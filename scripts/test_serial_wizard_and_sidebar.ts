import fs from 'fs';

function runTests() {
  console.log('--- RUNNING UNIVERSAL BILLING VERIFICATION TESTS ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // TEST 1: Sidebar.tsx does not have Serial Numbers in navigation list
  const sidebarContent = fs.readFileSync('src/components/layout/Sidebar.tsx', 'utf8');
  const hasSerialInInventoryMenu = sidebarContent.includes("{ name: 'Serial Numbers', path: '/inventory/serials'");
  assert(!hasSerialInInventoryMenu, 'Sidebar.tsx does not contain Serial Numbers navigation item');

  // Verify other inventory items in sidebar are preserved
  assert(sidebarContent.includes("name: 'Stock Overview', path: '/inventory'"), 'Stock Overview remains in sidebar');
  assert(!sidebarContent.includes("name: 'Stock Transfers', path: '/inventory/transfers'"), 'Stock Transfers removed from sidebar');
  assert(!sidebarContent.includes("name: 'Stock Adjustments', path: '/inventory/adjustments'"), 'Stock Adjustments removed from sidebar');

  // TEST 2: NewProductPage.tsx has 6 steps with correct order
  const newProductContent = fs.readFileSync('src/pages/products/NewProductPage.tsx', 'utf8');
  assert(newProductContent.includes("title: '1. Basic Information'"), 'Step 1 is Basic Information');
  assert(newProductContent.includes("title: '2. Product Prices'"), 'Step 2 is Product Prices');
  assert(newProductContent.includes("title: '3. Warehouse & Opening Stock Details'"), 'Step 3 is Warehouse & Opening Stock Details');
  assert(newProductContent.includes("title: '4. Batch, Expiry & Serial Details'"), 'Step 4 is Batch, Expiry & Serial Details');
  assert(newProductContent.includes("title: '5. Units & Conversion'"), 'Step 5 is Units & Conversion');
  assert(newProductContent.includes("title: '6. Tax & HSN'"), 'Step 6 is Tax & HSN');

  // TEST 3: Step 4 Subsections A, B, C exist
  assert(newProductContent.includes('A. Batch Details') || newProductContent.includes('Batch Details</h3>'), 'Step 4 contains Subsection A (Batch Details)');
  assert(newProductContent.includes('B. Expiry Details') || newProductContent.includes('Expiry Details</h3>'), 'Step 4 contains Subsection B (Expiry Details)');
  assert(newProductContent.includes('C. Serial Number Details') || newProductContent.includes('Serial Number Details</h3>'), 'Step 4 contains Subsection C (Serial Number Details)');

  // TEST 4: Batch & Expiry logic
  assert(newProductContent.includes('field-batchNumber'), 'Batch Number input field is present');
  assert(newProductContent.includes('field-expiryDate'), 'Expiry Date picker input is present');
  assert(newProductContent.includes('setExpiryPreset(6)'), 'Expiry date preset +6 Months is present');
  assert(newProductContent.includes('setExpiryPreset(12)'), 'Expiry date preset +1 Year is present');
  assert(newProductContent.includes('Auto-Generate Lot') || newProductContent.includes('handleAutoGenerateBatchNumber'), 'Auto-generate batch lot code is present');

  // TEST 5: Serial Number Tracking features
  assert(newProductContent.includes('field-serialTracking'), 'Serial Number tracking toggle is present');
  assert(newProductContent.includes('field-singleSerial'), 'Single serial number input is present');
  assert(newProductContent.includes('field-bulkSerials'), 'Bulk serial number input is present');
  assert(newProductContent.includes('field-warrantyMonths'), 'Warranty months input is present');
  assert(newProductContent.includes('handleAutoGenerateSerials'), 'Auto-generate serial numbers helper is present');
  assert(newProductContent.includes('handleRemoveSerial'), 'Remove serial number chip helper is present');
  assert(newProductContent.includes('handleClearAllSerials'), 'Clear all serial numbers helper is present');

  // TEST 6: Validation logic for Step 4
  assert(newProductContent.includes('if (stepNumber === 4)'), 'validateStep handles Step 4');
  assert(newProductContent.includes('errs.batchNumber ='), 'Batch number required validation is present');
  assert(newProductContent.includes('errs.expiryDate ='), 'Expiry date required validation is present');
  assert(newProductContent.includes('errs.serialNumbers ='), 'Serial number validation is present');

  // TEST 7: Saving serial numbers to product_serial_numbers without altering stock balance
  assert(newProductContent.includes('addSerialNumber({'), 'addSerialNumber called for registered serials');
  assert(newProductContent.includes('warrantyStatus: \'In Stock\''), 'Serial numbers saved with In Stock status');

  // TEST 8: Accessible from Product Detail Quick View and Batch Tracking
  const productListContent = fs.readFileSync('src/pages/products/ProductListPage.tsx', 'utf8');
  assert(productListContent.includes('/inventory/serials'), 'ProductListPage links to /inventory/serials when serialTracking is true');

  const batchPageContent = fs.readFileSync('src/pages/inventory/BatchManagementPage.tsx', 'utf8');
  assert(!batchPageContent.includes('/inventory/serials'), 'BatchManagementPage does not link to /inventory/serials');

  console.log(`\nTests Completed: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
