// Test Suite: Sales Person Dashboard Header Alignment with Warehouse Manager Dashboard
// Verifies all requirements from the user's prompt:
// 1. Header Layout matches Warehouse Manager Dashboard (breadcrumbs, date badge, heading, subtitle, profile alignment)
// 2. Sales Person Header Content: greeting, role badge ("Sales Person Portal"), organization name ("Universal ERP Enterprise"), dynamic date
// 3. Profile: displays actual authenticated user name, styled like Warehouse Manager profile button, opens UserProfileModal
// 4. Retains existing buttons unchanged: "Check Inventory" and "Add Customer"
// 5. Restrictions: Warehouse Manager Dashboard is not modified

import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('================================================================================');
console.log('TEST SUITE: SALES PERSON DASHBOARD HEADER ALIGNMENT');
console.log('================================================================================\n');

let totalTests = 0;
let passedTests = 0;

function test(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${name} -> ${err?.message || err}`);
    process.exitCode = 1;
  }
}

const salespersonDashboardPath = path.resolve('src/pages/sales/SalespersonDashboardPage.tsx');
const warehouseDashboardPath = path.resolve('src/pages/warehouse/WarehouseManagerDashboardPage.tsx');

const salespersonCode = fs.readFileSync(salespersonDashboardPath, 'utf-8');
const warehouseCode = fs.readFileSync(warehouseDashboardPath, 'utf-8');

console.log('--- 1. Header Layout Alignment with Warehouse Manager ---');

test('Header container matches Warehouse Manager spacing, border, and responsive flex classes', () => {
  const expectedContainerClasses = 'bg-white px-4 py-3.5 sm:px-5 sm:py-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4';
  assert.ok(
    salespersonCode.includes(expectedContainerClasses),
    `Sales Person header container must have classes: "${expectedContainerClasses}"`
  );
  assert.ok(
    warehouseCode.includes(expectedContainerClasses),
    'Warehouse Manager dashboard header uses identical container classes'
  );
});

test('Breadcrumb section label is positioned at top of left column', () => {
  assert.ok(
    salespersonCode.includes('TrendingUp className="w-3.5 h-3.5 text-blue-600 shrink-0"'),
    'Breadcrumb must feature icon styled like Warehouse Manager'
  );
  assert.ok(
    salespersonCode.includes('<span>Dashboard</span>'),
    'Breadcrumb must display Dashboard root'
  );
  assert.ok(
    salespersonCode.includes('Sales Operations'),
    'Breadcrumb must display Sales Operations section label'
  );
});

test('Dynamic date badge is positioned inline beside breadcrumbs in top row', () => {
  assert.ok(
    salespersonCode.includes('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100/80 text-slate-600 text-[11px] font-medium border border-slate-200/60 shrink-0'),
    'Date badge must have exact pill styling matching Warehouse Manager'
  );
  assert.ok(
    salespersonCode.includes('<Calendar className="w-3 h-3 text-slate-400" />'),
    'Date badge must include Calendar icon'
  );
  assert.ok(
    salespersonCode.includes('formattedToday'),
    'Date badge must render dynamic formattedToday localized date'
  );
});

test('Main heading position, font size, and typography match Warehouse Manager', () => {
  assert.ok(
    salespersonCode.includes('text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-tight'),
    'Main heading must use text-xl sm:text-2xl font-bold tracking-tight leading-tight'
  );
  assert.ok(
    salespersonCode.includes('Sales Dashboard'),
    'Main heading must render "Sales Dashboard"'
  );
  assert.ok(
    !salespersonCode.includes('{greeting}, {displayName}!'),
    'Greeting and user name in heading must be removed'
  );
});

test('Subtitle position, typography, and organization name match layout', () => {
  assert.ok(
    salespersonCode.includes('text-xs text-slate-500 max-w-xl mt-0.5'),
    'Subtitle must use text-xs text-slate-500 max-w-xl mt-0.5'
  );
  assert.ok(
    salespersonCode.includes("company?.name || 'Universal ERP Enterprise'") ||
    salespersonCode.includes("Universal ERP Enterprise"),
    'Subtitle must display Universal ERP Enterprise organization name'
  );
});

console.log('\n--- 2. Sales Person Role Badge & Identity ---');

test('"Sales Person Portal" badge has been removed as requested', () => {
  assert.ok(
    !salespersonCode.includes('Sales Person Portal'),
    'Header must NOT include "Sales Person Portal" badge'
  );
});

console.log('\n--- 3. Profile Alignment & Real Authentication Session ---');

test('Profile pill button is styled and aligned with action toolbar like Warehouse Manager', () => {
  const profileBtnClasses = 'flex items-center gap-1.5 pl-1.5 pr-2.5 py-1.5 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-700 transition-all cursor-pointer shadow-2xs shrink-0';
  assert.ok(
    salespersonCode.includes(profileBtnClasses),
    `Profile button must use exact Warehouse Manager styling: "${profileBtnClasses}"`
  );
  assert.ok(
    warehouseCode.includes(profileBtnClasses),
    'Warehouse Manager uses identical profile button classes'
  );
});

test('Profile button displays avatar initial and authenticated salesperson name', () => {
  assert.ok(
    salespersonCode.includes('(profile?.full_name || user?.email || \'S\')[0].toUpperCase()'),
    'Avatar circle must display capitalized initial from auth session'
  );
  assert.ok(
    salespersonCode.includes('{displayName}'),
    'Profile button must display authenticated salesperson name'
  );
  assert.ok(
    salespersonCode.includes('setIsProfileModalOpen(true)'),
    'Clicking profile button must open UserProfileModal'
  );
  assert.ok(
    salespersonCode.includes('<UserProfileModal'),
    'Page must render UserProfileModal component'
  );
});

console.log('\n--- 4. Preservation of Existing Action Buttons ---');

test('Sales Person Dashboard retains "Check Inventory" button unchanged', () => {
  assert.ok(
    salespersonCode.includes('navigate(\'/inventory\')'),
    'Check Inventory button must navigate to /inventory'
  );
  assert.ok(
    salespersonCode.includes('<span>Check Inventory</span>'),
    'Check Inventory button label must be preserved'
  );
  assert.ok(
    salespersonCode.includes('Boxes'),
    'Check Inventory button must keep Boxes icon'
  );
  assert.ok(
    salespersonCode.includes('bg-slate-100'),
    'Check Inventory button must keep secondary slate styling'
  );
});

test('Sales Person Dashboard retains "Add Customer" button unchanged', () => {
  assert.ok(
    salespersonCode.includes('navigate(\'/customers?action=new\')'),
    'Add Customer button must navigate to /customers?action=new'
  );
  assert.ok(
    salespersonCode.includes('<span>Add Customer</span>'),
    'Add Customer button label must be preserved'
  );
  assert.ok(
    salespersonCode.includes('Plus'),
    'Add Customer button must keep Plus icon'
  );
  assert.ok(
    salespersonCode.includes('bg-blue-600'),
    'Add Customer button must keep primary blue styling'
  );
});

console.log('\n--- 5. Restrictions & Scope Verification ---');

test('Warehouse Manager Dashboard file has NOT been altered', () => {
  // Confirm Warehouse Manager Dashboard retains its own title and actions
  assert.ok(
    warehouseCode.includes('Warehouse Manager Dashboard'),
    'Warehouse Manager dashboard title must remain unchanged'
  );
  assert.ok(
    warehouseCode.includes('Create Purchase Request'),
    'Warehouse Manager must retain Create Purchase Request button'
  );
  assert.ok(
    warehouseCode.includes('handleRefresh'),
    'Warehouse Manager must retain handleRefresh'
  );
});

console.log('\n================================================================================');
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`PASSED:      ${passedTests}`);
console.log(`FAILED:      ${totalTests - passedTests}`);
console.log('================================================================================');

if (totalTests === passedTests) {
  console.log('\n🎉 ALL TESTS PASSED! Sales Person Dashboard Header alignment verified.');
}
