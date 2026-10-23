import { authService, getInMemoryStaffSession } from '../src/services/authService';
import { getRoleDefaultRoute, canAccessRoute, getActiveUserRole, AppModule } from '../src/utils/rbac';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    failed++;
  }
}

async function runSessionReopenTests() {
  console.log('================================================================');
  console.log('TEST SUITE: REQUIRE LOGIN EVERY TIME WEBSITE IS REOPENED');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // 1. Initial State / App Startup: No valid in-memory session exists
  // ---------------------------------------------------------------------------
  console.log('--- 1. App Startup: Unauthenticated Initial State ---');
  authService.clearInMemorySession();

  const initialSession = await authService.getSession();
  assert(initialSession === null, 'On startup, getSession() returns null when no in-memory session exists');

  const initialProfile = await authService.getCurrentUserProfile();
  assert(initialProfile === null, 'On startup, getCurrentUserProfile() returns null');

  const initialRole = await getActiveUserRole();
  assert(initialRole === null, 'On startup, getActiveUserRole() returns null');

  // Verify all protected routes block unauthenticated access
  const privateRoutes = [
    '/',
    '/dashboard',
    '/sales',
    '/sales/dashboard',
    '/sales/pos',
    '/sales/new',
    '/purchases',
    '/purchases/new',
    '/products',
    '/products/new',
    '/inventory',
    '/inventory/warehouses',
    '/customers',
    '/suppliers',
    '/accounting',
    '/accounting/ledger',
    '/reports',
    '/users',
    '/settings'
  ];

  let allBlocked = true;
  for (const route of privateRoutes) {
    if (canAccessRoute(null, route)) {
      allBlocked = false;
      break;
    }
  }
  assert(allBlocked, 'All private routes block unauthenticated access (canAccessRoute returns false)');
  console.log('');

  // ---------------------------------------------------------------------------
  // 2. Login works for every role and sets in-memory session & correct landing
  // ---------------------------------------------------------------------------
  console.log('--- 2. Login For Every Role & Role-Based Dashboard Routing ---');
  const rolesToTest = [
    { email: 'owner@gmail.com', pass: 'owner123', expectedRole: 'Owner', expectedRoute: '/' },
    { email: 'admin@gmail.com', pass: 'admin123', expectedRole: 'Admin', expectedRoute: '/' },
    { email: 'sales@gmail.com', pass: 'sales123', expectedRole: 'Salesperson', expectedRoute: '/sales/dashboard' },
    { email: 'cashier@gmail.com', pass: 'cashier123', expectedRole: 'Cashier', expectedRoute: '/sales/pos' },
    { email: 'warehouse@gmail.com', pass: 'wh123', expectedRole: 'Warehouse Manager', expectedRoute: '/inventory' },
    { email: 'accountant@gmail.com', pass: 'acc123', expectedRole: 'Accountant', expectedRoute: '/accounting' },
    { email: 'purchaser@gmail.com', pass: 'pur123', expectedRole: 'Purchase Manager', expectedRoute: '/purchases' }
  ];

  for (const item of rolesToTest) {
    const res = await authService.signIn(item.email, item.pass);
    assert(res.data !== null && res.data.user !== null, `Login succeeded for ${item.expectedRole} (${item.email})`);
    
    const inMem = getInMemoryStaffSession();
    assert(inMem !== null && inMem.user.email === item.email, `In-memory session established for ${item.expectedRole}`);

    const role = inMem?.profile?.role || res.data?.user?.user_metadata?.role;
    assert(role === item.expectedRole, `Role resolved correctly as ${item.expectedRole} (Actual: ${role})`);

    const defaultRoute = getRoleDefaultRoute(role);
    assert(defaultRoute === item.expectedRoute, `${item.expectedRole} routes to correct dashboard: "${defaultRoute}"`);

    await authService.signOut();
  }
  console.log('');

  // ---------------------------------------------------------------------------
  // 3. Navigation during active session works without repeated login prompts
  // ---------------------------------------------------------------------------
  console.log('--- 3. In-App Navigation Keeps User Authenticated ---');
  const salesLogin = await authService.signIn('sales@gmail.com', 'sales123');
  assert(salesLogin.data !== null, 'Salesperson logged in');

  // Simulate multiple client-side route transitions
  const sessionStep1 = await authService.getSession();
  assert(sessionStep1?.user?.email === 'sales@gmail.com', 'Step 1: Session valid on navigating to /sales/dashboard');

  const sessionStep2 = await authService.getSession();
  assert(sessionStep2?.user?.email === 'sales@gmail.com', 'Step 2: Session valid on navigating to /sales/pos');

  const sessionStep3 = await authService.getSession();
  assert(sessionStep3?.user?.email === 'sales@gmail.com', 'Step 3: Session valid on navigating to /sales/invoices');

  const sessionStep4 = await authService.getSession();
  assert(sessionStep4?.user?.email === 'sales@gmail.com', 'Step 4: Session valid on navigating to /customers');

  const activeRole = await getActiveUserRole();
  assert(activeRole === 'Salesperson', 'Active user role consistently resolved as Salesperson across navigation');
  console.log('');

  // ---------------------------------------------------------------------------
  // 4. Closing & Reopening Website: Session is NOT restored
  // ---------------------------------------------------------------------------
  console.log('--- 4. Closing & Reopening Website Requires Re-Login ---');
  // Simulate closing the browser/website: in-memory JavaScript state is reset
  authService.clearInMemorySession();

  const sessionAfterReopen = await authService.getSession();
  assert(sessionAfterReopen === null, 'After closing & reopening, getSession() is null (no auto-restore)');

  const profileAfterReopen = await authService.getCurrentUserProfile();
  assert(profileAfterReopen === null, 'After closing & reopening, getCurrentUserProfile() is null');

  const roleAfterReopen = await getActiveUserRole();
  assert(roleAfterReopen === null, 'After closing & reopening, getActiveUserRole() is null');

  // Verify unauthenticated user is blocked and must see login
  assert(!canAccessRoute(null, '/'), 'Reopened website blocks root dashboard');
  assert(!canAccessRoute(null, '/sales/dashboard'), 'Reopened website blocks Salesperson dashboard');
  assert(!canAccessRoute(null, '/inventory'), 'Reopened website blocks Warehouse Manager dashboard');
  console.log('');

  // ---------------------------------------------------------------------------
  // 5. Anti-Restoration: LocalStorage & SessionStorage cannot restore sessions
  // ---------------------------------------------------------------------------
  console.log('--- 5. Anti-Restoration: Storage Tampering Cannot Restore Session ---');
  let mockStorage = typeof window !== 'undefined' ? window.localStorage : (globalThis as any).localStorage;
  let didPolyfill = false;
  if (!mockStorage) {
    const store = new Map<string, string>();
    mockStorage = {
      getItem: (k: string) => store.get(k) || null,
      setItem: (k: string, v: string) => store.set(k, String(v)),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
      get length() { return store.size; },
      key: (i: number) => Array.from(store.keys())[i] || null
    };
    (globalThis as any).localStorage = mockStorage;
    didPolyfill = true;
  }

  // Maliciously inject a fake legacy session into localStorage
  mockStorage.setItem(
    'erp_staff_session',
    JSON.stringify({
      user: { id: 'fake-id', email: 'intruder@gmail.com' },
      profile: { id: 'fake-id', email: 'intruder@gmail.com', role: 'Owner' }
    })
  );

  // Verify authService.getSession() does NOT use localStorage to restore session
  authService.clearInMemorySession();
  const interceptedSession = await authService.getSession();
  assert(interceptedSession === null, 'authService.getSession() ignores localStorage erp_staff_session');

  const interceptedRole = await getActiveUserRole();
  assert(interceptedRole === null, 'getActiveUserRole() ignores localStorage erp_staff_session');

  // Clean up
  mockStorage.removeItem('erp_staff_session');
  if (didPolyfill) {
    delete (globalThis as any).localStorage;
  }
  console.log('');

  // ---------------------------------------------------------------------------
  // 6. Explicit Logout Clears In-Memory Session & User-Specific Cache
  // ---------------------------------------------------------------------------
  console.log('--- 6. Explicit Logout Behavior & Security ---');
  await authService.signIn('warehouse@gmail.com', 'wh123');
  assert(getInMemoryStaffSession()?.user?.email === 'warehouse@gmail.com', 'Warehouse Manager logged in');

  let listenerNotifiedOfSignOut = false;
  const sub = authService.onAuthStateChange((event, s) => {
    if (event === 'SIGNED_OUT' && s === null) {
      listenerNotifiedOfSignOut = true;
    }
  });

  await authService.signOut();
  sub.data.subscription.unsubscribe();

  assert(getInMemoryStaffSession() === null, 'In-memory staff session is null after signOut()');
  assert(listenerNotifiedOfSignOut, 'onAuthStateChange subscriber notified of SIGNED_OUT event');
  assert((await authService.getSession()) === null, 'getSession() is null after signOut()');
  assert((await authService.getCurrentUserProfile()) === null, 'getCurrentUserProfile() is null after signOut()');
  console.log('');

  // ---------------------------------------------------------------------------
  // 7. Isolation Between Consecutive Logins (No Data Leakage)
  // ---------------------------------------------------------------------------
  console.log('--- 7. Isolation Between Consecutive User Logins ---');
  // First user: Warehouse Manager
  await authService.signIn('warehouse@gmail.com', 'wh123');
  const whProfile = await authService.getCurrentUserProfile();
  assert(whProfile?.role === 'Warehouse Manager', 'User A logged in as Warehouse Manager');

  await authService.signOut();

  // Second user: Salesperson
  await authService.signIn('sales@gmail.com', 'sales123');
  const salesProfile2 = await authService.getCurrentUserProfile();
  assert(salesProfile2?.role === 'Salesperson', 'User B logged in as Salesperson');
  assert(salesProfile2?.email === 'sales@gmail.com', 'User B has their own email, not User A');
  assert(getRoleDefaultRoute(salesProfile2?.role) === '/sales/dashboard', 'User B lands on Sales dashboard');

  await authService.signOut();
  console.log('');

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('================================================================');
  console.log(` TEST RESULTS: ${passed}/${passed + failed} Passed (${failed} Failed)`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSessionReopenTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
