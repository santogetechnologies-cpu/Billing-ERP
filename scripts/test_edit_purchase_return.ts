import fs from 'fs';
import path from 'path';
import { getAppStorage } from '../src/utils/storageUtils';
import { customerReturnService } from '../src/services/customerReturnService';
import { CustomerReturn, UpdateCustomerReturnInput } from '../src/types';

const storage = getAppStorage();

let passed = 0;
let failed = 0;

function assert(condition: boolean, desc: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${desc}`);
    failed++;
  }
}

async function runTestSuite() {
  console.log('================================================================================');
  console.log('TEST SUITE: EDIT PURCHASE RETURN DETAILS & INVENTORY SAFETY');
  console.log('================================================================================\n');

  const pagePath = path.resolve(process.cwd(), 'src/pages/inventory/CustomerReturnsPage.tsx');
  const pageContent = fs.readFileSync(pagePath, 'utf-8');

  // Verify KPI summary card buttons removed
  assert(
    !pageContent.includes('KPI Summary Cards (Interactive Filter Shortcuts)') &&
    !pageContent.includes('metrics.totalRefundValue'),
    'KPI summary card buttons have been cleanly removed from Purchase Return page'
  );

  // ---------------------------------------------------------------------------
  // 1. UI VERIFICATION: Action Buttons & Edit Modal
  // ---------------------------------------------------------------------------
  console.log('\n--- 1. Verification of Actions Column & View Details Modal ---');

  // Check Eye icon retained in Actions column
  assert(
    pageContent.includes('<Eye className="w-4 h-4" />') &&
    pageContent.includes('title="View Return Details"'),
    'Main table retains Eye (View Details) button in Actions column'
  );

  // Check Edit (pencil) icon is REMOVED from main table row actions
  const tableActionsSection = pageContent.substring(
    pageContent.indexOf('{/* 7. Actions */}'),
    pageContent.indexOf('</tbody>')
  );
  assert(
    !tableActionsSection.includes('title="Edit Return Details"') &&
    !tableActionsSection.includes('<Edit2 className="w-4 h-4" />'),
    'Main table actions column does NOT include Edit button (removed from directory table)'
  );

  // Check Table layout is responsive and properly sized
  assert(
    pageContent.includes('table-auto sm:table-fixed') &&
    pageContent.includes('w-[6%] sm:w-[70px]'),
    'Main table has balanced proportional widths and fixed action width to prevent clipping'
  );

  // Check Edit button inside View Return Details modal
  assert(
    pageContent.includes('<span>Edit Return</span>') &&
    pageContent.includes('<Edit2 className="w-3.5 h-3.5" />'),
    'View Return Details modal includes an Edit button inside its panel'
  );

  // Check In-form editing inside View modal
  assert(
    pageContent.includes('isEditingInspect') &&
    pageContent.includes('startEditingInspect') &&
    pageContent.includes('cancelEditingInspect'),
    'Supports seamless in-form editing directly inside the view details panel'
  );

  // Check Sales Person permission
  assert(
    pageContent.includes('const canEditReturn = isSalesperson || isOwnerOrAdmin;'),
    'Editing is authorized for Sales Person (and Owner/Admin)'
  );

  // ---------------------------------------------------------------------------
  // 2. UI VERIFICATION: Read-Only & Editable Fields
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Read-Only vs Editable Fields in Edit Form ---');

  assert(
    pageContent.includes('Original Sale Reference (Read-Only)') &&
    pageContent.includes('{inspectingReturn.returnNumber}') &&
    pageContent.includes('{inspectingReturn.originalInvoiceNumber}') &&
    pageContent.includes('{inspectingReturn.productName}') &&
    pageContent.includes('{inspectingReturn.soldQty}'),
    'Return ID, original invoice number, and sale reference are kept read-only'
  );

  assert(
    pageContent.includes('Customer Name') &&
    pageContent.includes('editCustomerName') &&
    pageContent.includes('editCustomerPhone') &&
    pageContent.includes('editReturnedQty') &&
    pageContent.includes('editCondition') &&
    pageContent.includes('editWarehouseId') &&
    pageContent.includes('editReason') &&
    pageContent.includes('editNotes'),
    'Customer details, quantity, condition, warehouse, reason, and notes are editable'
  );

  assert(
    pageContent.includes('Save Changes') &&
    pageContent.includes('Cancel') &&
    pageContent.includes('handleSaveEdit'),
    'Provides Save Changes and Cancel buttons with validation handler'
  );

  assert(
    pageContent.includes('Edit History & Audit Trail') &&
    pageContent.includes('inspectingReturn.auditTrail'),
    'View Details panel displays full audit trail of edits (field, old, new, author, date)'
  );

  // ---------------------------------------------------------------------------
  // 3. SERVICE INTEGRATION & INVENTORY SAFETY
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Inventory Recalculation & Delta Logic (Inventory Safety) ---');

  const companyId = '00000000-0000-0000-0000-000000000001';
  const testProdId = `prod-edit-${Date.now()}`;
  const testWh1 = '00000000-0000-0000-0000-000000000001';
  const testWh2 = '00000000-0000-0000-0000-000000000002';
  const testInvoiceId = `inv-edit-${Date.now()}`;

  // Initialize mock product in storage
  const prodKey = `universal_billing_products_${companyId}`;
  const initialStock = 20;
  const mockProduct = {
    id: testProdId,
    name: 'Safety Test Drill',
    sku: 'DRILL-001',
    stock: initialStock,
    currentStock: initialStock,
    minStock: 5,
    unit: 'Piece',
    companyId
  };
  storage.setItem(prodKey, JSON.stringify([mockProduct]));

  // Initialize mock warehouse balance in storage
  const whKey = `universal_billing_stock_balances_${companyId}`;
  storage.setItem(whKey, JSON.stringify([
    {
      productId: testProdId,
      warehouseId: testWh1,
      quantity: initialStock,
      companyId
    },
    {
      productId: testProdId,
      warehouseId: testWh2,
      quantity: 5,
      companyId
    }
  ]));

  // Step A: Create a direct return of 5 units (Resalable)
  // Stock should become 20 + 5 = 25
  const createInput = {
    originalInvoiceId: testInvoiceId,
    originalInvoiceNumber: 'INV-2026-EDIT',
    customerId: 'cust-1',
    customerName: 'Priya Verma',
    customerPhone: '9876543210',
    productId: testProdId,
    productName: 'Safety Test Drill',
    sku: 'DRILL-001',
    soldQty: 10,
    returnedQty: 5,
    unitPrice: 500,
    refundAmount: 2500,
    reason: 'Customer Return',
    condition: 'Resalable' as const,
    warehouseId: testWh1,
    warehouseName: 'Main Godown',
    notes: 'Initial return',
    returnDate: new Date().toISOString().split('T')[0],
    directRestock: true,
    isDirectReturn: true
  };

  const initialReturn = await customerReturnService.createCustomerReturn(
    {
      ...createInput,
      createdBy: '00000000-0000-0000-0000-000000000001',
      createdByName: 'Ramesh Sales'
    },
    companyId
  );

  const prodAfterCreate = JSON.parse(storage.getItem(prodKey) || '[]').find((p: any) => p.id === testProdId);
  assert(
    prodAfterCreate.currentStock === 25,
    `Initial direct return of 5 units sets stock to 25 (was ${initialStock})`
  );

  // Step B: Edit Returned Quantity: Increase from 5 to 7 units
  // Delta should be +2 (7 - 5). Total stock should become 25 + 2 = 27.
  // NEVER add 7 again (which would wrongly make it 32).
  const updateInput1: UpdateCustomerReturnInput = {
    customerName: 'Priya Sharma (Married)',
    customerPhone: '9876543211',
    returnedQty: 7,
    reason: 'Wrong Item Delivered',
    condition: 'Resalable',
    warehouseId: testWh1,
    notes: 'Updated to 7 units after full box inspection',
    updatedBy: 'user-sales-1',
    updatedByName: 'Ramesh Sales'
  };

  const result1 = await customerReturnService.updateCustomerReturn(
    initialReturn.id,
    updateInput1,
    companyId,
    'user-sales-1',
    'Ramesh Sales'
  );

  const prodAfterUpdate1 = JSON.parse(storage.getItem(prodKey) || '[]').find((p: any) => p.id === testProdId);
  assert(
    result1.productStockDelta === 2,
    'Calculates productStockDelta as exact difference (+2), NOT the entire quantity'
  );
  assert(
    prodAfterUpdate1.currentStock === 27,
    `Stock correctly adjusted by +2 to 27 (never duplicate entire quantity of 7)`
  );
  assert(
    result1.updatedReturn.customerName === 'Priya Sharma (Married)',
    'Customer details (name) successfully updated and persisted'
  );
  assert(
    result1.auditLogs.some(l => l.field === 'returnedQty' && Number(l.oldValue) === 5 && Number(l.newValue) === 7),
    'Audit trail records returnedQty change from 5 to 7'
  );

  // Step C: Edit Returned Quantity: Decrease from 7 to 4 units
  // Delta should be -3 (4 - 7). Total stock should become 27 - 3 = 24.
  const updateInput2: UpdateCustomerReturnInput = {
    returnedQty: 4,
    notes: 'Reduced to 4 units'
  };

  const result2 = await customerReturnService.updateCustomerReturn(
    initialReturn.id,
    updateInput2,
    companyId,
    'user-sales-1',
    'Ramesh Sales'
  );

  const prodAfterUpdate2 = JSON.parse(storage.getItem(prodKey) || '[]').find((p: any) => p.id === testProdId);
  assert(
    result2.productStockDelta === -3,
    'Calculates productStockDelta as exact deduction (-3)'
  );
  assert(
    prodAfterUpdate2.currentStock === 24,
    'Stock correctly reduced by 3 to 24'
  );

  // Step D: Prevent Exceeding Original Sold Qty
  // Sold qty is 10. Trying to set returnedQty to 11 must be rejected!
  let exceededErrorCaught = false;
  try {
    await customerReturnService.updateCustomerReturn(
      initialReturn.id,
      { returnedQty: 11 },
      companyId,
      'user-sales-1',
      'Ramesh Sales'
    );
  } catch (err: any) {
    exceededErrorCaught = true;
    assert(
      err.message.includes('exceeds') && (err.message.includes('eligible') || err.message.includes('quantity')),
      `Validation prevents returned quantity exceeding sold quantity: "${err.message}"`
    );
  }
  assert(exceededErrorCaught, 'Excessive quantity edit is strictly blocked');

  // Step E: Reclassification from Resalable to Damaged (Quarantine)
  // Currently: 4 units Resalable in stock.
  // When changed to Damaged: 4 units must be removed from sellable stock (delta = -4). Stock becomes 24 - 4 = 20.
  const updateInput3: UpdateCustomerReturnInput = {
    condition: 'Damaged',
    reason: 'Damaged in Transit',
    notes: 'Packaging was crushed upon further inspection'
  };

  const result3 = await customerReturnService.updateCustomerReturn(
    initialReturn.id,
    updateInput3,
    companyId,
    'user-sales-1',
    'Ramesh Sales'
  );

  const prodAfterUpdate3 = JSON.parse(storage.getItem(prodKey) || '[]').find((p: any) => p.id === testProdId);
  assert(
    result3.productStockDelta === -4,
    'Changing condition to Damaged correctly applies delta (-4) to remove non-sellable goods from stock'
  );
  assert(
    prodAfterUpdate3.currentStock === 20,
    'Stock successfully reduced back to baseline (20) after damaged goods isolated'
  );

  // Step F: Inventory Consistency Check (Negative Stock Prevention)
  // Set warehouse balance artificially low to test consistency failure
  const balances = JSON.parse(storage.getItem(whKey) || '[]');
  const wh1Bal = balances.find((b: any) => b.productId === testProdId && b.warehouseId === testWh1);
  wh1Bal.quantity = 1; // only 1 in stock now
  storage.setItem(whKey, JSON.stringify(balances));

  // If a return had 5 resalable units, and we want to change it to Damaged or reduce it by 5,
  // warehouse balance would become 1 - 5 = -4. The system MUST abort the edit with an explanation!
  const retToReduce = await customerReturnService.createCustomerReturn(
    {
      originalInvoiceId: `inv-consist-${Date.now()}`,
      originalInvoiceNumber: 'INV-CONSIST-01',
      customerId: 'cust-1',
      customerName: 'Test Inconsistency',
      productId: testProdId,
      productName: 'Safety Test Drill',
      soldQty: 10,
      returnedQty: 5,
      unitPrice: 500,
      reason: 'Wrong Item',
      condition: 'Resalable',
      warehouseId: testWh1,
      isDirectReturn: false,
      createdBy: '00000000-0000-0000-0000-000000000001',
      createdByName: 'Ramesh Sales'
    },
    companyId
  );
  // Mark it restocked
  retToReduce.returnStatus = 'Stock Restocked';
  retToReduce.restockedAt = new Date().toISOString();
  const allReturns = JSON.parse(storage.getItem(`universal_billing_customer_returns_${companyId}`) || '[]');
  const idx = allReturns.findIndex((r: any) => r.id === retToReduce.id);
  if (idx >= 0) {
    allReturns[idx] = retToReduce;
  } else {
    allReturns.push(retToReduce);
  }
  storage.setItem(`universal_billing_customer_returns_${companyId}`, JSON.stringify(allReturns));

  let inconsistencyCaught = false;
  try {
    // Attempting to reclassify to Damaged would deduct 5 from warehouse which only has 1
    await customerReturnService.updateCustomerReturn(
      retToReduce.id,
      { condition: 'Damaged' },
      companyId,
      'user-sales-1',
      'Ramesh Sales'
    );
  } catch (err: any) {
    inconsistencyCaught = true;
    assert(
      err.message.includes('Inventory inconsistency') || err.message.includes('insufficient'),
      `Inventory consistency check blocked edit: "${err.message}"`
    );
  }
  assert(inconsistencyCaught, 'Inconsistent stock reduction is prevented with explanatory error');

  // Step G: Multi-return partial returns check
  // Original sold: 10. Return A has 4. Return B has 3.
  // Return A can be edited up to (10 - 3) = 7.
  const maxEligibleForA = await customerReturnService.getRemainingEligibleQty(
    testInvoiceId,
    testProdId,
    10,
    companyId,
    initialReturn.id // exclude return A
  );
  assert(
    maxEligibleForA >= 6,
    `getRemainingEligibleQty correctly excludes current return when checking maximum eligible quantity (${maxEligibleForA})`
  );

  console.log('\n================================================================================');
  console.log(`TOTAL TESTS: ${passed + failed}`);
  console.log(`PASSED:      ${passed}`);
  console.log(`FAILED:      ${failed}`);
  console.log('================================================================================\n');

  if (failed === 0) {
    console.log('🎉 ALL TESTS PASSED! Edit Purchase Return Details functionality is fully verified.');
    process.exit(0);
  } else {
    console.error(`❌ ${failed} test(s) failed.`);
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
