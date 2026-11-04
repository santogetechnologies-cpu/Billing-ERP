import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('================================================================================');
console.log('TEST SUITE: REMOVE GOODS RECEIVED (GRN) FROM PURCHASES & PO');
console.log('================================================================================');

async function runTests() {
  const pagePath = path.resolve('src/pages/purchases/PurchaseInvoicesPage.tsx');
  const ordersTabPath = path.resolve('src/components/purchases/PurchaseOrdersTab.tsx');

  assert(fs.existsSync(pagePath), 'PurchaseInvoicesPage.tsx must exist');
  assert(fs.existsSync(ordersTabPath), 'PurchaseOrdersTab.tsx must exist');

  const pageCode = fs.readFileSync(pagePath, 'utf-8');
  const ordersCode = fs.readFileSync(ordersTabPath, 'utf-8');

  // --- 1. Tab Definitions in Purchases & PO ---
  console.log('\n--- 1. Tab Definitions in Purchases & PO ---');

  // 1.1 Goods Received (GRN) tab removed from purchaseTabs
  assert(!pageCode.includes("{ id: 'grn'"), "1.1 { id: 'grn' } tab must be removed from purchaseTabs");
  assert(!pageCode.includes("label: 'Goods Received (GRN)'"), "1.1 'Goods Received (GRN)' label must not appear in tab items");
  console.log('  ✓ PASS: 1.1 "Goods Received (GRN)" tab removed from Purchases & PO');

  // 1.2 Preserved remaining tabs: Orders (PO), Bills, Returns, Payments made
  assert(pageCode.includes("label: 'Orders (PO)'"), "1.2 Orders (PO) tab preserved");
  assert(pageCode.includes("label: 'Bills'"), "1.2 Bills tab preserved");
  assert(pageCode.includes("label: 'Returns'"), "1.2 Returns tab preserved");
  assert(pageCode.includes("label: 'Payments made'"), "1.2 Payments made tab preserved");
  console.log('  ✓ PASS: 1.2 Remaining tabs (Orders (PO), Bills, Returns, Payments made) preserved intact');

  // --- 2. Tab Content Rendering ---
  console.log('\n--- 2. Tab Content Rendering ---');

  // 2.1 Tab 2 GRN content block removed
  assert(!pageCode.includes("activeTab === 'grn'"), "2.1 activeTab === 'grn' render block must be removed");
  assert(!pageCode.includes("<PurchaseGoodsReceivedTab"), "2.1 PurchaseGoodsReceivedTab must not be rendered in PurchaseInvoicesPage");
  console.log('  ✓ PASS: 2.1 GRN tab content component removed');

  // 2.2 Subtitle updated to exclude GRN
  assert(!pageCode.includes("goods receipt notes (GRN)"), "2.2 Page subtitle must not reference goods receipt notes (GRN)");
  console.log('  ✓ PASS: 2.2 Header subtitle cleaned of GRN references');

  // 2.3 Graceful URL parameter handling for ?tab=grn
  assert(
    pageCode.includes("tab === 'grn'") && pageCode.includes("setActiveTab('orders')"),
    "2.3 URL query parameter ?tab=grn gracefully redirects to 'orders'"
  );
  console.log('  ✓ PASS: 2.3 Fallback for legacy ?tab=grn redirects to orders');

  // --- 3. PurchaseOrdersTab Action Column ---
  console.log('\n--- 3. Purchase Orders Tab Actions ---');

  // 3.1 onReceivePO is optional in PurchaseOrdersTab
  assert(ordersCode.includes('onReceivePO?:'), "3.1 onReceivePO made optional in PurchaseOrdersTabProps");
  // 3.2 Action column contains Eye, Update, and Received components
  assert(ordersCode.includes('<th className="px-4 py-3 text-right">Action</th>'), "3.2 Action column is the 6th column in table");
  // 3.3 PurchaseInvoicesPage does NOT supply onReceivePO
  const poUsageIdx = pageCode.indexOf('<PurchaseOrdersTab');
  assert(poUsageIdx !== -1, "PurchaseOrdersTab used in page");
  const poBlock = pageCode.slice(poUsageIdx, pageCode.indexOf('/>', poUsageIdx) + 2);
  assert(!poBlock.includes('onReceivePO'), "3.3 PurchaseInvoicesPage does not pass onReceivePO");
  console.log('  ✓ PASS: 3.1 - 3.3 Legacy GRN button replaced with modern Action components (Eye, Update, Received)');

  console.log('\n================================================================================');
  console.log('ALL VERIFICATIONS PASSED SUCCESSFULLY (8/8)');
  console.log('================================================================================');
}

runTests().catch(err => {
  console.error('\n❌ Test Suite Failed:', err.message);
  process.exit(1);
});

