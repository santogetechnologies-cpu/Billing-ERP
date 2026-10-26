import fs from 'fs';
import path from 'path';

function runTests() {
  console.log('--- Testing Stock Valuation Costing Basis Shortening ---');

  const filePath = path.resolve(process.cwd(), 'src/pages/inventory/StockValuationPage.tsx');
  if (!fs.existsSync(filePath)) {
    console.error('FAIL: StockValuationPage.tsx not found!');
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  // Check 1: Costing basis column displays W/A when valuationMethod === 'Weighted Average'
  const hasWAConditional = content.includes("valuationMethod === 'Weighted Average' ? 'W/A' : valuationMethod");
  console.log(hasWAConditional ? 'PASS: Costing Basis conditionally displays W/A for Weighted Average' : 'FAIL: W/A conditional missing');

  // Check 2: Table row badge has title for accessibility
  const hasAccessibilityTitle = content.includes("title={valuationMethod === 'Weighted Average' ? 'Weighted Average' : valuationMethod}");
  console.log(hasAccessibilityTitle ? 'PASS: Full "Weighted Average" preserved in title/tooltip accessibility' : 'FAIL: Title tooltip missing');

  // Check 3: Preserves green badge styling
  const hasGreenBadge = content.includes('bg-emerald-50') &&
    content.includes('text-emerald-700') &&
    content.includes('border border-emerald-200') &&
    content.includes('rounded-full') &&
    content.includes('whitespace-nowrap inline-block');
  console.log(hasGreenBadge ? 'PASS: Green badge styling and compact single-line layout preserved' : 'FAIL: Green badge styling altered');

  // Check 4: Reconciliation footer also displays W/A conditionally
  const footerOccurrences = (content.match(/valuationMethod === 'Weighted Average' \? 'W\/A' : valuationMethod/g) || []).length;
  console.log(footerOccurrences >= 2 ? `PASS: Found ${footerOccurrences} occurrences covering table rows and footer` : `FAIL: Expected at least 2 occurrences, found ${footerOccurrences}`);

  // Check 5: Valuation method switcher still has the full 'Weighted Average' label
  const hasSwitcherButton = content.includes('>Weighted Average</button>') || content.includes('Weighted Average\n            </button>');
  console.log(hasSwitcherButton ? 'PASS: Valuation method toggle button preserves full "Weighted Average"' : 'FAIL: Method switcher button missing');

  // Check 6: Calculations and CSV export preserve 'valuationMethod'
  const hasCsvValuationMethod = content.includes('valuationMethod,') && content.includes('Stock_Valuation_${valuationMethod}_');
  console.log(hasCsvValuationMethod ? 'PASS: CSV export preserves underlying valuationMethod' : 'FAIL: CSV export modified');

  if (hasWAConditional && hasAccessibilityTitle && hasGreenBadge && footerOccurrences >= 2 && hasSwitcherButton && hasCsvValuationMethod) {
    console.log('\nAll 6 verification checks PASSED successfully!');
  } else {
    console.error('\nSome checks FAILED.');
    process.exit(1);
  }
}

runTests();
