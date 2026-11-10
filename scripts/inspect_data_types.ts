import { supabase } from '../src/lib/supabase';

async function main() {
  const { data: purchases } = await supabase.from('purchases').select('id, invoice_number, doc_type, supplier_name, date, grand_total, payment_status, notes');
  console.log('Purchases doc_types:', [...new Set(purchases?.map(p => p.doc_type))]);
  console.log('Sample purchases with doc_type:');
  console.log(purchases?.slice(0, 10));

  // Check returns
  const { data: returnsData, error: retErr } = await supabase.from('customer_returns').select('*').limit(5);
  console.log('\ncustomer_returns table:', retErr ? retErr.message : returnsData);

  // Check audit_logs modules/actions
  const { data: auditData } = await supabase.from('audit_logs').select('action, module').limit(50);
  console.log('\naudit_logs actions:', [...new Set(auditData?.map(a => `${a.module}:${a.action}`))]);

  // Check stock_transactions
  const { data: stockTx } = await supabase.from('stock_transactions').select('*').limit(5);
  console.log('\nsample stock_transactions:', stockTx);
}

main().catch(console.error);

