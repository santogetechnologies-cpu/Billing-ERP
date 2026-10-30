import { supabase } from '../src/lib/supabase';

async function check() {
  const { data: items } = await supabase.from('purchase_items').select('*').limit(3);
  console.log('Sample purchase_items:', JSON.stringify(items, null, 2));

  const { data: samplePurchase } = await supabase.from('purchases').select('*').limit(2);
  console.log('Sample purchases:', JSON.stringify(samplePurchase, null, 2));
}
check();
