import fs from 'fs';
import path from 'path';

function runTests() {
  console.log('--- STARTING REMOVE STOCK TRANSFERS FROM WAREHOUSES HEADER TEST ---');
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

  const warehousesPagePath = path.resolve('src/pages/inventory/WarehousesPage.tsx');
  const content = fs.readFileSync(warehousesPagePath, 'utf8');

  // Test 1: Header action buttons section does not contain "Stock Transfers" button
  const headerMatch = content.match(/<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl[\s\S]*?Key Metric Stat Cards/);
  assert(
    Boolean(headerMatch),
    'Test 1: Found Multi-Warehouse Management header section in WarehousesPage.tsx'
  );

  if (headerMatch) {
    const headerContent = headerMatch[0];
    assert(
      !headerContent.includes('Stock Transfers'),
      'Test 2: "Stock Transfers" button is removed from the header section'
    );

    assert(
      headerContent.includes('Refresh Live Balances') && headerContent.includes('Add Warehouse'),
      'Test 3: Refresh button and "Add Warehouse" button are preserved in the header'
    );

    assert(
      headerContent.includes('Multi-Warehouse Management') && headerContent.includes('{warehouses.length} Locations'),
      'Test 4: Multi-Warehouse Management title and Locations count badge are preserved'
    );
  }

  if (failures > 0) {
    console.error(`\nTOTAL FAILURES: ${failures}`);
    process.exit(1);
  } else {
    console.log('\n--- ALL REMOVE STOCK TRANSFERS TESTS PASSED ---');
    process.exit(0);
  }
}

runTests();
