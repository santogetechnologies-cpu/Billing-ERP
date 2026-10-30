import { supabase } from '../src/lib/supabase';

async function main() {
  console.log('--- 1. PROFILES (USERS) ---');
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, company_id, created_at');

  if (pErr) console.error('Error fetching profiles:', pErr);
  else console.table(profiles);

  console.log('\n--- 2. COMPANIES ---');
  const { data: companies, error: cErr } = await supabase
    .from('companies')
    .select('id, name, created_at');

  if (cErr) console.error('Error fetching companies:', cErr);
  else console.table(companies);

  console.log('\n--- 3. WAREHOUSES ---');
  const { data: warehouses, error: wErr } = await supabase
    .from('warehouses')
    .select('id, name, code, company_id');

  if (wErr) console.error('Error fetching warehouses:', wErr);
  else console.table(warehouses);

  console.log('\n--- 4. SUPPLIERS ---');
  const { data: suppliers, error: sErr } = await supabase
    .from('suppliers')
    .select('id, name, company_id');

  if (sErr) console.error('Error fetching suppliers:', sErr);
  else console.table(suppliers);

  console.log('\n--- 5. CUSTOMERS ---');
  const { data: customers, error: cuErr } = await supabase
    .from('customers')
    .select('id, name, company_id');

  if (cuErr) console.error('Error fetching customers:', cuErr);
  else console.table(customers);
}

main();
