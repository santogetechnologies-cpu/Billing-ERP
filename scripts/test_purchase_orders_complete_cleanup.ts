import { supabase } from '../src/lib/supabase';
import { purchaseRequestService } from '../src/services/purchaseRequestService';

async function main() {
  console.log('================================================================================');
  console.log('TEST SUITE: VERIFYING COMPLETE PURCHASE ORDERS CLEANUP & INTEGRITY');
  console.log('================================================================================\n');

  // 1. Direct Database Verification
  console.log('--- 1. Database Purchase Records Check ---');
  const { data: poRecords, error: poErr } = await supabase
    .from('purchases')
    .select('id, doc_type, invoice_number')
    .eq('doc_type', 'purchase_order');

  if (poErr) {
    console.error('❌ Failed to query purchases:', poErr.message);
    process.exit(1);
  }

  console.log(`Live Purchase Orders in database: ${poRecords?.length || 0}`);
  if ((poRecords?.length || 0) !== 0) {
    console.error('❌ Expected 0 purchase orders in database, but found:', poRecords?.length);
    process.exit(1);
  }
  console.log('  ✓ PASS: Exactly 0 purchase orders in database');

  const { data: piRecords, error: piErr } = await supabase
    .from('purchase_items')
    .select('id');

  if (piErr) {
    console.error('❌ Failed to query purchase_items:', piErr.message);
    process.exit(1);
  }

  console.log(`Live Purchase Order line items in database: ${piRecords?.length || 0}`);
  if ((piRecords?.length || 0) !== 0) {
    console.error('❌ Expected 0 purchase line items in database, but found:', piRecords?.length);
    process.exit(1);
  }
  console.log('  ✓ PASS: Exactly 0 purchase line items in database');

  // 2. Protected Data Safety Audit
  console.log('\n--- 2. Protected Records Safety Audit ---');
  const { count: prodCount } = await supabase.from('products').select('*', { count: 'exact', head: true });
  const { count: suppCount } = await supabase.from('suppliers').select('*', { count: 'exact', head: true });
  const { count: whCount } = await supabase.from('warehouses').select('*', { count: 'exact', head: true });
  const { count: payCount } = await supabase.from('payments').select('*', { count: 'exact', head: true });
  const { count: stCount } = await supabase.from('stock_transactions').select('*', { count: 'exact', head: true });
  const { count: salesCount } = await supabase.from('sales').select('*', { count: 'exact', head: true });
  const { count: custCount } = await supabase.from('customers').select('*', { count: 'exact', head: true });

  console.log(`- Products:           ${prodCount} (Expected: 0)`);
  console.log(`- Suppliers:          ${suppCount} (Expected: 0)`);
  console.log(`- Warehouses:         ${whCount} (Expected: 7)`);
  console.log(`- Payments:           ${payCount} (Expected: 0)`);
  console.log(`- Stock Transactions: ${stCount} (Expected: 0)`);
  console.log(`- Sales:              ${salesCount} (Expected: 0)`);
  console.log(`- Customers:          ${custCount} (Expected: 0)`);

  if (whCount !== 7 || prodCount !== 0 || suppCount !== 0 || payCount !== 0 || stCount !== 0 || salesCount !== 0) {
    console.error('❌ Safety Audit Failed: Business records must be 0 after mock data removal, and warehouses must be 7!');
    process.exit(1);
  }
  console.log('  ✓ PASS: All mock data verified cleared (0 records) & warehouses intact (7 records)');

  // 3. Purchase Request & Cache Sanitization Check
  console.log('\n--- 3. Purchase Requests & Cache Sanitization Check ---');
  const prs = await purchaseRequestService.getPurchaseRequests(undefined, '00000000-0000-0000-0000-000000000001');
  const ghostPOs = prs.filter(r => r.purchaseOrderNumber || r.purchaseOrderId);
  console.log(`Cached purchase requests with linked POs: ${ghostPOs.length}`);
  if (ghostPOs.length !== 0) {
    console.error('❌ Found ghost purchase orders in requests cache:', ghostPOs.map(r => r.purchaseOrderNumber));
    process.exit(1);
  }
  console.log('  ✓ PASS: Zero ghost purchase orders synthesized from cached requests');

  // 4. Test New Purchase Order Creation
  console.log('\n--- 4. New Purchase Order Functionality Test ---');
  const testPO = {
    company_id: '00000000-0000-0000-0000-000000000001',
    invoice_number: 'TEST-FRESH-PO-999',
    doc_type: 'purchase_order',
    date: new Date().toISOString().split('T')[0],
    supplier_name: 'aswin',
    subtotal: 1200,
    tax_total: 216,
    grand_total: 1416,
    payment_status: 'Unpaid'
  };

  const { data: createdPO, error: createErr } = await supabase.from('purchases').insert(testPO).select().single();
  if (createErr) {
    console.error('❌ Failed to insert new purchase order:', createErr.message);
    process.exit(1);
  }
  console.log(`  ✓ PASS: Successfully created new Purchase Order: ${createdPO.invoice_number} (ID: ${createdPO.id})`);

  // Insert child line items
  const { data: createdItem, error: itemErr } = await supabase.from('purchase_items').insert({
    purchase_id: createdPO.id,
    product_name: 'Test Steel Beam',
    qty: 10,
    unit: 'Piece',
    rate: 120,
    tax_rate: 18,
    tax_amt: 216,
    total: 1416
  }).select().single();

  if (itemErr) {
    console.error('❌ Failed to insert line item for new purchase order:', itemErr.message);
    process.exit(1);
  }
  console.log(`  ✓ PASS: Successfully inserted child line item for new PO (ID: ${createdItem.id})`);

  // Query back to verify appearance
  const { data: retrievedPO } = await supabase
    .from('purchases')
    .select('*, purchase_items(*)')
    .eq('id', createdPO.id)
    .single();

  if (!retrievedPO || retrievedPO.purchase_items?.length !== 1) {
    console.error('❌ Failed to retrieve newly created PO with line items!');
    process.exit(1);
  }
  console.log(`  ✓ PASS: New Purchase Order retrieved with 1 line item, Grand Total=${retrievedPO.grand_total}`);

  // Clean up temporary test order
  await supabase.from('purchase_items').delete().eq('id', createdItem.id);
  await supabase.from('purchases').delete().eq('id', createdPO.id);
  console.log('  ✓ PASS: Cleaned up temporary verification order back to 0 baseline');

  // 5. Final Confirmation
  const { count: finalPOCount } = await supabase.from('purchases').select('*', { count: 'exact', head: true }).eq('doc_type', 'purchase_order');
  const { count: finalItemCount } = await supabase.from('purchase_items').select('*', { count: 'exact', head: true });
  console.log(`\nFinal Database Count -> Purchase Orders: ${finalPOCount}, Items: ${finalItemCount}`);

  if (finalPOCount !== 0 || finalItemCount !== 0) {
    console.error('❌ Final cleanup confirmation failed: Count is not 0!');
    process.exit(1);
  }

  console.log('\n================================================================================');
  console.log('🎉 ALL PURCHASE ORDER CLEANUP & INTEGRITY CHECKS PASSED (100%)');
  console.log('================================================================================');
}

main().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
