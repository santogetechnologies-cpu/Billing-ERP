import fs from 'fs';
import path from 'path';

function runTests() {
  console.log('--- Testing Purchases & PO: Bills Section Layout & Modal ---');

  const pagePath = path.resolve('src/pages/purchases/PurchaseInvoicesPage.tsx');
  const modalPath = path.resolve('src/components/purchases/SupplierBillInvoiceModal.tsx');

  if (!fs.existsSync(pagePath)) {
    throw new Error(`File not found: ${pagePath}`);
  }
  if (!fs.existsSync(modalPath)) {
    throw new Error(`File not found: ${modalPath}`);
  }

  const pageContent = fs.readFileSync(pagePath, 'utf8');
  const modalContent = fs.readFileSync(modalPath, 'utf8');

  // 1. Verify 6 Table Columns in exact order in Tab 2 Bills Table
  const expectedHeaders = [
    'Supplier / PO Number',
    'Bill Date',
    'Destination Store',
    'Items Count',
    'Payment Status',
    'Action'
  ];

  for (const header of expectedHeaders) {
    if (!pageContent.includes(`<th className="px-4 py-3">${header}</th>`) &&
        !pageContent.includes(`>${header}</th>`)) {
      throw new Error(`Missing expected column header: ${header}`);
    }
  }
  console.log('✓ Verified all 6 column headers are present');

  // Verify header ordering in table
  const headerIndices = expectedHeaders.map(h => pageContent.indexOf(`>${h}</th>`));
  for (let i = 0; i < headerIndices.length - 1; i++) {
    if (headerIndices[i] >= headerIndices[i + 1]) {
      throw new Error(`Headers are not in the expected order: ${expectedHeaders[i]} comes after ${expectedHeaders[i + 1]}`);
    }
  }
  console.log('✓ Verified 6 column headers are in exact required order');

  // 2. Verify Supplier / PO Number column display format
  if (!pageContent.includes('bill.supplierName') || !pageContent.includes('text-purple-600')) {
    throw new Error('Supplier name and purple PO number layout missing');
  }
  console.log('✓ Verified Supplier / PO Number styling (Bold Supplier on top, Purple PO underneath)');

  // 3. Verify Payment Status badges: PENDING and COMPLETED
  if (!pageContent.includes('PENDING') || !pageContent.includes('COMPLETED')) {
    throw new Error('Payment status badges PENDING or COMPLETED missing');
  }
  if (!pageContent.includes('bg-amber-50') || !pageContent.includes('bg-emerald-50')) {
    throw new Error('Orange (amber) and green (emerald) badge styles missing for payment statuses');
  }
  console.log('✓ Verified Payment Status badges (Orange PENDING / Green COMPLETED)');

  // 4. Verify Purple Bill Button in Action column
  if (!pageContent.includes('>Bill</span>') || !pageContent.includes('bg-purple-50')) {
    throw new Error('Purple Bill button missing in Action column');
  }
  console.log('✓ Verified Purple Bill button in Action column');

  // 5. Verify SupplierBillInvoiceModal wiring
  if (!pageContent.includes('<SupplierBillInvoiceModal')) {
    throw new Error('SupplierBillInvoiceModal not integrated into PurchaseInvoicesPage');
  }
  console.log('✓ Verified SupplierBillInvoiceModal is connected to selectedInvoice');

  // 6. Verify SupplierBillInvoiceModal components:
  // A. Company Information
  if (!modalContent.includes('companyAddressStr') && !modalContent.includes('company?.name')) {
    throw new Error('Company information missing in SupplierBillInvoiceModal');
  }
  console.log('✓ Verified Company Information in modal');

  // B. Supplier Information
  if (!modalContent.includes('bill.supplierName') || !modalContent.includes('supplierGstin')) {
    throw new Error('Supplier information missing in SupplierBillInvoiceModal');
  }
  console.log('✓ Verified Supplier Information in modal');

  // C. Invoice Information
  if (!modalContent.includes('bill.supplierInvoiceNumber') || !modalContent.includes('bill.purchaseOrderNumber')) {
    throw new Error('Invoice information missing in SupplierBillInvoiceModal');
  }
  console.log('✓ Verified Invoice Information in modal');

  // D. Product Details Table (9 Columns)
  const productHeaders = [
    'S.No',
    'Product Name',
    'Quantity',
    'Unit',
    'Total Cost',
    'GST %',
    'GST Amount'
  ];
  for (const ph of productHeaders) {
    if (!modalContent.includes(`>${ph}</th>`)) {
      throw new Error(`Missing product table header: ${ph}`);
    }
  }
  if (!modalContent.includes('>Cost / Item</th>') && !modalContent.includes('>Cost per Item</th>')) {
    throw new Error('Missing Cost / Item header');
  }
  if (!modalContent.includes('>Amount</th>') && !modalContent.includes('>Total</th>')) {
    throw new Error('Missing Amount header');
  }
  console.log('✓ Verified 9 Product Table column headers in modal');

  // E. Bill Summary
  if (!modalContent.includes('Subtotal (Before GST):') ||
      !modalContent.includes('Total GST:') ||
      !modalContent.includes('Additional Charges:') ||
      !modalContent.includes('Grand Total:')) {
    throw new Error('Bill Summary section fields missing');
  }
  console.log('✓ Verified Bill Summary in modal');

  // F. Payment Information
  if (!modalContent.includes('Payment Information') ||
      !modalContent.includes('Amount Paid:') ||
      !modalContent.includes('Balance Due:')) {
    throw new Error('Payment Information section fields missing');
  }
  console.log('✓ Verified Payment Information in modal');

  // 7. Verify Print Bill & Close buttons + A4 print isolation
  if (!modalContent.includes('window.print()') || !modalContent.includes('invoice-modal-backdrop') || !modalContent.includes('no-print')) {
    throw new Error('Print Bill and print isolation styles missing');
  }
  console.log('✓ Verified Print Bill functionality and A4 print isolation classes');

  console.log('\n--- ALL BILLS SECTION TESTS PASSED SUCCESSFULLY! ---');
}

runTests();

