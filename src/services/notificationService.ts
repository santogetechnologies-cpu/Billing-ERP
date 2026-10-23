import { supabase } from '../lib/supabase';
import { NotificationItem, SalesInvoice, PaymentRecord, CustomerSupportPriority } from '../types';
import { getAppStorage } from '../utils/storageUtils';

const STORAGE_KEY = (cId: string) => `universal_billing_notifications_${cId}`;

/**
 * Safely parses the notification creation timestamp to epoch milliseconds.
 * Handles ISO strings, formatted time strings, "Just now", and missing timestamps safely.
 * Guaranteed never to throw, never to crash, and never to return NaN.
 */
export function parseNotificationTime(item: NotificationItem): number {
  if (!item) return 0;

  // 1. Prioritize explicit ISO createdAt timestamp
  if (item.createdAt) {
    const t = new Date(item.createdAt).getTime();
    if (!isNaN(t) && t > 0) return t;
  }

  // 2. Fall back to timestamp string
  if (item.timestamp) {
    if (item.timestamp === 'Just now') {
      return Date.now();
    }

    const t = new Date(item.timestamp).getTime();
    if (!isNaN(t) && t > 0) return t;

    // Handle "hh:mm[:ss] [AM|PM]" formatted strings
    const timeMatch = item.timestamp.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      const seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
      const meridiem = timeMatch[4]?.toUpperCase();
      if (meridiem === 'PM' && hours < 12) hours += 12;
      if (meridiem === 'AM' && hours === 12) hours = 0;
      const now = new Date();
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, seconds, 0);
      return d.getTime();
    }
  }

  return 0;
}

/**
 * Deterministically sorts notifications according to ERP system requirements:
 * 1. Unread notifications first (newest unread at the very top).
 * 2. Read notifications below unread notifications (newest read at top of the read section).
 * 3. Sorted by actual creation timestamp descending within each group.
 * 4. Deterministic secondary tie-breaker by id.
 * Pure/immutable function: does not mutate the input array.
 */
export function sortNotifications(items: NotificationItem[]): NotificationItem[] {
  if (!Array.isArray(items)) return [];

  return [...items].sort((a, b) => {
    // 1. Unread before read
    const aRead = Boolean(a.read);
    const bRead = Boolean(b.read);
    if (!aRead && bRead) return -1;
    if (aRead && !bRead) return 1;

    // 2. Newest notification first within each group (by actual creation timestamp)
    const timeA = parseNotificationTime(a);
    const timeB = parseNotificationTime(b);
    if (timeB !== timeA) {
      return timeB - timeA;
    }

    // 3. Stable secondary tie-breaker
    return (a.id || '').localeCompare(b.id || '');
  });
}

/**
 * Checks whether a notification belongs to any of the 6 customer support categories:
 * 1. Customer Complaints — High Priority
 * 2. Product Damage & Defects
 * 3. Customer Support Requests
 * 4. Return & Replacement Requests
 * 5. Pending Customer Follow-ups
 * 6. Customer Updates
 */
export function isCustomerSupportNotification(item: { type: string; category?: string } | NotificationItem): boolean {
  if (!item) return false;
  const csCategories = [
    'customer_complaint',
    'customer_product_damage',
    'customer_support_request',
    'customer_return_request',
    'customer_followup',
    'customer_update'
  ];
  return (
    csCategories.includes(item.type) ||
    (Boolean((item as any).category) && csCategories.includes((item as any).category))
  );
}

export const notificationService = {
  /**
   * Helper to check recipient authorization consistently across queries and real-time events.
   * - Sales Persons receive Customer Support notifications assigned to them.
   * - Cashiers, Warehouse Managers, and Purchase Managers NEVER receive customer support notifications.
   * - Owners & Admins receive customer support alerts ONLY when explicitly escalated or directly addressed.
   * - Warehouse Managers receive stock alerts addressed specifically to them for their assigned warehouses.
   */
  isAuthorizedRecipient(item: NotificationItem, userId?: string, role?: string): boolean {
    // 0. Internal / System queries without user/role context see all for deduplication/resolution
    if (!role && !userId) {
      return true;
    }

    const isStockAlert = (type: string) =>
      type === 'low_stock' || type === 'limited_stock' || type === 'out_of_stock' || type === 'stock_damage';

    const isPRCancellation = (it: NotificationItem) => {
      if (it.type !== 'purchase_request') return false;
      const titleLower = (it.title || '').toLowerCase();
      const messageLower = (it.message || '').toLowerCase();
      return (
        titleLower.includes('cancel') ||
        titleLower.includes('cancelled') ||
        messageLower.includes('cancelled') ||
        messageLower.includes('status: cancelled')
      );
    };

    const isPRCreationOrRoutine = (it: NotificationItem) => {
      if (it.type !== 'purchase_request') return false;
      const titleLower = (it.title || '').toLowerCase();
      const messageLower = (it.message || '').toLowerCase();
      return (
        titleLower.startsWith('new purchase request') ||
        messageLower.includes('requested replenishment')
      );
    };

    // =========================================================================
    // 1. "MISSING WAREHOUSE MANAGER ASSIGNMENT" SYSTEM NOTIFICATIONS
    // Route ONLY to authorized executive roles responsible for warehouse assignment (Owner and Admin).
    // Strictly FORBIDDEN for Salesperson, Cashier, Warehouse Manager, Purchase Manager, and Accountant.
    // =========================================================================
    if (
      item.title === 'Missing Warehouse Manager Assignment' ||
      (item.message && item.message.includes('no Warehouse Manager is assigned'))
    ) {
      return role === 'Owner' || role === 'Admin';
    }

    // =========================================================================
    // 2. SALES PERSON ROLE STRICT BOUNDARY:
    // The Sales Person notification center MUST show ONLY these 6 categories:
    //   - Customer Complaints (customer_complaint)
    //   - Product Damage & Defects (customer_product_damage)
    //   - Customer Support Requests (customer_support_request)
    //   - Return & Replacement Requests (customer_return_request)
    //   - Pending Customer Follow-ups (customer_followup)
    //   - Relevant Customer Updates (customer_update)
    // Warehouse assignment, warehouse receiving, stock damage, stock alerts,
    // purchase requests, and all warehouse operational / system notifications
    // MUST NEVER appear for the Sales Person.
    // =========================================================================
    if (role === 'Salesperson') {
      if (!isCustomerSupportNotification(item)) {
        return false;
      }
      if (item.userId) {
        return item.userId === userId;
      }
      // Unassigned customer support cases in company queue: visible unless escalated
      return !item.isEscalated;
    }

    // =========================================================================
    // 3. CUSTOMER SUPPORT NOTIFICATIONS (for non-Salesperson roles)
    // Strictly block Cashier, Warehouse Manager, Purchase Manager, and Accountant.
    // Restrict Owner / Admin to explicitly escalated or directly assigned cases.
    // =========================================================================
    if (isCustomerSupportNotification(item)) {
      if (
        role === 'Cashier' ||
        role === 'Warehouse Manager' ||
        role === 'Purchase Manager' ||
        role === 'Accountant'
      ) {
        return false;
      }

      if (role === 'Owner' || role === 'Admin') {
        // Owner/Admin oversight: only delivered if explicitly escalated or directly addressed
        return Boolean(item.isEscalated) || (Boolean(item.userId) && item.userId === userId);
      }

      return false;
    }

    // 1. WAREHOUSE MANAGER ROLE RESTRICTION:
    // A Warehouse Manager MUST ONLY receive notifications from the 5 permitted categories:
    //   A. Low Stock Alert (low_stock)
    //   B. Out of Stock Alert (out_of_stock)
    //   C. Limited Stock Alert (limited_stock)
    //   D. Purchase Request Cancellation (purchase_request cancellation addressed to this manager)
    //   E. Stock Damage Alert (stock_damage)
    // Strictly EXCLUDES:
    //   - Customer support, complaints, damages, returns, follow-ups
    //   - Routine PR creation notifications ("New Purchase Request: PR-...")
    //   - General purchasing updates
    //   - Unrelated sales, accounting, user management, or administrative notifications
    if (role === 'Warehouse Manager') {
      if (!userId) return false;

      // Category A, B, C, E: Stock alerts & damage alerts
      if (isStockAlert(item.type)) {
        return item.userId === userId;
      }

      // Category D: Purchase Request Cancellation
      if (isPRCancellation(item) && !isPRCreationOrRoutine(item)) {
        return item.userId === userId;
      }

      // All other notification types are strictly excluded for Warehouse Manager
      return false;
    }

    // 2. PURCHASE MANAGER ROLE RESTRICTION:
    // A Purchase Manager MUST ONLY receive notifications relevant to purchasing,
    // supplier management, purchase requests, purchase orders, and replenishment.
    // Strictly EXCLUDES:
    //   - Customer complaints & support notifications
    //   - Sales invoices & POS billing
    //   - Unrelated finance, payment, expense, or user activity notifications
    if (role === 'Purchase Manager') {
      // A. Strictly block forbidden notification types
      const forbiddenTypes = [
        'customer_complaint',
        'customer_product_damage',
        'customer_support_request',
        'customer_return_request',
        'customer_followup',
        'customer_update',
        'overdue_invoice',
        'payment_received',
        'sale',
        'pos_billing',
        'pos_sale',
        'credit_limit',
        'expense',
        'accounting',
        'journal',
        'tax',
        'user_activity',
        'user_session',
        'system'
      ];
      if (forbiddenTypes.includes(item.type) || isCustomerSupportNotification(item)) {
        return false;
      }

      // Strictly block links to forbidden modules
      if (item.link) {
        const linkLower = item.link.toLowerCase();
        if (
          linkLower.startsWith('/sales') ||
          linkLower.startsWith('/payments') ||
          linkLower.startsWith('/accounting') ||
          linkLower.startsWith('/users/activity') ||
          linkLower.startsWith('/users')
        ) {
          return false;
        }
      }

      // B. Urgent Stock Alerts & Damage Alerts (low_stock, limited_stock, out_of_stock, stock_damage)
      if (isStockAlert(item.type)) {
        return true;
      }

      // C. Purchase Requests & Purchase Orders
      if (item.type === 'purchase_request' || item.type === 'purchase_order') {
        const titleLower = (item.title || '').toLowerCase();
        const messageLower = (item.message || '').toLowerCase();

        const isApprovalNotice = titleLower.includes('approved') || messageLower.includes('approved by');
        const isRejectionNotice = titleLower.includes('rejected') || messageLower.includes('rejected by');
        if ((isApprovalNotice || isRejectionNotice) && item.userId && item.userId !== userId) {
          return false;
        }

        return true;
      }

      // D. Supplier Updates
      if (
        item.type === 'supplier_update' ||
        item.type === 'supplier' ||
        (item.title || '').toLowerCase().includes('supplier') ||
        (item.message || '').toLowerCase().includes('supplier')
      ) {
        return true;
      }

      // E. Direct notifications specifically addressed to this Purchase Manager (non-customer support)
      if (item.userId && item.userId === userId) {
        return true;
      }

      // Deny all other unrelated notifications
      return false;
    }

    // 3. Stock alerts (low_stock, limited_stock, out_of_stock, stock_damage):
    // Delivered ONLY to the assigned manager (item.userId === userId).
    if (isStockAlert(item.type)) {
      if (!item.userId || !userId) {
        return false;
      }
      return item.userId === userId;
    }

    // 4. Administrative system notifications:
    if (item.type === 'system') {
      if (item.userId) return item.userId === userId;
      return role === 'Owner' || role === 'Admin';
    }

    // 5. Cashier:
    // Strictly blocked from purchase requests, stock alerts, and customer support notifications
    if (role === 'Cashier') {
      if (item.type === 'purchase_request' || isCustomerSupportNotification(item)) return false;
      return !item.userId || item.userId === userId;
    }

    // 6. Sales Persons:
    // Strictly blocked from purchase requests and stock alerts
    if (role === 'Salesperson') {
      if (item.type === 'purchase_request' || isStockAlert(item.type)) return false;
      return !item.userId || item.userId === userId;
    }

    // 7. Executive Roles: Owner and Admin can oversee general company non-stock alerts
    if (role === 'Owner' || role === 'Admin') {
      return true;
    }

    // 8. Default safe fallback for other staff roles
    return !item.userId || item.userId === userId;
  },

  /**
   * Retrieves notifications filtered strictly by company and recipient authorization,
   * sorted deterministically: unread first (newest unread at the top), then read below (newest read at top).
   */
  async getNotifications(companyId?: string, userId?: string, role?: string): Promise<NotificationItem[]> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    let items: NotificationItem[] = [];

    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('company_id', finalCompanyId);

      // Backend/database level filtering: confine Salesperson query strictly to customer support categories
      if (role === 'Salesperson') {
        const csTypes = [
          'customer_complaint',
          'customer_product_damage',
          'customer_support_request',
          'customer_return_request',
          'customer_followup',
          'customer_update'
        ];
        query = query.or(`type.in.(${csTypes.join(',')}),category.in.(${csTypes.join(',')})`);
      } else if (role === 'Warehouse Manager' && userId) {
        query = query.eq('user_id', userId);
      }

      query = query.order('created_at', { ascending: false }).limit(100);

      const { data, error } = await query;

      if (!error && data && data.length > 0) {
        items = data.map((d: any) => {
          let invoiceId = d.invoice_id || d.invoiceId || null;
          let paymentId = d.payment_id || d.paymentId || null;
          let invoiceNumber = d.invoice_number || d.invoiceNumber || null;
          let paymentNumber = d.payment_number || d.paymentNumber || null;

          if (d.link) {
            try {
              const url = new URL(d.link, 'https://universal-billing.local');
              if (!invoiceId) invoiceId = url.searchParams.get('invoiceId') || (d.type === 'overdue_invoice' ? url.searchParams.get('id') : null);
              if (!invoiceNumber) invoiceNumber = url.searchParams.get('invoiceNumber');
              if (!paymentId) paymentId = url.searchParams.get('paymentId') || (d.type === 'payment_received' ? url.searchParams.get('id') : null);
              if (!paymentNumber) paymentNumber = url.searchParams.get('paymentNumber');
              if (!invoiceId && d.type === 'payment_received') invoiceId = url.searchParams.get('invoiceId');
            } catch {}
          }

          if (!invoiceNumber && d.type === 'overdue_invoice') {
            const text = `${d.title || ''} ${d.message || ''}`;
            const m = text.match(/#?([A-Za-z]{3,4}-\d{4}-\d{3,})/i) || text.match(/#(INV-[\w-]+)/i);
            if (m && m[1]) invoiceNumber = m[1];
          }

          if (!paymentNumber && d.type === 'payment_received') {
            const text = `${d.title || ''} ${d.message || ''}`;
            const m = text.match(/\b(REC-[\w-]+|PAY-[\w-]+)\b/i);
            if (m && m[1]) paymentNumber = m[1];
          }

          return {
            id: d.id,
            title: d.title,
            message: d.message,
            type: (d.type as any) || 'system',
            timestamp: d.created_at
              ? new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'Just now',
            createdAt: d.created_at || new Date().toISOString(),
            read: d.read ?? d.is_read ?? false,
            link: d.link || undefined,
            userId: d.user_id || null,
            warehouseId: d.warehouse_id || null,
            productId: d.product_id || null,
            invoiceId,
            paymentId,
            invoiceNumber,
            paymentNumber,
            priority: d.priority || (d.type === 'customer_complaint' ? 'High' : 'Normal'),
            category: d.category || (isCustomerSupportNotification(d) ? d.type : undefined),
            customerId: d.customer_id || null,
            customerName: d.customer_name || d.metadata?.customerName || undefined,
            productName: d.product_name || d.metadata?.productName || undefined,
            caseId: d.case_id || null,
            caseNumber: d.case_number || d.metadata?.caseNumber || null,
            caseStatus: d.case_status || d.metadata?.caseStatus || 'Open',
            followupDue: d.followup_due || null,
            actionText: d.action_text || d.metadata?.actionText || undefined,
            dedupKey: d.dedup_key || null,
            isEscalated: Boolean(d.is_escalated)
          };
        });
      }
    } catch (err) {
      console.warn('Supabase getNotifications note:', err);
    }

    // Fallback/merge with local storage cache
    const storage = getAppStorage();
    if (storage) {
      try {
        const raw = storage.getItem(STORAGE_KEY(finalCompanyId));
        if (raw) {
          const cached: NotificationItem[] = JSON.parse(raw);
          const existingMap = new Map(items.map(i => [i.id, i]));
          cached.forEach(c => {
            const existing = existingMap.get(c.id);
            if (!existing) {
              items.push({
                ...c,
                createdAt: c.createdAt || (c.timestamp && c.timestamp !== 'Just now' ? c.timestamp : new Date().toISOString()),
                read: Boolean(c.read)
              });
            } else {
              // Synchronize read status if cache has newer read status
              if (c.read && !existing.read) {
                existing.read = true;
              }
              if (c.createdAt && !existing.createdAt) {
                existing.createdAt = c.createdAt;
              }
            }
          });
        }
      } catch {}
    }

    // Apply strict recipient authorization filtering and sort
    const authorized = items.filter(item => this.isAuthorizedRecipient(item, userId, role));
    return sortNotifications(authorized);
  },

  /**
   * Marks a notification as read in database and local cache.
   * Throws if database update fails so the caller does not falsely confirm read status.
   */
  async markAsRead(id: string, companyId?: string): Promise<void> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    let dbError: any = null;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (isUuid) {
      try {
        // Primary Supabase column is `is_read`
        let { error } = await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', id);

        if (error && (error.code === 'PGRST204' || error.message?.includes('is_read'))) {
          const fb = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('id', id);
          error = fb.error;
        }

        if (error) {
          dbError = error;
          console.warn('Failed to mark notification as read in DB:', error);
        }
      } catch (e) {
        dbError = e;
        console.warn('Failed to mark notification as read in DB:', e);
      }

      if (dbError) {
        throw dbError;
      }
    }

    const storage = getAppStorage();
    if (storage) {
      try {
        const raw = storage.getItem(STORAGE_KEY(finalCompanyId));
        if (raw) {
          const list: NotificationItem[] = JSON.parse(raw);
          const updated = sortNotifications(
            list.map(item => (item.id === id ? { ...item, read: true } : item))
          );
          storage.setItem(STORAGE_KEY(finalCompanyId), JSON.stringify(updated));
        }
      } catch {}
    }
  },

  /**
   * Marks all authorized notifications as read for company/user.
   */
  async markAllAsRead(companyId?: string, userId?: string, role?: string): Promise<void> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    let dbError: any = null;

    try {
      let query = supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('company_id', finalCompanyId);

      if (role && role !== 'Owner' && role !== 'Admin' && userId) {
        query = query.eq('user_id', userId);
      }

      let { error } = await query;
      if (error && (error.code === 'PGRST204' || error.message?.includes('is_read'))) {
        let fbQuery = supabase
          .from('notifications')
          .update({ read: true })
          .eq('company_id', finalCompanyId);
        if (role && role !== 'Owner' && role !== 'Admin' && userId) {
          fbQuery = fbQuery.eq('user_id', userId);
        }
        const fbRes = await fbQuery;
        error = fbRes.error;
      }

      if (error) {
        dbError = error;
        console.warn('Failed to mark all as read in DB:', error);
      }
    } catch (e) {
      dbError = e;
      console.warn('Failed to mark all as read in DB:', e);
    }

    if (dbError) {
      throw dbError;
    }

    const storage = getAppStorage();
    if (storage) {
      try {
        const raw = storage.getItem(STORAGE_KEY(finalCompanyId));
        if (raw) {
          const list: NotificationItem[] = JSON.parse(raw);
          const updated = sortNotifications(
            list.map(item => {
              if (!role || role === 'Owner' || role === 'Admin' || item.userId === userId) {
                return { ...item, read: true };
              }
              return item;
            })
          );
          storage.setItem(STORAGE_KEY(finalCompanyId), JSON.stringify(updated));
        }
      } catch {}
    }
  },

  /**
   * Auto-resolves / clears "Missing Warehouse Manager Assignment" alerts for a specific warehouse
   * once a Warehouse Manager has been assigned.
   */
  async resolveMissingWarehouseManagerAlert(warehouseId: string, companyId?: string): Promise<void> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true, read: true })
        .eq('company_id', finalCompanyId)
        .eq('warehouse_id', warehouseId)
        .eq('title', 'Missing Warehouse Manager Assignment');
    } catch (e) {
      console.warn('Failed to resolve missing warehouse manager alert in DB:', e);
    }

    const storage = getAppStorage();
    if (storage) {
      try {
        const raw = storage.getItem(STORAGE_KEY(finalCompanyId));
        if (raw) {
          const list: NotificationItem[] = JSON.parse(raw);
          const updated = sortNotifications(
            list.map(item =>
              item.warehouseId === warehouseId && item.title === 'Missing Warehouse Manager Assignment'
                ? { ...item, read: true }
                : item
            )
          );
          storage.setItem(STORAGE_KEY(finalCompanyId), JSON.stringify(updated));
        }
      } catch {}
    }
  },

  /**
   * Clears notifications for the company (or user-specific notifications)
   */
  async clearAll(companyId?: string, userId?: string, role?: string): Promise<void> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    try {
      let query = supabase.from('notifications').delete().eq('company_id', finalCompanyId);
      if (role === 'Salesperson') {
        if (!userId) return;
        query = query.eq('user_id', userId);
      } else if (role !== 'Owner' && role !== 'Admin' && userId) {
        query = query.eq('user_id', userId);
      }
      await query;
    } catch (e) {
      console.warn('Failed to clear notifications in DB:', e);
    }

    const storage = getAppStorage();
    if (storage) {
      try {
        if (!role || role === 'Owner' || role === 'Admin') {
          storage.removeItem(STORAGE_KEY(finalCompanyId));
        } else if (role === 'Salesperson') {
          const raw = storage.getItem(STORAGE_KEY(finalCompanyId));
          if (raw) {
            const list: NotificationItem[] = JSON.parse(raw);
            // Retain shared company warehouse alerts; only remove this salesperson's customer support notifications
            const remaining = list.filter(n => !(isCustomerSupportNotification(n) && n.userId === userId));
            storage.setItem(STORAGE_KEY(finalCompanyId), JSON.stringify(remaining));
          }
        } else if (userId) {
          const raw = storage.getItem(STORAGE_KEY(finalCompanyId));
          if (raw) {
            const list: NotificationItem[] = JSON.parse(raw);
            const remaining = list.filter(n => n.userId && n.userId !== userId);
            storage.setItem(STORAGE_KEY(finalCompanyId), JSON.stringify(remaining));
          }
        }
      } catch {}
    }
  },

  /**
   * Creates a targeted notification with explicit recipient user_id, warehouse_id, and createdAt timestamp.
   */
  async createNotification(
    notif: {
      title: string;
      message: string;
      type: string;
      link?: string;
      userId?: string | null;
      warehouseId?: string | null;
      productId?: string | null;
      invoiceId?: string | null;
      paymentId?: string | null;
      invoiceNumber?: string | null;
      paymentNumber?: string | null;
      warehouseName?: string;
      createdAt?: string;
      priority?: CustomerSupportPriority;
      category?: string;
      customerId?: string | null;
      customerName?: string;
      productName?: string;
      caseId?: string | null;
      caseNumber?: string | null;
      caseStatus?: string;
      followupDue?: string | null;
      actionText?: string;
      dedupKey?: string;
      isEscalated?: boolean;
    },
    companyId?: string
  ): Promise<NotificationItem> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    let createdId: string | null = null;
    const createdAt = notif.createdAt || new Date().toISOString();

    // Standardize navigation link if not explicitly provided
    let calculatedLink = notif.link;
    if (!calculatedLink) {
      if (notif.type === 'overdue_invoice') {
        if (notif.invoiceId) {
          calculatedLink = `/sales?invoiceId=${encodeURIComponent(notif.invoiceId)}`;
        } else if (notif.invoiceNumber) {
          calculatedLink = `/sales?invoiceNumber=${encodeURIComponent(notif.invoiceNumber)}`;
        } else {
          const m = notif.title.match(/#?([A-Za-z]{3,4}-\d{4}-\d{3,})/i) || notif.title.match(/#(INV-[\w-]+)/i);
          if (m && m[1]) {
            calculatedLink = `/sales?invoiceNumber=${encodeURIComponent(m[1])}`;
          } else {
            calculatedLink = '/sales';
          }
        }
      } else if (notif.type === 'payment_received') {
        if (notif.paymentId) {
          calculatedLink = `/payments?paymentId=${encodeURIComponent(notif.paymentId)}`;
        } else if (notif.paymentNumber) {
          calculatedLink = `/payments?paymentNumber=${encodeURIComponent(notif.paymentNumber)}`;
        } else if (notif.invoiceId) {
          calculatedLink = `/payments?invoiceId=${encodeURIComponent(notif.invoiceId)}`;
        } else {
          const m = notif.title.match(/\b(REC-[\w-]+|PAY-[\w-]+)\b/i) || notif.message.match(/\b(REC-[\w-]+|PAY-[\w-]+)\b/i);
          if (m && m[1]) {
            calculatedLink = `/payments?paymentNumber=${encodeURIComponent(m[1])}`;
          } else {
            calculatedLink = '/payments';
          }
        }
      }
    }

    let finalInvoiceNumber = notif.invoiceNumber || null;
    let finalPaymentNumber = notif.paymentNumber || null;
    if (!finalInvoiceNumber && notif.type === 'overdue_invoice') {
      const m = notif.title.match(/#?([A-Za-z]{3,4}-\d{4}-\d{3,})/i) || notif.title.match(/#(INV-[\w-]+)/i);
      if (m && m[1]) finalInvoiceNumber = m[1];
    }
    if (!finalPaymentNumber && notif.type === 'payment_received') {
      const m = notif.title.match(/\b(REC-[\w-]+|PAY-[\w-]+)\b/i) || notif.message.match(/\b(REC-[\w-]+|PAY-[\w-]+)\b/i);
      if (m && m[1]) finalPaymentNumber = m[1];
    }

    const dedupKey =
      notif.dedupKey ||
      (notif.caseId ? `${notif.type}_${notif.caseId}_${notif.userId || 'unassigned'}` : undefined);

    // Stable deduplication (Requirement 9): if an unread notification with identical dedupKey already exists,
    // update it rather than creating a duplicate alert copy.
    const storage = getAppStorage();
    if (storage && dedupKey) {
      try {
        const raw = storage.getItem(STORAGE_KEY(finalCompanyId));
        const list: NotificationItem[] = raw ? JSON.parse(raw) : [];
        const existingIdx = list.findIndex(n => n.dedupKey === dedupKey && !n.read);
        if (existingIdx !== -1) {
          const existing = list[existingIdx];
          existing.message = notif.message;
          existing.title = notif.title;
          existing.timestamp = 'Just now';
          existing.createdAt = createdAt;
          if (notif.caseStatus) existing.caseStatus = notif.caseStatus;
          list.splice(existingIdx, 1);
          const updated = sortNotifications([existing, ...list]);
          storage.setItem(STORAGE_KEY(finalCompanyId), JSON.stringify(updated.slice(0, 100)));
          return existing;
        }
      } catch {}
    }

    try {
      // Try full insert with extended recipient targeting and customer support columns
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          company_id: finalCompanyId,
          user_id: notif.userId || null,
          warehouse_id: notif.warehouseId || null,
          product_id: notif.productId || null,
          customer_id: notif.customerId || null,
          priority: notif.priority || (notif.type === 'customer_complaint' ? 'High' : 'Normal'),
          category: notif.category || (isCustomerSupportNotification(notif) ? notif.type : null),
          case_id: notif.caseId || null,
          case_status: notif.caseStatus || null,
          followup_due: notif.followupDue || null,
          dedup_key: dedupKey || null,
          is_escalated: Boolean(notif.isEscalated),
          title: notif.title,
          message: notif.message,
          type: notif.type,
          link: calculatedLink,
          is_read: false,
          created_at: createdAt
        })
        .select()
        .single();

      if (!error && data?.id) {
        createdId = data.id;
      } else if (error) {
        // Fallback for earlier database schema
        const { data: fbData } = await supabase
          .from('notifications')
          .insert({
            company_id: finalCompanyId,
            user_id: notif.userId || null,
            title: notif.title,
            message: notif.message,
            type: notif.type,
            link: calculatedLink,
            is_read: false,
            created_at: createdAt
          })
          .select()
          .single();
        if (fbData?.id) createdId = fbData.id;
      }
    } catch (e) {
      console.warn('Supabase notification insert note:', e);
    }

    const generateFallbackId = () => {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      return '00000000-0000-4000-8000-' + Math.random().toString(16).slice(2, 14).padEnd(12, '0');
    };

    const item: NotificationItem = {
      id: createdId || generateFallbackId(),
      title: notif.title,
      message: notif.message,
      type: notif.type as any,
      timestamp: 'Just now',
      createdAt,
      read: false,
      link: calculatedLink,
      userId: notif.userId || null,
      warehouseId: notif.warehouseId || null,
      productId: notif.productId || null,
      invoiceId: notif.invoiceId || null,
      paymentId: notif.paymentId || null,
      invoiceNumber: finalInvoiceNumber,
      paymentNumber: finalPaymentNumber,
      warehouseName: notif.warehouseName,
      priority: notif.priority || (notif.type === 'customer_complaint' ? 'High' : 'Normal'),
      category: notif.category || (isCustomerSupportNotification(notif) ? notif.type : undefined),
      customerId: notif.customerId || null,
      customerName: notif.customerName,
      productName: notif.productName,
      caseId: notif.caseId || null,
      caseNumber: notif.caseNumber || null,
      caseStatus: notif.caseStatus || 'Open',
      followupDue: notif.followupDue || null,
      actionText: notif.actionText,
      dedupKey,
      isEscalated: Boolean(notif.isEscalated)
    };

    // Save to local storage cache for offline / test resilience, preserving required sort
    if (storage) {
      try {
        const raw = storage.getItem(STORAGE_KEY(finalCompanyId));
        const list: NotificationItem[] = raw ? JSON.parse(raw) : [];
        const updated = sortNotifications([item, ...list.filter(n => n.id !== item.id)]);
        storage.setItem(STORAGE_KEY(finalCompanyId), JSON.stringify(updated.slice(0, 100)));
      } catch {}
    }

    return item;
  },

  /**
   * Subscribes to real-time notification changes (INSERT and UPDATE) for the company.
   */
  subscribeToNotifications(
    companyId: string,
    onInsert: (item: NotificationItem) => void,
    onUpdate?: (item: NotificationItem) => void
  ): () => void {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    try {
      const channel = supabase.channel(`notifications-${finalCompanyId}`);
      channel
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `company_id=eq.${finalCompanyId}` },
          payload => {
            const d = payload.new;
            if (!d) return;

            let invoiceId = d.invoice_id || d.invoiceId || null;
            let paymentId = d.payment_id || d.paymentId || null;
            let invoiceNumber = d.invoice_number || d.invoiceNumber || null;
            let paymentNumber = d.payment_number || d.paymentNumber || null;

            if (d.link) {
              try {
                const url = new URL(d.link, 'https://universal-billing.local');
                if (!invoiceId) invoiceId = url.searchParams.get('invoiceId') || (d.type === 'overdue_invoice' ? url.searchParams.get('id') : null);
                if (!invoiceNumber) invoiceNumber = url.searchParams.get('invoiceNumber');
                if (!paymentId) paymentId = url.searchParams.get('paymentId') || (d.type === 'payment_received' ? url.searchParams.get('id') : null);
                if (!paymentNumber) paymentNumber = url.searchParams.get('paymentNumber');
                if (!invoiceId && d.type === 'payment_received') invoiceId = url.searchParams.get('invoiceId');
              } catch {}
            }

            if (!invoiceNumber && d.type === 'overdue_invoice') {
              const text = `${d.title || ''} ${d.message || ''}`;
              const m = text.match(/#?([A-Za-z]{3,4}-\d{4}-\d{3,})/i) || text.match(/#(INV-[\w-]+)/i);
              if (m && m[1]) invoiceNumber = m[1];
            }

            if (!paymentNumber && d.type === 'payment_received') {
              const text = `${d.title || ''} ${d.message || ''}`;
              const m = text.match(/\b(REC-[\w-]+|PAY-[\w-]+)\b/i);
              if (m && m[1]) paymentNumber = m[1];
            }

            const item: NotificationItem = {
              id: d.id,
              title: d.title,
              message: d.message,
              type: (d.type as any) || 'system',
              timestamp: d.created_at
                ? new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Just now',
              createdAt: d.created_at || new Date().toISOString(),
              read: d.read ?? d.is_read ?? false,
              link: d.link || undefined,
              userId: d.user_id || null,
              warehouseId: d.warehouse_id || null,
              productId: d.product_id || null,
              invoiceId,
              paymentId,
              invoiceNumber,
              paymentNumber,
              priority: d.priority || (d.type === 'customer_complaint' ? 'High' : 'Normal'),
              category: d.category || (isCustomerSupportNotification(d as any) ? d.type : undefined),
              customerId: d.customer_id || null,
              customerName: d.customer_name || d.metadata?.customerName || undefined,
              productName: d.product_name || d.metadata?.productName || undefined,
              caseId: d.case_id || null,
              caseNumber: d.case_number || d.metadata?.caseNumber || null,
              caseStatus: d.case_status || d.metadata?.caseStatus || 'Open',
              followupDue: d.followup_due || null,
              actionText: d.action_text || d.metadata?.actionText || undefined,
              dedupKey: d.dedup_key || null,
              isEscalated: Boolean(d.is_escalated)
            };
            onInsert(item);
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `company_id=eq.${finalCompanyId}` },
          payload => {
            const d = payload.new;
            if (!d) return;

            let invoiceId = d.invoice_id || d.invoiceId || null;
            let paymentId = d.payment_id || d.paymentId || null;
            let invoiceNumber = d.invoice_number || d.invoiceNumber || null;
            let paymentNumber = d.payment_number || d.paymentNumber || null;

            if (d.link) {
              try {
                const url = new URL(d.link, 'https://universal-billing.local');
                if (!invoiceId) invoiceId = url.searchParams.get('invoiceId') || (d.type === 'overdue_invoice' ? url.searchParams.get('id') : null);
                if (!invoiceNumber) invoiceNumber = url.searchParams.get('invoiceNumber');
                if (!paymentId) paymentId = url.searchParams.get('paymentId') || (d.type === 'payment_received' ? url.searchParams.get('id') : null);
                if (!paymentNumber) paymentNumber = url.searchParams.get('paymentNumber');
                if (!invoiceId && d.type === 'payment_received') invoiceId = url.searchParams.get('invoiceId');
              } catch {}
            }

            if (!invoiceNumber && d.type === 'overdue_invoice') {
              const text = `${d.title || ''} ${d.message || ''}`;
              const m = text.match(/#?([A-Za-z]{3,4}-\d{4}-\d{3,})/i) || text.match(/#(INV-[\w-]+)/i);
              if (m && m[1]) invoiceNumber = m[1];
            }

            if (!paymentNumber && d.type === 'payment_received') {
              const text = `${d.title || ''} ${d.message || ''}`;
              const m = text.match(/\b(REC-[\w-]+|PAY-[\w-]+)\b/i);
              if (m && m[1]) paymentNumber = m[1];
            }

            const item: NotificationItem = {
              id: d.id,
              title: d.title,
              message: d.message,
              type: (d.type as any) || 'system',
              timestamp: d.created_at
                ? new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Just now',
              createdAt: d.created_at || new Date().toISOString(),
              read: d.read ?? d.is_read ?? false,
              link: d.link || undefined,
              userId: d.user_id || null,
              warehouseId: d.warehouse_id || null,
              productId: d.product_id || null,
              invoiceId,
              paymentId,
              invoiceNumber,
              paymentNumber,
              priority: d.priority || (d.type === 'customer_complaint' ? 'High' : 'Normal'),
              category: d.category || (isCustomerSupportNotification(d as any) ? d.type : undefined),
              customerId: d.customer_id || null,
              customerName: d.customer_name || d.metadata?.customerName || undefined,
              productName: d.product_name || d.metadata?.productName || undefined,
              caseId: d.case_id || null,
              caseNumber: d.case_number || d.metadata?.caseNumber || null,
              caseStatus: d.case_status || d.metadata?.caseStatus || 'Open',
              followupDue: d.followup_due || null,
              actionText: d.action_text || d.metadata?.actionText || undefined,
              dedupKey: d.dedup_key || null,
              isEscalated: Boolean(d.is_escalated)
            };
            onUpdate?.(item);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch {
      return () => {};
    }
  }
};

/**
 * Resolves a sales invoice from an overdue invoice notification using reliable identifiers first,
 * falling back safely to invoice number patterns in title/message.
 */
export function resolveInvoiceFromNotification(
  item: NotificationItem,
  salesInvoices: SalesInvoice[]
): { invoice: SalesInvoice | null; identifier: string; error?: string } {
  if (!item) {
    return { invoice: null, identifier: 'None', error: 'Invalid notification item.' };
  }

  // 1. Direct invoiceId property on item
  if (item.invoiceId) {
    const inv = salesInvoices.find(s => s.id === item.invoiceId);
    if (inv) return { invoice: inv, identifier: item.invoiceId };
    return {
      invoice: null,
      identifier: item.invoiceId,
      error: `Invoice with ID "${item.invoiceId}" no longer exists or has been deleted.`
    };
  }

  // 2. Query param in link (e.g. /sales?invoiceId=... or /sales?id=...)
  if (item.link) {
    try {
      const urlObj = new URL(item.link, 'https://universal-billing.local');
      const paramId = urlObj.searchParams.get('invoiceId') || (item.type === 'overdue_invoice' ? urlObj.searchParams.get('id') : null);
      if (paramId) {
        const inv = salesInvoices.find(s => s.id === paramId);
        if (inv) return { invoice: inv, identifier: paramId };
        return {
          invoice: null,
          identifier: paramId,
          error: `Invoice with ID "${paramId}" no longer exists or has been deleted.`
        };
      }
      const paramNum = urlObj.searchParams.get('invoiceNumber');
      if (paramNum) {
        const inv = salesInvoices.find(s => s.invoiceNumber.toLowerCase() === paramNum.toLowerCase());
        if (inv) return { invoice: inv, identifier: paramNum };
        return {
          invoice: null,
          identifier: paramNum,
          error: `Invoice "${paramNum}" no longer exists or has been deleted.`
        };
      }
    } catch {}
  }

  // 3. Direct invoiceNumber property on item
  if (item.invoiceNumber) {
    const inv = salesInvoices.find(s => s.invoiceNumber.toLowerCase() === item.invoiceNumber!.toLowerCase());
    if (inv) return { invoice: inv, identifier: item.invoiceNumber };
    return {
      invoice: null,
      identifier: item.invoiceNumber,
      error: `Invoice "${item.invoiceNumber}" no longer exists or has been deleted.`
    };
  }

  // 4. Safe fallback for legacy/incomplete notifications:
  // Extract invoice number from title or message (e.g. "Overdue Invoice #INV-2026-0042")
  const textToScan = `${item.title || ''} ${item.message || ''}`;
  const invNumMatch = textToScan.match(/#?([A-Za-z]{3,4}-\d{4}-\d{3,})/i) || textToScan.match(/#(INV-[\w-]+)/i);
  if (invNumMatch && invNumMatch[1]) {
    const extracted = invNumMatch[1];
    const inv = salesInvoices.find(s => s.invoiceNumber.toLowerCase() === extracted.toLowerCase());
    if (inv) return { invoice: inv, identifier: extracted };
    return {
      invoice: null,
      identifier: extracted,
      error: `Invoice "${extracted}" no longer exists or has been deleted.`
    };
  }

  return {
    invoice: null,
    identifier: 'Unknown',
    error: 'Could not identify invoice: Notification payload does not specify an invoice ID or invoice number.'
  };
}

/**
 * Resolves a payment record from a payment received notification using reliable identifiers first,
 * falling back safely to voucher number patterns in title/message, or unambiguous invoice relations.
 */
export function resolvePaymentFromNotification(
  item: NotificationItem,
  payments: PaymentRecord[]
): { payment: PaymentRecord | null; identifier: string; error?: string } {
  if (!item) {
    return { payment: null, identifier: 'None', error: 'Invalid notification item.' };
  }

  // 1. Direct paymentId property on item
  if (item.paymentId) {
    const p = payments.find(pay => pay.id === item.paymentId);
    if (p) return { payment: p, identifier: item.paymentId };
    return {
      payment: null,
      identifier: item.paymentId,
      error: `Payment record with ID "${item.paymentId}" no longer exists or may have been deleted.`
    };
  }

  // 2. Query param in link (e.g. /payments?paymentId=... or /payments?id=...)
  if (item.link) {
    try {
      const urlObj = new URL(item.link, 'https://universal-billing.local');
      const paramId = urlObj.searchParams.get('paymentId') || (item.type === 'payment_received' ? urlObj.searchParams.get('id') : null);
      if (paramId) {
        const p = payments.find(pay => pay.id === paramId);
        if (p) return { payment: p, identifier: paramId };
        return {
          payment: null,
          identifier: paramId,
          error: `Payment record with ID "${paramId}" no longer exists or may have been deleted.`
        };
      }
      const paramNum = urlObj.searchParams.get('paymentNumber');
      if (paramNum) {
        const p = payments.find(pay => pay.paymentNumber.toLowerCase() === paramNum.toLowerCase());
        if (p) return { payment: p, identifier: paramNum };
        return {
          payment: null,
          identifier: paramNum,
          error: `Payment voucher "${paramNum}" no longer exists or may have been deleted.`
        };
      }
      const paramInv = urlObj.searchParams.get('invoiceId');
      if (paramInv) {
        const matches = payments.filter(pay => pay.invoiceId === paramInv);
        if (matches.length === 1) {
          return { payment: matches[0], identifier: `Invoice #${paramInv}` };
        } else if (matches.length > 1) {
          return {
            payment: null,
            identifier: `Invoice #${paramInv}`,
            error: `Multiple payment transactions (${matches.length}) are associated with invoice #${paramInv}. Please view payments in the Payment Registry.`
          };
        } else {
          return {
            payment: null,
            identifier: `Invoice #${paramInv}`,
            error: `No payment transaction is associated with invoice #${paramInv}.`
          };
        }
      }
    } catch {}
  }

  // 3. Direct paymentNumber property on item
  if (item.paymentNumber) {
    const p = payments.find(pay => pay.paymentNumber.toLowerCase() === item.paymentNumber!.toLowerCase());
    if (p) return { payment: p, identifier: item.paymentNumber };
    return {
      payment: null,
      identifier: item.paymentNumber,
      error: `Payment voucher "${item.paymentNumber}" no longer exists or may have been deleted.`
    };
  }

  // 4. If notification has only invoiceId:
  // "If the notification contains only an invoice ID, use the existing relationship to identify the relevant payment only when that relationship is unambiguous. Do not select an arbitrary payment for the customer."
  if (item.invoiceId) {
    const matches = payments.filter(pay => pay.invoiceId === item.invoiceId);
    if (matches.length === 1) {
      return { payment: matches[0], identifier: `Invoice #${item.invoiceId}` };
    } else if (matches.length > 1) {
      return {
        payment: null,
        identifier: `Invoice #${item.invoiceId}`,
        error: `Multiple payments (${matches.length}) exist for this invoice. Please view payments in the Payment Registry.`
      };
    } else {
      return {
        payment: null,
        identifier: `Invoice #${item.invoiceId}`,
        error: `No payment record exists for invoice #${item.invoiceId}.`
      };
    }
  }

  // 5. Safe fallback for legacy/incomplete notifications:
  // Check if title or message mentions a voucher number (e.g. REC-1001, PAY-1001, etc.)
  const textToScan = `${item.title || ''} ${item.message || ''}`;
  const voucherMatch = textToScan.match(/\b(REC-[\w-]+|PAY-[\w-]+)\b/i);
  if (voucherMatch && voucherMatch[1]) {
    const extracted = voucherMatch[1];
    const p = payments.find(pay => pay.paymentNumber.toLowerCase() === extracted.toLowerCase());
    if (p) return { payment: p, identifier: extracted };
    return {
      payment: null,
      identifier: extracted,
      error: `Payment voucher "${extracted}" no longer exists or may have been deleted.`
    };
  }

  return {
    payment: null,
    identifier: 'Unknown',
    error: 'Payment record could not be identified: Notification payload is missing payment details.'
  };
}

export const isAuthorizedRecipient = (
  item: NotificationItem,
  userId?: string,
  role?: string
): boolean => {
  return notificationService.isAuthorizedRecipient(item, userId, role);
};

