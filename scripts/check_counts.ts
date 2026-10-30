import { supabase } from '../src/lib/supabase';

async function check() {
  const tables = [
    'sales',
    'sales_items',
    'quotations',
    'quotation_items',
    'sales_orders',
    'sales_order_items',
    'sales_returns',
    'sales_return_items',
    'purchases',
    'purchase_items',
    'purchase_requests',
    'purchase_request_items',
    'purchase_returns',
    'purchase_return_items',
    'stock_transactions',
    'stock_transfers',
    'stock_transfer_items',
    'stocks',
    'stock_adjustments',
    'batches',
    'serial_numbers',
    'products',
    'product_barcodes',
    'payments',
    'payment_allocations',
    'expenses',
    'notifications',
    'audit_logs',
    'customers',
    'suppliers',
    'warehouses',
    'companies',
    'profiles',
    'roles',
    'permissions',
    'role_permissions',
    'user_roles'
  ];

  const results: Record<string, number | null> = {};
  for (const t of tables) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
    results[t] = error ? null : (count ?? 0);
  }
  console.log(JSON.stringify(results, null, 2));
}

check();
