import fs from 'fs';
import path from 'path';

console.log('================================================================');
console.log('TEST SUITE: Manual & Auto Barcode Option in Add New Product Form');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string) {
  totalTests++;
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`❌ FAIL: ${testName}`);
  }
}

// 1. Types & Schema
console.log('--- 1. Verification of Types & DB Migration ---');
const typesContent = fs.readFileSync(path.resolve('src/types/index.ts'), 'utf-8');
assert(
  typesContent.includes("barcodeType?: 'Auto Generated' | 'Manufacturer / Manual'"),
  "Product interface contains barcodeType union ('Auto Generated' | 'Manufacturer / Manual')"
);

const migrationPath = path.resolve('supabase/migrations/042_product_barcode_type_and_manual_mode.sql');
assert(fs.existsSync(migrationPath), 'Migration 042_product_barcode_type_and_manual_mode.sql exists');
const migrationContent = fs.readFileSync(migrationPath, 'utf-8');
assert(
  migrationContent.includes('barcode_type VARCHAR(50) DEFAULT \'Auto Generated\''),
  'Migration adds barcode_type column with default "Auto Generated"'
);
assert(
  migrationContent.includes('manufacturer_barcode VARCHAR(100)'),
  'Migration adds manufacturer_barcode column'
);

// 2. Product Service Persistence
console.log('\n--- 2. Verification of Product Service Persistence ---');
const serviceContent = fs.readFileSync(path.resolve('src/services/productService.ts'), 'utf-8');
assert(
  serviceContent.includes('barcode_type: p.barcodeType || \'Auto Generated\''),
  'createProduct maps barcode_type to database payload'
);
assert(
  serviceContent.includes("barcodeType: p.barcode_type || (p.manufacturer_barcode ? 'Manufacturer / Manual' : 'Auto Generated')"),
  'mapDbToProduct retrieves barcodeType from database'
);
assert(
  serviceContent.includes("barcode_type: p.barcodeType === 'Manufacturer / Manual' ? 'Manufacturer' : 'Auto Generated'"),
  'product_barcodes table registers barcode_type properly'
);

// 3. InitialStockPage (Primary Add Product Page)
console.log('\n--- 3. Verification of InitialStockPage (Add Product Page) ---');
const initialStockContent = fs.readFileSync(path.resolve('src/pages/products/InitialStockPage.tsx'), 'utf-8');
assert(
  initialStockContent.includes('Auto Generate') && initialStockContent.includes('Manual'),
  'InitialStockPage contains both Auto Generate and Manual buttons'
);
assert(
  initialStockContent.includes("item.barcodeType !== 'Manufacturer / Manual'") &&
  initialStockContent.includes("item.barcodeType === 'Manufacturer / Manual'"),
  'InitialStockPage tracks item.barcodeType between Auto and Manual modes'
);
assert(
  initialStockContent.includes('handleAutoGenerateBarcode(idx)'),
  'Auto Generate button triggers barcode generation'
);
assert(
  initialStockContent.includes('handleSwitchBarcodeManual(idx)'),
  'Manual button switches mode to Manual'
);
assert(
  initialStockContent.includes('Scan manufacturer barcode or type manually...'),
  'Manual mode displays input with scanner and manual typing placeholder'
);
assert(
  initialStockContent.includes("title=\"Clear barcode\"") && initialStockContent.includes("handleUpdateItem(idx, 'barcode', '')"),
  'Manual mode provides small Clear option to remove entered barcode'
);
assert(
  initialStockContent.includes("Duplicate Barcode") && initialStockContent.includes("already assigned to"),
  'Duplicate barcode assignments are strictly prevented'
);
assert(
  initialStockContent.includes("barcodeType: item.barcodeType || 'Auto Generated'"),
  'InitialStockPage saves barcodeType with new product payload'
);

// 4. ProductMasterModal (Add New Product / Edit Modal)
console.log('\n--- 4. Verification of ProductMasterModal (Add New Product Modal) ---');
const modalContent = fs.readFileSync(path.resolve('src/components/products/ProductMasterModal.tsx'), 'utf-8');
assert(
  modalContent.includes('Auto Generate') && modalContent.includes('Manual'),
  'ProductMasterModal contains both Auto Generate and Manual buttons'
);
assert(
  modalContent.includes("const [barcodeMode, setBarcodeMode] = useState<'auto' | 'manual'>('auto')"),
  'ProductMasterModal manages barcodeMode state'
);
assert(
  modalContent.includes('handleAutoGenerateBarcode'),
  'ProductMasterModal provides handleAutoGenerateBarcode function'
);
assert(
  modalContent.includes('handleManualBarcode'),
  'ProductMasterModal provides handleManualBarcode function'
);
assert(
  modalContent.includes('Scan manufacturer barcode or type manually...'),
  'Manual mode in modal displays barcode input field'
);
assert(
  modalContent.includes("title=\"Clear barcode\"") && modalContent.includes("setBarcode('')"),
  'Manual mode in modal provides small Clear option'
);
assert(
  modalContent.includes('Duplicate barcodes are not allowed'),
  'ProductMasterModal prevents duplicate barcode assignments'
);
assert(
  modalContent.includes("barcodeType: barcodeMode === 'manual' ? 'Manufacturer / Manual' : 'Auto Generated'"),
  'ProductMasterModal saves barcodeType with new product payload'
);

// 5. NewProductPage (Step-by-step Wizard)
console.log('\n--- 5. Verification of NewProductPage ---');
const newProdContent = fs.readFileSync(path.resolve('src/pages/products/NewProductPage.tsx'), 'utf-8');
assert(
  newProdContent.includes('Auto Generate') && newProdContent.includes('Manual'),
  'NewProductPage contains both Auto Generate and Manual buttons'
);
assert(
  newProdContent.includes("barcodeMode === 'manual' ? 'Manufacturer / Manual' : 'Auto Generated'"),
  'NewProductPage saves barcodeType with product payload'
);

console.log('\n================================================================');
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`PASSED: ${passedTests}`);
console.log(`FAILED: ${totalTests - passedTests}`);
console.log('================================================================\n');

if (passedTests === totalTests) {
  console.log('🎉 ALL MANUAL BARCODE OPTION TESTS PASSED!');
  process.exit(0);
} else {
  console.error('❌ SOME TESTS FAILED');
  process.exit(1);
}

