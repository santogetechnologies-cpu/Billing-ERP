import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('================================================================');
console.log('TEST SUITE: REMOVE BATCH CODE & SERIAL PANEL FROM ADD PRODUCT');
console.log('================================================================');

// 1. Read NewProductPage.tsx
const pagePath = path.resolve('src/pages/products/NewProductPage.tsx');
assert(fs.existsSync(pagePath), 'NewProductPage.tsx must exist');
const pageCode = fs.readFileSync(pagePath, 'utf-8');

console.log('\n--- 1. Verification of Panel Removal from Step 3 ---');
assert(
  !pageCode.includes('Batch Code, Expiry &amp; Serial Number Tracking') &&
  !pageCode.includes('Batch Code, Expiry & Serial Number Tracking'),
  'The title "Batch Code, Expiry & Serial Number Tracking" must be removed from Step 3'
);
console.log('  ✓ PASS: Panel title is completely removed');

assert(
  !pageCode.includes('Configured in dedicated <strong>Step 4: Batch, Expiry &amp; Serial Details</strong> directly after warehouse setup.') &&
  !pageCode.includes('Configured in dedicated Step 4'),
  'The description "Configured in dedicated Step 4: Batch, Expiry & Serial Details directly after warehouse setup." must be removed'
);
console.log('  ✓ PASS: Panel description text is completely removed');

assert(
  !pageCode.includes('Configured in Step 4 →'),
  'The button/badge "Configured in Step 4 →" must be removed'
);
console.log('  ✓ PASS: "Configured in Step 4 →" button/badge is completely removed');

assert(
  !pageCode.includes('Step 4 Next Pointer Note'),
  'The comment and container for Step 4 Next Pointer Note must be completely removed'
);
console.log('  ✓ PASS: All related wrapper divs and comments removed');

console.log('\n--- 2. Clean Form Layout & Spacing in Step 3 ---');
// Verify Step 3 ends cleanly after the fields grid
const step3BlockMatch = pageCode.match(/currentStep === 3 && \([\s\S]*?currentStep === 4 && \(/);
assert(step3BlockMatch, 'Step 3 block must be present');
const step3Code = step3BlockMatch[0];

assert(step3Code.includes('id="field-warehouse"'), 'Step 3 retains Warehouse input');
assert(step3Code.includes('id="field-openingStock"'), 'Step 3 retains Opening Stock Quantity input');
assert(step3Code.includes('id="field-stockUnit"'), 'Step 3 retains Stock Unit select');
assert(step3Code.includes('id="field-openingStockValue"'), 'Step 3 retains Opening Stock Value input');
assert(step3Code.includes('id="field-rack"'), 'Step 3 retains Storage Rack input');
assert(step3Code.includes('id="field-reorderLevel"'), 'Step 3 retains Warning Limit input');
console.log('  ✓ PASS: All Step 3 warehouse, stock, rack, and warning limit fields are preserved');

console.log('\n--- 3. Preservation of Dedicated Step 4 & Tracking Functionality ---');
assert(pageCode.includes("key: 'batch_expiry_serial'"), 'Step 4 definition is preserved');
assert(pageCode.includes('id="field-batchNumber"'), 'Step 4 retains Batch Number input');
assert(pageCode.includes('id="field-expiryDate"'), 'Step 4 retains Expiry Date input');
assert(pageCode.includes('id="field-serialTracking"'), 'Step 4 retains Serial Tracking checkbox');
assert(pageCode.includes('handleAutoGenerateSerials'), 'Step 4 retains auto-generate serial numbers');
assert(pageCode.includes('handleAutoGenerateBatchNumber'), 'Step 4 retains auto-generate batch number');
console.log('  ✓ PASS: Dedicated Step 4 configuration and functionality are completely intact');

console.log('\n================================================================');
console.log('ALL REMOVE PANEL VERIFICATION TESTS PASSED (100%)');
console.log('================================================================');
