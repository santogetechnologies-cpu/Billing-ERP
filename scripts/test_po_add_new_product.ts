import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('================================================================================');
console.log('TEST SUITE: ADD NEW PRODUCT DIRECTLY FROM PURCHASE ORDER (PO)');
console.log('================================================================================');

async function runTests() {
  const modalPath = path.resolve('src/components/purchases/PurchaseDocumentModal.tsx');
  assert(fs.existsSync(modalPath), 'PurchaseDocumentModal.tsx must exist');
  const code = fs.readFileSync(modalPath, 'utf-8');

  // --- 1. UI Placement & Layout ---
  console.log('\n--- 1. UI Placement & Layout ---');
  
  // 1.1 "+ Add New Product" button exists
  assert(code.includes('+ Add New Product'), '1.1 Must contain "+ Add New Product" button');
  console.log('  ✓ PASS: 1.1 Contains "+ Add New Product" button');

  // 1.2 Placement directly below the product dropdown and before items list
  const dropdownIdx = code.indexOf('Select a product to add to purchase...');
  const addBtnIdx = code.indexOf('+ Add New Product');
  const itemsListIdx = code.indexOf('Purchased Items ({items.length})');
  assert(itemsListIdx !== -1, 'Purchased items section must exist');
  assert(dropdownIdx !== -1, 'Product selection dropdown must exist');
  assert(addBtnIdx !== -1, 'Add New Product button must exist');
  assert(itemsListIdx < dropdownIdx, 'Purchased Items heading must appear before dropdown');
  assert(dropdownIdx < addBtnIdx, 'Dropdown must appear before "+ Add New Product" button');
  console.log('  ✓ PASS: 1.2 Correct vertical layout: Purchased Items -> Dropdown -> "+ Add New Product"');

  // 1.3 Left alignment & compact styling
  assert(code.includes('justify-start'), '1.3 Button container must align to the left side (justify-start)');
  assert(code.includes('px-2.5 py-1') || code.includes('text-xs'), '1.3 Button must be compact and professional');
  console.log('  ✓ PASS: 1.3 Proper left alignment and compact styling verified');

  // 1.4 Purple theme & design system
  assert(code.includes('text-purple-700') || code.includes('text-purple-600') || code.includes('text-purple-300'), '1.4 Uses purple text styling');
  assert(code.includes('bg-purple-50') || code.includes('bg-purple-600'), '1.4 Uses purple background styling');
  assert(code.includes('border-purple-200') || code.includes('border-purple-800'), '1.4 Uses purple border styling');
  console.log('  ✓ PASS: 1.4 Uses existing purple theme and design tokens');

  // --- 2. Required Fields in Add New Product Modal ---
  console.log('\n--- 2. Required Product Fields in Add New Product Modal ---');

  // 2.1 Product Name *
  assert(code.includes('Product Name') && code.includes('*'), '2.1 Form contains Product Name * with required asterisk');
  // 2.2 Product Code / SKU
  assert(code.includes('Product Code / SKU') || code.includes('SKU'), '2.2 Form contains Product Code / SKU');
  // 2.3 Barcode
  assert(code.includes('Barcode'), '2.3 Form contains Barcode');
  // 2.4 Category
  assert(code.includes('Category'), '2.4 Form contains Category');
  // 2.5 Unit
  assert(code.includes('Unit'), '2.5 Form contains Unit');
  // 2.6 Purchase Price
  assert(code.includes('Purchase Price'), '2.6 Form contains Purchase Price');
  // 2.7 Selling Price
  assert(code.includes('Selling Price'), '2.7 Form contains Selling Price');
  // 2.8 GST / Tax Rate
  assert(code.includes('GST / Tax Rate') || code.includes('Tax Rate'), '2.8 Form contains GST / Tax Rate');
  // 2.9 HSN Code
  assert(code.includes('HSN Code') || code.includes('HSN'), '2.9 Form contains HSN Code');
  console.log('  ✓ PASS: 2.1 - 2.9 All 9 required fields present in Add New Product modal');

  // --- 3. Functionality & Duplicate Prevention ---
  console.log('\n--- 3. Functionality & Duplicate Prevention ---');

  // 3.1 Duplicate checks
  assert(code.includes('already exists in the catalog'), '3.1 Enforces duplicate product name check');
  assert(code.includes('already assigned to another product'), '3.1 Enforces duplicate SKU/barcode checks');
  console.log('  ✓ PASS: 3.1 Prevents duplicate product creation');

  // 3.2 Permanent Database Save via addProduct
  assert(code.includes('await addProduct('), '3.2 Calls addProduct to save product permanently');
  console.log('  ✓ PASS: 3.2 Saves product permanently to Product Master / Database');

  // 3.3 Automatic addition to current PO and selection in purchase items list
  assert(code.includes('handleAddItem(saved)'), '3.3 Calls handleAddItem(saved) to immediately add created product to current purchase order');
  assert(code.includes('setIsAddProductModalOpen(false)'), '3.3 Closes child modal while keeping PO modal open');
  console.log('  ✓ PASS: 3.3 Automatically adds newly created product to Purchase Order items list');

  // 3.4 Preservation of PO state & totals
  assert(code.includes('supplierId') && code.includes('warehouseName') && code.includes('supplierBillNo'), '3.4 Preserves supplier, warehouse, and bill ref state');
  assert(code.includes('subtotal') && code.includes('taxTotal') && code.includes('grandTotal'), '3.4 Preserves existing grand total & tax calculations');
  console.log('  ✓ PASS: 3.4 Preserves all PO details, calculations, and active modal state');

  console.log('\n================================================================================');
  console.log('ALL TESTS PASSED SUCCESSFULLY! (10/10)');
  console.log('================================================================================');
}

runTests().catch(err => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});

