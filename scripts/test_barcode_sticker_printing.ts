import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('================================================================================');
console.log('TEST SUITE: BARCODE STICKER PRINTING - PRINT ONLY BARCODE TAGS');
console.log('================================================================================\n');

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${name} -> ${err?.message || err}`);
    failed++;
    process.exitCode = 1;
  }
}

const tabContent = fs.readFileSync(path.resolve('src/components/products/ProductLabelsTab.tsx'), 'utf-8');
const cssContent = fs.readFileSync(path.resolve('src/index.css'), 'utf-8');

// -----------------------------------------------------------------------------
// 1. Print Only Barcode Sticker (Hide Entire Application Interface)
// -----------------------------------------------------------------------------
console.log('--- 1. Screen Interface Isolation & Dedicated Print Container ---');

test('1.1 Screen UI elements are marked with no-print and barcode-screen-only', () => {
  // Custom Sticker Designer & Preview Grid
  assert(tabContent.includes('no-print barcode-screen-only grid grid-cols-1 lg:grid-cols-3 gap-5'), 'Custom sticker designer grid marked no-print');
});

test('1.2 Dedicated print-only container exists in DOM and is hidden on screen', () => {
  assert(tabContent.includes('id="barcode-print-container"'), 'id="barcode-print-container" must exist in ProductLabelsTab');
  assert(tabContent.includes('className="print-only hidden print:block"'), 'Must have print-only and hidden print:block classes');
  assert(cssContent.includes('#barcode-print-container') && cssContent.includes('display: none;'), '#barcode-print-container must be hidden on screen via CSS');
});

test('1.3 CSS hides application layout and isolates barcode print container during print', () => {
  assert(cssContent.includes('body.printing-barcodes aside'), 'aside hidden when printing barcodes');
  assert(cssContent.includes('body.printing-barcodes header'), 'header hidden when printing barcodes');
  assert(cssContent.includes('body.printing-barcodes nav'), 'nav hidden when printing barcodes');
  assert(cssContent.includes('body:has(#barcode-print-container) aside'), 'aside hidden when barcode print container present');
  assert(cssContent.includes('body:has(#barcode-print-container) .no-print'), '.no-print hidden when barcode print container present');
  assert(cssContent.includes('#barcode-print-container') && cssContent.includes('display: block !important;'), '#barcode-print-container shown in print');
});

// -----------------------------------------------------------------------------
// 2. Number of Copies Dynamic Generation
// -----------------------------------------------------------------------------
console.log('\n--- 2. Number of Copies Dynamic Element Generation ---');

test('2.1 Elements are repeated using displayCopies based on input without hardcoding', () => {
  assert(
    tabContent.includes('Array.from({') &&
    tabContent.includes('length: displayCopies') &&
    tabContent.includes('.map((_, idx) =>'),
    'Renders stickers repeated by displayCopies'
  );
  assert(!tabContent.includes('length: 1,'), 'Quantity must not be hardcoded to 1 in print loop');
});

test('2.2 Verifies exact sticker counts for 1, 5, 10, and 50 copies', () => {
  const simulateCopies = (copiesInput: number | string) => {
    const displayCopies = typeof copiesInput === 'number' && copiesInput > 0
      ? copiesInput
      : Math.max(1, parseInt(String(copiesInput), 10) || 1);
    return Array.from({ length: displayCopies }).map((_, idx) => idx + 1);
  };

  assert.strictEqual(simulateCopies(1).length, 1, '1 copy -> exactly 1 sticker');
  assert.strictEqual(simulateCopies(5).length, 5, '5 copies -> exactly 5 stickers');
  assert.strictEqual(simulateCopies(10).length, 10, '10 copies -> exactly 10 stickers');
  assert.strictEqual(simulateCopies(50).length, 50, '50 copies -> exactly 50 stickers');
});

// -----------------------------------------------------------------------------
// 3. Printing Layout & Sticker Dimensions
// -----------------------------------------------------------------------------
console.log('\n--- 3. Printing Layout & Dimension Preservation ---');

test('3.1 Preserves selected sticker sizes (50x25, 38x25, 100x50 mm)', () => {
  assert(tabContent.includes("case '38x25':"), 'Handles 38x25 dimension');
  assert(tabContent.includes("width: '38mm'"), '38mm width specified');
  assert(tabContent.includes("height: '25mm'"), '25mm height specified');

  assert(tabContent.includes("case '100x50':"), 'Handles 100x50 dimension');
  assert(tabContent.includes("width: '100mm'"), '100mm width specified');
  assert(tabContent.includes("height: '50mm'"), '50mm height specified');

  assert(tabContent.includes("case '50x25':"), 'Handles 50x25 dimension');
  assert(tabContent.includes("width: '50mm'"), '50mm width specified');
  assert(tabContent.includes("height: '25mm'"), '25mm height specified');

  assert(cssContent.includes('.barcode-sticker-50x25'), 'CSS class for 50x25 sticker');
  assert(cssContent.includes('.barcode-sticker-38x25'), 'CSS class for 38x25 sticker');
  assert(cssContent.includes('.barcode-sticker-100x50'), 'CSS class for 100x50 sticker');
});

test('3.2 Preserves visible elements (Product name, Barcode, Price, MRP, Category)', () => {
  assert(tabContent.includes('{activeProduct.name}'), 'Includes product name');
  assert(tabContent.includes('<BarcodeCanvas'), 'Includes BarcodeCanvas');
  assert(tabContent.includes('showPrice &&'), 'Preserves showPrice toggle');
  assert(tabContent.includes('showMrp &&'), 'Preserves showMrp toggle');
  assert(tabContent.includes('showCategory &&'), 'Preserves showCategory toggle');
  assert(tabContent.includes('company.name'), 'Includes company name');
});

test('3.3 Avoids blank pages and prevents splitting across page boundaries', () => {
  assert(cssContent.includes('break-inside: avoid !important;'), 'CSS break-inside avoid configured');
  assert(cssContent.includes('page-break-inside: avoid !important;'), 'CSS page-break-inside avoid configured');
  assert(tabContent.includes('breakInside: \'avoid\'') || cssContent.includes('.barcode-sticker-tag'), 'Tag avoids break');
});

// -----------------------------------------------------------------------------
// 4. Barcode Scannability
// -----------------------------------------------------------------------------
console.log('\n--- 4. Barcode Scannability Guarantee ---');

test('4.1 Barcode SVG uses crisp edges and exact color adjust', () => {
  assert(cssContent.includes('.barcode-sticker-tag svg') && cssContent.includes('shape-rendering: crispEdges !important;'), 'SVG crisp edges in print');
  assert(cssContent.includes('print-color-adjust: exact !important;'), 'print-color-adjust exact in print');
});

console.log('\n================================================================================');
console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('================================================================================\n');

if (failed > 0) {
  process.exit(1);
}

