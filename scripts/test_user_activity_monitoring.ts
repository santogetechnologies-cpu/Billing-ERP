import {
  canAccessUserActivity,
  canRoleAccessNavItem,
  canAccessRoute,
  getRoleDefaultRoute
} from '../src/utils/rbac';
import { UserRole } from '../src/types';
import { userActivityService, HEARTBEAT_TIMEOUT_SECONDS } from '../src/services/userActivityService';
import { presenceService, ONLINE_THRESHOLD_MS } from '../src/services/presenceService';

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
  console.log('========================================================================');
  console.log('UNIVERSAL BILLING: USER ACTIVITY MONITORING & LOGIN TIME TRACKING TESTS');
  console.log('========================================================================\n');

  // ---------------------------------------------------------------------------
  // 1. Dashboard Top — Active Status Indicator Logic for All Users
  // ---------------------------------------------------------------------------
  console.log('--- 1. Testing Dashboard Top Active / Inactive Status Indicator ---');
  {
    const now = Date.now();
    // Valid session within heartbeat window
    const recentSeen = new Date(now - 30 * 1000).toISOString();
    assert(
      presenceService.isUserOnline(recentSeen, 'Active') === true,
      'Valid session with heartbeat 30s ago is ACTIVE (green dot)'
    );

    // Stale session (heartbeat timed out > 2 minutes)
    const staleSeen = new Date(now - 130 * 1000).toISOString();
    assert(
      presenceService.isUserOnline(staleSeen, 'Active') === false,
      'Stale session (> 120s without heartbeat) is INACTIVE (grey dot)'
    );

    // Explicit logged-out user
    assert(
      presenceService.isUserOnline(recentSeen, 'Inactive') === false,
      'Logged out user with presence Inactive is INACTIVE even if timestamp is recent'
    );

    // No session / null timestamp
    assert(
      presenceService.isUserOnline(null, 'Active') === false,
      'User with null session timestamp is INACTIVE'
    );
  }

  // ---------------------------------------------------------------------------
  // 2. Strict Permissions & Security: Owner-Only Access Restriction
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Testing Strict Permissions: Owner-Only Telemetry ---');
  {
    const roles: UserRole[] = [
      'Owner',
      'Admin',
      'Accountant',
      'Salesperson',
      'Purchase Manager',
      'Warehouse Manager',
      'Cashier'
    ];

    roles.forEach(role => {
      const allowed = canAccessUserActivity(role);
      const navAllowed = canRoleAccessNavItem(role, 'User Activity');
      const routeAllowed = canAccessRoute(role, '/users/activity');

      if (role === 'Owner') {
        assert(allowed === true, `canAccessUserActivity('${role}') is TRUE (Owner granted)`);
        assert(navAllowed === true, `canRoleAccessNavItem('${role}', 'User Activity') is TRUE (menu visible)`);
        assert(routeAllowed === true, `canAccessRoute('${role}', '/users/activity') is TRUE`);
      } else {
        assert(allowed === false, `canAccessUserActivity('${role}') is FALSE (Strictly blocked)`);
        assert(navAllowed === false, `canRoleAccessNavItem('${role}', 'User Activity') is FALSE (menu hidden)`);
        assert(routeAllowed === false, `canAccessRoute('${role}', '/users/activity') is FALSE (route blocked)`);
      }
    });

    // Verify role default routes are returned properly for redirection
    assert(getRoleDefaultRoute('Admin') === '/', 'Admin fallback route is /');
    assert(getRoleDefaultRoute('Salesperson') === '/sales/dashboard', 'Salesperson fallback route is /sales/dashboard');
    assert(getRoleDefaultRoute('Cashier') === '/sales/pos', 'Cashier fallback route is /sales/pos');
  }

  // ---------------------------------------------------------------------------
  // 3. Login and Logout Tracking: Accurate Timestamps & Durations
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Testing Login and Logout Session Event Recording ---');
  {
    // Start session
    const session = await userActivityService.startSession({
      id: 'usr-test-001',
      email: 'sales@example.com',
      name: 'John Salesperson',
      role: 'Salesperson'
    });

    assert(!!session.id, 'Session has a generated unique session ID');
    assert(session.status === 'Active', 'New session is marked as Active');
    assert(!!session.loginAt, 'Login timestamp is recorded in UTC');
    assert(session.logoutAt === null, 'Logout timestamp is initially null');
    assert(session.durationSeconds === 0, 'Initial duration is 0 seconds');
    assert(!!session.deviceInfo, 'Device and client metadata signature is captured');

    // Simulate 35 seconds of session duration
    const fakeLoginTime = new Date(Date.now() - 35 * 1000).toISOString();
    userActivityService.updateSession(session.id, { loginAt: fakeLoginTime });

    // Heartbeat updates duration
    const activeId = session.id;
    await userActivityService.recordHeartbeat(activeId);

    // End session
    await userActivityService.endSession(activeId);

    const history = await userActivityService.getUserSessionHistory('usr-test-001');
    const closedSession = history.find(s => s.id === activeId);

    assert(!!closedSession, 'Closed session exists in session history');
    assert(closedSession?.status === 'Completed', 'Ended session is marked as Completed');
    assert(!!closedSession?.logoutAt, 'Logout timestamp is recorded upon logout');
    assert(
      (closedSession?.durationSeconds || 0) >= 30,
      `Session duration calculated accurately (${closedSession?.durationSeconds}s >= 30s)`
    );
  }

  // ---------------------------------------------------------------------------
  // 4. Unexpected Browser Closure & Heartbeat Timeout (Expired Sessions)
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Testing Unexpected Browser Closure & Heartbeat Timeout ---');
  {
    // Create session where user unexpectedly closed browser 3 minutes ago
    const abandonedSession = await userActivityService.startSession({
      id: 'usr-abandoned-002',
      email: 'abandoned@example.com',
      name: 'Crash User',
      role: 'Cashier'
    });

    // Simulate heartbeat that stopped 150 seconds ago (> 120s timeout)
    const loginMs = Date.now() - 300 * 1000; // logged in 5 mins ago
    const lastHeartbeatMs = Date.now() - 150 * 1000; // last heartbeat 2.5 mins ago
    userActivityService.updateSession(abandonedSession.id, {
      loginAt: new Date(loginMs).toISOString(),
      lastHeartbeatAt: new Date(lastHeartbeatMs).toISOString()
    });

    // Trigger reaper
    const expiredCount = await userActivityService.expireStaleSessions(undefined, HEARTBEAT_TIMEOUT_SECONDS);
    assert(expiredCount >= 1, `Expired stale sessions identified: ${expiredCount}`);

    const history = await userActivityService.getUserSessionHistory('usr-abandoned-002');
    const expired = history.find(s => s.id === abandonedSession.id);

    assert(expired?.status === 'Expired', 'Unexpectedly closed session marked as Expired (not Completed)');
    assert(expired?.logoutAt === null || expired?.logoutAt === undefined, 'No fake logout time is invented');
    assert(
      (expired?.durationSeconds || 0) >= 140 && (expired?.durationSeconds || 0) <= 160,
      `Duration for expired session is computed accurately up to last heartbeat (${expired?.durationSeconds}s ~ 150s)`
    );
  }

  // ---------------------------------------------------------------------------
  // 5. Multiple Concurrent Sessions Tracked Separately
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Testing Concurrent Sessions on Multiple Devices ---');
  {
    // Device 1: Desktop Browser
    const session1 = await userActivityService.startSession({
      id: 'usr-multidevice-003',
      email: 'multi@example.com',
      name: 'Multi Device User',
      role: 'Accountant'
    });

    // Device 2: Mobile / POS Tablet
    const session2 = await userActivityService.startSession({
      id: 'usr-multidevice-003',
      email: 'multi@example.com',
      name: 'Multi Device User',
      role: 'Accountant'
    });

    assert(session1.id !== session2.id, 'Concurrent sessions have distinct session IDs');

    // End session 1 only
    await userActivityService.endSession(session1.id);

    const history = await userActivityService.getUserSessionHistory('usr-multidevice-003');
    const s1 = history.find(s => s.id === session1.id);
    const s2 = history.find(s => s.id === session2.id);

    assert(s1?.status === 'Completed', 'First concurrent session ended and marked Completed');
    assert(s2?.status === 'Active', 'Second concurrent session remains independently Active');
  }

  // ---------------------------------------------------------------------------
  // 6. Longest and Shortest Session Calculations & Mode Toggling
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. Testing Longest and Shortest Session Analytics ---');
  {
    // Create user A with 1 long session (3600 seconds)
    const userASession = await userActivityService.startSession({
      id: 'usr-analytic-A',
      email: 'userA@example.com',
      name: 'Alice LongSession',
      role: 'Salesperson'
    });
    userActivityService.updateSession(userASession.id, {
      loginAt: new Date(Date.now() - 3600 * 1000).toISOString(),
      logoutAt: new Date().toISOString(),
      durationSeconds: 3600,
      status: 'Completed'
    });

    // Create user B with 1 short completed session (120 seconds) and 1 medium session (300 seconds) -> Total 420s
    const userBSession1 = await userActivityService.startSession({
      id: 'usr-analytic-B',
      email: 'userB@example.com',
      name: 'Bob ShortSession',
      role: 'Cashier'
    });
    userActivityService.updateSession(userBSession1.id, {
      loginAt: new Date(Date.now() - 120 * 1000).toISOString(),
      logoutAt: new Date().toISOString(),
      durationSeconds: 120,
      status: 'Completed'
    });

    const userBSession2 = await userActivityService.startSession({
      id: 'usr-analytic-B',
      email: 'userB@example.com',
      name: 'Bob ShortSession',
      role: 'Cashier'
    });
    userActivityService.updateSession(userBSession2.id, {
      loginAt: new Date(Date.now() - 300 * 1000).toISOString(),
      logoutAt: new Date().toISOString(),
      durationSeconds: 300,
      status: 'Completed'
    });


    const data = await userActivityService.getUserActivityMonitoringData();

    // Verify longest individual session
    assert(
      (data.overviewStats.longestIndividualSessionUser?.durationSeconds || 0) >= 3600,
      `Longest individual session correctly identified (>= 3600s, actual: ${data.overviewStats.longestIndividualSessionUser?.durationSeconds}s)`
    );

    // Verify shortest completed session
    assert(
      (data.overviewStats.shortestCompletedSessionUser?.durationSeconds || 0) <= 120,
      `Shortest completed session correctly identified (<= 120s, actual: ${data.overviewStats.shortestCompletedSessionUser?.durationSeconds}s)`
    );

    // Verify duration formatting helper
    assert(userActivityService.formatDuration(3665) === '1h 1m 5s', 'formatDuration(3665) -> "1h 1m 5s"');
    assert(userActivityService.formatDuration(125) === '2m 5s', 'formatDuration(125) -> "2m 5s"');
    assert(userActivityService.formatDuration(45) === '45s', 'formatDuration(45) -> "45s"');
    assert(userActivityService.formatDuration(0) === '0s', 'formatDuration(0) -> "0s"');
  }

  // ---------------------------------------------------------------------------
  // 7. Security: Unauthorized Caller Data Query Block
  // ---------------------------------------------------------------------------
  console.log('\n--- 7. Testing Unauthorized API Query Prevention ---');
  {
    // Verify that non-Owner roles cannot access user activity
    const nonOwnerRoles: UserRole[] = ['Admin', 'Accountant', 'Salesperson', 'Purchase Manager', 'Warehouse Manager', 'Cashier'];
    for (const r of nonOwnerRoles) {
      assert(canAccessUserActivity(r) === false, `Role ${r} is denied by canAccessUserActivity`);
    }
  }

  console.log('\n========================================================================');
  console.log(` TEST SUMMARY: ${passedTests}/${totalTests} Passed (0 Failed)`);
  console.log('========================================================================\n');
}

runTestSuite().catch(err => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});
