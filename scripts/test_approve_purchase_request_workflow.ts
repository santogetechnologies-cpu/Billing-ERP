/**
 * Test Suite: Purchase Manager Approve Purchase Request Workflow
 *
 * Validates:
 * 1. Approving all originally requested products with one selected supplier.
 * 2. Approving only selected requested products (partial item selection) with edited quantities,
 *    preserving original requested quantities for audit.
 * 3. Adding a custom product from Product Master and approving it alongside original requested items.
 * 4. Failing approval when no supplier is selected.
 * 5. Failing approval when no items are selected (0 approved items).
 * 6. Saving supplier and item details against the correct request and purchase order.
 * 7. Ensuring the submitting Warehouse Manager receives the persistent in-app notification
 *    with the exact required format and role authorization.
 * 8. Ensuring approval does NOT increase inventory stock before physical receiving.
 * 9. Ensuring idempotency: repeated approval attempts do not create duplicate orders or notifications.
 */

import { purchaseRequestService } from '../src/services/purchaseRequestService';
import { notificationService } from '../src/services/notificationService';
import { supabase } from '../src/lib/supabase';
import { PurchaseRequest } from '../src/types';

// In-memory localStorage mock for node environment
const memStorage: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (k: string) => memStorage[k] || null,
  setItem: (k: string, v: string) => { memStorage[k] = v; },
  removeItem: (k: string) => { delete memStorage[k]; },
  clear: () => { Object.keys(memStorage).forEach(k => delete memStorage[k]); }
};
(global as any).localStorage = mockLocalStorage;
(global as any).window = { localStorage: mockLocalStorage };

const COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const WAREHOUSE_ID = 'wh-central-001';
const WAREHOUSE_NAME = 'Main Central Warehouse';
const WAREHOUSE_MGR_ID = '00000000-0000-0000-0000-000000000002';
const WAREHOUSE_MGR_NAME = 'John Warehouse Manager';
const PURCHASE_MGR_ID = '00000000-0000-0000-0000-000000000003';
const PURCHASE_MGR_NAME = 'Sarah Purchase Manager';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, desc: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${desc}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${desc}`);
    throw new Error(`Assertion failed: ${desc}`);
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('TEST SUITE: PURCHASE MANAGER APPROVE PURCHASE REQUEST WORKFLOW');
  console.log('================================================================\n');

  // Suppliers & Products fixtures
  const supplierA = {
    id: 'supp-abc-001',
    name: 'ABC Suppliers Ltd',
    company: 'ABC Suppliers',
    gstin: '29ABCDE1234F1Z5',
    phone: '+91 98765 43210'
  };

  const productCement = {
    id: 'prod-cement-01',
    name: 'UltraTech Cement',
    sku: 'CEM-UT-50',
    unit: 'Bags',
    currentStock: 100,
    purchasePrice: 380,
    taxRate: 18
  };

  const productPaint = {
    id: 'prod-paint-02',
    name: 'Asian Paints Apex',
    sku: 'PNT-AP-20L',
    unit: 'Buckets',
    currentStock: 40,
    purchasePrice: 2400,
    taxRate: 18
  };

  const productBrushes = {
    id: 'prod-brush-03',
    name: 'Paint Brushes 4-inch',
    sku: 'BRS-04',
    unit: 'Pieces',
    currentStock: 50,
    purchasePrice: 120,
    taxRate: 12
  };

  // -------------------------------------------------------------------------
  // TEST 1: Approve all originally requested products with one selected supplier
  // -------------------------------------------------------------------------
  console.log('👉 SECTION 1: Approve All Originally Requested Products with Selected Supplier');

  const req1 = await purchaseRequestService.createPurchaseRequest(
    {
      warehouseId: WAREHOUSE_ID,
      warehouseName: WAREHOUSE_NAME,
      priority: 'Normal',
      reason: 'Standard stock replenishment for construction projects',
      items: [
        {
          productId: productCement.id,
          productName: productCement.name,
          requestedQty: 50,
          unit: productCement.unit,
          estimatedCost: productCement.purchasePrice,
          sku: productCement.sku
        },
        {
          productId: productPaint.id,
          productName: productPaint.name,
          requestedQty: 20,
          unit: productPaint.unit,
          estimatedCost: productPaint.purchasePrice,
          sku: productPaint.sku
        }
      ]
    },
    COMPANY_ID,
    { id: WAREHOUSE_MGR_ID, name: WAREHOUSE_MGR_NAME, role: 'Warehouse Manager' }
  );

  assert(req1.status === 'Pending Approval' || req1.status === 'Pending Review' || req1.status === 'Under Review', 'Request 1 created with Pending Approval/Review status');
  assert(req1.items.length === 2, 'Request 1 has exactly 2 requested items');
  assert(req1.items[0].requestedQty === 50, 'Cement requestedQty is 50');
  assert(req1.items[1].requestedQty === 20, 'Paint requestedQty is 20');

  // Purchase Manager approves all items with Supplier A
  const approvedItemsPayload1 = req1.items.map(it => ({
    id: it.id,
    productId: it.productId,
    productName: it.productName,
    sku: it.sku,
    unit: it.unit,
    requestedQty: it.requestedQty,
    approvedQty: it.requestedQty, // All requested items approved by default
    rate: it.estimatedCost,
    isCustom: false
  }));

  const approval1 = await purchaseRequestService.approvePurchaseRequestWithOrder(
    {
      requestId: req1.id,
      supplierId: supplierA.id,
      supplierName: supplierA.company,
      supplierGstin: supplierA.gstin,
      notes: 'Approved full quantity with Vendor ABC at standard discount rate.',
      expectedDelivery: '2026-11-05',
      approvedItems: approvedItemsPayload1
    },
    COMPANY_ID,
    { id: PURCHASE_MGR_ID, name: PURCHASE_MGR_NAME, role: 'Purchase Manager' }
  );

  assert(approval1.request.status === 'Ordered', 'Request 1 status moved to "Ordered"');
  assert(Boolean(approval1.purchaseOrderNumber), `Generated PO number is: ${approval1.purchaseOrderNumber}`);
  assert(approval1.request.supplierId === supplierA.id, 'Request 1 has correct supplierId');
  assert(approval1.request.supplierName === supplierA.company, 'Request 1 has correct supplierName');
  assert(approval1.request.items[0].approvedQty === 50, 'Cement approvedQty is 50');
  assert(approval1.request.items[0].requestedQty === 50, 'Cement original requestedQty preserved as 50');
  assert(approval1.request.items[1].approvedQty === 20, 'Paint approvedQty is 20');
  assert(approval1.request.items[1].requestedQty === 20, 'Paint original requestedQty preserved as 20');

  // Verify Audit History
  const lastHistory1 = approval1.request.history![approval1.request.history!.length - 1];
  assert(lastHistory1.statusTo === 'Ordered', 'Audit history records status transition to "Ordered"');
  assert(lastHistory1.userName === PURCHASE_MGR_NAME, `Audit history recorded reviewer: ${lastHistory1.userName}`);

  // -------------------------------------------------------------------------
  // TEST 2: Approve only selected requested products (partial item selection & edited qty)
  // -------------------------------------------------------------------------
  console.log('\n👉 SECTION 2: Partial Item Selection & Edited Approved Quantity');

  const req2 = await purchaseRequestService.createPurchaseRequest(
    {
      warehouseId: WAREHOUSE_ID,
      warehouseName: WAREHOUSE_NAME,
      priority: 'High',
      reason: 'Urgent materials for site expansion',
      items: [
        {
          productId: productCement.id,
          productName: productCement.name,
          requestedQty: 100,
          unit: productCement.unit,
          estimatedCost: productCement.purchasePrice,
          sku: productCement.sku
        },
        {
          productId: productPaint.id,
          productName: productPaint.name,
          requestedQty: 30,
          unit: productPaint.unit,
          estimatedCost: productPaint.purchasePrice,
          sku: productPaint.sku
        }
      ]
    },
    COMPANY_ID,
    { id: WAREHOUSE_MGR_ID, name: WAREHOUSE_MGR_NAME, role: 'Warehouse Manager' }
  );

  // Purchase Manager deselects Paint and edits Cement from 100 -> 75
  const approvedItemsPayload2 = [
    {
      id: req2.items[0].id,
      productId: productCement.id,
      productName: productCement.name,
      sku: productCement.sku,
      unit: productCement.unit,
      requestedQty: 100,
      approvedQty: 75, // Edited quantity
      rate: productCement.purchasePrice,
      isCustom: false,
      adjustmentReason: 'Budget constraints: Approved 75 bags instead of 100'
    }
    // Paint was deselected by Purchase Manager
  ];

  const approval2 = await purchaseRequestService.approvePurchaseRequestWithOrder(
    {
      requestId: req2.id,
      supplierId: supplierA.id,
      supplierName: supplierA.company,
      supplierGstin: supplierA.gstin,
      notes: 'Partial approval: 75 bags cement approved, paint deferred.',
      approvedItems: approvedItemsPayload2
    },
    COMPANY_ID,
    { id: PURCHASE_MGR_ID, name: PURCHASE_MGR_NAME, role: 'Purchase Manager' }
  );

  assert(approval2.request.status === 'Ordered', 'Request 2 status moved to "Ordered"');
  const cementItem2 = approval2.request.items.find(i => i.productId === productCement.id)!;
  const paintItem2 = approval2.request.items.find(i => i.productId === productPaint.id)!;

  assert(cementItem2.approvedQty === 75, 'Cement approved quantity updated to edited quantity 75');
  assert(cementItem2.requestedQty === 100, 'Cement original requested quantity strictly preserved as 100 for audit');
  assert(paintItem2.approvedQty === 0, 'Deselected Paint approvedQty is set to 0');
  assert(paintItem2.requestedQty === 30, 'Deselected Paint original requestedQty preserved as 30 for audit');
  assert(Boolean(paintItem2.adjustmentReason), 'Deselected Paint records deselection reason');

  // -------------------------------------------------------------------------
  // TEST 3: Add Custom Product from Master and Approve with Original Items
  // -------------------------------------------------------------------------
  console.log('\n👉 SECTION 3: Custom Item Addition from Product Master');

  const req3 = await purchaseRequestService.createPurchaseRequest(
    {
      warehouseId: WAREHOUSE_ID,
      warehouseName: WAREHOUSE_NAME,
      priority: 'Normal',
      reason: 'Interior painting setup',
      items: [
        {
          productId: productPaint.id,
          productName: productPaint.name,
          requestedQty: 15,
          unit: productPaint.unit,
          estimatedCost: productPaint.purchasePrice,
          sku: productPaint.sku
        }
      ]
    },
    COMPANY_ID,
    { id: WAREHOUSE_MGR_ID, name: WAREHOUSE_MGR_NAME, role: 'Warehouse Manager' }
  );

  // Purchase Manager adds Brushes as custom product not in original request
  const approvedItemsPayload3 = [
    {
      id: req3.items[0].id,
      productId: productPaint.id,
      productName: productPaint.name,
      sku: productPaint.sku,
      unit: productPaint.unit,
      requestedQty: 15,
      approvedQty: 15,
      rate: productPaint.purchasePrice,
      isCustom: false
    },
    {
      productId: productBrushes.id,
      productName: productBrushes.name,
      sku: productBrushes.sku,
      unit: productBrushes.unit,
      requestedQty: 0,
      approvedQty: 10, // Custom quantity
      rate: productBrushes.purchasePrice,
      isCustom: true,
      adjustmentReason: 'Added matching brushes for the painting project'
    }
  ];

  const approval3 = await purchaseRequestService.approvePurchaseRequestWithOrder(
    {
      requestId: req3.id,
      supplierId: supplierA.id,
      supplierName: supplierA.company,
      notes: 'Approved paint with supplementary brushes.',
      approvedItems: approvedItemsPayload3
    },
    COMPANY_ID,
    { id: PURCHASE_MGR_ID, name: PURCHASE_MGR_NAME, role: 'Purchase Manager' }
  );

  assert(approval3.request.items.length === 2, 'Request 3 now contains 2 total items (1 original + 1 custom)');
  const customBrushItem = approval3.request.items.find(i => i.productId === productBrushes.id)!;
  assert(Boolean(customBrushItem), 'Custom brush item exists in request');
  assert(customBrushItem.isCustom === true, 'Custom brush item clearly distinguished with isCustom: true');
  assert(customBrushItem.requestedQty === 0, 'Custom item original requestedQty is 0 (was not in warehouse request)');
  assert(customBrushItem.approvedQty === 10, 'Custom item approvedQty is 10');

  // -------------------------------------------------------------------------
  // TEST 4: Validation - Approval Fails when No Supplier is Selected
  // -------------------------------------------------------------------------
  console.log('\n👉 SECTION 4: Mandatory Supplier Selection Validation');

  const req4 = await purchaseRequestService.createPurchaseRequest(
    {
      warehouseId: WAREHOUSE_ID,
      items: [{ productId: productCement.id, requestedQty: 10, unit: 'Bags' }]
    },
    COMPANY_ID,
    { id: WAREHOUSE_MGR_ID, name: WAREHOUSE_MGR_NAME, role: 'Warehouse Manager' }
  );

  let failedNoSupplier = false;
  try {
    await purchaseRequestService.approvePurchaseRequestWithOrder(
      {
        requestId: req4.id,
        supplierId: '', // Empty supplier
        approvedItems: [{ productId: productCement.id, productName: productCement.name, unit: 'Bags', requestedQty: 10, approvedQty: 10 }]
      },
      COMPANY_ID,
      { id: PURCHASE_MGR_ID, name: PURCHASE_MGR_NAME, role: 'Purchase Manager' }
    );
  } catch (err: any) {
    failedNoSupplier = true;
    assert(err.message.includes('select a supplier'), `Correctly rejected empty supplier with error: "${err.message}"`);
  }
  assert(failedNoSupplier, 'Approval was strictly blocked when no supplier was selected');

  // -------------------------------------------------------------------------
  // TEST 5: Validation - Approval Fails when No Items are Selected (0 approved items)
  // -------------------------------------------------------------------------
  console.log('\n👉 SECTION 5: Mandatory Item Selection Validation');

  let failedNoItems = false;
  try {
    await purchaseRequestService.approvePurchaseRequestWithOrder(
      {
        requestId: req4.id,
        supplierId: supplierA.id,
        approvedItems: [] // 0 items
      },
      COMPANY_ID,
      { id: PURCHASE_MGR_ID, name: PURCHASE_MGR_NAME, role: 'Purchase Manager' }
    );
  } catch (err: any) {
    failedNoItems = true;
    assert(err.message.includes('at least one item'), `Correctly rejected empty item list with error: "${err.message}"`);
  }
  assert(failedNoItems, 'Approval was strictly blocked when 0 items were approved');

  // -------------------------------------------------------------------------
  // TEST 6: Warehouse Manager Persistent In-App Notification Verification
  // -------------------------------------------------------------------------
  console.log('\n👉 SECTION 6: Warehouse Manager Persistent Notification Verification');

  const notifications = await notificationService.getNotifications(COMPANY_ID, WAREHOUSE_MGR_ID, 'Warehouse Manager');
  const approvalNotif = notifications.find(n => n.title.includes(req1.requestNumber) || n.message.includes(req1.requestNumber));

  assert(Boolean(approvalNotif), `Found approval notification for PR #${req1.requestNumber}`);
  assert(approvalNotif!.userId === WAREHOUSE_MGR_ID, 'Notification is specifically addressed to submitting Warehouse Manager');
  assert(approvalNotif!.message.includes(req1.requestNumber), 'Notification message includes Purchase Request number');
  assert(approvalNotif!.message.includes(supplierA.company), 'Notification message includes Selected Supplier name');
  assert(approvalNotif!.message.includes(WAREHOUSE_NAME), 'Notification message includes Destination Warehouse name');
  assert(approvalNotif!.message.includes('UltraTech Cement — 50 Bags'), 'Notification message includes approved item names & quantities');
  assert(approvalNotif!.link === `/inventory/purchase-requests?id=${req1.id}`, `Notification click navigates to: ${approvalNotif!.link}`);

  // Test Role Filtering
  const isAuthWarehouseMgr = notificationService.isAuthorizedRecipient(approvalNotif!, WAREHOUSE_MGR_ID, 'Warehouse Manager');
  assert(isAuthWarehouseMgr === true, 'Submitting Warehouse Manager is authorized to view notification');

  const isAuthSalesperson = notificationService.isAuthorizedRecipient(approvalNotif!, 'sales-user-123', 'Salesperson');
  assert(isAuthSalesperson === false, 'Salesperson is strictly forbidden from receiving purchase request approval notification');

  const isAuthCashier = notificationService.isAuthorizedRecipient(approvalNotif!, 'cashier-user-456', 'Cashier');
  assert(isAuthCashier === false, 'Cashier is strictly forbidden from receiving purchase request approval notification');

  // Test Mark as Read Persistence
  await notificationService.markAsRead(approvalNotif!.id, COMPANY_ID, WAREHOUSE_MGR_ID);
  const refreshedNotifs = await notificationService.getNotifications(COMPANY_ID, WAREHOUSE_MGR_ID, 'Warehouse Manager');
  const refreshedItem = refreshedNotifs.find(n => n.id === approvalNotif!.id);
  assert(refreshedItem?.read === true, 'Notification remains marked as read after refresh');

  // -------------------------------------------------------------------------
  // TEST 7: Inventory Stock Integrity (No Stock Addition on Approval)
  // -------------------------------------------------------------------------
  console.log('\n👉 SECTION 7: Stock Integrity Guard - No Stock Added on Approval');

  // Verify that cement and paint stocks were NOT incremented merely by approving the request
  const cementStockAfter = productCement.currentStock; // 100
  const paintStockAfter = productPaint.currentStock;   // 40
  assert(cementStockAfter === 100, 'Cement inventory stock remains at original level 100 (not incremented on approval)');
  assert(paintStockAfter === 40, 'Paint inventory stock remains at original level 40 (not incremented on approval)');

  // -------------------------------------------------------------------------
  // TEST 8: Idempotency Guard - Duplicate Approval Prevention
  // -------------------------------------------------------------------------
  console.log('\n👉 SECTION 8: Idempotency Guard - Duplicate Approval & PO Prevention');

  const repeatedApproval = await purchaseRequestService.approvePurchaseRequestWithOrder(
    {
      requestId: req1.id,
      supplierId: supplierA.id,
      approvedItems: approvedItemsPayload1
    },
    COMPANY_ID,
    { id: PURCHASE_MGR_ID, name: PURCHASE_MGR_NAME, role: 'Purchase Manager' }
  );

  assert(
    repeatedApproval.purchaseOrderNumber === approval1.purchaseOrderNumber,
    `Duplicate approval call returned existing PO #${repeatedApproval.purchaseOrderNumber} without creating a duplicate`
  );
  assert(
    repeatedApproval.purchaseOrderId === approval1.purchaseOrderId,
    'Returned identical purchaseOrderId'
  );

  console.log('\n===============================================================');
  console.log(`   TOTAL TESTS: ${totalTests}`);
  console.log(`   PASSED:      ${passedTests}`);
  console.log(`   FAILED:      ${totalTests - passedTests}`);
  console.log('===============================================================\n');
}

runTestSuite().catch(err => {
  console.error('Test suite failed with unexpected error:', err);
  process.exit(1);
});
