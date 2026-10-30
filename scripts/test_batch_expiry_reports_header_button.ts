import fs from 'fs';
import path from 'path';

function runTests() {
  console.log('--- STARTING BATCH & EXPIRY HEADER BUTTON & REPORTS TEST ---');
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

  const batchPagePath = path.resolve('src/pages/inventory/BatchManagementPage.tsx');
  const batchContent = fs.readFileSync(batchPagePath, 'utf8');

  // Test 1: Header does NOT contain "Add New Batch" button
  const headerMatch = batchContent.match(/<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl[\s\S]*?Batches Table/);
  assert(
    Boolean(headerMatch),
    'Test 1: Found Header section in BatchManagementPage.tsx'
  );

  if (headerMatch) {
    const headerContent = headerMatch[0];

    assert(
      !headerContent.includes('Add New Batch'),
      'Test 2: Header does NOT contain "Add New Batch" button'
    );

    assert(
      headerContent.includes('Expiry Reports'),
      'Test 3: Header displays "Expiry Reports" button'
    );

    assert(
      headerContent.includes('bg-blue-600') && headerContent.includes('text-white') && headerContent.includes('rounded-lg'),
      'Test 4: Expiry Reports button maintains blue styling, text-white, and rounded styling'
    );

    assert(
      headerContent.includes('FileSpreadsheet') || headerContent.includes('Calendar') || headerContent.includes('FileText'),
      'Test 5: Expiry Reports button uses a report/document/calendar icon'
    );
  }

  // Test 6: Expiry Reports modal view exists with real batch data and expiry categories
  assert(
    batchContent.includes('title="Expiry Reports"'),
    'Test 6: Expiry Reports modal is present'
  );

  assert(
    batchContent.includes('expiryStats') &&
    batchContent.includes('calculateBatchStatus') &&
    batchContent.includes('filteredExpiryBatches'),
    'Test 7: Expiry calculations and filter logic are implemented'
  );

  assert(
    batchContent.includes('Expired') &&
    batchContent.includes('Expiring Soon') &&
    batchContent.includes('Valid Stock'),
    'Test 8: Expiry categories (Expired, Expiring Soon, Valid Stock) are supported'
  );

  assert(
    batchContent.includes('handleExportExpiryCSV') && batchContent.includes('window.print()'),
    'Test 9: Export CSV and Print functions are available on Expiry Report'
  );

  // Test 10: Preserves existing Add New Batch functionality
  assert(
    batchContent.includes('title="Register Product Batch"') &&
    batchContent.includes('handleCreateBatch') &&
    batchContent.includes('addBatch'),
    'Test 10: Existing Add New Batch modal and creation functionality are preserved'
  );

  // Test 11: ReportsPage includes batch-expiry report
  const reportsPagePath = path.resolve('src/pages/reports/ReportsPage.tsx');
  const reportsContent = fs.readFileSync(reportsPagePath, 'utf8');

  assert(
    reportsContent.includes("id: 'batch-expiry'") &&
    reportsContent.includes("case 'batch-expiry':"),
    'Test 11: ReportsPage.tsx includes Batch & Expiry Date report'
  );

  assert(
    reportsContent.includes('calculateBatchStatus') && reportsContent.includes('batches.map'),
    'Test 12: ReportsPage uses real batch data and calculateBatchStatus'
  );

  if (failures > 0) {
    console.error(`\nTOTAL FAILURES: ${failures}`);
    process.exit(1);
  } else {
    console.log('\n--- ALL BATCH & EXPIRY HEADER BUTTON & REPORTS TESTS PASSED ---');
    process.exit(0);
  }
}

runTests();
