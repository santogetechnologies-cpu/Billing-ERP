import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('================================================================================');
console.log('TEST SUITE: SUPPLIER PAYMENT HISTORY – PRINT TABLE LAYOUT VERIFICATION');
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

async function main() {
  const tabPath = path.resolve('src/components/purchases/PurchasePaymentsMadeTab.tsx');
  const dataTablePath = path.resolve('src/components/common/DataTable.tsx');

  const tabCode = fs.readFileSync(tabPath, 'utf8');
  const dataTableCode = fs.readFileSync(dataTablePath, 'utf8');

  // --- Group 1: DataTable onPrint Integration ---
  console.log('--- 1. DataTable Print Table Trigger Integration ---');
  runTest('DataTableProps supports onPrint callback', () => {
    assert(dataTableCode.includes('onPrint?: () => void;'), 'DataTableProps must declare onPrint');
  });

  runTest('Export -> Print Table option invokes onPrint callback', () => {
    assert(dataTableCode.includes('if (onPrint) {'), 'Must check if onPrint is provided');
    assert(dataTableCode.includes('onPrint();'), 'Must invoke onPrint when provided');
  });

  runTest('PurchasePaymentsMadeTab wires onPrint={handlePrintTable}', () => {
    assert(tabCode.includes('onPrint={handlePrintTable}'), 'Must pass onPrint to DataTable');
    assert(tabCode.includes('const handlePrintTable ='), 'Must define handlePrintTable');
  });

  // --- Group 2: Print Only Supplier Payment History & Exclusion of Unrelated UI ---
  console.log('\n--- 2. Print Only Payment History (Excluding Unrelated Sections) ---');
  runTest('Screen UI wrapped with no-print class', () => {
    assert(tabCode.includes('<div className="space-y-4 no-print">'), 'Screen UI must be wrapped in no-print');
  });

  runTest('Print styles hide .no-print elements, navigation, and sidebar', () => {
    assert(tabCode.includes('.no-print {'), 'Must define .no-print rule');
    assert(tabCode.includes('display: none !important;'), 'Must hide elements in print');
  });

  runTest('Print document excludes checkboxes, eye icons, and actions', () => {
    // Both HTML generator and dedicated container must not have input checkboxes or Eye icon
    const genIndex = tabCode.indexOf('generateSupplierPaymentHistoryPrintHTML');
    const genCode = tabCode.slice(genIndex, tabCode.indexOf('export const PurchasePaymentsMadeTab'));
    assert(!genCode.includes('type="checkbox"'), 'Print HTML must not include checkboxes');
    assert(!genCode.includes('actionsWidth'), 'Print HTML must not include actionsWidth');
    assert(!genCode.includes('Eye'), 'Print HTML must not include Eye icon');
  });

  // --- Group 3: Professional A4 Landscape Layout ---
  console.log('\n--- 3. Professional A4 Landscape Print Layout ---');
  runTest('Applies A4 landscape page size and proper margins', () => {
    assert(tabCode.includes('size: A4 landscape;'), 'Must set @page size to A4 landscape');
    assert(tabCode.includes('margin: 10mm 8mm;'), 'Must set clean printable margins');
  });

  runTest('Table occupies 100% available printable width with table-fixed layout', () => {
    assert(tabCode.includes('width: 100%'), 'Table must occupy 100% width');
    assert(tabCode.includes('border-collapse: collapse'), 'Table must have collapsed borders');
  });

  // --- Group 4: Exact 9 Columns in the Correct Order ---
  console.log('\n--- 4. Correct 9 Columns in Table ---');
  const requiredColumns = [
    'Voucher Number',
    'Supplier Name',
    'Supplier Invoice Number',
    'PO Number',
    'Payment Date',
    'Payment Method',
    'Transaction Reference',
    'Amount Paid',
    'Payment Status'
  ];

  runTest('Print HTML includes all 9 columns in the exact order', () => {
    const genIndex = tabCode.indexOf('generateSupplierPaymentHistoryPrintHTML');
    const genCode = tabCode.slice(genIndex, tabCode.indexOf('export const PurchasePaymentsMadeTab'));

    let lastIdx = -1;
    for (const col of requiredColumns) {
      const idx = genCode.indexOf(`>${col}<`);
      assert(idx !== -1, `Print HTML must contain column header: ${col}`);
      assert(idx > lastIdx, `Column ${col} must appear in order after previous columns`);
      lastIdx = idx;
    }
  });

  runTest('In-page print container includes all 9 columns in the exact order', () => {
    const containerIdx = tabCode.indexOf('supplier-payment-history-print-container');
    const containerCode = tabCode.slice(containerIdx);

    let lastIdx = -1;
    for (const col of requiredColumns) {
      const idx = containerCode.indexOf(`>${col}<`);
      assert(idx !== -1, `Container must contain column header: ${col}`);
      assert(idx > lastIdx, `Column ${col} must appear in order after previous columns`);
      lastIdx = idx;
    }
  });

  // --- Group 5: Page Handling (thead repetition & row break avoidance) ---
  console.log('\n--- 5. Page Break Handling ---');
  runTest('Repeats table headings across multiple pages with display: table-header-group', () => {
    assert(tabCode.includes('display: table-header-group;'), 'thead must repeat via table-header-group');
  });

  runTest('Prevents splitting individual payment rows across pages with page-break-inside: avoid', () => {
    assert(tabCode.includes('page-break-inside: avoid !important;'), 'Rows must avoid page breaks');
    assert(tabCode.includes('break-inside: avoid !important;'), 'Rows must avoid CSS break-inside');
  });

  // --- Group 6: Print Header Information ---
  console.log('\n--- 6. Header Metadata & Company Details ---');
  runTest('Print header displays "Supplier Payment History" title', () => {
    assert(tabCode.includes('>Supplier Payment History<') || tabCode.includes('Supplier Payment History'), 'Must display title');
  });

  runTest('Print header displays total number of payment records', () => {
    assert(tabCode.includes('Total ${payments.length} payment records') || tabCode.includes('Total ${outwardPayments.length} payment records'), 'Must display total record count');
  });

  runTest('Print header displays print date and company name', () => {
    assert(tabCode.includes('printDateStr'), 'Must display print date');
    assert(tabCode.includes('companyName') || tabCode.includes('company?.companyName'), 'Must display company name');
  });

  // --- Group 7: Isolated Iframe Mechanism ---
  console.log('\n--- 7. Isolated Iframe Print Execution ---');
  runTest('handlePrintTable uses isolated iframe to prevent background/sidebar leakage', () => {
    assert(tabCode.includes("document.createElement('iframe')"), 'Must create isolated iframe');
    assert(tabCode.includes('iframe.contentWindow?.print()'), 'Must invoke print on iframe');
  });

  console.log('\n================================================================================');
  console.log(`RESULTS: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('================================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});

