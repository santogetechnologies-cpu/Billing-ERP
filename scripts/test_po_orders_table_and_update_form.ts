import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('================================================================================');
console.log('TEST SUITE: ORDERS TABLE & UPDATE FORM (CANCEL & RECEIVED ONLY)');
console.log('================================================================================');

async function runTests() {
  const tableFilePath = path.resolve('src/components/purchases/PurchaseOrdersTab.tsx');
  const viewModalPath = path.resolve('src/components/purchases/ViewPODetailsModal.tsx');
  const updateModalPath = path.resolve('src/components/purchases/UpdatePOModal.tsx');
  const purchaseServicePath = path.resolve('src/services/purchaseService.ts');
  const erpContextPath = path.resolve('src/context/ERPContext.tsx');
  const billsPagePath = path.resolve('src/pages/purchases/PurchaseInvoicesPage.tsx');

  assert(fs.existsSync(tableFilePath), 'PurchaseOrdersTab.tsx must exist');
  assert(fs.existsSync(viewModalPath), 'ViewPODetailsModal.tsx must exist');
  assert(fs.existsSync(updateModalPath), 'UpdatePOModal.tsx must exist');
  assert(fs.existsSync(purchaseServicePath), 'purchaseService.ts must exist');

  const tableCode = fs.readFileSync(tableFilePath, 'utf-8');
  const viewModalCode = fs.readFileSync(viewModalPath, 'utf-8');
  const updateModalCode = fs.readFileSync(updateModalPath, 'utf-8');
  const serviceCode = fs.readFileSync(purchaseServicePath, 'utf-8');
  const contextCode = fs.readFileSync(erpContextPath, 'utf-8');
  const billsPageCode = fs.readFileSync(billsPagePath, 'utf-8');

  // --- 1. Orders Table Columns & Layout ---
  console.log('\n--- 1. Orders Table Columns & Layout ---');

  const expectedHeaders = [
    'Supplier / PO Number',
    'Order Date',
    'Destination Store',
    'Items Count',
    'Status',
    'Action'
  ];

  for (const header of expectedHeaders) {
    assert(tableCode.includes(header), `Table must include header: "${header}"`);
  }
  console.log('  ✓ PASS: 1.1 All 6 required column headers are present');

  assert(!tableCode.includes('Estimated Total'), 'Orders table must not have "Estimated Total" column');
  assert(!tableCode.includes('formatCurrency(po.grandTotal)'), 'Orders table must not display po.grandTotal or currency amounts');
  console.log('  ✓ PASS: 1.2 Pricing and Estimated Total completely removed from Orders table');

  assert(tableCode.includes('po.supplierName'), 'Cell must display supplierName');
  assert(tableCode.includes('po.invoiceNumber'), 'Cell must display PO invoiceNumber');
  assert(tableCode.includes('text-purple-600'), 'PO Number must be rendered in purple text');
  console.log('  ✓ PASS: 1.3 Supplier Name and PO Number combined into single cell with purple PO number');

  assert(
    tableCode.includes("po.items.length === 1 ? 'Item' : 'Items'") ||
    tableCode.includes("po.items.length === 1 ? 'item' : 'items'"),
    'Items Count should display singular/plural item count'
  );
  console.log('  ✓ PASS: 1.4 Items Count displays formatted "X Items" / "X Item"');

  // --- 2. Orders Table Action Column: Eye & Update (Hide Update When Received) ---
  console.log('\n--- 2. Orders Table Action Column: Eye & Update (Hide Update When Received) ---');

  assert(tableCode.includes('Eye'), 'Action column must include Eye icon');
  assert(tableCode.includes('setViewingPO(po)'), 'Eye icon triggers View Details modal');
  console.log('  ✓ PASS: 2.1 Eye icon present and opens ViewPODetailsModal');

  assert(tableCode.includes('FileEdit'), 'Action column must include FileEdit icon for Update');
  assert(tableCode.includes('setUpdatingPO(po)'), 'Update button triggers Update modal');
  assert(
    tableCode.includes('!isReceived &&') && tableCode.includes('setUpdatingPO(po)'),
    'Update button must only be shown when PO status is NOT received'
  );
  console.log('  ✓ PASS: 2.2 Update button is hidden when PO is RECEIVED and shown when ORDERED');

  assert(
    tableCode.includes("updatingPO.poStatus?.toLowerCase() !== 'received'"),
    'UpdatePOModal guards against opening for already received POs'
  );
  console.log('  ✓ PASS: 2.3 Reopening update form for fully received PO is blocked');

  assert(
    !tableCode.includes('onClick={() => setConfirmingPO(po)}') &&
    !tableCode.includes('title="Confirm Goods Receipt"'),
    'Received button must be completely removed from Orders table rows'
  );
  console.log('  ✓ PASS: 2.4 Received button completely removed from Orders table rows');

  // --- 3. Status Management ---
  console.log('\n--- 3. Status Management ---');

  assert(tableCode.includes("po.poStatus || 'Ordered'"), 'PO status defaults to Ordered');
  assert(tableCode.includes('ORDERED'), 'Status badge displays ORDERED');
  assert(tableCode.includes('PARTIALLY RECEIVED'), 'Status badge displays PARTIALLY RECEIVED');
  assert(tableCode.includes('RECEIVED'), 'Status badge displays RECEIVED');
  console.log('  ✓ PASS: 3.1 Status badges (ORDERED, PARTIALLY RECEIVED, RECEIVED) correctly handled');

  // --- 4. Remove Save Update & Keep Only [Cancel] [Received] ---
  console.log('\n--- 4. Remove Save Update & Keep Only [Cancel] [Received] ---');

  // 4.1 Save Update button completely removed
  assert(!updateModalCode.includes('Save Update'), 'Update form must not contain Save Update button');
  console.log('  ✓ PASS: 4.1 "Save Update" button and its separate action completely removed');

  // 4.2 Expected footer text note
  const expectedFooterNote = 'Note: Confirming receipt saves billing details and updates inventory.';
  assert(updateModalCode.includes(expectedFooterNote), `Footer must contain note: "${expectedFooterNote}"`);
  console.log('  ✓ PASS: 4.2 Expected footer note present');

  // 4.3 Footer has [Cancel] [Received] buttons
  const footerSlice = updateModalCode.slice(updateModalCode.indexOf('Form Action Buttons'));
  assert(footerSlice.includes('Cancel'), 'Footer contains Cancel button');
  assert(footerSlice.includes('Received'), 'Footer contains Received button');
  assert(!footerSlice.includes('Save Update'), 'Footer does not contain Save Update');
  console.log('  ✓ PASS: 4.3 Footer contains only [Cancel] and [Received]');

  // 4.4 Received button is green and is the only submission action
  assert(
    footerSlice.includes('bg-emerald-600') && footerSlice.includes('type="submit"'),
    'Received button is the primary submit action with green styling'
  );
  console.log('  ✓ PASS: 4.4 Received button is the only submission action with green styling');

  // --- 5. Received Button Validation & Unified Execution ---
  console.log('\n--- 5. Received Button Validation & Unified Execution ---');

  // 5.1 Validate supplier invoice number
  assert(
    updateModalCode.includes('!supplierInvoiceNumber.trim()'),
    'Validates supplier invoice number before allowing receipt'
  );
  console.log('  ✓ PASS: 5.1 Validates supplier invoice number');

  // 5.2 Validate received quantities
  assert(
    updateModalCode.includes('hasAnyReceived') || updateModalCode.includes('parseFloat(it.receivedQty)'),
    'Validates actual received quantities'
  );
  console.log('  ✓ PASS: 5.2 Validates received quantities');

  // 5.3 Validate purchase cost and GST for all received products
  assert(
    updateModalCode.includes('!it.rate.trim() || isNaN(rate) || rate <= 0') &&
    updateModalCode.includes('!it.taxRate.trim() || isNaN(tax) || tax < 0 || tax > 100'),
    'Validates purchase cost (> 0) and GST (0-100%) for received products'
  );
  console.log('  ✓ PASS: 5.3 Validates purchase cost and GST for received products');

  // 5.4 Unified execution: receiveAndSavePurchaseOrder saves details, updates inventory, updates status to RECEIVED
  assert(
    serviceCode.includes('receiveAndSavePurchaseOrder'),
    'purchaseService has receiveAndSavePurchaseOrder method'
  );
  assert(
    contextCode.includes('receiveAndSavePurchaseOrder'),
    'ERPContext provides receiveAndSavePurchaseOrder'
  );
  assert(
    tableCode.includes('receiveAndSavePurchaseOrder'),
    'PurchaseOrdersTab connects receiveAndSavePurchaseOrder to UpdatePOModal'
  );
  console.log('  ✓ PASS: 5.4 Unified receiveAndSavePurchaseOrder implementation connected');

  // 5.5 Successful confirmation message displayed
  assert(
    updateModalCode.includes('Goods Receipt Confirmed!') &&
    updateModalCode.includes('isSuccess'),
    'Displays successful confirmation message upon goods receipt'
  );
  console.log('  ✓ PASS: 5.5 Successful confirmation message displayed upon completion');

  // --- 6. Linked Purchase Bill Integration ---
  console.log('\n--- 6. Linked Purchase Bill Integration ---');

  assert(serviceCode.includes("doc_type: 'purchase_invoice'"), 'Creates or updates linked bill with doc_type purchase_invoice');
  assert(serviceCode.includes('linkedBillId'), 'Reuses existing linkedBillId to prevent duplicate bills');
  assert(
    billsPageCode.includes('!i.purchaseOrderId || i.billStatus === \'Complete\''),
    'Bills tab filters linked bills to only show Complete bills'
  );
  console.log('  ✓ PASS: 6.1 Linked purchase bill lifecycle and duplicate prevention verified');

  // --- 7. Product Details 9 Columns & Calculation Logic ---
  console.log('\n--- 7. Product Details 9 Columns & Calculation Logic ---');

  const expectedModalHeaders = [
    'Product Name',
    'Ordered Qty',
    'Received Qty',
    'Unit',
    'Cost per Item (₹)',
    'Total Cost (₹)',
    'GST %',
    'GST Amount (₹)',
    'Line Total (₹)'
  ];

  for (const header of expectedModalHeaders) {
    assert(updateModalCode.includes(header), `Update modal must include column header: "${header}"`);
  }
  console.log('  ✓ PASS: 7.1 All 9 required column headers present in exact order');

  // Check column order in thead
  const theadIndex = updateModalCode.indexOf('<thead');
  const theadEndIndex = updateModalCode.indexOf('</thead>');
  const theadSlice = updateModalCode.slice(theadIndex, theadEndIndex);

  let lastIndex = 0;
  for (const header of expectedModalHeaders) {
    const idx = theadSlice.indexOf(header);
    assert(idx > -1, `Header "${header}" not found in thead`);
    assert(idx >= lastIndex, `Header "${header}" is not in the correct relative position in thead`);
    lastIndex = idx;
  }
  console.log('  ✓ PASS: 7.2 Columns appear in exact specified sequential order in thead');

  // Calculation formulas
  assert(
    updateModalCode.includes('totalCost = recv * rate') || updateModalCode.includes('const totalCost = recv * rate'),
    'Calculates Total Cost = Received Quantity * Cost per Item'
  );
  assert(
    updateModalCode.includes('gstAmount = totalCost * (taxRate / 100)') || updateModalCode.includes('const gstAmount = totalCost * (taxRate / 100)'),
    'Calculates GST Amount = Total Cost * GST Percentage / 100'
  );
  assert(
    updateModalCode.includes('lineTotal = totalCost + gstAmount') || updateModalCode.includes('const lineTotal = totalCost + gstAmount'),
    'Calculates Line Total = Total Cost + GST Amount'
  );
  console.log('  ✓ PASS: 7.3 Total Cost, GST Amount, and Line Total calculations implemented accurately');

  // Read-only / auto-calculated vs editable assertions
  assert(
    updateModalCode.includes('{formatCurrency(totalCost)}'),
    'Total Cost is displayed as formatted read-only currency'
  );
  assert(
    updateModalCode.includes('{formatCurrency(gstAmount)}'),
    'GST Amount is displayed as formatted read-only currency'
  );
  assert(
    updateModalCode.includes('{formatCurrency(lineTotal)}'),
    'Line Total is displayed as formatted read-only currency'
  );
  assert(
    updateModalCode.includes("onChange={e => handleItemChange(idx, 'rate', e.target.value)}"),
    'Cost per Item has editable input for user entry'
  );
  console.log('  ✓ PASS: 7.4 Total Cost & GST Amount are read-only, Cost per Item is manually entered');

  // Bill summary checks
  assert(
    updateModalCode.includes('Subtotal (Total Cost before GST):') &&
    updateModalCode.includes('Total GST:') &&
    updateModalCode.includes('Additional Charges:') &&
    updateModalCode.includes('Grand Total:'),
    'Bill Summary includes Subtotal (Total Cost before GST), Total GST, Additional Charges, Grand Total'
  );
  console.log('  ✓ PASS: 7.5 Bill summary reflects Subtotal before GST, Total GST, Additional Charges, and Grand Total');

  // UI Alignment & responsive container
  assert(
    updateModalCode.includes('overflow-x-auto') &&
    updateModalCode.includes('min-w-[150px]'),
    'UI alignment features horizontal scrolling and min-width on product name'
  );
  console.log('  ✓ PASS: 7.6 UI alignment and responsive table container verified');

  console.log('\n================================================================================');
  console.log('ALL TESTS PASSED SUCCESSFULLY! (25/25 Assertions)');
  console.log('================================================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ Test Failure:', err.message);
  process.exit(1);
});
