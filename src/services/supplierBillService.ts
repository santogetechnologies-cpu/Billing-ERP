import { supabase } from '../lib/supabase';
import {
  PurchaseInvoice,
  PaymentRecord,
  PaymentMethod,
  BillVerificationStatus,
  UserRole
} from '../types';
import {
  purchaseService,
  injectBillMetadata,
  extractBillMetadata,
  saveBillMetaCache,
  BillMetadata
} from './purchaseService';
import { filterSupportedPurchasePayload } from '../utils/schemaDetector';
import { notificationService } from './notificationService';
import { auditService } from './auditService';
import { assertCallerPermission, getActiveUserRole } from '../utils/rbac';

export type SupplierBillTab =
  | 'Pending Review'
  | 'Approved for Payment'
  | 'Partially Paid'
  | 'Paid'
  | 'Overdue'
  | 'All';

export interface SupplierBillFilter {
  tab?: SupplierBillTab;
  search?: string;
  supplierId?: string;
  startDate?: string;
  endDate?: string;
}

export interface SupplierBillItem extends PurchaseInvoice {
  balanceDue: number;
  isOverdue: boolean;
}

export interface SupplierBillSummary {
  bills: SupplierBillItem[];
  counts: {
    pendingReview: number;
    approvedForPayment: number;
    partiallyPaid: number;
    paid: number;
    overdue: number;
    all: number;
  };
  totals: {
    totalBillsAmount: number;
    pendingReviewAmount: number;
    approvedAmount: number;
    partiallyPaidAmount: number;
    paidAmount: number;
    overdueAmount: number;
  };
}

export const supplierBillService = {
  /**
   * Retrieves all supplier purchase bills augmented with PO/PR links,
   * verification status, remaining balance due, and tab categorization.
   */
  async getSupplierBills(
    companyId?: string,
    filter?: SupplierBillFilter
  ): Promise<SupplierBillSummary> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';

    // 1. Fetch all purchases (excluding debit notes / returns)
    const allInvoices = await purchaseService.getPurchaseInvoices(undefined, finalCompanyId);
    const supplierBills = allInvoices.filter(
      b => b.docType === 'purchase_invoice' || !b.docType
    );

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // 2. Augment each bill with balance due & overdue status
    const augmented: SupplierBillItem[] = supplierBills.map(b => {
      const grandTotal = Number(b.grandTotal || 0);
      const paidAmount = Number(b.paidAmount || 0);
      const balanceDue = Math.max(0, grandTotal - paidAmount);

      let isOverdue = false;
      if (balanceDue > 0 && b.dueDate) {
        const dueTime = new Date(b.dueDate).getTime();
        if (!isNaN(dueTime) && dueTime < todayStart.getTime()) {
          isOverdue = true;
        }
      }

      const verificationStatus = (b.verificationStatus || 'Pending Review') as BillVerificationStatus;

      return {
        ...b,
        balanceDue,
        isOverdue,
        verificationStatus
      };
    });

    // 3. Tab filter classification logic
    const counts = {
      pendingReview: 0,
      approvedForPayment: 0,
      partiallyPaid: 0,
      paid: 0,
      overdue: 0,
      all: augmented.length
    };

    const totals = {
      totalBillsAmount: 0,
      pendingReviewAmount: 0,
      approvedAmount: 0,
      partiallyPaidAmount: 0,
      paidAmount: 0,
      overdueAmount: 0
    };

    augmented.forEach(b => {
      totals.totalBillsAmount += b.grandTotal;

      // Pending Review tab:
      if (b.verificationStatus === 'Pending Review') {
        counts.pendingReview++;
        totals.pendingReviewAmount += b.grandTotal;
      }

      // Approved for Payment tab:
      // Verified by accountant, ready for payment (unpaid or partially paid, not overdue)
      if (b.verificationStatus === 'Approved for Payment' && b.balanceDue > 0 && !b.isOverdue) {
        counts.approvedForPayment++;
        totals.approvedAmount += b.balanceDue;
      }

      // Partially Paid tab:
      if (b.paymentStatus === 'Partially Paid' && b.balanceDue > 0) {
        counts.partiallyPaid++;
        totals.partiallyPaidAmount += b.balanceDue;
      }

      // Paid tab: fully paid
      if (b.paymentStatus === 'Paid' || b.balanceDue === 0) {
        counts.paid++;
        totals.paidAmount += b.grandTotal;
      }

      // Overdue tab: past due date with outstanding balance
      if (b.isOverdue && b.balanceDue > 0) {
        counts.overdue++;
        totals.overdueAmount += b.balanceDue;
      }
    });

    // 4. Filter bills according to requested tab and search query
    let filtered = augmented;

    if (filter?.tab && filter.tab !== 'All') {
      switch (filter.tab) {
        case 'Pending Review':
          filtered = filtered.filter(b => b.verificationStatus === 'Pending Review');
          break;
        case 'Approved for Payment':
          filtered = filtered.filter(
            b => b.verificationStatus === 'Approved for Payment' && b.balanceDue > 0 && !b.isOverdue
          );
          break;
        case 'Partially Paid':
          filtered = filtered.filter(
            b => b.paymentStatus === 'Partially Paid' && b.balanceDue > 0
          );
          break;
        case 'Paid':
          filtered = filtered.filter(
            b => b.paymentStatus === 'Paid' || b.balanceDue === 0
          );
          break;
        case 'Overdue':
          filtered = filtered.filter(b => b.isOverdue && b.balanceDue > 0);
          break;
      }
    }

    if (filter?.search && filter.search.trim()) {
      const q = filter.search.trim().toLowerCase();
      filtered = filtered.filter(b =>
        (b.invoiceNumber || '').toLowerCase().includes(q) ||
        (b.supplierName || '').toLowerCase().includes(q) ||
        (b.purchaseOrderNumber || '').toLowerCase().includes(q) ||
        (b.purchaseRequestNumber || '').toLowerCase().includes(q)
      );
    }

    if (filter?.supplierId && filter.supplierId !== 'All') {
      filtered = filtered.filter(b => b.supplierId === filter.supplierId);
    }

    return {
      bills: filtered,
      counts,
      totals
    };
  },

  /**
   * Verifies a supplier bill by Accountant: marks as 'Approved for Payment' or 'Correction Requested'.
   * Strictly enforces that only Accountant, Admin, or Owner can verify bills.
   */
  async verifySupplierBill(
    params: {
      billId: string;
      status: 'Approved for Payment' | 'Correction Requested';
      notes?: string;
      userProfile?: { id: string; fullName: string; role: string };
    },
    companyId?: string
  ): Promise<SupplierBillItem> {
    // Strict RBAC: Only Accountant, Admin, Owner can verify bills
    const role = (await getActiveUserRole()) || (params.userProfile?.role as UserRole);
    if (role !== 'Accountant' && role !== 'Admin' && role !== 'Owner') {
      throw new Error(`Unauthorized (403): Only authorized Accountants can verify bills for payment. Role '${role || 'Unknown'}' is not permitted.`);
    }

    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const nowIso = new Date().toISOString();

    // 1. Fetch current bill
    const all = await purchaseService.getPurchaseInvoices(undefined, finalCompanyId);
    const existing = all.find(b => b.id === params.billId);
    if (!existing) {
      throw new Error(`Supplier bill #${params.billId} not found.`);
    }

    const updatedMeta: BillMetadata = {
      purchaseOrderId: existing.purchaseOrderId,
      purchaseOrderNumber: existing.purchaseOrderNumber,
      purchaseRequestId: existing.purchaseRequestId,
      purchaseRequestNumber: existing.purchaseRequestNumber,
      verificationStatus: params.status,
      verifiedBy: params.userProfile?.id || undefined,
      verifiedByName: params.userProfile?.fullName || 'Accountant',
      verifiedAt: nowIso,
      correctionNotes: params.status === 'Correction Requested' ? (params.notes || 'Correction requested by Accountant.') : undefined,
      correctionRequestedAt: params.status === 'Correction Requested' ? nowIso : undefined
    };

    const updatedNotes = injectBillMetadata(existing.notes, updatedMeta);

    // 2. Persist to Supabase
    try {
      const rawUpdate = {
        verification_status: params.status,
        verified_by: params.userProfile?.id || null,
        verified_by_name: params.userProfile?.fullName || 'Accountant',
        verified_at: nowIso,
        correction_notes: updatedMeta.correctionNotes || null,
        correction_requested_at: updatedMeta.correctionRequestedAt || null,
        notes: updatedNotes,
        updated_at: nowIso
      };

      const filteredUpdate = await filterSupportedPurchasePayload(rawUpdate);

      const { error: dbErr } = await supabase
        .from('purchases')
        .update(filteredUpdate)
        .eq('id', params.billId)
        .eq('company_id', finalCompanyId);

      if (dbErr) {
        console.warn('DB update of supplier bill verification error:', dbErr.message);
      }
    } catch (e) {
      console.warn('Failed to update supplier bill verification in DB:', e);
    }

    // 3. Cache in storage
    saveBillMetaCache(finalCompanyId, params.billId, updatedMeta);
    if (existing.invoiceNumber) {
      saveBillMetaCache(finalCompanyId, existing.invoiceNumber, updatedMeta);
    }

    // 4. Notify Purchase Manager if Correction Requested
    if (params.status === 'Correction Requested') {
      try {
        await notificationService.createNotification({
          title: `Correction Requested: Bill #${existing.invoiceNumber}`,
          message: `Accountant ${params.userProfile?.fullName || ''} requested correction: "${params.notes || 'Please review items/amount'}". Supplier: ${existing.supplierName}.`,
          type: 'bill_correction',
          link: '/purchases',
          dedupKey: `bill_correction_${params.billId}_${Date.now()}`,
          actionText: 'Review Purchase'
        }, finalCompanyId);
      } catch (notifErr) {
        console.warn('Could not dispatch correction notification to Purchase Manager:', notifErr);
      }
    }

    // 5. Audit Log
    try {
      await auditService.logAction(
        params.status === 'Approved for Payment' ? 'VERIFY_SUPPLIER_BILL' : 'FLAG_SUPPLIER_BILL_CORRECTION',
        'Purchases & Payments',
        `Supplier Bill #${existing.invoiceNumber}`,
        existing.verificationStatus || 'Pending Review',
        params.status,
        finalCompanyId
      );
    } catch {}

    const grandTotal = Number(existing.grandTotal || 0);
    const paidAmount = Number(existing.paidAmount || 0);
    const balanceDue = Math.max(0, grandTotal - paidAmount);

    return {
      ...existing,
      ...updatedMeta,
      verificationStatus: params.status,
      notes: existing.notes,
      balanceDue,
      isOverdue: false
    };
  },

  /**
   * Records a payment against a verified supplier bill by the Accountant.
   * Auto-calculates remaining balance: Total Bill Amount - Total Successful Payments.
   * Updates payment status to 'Partially Paid' or 'Paid' (only when balance is 0).
   */
  async recordSupplierBillPayment(
    params: {
      billId: string;
      amount: number;
      paymentMethod: PaymentMethod;
      date?: string;
      account?: string;
      reference?: string;
      notes?: string;
      userProfile?: { id: string; fullName: string; role: string };
    },
    companyId?: string
  ): Promise<{ payment: PaymentRecord; updatedBill: SupplierBillItem }> {
    // Strict RBAC: Only Accountant, Admin, Owner can record bill payments
    const role = (await getActiveUserRole()) || (params.userProfile?.role as UserRole);
    if (role !== 'Accountant' && role !== 'Admin' && role !== 'Owner') {
      throw new Error(`Unauthorized (403): Only authorized Accountants can record supplier bill payments. Role '${role || 'Unknown'}' is not permitted.`);
    }

    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';

    // Call core purchaseService.recordPurchasePayment
    const { payment, updatedPurchase } = await purchaseService.recordPurchasePayment(
      {
        purchaseId: params.billId,
        amount: params.amount,
        paymentMethod: params.paymentMethod,
        date: params.date,
        reference: params.reference,
        notes: params.notes,
        account: params.account
      },
      finalCompanyId
    );

    const grandTotal = Number(updatedPurchase.grandTotal || 0);
    const paidAmount = Number(updatedPurchase.paidAmount || 0);
    const balanceDue = Math.max(0, grandTotal - paidAmount);

    // Audit log
    try {
      await auditService.logAction(
        'RECORD_BILL_PAYMENT',
        'Purchases & Payments',
        `Supplier Bill #${updatedPurchase.invoiceNumber}`,
        `Paid: ₹${(paidAmount - params.amount).toLocaleString('en-IN')}`,
        `Paid: ₹${paidAmount.toLocaleString('en-IN')} (Remaining: ₹${balanceDue.toLocaleString('en-IN')})`,
        finalCompanyId
      );
    } catch {}

    const updatedBill: SupplierBillItem = {
      ...updatedPurchase,
      balanceDue,
      isOverdue: false
    };

    return {
      payment,
      updatedBill
    };
  },

  /**
   * Retrieves payment transaction history for a specific supplier bill.
   */
  async getBillPaymentHistory(
    billId: string,
    companyId?: string
  ): Promise<PaymentRecord[]> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('company_id', finalCompanyId)
        .or(`invoice_id.eq.${billId}`)
        .order('date', { ascending: false });

      if (error) {
        console.warn('Error fetching payment history for bill:', error.message);
        return [];
      }

      return (data || []).map((p: any) => ({
        id: p.id,
        paymentNumber: p.payment_number,
        type: p.type || 'Paid',
        partyType: p.party_type || 'Supplier',
        partyId: p.party_id,
        partyName: p.party_name,
        amount: Number(p.amount || 0),
        date: p.date,
        paymentMethod: p.payment_method,
        account: p.account || p.account_name,
        reference: p.reference,
        notes: p.notes,
        createdAt: p.created_at,
        invoiceId: p.invoice_id
      }));
    } catch (e) {
      console.warn('Failed to query bill payment history:', e);
      return [];
    }
  },

  /**
   * Checks for bills approaching due date (within 3 days) and overdue bills.
   * Dispatches deduplicated notifications to Accountant.
   */
  async checkAndSendBillDueNotifications(companyId?: string): Promise<void> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    try {
      const summary = await this.getSupplierBills(finalCompanyId);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const threeDaysLater = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
      const todayDateStr = today.toISOString().split('T')[0];

      for (const bill of summary.bills) {
        if (bill.balanceDue <= 0 || !bill.dueDate) continue;
        const dueDate = new Date(bill.dueDate);
        dueDate.setHours(0, 0, 0, 0);

        // 1. Overdue Alert
        if (dueDate.getTime() < today.getTime()) {
          const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          await notificationService.createNotification(
            {
              title: `Overdue Supplier Bill: #${bill.invoiceNumber}`,
              message: `Bill #${bill.invoiceNumber} from ${bill.supplierName} is ${daysOverdue} day(s) overdue. Outstanding: ₹${bill.balanceDue.toLocaleString('en-IN')}.`,
              type: 'bill_overdue',
              link: '/payments/bills?tab=overdue',
              dedupKey: `bill_overdue_${bill.id}_${todayDateStr}`,
              actionText: 'View Overdue'
            },
            finalCompanyId
          );
        }
        // 2. Approaching Due Date Alert (due within 3 days)
        else if (dueDate.getTime() <= threeDaysLater.getTime()) {
          const daysLeft = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          const dueMsg = daysLeft === 0 ? 'due today' : `due in ${daysLeft} day(s)`;
          await notificationService.createNotification(
            {
              title: `Supplier Bill Due Soon: #${bill.invoiceNumber}`,
              message: `Bill #${bill.invoiceNumber} (${bill.supplierName}) is ${dueMsg}. Amount payable: ₹${bill.balanceDue.toLocaleString('en-IN')}.`,
              type: 'bill_due_date',
              link: '/payments/bills?tab=approved',
              dedupKey: `bill_due_soon_${bill.id}_${bill.dueDate}`,
              actionText: 'Review Due'
            },
            finalCompanyId
          );
        }
      }
    } catch (e) {
      console.warn('Error checking bill due notifications:', e);
    }
  }
};
