import fs from 'fs';
import path from 'path';

function runTests() {
  console.log('--- STARTING REMOVE SUGGESTED REORDER FROM LOW STOCK & REORDER TEST ---');
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

  const stockAlertsPagePath = path.resolve('src/pages/inventory/StockAlertsPage.tsx');
  const content = fs.readFileSync(stockAlertsPagePath, 'utf8');

  // Test 1: Thead does not contain Suggested Reorder header
  const theadMatch = content.match(/<thead[\s\S]*?<\/thead>/);
  assert(Boolean(theadMatch), 'Test 1: Found thead in StockAlertsPage.tsx');

  if (theadMatch) {
    const thead = theadMatch[0];
    assert(
      !thead.includes('Suggested Reorder') && !thead.includes('suggested-reorder'),
      'Test 2: "Suggested Reorder" column header is removed from the table header'
    );

    assert(
      thead.includes('Product Name') &&
      thead.includes('SKU / Code') &&
      thead.includes('Warehouse') &&
      thead.includes('Stock Status / Available') &&
      thead.includes('Warning Limit') &&
      thead.includes('Actions'),
      'Test 3: Remaining columns (Product Name, SKU / Code, Warehouse, Stock Status / Available, Warning Limit, Actions) are intact'
    );
  }

  // Test 4: Table body rows do not contain the Suggested Reorder cell
  const tbodyMatch = content.match(/<tbody[\s\S]*?<\/tbody>/);
  assert(Boolean(tbodyMatch), 'Test 4: Found tbody in StockAlertsPage.tsx');

  if (tbodyMatch) {
    const tbody = tbodyMatch[0];
    assert(
      !tbody.includes('{/* Suggested Reorder Qty */}') && !tbody.includes('product.suggestedReorderQty > 0'),
      'Test 5: Suggested Reorder cell is removed from table rows'
    );

    assert(
      content.includes('colSpan={7}'),
      'Test 6: Empty state colSpan is updated to 7'
    );
  }

  if (failures > 0) {
    console.error(`\nTOTAL FAILURES: ${failures}`);
    process.exit(1);
  } else {
    console.log('\n--- ALL REMOVE SUGGESTED REORDER TESTS PASSED ---');
    process.exit(0);
  }
}

runTests();
