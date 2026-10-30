import { supabase } from '../src/lib/supabase';

async function main() {
  const { data } = await supabase.from('purchases').select('id, invoice_number, doc_type, created_at');
  console.log('Purchases in DB:', data);
}

main().catch(console.error);
