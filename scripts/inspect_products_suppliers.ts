import { supabase } from '../src/lib/supabase';

async function main() {
  const { data: sups } = await supabase.from('suppliers').select('id, name, company, phone');
  console.log('Suppliers:', sups);

  const { data: prods } = await supabase.from('products').select('id, name, supplier_id, brand, default_warehouse_id');
  console.log('Products supplier info:', prods);
}

main().catch(console.error);

