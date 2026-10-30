import { supabase } from '../src/lib/supabase';

async function checkFKs() {
  // Let's query information_schema or check relationships from migrations
  const { data, error } = await supabase.rpc('get_foreign_keys');
  if (error) {
    console.log('get_foreign_keys RPC not available, analyzing via migrations.');
  } else {
    console.log('Foreign keys:', data);
  }
}

checkFKs();

