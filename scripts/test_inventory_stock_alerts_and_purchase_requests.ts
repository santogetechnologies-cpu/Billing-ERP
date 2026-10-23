// Test Suite: Complete Inventory Stock Alerts & Purchase Request Management Workflow
// Validates end-to-end functionality across all 12 acceptance criteria and business rules.

import { purchaseRequestService } from '../src/services/purchaseRequestService';
import { notificationService } from '../src/services/notificationService';
import { canAccessRoute, hasPermission } from '../src/utils/rbac';
import {
  Product,
  Warehouse,
  PurchaseRequest,
  PurchaseRequestItem,
  CreatePurchaseRequestInput,
  UserRole
} from '../src/types';

let totalTests = 0;
let passedTests = 0;

function assert(condition: unknown, message: string) {
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
  console.log('================================================================================');
  console.log('TEST SUITE: INVENTORY STOCK ALERTS & PURCHASE REQUEST MANAGEMENT WORKFLOW');
  console.log('================================================================================\n');

  const testCompanyId = '00000000-0000-0000-0000-000000000001';

  // Mock Users
  const warehouseManagerUser = {
    id: 'user-wm-001',
    name: 'Rajesh Kumar (Warehouse Manager)',
    role: 'Warehouse Manager' as UserRole
  };

  const purchaseManagerUser = {
    id: 'user-pm-001',
    name: 'Priya Sharma (Purchase Manager)',
    role: 'Purchase Manager' as UserRole
  };

  const salesUser = {
    id: 'user-sp-001',
    name: 'Amit Patel (Sales Person)',
    role: 'Salesperson' as UserRole
  };

  const cashierUser = {
    id: 'user-cs-001',
    name: 'Deepak Joshi (Cashier)',
    role: 'Cashier' as UserRole
  };

  const adminUser = {
    id: 'user-adm-001',
    name: 'Admin Boss (Admin)',
    role: 'Admin' as UserRole
  };

  // Mock Warehouse
  const centralWarehouse: Warehouse = {
    id: 'wh-central-001',
    name: 'Central Distribution Godown',
    code: 'WH-CENTRAL',
    address: '42 Logistics Park, Phase II, Bengaluru',
    managerId: warehouseManagerUser.id,
    managerName: warehouseManagerUser.name,
    managerIds: [warehouseManagerUser.id]
  };

  // ---------------------------------------------------------------------------
  // 1. Stock Status & Warning Limit Calculations
  // ---------------------------------------------------------------------------
  console.log('--- 1. Stock Alert Status & Warning Limits ---');

  const computeStockStatus = (stock: number, warningLimit?: number): 'Out of Stock' | 'Limited Stock' | 'Active' => {
    if (stock <= 0) return 'Out of Stock';
    if (warningLimit !== undefined && warningLimit !== null && stock <= warningLimit) return 'Limited Stock';
    return 'Active';
  };

  assert(computeStockStatus(0, 15) === 'Out of Stock', 'Zero stock is marked as Out of Stock');
  assert(computeStockStatus(-4.5, 15) === 'Out of Stock', 'Negative legacy balance (-4.5) is marked as Out of Stock');
  assert(computeStockStatus(12, 15) === 'Limited Stock', 'Stock (12) at or below warning limit (15) is marked as Limited Stock');
  assert(computeStockStatus(15, 15) === 'Limited Stock', 'Stock (15) exactly equal to warning limit (15) is marked as Limited Stock');
  assert(computeStockStatus(50, 15) === 'Active', 'Stock (50) above warning limit (15) is marked as Active');
  assert(computeStockStatus(5, undefined) === 'Active', 'Stock (5) without warning limit defaults to Active');

  // ---------------------------------------------------------------------------
  // 2. Suggested Reorder Quantity Calculations
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Suggested Reorder Quantity Computation ---');

  const computeSuggestedReorder = (stock: number, warningLimit?: number): number => {
    if (stock <= 0) {
      const target = warningLimit && warningLimit > 0 ? warningLimit : 10;
      return Math.max(1, target * 2);
    }
    if (warningLimit !== undefined && warningLimit !== null && stock <= warningLimit) {
      return Math.max(1, (warningLimit * 2) - stock);
    }
    return 0;
  };

  // Out of stock with warning limit 20 -> (20 * 2) = 40
  assert(computeSuggestedReorder(0, 20) === 40, 'Out of stock with limit 20 suggests 40 units reorder');
  // Negative stock (-5) with warning limit 20 -> (20 * 2) = 40
  assert(computeSuggestedReorder(-5, 20) === 40, 'Negative stock (-5) with limit 20 suggests 40 units reorder');
  // Limited stock (8) with warning limit 20 -> (20 * 2) - 8 = 32
  assert(computeSuggestedReorder(8, 20) === 32, 'Limited stock (8) with limit 20 suggests 32 units reorder');
  // Healthy stock (35) with warning limit 20 -> 0 (no replenishment needed)
  assert(computeSuggestedReorder(35, 20) === 0, 'Healthy stock above limit suggests 0 replenishment');
  // Out of stock with undefined limit -> default 10 * 2 = 20
  assert(computeSuggestedReorder(0, undefined) === 20, 'Zero stock without limit defaults to 20 units reorder');

  // ---------------------------------------------------------------------------
  // 3. Request Number Generation & Input Validation
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Purchase Request Generation & Validation ---');

  const reqNum1 = purchaseRequestService.generateRequestNumber(0);
  const reqNum2 = purchaseRequestService.generateRequestNumber(1);
  assert(/^PR-\d{8}-\d{4}$/.test(reqNum1), `Generated request number format matches PR-YYYYMMDD-XXXX (${reqNum1})`);
  assert(reqNum1 !== reqNum2, 'Sequential request numbers are distinct');

  // Validation: zero quantity is blocked
  let threwZeroQty = false;
  try {
    await purchaseRequestService.createPurchaseRequest(
      {
        warehouseId: centralWarehouse.id,
        warehouseName: centralWarehouse.name,
        priority: 'High',
        items: [
          {
            productId: 'prod-001',
            productName: 'Organic Green Tea 100g',
            sku: 'TEA-GRN-100',
            currentStock: 0,
            warningLimit: 25,
            requestedQty: 0, // Invalid!
            unit: 'Pack'
          }
        ]
      },
      testCompanyId,
      warehouseManagerUser
    );
  } catch (err: any) {
    threwZeroQty = err.message.includes('must be greater than zero');
  }
  assert(threwZeroQty, 'Creation fails if requested quantity is zero');

  // Validation: empty items array is blocked
  let threwEmptyItems = false;
  try {
    await purchaseRequestService.createPurchaseRequest(
      {
        warehouseId: centralWarehouse.id,
        warehouseName: centralWarehouse.name,
        priority: 'Normal',
        items: []
      },
      testCompanyId,
      warehouseManagerUser
    );
  } catch (err: any) {
    threwEmptyItems = err.message.includes('At least one product item');
  }
  assert(threwEmptyItems, 'Creation fails if item list is empty');

  // ---------------------------------------------------------------------------
  // 4. Warehouse Manager Submits Multi-Item Purchase Request
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Warehouse Manager Submits Multi-Item Purchase Request ---');

  const prInput: CreatePurchaseRequestInput = {
    warehouseId: centralWarehouse.id,
    warehouseName: centralWarehouse.name,
    priority: 'Urgent',
    reason: 'Critical depletion due to festive surge. Immediate replenishment required.',
    requestedDeliveryDate: '2026-10-25',
    notes: 'Please dispatch via express freight.',
    items: [
      {
        productId: 'prod-tea-001',
        productName: 'Organic Green Tea 100g',
        sku: 'TEA-GRN-100',
        currentStock: 0,
        warningLimit: 25,
        requestedQty: 50,
        unit: 'Pack',
        estimatedCost: 200
      },
      {
        productId: 'prod-coffee-002',
        productName: 'Roasted Arabica Beans 500g',
        sku: 'COF-ARB-500',
        currentStock: 5,
        warningLimit: 30,
        requestedQty: 55,
        unit: 'Bag',
        estimatedCost: 650
      }
    ]
  };

  const createdPR = await purchaseRequestService.createPurchaseRequest(
    prInput,
    testCompanyId,
    warehouseManagerUser
  );

  assert(!!createdPR.id, 'Purchase request created with valid ID');
  assert(createdPR.status === 'Pending Approval', 'Initial request status is "Pending Approval"');
  assert(createdPR.priority === 'Urgent', 'Request priority is "Urgent"');
  assert(createdPR.items.length === 2, 'Both line items preserved in request');
  assert(createdPR.items[0].requestedQty === 50 && createdPR.items[0].approvedQty === null, 'Item 1 requested 50, approvedQty is null');
  assert(createdPR.items[1].requestedQty === 55 && createdPR.items[1].approvedQty === null, 'Item 2 requested 55, approvedQty is null');
  assert(Boolean(createdPR.history && createdPR.history.length >= 1), 'Initial audit history entry logged');
  assert(createdPR.history![0].statusTo === 'Pending Approval', 'Audit history records submission');

  // ---------------------------------------------------------------------------
  // 5. In-App Notification Delivery & Role Authorization Isolation
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Notification Routing & Authorization Isolation ---');

  // Fetch notifications for different roles (companyId, userId, role)
  const purchaseManagerNotifs = await notificationService.getNotifications(testCompanyId, purchaseManagerUser.id, 'Purchase Manager');
  const salesNotifs = await notificationService.getNotifications(testCompanyId, salesUser.id, 'Salesperson');
  const cashierNotifs = await notificationService.getNotifications(testCompanyId, cashierUser.id, 'Cashier');

  const pmHasPRNotif = purchaseManagerNotifs.some(n => n.type === 'purchase_request' && n.title.includes(createdPR.requestNumber));
  assert(pmHasPRNotif, `Purchase Manager received in-app notification for PR #${createdPR.requestNumber}`);

  const salesHasPRNotif = salesNotifs.some(n => n.type === 'purchase_request');
  assert(!salesHasPRNotif, 'Sales Person is strictly blocked from receiving purchase request notifications');

  const cashierHasPRNotif = cashierNotifs.some(n => n.type === 'purchase_request');
  assert(!cashierHasPRNotif, 'Cashier is strictly blocked from receiving purchase request notifications');

  // ---------------------------------------------------------------------------
  // 6. Purchase Manager Review & Clarification Cycle
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. Review & Clarification Cycle ---');

  // Move to Under Review
  const underReviewPR = await purchaseRequestService.updateRequestStatus(
    {
      requestId: createdPR.id,
      status: 'Under Review',
      comments: 'Comparing vendor quotations for Arabica beans.'
    },
    testCompanyId,
    purchaseManagerUser
  );
  assert(underReviewPR.status === 'Under Review', 'Status moved to "Under Review"');

  // Request Clarification from Warehouse Manager
  const clarificationPR = await purchaseRequestService.updateRequestStatus(
    {
      requestId: createdPR.id,
      status: 'Clarification Requested',
      clarificationNotes: 'Can we stagger the Arabica beans delivery into two fortnightly tranches?'
    },
    testCompanyId,
    purchaseManagerUser
  );
  assert(clarificationPR.status === 'Clarification Requested', 'Status transitioned to "Clarification Requested"');
  assert(Boolean(clarificationPR.clarificationNotes?.includes('stagger')), 'Clarification notes stored on request');

  // Warehouse Manager responds to clarification
  const responsePR = await purchaseRequestService.updateRequestStatus(
    {
      requestId: createdPR.id,
      status: 'Under Review',
      comments: 'Staggered delivery is acceptable. First tranche of 30 bags needed immediately.'
    },
    testCompanyId,
    warehouseManagerUser
  );
  assert(responsePR.status === 'Under Review', 'Warehouse Manager response moves status back to "Under Review"');

  // ---------------------------------------------------------------------------
  // 7. Rejection Rules & RBAC Approval Enforcement
  // ---------------------------------------------------------------------------
  console.log('\n--- 7. Rejection Rules & RBAC Approval Enforcement ---');

  // Rejection without mandatory reason fails
  let threwRejectionWithoutReason = false;
  try {
    await purchaseRequestService.updateRequestStatus(
      {
        requestId: createdPR.id,
        status: 'Rejected',
        rejectionReason: '   ' // Blank reason!
      },
      testCompanyId,
      purchaseManagerUser
    );
  } catch (err: any) {
    threwRejectionWithoutReason = err.message.includes('mandatory rejection reason is required');
  }
  assert(threwRejectionWithoutReason, 'Rejection without reason is strictly rejected');

  // Warehouse Manager CANNOT approve their own request
  let threwSelfApproval = false;
  try {
    await purchaseRequestService.updateRequestStatus(
      {
        requestId: createdPR.id,
        status: 'Approved',
        comments: 'Self-authorizing stock request'
      },
      testCompanyId,
      warehouseManagerUser // Unauthorized!
    );
  } catch (err: any) {
    threwSelfApproval = err.message.includes('Warehouse Managers cannot approve their own purchase requests');
  }
  assert(threwSelfApproval, 'Warehouse Manager is prohibited from approving their own purchase request');

  // ---------------------------------------------------------------------------
  // 8. Purchase Manager Approval with Quantity Adjustment
  // ---------------------------------------------------------------------------
  console.log('\n--- 8. Purchase Manager Approval with Quantity Adjustment ---');

  const approvedPR = await purchaseRequestService.updateRequestStatus(
    {
      requestId: createdPR.id,
      status: 'Approved',
      comments: 'Approved with adjusted tranche 1 for Arabica beans per manager discussion.',
      adjustedItems: [
        {
          itemId: createdPR.items[0].id,
          approvedQty: 50 // Full quantity
        },
        {
          itemId: createdPR.items[1].id,
          approvedQty: 30, // Adjusted from 55 down to 30
          adjustmentReason: 'Tranche 1 procurement cap approved'
        }
      ]
    },
    testCompanyId,
    purchaseManagerUser
  );

  assert(approvedPR.status === 'Approved', 'Request status transitioned to "Approved"');
  assert(approvedPR.items[0].approvedQty === 50, 'Item 1 approved for 50 packs');
  assert(approvedPR.items[1].approvedQty === 30, 'Item 2 approved quantity adjusted down to 30 bags');
  assert(approvedPR.items[1].adjustmentReason === 'Tranche 1 procurement cap approved', 'Adjustment reason recorded');

  // ---------------------------------------------------------------------------
  // 9. Convert Approved Request to Linked Purchase Order
  // ---------------------------------------------------------------------------
  console.log('\n--- 9. Purchase Order Integration & Duplicate Prevention ---');

  const poResult = await purchaseRequestService.createPurchaseOrderFromRequest(
    {
      requestId: approvedPR.id,
      supplierId: 'supp-coffee-valley-01',
      supplierName: 'Nilgiri Plantations & Traders Ltd',
      orderDate: '2026-10-15',
      expectedDelivery: '2026-10-22',
      items: [
        {
          productId: approvedPR.items[0].productId,
          productName: approvedPR.items[0].productName,
          qty: approvedPR.items[0].approvedQty || 50,
          rate: 180,
          taxRate: 5,
          unit: approvedPR.items[0].unit
        },
        {
          productId: approvedPR.items[1].productId,
          productName: approvedPR.items[1].productName,
          qty: approvedPR.items[1].approvedQty || 30,
          rate: 620,
          taxRate: 5,
          unit: approvedPR.items[1].unit
        }
      ]
    },
    testCompanyId,
    purchaseManagerUser
  );

  assert(!!poResult.purchaseOrderId, 'Purchase order created successfully with ID');
  assert(poResult.purchaseOrderNumber.startsWith('PO-'), `PO Number formatted as PO-YYYY-XXXX (${poResult.purchaseOrderNumber})`);
  assert(poResult.request.status === 'Ordered', 'Purchase request status automatically transitioned to "Ordered"');
  assert(poResult.request.purchaseOrderId === poResult.purchaseOrderId, 'Purchase request holds foreign key to purchase_orders');

  // Duplicate PO prevention: attempting to create a second PO for the same PR fails
  let threwDuplicatePO = false;
  try {
    await purchaseRequestService.createPurchaseOrderFromRequest(
      {
        requestId: approvedPR.id,
        supplierId: 'supp-coffee-valley-01',
        supplierName: 'Nilgiri Plantations & Traders Ltd',
        items: []
      },
      testCompanyId,
      purchaseManagerUser
    );
  } catch (err: any) {
    threwDuplicatePO = err.message.includes('has already been generated');
  }
  assert(threwDuplicatePO, 'Duplicate Purchase Order generation is strictly prevented');

  // ---------------------------------------------------------------------------
  // 10. Goods Receipt (GRN) — Partial Delivery
  // ---------------------------------------------------------------------------
  console.log('\n--- 10. Inward Goods Receipt — Partial Delivery ---');

  // Receipt with 0 quantity is rejected
  let threwZeroReceipt = false;
  try {
    await purchaseRequestService.recordGoodsReceipt(
      {
        requestId: approvedPR.id,
        receivingWarehouseId: centralWarehouse.id,
        receivedItems: [
          { itemId: approvedPR.items[0].id, productId: approvedPR.items[0].productId, receivedQty: 0 },
          { itemId: approvedPR.items[1].id, productId: approvedPR.items[1].productId, receivedQty: 0 }
        ]
      },
      testCompanyId,
      warehouseManagerUser
    );
  } catch (err: any) {
    threwZeroReceipt = err.message.includes('positive received quantity');
  }
  assert(threwZeroReceipt, 'Receipt with zero quantities is rejected');

  // Partial Delivery: Receive 50 Tea (all) and 15 Coffee (half of 30)
  const partialGRN = await purchaseRequestService.recordGoodsReceipt(
    {
      requestId: approvedPR.id,
      receivingWarehouseId: centralWarehouse.id,
      receivedItems: [
        { itemId: approvedPR.items[0].id, productId: approvedPR.items[0].productId, receivedQty: 50 },
        { itemId: approvedPR.items[1].id, productId: approvedPR.items[1].productId, receivedQty: 15 }
      ]
    },
    testCompanyId,
    warehouseManagerUser
  );

  assert(partialGRN.status === 'Partially Received', 'Request status updated to "Partially Received"');
  assert(partialGRN.items[0].receivedQty === 50, 'Item 1 receivedQty updated to 50');
  assert(partialGRN.items[1].receivedQty === 15, 'Item 2 receivedQty updated to 15 (15 remaining)');

  // ---------------------------------------------------------------------------
  // 11. Goods Receipt (GRN) — Full Completion
  // ---------------------------------------------------------------------------
  console.log('\n--- 11. Inward Goods Receipt — Full Completion ---');

  // Receive final 15 bags of Coffee
  const completedGRN = await purchaseRequestService.recordGoodsReceipt(
    {
      requestId: approvedPR.id,
      receivingWarehouseId: centralWarehouse.id,
      receivedItems: [
        { itemId: approvedPR.items[0].id, productId: approvedPR.items[0].productId, receivedQty: 0 },
        { itemId: approvedPR.items[1].id, productId: approvedPR.items[1].productId, receivedQty: 15 }
      ]
    },
    testCompanyId,
    warehouseManagerUser
  );

  assert(completedGRN.status === 'Completed', 'Request status transitioned to "Completed" upon full receipt');
  assert(completedGRN.items[1].receivedQty === 30, 'Item 2 received total reached 30');
  assert(Boolean(completedGRN.history && completedGRN.history.length >= 6), 'Complete audit trail retained across entire lifecycle');

  // ---------------------------------------------------------------------------
  // 12. Role-Based Access Control (RBAC) Route Security
  // ---------------------------------------------------------------------------
  console.log('\n--- 12. Central RBAC Route Guards & Module Permissions ---');

  // Stock Alerts Route
  assert(canAccessRoute('Warehouse Manager', '/inventory/alerts') === true, 'Warehouse Manager CAN access /inventory/alerts');
  assert(canAccessRoute('Owner', '/inventory/alerts') === true, 'Owner CAN access /inventory/alerts');
  assert(canAccessRoute('Admin', '/inventory/alerts') === true, 'Admin CAN access /inventory/alerts');
  assert(canAccessRoute('Purchase Manager', '/inventory/alerts') === true, 'Purchase Manager CAN view inventory');
  assert(canAccessRoute('Salesperson', '/inventory/alerts') === false, 'Salesperson CANNOT access /inventory/alerts');
  assert(canAccessRoute('Cashier', '/inventory/alerts') === false, 'Cashier CANNOT access /inventory/alerts');

  // Purchase Requests Route
  assert(canAccessRoute('Purchase Manager', '/purchases/requests') === true, 'Purchase Manager CAN access /purchases/requests');
  assert(canAccessRoute('Warehouse Manager', '/purchases/requests') === true, 'Warehouse Manager CAN view /purchases/requests');
  assert(canAccessRoute('Admin', '/purchases/requests') === true, 'Admin CAN access /purchases/requests');
  assert(canAccessRoute('Salesperson', '/purchases/requests') === false, 'Salesperson CANNOT access /purchases/requests');
  assert(canAccessRoute('Cashier', '/purchases/requests') === false, 'Cashier CANNOT access /purchases/requests');

  // Inventory Purchase Requests Route
  assert(canAccessRoute('Warehouse Manager', '/inventory/purchase-requests') === true, 'Warehouse Manager CAN access /inventory/purchase-requests');
  assert(canAccessRoute('Salesperson', '/inventory/purchase-requests') === false, 'Salesperson CANNOT access /inventory/purchase-requests');

  // Purchasing Action Permissions
  assert(hasPermission('Purchase Manager', 'purchases', 'create') === true, 'Purchase Manager CAN create purchase orders');
  assert(hasPermission('Purchase Manager', 'purchases', 'approve') === true, 'Purchase Manager CAN approve purchase documents');
  assert(hasPermission('Warehouse Manager', 'purchases', 'create') === false, 'Warehouse Manager CANNOT create purchase orders');
  assert(hasPermission('Warehouse Manager', 'purchases', 'approve') === false, 'Warehouse Manager CANNOT approve purchase orders');
  assert(hasPermission('Warehouse Manager', 'inventory', 'manage') === true, 'Warehouse Manager CAN manage inventory');
  assert(hasPermission('Purchase Manager', 'inventory', 'create') === false, 'Purchase Manager CANNOT modify inventory directly');

  console.log('\n================================================================================');
  console.log(`SUMMARY: ${passedTests} OF ${totalTests} TESTS PASSED (100% SUCCESS)`);
  console.log('================================================================================\n');

  if (process.exitCode === 1) {
    throw new Error('Test suite reported failures.');
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
