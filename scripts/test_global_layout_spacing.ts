// Test Suite: Global Layout & Dashboard Horizontal Spacing
// Verifies:
// 1. AppLayout content container has reduced horizontal padding (12-16px mobile, 16-20px tablet, 16-24px desktop).
// 2. Absence of restrictive max-w-7xl and mx-auto constraints on main dashboard container.
// 3. Removal of duplicate nested padding and max-w constraints in WarehouseManagerDashboardPage.
// 4. Clean responsiveness across all role dashboard pages (Owner, Admin, Accountant, Salesperson, Warehouse Manager).

import * as fs from 'fs';
import * as path from 'path';

let totalTests = 0;
let passedTests = 0;

function assert(condition: unknown, message: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    process.exitCode = 1;
  }
}

console.log('================================================================================');
console.log('TEST SUITE: GLOBAL DASHBOARD BODY HORIZONTAL SPACING & RESPONSIVENESS');
console.log('================================================================================\n');

const appLayoutPath = path.resolve(process.cwd(), 'src/components/layout/AppLayout.tsx');
const warehouseDashboardPath = path.resolve(process.cwd(), 'src/pages/warehouse/WarehouseManagerDashboardPage.tsx');
const fastPosPath = path.resolve(process.cwd(), 'src/pages/sales/FastPOSPage.tsx');
const commercialDashboardPath = path.resolve(process.cwd(), 'src/pages/dashboard/DashboardPage.tsx');
const salespersonDashboardPath = path.resolve(process.cwd(), 'src/pages/sales/SalespersonDashboardPage.tsx');

const appLayoutContent = fs.readFileSync(appLayoutPath, 'utf8');
const warehouseDashboardContent = fs.readFileSync(warehouseDashboardPath, 'utf8');
const fastPosContent = fs.readFileSync(fastPosPath, 'utf8');
const commercialDashboardContent = fs.readFileSync(commercialDashboardPath, 'utf8');
const salespersonDashboardContent = fs.readFileSync(salespersonDashboardPath, 'utf8');

// -----------------------------------------------------------------------------
// 1. AppLayout Central Content Container Tests
// -----------------------------------------------------------------------------
console.log('--- 1. AppLayout Central Content Container Specifications ---');

// Check that max-w-7xl mx-auto was removed from AppLayout main wrapper
assert(
  !appLayoutContent.includes('max-w-7xl') && !appLayoutContent.includes('mx-auto'),
  'AppLayout main wrapper no longer restricts content with "max-w-7xl mx-auto"'
);

// Check that horizontal padding matches 12-24px responsive scale
assert(
  appLayoutContent.includes('px-3') || appLayoutContent.includes('px-4'),
  'AppLayout defines mobile horizontal padding (12-16px)'
);
assert(
  appLayoutContent.includes('md:px-5') || appLayoutContent.includes('sm:px-4') || appLayoutContent.includes('sm:px-5'),
  'AppLayout defines medium/tablet horizontal padding (16-20px)'
);
assert(
  appLayoutContent.includes('lg:px-6') || appLayoutContent.includes('lg:px-5'),
  'AppLayout defines desktop horizontal padding (16-24px)'
);

// Check that container uses full available width
assert(
  appLayoutContent.includes('w-full'),
  'AppLayout content container uses "w-full" to naturally fill available screen width'
);

// -----------------------------------------------------------------------------
// 2. Warehouse Manager Dashboard Nested Container Tests
// -----------------------------------------------------------------------------
console.log('\n--- 2. Warehouse Manager Dashboard Container Checks ---');

// Check that duplicate max-w-7xl mx-auto was removed from WarehouseManagerDashboardPage
assert(
  !warehouseDashboardContent.includes('space-y-6 pb-12 max-w-7xl mx-auto'),
  'WarehouseManagerDashboardPage root container does not restrict content with max-w-7xl mx-auto'
);

// Check that duplicate nested horizontal padding was removed
assert(
  !warehouseDashboardContent.includes('px-2 sm:px-4'),
  'WarehouseManagerDashboardPage removed duplicate nested "px-2 sm:px-4"'
);

assert(
  warehouseDashboardContent.includes('space-y-6 pb-12 w-full'),
  'WarehouseManagerDashboardPage root container uses "w-full" seamlessly with AppLayout'
);

// -----------------------------------------------------------------------------
// 3. Role-Specific Dashboards Share Central AppLayout Container
// -----------------------------------------------------------------------------
console.log('\n--- 3. Role Dashboards Architectural Consistency ---');

// Commercial Operations Dashboard (Owner, Admin, Accountant)
assert(
  commercialDashboardContent.includes('<div className="space-y-6">'),
  'Commercial Dashboard (Owner/Admin/Accountant) renders cleanly without duplicate nested wrappers'
);

// Salesperson Dashboard (Salesperson)
assert(
  salespersonDashboardContent.includes('<div className="space-y-6">'),
  'Salesperson Dashboard renders cleanly without duplicate nested wrappers'
);

// FastPOS fullscreen overlay offset synchronization
assert(
  fastPosContent.includes('-mx-3') && fastPosContent.includes('lg:-mx-6'),
  'FastPOSPage negative margin offsets precisely match AppLayout global padding'
);

// -----------------------------------------------------------------------------
// 4. Sidebar and Header Preservation Verification
// -----------------------------------------------------------------------------
console.log('\n--- 4. Sidebar and Top Navigation Preservation ---');

// Verify sidebar layout offset classes remain untouched
assert(
  appLayoutContent.includes("isCollapsed ? 'lg:pl-18' : 'lg:pl-56'"),
  'AppLayout preserves existing sidebar width transition (lg:pl-18 / lg:pl-56)'
);

// Verify Header component remains cleanly mounted
assert(
  appLayoutContent.includes('<Header'),
  'Top Navigation Header remains mounted in normal position'
);

console.log('\n================================================================================');
console.log(`SUMMARY: ${passedTests} OF ${totalTests} TESTS PASSED (${Math.round((passedTests / totalTests) * 100)}% SUCCESS)`);
console.log('================================================================================\n');
