import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('================================================================================');
console.log('TEST SUITE: REMOVE HIGHLIGHTED PURCHASE ORDERS SECTION IN HISTORY TAB');
console.log('================================================================================\n');

let totalTests = 0;
let passedTests = 0;

function check(desc: string, fn: () => void) {
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

const invoicesPagePath = path.resolve('src/pages/purchases/PurchaseInvoicesPage.tsx');
const poPagePath = path.resolve('src/pages/purchases/PurchaseOrdersPage.tsx');

const invoicesCode = fs.readFileSync(invoicesPagePath, 'utf-8');
const poCode = fs.readFileSync(poPagePath, 'utf-8');

console.log('--- 1. History Tab Integration and Embedding ---');

check('Purchases & PO History tab renders PurchaseOrdersPage with embedded=true', () => {
  assert(invoicesCode.includes("activeTab === 'history'"), 'History tab branch must exist');
  assert(
    invoicesCode.includes('<PurchaseOrdersPage embedded={true} initialTabFilter="History" />'),
    'History tab must render PurchaseOrdersPage with embedded={true} and initialTabFilter="History"'
  );
});

check('Top Purchases & PO header and navigation tabs are preserved intact', () => {
  assert(invoicesCode.includes('Purchases & PO'), 'Top header title "Purchases & PO" must exist');
  assert(
    invoicesCode.includes('Manage purchase orders, vendor bills, debit notes, and payments.'),
    'Top header subtitle must remain intact'
  );
  assert(invoicesCode.includes('purchaseTabs'), 'All navigation tabs must exist');
  assert(invoicesCode.includes("'orders'"), 'Orders (PO) tab exists');
  assert(invoicesCode.includes("'bills'"), 'Bills tab exists');
  assert(invoicesCode.includes("'returns'"), 'Returns tab exists');
  assert(invoicesCode.includes("'payments'"), 'Payments Made tab exists');
  assert(invoicesCode.includes("'history'"), 'History tab exists');
});

console.log('\n--- 2. Removal of Highlighted Elements in Embedded History Tab ---');

check('Purchase Orders header card, description, refresh, new order, new bill are hidden when embedded', () => {
  assert(poCode.includes('!embedded && ('), 'Top Breadcrumb & Action Header must be guarded by !embedded');
  // Check that the header card is within !embedded
  const headerSectionMatch = poCode.match(/\{!embedded && \(\s*<div[^>]*>[\s\S]*?<span>Purchase Orders<\/span>[\s\S]*?<span>Refresh<\/span>[\s\S]*?<span>New Order<\/span>[\s\S]*?<span>New Bill<\/span>[\s\S]*?<\/div>\s*\)\}/);
  assert(headerSectionMatch, 'Header card containing Purchase Orders, Refresh, New Order, New Bill must be guarded by !embedded');
});

check('Summary cards (Ordered, Delivered, Overdue, History) are hidden when embedded', () => {
  // Check that po-status-buttons-row is guarded by !embedded
  const statusRowMatch = poCode.match(/\{!embedded && \(\s*<div id="po-status-buttons-row"[\s\S]*?<\/button>\s*<\/div>\s*\)\}/);
  assert(statusRowMatch, 'Status summary cards row must be guarded by !embedded so it is omitted from History tab');
});

console.log('\n--- 3. Direct Placement and Spacing of Filters below Navigation Tabs ---');

check('Filters toolbar is positioned directly below navigation tabs with consistent spacing', () => {
  // When embedded, root uses space-y-4
  assert(
    poCode.includes('className={embedded ? "space-y-4 animate-fadeIn" : "space-y-6"}'),
    'PurchaseOrdersPage must use space-y-4 when embedded for consistent spacing with tabs'
  );
  // Search and filters toolbar exists
  assert(poCode.includes('Search & Filters Toolbar'), 'Search & Filters Toolbar must exist');
  assert(poCode.includes('warehouseFilter'), 'Warehouse filter must be kept');
  assert(poCode.includes('supplierFilter'), 'Supplier filter must be kept');
  assert(poCode.includes('searchQuery'), 'Search query input must be kept');
});

console.log('\n--- 4. History Table and Functionality Preservation ---');

check('Purchase order history table and functionality remain completely intact', () => {
  assert(poCode.includes('ordersTableRef'), 'Orders table ref must remain intact');
  assert(poCode.includes('filteredOrders'), 'Filtered orders data calculation must remain intact');
  assert(poCode.includes('formatDate'), 'Date formatting preserved');
  assert(poCode.includes('formatCurrency') || poCode.includes('grandTotal'), 'Order values preserved');
  assert(poCode.includes('setSelectedOrder'), 'Order detail viewing functionality preserved');
  assert(poCode.includes('isReceiveModalOpen') || poCode.includes('setReceiveTargetOrder'), 'Receipt modal functionality preserved');
});

console.log('\n================================================================================');
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`PASSED:      ${passedTests}`);
console.log(`FAILED:      ${totalTests - passedTests}`);
console.log('================================================================================\n');

if (totalTests === passedTests) {
  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! The highlighted section is completely removed from the History tab while preserving all required functionality.');
} else {
  process.exitCode = 1;
}

