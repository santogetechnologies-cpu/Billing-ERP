import fs from 'fs';
import path from 'path';

function runTests() {
  console.log('--- STARTING BARCODE PRINTING & PDF EXPORT VERIFICATION ---');
  let failures = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
    } else {
      console.error(`[FAIL] ${testName}`);
      if (details) console.error(`       Details: ${details}`);
      failures++;
    }
  }

  const cssPath = path.resolve('src/index.css');
  const barcodePagePath = path.resolve('src/pages/barcode/BarcodePage.tsx');
  const barcodeCanvasPath = path.resolve('src/components/barcode/BarcodeCanvas.tsx');

  const cssContent = fs.readFileSync(cssPath, 'utf8');
  const barcodePageContent = fs.readFileSync(barcodePagePath, 'utf8');
  const barcodeCanvasContent = fs.readFileSync(barcodeCanvasPath, 'utf8');

  // Test 1: Global Print Resets in src/index.css
  assert(
    cssContent.includes('html,') &&
    cssContent.includes('#root > div,') &&
    cssContent.includes('#root > div > div,') &&
    cssContent.includes('overflow: visible !important;') &&
    cssContent.includes('max-height: none !important;'),
    'Test 1: Global print stylesheet unconstrains layout wrappers (prevents clipping in Chromium/PDF driver)'
  );

  // Test 2: Print Color Adjust in src/index.css
  assert(
    cssContent.includes('-webkit-print-color-adjust: exact !important;') &&
    cssContent.includes('print-color-adjust: exact !important;'),
    'Test 2: Global print stylesheet forces exact print color adjust for full contrast barcode rendering'
  );

  // Test 3: Screen chrome excluded from print
  assert(
    cssContent.includes('aside,') &&
    cssContent.includes('header,') &&
    cssContent.includes('nav,') &&
    cssContent.includes('.no-print,'),
    'Test 3: Screen chrome (aside, header, nav, .no-print) is hidden globally during print'
  );

  // Test 4: Dedicated Barcode Print Sheet styles in src/index.css
  assert(
    cssContent.includes('#barcode-printable-sheet') &&
    cssContent.includes('.barcode-printable-area') &&
    cssContent.includes('.barcode-printable-grid'),
    'Test 4: Dedicated barcode printable sheet and grid classes defined in index.css'
  );

  // Test 5: Multi-page page-break avoidance for labels
  assert(
    cssContent.includes('break-inside: avoid !important;') &&
    cssContent.includes('page-break-inside: avoid !important;'),
    'Test 5: Label items prevent page breaks inside individual stickers to guarantee smooth multi-page pagination'
  );

  // Test 6: Flex column definitions for reliable Chromium PDF output
  assert(
    cssContent.includes('.barcode-printable-grid.cols-1') &&
    cssContent.includes('.barcode-printable-grid.cols-2') &&
    cssContent.includes('.barcode-printable-grid.cols-3') &&
    cssContent.includes('.barcode-printable-grid.cols-4'),
    'Test 6: Printable sheet defines exact column percentages for 1, 2, 3, and 4 columns'
  );

  // Test 7: BarcodeCanvas pure black fills & crisp edges
  assert(
    barcodeCanvasContent.includes('shapeRendering="crispEdges"') &&
    barcodeCanvasContent.includes('fill="#000000"') &&
    barcodeCanvasContent.includes('WebkitPrintColorAdjust: \'exact\''),
    'Test 7: BarcodeCanvas uses pure black fill (#000000), crispEdges, and inline printColorAdjust'
  );

  // Test 8: BarcodePage printable sheet container & classes
  assert(
    barcodePageContent.includes('id="barcode-printable-sheet"') &&
    barcodePageContent.includes('barcode-printable-grid cols-${columnsCount}') &&
    barcodePageContent.includes('barcode-label-item'),
    'Test 8: BarcodePage sticker sheet uses isolated printable sheet, dynamic grid, and label items'
  );

  // Test 9: BarcodePage handlePrintLabels waits for render and cleans up
  assert(
    barcodePageContent.includes('barcode-printing-active') &&
    barcodePageContent.includes('requestAnimationFrame') &&
    barcodePageContent.includes('afterprint'),
    'Test 9: handlePrintLabels flushes DOM with requestAnimationFrame and manages barcode-printing-active lifecycle'
  );

  // Test 10: Option 2 has Print Labels button to print matched products
  assert(
    barcodePageContent.includes('title="Open in Barcode Generator & Print Sticker Sheet"') &&
    barcodePageContent.includes('Print Labels'),
    'Test 10: Option 2 provides direct Print Labels action for scanned/identified product'
  );

  // Test 11: Label elements display product name, SKU, price, MRP, batch, expiry
  assert(
    barcodePageContent.includes('selectedGenProduct?.name') &&
    barcodePageContent.includes('selectedGenProduct?.sku') &&
    barcodePageContent.includes('selectedGenProduct?.sellingPrice') &&
    barcodePageContent.includes('selectedGenProduct?.mrp') &&
    barcodePageContent.includes('batchNo') &&
    barcodePageContent.includes('expDate'),
    'Test 11: Sticker label includes name, SKU, price, MRP, batch number, and expiry date'
  );

  if (failures > 0) {
    console.error(`\nTOTAL FAILURES: ${failures}`);
    process.exit(1);
  } else {
    console.log('\n--- ALL BARCODE PRINTING & PDF EXPORT TESTS PASSED ---');
    process.exit(0);
  }
}

runTests();
