import assert from 'assert';
import {
  canRoleAccessNavItem,
  canAccessRoute,
  hasPermission,
  ROLE_ALLOWED_NAV_MENUS,
  ROLE_PERMISSIONS_MATRIX,
  getRoleDefaultRoute
} from '../src/utils/rbac';
import { supplierBillService } from '../src/services/supplierBillService';

async function runTests() {
  console.log('================================================================');
  console.log('TEST SUITE: Payment Management Access Transfer to Purchase Manager');
  console.log('================================================================\n');

  // -------------------------------------------------------------------------
  // 1. ROLE PERMISSION MATRIX ASSERTIONS
  // -------------------------------------------------------------------------
  console.log('1. Checking Role Permissions Matrix...');

  // Purchase Manager MUST have full payment operational permissions
  assert.strictEqual(
    hasPermission('Purchase Manager', 'payments', 'view'),
    true,
    'Purchase Manager must have payments:view permission'
  );
  assert.strictEqual(
    hasPermission('Purchase Manager', 'payments', 'create'),
    true,
    'Purchase Manager must have payments:create permission'
  );
  assert.strictEqual(
    hasPermission('Purchase Manager', 'payments', 'edit'),
    true,
    'Purchase Manager must have payments:edit permission'
  );
  assert.strictEqual(
    hasPermission('Purchase Manager', 'payments', 'approve'),
    true,
    'Purchase Manager must have payments:approve permission'
  );
  assert.strictEqual(
    hasPermission('Purchase Manager', 'payments', 'delete'),
    false,
    'Purchase Manager must NOT have payments:delete permission (governance policy)'
  );

  // Accountant MUST be strictly denied from payments
  assert.strictEqual(
    hasPermission('Accountant', 'payments', 'view'),
    false,
    'Accountant must NOT have payments:view permission'
  );
  assert.strictEqual(
    hasPermission('Accountant', 'payments', 'create'),
    false,
    'Accountant must NOT have payments:create permission'
  );
  assert.strictEqual(
    hasPermission('Accountant', 'payments', 'edit'),
    false,
    'Accountant must NOT have payments:edit permission'
  );
  assert.strictEqual(
    hasPermission('Accountant', 'payments', 'approve'),
    false,
    'Accountant must NOT have payments:approve permission'
  );

  // Other roles retain existing permissions
  assert.strictEqual(hasPermission('Admin', 'payments', 'view'), true, 'Admin retains payments:view');
  assert.strictEqual(hasPermission('Owner', 'payments', 'view'), true, 'Owner retains payments:view');
  assert.strictEqual(hasPermission('Cashier', 'payments', 'create'), true, 'Cashier retains POS receipt payments:create');
  assert.strictEqual(hasPermission('Salesperson', 'payments', 'view'), false, 'Salesperson retains payments:ALL_DENIED');
  assert.strictEqual(hasPermission('Warehouse Manager', 'payments', 'view'), false, 'Warehouse Manager retains payments:ALL_DENIED');

  console.log('✓ Role Permissions Matrix passed.\n');

  // -------------------------------------------------------------------------
  // 2. SIDEBAR NAVIGATION MENU PERMISSIONS
  // -------------------------------------------------------------------------
  console.log('2. Checking Sidebar Navigation Menu Access...');

  // Purchase Manager sidebar MUST include Payments
  assert.strictEqual(
    canRoleAccessNavItem('Purchase Manager', 'Payments', 'payments'),
    true,
    'Purchase Manager must have access to Payments nav item in sidebar'
  );
  assert.ok(
    ROLE_ALLOWED_NAV_MENUS['Purchase Manager'].includes('Payments'),
    "ROLE_ALLOWED_NAV_MENUS['Purchase Manager'] must include 'Payments'"
  );

  // Accountant sidebar MUST NOT include Payments
  assert.strictEqual(
    canRoleAccessNavItem('Accountant', 'Payments', 'payments'),
    false,
    'Accountant must NOT have access to Payments nav item in sidebar'
  );
  assert.ok(
    !ROLE_ALLOWED_NAV_MENUS['Accountant'].includes('Payments'),
    "ROLE_ALLOWED_NAV_MENUS['Accountant'] must NOT include 'Payments'"
  );

  // Salesperson, Warehouse Manager MUST NOT have Payments in sidebar
  assert.strictEqual(canRoleAccessNavItem('Salesperson', 'Payments', 'payments'), false, 'Salesperson must not access Payments nav');
  assert.strictEqual(canRoleAccessNavItem('Warehouse Manager', 'Payments', 'payments'), false, 'Warehouse Manager must not access Payments nav');

  // Owner and Admin MUST have Payments in sidebar
  assert.strictEqual(canRoleAccessNavItem('Owner', 'Payments', 'payments'), true, 'Owner must access Payments nav');
  assert.strictEqual(canRoleAccessNavItem('Admin', 'Payments', 'payments'), true, 'Admin must access Payments nav');

  console.log('✓ Sidebar Navigation Menu Access passed.\n');

  // -------------------------------------------------------------------------
  // 3. ROUTE LEVEL ACCESS CONTROL (DIRECT URL ACCESS RESTRICTION)
  // -------------------------------------------------------------------------
  console.log('3. Checking Route Level Direct URL Access Control...');

  const paymentRoutes = [
    '/payments',
    '/payments/bills',
    '/cash-bank',
    '/receivables',
    '/payables'
  ];

  // Purchase Manager MUST be able to access all payment routes via direct URL
  for (const route of paymentRoutes) {
    assert.strictEqual(
      canAccessRoute('Purchase Manager', route),
      true,
      `Purchase Manager must be allowed to access ${route}`
    );
  }

  // Accountant MUST be strictly BLOCKED from accessing any payment route via direct URL
  for (const route of paymentRoutes) {
    assert.strictEqual(
      canAccessRoute('Accountant', route),
      false,
      `Accountant must be BLOCKED from accessing ${route}`
    );
  }

  // Accountant fallback default route should be /accounting
  assert.strictEqual(
    getRoleDefaultRoute('Accountant'),
    '/accounting',
    'Accountant fallback route must remain /accounting'
  );

  // Purchase Manager fallback default route should be /purchases/dashboard
  assert.strictEqual(
    getRoleDefaultRoute('Purchase Manager'),
    '/purchases/dashboard',
    'Purchase Manager fallback route must remain /purchases/dashboard'
  );

  console.log('✓ Route Level Direct URL Access Control passed.\n');

  // -------------------------------------------------------------------------
  // 4. SERVICE-LEVEL AUTHORIZATION ENFORCEMENT
  // -------------------------------------------------------------------------
  console.log('4. Checking Service-Level Authorization Enforcement...');

  // Test recordSupplierBillPayment with Accountant profile -> Must throw 403 Forbidden
  let accountantBlocked = false;
  try {
    await supplierBillService.recordSupplierBillPayment(
      {
        billId: '00000000-0000-0000-0000-000000000001',
        amount: 500,
        paymentMethod: 'Bank Transfer',
        userProfile: {
          id: 'test-acc-user',
          fullName: 'Test Accountant',
          role: 'Accountant'
        }
      },
      '00000000-0000-0000-0000-000000000001'
    );
  } catch (err: any) {
    if (err.message.includes('403') || err.message.includes('Unauthorized')) {
      accountantBlocked = true;
    } else {
      console.warn('Unexpected error when testing Accountant record payment:', err);
    }
  }
  assert.strictEqual(accountantBlocked, true, 'supplierBillService.recordSupplierBillPayment must block Accountant with 403');

  // Test verifySupplierBill with Accountant profile -> Must throw 403 Forbidden
  let accountantVerifyBlocked = false;
  try {
    await supplierBillService.verifySupplierBill(
      {
        billId: '00000000-0000-0000-0000-000000000001',
        status: 'Approved for Payment',
        userProfile: {
          id: 'test-acc-user',
          fullName: 'Test Accountant',
          role: 'Accountant'
        }
      },
      '00000000-0000-0000-0000-000000000001'
    );
  } catch (err: any) {
    if (err.message.includes('403') || err.message.includes('Unauthorized')) {
      accountantVerifyBlocked = true;
    }
  }
  assert.strictEqual(accountantVerifyBlocked, true, 'supplierBillService.verifySupplierBill must block Accountant with 403');

  console.log('✓ Service-Level Authorization Enforcement passed.\n');

  // -------------------------------------------------------------------------
  // 5. UNRELATED PERMISSIONS PRESERVATION CHECK
  // -------------------------------------------------------------------------
  console.log('5. Checking Unrelated Permissions Preservation...');

  // Accountant retains accounting, expenses, taxes, reports, read-only sales/purchases
  assert.strictEqual(hasPermission('Accountant', 'accounting', 'view'), true, 'Accountant retains accounting:view');
  assert.strictEqual(hasPermission('Accountant', 'accounting', 'create'), true, 'Accountant retains accounting:create');
  assert.strictEqual(hasPermission('Accountant', 'expenses', 'view'), true, 'Accountant retains expenses:view');
  assert.strictEqual(hasPermission('Accountant', 'taxes', 'view'), true, 'Accountant retains taxes:view');
  assert.strictEqual(hasPermission('Accountant', 'reports', 'view'), true, 'Accountant retains reports:view');
  assert.strictEqual(canAccessRoute('Accountant', '/accounting'), true, 'Accountant retains access to /accounting');
  assert.strictEqual(canAccessRoute('Accountant', '/expenses'), true, 'Accountant retains access to /expenses');
  assert.strictEqual(canAccessRoute('Accountant', '/taxes'), true, 'Accountant retains access to /taxes');
  assert.strictEqual(canAccessRoute('Accountant', '/reports'), true, 'Accountant retains access to /reports');

  // Purchase Manager retains purchasing, suppliers, customers, barcode, inventory
  assert.strictEqual(hasPermission('Purchase Manager', 'purchases', 'view'), true, 'Purchase Manager retains purchases:view');
  assert.strictEqual(hasPermission('Purchase Manager', 'purchases', 'create'), true, 'Purchase Manager retains purchases:create');
  assert.strictEqual(hasPermission('Purchase Manager', 'suppliers', 'view'), true, 'Purchase Manager retains suppliers:view');
  assert.strictEqual(hasPermission('Purchase Manager', 'inventory', 'view'), true, 'Purchase Manager retains inventory:view');
  assert.strictEqual(hasPermission('Purchase Manager', 'barcode', 'view'), true, 'Purchase Manager retains barcode:view');
  assert.strictEqual(canAccessRoute('Purchase Manager', '/purchases'), true, 'Purchase Manager retains access to /purchases');
  assert.strictEqual(canAccessRoute('Purchase Manager', '/purchases/orders'), true, 'Purchase Manager retains access to /purchases/orders');
  assert.strictEqual(canAccessRoute('Purchase Manager', '/suppliers'), true, 'Purchase Manager retains access to /suppliers');

  // Purchase Manager does NOT have Admin permissions
  assert.strictEqual(hasPermission('Purchase Manager', 'users', 'view'), false, 'Purchase Manager must NOT have users:view');
  assert.strictEqual(hasPermission('Purchase Manager', 'users', 'manage'), false, 'Purchase Manager must NOT have users:manage');
  assert.strictEqual(hasPermission('Purchase Manager', 'audit', 'view'), false, 'Purchase Manager must NOT have audit:view');
  assert.strictEqual(canAccessRoute('Purchase Manager', '/users'), false, 'Purchase Manager cannot access /users');
  assert.strictEqual(canAccessRoute('Purchase Manager', '/audit-log'), false, 'Purchase Manager cannot access /audit-log');

  console.log('✓ Unrelated Permissions Preservation passed.\n');

  console.log('================================================================');
  console.log('ALL TEST SCENARIOS PASSED SUCCESSFULLY!');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
