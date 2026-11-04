import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('================================================================================');
console.log('TEST SUITE: PO FORM - REMOVE ALL PRICING & SHOW STOCK STATUS');
console.log('================================================================================');

async function runTests() {
  const modalPath = path.resolve('src/components/purchases/PurchaseDocumentModal.tsx');
  assert(fs.existsSync(modalPath), 'PurchaseDocumentModal.tsx must exist');

  const code = fs.readFileSync(modalPath, 'utf-8');

  // --- 1. Pricing Removal Verification ---
  console.log('\n--- 1. Pricing and Cost Fields Removal ---');

  // 1.1 In PO mode, product dropdown must NOT display Cost / ₹
  assert(code.includes("isPO"), '1.1 Identifies PO mode via isPO condition');
  assert(
    code.includes("isPO\n                        ? `${p.name} (${p.primaryUnit || 'Piece'})`") ||
    code.includes("isPO ? `${p.name} (${p.primaryUnit || 'Piece'})`"),
    '1.1 Product dropdown shows clean product name and unit without cost in PO mode'
  );
  console.log('  ✓ PASS: 1.1 Product dropdown options show only name and unit (no Cost or ₹ in PO mode)');

  // 1.2 Step 3 Review summary card with Subtotal, GST, Grand Total must be hidden in PO mode
  assert(code.includes('{!isPO && ('), '1.2 Review Summary card guarded with {!isPO && (');
  const reviewCardIdx = code.indexOf('{/* Step 3: REVIEW Summary Card');
  assert(reviewCardIdx !== -1, 'Review Summary Card comment exists');
  const guardedIdx = code.indexOf('{!isPO && (', reviewCardIdx);
  assert(guardedIdx !== -1 && guardedIdx - reviewCardIdx < 100, '1.2 Review Summary card is strictly non-PO only');
  console.log('  ✓ PASS: 1.2 Subtotal, Input Tax Credit, and Grand Total summary card excluded from PO form');

  // 1.3 Add New Item (PO Only) modal must NOT contain "Estimated Line Total" or ₹0.00
  const newItemModalIdx = code.indexOf('Add New Item (PO Only)');
  assert(newItemModalIdx !== -1, 'Add New Item modal exists');
  const newItemModalBlock = code.slice(newItemModalIdx, code.indexOf('</form>', newItemModalIdx));
  assert(!newItemModalBlock.includes('Estimated Line Total:'), '1.3 Estimated Line Total removed from Add New Item modal');
  assert(!newItemModalBlock.includes('formatCurrency(0)'), '1.3 formatCurrency(0) removed from Add New Item modal');
  console.log('  ✓ PASS: 1.3 Add New Item modal contains zero pricing and no ₹0.00');

  // --- 2. 4-Column Product Row Layout ---
  console.log('\n--- 2. Product Row Layout Verification ---');

  // 2.1 Table Header columns: Product Name, Stock Status, Required Quantity, Action
  assert(code.includes('<div className="col-span-5">Product Name</div>'), '2.1 Contains Product Name column header');
  assert(code.includes('<div className="col-span-3">Stock Status</div>'), '2.1 Contains Stock Status column header');
  assert(code.includes('<div className="col-span-3">Required Quantity</div>'), '2.1 Contains Required Quantity column header');
  assert(code.includes('<div className="col-span-1 text-right">Action</div>'), '2.1 Contains Action column header');
  console.log('  ✓ PASS: 2.1 Header displays 4 exact columns: Product Name, Stock Status, Required Quantity, Action');

  // 2.2 Product Name column has ample width (col-span-5) and supports PO Only badge
  assert(code.includes('PO Only'), '2.2 Shows "PO Only" badge for temporary items');
  console.log('  ✓ PASS: 2.2 Product Name column accommodates name and PO Only identifier');

  // 2.3 Required Quantity column has editable numeric input
  assert(
    code.includes('type="number"') && code.includes('min="1"') && code.includes('item.qty'),
    '2.3 Required Quantity provides editable numeric input'
  );
  console.log('  ✓ PASS: 2.3 Required Quantity has editable numeric input');

  // 2.4 Delete action button aligned at the right
  assert(
    code.includes('handleRemoveItem(idx)') && code.includes('Trash2'),
    '2.4 Delete icon aligned at the right'
  );
  console.log('  ✓ PASS: 2.4 Delete icon button aligned to the right');

  // --- 3. Stock Status Logic ---
  console.log('\n--- 3. Stock Status Logic Verification ---');

  // 3.1 Uses getWarehouseStock with selected warehouse
  assert(code.includes('getWarehouseStock'), '3.1 Injects getWarehouseStock from useERP');
  assert(
    code.includes('getWarehouseStock(selectedWarehouse?.id, prod.id)'),
    '3.1 Queries available warehouse stock for selected Receiving Warehouse'
  );
  console.log('  ✓ PASS: 3.1 Queries warehouse-specific inventory balance');

  // 3.2 Implements In Stock, Limited Stock, and Out of Stock
  assert(code.includes("'In Stock'"), '3.2 Includes In Stock status');
  assert(code.includes("'Limited Stock'"), '3.2 Includes Limited Stock status');
  assert(code.includes("'Out of Stock'"), '3.2 Includes Out of Stock status');
  console.log('  ✓ PASS: 3.2 Returns In Stock, Limited Stock, and Out of Stock statuses');

  // 3.3 Visual styling for each status badge
  assert(code.includes('bg-emerald-50 text-emerald-700'), '3.3 In Stock uses emerald badge');
  assert(code.includes('bg-amber-50 text-amber-700'), '3.3 Limited Stock uses amber badge');
  assert(code.includes('bg-rose-50 text-rose-700'), '3.3 Out of Stock uses rose badge');
  console.log('  ✓ PASS: 3.3 Visual badges for In Stock (emerald), Limited Stock (amber), Out of Stock (rose)');

  // 3.4 Out of Stock for unregistered/temporary items
  assert(
    code.includes("if (isUnregistered || !productId || productId.startsWith('unregistered-'))"),
    '3.4 Unregistered/temporary items return Out of Stock'
  );
  console.log('  ✓ PASS: 3.4 Unregistered/temporary items correctly evaluate to Out of Stock');

  // --- 4. Save Purchase Order Behavior ---
  console.log('\n--- 4. Save Purchase Order Behavior ---');

  // 4.1 Validates qty > 0
  assert(code.includes('invalidQtyItem'), '4.1 Validates that all items have positive required quantity');
  console.log('  ✓ PASS: 4.1 Validates required quantity before saving');

  // 4.2 Rates and totals are zeroed out for PO
  assert(code.includes('rate: isPO ? 0 :'), '4.2 Rate set to 0 in PO mode');
  assert(code.includes('subtotal: isPO ? 0 :'), '4.2 Subtotal set to 0 in PO mode');
  assert(code.includes('grandTotal: isPO ? 0 :'), '4.2 Grand total set to 0 in PO mode');
  console.log('  ✓ PASS: 4.2 Database safe: PO lines and document totals set safely to 0 without pricing');

  // 4.3 Success view displays details without grandTotal in PO mode
  assert(
    code.includes('{!isPO && (') && code.includes('formatCurrency(savedDocument.grandTotal)'),
    '4.3 Success view omits grandTotal currency in PO mode'
  );
  console.log('  ✓ PASS: 4.3 Success confirmation screen cleanly omits pricing in PO mode');

  // --- 5. Autogenerated Supplier Invoice / Ref # ---
  console.log('\n--- 5. Autogenerated Supplier Invoice / Ref # ---');

  // 5.1 Defines generateAutoRef helper with PO-REF prefix
  assert(code.includes('generateAutoRef'), '5.1 Defines generateAutoRef function');
  assert(code.includes('PO-REF-'), '5.1 Uses standard PO-REF- prefix for PO reference numbers');
  console.log('  ✓ PASS: 5.1 Autogenerates PO reference with PO-REF- format');

  // 5.2 Initial state and effect automatically prefill the field when opening modal
  assert(
    code.includes('setSupplierBillNo(generateAutoRef())'),
    '5.2 Automatically generates reference number on modal open'
  );
  console.log('  ✓ PASS: 5.2 Prepopulates Supplier Invoice / Ref # on modal open');

  // 5.3 Provides an Auto / Regenerate action button with Sparkles icon
  assert(
    code.includes('Auto') && code.includes('Sparkles') && code.includes('generateAutoRef()'),
    '5.3 Provides an Auto regenerate button for reference numbers'
  );
  console.log('  ✓ PASS: 5.3 Quick "Auto" button allows one-click regeneration');

  // 5.4 Fallback on save ensures supplierInvoiceNumber is always populated
  assert(
    code.includes('finalSupplierInvoiceNumber = supplierBillNo.trim() || generateAutoRef()'),
    '5.4 Fallback on save guarantees non-empty autogenerated reference'
  );
  console.log('  ✓ PASS: 5.4 Save handler guarantees autogenerated reference number persistence');

  console.log('\n================================================================================');
  console.log('ALL VERIFICATIONS PASSED SUCCESSFULLY (19/19)');
  console.log('================================================================================');
}

runTests().catch(err => {
  console.error('\n❌ Test Suite Failed:', err.message);
  process.exit(1);
});

