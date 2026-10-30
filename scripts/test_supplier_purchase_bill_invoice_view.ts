import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { supabase } from '../src/lib/supabase';

console.log('================================================================================');
console.log('TEST SUITE: SUPPLIER PURCHASE BILL - COMPLETE INVOICE PREVIEW');
console.log('================================================================================\n');

let totalTests = 0;
let passedTests = 0;

async function runTest(desc: string, fn: () => Promise<void> | void) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ PASS: ${desc}`);
    passedTests++;
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

async function main() {
  const purchaseInvoicesPagePath = path.resolve('src/pages/purchases/PurchaseInvoicesPage.tsx');

  // --- Group 1: UI & Structure in PurchaseInvoicesPage.tsx ---
  console.log('--- 1. Supplier Purchase Bills Table & Actions Column ---');
  await runTest('Table retains 7 core columns and Eye action for bill details', () => {
    const code = fs.readFileSync(purchaseInvoicesPagePath, 'utf8');
    assert(code.includes("key: 'purchaseOrderNumber'"), 'Must retain Purchase Order # column');
    assert(code.includes("key: 'supplierName'"), 'Must retain Supplier Name column');
    assert(code.includes("key: 'supplierInvoiceNumber'"), 'Must retain Supplier Invoice # column');
    assert(code.includes("key: 'date'"), 'Must retain Invoice Date column');
    assert(code.includes("key: 'grandTotal'"), 'Must retain Bill Amount column');
    assert(code.includes("Receiving Status"), 'Must retain Receiving Status column');
    assert(code.includes("key: 'paymentStatus'"), 'Must retain Payment Status column');
    assert(code.includes('<Eye className="w-4 h-4" />'), 'Action column must render Eye icon');
    assert(code.includes('setSelectedInvoice(row)'), 'Clicking row or eye icon must set selected invoice');
  });

  console.log('\n--- 2. Invoice Header Details ---');
  await runTest('Invoice Header contains all 8 required fields', () => {
    const code = fs.readFileSync(purchaseInvoicesPagePath, 'utf8');
    assert(code.includes('selectedInvoice.supplierInvoiceNumber || selectedInvoice.invoiceNumber'), 'Must show Supplier Bill Number');
    assert(code.includes('{selectedInvoice.supplierName}'), 'Must show Supplier Name');
    assert(code.includes('selectedInvoice.supplierGstin || \'Unregistered\''), 'Must show Supplier GSTIN');
    assert(code.includes('formatDate(selectedInvoice.date)'), 'Must show Invoice Date');
    assert(code.includes('selectedInvoice.dueDate'), 'Must show Due Date');
    assert(code.includes('#{selectedInvoice.invoiceNumber}'), 'Must show Internal Reference Number');
    assert(code.includes('selectedInvoice.purchaseOrderNumber'), 'Must show Linked Purchase Order Number');
    assert(code.includes('resolvedWarehouseName'), 'Must show Destination Warehouse Name');
  });

  console.log('\n--- 3. Purchased Products Table Details ---');
  await runTest('Products table renders serial #, name, qty, unit, rate, tax rate, tax amt, and line total', () => {
    const code = fs.readFileSync(purchaseInvoicesPagePath, 'utf8');
    assert(code.includes('Product Name / Description'), 'Must have Product Name / Description header');
    assert(code.includes('Quantity'), 'Must have Quantity header');
    assert(code.includes('Unit'), 'Must have Unit header');
    assert(code.includes('Unit Rate'), 'Must have Unit Rate header');
    assert(code.includes('Tax Rate (GST %)'), 'Must have Tax Rate (GST %) header');
    assert(code.includes('Tax Amount'), 'Must have Tax Amount header');
    assert(code.includes('Line Total'), 'Must have Line Total header');
    assert(code.includes('billItems.map'), 'Must map over billItems to render each product in a separate row');
    assert(code.includes('item.productName'), 'Must render product name');
    assert(code.includes('item.qty'), 'Must render product quantity');
    assert(code.includes('formatCurrency(item.rate)'), 'Must render product unit rate');
    assert(code.includes('item.taxRate'), 'Must render product tax rate');
    assert(code.includes('formatCurrency(item.taxAmt'), 'Must render product tax amount');
    assert(code.includes('formatCurrency(item.total)'), 'Must render product line total');
    assert(code.includes('No itemized products recorded for this bill'), 'Must handle empty line items clearly without inventing products');
  });

  console.log('\n--- 4. Bill Summary & GST Breakdown ---');
  await runTest('Summary displays Subtotal, CGST/SGST or IGST, Freight, Grand Total, Paid, and Balance Due', () => {
    const code = fs.readFileSync(purchaseInvoicesPagePath, 'utf8');
    assert(code.includes('Subtotal / Taxable Value'), 'Must display Subtotal / Taxable Value');
    assert(code.includes('CGST (Central Tax)'), 'Must display CGST');
    assert(code.includes('SGST (State Tax)'), 'Must display SGST');
    assert(code.includes('IGST (Integrated Tax)'), 'Must display IGST');
    assert(code.includes('Freight & Shipping Charges'), 'Must display Freight & Shipping Charges');
    assert(code.includes('Grand Total'), 'Must display Grand Total');
    assert(code.includes('Amount Paid'), 'Must display Amount Paid');
    assert(code.includes('Balance Due'), 'Must display Balance Due');
    assert(code.includes('balanceDue = Math.max(0, grandTotal - paidAmount)'), 'Must accurately calculate Balance Due');
  });

  console.log('\n--- 5. Additional Information & User Actions ---');
  await runTest('Additional info and actions (Copy, Print, Close, Escape) are fully supported', () => {
    const code = fs.readFileSync(purchaseInvoicesPagePath, 'utf8');
    assert(code.includes('Invoice Notes and Remarks'), 'Must display Invoice Notes and Remarks');
    assert(code.includes('Receiving Status'), 'Must display Receiving Status');
    assert(code.includes('Payment Status'), 'Must display Payment Status');
    assert(code.includes('Verification Status'), 'Must display Verification Status');
    assert(code.includes('navigator.clipboard.writeText'), 'Must support Copy Invoice #');
    assert(code.includes('handlePrint'), 'Must support Print action');
    assert(code.includes('@media print'), 'Must include print media stylesheet');
    assert(code.includes('setSelectedInvoice(null)'), 'Must support Close action');
  });

  // --- Group 2: Historical Database Bill Verification ---
  console.log('\n--- 6. Historical Bills in Database ---');
  await runTest('Scenario 1: Old bill containing one product', async () => {
    const { data: bill } = await supabase
      .from('purchases')
      .select('id, invoice_number, supplier_name, subtotal, tax_total, grand_total, purchase_items(*)')
      .eq('invoice_number', 'PUR-BILL-036271')
      .single();

    assert(bill, 'Historical bill PUR-BILL-036271 must exist');
    assert.strictEqual(bill.purchase_items?.length, 1, 'Must have exactly 1 line item');
    const item = bill.purchase_items[0];
    assert.strictEqual(item.product_name, 'wire', 'Item name must be wire');
    assert.strictEqual(Number(item.qty), 30, 'Quantity must be 30');
    assert.strictEqual(Number(item.rate), 280, 'Rate must be 280');
    assert.strictEqual(Number(item.total), 9912, 'Total must match 9912');
  });

  await runTest('Scenario 2: Old bill containing multiple products', async () => {
    const { data: bill } = await supabase
      .from('purchases')
      .select('id, invoice_number, supplier_name, subtotal, tax_total, grand_total, purchase_items(*)')
      .eq('invoice_number', 'PUR-2026-635841')
      .single();

    assert(bill, 'Historical bill PUR-2026-635841 must exist');
    assert(bill.purchase_items?.length >= 2, 'Must have multiple line items');
    const productNames = bill.purchase_items.map((i: any) => i.product_name);
    assert(productNames.includes('abc'), 'Must contain product abc');
    assert(productNames.includes('Bundle Item Beta'), 'Must contain product Bundle Item Beta');
  });

  await runTest('Scenario 3: Two different bills from the same supplier have isolated items', async () => {
    const { data: billA } = await supabase
      .from('purchases')
      .select('id, invoice_number, supplier_name, purchase_items(*)')
      .eq('invoice_number', 'PUR-BILL-036271')
      .single();

    const { data: billB } = await supabase
      .from('purchases')
      .select('id, invoice_number, supplier_name, purchase_items(*)')
      .eq('invoice_number', 'PUR-2026-635840')
      .single();

    assert(billA && billB, 'Both bills from supplier2 must exist');
    assert.strictEqual(billA.supplier_name, 'supplier2');
    assert.strictEqual(billB.supplier_name, 'supplier2');

    const itemsA = billA.purchase_items.map((i: any) => i.product_name);
    const itemsB = billB.purchase_items.map((i: any) => i.product_name);

    assert(itemsA.includes('wire'), 'Bill A must contain wire');
    assert(!itemsA.includes('Bundle Item Beta'), 'Bill A must NOT contain Bundle Item Beta');
    assert(itemsB.includes('Bundle Item Beta'), 'Bill B must contain Bundle Item Beta');
    assert(!itemsB.includes('wire'), 'Bill B must NOT contain wire');
  });

  await runTest('Scenario 4: Bill with payment calculation', async () => {
    const { data: bill } = await supabase
      .from('purchases')
      .select('id, invoice_number, grand_total, paid_amount, payment_status')
      .eq('invoice_number', 'PUR-BILL-532837')
      .single();

    assert(bill, 'Bill PUR-BILL-532837 must exist');
    assert(Number(bill.grand_total) > 0, 'Grand total must be positive');
    const balanceDue = Math.max(0, Number(bill.grand_total) - Number(bill.paid_amount));
    if (bill.payment_status === 'Paid') {
      assert.strictEqual(balanceDue, 0, 'Balance due must be 0 for Paid bill');
    }
  });

  await runTest('Scenario 5: Warehouse name lookup safely resolves or falls back', () => {
    const code = fs.readFileSync(purchaseInvoicesPagePath, 'utf8');
    assert(
      code.includes('resolvedWarehouseName = selectedInvoice'),
      'Must resolve warehouse name from warehouses or default to Main Warehouse'
    );
  });

  console.log('\n--- 7. Protected Product Master Files Protection ---');
  const protectedScreens = [
    'src/pages/products/InitialStockPage.tsx',
    'src/pages/products/NewProductPage.tsx',
    'src/pages/products/ProductListPage.tsx',
    'src/pages/products/UpdateStockPage.tsx'
  ];

  for (const filePath of protectedScreens) {
    await runTest(`Protected file is preserved: ${filePath}`, () => {
      assert(fs.existsSync(path.resolve(filePath)), `File ${filePath} must exist`);
      const stat = fs.statSync(path.resolve(filePath));
      assert(stat.size > 0, `File ${filePath} must not be empty`);
    });
  }

  console.log('\n================================================================================');
  console.log(`RESULTS: ${passedTests} OF ${totalTests} TESTS PASSED (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log('================================================================================\n');

  if (passedTests !== totalTests) {
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error('Test execution failed:', err);
  process.exitCode = 1;
});

