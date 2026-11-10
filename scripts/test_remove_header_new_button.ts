import fs from 'fs';
import path from 'path';

function runTests() {
  console.log('--- Testing Removal of "+ New" Button from Header ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`[PASS] ${msg}`);
      passed++;
    } else {
      console.error(`[FAIL] ${msg}`);
      failed++;
    }
  }

  const baseDir = path.resolve('C:/Users/mijil/OneDrive/Desktop/New');
  const headerPath = path.join(baseDir, 'src/components/layout/Header.tsx');
  const headerContent = fs.readFileSync(headerPath, 'utf8');

  // Test 1: Header.tsx does not contain showQuickCreateMenu
  assert(
    !headerContent.includes('showQuickCreateMenu'),
    'Header.tsx does NOT contain showQuickCreateMenu state'
  );

  // Test 2: Header.tsx does not contain quickCreateRef
  assert(
    !headerContent.includes('quickCreateRef'),
    'Header.tsx does NOT contain quickCreateRef ref'
  );

  // Test 3: Header.tsx does not render "+ New" or "New" quick button
  assert(
    !headerContent.includes('<span className="hidden sm:inline">New</span>'),
    'Header.tsx does NOT render the "+ New" quick create button'
  );

  // Test 4: Quick action dropdown routes are removed from Header.tsx
  assert(
    !headerContent.includes("navigate('/sales/pos')") &&
    !headerContent.includes('/customers?action=new') &&
    !headerContent.includes('/purchases?tab=orders&action=new_po'),
    'Header.tsx does NOT contain the quick create dropdown menu routes'
  );

  // Test 5: Global search, warehouse switcher, notifications, user profile remain functional
  assert(
    headerContent.includes('getPageTitle()') &&
    headerContent.includes('selectedWarehouse') &&
    headerContent.includes('onOpenSearch') &&
    headerContent.includes('onOpenNotifications') &&
    headerContent.includes('UserPresenceBadge') &&
    headerContent.includes('showProfileMenu'),
    'Header.tsx retains page title, warehouse switcher, search, notifications, and user account menu'
  );

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
