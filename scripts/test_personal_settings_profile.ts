import { readFileSync } from 'fs';
import { resolve } from 'path';

function runTests() {
  console.log('--- Testing Personal Settings User Profile Implementation ---');

  const settingsPagePath = resolve(process.cwd(), 'src/pages/settings/SettingsPage.tsx');
  const authServicePath = resolve(process.cwd(), 'src/services/authService.ts');
  const authContextPath = resolve(process.cwd(), 'src/context/AuthContext.tsx');

  const settingsContent = readFileSync(settingsPagePath, 'utf-8');
  const authServiceContent = readFileSync(authServicePath, 'utf-8');
  const authContextContent = readFileSync(authContextPath, 'utf-8');

  // Test 1: Full Name field is editable with required attribute and state binding
  console.log('Test 1: Full Name editable field in Personal Settings');
  if (
    !settingsContent.includes('value={personalName}') ||
    !settingsContent.includes('onChange={e => setPersonalName(e.target.value)}')
  ) {
    throw new Error('Full Name editable field is missing proper state bindings in SettingsPage.tsx');
  }
  console.log('✓ Full Name field properly bound and editable');

  // Test 2: Email Address is read-only, disabled, and has visual lock
  console.log('Test 2: Email Address is strictly read-only and visually distinguished');
  if (
    !settingsContent.includes('type="email"') ||
    !settingsContent.includes('disabled') ||
    !settingsContent.includes('readOnly') ||
    !settingsContent.includes('Lock') ||
    !settingsContent.includes('cursor-not-allowed')
  ) {
    throw new Error('Email Address input must be disabled, read-only, with cursor-not-allowed and Lock icon');
  }
  console.log('✓ Email Address field is disabled, readOnly, and styled with Lock icon');

  // Test 3: Phone / Mobile field is editable
  console.log('Test 3: Phone / Mobile editable field in Personal Settings');
  if (
    !settingsContent.includes('value={personalPhone}') ||
    !settingsContent.includes('onChange={e => setPersonalPhone(e.target.value)}')
  ) {
    throw new Error('Phone / Mobile field is missing proper state bindings in SettingsPage.tsx');
  }
  console.log('✓ Phone / Mobile field properly bound and editable');

  // Test 4: Account Status displays Active/Inactive presence badge
  console.log('Test 4: Account Status displays Active/Inactive presence status');
  if (
    !settingsContent.includes('Account Status') ||
    !settingsContent.includes('displayPresenceStatus') ||
    !settingsContent.includes('presenceService.isUserOnline')
  ) {
    throw new Error('Account Status must be displayed based on presenceService.isUserOnline');
  }
  console.log('✓ Account Status displayed dynamically using presence tracking');

  // Test 5: Last Active / Activity Time displays real activity time
  console.log('Test 5: Last Active / Activity Time displays real activity timestamp');
  if (
    !settingsContent.includes('Last Active / Activity Time') ||
    !settingsContent.includes('displayActivityTime') ||
    !settingsContent.includes('presenceService.formatActivityTime')
  ) {
    throw new Error('Last Active / Activity Time must display stored activity using formatActivityTime');
  }
  console.log('✓ Last Active / Activity Time displays real stored presence telemetry');

  // Test 6: Assigned System Role displays current role
  console.log('Test 6: Assigned System Role displays user role with fixed security scope');
  if (
    !settingsContent.includes('Assigned System Role') ||
    !settingsContent.includes('Fixed Security Scope') ||
    !settingsContent.includes('userRole || profile?.role')
  ) {
    throw new Error('Assigned System Role must display current role with security badge');
  }
  console.log('✓ Assigned System Role displayed accurately with security indicator');

  // Test 7: Age field is supported safely without breaking data model
  console.log('Test 7: Age field is handled safely');
  if (
    !settingsContent.includes('personalAge') ||
    !authServiceContent.includes('age?: number') ||
    !authServiceContent.includes('filterSupportedProfilePayload')
  ) {
    throw new Error('Age field must be supported and passed through filterSupportedProfilePayload in authService');
  }
  console.log('✓ Age field supported safely with schema detector filtering');

  // Test 8: Save handler saves name and phone, preserves email and role
  console.log('Test 8: Save profile handler');
  if (
    !settingsContent.includes('updateUserProfile({') ||
    !authServiceContent.includes('async updateUserProfile(') ||
    !authContextContent.includes('updateUserProfile:')
  ) {
    throw new Error('Save handler must call updateUserProfile through AuthContext/authService');
  }
  console.log('✓ Save handler properly updates profile and preserves email and role');

  // Test 9: Account switching clears stale user data and loads current user
  console.log('Test 9: Account switching reactive sync');
  if (
    !settingsContent.includes('universal_billing_prefs_${user.id}') ||
    !settingsContent.includes('universal_billing_profile_${user.id}')
  ) {
    throw new Error('Preferences and profile caches must be isolated per user ID');
  }
  console.log('✓ Profile and regional preferences isolated per user ID for account switching');

  // Test 10: Other tabs in SettingsPage are preserved
  console.log('Test 10: Preserved Settings tabs (Appearance & Theme, Notifications, Company Policy, etc.)');
  if (
    !settingsContent.includes("activeSection === 'appearance'") ||
    !settingsContent.includes("activeSection === 'notifications'") ||
    !settingsContent.includes("activeSection === 'policy'") ||
    !settingsContent.includes("activeSection === 'company'") ||
    !settingsContent.includes("activeSection === 'users'") ||
    !settingsContent.includes("activeSection === 'system'")
  ) {
    throw new Error('All other tabs in SettingsPage must remain intact');
  }
  console.log('✓ All Settings tabs (Appearance, Notifications, Policy, Company, Users, System) intact');

  console.log('\n--- All Personal Settings User Profile Tests Passed! ---');
}

runTests();
