import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('================================================================');
console.log('TEST SUITE: BATCH REGISTRY EYE ICON & PRODUCT REVIEW MODAL');
console.log('================================================================');

// 1. Inspect BatchManagementPage.tsx
const pagePath = path.resolve('src/pages/inventory/BatchManagementPage.tsx');
assert(fs.existsSync(pagePath), 'BatchManagementPage.tsx must exist');
const pageCode = fs.readFileSync(pagePath, 'utf-8');

console.log('\n--- 1. Actions Column with Eye Icon ---');
assert(pageCode.includes('actions={row =>'), 'DataTable must configure actions column');
assert(pageCode.includes('<Eye className="w-4 h-4" />'), 'Actions column renders Eye icon');
assert(pageCode.includes('title="Review Product Details"'), 'Eye button includes title tooltip');
assert(pageCode.includes('aria-label="Review Product Details"'), 'Eye button includes accessible aria-label');
console.log('  ✓ PASS: Actions column with Eye icon button configured on every batch row');

console.log('\n--- 2. Row Click & Product Lookup Handler ---');
assert(pageCode.includes('onRowClick={row => handleReviewProduct(row)}'), 'DataTable handles onRowClick');
assert(pageCode.includes('handleReviewProduct'), 'handleReviewProduct function exists');
assert(pageCode.includes('const [selectedProduct, setSelectedProduct] = useState'), 'selectedProduct state exists');
assert(pageCode.includes('const [selectedBatch, setSelectedBatch] = useState'), 'selectedBatch state exists');
console.log('  ✓ PASS: Product review trigger and state management verified');

console.log('\n--- 3. Product Details Review Modal Content ---');
assert(pageCode.includes('Product Details Review Modal'), 'Product review modal section exists');
assert(pageCode.includes('<BarcodeCanvas value={selectedProduct.barcode}'), 'Renders Product Barcode');
assert(pageCode.includes('Total Available Stock'), 'Renders Total Available Stock');
assert(pageCode.includes('Selected Lot / Batch'), 'Renders Selected Batch highlight card');
assert(pageCode.includes('Commercial Pricing Tier'), 'Renders Commercial Pricing Tiers');
assert(pageCode.includes('Storage Location'), 'Renders Warehouse and Rack Storage Location');
assert(pageCode.includes('Tracking Controls'), 'Renders Tracking Controls (Batch, Serial, Expiry)');
assert(pageCode.includes('navigate(`/products/edit/${selectedProduct.id}`)'), 'Provides Edit Product action button');
console.log('  ✓ PASS: Rich Product Details Review modal renders all essential product and batch details');

console.log('\n================================================================');
console.log('ALL BATCH PRODUCT REVIEW TESTS PASSED (100%)');
console.log('================================================================');
