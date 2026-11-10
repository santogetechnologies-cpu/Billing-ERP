import { supabase } from '../src/lib/supabase';

async function main() {
  const { data: auditLogs } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(25);
  console.log('Recent audit logs:', auditLogs?.map(a => ({
    action: a.action,
    module: a.module,
    user: a.user_name,
    record: a.record,
    date: a.date,
    time: a.time,
    created_at: a.created_at
  })));

  const { data: prods } = await supabase.from('products').select('*');
  console.log('Products:', prods?.map(p => ({
    id: p.id,
    name: p.name,
    code: p.code,
    sku: p.sku,
    category: p.category,
    opening_stock: p.opening_stock,
    current_stock: p.current_stock,
    created_at: p.created_at
  })));
}

main().catch(console.error);

