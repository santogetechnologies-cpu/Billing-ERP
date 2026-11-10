import { supabase } from '../src/lib/supabase';
import { supplierService } from '../src/services/supplierService';
import { enrichSuppliersWithDeliveryStatus } from '../src/utils/supplierStatus';
import { Supplier } from '../src/types';
import fs from 'fs';
import path from 'path';

let totalTests = 0;
let passedTests = 0;

function check(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    process.exitCode = 1;
  }
}

async function run() {
  console.log('================================================================');
  console.log('TEST SUITE: SUPPLIER STATUS UPDATE (ACTIVE <-> INACTIVE)');
  console.log('================================================================\n');

  // 1. Check existing suppliers in the database
  const { data: initialSuppliers, error: initErr } = await supabase
    .from('suppliers')
    .select('*');

  check(!initErr && Array.isArray(initialSuppliers) && initialSuppliers.length > 0, 'Database connection ok and at least 1 supplier exists');
  const targetSupplier = initialSuppliers![0];
  const targetId = targetSupplier.id;
  const initialCount = initialSuppliers!.length;
  console.log(`Testing with target supplier: ID=${targetId}, Name="${targetSupplier.name}", Company="${targetSupplier.company}"`);

  // 2. Test Transition 1: Active -> Inactive
  console.log('\n--- 1. Transition Active -> Inactive ---');
  const updatedToInactive = await supplierService.updateSupplier(targetId, {
    status: 'Inactive'
  });
  check(updatedToInactive !== null && updatedToInactive.status === 'Inactive', 'updateSupplier returned updated row with status "Inactive"');

  // Query DB directly to verify persistence across page refresh
  const { data: dbAfterInactive } = await supabase
    .from('suppliers')
    .select('*')
    .eq('id', targetId)
    .single();
  check(dbAfterInactive?.status === 'Inactive', 'Database persisted status "Inactive" correctly');

  // Verify no duplicate record created
  const { data: countAfterInactive } = await supabase
    .from('suppliers')
    .select('id');
  check(countAfterInactive?.length === initialCount, `No duplicate supplier created (count remained ${initialCount})`);

  // Verify enrichSuppliersWithDeliveryStatus preserves Inactive status
  const dummySupplierInactive: Supplier = {
    id: targetId,
    name: targetSupplier.name,
    company: targetSupplier.company,
    phone: targetSupplier.phone || '',
    email: targetSupplier.email || '',
    address: targetSupplier.address || '',
    gstin: targetSupplier.gstin || '',
    pan: targetSupplier.pan || '',
    creditDays: targetSupplier.credit_days || 30,
    openingBalance: 0,
    currentOutstanding: 0,
    totalPurchases: 0,
    totalPaid: 0,
    status: 'Inactive',
    createdAt: targetSupplier.created_at
  };
  const enrichedInactive = enrichSuppliersWithDeliveryStatus([dummySupplierInactive], {
    preserveSavedStatus: true,
    purchaseOrders: []
  });
  check(enrichedInactive[0].status === 'Inactive', 'enrichSuppliersWithDeliveryStatus preserves "Inactive" status without overwriting');

  // 3. Test Transition 2: Inactive -> Active
  console.log('\n--- 2. Transition Inactive -> Active ---');
  const updatedToActive = await supplierService.updateSupplier(targetId, {
    status: 'Active'
  });
  check(updatedToActive !== null && updatedToActive.status === 'Active', 'updateSupplier returned updated row with status "Active"');

  // Query DB directly to verify persistence across page refresh
  const { data: dbAfterActive } = await supabase
    .from('suppliers')
    .select('*')
    .eq('id', targetId)
    .single();
  check(dbAfterActive?.status === 'Active', 'Database persisted status "Active" correctly');

  // Verify no duplicate record created
  const { data: countAfterActive } = await supabase
    .from('suppliers')
    .select('id');
  check(countAfterActive?.length === initialCount, `No duplicate supplier created (count remained ${initialCount})`);

  // Verify enrichSuppliersWithDeliveryStatus preserves Active status
  const dummySupplierActive: Supplier = {
    ...dummySupplierInactive,
    status: 'Active'
  };
  const enrichedActive = enrichSuppliersWithDeliveryStatus([dummySupplierActive], {
    preserveSavedStatus: true,
    purchaseOrders: []
  });
  check(enrichedActive[0].status === 'Active', 'enrichSuppliersWithDeliveryStatus preserves "Active" status without overwriting');

  // 4. Test Error Handling: Invalid ID must throw
  console.log('\n--- 3. Error Handling Verification ---');
  let threwError = false;
  try {
    await supplierService.updateSupplier('00000000-0000-0000-0000-999999999999', {
      status: 'Inactive'
    });
  } catch (err: any) {
    threwError = true;
    check(err.message.includes('not found') || err.message.includes('Failed to update'), `Non-existent ID throws descriptive error (got: "${err.message}")`);
  }
  check(threwError, 'Non-existent supplier ID threw error and was not silently ignored');

  // 5. Static Inspection: Frontend components
  console.log('\n--- 4. Static Code Inspection ---');
  const suppliersPageContent = fs.readFileSync(path.resolve('src/pages/suppliers/SuppliersPage.tsx'), 'utf-8');
  check(suppliersPageContent.includes('preserveSavedStatus: true'), 'SuppliersPage passes preserveSavedStatus: true to retain user-saved status');
  check(suppliersPageContent.includes('suppliersWithStatus.find(s => s.id === supplierToView?.id)'), 'SuppliersPage provides reactive supplier data to SupplierViewModal');

  const erpContextContent = fs.readFileSync(path.resolve('src/context/ERPContext.tsx'), 'utf-8');
  check(erpContextContent.includes('refreshSuppliers: () => Promise<void>'), 'ERPContext defines refreshSuppliers in interface');
  check(erpContextContent.includes('refreshSuppliers().catch'), 'updateSupplier in ERPContext triggers refreshSuppliers in background');

  const supplierFormModalContent = fs.readFileSync(path.resolve('src/components/suppliers/SupplierFormModal.tsx'), 'utf-8');
  check(supplierFormModalContent.includes('suppliers.find(s => s.id === supplierToEdit.id)'), 'SupplierFormModal resolves latest supplier from state');
  check(supplierFormModalContent.includes('status,'), 'SupplierFormModal includes status in updateSupplier call');

  const supplierViewModalContent = fs.readFileSync(path.resolve('src/components/suppliers/SupplierViewModal.tsx'), 'utf-8');
  check(supplierViewModalContent.includes('supplier.status === \'Active\''), 'SupplierViewModal conditionally styles Active/Inactive badge');

  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passedTests}/${totalTests} Passed (${totalTests - passedTests} Failed)`);
  console.log('================================================================');

  if (passedTests === totalTests) {
    console.log('\n🎉 ALL SUPPLIER STATUS UPDATE TESTS PASSED 100%!\n');
  } else {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});

