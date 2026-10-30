import { supabase } from '../src/lib/supabase';

async function main() {
  console.log('--- Inspecting Companies & Purchases across ALL companies ---');
  const { data: comps } = await supabase.from('companies').select('*');
  console.log('Companies:', comps?.map(c => ({ id: c.id, name: c.name })));

  // Query purchases with NO company_id filter
  const { data: allPurchases } = await supabase.from('purchases').select('id, company_id, doc_type, invoice_number');
  console.log('Total purchases across all companies:', allPurchases?.length);

  // Check if purchase_orders table exists in any schema or if there's any other table
  const { data: tablesData, error: tErr } = await supabase.rpc('get_tables');
  if (tErr) {
    console.log('rpc get_tables error:', tErr.message);
  } else {
    console.log('Tables from rpc:', tablesData);
  }
}

main().catch(console.error);
