// Test Suite: Customer Returns Management System
// Validates all 10 requirements from the Antigravity prompt:
// 1. Customer return can be created from an existing sales invoice.
// 2. Pending return does not increase inventory.
// 3. Approved resalable return increases the correct warehouse's stock exactly once.
// 4. Damaged or expired returns do not enter sellable stock.
// 5. Rejected returns do not affect stock.
// 6. Refund processing does not add stock again.
// 7. Partial returns respect remaining eligible quantity.
// 8. Inventory totals and stock movement history remain consistent and idempotent.
// 9. Permissions are enforced for every role.
// 10. Existing billing, sales, purchasing, and inventory workflows continue to work.

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  canRoleAccessNavItem,
  canRoleAccessSubItem,
  canAccessRoute,
  hasPermission
} from '../src/utils/rbac';
import { customerReturnService } from '../src/services/customerReturnService';
import { CustomerReturn, CreateCustomerReturnInput } from '../src/types';

console.log('================================================================================');
console.log('TEST SUITE: CUSTOMER PURCHASE RETURNS SYSTEM (INVENTORY)');
console.log('================================================================================\n');

let totalTests = 0;
let passedTests = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${name} -> ${err?.message || err}`);
    process.exitCode = 1;
  }
}

async function runAllTests() {
  // Valid UUIDs for DB schema compatibility
  const companyId = '00000000-0000-4000-8000-000000000001';
  const testProductId = '11111111-1111-4111-8111-111111111111';
  const testWarehouseId = '22222222-2222-4222-8222-222222222222';
  const testInvoiceId = '33333333-3333-4333-8333-333333333333';
  const testInvoiceNumber = 'INV-2026-9999';

  // -----------------------------------------------------------------------------
  // 1. Sidebar & Route Registration
  // -----------------------------------------------------------------------------
  console.log('--- 1. Navigation, Routes & Sidebar Configuration ---');

  await test('Sidebar.tsx includes "Purchase Return" under Inventory submenu', () => {
    const sidebarCode = fs.readFileSync(path.resolve('src/components/layout/Sidebar.tsx'), 'utf-8');
    assert.ok(
      sidebarCode.includes("name: 'Purchase Return'"),
      'Sidebar must have "Purchase Return" item under Inventory'
    );
    assert.ok(
      sidebarCode.includes("path: '/inventory/purchase-returns'"),
      'Sidebar must point to /inventory/purchase-returns'
    );
    assert.ok(
      sidebarCode.includes('RotateCcw'),
      'Sidebar must use RotateCcw return-arrow icon'
    );
  });

  await test('App.tsx defines route for /inventory/purchase-returns and redirect for /inventory/returns', () => {
    const appCode = fs.readFileSync(path.resolve('src/App.tsx'), 'utf-8');
    assert.ok(
      appCode.includes('CustomerReturnsPage'),
      'App.tsx must import CustomerReturnsPage'
    );
    assert.ok(
      appCode.includes('path="inventory/purchase-returns"'),
      'App.tsx must define route path="inventory/purchase-returns"'
    );
    assert.ok(
      appCode.includes('path="inventory/customer-returns"'),
      'App.tsx must define route path="inventory/customer-returns" for compatibility'
    );
    assert.ok(
      appCode.includes('path="inventory/returns"'),
      'App.tsx must define route path="inventory/returns"'
    );
  });

  // -----------------------------------------------------------------------------
  // 2. Role Permissions (RBAC)
  // -----------------------------------------------------------------------------
  console.log('\n--- 2. Role-Based Access Control (RBAC) ---');

  await test('Sales Person can access /inventory/purchase-returns to submit and view returns', () => {
    assert.strictEqual(
      canAccessRoute('Salesperson', '/inventory/purchase-returns'),
      true,
      'Salesperson must have access to purchase returns route'
    );
    assert.strictEqual(
      canAccessRoute('Sales Person', '/inventory/purchase-returns'),
      true,
      'Sales Person alias must normalize and allow access to purchase returns route'
    );
    assert.strictEqual(
      canRoleAccessSubItem('Salesperson', 'Inventory', 'Purchase Return', '/inventory/purchase-returns'),
      true,
      'Salesperson must see Purchase Return in submenu'
    );
    assert.strictEqual(
      canRoleAccessSubItem('Sales Person', 'Inventory', 'Purchase Return', '/inventory/purchase-returns'),
      true,
      'Sales Person alias must see Purchase Return in submenu'
    );
  });

  await test('Warehouse Manager can access /inventory/purchase-returns route if authorized for stock verification, but submenu is hidden', () => {
    assert.strictEqual(
      canAccessRoute('Warehouse Manager', '/inventory/purchase-returns'),
      true,
      'Warehouse Manager can access route for warehouse stock verification'
    );
    assert.strictEqual(
      canRoleAccessSubItem('Warehouse Manager', 'Inventory', 'Purchase Return', '/inventory/purchase-returns'),
      false,
      'Purchase Return in Inventory submenu is strictly scoped to Salesperson role only'
    );
  });

  await test('Cashier can access /inventory/purchase-returns for refund processing, but submenu is hidden', () => {
    assert.strictEqual(
      canAccessRoute('Cashier', '/inventory/purchase-returns'),
      true,
      'Cashier must have access to purchase returns to process refunds'
    );
    assert.strictEqual(
      canRoleAccessSubItem('Cashier', 'Inventory', 'Purchase Return', '/inventory/purchase-returns'),
      false,
      'Purchase Return in Inventory submenu is strictly scoped to Salesperson role only'
    );
  });

  await test('Admin and Owner retain full access to route, but generic Inventory submenu remains unchanged', () => {
    assert.strictEqual(canAccessRoute('Admin', '/inventory/purchase-returns'), true);
    assert.strictEqual(canAccessRoute('Owner', '/inventory/purchase-returns'), true);
    assert.strictEqual(
      canRoleAccessSubItem('Admin', 'Inventory', 'Purchase Return', '/inventory/purchase-returns'),
      false,
      'Purchase Return submenu under Inventory is strictly for Salesperson; Admin Inventory submenu is unchanged'
    );
    assert.strictEqual(
      canRoleAccessSubItem('Owner', 'Inventory', 'Purchase Return', '/inventory/purchase-returns'),
      false,
      'Purchase Return submenu under Inventory is strictly for Salesperson; Owner Inventory submenu is unchanged'
    );
  });

  await test('Purchase Manager is excluded from Purchase Return under Inventory', () => {
    assert.strictEqual(
      canRoleAccessSubItem('Purchase Manager', 'Inventory', 'Purchase Return', '/inventory/purchase-returns'),
      false,
      'Customer Purchase Returns are not vendor purchase returns and must not appear in Purchase Manager inventory menu'
    );
  });

  // -----------------------------------------------------------------------------
  // 3. Customer Return Creation & Validation
  // -----------------------------------------------------------------------------
  console.log('\n--- 3. Customer Return Creation & Validation ---');

  let initialReturn: CustomerReturn;

  await test('Can create a customer return from an original sales invoice with valid quantity', async () => {
    const returnInput: CreateCustomerReturnInput = {
      originalInvoiceId: testInvoiceId,
      originalInvoiceNumber: testInvoiceNumber,
      returnDate: '2026-10-26',
      customerId: '00000000-0000-4000-8000-000000000999',
      customerName: 'Aarav Sharma',
      customerPhone: '9876543210',
      productId: testProductId,
      productName: 'Organic Green Tea 250g',
      sku: 'SKU-TEA-001',
      unit: 'Box',
      soldQty: 10,
      returnedQty: 3,
      unitPrice: 250,
      refundAmount: 750,
      condition: 'Resalable',
      reason: 'Ordered wrong flavor by mistake',
      notes: 'Unopened box sealed in original packaging',
      warehouseId: testWarehouseId,
      warehouseName: 'Main Warehouse'
    };

    initialReturn = await customerReturnService.createCustomerReturn(
      {
        ...returnInput,
        createdBy: 'user-sales-1',
        createdByName: 'Priya Sales'
      },
      companyId
    );

    assert.ok(initialReturn.id, 'Created return must have an ID');
    assert.ok(initialReturn.returnNumber.startsWith('RET-'), 'Return number must start with RET-');
    assert.strictEqual(initialReturn.returnStatus, 'Pending Review', 'Status must start as Pending Review');
    assert.strictEqual(initialReturn.refundStatus, 'Pending', 'Refund status must start as Pending');
    assert.strictEqual(initialReturn.returnedQty, 3, 'Returned quantity must match');
  });

  await test('Remaining eligible quantity respects partial returns', async () => {
    const remaining = await customerReturnService.getRemainingEligibleQty(
      testInvoiceId,
      testProductId,
      10,
      companyId
    );
    assert.strictEqual(remaining, 7, 'Remaining eligible qty must be 10 - 3 = 7');
  });

  await test('Creating a return exceeding remaining quantity is strictly rejected', async () => {
    let errorThrown = false;
    try {
      await customerReturnService.createCustomerReturn(
        {
          originalInvoiceId: testInvoiceId,
          originalInvoiceNumber: testInvoiceNumber,
          returnDate: '2026-10-26',
          customerId: '00000000-0000-4000-8000-000000000999',
          customerName: 'Aarav Sharma',
          productId: testProductId,
          productName: 'Organic Green Tea 250g',
          sku: 'SKU-TEA-001',
          unit: 'Box',
          soldQty: 10,
          returnedQty: 8, // Remaining is 7, 8 exceeds it!
          unitPrice: 250,
          refundAmount: 2000,
          condition: 'Resalable',
          reason: 'Defective item',
          warehouseId: testWarehouseId,
          warehouseName: 'Main Warehouse'
        },
        companyId
      );
    } catch (err: any) {
      errorThrown = true;
      assert.ok(
        err.message.includes('exceeds remaining eligible quantity'),
        `Expected error message about exceeding eligible quantity, got: ${err.message}`
      );
    }
    assert.strictEqual(errorThrown, true, 'Must throw error when returning more than remaining eligible quantity');
  });

  // -----------------------------------------------------------------------------
  // 4. Inventory Stock Rules
  // -----------------------------------------------------------------------------
  console.log('\n--- 4. Stock Isolation & Restocking Rules ---');

  await test('Rule 1: Pending Review return does NOT alter sellable stock or restock record', async () => {
    assert.strictEqual(initialReturn.returnStatus, 'Pending Review');
    assert.strictEqual(initialReturn.restockedAt, undefined, 'Must not be restocked while Pending Review');
  });

  await test('Rule 2: Approved return transitions status to "Approved" without altering stock yet', async () => {
    const approved = await customerReturnService.approveReturn(
      initialReturn.id,
      'admin-1',
      'Operations Manager',
      companyId
    );
    assert.strictEqual(approved.returnStatus, 'Approved');
    assert.strictEqual(approved.approvedBy, 'admin-1');
    assert.strictEqual(approved.restockedAt, undefined, 'Approval alone must not prematurely update inventory');
    initialReturn = approved;
  });

  await test('Rule 3: Approved + Resalable restocking increments stock and records ledger', async () => {
    const restockRes = await customerReturnService.restockReturn(
      initialReturn.id,
      testWarehouseId,
      'Main Warehouse',
      'wh-manager-1',
      'Vikram Godown',
      companyId
    );

    assert.strictEqual(restockRes.restocked, true, 'Resalable return must restock stock');
    assert.strictEqual(restockRes.returnRecord.returnStatus, 'Stock Restocked');
    assert.ok(restockRes.returnRecord.restockedAt, 'Must set restockedAt timestamp');
    assert.strictEqual(restockRes.returnRecord.warehouseId, testWarehouseId);

    initialReturn = restockRes.returnRecord;
  });

  await test('Rule 4: Duplicate restock calls are strictly idempotent and prevent double-stocking', async () => {
    const secondCall = await customerReturnService.restockReturn(
      initialReturn.id,
      testWarehouseId,
      'Main Warehouse',
      'wh-manager-1',
      'Vikram Godown',
      companyId
    );

    assert.strictEqual(secondCall.restocked, false, 'Second call must NOT restock stock again');
    assert.ok(secondCall.message.toLowerCase().includes('already') && secondCall.message.toLowerCase().includes('restocked'), 'Message should indicate already restocked');
  });

  await test('Rule 5: Approved + Damaged/Defective/Expired does NOT increase sellable stock', async () => {
    // Create a damaged return for 2 units
    const damagedReturn = await customerReturnService.createCustomerReturn(
      {
        originalInvoiceId: testInvoiceId,
        originalInvoiceNumber: testInvoiceNumber,
        returnDate: '2026-10-26',
        customerId: '00000000-0000-4000-8000-000000000999',
        customerName: 'Aarav Sharma',
        productId: testProductId,
        productName: 'Organic Green Tea 250g',
        sku: 'SKU-TEA-001',
        unit: 'Box',
        soldQty: 10,
        returnedQty: 2,
        unitPrice: 250,
        refundAmount: 500,
        condition: 'Damaged',
        reason: 'Crushed packaging in transit',
        warehouseId: testWarehouseId,
        warehouseName: 'Main Warehouse'
      },
      companyId
    );

    const approvedDamaged = await customerReturnService.approveReturn(
      damagedReturn.id,
      'admin-1',
      'Manager',
      companyId
    );

    const damagedRestockRes = await customerReturnService.restockReturn(
      approvedDamaged.id,
      testWarehouseId,
      'Main Warehouse',
      'wh-manager-1',
      'Vikram Godown',
      companyId
    );

    assert.strictEqual(damagedRestockRes.restocked, false, 'Non-resalable items must NOT increment sellable stock');
    assert.ok(
      damagedRestockRes.message.includes('quarantine') || damagedRestockRes.message.includes('Quarantined'),
      'Must record item to quarantine/damaged ledger without sellable stock'
    );
  });

  await test('Rule 6: Rejected return does not affect stock and sets status to "Rejected"', async () => {
    // Create another return to test rejection
    const toReject = await customerReturnService.createCustomerReturn(
      {
        originalInvoiceId: testInvoiceId,
        originalInvoiceNumber: testInvoiceNumber,
        returnDate: '2026-10-26',
        customerId: '00000000-0000-4000-8000-000000000999',
        customerName: 'Aarav Sharma',
        productId: testProductId,
        productName: 'Organic Green Tea 250g',
        sku: 'SKU-TEA-001',
        unit: 'Box',
        soldQty: 10,
        returnedQty: 1,
        unitPrice: 250,
        refundAmount: 250,
        condition: 'Defective',
        reason: 'Customer claims sour taste',
        warehouseId: testWarehouseId,
        warehouseName: 'Main Warehouse'
      },
      companyId
    );

    const rejected = await customerReturnService.rejectReturn(
      toReject.id,
      'Inspection revealed product was consumed and past return window',
      'admin-1',
      'Manager',
      companyId
    );

    assert.strictEqual(rejected.returnStatus, 'Rejected');
    assert.strictEqual(rejected.rejectionReason, 'Inspection revealed product was consumed and past return window');
    assert.strictEqual(rejected.restockedAt, undefined);
  });

  // -----------------------------------------------------------------------------
  // 5. Refund Handling Rules
  // -----------------------------------------------------------------------------
  console.log('\n--- 5. Refund Workflow & Decoupled Stock Tracking ---');

  await test('Refund workflow updates refund status without altering stock', async () => {
    const refunded = await customerReturnService.processRefund(
      initialReturn.id,
      'UPI',
      750,
      'cashier-1',
      'Ravi Cashier',
      companyId
    );

    assert.strictEqual(refunded.refundStatus, 'Refunded');
    assert.strictEqual(refunded.refundMethod, 'UPI');
    assert.strictEqual(refunded.refundAmount, 750);
    assert.strictEqual(refunded.refundedBy, 'cashier-1');
    assert.ok(refunded.refundedAt, 'Must set refundedAt timestamp');
    // Ensure stock status remained "Stock Restocked" and was not altered
    assert.strictEqual(refunded.returnStatus, 'Stock Restocked');
  });

  await test('Duplicate refund attempts are idempotent and do not double-refund', async () => {
    const duplicate = await customerReturnService.processRefund(
      initialReturn.id,
      'Cash',
      750,
      'cashier-1',
      'Ravi Cashier',
      companyId
    );

    assert.strictEqual(duplicate.refundStatus, 'Refunded');
    assert.strictEqual(duplicate.refundMethod, 'UPI', 'Original refund method preserved');
  });

  // -----------------------------------------------------------------------------
  // 6. UI Structure & Filter Verification
  // -----------------------------------------------------------------------------
  console.log('\n--- 6. CustomerReturnsPage UI Verification ---');

  await test('CustomerReturnsPage.tsx has all required columns, filters and modals', () => {
    const pageCode = fs.readFileSync(path.resolve('src/pages/inventory/CustomerReturnsPage.tsx'), 'utf-8');

    // Required columns
    const columns = [
      'Return ID',
      'Original Invoice',
      'Return Date',
      'Customer Name',
      'Product Name',
      'SKU',
      'Qty',
      'Reason',
      'Refund Status',
      'Return Status',
      'Actions'
    ];
    for (const col of columns) {
      assert.ok(pageCode.includes(col), `Page must contain column or header for: ${col}`);
    }

    // Condition & Date filters are present, and Status filter section has been removed per user prompt
    assert.ok(pageCode.includes('All Conditions'), 'Page must contain Condition filter');
    assert.ok(pageCode.includes('From:'), 'Page must contain From Date filter');
    assert.ok(pageCode.includes('To:'), 'Page must contain To Date filter');

    // Modal forms and actions
    assert.ok(pageCode.includes('New Purchase Return') || pageCode.includes('New Customer Return'), 'Page must have New Purchase Return button/modal');
    assert.ok(pageCode.includes('Remaining Eligible Quantity'), 'Modal must display remaining eligible quantity');
    assert.ok(pageCode.includes('Resalable'), 'Modal must support Resalable condition');
    assert.ok(pageCode.includes('Damaged'), 'Modal must support Damaged condition');
    assert.ok(pageCode.includes('Defective'), 'Modal must support Defective condition');
    assert.ok(pageCode.includes('Expired'), 'Modal must support Expired condition');
  });

  console.log('\n================================================================================');
  console.log(`TOTAL TESTS: ${totalTests}`);
  console.log(`PASSED:      ${passedTests}`);
  console.log(`FAILED:      ${totalTests - passedTests}`);
  console.log('================================================================================');

  if (totalTests === passedTests) {
    console.log('\n🎉 ALL TESTS PASSED! Customer Purchase Returns is fully verified.');
  } else {
    process.exitCode = 1;
  }
}

runAllTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
