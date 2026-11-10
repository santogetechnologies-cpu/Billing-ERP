import { supabase } from '../src/lib/supabase';

async function main() {
  const { data: products } = await supabase.from('products').select('*').order('created_at', { ascending: false });
  const { data: auditLogs } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false });
  const { data: stockTx } = await supabase.from('stock_transactions').select('*').order('created_at', { ascending: false });
  const { data: suppliers } = await supabase.from('suppliers').select('*');

  console.log(`Products: ${products?.length}, Audit logs: ${auditLogs?.length}, Stock transactions: ${stockTx?.length}`);

  // Test matching products with audit logs and stock transactions
  const productAddHistory = (products || []).map(p => {
    // Find matching audit log for creation
    const createLog = auditLogs?.find(a =>
      (a.module === 'Products' || a.action?.toLowerCase().includes('product')) &&
      (a.record === p.name || a.record === p.sku || a.record === p.code || a.new_value?.includes(p.name))
    );

    // Find opening stock transaction
    const initialTx = stockTx?.find(s =>
      s.product_id === p.id &&
      (s.type === 'Opening Stock' || s.reference_type === 'Opening')
    );

    const sup = suppliers?.find(s => s.id === p.supplier_id || s.name === p.brand);

    return {
      id: p.id,
      name: p.name,
      code: p.code || p.sku,
      category: p.category || 'General',
      supplier: sup?.name || p.brand || (suppliers && suppliers[0] ? suppliers[0].name : 'Primary Supplier'),
      quantityAdded: initialTx ? initialTx.qty : (p.opening_stock || 0),
      unit: p.primary_unit || initialTx?.unit || 'Piece',
      date: p.created_at ? p.created_at.split('T')[0] : (createLog?.date || new Date().toISOString().split('T')[0]),
      addedBy: createLog?.user_name || 'Purchase Manager'
    };
  });

  console.log('Sample product add history records:', JSON.stringify(productAddHistory, null, 2));
}

main().catch(console.error);

