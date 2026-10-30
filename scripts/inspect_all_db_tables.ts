import { supabase } from '../src/lib/supabase';

async function inspect() {
  console.log('--- Inspecting Database Tables & Record Counts ---\n');

  // List of tables from migrations
  const tables = [
    // Users & Roles & Auth & Company
    'companies',
    'profiles',
    'user_roles',
    'role_permissions',
    'user_presence',
    'user_activities',
    'user_preferences',
    'company_policies',
    'warehouse_managers',

    // Products & Units & Categories
    'categories',
    'units',
    'products',
    'product_variants',
    'product_barcodes',
    'barcodes',
    'barcode_overrides',

    // Warehouses & Inventory
    'warehouses',
    'stocks',
    'stock_transactions',
    'stock_adjustments',
    'stock_transfers',
    'stock_transfer_items',
    'batches',
    'serial_numbers',
    'inventory_alerts',
    'goods_receipts',
    'goods_receipt_items',

    // Customers & Suppliers
    'customers',
    'suppliers',

    // Purchases
    'purchases',
    'purchase_items',
    'purchase_requests',
    'purchase_request_items',
    'purchase_orders',
    'purchase_bills',
    'purchase_returns',
    'purchase_return_items',

    // Sales
    'sales',
    'sale_items',
    'sales_orders',
    'sales_order_items',
    'sales_returns',
    'sales_return_items',
    'invoices',
    'invoice_items',
    'quotations',
    'quotation_items',

    // Payments & Expenses
    'payments',
    'payment_allocations',
    'expenses',
    'expense_categories',
    'bank_accounts',
    'bank_transactions',

    // Accounting
    'chart_of_accounts',
    'general_ledger',
    'journal_entries',
    'journal_entry_lines',

    // Taxes
    'tax_rates',
    'tax_slabs',

    // System, Notifications, Audit
    'notifications',
    'audit_logs',
    'activity_logs'
  ];

  const results: { table: string; count: number | null; error?: string }[] = [];

  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        // Table might not exist or permission denied
        results.push({ table, count: null, error: error.message });
      } else {
        results.push({ table, count: count ?? 0 });
      }
    } catch (err: any) {
      results.push({ table, count: null, error: err.message });
    }
  }

  console.log('TABLES WITH DATA:');
  const withData = results.filter(r => r.count !== null && r.count > 0);
  for (const r of withData) {
    console.log(`  ${r.table.padEnd(25)}: ${r.count} records`);
  }

  console.log('\nTABLES WITH 0 RECORDS:');
  const zeroCount = results.filter(r => r.count === 0);
  for (const r of zeroCount) {
    console.log(`  ${r.table.padEnd(25)}: 0 records`);
  }

  console.log('\nTABLES NOT FOUND OR ERROR:');
  const errors = results.filter(r => r.count === null);
  for (const r of errors) {
    console.log(`  ${r.table.padEnd(25)}: ${r.error}`);
  }
}

inspect();
