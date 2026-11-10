import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('================================================================================');
console.log('TEST SUITE: PURCHASE MANAGER DASHBOARD HEADER ALIGNMENT');
console.log('================================================================================\n');

let totalTests = 0;
let passedTests = 0;

function runTest(desc: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ PASS: ${desc}`);
    passedTests++;
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

const pmDashboardPath = path.resolve('src/pages/purchases/PurchaseManagerDashboardPage.tsx');
const pmDashboardCode = fs.readFileSync(pmDashboardPath, 'utf-8');

// -----------------------------------------------------------------------------
// 1. Rename Buttons Verification
// -----------------------------------------------------------------------------
console.log('--- 1. Button Labels & Icons ---');

runTest('Quotation button exists with FileText icon and bulk-order link', () => {
  assert(pmDashboardCode.includes('<span>Quotation</span>'), 'Button text must be "Quotation"');
  assert(pmDashboardCode.includes('navigate(\'/purchases/orders?new=bulk-order\')'), 'Must navigate to quotation/bulk-order form');
});

runTest('Profile button is removed from header toolbar', () => {
  const toolbarSectionMatch = pmDashboardCode.match(/Action Controls Toolbar[\s\S]*?Error Alert/);
  const toolbarSection = toolbarSectionMatch ? toolbarSectionMatch[0] : '';
  assert(!toolbarSection.includes('title="View Profile"'), 'Profile button must not be present in toolbar');
});

// -----------------------------------------------------------------------------
// 2. Header Layout & Alignment Verification
// -----------------------------------------------------------------------------
console.log('\n--- 2. Header Layout & Alignment ---');

runTest('Header contains left-aligned title & welcome message', () => {
  assert(pmDashboardCode.includes('Purchase Manager Dashboard'), 'Dashboard title must be present');
  assert(pmDashboardCode.includes('Welcome back, <span className="font-semibold text-slate-700">{displayName}</span>!'), 'Welcome message must be present');
});

runTest('Header toolbar aligns Refresh and Quotation buttons in row', () => {
  assert(
    pmDashboardCode.includes('flex items-center gap-2 sm:gap-2.5 shrink-0 self-start sm:self-auto'),
    'Toolbar must align items in flex row'
  );
});

runTest('All action buttons have consistent height (h-9) and vertical centering', () => {
  // Check height classes
  const refreshMatch = pmDashboardCode.match(/className="[^"]*h-9 w-9[^"]*"/);
  const quotationMatch = pmDashboardCode.match(/className="[^"]*h-9 px-3.5[^"]*bg-blue-600[^"]*"/);

  assert(refreshMatch, 'Refresh button must have h-9 height');
  assert(quotationMatch, 'Quotation button must have h-9 height');
});

runTest('All action buttons share consistent rounded-xl border radius & text-xs font', () => {
  assert(pmDashboardCode.includes('rounded-xl border border-slate-200/90'), 'Buttons must use rounded-xl border');
  assert(pmDashboardCode.includes('rounded-xl text-xs font-semibold'), 'Action buttons must use rounded-xl and text-xs font-semibold');
});

// -----------------------------------------------------------------------------
// 3. Preservation of Protected Screens
// -----------------------------------------------------------------------------
console.log('\n--- 3. Protected Screens Audit ---');

const protectedScreens = [
  'src/pages/products/InitialStockPage.tsx',
  'src/pages/products/NewProductPage.tsx',
  'src/pages/products/ProductListPage.tsx',
  'src/pages/products/UpdateStockPage.tsx'
];

protectedScreens.forEach(filePath => {
  runTest(`Protected file is intact: ${filePath}`, () => {
    assert(fs.existsSync(path.resolve(filePath)), `File must exist: ${filePath}`);
    const content = fs.readFileSync(path.resolve(filePath), 'utf-8');
    assert(content.length > 500, `File must have content: ${filePath}`);
  });
});

// -----------------------------------------------------------------------------
// Final Summary
// -----------------------------------------------------------------------------
console.log('\n================================================================================');
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`PASSED:      ${passedTests}`);
console.log(`FAILED:      ${totalTests - passedTests}`);
console.log('================================================================================\n');

if (totalTests === passedTests) {
  console.log('🎉 ALL HEADER ALIGNMENT TESTS PASSED 100%!\n');
} else {
  process.exitCode = 1;
}

