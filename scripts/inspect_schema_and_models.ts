import { supabase } from '../src/lib/supabase';

async function checkProducts() {
  const { data, error } = await supabase.from('products').select('id, name, sku, current_stock, selling_price, purchase_price, primary_unit');
  console.log('Products:', JSON.stringify(data, null, 2));
}

checkProducts().catch(console.error);
