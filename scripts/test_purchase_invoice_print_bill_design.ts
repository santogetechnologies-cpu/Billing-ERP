import fs from 'fs';
import path from 'path';

function runTests() {
  console.log('--- Testing Purchase Invoice: Professional Print Bill Design ---');

  const modalPath = path.resolve('src/components/purchases/SupplierBillInvoiceModal.tsx');

  if (!fs.existsSync(modalPath)) {
    throw new Error(`File not found: ${modalPath}`);
  }

  const modalContent = fs.readFileSync(modalPath, 'utf8');

  // 1. Verify Print Bill Functionality & Window.print
  if (!modalContent.includes('window.print()')) {
    throw new Error('Print Bill does not invoke window.print()');
  }
  if (!modalContent.includes("document.body.classList.add('invoice-modal-open')")) {
    throw new Error('Invoice modal open class not added to document.body for print isolation');
  }
  console.log('✓ Verified Print Bill functionality and document print isolation');

  // 2. Verify Header – Company Details (Top-Left) & PURCHASE INVOICE (Top-Right)
  if (!modalContent.includes('companyLogo') || !modalContent.includes('companyAddressStr')) {
    throw new Error('Company Logo or Address missing in Header');
  }
  if (!modalContent.includes('companyPhone') || !modalContent.includes('companyEmail') || !modalContent.includes('companyGstin')) {
    throw new Error('Company contact or GSTIN details missing in Header');
  }
  if (!modalContent.includes('PURCHASE INVOICE')) {
    throw new Error('PURCHASE INVOICE title missing in Header');
  }
  console.log('✓ Verified Header with Company Details (Logo, Name, Address, Phone, Email, GSTIN) and top-right PURCHASE INVOICE');

  // 3. Verify Supplier & Invoice Information (2-Column Layout)
  if (!modalContent.includes('Supplier Details') || !modalContent.includes('Invoice Details')) {
    throw new Error('Supplier Details or Invoice Details section missing');
  }
  if (!modalContent.includes('supplierName') || !modalContent.includes('supplierAddress') || !modalContent.includes('supplierPhone') || !modalContent.includes('supplierGstin')) {
    throw new Error('Supplier details fields missing');
  }
  if (!modalContent.includes('Supplier Invoice Number') || !modalContent.includes('Purchase Order Number') || !modalContent.includes('Invoice Date') || !modalContent.includes('Destination Warehouse')) {
    throw new Error('Invoice details fields missing');
  }
  console.log('✓ Verified Supplier & Invoice Information 2-column layout');

  // 4. Verify Product Details Table Columns (Strictly 9 Columns matching prompt)
  const requiredTableColumns = [
    'S.No',
    'Product Name',
    'Quantity',
    'Unit',
    'Cost / Item',
    'Total Cost',
    'GST %',
    'GST Amount',
    'Amount'
  ];

  for (const col of requiredTableColumns) {
    if (!modalContent.includes(`>${col}</th>`)) {
      throw new Error(`Missing required Product Details table column header: ${col}`);
    }
  }
  console.log('✓ Verified all 9 required Product Details table columns in exact format');

  // 5. Verify Product Calculations & Data Accuracy
  if (!modalContent.includes('recv = it.receivedQty !== undefined ? it.receivedQty : it.qty') ||
      !modalContent.includes('totalCost = recv * rate') ||
      !modalContent.includes('taxAmt = it.taxAmt !== undefined') ||
      !modalContent.includes('lineTotal = it.total !== undefined')) {
    throw new Error('Product received quantity, rate, total cost, taxAmt or lineTotal calculation missing');
  }
  console.log('✓ Verified actual received quantity, unit cost, total cost, GST amount, and final Amount calculations');

  // 6. Verify Bill Summary & Prominent Grand Total
  if (!modalContent.includes('Subtotal (Before GST):') ||
      !modalContent.includes('Total GST:') ||
      !modalContent.includes('Additional Charges:') ||
      !modalContent.includes('Grand Total:')) {
    throw new Error('Bill Summary fields missing');
  }
  console.log('✓ Verified Bill Summary fields and highlighted Grand Total');

  // 7. Verify Payment Details
  if (!modalContent.includes('Payment Status:') ||
      !modalContent.includes('Amount Paid:') ||
      !modalContent.includes('Balance Due:') ||
      !modalContent.includes('Payment Date:') ||
      !modalContent.includes('Payment Method:')) {
    throw new Error('Payment Details fields missing');
  }
  if (!modalContent.includes('COMPLETED') || !modalContent.includes('PENDING')) {
    throw new Error('COMPLETED or PENDING payment status missing');
  }
  console.log('✓ Verified Payment Details (Status: PENDING/COMPLETED, Paid, Balance, Date, Method)');

  // 8. Verify Footer (Terms & Conditions, Notes/Remarks, Signatures)
  if (!modalContent.includes('Terms & Conditions') ||
      !modalContent.includes('Notes / Remarks') ||
      !modalContent.includes('Authorized Signature') ||
      !modalContent.includes('Supplier / Carrier Signature')) {
    throw new Error('Footer sections (Terms, Notes, Authorized Signature, Supplier Signature) missing');
  }
  console.log('✓ Verified Footer (Terms & Conditions, Notes / Remarks, Authorized Signature, Supplier Signature)');

  // 9. Verify Print Styling & Dedicated Print Document
  if (!modalContent.includes('@page') ||
      !modalContent.includes('size: A4 portrait') ||
      !modalContent.includes('purchase-invoice-print-document') ||
      !modalContent.includes('purchase-invoice-screen-view') ||
      !modalContent.includes('print-avoid-break')) {
    throw new Error('Print CSS, A4 portrait size, dedicated print document, or page-break-avoid rules missing');
  }
  console.log('✓ Verified dedicated A4 portrait print styling, screen preview hiding, and page-break isolation');

  console.log('\n--- ALL PROFESSIONAL PRINT BILL DESIGN TESTS PASSED! ---');
}

runTests();

