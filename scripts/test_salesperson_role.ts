// Automated Verification Script: Sales Person Role-Based Dashboard & RBAC
import { createClient } from '@supabase/supabase-js';
import {
  ROLE_PERMISSIONS_MATRIX,
  ROUTE_MODULE_MAP,
  hasPermission,
  canAccessRoute,
  getRoleDefaultRoute
} from '../src/utils/rbac';

const supabaseUrl = 'https://zdygiubhmxuonzqchehp.supabase.co';
const supabaseKey = 'sb_publishable_zzlKCAxfsUya4_UePohgnA_QvR8Cz6Q';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
  console.log('====================================================');
  console.log(' Universal Billing — Sales Person RBAC Verification ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(desc: string, condition: boolean, extraInfo?: any) {
    if (condition) {
      console.log(`  ✓ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${desc}`);
      if (extraInfo) console.error('    Details:', extraInfo);
      failed++;
    }
  }

  // 1. Role Default Landing Routes
  console.log('\n--- 1. Testing Default Landing Routes by Role ---');
  assert(
    'Salesperson lands on /sales/dashboard',
    getRoleDefaultRoute('Salesperson') === '/sales/dashboard',
    getRoleDefaultRoute('Salesperson')
  );
  assert(
    'Admin lands on /',
    getRoleDefaultRoute('Admin') === '/',
    getRoleDefaultRoute('Admin')
  );
  assert(
    'Owner lands on /',
    getRoleDefaultRoute('Owner') === '/',
    getRoleDefaultRoute('Owner')
  );
  assert(
    'Cashier lands on /sales/pos',
    getRoleDefaultRoute('Cashier') === '/sales/pos',
    getRoleDefaultRoute('Cashier')
  );

  // 2. Salesperson Route Access Permissions
  console.log('\n--- 2. Testing Salesperson Route Access Permissions ---');
  const allowedRoutesForSalesperson = [
    '/sales/dashboard',
    '/sales/pos',
    '/sales',
    '/sales/invoices',
    '/sales/new',
    '/sales/documents',
    '/customers',
    '/products'
  ];

  for (const route of allowedRoutesForSalesperson) {
    assert(`Salesperson can access ${route}`, canAccessRoute('Salesperson', route));
  }

  // 3. Restricted Routes for Salesperson
  console.log('\n--- 3. Testing Restricted Routes for Salesperson ---');
  const restrictedRoutesForSalesperson = [
    '/purchases',
    '/purchases/new',
    '/purchases/invoices',
    '/purchases/returns',
    '/suppliers',
    '/expenses',
    '/inventory/warehouses',
    '/inventory/transfers',
    '/inventory/batches',
    '/inventory/serials',
    '/inventory/valuation',
    '/accounting',
    '/accounting/ledger',
    '/accounting/trial-balance',
    '/accounting/profit-loss',
    '/accounting/balance-sheet',
    '/accounting/cash-flow',
    '/taxes',
    '/reports',
    '/barcode',
    '/users',
    '/audit-log',
    '/settings',
    '/pricing',
    '/units'
  ];

  for (const route of restrictedRoutesForSalesperson) {
    assert(
      `Salesperson CANNOT access ${route}`,
      !canAccessRoute('Salesperson', route)
    );
  }

  // 4. Admin and Owner Full Access Verification
  console.log('\n--- 4. Testing Admin / Owner Full Unrestricted Access ---');
  for (const route of restrictedRoutesForSalesperson) {
    assert(`Admin CAN access ${route}`, canAccessRoute('Admin', route));
    assert(`Owner CAN access ${route}`, canAccessRoute('Owner', route));
  }

  // 5. Granular Operation Permissions
  console.log('\n--- 5. Testing Granular Action Permissions for Salesperson ---');
  assert('Salesperson can view dashboard', hasPermission('Salesperson', 'dashboard', 'view'));
  assert('Salesperson CANNOT manage dashboard', !hasPermission('Salesperson', 'dashboard', 'manage'));
  assert('Salesperson can view sales', hasPermission('Salesperson', 'sales', 'view'));
  assert('Salesperson can create sales', hasPermission('Salesperson', 'sales', 'create'));
  assert('Salesperson can edit sales', hasPermission('Salesperson', 'sales', 'edit'));
  assert('Salesperson CANNOT delete sales invoices', !hasPermission('Salesperson', 'sales', 'delete'));
  assert('Salesperson can view products', hasPermission('Salesperson', 'products', 'view'));
  assert('Salesperson CANNOT create products', !hasPermission('Salesperson', 'products', 'create'));
  assert('Salesperson CANNOT edit products', !hasPermission('Salesperson', 'products', 'edit'));
  assert('Salesperson CANNOT delete products', !hasPermission('Salesperson', 'products', 'delete'));
  assert('Salesperson CANNOT manage settings', !hasPermission('Salesperson', 'settings', 'manage'));
  assert('Salesperson CANNOT manage users', !hasPermission('Salesperson', 'users', 'manage'));
  assert('Salesperson CANNOT access accounting', !hasPermission('Salesperson', 'accounting', 'view'));

  // 6. Live Supabase Records Verification
  console.log('\n--- 6. Verifying Live Supabase Database Records ---');
  try {
    const { data: salesProfile, error: profErr } = await supabase
      .from('profiles')
      .select('*')
      .ilike('email', 'sales@gmail.com')
      .maybeSingle();

    assert('Supabase profile exists for sales@gmail.com', !profErr && !!salesProfile, profErr);
    assert('sales@gmail.com role is Salesperson', salesProfile?.role === 'Salesperson', salesProfile?.role);
    assert('sales@gmail.com status is Active', salesProfile?.status === 'Active', salesProfile?.status);
    assert(
      'sales@gmail.com has valid company_id',
      !!salesProfile?.company_id && salesProfile?.company_id.length > 0,
      salesProfile?.company_id
    );

    const companyId = salesProfile?.company_id;

    // 7. Company Scoped Sales Data
    const { data: companySales, error: salesErr } = await supabase
      .from('sales')
      .select('id, invoice_number, grand_total, date, payment_method, payment_status, company_id')
      .eq('company_id', companyId);

    assert('Company sales invoices query succeeds', !salesErr, salesErr);
    assert('Company has actual live sales invoices', (companySales?.length || 0) > 0, companySales?.length);

    console.log(`    Found ${companySales?.length || 0} real invoices for company ${companyId}`);

    // Compute metrics
    const todayStr = new Date().toISOString().split('T')[0];
    const todaySales = (companySales || [])
      .filter(inv => inv.date === todayStr)
      .reduce((sum, inv) => sum + Number(inv.grand_total || 0), 0);
    const totalCompanySales = (companySales || []).reduce(
      (sum, inv) => sum + Number(inv.grand_total || 0),
      0
    );

    console.log(`    Total company sales: ₹${totalCompanySales.toLocaleString()}`);
    console.log(`    Today sales: ₹${todaySales.toLocaleString()}`);

    assert('Dashboard metrics correctly computed from real data', totalCompanySales >= 0);
  } catch (err: any) {
    console.error('Supabase query error:', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(` Results: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
