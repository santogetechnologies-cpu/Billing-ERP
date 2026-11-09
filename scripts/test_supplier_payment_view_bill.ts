import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('================================================================================');
console.log('TEST SUITE: SUPPLIER PAYMENT HISTORY – VIEW SUPPLIER BILL VERIFICATION');
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
  const modalPath = path.resolve('src/components/purchases/SupplierBillInvoiceModal.tsx');

  const tabCode = fs.readFileSync(tabPath, 'utf8');
  const modalCode = fs.readFileSync(modalPath, 'utf8');

  // --- Group 1: Eye Icon & Bill Resolution in PurchasePaymentsMadeTab.tsx ---
  console.log('--- 1. Eye Icon and Bill Resolution in Supplier Payment History ---');
  runTest('Imports SupplierBillInvoiceModal in PurchasePaymentsMadeTab', () => {
    assert(tabCode.includes("import { SupplierBillInvoiceModal } from './SupplierBillInvoiceModal';"), 'Must import SupplierBillInvoiceModal');
  });

  runTest('State holds selected bill for viewing', () => {
    assert(tabCode.includes('selectedBillForView'), 'Must define selectedBillForView state');
    assert(tabCode.includes('setSelectedBillForView'), 'Must define setSelectedBillForView state updater');
  });

  runTest('Eye icon action triggers handleViewBill', () => {
    assert(tabCode.includes('handleViewBill(row)'), 'Eye icon action must trigger handleViewBill');
    assert(tabCode.includes('title="View Bill"'), 'Eye icon action button must be titled "View Bill"');
    assert(tabCode.includes('<Eye className="w-4 h-4" />'), 'Action must render Eye icon');
  });

  runTest('findBillForPayment resolves by invoiceId, reference, supplierInvoiceNumber, PO number, and supplier', () => {
    assert(tabCode.includes('findBillForPayment'), 'Must define findBillForPayment helper');
    assert(tabCode.includes('p.invoiceId') || tabCode.includes('paymentRow.invoiceId'), 'Must resolve by invoiceId');
    assert(tabCode.includes('supplierInvoiceNumber'), 'Must resolve by supplierInvoiceNumber');
    assert(tabCode.includes('purchaseOrderNumber'), 'Must resolve by purchaseOrderNumber');
    assert(tabCode.includes('cleanRef') || tabCode.includes('invoiceNumber'), 'Must resolve by invoiceNumber in reference');
  });

  runTest('SupplierBillInvoiceModal is rendered with bill and payment props', () => {
    assert(tabCode.includes('<SupplierBillInvoiceModal'), 'Must render SupplierBillInvoiceModal');
    assert(tabCode.includes('bill={selectedBillForView}'), 'Must pass selectedBillForView to modal');
    assert(tabCode.includes('isOpen={Boolean(selectedBillForView)}'), 'Modal must open when bill is selected');
  });

  // --- Group 2: Professional Bill Format in SupplierBillInvoiceModal.tsx ---
  console.log('\n--- 2. Professional Purchase Invoice Bill Format ---');
  runTest('Displays Company name and details', () => {
    assert(modalCode.includes('companyName'), 'Must display company name');
    assert(modalCode.includes('companyAddressStr'), 'Must display company address');
    assert(modalCode.includes('companyPhone'), 'Must display company phone');
    assert(modalCode.includes('companyEmail'), 'Must display company email');
    assert(modalCode.includes('companyGstin'), 'Must display company GSTIN');
  });

  runTest('Displays Purchase Invoice / Bill Number', () => {
    assert(modalCode.includes('bill.supplierInvoiceNumber || bill.invoiceNumber'), 'Must display Bill Number');
  });

  runTest('Displays Supplier Name and Details', () => {
    assert(modalCode.includes('supplierName'), 'Must display supplier name');
    assert(modalCode.includes('supplierAddress'), 'Must display supplier address');
    assert(modalCode.includes('supplierGstin'), 'Must display supplier GSTIN');
  });

  runTest('Displays Supplier Invoice Number & Purchase Order Number', () => {
    assert(modalCode.includes('Supplier Invoice Number:'), 'Must label Supplier Invoice Number');
    assert(modalCode.includes('Purchase Order Number:'), 'Must label Purchase Order Number');
  });

  runTest('Displays Invoice Date and Destination Warehouse', () => {
    assert(modalCode.includes('Invoice Date:'), 'Must display Invoice Date');
    assert(modalCode.includes('Destination Warehouse:'), 'Must display Destination Warehouse');
    assert(modalCode.includes('bill.warehouse'), 'Must use bill.warehouse');
  });

  runTest('Line items display Ordered Quantity and Received Quantity explicitly', () => {
    assert(modalCode.includes('Ordered Qty'), 'Must have Ordered Qty column header');
    assert(modalCode.includes('Received Qty'), 'Must have Received Qty column header');
    assert(modalCode.includes('it.orderedQty'), 'Must read orderedQty');
    assert(modalCode.includes('it.receivedQty'), 'Must read receivedQty');
  });

  runTest('Line items display Unit, Cost per Item, Total Cost, GST %, GST Amount, and Amount', () => {
    assert(modalCode.includes('Unit'), 'Must have Unit header');
    assert(modalCode.includes('Cost / Item'), 'Must have Cost / Item header');
    assert(modalCode.includes('Total Cost'), 'Must have Total Cost header');
    assert(modalCode.includes('GST %'), 'Must have GST % header');
    assert(modalCode.includes('GST Amount'), 'Must have GST Amount header');
    assert(modalCode.includes('lineTotal') || modalCode.includes('it.total'), 'Must compute and display Line Total');
  });

  runTest('Displays Additional Charges, Subtotal, and Grand Total', () => {
    assert(modalCode.includes('Subtotal (Before GST):'), 'Must display Subtotal');
    assert(modalCode.includes('Total GST:'), 'Must display Total GST');
    assert(modalCode.includes('Additional Charges:'), 'Must display Additional Charges');
    assert(modalCode.includes('Grand Total:'), 'Must display Grand Total');
  });

  // --- Group 3: View-Only Mode ---
  console.log('\n--- 3. View-Only Mode Verification ---');
  runTest('Modal has no Edit, Update, or Received modification buttons', () => {
    assert(!modalCode.includes('btn-edit') && !modalCode.includes('Edit Bill') && !modalCode.includes('Edit Invoice'), 'Must not have Edit button');
    assert(!modalCode.includes('Update Bill') && !modalCode.includes('Update Status'), 'Must not have Update button');
    assert(!modalCode.includes('Mark as Received') && !modalCode.includes('Receive Items'), 'Must not have Received button');
  });

  // --- Group 4: Print Bill Option ---
  console.log('\n--- 4. Print Bill Option Verification ---');
  runTest('Top action bar has only the Close button (Print button removed from top-right)', () => {
    const topBarSnippet = modalCode.slice(modalCode.indexOf('SCREEN ACTION BAR'), modalCode.indexOf('ON-SCREEN MODAL PREVIEW'));
    assert(!topBarSnippet.includes('Print Bill'), 'Top action bar must NOT contain Print Bill button');
    assert(topBarSnippet.includes('title="Close"'), 'Top action bar must contain Close button');
  });

  runTest('Bottom footer contains Print Bill button', () => {
    const footerSnippet = modalCode.slice(modalCode.indexOf('MODAL FOOTER'));
    assert(footerSnippet.includes('Print Bill'), 'Modal footer must contain Print Bill button');
    assert(footerSnippet.includes('handlePrint'), 'Print Bill button in footer must trigger handlePrint');
    assert(footerSnippet.includes('Printer'), 'Print Bill button must render Printer icon');
  });

  runTest('handlePrint uses isolated hidden iframe for clean A4 printing', () => {
    assert(modalCode.includes('generatePurchaseInvoiceHTML'), 'Must generate standalone HTML for print');
    assert(modalCode.includes("document.createElement('iframe')"), 'Must use isolated iframe print mechanism');
    assert(modalCode.includes('iframe.contentWindow?.print()'), 'Must invoke print on iframe');
  });

  runTest('Print styles hide background, modal controls, buttons, and navigation bar', () => {
    assert(modalCode.includes('.no-print {'), 'Must define .no-print rule');
    assert(modalCode.includes('display: none !important;'), 'Must hide elements in print');
    assert(modalCode.includes('size: A4 portrait;'), 'Must set @page size to A4 portrait');
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

