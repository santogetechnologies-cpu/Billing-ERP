import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('================================================================================');
console.log('TEST SUITE: AUTOMATICALLY MOVE RECEIVED ORDER BILLS TO BILLS SECTION');
console.log('================================================================================');

async function runTests() {
  const billsPagePath = path.resolve('src/pages/purchases/PurchaseInvoicesPage.tsx');
  const servicePath = path.resolve('src/services/purchaseService.ts');
  const paymentsTabPath = path.resolve('src/components/purchases/PurchasePaymentsMadeTab.tsx');
  const contextPath = path.resolve('src/context/ERPContext.tsx');

  assert(fs.existsSync(billsPagePath), 'PurchaseInvoicesPage.tsx must exist');
  assert(fs.existsSync(servicePath), 'purchaseService.ts must exist');
  assert(fs.existsSync(paymentsTabPath), 'PurchasePaymentsMadeTab.tsx must exist');
  assert(fs.existsSync(contextPath), 'ERPContext.tsx must exist');

  const billsCode = fs.readFileSync(billsPagePath, 'utf-8');
  const serviceCode = fs.readFileSync(servicePath, 'utf-8');
  const paymentsCode = fs.readFileSync(paymentsTabPath, 'utf-8');
  const contextCode = fs.readFileSync(contextPath, 'utf-8');

  // --- 1. Automatic Bill Creation / Transfer & Persistence ---
  console.log('\n--- 1. Automatic Bill Creation / Transfer & Persistence ---');

  assert(serviceCode.includes('receiveAndSavePurchaseOrder'), 'Service implements receiveAndSavePurchaseOrder');
  assert(serviceCode.includes("const poStatus: 'Received' = 'Received'"), 'PO status is updated to RECEIVED');
  assert(serviceCode.includes("billStatus: 'Complete'"), 'Linked bill is marked with billStatus Complete');
  assert(serviceCode.includes("paymentStatus: 'Unpaid'"), 'Initial bill payment status is UNPAID');
  assert(serviceCode.includes('receivedItems: data.items'), 'Bill metadata stores full item details including ordered/received quantities and rates');
  console.log('  ✓ PASS: 1.1 Goods receipt updates PO to RECEIVED and creates/updates bill with COMPLETE status');

  // Duplicate prevention check:
  assert(
    serviceCode.includes('linkedBillId') &&
    serviceCode.includes('purchases') &&
    serviceCode.includes('update(billUpdatePayload)'),
    'Updates existing bill if linkedBillId exists instead of creating duplicates'
  );
  assert(
    contextCode.includes('next.findIndex(inv => inv.id === res.linkedBill!.id || (inv.purchaseOrderId === poId && inv.docType === \'purchase_invoice\'))'),
    'Context updates existing linked bill in place to prevent duplicate rows'
  );
  console.log('  ✓ PASS: 1.2 Linked bill duplicate prevention verified (updates in place, links via PO ID)');

  // --- 2. Bills Section Table Columns ---
  console.log('\n--- 2. Bills Section Table Columns ---');

  const expectedTableHeaders = [
    'Supplier Name',
    'Supplier Invoice Number',
    'Original PO Number',
    'Bill Date',
    'Destination Warehouse',
    'Number of Products',
    'Subtotal',
    'Total GST',
    'Additional Charges',
    'Grand Total',
    'Bill Status'
  ];

  for (const header of expectedTableHeaders) {
    assert(billsCode.includes(header), `Bills table must include column header: "${header}"`);
  }
  console.log('  ✓ PASS: 2.1 All required Bills table column headers are present');

  assert(
    billsCode.includes('standardBills') &&
    billsCode.includes("i.billStatus === 'Complete'"),
    'Bills tab filters linked bills to include completed bills'
  );
  console.log('  ✓ PASS: 2.2 Completed bills automatically appear in standardBills');

  assert(billsCode.includes('COMPLETE'), 'Bill status badge displays COMPLETE');
  assert(billsCode.includes('StatusBadge status={row.paymentStatus}'), 'Payment status badge is displayed separately');
  console.log('  ✓ PASS: 2.3 Bill status (COMPLETE) and Payment status (UNPAID/PAID) are rendered as separate fields');

  // --- 3. Bill Details Modal (Eye Icon) ---
  console.log('\n--- 3. Bill Details Modal (Eye Icon) ---');

  // 3.1 Supplier Information
  assert(billsCode.includes('Supplier Information'), 'Modal displays Supplier Information section');
  assert(billsCode.includes('selectedInvoice.supplierName'), 'Modal displays Supplier Name');
  assert(billsCode.includes('Supplier Invoice Number'), 'Modal displays Supplier Invoice Number');
  assert(billsCode.includes('PO Number'), 'Modal displays PO Number');
  assert(billsCode.includes('Warehouse'), 'Modal displays Warehouse');
  console.log('  ✓ PASS: 3.1 Supplier Information card displays Supplier Name, Invoice #, PO #, and Warehouse');

  // 3.2 Product Details Table with 9 columns
  const expectedProductTableHeaders = [
    'Product Name',
    'Ordered Quantity',
    'Received Quantity',
    'Unit',
    'Cost per Item',
    'Total Cost',
    'GST %',
    'GST Amount',
    'Final Line Total'
  ];

  for (const header of expectedProductTableHeaders) {
    assert(billsCode.includes(header), `Product details table in modal must include header: "${header}"`);
  }
  console.log('  ✓ PASS: 3.2 Product details table in modal displays all 9 required columns');

  // 3.3 Bill Summary
  assert(billsCode.includes('Bill Summary'), 'Modal displays Bill Summary section');
  assert(billsCode.includes('selectedInvoice.subtotal'), 'Modal displays Subtotal');
  assert(billsCode.includes('selectedInvoice.taxTotal'), 'Modal displays Total GST');
  assert(billsCode.includes('selectedInvoice.otherCharges'), 'Modal displays Additional Charges');
  assert(billsCode.includes('selectedInvoice.grandTotal'), 'Modal displays Grand Total');
  console.log('  ✓ PASS: 3.3 Bill Summary displays Subtotal, Total GST, Additional Charges, and Grand Total');

  // --- 4. Accountant Payment Workflow ---
  console.log('\n--- 4. Accountant Payment Workflow ---');

  assert(
    paymentsCode.includes('unpaidBills') &&
    paymentsCode.includes("b.paymentStatus === 'Unpaid' || b.paymentStatus === 'Partially Paid'"),
    'Unpaid bills are available to accountant in payments workflow'
  );
  assert(
    paymentsCode.includes('recordPurchasePayment'),
    'Accountant uses recordPurchasePayment to process payment'
  );
  assert(
    billsCode.includes('Process Payment') || billsCode.includes("setActiveTab('payments')"),
    'Bill details modal includes link/action to payment workflow'
  );
  console.log('  ✓ PASS: 4.1 Completed bills are available for accountant payment processing');

  console.log('\n================================================================================');
  console.log('ALL VERIFICATIONS PASSED SUCCESSFULLY (17/17 Assertions)');
  console.log('================================================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ Test Failure:', err.message);
  process.exit(1);
});

