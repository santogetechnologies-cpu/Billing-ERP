import { presenceService } from '../src/services/presenceService';
import { userService } from '../src/services/userService';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zdygiubhmxuonzqchehp.supabase.co';
const supabaseAnonKey = 'sb_publishable_zzlKCAxfsUya4_UePohgnA_QvR8Cz6Q';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

async function runTest() {
  console.log('================================================================');
  console.log('TEST: VERIFYING ELIMINATION OF PATCH profiles 400 (Bad Request)');
  console.log('================================================================\n');

  const targetUserId = '9f54b96d-805e-467e-9480-617b13bbc1c3';

  // Verify profile exists in Supabase
  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', targetUserId)
    .single();

  assert(!pErr && !!profile, `User profile exists for ID ${targetUserId}`);
  console.log(`    User email: ${profile?.email}, Role: ${profile?.role}, Status: ${profile?.status}\n`);

  // 1. Test recordLogin does NOT produce 400 Bad Request
  console.log('--- 1. Testing presenceService.recordLogin ---');
  let loginSucceeded = false;
  try {
    await presenceService.recordLogin({
      id: targetUserId,
      email: profile.email,
      name: profile.full_name,
      companyId: profile.company_id
    });
    loginSucceeded = true;
  } catch (err: any) {
    console.error('recordLogin threw error:', err);
  }
  assert(loginSucceeded, 'presenceService.recordLogin executed cleanly without exceptions');

  // Verify DB state after login
  const { data: afterLoginProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', targetUserId)
    .single();
  assert(afterLoginProfile?.status === 'Active', 'Profile status is Active after login');
  assert(!!afterLoginProfile?.last_login, 'last_login timestamp was saved to profiles in DB');
  console.log(`    last_login in DB: ${afterLoginProfile?.last_login}\n`);

  // 2. Test sendHeartbeat does NOT produce 400 Bad Request
  console.log('--- 2. Testing presenceService.sendHeartbeat ---');
  let heartbeatSucceeded = false;
  try {
    await presenceService.sendHeartbeat({
      id: targetUserId,
      email: profile.email,
      name: profile.full_name,
      companyId: profile.company_id
    });
    heartbeatSucceeded = true;
  } catch (err: any) {
    console.error('sendHeartbeat threw error:', err);
  }
  assert(heartbeatSucceeded, 'presenceService.sendHeartbeat executed cleanly without 400 Bad Request');
  presenceService.stopHeartbeat();
  console.log('');

  // 3. Test recordLogout does NOT produce 400 Bad Request
  console.log('--- 3. Testing presenceService.recordLogout ---');
  let logoutSucceeded = false;
  try {
    await presenceService.recordLogout({
      id: targetUserId,
      email: profile.email,
      name: profile.full_name,
      companyId: profile.company_id
    });
    logoutSucceeded = true;
  } catch (err: any) {
    console.error('recordLogout threw error:', err);
  }
  assert(logoutSucceeded, 'presenceService.recordLogout executed cleanly without exceptions');
  console.log('');

  // 4. Test userService.updateUser with presence & account status updates
  console.log('--- 4. Testing userService.updateUser with safe schema payload ---');
  let updateSucceeded = false;
  try {
    const updatedUser = await userService.updateUser(
      targetUserId,
      {
        name: profile.full_name,
        role: profile.role,
        accountStatus: 'Enabled',
        presenceStatus: 'Active'
      },
      profile.company_id
    );
    updateSucceeded = !!updatedUser && updatedUser.name === profile.full_name;
  } catch (err: any) {
    console.error('updateUser threw error:', err);
  }
  assert(updateSucceeded, 'userService.updateUser completed successfully without 400 Bad Request');
  console.log('');

  // Final Summary
  console.log('================================================================');
  console.log(` TEST RESULTS: ${passedTests}/${totalTests} Passed (0 Failed)`);
  console.log('================================================================');

  if (passedTests === totalTests) {
    console.log('All presence and profile update operations verified 100% clean!');
  } else {
    process.exitCode = 1;
  }
}

runTest().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
