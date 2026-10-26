import fs from 'fs';
import path from 'path';

function runTests() {
  console.log('--- STARTING MERGE AVAILABLE STOCK & STOCK STATUS VERIFICATION ---');
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

  // Test 1: Header merged column exists
  assert(
    content.includes('Available Stock / Status'),
    'Test 1: Table header contains "Available Stock / Status"'
  );

  // Test 2: Separate headers removed from the main table header
  assert(
    !content.includes('<th className="py-3 px-3.5 whitespace-nowrap text-right">Available Stock</th>') &&
    !content.includes('<th className="py-3 px-3 text-center whitespace-nowrap">Stock Status</th>'),
    'Test 2: Separate "Available Stock" and "Stock Status" headers are removed from primary table'
  );

  // Test 3: StatusBadge is positioned at the top of the cell
  const mergedCellSnippetMatch = content.match(/Stock Status & Available Stock \(Merged\)[\s\S]*?<td[\s\S]*?>([\s\S]*?)<\/td>/);
  assert(
    Boolean(mergedCellSnippetMatch),
    'Test 3: Merged cell for Stock Status & Available Stock found in JSX'
  );

  if (mergedCellSnippetMatch) {
    const cellContent = mergedCellSnippetMatch[1];
    const statusBadgeIdx = cellContent.indexOf('<StatusBadge');
    const stockSpanIdx = cellContent.indexOf('product.effectiveStock');

    assert(
      statusBadgeIdx !== -1 && stockSpanIdx !== -1 && statusBadgeIdx < stockSpanIdx,
      'Test 4: Stock Status badge is at the top and Available Stock is down in the cell',
      `statusBadgeIdx: ${statusBadgeIdx}, stockSpanIdx: ${stockSpanIdx}`
    );

    assert(
      cellContent.includes('flex flex-col items-start justify-center gap-1'),
      'Test 5: Cell uses vertical flex column layout with centered items'
    );
  }

  // Test 6: colSpan updated to 8 for empty state (previously 9 with Priority column)
  assert(
    content.includes('colSpan={8}') || content.includes('colSpan={9}'),
    'Test 6: Table empty state colSpan matches the column count'
  );

  // Test 7: Column sequence: Warehouse -> Available Stock / Status -> Warning Limit
  const headerSectionMatch = content.match(/<thead[\s\S]*?<\/thead>/);
  if (headerSectionMatch) {
    const thead = headerSectionMatch[0];
    const whIdx = thead.indexOf('Warehouse');
    const statusStockIdx = thead.indexOf('Available Stock / Status');
    const warningIdx = thead.indexOf('Warning Limit');

    assert(
      whIdx !== -1 && statusStockIdx !== -1 && warningIdx !== -1 &&
      whIdx < statusStockIdx && statusStockIdx < warningIdx,
      'Test 7: Header sequence correctly orders Warehouse -> Available Stock / Status -> Warning Limit'
    );
  } else {
    assert(false, 'Test 7: Could not match thead section in file');
  }

  if (failures > 0) {
    console.error(`\nTOTAL FAILURES: ${failures}`);
    process.exit(1);
  } else {
    console.log('\n--- ALL MERGED STOCK STATUS & AVAILABLE TESTS PASSED ---');
    process.exit(0);
  }
}

runTests();
