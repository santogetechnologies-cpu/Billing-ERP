import fs from 'fs';
import path from 'path';

function runTests() {
  console.log('--- Running Tests for Quotation Print Isolation & Format ---\n');
  let passedCount = 0;
  let totalCount = 0;

  function assert(desc: string, condition: boolean, detail?: string) {
    totalCount++;
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passedCount++;
    } else {
      console.error(`[FAIL] ${desc}${detail ? ` - ${detail}` : ''}`);
    }
  }

  const modalPath = path.resolve('src/components/purchases/BulkOrderBillModal.tsx');
  const poPagePath = path.resolve('src/pages/purchases/PurchaseOrdersPage.tsx');
  const cssPath = path.resolve('src/index.css');

  const modalCode = fs.readFileSync(modalPath, 'utf8');
  const poPageCode = fs.readFileSync(poPagePath, 'utf8');
  const cssCode = fs.readFileSync(cssPath, 'utf8');

  // Test 1: PurchaseOrdersPage background content is hidden during print when quotation modal is active
  assert(
    'PurchaseOrdersPage wraps all background cards, filters, and tables in print:hidden no-print when quotation modal is active',
    poPageCode.includes("isBulkOrderModalOpen ? 'print:hidden no-print' : ''")
  );

  // Test 2: Dedicated quotation print container is present in BulkOrderBillModal
  assert(
    'Dedicated quotation print container #quotation-print-container exists',
    modalCode.includes('id="quotation-print-container"') &&
    modalCode.includes('quotation-print-document')
  );

  // Test 3: CSS @media print isolates the quotation document
  assert(
    'index.css isolates quotation modal and hides sidebars, headers, navigation in print',
    cssCode.includes('body.quotation-modal-open aside') &&
    cssCode.includes('body.quotation-print-active aside') &&
    cssCode.includes('body:has(#quotation-print-container) aside') &&
    cssCode.includes('#quotation-print-container')
  );

  // Test 4: generateQuotationPrintHTML creates standalone isolated A4 HTML
  assert(
    'generateQuotationPrintHTML exists and formats as A4 portrait',
    modalCode.includes('function generateQuotationPrintHTML') &&
    modalCode.includes('size: A4 portrait') &&
    (modalCode.includes('margin: 0') || modalCode.includes('12mm 15mm'))
  );

  // Test 5: Hidden iframe isolation used for single-document printing without background bleed
  assert(
    'handlePrint uses isolated hidden iframe (quotation-print-iframe)',
    modalCode.includes('quotation-print-iframe') &&
    (modalCode.includes('iframe.contentWindow?.print()') || modalCode.includes('iframeWin?.print()'))
  );

  // Test 6: Includes Company Name & Contact details
  assert(
    'Print output includes Company name and contact details',
    modalCode.includes('company-title') &&
    modalCode.includes('company?.name') &&
    modalCode.includes('company?.address') &&
    modalCode.includes('company?.phone') &&
    modalCode.includes('company?.email')
  );

  // Test 7: Includes Quotation Number and Quotation Date
  assert(
    'Print output includes Quotation Number and Quotation Date',
    modalCode.includes('quote-num') &&
    modalCode.includes('billNumber') &&
    modalCode.includes('quote-date') &&
    modalCode.includes('orderDate')
  );

  // Test 8: Includes Customer Details
  assert(
    'Print output includes Customer Details',
    modalCode.includes('cust-section') &&
    modalCode.includes('customerName') &&
    modalCode.includes('customerPhone')
  );

  // Test 9: Includes Quotation Validity Date
  assert(
    'Print output includes Quotation Validity Date and validity notice',
    modalCode.includes('Valid Until:') &&
    modalCode.includes('validUntil') &&
    modalCode.includes('This quotation is valid until the specified date. Prices may change after the validity period.')
  );

  // Test 10: Includes Product table columns
  const requiredColumns = [
    'Product Name',
    'Quantity',
    'Unit',
    'Original Unit Price',
    'Discount (%)',
    'Discount Amount',
    'Final Unit Price',
    'Total Product Amount'
  ];
  const allColsInPrint = requiredColumns.every(col => modalCode.includes(col));
  assert(
    'Print output includes all 8 specified product details columns',
    allColsInPrint
  );

  // Test 11: Includes Financial Summary totals
  assert(
    'Print output includes Subtotal, Total Discount, GST (if applicable), and Grand Total',
    modalCode.includes('Subtotal:') &&
    modalCode.includes('Total Discount:') &&
    modalCode.includes('GST (if applicable):') &&
    modalCode.includes('Grand Total:')
  );

  // Test 12: Includes Authorized Signature
  assert(
    'Print output includes Authorized Signature line',
    modalCode.includes('Authorized Signature')
  );

  // Test 13: Redirects to main Dashboard after print completion
  assert(
    'Redirects to main Dashboard after print dialog completion',
    modalCode.includes("navigate('/')") &&
    modalCode.includes('afterprint')
  );

  console.log(`\nResults: ${passedCount}/${totalCount} tests passed.\n`);

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runTests();
