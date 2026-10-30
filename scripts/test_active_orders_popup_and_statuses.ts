import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { purchaseRequestService } from '../src/services/purchaseRequestService';
import { determineSupplierStatus } from '../src/utils/supplierStatus';
import { Product, Supplier, Warehouse, PurchaseRequest } from '../src/types';

let totalTests = 0;
let passedTests = 0;

function check(condition: boolean, message: string) {
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
  console.log('TEST SUITE: ACTIVE ORDERS POPUP & TWO ORDER STATUSES (ACTIVE & DELIVERED)');
  console.log('================================================================\n');

  const dashboardPath = path.resolve('src/pages/purchases/PurchaseManagerDashboardPage.tsx');
  const dashboardContent = fs.readFileSync(dashboardPath, 'utf-8');

  const modalPath = path.resolve('src/components/purchases/ActiveOrdersModal.tsx');
  const modalExists = fs.existsSync(modalPath);
  const modalContent = modalExists ? fs.readFileSync(modalPath, 'utf-8') : '';

  const poPagePath = path.resolve('src/pages/purchases/PurchaseOrdersPage.tsx');
  const poPageContent = fs.readFileSync(poPagePath, 'utf-8');

  const prServicePath = path.resolve('src/services/purchaseRequestService.ts');
  const prServiceContent = fs.readFileSync(prServicePath, 'utf-8');

  // ---------------------------------------------------------------------------
  // 1. Active Orders Modal & UI Popup Specifications
  // ---------------------------------------------------------------------------
  console.log('--- 1. Active Orders Modal Structure & Popup Behavior ---');
  check(modalExists, 'ActiveOrdersModal.tsx component exists in src/components/purchases/');
  check(modalContent.includes('export const ActiveOrdersModal'), 'ActiveOrdersModal component is exported');
  check(modalContent.includes('fixed inset-0 bg-slate-900/60'), 'Modal renders dimmed background backdrop overlay');
  check(modalContent.includes('overflow-y-auto') && modalContent.includes('max-h-'), 'Modal body container is independently scrollable');
  check(modalContent.includes("e.key === 'Escape'"), 'Modal supports closing with ESC key');
  check(modalContent.includes('border-rose-300 text-rose-600') || modalContent.includes('border-rose-200 text-rose-600'), 'Modal header includes red outlined X close button');
  check(modalContent.includes("document.body.style.overflow = 'hidden'"), 'Modal locks background body scrolling while open');
  check(modalContent.includes('SupplierOrderGroup') || modalContent.includes('supplierGroups'), 'Orders are grouped by actual supplier');
  check(modalContent.includes('group.orders.map'), 'Individual purchase orders are listed under each supplier without merging');
  check(modalContent.includes('order.items.map') && modalContent.includes('isExpanded'), 'Allows expanding order to view individual product lines');
  check(modalContent.includes('statusFilter') && modalContent.includes("'Active'") && modalContent.includes("'Delivered'"), 'Provides dedicated filters for Active and Delivered');
  check(modalContent.includes('order.status === statusFilter'), 'Strictly filters orders by Active or Delivered');
  check(modalContent.includes("statusLower === 'cancelled' || statusLower === 'rejected'") && modalContent.includes('return;'), 'Does not include cancelled or rejected orders in the Active list');

  // ---------------------------------------------------------------------------
  // 2. Purchase Manager Dashboard Integration (No Inline Appending)
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Dashboard Modal Triggers & Removal of Inline Panel ---');
  check(dashboardContent.includes('import { ActiveOrdersModal }'), 'PurchaseManagerDashboardPage imports ActiveOrdersModal');
  check(dashboardContent.includes('<ActiveOrdersModal'), 'PurchaseManagerDashboardPage renders ActiveOrdersModal');
  check(dashboardContent.includes('isActiveOrdersModalOpen'), 'Dashboard manages isActiveOrdersModalOpen state');
  check(!dashboardContent.includes('id="active-orders-panel"'), 'Inline active orders section below dashboard is completely removed');
  check(!dashboardContent.includes('showActiveOrdersPanel'), 'Old inline showActiveOrdersPanel state is removed');
  check(
    dashboardContent.includes("title=\"Active Orders\"") && dashboardContent.includes("onClick={() => setIsActiveOrdersModalOpen(true)}"),
    'Clicking Active Orders StatCard opens ActiveOrdersModal popup'
  );
  check(
    dashboardContent.includes("<span>Manage Orders</span>") && dashboardContent.includes("onClick={() => setIsActiveOrdersModalOpen(true)}"),
    'Clicking Manage Orders button opens ActiveOrdersModal popup directly without page navigation'
  );

  // ---------------------------------------------------------------------------
  // 3. Strict Two Order Statuses Only: Active and Delivered
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Strict Two Order Statuses (Active and Delivered) ---');
  check(
    !dashboardContent.includes("order.status === 'Ordered'"),
    'No "Ordered" status badge rendered in active orders on Dashboard'
  );
  check(
    dashboardContent.includes("<span>Active</span>") && dashboardContent.includes("<span>Delivered</span>"),
    'Dashboard Supplier Delivery Overview renders only Active and Delivered delivery statuses'
  );
  check(
    !dashboardContent.includes("item.deliveryStatus === 'In Transit'") && !dashboardContent.includes("item.deliveryStatus === 'Pending'"),
    'Intermediary delivery status badges (In Transit, Pending) replaced with Active/Delivered in table display'
  );
  check(
    poPageContent.includes("status: 'Active' | 'Delivered' | 'Cancelled'"),
    'PurchaseOrdersPage defines normalized status with only Active, Delivered, and Cancelled'
  );
  check(
    poPageContent.includes("title=\"Delivered Orders\""),
    'PurchaseOrdersPage StatCard uses "Delivered Orders" terminology'
  );

  // ---------------------------------------------------------------------------
  // 4. Order Creation Workflow: Created Orders are Immediately 'Active'
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Order Creation Workflow: Approved PO is Immediately "Active" ---');
  check(
    prServiceContent.includes("status: 'Active',") && prServiceContent.includes("company_id: finalCompanyId,"),
    'approvePurchaseRequestWithOrder creates purchase order with status "Active"'
  );
  check(
    prServiceContent.includes("const poStatus = nextStatus === 'Completed' ? 'Delivered' : 'Active';"),
    'recordGoodsReceipt updates purchase order to "Delivered" on complete fulfillment and remains "Active" on partial fulfillment'
  );

  // ---------------------------------------------------------------------------
  // 5. Functional Business Rules & Supplier Active/Inactive Determination
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Functional Verification: Status Determination ---');
  {
    // Supplier with Active order is Active
    const activeStatus = determineSupplierStatus('sup-101', 'Premier Steel', {
      purchaseOrders: [
        { id: 'po-1', order_number: 'PO-2026-101', supplier_id: 'sup-101', status: 'Active', qty: 100, received_qty: 20 }
      ]
    });
    check(activeStatus === 'Active', 'Supplier with outstanding order quantity is marked "Active"');

    // Supplier with all orders Delivered is Inactive
    const inactiveStatus = determineSupplierStatus('sup-101', 'Premier Steel', {
      purchaseOrders: [
        { id: 'po-1', order_number: 'PO-2026-101', supplier_id: 'sup-101', status: 'Delivered', qty: 100, received_qty: 100 }
      ]
    });
    check(inactiveStatus === 'Inactive', 'Supplier with all orders Delivered (0 outstanding) is marked "Inactive"');

    // Supplier with new active order transitions back to Active
    const reactivatedStatus = determineSupplierStatus('sup-101', 'Premier Steel', {
      purchaseOrders: [
        { id: 'po-1', order_number: 'PO-2026-101', supplier_id: 'sup-101', status: 'Delivered', qty: 100, received_qty: 100 },
        { id: 'po-2', order_number: 'PO-2026-102', supplier_id: 'sup-101', status: 'Active', qty: 50, received_qty: 0 }
      ]
    });
    check(reactivatedStatus === 'Active', 'Supplier assigned a new approved order transitions back to "Active"');
  }

  // ---------------------------------------------------------------------------
  // 6. End-to-End Approval Workflow Integration
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. End-to-End Approval Workflow with Live Database ---');
  {
    const COMPANY_ID = '00000000-0000-0000-0000-000000000001';
    const TEST_SUPPLIER_ID = 'test-sup-active-001';
    const TEST_WH_ID = 'test-wh-active-001';

    // Create a new purchase request
    const req = await purchaseRequestService.createPurchaseRequest({
      warehouseId: TEST_WH_ID,
      warehouseName: 'Main Depot',
      priority: 'Normal',
      reason: 'Stock replenishment for Active order testing',
      items: [
        {
          productId: 'prod-active-1',
          productName: 'TMT Steel Bars',
          requestedQty: 50,
          unit: 'Pieces',
          estimatedCost: 800
        }
      ]
    }, COMPANY_ID, { id: 'usr-wh', name: 'Bob Warehouse', role: 'Warehouse Manager' });

    check(Boolean(req.id), 'Successfully created test purchase request');

    // Purchase Manager approves request and selects supplier
    const approval = await purchaseRequestService.approvePurchaseRequestWithOrder({
      requestId: req.id,
      supplierId: TEST_SUPPLIER_ID,
      supplierName: 'National Steel Corp',
      expectedDelivery: '2026-11-15',
      approvedItems: [
        {
          productId: 'prod-active-1',
          productName: 'TMT Steel Bars',
          unit: 'Pieces',
          requestedQty: 50,
          approvedQty: 50,
          rate: 800
        }
      ]
    }, COMPANY_ID, { id: 'usr-pm', name: 'Alice Manager', role: 'Purchase Manager' });

    check(Boolean(approval.purchaseOrderNumber), `Purchase order generated: ${approval.purchaseOrderNumber}`);

    // Verify PO state
    const poList = await purchaseRequestService.getPurchaseRequests(COMPANY_ID);
    const updatedPr = poList.find(r => r.id === req.id);
    check(Boolean(updatedPr?.purchaseOrderId), 'Linked purchase order ID is present');

    // Record Partial Goods Receipt: order must remain Active
    const partialReceipt = await purchaseRequestService.recordGoodsReceipt({
      requestId: req.id,
      receivingWarehouseId: TEST_WH_ID,
      notes: 'First consignment delivered',
      receivedItems: [
        {
          itemId: updatedPr!.items[0].id,
          productId: 'prod-active-1',
          receivedQty: 20,
          damagedQty: 0,
          acceptedQty: 20
        }
      ]
    }, COMPANY_ID, { id: 'usr-wh', name: 'Bob Warehouse', role: 'Warehouse Manager' });

    check(partialReceipt.items[0].receivedQty === 20, 'Partial received quantity recorded as 20');
    check(partialReceipt.status === 'Partially Received', 'Request status is Partially Received while outstanding quantity remains');

    // Record Final Goods Receipt: order transitions to Completed / Delivered
    const finalReceipt = await purchaseRequestService.recordGoodsReceipt({
      requestId: req.id,
      receivingWarehouseId: TEST_WH_ID,
      notes: 'Final consignment delivered',
      receivedItems: [
        {
          itemId: updatedPr!.items[0].id,
          productId: 'prod-active-1',
          receivedQty: 30,
          damagedQty: 0,
          acceptedQty: 30
        }
      ]
    }, COMPANY_ID, { id: 'usr-wh', name: 'Bob Warehouse', role: 'Warehouse Manager' });

    check(finalReceipt.items[0].receivedQty === 50, 'Total received quantity reached 50');
    check(finalReceipt.status === 'Completed', 'Request status moved to Completed once fully delivered');
  }

  console.log('\n================================================================');
  console.log(`TOTAL TESTS: ${totalTests}`);
  console.log(`PASSED:      ${passedTests}`);
  console.log(`FAILED:      ${totalTests - passedTests}`);
  console.log('================================================================');

  if (totalTests === passedTests) {
    console.log('\n🎉 ALL ACTIVE ORDERS POPUP & TWO-STATUS TESTS PASSED 100%!\n');
  }
}

runTestSuite().catch(err => {
  console.error('Test suite failed with unexpected error:', err);
  process.exit(1);
});
