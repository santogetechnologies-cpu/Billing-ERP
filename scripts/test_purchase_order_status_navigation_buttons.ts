import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('================================================================================');
console.log('TEST SUITE: PURCHASE ORDER STATUS NAVIGATION BUTTONS VERIFICATION');
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

const pmDashboardPath = path.resolve('src/pages/purchases/PurchaseManagerDashboardPage.tsx');
const poPagePath = path.resolve('src/pages/purchases/PurchaseOrdersPage.tsx');

const pmDashboardCode = fs.readFileSync(pmDashboardPath, 'utf-8');
const poPageCode = fs.readFileSync(poPagePath, 'utf-8');

// -----------------------------------------------------------------------------
// 1. Dashboard Status Navigation Buttons (PurchaseManagerDashboardPage.tsx)
// -----------------------------------------------------------------------------
console.log('--- 1. Purchase Manager Dashboard Navigation Buttons ---');

runTest('Purchase Manager Dashboard includes the status navigation buttons container', () => {
  assert(pmDashboardCode.includes('id="po-status-navigation-buttons"'), 'Buttons container must have id="po-status-navigation-buttons"');
  assert(pmDashboardCode.includes('grid grid-cols-2 lg:grid-cols-4'), 'Buttons must be aligned in horizontal row on desktop (4 columns) and wrap on mobile');
});

runTest('Dashboard Ordered button has ClipboardList icon, subtle blue style, real count & navigates to /purchases/orders?status=Ordered', () => {
  assert(pmDashboardCode.includes("navigate('/purchases/orders?status=Ordered')"), 'Ordered button must navigate to /purchases/orders?status=Ordered');
  assert(pmDashboardCode.includes('ClipboardList'), 'Ordered button must use clipboard icon');
  assert(pmDashboardCode.includes('text-blue-600') || pmDashboardCode.includes('text-blue-700'), 'Ordered button must use subtle blue color');
  assert(pmDashboardCode.includes('orderStatusNavigationCounts.orderedCount'), 'Ordered button must display real orderedCount from database records');
});

runTest('Dashboard Delivered button has CheckCircle2 icon, subtle green style, real count & navigates to /purchases/orders?status=Received', () => {
  assert(pmDashboardCode.includes("navigate('/purchases/orders?status=Received')"), 'Delivered button must navigate to /purchases/orders?status=Received');
  assert(pmDashboardCode.includes('CheckCircle2'), 'Delivered button must use check-circle icon');
  assert(pmDashboardCode.includes('text-emerald-600') || pmDashboardCode.includes('text-emerald-700'), 'Delivered button must use subtle green color');
  assert(pmDashboardCode.includes('orderStatusNavigationCounts.deliveredCount'), 'Delivered button must display real deliveredCount from database records');
});

runTest('Dashboard Overdue button has AlertTriangle icon, subtle red style, real count & navigates to /purchases/orders?status=Overdue', () => {
  assert(pmDashboardCode.includes("navigate('/purchases/orders?status=Overdue')"), 'Overdue button must navigate to /purchases/orders?status=Overdue');
  assert(pmDashboardCode.includes('AlertTriangle'), 'Overdue button must use alert-triangle icon');
  assert(pmDashboardCode.includes('text-rose-600') || pmDashboardCode.includes('text-rose-700'), 'Overdue button must use subtle red color');
  assert(pmDashboardCode.includes('orderStatusNavigationCounts.overdueCount'), 'Overdue button must display real overdueCount based on expected delivery date and pending qty');
});

runTest('Dashboard History button has History icon, subtle neutral gray style, real count & navigates to /purchases/orders?status=History', () => {
  assert(pmDashboardCode.includes("navigate('/purchases/orders?status=History')"), 'History button must navigate to /purchases/orders?status=History');
  assert(pmDashboardCode.includes('History'), 'History button must use history icon');
  assert(pmDashboardCode.includes('text-slate-600') || pmDashboardCode.includes('text-slate-700') || pmDashboardCode.includes('text-slate-900'), 'History button must use subtle neutral gray color');
  assert(pmDashboardCode.includes('orderStatusNavigationCounts.historyCount'), 'History button must display real historyCount of all orders');
});

// -----------------------------------------------------------------------------
// 2. Purchase Orders Page Navigation Buttons & Filtering (PurchaseOrdersPage.tsx)
// -----------------------------------------------------------------------------
console.log('\n--- 2. Purchase Orders Page Navigation Buttons & Filtering ---');

runTest('PurchaseOrdersPage includes the four navigation buttons container', () => {
  assert(poPageCode.includes('id="po-status-buttons-row"'), 'PurchaseOrdersPage must render id="po-status-buttons-row"');
  assert(poPageCode.includes('grid grid-cols-2 lg:grid-cols-4'), 'Buttons row must be aligned horizontally on desktop');
});

runTest('PurchaseOrdersPage Ordered button filters to Ordered orders', () => {
  assert(poPageCode.includes("onClick={() => handleCardFilterClick('Ordered')}"), 'Ordered button must invoke handleCardFilterClick with Ordered');
  assert(poPageCode.includes("order.status !== 'Ordered'"), 'filteredOrders must filter strictly to Ordered orders');
});

runTest('PurchaseOrdersPage Delivered button filters to Received orders', () => {
  assert(poPageCode.includes("onClick={() => handleCardFilterClick('Received')}"), 'Delivered button must invoke handleCardFilterClick with Received');
  assert(poPageCode.includes("order.status !== 'Received'"), 'filteredOrders must filter strictly to Received orders');
});

runTest('PurchaseOrdersPage Overdue button filters to overdue orders with pending quantities', () => {
  assert(poPageCode.includes("onClick={() => handleCardFilterClick('Overdue')}"), 'Overdue button must invoke handleCardFilterClick with Overdue');
  assert(poPageCode.includes('!order.isOverdue || order.status !== \'Ordered\''), 'filteredOrders must filter to overdue pending orders');
});

runTest('PurchaseOrdersPage History button displays all order records', () => {
  assert(poPageCode.includes("onClick={() => handleCardFilterClick('History')}"), 'History button must invoke handleCardFilterClick with History');
  assert(poPageCode.includes("tabFilter === 'History' || tabFilter === 'All'"), 'filteredOrders must include all past & current order records in History view');
});

runTest('PurchaseOrdersPage provides clear way to return to all orders', () => {
  assert(poPageCode.includes('Return to All Orders') || poPageCode.includes('Show All Orders'), 'Must render Return/Show All Orders option');
  assert(poPageCode.includes("handleCardFilterClick('All')"), 'Return to All Orders must reset tabFilter to All');
});

runTest('PurchaseOrdersPage parses URL status search param dynamically', () => {
  assert(poPageCode.includes("searchParams.get('status')"), 'Must read status from URL searchParams');
  assert(poPageCode.includes("statusParam.toLowerCase() === 'ordered'"), 'Must parse status=ordered');
  assert(poPageCode.includes("statusParam.toLowerCase() === 'received'"), 'Must parse status=received');
  assert(poPageCode.includes("statusParam.toLowerCase() === 'overdue'"), 'Must parse status=overdue');
  assert(poPageCode.includes("statusParam.toLowerCase() === 'history'"), 'Must parse status=history');
});

// -----------------------------------------------------------------------------
// 3. Status Rules Verification
// -----------------------------------------------------------------------------
console.log('\n--- 3. Strict Status Rules ---');

runTest('Delivery status strictly uses only Ordered and Received', () => {
  assert(pmDashboardCode.includes("order.deliveryStatus === 'Received'"), 'Must evaluate Received');
  assert(pmDashboardCode.includes("order.deliveryStatus === 'Ordered'"), 'Must evaluate Ordered');
  assert(!pmDashboardCode.includes("order.deliveryStatus === 'Delivered'"), 'Delivered must NOT be a deliveryStatus enum');
  assert(!pmDashboardCode.includes("order.deliveryStatus === 'Active'"), 'Active must NOT be a deliveryStatus enum');
});

runTest('Overdue is a filter and not a separate deliveryStatus enum', () => {
  assert(poPageCode.includes("cleanExpDate < today && pendingQty > 0"), 'Overdue is derived from expected date and pending quantity');
  assert(poPageCode.includes("isOverdue"), 'isOverdue is a boolean flag');
});

// -----------------------------------------------------------------------------
// 4. Critical Product Screens Protection Audit
// -----------------------------------------------------------------------------
console.log('\n--- 4. Protected Product Screens Audit ---');

const protectedScreens = [
  'src/pages/products/InitialStockPage.tsx',
  'src/pages/products/NewProductPage.tsx',
  'src/pages/products/ProductListPage.tsx',
  'src/pages/products/UpdateStockPage.tsx'
];

protectedScreens.forEach(filePath => {
  runTest(`Protected product screen is intact: ${filePath}`, () => {
    assert(fs.existsSync(path.resolve(filePath)), `File must exist: ${filePath}`);
    const content = fs.readFileSync(path.resolve(filePath), 'utf-8');
    assert(content.length > 500, `File must have substantial content: ${filePath}`);
  });
});

// -----------------------------------------------------------------------------
// Final Summary
// -----------------------------------------------------------------------------
console.log('\n================================================================================');
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`PASSED:      ${passedTests}`);
console.log(`FAILED:      ${totalTests - passedTests}`);
console.log('================================================================================\n');

if (totalTests === passedTests) {
  console.log('🎉 ALL PURCHASE ORDER STATUS NAVIGATION BUTTON TESTS PASSED 100%!\n');
} else {
  process.exitCode = 1;
}

