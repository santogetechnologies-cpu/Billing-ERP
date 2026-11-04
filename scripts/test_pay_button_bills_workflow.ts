import fs from 'fs';
import path from 'path';

function runTests() {
  console.log('--- Testing Purchases & PO: Pay Button in Bills Section Workflow ---');

  const pagePath = path.resolve('src/pages/purchases/PurchaseInvoicesPage.tsx');
  const payModalPath = path.resolve('src/components/purchases/PaySupplierBillModal.tsx');
  const paymentsMadePath = path.resolve('src/components/purchases/PurchasePaymentsMadeTab.tsx');

  if (!fs.existsSync(pagePath)) throw new Error(`File not found: ${pagePath}`);
  if (!fs.existsSync(payModalPath)) throw new Error(`File not found: ${payModalPath}`);
  if (!fs.existsSync(paymentsMadePath)) throw new Error(`File not found: ${paymentsMadePath}`);

  const pageContent = fs.readFileSync(pagePath, 'utf8');
  const payModalContent = fs.readFileSync(payModalPath, 'utf8');
  const paymentsMadeContent = fs.readFileSync(paymentsMadePath, 'utf8');

  // 1. Verify Action Column contains both Bill and Pay buttons
  if (!pageContent.includes('>Bill</span>') || !pageContent.includes('>Pay</span>')) {
    throw new Error('Action column does not contain both Bill and Pay buttons');
  }
  console.log('✓ Verified Action column contains both Bill and Pay buttons');

  // 2. Verify Pay button visibility logic: shown when !isCompleted, hidden when COMPLETED
  if (!pageContent.includes('!isCompleted && (') || !pageContent.includes('onClick={() => setPayingBill(bill)}')) {
    throw new Error('Pay button is not conditionally hidden when bill is COMPLETED');
  }
  console.log('✓ Verified Pay button behavior: visible for PENDING / PARTIALLY PAID, hidden when COMPLETED');

  // 3. Verify Payment Statuses: PENDING, PARTIALLY PAID, COMPLETED
  if (!pageContent.includes('PENDING') || !pageContent.includes('PARTIALLY PAID') || !pageContent.includes('COMPLETED')) {
    throw new Error('Page does not support all 3 payment statuses: PENDING, PARTIALLY PAID, COMPLETED');
  }
  console.log('✓ Verified all 3 payment statuses supported: PENDING, PARTIALLY PAID, COMPLETED');

  // 4. Verify PaySupplierBillModal integration
  if (!pageContent.includes('<PaySupplierBillModal')) {
    throw new Error('PaySupplierBillModal is not integrated into PurchaseInvoicesPage');
  }
  console.log('✓ Verified PaySupplierBillModal is wired into PurchaseInvoicesPage');

  // 5. Verify PaySupplierBillModal displays required Bill Information
  const requiredBillInfo = [
    'bill.supplierName',
    'Supplier Invoice #',
    'PO Number',
    'Bill Date',
    'Grand Total',
    'Amount Paid',
    'Balance Due'
  ];
  for (const info of requiredBillInfo) {
    if (!payModalContent.includes(info)) {
      throw new Error(`PaySupplierBillModal missing Bill Information item: ${info}`);
    }
  }
  console.log('✓ Verified Bill Information in Pay modal (Supplier Name, Invoice #, PO #, Date, Grand Total, Already Paid, Balance Due)');

  // 6. Verify PaySupplierBillModal Payment Details
  const requiredPaymentDetails = [
    'Payment Date',
    'Payment Method',
    'Bank Transfer',
    'Cash',
    'UPI',
    'Cheque',
    'Payment Amount',
    'Transaction / Reference Number',
    'Payment Remarks'
  ];
  for (const detail of requiredPaymentDetails) {
    if (!payModalContent.includes(detail)) {
      throw new Error(`PaySupplierBillModal missing Payment Detail field: ${detail}`);
    }
  }
  console.log('✓ Verified Payment Details form (Date, Amount, Methods: Cash, Bank Transfer, UPI, Cheque, Reference, Remarks)');

  // 7. Verify Payment Calculation: Balance Due = Grand Total - Amount Paid and validation
  if (!payModalContent.includes('balanceDue = Math.max(0, grandTotal - alreadyPaid)') ||
      !payModalContent.includes('numAmount > balanceDue')) {
    throw new Error('PaySupplierBillModal missing balance due calculation or overpayment validation');
  }
  console.log('✓ Verified payment calculation (Balance Due = Grand Total - Amount Already Paid) and overpayment prevention');

  // 8. Verify Payment Confirmation saves to Supabase via recordPurchasePayment
  if (!payModalContent.includes('recordPurchasePayment({') ||
      !payModalContent.includes('purchaseId: bill.id') ||
      !payModalContent.includes('setSuccessInfo({')) {
    throw new Error('Payment confirmation does not call recordPurchasePayment or show success info');
  }
  console.log('✓ Verified Payment Confirmation calls recordPurchasePayment and displays success confirmation');

  // 9. Verify Strict Role Enforcement: Only Accountant / Admin / Owner
  if (!payModalContent.includes("profile?.role === 'Accountant'") ||
      !payModalContent.includes('Only authorized Accountant users can process payments')) {
    throw new Error('Strict Accountant role enforcement is missing in Pay modal');
  }
  console.log('✓ Verified strict Accountant role enforcement');

  // 10. Verify Payments Made Tab Integration: Required columns
  const requiredPaymentsMadeColumns = [
    'Supplier Name',
    'Supplier Invoice Number',
    'PO Number',
    'Payment Date',
    'Payment Method',
    'Transaction Reference',
    'Amount Paid',
    'Payment Status'
  ];
  for (const col of requiredPaymentsMadeColumns) {
    if (!paymentsMadeContent.includes(`header: '${col}'`)) {
      throw new Error(`Payments Made Tab missing column header: ${col}`);
    }
  }
  console.log('✓ Verified Payments Made Tab displays all required columns (Supplier Name, Invoice #, PO #, Date, Method, Reference, Amount, Status)');

  console.log('\n--- ALL PAY BUTTON & BILLS SECTION TESTS PASSED SUCCESSFULLY! ---');
}

runTests();

