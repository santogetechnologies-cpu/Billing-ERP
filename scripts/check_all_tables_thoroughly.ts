import { supabase } from '../src/lib/supabase';

async function main() {
  console.log('--- Checking all possible tables in Supabase for purchase orders ---');

  // Let's test tables: purchases, orders, purchase_orders, purchase_requests, etc.
  const tables = [
    'purchases',
    'purchase_items',
    'orders',
    'purchase_orders',
    'purchase_order_items',
    'purchase_requests',
    'purchase_request_items',
    'goods_receipts',
    'goods_receipt_items',
    'suppliers',
    'products',
    'warehouse_stock',
    'stock_transactions',
    'audit_logs',
    'notifications'
  ];

  for (const t of tables) {
    try {
      const { data, error, count } = await supabase.from(t).select('*', { count: 'exact' }).limit(5);
      if (error) {
        console.log(`Table ${t}: Error (${error.code}) - ${error.message}`);
      } else {
        console.log(`Table ${t}: Found ${count} rows`);
        if (data && data.length > 0) {
          const sample = data[0];
          console.log(`  Sample keys from ${t}:`, Object.keys(sample));
          if (sample.order_number || sample.invoice_number || sample.doc_type) {
            console.log(`  Sample order keys: order_number=${sample.order_number}, invoice_number=${sample.invoice_number}, doc_type=${sample.doc_type}`);
          }
        }
      }
    } catch (e: any) {
      console.log(`Table ${t} exception:`, e.message);
    }
  }
}

main().catch(console.error);
