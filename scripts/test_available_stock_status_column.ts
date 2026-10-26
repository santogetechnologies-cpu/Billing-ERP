import * as fs from 'fs';
import * as path from 'path';

console.log('=== Verifying Available Stock / Status Column UI ===\n');

let failures = 0;
const rootDir = process.cwd();

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
  } else {
    console.error(`❌ [FAIL] ${testName}`);
    if (details) console.error(`       Details: ${details}`);
    failures++;
  }
}

// 1. Verify WarehouseManagerDashboardPage.tsx
const whPath = path.join(rootDir, 'src/pages/warehouse/WarehouseManagerDashboardPage.tsx');
const whContent = fs.readFileSync(whPath, 'utf-8');

assert(
  whContent.includes('<span>Available Stock / Status</span>'),
  'WarehouseManagerDashboard: Column header is "Available Stock / Status"'
);

const whCellMatch = whContent.match(/\{\/\* 3\. Available Stock \/ Status \*\/\}[\s\S]*?<td[\s\S]*?>([\s\S]*?)<\/td>/);
assert(Boolean(whCellMatch), 'WarehouseManagerDashboard: Found Available Stock / Status td cell');

if (whCellMatch) {
  const cell = whCellMatch[1];
  assert(
    cell.includes('flex flex-col items-start justify-center gap-1'),
    'WarehouseManagerDashboard: Cell uses vertical stack with items-start and left alignment'
  );

  const outOfStockIdx = cell.indexOf("p.stockStatus === 'Out of Stock'");
  const quantitySpanIdx = cell.indexOf('formatNumber(safeStock)');

  assert(
    outOfStockIdx !== -1 && quantitySpanIdx !== -1 && outOfStockIdx < quantitySpanIdx,
    'WarehouseManagerDashboard: Status badge is on the first line and quantity is directly below on the second line',
    `outOfStockIdx: ${outOfStockIdx}, quantitySpanIdx: ${quantitySpanIdx}`
  );
}

// 2. Verify StockAlertsPage.tsx
const saPath = path.join(rootDir, 'src/pages/inventory/StockAlertsPage.tsx');
const saContent = fs.readFileSync(saPath, 'utf-8');

assert(
  saContent.includes('>Available Stock / Status</th>'),
  'StockAlertsPage: Column header is "Available Stock / Status"'
);

const saCellMatch = saContent.match(/\{\/\* Available Stock \/ Status \(Merged\) \*\/\}[\s\S]*?<td[\s\S]*?>([\s\S]*?)<\/td>/);
assert(Boolean(saCellMatch), 'StockAlertsPage: Found Available Stock / Status td cell');

if (saCellMatch) {
  const cell = saCellMatch[1];
  assert(
    cell.includes('flex flex-col items-start justify-center gap-1'),
    'StockAlertsPage: Cell uses vertical stack with items-start and left alignment'
  );

  const statusBadgeIdx = cell.indexOf('<StatusBadge');
  const quantitySpanIdx = cell.indexOf('product.effectiveStock');

  assert(
    statusBadgeIdx !== -1 && quantitySpanIdx !== -1 && statusBadgeIdx < quantitySpanIdx,
    'StockAlertsPage: Status badge is on the first line and quantity is directly below on the second line',
    `statusBadgeIdx: ${statusBadgeIdx}, quantitySpanIdx: ${quantitySpanIdx}`
  );
}

// 3. Update test_merge_stock_status_available.ts if needed so legacy tests also pass
const legacyPath = path.join(rootDir, 'scripts/test_merge_stock_status_available.ts');
if (fs.existsSync(legacyPath)) {
  let legacyContent = fs.readFileSync(legacyPath, 'utf-8');
  if (legacyContent.includes('Stock Status / Available') || legacyContent.includes('items-center')) {
    legacyContent = legacyContent
      .replace(/Stock Status \/ Available/g, 'Available Stock / Status')
      .replace(/items-center justify-center/g, 'items-start justify-center');
    fs.writeFileSync(legacyPath, legacyContent, 'utf-8');
    console.log('✅ Updated legacy test script to reflect new left-aligned Available Stock / Status header and layout');
  }
}

console.log(`\nVerification finished with ${failures} failure(s).`);
if (failures > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL AVAILABLE STOCK / STATUS COLUMN TESTS PASSED!');
}
