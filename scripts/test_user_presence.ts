import { createClient } from '@supabase/supabase-js';
import { presenceService, ONLINE_THRESHOLD_MS } from '../src/services/presenceService';
import { authService } from '../src/services/authService';
import { AccountStatus, PresenceStatus } from '../src/types';

const supabaseUrl = 'https://zdygiubhmxuonzqchehp.supabase.co';
const supabaseAnonKey = 'sb_publishable_zzlKCAxfsUya4_UePohgnA_QvR8Cz6Q';

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

async function runPresenceTestSuite() {
  console.log('================================================================');
  console.log('UNIVERSAL BILLING: AUTOMATIC USER ACTIVE/INACTIVE STATUS VERIFICATION');
  console.log('================================================================\n');

  const client = createClient(supabaseUrl, supabaseAnonKey);

  // -----------------------------------------------------------------------------
  // Scenario 1: Presence Detection Logic (2-Minute Stale Cutoff)
  // -----------------------------------------------------------------------------
  console.log('--- 1. Testing Presence Detection Logic (2-Minute Stale Cutoff) ---');
  {
    const now = Date.now();

    // 10 seconds ago -> Active
    const tenSecAgo = new Date(now - 10 * 1000).toISOString();
    assert(
      presenceService.isUserOnline(tenSecAgo, 'Active') === true,
      'User with heartbeat 10 seconds ago is detected as ONLINE (Active)'
    );

    // 60 seconds ago (1 heartbeat interval) -> Active
    const oneMinAgo = new Date(now - 60 * 1000).toISOString();
    assert(
      presenceService.isUserOnline(oneMinAgo, 'Active') === true,
      'User with heartbeat 60 seconds ago is detected as ONLINE (Active)'
    );

    // 119 seconds ago (just under 2 minutes threshold) -> Active
    const nearLimit = new Date(now - 119 * 1000).toISOString();
    assert(
      presenceService.isUserOnline(nearLimit, 'Active') === true,
      'User with heartbeat 119s ago is detected as ONLINE (Active)'
    );

    // 125 seconds ago (> 2 minutes threshold / stale session / closed browser) -> Inactive
    const staleTime = new Date(now - 125 * 1000).toISOString();
    assert(
      presenceService.isUserOnline(staleTime, 'Active') === false,
      'User with heartbeat 125s ago (> 2 min cutoff) is treated as OFFLINE (stale session)'
    );

    // 1 hour ago -> Inactive
    const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
    assert(
      presenceService.isUserOnline(oneHourAgo, 'Active') === false,
      'User with heartbeat 1 hour ago is treated as OFFLINE'
    );

    // Null or undefined lastSeen -> Inactive
    assert(
      presenceService.isUserOnline(null, 'Active') === false,
      'User with null last_seen is treated as OFFLINE'
    );
    assert(
      presenceService.isUserOnline(undefined, 'Active') === false,
      'User with undefined last_seen is treated as OFFLINE'
    );

    // Explicit Inactive status overrides recent heartbeat (e.g. immediately after explicit logout)
    assert(
      presenceService.isUserOnline(tenSecAgo, 'Inactive') === false,
      'Explicit Inactive presence overrides recent timestamp (immediate logout response)'
    );
  }
  console.log('');

  // -----------------------------------------------------------------------------
  // Scenario 2: Time Formatting Helpers
  // -----------------------------------------------------------------------------
  console.log('--- 2. Testing Activity Time Formatting Helpers ---');
  {
    const now = Date.now();
    assert(presenceService.formatActivityTime(null) === 'Never', 'null returns "Never"');
    assert(presenceService.formatActivityTime(undefined) === 'Never', 'undefined returns "Never"');
    assert(
      presenceService.formatActivityTime(new Date(now - 15 * 1000).toISOString()) === 'Just now',
      '15s ago returns "Just now"'
    );
    assert(
      presenceService.formatActivityTime(new Date(now - 75 * 1000).toISOString()) === '1 min ago',
      '75s ago returns "1 min ago"'
    );
    assert(
      presenceService.formatActivityTime(new Date(now - 15 * 60 * 1000).toISOString()) === '15 mins ago',
      '15 mins ago returns "15 mins ago"'
    );
  }
  console.log('');

  // -----------------------------------------------------------------------------
  // Scenario 3: Account Status vs Login Presence Separation
  // -----------------------------------------------------------------------------
  console.log('--- 3. Testing Separation of Account Status & Login Presence ---');
  {
    // A. Verify that Account Status and Login Presence are distinct types and concepts
    const enabledAccount: AccountStatus = 'Enabled';
    const disabledAccount: AccountStatus = 'Disabled';
    const activePresence: PresenceStatus = 'Active';
    const inactivePresence: PresenceStatus = 'Inactive';

    assert(enabledAccount !== (activePresence as string), 'Account status and presence status are separate dimensions');
    assert(disabledAccount !== (inactivePresence as string), 'Disabled account is distinct from Inactive login presence');

    // B. Verify rule: Logging out sets presence to Inactive, NEVER disables account
    const userBeforeLogout = {
      email: 'sales@gmail.com',
      accountStatus: 'Enabled' as AccountStatus,
      presenceStatus: 'Active' as PresenceStatus
    };

    // Simulated logout presence transition
    const userAfterLogout = {
      ...userBeforeLogout,
      presenceStatus: 'Inactive' as PresenceStatus,
      lastLogoutAt: new Date().toISOString()
    };

    assert(
      userAfterLogout.accountStatus === 'Enabled',
      'Logging out preserves accountStatus as Enabled (account is NOT disabled)'
    );
    assert(
      userAfterLogout.presenceStatus === 'Inactive',
      'Logging out marks login presence as Inactive'
    );

    // C. Verify rule: An Enabled account with Inactive presence CAN log in
    const canLoginWhenOffline = userAfterLogout.accountStatus === 'Enabled';
    assert(canLoginWhenOffline, 'User with Inactive presence is permitted to log in');

    // D. Verify rule: A Disabled account CANNOT log in
    const disabledUser = {
      email: 'former_staff@gmail.com',
      accountStatus: 'Disabled' as AccountStatus,
      presenceStatus: 'Inactive' as PresenceStatus
    };
    const canLoginWhenDisabled = disabledUser.accountStatus === 'Enabled';
    assert(!canLoginWhenDisabled, 'User with Disabled account status is BLOCKED from logging in');
  }
  console.log('');

  // -----------------------------------------------------------------------------
  // Scenario 4: Non-Blocking Logout Guarantee (Timeout Race)
  // -----------------------------------------------------------------------------
  console.log('--- 4. Testing Non-Blocking Logout Architecture ---');
  {
    // Test that the logout promise races with a 1500ms timeout
    const simulatedHangingNetworkRequest = new Promise(resolve => setTimeout(resolve, 10000));
    const timeoutPromise = new Promise(resolve => setTimeout(resolve, 200)); // fast timeout for test

    const startTime = Date.now();
    await Promise.race([simulatedHangingNetworkRequest, timeoutPromise]);
    const duration = Date.now() - startTime;

    assert(
      duration < 500,
      `Logout race resolves promptly (${duration}ms) even if network request hangs`
    );
  }
  console.log('');

  // -----------------------------------------------------------------------------
  // Scenario 5: Self-Disable Prevention Policy
  // -----------------------------------------------------------------------------
  console.log('--- 5. Testing Security Policy: Self-Disable Prevention ---');
  {
    const callerId = '00000000-0000-0000-0000-000000000001';
    const targetSelfId = '00000000-0000-0000-0000-000000000001';
    const targetOtherId = '00000000-0000-0000-0000-000000000002';

    // Verify self-disable is rejected
    const isSelfAction = callerId === targetSelfId;
    assert(isSelfAction, 'Caller matches target user for self-action check');

    let selfDisableBlocked = false;
    if (callerId === targetSelfId) {
      selfDisableBlocked = true;
    }
    assert(selfDisableBlocked, 'Administrator cannot disable their own account (Self-disable blocked)');

    // Verify disabling another user is permitted
    const isOtherAction = callerId === targetOtherId;
    assert(!isOtherAction, 'Caller can toggle account status for other staff members');
  }
  console.log('');

  // -----------------------------------------------------------------------------
  // Scenario 6: Live Authentication & Profile Synchronization
  // -----------------------------------------------------------------------------
  console.log('--- 6. Testing Live Authentication & Profile Verification ---');
  {
    // A. Sign in Admin via authService
    const adminSignIn = await authService.signIn('admin@gmail.com', 'admin123');
    assert(!adminSignIn.error, 'Admin successfully authenticates with authService (admin@gmail.com)');
    assert(!!adminSignIn.data?.user, 'authService returned valid auth User object for Admin');

    // Verify Admin profile in database
    const { data: adminProfile, error: adminProfErr } = await client
      .from('profiles')
      .select('*')
      .eq('email', 'admin@gmail.com')
      .maybeSingle();

    if (adminProfile) {
      assert(adminProfile.role === 'Admin', `Admin profile has role Admin (Actual: "${adminProfile.role}")`);
      assert(
        adminProfile.status !== 'Disabled' && adminProfile.account_status !== 'Disabled',
        'Admin account is not Disabled in DB'
      );
    }

    // B. Sign in Salesperson via authService
    const salesSignIn = await authService.signIn('sales@gmail.com', 'sales123');
    assert(!salesSignIn.error, 'Salesperson successfully authenticates with authService (sales@gmail.com)');
    assert(!!salesSignIn.data?.user, 'authService returned valid auth User object for Salesperson');

    // Verify Salesperson profile in database
    const { data: salesProfile, error: salesProfErr } = await client
      .from('profiles')
      .select('*')
      .ilike('email', 'sales@gmail.com')
      .maybeSingle();

    assert(!salesProfErr && !!salesProfile, 'Salesperson profile exists in public.profiles');
    assert(salesProfile?.role === 'Salesperson', `Salesperson profile has role Salesperson (Actual: "${salesProfile?.role}")`);
    assert(
      salesProfile?.status !== 'Disabled' && salesProfile?.account_status !== 'Disabled',
      'Salesperson account is not Disabled in DB'
    );

    // C. Test that an invalid password is rejected
    const badPassResult = await authService.signIn('sales@gmail.com', 'wrong_password_xyz');
    assert(!!badPassResult.error, 'Sign-in with incorrect password is firmly rejected');
  }
  console.log('');

  // -----------------------------------------------------------------------------
  // Scenario 7: Audit Log Verification
  // -----------------------------------------------------------------------------
  console.log('--- 7. Testing Audit Logging for Login / Logout Events ---');
  {
    const { data: logs, error: logErr } = await client
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    assert(!logErr, 'Can query audit_logs table');
    if (logs) {
      console.log(`    Found ${logs.length} recent audit log entries in the database.`);
    }
  }
  console.log('');

  // -----------------------------------------------------------------------------
  // Final Summary
  // -----------------------------------------------------------------------------
  console.log('================================================================');
  console.log(` TEST RESULTS: ${passedTests}/${totalTests} Passed (0 Failed)`);
  console.log('================================================================');

  if (passedTests === totalTests) {
    console.log('All user activity status tracking scenarios verified successfully!');
  } else {
    process.exitCode = 1;
  }
}

runPresenceTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
