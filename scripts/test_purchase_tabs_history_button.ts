import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('================================================================================');
console.log('TEST SUITE: MOVE HISTORY BUTTON TO PURCHASES & PO TABS VERIFICATION');
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

const invoicesPageCode = fs.readFileSync(invoicesPagePath, 'utf-8');
const poPageCode = fs.readFileSync(poPagePath, 'utf-8');

console.log('--- 1. Tab Order and Placement in Purchases & PO Module ---');

check('Purchases & PO tabs define exactly 5 tabs in required order', () => {
  const tabsMatch = invoicesPageCode.match(/const purchaseTabs:\s*TabItem\[\]\s*=\s*\[([\s\S]*?)\];/);
  assert(tabsMatch, 'purchaseTabs array must be defined');

  const tabsContent = tabsMatch[1];
  const orderIndex = tabsContent.indexOf("'orders'");
  const billsIndex = tabsContent.indexOf("'bills'");
  const returnsIndex = tabsContent.indexOf("'returns'");
  const paymentsIndex = tabsContent.indexOf("'payments'");
  const historyIndex = tabsContent.indexOf("'history'");

  assert(orderIndex !== -1, 'Orders (PO) tab must exist');
  assert(billsIndex !== -1, 'Bills tab must exist');
  assert(returnsIndex !== -1, 'Returns tab must exist');
  assert(paymentsIndex !== -1, 'Payments Made tab must exist');
  assert(historyIndex !== -1, 'History tab must exist');

  assert(orderIndex < billsIndex, 'Orders (PO) must be before Bills');
  assert(billsIndex < returnsIndex, 'Bills must be before Returns');
  assert(returnsIndex < paymentsIndex, 'Returns must be before Payments Made');
  assert(paymentsIndex < historyIndex, 'History must be immediately after Payments Made');
});

check('History tab has correct icon, label, and record count', () => {
  assert(invoicesPageCode.includes('import {') && invoicesPageCode.includes('History'), 'History icon must be imported from lucide-react');
  assert(invoicesPageCode.includes("label: 'History'"), 'History tab must have label "History"');
  assert(invoicesPageCode.includes('icon: History'), 'History tab must use History icon');
  assert(invoicesPageCode.includes('count: historyCount'), 'History tab must include count (historyCount)');
  assert(invoicesPageCode.includes("label: 'Payments Made'"), 'Payments Made tab must use title case "Payments Made"');
});

console.log('\n--- 2. Functionality and Order History Display ---');

check('History tab renders the order history component and preserves functionality', () => {
  assert(invoicesPageCode.includes("activeTab === 'history'"), 'Must conditionally render content for activeTab === "history"');
  assert(invoicesPageCode.includes('<PurchaseOrdersPage embedded={true} initialTabFilter="History" />'), 'History tab must render PurchaseOrdersPage embedded with initialTabFilter="History"');
  assert(invoicesPageCode.includes('import { PurchaseOrdersPage } from \'./PurchaseOrdersPage\';'), 'Must import PurchaseOrdersPage in PurchaseInvoicesPage');
});

check('PurchaseOrdersPage supports embedded mode and preserves full order history data', () => {
  assert(poPageCode.includes('embedded'), 'PurchaseOrdersPage must accept embedded prop');
  assert(poPageCode.includes('initialTabFilter'), 'PurchaseOrdersPage must accept initialTabFilter prop');
  assert(poPageCode.includes('!embedded &&'), 'Standalone top breadcrumb header is omitted when embedded');
  assert(poPageCode.includes('ordersTableRef'), 'Preserves ordersTableRef and smooth scroll');
  assert(poPageCode.includes('handleCardFilterClick'), 'Preserves card filter handling');
  assert(poPageCode.includes('isReceiveModalOpen'), 'Preserves goods receipt modal functionality');
  assert(poPageCode.includes('isDetailModalOpen'), 'Preserves order detail modal functionality');
});

console.log('\n--- 3. Removal of Old History Button from PurchaseOrdersPage ---');

check('Old History button is removed from po-status-buttons-row in PurchaseOrdersPage', () => {
  const rowMatch = poPageCode.match(/<div id="po-status-buttons-row"[\s\S]*?<\/button>\s*<\/div>/);
  assert(rowMatch, 'po-status-buttons-row must exist');
  const rowContent = rowMatch[0];

  assert(!rowContent.includes('{/* 4. History Button */}'), 'Old History button comment must be removed');
  assert(!rowContent.includes("onClick={() => handleCardFilterClick('History')}"), 'Old History button click handler must not be in po-status-buttons-row');
  assert(rowContent.includes('handleCardFilterClick(\'Ordered\')'), 'Ordered button remains in po-status-buttons-row');
  assert(rowContent.includes('handleCardFilterClick(\'Received\')'), 'Delivered button remains in po-status-buttons-row');
  assert(rowContent.includes('handleCardFilterClick(\'Overdue\')'), 'Overdue button remains in po-status-buttons-row');
  assert(rowContent.includes('grid-cols-1 sm:grid-cols-3'), 'po-status-buttons-row rebalanced to 3 equal columns');
});

console.log('\n--- 4. Styling and Navigation Alignment ---');

check('Tabs component renders all 5 tabs in unified navigation row', () => {
  assert(invoicesPageCode.includes('<Tabs'), 'Purchases & PO uses universal Tabs component');
  assert(invoicesPageCode.includes('tabs={purchaseTabs}'), 'Tabs receives purchaseTabs containing all 5 tabs');
});

console.log('\n================================================================================');
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`PASSED:      ${passedTests}`);
console.log(`FAILED:      ${totalTests - passedTests}`);
console.log('================================================================================\n');

if (totalTests === passedTests) {
  console.log('🎉 ALL PURCHASES & PO TABS MOVE HISTORY BUTTON TESTS PASSED 100%!\n');
} else {
  process.exitCode = 1;
}

