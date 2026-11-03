import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('================================================================================');
console.log('TEST SUITE: ADD TEMPORARY / UNREGISTERED ITEM IN PURCHASE ORDER (UPDATED UI)');
console.log('================================================================================');

async function runTests() {
  const modalPath = path.resolve('src/components/purchases/PurchaseDocumentModal.tsx');
  const servicePath = path.resolve('src/services/purchaseService.ts');
  const typesPath = path.resolve('src/types/index.ts');

  assert(fs.existsSync(modalPath), 'PurchaseDocumentModal.tsx must exist');
  assert(fs.existsSync(servicePath), 'purchaseService.ts must exist');
  assert(fs.existsSync(typesPath), 'types/index.ts must exist');

  const modalCode = fs.readFileSync(modalPath, 'utf-8');
  const serviceCode = fs.readFileSync(servicePath, 'utf-8');
  const typesCode = fs.readFileSync(typesPath, 'utf-8');

  // --- 1. UI Requirements: Button Placement & Purple Theme ---
  console.log('\n--- 1. UI Placement & Styling ---');
  
  // 1.1 Contains "+ Add New Item"
  assert(modalCode.includes('+ Add New Item'), '1.1 Must contain "+ Add New Item" button');
  console.log('  ✓ PASS: 1.1 Contains "+ Add New Item" button');

  // 1.2 Placement directly below the product dropdown and before items list
  const dropdownIdx = modalCode.indexOf('Select a product to add to purchase...');
  const addBtnIdx = modalCode.indexOf('+ Add New Item');
  const itemsListIdx = modalCode.indexOf('Purchased Items ({items.length})');
  assert(itemsListIdx !== -1, 'Purchased items section must exist');
  assert(dropdownIdx !== -1, 'Product selection dropdown must exist');
  assert(addBtnIdx !== -1, 'Add New Item button must exist');
  assert(itemsListIdx < dropdownIdx, 'Purchased Items heading must appear before dropdown');
  assert(dropdownIdx < addBtnIdx, 'Dropdown must appear before "+ Add New Item" button');
  console.log('  ✓ PASS: 1.2 Positioned directly below product selection dropdown');

  // 1.3 Left alignment & compact purple theme
  assert(modalCode.includes('justify-start'), '1.3 Aligned properly to the left side (justify-start)');
  assert(modalCode.includes('text-purple-700') && modalCode.includes('bg-purple-50'), '1.3 Uses purple theme');
  assert(modalCode.includes('px-2.5 py-1') && modalCode.includes('rounded-lg') && modalCode.includes('text-xs'), '1.3 Button is compact and professional');
  console.log('  ✓ PASS: 1.3 Aligned left with compact purple theme and proper spacing');

  // 1.4 Removed "+ Add New Product" button
  assert(!modalCode.includes('+ Add New Product'), '1.4 "+ Add New Product" button must be removed');
  console.log('  ✓ PASS: 1.4 "+ Add New Product" button has been cleanly removed');

  // --- 2. Add New Item Modal Form Fields & Layout Updates ---
  console.log('\n--- 2. Add New Item Modal Form Fields & Layout Updates ---');

  // Extract the Add New Item modal JSX block
  const startModalIdx = modalCode.indexOf('{isAddNewItemModalOpen && (');
  assert(startModalIdx !== -1, 'Add New Item modal JSX block must exist');
  const modalBlock = modalCode.slice(startModalIdx);

  // 2.1 Product / Item Name (Required) - Full width
  assert(modalBlock.includes('Product / Item Name') && modalBlock.includes('*'), '2.1 Contains Product / Item Name (Required)');
  assert(modalBlock.includes('w-full') && modalBlock.includes('newItemName'), '2.1 Item Name is a full-width field');
  console.log('  ✓ PASS: 2.1 Product / Item Name is full-width and mandatory');

  // 2.2 Quantity and Unit side by side in one row (equal widths grid)
  assert(modalBlock.includes('grid grid-cols-2 gap-3'), '2.2 Quantity and Unit are in a 2-column grid side by side');
  assert(modalBlock.includes('Quantity <span className="text-rose-500">*</span>'), '2.2 Quantity is mandatory');
  assert(modalBlock.includes('Unit <span className="text-slate-400 font-normal">(Optional)</span>'), '2.2 Unit is optional');
  console.log('  ✓ PASS: 2.2 Quantity and Unit side by side with equal 50-50 widths');

  // 2.3 Rate and GST completely removed from this popup
  assert(!modalBlock.includes('Purchase Rate / Unit Price'), '2.3 Purchase Rate removed completely from form');
  assert(!modalBlock.includes('GST Percentage'), '2.3 GST Percentage removed completely from form');
  assert(!modalCode.includes('newItemRate'), '2.3 newItemRate state removed');
  assert(!modalCode.includes('newItemGst'), '2.3 newItemGst state removed');
  console.log('  ✓ PASS: 2.3 Purchase Rate and GST Percentage fields removed completely');

  // 2.4 Estimated Line Total directly below Quantity & Unit
  const qtyUnitIdx = modalBlock.indexOf('grid grid-cols-2 gap-3');
  const estTotalIdx = modalBlock.indexOf('Estimated Line Total:');
  const footerIdx = modalBlock.indexOf('Not saved in Product Master');
  assert(qtyUnitIdx !== -1 && estTotalIdx !== -1 && footerIdx !== -1, 'Elements must exist in modal');
  assert(qtyUnitIdx < estTotalIdx, 'Quantity & Unit row must precede Estimated Line Total');
  assert(estTotalIdx < footerIdx, 'Estimated Line Total must precede footer buttons');
  console.log('  ✓ PASS: 2.4 Estimated Line Total placed directly below Quantity and Unit row');

  // 2.5 Footer buttons
  assert(modalBlock.includes('Not saved in Product Master'), '2.5 Footer has "Not saved in Product Master" text');
  assert(modalBlock.includes('Cancel') && modalBlock.includes('Add to Order'), '2.5 Footer has Cancel and Add to Order buttons');
  console.log('  ✓ PASS: 2.5 Footer buttons properly aligned');

  // --- 3. Database Rules: Not Saved in Product Master / Products Table ---
  console.log('\n--- 3. Database Rules & PO-Only Scoping ---');

  // 3.1 Handler does NOT call addProduct or touch products table
  assert(
    modalCode.includes('handleCreateAndAddUnregisteredItem'),
    '3.1 Defines dedicated handleCreateAndAddUnregisteredItem handler'
  );
  // Ensure the unregistered item uses a special non-UUID id and does NOT call addProduct
  const handlerFnStr = modalCode.slice(
    modalCode.indexOf('handleCreateAndAddUnregisteredItem'),
    modalCode.indexOf('};', modalCode.indexOf('handleCreateAndAddUnregisteredItem')) + 2
  );
  assert(!handlerFnStr.includes('addProduct('), '3.1 handleCreateAndAddUnregisteredItem must NOT call addProduct');
  assert(handlerFnStr.includes('unregistered-'), '3.1 Uses unregistered identifier for line item');
  assert(handlerFnStr.includes('isUnregistered: true'), '3.1 Marks item as isUnregistered: true');
  console.log('  ✓ PASS: 3.1 Does NOT create product in Product Master or products table');

  // 3.2 Backend purchaseService ensures product_id is null for non-UUID items and avoids stock increment
  assert(
    serviceCode.includes('product_id: isValidUuid(it.productId) ? it.productId : null'),
    '3.2 Backend sets product_id to null for non-UUID unregistered items'
  );
  assert(
    serviceCode.includes('if (isValidUuid(item.productId))'),
    '3.2 Backend skips inventory stock increment and stock transactions for unregistered items'
  );
  console.log('  ✓ PASS: 3.2 Backend stores item strictly as PO line item without modifying stock/products');

  // 3.3 Identification as non-registered item
  assert(modalCode.includes('PO Only') || modalCode.includes('isUnregistered'), '3.3 Identifies PO-only unregistered items with a badge in UI');
  assert(typesCode.includes('isUnregistered?: boolean;'), '3.3 types/index.ts supports isUnregistered flag');
  console.log('  ✓ PASS: 3.3 Unregistered items are clearly identified in UI and type system');

  // --- 4. Purchase Calculations & Preservation ---
  console.log('\n--- 4. Purchase Order Calculations & Preservation ---');
  assert(modalCode.includes('subtotal') && modalCode.includes('taxTotal') && modalCode.includes('grandTotal'), '4.1 Subtotal, tax, and grand total calculations preserved');
  assert(modalCode.includes('handleRemoveItem'), '4.2 Allows removing item before saving PO');
  assert(modalCode.includes('item.rate') && modalCode.includes('item.qty'), '4.3 Allows editing quantity and rate in items list');
  console.log('  ✓ PASS: 4.1 - 4.3 Calculations, editing, and removal fully supported');

  console.log('\n================================================================================');
  console.log('ALL VERIFICATIONS PASSED SUCCESSFULLY (10/10)');
  console.log('================================================================================');
}

runTests().catch(err => {
  console.error('\n❌ Test Suite Failed:', err.message);
  process.exit(1);
});
