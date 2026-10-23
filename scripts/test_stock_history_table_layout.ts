import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('================================================================');
console.log('TEST SUITE: STOCK HISTORY TABLE LAYOUT & SCROLLBAR VERIFICATION');
console.log('================================================================');

// 1. Inspect InventoryDashboardPage.tsx
const pagePath = path.resolve('src/pages/inventory/InventoryDashboardPage.tsx');
assert(fs.existsSync(pagePath), 'InventoryDashboardPage.tsx must exist');
const pageCode = fs.readFileSync(pagePath, 'utf-8');

console.log('\n--- 1. Tab 2 DataTable Horizontal Scrollbar Removal ---');
// Extract the Tab 2 movements section
const tab2Index = pageCode.indexOf("{/* Tab 2: Stock History */}");
assert(tab2Index !== -1, 'Tab 2 Stock History section must exist');
const tab2Section = pageCode.substring(tab2Index, tab2Index + 1600);

assert(
  !tab2Section.includes('minTableWidth="980px"'),
  'Tab 2 DataTable must NOT have hardcoded minTableWidth="980px"'
);
assert(
  tab2Section.includes('hideHorizontalScroll={true}'),
  'Tab 2 DataTable must set hideHorizontalScroll={true} to eliminate horizontal scrollbar'
);
assert(
  tab2Section.includes('tableFixed={true}'),
  'Tab 2 DataTable must set tableFixed={true} for fixed responsive table layout'
);
console.log('  ✓ PASS: minTableWidth="980px" removed, hideHorizontalScroll={true} and tableFixed={true} configured');

console.log('\n--- 2. Responsive Column Width Distribution (100% Total) ---');
// Extract columns definition
const columnsMatch = pageCode.match(/const columns:\s*Column<InventoryTransaction>\[\]\s*=\s*\[([\s\S]*?)\];/);
assert(columnsMatch, 'columns definition for Stock History must exist');
const columnsCode = columnsMatch[1];

// Verify column width percentages
const widthMatches = [...columnsCode.matchAll(/width:\s*['"](\d+)%['"]/g)].map(m => parseInt(m[1], 10));
console.log('  Extracted column widths:', widthMatches);
assert.strictEqual(widthMatches.length, 7, 'Must have exactly 7 percentage-based columns');
const totalWidth = widthMatches.reduce((sum, w) => sum + w, 0);
assert.strictEqual(totalWidth, 100, `Column percentage widths must sum to exactly 100% (got ${totalWidth}%)`);
console.log('  ✓ PASS: All 7 columns have proportional percentage widths summing to exactly 100%');

console.log('\n--- 3. Elimination of Rigid minWidth Constraints ---');
// Verify that rigid minWidths (e.g. 160px, 150px) are removed from columns definition
const minWidthMatches = columnsCode.match(/minWidth:\s*['"]\d+px['"]/g);
assert(
  !minWidthMatches,
  `Columns must NOT contain rigid pixel minWidth constraints that force horizontal overflow (found: ${minWidthMatches})`
);
console.log('  ✓ PASS: Rigid pixel minWidths eliminated so table scales gracefully on all desktop screens');

console.log('\n--- 4. Column Alignment & Vertical Centering ---');
// Check alignment
assert(columnsCode.includes("key: 'date'"), 'Date column exists');
assert(columnsCode.includes("key: 'type'"), 'Type column exists');
assert(columnsCode.includes("key: 'productName'"), 'Product column exists');
assert(columnsCode.includes("key: 'qty'"), 'Movement/Quantity column exists');
assert(columnsCode.includes("key: 'warehouse'"), 'Warehouse column exists');
assert(columnsCode.includes("key: 'referenceDoc'"), 'Reference column exists');
assert(columnsCode.includes("key: 'notes'"), 'Remarks column exists');

// Verify qty column alignment is center
const qtyColMatch = columnsCode.match(/key:\s*'qty'[\s\S]*?align:\s*'center'/);
assert(qtyColMatch, 'Movement/Quantity column must be center-aligned');

// Verify date alignment is left
const dateColMatch = columnsCode.match(/key:\s*'date'[\s\S]*?align:\s*'left'/);
assert(dateColMatch, 'Date column must be left-aligned');

console.log('  ✓ PASS: All columns have consistent alignments (left for text, center for movement quantity)');

console.log('\n--- 5. Long Text Truncation & Hover Tooltips ---');
// Check productName truncation and tooltip
assert(columnsCode.includes('title={row.productName}'), 'Product name provides hover tooltip');
assert(columnsCode.includes('truncate') && columnsCode.includes('row.productName'), 'Product name uses truncate for long names');

// Check warehouse truncation and tooltip
assert(columnsCode.includes('title={wh ? `${wh.name} (${wh.code || \'\'})` : whLabel}'), 'Warehouse provides full name & code tooltip');

// Check referenceDoc truncation and tooltip
assert(columnsCode.includes('title={row.referenceDoc || \'—\'}'), 'Reference provides fallback and tooltip');

// Check notes truncation and tooltip
assert(columnsCode.includes('title={row.notes || \'—\'}'), 'Remarks provides fallback and tooltip');

// Check type badge truncation and tooltip
assert(columnsCode.includes('title={row.type}'), 'Transaction type provides tooltip');

// Check date tooltip
assert(columnsCode.includes('title={formatDate(row.date)}'), 'Date provides formatted tooltip');

console.log('  ✓ PASS: Truncation with informative hover tooltips handles long product names, warehouses, references, and remarks');

console.log('\n--- 6. Preservation of Existing Features & Filtering ---');
assert(tab2Section.includes("searchKeys={['productName', 'warehouse', 'referenceDoc', 'type', 'notes']}"), 'Preserves search keys');
assert(tab2Section.includes("defaultSortKey=\"date\""), 'Preserves default sort key');
assert(tab2Section.includes("defaultSortDir=\"desc\""), 'Preserves default sort dir');
assert(tab2Section.includes("pageSize={10}"), 'Preserves page size');
assert(tab2Section.includes("label: 'Sale'"), 'Preserves Sale filter');
assert(tab2Section.includes("label: 'Purchase'"), 'Preserves Purchase filter');
assert(tab2Section.includes("label: 'Stock Adjustment'"), 'Preserves Stock Adjustment filter');
assert(tab2Section.includes("label: 'Stock Transfer'"), 'Preserves Stock Transfer filter');
console.log('  ✓ PASS: All existing features, sorting, filtering, searching and pagination are preserved');

console.log('\n================================================================');
console.log('ALL STOCK HISTORY TABLE VERIFICATION TESTS PASSED (100%)');
console.log('================================================================');
