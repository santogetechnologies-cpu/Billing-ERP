import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('================================================================================');
console.log('TEST SUITE: REPLACE PRINT ICON WITH VIEW (EYE) ICON IN PRODUCTS TABLE');
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

const listContent = fs.readFileSync(path.resolve('src/pages/products/ProductListPage.tsx'), 'utf-8');
const modalContent = fs.readFileSync(path.resolve('src/components/products/ProductMasterModal.tsx'), 'utf-8');

// 1. Actions column has View (Eye) | Edit (Pencil) | Delete (Trash)
test('1. Actions column contains Eye, Edit, Trash icons and NO Print icon', () => {
  const actionsStart = listContent.indexOf("key: 'actions'");
  assert(actionsStart !== -1, 'Actions column definition must exist');
  const actionsBlock = listContent.substring(actionsStart, actionsStart + 1200);

  assert(actionsBlock.includes('<Eye className="w-3.5 h-3.5" />'), 'Actions column must have Eye icon');
  assert(actionsBlock.includes('title="View product details"'), 'Eye icon must have view details title');
  assert(!actionsBlock.includes('<Printer'), 'Actions column must NOT contain Printer icon');
  assert(actionsBlock.includes('<Edit className="w-3.5 h-3.5" />'), 'Actions column must have Edit icon');
  assert(actionsBlock.includes('<Trash2 className="w-3.5 h-3.5" />'), 'Actions column must have Trash2 icon');
});

// 2. Eye icon triggers view mode
test('2. Clicking Eye icon opens product details in view mode', () => {
  assert(listContent.includes('onClick={() => handleViewProduct(p)}'), 'Eye button must call handleViewProduct');
  assert(listContent.includes('setSelectedProductView(product)'), 'handleViewProduct must set selectedProductView');
  assert(
    listContent.includes('productToEdit={selectedProductView || productToEdit}') &&
    listContent.includes('readOnly={Boolean(selectedProductView)}'),
    'ProductMasterModal must be opened with selectedProductView in readOnly mode'
  );
});

// 3. ProductMasterModal prevents accidental edits in readOnly mode
test('3. ProductMasterModal disables inputs and hides save button when readOnly=true', () => {
  assert(modalContent.includes('readOnly?: boolean;'), 'ProductMasterModalProps accepts readOnly');
  assert(modalContent.includes('readOnly = false'), 'readOnly defaults to false');
  assert(modalContent.includes('<fieldset disabled={readOnly}'), 'Form fields are wrapped in disabled fieldset');
  assert(modalContent.includes('View-Only'), 'Header indicates View-Only state');
  assert(!modalContent.includes('disabled={readOnly}>Save Product'), 'Save button is not used in readOnly mode');
  assert(modalContent.includes('Close\n                </button>') || modalContent.includes('Close\r\n                </button>'), 'readOnly mode displays Close button');
});

// 4. Barcode printing functionality preserved elsewhere
test('4. Barcode printing functionality preserved in Barcodes & Labels and directPrintService', () => {
  const barcodePageContent = fs.readFileSync(path.resolve('src/pages/barcode/BarcodePage.tsx'), 'utf-8');
  assert(barcodePageContent.includes('directPrintService'), 'BarcodePage directPrintService preserved');
  const tabContent = fs.readFileSync(path.resolve('src/components/products/ProductLabelsTab.tsx'), 'utf-8');
  assert(tabContent.includes('handlePrintCustomSticker'), 'ProductLabelsTab printing preserved');
});

console.log('\n================================================================================');
console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('================================================================================\n');

if (failed > 0) {
  process.exit(1);
}
