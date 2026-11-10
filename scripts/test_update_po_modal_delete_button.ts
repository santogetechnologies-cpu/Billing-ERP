import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('================================================================================');
console.log('TEST SUITE: UPDATE PO MODAL DELETE BUTTON VERIFICATION');
console.log('================================================================================\n');

let totalTests = 0;
let passedTests = 0;

function check(desc: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ PASS: ${desc}`);
    passedTests++;
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

const updateModalPath = path.resolve('src/components/purchases/UpdatePOModal.tsx');
const poTabPath = path.resolve('src/components/purchases/PurchaseOrdersTab.tsx');
const erpContextPath = path.resolve('src/context/ERPContext.tsx');
const servicePath = path.resolve('src/services/purchaseService.ts');

const updateModalCode = fs.readFileSync(updateModalPath, 'utf-8');
const poTabCode = fs.readFileSync(poTabPath, 'utf-8');
const erpContextCode = fs.readFileSync(erpContextPath, 'utf-8');
const serviceCode = fs.readFileSync(servicePath, 'utf-8');

console.log('--- 1. Delete Button Placement Between Cancel and Received ---');

check('UpdatePOModal imports Trash2 icon from lucide-react', () => {
  assert(updateModalCode.includes('Trash2'), 'Trash2 must be imported from lucide-react');
});

check('Delete button exists in bottom right footer between Cancel and Received buttons', () => {
  const footerMatch = updateModalCode.match(/Form Action Buttons[\s\S]*?<\/form>/);
  assert(footerMatch, 'Footer action buttons section must exist');
  const footer = footerMatch[0];

  const cancelIndex = footer.indexOf('Cancel');
  const deleteIndex = footer.indexOf('Delete');
  const receivedIndex = footer.indexOf('Received');

  assert(cancelIndex !== -1, 'Cancel button must exist in footer');
  assert(deleteIndex !== -1, 'Delete button must exist in footer');
  assert(receivedIndex !== -1, 'Received button must exist in footer');

  assert(
    cancelIndex < deleteIndex && deleteIndex < receivedIndex,
    'Delete button must be positioned strictly between Cancel and Received buttons'
  );
});

check('Delete button has appropriate styling with rose/red theme and Trash icon', () => {
  assert(updateModalCode.includes('text-rose-600'), 'Delete button must use rose/red text');
  assert(updateModalCode.includes('<Trash2'), 'Delete button must display Trash2 icon');
  assert(updateModalCode.includes('title="Delete this Purchase Order"'), 'Delete button must include descriptive title');
});

console.log('\n--- 2. Deletion Logic and Confirmation ---');

check('handleDelete prompts for user confirmation before deleting', () => {
  assert(updateModalCode.includes('window.confirm('), 'Must prompt for confirmation before deleting');
  assert(updateModalCode.includes('handleDelete'), 'handleDelete function must exist');
});

check('handleDelete supports onDelete callback, ERPContext deletePurchaseInvoice, and purchaseService fallback', () => {
  assert(updateModalCode.includes('onDelete(po.id)'), 'Must support onDelete callback');
  assert(updateModalCode.includes('deletePurchaseInvoice(po.id)'), 'Must support ERPContext deletePurchaseInvoice');
  assert(updateModalCode.includes('purchaseService.deletePurchaseInvoice(po.id)'), 'Must support purchaseService fallback');
});

console.log('\n--- 3. Context & Service Wiring ---');

check('ERPContext defines and exposes deletePurchaseInvoice', () => {
  assert(erpContextCode.includes('deletePurchaseInvoice: (id: string) => Promise<void>'), 'ERPContextType must declare deletePurchaseInvoice');
  assert(erpContextCode.includes('deletePurchaseInvoice = async (id: string)'), 'ERPContext must implement deletePurchaseInvoice');
  assert(erpContextCode.includes('deletePurchaseInvoice,'), 'ERPContext must provide deletePurchaseInvoice in value');
});

check('purchaseService implements deletePurchaseInvoice with line item and bill cascade', () => {
  assert(serviceCode.includes('async deletePurchaseInvoice(id: string'), 'purchaseService must implement deletePurchaseInvoice');
  assert(serviceCode.includes(".from('purchase_items').delete().eq('purchase_id', id)"), 'Must delete linked line items first');
  assert(serviceCode.includes(".from('purchases')") && serviceCode.includes(".delete()") && serviceCode.includes(".eq('id', id)"), 'Must delete the purchase invoice record');
});

check('PurchaseOrdersTab wires onDelete to deletePurchaseInvoice and closes modal', () => {
  assert(poTabCode.includes('deletePurchaseInvoice'), 'PurchaseOrdersTab must obtain deletePurchaseInvoice from useERP');
  assert(poTabCode.includes('onDelete={async (poId) =>'), 'PurchaseOrdersTab must pass onDelete to UpdatePOModal');
  assert(poTabCode.includes('await deletePurchaseInvoice(poId)'), 'PurchaseOrdersTab must call deletePurchaseInvoice');
  assert(poTabCode.includes('setUpdatingPO(null)'), 'PurchaseOrdersTab must close modal on delete');
});

console.log('\n================================================================================');
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`PASSED:      ${passedTests}`);
console.log(`FAILED:      ${totalTests - passedTests}`);
console.log('================================================================================\n');

if (totalTests === passedTests) {
  console.log('🎉 ALL UPDATE PO MODAL DELETE BUTTON TESTS PASSED 100%!\n');
} else {
  process.exitCode = 1;
}
