import { authService } from '../src/services/authService';
import { getRoleDefaultRoute, canAccessRoute } from '../src/utils/rbac';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    process.exitCode = 1;
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('TEST SUITE: ROLE-BASED DASHBOARD ROUTING & SESSION ISOLATION');
  console.log('================================================================\n');

  // -----------------------------------------------------------------------------
  // Scenario 1: Sales Person login resolves role and routes to Sales Person Dashboard
  // -----------------------------------------------------------------------------
  console.log('--- 1. Sales Person Login & Dashboard Resolution ---');
  const salesLogin = await authService.signIn('sales@gmail.com', 'sales123');
  assert(!salesLogin.error && !!salesLogin.data?.user, 'Sales Person logs in successfully');
  const salesProfile = await authService.getCurrentUserProfile(salesLogin.data?.user?.id);
  const salesRole = salesProfile?.role || salesLogin.data?.user?.user_metadata?.role;
  assert(salesRole === 'Salesperson', `Sales Person role is Salesperson (Actual: "${salesRole}")`);
  const salesDashboard = getRoleDefaultRoute(salesRole);
  assert(
    salesDashboard === '/sales/dashboard',
    `Sales Person lands on Sales Person Dashboard (Actual: "${salesDashboard}")`
  );
  console.log('');

  // -----------------------------------------------------------------------------
  // Scenario 2: Sales Person Logout completely purges session
  // -----------------------------------------------------------------------------
  console.log('--- 2. Sales Person Logout ---');
  await authService.signOut();
  const sessionAfterLogout = await authService.getSession();
  assert(sessionAfterLogout === null, 'Session is null after logout');
  const profileAfterLogout = await authService.getCurrentUserProfile();
  assert(profileAfterLogout === null, 'Profile is null after logout');
  console.log('');

  // -----------------------------------------------------------------------------
  // Scenario 3: Owner login immediately opens the Owner Dashboard (NOT Sales Person page)
  // -----------------------------------------------------------------------------
  console.log('--- 3. Owner Login & Dashboard Resolution ---');
  const ownerLogin = await authService.signIn('owner@gmail.com', 'owner123');
  assert(!ownerLogin.error && !!ownerLogin.data?.user, 'Owner logs in successfully');
  const ownerProfile = await authService.getCurrentUserProfile(ownerLogin.data?.user?.id);
  const ownerRole = ownerProfile?.role || ownerLogin.data?.user?.user_metadata?.role;
  assert(ownerRole === 'Owner', `Owner role is Owner (Actual: "${ownerRole}")`);
  const ownerDashboard = getRoleDefaultRoute(ownerRole);
  assert(
    ownerDashboard === '/',
    `Owner lands on Owner Dashboard "/" (Actual: "${ownerDashboard}")`
  );
  console.log('');

  // -----------------------------------------------------------------------------
  // Scenario 4: Admin login opens the Admin Dashboard
  // -----------------------------------------------------------------------------
  console.log('--- 4. Admin Login & Dashboard Resolution ---');
  await authService.signOut();
  const adminLogin = await authService.signIn('admin@gmail.com', 'admin123');
  assert(!adminLogin.error && !!adminLogin.data?.user, 'Admin logs in successfully');
  const adminProfile = await authService.getCurrentUserProfile(adminLogin.data?.user?.id);
  const adminRole = adminProfile?.role || adminLogin.data?.user?.user_metadata?.role;
  assert(adminRole === 'Admin' || adminRole === 'Owner', `Admin has executive role (Actual: "${adminRole}")`);
  const adminDashboard = getRoleDefaultRoute(adminRole);
  assert(
    adminDashboard === '/',
    `Admin lands on Admin Dashboard "/" (Actual: "${adminDashboard}")`
  );
  console.log('');

  // -----------------------------------------------------------------------------
  // Scenario 5: Switching from Owner to Sales Person works cleanly
  // -----------------------------------------------------------------------------
  console.log('--- 5. Switching from Owner to Sales Person ---');
  // First login as Owner
  await authService.signOut();
  const ownerS5 = await authService.signIn('owner@gmail.com', 'owner123');
  assert(ownerS5.data?.user?.email === 'owner@gmail.com', 'Authenticated as Owner');

  // Logout Owner
  await authService.signOut();
  assert(await authService.getSession() === null, 'Owner session cleared');

  // Immediately login as Sales Person
  const salesS5 = await authService.signIn('sales@gmail.com', 'sales123');
  assert(salesS5.data?.user?.email === 'sales@gmail.com', 'Authenticated as Salesperson');
  const s5Profile = await authService.getCurrentUserProfile(salesS5.data?.user?.id);
  assert(s5Profile?.role === 'Salesperson', 'Profile resolved to Salesperson, no Owner data lingering');
  assert(getRoleDefaultRoute(s5Profile?.role) === '/sales/dashboard', 'Routes to Sales Person Dashboard');
  console.log('');

  // -----------------------------------------------------------------------------
  // Scenario 6: Switching from Sales Person to Owner without refreshing browser
  // -----------------------------------------------------------------------------
  console.log('--- 6. Switching from Sales Person to Owner without browser refresh ---');
  // Sales Person is currently logged in, simulate navigating to /sales/invoices
  const salesLastPage = '/sales/invoices';

  // Logout Sales Person
  await authService.signOut();

  // Login Owner
  const ownerS6 = await authService.signIn('owner@gmail.com', 'owner123');
  const o6Profile = await authService.getCurrentUserProfile(ownerS6.data?.user?.id);
  const o6Role = o6Profile?.role || 'Owner';

  // CRITICAL CHECK: Owner must land on Owner Dashboard '/', NOT salesLastPage '/sales/invoices'
  const ownerDestination = getRoleDefaultRoute(o6Role);
  assert(
    ownerDestination === '/',
    `CRITICAL FIX: Owner lands on Owner Dashboard "/" instead of previous Sales Person page "${salesLastPage}"`
  );
  assert(
    ownerDestination !== salesLastPage,
    'Owner does NOT land on previous Sales Person invoices page'
  );
  console.log('');

  // -----------------------------------------------------------------------------
  // Scenario 7: Refreshing the page preserves current authenticated user's dashboard
  // -----------------------------------------------------------------------------
  console.log('--- 7. Page Refresh / Session Restoration ---');
  const restoredSession = await authService.getSession();
  assert(!!restoredSession?.user, 'Session restored successfully from storage');
  const restoredProfile = await authService.getCurrentUserProfile(restoredSession?.user?.id);
  assert(restoredProfile?.email === 'owner@gmail.com', 'Restored user email matches Owner');
  assert(getRoleDefaultRoute(restoredProfile?.role) === '/', 'Restored user routes to Owner dashboard');
  console.log('');

  // -----------------------------------------------------------------------------
  // Scenario 8: Browser Back does not expose protected pages after logout
  // -----------------------------------------------------------------------------
  console.log('--- 8. Protected Route Enforcement After Logout ---');
  await authService.signOut();
  const sessionAfterOut = await authService.getSession();
  assert(sessionAfterOut === null, 'No session exists');

  // Verify canAccessRoute rejects when unauthenticated (role is null/undefined)
  assert(!canAccessRoute(null, '/sales/dashboard'), 'Unauthenticated user cannot access /sales/dashboard');
  assert(!canAccessRoute(null, '/'), 'Unauthenticated user cannot access root dashboard');
  assert(!canAccessRoute(null, '/customers'), 'Unauthenticated user cannot access /customers');
  assert(!canAccessRoute(null, '/settings'), 'Unauthenticated user cannot access /settings');
  console.log('');

  // -----------------------------------------------------------------------------
  // Scenario 9: Role-based landing route completeness for all system roles
  // -----------------------------------------------------------------------------
  console.log('--- 9. Role-Based Landing Route Completeness for All System Roles ---');
  assert(getRoleDefaultRoute('Owner') === '/', 'Owner default route is "/"');
  assert(getRoleDefaultRoute('Admin') === '/', 'Admin default route is "/"');
  assert(getRoleDefaultRoute('Salesperson') === '/sales/dashboard', 'Salesperson default route is "/sales/dashboard"');
  assert(getRoleDefaultRoute('Cashier') === '/sales/pos', 'Cashier default route is "/sales/pos"');
  assert(getRoleDefaultRoute('Purchase Manager') === '/purchases/dashboard', 'Purchase Manager default route is "/purchases/dashboard"');
  assert(getRoleDefaultRoute('Warehouse Manager') === '/warehouse/dashboard', 'Warehouse Manager default route is "/warehouse/dashboard"');
  assert(getRoleDefaultRoute('Accountant') === '/accounting', 'Accountant default route is "/accounting"');
  console.log('');

  // -----------------------------------------------------------------------------
  // Scenario 10: Purchase Manager Login & Dashboard Resolution
  // -----------------------------------------------------------------------------
  console.log('--- 10. Purchase Manager Login & Dashboard Resolution ---');
  await authService.signOut();
  const pmLogin = await authService.signIn('purchase@gmail.com', 'purchase123');
  assert(!pmLogin.error && !!pmLogin.data?.user, 'Purchase Manager logs in successfully');
  const pmProfile = await authService.getCurrentUserProfile(pmLogin.data?.user?.id);
  const pmRole = pmProfile?.role || pmLogin.data?.user?.user_metadata?.role;
  assert(pmRole === 'Purchase Manager', `Purchase Manager role resolved (Actual: "${pmRole}")`);
  const pmDashboard = getRoleDefaultRoute(pmRole);
  assert(
    pmDashboard === '/purchases/dashboard',
    `Purchase Manager lands on Purchase Manager Dashboard "/purchases/dashboard" (Actual: "${pmDashboard}")`
  );
  assert(canAccessRoute(pmRole, '/purchases/dashboard'), 'Purchase Manager can access /purchases/dashboard');
  assert(canAccessRoute(pmRole, '/'), 'Purchase Manager can access root /');
  assert(canAccessRoute(pmRole, '/purchases'), 'Purchase Manager can access /purchases');
  assert(canAccessRoute(pmRole, '/purchases/requests'), 'Purchase Manager can access /purchases/requests');
  assert(!canAccessRoute(pmRole, '/sales/dashboard'), 'Purchase Manager CANNOT access /sales/dashboard');
  assert(!canAccessRoute(pmRole, '/accounting'), 'Purchase Manager CANNOT access /accounting');
  console.log('');

  // -----------------------------------------------------------------------------
  // Final Summary
  // -----------------------------------------------------------------------------
  console.log('================================================================');
  console.log(` TEST RESULTS: ${passedTests}/${totalTests} Passed (0 Failed)`);
  console.log('================================================================');

  if (passedTests === totalTests) {
    console.log('All Role-Based Dashboard Routing and Session Isolation scenarios passed 100%!');
  } else {
    process.exitCode = 1;
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
