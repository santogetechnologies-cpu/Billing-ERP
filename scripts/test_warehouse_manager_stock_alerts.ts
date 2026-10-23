// Test Suite: Warehouse Manager Targeted Low-Stock Alerts & Notification Isolation
// Verifies all 9 requirements from Universal Billing specification

import { stockAlertService } from '../src/services/stockAlertService';
import { notificationService } from '../src/services/notificationService';
import { companyService } from '../src/services/companyService';
import { Product, Warehouse, StockBalance, SystemUser } from '../src/types';

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
  console.log('TEST SUITE: WAREHOUSE MANAGER TARGETED STOCK ALERTS & ISOLATION');
  console.log('================================================================\n');

  const companyA = '00000000-0000-0000-0000-000000000001';
  const companyB = '00000000-0000-0000-0000-000000000002';

  // Define Mock Users
  const managerUserA: SystemUser = {
    id: 'user-wm-001',
    name: 'Vikram Singh (Manager A)',
    email: 'manager.a@company.com',
    role: 'Warehouse Manager',
    status: 'Active',
    accountStatus: 'Enabled',
    presenceStatus: 'Active',
    lastLogin: 'Today'
  };

  const managerUserB: SystemUser = {
    id: 'user-wm-002',
    name: 'Anjali Desai (Manager B)',
    email: 'manager.b@company.com',
    role: 'Warehouse Manager',
    status: 'Active',
    accountStatus: 'Enabled',
    presenceStatus: 'Active',
    lastLogin: 'Today'
  };

  const assistantManagerA: SystemUser = {
    id: 'user-wm-003',
    name: 'Rohan Verma (Assistant Manager A)',
    email: 'assistant.a@company.com',
    role: 'Warehouse Manager',
    status: 'Active',
    accountStatus: 'Enabled',
    presenceStatus: 'Active',
    lastLogin: 'Today'
  };

  const salespersonUser: SystemUser = {
    id: 'user-sales-001',
    name: 'Rahul Salesperson',
    email: 'sales@gmail.com',
    role: 'Salesperson',
    status: 'Active',
    accountStatus: 'Enabled',
    presenceStatus: 'Active',
    lastLogin: 'Today'
  };

  const cashierUser: SystemUser = {
    id: 'user-cashier-001',
    name: 'Priya Cashier',
    email: 'cashier@gmail.com',
    role: 'Cashier',
    status: 'Active',
    accountStatus: 'Enabled',
    presenceStatus: 'Active',
    lastLogin: 'Today'
  };

  const companyBManager: SystemUser = {
    id: 'user-compb-wm',
    name: 'Company B Manager',
    email: 'wm@companyb.com',
    role: 'Warehouse Manager',
    status: 'Active',
    accountStatus: 'Enabled',
    presenceStatus: 'Active',
    lastLogin: 'Today'
  };

  const allCompanyUsers: SystemUser[] = [
    managerUserA,
    managerUserB,
    assistantManagerA,
    salespersonUser,
    cashierUser
  ];

  // Define Mock Warehouses
  const warehouseA: Warehouse = {
    id: 'wh-loc-001',
    name: 'North Central Hub',
    code: 'WH-NORTH',
    address: 'Plot 12, Industrial Area, Delhi',
    isActive: true,
    isDefault: true,
    managerId: managerUserA.id,
    managerName: managerUserA.name,
    managerIds: [managerUserA.id]
  };

  const warehouseB: Warehouse = {
    id: 'wh-loc-002',
    name: 'South Coastal Godown',
    code: 'WH-SOUTH',
    address: 'Dock 4, Port Area, Chennai',
    isActive: true,
    isDefault: false,
    managerId: managerUserB.id,
    managerName: managerUserB.name,
    managerIds: [managerUserB.id]
  };

  const warehouseUnassigned: Warehouse = {
    id: 'wh-loc-003',
    name: 'East Buffer Store',
    code: 'WH-EAST',
    address: 'Sector 5, Kolkata',
    isActive: true,
    isDefault: false,
    managerId: null,
    managerName: '',
    managerIds: []
  };

  // Define Mock Products
  const prodSteelRod: Product = {
    id: 'prod-steel-001',
    name: 'TMT Steel Rod 12mm',
    sku: 'STEEL-12MM',
    category: 'Construction',
    hsn: '7214',
    taxRate: 18,
    costPrice: 500,
    sellingPrice: 650,
    currentStock: 4,
    openingStock: 50,
    reorderLevel: 10, // Minimum threshold = 10
    primaryUnit: 'Piece',
    batchTracking: false,
    serialTracking: false
  } as unknown as Product;

  const prodCementBag: Product = {
    id: 'prod-cement-002',
    name: 'UltraTech Portland Cement',
    sku: 'CEMENT-50KG',
    category: 'Construction',
    hsn: '2523',
    taxRate: 28,
    costPrice: 320,
    sellingPrice: 410,
    currentStock: 2,
    openingStock: 100,
    reorderLevel: 25, // Minimum threshold = 25
    primaryUnit: 'Bag',
    batchTracking: false,
    serialTracking: false
  } as unknown as Product;

  // Clear previous test notifications in memory / local cache
  await notificationService.clearAll(companyA, undefined, 'Owner');
  await notificationService.clearAll(companyB, undefined, 'Owner');

  // -----------------------------------------------------------------------------
  // Scenario 1: Limited stock in Warehouse A notifies only Warehouse A's manager
  // -----------------------------------------------------------------------------
  console.log('--- 1. Limited stock in Warehouse A notifies only Warehouse A Manager ---');
  // Stock in Warehouse A is 5 (greater than 0, but below threshold 10)
  // Stock in Warehouse B is 50 (healthy)
  const balancesS1: StockBalance[] = [
    { id: 'sb-1', warehouseId: warehouseA.id, productId: prodSteelRod.id, quantity: 5 },
    { id: 'sb-2', warehouseId: warehouseB.id, productId: prodSteelRod.id, quantity: 50 }
  ];

  await stockAlertService.checkProductsStockAlerts(
    [prodSteelRod],
    companyA,
    [warehouseA, warehouseB],
    balancesS1,
    allCompanyUsers
  );

  const notifsForManagerA = await notificationService.getNotifications(
    companyA,
    managerUserA.id,
    'Warehouse Manager'
  );
  const notifsForManagerB = await notificationService.getNotifications(
    companyA,
    managerUserB.id,
    'Warehouse Manager'
  );

  assert(notifsForManagerA.length > 0, 'Warehouse A Manager received stock alert');
  const alertA = notifsForManagerA[0];
  assert(
    alertA?.type === 'limited_stock',
    'Alert type is strictly "limited_stock"'
  );
  assert(
    alertA?.message.includes(warehouseA.name) && alertA?.message.includes(prodSteelRod.name),
    `Alert mentions Warehouse A ("${warehouseA.name}") and product ("${prodSteelRod.name}")`
  );
  assert(
    alertA?.message.includes(prodSteelRod.sku || '') && alertA?.message.includes('5 Piece') && alertA?.message.includes('10 Piece'),
    'Alert includes SKU, current quantity (5 Piece), and minimum threshold (10 Piece)'
  );
  assert(
    notifsForManagerB.length === 0,
    'Warehouse B Manager received 0 notifications for Warehouse A low stock'
  );
  console.log('');

  // -----------------------------------------------------------------------------
  // Scenario 1B: Out of Stock (Available quantity = 0) in Warehouse A
  // -----------------------------------------------------------------------------
  console.log('--- 1B. Out of stock (0 quantity) notifies only Warehouse A Manager with Out of Stock alert ---');
  await notificationService.clearAll(companyA, undefined, 'Owner');
  stockAlertService.saveAlertState(companyA, {});

  const balancesZero: StockBalance[] = [
    { id: 'sb-1', warehouseId: warehouseA.id, productId: prodSteelRod.id, quantity: 0 },
    { id: 'sb-2', warehouseId: warehouseB.id, productId: prodSteelRod.id, quantity: 50 }
  ];

  await stockAlertService.checkProductsStockAlerts(
    [prodSteelRod],
    companyA,
    [warehouseA, warehouseB],
    balancesZero,
    allCompanyUsers
  );

  const outOfStockA = await notificationService.getNotifications(companyA, managerUserA.id, 'Warehouse Manager');
  const outOfStockB = await notificationService.getNotifications(companyA, managerUserB.id, 'Warehouse Manager');

  assert(outOfStockA.length === 1, 'Warehouse A Manager received Out of Stock alert');
  assert(outOfStockA[0]?.type === 'out_of_stock', 'Alert type is strictly "out_of_stock"');
  assert(
    outOfStockA[0]?.title.includes('Out of Stock') && outOfStockA[0]?.message.includes('Available quantity: 0 Piece'),
    'Alert specifies "Out of Stock" title and "Available quantity: 0 Piece"'
  );
  assert(outOfStockB.length === 0, 'Warehouse B Manager received 0 alerts for Warehouse A out of stock');
  console.log('');

  // -----------------------------------------------------------------------------
  // Scenario 1C: Stock above threshold produces NO alerts
  // -----------------------------------------------------------------------------
  console.log('--- 1C. Stock above threshold produces NO stock alerts ---');
  await notificationService.clearAll(companyA, undefined, 'Owner');
  stockAlertService.saveAlertState(companyA, {});

  const balancesHealthy: StockBalance[] = [
    { id: 'sb-1', warehouseId: warehouseA.id, productId: prodSteelRod.id, quantity: 80 },
    { id: 'sb-2', warehouseId: warehouseB.id, productId: prodSteelRod.id, quantity: 50 }
  ];

  await stockAlertService.checkProductsStockAlerts(
    [prodSteelRod],
    companyA,
    [warehouseA, warehouseB],
    balancesHealthy,
    allCompanyUsers
  );

  const healthyA = await notificationService.getNotifications(companyA, managerUserA.id, 'Warehouse Manager');
  assert(healthyA.length === 0, 'No alerts generated when stock is safely above threshold');
  console.log('');

  // -----------------------------------------------------------------------------
  // Scenario 2: Low stock in Warehouse B notifies only Warehouse B's manager
  // -----------------------------------------------------------------------------
  console.log('--- 2. Low stock in Warehouse B notifies only Warehouse B Manager ---');
  // Cement in Warehouse B is 3 bags (below threshold 25)
  // Cement in Warehouse A is 100 bags (healthy)
  const balancesS2: StockBalance[] = [
    ...balancesS1,
    { id: 'sb-3', warehouseId: warehouseA.id, productId: prodCementBag.id, quantity: 100 },
    { id: 'sb-4', warehouseId: warehouseB.id, productId: prodCementBag.id, quantity: 3 }
  ];

  await stockAlertService.checkProductsStockAlerts(
    [prodSteelRod, prodCementBag],
    companyA,
    [warehouseA, warehouseB],
    balancesS2,
    allCompanyUsers
  );

  const notifsB_After = await notificationService.getNotifications(
    companyA,
    managerUserB.id,
    'Warehouse Manager'
  );
  assert(notifsB_After.length === 1, 'Warehouse B Manager received exactly 1 targeted notification');
  const alertB = notifsB_After[0];
  assert(
    alertB?.message.includes(warehouseB.name) && alertB?.message.includes(prodCementBag.name),
    `Alert mentions Warehouse B ("${warehouseB.name}") and Cement ("${prodCementBag.name}")`
  );
  assert(
    alertB?.message.includes('3 Bag') && alertB?.message.includes('25 Bag'),
    'Alert includes quantity 3 Bag and minimum threshold 25 Bag'
  );
  console.log('');

  // -----------------------------------------------------------------------------
  // Scenario 3: Sales Persons, Cashiers, Owners, and unrelated Admins receive NO stock alerts
  // -----------------------------------------------------------------------------
  console.log('--- 3. Sales Persons, Cashiers, Owners, and Admins receive NO stock alerts unless assigned ---');
  const notifsForSales = await notificationService.getNotifications(
    companyA,
    salespersonUser.id,
    'Salesperson'
  );
  const notifsForCashier = await notificationService.getNotifications(
    companyA,
    cashierUser.id,
    'Cashier'
  );
  const notifsForOwner = await notificationService.getNotifications(
    companyA,
    'user-owner-001',
    'Owner'
  );
  const notifsForAdmin = await notificationService.getNotifications(
    companyA,
    'user-admin-001',
    'Admin'
  );

  assert(
    notifsForSales.length === 0,
    `Sales Person received 0 stock notifications (Actual: ${notifsForSales.length})`
  );
  assert(
    notifsForCashier.length === 0,
    `Cashier received 0 stock notifications (Actual: ${notifsForCashier.length})`
  );
  assert(
    notifsForOwner.length === 0,
    `Unassigned Owner received 0 stock notifications (Actual: ${notifsForOwner.length})`
  );
  assert(
    notifsForAdmin.length === 0,
    `Unassigned Admin received 0 stock notifications (Actual: ${notifsForAdmin.length})`
  );

  // Directly verify checkProductsStockAlerts returns empty array for Salesperson
  const directSalesAlerts = await stockAlertService.checkProductsStockAlerts(
    [prodSteelRod, prodCementBag],
    companyA,
    [warehouseA, warehouseB],
    balancesS2,
    allCompanyUsers,
    salespersonUser.id,
    'Salesperson'
  );
  assert(
    directSalesAlerts.length === 0,
    'stockAlertService returns [] for Salesperson caller'
  );
  console.log('');

  // -----------------------------------------------------------------------------
  // Scenario 4: Multiple assigned managers receive notifications if authorized
  // -----------------------------------------------------------------------------
  console.log('--- 4. Multiple assigned managers receive notification if authorized ---');
  // Assign both Manager A and Assistant Manager A to Warehouse A
  const warehouseAMulti: Warehouse = {
    ...warehouseA,
    managerIds: [managerUserA.id, assistantManagerA.id]
  };

  // Re-run for Warehouse A with multi-managers
  await notificationService.clearAll(companyA, undefined, 'Owner');
  // Reset alert state for clean multi-manager dispatch
  stockAlertService.saveAlertState(companyA, {});

  await stockAlertService.checkProductsStockAlerts(
    [prodSteelRod],
    companyA,
    [warehouseAMulti, warehouseB],
    balancesS1,
    allCompanyUsers
  );

  const notifsA1 = await notificationService.getNotifications(companyA, managerUserA.id, 'Warehouse Manager');
  const notifsA2 = await notificationService.getNotifications(companyA, assistantManagerA.id, 'Warehouse Manager');
  const notifsBMulti = await notificationService.getNotifications(companyA, managerUserB.id, 'Warehouse Manager');

  assert(notifsA1.length > 0, 'Primary Manager A received the alert');
  assert(notifsA2.length > 0, 'Assistant Manager A explicitly assigned received the alert');
  assert(notifsBMulti.length === 0, 'Unassigned Manager B received 0 alerts');
  console.log('');

  // -----------------------------------------------------------------------------
  // Scenario 4B: Explicitly assigned Admin receives stock alert, but unrelated Admin does not
  // -----------------------------------------------------------------------------
  console.log('--- 4B. Explicitly assigned Admin receives stock alert, but unrelated Admin does not ---');
  const adminManagerUser: SystemUser = {
    id: 'user-admin-assigned',
    name: 'Gaurav Admin (Assigned Manager)',
    email: 'admin.assigned@company.com',
    role: 'Admin',
    status: 'Active',
    accountStatus: 'Enabled',
    presenceStatus: 'Active',
    lastLogin: 'Today'
  };

  const warehouseWithAdminManager: Warehouse = {
    ...warehouseA,
    managerIds: [adminManagerUser.id]
  };

  await notificationService.clearAll(companyA, undefined, 'Owner');
  stockAlertService.saveAlertState(companyA, {});

  await stockAlertService.checkProductsStockAlerts(
    [prodSteelRod],
    companyA,
    [warehouseWithAdminManager],
    balancesS1,
    [...allCompanyUsers, adminManagerUser]
  );

  const notifsForAssignedAdmin = await notificationService.getNotifications(companyA, adminManagerUser.id, 'Admin');
  const notifsForUnrelatedAdmin = await notificationService.getNotifications(companyA, 'user-admin-unrelated', 'Admin');

  assert(notifsForAssignedAdmin.length === 1, 'Admin explicitly assigned to warehouse receives stock alert');
  assert(notifsForUnrelatedAdmin.length === 0, 'Unrelated Admin receives 0 stock alerts');
  console.log('');

  // -----------------------------------------------------------------------------
  // Scenario 5: Multi-Tenant Company Isolation
  // -----------------------------------------------------------------------------
  console.log('--- 5. Multi-Tenant Company Isolation ---');
  const notifsCompanyB = await notificationService.getNotifications(
    companyB,
    companyBManager.id,
    'Warehouse Manager'
  );
  assert(
    notifsCompanyB.length === 0,
    'Company B Manager cannot access or see any alerts from Company A'
  );
  console.log('');

  // -----------------------------------------------------------------------------
  // Scenario 6: Repeated queries do NOT generate duplicate notifications
  // -----------------------------------------------------------------------------
  console.log('--- 6. Deduplication on repeated queries ---');
  const countBefore = (await notificationService.getNotifications(companyA, managerUserA.id, 'Warehouse Manager')).length;

  // Run alert check 3 consecutive times with same balances
  await stockAlertService.checkProductsStockAlerts(
    [prodSteelRod],
    companyA,
    [warehouseAMulti, warehouseB],
    balancesS1,
    allCompanyUsers
  );
  await stockAlertService.checkProductsStockAlerts(
    [prodSteelRod],
    companyA,
    [warehouseAMulti, warehouseB],
    balancesS1,
    allCompanyUsers
  );

  const countAfter = (await notificationService.getNotifications(companyA, managerUserA.id, 'Warehouse Manager')).length;
  assert(
    countAfter === countBefore,
    `No duplicate alerts generated on repeated stock checks (Before: ${countBefore}, After: ${countAfter})`
  );
  console.log('');

  // -----------------------------------------------------------------------------
  // Scenario 7: Restocking and subsequent shortage generate a new alert
  // -----------------------------------------------------------------------------
  console.log('--- 7. Restocking auto-resolves and re-alert on subsequent shortage ---');
  // Replenish Steel Rod in Warehouse A from 5 to 50 (above threshold 10)
  const replenishedBalances: StockBalance[] = [
    { id: 'sb-1', warehouseId: warehouseA.id, productId: prodSteelRod.id, quantity: 50 },
    { id: 'sb-2', warehouseId: warehouseB.id, productId: prodSteelRod.id, quantity: 50 }
  ];

  await stockAlertService.checkProductsStockAlerts(
    [prodSteelRod],
    companyA,
    [warehouseAMulti, warehouseB],
    replenishedBalances,
    allCompanyUsers
  );

  const notifsAfterReplenish = await notificationService.getNotifications(
    companyA,
    managerUserA.id,
    'Warehouse Manager'
  );
  const unreadAlertsAfterReplenish = notifsAfterReplenish.filter(n => !n.read && n.productId === prodSteelRod.id);
  assert(
    unreadAlertsAfterReplenish.length === 0,
    'Existing unread alerts were automatically marked as read/resolved upon replenishment'
  );

  // Now, stock falls below threshold AGAIN (from 50 down to 2)
  const shortageBalances: StockBalance[] = [
    { id: 'sb-1', warehouseId: warehouseA.id, productId: prodSteelRod.id, quantity: 2 },
    { id: 'sb-2', warehouseId: warehouseB.id, productId: prodSteelRod.id, quantity: 50 }
  ];

  await stockAlertService.checkProductsStockAlerts(
    [prodSteelRod],
    companyA,
    [warehouseAMulti, warehouseB],
    shortageBalances,
    allCompanyUsers
  );

  const notifsAfterShortage = await notificationService.getNotifications(
    companyA,
    managerUserA.id,
    'Warehouse Manager'
  );
  const newActiveAlert = notifsAfterShortage.find(n => !n.read && n.productId === prodSteelRod.id);
  assert(
    !!newActiveAlert,
    'New active alert generated after stock dropped below threshold a second time'
  );
  console.log('');

  // -----------------------------------------------------------------------------
  // Scenario 8: Safe fallback policy for unassigned warehouses
  // -----------------------------------------------------------------------------
  console.log('--- 8. Safe fallback policy for unassigned warehouses ---');
  // Warehouse C has no assigned manager
  const balancesUnassigned: StockBalance[] = [
    { id: 'sb-5', warehouseId: warehouseUnassigned.id, productId: prodSteelRod.id, quantity: 1 }
  ];

  await stockAlertService.checkProductsStockAlerts(
    [prodSteelRod],
    companyA,
    [warehouseUnassigned],
    balancesUnassigned,
    allCompanyUsers
  );

  // Sales Person and Cashier must STILL receive 0 alerts!
  const salesOnUnassigned = await notificationService.getNotifications(companyA, salespersonUser.id, 'Salesperson');
  const cashierOnUnassigned = await notificationService.getNotifications(companyA, cashierUser.id, 'Cashier');
  assert(salesOnUnassigned.length === 0, 'Sales Person receives 0 alerts even for unassigned warehouse');
  assert(cashierOnUnassigned.length === 0, 'Cashier receives 0 alerts even for unassigned warehouse');

  // Warehouse Managers A and B do NOT receive alerts for unassigned warehouse C
  const managerAUnassigned = (await notificationService.getNotifications(companyA, managerUserA.id, 'Warehouse Manager')).filter(n => n.warehouseId === warehouseUnassigned.id);
  assert(managerAUnassigned.length === 0, 'Warehouse A Manager receives 0 alerts for unassigned Warehouse C');
  const managerBUnassigned = (await notificationService.getNotifications(companyA, managerUserB.id, 'Warehouse Manager')).filter(n => n.warehouseId === warehouseUnassigned.id);
  assert(managerBUnassigned.length === 0, 'Warehouse B Manager receives 0 alerts for unassigned Warehouse C');

  // Executive (Owner / Admin) receives the unassigned warehouse administrative notice
  const adminAlerts = await notificationService.getNotifications(companyA, 'admin-id', 'Admin');
  assert(adminAlerts.length > 0, 'Company Admin/Owner can oversee unassigned warehouse administrative notice');
  assert(adminAlerts.every(n => n.type === 'system'), 'Administrative notice is of type "system", not a stock broadcast');
  console.log('');

  // -----------------------------------------------------------------------------
  // Scenario 9: Existing non-stock notifications continue working normally
  // -----------------------------------------------------------------------------
  console.log('--- 9. Existing non-stock notifications continue working ---');
  const paymentNotif = await notificationService.createNotification(
    {
      title: 'Payment Received: INV-2026-001',
      message: 'Payment of Rs. 15,000 received from Customer ABC',
      type: 'payment_received',
      link: '/payments'
    },
    companyA
  );

  assert(paymentNotif.id.length > 0, 'Non-stock payment notification created successfully');
  const salesWithPayment = await notificationService.getNotifications(companyA, salespersonUser.id, 'Salesperson');
  assert(
    salesWithPayment.some(n => n.type === 'payment_received'),
    'Sales Person receives payment notifications without being blocked'
  );
  console.log('');

  // -----------------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------------
  console.log('================================================================');
  console.log(` TEST RESULTS: ${passedTests}/${totalTests} Passed (${totalTests - passedTests} Failed)`);
  console.log('================================================================');

  if (passedTests === totalTests) {
    console.log('🎉 All Warehouse Manager stock alert targeting & isolation tests passed 100%!\n');
  } else {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
