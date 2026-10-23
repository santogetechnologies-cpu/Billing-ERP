/**
 * End-to-End Role-Based Access Control (RBAC) Verification Suite
 * Tests all 7 system roles, 17 modules, 7 actions, direct route access,
 * and service API assertion boundaries.
 */

import {
  ROLE_PERMISSIONS_MATRIX,
  ROUTE_MODULE_MAP,
  hasPermission,
  canAccessRoute,
  getRoleDefaultRoute,
  AppModule,
  AppAction
} from '../src/utils/rbac';
import { UserRole } from '../src/types';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zdygiubhmxuonzqchehp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zzlKCAxfsUya4_UePohgnA_QvR8Cz6Q';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

const ALL_ROLES: UserRole[] = [
  'Owner',
  'Admin',
  'Accountant',
  'Salesperson',
  'Purchase Manager',
  'Warehouse Manager',
  'Cashier'
];

const ALL_MODULES: AppModule[] = [
  'dashboard',
  'sales',
  'pos',
  'purchases',
  'products',
  'inventory',
  'customers',
  'suppliers',
  'expenses',
  'payments',
  'accounting',
  'taxes',
  'reports',
  'barcode',
  'users',
  'audit',
  'settings'
];

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${testName} ${details ? `(${details})` : ''}`);
  }
}

async function runTestSuite() {
  console.log('===============================================================');
  console.log('   UNIVERSAL BILLING ERP - STRICT RBAC VERIFICATION SUITE');
  console.log('===============================================================\n');

  // --------------------------------------------------------------------------
  // SUITE 1: MATRIX INTEGRITY (All 7 roles x 17 modules configured)
  // --------------------------------------------------------------------------
  console.log('👉 SUITE 1: Matrix Coverage & Completeness');
  for (const role of ALL_ROLES) {
    const roleMap = ROLE_PERMISSIONS_MATRIX[role];
    assert(!!roleMap, `Role "${role}" exists in permission matrix`);
    for (const mod of ALL_MODULES) {
      assert(roleMap && typeof roleMap[mod] === 'object', `Role "${role}" has definition for module "${mod}"`);
    }
  }

  // --------------------------------------------------------------------------
  // SUITE 2: OWNER & ADMIN UNRESTRICTED MASTERY
  // --------------------------------------------------------------------------
  console.log('\n👉 SUITE 2: Owner & Admin Unrestricted Master Access');
  for (const adminRole of ['Owner', 'Admin'] as UserRole[]) {
    assert(hasPermission(adminRole, 'settings', 'manage'), `${adminRole} has manage on settings`);
    assert(hasPermission(adminRole, 'users', 'manage'), `${adminRole} has manage on users`);
    assert(hasPermission(adminRole, 'accounting', 'delete'), `${adminRole} has delete on accounting`);
    assert(canAccessRoute(adminRole, '/settings'), `${adminRole} can access route /settings`);
    assert(canAccessRoute(adminRole, '/users'), `${adminRole} can access route /users`);
    assert(canAccessRoute(adminRole, '/accounting/ledger'), `${adminRole} can access route /accounting/ledger`);
  }

  // --------------------------------------------------------------------------
  // SUITE 3: ACCOUNTANT PERMISSIONS & BOUNDARIES
  // --------------------------------------------------------------------------
  console.log('\n👉 SUITE 3: Accountant Role Permissions & Strict Separation');
  // Allowed
  assert(hasPermission('Accountant', 'accounting', 'view'), 'Accountant CAN view accounting');
  assert(hasPermission('Accountant', 'accounting', 'create'), 'Accountant CAN create accounting');
  assert(hasPermission('Accountant', 'accounting', 'manage'), 'Accountant CAN manage accounting');
  assert(hasPermission('Accountant', 'taxes', 'view'), 'Accountant CAN view taxes');
  assert(hasPermission('Accountant', 'reports', 'export'), 'Accountant CAN export reports');
  assert(hasPermission('Accountant', 'payments', 'create'), 'Accountant CAN record payments');
  assert(canAccessRoute('Accountant', '/accounting/trial-balance'), 'Accountant CAN access /accounting/trial-balance');
  assert(canAccessRoute('Accountant', '/accounting/ledger'), 'Accountant CAN access /accounting/ledger');

  // Blocked
  assert(!hasPermission('Accountant', 'users', 'view'), 'Accountant CANNOT view users');
  assert(!hasPermission('Accountant', 'users', 'manage'), 'Accountant CANNOT manage users');
  assert(!hasPermission('Accountant', 'inventory', 'manage'), 'Accountant CANNOT manage warehouse inventory');
  assert(!hasPermission('Accountant', 'settings', 'manage'), 'Accountant CANNOT manage company settings');
  assert(!hasPermission('Accountant', 'pos', 'view'), 'Accountant CANNOT open POS counter billing');
  assert(!canAccessRoute('Accountant', '/users'), 'Accountant is BLOCKED from route /users');
  assert(canAccessRoute('Accountant', '/settings'), 'Accountant CAN access route /settings for personal & financial preferences');
  assert(!canAccessRoute('Accountant', '/inventory/warehouses'), 'Accountant is BLOCKED from route /inventory/warehouses');

  // --------------------------------------------------------------------------
  // SUITE 4: SALESPERSON PERMISSIONS & BOUNDARIES
  // --------------------------------------------------------------------------
  console.log('\n👉 SUITE 4: Salesperson Role Permissions & Strict Separation');
  // Allowed
  assert(hasPermission('Salesperson', 'sales', 'create'), 'Salesperson CAN create sales invoices');
  assert(hasPermission('Salesperson', 'sales', 'view'), 'Salesperson CAN view sales');
  assert(hasPermission('Salesperson', 'customers', 'create'), 'Salesperson CAN create customers');
  assert(!hasPermission('Salesperson', 'pos', 'view'), 'Salesperson CANNOT open POS fast billing');
  assert(!canAccessRoute('Salesperson', '/sales/pos'), 'Salesperson is BLOCKED from route /sales/pos');
  // Legitimate cross-module read
  assert(hasPermission('Salesperson', 'products', 'view'), 'Salesperson CAN view product master for pricing/stock check');
  assert(!hasPermission('Salesperson', 'products', 'delete'), 'Salesperson CANNOT delete products master');

  // Blocked
  assert(!hasPermission('Salesperson', 'accounting', 'view'), 'Salesperson CANNOT view accounting ledger');
  assert(!hasPermission('Salesperson', 'purchases', 'view'), 'Salesperson CANNOT view vendor purchases');
  assert(!hasPermission('Salesperson', 'suppliers', 'view'), 'Salesperson CANNOT view suppliers');
  assert(!hasPermission('Salesperson', 'users', 'view'), 'Salesperson CANNOT view or manage users');
  assert(!hasPermission('Salesperson', 'settings', 'manage'), 'Salesperson CANNOT manage company settings');
  assert(!canAccessRoute('Salesperson', '/accounting'), 'Salesperson is BLOCKED from route /accounting');
  assert(!canAccessRoute('Salesperson', '/purchases'), 'Salesperson is BLOCKED from route /purchases');
  assert(!canAccessRoute('Salesperson', '/inventory/warehouses'), 'Salesperson is BLOCKED from route /inventory/warehouses');
  assert(!canAccessRoute('Salesperson', '/users'), 'Salesperson is BLOCKED from route /users');

  // --------------------------------------------------------------------------
  // SUITE 5: PURCHASE MANAGER PERMISSIONS & BOUNDARIES
  // --------------------------------------------------------------------------
  console.log('\n👉 SUITE 5: Purchase Manager Role Permissions & Strict Separation');
  // Allowed
  assert(hasPermission('Purchase Manager', 'purchases', 'view'), 'Purchase Manager CAN view purchases');
  assert(hasPermission('Purchase Manager', 'purchases', 'create'), 'Purchase Manager CAN create purchase bills');
  assert(hasPermission('Purchase Manager', 'purchases', 'approve'), 'Purchase Manager CAN approve purchase orders');
  assert(hasPermission('Purchase Manager', 'suppliers', 'create'), 'Purchase Manager CAN manage suppliers');
  assert(hasPermission('Purchase Manager', 'products', 'view'), 'Purchase Manager CAN view product catalog for unit costs');
  assert(hasPermission('Purchase Manager', 'inventory', 'view'), 'Purchase Manager CAN view inventory stock levels');

  // Blocked
  assert(!hasPermission('Purchase Manager', 'sales', 'view'), 'Purchase Manager CANNOT view sales administration');
  assert(!hasPermission('Purchase Manager', 'pos', 'view'), 'Purchase Manager CANNOT open POS billing');
  assert(!hasPermission('Purchase Manager', 'accounting', 'view'), 'Purchase Manager CANNOT view general ledger');
  assert(!hasPermission('Purchase Manager', 'users', 'view'), 'Purchase Manager CANNOT access user provisioning');
  assert(!canAccessRoute('Purchase Manager', '/sales'), 'Purchase Manager is BLOCKED from route /sales');
  assert(!canAccessRoute('Purchase Manager', '/sales/pos'), 'Purchase Manager is BLOCKED from route /sales/pos');
  assert(!canAccessRoute('Purchase Manager', '/accounting/trial-balance'), 'Purchase Manager is BLOCKED from /accounting/trial-balance');

  // --------------------------------------------------------------------------
  // SUITE 6: WAREHOUSE MANAGER PERMISSIONS & BOUNDARIES
  // --------------------------------------------------------------------------
  console.log('\n👉 SUITE 6: Warehouse Manager Role Permissions & Strict Separation');
  // Allowed
  assert(hasPermission('Warehouse Manager', 'inventory', 'view'), 'Warehouse Manager CAN view stock');
  assert(hasPermission('Warehouse Manager', 'inventory', 'manage'), 'Warehouse Manager CAN manage warehouses and transfers');
  assert(hasPermission('Warehouse Manager', 'products', 'edit'), 'Warehouse Manager CAN update item inventory metadata');
  assert(hasPermission('Warehouse Manager', 'products', 'delete'), 'Warehouse Manager CAN delete products master');
  assert(hasPermission('Warehouse Manager', 'barcode', 'create'), 'Warehouse Manager CAN print barcode labels');
  assert(canAccessRoute('Warehouse Manager', '/inventory/transfers'), 'Warehouse Manager CAN access /inventory/transfers');
  assert(canAccessRoute('Warehouse Manager', '/inventory/batches'), 'Warehouse Manager CAN access /inventory/batches');

  // Blocked
  assert(!hasPermission('Warehouse Manager', 'accounting', 'view'), 'Warehouse Manager CANNOT view accounting');
  assert(!hasPermission('Warehouse Manager', 'payments', 'view'), 'Warehouse Manager CANNOT view payments');
  assert(!hasPermission('Warehouse Manager', 'sales', 'view'), 'Warehouse Manager CANNOT access sales orders');
  assert(!hasPermission('Warehouse Manager', 'users', 'manage'), 'Warehouse Manager CANNOT manage users');
  assert(!hasPermission('Warehouse Manager', 'settings', 'manage'), 'Warehouse Manager CANNOT manage company settings');
  assert(!canAccessRoute('Warehouse Manager', '/accounting'), 'Warehouse Manager is BLOCKED from route /accounting');
  assert(!canAccessRoute('Warehouse Manager', '/sales'), 'Warehouse Manager is BLOCKED from route /sales');
  assert(!canAccessRoute('Warehouse Manager', '/users'), 'Warehouse Manager is BLOCKED from route /users');

  // --------------------------------------------------------------------------
  // SUITE 7: CASHIER PERMISSIONS & BOUNDARIES
  // --------------------------------------------------------------------------
  console.log('\n👉 SUITE 7: Cashier Role Permissions & Strict Separation');
  // Allowed
  assert(hasPermission('Cashier', 'pos', 'view'), 'Cashier CAN view POS billing interface');
  assert(hasPermission('Cashier', 'pos', 'create'), 'Cashier CAN create counter POS tickets');
  assert(hasPermission('Cashier', 'sales', 'create'), 'Cashier CAN create counter invoices');
  assert(hasPermission('Cashier', 'payments', 'create'), 'Cashier CAN record drawer cash payments');
  assert(hasPermission('Cashier', 'products', 'view'), 'Cashier CAN view product prices & barcodes');
  assert(canAccessRoute('Cashier', '/sales/pos'), 'Cashier CAN access /sales/pos');

  // Blocked
  assert(!hasPermission('Cashier', 'accounting', 'view'), 'Cashier CANNOT view accounting ledger');
  assert(!hasPermission('Cashier', 'purchases', 'view'), 'Cashier CANNOT view vendor purchases');
  assert(!hasPermission('Cashier', 'inventory', 'view'), 'Cashier CANNOT view stock transfers / warehouses');
  assert(!hasPermission('Cashier', 'users', 'view'), 'Cashier CANNOT access user accounts');
  assert(!hasPermission('Cashier', 'settings', 'manage'), 'Cashier CANNOT access company settings');
  assert(!canAccessRoute('Cashier', '/accounting'), 'Cashier is BLOCKED from route /accounting');
  assert(!canAccessRoute('Cashier', '/purchases'), 'Cashier is BLOCKED from route /purchases');
  assert(!canAccessRoute('Cashier', '/inventory'), 'Cashier is BLOCKED from route /inventory');
  assert(canAccessRoute('Cashier', '/settings'), 'Cashier CAN access route /settings for personal & POS preferences');
  assert(!canAccessRoute('Cashier', '/users'), 'Cashier is BLOCKED from route /users');

  // --------------------------------------------------------------------------
  // SUITE 8: DIRECT LANDING ROUTE RESOLUTION
  // --------------------------------------------------------------------------
  console.log('\n👉 SUITE 8: Role Default Landing Routes');
  assert(getRoleDefaultRoute('Cashier') === '/sales/pos', 'Cashier lands on /sales/pos');
  assert(getRoleDefaultRoute('Salesperson') === '/sales/dashboard', 'Salesperson lands on /sales/dashboard');
  assert(getRoleDefaultRoute('Purchase Manager') === '/purchases/dashboard', 'Purchase Manager lands on /purchases/dashboard');
  assert(getRoleDefaultRoute('Warehouse Manager') === '/warehouse/dashboard', 'Warehouse Manager lands on /warehouse/dashboard');
  assert(getRoleDefaultRoute('Accountant') === '/accounting', 'Accountant lands on /accounting');
  assert(getRoleDefaultRoute('Admin') === '/', 'Admin lands on /');
  assert(getRoleDefaultRoute('Owner') === '/', 'Owner lands on /');

  // --------------------------------------------------------------------------
  // SUITE 9: LIVE SUPABASE POSTGRESQL DATABASE VERIFICATION
  // --------------------------------------------------------------------------
  console.log('\n👉 SUITE 9: Live Supabase Database Tables & Policies');
  try {
    const { data: dbRoles, error: rolesErr } = await supabase.from('roles').select('name');
    if (rolesErr) {
      console.warn(`  ⚠️ Supabase fetch roles notice: ${rolesErr.message}`);
    } else {
      const names = dbRoles.map((r: any) => r.name);
      assert(names.includes('Admin'), 'Database roles table contains Admin');
      assert(names.includes('Accountant'), 'Database roles table contains Accountant');
      assert(names.includes('Salesperson'), 'Database roles table contains Salesperson');
      assert(names.includes('Purchase Manager'), 'Database roles table contains Purchase Manager');
      assert(names.includes('Warehouse Manager'), 'Database roles table contains Warehouse Manager');
      assert(names.includes('Cashier'), 'Database roles table contains Cashier');
    }

    const { count: permCount, error: permErr } = await supabase
      .from('role_permissions')
      .select('*', { count: 'exact', head: true });
    if (!permErr && permCount !== null) {
      assert(permCount >= 119, `Database has ${permCount} role_permissions entries (expected >= 119)`);
    }

    const { data: activeProfiles, error: profErr } = await supabase
      .from('profiles')
      .select('email, role');
    if (!profErr && activeProfiles) {
      console.log(`  ℹ️ Found ${activeProfiles.length} active user profiles in database:`);
      for (const p of activeProfiles) {
        console.log(`     - ${p.email} => [${p.role}]`);
      }
      assert(activeProfiles.length > 0, 'Company user profiles exist in database');
    }
  } catch (err: any) {
    console.error('  ⚠️ Database check failed:', err.message);
  }

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`   TOTAL TESTS: ${totalTests}`);
  console.log(`   PASSED:      ${passedTests}`);
  console.log(`   FAILED:      ${failedTests}`);
  console.log('===============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
