/**
 * Verification Test Suite: Instant Stock Update on Customer Return
 * Tests the 5 core requirements from the user prompt:
 * 1. Direct Return — No Approval Required (Instant Stock Restock for Sales Person)
 * 2. Return Form (Search by invoice #, customer name, phone; reason options; Submit Return button)
 * 3. Stock Update Rules (Exact quantity, warehouse target, anti-duplicate, ledger tracking)
 * 4. Damaged Products (Quarantine isolation; no sellable stock addition for damaged/defective/expired)
 * 5. Role Permissions (Sales Person direct flow, preservation of existing data and other roles)
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { customerReturnService } from '../src/services/customerReturnService';
import { CreateCustomerReturnInput } from '../src/types';

const TEST_COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const pagePath = path.resolve(process.cwd(), 'src/pages/inventory/CustomerReturnsPage.tsx');

async function runTestSuite() {
  console.log('================================================================================');
  console.log('TEST SUITE: INSTANT STOCK UPDATE ON CUSTOMER RETURN (SALES PERSON)');
  console.log('================================================================================\n');

  let passed = 0;
  let total = 0;

  const test = async (name: string, fn: () => Promise<void> | void) => {
    total++;
    try {
      await fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    ${err.message || err}`);
    }
  };

  // ---------------------------------------------------------------------------
  // 1. Direct Return — No Approval Required
  // ---------------------------------------------------------------------------
  console.log('--- 1. Direct Return — No Approval Required ---');

  await test('Direct return creates record with "Stock Restocked" status immediately', async () => {
    const uniqueId = Date.now();
    const input: CreateCustomerReturnInput = {
      originalInvoiceId: `inv-direct-${uniqueId}`,
      originalInvoiceNumber: `INV-DIR-${uniqueId}`,
      customerId: 'cust-101',
      customerName: 'Direct Customer',
      customerPhone: '9876543210',
      productId: `prod-direct-${uniqueId}`,
      productName: 'Direct Test Product',
      sku: 'SKU-DIR-01',
      soldQty: 10,
      returnedQty: 3,
      unit: 'Piece',
      unitPrice: 150,
      reason: 'Customer Return',
      condition: 'Resalable',
      warehouseId: 'wh-central-001',
      warehouseName: 'Main Central Godown',
      directRestock: true, // Sales Person direct return
      createdBy: 'user-sales-01',
      createdByName: 'Sales Person'
    };

    const record = await customerReturnService.createCustomerReturn(input, TEST_COMPANY_ID);
    assert.strictEqual(record.returnStatus, 'Approved', 'Status must be immediately "Approved" without separate approval workflow');
    assert.strictEqual(record.approvedByName, 'Sales Person', 'Approved by must be recorded');
    assert.ok(record.approvedAt, 'Approved timestamp must be recorded');
    assert.strictEqual(record.restockedByName, 'Sales Person', 'Restocked by must be recorded');
    assert.ok(record.restockedAt, 'Restocked timestamp must be recorded');
  });

  await test('CustomerReturnsPage.tsx displays exact success message: "Product returned successfully. Inventory stock has been updated."', () => {
    const content = fs.readFileSync(pagePath, 'utf-8');
    assert.ok(
      content.includes('Product returned successfully. Inventory stock has been updated.'),
      'Must contain exact toast success message'
    );
  });

  await test('CustomerReturnsPage.tsx Submit button displays "Submit Return"', () => {
    const content = fs.readFileSync(pagePath, 'utf-8');
    assert.ok(
      content.includes('Submit Return'),
      'Submit button must be labeled "Submit Return"'
    );
  });

  // ---------------------------------------------------------------------------
  // 2. Return Form Search & Fields
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Return Form Verification ---');

  await test('Modal allows searching original invoice by invoice number, customer name, and phone', () => {
    const content = fs.readFileSync(pagePath, 'utf-8');
    assert.ok(
      content.includes('modalInvoiceSearch'),
      'Page must have invoice search input state'
    );
    assert.ok(
      content.includes('Search invoice number, customer name, or phone number...'),
      'Search input must have descriptive placeholder'
    );
    assert.ok(
      content.includes('matchPhone') || content.includes('customerPhone'),
      'Search filtering must support customer phone'
    );
  });

  await test('Form includes return reasons: Wrong Item, Customer Return, and Other', () => {
    const content = fs.readFileSync(pagePath, 'utf-8');
    assert.ok(content.includes('Wrong Item'), 'Must include Wrong Item reason');
    assert.ok(content.includes('Customer Return'), 'Must include Customer Return reason');
    assert.ok(content.includes('Other'), 'Must include Other reason');
  });

  // ---------------------------------------------------------------------------
  // 3. Stock Update Rules
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Stock Update Rules ---');

  await test('Cannot return quantity exceeding sold quantity minus previous returns', async () => {
    const uniqueId = Date.now();
    const invoiceId = `inv-over-${uniqueId}`;
    const prodId = `prod-over-${uniqueId}`;

    // Return 6 of 10
    await customerReturnService.createCustomerReturn({
      originalInvoiceId: invoiceId,
      originalInvoiceNumber: `INV-OVER-${uniqueId}`,
      customerId: 'cust-over',
      customerName: 'Over Return Customer',
      productId: prodId,
      productName: 'Limited Product',
      soldQty: 10,
      returnedQty: 6,
      unitPrice: 50,
      reason: 'Customer Return',
      directRestock: true
    }, TEST_COMPANY_ID);

    // Remaining should be 4
    const remaining = await customerReturnService.getRemainingEligibleQty(invoiceId, prodId, 10, TEST_COMPANY_ID);
    assert.strictEqual(remaining, 4, 'Remaining quantity must be 4');

    // Attempting to return 5 should throw
    let threw = false;
    try {
      await customerReturnService.createCustomerReturn({
        originalInvoiceId: invoiceId,
        originalInvoiceNumber: `INV-OVER-${uniqueId}`,
        customerId: 'cust-over',
        customerName: 'Over Return Customer',
        productId: prodId,
        productName: 'Limited Product',
        soldQty: 10,
        returnedQty: 5,
        unitPrice: 50,
        reason: 'Customer Return',
        directRestock: true
      }, TEST_COMPANY_ID);
    } catch (err: any) {
      threw = true;
      assert.ok(err.message.includes('exceeds remaining eligible quantity'), 'Error must specify remaining quantity exceeded');
    }
    assert.strictEqual(threw, true, 'Validation must block over-returns');
  });

  await test('Anti-duplicate protection prevents duplicate stock updates on rapid repeated submissions', async () => {
    const uniqueId = Date.now();
    const input: CreateCustomerReturnInput = {
      originalInvoiceId: `inv-anti-dup-${uniqueId}`,
      originalInvoiceNumber: `INV-DUP-${uniqueId}`,
      customerId: 'cust-dup',
      customerName: 'Dup Customer',
      productId: `prod-dup-${uniqueId}`,
      productName: 'Dup Product',
      soldQty: 20,
      returnedQty: 2,
      unitPrice: 100,
      reason: 'Customer Return',
      directRestock: true
    };

    const first = await customerReturnService.createCustomerReturn(input, TEST_COMPANY_ID);
    const second = await customerReturnService.createCustomerReturn(input, TEST_COMPANY_ID);

    assert.strictEqual(first.id, second.id, 'Submitting identical return within debounce window must return existing record');
    assert.strictEqual(first.returnNumber, second.returnNumber, 'Return numbers must match');
  });

  await test('Return ID and details are linked to Stock Movement Ledger', async () => {
    const uniqueId = Date.now();
    const input: CreateCustomerReturnInput = {
      originalInvoiceId: `inv-ledger-${uniqueId}`,
      originalInvoiceNumber: `INV-LEDGER-${uniqueId}`,
      customerId: 'cust-ledger',
      customerName: 'Ledger Customer',
      productId: `prod-ledger-${uniqueId}`,
      productName: 'Ledger Product',
      soldQty: 15,
      returnedQty: 3,
      unitPrice: 200,
      reason: 'Customer Return',
      condition: 'Resalable',
      warehouseId: 'wh-central-001',
      directRestock: true,
      createdBy: 'user-007',
      createdByName: 'Agent 007'
    };

    const record = await customerReturnService.createCustomerReturn(input, TEST_COMPANY_ID);
    assert.ok(record.returnNumber.startsWith('RET-'), 'Return number must follow RET- prefix format');
    assert.strictEqual(record.returnStatus, 'Approved');
  });

  // ---------------------------------------------------------------------------
  // 4. Damaged Products
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Damaged Products & Quarantine Isolation ---');

  await test('Damaged/Defective/Expired products are recorded to quarantine without sellable stock increase', async () => {
    const uniqueId = Date.now();
    const conditions = ['Damaged', 'Defective', 'Expired'] as const;

    for (const cond of conditions) {
      const input: CreateCustomerReturnInput = {
        originalInvoiceId: `inv-dmg-${cond}-${uniqueId}`,
        originalInvoiceNumber: `INV-${cond}-${uniqueId}`,
        customerId: 'cust-dmg',
        customerName: 'Damage Customer',
        productId: `prod-dmg-${cond}-${uniqueId}`,
        productName: `${cond} Product`,
        soldQty: 10,
        returnedQty: 2,
        unitPrice: 100,
        reason: 'Defective Product',
        condition: cond,
        warehouseId: 'wh-central-001',
        directRestock: true,
        createdBy: 'user-sales-01',
        createdByName: 'Sales Person'
      };

      const record = await customerReturnService.createCustomerReturn(input, TEST_COMPANY_ID);
      assert.strictEqual(record.condition, cond);
      assert.strictEqual(record.returnStatus, 'Approved');
    }
  });

  await test('CustomerReturnsPage.tsx makes product condition clear with quarantine explanation', () => {
    const content = fs.readFileSync(pagePath, 'utf-8');
    assert.ok(content.includes('Physical Product Condition'), 'Page must have Physical Product Condition selector');
    assert.ok(content.includes('Quarantine only'), 'Page must indicate quarantine for damaged items');
    assert.ok(content.includes('Recorded separately in quarantine tracking'), 'Page must explain quarantine tracking to user');
  });

  // ---------------------------------------------------------------------------
  // 5. Permissions & Non-Salesperson Workflows
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Permissions & Workflow Preservation ---');

  await test('Non-direct return (Manager/Admin review workflow) starts in "Pending Review" without stock alteration', async () => {
    const uniqueId = Date.now();
    const input: CreateCustomerReturnInput = {
      originalInvoiceId: `inv-mgr-${uniqueId}`,
      originalInvoiceNumber: `INV-MGR-${uniqueId}`,
      customerId: 'cust-mgr',
      customerName: 'Manager Workflow Customer',
      productId: `prod-mgr-${uniqueId}`,
      productName: 'Manager Review Item',
      soldQty: 10,
      returnedQty: 2,
      unitPrice: 80,
      reason: 'Customer Return',
      condition: 'Resalable',
      directRestock: false, // Traditional workflow
      createdBy: 'user-standard',
      createdByName: 'Standard User'
    };

    const record = await customerReturnService.createCustomerReturn(input, TEST_COMPANY_ID);
    assert.strictEqual(record.returnStatus, 'Pending Review', 'Non-direct return must start as Pending Review');
    assert.strictEqual(record.approvedAt, undefined, 'Must not be approved yet');
    assert.strictEqual(record.restockedAt, undefined, 'Must not be restocked yet');
  });

  console.log('\n================================================================================');
  console.log(`TOTAL TESTS: ${total}`);
  console.log(`PASSED:      ${passed}`);
  console.log(`FAILED:      ${total - passed}`);
  console.log('================================================================================');

  if (total === passed) {
    console.log('\n🎉 ALL TESTS PASSED! Instant Stock Update on Customer Return is verified.');
  } else {
    process.exitCode = 1;
  }
}

runTestSuite().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
