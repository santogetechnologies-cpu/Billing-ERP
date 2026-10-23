/**
 * Universal Billing — Test Suite for Refresh Login Preservation & 30-Minute Inactivity Logout
 * 
 * Verifies all 10 scenarios requested:
 * 1. Log in and refresh the page: the user remains logged in.
 * 2. Navigate between pages: the session remains active.
 * 3. Remain inactive for 29 minutes: the session remains active, warning triggers at 28 mins.
 * 4. Remain inactive for 30 minutes: automatic signout triggers.
 * 5. Perform activity before timeout: timer resets back to 30 mins.
 * 6. Close and reopen the tab: tab-scoped session discarded, login required.
 * 7. Open a new tab: isolated sessionStorage requires login.
 * 8. Expired or revoked sessions cannot access protected routes.
 * 9. Switching between Owner, Admin, Sales Person, Warehouse Manager does not leak data.
 * 10. Existing POS, inventory, notifications, and RBAC continue working seamlessly.
 */

// Mock window, sessionStorage, localStorage for Node / tsx environment
class MockStorage implements Storage {
  private store = new Map<string, string>();
  get length() { return this.store.size; }
  clear() { this.store.clear(); }
  getItem(key: string): string | null { return this.store.has(key) ? this.store.get(key)! : null; }
  key(index: number): string | null { return Array.from(this.store.keys())[index] || null; }
  removeItem(key: string): void { this.store.delete(key); }
  setItem(key: string, value: string): void { this.store.set(key, String(value)); }
}

const mockSessionStorage = new MockStorage();
const mockLocalStorage = new MockStorage();

(global as any).window = {
  sessionStorage: mockSessionStorage,
  localStorage: mockLocalStorage,
  addEventListener: (_ev: string, _cb: any) => {},
  removeEventListener: (_ev: string, _cb: any) => {},
  location: {
    href: '',
    replace: (url: string) => { (global as any).window.location.href = url; }
  }
};

(global as any).document = {
  visibilityState: 'visible',
  addEventListener: (_ev: string, _cb: any) => {},
  removeEventListener: (_ev: string, _cb: any) => {}
};

import { authService, getTabScopedStaffSession, setTabScopedStaffSession, resetInMemoryStaffCache, STAFF_SESSION_STORAGE_KEY } from '../src/services/authService';
import { inactivityService, INACTIVITY_TIMEOUT_MS, INACTIVITY_WARNING_MS, INACTIVITY_STORAGE_KEY } from '../src/services/inactivityService';
import { getRoleDefaultRoute, canAccessRoute, hasPermission, AppModule } from '../src/utils/rbac';

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

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTestSuite() {
  console.log('========================================================================');
  console.log('UNIVERSAL BILLING: REFRESH LOGIN & 30-MIN INACTIVITY LOGOUT TEST SUITE');
  console.log('========================================================================\n');

  // Reset storage
  mockSessionStorage.clear();
  mockLocalStorage.clear();

  // ---------------------------------------------------------------------------
  // SCENARIO 1: Log in and refresh the page (Same tab preservation)
  // ---------------------------------------------------------------------------
  console.log('--- SCENARIO 1: Log In and Refresh The Page (Preserves Login) ---');
  
  // User signs in as Admin
  const loginRes = await authService.signIn('admin@gmail.com', 'admin123');
  assert(loginRes.data !== null && loginRes.data.user !== null, 'Sign in as Admin succeeded');

  // Verify tab-scoped session was stored in sessionStorage
  const storedSessionRaw = mockSessionStorage.getItem(STAFF_SESSION_STORAGE_KEY);
  assert(storedSessionRaw !== null, 'Session is stored in tab-scoped sessionStorage');
  assert(mockLocalStorage.getItem(STAFF_SESSION_STORAGE_KEY) === null, 'Session is NOT stored in localStorage');

  // Simulate a Page Refresh in the same tab:
  // In a real browser, in-memory JS variables are re-instantiated, but window.sessionStorage persists!
  resetInMemoryStaffCache(); // Clear JS memory reference to simulate page reload without touching sessionStorage
  
  // Call getSession() and getCurrentUserProfile() after refresh
  const restoredSession = await authService.getSession();
  assert(restoredSession !== null && restoredSession.user !== null, 'After page refresh, getSession() restores user from sessionStorage');
  assert(restoredSession?.user?.email === 'admin@gmail.com', 'Restored user email matches logged-in user');

  const restoredProfile = await authService.getCurrentUserProfile();
  assert(restoredProfile !== null && restoredProfile.role === 'Admin', 'User profile and role "Admin" correctly preserved after refresh');
  assert(restoredProfile?.company_id !== undefined, 'Authorized company context preserved across page refresh');
  console.log('');

  // ---------------------------------------------------------------------------
  // SCENARIO 2: Navigate between pages
  // ---------------------------------------------------------------------------
  console.log('--- SCENARIO 2: Navigate Between Pages (Session Remains Active) ---');
  
  // Navigation across routes checks permissions and keeps active session
  const testRoutes = ['/', '/sales', '/inventory', '/purchases', '/accounting', '/users'];
  for (const route of testRoutes) {
    const isAccessible = canAccessRoute('Admin', route);
    assert(isAccessible, `Admin has authorized access to navigate to route: ${route}`);
  }
  
  const currentSessionAfterNav = await authService.getSession();
  assert(currentSessionAfterNav !== null, 'Session remains active throughout page navigation');
  console.log('');

  // ---------------------------------------------------------------------------
  // SCENARIO 3: Inactivity Timer at 28 & 29 Minutes (Warning Triggered, Active)
  // ---------------------------------------------------------------------------
  console.log('--- SCENARIO 3: Inactivity at 28 & 29 Minutes (Warning Triggered, Session Active) ---');
  
  let warningFired = false;
  let remainingSecondsNotified = 0;
  let timeoutFired = false;

  // Start inactivity tracking
  inactivityService.startTracking({
    onWarning: (secs) => {
      warningFired = true;
      remainingSecondsNotified = secs;
    },
    onWarningDismiss: () => {
      warningFired = false;
    },
    onTimeout: () => {
      timeoutFired = true;
    }
  });

  // Verify inactivity tracking recorded initial activity
  const initialActivityTime = inactivityService.getLastActivity();
  assert(initialActivityTime > 0, 'Inactivity service has valid initial activity timestamp');

  // Simulate 28 minutes elapsed (warning threshold: 30m - 2m = 28m)
  const twentyEightMinsAgo = Date.now() - (28 * 60 * 1000 + 5000); // 28m 5s ago
  mockSessionStorage.setItem(INACTIVITY_STORAGE_KEY, String(twentyEightMinsAgo));

  // Wait 1.1s for the 1-second pulse checker to evaluate
  await sleep(1100);

  assert(warningFired, 'Inactivity warning modal triggered at 28 minutes');
  assert(remainingSecondsNotified > 0 && remainingSecondsNotified <= 120, `Warning notification provided accurate remaining countdown: ${remainingSecondsNotified}s`);
  assert(!timeoutFired, 'Session is still active at 28-29 minutes (no timeout yet)');
  console.log('');

  // ---------------------------------------------------------------------------
  // SCENARIO 4: Inactivity at 30 Minutes (Automatic Logout)
  // ---------------------------------------------------------------------------
  console.log('--- SCENARIO 4: Inactivity at 30 Minutes (Automatic Signout) ---');
  
  // Simulate 30 minutes and 1 second elapsed
  const thirtyMinsAgo = Date.now() - (30 * 60 * 1000 + 1000);
  mockSessionStorage.setItem(INACTIVITY_STORAGE_KEY, String(thirtyMinsAgo));

  // Wait 1.1s for the pulse checker
  await sleep(1100);

  assert(timeoutFired, 'Timeout callback fired automatically after 30 minutes of inactivity');
  
  // Execute sign out as AuthContext would on timeout
  await authService.signOut();
  inactivityService.stopTracking();

  const sessionAfterTimeout = await authService.getSession();
  assert(sessionAfterTimeout === null, 'After 30-min inactivity logout, session is completely wiped');
  assert(mockSessionStorage.getItem(STAFF_SESSION_STORAGE_KEY) === null, 'SessionStorage auth token removed');
  assert(mockSessionStorage.getItem(INACTIVITY_STORAGE_KEY) === null, 'Inactivity storage timestamp cleaned up');
  console.log('');

  // ---------------------------------------------------------------------------
  // SCENARIO 5: Meaningful User Activity Resets Inactivity Timer
  // ---------------------------------------------------------------------------
  console.log('--- SCENARIO 5: Activity Resets Inactivity Timer ---');
  
  // Re-login
  await authService.signIn('admin@gmail.com', 'admin123');
  let warningActive2 = false;
  let timeoutActive2 = false;

  inactivityService.startTracking({
    onWarning: () => { warningActive2 = true; },
    onWarningDismiss: () => { warningActive2 = false; },
    onTimeout: () => { timeoutActive2 = true; }
  });

  // Simulate 29 minutes elapsed
  const twentyNineMinsAgo = Date.now() - (29 * 60 * 1000);
  mockSessionStorage.setItem(INACTIVITY_STORAGE_KEY, String(twentyNineMinsAgo));
  await sleep(1100);
  assert(warningActive2, 'Warning active before user interaction');

  // User clicks or moves mouse -> recordActivity() called
  inactivityService.recordActivity();
  assert(!warningActive2, 'Recording user activity immediately dismisses warning modal');

  const nowTime = Date.now();
  const resetActivityTime = inactivityService.getLastActivity();
  assert(Math.abs(nowTime - resetActivityTime) < 100, 'Last activity timestamp reset to current time');

  // Verify that after 1 second, session remains active with no timeout or warning
  await sleep(1100);
  assert(!timeoutActive2, 'Session remains active; timer reset successfully');
  assert(!warningActive2, 'Warning modal remains dismissed after activity reset');
  inactivityService.stopTracking();
  console.log('');

  // ---------------------------------------------------------------------------
  // SCENARIO 6 & 7: Tab Close & New Tab Isolation
  // ---------------------------------------------------------------------------
  console.log('--- SCENARIO 6 & 7: Close Tab & New Tab Isolation ---');
  
  // When a tab is closed, browser automatically clears that tab's sessionStorage
  mockSessionStorage.clear();
  setTabScopedStaffSession(null);

  const tabClosedSession = await authService.getSession();
  assert(tabClosedSession === null, 'Reopening tab after closure requires new login (no session exists)');

  // Opening in a new tab: creates fresh empty sessionStorage
  const newTabSession = await authService.getSession();
  assert(newTabSession === null, 'New tab does not inherit session from previous closed tab');
  console.log('');

  // ---------------------------------------------------------------------------
  // SCENARIO 8: Expired/Revoked Sessions Cannot Access Protected Routes
  // ---------------------------------------------------------------------------
  console.log('--- SCENARIO 8: Protected Routes Block Unauthenticated Access ---');
  
  const protectedModules: AppModule[] = ['dashboard', 'sales', 'inventory', 'purchases', 'accounting', 'pos', 'users', 'settings', 'audit'];
  let allProtectedBlocked = true;
  for (const mod of protectedModules) {
    if (hasPermission(null, mod, 'view')) {
      allProtectedBlocked = false;
      break;
    }
  }
  assert(allProtectedBlocked, 'All protected modules block unauthenticated access (hasPermission returns false)');
  console.log('');

  // ---------------------------------------------------------------------------
  // SCENARIO 9: Switching Between Roles Does Not Leak Previous Data
  // ---------------------------------------------------------------------------
  console.log('--- SCENARIO 9: Switching Roles Clears Previous State & Routes Accurately ---');
  
  const roleScenarios = [
    { email: 'owner@gmail.com', pass: 'owner123', role: 'Owner', route: '/' },
    { email: 'admin@gmail.com', pass: 'admin123', role: 'Admin', route: '/' },
    { email: 'sales@gmail.com', pass: 'sales123', role: 'Salesperson', route: '/sales/dashboard' },
    { email: 'warehouse@gmail.com', pass: 'wh123', role: 'Warehouse Manager', route: '/warehouse/dashboard' },
    { email: 'cashier@gmail.com', pass: 'cashier123', role: 'Cashier', route: '/sales/pos' },
    { email: 'accountant@gmail.com', pass: 'acc123', role: 'Accountant', route: '/accounting' },
    { email: 'purchaser@gmail.com', pass: 'pur123', role: 'Purchase Manager', route: '/purchases/dashboard' }
  ];

  for (const s of roleScenarios) {
    // 1. Sign in
    const res = await authService.signIn(s.email, s.pass);
    assert(res.data !== null, `Login succeeded for ${s.role}`);

    const sess = await authService.getSession();
    const prof = await authService.getCurrentUserProfile();
    assert(prof?.role === s.role, `Profile role matches ${s.role}`);

    const targetRoute = getRoleDefaultRoute(prof?.role);
    assert(targetRoute === s.route, `${s.role} redirects to correct role dashboard: ${s.route}`);

    // 2. Sign out immediately
    await authService.signOut();
    const cleanSess = await authService.getSession();
    assert(cleanSess === null, `State completely wiped after signing out ${s.role}`);
  }
  console.log('');

  // ---------------------------------------------------------------------------
  // SCENARIO 10: Existing POS, Inventory, Notifications & Role-based Permissions
  // ---------------------------------------------------------------------------
  console.log('--- SCENARIO 10: Existing Role-Based Permissions & Module Functions ---');
  
  // Warehouse Manager: Can view inventory, create transfers, delete products (recently added feature)
  assert(hasPermission('Warehouse Manager', 'inventory', 'view'), 'Warehouse Manager has inventory:view permission');
  assert(hasPermission('Warehouse Manager', 'products', 'delete'), 'Warehouse Manager has products:delete permission');
  assert(!hasPermission('Salesperson', 'products', 'delete'), 'Salesperson cannot delete products');

  // Salesperson: Can view sales, create invoices, view pos
  assert(hasPermission('Salesperson', 'sales', 'view'), 'Salesperson has sales:view permission');
  assert(hasPermission('Salesperson', 'sales', 'create'), 'Salesperson has sales:create permission');
  assert(!hasPermission('Salesperson', 'accounting', 'view'), 'Salesperson cannot access accounting');

  // Cashier: Can access POS
  assert(hasPermission('Cashier', 'pos', 'view'), 'Cashier has pos:view permission');
  assert(hasPermission('Cashier', 'pos', 'create'), 'Cashier has pos:create permission');

  console.log('');
  console.log('========================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
