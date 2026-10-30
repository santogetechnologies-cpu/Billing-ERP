import * as fs from 'fs';
import * as path from 'path';

function runTests() {
  const filePath = path.join(process.cwd(), 'src', 'pages', 'inventory', 'InventoryDashboardPage.tsx');
  if (!fs.existsSync(filePath)) {
    console.error(`FAIL: File not found: ${filePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const assertions: Array<{ name: string; pass: boolean; details?: string }> = [];

  // 1. Tab 1 Heading
  assertions.push({
    name: 'Tab 1 displays "Current Stock"',
    pass: content.includes('<span>Current Stock</span>'),
  });

  assertions.push({
    name: 'Tab 1 no longer displays "Physical Stock & Availability"',
    pass: !content.includes('<span>Physical Stock & Availability</span>'),
  });

  // 2. Tab 2 Heading
  assertions.push({
    name: 'Tab 2 displays "Stock History"',
    pass: content.includes('<span>Stock History</span>'),
  });

  assertions.push({
    name: 'Tab 2 no longer displays "Stock Movement Ledger" as tab heading',
    pass: !content.includes('<span>Stock Movement Ledger</span>'),
  });

  // 3. Icons preserved
  assertions.push({
    name: 'Tab 1 preserves Boxes icon',
    pass: content.includes('<Boxes className="w-4 h-4" />'),
  });

  assertions.push({
    name: 'Tab 2 preserves ArrowRightLeft icon',
    pass: content.includes('<ArrowRightLeft className="w-4 h-4" />'),
  });

  // 4. Click handlers and state updates preserved
  assertions.push({
    name: 'Tab 1 triggers setActiveTab(\'stock\')',
    pass: content.includes("setActiveTab('stock')"),
  });

  assertions.push({
    name: 'Tab 2 triggers setActiveTab(\'movements\')',
    pass: content.includes("setActiveTab('movements')"),
  });

  // 5. Badge counts preserved
  assertions.push({
    name: 'Tab 1 preserves filteredOperationalStock.length badge count',
    pass: content.includes('{filteredOperationalStock.length}'),
  });

  assertions.push({
    name: 'Tab 2 preserves displayMovementTransactions.length badge count',
    pass: content.includes('{displayMovementTransactions.length}'),
  });

  let allPassed = true;
  console.log('\n--- Inventory Section Tab Headings Verification ---\n');
  assertions.forEach((a, idx) => {
    if (a.pass) {
      console.log(`[PASS] ${idx + 1}. ${a.name}`);
    } else {
      console.error(`[FAIL] ${idx + 1}. ${a.name}${a.details ? ` (${a.details})` : ''}`);
      allPassed = false;
    }
  });

  if (!allPassed) {
    console.error('\nOne or more test assertions failed!');
    process.exit(1);
  } else {
    console.log('\nAll inventory tab headings assertions passed successfully!\n');
  }
}

runTests();
