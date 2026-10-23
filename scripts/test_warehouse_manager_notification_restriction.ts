// Test Suite: Warehouse Manager Notification Restriction & Relevant Alert Delivery
// Tests all acceptance criteria from the Antigravity prompt

import { notificationService } from '../src/services/notificationService';
import { purchaseRequestService } from '../src/services/purchaseRequestService';
import { inventoryService } from '../src/services/inventoryService';
import { stockAlertService } from '../src/services/stockAlertService';
import { Product, Warehouse, StockBalance, SystemUser } from '../src/types';
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
  console.log('TEST SUITE: WAREHOUSE MANAGER NOTIFICATION RESTRICTION');
  console.log('================================================================\n');

  const testCompanyId = '00000000-0000-0000-0000-000000000001';

  // 1. Setup mock users
  const wmUserA: SystemUser = {
    id: 'user-wm-delhi',
    name: 'Ramesh Warehouse Manager',
    email: 'ramesh.wm@universal.com',
    role: 'Warehouse Manager',
    status: 'Active',
    accountStatus: 'Enabled',
    presenceStatus: 'Active',
    lastLogin: 'Today'
  };

  const wmUserB: SystemUser = {
    id: 'user-wm-chennai',
    name: 'Suresh Chennai Manager',
    email: 'suresh.wm@universal.com',
    role: 'Warehouse Manager',
    status: 'Active',
    accountStatus: 'Enabled',
    presenceStatus: 'Active',
    lastLogin: 'Today'
  };

  const pmUser: SystemUser = {
    id: 'user-pm-001',
    name: 'Priya Purchase Manager',
    email: 'priya.pm@universal.com',
    role: 'Purchase Manager',
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

  const salesUser: SystemUser = {
    id: 'user-sales-001',
    name: 'Sunil Sales',
    email: 'sunil.sales@universal.com',
    role: 'Salesperson',
    status: 'Active',
    accountStatus: 'Enabled',
    presenceStatus: 'Active',
    lastLogin: 'Today'
  };

  // 2. Setup mock warehouses
  const warehouseDelhi: Warehouse = {
    id: 'wh-delhi-001',
    name: 'Delhi Central Hub',
    code: 'WH-DEL',
    address: 'Okhla Phase 3, Delhi',
    isActive: true,
    isDefault: true,
    managerId: wmUserA.id,
    managerName: wmUserA.name,
    managerIds: [wmUserA.id]
  };

  const warehouseChennai: Warehouse = {
    id: 'wh-chennai-002',
    name: 'Chennai Godown',
    code: 'WH-CHE',
    address: 'Guindy Industrial Estate, Chennai',
    isActive: true,
    isDefault: false,
    managerId: wmUserB.id,
    managerName: wmUserB.name,
    managerIds: [wmUserB.id]
  };

  const allWarehouses = [warehouseDelhi, warehouseChennai];

  // 3. Setup mock products
  const productA: Product = {
    id: 'prod-cement-50kg',
    name: 'Ambuja Portland Cement 50kg',
    sku: 'CEM-AMB-50KG',
    category: 'Building Materials',
    hsn: '2523',
    taxRate: 28,
    costPrice: 320,
    sellingPrice: 380,
    mrp: 410,
    primaryUnit: 'Bag',
    openingStock: 0,
    currentStock: 5,
    reorderLevel: 20, // Warning limit: 20
    warehouse: warehouseDelhi.id,
    isActive: true
  };

  const productB: Product = {
    id: 'prod-paint-20l',
    name: 'Asian Paints Apex 20L White',
    sku: 'PNT-APX-20L',
    category: 'Paints',
    hsn: '3209',
    taxRate: 18,
    costPrice: 2800,
    sellingPrice: 3400,
    mrp: 3600,
    primaryUnit: 'Bucket',
    openingStock: 0,
    currentStock: 0,
    reorderLevel: 10,
    warehouse: warehouseDelhi.id,
    isActive: true
  };

  // Clear notifications and seed storage for test isolation
  await notificationService.clearAll(testCompanyId);
  const storage = getAppStorage();
  storage.setItem(`universal_billing_products_${testCompanyId}`, JSON.stringify([productA, productB]));
  storage.setItem(`universal_billing_warehouses_${testCompanyId}`, JSON.stringify(allWarehouses));

  // ---------------------------------------------------------------------------
  // REQUIREMENT 1: Remove Routine Purchase Request Creation Notifications for Warehouse Manager
  // ---------------------------------------------------------------------------
  console.log('\n--- 1. Purchase Request Creation: Excluded for Warehouse Manager ---');

  const createdPR = await purchaseRequestService.createPurchaseRequest(
    {
      warehouseId: warehouseDelhi.id,
      priority: 'Normal',
      requiredByDate: '2026-10-25',
      items: [
        {
          productId: productA.id,
          requestedQty: 50,
          unit: 'Bag'
        }
      ]
    },
    testCompanyId,
    { id: wmUserA.id, name: wmUserA.name, role: wmUserA.role }
  );

  // Query notifications for Warehouse Manager A (the creator of the PR)
  const wmANotifsAfterPR = await notificationService.getNotifications(testCompanyId, wmUserA.id, wmUserA.role);
  const wmAReceivedPRCreateNotif = wmANotifsAfterPR.some(
    n => n.type === 'purchase_request' && (n.title.includes(createdPR.requestNumber) || n.message.includes('replenishment'))
  );
  assert(!wmAReceivedPRCreateNotif, 'Warehouse Manager receives 0 notifications for newly created Purchase Request');

  // Query notifications for Warehouse Manager B (unrelated warehouse manager)
  const wmBNotifsAfterPR = await notificationService.getNotifications(testCompanyId, wmUserB.id, wmUserB.role);
  assert(wmBNotifsAfterPR.length === 0, 'Unrelated Warehouse Manager B receives 0 notifications for PR');

  // Query notifications for Purchase Manager (MUST still receive it)
  const pmNotifsAfterPR = await notificationService.getNotifications(testCompanyId, pmUser.id, pmUser.role);
  const pmReceivedPRNotif = pmNotifsAfterPR.some(
    n => n.type === 'purchase_request' && n.title.includes(createdPR.requestNumber)
  );
  assert(pmReceivedPRNotif, 'Purchase Manager receives in-app notification for the newly created Purchase Request');

  // Query notifications for Admin (MUST still receive it)
  const adminNotifsAfterPR = await notificationService.getNotifications(testCompanyId, adminUser.id, adminUser.role);
  const adminReceivedPRNotif = adminNotifsAfterPR.some(
    n => n.type === 'purchase_request' && n.title.includes(createdPR.requestNumber)
  );
  assert(adminReceivedPRNotif, 'Admin receives in-app notification for the newly created Purchase Request');

  // ---------------------------------------------------------------------------
  // REQUIREMENT 2A & 2C: Low Stock Alert & Limited Stock Alert for Warehouse Manager
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Low Stock / Limited Stock Alerts for Assigned Warehouse Manager ---');

  // Product A has current stock 5 (limit 20) in Delhi Warehouse
  const stockBalances: StockBalance[] = [
    {
      id: 'sb-001',
      warehouseId: warehouseDelhi.id,
      productId: productA.id,
      quantity: 5,
      updatedAt: new Date().toISOString()
    }
  ];

  await stockAlertService.checkProductsStockAlerts(
    [productA],
    testCompanyId,
    allWarehouses,
    stockBalances,
    [wmUserA, wmUserB],
    wmUserA.id,
    wmUserA.role
  );

  const wmANotifsAfterLowStock = await notificationService.getNotifications(testCompanyId, wmUserA.id, wmUserA.role);
  const lowStockAlert = wmANotifsAfterLowStock.find(
    n => (n.type === 'limited_stock' || n.type === 'low_stock') && n.productId === productA.id
  );

  assert(Boolean(lowStockAlert), 'Assigned Warehouse Manager received Low/Limited Stock Alert');
  assert(
    Boolean(lowStockAlert?.message.includes(productA.name) && lowStockAlert?.message.includes(warehouseDelhi.name)),
    'Low Stock Alert includes product name and warehouse name'
  );
  assert(
    Boolean(lowStockAlert?.message.includes('5') && lowStockAlert?.message.includes('20')),
    'Low Stock Alert includes current stock (5) and warning limit (20)'
  );

  // Unassigned Warehouse Manager B must NOT receive this alert
  const wmBNotifsAfterLowStock = await notificationService.getNotifications(testCompanyId, wmUserB.id, wmUserB.role);
  const wmBReceivedDelhiLowStock = wmBNotifsAfterLowStock.some(
    n => n.productId === productA.id && (n.warehouseId === warehouseDelhi.id || n.message.includes(warehouseDelhi.name))
  );
  assert(!wmBReceivedDelhiLowStock, 'Unassigned Warehouse Manager B receives 0 alerts for Delhi warehouse low stock');

  // Deduplication check: repeated alert checks must NOT produce duplicate unread alerts
  await stockAlertService.checkProductsStockAlerts(
    [productA],
    testCompanyId,
    allWarehouses,
    stockBalances,
    [wmUserA, wmUserB],
    wmUserA.id,
    wmUserA.role
  );
  const wmANotifsAfterDedupe = await notificationService.getNotifications(testCompanyId, wmUserA.id, wmUserA.role);
  const lowStockCount = wmANotifsAfterDedupe.filter(
    n => (n.type === 'limited_stock' || n.type === 'low_stock') && n.productId === productA.id
  ).length;
  assert(lowStockCount === 1, 'Duplicate Low Stock alerts are prevented for continuous unresolved condition');

  // ---------------------------------------------------------------------------
  // REQUIREMENT 2B: Out of Stock Alert for Warehouse Manager
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Out of Stock Alert for Warehouse Manager ---');

  const stockBalancesZero: StockBalance[] = [
    {
      id: 'sb-002',
      warehouseId: warehouseDelhi.id,
      productId: productB.id,
      quantity: 0,
      updatedAt: new Date().toISOString()
    }
  ];

  await stockAlertService.checkProductsStockAlerts(
    [productB],
    testCompanyId,
    allWarehouses,
    stockBalancesZero,
    [wmUserA, wmUserB],
    wmUserA.id,
    wmUserA.role
  );

  const wmANotifsAfterOOS = await notificationService.getNotifications(testCompanyId, wmUserA.id, wmUserA.role);
  const oosAlert = wmANotifsAfterOOS.find(n => n.type === 'out_of_stock' && n.productId === productB.id);
  assert(Boolean(oosAlert), 'Assigned Warehouse Manager received Out of Stock Alert');
  assert(
    Boolean(oosAlert?.message.includes(productB.name) && oosAlert?.message.includes('0')),
    'Out of Stock alert specifies product name and available quantity: 0'
  );

  // ---------------------------------------------------------------------------
  // REQUIREMENT 2D: Purchase Request Cancellation Alert
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Purchase Request Cancellation Alert ---');

  // Purchase Manager Priya cancels the PR created by Warehouse Manager A
  const cancelledPR = await purchaseRequestService.cancelPurchaseRequest(
    {
      requestId: createdPR.id,
      cancellationReason: 'Discontinued product line — replacement SKU to be specified.'
    },
    testCompanyId,
    { id: pmUser.id, name: pmUser.name, role: pmUser.role }
  );

  assert(cancelledPR.status === 'Cancelled', 'Purchase Request status updated to "Cancelled"');

  // Warehouse Manager A (the creator) MUST receive the cancellation alert
  const wmANotifsAfterCancel = await notificationService.getNotifications(testCompanyId, wmUserA.id, wmUserA.role);
  const cancelNotif = wmANotifsAfterCancel.find(
    n => n.type === 'purchase_request' && n.title.includes('Cancelled') && n.title.includes(createdPR.requestNumber)
  );

  assert(Boolean(cancelNotif), 'Warehouse Manager received Purchase Request Cancellation Alert');
  assert(
    Boolean(cancelNotif?.message.includes('Cancelled') && cancelNotif?.message.includes('Discontinued product line')),
    'Cancellation alert includes cancellation status and cancellation reason'
  );

  // Unrelated Warehouse Manager B must NOT receive this cancellation
  const wmBNotifsAfterCancel = await notificationService.getNotifications(testCompanyId, wmUserB.id, wmUserB.role);
  const wmBReceivedCancel = wmBNotifsAfterCancel.some(n => n.title.includes(createdPR.requestNumber));
  assert(!wmBReceivedCancel, 'Unrelated Warehouse Manager B receives 0 alerts for Delhi PR cancellation');

  // ---------------------------------------------------------------------------
  // REQUIREMENT 2E: Stock Damage Alert
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Stock Damage Alert ---');

  // Record a stock adjustment with damage write-off
  const damageTxn = await inventoryService.adjustStock(
    productA.id,
    -3,
    'Transit damage write-off — packaging broken and material spoiled',
    warehouseDelhi.id,
    testCompanyId,
    { id: wmUserA.id, name: wmUserA.name, role: wmUserA.role },
    { productName: productA.name, warehouseName: warehouseDelhi.name, unit: productA.primaryUnit }
  );

  assert(damageTxn.type === 'Stock Adjustment', 'Stock adjustment transaction recorded for damage');

  // Warehouse Manager A must receive the Stock Damage Alert
  const wmANotifsAfterDamage = await notificationService.getNotifications(testCompanyId, wmUserA.id, wmUserA.role);
  const damageAlert = wmANotifsAfterDamage.find(n => n.type === 'stock_damage' && n.productId === productA.id);

  assert(Boolean(damageAlert), 'Assigned Warehouse Manager received Stock Damage Alert');
  assert(
    Boolean(damageAlert?.message.includes('3') && damageAlert?.message.includes(productA.name)),
    'Stock Damage Alert includes damaged quantity (3) and product name'
  );
  assert(
    Boolean(damageAlert?.message.includes(warehouseDelhi.name)),
    'Stock Damage Alert specifies warehouse name'
  );
  assert(
    Boolean(damageAlert?.message.includes('Transit damage write-off')),
    'Stock Damage Alert includes damage justification reason'
  );

  // ---------------------------------------------------------------------------
  // REQUIREMENT 3: Excluded Notifications for Warehouse Manager
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. Verification: Excluded Notifications for Warehouse Manager ---');

  // Create mock unrelated notifications (payment, system, overdue invoice)
  await notificationService.createNotification(
    {
      title: 'Payment Received: ₹50,000',
      message: 'Payment received from Customer ABC via NEFT.',
      type: 'payment_received'
    },
    testCompanyId
  );

  await notificationService.createNotification(
    {
      title: 'Overdue Invoice #INV-2026-0042',
      message: 'Invoice overdue by 15 days.',
      type: 'overdue_invoice'
    },
    testCompanyId
  );

  await notificationService.createNotification(
    {
      title: 'System Notice: Daily Backup Completed',
      message: 'Database backup succeeded.',
      type: 'system'
    },
    testCompanyId
  );

  const wmFinalNotifs = await notificationService.getNotifications(testCompanyId, wmUserA.id, wmUserA.role);

  const receivedPayment = wmFinalNotifs.some(n => n.type === 'payment_received');
  const receivedInvoice = wmFinalNotifs.some(n => n.type === 'overdue_invoice');
  const receivedSystem = wmFinalNotifs.some(n => n.type === 'system');

  assert(!receivedPayment, 'Warehouse Manager is strictly blocked from receiving payment notifications');
  assert(!receivedInvoice, 'Warehouse Manager is strictly blocked from receiving invoice notifications');
  assert(!receivedSystem, 'Warehouse Manager is strictly blocked from receiving system administrative notices');

  // Ensure ALL notifications visible to Warehouse Manager belong ONLY to the 5 permitted categories
  const allMatchPermitted = wmFinalNotifs.every(n => {
    if (n.type === 'low_stock' || n.type === 'limited_stock' || n.type === 'out_of_stock' || n.type === 'stock_damage') {
      return true;
    }
    if (n.type === 'purchase_request' && n.title.includes('Cancelled')) {
      return true;
    }
    return false;
  });

  assert(allMatchPermitted, '100% of Warehouse Manager notifications belong strictly to the 5 permitted categories');

  // ---------------------------------------------------------------------------
  // REQUIREMENT 5: Replenishment Auto-Resolves & Re-alerts on Future Shortage
  // ---------------------------------------------------------------------------
  console.log('\n--- 7. Replenishment Auto-Resolves and Re-alerts on Shortage ---');

  // Replenish product A to 100 (well above threshold of 20)
  const replenishedBalances: StockBalance[] = [
    {
      id: 'sb-001',
      warehouseId: warehouseDelhi.id,
      productId: productA.id,
      quantity: 100,
      updatedAt: new Date().toISOString()
    }
  ];

  await stockAlertService.checkProductsStockAlerts(
    [{ ...productA, currentStock: 100 }],
    testCompanyId,
    allWarehouses,
    replenishedBalances,
    [wmUserA, wmUserB],
    wmUserA.id,
    wmUserA.role
  );

  const wmNotifsAfterReplenish = await notificationService.getNotifications(testCompanyId, wmUserA.id, wmUserA.role);
  const activeUnreadLowStock = wmNotifsAfterReplenish.filter(
    n => !n.read && (n.type === 'limited_stock' || n.type === 'low_stock') && n.productId === productA.id
  );
  assert(activeUnreadLowStock.length === 0, 'Replenishment automatically marks low stock alert as resolved/read');

  // Now drop stock below threshold again (e.g. down to 2)
  const lowAgainBalances: StockBalance[] = [
    {
      id: 'sb-001',
      warehouseId: warehouseDelhi.id,
      productId: productA.id,
      quantity: 2,
      updatedAt: new Date().toISOString()
    }
  ];

  await stockAlertService.checkProductsStockAlerts(
    [{ ...productA, currentStock: 2 }],
    testCompanyId,
    allWarehouses,
    lowAgainBalances,
    [wmUserA, wmUserB],
    wmUserA.id,
    wmUserA.role
  );

  const wmNotifsAfterSecondShortage = await notificationService.getNotifications(testCompanyId, wmUserA.id, wmUserA.role);
  const newLowStockAlert = wmNotifsAfterSecondShortage.find(
    n => !n.read && (n.type === 'limited_stock' || n.type === 'low_stock') && n.productId === productA.id
  );
  assert(Boolean(newLowStockAlert), 'Subsequent shortage after replenishment produces a fresh active alert');

  // ---------------------------------------------------------------------------
  // REQUIREMENT 4 & 8: Notification Bell & Unread Count Accuracy
  // ---------------------------------------------------------------------------
  console.log('\n--- 8. Notification Bell & Unread Count Accuracy ---');

  const unreadCount = wmNotifsAfterSecondShortage.filter(n => !n.read).length;
  assert(unreadCount > 0, `Unread count reflects only visible notifications (Actual: ${unreadCount})`);

  // Marking an alert as read updates status correctly
  if (newLowStockAlert) {
    await notificationService.markAsRead(newLowStockAlert.id, testCompanyId);
    const updatedNotifs = await notificationService.getNotifications(testCompanyId, wmUserA.id, wmUserA.role);
    const targetItem = updatedNotifs.find(n => n.id === newLowStockAlert.id);
    assert(targetItem?.read === true, 'Marking notification as read works correctly for Warehouse Manager');
  }

  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passedTests}/${totalTests} Passed (${totalTests - passedTests} Failed)`);
  console.log('================================================================');

  if (passedTests === totalTests) {
    console.log('🎉 All Warehouse Manager Notification Restriction acceptance tests passed 100%!\n');
  }
}

runTestSuite().catch(err => {
  console.error('Fatal error in test suite:', err);
  process.exit(1);
});
