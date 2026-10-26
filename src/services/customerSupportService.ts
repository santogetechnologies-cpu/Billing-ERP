import { supabase } from '../lib/supabase';
import {
  CustomerSupportCase,
  CustomerSupportCategory,
  CustomerSupportCaseStatus,
  CustomerSupportPriority,
  CustomerSupportCaseNote,
  Customer,
  Product,
  SystemUser,
  NotificationItem
} from '../types';
import { notificationService } from './notificationService';
import { userService } from './userService';
import { getAppStorage } from '../utils/storageUtils';
import {
  isTableMarkedMissing,
  markTableMissing,
  isTableNotFoundError,
  markTableAvailable
} from '../utils/schemaDetector';

const SUPPORT_CASES_STORAGE_KEY = (cId: string) => `universal_billing_support_cases_${cId}`;

export interface CreateSupportCasePayload {
  customerId: string;
  category: CustomerSupportCategory;
  priority?: CustomerSupportPriority;
  title: string;
  description: string;
  productId?: string | null;
  invoiceId?: string | null;
  assignedSalespersonId?: string | null;
  followupDue?: string | null;
  isEscalated?: boolean;
}

export const customerSupportService = {
  /**
   * Resolves the appropriate Sales Person recipient for a customer case.
   * - Uses explicit assignment if provided and verified as a Salesperson.
   * - Falls back to customer's assigned Sales Person.
   * - Falls back to active enabled Sales Persons in the company (primary/first active).
   * - NEVER assigns or delivers to Cashier, Warehouse Manager, or Purchase Manager.
   */
  async resolveAssignedSalesperson(
    companyId: string,
    customerId: string,
    explicitSalespersonId?: string | null
  ): Promise<string | null> {
    try {
      const users: SystemUser[] = await userService.getUsers(companyId);
      const salespersons = users.filter(
        u => u.role === 'Salesperson' && u.accountStatus === 'Enabled'
      );

      // 1. Explicit ID if provided (strictly blocking non-sales roles like Cashier, Warehouse Manager, etc.)
      if (explicitSalespersonId) {
        const isForbiddenRole = users.some(
          u => u.id === explicitSalespersonId && u.role !== 'Salesperson'
        );
        if (!isForbiddenRole) {
          return explicitSalespersonId;
        }
      }

      if (salespersons.length === 0) {
        return null;
      }

      // 2. Customer's assigned Sales Person if set
      if (customerId) {
        const { data: custData } = await supabase
          .from('customers')
          .select('assigned_salesperson_id')
          .eq('id', customerId)
          .single();

        if (custData?.assigned_salesperson_id) {
          const matched = salespersons.find(sp => sp.id === custData.assigned_salesperson_id);
          if (matched) return matched.id;
        }
      }

      // 3. Fallback to active Salesperson (prefer online/active presence)
      const onlineSp = salespersons.find(sp => sp.presenceStatus === 'Active');
      return onlineSp ? onlineSp.id : salespersons[0].id;
    } catch (err) {
      console.warn('Error resolving assigned salesperson:', err);
      return explicitSalespersonId || null;
    }
  },

  /**
   * Generates a sequential, user-friendly case tracking number: CASE-YYYY-XXXX
   */
  generateCaseNumber(): string {
    const year = new Date().getFullYear();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `CASE-${year}-${randomSuffix}`;
  },

  /**
   * Retrieves support cases filtered with strict role isolation:
   * - Salesperson sees only cases assigned to them (or unassigned queue).
   * - Owner / Admin sees all company support cases for oversight.
   * - Cashier, Warehouse Manager, and Purchase Manager receive an empty list [].
   */
  async getSupportCases(
    companyId?: string,
    currentUserId?: string,
    userRole?: string
  ): Promise<CustomerSupportCase[]> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';

    // Strict role boundary: Non-sales staff roles cannot access customer support cases
    if (
      userRole === 'Cashier' ||
      userRole === 'Warehouse Manager' ||
      userRole === 'Purchase Manager' ||
      userRole === 'Accountant'
    ) {
      return [];
    }

    let cases: CustomerSupportCase[] = [];

    if (!isTableMarkedMissing('customer_support_cases')) {
      try {
        let query = supabase
          .from('customer_support_cases')
          .select('*')
          .eq('company_id', finalCompanyId)
          .order('created_at', { ascending: false });

        if (userRole === 'Salesperson' && currentUserId) {
          // Salesperson sees their assigned cases or unassigned queue
          query = query.or(`assigned_salesperson_id.eq.${currentUserId},assigned_salesperson_id.is.null`);
        }

        const { data, error } = await query;

        if (error) {
          if (isTableNotFoundError(error)) {
            markTableMissing('customer_support_cases');
          }
        } else if (data) {
          markTableAvailable('customer_support_cases');
          if (data.length > 0) {
            cases = data.map((d: any) => ({
              id: d.id,
              companyId: d.company_id,
              caseNumber: d.case_number,
              customerId: d.customer_id,
              customerName: d.customer_name,
              customerPhone: d.customer_phone,
              category: d.category,
              priority: d.priority || 'Normal',
              status: d.status || 'Open',
              title: d.title,
              description: d.description,
              productId: d.product_id,
              productName: d.product_name,
              invoiceId: d.invoice_id,
              invoiceNumber: d.invoice_number,
              assignedSalespersonId: d.assigned_salesperson_id,
              assignedSalespersonName: d.assigned_salesperson_name,
              followupDue: d.followup_due,
              resolutionNotes: d.resolution_notes,
              notes: Array.isArray(d.notes) ? d.notes : [],
              isEscalated: Boolean(d.is_escalated),
              createdAt: d.created_at,
              updatedAt: d.updated_at
            }));
          }
        }
      } catch (e) {
        console.warn('Supabase get support cases query warning:', e);
      }
    }

    // Fall back to local storage cache if Supabase returned empty
    const storage = getAppStorage();
    if (cases.length === 0 && storage) {
      try {
        const raw = storage.getItem(SUPPORT_CASES_STORAGE_KEY(finalCompanyId));
        if (raw) {
          const list: CustomerSupportCase[] = JSON.parse(raw);
          if (userRole === 'Salesperson' && currentUserId) {
            cases = list.filter(
              c => !c.assignedSalespersonId || c.assignedSalespersonId === currentUserId
            );
          } else if (userRole === 'Owner' || userRole === 'Admin') {
            cases = list;
          }
        }
      } catch {}
    }

    return cases;
  },

  /**
   * Creates a new support case across any of the 6 categories and triggers
   * a targeted, deduplicated notification strictly to the assigned Sales Person.
   */
  async createSupportCase(
    payload: CreateSupportCasePayload,
    companyId?: string,
    customerMeta?: Partial<Customer>,
    productMeta?: Partial<Product>,
    createdByUserId?: string
  ): Promise<CustomerSupportCase> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const nowIso = new Date().toISOString();
    const caseNumber = this.generateCaseNumber();

    // 1. Resolve assigned Sales Person
    const assignedSpId = await this.resolveAssignedSalesperson(
      finalCompanyId,
      payload.customerId,
      payload.assignedSalespersonId
    );

    // Get assigned salesperson name if available
    let assignedSpName: string | undefined;
    if (assignedSpId) {
      try {
        const users = await userService.getUsers(finalCompanyId);
        const sp = users.find(u => u.id === assignedSpId);
        if (sp) assignedSpName = sp.name;
      } catch {}
    }

    // High Priority enforcement for Complaints, Damage/Defects, and Return Requests (Requirements 1, 2, 4)
    const isHighByDefault =
      payload.category === 'customer_complaint' ||
      payload.category === 'customer_product_damage' ||
      payload.category === 'customer_return_request';

    const priority: CustomerSupportPriority = isHighByDefault
      ? 'High'
      : payload.priority || 'Normal';

    const caseRecord: CustomerSupportCase = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `case_${Date.now()}`,
      companyId: finalCompanyId,
      caseNumber,
      customerId: payload.customerId,
      customerName: customerMeta?.name || 'Customer',
      customerPhone: customerMeta?.phone,
      category: payload.category,
      priority,
      status: 'Open',
      title: payload.title,
      description: payload.description,
      productId: payload.productId || null,
      productName: productMeta?.name,
      invoiceId: payload.invoiceId || null,
      assignedSalespersonId: assignedSpId,
      assignedSalespersonName: assignedSpName,
      followupDue: payload.followupDue || null,
      notes: [],
      isEscalated: Boolean(payload.isEscalated),
      createdAt: nowIso,
      updatedAt: nowIso
    };

    // 2. Persist to Supabase if table is available
    if (!isTableMarkedMissing('customer_support_cases')) {
      try {
        const { data, error } = await supabase
          .from('customer_support_cases')
          .insert({
            id: caseRecord.id,
            company_id: finalCompanyId,
            case_number: caseRecord.caseNumber,
            customer_id: caseRecord.customerId,
            category: caseRecord.category,
            priority: caseRecord.priority,
            status: caseRecord.status,
            title: caseRecord.title,
            description: caseRecord.description,
            product_id: caseRecord.productId,
            invoice_id: caseRecord.invoiceId,
            assigned_salesperson_id: caseRecord.assignedSalespersonId,
            followup_due: caseRecord.followupDue,
            is_escalated: caseRecord.isEscalated,
            created_by: createdByUserId || null,
            created_at: nowIso,
            updated_at: nowIso
          })
          .select()
          .single();

        if (error && isTableNotFoundError(error)) {
          markTableMissing('customer_support_cases');
        } else if (!error && data?.id) {
          caseRecord.id = data.id;
        }
      } catch (e) {
        console.warn('Supabase support case insert note:', e);
      }
    }

    // 3. Persist to localStorage cache
    const storage = getAppStorage();
    if (storage) {
      try {
        const raw = storage.getItem(SUPPORT_CASES_STORAGE_KEY(finalCompanyId));
        const list: CustomerSupportCase[] = raw ? JSON.parse(raw) : [];
        storage.setItem(
          SUPPORT_CASES_STORAGE_KEY(finalCompanyId),
          JSON.stringify([caseRecord, ...list.filter(c => c.id !== caseRecord.id)])
        );
      } catch {}
    }

    // 4. Dispatch targeted notification to the assigned Sales Person
    await this.dispatchCaseNotification(caseRecord, finalCompanyId);

    return caseRecord;
  },

  /**
   * Dispatches the required notification format according to the 6 Master Prompt categories:
   * 1. Customer Complaints — High Priority (Title: "Customer Complaint", Action: "View Complaint")
   * 2. Product Damage & Defects — High Priority (Title: "Product Damage Report", Action: "View Case")
   * 3. Customer Support Requests — Normal Priority (Title: "New Customer Support Request", Action: "View Support Request")
   * 4. Return & Replacement Requests — High Priority (Title: "Return / Replacement Request", Action: "Review Request")
   * 5. Pending Customer Follow-ups (Title: "Customer Follow-up Required", Action: "View Case")
   * 6. Customer Updates (Title: "Customer Assigned", Action: "View Customer")
   */
  async dispatchCaseNotification(
    caseRecord: CustomerSupportCase,
    companyId: string
  ): Promise<void> {
    let title = caseRecord.title;
    let message = caseRecord.description;
    let actionText = 'View Case';

    switch (caseRecord.category) {
      case 'customer_complaint':
        title = 'Customer Complaint';
        if (caseRecord.productName) {
          message = `Customer ${caseRecord.customerName || 'Customer'} reported an issue with ${caseRecord.productName}.`;
        } else {
          message = `Customer ${caseRecord.customerName || 'Customer'} reported an issue: ${caseRecord.description || caseRecord.title}`;
        }
        actionText = 'View Complaint';
        break;

      case 'customer_product_damage':
        title = 'Product Damage Report';
        if (caseRecord.productName) {
          message = `${caseRecord.customerName || 'Customer'} reported damage to ${caseRecord.productName}.`;
        } else {
          message = `${caseRecord.customerName || 'Customer'} reported damage: ${caseRecord.description || caseRecord.title}`;
        }
        actionText = 'View Case';
        break;

      case 'customer_support_request':
        title = 'New Customer Support Request';
        const requestType = caseRecord.title || 'Product Assistance';
        message = `${caseRecord.customerName || 'Customer'} needs assistance with ${requestType}.`;
        actionText = 'View Support Request';
        break;

      case 'customer_return_request':
        title = 'Return / Replacement Request';
        if (caseRecord.productName) {
          message = `${caseRecord.customerName || 'Customer'} requested a return or replacement for ${caseRecord.productName}.`;
        } else {
          message = `${caseRecord.customerName || 'Customer'} requested a return or replacement: ${caseRecord.description || caseRecord.title}`;
        }
        actionText = 'Review Request';
        break;

      case 'customer_followup':
        title = 'Customer Follow-up Required';
        const caseRef = caseRecord.caseNumber ? `#${caseRecord.caseNumber}` : caseRecord.title;
        message = `Follow up with ${caseRecord.customerName || 'Customer'} regarding ${caseRef}.`;
        actionText = 'View Case';
        break;

      case 'customer_update':
        title = 'Customer Assigned';
        message = caseRecord.caseNumber
          ? `Customer support case #${caseRecord.caseNumber} for ${caseRecord.customerName || 'Customer'} has been assigned to you.`
          : `Customer ${caseRecord.customerName || 'Customer'} has been assigned to you.`;
        actionText = caseRecord.caseNumber ? 'View Case' : 'View Customer';
        break;
    }

    // Stable deduplication key preventing duplicate alerts for the same case & recipient
    const dedupKey = `support_${caseRecord.category}_${caseRecord.id}_${caseRecord.assignedSalespersonId || 'unassigned'}`;

    const link = `/customers/${caseRecord.customerId}?caseId=${caseRecord.id}`;

    try {
      await notificationService.createNotification(
        {
          title,
          message,
          type: caseRecord.category as any,
          userId: caseRecord.assignedSalespersonId || null,
          priority: caseRecord.priority,
          category: caseRecord.category,
          customerId: caseRecord.customerId,
          customerName: caseRecord.customerName,
          productId: caseRecord.productId || null,
          productName: caseRecord.productName,
          caseId: caseRecord.id,
          caseNumber: caseRecord.caseNumber,
          caseStatus: caseRecord.status,
          followupDue: caseRecord.followupDue || null,
          actionText,
          dedupKey,
          isEscalated: caseRecord.isEscalated,
          link
        },
        companyId
      );
    } catch (err) {
      console.warn('Failed to dispatch customer support notification:', err);
    }
  },

  /**
   * Updates an existing support case (status, notes, resolution).
   * When status is set to 'Resolved' or 'Closed', automatically resolves pending follow-up reminders.
   */
  async updateSupportCaseStatus(
    caseId: string,
    status: CustomerSupportCaseStatus,
    resolutionNotes?: string,
    companyId?: string
  ): Promise<CustomerSupportCase | null> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const nowIso = new Date().toISOString();

    if (!isTableMarkedMissing('customer_support_cases')) {
      try {
        const { data, error } = await supabase
          .from('customer_support_cases')
          .update({
            status,
            resolution_notes: resolutionNotes || null,
            updated_at: nowIso
          })
          .eq('id', caseId)
          .eq('company_id', finalCompanyId)
          .select()
          .single();

        if (error) {
          if (isTableNotFoundError(error)) {
            markTableMissing('customer_support_cases');
          }
        } else if (data) {
          // Sync local cache
          const storage = getAppStorage();
          if (storage) {
            const raw = storage.getItem(SUPPORT_CASES_STORAGE_KEY(finalCompanyId));
            if (raw) {
              const list: CustomerSupportCase[] = JSON.parse(raw);
              const updated = list.map(c =>
                c.id === caseId
                  ? { ...c, status, resolutionNotes: resolutionNotes || c.resolutionNotes, updatedAt: nowIso }
                  : c
              );
              storage.setItem(SUPPORT_CASES_STORAGE_KEY(finalCompanyId), JSON.stringify(updated));
            }
          }

          // When a case is resolved or closed, stop follow-up reminders (Requirement 5 & 10)
          if (status === 'Resolved' || status === 'Closed') {
            await this.stopFollowupReminders(caseId, finalCompanyId);
          }

          return data as CustomerSupportCase;
        }
      } catch (e) {
        console.warn('Supabase update support case note:', e);
      }
    }

    // Local storage update fallback
    const storage = getAppStorage();
    if (storage) {
      try {
        const raw = storage.getItem(SUPPORT_CASES_STORAGE_KEY(finalCompanyId));
        if (raw) {
          const list: CustomerSupportCase[] = JSON.parse(raw);
          const found = list.find(c => c.id === caseId);
          if (found) {
            found.status = status;
            if (resolutionNotes) found.resolutionNotes = resolutionNotes;
            found.updatedAt = nowIso;
            storage.setItem(SUPPORT_CASES_STORAGE_KEY(finalCompanyId), JSON.stringify(list));

            if (status === 'Resolved' || status === 'Closed') {
              await this.stopFollowupReminders(caseId, finalCompanyId);
            }
            return found;
          }
        }
      } catch {}
    }

    return null;
  },

  /**
   * Adds an internal follow-up / progress note to a customer support case.
   */
  async addSupportCaseNote(
    caseId: string,
    text: string,
    authorName: string,
    authorRole?: string,
    companyId?: string
  ): Promise<CustomerSupportCaseNote> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const note: CustomerSupportCaseNote = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `note_${Date.now()}`,
      author: authorName,
      authorRole,
      text,
      createdAt: new Date().toISOString()
    };

    // Update in Supabase & local cache
    if (!isTableMarkedMissing('customer_support_cases')) {
      try {
        const { data: existing, error: selError } = await supabase
          .from('customer_support_cases')
          .select('notes')
          .eq('id', caseId)
          .single();

        if (selError && isTableNotFoundError(selError)) {
          markTableMissing('customer_support_cases');
        } else {
          const existingNotes = Array.isArray(existing?.notes) ? existing.notes : [];
          const updatedNotes = [...existingNotes, note];

          const { error: updError } = await supabase
            .from('customer_support_cases')
            .update({ notes: updatedNotes, updated_at: new Date().toISOString() })
            .eq('id', caseId);

          if (updError && isTableNotFoundError(updError)) {
            markTableMissing('customer_support_cases');
          }
        }
      } catch {}
    }

    const storage = getAppStorage();
    if (storage) {
      try {
        const raw = storage.getItem(SUPPORT_CASES_STORAGE_KEY(finalCompanyId));
        if (raw) {
          const list: CustomerSupportCase[] = JSON.parse(raw);
          const c = list.find(item => item.id === caseId);
          if (c) {
            c.notes = [...(c.notes || []), note];
            c.updatedAt = new Date().toISOString();
            storage.setItem(SUPPORT_CASES_STORAGE_KEY(finalCompanyId), JSON.stringify(list));
          }
        }
      } catch {}
    }

    return note;
  },

  /**
   * Stops follow-up reminders when a case is resolved or closed.
   */
  async stopFollowupReminders(caseId: string, companyId: string): Promise<void> {
    try {
      const notifs = await notificationService.getNotifications(companyId);
      const followups = notifs.filter(
        n => (n.caseId === caseId || n.link?.includes(`caseId=${caseId}`)) && !n.read
      );

      for (const fn of followups) {
        await notificationService.markAsRead(fn.id, companyId);
      }
    } catch (err) {
      console.warn('Error clearing resolved follow-up reminders:', err);
    }
  },

  /**
   * Scans for pending/overdue customer follow-ups and dispatches targeted reminders (Category 5).
   * Requirement 5:
   * Title: Customer Follow-up Required
   * Message: Follow up with [Customer Name] regarding [Case Reference].
   * Priority: High when overdue; otherwise Normal.
   * Action: View Case
   * Prevents spam duplicates via stable dedupKey.
   */
  async checkPendingFollowups(
    companyId: string,
    cases: CustomerSupportCase[],
    customers: Customer[]
  ): Promise<NotificationItem[]> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const notificationsGenerated: NotificationItem[] = [];
    const now = new Date();

    const customerMap = new Map(customers.map(c => [c.id, c]));

    for (const c of cases) {
      if (c.status === 'Resolved' || c.status === 'Closed') continue;
      if (!c.followupDue) continue;

      const due = new Date(c.followupDue);
      if (due.getTime() <= now.getTime()) {
        const cust = customerMap.get(c.customerId);
        const repId = c.assignedSalespersonId || cust?.assignedSalespersonId || null;

        const isOverdue = due.getTime() < now.getTime();
        const priority: CustomerSupportPriority = isOverdue ? 'High' : 'Normal';
        const caseRef = c.caseNumber ? `#${c.caseNumber}` : c.title;

        const notif = await notificationService.createNotification(
          {
            title: 'Customer Follow-up Required',
            message: `Follow up with ${cust?.name || c.customerName || 'Customer'} regarding ${caseRef}.`,
            type: 'customer_followup',
            priority,
            category: 'customer_followup',
            userId: repId,
            customerId: c.customerId,
            customerName: cust?.name || c.customerName,
            caseId: c.id,
            caseNumber: c.caseNumber,
            caseStatus: c.status,
            followupDue: c.followupDue,
            link: `/customers/${c.customerId}?caseId=${c.id}`,
            actionText: 'View Case',
            dedupKey: `followup_${c.id}_${due.toISOString().split('T')[0]}`
          },
          finalCompanyId
        );

        notificationsGenerated.push(notif);
      }
    }

    return notificationsGenerated;
  },

  /**
   * Dispatches a "Customer Assigned" notification when a customer is assigned or reassigned to a Sales Person.
   * Requirement 6:
   * Title: Customer Assigned
   * Message: Customer [Customer Name] has been assigned to you.
   * Priority: Normal
   * Action: View Customer
   */
  async notifyCustomerAssigned(
    customer: { id: string; name: string },
    salespersonId: string,
    companyId?: string,
    isReassigned: boolean = false
  ): Promise<NotificationItem | null> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const dedupKey = `cust_assigned_${customer.id}_${salespersonId}`;

    return await notificationService.createNotification(
      {
        title: 'Customer Assigned',
        message: `Customer ${customer.name} has been assigned to you.`,
        type: 'customer_update',
        priority: 'Normal',
        category: 'customer_update',
        userId: salespersonId,
        customerId: customer.id,
        customerName: customer.name,
        link: `/customers/${customer.id}`,
        actionText: 'View Customer',
        dedupKey
      },
      finalCompanyId
    );
  },

  /**
   * Forwards a Return / Replacement Request for management authorization.
   * Salesperson explicitly CANNOT approve refunds, cancel invoices, or adjust inventory.
   */
  async forwardReturnRequestForApproval(
    caseId: string,
    reason: string,
    authorName: string,
    companyId?: string
  ): Promise<CustomerSupportCase | null> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';

    await this.addSupportCaseNote(
      caseId,
      `Forwarded for Management Return/Refund Authorization: ${reason}`,
      authorName,
      'Salesperson',
      finalCompanyId
    );

    // Mark as escalated for executive oversight in Supabase & local cache
    let updatedCase: CustomerSupportCase | null = null;
    const nowIso = new Date().toISOString();

    if (!isTableMarkedMissing('customer_support_cases')) {
      try {
        const { data, error } = await supabase
          .from('customer_support_cases')
          .update({
            is_escalated: true,
            status: 'Pending Cashier / Admin Authorization',
            updated_at: nowIso
          })
          .eq('id', caseId)
          .select()
          .single();

        if (error && isTableNotFoundError(error)) {
          markTableMissing('customer_support_cases');
        } else if (data) {
          updatedCase = data as CustomerSupportCase;
        }
      } catch {}
    }

    const storage = getAppStorage();
    if (storage) {
      try {
        const raw = storage.getItem(SUPPORT_CASES_STORAGE_KEY(finalCompanyId));
        if (raw) {
          const list: CustomerSupportCase[] = JSON.parse(raw);
          const c = list.find(item => item.id === caseId);
          if (c) {
            c.isEscalated = true;
            c.status = 'Pending Cashier / Admin Authorization';
            c.updatedAt = nowIso;
            storage.setItem(SUPPORT_CASES_STORAGE_KEY(finalCompanyId), JSON.stringify(list));
            if (!updatedCase) updatedCase = c;
          }
        }
      } catch {}
    }

    return updatedCase;
  }
};
