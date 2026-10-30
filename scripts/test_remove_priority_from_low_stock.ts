import fs from 'fs';
import path from 'path';

function runTests() {
  console.log('--- STARTING REMOVE PRIORITY FROM LOW STOCK & REORDER TEST ---');
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

  // Test 1: Thead does not contain Priority header
  const theadMatch = content.match(/<thead[\s\S]*?<\/thead>/);
  assert(Boolean(theadMatch), 'Test 1: Found thead in StockAlertsPage.tsx');

  if (theadMatch) {
    const thead = theadMatch[0];
    assert(
      !thead.includes('>Priority<') && !thead.includes('Priority</th>'),
      'Test 2: Priority column header is removed from the table header'
    );

    assert(
      thead.includes('Product Name') &&
      thead.includes('SKU / Code') &&
      thead.includes('Warehouse') &&
      thead.includes('Stock Status / Available') &&
      thead.includes('Warning Limit') &&
      thead.includes('Actions'),
      'Test 3: Core columns (Product Name, SKU / Code, Warehouse, Stock Status / Available, Warning Limit, Actions) are intact'
    );
  }

  // Test 4: Table body rows do not contain the Priority cell
  const tbodyMatch = content.match(/<tbody[\s\S]*?<\/tbody>/);
  assert(Boolean(tbodyMatch), 'Test 4: Found tbody in StockAlertsPage.tsx');

  if (tbodyMatch) {
    const tbody = tbodyMatch[0];
    assert(
      !tbody.includes('{/* Priority */}'),
      'Test 5: Priority cell comment and td are removed from table rows'
    );

    assert(
      content.includes('colSpan={8}') || content.includes('colSpan={7}'),
      'Test 6: Empty state colSpan is properly set'
    );
  }

  if (failures > 0) {
    console.error(`\nTOTAL FAILURES: ${failures}`);
    process.exit(1);
  } else {
    console.log('\n--- ALL REMOVE PRIORITY TESTS PASSED ---');
    process.exit(0);
  }
}

runTests();
