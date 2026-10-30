import { supabase } from '../src/lib/supabase';

async function checkWH() {
  const { data } = await supabase.from('warehouses').select('*');
  console.log(JSON.stringify(data, null, 2));
}

checkWH();

