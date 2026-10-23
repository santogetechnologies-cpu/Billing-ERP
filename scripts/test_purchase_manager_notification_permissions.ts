// Test Suite: Purchase Manager Notification Permissions & Relevant Alert Delivery
// Tests all acceptance criteria from the Antigravity prompt

import { notificationService } from '../src/services/notificationService';
import { purchaseRequestService } from '../src/services/purchaseRequestService';
import { stockAlertService } from '../src/services/stockAlertService';
import { NotificationItem, Product, Warehouse, StockBalance, SystemUser, UserRole } from '../src/types';
import { hasPermission } from '../src/utils/rbac';
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

async function runTestSuite() {
  console.log('================================================================');
  console.log('TEST SUITE: PURCHASE MANAGER NOTIFICATION PERMISSIONS');
  console.log('================================================================\n');

  const testCompanyId = '00000000-0000-0000-0000-000000000001';
  const storage = getAppStorage();

  // Reset local storage for clean test run
  if (storage) {
    storage.setItem(`universal_billing_notifications_${testCompanyId}`, JSON.stringify([]));
  }

  // 1. Setup mock users
  const pmUser: SystemUser = {
    id: 'user-pm-001',
    name: 'Priya Sharma (Purchase Manager)',
    email: 'priya.pm@universal.com',
    role: 'Purchase Manager',
    status: 'Active',
    accountStatus: 'Enabled',
    presenceStatus: 'Active',
    lastLogin: 'Today'
  };

  const wmUser: SystemUser = {
    id: 'user-wm-001',
    name: 'Ramesh Warehouse Manager',
    email: 'ramesh.wm@universal.com',
    role: 'Warehouse Manager',
    status: 'Active',
    accountStatus: 'Enabled',
    presenceStatus: 'Active',
    lastLogin: 'Today'
  };

  const salesUser: SystemUser = {
    id: 'user-sales-001',
    name: 'Sunil Salesperson',
    email: 'sunil.sales@universal.com',
    role: 'Salesperson',
    status: 'Active',
    accountStatus: 'Enabled',
    presenceStatus: 'Active',
    lastLogin: 'Today'
  };

  const adminUser: SystemUser = {
    id: 'user-admin-001',
    name: 'Amit Admin',
    email: 'amit.admin@universal.com',
    role: 'Admin',
    status: 'Active',
    accountStatus: 'Enabled',
    presenceStatus: 'Active',
    lastLogin: 'Today'
  };

  // ---------------------------------------------------------------------------
  // 1. New Purchase Request Notification Delivery
  // ---------------------------------------------------------------------------
  console.log('--- 1. New Purchase Request Submitted by Warehouse Manager ---');
  {
    const newPrNotif: NotificationItem = {
      id: 'notif-pr-new-001',
      title: 'New Purchase Request: PR-20261022-0001',
      message: 'Ramesh Warehouse Manager requested replenishment for North Central Hub: TMT Steel Rod 12mm (50 Piece). Priority: Urgent.',
      type: 'purchase_request',
      timestamp: 'Just now',
      createdAt: new Date().toISOString(),
      read: false,
      link: '/purchases/requests?id=pr-001',
      warehouseId: 'wh-north-001',
      warehouseName: 'North Central Hub'
    };

    assert(
      notificationService.isAuthorizedRecipient(newPrNotif, pmUser.id, pmUser.role) === true,
      'Purchase Manager receives in-app notification for new Purchase Request submitted by Warehouse Manager'
    );
  }

  // ---------------------------------------------------------------------------
  // 2. Urgent Stock Alerts (Low Stock, Limited Stock, Out of Stock)
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Urgent Stock Alerts for Procurement Evaluation ---');
  {
    const lowStockNotif: NotificationItem = {
      id: 'notif-stock-low-001',
      title: 'Limited Stock: UltraTech Cement 50kg',
      message: 'Limited Stock: UltraTech Cement 50kg in Warehouse "Main Godown". Available: 5 Bag. Minimum threshold: 25 Bag.',
      type: 'limited_stock',
      timestamp: 'Just now',
      createdAt: new Date().toISOString(),
      read: false,
      link: '/inventory/alerts',
      warehouseId: 'wh-main-001',
      productId: 'prod-cement-001'
    };

    const outOfStockNotif: NotificationItem = {
      id: 'notif-stock-out-001',
      title: 'Out of Stock: Copper Wire 2.5mm',
      message: 'Out of Stock: Copper Wire 2.5mm in Warehouse "Main Godown". Available: 0 Roll. Minimum threshold: 10 Roll.',
      type: 'out_of_stock',
      timestamp: 'Just now',
      createdAt: new Date().toISOString(),
      read: false,
      link: '/inventory/alerts',
      warehouseId: 'wh-main-001',
      productId: 'prod-wire-001'
    };

    assert(
      notificationService.isAuthorizedRecipient(lowStockNotif, pmUser.id, pmUser.role) === true,
      'Purchase Manager receives Limited/Low Stock Alert across company warehouses'
    );
    assert(
      notificationService.isAuthorizedRecipient(outOfStockNotif, pmUser.id, pmUser.role) === true,
      'Purchase Manager receives Out of Stock Alert across company warehouses'
    );
  }

  // ---------------------------------------------------------------------------
  // 3. Purchase Request Updates (Clarification & Cancellation by Requester)
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Purchase Request Updates Requiring PM Attention ---');
  {
    const clarifyResponseNotif: NotificationItem = {
      id: 'notif-pr-clarify-001',
      title: 'Clarification Provided: PR-20261022-0001',
      message: 'Clarification provided by Ramesh Warehouse Manager for request #PR-20261022-0001. Ready for review.',
      type: 'purchase_request',
      timestamp: 'Just now',
      createdAt: new Date().toISOString(),
      read: false,
      link: '/purchases/requests?id=pr-001'
    };

    const cancelNotif: NotificationItem = {
      id: 'notif-pr-cancel-001',
      title: 'Purchase Request Cancelled: PR-20261022-0001',
      message: 'Purchase request #PR-20261022-0001 was cancelled by Ramesh Warehouse Manager. Reason: Site requirements changed.',
      type: 'purchase_request',
      timestamp: 'Just now',
      createdAt: new Date().toISOString(),
      read: false,
      link: '/purchases/requests?id=pr-001'
    };

    assert(
      notificationService.isAuthorizedRecipient(clarifyResponseNotif, pmUser.id, pmUser.role) === true,
      'Purchase Manager receives "Clarification Provided" notification when requester responds'
    );
    assert(
      notificationService.isAuthorizedRecipient(cancelNotif, pmUser.id, pmUser.role) === true,
      'Purchase Manager receives "Purchase Request Cancelled" notification'
    );
  }

  // ---------------------------------------------------------------------------
  // 4. Purchase Order Updates & Inward Goods Deliveries
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Purchase Order Updates & Inward Goods Deliveries ---');
  {
    const poPlacedNotif: NotificationItem = {
      id: 'notif-po-placed-001',
      title: 'Purchase Order Placed: PO-2026-9042',
      message: 'Goods for request PR-20261022-0001 have been ordered from Tata Steel Ltd.',
      type: 'purchase_order',
      timestamp: 'Just now',
      createdAt: new Date().toISOString(),
      read: false,
      link: '/purchases?id=po-9042'
    };

    const grnReceivedNotif: NotificationItem = {
      id: 'notif-grn-001',
      title: 'Inward Goods Received: PR-20261022-0001',
      message: 'Full Delivery: 50/50 Piece confirmed at North Central Hub. Overall status: Completed.',
      type: 'purchase_request',
      timestamp: 'Just now',
      createdAt: new Date().toISOString(),
      read: false,
      link: '/purchases/requests?id=pr-001'
    };

    assert(
      notificationService.isAuthorizedRecipient(poPlacedNotif, pmUser.id, pmUser.role) === true,
      'Purchase Manager receives Purchase Order update notification'
    );
    assert(
      notificationService.isAuthorizedRecipient(grnReceivedNotif, pmUser.id, pmUser.role) === true,
      'Purchase Manager receives Inward Goods Received confirmation notification'
    );
  }

  // ---------------------------------------------------------------------------
  // 5. Supplier Updates & Stock Damage
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Supplier Updates & Stock Damage Alerts ---');
  {
    const supplierNotif: NotificationItem = {
      id: 'notif-sup-001',
      title: 'Supplier Update: Price Revision Notice',
      message: 'Supplier Jindal Steel updated their wholesale catalog price schedule.',
      type: 'supplier_update',
      timestamp: 'Just now',
      createdAt: new Date().toISOString(),
      read: false,
      link: '/suppliers'
    };

    const damageNotif: NotificationItem = {
      id: 'notif-damage-001',
      title: 'Stock Damage Alert: Ceramic Floor Tiles',
      message: '15 Box of Ceramic Floor Tiles reported damaged/written-off in warehouse "Main Godown". Reason: Transit breakage.',
      type: 'stock_damage',
      timestamp: 'Just now',
      createdAt: new Date().toISOString(),
      read: false,
      link: '/inventory'
    };

    assert(
      notificationService.isAuthorizedRecipient(supplierNotif, pmUser.id, pmUser.role) === true,
      'Purchase Manager receives Supplier Update notification'
    );
    assert(
      notificationService.isAuthorizedRecipient(damageNotif, pmUser.id, pmUser.role) === true,
      'Purchase Manager receives Stock Damage Alert for replacement procurement'
    );
  }

  // ---------------------------------------------------------------------------
  // 6. Approval & Rejection: Prevent Duplicate Self-Action Notifications
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. Self-Action Deduplication for Approvals & Rejections ---');
  {
    // Notification generated when PM Priya approves request PR-001. Addressed to requester Ramesh.
    const approvedNotifForRequester: NotificationItem = {
      id: 'notif-appr-001',
      title: 'Purchase Request Approved: PR-20261022-0001',
      message: 'Approved by Priya Sharma (Purchase Manager). Ready for purchase order generation.',
      type: 'purchase_request',
      userId: wmUser.id, // Addressed to requester Ramesh
      timestamp: 'Just now',
      createdAt: new Date().toISOString(),
      read: false,
      link: '/inventory/purchase-requests?id=pr-001'
    };

    // Notification generated when PM Priya rejects request PR-002. Addressed to requester Ramesh.
    const rejectedNotifForRequester: NotificationItem = {
      id: 'notif-rej-001',
      title: 'Purchase Request Rejected: PR-20261022-0002',
      message: 'Rejected by Priya Sharma (Purchase Manager). Reason: Insufficient budget allocated this quarter.',
      type: 'purchase_request',
      userId: wmUser.id, // Addressed to requester Ramesh
      timestamp: 'Just now',
      createdAt: new Date().toISOString(),
      read: false,
      link: '/inventory/purchase-requests?id=pr-002'
    };

    assert(
      notificationService.isAuthorizedRecipient(approvedNotifForRequester, pmUser.id, pmUser.role) === false,
      'Purchase Manager does NOT receive duplicate notification for approval they performed themselves'
    );
    assert(
      notificationService.isAuthorizedRecipient(rejectedNotifForRequester, pmUser.id, pmUser.role) === false,
      'Purchase Manager does NOT receive duplicate notification for rejection they performed themselves'
    );
  }

  // ---------------------------------------------------------------------------
  // 7. Strictly Blocked Irrelevant & Unauthorized Notifications
  // ---------------------------------------------------------------------------
  console.log('\n--- 7. Strictly Blocked Irrelevant & Unauthorized Notifications ---');
  {
    const overdueInvoiceNotif: NotificationItem = {
      id: 'notif-inv-overdue',
      title: 'Overdue Invoice #INV-2026-0042',
      message: 'Customer Sharma Building Materials has an overdue balance of ₹34,560.',
      type: 'overdue_invoice',
      timestamp: 'Just now',
      createdAt: new Date().toISOString(),
      read: false,
      link: '/sales?invoiceNumber=INV-2026-0042'
    };

    const paymentReceivedNotif: NotificationItem = {
      id: 'notif-pay-rec',
      title: 'Payment Received: ₹50,000',
      message: 'Payment REC-2026-1001 received from Sharma Building Materials.',
      type: 'payment_received',
      timestamp: 'Just now',
      createdAt: new Date().toISOString(),
      read: false,
      link: '/payments?paymentNumber=REC-2026-1001'
    };

    const saleBillingNotif: NotificationItem = {
      id: 'notif-pos-sale',
      title: 'Counter Sale Billed: #POS-2026-0199',
      message: 'Counter invoice generated for ₹1,250.',
      type: 'pos_billing' as any,
      timestamp: 'Just now',
      createdAt: new Date().toISOString(),
      read: false,
      link: '/sales/pos'
    };

    const creditLimitNotif: NotificationItem = {
      id: 'notif-credit-limit',
      title: 'Customer Credit Limit Exceeded',
      message: 'Verma Infrastructure has exceeded their credit ceiling.',
      type: 'credit_limit',
      timestamp: 'Just now',
      createdAt: new Date().toISOString(),
      read: false,
      link: '/customers'
    };

    const expenseNotif: NotificationItem = {
      id: 'notif-expense-001',
      title: 'Expense Recorded: Office Rent',
      message: '₹45,000 recorded under Administrative Expenses.',
      type: 'expense' as any,
      timestamp: 'Just now',
      createdAt: new Date().toISOString(),
      read: false,
      link: '/expenses'
    };

    const userActivityNotif: NotificationItem = {
      id: 'notif-act-001',
      title: 'User Activity Session Alert',
      message: 'Owner login history updated.',
      type: 'user_activity' as any,
      timestamp: 'Just now',
      createdAt: new Date().toISOString(),
      read: false,
      link: '/users/activity'
    };

    const systemAdminNotif: NotificationItem = {
      id: 'notif-sys-001',
      title: 'Missing Warehouse Manager Assignment',
      message: 'Main warehouse has stock alerts but no manager is assigned.',
      type: 'system',
      timestamp: 'Just now',
      createdAt: new Date().toISOString(),
      read: false,
      link: '/warehouses'
    };

    assert(
      notificationService.isAuthorizedRecipient(overdueInvoiceNotif, pmUser.id, pmUser.role) === false,
      'Purchase Manager is strictly BLOCKED from sales overdue invoice notifications'
    );
    assert(
      notificationService.isAuthorizedRecipient(paymentReceivedNotif, pmUser.id, pmUser.role) === false,
      'Purchase Manager is strictly BLOCKED from customer payment notifications'
    );
    assert(
      notificationService.isAuthorizedRecipient(saleBillingNotif, pmUser.id, pmUser.role) === false,
      'Purchase Manager is strictly BLOCKED from POS / sales counter billing notifications'
    );
    assert(
      notificationService.isAuthorizedRecipient(creditLimitNotif, pmUser.id, pmUser.role) === false,
      'Purchase Manager is strictly BLOCKED from customer credit limit alerts'
    );
    assert(
      notificationService.isAuthorizedRecipient(expenseNotif, pmUser.id, pmUser.role) === false,
      'Purchase Manager is strictly BLOCKED from operational expense notifications'
    );
    assert(
      notificationService.isAuthorizedRecipient(userActivityNotif, pmUser.id, pmUser.role) === false,
      'Purchase Manager is strictly BLOCKED from user activity / session tracking alerts'
    );
    assert(
      notificationService.isAuthorizedRecipient(systemAdminNotif, pmUser.id, pmUser.role) === false,
      'Purchase Manager is strictly BLOCKED from administrative system notices'
    );
  }

  // ---------------------------------------------------------------------------
  // 8. Navigation Links & Access Restricted Prevention
  // ---------------------------------------------------------------------------
  console.log('\n--- 8. Navigation Links & Access Restricted Prevention ---');
  {
    // A. Verify Purchase Manager cannot access sales or payments
    assert(
      hasPermission(pmUser.role, 'sales', 'view') === false,
      'Purchase Manager has NO view permission on sales invoices'
    );
    assert(
      hasPermission(pmUser.role, 'payments', 'view') === false,
      'Purchase Manager has NO view permission on customer payments'
    );

    // B. Verify Purchase Manager CAN access purchasing and inventory
    assert(
      hasPermission(pmUser.role, 'purchases', 'view') === true,
      'Purchase Manager has view permission on purchases'
    );
    assert(
      hasPermission(pmUser.role, 'inventory', 'view') === true,
      'Purchase Manager has view permission on inventory'
    );

    // C. Verify all permitted notification links are accessible to Purchase Manager
    const samplePermittedNotifs: NotificationItem[] = [
      { id: '1', title: 'PR 1', message: 'msg', type: 'purchase_request', timestamp: 'Just now', read: false, link: '/purchases/requests?id=pr-001' },
      { id: '2', title: 'Stock Low', message: 'msg', type: 'limited_stock', timestamp: 'Just now', read: false, link: '/inventory/alerts' },
      { id: '3', title: 'Out of stock', message: 'msg', type: 'out_of_stock', timestamp: 'Just now', read: false, link: '/products?search=Cement' },
      { id: '4', title: 'Supplier Update', message: 'msg', type: 'supplier_update', timestamp: 'Just now', read: false, link: '/suppliers' }
    ];

    samplePermittedNotifs.forEach(notif => {
      const isAuthorized = notificationService.isAuthorizedRecipient(notif, pmUser.id, pmUser.role);
      assert(isAuthorized === true, `Permitted notification link "${notif.link}" is authorized for PM`);
    });
  }

  // ---------------------------------------------------------------------------
  // 9. Unread Count Accuracy & Mark as Read
  // ---------------------------------------------------------------------------
  console.log('\n--- 9. Notification Bell Unread Count Accuracy ---');
  {
    const mixedBatch: NotificationItem[] = [
      // 3 Relevant to PM:
      { id: 'pm-1', title: 'New PR', message: 'PR #100', type: 'purchase_request', timestamp: '10:00 AM', createdAt: new Date(Date.now() - 3000).toISOString(), read: false, link: '/purchases/requests' },
      { id: 'pm-2', title: 'Low Stock', message: 'Cement low', type: 'low_stock', timestamp: '10:01 AM', createdAt: new Date(Date.now() - 2000).toISOString(), read: false, link: '/inventory/alerts' },
      { id: 'pm-3', title: 'Supplier price change', message: 'Steel prices', type: 'supplier_update', timestamp: '10:02 AM', createdAt: new Date(Date.now() - 1000).toISOString(), read: true, link: '/suppliers' },
      // 4 Irrelevant to PM:
      { id: 'irr-1', title: 'Invoice Overdue', message: 'INV-42', type: 'overdue_invoice', timestamp: '10:00 AM', read: false, link: '/sales' },
      { id: 'irr-2', title: 'Payment Rec', message: 'REC-01', type: 'payment_received', timestamp: '10:00 AM', read: false, link: '/payments' },
      { id: 'irr-3', title: 'Self Approval', message: 'Approved by Priya Sharma (Purchase Manager)', type: 'purchase_request', userId: 'user-wm-001', timestamp: '10:00 AM', read: false },
      { id: 'irr-4', title: 'Expense', message: 'Rent', type: 'expense' as any, timestamp: '10:00 AM', read: false, link: '/expenses' }
    ];

    const testBatchCompanyId = 'pm-test-company-batch-' + Date.now();
    if (storage) {
      storage.setItem(`universal_billing_notifications_${testBatchCompanyId}`, JSON.stringify(mixedBatch));
    }

    const pmVisible = await notificationService.getNotifications(testBatchCompanyId, pmUser.id, pmUser.role);
    assert(pmVisible.length === 3, `Purchase Manager receives strictly the 3 relevant notifications (Actual: ${pmVisible.length})`);

    const pmUnread = pmVisible.filter(n => !n.read).length;
    assert(pmUnread === 2, `Purchase Manager unread count reflects strictly visible unread notifications (Expected: 2, Actual: ${pmUnread})`);

    // Verify 100% of visible notifications belong to authorized purchasing categories
    const allValid = pmVisible.every(n =>
      n.type === 'purchase_request' || n.type === 'low_stock' || n.type === 'supplier_update'
    );
    assert(allValid === true, '100% of Purchase Manager notifications belong to authorized purchasing categories');
  }

  // ---------------------------------------------------------------------------
  // 10. Role Separation: Owner, Admin, and Warehouse Manager Continuity
  // ---------------------------------------------------------------------------
  console.log('\n--- 10. Role Separation: Other Roles Untouched ---');
  {
    // Owner sees company notifications
    const overdueInv: NotificationItem = {
      id: 'inv-test',
      title: 'Overdue Invoice',
      message: 'Inv msg',
      type: 'overdue_invoice',
      timestamp: 'Just now',
      read: false
    };
    assert(
      notificationService.isAuthorizedRecipient(overdueInv, 'user-owner', 'Owner') === true,
      'Owner still receives company sales invoice notifications'
    );
    assert(
      notificationService.isAuthorizedRecipient(overdueInv, 'user-admin', 'Admin') === true,
      'Admin still receives company sales invoice notifications'
    );

    // Salesperson blocked from purchase requests
    const prNotif: NotificationItem = {
      id: 'pr-test',
      title: 'New PR',
      message: 'Replenishment',
      type: 'purchase_request',
      timestamp: 'Just now',
      read: false
    };
    assert(
      notificationService.isAuthorizedRecipient(prNotif, salesUser.id, salesUser.role) === false,
      'Salesperson remains strictly BLOCKED from purchase request notifications'
    );
  }

  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passedTests}/${totalTests} Passed (${totalTests - passedTests} Failed)`);
  console.log('================================================================');
  if (passedTests === totalTests) {
    console.log('🎉 All Purchase Manager Notification Permissions tests passed 100%!\n');
  } else {
    process.exitCode = 1;
  }
}

runTestSuite().catch(err => {
  console.error('Fatal error running test suite:', err);
  process.exit(1);
});
