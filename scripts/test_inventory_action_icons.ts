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

  // 1. Tooltips check
  assertions.push({
    name: 'Adjust icon button has title="Adjust Stock"',
    pass: content.includes('title="Adjust Stock"'),
  });

  assertions.push({
    name: 'Movements icon button has title="View Stock Movements"',
    pass: content.includes('title="View Stock Movements"'),
  });

  // 2. Accessibility aria-labels
  assertions.push({
    name: 'Adjust icon button has aria-label="Adjust Stock"',
    pass: content.includes('aria-label="Adjust Stock"'),
  });

  assertions.push({
    name: 'Movements icon button has aria-label="View Stock Movements"',
    pass: content.includes('aria-label="View Stock Movements"'),
  });

  // 3. Compact dimensions and styling
  assertions.push({
    name: 'Adjust icon button has compact w-8 h-8 dimensions and blue palette',
    pass: content.includes('w-8 h-8 rounded-lg bg-blue-50') && content.includes('text-blue-700'),
  });

  assertions.push({
    name: 'Movements icon button has compact w-8 h-8 dimensions and neutral grey palette',
    pass: content.includes('w-8 h-8 rounded-lg bg-slate-100') && content.includes('text-slate-600'),
  });

  // 4. Icons used from library
  assertions.push({
    name: 'Uses Plus icon for Adjust and ArrowRightLeft icon for Movements',
    pass: content.includes('<Plus className="w-4 h-4" />') && content.includes('<ArrowRightLeft className="w-3.5 h-3.5" />'),
  });

  // 5. No visible text labels in operational table actions
  const operationalTableSectionMatch = content.match(/{\/\* Operational Inventory Table \*\/}[\s\S]*?{\/\* Pagination \*\/}/);
  if (operationalTableSectionMatch) {
    const tableSection = operationalTableSectionMatch[0];
    assertions.push({
      name: 'No <span>Adjust</span> label in Operational Inventory table actions',
      pass: !tableSection.includes('<span>Adjust</span>'),
    });
    assertions.push({
      name: 'No <span>Movements</span> label in Operational Inventory table actions',
      pass: !tableSection.includes('<span>Movements</span>'),
    });
    assertions.push({
      name: 'Actions column triggers openAdjustForProduct',
      pass: tableSection.includes('openAdjustForProduct(item.product.id)'),
    });
    assertions.push({
      name: 'Actions column triggers setMovementProductFilter and setActiveTab',
      pass: tableSection.includes('setMovementProductFilter(item.product.name)') && tableSection.includes("setActiveTab('movements')"),
    });
  } else {
    assertions.push({
      name: 'Found Operational Inventory Table section',
      pass: false,
      details: 'Could not locate operational table section in file',
    });
  }

  // 6. Report results
  let allPassed = true;
  console.log('\n--- Inventory Action Icons Verification ---\n');
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
    console.log('\nAll inventory action icon assertions passed successfully!\n');
  }
}

runTests();
