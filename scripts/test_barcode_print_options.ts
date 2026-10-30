import fs from 'fs';
import path from 'path';

function runTests() {
  console.log('--- Testing Barcode Management Hub Printing Options ---');

  const filePath = path.resolve(process.cwd(), 'src/pages/barcode/BarcodePage.tsx');
  if (!fs.existsSync(filePath)) {
    console.error('FAIL: BarcodePage.tsx not found!');
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  // Check 1: Exactly the "Print Barcode Sticker (Direct)" button is present
  const hasDirectPrintStickerBtn = content.includes('Print Barcode Sticker (Direct)');
  console.log(hasDirectPrintStickerBtn ? 'PASS: "Print Barcode Sticker (Direct)" button is present' : 'FAIL: "Print Barcode Sticker (Direct)" missing');

  // Check 2: Browser Print button / UI control removed
  const hasBrowserPrint = content.includes('<span>Browser Print</span>');
  console.log(!hasBrowserPrint ? 'PASS: "Browser Print" control has been removed' : 'FAIL: "Browser Print" still exists');

  // Check 3: Sheet Print button removed
  const hasSheetPrint = content.includes('<span>Sheet Print</span>');
  console.log(!hasSheetPrint ? 'PASS: "Sheet Print" button has been removed' : 'FAIL: "Sheet Print" still exists');

  // Check 4: Sheet Preview button removed
  const hasSheetPreview = content.includes('<span>Sheet Preview</span>');
  console.log(!hasSheetPreview ? 'PASS: "Sheet Preview" button has been removed' : 'FAIL: "Sheet Preview" still exists');

  // Check 5: Duplicate "Direct Print" button removed
  const hasDuplicateDirectPrint = content.includes('<span>Direct Print</span>');
  console.log(!hasDuplicateDirectPrint ? 'PASS: Duplicate "Direct Print" button in sheet preview has been removed' : 'FAIL: Duplicate "Direct Print" still exists');

  // Check 6: Direct print handler intact and connected
  const hasHandler = content.includes('handleDirectPrintSticker') && content.includes('directPrintService.printBarcodeSticker');
  console.log(hasHandler ? 'PASS: Direct print handler and service integration intact' : 'FAIL: Direct print service integration missing');

  // Check 7: Update Existing Product Barcode feature is preserved
  const hasOption2 = content.includes('Update Existing Product Barcode') && content.includes('handleSaveProductUpdates');
  console.log(hasOption2 ? 'PASS: "Update Existing Product Barcode" feature and form are preserved' : 'FAIL: Option 2 feature missing');

  // Check 8: Barcode generation and label dimension controls preserved
  const hasDimensions = content.includes('labelWidthMm') && content.includes('labelHeightMm') && content.includes('copiesCount');
  console.log(hasDimensions ? 'PASS: Barcode generator dimension & copies controls are preserved' : 'FAIL: Dimension controls missing');

  const allPassed =
    hasDirectPrintStickerBtn &&
    !hasBrowserPrint &&
    !hasSheetPrint &&
    !hasSheetPreview &&
    !hasDuplicateDirectPrint &&
    hasHandler &&
    hasOption2 &&
    hasDimensions;

  if (allPassed) {
    console.log('\nAll 8 verification checks PASSED successfully!');
  } else {
    console.error('\nSome checks FAILED.');
    process.exit(1);
  }
}

runTests();
