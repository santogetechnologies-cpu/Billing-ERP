import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { computePurchaseOrderDeliveryStatus } from '../src/pages/purchases/PurchaseManagerDashboardPage';

console.log('================================================================================');
console.log('TEST SUITE: PURCHASE ORDER DELIVERY STATUS (ORDERED vs RECEIVED)');
console.log('================================================================================\n');

let totalTests = 0;
let passedTests = 0;

function runTest(desc: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ PASS: ${desc}`);
    passedTests++;
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

// -----------------------------------------------------------------------------
// 1. Logic Verification: computePurchaseOrderDeliveryStatus
// -----------------------------------------------------------------------------
console.log('--- 1. Delivery Status Calculation Logic ---');

runTest('New purchase order (0 items received) evaluates to "Ordered"', () => {
  const newOrder = {
    id: 'po-1',
    order_number: 'PO-2026-001',
    items: [
      { productId: 'p1', qty: 10, receivedQty: 0 }
    ]
  };
  const status = computePurchaseOrderDeliveryStatus(newOrder);
  assert.strictEqual(status, 'Ordered');
});

runTest('Single-product partially received order evaluates to "Ordered"', () => {
  const partialOrder = {
    id: 'po-2',
    order_number: 'PO-2026-002',
    items: [
      { productId: 'p1', qty: 10, receivedQty: 6 }
    ]
  };
  const status = computePurchaseOrderDeliveryStatus(partialOrder);
  assert.strictEqual(status, 'Ordered');
});

runTest('Multi-product order where one product is partial evaluates to "Ordered"', () => {
  const multiPartialOrder = {
    id: 'po-3',
    order_number: 'PO-2026-003',
    items: [
      { productId: 'p1', qty: 10, receivedQty: 10 },
      { productId: 'p2', qty: 5, receivedQty: 2 }
    ]
  };
  const status = computePurchaseOrderDeliveryStatus(multiPartialOrder);
  assert.strictEqual(status, 'Ordered');
});

runTest('Multi-product order where one product is complete and other has 0 received evaluates to "Ordered"', () => {
  const multiPartialOrder = {
    id: 'po-4',
    order_number: 'PO-2026-004',
    items: [
      { productId: 'p1', qty: 10, receivedQty: 10 },
      { productId: 'p2', qty: 5, receivedQty: 0 }
    ]
  };
  const status = computePurchaseOrderDeliveryStatus(multiPartialOrder);
  assert.strictEqual(status, 'Ordered');
});

runTest('Single-product fully received order evaluates to "Received"', () => {
  const fullyReceived = {
    id: 'po-5',
    order_number: 'PO-2026-005',
    items: [
      { productId: 'p1', qty: 10, receivedQty: 10 }
    ]
  };
  const status = computePurchaseOrderDeliveryStatus(fullyReceived);
  assert.strictEqual(status, 'Received');
});

runTest('Multi-product fully received order evaluates to "Received"', () => {
  const multiFullyReceived = {
    id: 'po-6',
    order_number: 'PO-2026-006',
    items: [
      { productId: 'p1', qty: 10, receivedQty: 10 },
      { productId: 'p2', qty: 5, receivedQty: 5 },
      { productId: 'p3', qty: 25, receivedQty: 25 }
    ]
  };
  const status = computePurchaseOrderDeliveryStatus(multiFullyReceived);
  assert.strictEqual(status, 'Received');
});

runTest('Order with zero quantities defaults to "Ordered"', () => {
  const zeroOrder = {
    id: 'po-7',
    order_number: 'PO-2026-007',
    items: []
  };
  const status = computePurchaseOrderDeliveryStatus(zeroOrder);
  assert.strictEqual(status, 'Ordered');
});

// -----------------------------------------------------------------------------
// 2. PurchaseManagerDashboardPage.tsx UI & Badge Standards
// -----------------------------------------------------------------------------
console.log('\n--- 2. PurchaseManagerDashboardPage UI Standards ---');

const pmDashboardPath = path.resolve('src/pages/purchases/PurchaseManagerDashboardPage.tsx');
const pmDashboardCode = fs.readFileSync(pmDashboardPath, 'utf8');

runTest('Recent Purchase Orders table renders Delivery Status column with blue "Ordered" badge', () => {
  assert.ok(
    pmDashboardCode.includes('order.deliveryStatus === \'Received\'') &&
    pmDashboardCode.includes('bg-blue-100 text-blue-800 border border-blue-200'),
    'Table must use blue badge for "Ordered"'
  );
});

runTest('Recent Purchase Orders table renders green "Received" badge when order is confirmed received', () => {
  assert.ok(
    pmDashboardCode.includes('bg-emerald-100 text-emerald-800 border border-emerald-200'),
    'Table must use green badge for "Received"'
  );
});

runTest('Old delivery status labels "Active" and "Delivered" are replaced in Recent Purchase Orders', () => {
  assert.ok(
    !pmDashboardCode.includes('order.deliveryStatus === \'Delivered\''),
    'Delivered label should not be used for PO delivery status'
  );
  assert.ok(
    !pmDashboardCode.includes('order.deliveryStatus === \'Active\''),
    'Active label should not be used for PO delivery status'
  );
});

runTest('PO Details popup modal displays Delivery Status with "Ordered" and "Received" badges', () => {
  assert.ok(
    pmDashboardCode.includes('selectedOrderForModal.deliveryStatus === \'Received\''),
    'Modal must check deliveryStatus === Received'
  );
  assert.ok(
    pmDashboardCode.includes('bg-emerald-100 text-emerald-800 border border-emerald-200') &&
    pmDashboardCode.includes('bg-blue-100 text-blue-800 border border-blue-200'),
    'Modal must support green Received and blue Ordered badges'
  );
});

// -----------------------------------------------------------------------------
// 3. PurchaseOrdersPage.tsx Consistency
// -----------------------------------------------------------------------------
console.log('\n--- 3. PurchaseOrdersPage UI & Consistency ---');

const poPagePath = path.resolve('src/pages/purchases/PurchaseOrdersPage.tsx');
const poPageCode = fs.readFileSync(poPagePath, 'utf8');

runTest('PurchaseOrdersPage includes "Delivery Status" table header', () => {
  assert.ok(
    poPageCode.includes('Delivery Status'),
    'PurchaseOrdersPage must display Delivery Status column'
  );
});

runTest('PurchaseOrdersPage displays green "Received" and blue "Ordered" badges', () => {
  assert.ok(
    poPageCode.includes("order.status === 'Received'") &&
    poPageCode.includes('bg-emerald-100 text-emerald-800') &&
    poPageCode.includes('bg-blue-100 text-blue-800'),
    'Table rows must use Received (green) and Ordered (blue)'
  );
});

runTest('PurchaseOrdersPage detail modal displays Delivery Status badge', () => {
  assert.ok(
    poPageCode.includes('Delivery Status:') &&
    poPageCode.includes("selectedOrder.status === 'Received'"),
    'Order detail modal must display Delivery Status'
  );
});

// -----------------------------------------------------------------------------
// 4. Goods Receipt & Data Safety
// -----------------------------------------------------------------------------
console.log('\n--- 4. Goods Receipt Workflow & Data Safety ---');

const prServicePath = path.resolve('src/services/purchaseRequestService.ts');
const prServiceCode = fs.readFileSync(prServicePath, 'utf8');

runTest('purchaseRequestService syncs PO status to "Received" when fully completed', () => {
  assert.ok(
    prServiceCode.includes("nextStatus === 'Completed' ? 'Received' : 'Ordered'"),
    'Service must update PO status to Received on completion and Ordered if partial'
  );
});

const protectedFiles = [
  'src/pages/products/InitialStockPage.tsx',
  'src/pages/products/NewProductPage.tsx',
  'src/pages/products/ProductListPage.tsx',
  'src/pages/products/UpdateStockPage.tsx'
];

for (const file of protectedFiles) {
  runTest(`Protected product screen exists intact: ${file}`, () => {
    assert.ok(fs.existsSync(path.resolve(file)), `File must exist: ${file}`);
  });
}

console.log('\n================================================================================');
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`PASSED:      ${passedTests}`);
console.log(`FAILED:      ${totalTests - passedTests}`);
console.log('================================================================================\n');

if (passedTests === totalTests) {
  console.log('🎉 ALL PURCHASE ORDER DELIVERY STATUS TESTS PASSED 100%!');
} else {
  process.exit(1);
}

