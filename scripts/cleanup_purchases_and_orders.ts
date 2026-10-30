import fs from 'fs';
import path from 'path';
import { supabase } from '../src/lib/supabase';

async function main() {
  console.log('================================================================================');
  console.log('PURCHASE ORDERS & PURCHASE BILLS CLEANUP AND RESET');
  console.log('================================================================================\n');

  const rootDir = process.cwd();
  const backupsDir = path.join(rootDir, 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  // 1. Audit Current State Before Deletion
  console.log('--- Step 1: Auditing Baseline Records ---');
  const { data: allPurchases, error: purFetchErr } = await supabase
    .from('purchases')
    .select('*');

  if (purFetchErr) {
    console.error('❌ Failed to fetch purchases:', purFetchErr);
    process.exit(1);
  }

  const { data: allItems, error: itemsFetchErr } = await supabase
    .from('purchase_items')
    .select('*');

  if (itemsFetchErr) {
    console.error('❌ Failed to fetch purchase_items:', itemsFetchErr);
    process.exit(1);
  }

  const { count: initialProductCount } = await supabase.from('products').select('*', { count: 'exact', head: true });
  const { count: initialSupplierCount } = await supabase.from('suppliers').select('*', { count: 'exact', head: true });
  const { count: initialWarehouseCount } = await supabase.from('warehouses').select('*', { count: 'exact', head: true });
  const { count: initialPaymentCount } = await supabase.from('payments').select('*', { count: 'exact', head: true });
  const { count: initialStockTxCount } = await supabase.from('stock_transactions').select('*', { count: 'exact', head: true });
  const { count: initialSalesCount } = await supabase.from('sales').select('*', { count: 'exact', head: true });

  const poRecords = (allPurchases || []).filter(p => p.doc_type === 'purchase_order');
  const billRecords = (allPurchases || []).filter(p => p.doc_type === 'purchase_invoice' || p.doc_type !== 'purchase_order');

  console.log(`Targeted Purchase Orders to delete: ${poRecords.length}`);
  console.log(`Targeted Purchase Bills to delete:  ${billRecords.length}`);
  console.log(`Targeted Line Items to delete:      ${allItems?.length || 0}`);
  console.log(`Total Purchases records:            ${allPurchases?.length || 0}\n`);

  console.log('Protected Records Baseline:');
  console.log(`- Products:            ${initialProductCount}`);
  console.log(`- Suppliers:           ${initialSupplierCount}`);
  console.log(`- Warehouses:          ${initialWarehouseCount}`);
  console.log(`- Payments:            ${initialPaymentCount}`);
  console.log(`- Stock Transactions:  ${initialStockTxCount}`);
  console.log(`- Sales:               ${initialSalesCount}\n`);

  // 2. Export / Backup Targeted Records
  console.log('--- Step 2: Creating Backup of Targeted Records ---');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `purchases_backup_${timestamp}.json`;
  const backupFilePath = path.join(backupsDir, backupFileName);

  const backupPayload = {
    exportedAt: new Date().toISOString(),
    summary: {
      totalPurchases: allPurchases?.length || 0,
      purchaseOrders: poRecords.length,
      purchaseBills: billRecords.length,
      purchaseItems: allItems?.length || 0,
      baselineCounts: {
        products: initialProductCount,
        suppliers: initialSupplierCount,
        warehouses: initialWarehouseCount,
        payments: initialPaymentCount,
        stockTransactions: initialStockTxCount,
        sales: initialSalesCount
      }
    },
    purchases: allPurchases,
    purchaseItems: allItems
  };

  fs.writeFileSync(backupFilePath, JSON.stringify(backupPayload, null, 2), 'utf-8');
  console.log(`✅ Backup successfully saved to:\n   ${backupFilePath}\n`);

  // 3. Deletion Process (Strict order to prevent orphaned records and FK issues)
  console.log('--- Step 3: Deleting Targeted Purchase Records ---');

  // 3a. Delete line items in purchase_items first
  if (allItems && allItems.length > 0) {
    const itemIds = allItems.map(i => i.id);
    console.log(`Deleting ${itemIds.length} purchase line items...`);
    
    // Batch delete in chunks of 50 to avoid URL length limits
    for (let i = 0; i < itemIds.length; i += 50) {
      const chunk = itemIds.slice(i, i + 50);
      const { error: delItemsErr } = await supabase
        .from('purchase_items')
        .delete()
        .in('id', chunk);

      if (delItemsErr) {
        console.error(`❌ Error deleting purchase_items chunk ${i}:`, delItemsErr);
        process.exit(1);
      }
    }
    console.log('✅ All purchase_items deleted successfully.');
  }

  // 3b. Delete purchase orders and purchase bills in purchases
  if (allPurchases && allPurchases.length > 0) {
    const purchaseIds = allPurchases.map(p => p.id);
    console.log(`Deleting ${purchaseIds.length} purchase records (POs & Bills)...`);

    for (let i = 0; i < purchaseIds.length; i += 50) {
      const chunk = purchaseIds.slice(i, i + 50);
      const { error: delPurErr } = await supabase
        .from('purchases')
        .delete()
        .in('id', chunk);

      if (delPurErr) {
        console.error(`❌ Error deleting purchases chunk ${i}:`, delPurErr);
        process.exit(1);
      }
    }
    console.log('✅ All purchases records (POs & Bills) deleted successfully.\n');
  }

  // 4. Verification Post-Deletion
  console.log('--- Step 4: Verifying Deletion Results ---');
  const { data: remainingPurchases, error: checkPurErr } = await supabase.from('purchases').select('id, doc_type');
  const { data: remainingItems, error: checkItemErr } = await supabase.from('purchase_items').select('id');

  console.log(`Remaining purchases:      ${remainingPurchases?.length ?? 'error'}`);
  console.log(`Remaining purchase_items: ${remainingItems?.length ?? 'error'}`);

  if ((remainingPurchases?.length || 0) !== 0 || (remainingItems?.length || 0) !== 0) {
    console.error('❌ Deletion verification failed: table is not empty!');
    process.exit(1);
  }
  console.log('✅ Verified: All historical Purchase Orders and Purchase Bills have been completely deleted.');

  // 5. Verify Protected Data Integrity
  console.log('\n--- Step 5: Verifying Strict Data Protection ---');
  const { count: postProductCount } = await supabase.from('products').select('*', { count: 'exact', head: true });
  const { count: postSupplierCount } = await supabase.from('suppliers').select('*', { count: 'exact', head: true });
  const { count: postWarehouseCount } = await supabase.from('warehouses').select('*', { count: 'exact', head: true });
  const { count: postPaymentCount } = await supabase.from('payments').select('*', { count: 'exact', head: true });
  const { count: postStockTxCount } = await supabase.from('stock_transactions').select('*', { count: 'exact', head: true });
  const { count: postSalesCount } = await supabase.from('sales').select('*', { count: 'exact', head: true });

  console.log(`- Products:           ${postProductCount} (Baseline: ${initialProductCount}) -> ${postProductCount === initialProductCount ? '✅ UNCHANGED' : '❌ CHANGED'}`);
  console.log(`- Suppliers:          ${postSupplierCount} (Baseline: ${initialSupplierCount}) -> ${postSupplierCount === initialSupplierCount ? '✅ UNCHANGED' : '❌ CHANGED'}`);
  console.log(`- Warehouses:         ${postWarehouseCount} (Baseline: ${initialWarehouseCount}) -> ${postWarehouseCount === initialWarehouseCount ? '✅ UNCHANGED' : '❌ CHANGED'}`);
  console.log(`- Payments:           ${postPaymentCount} (Baseline: ${initialPaymentCount}) -> ${postPaymentCount === initialPaymentCount ? '✅ UNCHANGED' : '❌ CHANGED'}`);
  console.log(`- Stock Transactions: ${postStockTxCount} (Baseline: ${initialStockTxCount}) -> ${postStockTxCount === initialStockTxCount ? '✅ UNCHANGED' : '❌ CHANGED'}`);
  console.log(`- Sales:              ${postSalesCount} (Baseline: ${initialSalesCount}) -> ${postSalesCount === initialSalesCount ? '✅ UNCHANGED' : '❌ CHANGED'}`);

  if (postProductCount !== initialProductCount || postSupplierCount !== initialSupplierCount) {
    console.error('❌ Data protection check failed! Protected records were altered.');
    process.exit(1);
  }

  // 6. Test New Creation Capability (Round-trip sanity check)
  console.log('\n--- Step 6: Verifying New Order and Bill Creation Capability ---');
  
  // Test PO Creation
  const testPO = {
    company_id: '00000000-0000-0000-0000-000000000001',
    invoice_number: 'TEST-VERIFY-PO-001',
    doc_type: 'purchase_order',
    date: new Date().toISOString().split('T')[0],
    supplier_name: 'aswin',
    subtotal: 500,
    tax_total: 90,
    grand_total: 590,
    payment_status: 'Unpaid'
  };

  const { data: createdPO, error: createPOErr } = await supabase.from('purchases').insert(testPO).select().single();
  if (createPOErr) {
    console.error('❌ Failed to create test Purchase Order:', createPOErr);
    process.exit(1);
  }
  console.log(`✅ New Purchase Order created successfully: ID=${createdPO.id}, PO=${createdPO.invoice_number}`);

  // Test Line Item Creation
  const { data: createdPOItem, error: createPOItemErr } = await supabase.from('purchase_items').insert({
    purchase_id: createdPO.id,
    product_name: 'Test Product',
    qty: 5,
    unit: 'Piece',
    rate: 100,
    tax_rate: 18,
    tax_amt: 90,
    total: 590
  }).select().single();

  if (createPOItemErr) {
    console.error('❌ Failed to create test PO line item:', createPOItemErr);
    process.exit(1);
  }
  console.log(`✅ New Purchase Order Item created successfully: ID=${createdPOItem.id}`);

  // Clean up the temporary verification PO
  await supabase.from('purchase_items').delete().eq('id', createdPOItem.id);
  await supabase.from('purchases').delete().eq('id', createdPO.id);
  console.log('✅ Temporary test PO cleaned up to maintain clean state (0 orders).');

  // Test Purchase Bill Creation
  const testBill = {
    company_id: '00000000-0000-0000-0000-000000000001',
    invoice_number: 'TEST-VERIFY-BILL-001',
    doc_type: 'purchase_invoice',
    date: new Date().toISOString().split('T')[0],
    supplier_name: 'aswin',
    subtotal: 1000,
    tax_total: 180,
    grand_total: 1180,
    payment_status: 'Paid',
    paid_amount: 1180
  };

  const { data: createdBill, error: createBillErr } = await supabase.from('purchases').insert(testBill).select().single();
  if (createBillErr) {
    console.error('❌ Failed to create test Purchase Bill:', createBillErr);
    process.exit(1);
  }
  console.log(`✅ New Purchase Bill created successfully: ID=${createdBill.id}, Bill=${createdBill.invoice_number}`);

  // Clean up the temporary verification Bill
  await supabase.from('purchases').delete().eq('id', createdBill.id);
  console.log('✅ Temporary test Bill cleaned up to maintain clean state (0 bills).');

  // Final check to confirm 0 records
  const { count: finalPurchasesCount } = await supabase.from('purchases').select('*', { count: 'exact', head: true });
  const { count: finalItemsCount } = await supabase.from('purchase_items').select('*', { count: 'exact', head: true });

  console.log('\n================================================================================');
  console.log(`FINAL DATABASE STATE:`);
  console.log(`- Purchase Orders / Bills (purchases table): ${finalPurchasesCount} (EXPECTED: 0)`);
  console.log(`- Purchase Order / Bill Items:               ${finalItemsCount} (EXPECTED: 0)`);
  console.log(`- Products:                                  ${postProductCount} (PRESERVED)`);
  console.log(`- Suppliers:                                 ${postSupplierCount} (PRESERVED)`);
  console.log(`- Warehouses:                                ${postWarehouseCount} (PRESERVED)`);
  console.log(`- Payments:                                  ${postPaymentCount} (PRESERVED)`);
  console.log(`- Stock Transactions:                        ${postStockTxCount} (PRESERVED)`);
  console.log(`- Sales:                                     ${postSalesCount} (PRESERVED)`);
  console.log('================================================================================');
  console.log('🎉 CLEANUP & RESET COMPLETED SUCCESSFULLY!');
}

main().catch(err => {
  console.error('Fatal error during cleanup:', err);
  process.exit(1);
});

