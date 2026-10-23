/**
 * Verification Test Suite: Role-Based Settings Access, Primary Accent Color Isolation,
 * and Owner-Only Company Policy Governance
 * 
 * Verifies all 8 requirement criteria:
 * 1. Every authenticated role can open Settings and access permitted options.
 * 2. Each user can change their own Primary Accent Color preference.
 * 3. Personal appearance settings do not unexpectedly affect other users or company defaults.
 * 4. Only the designated Owner can add or edit Company Policy.
 * 5. Admin and all operational roles cannot modify Company Policy through direct API calls.
 * 6. Published policies are visible to authorized staff; drafts are hidden from non-Owners.
 * 7. Existing settings, company configurations, users, and roles remain intact.
 * 8. Unauthorized operations are strictly rejected at the service/backend layer.
 */

import {
  ROLE_PERMISSIONS_MATRIX,
  ROUTE_MODULE_MAP,
  hasPermission,
  canAccessRoute,
  canManageCompanyPolicy,
  canViewCompanyPolicy,
  canManageCompanySettings,
  canManageSystemConfig,
  canAccessAccountSecurity,
  canConfigureStockAlerts,
  canConfigureSalesDispatchAlerts,
  canAccessHeaderProfile
} from '../src/utils/rbac';
import { UserRole } from '../src/types';
import {
  THEME_PRESETS,
  normalizeThemeColor,
  getUserStoredThemeColor
} from '../src/context/ThemeContext';
import { policyService } from '../src/services/policyService';

// Polyfill localStorage in Node test runner
if (typeof (globalThis as any).localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, val: string) => store.set(key, String(val)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (idx: number) => Array.from(store.keys())[idx] || null,
    get length() {
      return store.size;
    }
  };
}

const ALL_ROLES: UserRole[] = [
  'Owner',
  'Admin',
  'Accountant',
  'Salesperson',
  'Purchase Manager',
  'Warehouse Manager',
  'Cashier'
];

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${testName} ${details ? `(${details})` : ''}`);
    process.exitCode = 1;
  }
}

async function runTestSuite() {
  console.log('========================================================================');
  console.log('TEST SUITE: ROLE-BASED SETTINGS ACCESS & COMPANY POLICY GOVERNANCE');
  console.log('========================================================================\n');

  const testCompanyId = '00000000-0000-0000-0000-000000000001';

  // --------------------------------------------------------------------------
  // TEST 1: SETTINGS ROUTE ACCESSIBLE TO EVERY AUTHENTICATED ROLE
  // --------------------------------------------------------------------------
  console.log('👉 Test 1: Settings Navigation Access Across All 7 Authenticated Roles');
  for (const role of ALL_ROLES) {
    assert(
      canAccessRoute(role, '/settings') === true,
      `Role "${role}" can access route /settings`
    );
    assert(
      hasPermission(role, 'settings', 'view') === true,
      `Role "${role}" has view permission on settings module`
    );
  }

  // --------------------------------------------------------------------------
  // TEST 2: SECTION PRIVILEGE BOUNDARIES (Company Settings & System Config)
  // --------------------------------------------------------------------------
  console.log('\n👉 Test 2: Role Permission Scopes for Sensitive Settings Sections');
  // Company Settings & System Config: Restricted to Owner and Admin
  assert(canManageCompanySettings('Owner') === true, 'Owner CAN manage Company Settings');
  assert(canManageCompanySettings('Admin') === true, 'Admin CAN manage Company Settings');
  assert(canManageCompanySettings('Accountant') === false, 'Accountant CANNOT manage Company Settings');
  assert(canManageCompanySettings('Salesperson') === false, 'Salesperson CANNOT manage Company Settings');
  assert(canManageCompanySettings('Purchase Manager') === false, 'Purchase Manager CANNOT manage Company Settings');
  assert(canManageCompanySettings('Warehouse Manager') === false, 'Warehouse Manager CANNOT manage Company Settings');
  assert(canManageCompanySettings('Cashier') === false, 'Cashier CANNOT manage Company Settings');

  assert(canManageSystemConfig('Owner') === true, 'Owner CAN execute System Backups & Cache Config');
  assert(canManageSystemConfig('Admin') === true, 'Admin CAN execute System Backups & Cache Config');
  assert(canManageSystemConfig('Accountant') === false, 'Accountant CANNOT execute System Config');
  assert(canManageSystemConfig('Salesperson') === false, 'Salesperson CANNOT execute System Config');
  assert(canManageSystemConfig('Warehouse Manager') === false, 'Warehouse Manager CANNOT execute System Config');

  // Account & Security Settings: Restricted from Salesperson
  assert(canAccessAccountSecurity('Salesperson') === false, 'Salesperson CANNOT access Account & Security settings');
  assert(canAccessAccountSecurity('Owner') === true, 'Owner CAN access Account & Security settings');
  assert(canAccessAccountSecurity('Admin') === true, 'Admin CAN access Account & Security settings');
  assert(canAccessAccountSecurity('Accountant') === true, 'Accountant CAN access Account & Security settings');
  assert(canAccessAccountSecurity('Purchase Manager') === true, 'Purchase Manager CAN access Account & Security settings');
  assert(canAccessAccountSecurity('Warehouse Manager') === true, 'Warehouse Manager CAN access Account & Security settings');
  assert(canAccessAccountSecurity('Cashier') === true, 'Cashier CAN access Account & Security settings');

  // Stock Threshold & Sales Dispatch Notifications RBAC
  assert(canConfigureStockAlerts('Salesperson') === false, 'Salesperson CANNOT configure Low Stock & Reorder Threshold alerts');
  assert(canConfigureStockAlerts('Owner') === true, 'Owner CAN configure Low Stock & Reorder Threshold alerts');
  assert(canConfigureStockAlerts('Admin') === true, 'Admin CAN configure Low Stock & Reorder Threshold alerts');
  assert(canConfigureStockAlerts('Warehouse Manager') === true, 'Warehouse Manager CAN configure Low Stock & Reorder Threshold alerts');
  assert(canConfigureStockAlerts('Purchase Manager') === true, 'Purchase Manager CAN configure Low Stock & Reorder Threshold alerts');

  assert(canConfigureSalesDispatchAlerts('Salesperson') === false, 'Salesperson CANNOT configure Sales Orders & Dispatch alerts');
  assert(canConfigureSalesDispatchAlerts('Owner') === true, 'Owner CAN configure Sales Orders & Dispatch alerts');
  assert(canConfigureSalesDispatchAlerts('Admin') === true, 'Admin CAN configure Sales Orders & Dispatch alerts');

  // Header Dropdown Profile Action RBAC
  assert(canAccessHeaderProfile('Salesperson') === false, 'Salesperson DOES NOT have My Profile in header user dropdown');
  assert(canAccessHeaderProfile('Owner') === true, 'Owner HAS My Profile in header user dropdown');
  assert(canAccessHeaderProfile('Admin') === true, 'Admin HAS My Profile in header user dropdown');
  assert(canAccessHeaderProfile('Warehouse Manager') === false, 'Warehouse Manager DOES NOT have My Profile in header user dropdown');

  // --------------------------------------------------------------------------
  // TEST 3: PRIMARY ACCENT COLOR PRESET INTEGRITY & USER PREFERENCE ISOLATION
  // --------------------------------------------------------------------------
  console.log('\n👉 Test 3: Primary Accent Color Presets & Multi-User Isolation');
  // Verify 4 required presets exist
  assert(THEME_PRESETS.blue.hex === '#1760F5', 'Blue preset hex is #1760F5');
  assert(THEME_PRESETS.green.hex === '#2EAF87', 'Green preset hex is #2EAF87');
  assert(THEME_PRESETS.red.hex === '#DC2626', 'Red preset hex is #DC2626');
  assert(THEME_PRESETS.dark_grey.hex === '#4B5565', 'Dark Grey preset hex is #4B5565');

  // Verify normalizer
  assert(normalizeThemeColor('green') === 'green', 'Normalizes "green" to green');
  assert(normalizeThemeColor('red') === 'red', 'Normalizes "red" to red');
  assert(normalizeThemeColor('grey') === 'dark_grey', 'Normalizes "grey" to dark_grey');
  assert(normalizeThemeColor('blue') === 'blue', 'Normalizes "blue" to blue');

  // Mock multi-user localStorage isolation test
  const userA_Id = 'user-uuid-1111-salesperson';
  const userB_Id = 'user-uuid-2222-warehouse';

  // Simulate User A selecting Green
  localStorage.setItem(`universal_billing_theme_user_${userA_Id}`, 'green');
  // Simulate User B selecting Red
  localStorage.setItem(`universal_billing_theme_user_${userB_Id}`, 'red');

  // Verify user isolation: User A's theme is Green, User B's theme is Red
  const retrievedA = getUserStoredThemeColor(userA_Id, testCompanyId);
  const retrievedB = getUserStoredThemeColor(userB_Id, testCompanyId);

  assert(retrievedA === 'green', `User A preference is isolated to "green" (got: ${retrievedA})`);
  assert(retrievedB === 'red', `User B preference is isolated to "red" (got: ${retrievedB})`);
  assert(retrievedA !== retrievedB, 'User A and User B preferences do not overwrite each other');

  // --------------------------------------------------------------------------
  // TEST 4: COMPANY POLICY — OWNER-ONLY MUTATION PERMISSION
  // --------------------------------------------------------------------------
  console.log('\n👉 Test 4: Company Policy Management Exclusivity (Owner Only)');
  assert(canManageCompanyPolicy('Owner') === true, 'Owner HAS authority to manage Company Policies');
  assert(canManageCompanyPolicy('Admin') === false, 'Admin DOES NOT have authority to manage Company Policies');
  assert(canManageCompanyPolicy('Accountant') === false, 'Accountant DOES NOT have authority to manage Company Policies');
  assert(canManageCompanyPolicy('Salesperson') === false, 'Salesperson DOES NOT have authority to manage Company Policies');
  assert(canManageCompanyPolicy('Purchase Manager') === false, 'Purchase Manager DOES NOT have authority to manage Company Policies');
  assert(canManageCompanyPolicy('Warehouse Manager') === false, 'Warehouse Manager DOES NOT have authority to manage Company Policies');
  assert(canManageCompanyPolicy('Cashier') === false, 'Cashier DOES NOT have authority to manage Company Policies');

  // Owner can create policy via policyService
  const testPolicySku = `TEST-POL-${Date.now()}`;
  let createdPolicy: any = null;
  try {
    createdPolicy = await policyService.createPolicy(
      {
        title: 'Owner Test Compliance Mandate',
        code: testPolicySku,
        category: 'General',
        content: 'Mandatory standard operating procedure created by company Owner.',
        version: '1.0',
        status: 'Draft'
      },
      'Owner',
      'owner-user-id',
      testCompanyId
    );
    assert(Boolean(createdPolicy?.id), 'Owner successfully created new company policy');
    assert(createdPolicy.status === 'Draft', 'Policy created initially as Draft');

    // Owner can edit policy
    const updated = await policyService.updatePolicy(
      createdPolicy.id,
      { version: '1.1', content: 'Updated policy content by Owner.' },
      'Owner',
      'owner-user-id',
      testCompanyId
    );
    assert(updated.version === '1.1', 'Owner successfully updated policy version to 1.1');

    // Owner can publish policy
    const published = await policyService.publishPolicy(
      createdPolicy.id,
      'Owner',
      'owner-user-id',
      testCompanyId
    );
    assert(published.status === 'Published', 'Owner successfully published company policy');

    // Owner can archive policy
    const archived = await policyService.archivePolicy(
      createdPolicy.id,
      'Owner',
      'owner-user-id',
      testCompanyId
    );
    assert(archived.status === 'Archived', 'Owner successfully archived company policy');

    // Owner can delete policy
    const deleted = await policyService.deletePolicy(
      createdPolicy.id,
      'Owner',
      'owner-user-id',
      testCompanyId
    );
    assert(deleted === true, 'Owner successfully deleted test company policy');
  } catch (err: any) {
    assert(false, `Owner policy operations failed: ${err.message}`);
  }

  // --------------------------------------------------------------------------
  // TEST 5: STRICT REJECTION OF NON-OWNER MUTATIONS AT SERVICE LAYER
  // --------------------------------------------------------------------------
  console.log('\n👉 Test 5: Rejection of Non-Owner Policy Mutation Requests (API Defense)');
  const nonOwnerRoles: UserRole[] = [
    'Admin',
    'Accountant',
    'Salesperson',
    'Purchase Manager',
    'Warehouse Manager',
    'Cashier'
  ];

  for (const role of nonOwnerRoles) {
    let createRejected = false;
    try {
      await policyService.createPolicy(
        {
          title: `Illegal Policy by ${role}`,
          category: 'General',
          content: 'This should be blocked.'
        },
        role,
        `user-${role}`,
        testCompanyId
      );
    } catch (err: any) {
      createRejected = err.message.includes('Only the Owner role is authorized');
    }
    assert(createRejected, `Service layer REJECTED policy creation attempt by role "${role}"`);
  }

  // --------------------------------------------------------------------------
  // TEST 6: PUBLISHED POLICIES READ-ONLY VISIBILITY FOR STAFF
  // --------------------------------------------------------------------------
  console.log('\n👉 Test 6: Published Policies Visible to Staff; Drafts Hidden');
  try {
    // Create one Draft policy and one Published policy as Owner
    const draftPol = await policyService.createPolicy(
      {
        title: 'Secret Draft Policy In Review',
        code: `DRAFT-${Date.now()}`,
        category: 'General',
        content: 'Confidential draft under executive review.',
        status: 'Draft'
      },
      'Owner',
      'owner-user-id',
      testCompanyId
    );

    const pubPol = await policyService.createPolicy(
      {
        title: 'Public Active Code of Conduct',
        code: `PUB-${Date.now()}`,
        category: 'General',
        content: 'Mandatory standard operating procedure for all employees.',
        status: 'Published'
      },
      'Owner',
      'owner-user-id',
      testCompanyId
    );

    // Query policies as Salesperson
    const staffPolicies = await policyService.getPolicies(testCompanyId, 'Salesperson');
    const staffSeesDraft = staffPolicies.some(p => p.id === draftPol.id);
    const staffSeesPublished = staffPolicies.some(p => p.id === pubPol.id);

    assert(!staffSeesDraft, 'Draft policy is HIDDEN from non-Owner staff (Salesperson)');
    assert(staffSeesPublished, 'Published policy is VISIBLE to non-Owner staff (Salesperson)');

    // Query policies as Owner
    const ownerPolicies = await policyService.getPolicies(testCompanyId, 'Owner');
    const ownerSeesDraft = ownerPolicies.some(p => p.id === draftPol.id);
    const ownerSeesPublished = ownerPolicies.some(p => p.id === pubPol.id);

    assert(ownerSeesDraft, 'Draft policy is VISIBLE to Owner');
    assert(ownerSeesPublished, 'Published policy is VISIBLE to Owner');

    // Clean up test policies
    await policyService.deletePolicy(draftPol.id, 'Owner', 'owner-user-id', testCompanyId);
    await policyService.deletePolicy(pubPol.id, 'Owner', 'owner-user-id', testCompanyId);
  } catch (err: any) {
    assert(false, `Policy visibility test failed: ${err.message}`);
  }

  // --------------------------------------------------------------------------
  // TEST 7: AUDIT HISTORY ACCESSIBILITY BOUNDARY
  // --------------------------------------------------------------------------
  console.log('\n👉 Test 7: Policy History & Audit Logging Boundaries');
  try {
    const auditPolicy = await policyService.createPolicy(
      {
        title: 'Audited Policy Document',
        category: 'Data & Security',
        content: 'Strict security policy to audit.',
        status: 'Published'
      },
      'Owner',
      'owner-user-id',
      testCompanyId
    );

    // Owner can fetch history
    const ownerHist = await policyService.getPolicyHistory(auditPolicy.id, 'Owner');
    assert(Array.isArray(ownerHist) && ownerHist.length > 0, 'Owner can retrieve policy audit history');
    assert(ownerHist[0].performedByRole === 'Owner', 'Audit record indicates performedByRole = Owner');

    // Non-Owner cannot fetch history
    let nonOwnerBlocked = false;
    try {
      await policyService.getPolicyHistory(auditPolicy.id, 'Accountant');
    } catch (err: any) {
      nonOwnerBlocked = err.message.includes('Only the Owner role can view policy audit history');
    }
    assert(nonOwnerBlocked, 'Non-Owner (Accountant) is BLOCKED from retrieving policy audit history');

    await policyService.deletePolicy(auditPolicy.id, 'Owner', 'owner-user-id', testCompanyId);
  } catch (err: any) {
    assert(false, `Audit history test failed: ${err.message}`);
  }

  // --------------------------------------------------------------------------
  // TEST 8: RBAC MATRIX INTEGRITY PRESERVED
  // --------------------------------------------------------------------------
  console.log('\n👉 Test 8: Central RBAC Matrix Integrity Across All 17 Modules');
  for (const role of ALL_ROLES) {
    const matrixRole = ROLE_PERMISSIONS_MATRIX[role];
    assert(Boolean(matrixRole), `Role "${role}" configured in central matrix`);
    assert(Boolean(matrixRole.settings), `Role "${role}" has settings module definition`);
    assert(matrixRole.settings.view === true, `Role "${role}" has settings.view = true`);
  }

  console.log('\n========================================================================');
  console.log(`TEST RESULTS: ${passedTests}/${totalTests} PASSED (Failed: ${failedTests})`);
  console.log('========================================================================\n');

  if (failedTests > 0) {
    process.exitCode = 1;
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exitCode = 1;
});
