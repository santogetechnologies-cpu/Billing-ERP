import { supabase } from '../src/lib/supabase';

async function inspectData() {
  const { data: prods } = await supabase.from('products').select('id, name, sku, category, selling_price, current_stock').limit(10);
  console.log('Sample products:');
  console.table(prods);

  const { data: custs } = await supabase.from('customers').select('id, name, email, phone, company_id');
  console.log('\nCustomers:');
  console.table(custs);

  const { data: supps } = await supabase.from('suppliers').select('id, name, email, phone, company_id');
  console.log('\nSuppliers:');
  console.table(supps);

  const { data: sales } = await supabase.from('sales').select('id, invoice_number, customer_name, grand_total, date').limit(5);
  console.log('\nSample sales:');
  console.table(sales);

  const { data: pmts } = await supabase.from('payments').select('id, payment_number, amount, payment_type, date').limit(5);
  console.log('\nSample payments:');
  console.table(pmts);
}

inspectData();

