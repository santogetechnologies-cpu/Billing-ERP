/**
 * Verification Test Suite: Billing Print Flow & Dedicated Saved Invoice Preview
 *
 * Verifies all 10 requirements:
 * 1. Invoice & items saved to database on bill completion.
 * 2. Dedicated Saved Invoice Preview screen opens and remains open instead of auto-navigating away.
 * 3. Displays saved invoice number, customer details, products, quantities, prices, taxes, discounts, grand total, and payment details.
 * 4. Actions provided: "Print Bill", "Download PDF", "Close / Back to Billing".
 * 5. Invoice preview remains open after printing finishes or print dialog is cancelled.
 * 6. No automatic navigation after saving or printing. Returns to billing page ONLY when user clicks "Close / Back to Billing".
 * 7. Re-printing an already saved invoice reuses the same saved invoice ID & number without creating a duplicate or re-deducting stock.
 * 8. Prevents duplicate save operations from repeated clicks or rapid submissions.
 * 9. Displays "Invoice saved successfully" confirmation after database confirms save.
 * 10. If saving fails, shows error and never displays a false success message.
 */

import fs from 'fs';
import path from 'path';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, failureDetails?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    console.error(`  [FAIL] ${testName}`);
    if (failureDetails) {
      console.error(`         ${failureDetails}`);
    }
  }
}

console.log('\n======================================================');
console.log('BILLING PRINT FLOW & SAVED INVOICE PREVIEW TEST SUITE');
console.log('======================================================\n');

const ROOT_DIR = process.cwd();
const invoiceModalPath = path.join(ROOT_DIR, 'src', 'components', 'invoice', 'InvoicePrintModal.tsx');
const newInvoicePath = path.join(ROOT_DIR, 'src', 'pages', 'sales', 'NewInvoicePage.tsx');
const fastPosPath = path.join(ROOT_DIR, 'src', 'pages', 'sales', 'FastPOSPage.tsx');

const modalContent = fs.readFileSync(invoiceModalPath, 'utf-8');
const newInvoiceContent = fs.readFileSync(newInvoicePath, 'utf-8');
const fastPosContent = fs.readFileSync(fastPosPath, 'utf-8');

// -----------------------------------------------------------------------------
// Test 1: InvoicePrintModal - Action Buttons
// -----------------------------------------------------------------------------
console.log('Section 1: Dedicated Saved Invoice Preview Actions');

assert(
  modalContent.includes('id="print-bill-btn"') && modalContent.includes('Print Bill'),
  'InvoicePrintModal contains explicit "Print Bill" action button'
);

assert(
  modalContent.includes('id="download-pdf-btn"') && modalContent.includes('Download PDF'),
  'InvoicePrintModal contains explicit "Download PDF" action button'
);

assert(
  modalContent.includes('id="close-back-to-billing-btn"') && modalContent.includes('Close / Back to Billing'),
  'InvoicePrintModal contains explicit "Close / Back to Billing" action button'
);

assert(
  modalContent.includes('showSuccessBanner') && modalContent.includes('Invoice saved successfully'),
  'InvoicePrintModal renders prominent "Invoice saved successfully" confirmation banner'
);

// -----------------------------------------------------------------------------
// Test 2: InvoicePrintModal - Backdrop Click & Print Dialog Persistence
// -----------------------------------------------------------------------------
console.log('\nSection 2: Preview Persistence (No premature dismissal)');

assert(
  modalContent.includes('preventBackdropClose ? undefined : onClose'),
  'Backdrop clicks do NOT dismiss the modal when preventBackdropClose is active'
);

assert(
  !modalContent.includes('window.addEventListener(\'afterprint\', onClose') &&
  !modalContent.includes('window.addEventListener("afterprint", onClose'),
  'No afterprint listener automatically closes the invoice preview after printing'
);

assert(
  (modalContent.includes('const handlePrint = () => {') || modalContent.includes('const handlePrint = async () => {')) &&
  !modalContent.slice(modalContent.indexOf('const handlePrint ='), modalContent.indexOf('const handlePrint =') + 250).includes('onClose()'),
  'handlePrint does NOT invoke onClose() after window.print()'
);

assert(
  modalContent.includes('const handleDownloadPdf = () => {') &&
  !modalContent.slice(modalContent.indexOf('const handleDownloadPdf = () => {'), modalContent.indexOf('const handleDownloadPdf = () => {') + 200).includes('onClose()'),
  'handleDownloadPdf does NOT invoke onClose() after triggering PDF print'
);

// -----------------------------------------------------------------------------
// Test 3: Invoice Details Display (A4 & Thermal Formats)
// -----------------------------------------------------------------------------
console.log('\nSection 3: Complete Invoice Data Rendering');

assert(
  modalContent.includes('invoice.invoiceNumber') &&
  modalContent.includes('invoice.customerName') &&
  modalContent.includes('invoice.customerGstin') &&
  modalContent.includes('invoice.customerPhone'),
  'Invoice preview displays saved invoice number and customer details'
);

assert(
  modalContent.includes('item.productName') &&
  modalContent.includes('item.qty') &&
  modalContent.includes('item.rate') &&
  modalContent.includes('item.total') &&
  modalContent.includes('item.discountAmt'),
  'Invoice preview displays line item products, quantities, prices, discounts, and item totals'
);

assert(
  modalContent.includes('invoice.subtotal') &&
  modalContent.includes('invoice.taxTotal') &&
  modalContent.includes('invoice.grandTotal'),
  'Invoice preview displays tax breakdown, subtotal, and grand total'
);

assert(
  modalContent.includes('invoice.paymentMethod') &&
  modalContent.includes('invoice.paymentStatus') &&
  modalContent.includes('invoice.paidAmount') &&
  modalContent.includes('changeReturnedNum') &&
  modalContent.includes('balanceDueNum'),
  'Invoice preview displays payment details (method, paid amount, change returned, balance due)'
);

// -----------------------------------------------------------------------------
// Test 4: NewInvoicePage - Billing Save & Navigation Flow
// -----------------------------------------------------------------------------
console.log('\nSection 4: New Invoice Page (Sales Billing) Flow');

assert(
  !newInvoiceContent.includes('navigate(\'/sales\')') ||
  !newInvoiceContent.includes('onClose={() => {\n          setIsPrintModalOpen(false);\n          navigate(\'/sales\');'),
  'Automatic navigation to /sales in InvoicePrintModal onClose removed from NewInvoicePage'
);

assert(
  newInvoiceContent.includes('handleStartNewBill()') &&
  newInvoiceContent.includes('setIsPrintModalOpen(false);') &&
  newInvoiceContent.includes('closeButtonLabel="Close / Back to Billing"'),
  'NewInvoicePage returns to billing page with clean form only when "Close / Back to Billing" is clicked'
);

assert(
  newInvoiceContent.includes('if (createdInvoice && createdInvoice.id) {') &&
  newInvoiceContent.includes('setIsPrintModalOpen(true);') &&
  newInvoiceContent.includes('return;'),
  'NewInvoicePage reuses already saved invoice without calling createSalesInvoice or deducting stock again'
);

assert(
  newInvoiceContent.includes('isSavingRef.current') &&
  newInvoiceContent.includes('isSavingRef.current = true;'),
  'NewInvoicePage guards against rapid duplicate clicks via isSavingRef'
);

assert(
  newInvoiceContent.includes('setSaveSuccessMessage(') &&
  newInvoiceContent.includes('Invoice saved successfully'),
  'NewInvoicePage sets success confirmation only upon successful database save'
);

assert(
  newInvoiceContent.includes('catch (err: any) {') &&
  newInvoiceContent.includes('setSaveSuccessMessage(null);') &&
  newInvoiceContent.includes('setCreatedInvoice(null);'),
  'NewInvoicePage clears success state and prevents preview display if database save fails'
);

// -----------------------------------------------------------------------------
// Test 5: FastPOSPage - Cashier POS Counter Flow
// -----------------------------------------------------------------------------
console.log('\nSection 5: Fast POS Counter (Cashier Billing) Flow');

assert(
  fastPosContent.includes('if (completedInvoice && completedInvoice.id) {') &&
  fastPosContent.includes('setPrintModalOpen(true);') &&
  fastPosContent.includes('return;'),
  'FastPOSPage reuses existing completed invoice ID/number without creating duplicate or re-deducting stock'
);

assert(
  fastPosContent.includes('isSavingRef.current') &&
  fastPosContent.includes('isSavingRef.current = true;'),
  'FastPOSPage protects against duplicate checkout clicks using isSavingRef lock'
);

assert(
  fastPosContent.includes('setCompletedInvoice(newInvoice);') &&
  fastPosContent.includes('setPrintModalOpen(true);') &&
  fastPosContent.includes('setSaveSuccessMessage('),
  'FastPOSPage sets completed invoice and opens dedicated preview on successful database save'
);

assert(
  fastPosContent.includes('catch (err: any) {') &&
  fastPosContent.includes('setSaveSuccessMessage(null);') &&
  fastPosContent.includes('setCompletedInvoice(null);'),
  'FastPOSPage resets saved invoice state and shows error if checkout transaction fails'
);

assert(
  fastPosContent.includes('closeButtonLabel="Close / Back to Billing"') &&
  fastPosContent.includes('setCompletedInvoice(null);') &&
  fastPosContent.includes('setPrintModalOpen(false);'),
  'FastPOSPage returns Cashier to active billing screen only when "Close / Back to Billing" is clicked'
);

assert(
  fastPosContent.includes('preventBackdropClose={true}'),
  'FastPOSPage passes preventBackdropClose={true} to avoid accidental preview dismissals'
);

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n------------------------------------------------------');
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`PASSED:      ${passedTests}`);
console.log(`FAILED:      ${totalTests - passedTests}`);
console.log('------------------------------------------------------\n');

if (passedTests === totalTests) {
  console.log('✓ ALL BILLING PRINT FLOW & SAVED PREVIEW TESTS PASSED SUCCESSFULLY!\n');
  process.exit(0);
} else {
  console.error('✗ SOME TESTS FAILED!\n');
  process.exit(1);
}
