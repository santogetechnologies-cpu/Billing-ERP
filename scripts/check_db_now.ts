import { supabase } from '../src/lib/supabase';

async function main() {
  console.log('--- Checking current database state ---');
  const { data: pData } = await supabase.from('purchases').select('id, doc_type, invoice_number');
  console.log('Current purchases in DB:', pData?.length);

  const { data: piData } = await supabase.from('purchase_items').select('id');
  console.log('Current purchase_items in DB:', piData?.length);

  // Check if there are ANY purchase requests with status in ordered, active, etc.
  const { data: prData } = await supabase.from('purchase_requests').select('*');
  console.log('purchase_requests in DB:', prData?.length);

  // Check if there are any other tables with "order" or "purchase"
  const { data: oData, error: oErr } = await supabase.from('orders').select('*');
  console.log('orders in DB:', oData?.length, oErr?.code);
}

main().catch(console.error);
