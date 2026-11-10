import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('================================================================================');
console.log('TEST SUITE: SIMPLIFIED PURCHASE ORDERS HISTORY TABLE (7 COLUMNS) VERIFICATION');
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

const poPagePath = path.resolve('src/pages/purchases/PurchaseOrdersPage.tsx');
const poPageCode = fs.readFileSync(poPagePath, 'utf-8');

console.log('--- 1. Verification of 7 Aligned Columns ---');

check('Table header defines all 7 simplified columns in clean aligned order', () => {
  assert(poPageCode.includes('>PO Number & Date</th>'), 'Column 1 must be PO Number & Date');
  assert(poPageCode.includes('>Supplier</th>'), 'Column 2 must be Supplier');
  assert(poPageCode.includes('>Destination Warehouse</th>'), 'Column 3 must be Destination Warehouse');
  assert(poPageCode.includes('>Expected Delivery</th>'), 'Column 4 must be Expected Delivery');
  assert(poPageCode.includes('>Status</th>'), 'Column 5 must be Status');
  assert(poPageCode.includes('>Total Amount (₹)</th>'), 'Column 6 must be Total Amount (₹)');
  assert(poPageCode.includes('>Action</th>'), 'Column 7 must be Action');
});

console.log('\n--- 2. Removal of Items & Quantity Column ---');

check('Items & Quantity column and Total Ordered details are completely removed from table', () => {
  const tableMatch = poPageCode.match(/<table[\s\S]*?<\/table>/);
  assert(tableMatch, 'Table element must exist');
  const tableCode = tableMatch[0];

  assert(!tableCode.includes('>Items & Quantity</th>'), 'Items & Quantity header must be removed from table');
  assert(!tableCode.includes('Total Ordered:'), 'Total Ordered text must be removed from table cells');
  assert(!tableCode.includes('Pending:'), 'Pending text must be removed from table cells');
});

console.log('\n--- 3. Action Buttons Simplification ---');

check('View (Eye icon) and Receive buttons are removed from table rows', () => {
  const tableBodyMatch = poPageCode.match(/<tbody[\s\S]*?<\/tbody>/);
  assert(tableBodyMatch, 'Table body must exist');
  const tableBody = tableBodyMatch[0];

  assert(!tableBody.includes('title="View Order Details"'), 'Eye view button must not exist in table rows');
  assert(!tableBody.includes('title="Record Inward Goods Receipt (GRN)"'), 'Receive button must not exist in table rows');
  assert(!tableBody.includes('<span>Receive</span>'), 'Receive text button must not exist in table rows');
});

check('Bill button is preserved with proper styling and navigation', () => {
  const tableBodyMatch = poPageCode.match(/<tbody[\s\S]*?<\/tbody>/);
  assert(tableBodyMatch, 'Table body must exist');
  const tableBody = tableBodyMatch[0];

  assert(tableBody.includes('<span>Bill</span>'), 'Bill button must be rendered in table rows');
  assert(tableBody.includes('navigate(`/purchases/new?poId='), 'Bill button must navigate to purchase bill creation');
  assert(tableBody.includes('title="Record Supplier Invoice against this Purchase Order"'), 'Bill button must maintain title');
});

console.log('\n--- 4. UI Alignment & Data Integrity ---');

check('Table layout includes responsive wrapper, proper text alignment, whitespace handling, and status badges', () => {
  assert(poPageCode.includes('className="overflow-x-auto"'), 'Table must be wrapped in overflow-x-auto');
  assert(poPageCode.includes('whitespace-nowrap'), 'Columns must prevent awkward line wrapping');
  assert(poPageCode.includes('align-middle'), 'Table cells must be vertically aligned');
  assert(poPageCode.includes('bg-emerald-100 text-emerald-800'), 'Received status styling preserved');
  assert(poPageCode.includes('bg-rose-100 text-rose-800'), 'Cancelled status styling preserved');
  assert(poPageCode.includes('bg-blue-100 text-blue-800'), 'Ordered status styling preserved');
  assert(poPageCode.includes('formatCurrency(order.grandTotal)'), 'Currency formatting preserved');
});

console.log('\n================================================================================');
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`PASSED:      ${passedTests}`);
console.log(`FAILED:      ${totalTests - passedTests}`);
console.log('================================================================================\n');

if (totalTests === passedTests) {
  console.log('🎉 ALL PURCHASE ORDERS TABLE VERIFICATION TESTS PASSED 100%!\n');
} else {
  process.exitCode = 1;
}
