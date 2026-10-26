/**
 * Comprehensive Verification Suite: Warehouse Manager Notifications Master Test
 * 
 * Verifies all 10 required testing scenarios from the Master Prompt:
 * 1. Stock falls to zero -> one Out of Stock Alert (Critical, "View Product").
 * 2. Stock reaches its warning limit but remains above zero -> one Limited Stock Alert (High, "View Product").
 * 3. Stock remains unchanged -> no duplicate alerts.
 * 4. Stock recovers and later becomes limited again -> a new alert is allowed.
 * 5. Purchase request becomes Approved -> only its submitting Warehouse Manager is notified (Normal, "View Purchase Request").
 * 6. Purchase request becomes Rejected -> only its submitting Warehouse Manager is notified (High, "View Purchase Request", with reason).
 * 7. A batch enters its 30-day expiry window -> an expiry alert is created ("Product Expiring Soon", High, "View Batch & Expiry Management").
 * 8. End-of-day reminder runs -> one reminder per Warehouse Manager per business date when relevant batches exist.
 * 9. Expired batches are clearly distinguished from batches approaching expiry.
 * 10. Notifications open the correct records and recipient authorization prevents leakage to other roles.
 */

import { stockAlertService, getBusinessDayConfig } from '../src/services/stockAlertService';
import { purchaseRequestService } from '../src/services/purchaseRequestService';
import { notificationService, sortNotifications } from '../src/services/notificationService';
import { getAppStorage } from '../src/utils/storageUtils';
import { Product, Warehouse, StockBalance, Batch, NotificationItem, PurchaseRequest } from '../src/types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    throw new Error(msg);
  } else {
    console.log(`  ✓ ${msg}`);
  }
}

async function runTestSuite() {
  console.log('======================================================================');
  console.log('🚀 RUNNING WAREHOUSE MANAGER NOTIFICATIONS VERIFICATION SUITE');
  console.log('======================================================================\n');

  const testCompanyId = '00000000-0000-0000-0000-000000000099';
  const warehouseManagerId = '11111111-1111-4111-8111-111111111111';
  const otherManagerId = '22222222-2222-4222-8222-222222222222';
  const testWarehouseId = '33333333-3333-4333-8333-333333333333';

  const testWarehouse: Warehouse = {
    id: testWarehouseId,
    name: 'Main Central Warehouse',
    code: 'MAIN',
    address: '100 Industrial Parkway',
    managerId: warehouseManagerId,
    managerIds: [warehouseManagerId],
    isActive: true
  };

  const cementProduct: Product = {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Cement',
    sku: 'BUI-CEM-00001',
    primaryUnit: 'Bag',
    currentStock: 50,
    reorderLevel: 20,
    price: 350,
    cost: 280,
    companyId: testCompanyId,
    createdAt: new Date().toISOString()
  };

  const paintProduct: Product = {
    id: 'prod-paint-005',
    name: 'Paint',
    sku: 'PAI-PAI-00005',
    primaryUnit: 'Piece',
    currentStock: 30,
    reorderLevel: 10,
    price: 600,
    cost: 450,
    companyId: testCompanyId,
    createdAt: new Date().toISOString()
  };

  let simulatedNotifications: NotificationItem[] = [];

  const createNotifMock = async (notif: any, cId?: string) => {
    const item: NotificationItem = {
      id: `notif-${Math.random().toString(16).slice(2, 10)}`,
      title: notif.title,
      message: notif.message,
      type: notif.type,
      link: notif.link,
      userId: notif.userId,
      warehouseId: notif.warehouseId,
      productId: notif.productId,
      warehouseName: notif.warehouseName,
      priority: notif.priority || 'Normal',
      actionText: notif.actionText,
      dedupKey: notif.dedupKey,
      read: false,
      timestamp: 'Just now',
      createdAt: new Date().toISOString()
    };
    simulatedNotifications.push(item);
    return item;
  };

  const markAsReadMock = async (id: string) => {
    const idx = simulatedNotifications.findIndex(n => n.id === id);
    if (idx !== -1) {
      simulatedNotifications[idx].read = true;
    }
  };

  // Clear mock state
  stockAlertService.saveAlertState(testCompanyId, {});

  // -------------------------------------------------------------------------
  // Scenario 1: Stock falls to zero -> one Out of Stock Alert
  // -------------------------------------------------------------------------
  console.log('--- SCENARIO 1: Stock falls to zero -> one Out of Stock Alert ---');
  {
    const initialBalances: StockBalance[] = [
      { id: 'sb-1', warehouseId: testWarehouseId, productId: cementProduct.id, quantity: 0 }
    ];

    await stockAlertService.checkAndTriggerStockAlerts({
      products: [cementProduct],
      companyId: testCompanyId,
      warehouses: [testWarehouse],
      stockBalances: initialBalances,
      existingNotifications: simulatedNotifications,
      createNotification: createNotifMock,
      markAsRead: markAsReadMock
    });

    const oosAlerts = simulatedNotifications.filter(
      n => n.type === 'out_of_stock' && n.productId === cementProduct.id && !n.read
    );

    assert(oosAlerts.length === 1, 'Exactly one Out of Stock Alert was created');
    assert(oosAlerts[0].title === 'Out of Stock Alert', 'Title is exactly "Out of Stock Alert"');
    assert(
      oosAlerts[0].message === 'Cement (SKU: BUI-CEM-00001) is out of stock in Main Central Warehouse.',
      `Message formatted correctly: "${oosAlerts[0].message}"`
    );
    assert(oosAlerts[0].priority === 'Critical', 'Priority is "Critical"');
    assert(oosAlerts[0].actionText === 'View Product', 'Action text is "View Product"');
    assert(oosAlerts[0].userId === warehouseManagerId, 'Delivered strictly to assigned Warehouse Manager');
    assert(
      oosAlerts[0].link?.includes('/products?search='),
      `Link opens product search: ${oosAlerts[0].link}`
    );
  }

  // -------------------------------------------------------------------------
  // Scenario 2: Stock reaches warning limit but remains above zero -> one Limited Stock Alert
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO 2: Stock reaches warning limit -> one Limited Stock Alert ---');
  {
    const balances: StockBalance[] = [
      { id: 'sb-1', warehouseId: testWarehouseId, productId: cementProduct.id, quantity: 0 },
      { id: 'sb-2', warehouseId: testWarehouseId, productId: paintProduct.id, quantity: 8 }
    ];

    await stockAlertService.checkAndTriggerStockAlerts({
      products: [cementProduct, paintProduct],
      companyId: testCompanyId,
      warehouses: [testWarehouse],
      stockBalances: balances,
      existingNotifications: simulatedNotifications,
      createNotification: createNotifMock,
      markAsRead: markAsReadMock
    });

    const limitedAlerts = simulatedNotifications.filter(
      n => n.type === 'limited_stock' && n.productId === paintProduct.id && !n.read
    );

    assert(limitedAlerts.length === 1, 'Exactly one Limited Stock Alert was created');
    assert(limitedAlerts[0].title === 'Limited Stock Alert', 'Title is exactly "Limited Stock Alert"');
    assert(
      limitedAlerts[0].message === 'Paint (SKU: PAI-PAI-00005) has 8 Piece remaining in Main Central Warehouse. Warning limit: 10 Piece.',
      `Message matches exact format: "${limitedAlerts[0].message}"`
    );
    assert(limitedAlerts[0].priority === 'High', 'Priority is "High"');
    assert(limitedAlerts[0].actionText === 'View Product', 'Action is "View Product"');
    assert(limitedAlerts[0].userId === warehouseManagerId, 'Delivered strictly to assigned Warehouse Manager');
  }

  // -------------------------------------------------------------------------
  // Scenario 3: Stock remains unchanged -> no duplicate alerts
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO 3: Stock remains unchanged -> no duplicate alerts ---');
  {
    const initialCount = simulatedNotifications.length;
    const balances: StockBalance[] = [
      { id: 'sb-1', warehouseId: testWarehouseId, productId: cementProduct.id, quantity: 0 },
      { id: 'sb-2', warehouseId: testWarehouseId, productId: paintProduct.id, quantity: 8 }
    ];

    // Re-run check with unchanged stock
    await stockAlertService.checkAndTriggerStockAlerts({
      products: [cementProduct, paintProduct],
      companyId: testCompanyId,
      warehouses: [testWarehouse],
      stockBalances: balances,
      existingNotifications: simulatedNotifications,
      createNotification: createNotifMock,
      markAsRead: markAsReadMock
    });

    assert(
      simulatedNotifications.length === initialCount,
      `No duplicate alerts generated (count remained ${initialCount})`
    );
  }

  // -------------------------------------------------------------------------
  // Scenario 4: Stock recovers and later becomes limited again -> new alert is allowed
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO 4: Stock recovers and later drops -> new alert allowed ---');
  {
    // 1. Paint replenished to 25 (above reorder limit of 10)
    const replenishedBalances: StockBalance[] = [
      { id: 'sb-1', warehouseId: testWarehouseId, productId: cementProduct.id, quantity: 0 },
      { id: 'sb-2', warehouseId: testWarehouseId, productId: paintProduct.id, quantity: 25 }
    ];

    await stockAlertService.checkAndTriggerStockAlerts({
      products: [cementProduct, paintProduct],
      companyId: testCompanyId,
      warehouses: [testWarehouse],
      stockBalances: replenishedBalances,
      existingNotifications: simulatedNotifications,
      createNotification: createNotifMock,
      markAsRead: markAsReadMock
    });

    // Previous paint alert should be resolved (marked as read)
    const activePaintAlerts = simulatedNotifications.filter(
      n => n.type === 'limited_stock' && n.productId === paintProduct.id && !n.read
    );
    assert(activePaintAlerts.length === 0, 'Previous limited stock alert auto-resolved upon replenishment');

    // 2. Later, stock drops back to 6 Piece (below limit of 10)
    const droppedBalances: StockBalance[] = [
      { id: 'sb-1', warehouseId: testWarehouseId, productId: cementProduct.id, quantity: 0 },
      { id: 'sb-2', warehouseId: testWarehouseId, productId: paintProduct.id, quantity: 6 }
    ];

    await stockAlertService.checkAndTriggerStockAlerts({
      products: [cementProduct, paintProduct],
      companyId: testCompanyId,
      warehouses: [testWarehouse],
      stockBalances: droppedBalances,
      existingNotifications: simulatedNotifications,
      createNotification: createNotifMock,
      markAsRead: markAsReadMock
    });

    const newPaintAlerts = simulatedNotifications.filter(
      n => n.type === 'limited_stock' && n.productId === paintProduct.id && !n.read
    );
    assert(newPaintAlerts.length === 1, 'New Limited Stock Alert successfully created after drop');
    assert(
      newPaintAlerts[0].message.includes('has 6 Piece remaining'),
      `Updated quantity reflected: "${newPaintAlerts[0].message}"`
    );
  }

  // -------------------------------------------------------------------------
  // Scenario 5: Purchase Request becomes Approved -> only submitting manager notified
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO 5: Purchase Request Approved -> only submitting manager notified ---');
  {
    const dummyPR: PurchaseRequest = {
      id: 'pr-test-101',
      companyId: testCompanyId,
      requestNumber: 'PR-2026-0001',
      requesterId: warehouseManagerId,
      requesterName: 'Main Warehouse Manager',
      warehouseId: testWarehouseId,
      warehouseName: 'Main Central Warehouse',
      status: 'Pending Review',
      priority: 'High',
      requiredDate: '2026-11-01',
      items: [
        {
          id: 'item-1',
          productId: cementProduct.id,
          productName: 'Cement',
          requestedQty: 100,
          unit: 'Bag',
          estimatedCost: 280
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: []
    };

    const storage = getAppStorage();
    if (storage) {
      storage.setItem(`universal_billing_purchase_requests_${testCompanyId}`, JSON.stringify([dummyPR]));
    }

    const notifsBefore = simulatedNotifications.length;

    // Simulate approval transition
    await purchaseRequestService.updateRequestStatus(
      {
        requestId: dummyPR.id,
        status: 'Approved',
        comments: 'Approved by Purchase Manager'
      },
      testCompanyId,
      { id: 'pm-001', name: 'Purchase Officer', role: 'Purchase Manager' }
    );

    // Fetch notifications
    const prNotifs = await notificationService.getNotifications(testCompanyId);
    const approvedNotifs = prNotifs.filter(
      n => n.type === 'purchase_request' && n.title === 'Purchase Request Approved'
    );

    assert(approvedNotifs.length >= 1, 'Purchase Request Approved notification generated');
    const targetNotif = approvedNotifs[0];
    assert(targetNotif.title === 'Purchase Request Approved', 'Title is "Purchase Request Approved"');
    assert(
      targetNotif.message === 'Your purchase request for Cement has been approved. You can view the request details.',
      `Message formatted as requested: "${targetNotif.message}"`
    );
    assert(targetNotif.priority === 'Normal', 'Priority is "Normal"');
    assert(targetNotif.actionText === 'View Purchase Request', 'Action is "View Purchase Request"');
    assert(targetNotif.userId === warehouseManagerId, 'Delivered strictly to submitting Warehouse Manager');

    // Verify other managers cannot see this notification
    const canOtherManagerSee = notificationService.isAuthorizedRecipient(
      targetNotif,
      otherManagerId,
      'Warehouse Manager'
    );
    assert(!canOtherManagerSee, 'Other Warehouse Manager CANNOT see this approved request notification');
  }

  // -------------------------------------------------------------------------
  // Scenario 6: Purchase Request becomes Rejected -> only submitting manager notified
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO 6: Purchase Request Rejected -> only submitting manager notified ---');
  {
    const dummyPR2: PurchaseRequest = {
      id: 'pr-test-102',
      companyId: testCompanyId,
      requestNumber: 'PR-2026-0002',
      requesterId: warehouseManagerId,
      requesterName: 'Main Warehouse Manager',
      warehouseId: testWarehouseId,
      warehouseName: 'Main Central Warehouse',
      status: 'Pending Review',
      priority: 'Normal',
      requiredDate: '2026-11-05',
      items: [
        {
          id: 'item-2',
          productId: paintProduct.id,
          productName: 'Paint',
          requestedQty: 50,
          unit: 'Piece',
          estimatedCost: 450
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: []
    };

    const storage = getAppStorage();
    if (storage) {
      storage.setItem(
        `universal_billing_purchase_requests_${testCompanyId}`,
        JSON.stringify([dummyPR2])
      );
    }

    await purchaseRequestService.updateRequestStatus(
      {
        requestId: dummyPR2.id,
        status: 'Rejected',
        rejectionReason: 'Exceeds monthly inventory replenishment budget'
      },
      testCompanyId,
      { id: 'pm-001', name: 'Purchase Officer', role: 'Purchase Manager' }
    );

    const prNotifs = await notificationService.getNotifications(testCompanyId);
    const rejectedNotifs = prNotifs.filter(
      n => n.type === 'purchase_request' && n.title === 'Purchase Request Rejected'
    );

    assert(rejectedNotifs.length >= 1, 'Purchase Request Rejected notification generated');
    const targetNotif = rejectedNotifs[0];
    assert(targetNotif.title === 'Purchase Request Rejected', 'Title is "Purchase Request Rejected"');
    assert(
      targetNotif.message === 'Your purchase request has been rejected. Reason: Exceeds monthly inventory replenishment budget.',
      `Message includes actual rejection reason: "${targetNotif.message}"`
    );
    assert(targetNotif.priority === 'High', 'Priority is "High"');
    assert(targetNotif.actionText === 'View Purchase Request', 'Action is "View Purchase Request"');
    assert(targetNotif.userId === warehouseManagerId, 'Delivered strictly to submitting Warehouse Manager');
  }

  // -------------------------------------------------------------------------
  // Scenario 7: A batch enters its 30-day expiry window -> an expiry alert is created
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO 7: Batch enters 30-day expiry window -> alert created ---');
  {
    // Create date 20 days in the future (within 30-day window)
    const in20Days = new Date();
    in20Days.setDate(in20Days.getDate() + 20);
    const expiryStr = in20Days.toISOString().split('T')[0];

    const expiringBatch: Batch = {
      id: 'batch-exp-001',
      productId: 'prod-med-001',
      productName: 'Medicine Antiseptic Cream',
      batchNumber: 'BAT-2026-MED01',
      mfgDate: '2025-01-01',
      expiryDate: expiryStr,
      purchaseDate: '2025-01-10',
      cost: 50,
      qty: 120,
      status: 'Expiring Soon',
      warehouseId: testWarehouseId
    };

    const alerts = await stockAlertService.checkBatchExpiryAlerts({
      batches: [expiringBatch],
      companyId: testCompanyId,
      warehouses: [testWarehouse],
      existingNotifications: simulatedNotifications,
      createNotification: createNotifMock
    });

    assert(alerts.length === 1, 'Batch expiry alert created for 30-day approaching batch');
    assert(alerts[0].title === 'Product Expiring Soon', 'Title is "Product Expiring Soon"');
    assert(
      alerts[0].message === `Medicine Antiseptic Cream, Batch BAT-2026-MED01, expires on ${expiryStr}. Please review the remaining stock.`,
      `Message formatted exactly: "${alerts[0].message}"`
    );
    assert(alerts[0].priority === 'High', 'Priority is "High"');
    assert(alerts[0].actionText === 'View Batch & Expiry Management', 'Action is "View Batch & Expiry Management"');
    assert(alerts[0].link?.includes('/inventory/batches'), 'Link navigates to batch management');
  }

  // -------------------------------------------------------------------------
  // Scenario 8: End-of-day reminder runs -> one reminder per Warehouse Manager per business date
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO 8: End-of-Day Expiry Reminder runs -> one reminder per manager ---');
  {
    const in10Days = new Date();
    in10Days.setDate(in10Days.getDate() + 10);

    const in25Days = new Date();
    in25Days.setDate(in25Days.getDate() + 25);

    const testBatches: Batch[] = [
      {
        id: 'b-1',
        productId: 'prod-1',
        productName: 'Antibiotic Ointment',
        batchNumber: 'B-001',
        mfgDate: '2025-01-01',
        expiryDate: in10Days.toISOString().split('T')[0],
        purchaseDate: '2025-01-01',
        cost: 20,
        qty: 15,
        status: 'Expiring Soon',
        warehouseId: testWarehouseId
      },
      {
        id: 'b-2',
        productId: 'prod-2',
        productName: 'Surgical Gauze',
        batchNumber: 'B-002',
        mfgDate: '2025-01-01',
        expiryDate: in25Days.toISOString().split('T')[0],
        purchaseDate: '2025-01-01',
        cost: 10,
        qty: 40,
        status: 'Expiring Soon',
        warehouseId: testWarehouseId
      }
    ];

    const todayDateKey = '2026-10-26';

    // First EOD run
    const reminders1 = await stockAlertService.checkEndOfDayExpiryReminder({
      batches: testBatches,
      companyId: testCompanyId,
      company: { closingTime: '18:00', timezone: 'Asia/Kolkata' } as any,
      warehouses: [testWarehouse],
      forceDate: todayDateKey,
      forceCheck: true, // simulate closing time reached
      existingNotifications: simulatedNotifications,
      createNotification: createNotifMock
    });

    assert(reminders1.length === 1, 'Exactly one End-of-Day reminder dispatched to the Warehouse Manager');
    assert(reminders1[0].title === 'End-of-Day Expiry Reminder', 'Title is "End-of-Day Expiry Reminder"');
    assert(
      reminders1[0].message === '2 batches across your assigned warehouses are approaching expiry. Review the batch list before closing for the day.',
      `Message formatted correctly: "${reminders1[0].message}"`
    );
    assert(reminders1[0].priority === 'High', 'Priority is "High"');
    assert(reminders1[0].actionText === 'View Expiring Batches', 'Action is "View Expiring Batches"');
    assert(reminders1[0].link === '/inventory/batches', 'Link is /inventory/batches');

    // Second EOD run (e.g. scheduler retry on same date)
    const remindersRetry = await stockAlertService.checkEndOfDayExpiryReminder({
      batches: testBatches,
      companyId: testCompanyId,
      company: { closingTime: '18:00', timezone: 'Asia/Kolkata' } as any,
      warehouses: [testWarehouse],
      forceDate: todayDateKey,
      forceCheck: true,
      existingNotifications: simulatedNotifications,
      createNotification: createNotifMock
    });

    assert(remindersRetry.length === 0, 'No duplicate reminder generated when scheduler retries on same date');
  }

  // -------------------------------------------------------------------------
  // Scenario 9: Expired batches are clearly distinguished from batches approaching expiry
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO 9: Expired batches distinguished from approaching expiry ---');
  {
    // Batch expired 5 days ago
    const expiredPastDate = new Date();
    expiredPastDate.setDate(expiredPastDate.getDate() - 5);
    const expiredDateStr = expiredPastDate.toISOString().split('T')[0];

    const expiredBatch: Batch = {
      id: 'batch-expired-old',
      productId: 'prod-old-01',
      productName: 'Old Expired Syrup',
      batchNumber: 'BAT-EXPIRED-99',
      mfgDate: '2024-01-01',
      expiryDate: expiredDateStr,
      purchaseDate: '2024-01-10',
      cost: 30,
      qty: 15,
      status: 'Expired',
      warehouseId: testWarehouseId
    };

    const alertsForExpired = await stockAlertService.checkBatchExpiryAlerts({
      batches: [expiredBatch],
      companyId: testCompanyId,
      warehouses: [testWarehouse],
      existingNotifications: simulatedNotifications,
      createNotification: createNotifMock
    });

    assert(
      alertsForExpired.length === 0,
      'Already expired batch is NOT alerted as "Product Expiring Soon" (approaching expiry)'
    );
  }

  // -------------------------------------------------------------------------
  // Scenario 10: Notifications open correct records & recipient authorization prevents leakage
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO 10: Routing & Recipient Authorization checks ---');
  {
    // Warehouse Manager visibility
    for (const notif of simulatedNotifications) {
      if (notif.userId === warehouseManagerId) {
        const canManagerSee = notificationService.isAuthorizedRecipient(
          notif,
          warehouseManagerId,
          'Warehouse Manager'
        );
        assert(canManagerSee, `Warehouse Manager can access notification: "${notif.title}"`);
      }

      // Salesperson must NOT see warehouse stock alerts or batch expiry reminders
      const canSalespersonSee = notificationService.isAuthorizedRecipient(
        notif,
        'salesperson-001',
        'Salesperson'
      );
      assert(!canSalespersonSee, `Salesperson correctly BLOCKED from viewing: "${notif.title}"`);

      // Cashier must NOT see warehouse stock alerts or batch expiry reminders
      const canCashierSee = notificationService.isAuthorizedRecipient(
        notif,
        'cashier-001',
        'Cashier'
      );
      assert(!canCashierSee, `Cashier correctly BLOCKED from viewing: "${notif.title}"`);
    }

    // Verify sort order: unread newest first, read below
    const sorted = sortNotifications(simulatedNotifications);
    assert(sorted.length === simulatedNotifications.length, 'sortNotifications preserved list count');
    let sawRead = false;
    for (const item of sorted) {
      if (item.read) sawRead = true;
      if (!item.read && sawRead) {
        throw new Error('Sort order violated: unread appeared after read notification!');
      }
    }
    console.log('  ✓ Verified sorting: unread notifications first, read notifications below');
  }

  console.log('\n======================================================================');
  console.log('🎉 ALL 10 TESTING SCENARIOS PASSED WITH ZERO FAILURES!');
  console.log('======================================================================\n');
}

runTestSuite().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
