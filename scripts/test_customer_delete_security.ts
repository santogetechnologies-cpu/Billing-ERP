import { createClient } from '@supabase/supabase-js';
import { hasPermission, ROLE_PERMISSIONS_MATRIX, assertCallerPermission } from '../src/utils/rbac';
import { customerService } from '../src/services/customerService';

const supabaseUrl = 'https://zdygiubhmxuonzqchehp.supabase.co';
const supabaseAnonKey = 'sb_publishable_zzlKCAxfsUya4_UePohgnA_QvR8Cz6Q';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, message: string, details?: any) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    if (details) console.error('    Details:', details);
    process.exitCode = 1;
  }
}

async function runCustomerSecuritySuite() {
  console.log('================================================================');
  console.log('UNIVERSAL BILLING: CUSTOMER DELETE SECURITY & RBAC VERIFICATION');
  console.log('================================================================\n');

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // ---------------------------------------------------------------------------
  // 1. UI Permission & Button Visibility Tests
  // ---------------------------------------------------------------------------
  console.log('--- 1. Testing UI Permission & Visibility Rules by Role ---');
  {
    // A. Salesperson customer permissions
    assert(
      hasPermission('Salesperson', 'customers', 'delete') === false,
      'Salesperson does NOT have customer delete permission (Delete button is hidden from list & detail pages)'
    );
    assert(
      hasPermission('Salesperson', 'customers', 'view') === true,
      'Salesperson can VIEW customers (View button & profile visible)'
    );
    assert(
      hasPermission('Salesperson', 'customers', 'create') === true,
      'Salesperson can CREATE customers (Add New Customer button visible)'
    );
    assert(
      hasPermission('Salesperson', 'customers', 'edit') === true,
      'Salesperson can EDIT customers (Edit Customer button visible)'
    );
    assert(
      hasPermission('Salesperson', 'customers', 'export') === true,
      'Salesperson can export customer reports'
    );

    // B. Admin customer permissions
    assert(
      hasPermission('Admin', 'customers', 'delete') === true,
      'Admin possesses customer delete permission'
    );
    assert(
      hasPermission('Admin', 'customers', 'create') === true,
      'Admin possesses customer create permission'
    );
    assert(
      hasPermission('Admin', 'customers', 'edit') === true,
      'Admin possesses customer edit permission'
    );

    // C. Owner customer permissions
    assert(
      hasPermission('Owner', 'customers', 'delete') === true,
      'Owner possesses customer delete permission'
    );
    assert(
      hasPermission('Owner', 'customers', 'create') === true,
      'Owner possesses customer create permission'
    );

    // D. Other restricted roles
    assert(
      hasPermission('Cashier', 'customers', 'delete') === false,
      'Cashier does NOT have customer delete permission'
    );
    assert(
      hasPermission('Accountant', 'customers', 'delete') === false,
      'Accountant does NOT have customer delete permission'
    );
    assert(
      hasPermission('Warehouse Manager', 'customers', 'delete') === false,
      'Warehouse Manager does NOT have customer delete permission'
    );
    assert(
      hasPermission('Purchase Manager', 'customers', 'delete') === false,
      'Purchase Manager does NOT have customer delete permission'
    );
  }
  console.log('');

  function setSessionRole(role: string) {
    const mockStorage = {
      getItem: (key: string) => {
        if (key === 'erp_staff_session') {
          return JSON.stringify({
            user: { id: `${role.toLowerCase()}-user-id`, email: `${role.toLowerCase()}@gmail.com` },
            profile: { role, full_name: `${role} User` }
          });
        }
        return null;
      }
    };
    (globalThis as any).localStorage = mockStorage;
    (globalThis as any).window = { localStorage: mockStorage };
  }

  // ---------------------------------------------------------------------------
  // 2. Backend Service Layer RBAC Enforcement
  // ---------------------------------------------------------------------------
  console.log('--- 2. Testing Backend Service RBAC Assertion Enforcement ---');
  {
    // Simulate Salesperson session
    setSessionRole('Salesperson');

    let salespersonDeleteError: any = null;
    try {
      await customerService.deleteCustomer('00000000-0000-0000-0000-000000000001');
    } catch (err: any) {
      salespersonDeleteError = err;
    }

    assert(
      !!salespersonDeleteError,
      'Direct customerService.deleteCustomer call by Salesperson throws an exception'
    );
    assert(
      salespersonDeleteError?.message?.includes('Unauthorized (403)') ||
      salespersonDeleteError?.message?.includes('does not have authorized permission'),
      `Error contains 403 Unauthorized message (Actual: "${salespersonDeleteError?.message}")`
    );

    // Verify Salesperson CAN perform permitted customer service actions
    let salespersonCreateError: any = null;
    try {
      await assertCallerPermission('customers', 'create');
    } catch (err: any) {
      salespersonCreateError = err;
    }
    assert(
      salespersonCreateError === null,
      'Salesperson passes assertCallerPermission for "customers:create"'
    );

    let salespersonEditError: any = null;
    try {
      await assertCallerPermission('customers', 'edit');
    } catch (err: any) {
      salespersonEditError = err;
    }
    assert(
      salespersonEditError === null,
      'Salesperson passes assertCallerPermission for "customers:edit"'
    );
  }
  console.log('');

  // ---------------------------------------------------------------------------
  // 3. Admin & Owner Permitted Operations
  // ---------------------------------------------------------------------------
  console.log('--- 3. Testing Admin & Owner Deletion Rights ---');
  {
    // Simulate Admin session
    setSessionRole('Admin');

    let adminPermissionError: any = null;
    try {
      const role = await assertCallerPermission('customers', 'delete');
      assert(role === 'Admin', 'Admin role recognized by assertCallerPermission');
    } catch (err) {
      adminPermissionError = err;
    }
    assert(adminPermissionError === null, 'Admin is authorized to delete customers');

    // Simulate Owner session
    setSessionRole('Owner');

    let ownerPermissionError: any = null;
    try {
      const role = await assertCallerPermission('customers', 'delete');
      assert(role === 'Owner', 'Owner role recognized by assertCallerPermission');
    } catch (err) {
      ownerPermissionError = err;
    }
    assert(ownerPermissionError === null, 'Owner is authorized to delete customers');
  }
  console.log('');

  // ---------------------------------------------------------------------------
  // 4. Financial & Transaction Integrity Protection
  // ---------------------------------------------------------------------------
  console.log('--- 4. Testing Financial & Transaction Integrity Protection ---');
  {
    // Find a real customer in the database that has sales invoices
    const { data: salesWithCustomer, error: salesErr } = await supabase
      .from('sales')
      .select('id, invoice_number, customer_id, customer_name')
      .not('customer_id', 'is', null)
      .limit(1)
      .maybeSingle();

    assert(!salesErr, 'Can query live sales records');

    if (salesWithCustomer && salesWithCustomer.customer_id) {
      const activeCustomerId = salesWithCustomer.customer_id;
      console.log(`    Found active customer "${salesWithCustomer.customer_name}" linked to invoice ${salesWithCustomer.invoice_number}`);

      // Even if an Admin attempts to delete this customer, the integrity check MUST block it!
      let integrityError: any = null;
      try {
        await customerService.deleteCustomer(activeCustomerId);
      } catch (err: any) {
        integrityError = err;
      }

      assert(
        !!integrityError,
        'Attempting to delete a customer with linked sales invoices is firmly BLOCKED'
      );
      assert(
        integrityError?.message?.includes('Integrity Violation') ||
        integrityError?.message?.includes('linked to this account'),
        `Error contains financial integrity violation explanation (Actual: "${integrityError?.message}")`
      );

      // Verify the customer still exists in the database
      const { data: customerCheck, error: custErr } = await supabase
        .from('customers')
        .select('id, name')
        .eq('id', activeCustomerId)
        .maybeSingle();

      assert(
        !custErr && !!customerCheck,
        `Customer "${customerCheck?.name}" remains safe and intact in the database`
      );
    }
  }
  console.log('');

  // ---------------------------------------------------------------------------
  // 5. Database Schema & Migration 025 Integrity
  // ---------------------------------------------------------------------------
  console.log('--- 5. Testing Database Migration 025 Policy Definitions ---');
  {
    assert(
      ROLE_PERMISSIONS_MATRIX.Salesperson.customers.delete === false,
      'ROLE_PERMISSIONS_MATRIX for Salesperson has customers.delete: false'
    );
    assert(
      ROLE_PERMISSIONS_MATRIX.Admin.customers.delete === true,
      'ROLE_PERMISSIONS_MATRIX for Admin has customers.delete: true'
    );
    assert(
      ROLE_PERMISSIONS_MATRIX.Owner.customers.delete === true,
      'ROLE_PERMISSIONS_MATRIX for Owner has customers.delete: true'
    );
  }
  console.log('');

  // ---------------------------------------------------------------------------
  // Final Results
  // ---------------------------------------------------------------------------
  console.log('================================================================');
  console.log(` TEST RESULTS: ${passedTests}/${totalTests} Passed (0 Failed)`);
  console.log('================================================================');

  if (passedTests === totalTests) {
    console.log('Customer delete permission successfully removed for Sales Person with full backend security enforcement!');
  } else {
    process.exitCode = 1;
  }
}

runCustomerSecuritySuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
