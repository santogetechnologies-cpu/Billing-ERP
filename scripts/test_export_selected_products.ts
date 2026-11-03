import assert from 'assert';

// Mock products as described in the user prompt example:
// - Wire
// - Pipe
// - Glass
// - Base Catalog Item
const sampleProducts = [
  { id: 'prod-wire-1', name: 'Wire', category: 'Electrical', primaryUnit: 'MTR', sellingPrice: 25, currentStock: 100, stockStatus: 'In Stock' },
  { id: 'prod-pipe-2', name: 'Pipe', category: 'Plumbing', primaryUnit: 'PCS', sellingPrice: 150, currentStock: 50, stockStatus: 'In Stock' },
  { id: 'prod-glass-3', name: 'Glass', category: 'Hardware', primaryUnit: 'SQFT', sellingPrice: 200, currentStock: 20, stockStatus: 'Low Stock' },
  { id: 'prod-base-4', name: 'Base Catalog Item', category: 'General', primaryUnit: 'PCS', sellingPrice: 56, currentStock: 10, stockStatus: 'Low Stock' }
];

const columns = [
  { key: 'name', header: 'Product' },
  { key: 'category', header: 'Category' },
  { key: 'primaryUnit', header: 'Base Unit' },
  { key: 'sellingPrice', header: 'Sale Price' },
  { key: 'currentStock', header: 'Stock Level' },
  { key: 'stockStatus', header: 'Status' }
];

// Helper simulating DataTable's exportCSV logic:
function generateCSV(
  data: any[],
  selectedIds: Set<string>,
  columns: any[],
  selectedOnly: boolean
): { headers: string; rows: string[]; csvContent: string } {
  const visibleColumns = new Set(columns.map(c => c.key));
  const activeCols = columns.filter(c => visibleColumns.has(c.key));
  const headers = activeCols.map(c => `"${c.header.replace(/"/g, '""')}"`).join(',');
  
  const targetData = selectedOnly
    ? data.filter(r => selectedIds.has(r.id || JSON.stringify(r)))
    : data;

  const rows = targetData.map(row => {
    return activeCols
      .map(c => {
        const val = row[c.key];
        return `"${String(val ?? '').replace(/"/g, '""')}"`;
      })
      .join(',');
  });

  const csvContent = [headers, ...rows].join('\n');
  return { headers, rows, csvContent };
}

console.log('--- STARTING EXPORT SELECTED TEST SUITE ---');

// Test Case 1: One selected product ("Wire")
{
  const selectedIds = new Set(['prod-wire-1']);
  const result = generateCSV(sampleProducts, selectedIds, columns, true);
  console.log('\n[Test 1] 1 Selected Product ("Wire"):');
  console.log(`Exported rows count: ${result.rows.length}`);
  console.log(`Row content: ${result.rows[0]}`);

  assert.strictEqual(result.rows.length, 1, 'Must export exactly 1 product');
  assert.ok(result.rows[0].includes('"Wire"'), 'Row must be Wire');
  assert.ok(!result.csvContent.includes('"Pipe"'), 'Must NOT export Pipe');
  assert.ok(!result.csvContent.includes('"Glass"'), 'Must NOT export Glass');
  assert.ok(!result.csvContent.includes('"Base Catalog Item"'), 'Must NOT export Base Catalog Item');
  console.log('✓ Test 1 Passed: Exactly 1 selected product exported, unselected products excluded.');
}

// Test Case 2: Two selected products ("Wire" & "Pipe")
{
  const selectedIds = new Set(['prod-wire-1', 'prod-pipe-2']);
  const result = generateCSV(sampleProducts, selectedIds, columns, true);
  console.log('\n[Test 2] 2 Selected Products ("Wire" & "Pipe"):');
  console.log(`Exported rows count: ${result.rows.length}`);

  assert.strictEqual(result.rows.length, 2, 'Must export exactly 2 products');
  assert.ok(result.csvContent.includes('"Wire"'), 'Must include Wire');
  assert.ok(result.csvContent.includes('"Pipe"'), 'Must include Pipe');
  assert.ok(!result.csvContent.includes('"Glass"'), 'Must NOT export Glass');
  assert.ok(!result.csvContent.includes('"Base Catalog Item"'), 'Must NOT export Base Catalog Item');
  console.log('✓ Test 2 Passed: Exactly 2 selected products exported, unselected products excluded.');
}

// Test Case 3: Three selected products ("Wire", "Pipe", "Glass")
{
  const selectedIds = new Set(['prod-wire-1', 'prod-pipe-2', 'prod-glass-3']);
  const result = generateCSV(sampleProducts, selectedIds, columns, true);
  console.log('\n[Test 3] 3 Selected Products ("Wire", "Pipe", "Glass"):');
  console.log(`Exported rows count: ${result.rows.length}`);

  assert.strictEqual(result.rows.length, 3, 'Must export exactly 3 products');
  assert.ok(result.csvContent.includes('"Wire"'), 'Must include Wire');
  assert.ok(result.csvContent.includes('"Pipe"'), 'Must include Pipe');
  assert.ok(result.csvContent.includes('"Glass"'), 'Must include Glass');
  assert.ok(!result.csvContent.includes('"Base Catalog Item"'), 'Must NOT export Base Catalog Item');
  console.log('✓ Test 3 Passed: Exactly 3 selected products exported, unselected products excluded.');
}

// Test Case 4: No products selected
{
  const selectedIds = new Set<string>();
  const result = generateCSV(sampleProducts, selectedIds, columns, true);
  console.log('\n[Test 4] No Products Selected:');
  console.log(`Exported rows count: ${result.rows.length}`);

  assert.strictEqual(result.rows.length, 0, 'Must export exactly 0 products');
  assert.strictEqual(result.csvContent, result.headers, 'CSV must only have header row');
  console.log('✓ Test 4 Passed: 0 products exported when none selected.');
}

// Test Case 5: Normal Export (selectedOnly = false)
{
  const selectedIds = new Set(['prod-wire-1']); // even if 1 is selected in UI
  const result = generateCSV(sampleProducts, selectedIds, columns, false);
  console.log('\n[Test 5] Normal Export (All Products):');
  console.log(`Exported rows count: ${result.rows.length}`);

  assert.strictEqual(result.rows.length, 4, 'Normal export must export all 4 products');
  assert.ok(result.csvContent.includes('"Wire"'));
  assert.ok(result.csvContent.includes('"Pipe"'));
  assert.ok(result.csvContent.includes('"Glass"'));
  assert.ok(result.csvContent.includes('"Base Catalog Item"'));
  console.log('✓ Test 5 Passed: Normal Export preserves exporting all records.');
}

console.log('\n=== ALL 5 EXPORT TEST CASES PASSED SUCCESSFULLY ===');

