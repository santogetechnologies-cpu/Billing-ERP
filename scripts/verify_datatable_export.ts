import fs from 'fs';
import assert from 'assert';

const code = fs.readFileSync('src/components/common/DataTable.tsx', 'utf-8');

console.log('Verifying DataTable.tsx changes...');

// 1. Verify exportCSV signature supports selectedOnly
assert.ok(
  code.includes('const exportCSV = (selectedOnly: boolean = false) => {'),
  'exportCSV must accept selectedOnly parameter defaulting to false'
);

// 2. Verify targetData filtering by selectedIds
assert.ok(
  code.includes('const targetData = isSelectedOnly') &&
  code.includes('data.filter(r => selectedIds.has(r.id || JSON.stringify(r)))'),
  'exportCSV must filter data using selectedIds when isSelectedOnly is true'
);

// 3. Verify "Export Selected" button calls exportCSV(true)
assert.ok(
  code.includes('onClick={() => exportCSV(true)}') &&
  code.includes('Export Selected'),
  'Export Selected button must invoke exportCSV(true)'
);

// 4. Verify normal Export dropdown buttons call exportCSV(false)
assert.ok(
  code.includes('onClick={() => exportCSV(false)}') &&
  code.includes('Export CSV') &&
  code.includes('Export Excel'),
  'Normal export dropdown options must invoke exportCSV(false)'
);

console.log('✓ All DataTable export source verifications passed successfully!');

