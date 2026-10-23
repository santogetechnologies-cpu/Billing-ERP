// Test Suite: Overdue Invoice and Payment Received Notification Details
// Verifies all requirements from the Bug Fix Prompt

import {
  notificationService,
  resolveInvoiceFromNotification,
  resolvePaymentFromNotification
} from '../src/services/notificationService';
import { hasPermission } from '../src/utils/rbac';
import { NotificationItem, SalesInvoice, PaymentRecord, UserRole } from '../src/types';
import { getAppStorage } from '../src/utils/storageUtils';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    process.exitCode = 1;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('TEST SUITE: OVERDUE INVOICE & PAYMENT NOTIFICATION DETAILS');
  console.log('================================================================\n');

  const testCompanyId = '00000000-0000-0000-0000-000000000001';
  const storage = getAppStorage();
  if (storage) {
    storage.removeItem(`universal_billing_notifications_${testCompanyId}`);
  }

  // Sample Mock Invoices
  const mockInvoices: SalesInvoice[] = [
    {
      id: 'inv-uuid-0042',
      invoiceNumber: 'INV-2026-0042',
      docType: 'tax_invoice',
      date: '2026-09-15',
      dueDate: '2026-10-05',
      customerId: 'cust-sharma-01',
      customerName: 'Sharma Building Materials Pvt Ltd',
      customerGstin: '27AABCS1429B1Z1',
      warehouseId: 'wh-central',
      items: [
        {
          id: 'item-1',
          productId: 'prod-cement-53',
          productName: 'UltraTech Cement 53 Grade',
          qty: 100,
          unit: 'Bag',
          rate: 420,
          discountPct: 0,
          discountAmt: 0,
          taxRate: 18,
          taxAmt: 7560,
          total: 49560
        }
      ],
      subtotal: 42000,
      discountTotal: 0,
      taxTotal: 7560,
      cgstTotal: 3780,
      sgstTotal: 3780,
      igstTotal: 0,
      roundOff: 0,
      grandTotal: 49560,
      paidAmount: 15000,
      paymentStatus: 'Partially Paid',
      paymentMethod: 'Bank Transfer'
    },
    {
      id: 'inv-uuid-0099',
      invoiceNumber: 'INV-2026-0099',
      docType: 'tax_invoice',
      date: '2026-09-01',
      dueDate: '2026-09-20',
      customerId: 'cust-verma-02',
      customerName: 'Verma Infrastructure Ltd',
      warehouseId: 'wh-north',
      items: [],
      subtotal: 100000,
      discountTotal: 0,
      taxTotal: 18000,
      cgstTotal: 9000,
      sgstTotal: 9000,
      igstTotal: 0,
      roundOff: 0,
      grandTotal: 118000,
      paidAmount: 0,
      paymentStatus: 'Unpaid',
      paymentMethod: 'Bank Transfer'
    }
  ];

  // Sample Mock Payments
  const mockPayments: PaymentRecord[] = [
    {
      id: 'pay-uuid-5001',
      paymentNumber: 'REC-2026-1001',
      type: 'Received',
      partyType: 'Customer',
      partyId: 'cust-sharma-01',
      partyName: 'Sharma Building Materials Pvt Ltd',
      amount: 50000,
      date: '2026-10-20',
      paymentMethod: 'Bank Transfer',
      account: 'HDFC Corporate Bank A/C',
      reference: 'UTR/HDFC/20261020/99812',
      notes: 'Part settlement for quarterly supplies',
      invoiceId: 'inv-uuid-0042'
    },
    {
      id: 'pay-uuid-5002',
      paymentNumber: 'REC-2026-1002',
      type: 'Received',
      partyType: 'Customer',
      partyId: 'cust-verma-02',
      partyName: 'Verma Infrastructure Ltd',
      amount: 118000,
      date: '2026-10-21',
      paymentMethod: 'UPI',
      account: 'Main Cash Drawer',
      reference: 'UPI/AXIS/9817291',
      notes: 'Full invoice settlement',
      invoiceId: 'inv-uuid-0099'
    },
    {
      id: 'pay-uuid-5003',
      paymentNumber: 'REC-2026-1003',
      type: 'Received',
      partyType: 'Customer',
      partyId: 'cust-sharma-01',
      partyName: 'Sharma Building Materials Pvt Ltd',
      amount: 15000,
      date: '2026-10-21',
      paymentMethod: 'Cash',
      account: 'Main Cash Drawer',
      reference: 'CASH-RCPT-1003',
      invoiceId: 'inv-uuid-multi' // shared invoice
    },
    {
      id: 'pay-uuid-5004',
      paymentNumber: 'REC-2026-1004',
      type: 'Received',
      partyType: 'Customer',
      partyId: 'cust-sharma-01',
      partyName: 'Sharma Building Materials Pvt Ltd',
      amount: 25000,
      date: '2026-10-22',
      paymentMethod: 'Card',
      account: 'HDFC Corporate Bank A/C',
      reference: 'TXN-CARD-4491',
      invoiceId: 'inv-uuid-multi' // shared invoice
    }
  ];

  // ---------------------------------------------------------------------------
  // 1 & 2: Overdue Invoice Notification Resolution
  // ---------------------------------------------------------------------------
  console.log('--- 1 & 2: Overdue Invoice Notification & Matching ---');

  // A. With explicit invoiceId
  const notifWithInvoiceId = await notificationService.createNotification(
    {
      title: 'Overdue Invoice #INV-2026-0042',
      message: 'Invoice overdue by 15 days.',
      type: 'overdue_invoice',
      invoiceId: 'inv-uuid-0042'
    },
    testCompanyId
  );
  assert(notifWithInvoiceId.invoiceId === 'inv-uuid-0042', 'Notification stored invoiceId correctly');
  assert(notifWithInvoiceId.link?.includes('/sales?invoiceId=inv-uuid-0042'), 'Generated link targets sales page with invoiceId');

  const resolvedInvA = resolveInvoiceFromNotification(notifWithInvoiceId, mockInvoices);
  assert(resolvedInvA.invoice !== null, 'Invoice resolved successfully by invoiceId');
  assert(resolvedInvA.invoice?.invoiceNumber === 'INV-2026-0042', 'Resolved invoiceNumber matches "INV-2026-0042"');
  assert(resolvedInvA.invoice?.customerName === 'Sharma Building Materials Pvt Ltd', 'Customer name is Sharma Building Materials');
  assert(resolvedInvA.invoice?.grandTotal === 49560, 'Invoice grandTotal matches 49,560');
  assert(resolvedInvA.invoice?.paidAmount === 15000, 'Invoice paidAmount matches 15,000');
  assert(
    resolvedInvA.invoice ? (resolvedInvA.invoice.grandTotal - resolvedInvA.invoice.paidAmount) === 34560 : false,
    'Calculated outstanding balance matches 34,560'
  );

  // B. Legacy/Fallback: Without invoiceId property, but with invoiceNumber or title regex
  const legacyInvoiceNotif: NotificationItem = {
    id: 'legacy-notif-1',
    title: 'Overdue Invoice #INV-2026-0042',
    message: 'Customer Sharma has an outstanding balance overdue beyond credit terms.',
    type: 'overdue_invoice',
    timestamp: 'Just now',
    read: false
  };
  const resolvedInvB = resolveInvoiceFromNotification(legacyInvoiceNotif, mockInvoices);
  assert(resolvedInvB.invoice !== null, 'Legacy notification resolved invoice from title pattern');
  assert(resolvedInvB.invoice?.id === 'inv-uuid-0042', 'Legacy notification matched correct invoice ID');

  // ---------------------------------------------------------------------------
  // 3 & 4: Payment Received Notification Resolution
  // ---------------------------------------------------------------------------
  console.log('\n--- 3 & 4: Payment Received Notification & Matching ---');

  // A. With explicit paymentId
  const notifWithPaymentId = await notificationService.createNotification(
    {
      title: 'Payment Received: ₹50,000',
      message: 'Payment received from Customer Sharma via NEFT.',
      type: 'payment_received',
      paymentId: 'pay-uuid-5001'
    },
    testCompanyId
  );
  assert(notifWithPaymentId.paymentId === 'pay-uuid-5001', 'Notification stored paymentId correctly');
  assert(notifWithPaymentId.link?.includes('/payments?paymentId=pay-uuid-5001'), 'Generated link targets payments page with paymentId');

  const resolvedPayA = resolvePaymentFromNotification(notifWithPaymentId, mockPayments);
  assert(resolvedPayA.payment !== null, 'Payment resolved successfully by paymentId');
  assert(resolvedPayA.payment?.paymentNumber === 'REC-2026-1001', 'Payment voucher matches "REC-2026-1001"');
  assert(resolvedPayA.payment?.amount === 50000, 'Payment amount matches ₹50,000');
  assert(resolvedPayA.payment?.partyName === 'Sharma Building Materials Pvt Ltd', 'Party matches customer');
  assert(resolvedPayA.payment?.paymentMethod === 'Bank Transfer', 'Payment mode matches "Bank Transfer"');
  assert(resolvedPayA.payment?.reference === 'UTR/HDFC/20261020/99812', 'Reference matches UTR string');
  assert(resolvedPayA.payment?.invoiceId === 'inv-uuid-0042', 'Associated invoice is inv-uuid-0042');

  // B. With unambiguous invoice relationship (exactly 1 payment for invoice)
  const notifWithUnambiguousInv: NotificationItem = {
    id: 'notif-unambiguous-1',
    title: 'Payment Received: ₹118,000',
    message: 'Payment received for INV-2026-0099',
    type: 'payment_received',
    timestamp: 'Just now',
    read: false,
    invoiceId: 'inv-uuid-0099'
  };
  const resolvedPayB = resolvePaymentFromNotification(notifWithUnambiguousInv, mockPayments);
  assert(resolvedPayB.payment !== null, 'Payment resolved unambiguously through linked invoice');
  assert(resolvedPayB.payment?.paymentNumber === 'REC-2026-1002', 'Resolved payment is REC-2026-1002 (Verma Infrastructure)');

  // C. With ambiguous invoice relationship (multiple payments exist for this invoice)
  const notifWithAmbiguousInv: NotificationItem = {
    id: 'notif-ambiguous-1',
    title: 'Payment Received for Multi-installment invoice',
    message: 'Installment received',
    type: 'payment_received',
    timestamp: 'Just now',
    read: false,
    invoiceId: 'inv-uuid-multi'
  };
  const resolvedPayC = resolvePaymentFromNotification(notifWithAmbiguousInv, mockPayments);
  assert(resolvedPayC.payment === null, 'Ambiguous relationship correctly refused to select arbitrary payment');
  assert(resolvedPayC.error?.includes('Multiple payments'), 'Returned clear message indicating multiple payments exist');

  // D. Legacy notification with voucher number in text
  const legacyPayNotif: NotificationItem = {
    id: 'legacy-pay-1',
    title: 'Payment Received: ₹50,000 (REC-2026-1001)',
    message: 'Processed at corporate desk.',
    type: 'payment_received',
    timestamp: 'Just now',
    read: false
  };
  const resolvedPayD = resolvePaymentFromNotification(legacyPayNotif, mockPayments);
  assert(resolvedPayD.payment !== null, 'Resolved payment from voucher number in text');
  assert(resolvedPayD.payment?.id === 'pay-uuid-5001', 'Matched correct payment ID from text voucher');

  // ---------------------------------------------------------------------------
  // 5: Multiple Customers & Invoices Cross-Contamination Test
  // ---------------------------------------------------------------------------
  console.log('\n--- 5: Multiple Customers & Invoices Independence ---');
  const notifCustomer1 = await notificationService.createNotification(
    {
      title: 'Overdue Invoice #INV-2026-0042',
      message: 'Sharma balance overdue',
      type: 'overdue_invoice',
      invoiceId: 'inv-uuid-0042'
    },
    testCompanyId
  );
  const notifCustomer2 = await notificationService.createNotification(
    {
      title: 'Overdue Invoice #INV-2026-0099',
      message: 'Verma balance overdue',
      type: 'overdue_invoice',
      invoiceId: 'inv-uuid-0099'
    },
    testCompanyId
  );

  const res1 = resolveInvoiceFromNotification(notifCustomer1, mockInvoices);
  const res2 = resolveInvoiceFromNotification(notifCustomer2, mockInvoices);
  assert(res1.invoice?.customerId === 'cust-sharma-01', 'Customer 1 invoice resolved independently');
  assert(res2.invoice?.customerId === 'cust-verma-02', 'Customer 2 invoice resolved independently');
  assert(res1.invoice?.id !== res2.invoice?.id, 'No cross-contamination between customers');

  // ---------------------------------------------------------------------------
  // 6: Missing or Invalid Record IDs
  // ---------------------------------------------------------------------------
  console.log('\n--- 6: Missing or Invalid Record IDs ---');
  const missingInvoiceNotif: NotificationItem = {
    id: 'missing-inv-1',
    title: 'Overdue Invoice #INV-DELETED',
    message: 'Deleted invoice alert',
    type: 'overdue_invoice',
    timestamp: 'Just now',
    read: false,
    invoiceId: 'non-existent-invoice-id'
  };
  const missingInvRes = resolveInvoiceFromNotification(missingInvoiceNotif, mockInvoices);
  assert(missingInvRes.invoice === null, 'Missing invoice returns null');
  assert(missingInvRes.error?.includes('non-existent-invoice-id'), 'Clear error returned identifying missing invoice');

  const missingPaymentNotif: NotificationItem = {
    id: 'missing-pay-1',
    title: 'Payment Received: ₹10,000',
    message: 'Removed transaction',
    type: 'payment_received',
    timestamp: 'Just now',
    read: false,
    paymentId: 'non-existent-payment-id'
  };
  const missingPayRes = resolvePaymentFromNotification(missingPaymentNotif, mockPayments);
  assert(missingPayRes.payment === null, 'Missing payment returns null');
  assert(missingPayRes.error?.includes('non-existent-payment-id'), 'Clear error returned identifying missing payment');

  // ---------------------------------------------------------------------------
  // 7: Security & Role-Based Access Control (RBAC)
  // ---------------------------------------------------------------------------
  console.log('\n--- 7: Security & RBAC Permission Enforcement ---');
  const authorizedRoles: UserRole[] = ['Owner', 'Admin', 'Accountant', 'Salesperson', 'Cashier'];
  const restrictedRoles: UserRole[] = ['Warehouse Manager', 'Purchase Manager'];

  authorizedRoles.forEach(role => {
    const canViewSales = hasPermission(role, 'sales', 'view');
    const canViewPayments = hasPermission(role, 'payments', 'view');
    assert(canViewSales && canViewPayments, `Role "${role}" is authorized to view invoices and payments`);
  });

  restrictedRoles.forEach(role => {
    const canViewSales = hasPermission(role, 'sales', 'view');
    const canViewPayments = hasPermission(role, 'payments', 'view');
    assert(!canViewSales, `Role "${role}" is strictly blocked from viewing sales invoices`);
    assert(!canViewPayments, `Role "${role}" is strictly blocked from viewing payment records`);
  });

  // ---------------------------------------------------------------------------
  // 8: Other Notification Types Continuity
  // ---------------------------------------------------------------------------
  console.log('\n--- 8: Non-Invoice/Payment Notification Continuity ---');
  const prNotif = await notificationService.createNotification(
    {
      title: 'New Purchase Request: #PR-20261022-0001',
      message: 'Warehouse replenishment request awaiting review',
      type: 'purchase_request',
      link: '/purchases/requests?id=pr-001'
    },
    testCompanyId
  );
  assert(prNotif.type === 'purchase_request', 'Purchase request notification created');
  assert(prNotif.link === '/purchases/requests?id=pr-001', 'PR navigation link preserved untouched');

  const stockNotif = await notificationService.createNotification(
    {
      title: 'Stock Warning Limit Reached',
      message: 'TMT 12mm rod low stock',
      type: 'low_stock',
      link: '/products?search=TMT'
    },
    testCompanyId
  );
  assert(stockNotif.type === 'low_stock', 'Stock notification created');
  assert(stockNotif.link === '/products?search=TMT', 'Stock navigation link preserved untouched');

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passedTests}/${totalTests} Passed (${totalTests - passedTests} Failed)`);
  console.log('================================================================');

  if (passedTests === totalTests) {
    console.log('🎉 All Overdue Invoice & Payment Received Notification tests passed 100%!\n');
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
