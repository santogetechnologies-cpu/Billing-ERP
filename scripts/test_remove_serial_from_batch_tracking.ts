import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('================================================================');
console.log('TEST SUITE: REMOVE SERIAL NUMBERS BUTTON FROM BATCH TRACKING');
console.log('================================================================');

// 1. Inspect BatchManagementPage.tsx
const pagePath = path.resolve('src/pages/inventory/BatchManagementPage.tsx');
assert(fs.existsSync(pagePath), 'BatchManagementPage.tsx must exist');
const pageCode = fs.readFileSync(pagePath, 'utf-8');

console.log('\n--- 1. Removal of Serial Numbers Button ---');
assert(
  !pageCode.includes('<span>Serial Numbers</span>'),
  'BatchManagementPage must NOT contain "Serial Numbers" label'
);
assert(
  !pageCode.includes('/inventory/serials'),
  'BatchManagementPage must NOT contain link to /inventory/serials'
);
assert(
  !pageCode.includes('Inspect individual per-unit serialized inventory'),
  'BatchManagementPage must NOT contain serial numbers tooltip'
);
console.log('  ✓ PASS: Serial Numbers button and link completely removed from Batch Tracking');

console.log('\n--- 2. Clean Imports & No Unused References ---');
assert(
  !pageCode.includes("import { Link } from 'react-router-dom';") &&
  !pageCode.includes("from 'react-router-dom'"),
  'Unused Link import from react-router-dom must be removed'
);
assert(
  !pageCode.includes('Hash') &&
  !pageCode.includes('<Hash'),
  'Unused Hash icon from lucide-react must be removed'
);
console.log('  ✓ PASS: Unused Link and Hash icon imports cleanly removed');

console.log('\n--- 3. Retention of Add New Batch & Batch Management ---');
assert(
  pageCode.includes('<span>Add New Batch</span>'),
  'BatchManagementPage retains "Add New Batch" button'
);
assert(
  pageCode.includes('onClick={() => setIsModalOpen(true)}'),
  'Retains modal trigger for Add New Batch'
);
assert(
  pageCode.includes('title="Manufacturing Lots & Batch Registry"'),
  'Retains Batches DataTable title'
);
assert(
  pageCode.includes('title="Register Product Batch"'),
  'Retains batch creation modal'
);
console.log('  ✓ PASS: Add New Batch button, modal, and batch registry table are fully preserved');

console.log('\n--- 4. Integrity of Serial Numbers Page ---');
const serialPagePath = path.resolve('src/pages/inventory/SerialNumbersPage.tsx');
assert(fs.existsSync(serialPagePath), 'SerialNumbersPage.tsx must still exist');
const serialPageCode = fs.readFileSync(serialPagePath, 'utf-8');
assert(
  serialPageCode.includes('title="Serialized Asset Master"'),
  'Serialized Asset Master DataTable preserved'
);
console.log('  ✓ PASS: Serial Numbers tracking page and functionality remain intact');

console.log('\n================================================================');
console.log('ALL REMOVE SERIAL FROM BATCH TRACKING TESTS PASSED (100%)');
console.log('================================================================');
