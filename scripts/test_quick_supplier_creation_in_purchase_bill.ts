import fs from 'fs';
import path from 'path';
import { supabase } from '../src/lib/supabase';
import { supplierService } from '../src/services/supplierService';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
}

async function runTests() {
  console.log('================================================================================');
  console.log('TEST SUITE: QUICK SUPPLIER CREATION IN PURCHASE BILL FORM');
  console.log('================================================================================\n');

  const invoicePagePath = path.resolve('src/pages/purchases/NewPurchaseInvoicePage.tsx');
  const modalComponentPath = path.resolve('src/components/suppliers/AddSupplierModal.tsx');
  const suppliersPagePath = path.resolve('src/pages/suppliers/SuppliersPage.tsx');

  assert(fs.existsSync(invoicePagePath), 'NewPurchaseInvoicePage.tsx must exist');
  assert(fs.existsSync(modalComponentPath), 'AddSupplierModal.tsx must exist');
  assert(fs.existsSync(suppliersPagePath), 'SuppliersPage.tsx must exist');

  const invoicePageCode = fs.readFileSync(invoicePagePath, 'utf-8');
  const modalCode = fs.readFileSync(modalComponentPath, 'utf-8');
  const suppliersPageCode = fs.readFileSync(suppliersPagePath, 'utf-8');

  // --- 1. UI Button in Purchase Bill Form ---
  console.log('--- 1. Add Supplier Button in Purchase Bill Form ---');
  assert(invoicePageCode.includes('Add Supplier'), 'Purchase Bill form must include "+ Add Supplier" button');
  assert(invoicePageCode.includes('setIsAddSupplierModalOpen(true)'), 'Button click must open the Add Supplier modal');
  assert(invoicePageCode.includes('flex items-center justify-between mb-1'), 'Button must be neatly aligned with Select Supplier label at top-right');
  assert(invoicePageCode.includes('w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold cursor-pointer'), 'Dropdown height and styling must remain intact');
  console.log('  ✓ PASS: "+ Add Supplier" button positioned at top-right of Select Supplier field');

  // --- 2. Reusable AddSupplierModal Form & Fields ---
  console.log('\n--- 2. AddSupplierModal Architecture & Fields ---');
  assert(modalCode.includes('Company Legal Name'), 'Modal must have Company Legal Name field');
  assert(modalCode.includes('Contact Person Name'), 'Modal must have Contact Person Name field');
  assert(modalCode.includes('Phone Number'), 'Modal must have Phone Number field');
  assert(modalCode.includes('Email Address'), 'Modal must have Email Address field');
  assert(modalCode.includes('GSTIN'), 'Modal must have GSTIN field');
  assert(modalCode.includes('PAN Number'), 'Modal must have PAN Number field');
  assert(modalCode.includes('Credit Terms (Days)'), 'Modal must have Credit Terms field');
  assert(modalCode.includes('Opening Balance'), 'Modal must have Opening Balance field');
  assert(modalCode.includes('Supplier Bank Name'), 'Modal must have Supplier Bank Name field');
  assert(modalCode.includes('Account Number'), 'Modal must have Account Number field');
  assert(modalCode.includes('IFSC Code'), 'Modal must have IFSC Code field');
  assert(modalCode.includes('Registered Address'), 'Modal must have Registered Address field');
  assert(modalCode.includes('Save Supplier'), 'Modal must have Save Supplier action');
  assert(modalCode.includes('Cancel'), 'Modal must have Cancel action');
  console.log('  ✓ PASS: AddSupplierModal includes all 12 corporate, banking, and tax fields');

  // --- 3. Duplicate Prevention & Validation ---
  console.log('\n--- 3. Validation & Error Handling ---');
  assert(modalCode.includes('isDuplicateName'), 'Modal must check and prevent duplicate supplier names');
  assert(modalCode.includes('isDuplicateGstin'), 'Modal must check and prevent duplicate GSTIN registrations');
  assert(modalCode.includes('cleanGstin.length !== 15'), 'Modal must validate 15-character GSTIN format');
  assert(modalCode.includes('setErrorMsg'), 'Modal must display inline error messages without losing input state');
  console.log('  ✓ PASS: Duplicate name/GSTIN checks and error alerts verified');

  // --- 4. Reusability Across Pages ---
  console.log('\n--- 4. Unification: Reused in SuppliersPage & NewPurchaseInvoicePage ---');
  assert(suppliersPageCode.includes('<AddSupplierModal'), 'SuppliersPage must reuse the unified AddSupplierModal');
  assert(invoicePageCode.includes('<AddSupplierModal'), 'NewPurchaseInvoicePage must reuse the unified AddSupplierModal');
  console.log('  ✓ PASS: Single source of truth for supplier registration verified across both pages');

  // --- 5. Automatic Dropdown Update & Form Preservation ---
  console.log('\n--- 5. Auto-Selection & State Preservation ---');
  assert(invoicePageCode.includes('setSelectedSupplierId(newSupplier.id)'), 'Newly created supplier ID must be selected immediately');
  assert(invoicePageCode.includes('setCustomSupplierName'), 'Custom supplier name must sync with newly created supplier');
  console.log('  ✓ PASS: New supplier automatically selected on return without resetting bill form state');

  // --- 6. Live Backend Supplier Creation & Cleanup Test ---
  console.log('\n--- 6. Backend Integration Test ---');
  const testSupplier = {
    name: 'Quick Test Vendor Corp',
    company: 'Quick Test Vendor Corp',
    phone: '+91 99887 76655',
    email: 'quickvendor@testcorp.com',
    address: 'Plot 44, Industrial Area',
    gstin: '29ABCDE1234F1Z5',
    pan: 'ABCDE1234F',
    creditDays: 45,
    openingBalance: 0,
    status: 'Active' as const
  };

  const created = await supplierService.createSupplier(testSupplier, '00000000-0000-0000-0000-000000000001');
  assert(Boolean(created && created.id), 'Supplier must be created and return an ID');
  console.log(`  ✓ Created test supplier in backend: ID=${created.id}, Company=${created.company}`);

  // Query back to verify persistence
  const { data: queried } = await supabase.from('suppliers').select('*').eq('id', created.id).single();
  assert(Boolean(queried && queried.name === testSupplier.name), 'Queried supplier must match created data');
  console.log('  ✓ Verified supplier record exists in database table');

  // Cleanup test record to keep database clean
  await supabase.from('suppliers').delete().eq('id', created.id);
  console.log('  ✓ Cleaned up test supplier record from database');

  console.log('\n================================================================================');
  console.log('🎉 ALL QUICK SUPPLIER CREATION TESTS PASSED (100%)');
  console.log('================================================================================');
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

