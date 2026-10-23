import { supabase } from '../src/lib/supabase';

async function main() {
  console.log('--- Inspecting Database Schema ---');
  
  // 1. Check products columns
  const { data: prodData, error: prodErr } = await supabase.from('products').select('*').limit(1);
  if (prodErr) {
    console.error('Products query error:', prodErr.message);
  } else if (prodData && prodData.length > 0) {
    console.log('Products columns:', Object.keys(prodData[0]));
    console.log('Sample product:', prodData[0]);
  } else {
    console.log('Products table exists but is empty.');
  }

  // 2. Check product_batches columns
  const { data: batchData, error: batchErr } = await supabase.from('product_batches').select('*').limit(1);
  if (batchErr) {
    console.error('product_batches query error:', batchErr.message);
  } else if (batchData && batchData.length > 0) {
    console.log('product_batches columns:', Object.keys(batchData[0]));
    console.log('Sample batch:', batchData[0]);
  } else {
    console.log('product_batches table exists but is empty.');
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
