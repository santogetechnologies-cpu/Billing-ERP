import { purchaseService } from '../src/services/purchaseService';
import { supabase } from '../src/lib/supabase';

async function main() {
  console.log('--- Checking purchaseService.getPurchaseReturns ---');
  try {
    const pReturns = await purchaseService.getPurchaseReturns();
    console.log('Purchase Returns count:', pReturns.length);
    console.log('Sample purchase returns:', JSON.stringify(pReturns, null, 2));
  } catch (err: any) {
    console.error('getPurchaseReturns error:', err.message);
  }

  // Also check if any purchase return is in local storage or in purchases table
  const { data: purTable } = await supabase.from('purchases').select('*').eq('doc_type', 'purchase_return');
  console.log('purchases table doc_type=purchase_return:', purTable);
}

main().catch(console.error);
