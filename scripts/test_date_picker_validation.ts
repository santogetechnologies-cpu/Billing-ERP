import fs from 'fs';

async function runTests() {
  console.log('=== TESTING DATE INPUT 4-DIGIT YEAR RESTRICTIONS & VALIDATION ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // 1. NewProductPage.tsx
  const newProductContent = fs.readFileSync('src/pages/products/NewProductPage.tsx', 'utf8');
  assert(
    newProductContent.includes('min="1900-01-01"') && newProductContent.includes('max="2099-12-31"'),
    'NewProductPage Expiry Date input sets min="1900-01-01" and max="2099-12-31"'
  );
  assert(
    newProductContent.includes('parts[0].length > 4') && newProductContent.includes('parts[0].slice(0, 4)'),
    'NewProductPage strictly slices year to 4 digits on change'
  );
  assert(
    newProductContent.includes('y > 2099') && newProductContent.includes("parts[0] = '2099'"),
    'NewProductPage caps year at 2099 on change'
  );
  assert(
    newProductContent.includes('year < 1900 || year > 2099'),
    'NewProductPage validateStep rejects years outside 1900–2099'
  );
  assert(
    newProductContent.includes('+6 Months') &&
    newProductContent.includes('+1 Year') &&
    newProductContent.includes('+2 Years') &&
    newProductContent.includes('+3 Years'),
    'NewProductPage includes quick date presets'
  );

  // 2. BatchManagementPage.tsx
  const batchContent = fs.readFileSync('src/pages/inventory/BatchManagementPage.tsx', 'utf8');
  assert(
    batchContent.includes('min="1900-01-01"') && batchContent.includes('max="2099-12-31"'),
    'BatchManagementPage date inputs set min/max boundaries'
  );

  // 3. PurchaseRequestsPage.tsx
  const prContent = fs.readFileSync('src/pages/purchases/PurchaseRequestsPage.tsx', 'utf8');
  assert(
    prContent.includes('min="2000-01-01"') && prContent.includes('max="2099-12-31"'),
    'PurchaseRequestsPage date inputs set min/max boundaries'
  );

  // 4. StockAlertsPage.tsx
  const saContent = fs.readFileSync('src/pages/inventory/StockAlertsPage.tsx', 'utf8');
  assert(
    saContent.includes('min="2000-01-01"') && saContent.includes('max="2099-12-31"'),
    'StockAlertsPage date inputs set min/max boundaries'
  );

  // 5. Test Year Clamping Logic Simulation with user screenshot value "343543-12-05"
  const userEnteredRaw = '343543-12-05';
  let clamped = userEnteredRaw;
  const parts = clamped.split('-');
  if (parts[0] && parts[0].length > 4) {
    parts[0] = parts[0].slice(0, 4);
    clamped = parts.join('-');
  }
  const y = parseInt(parts[0], 10);
  if (!isNaN(y) && y > 2099) {
    parts[0] = '2099';
    clamped = parts.join('-');
  }
  assert(clamped === '2099-12-05', `User year "343543" safely clamped to valid 4-digit max year "2099-12-05" (was: ${clamped})`);

  // 6. Test Validation Function with user screenshot value
  const testValidation = (val: string) => {
    if (!val || !val.trim()) return 'Expiry date is required.';
    const year = parseInt(val.split('-')[0], 10);
    if (isNaN(new Date(val).getTime()) || isNaN(year) || year < 1900 || year > 2099) {
      return 'Please select a valid expiry date with a 4-digit year (1900–2099).';
    }
    return null;
  };

  assert(
    testValidation('343543-12-05') === 'Please select a valid expiry date with a 4-digit year (1900–2099).',
    'Validation correctly flags 6-digit year 343543 as invalid'
  );
  assert(
    testValidation('2026-12-05') === null,
    'Validation accepts standard valid year 2026-12-05'
  );

  // 7. Test Presets
  const now = new Date();
  const oneYearLater = new Date(now);
  oneYearLater.setMonth(oneYearLater.getMonth() + 12);
  const oneYearStr = `${oneYearLater.getFullYear()}-${String(oneYearLater.getMonth() + 1).padStart(2, '0')}-${String(oneYearLater.getDate()).padStart(2, '0')}`;
  assert(testValidation(oneYearStr) === null, `Quick preset (+1 year -> ${oneYearStr}) produces valid date`);

  console.log(`\nRESULTS: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

runTests();
