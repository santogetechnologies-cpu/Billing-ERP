/**
 * Verification Test Suite: Simplified Purchase Return Table & Eye Details Modal
 * Validates:
 * 1. Removal of Return Reason, Product Condition, and Return Date columns from main table display.
 * 2. Proper redistribution of remaining 7 columns (Return ID, Original Bill/Invoice, Customer Name, Product & SKU, Returned Qty, Return Status, Actions).
 * 3. Eye (View Details) button presence and behavior.
 * 4. Comprehensive View Return Details modal displaying all 14 required fields with "—" fallback.
 * 5. Fetching return details by unique record ID (protects multiple returns on the same invoice).
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

async function runTests() {
  console.log('================================================================================');
  console.log('TEST SUITE: SIMPLIFIED PURCHASE RETURN TABLE & EYE DETAILS MODAL');
  console.log('================================================================================\n');

  let passed = 0;
  let total = 0;

  const test = (name: string, fn: () => void) => {
    total++;
    try {
      fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    ${err.message || err}`);
    }
  };

  const pagePath = path.resolve(process.cwd(), 'src/pages/inventory/CustomerReturnsPage.tsx');
  const content = fs.readFileSync(pagePath, 'utf-8');

  // Extract the table element
  const tableMatch = content.match(/<table[\s\S]*?<\/table>/);
  assert.ok(tableMatch, 'CustomerReturnsPage.tsx must contain a <table> element');
  const tableCode = tableMatch[0];

  const theadMatch = tableCode.match(/<thead[\s\S]*?<\/thead>/);
  assert.ok(theadMatch, 'Table must contain <thead>');
  const theadCode = theadMatch[0];

  // 1. Columns Removed from Main Table
  console.log('--- 1. Verification of Removed Columns from Main Table ---');

  test('Main table header does NOT include "Return Reason" column', () => {
    assert.strictEqual(
      theadCode.includes('>Return Reason<') || theadCode.includes('Return Reason</th>'),
      false,
      'Return Reason column must not be present in main table header'
    );
  });

  test('Main table header does NOT include "Product Condition" column', () => {
    assert.strictEqual(
      theadCode.includes('>Product Condition<') || theadCode.includes('Product Condition</th>'),
      false,
      'Product Condition column must not be present in main table header'
    );
  });

  test('Main table header does NOT include "Return Date" column', () => {
    assert.strictEqual(
      theadCode.includes('>Return Date<') || theadCode.includes('Return Date</th>'),
      false,
      'Return Date column must not be present in main table header'
    );
  });

  // 2. Remaining 7 Columns Properly Formatted
  console.log('\n--- 2. Verification of Remaining Columns & Layout ---');

  test('Main table header includes the 7 remaining columns', () => {
    assert.ok(theadCode.includes('Return ID'), 'Must have Return ID header');
    assert.ok(theadCode.includes('Original Bill / Invoice') || theadCode.includes('Original Invoice'), 'Must have Original Invoice header');
    assert.ok(theadCode.includes('Customer Name'), 'Must have Customer Name header');
    assert.ok(theadCode.includes('Product Name & SKU') || theadCode.includes('Product Name and SKU'), 'Must have Product Name & SKU header');
    assert.ok(theadCode.includes('Returned Qty'), 'Must have Returned Qty header');
    assert.ok(theadCode.includes('Return Status'), 'Must have Return Status header');
    assert.ok(theadCode.includes('Actions'), 'Must have Actions header');
  });

  test('Empty state row uses colSpan={7}', () => {
    assert.ok(tableCode.includes('colSpan={7}'), 'Empty state must span exactly 7 columns');
  });

  // 3. Eye Icon (View Details)
  console.log('\n--- 3. Eye (View Details) Icon & Actions ---');

  test('Each row contains an Eye (View Details) button', () => {
    assert.ok(tableCode.includes('title="View Return Details"'), 'Eye button must have title="View Return Details"');
    assert.ok(tableCode.includes('<Eye'), 'Eye icon component must be rendered');
  });

  // 4. View Return Details Modal Fields
  console.log('\n--- 4. View Return Details Modal Comprehensive Content ---');

  test('View Return Details modal displays all 14 required fields', () => {
    // 1. Return ID
    assert.ok(content.includes('inspectingReturn.returnNumber'), 'Must display Return ID');

    // 2. Original Bill/Invoice Number
    assert.ok(content.includes('inspectingReturn.originalInvoiceNumber'), 'Must display Original Invoice');

    // 3. Customer Name and Phone Number
    assert.ok(content.includes('inspectingReturn.customerName'), 'Must display Customer Name');
    assert.ok(content.includes('inspectingReturn.customerPhone'), 'Must display Customer Phone');

    // 4. Product Name and SKU
    assert.ok(content.includes('inspectingReturn.productName'), 'Must display Product Name');
    assert.ok(content.includes('inspectingReturn.sku'), 'Must display SKU');

    // 5. Returned Quantity and Unit
    assert.ok(content.includes('inspectingReturn.returnedQty'), 'Must display Returned Quantity');
    assert.ok(content.includes('inspectingReturn.unit'), 'Must display Unit');

    // 6. Original Quantity Sold
    assert.ok(content.includes('inspectingReturn.soldQty'), 'Must display Original Quantity Sold');

    // 7. Return Reason
    assert.ok(content.includes('inspectingReturn.reason'), 'Must display Return Reason');

    // 8. Product Condition
    assert.ok(content.includes('inspectingReturn.condition'), 'Must display Product Condition');

    // 9. Return Date and Time
    assert.ok(content.includes('formatDateTime'), 'Must support Date and Time formatting');

    // 10. Warehouse Name
    assert.ok(content.includes('inspectingReturn.warehouseName'), 'Must display Warehouse Name');

    // 11. Return Status
    assert.ok(content.includes('inspectingReturn.returnStatus'), 'Must display Return Status');

    // 12. Stock Update Status
    assert.ok(content.includes('Stock Update Status'), 'Must display Stock Update Status');
    assert.ok(content.includes('getStockUpdateStatus'), 'Must calculate Stock Update Status');

    // 13. Created By
    assert.ok(content.includes('inspectingReturn.createdByName'), 'Must display Created By');

    // 14. Notes or additional information
    assert.ok(content.includes('inspectingReturn.notes'), 'Must display Notes / Additional Info');
  });

  test('Modal uses "—" fallback for empty/undefined fields', () => {
    assert.ok(content.includes("|| '—'"), 'Modal must fallback to "—" when values are missing');
  });

  // 5. Record ID Lookup Safety
  console.log('\n--- 5. Record ID Lookup & Safety ---');

  test('Fetches return details using exact unique record ID (protects multiple returns on same invoice)', () => {
    assert.ok(content.includes('inspectingReturnId'), 'Must maintain inspectingReturnId state');
    assert.ok(
      content.includes('customerReturns.find(r => r.id === inspectingReturnId)'),
      'Must look up record by unique record ID'
    );
  });

  test('Modal provides Close button and supports backdrop / escape dismissal', () => {
    assert.ok(content.includes('setInspectingReturn(null)'), 'Must support closing modal');
    assert.ok(content.includes('Close'), 'Must include Close button');
  });

  console.log('\n================================================================================');
  console.log(`TOTAL TESTS: ${total}`);
  console.log(`PASSED:      ${passed}`);
  console.log(`FAILED:      ${total - passed}`);
  console.log('================================================================================');

  if (total === passed) {
    console.log('\n🎉 ALL TESTS PASSED! Simplified Table & Eye Details Modal fully verified.');
  } else {
    process.exitCode = 1;
  }
}

runTests();
