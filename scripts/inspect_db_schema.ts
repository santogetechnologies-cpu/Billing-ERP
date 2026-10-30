import { supabase } from '../src/lib/supabase';

async function main() {
  console.log('--- Inspecting Database Schema ---');
  
  // 1. Check warehouses columns
  const { data: whData, error: whErr } = await supabase.from('warehouses').select('*').limit(1);
  if (whErr) {
    console.error('warehouses error:', whErr);
  } else if (whData && whData.length > 0) {
    console.log('warehouses columns:', Object.keys(whData[0]));
    console.log('Sample warehouse:', whData[0]);
  } else {
    console.log('warehouses table exists but is empty.');
  }

  // 2. Check purchase_orders
  const { data: poData, error: poErr } = await supabase.from('purchase_orders').select('*').limit(1);
  if (poErr) {
    console.log('purchase_orders error:', { message: poErr.message, code: poErr.code, status: (poErr as any).status });
  } else {
    console.log('purchase_orders exists!');
  }

  // 3. Check document_settings
  const { data: docData, error: docErr } = await supabase.from('document_settings').select('*').limit(10);
  if (docErr) {
    console.error('document_settings error:', docErr);
  } else {
    console.log('document_settings count:', docData.length);
    console.log('document_settings rows:', docData.map(d => ({ id: d.id, company_id: d.company_id, doc_type: d.doc_type, title: d.title })));
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
