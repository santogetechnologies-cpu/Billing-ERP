import fs from 'fs';
import path from 'path';

function runTests() {
  console.log('--- STARTING REMOVE WORKPLACE & REGIONAL PREFERENCES TEST ---');
  let failures = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
    } else {
      console.error(`[FAIL] ${testName}`);
      if (details) console.error(`       Details: ${details}`);
      failures++;
    }
  }

  const settingsPagePath = path.resolve('src/pages/settings/SettingsPage.tsx');
  const content = fs.readFileSync(settingsPagePath, 'utf8');

  // Test 1: Heading removed
  assert(
    !content.includes('Workplace & Regional Preferences') &&
    !content.includes('WORKPLACE & REGIONAL PREFERENCES'),
    'Test 1: "Workplace & Regional Preferences" heading is removed from Settings'
  );

  // Test 2: Subtitle removed
  assert(
    !content.includes('Local currency, date formats, and initial view'),
    'Test 2: "Local currency, date formats, and initial view" description is removed'
  );

  // Test 3: Display Language label removed
  assert(
    !content.includes('Display Language'),
    'Test 3: "Display Language" dropdown field is removed'
  );

  // Test 4: Date Format label removed from personal settings
  assert(
    !content.includes('<label className="block text-xs font-semibold text-slate-700 mb-1">Date Format</label>'),
    'Test 4: "Date Format" field is removed from personal settings'
  );

  // Test 5: Number & Currency Format label removed
  assert(
    !content.includes('Number & Currency Format'),
    'Test 5: "Number & Currency Format" dropdown field is removed'
  );

  // Test 6: Default Landing Route label removed
  assert(
    !content.includes('Default Landing Route'),
    'Test 6: "Default Landing Route" dropdown field is removed'
  );

  // Test 7: Personal profile fields preserved
  assert(
    content.includes('value={personalName}') &&
    content.includes('value={user?.email || profile?.email || \'\'}') &&
    content.includes('value={personalPhone}') &&
    content.includes('Assigned System Role') &&
    content.includes('Account Status') &&
    content.includes('Last Active / Activity Time'),
    'Test 7: User profile fields (Name, Email, Phone, Role, Status, Activity) are preserved'
  );

  if (failures > 0) {
    console.error(`\nTOTAL FAILURES: ${failures}`);
    process.exit(1);
  } else {
    console.log('\n--- ALL WORKPLACE & REGIONAL PREFERENCES REMOVAL TESTS PASSED ---');
    process.exit(0);
  }
}

runTests();
