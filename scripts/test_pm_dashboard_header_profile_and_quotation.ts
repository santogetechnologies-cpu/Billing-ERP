import fs from 'fs';
import path from 'path';

function runTests() {
  console.log('--- Testing PM Dashboard Header: Remove Profile & Rename New Bill as Quotation ---');
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
  const targetPath = path.join(baseDir, 'src/pages/purchases/PurchaseManagerDashboardPage.tsx');
  const content = fs.readFileSync(targetPath, 'utf8');

  // Test 1: Button renamed from "New Bill" to "Quotation"
  assert(
    content.includes('<span>Quotation</span>'),
    'Header button is named "Quotation"'
  );

  // Test 2: "New Bill" is no longer the button text in the dashboard header toolbar
  const toolbarSectionMatch = content.match(/Action Controls Toolbar[\s\S]*?Error Alert/);
  const toolbarSection = toolbarSectionMatch ? toolbarSectionMatch[0] : '';
  assert(
    !toolbarSection.includes('<span>New Bill</span>'),
    'Header toolbar does NOT contain "New Bill"'
  );

  // Test 3: Profile button is removed from header toolbar
  assert(
    !toolbarSection.includes('title="View Profile"') &&
    !toolbarSection.includes('setIsProfileModalOpen(true)'),
    'Profile button ([P] purchase) has been removed from the header toolbar'
  );

  // Test 4: Refresh button is preserved in toolbar
  assert(
    toolbarSection.includes('handleRefresh') &&
    toolbarSection.includes('RefreshCw'),
    'Refresh button is preserved in the toolbar'
  );

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();

