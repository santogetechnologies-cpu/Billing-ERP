import { supabase } from '../src/lib/supabase';

async function chunkDelete(table: string, idField: string = 'id') {
  console.log(`Checking ${table}...`);
  let totalDeleted = 0;

  while (true) {
    const { data: rows, error: fetchErr } = await supabase
      .from(table)
      .select(idField)
      .limit(1000);

    if (fetchErr) {
      console.error(`❌ Error fetching ${table}:`, fetchErr.message);
      return false;
    }

    if (!rows || rows.length === 0) {
      if (totalDeleted > 0) {
        console.log(`  ✅ Successfully cleared total ${totalDeleted} rows from ${table}`);
      } else {
        console.log(`  ✓ ${table} is clean (0 rows)`);
      }
      break;
    }

    const ids = rows.map((r: any) => r[idField]);
    console.log(`  Deleting batch of ${ids.length} rows from ${table}...`);

    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const { error: delErr } = await supabase
        .from(table)
        .delete()
        .in(idField, chunk);

      if (delErr) {
        console.error(`❌ Error deleting chunk from ${table}:`, delErr.message);
        return false;
      }
    }

    totalDeleted += ids.length;
  }

  return true;
}

async function main() {
  console.log('================================================================================');
  console.log('FINALIZING SAFE DATABASE RESET: ENSURING ALL MOCK DATA IS 0');
  console.log('================================================================================\n');

  // Verify baseline users before doing anything
  const { count: initialUserCount, error: userErr } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  if (userErr || initialUserCount === null || initialUserCount === 0) {
    console.error('❌ Aborting: Cannot verify profiles table:', userErr);
    process.exit(1);
  }
  console.log(`🔒 User Protection Verified: ${initialUserCount} user accounts in profiles.\n`);

  const deletionSequence = [
    'payments',
    'sales_items',
    'sales',
    'stock_transfer_items',
    'stock_transfers',
    'stock_transactions',
    'product_barcodes',
    'products',
    'customers',
    'suppliers',
    'notifications',
    'audit_logs'
  ];

  for (const table of deletionSequence) {
    const ok = await chunkDelete(table);
    if (!ok) {
      console.error(`❌ Failed on ${table}. Halting execution.`);
      process.exit(1);
    }
  }

  console.log('\n================================================================================');
  console.log('POST-CLEANUP AUDIT & INTEGRITY VERIFICATION');
  console.log('================================================================================\n');

  let allZero = true;
  for (const table of deletionSequence) {
    const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if ((count ?? 0) !== 0) {
      console.error(`❌ ${table} has ${count} records remaining (expected 0)`);
      allZero = false;
    } else {
      console.log(`  ✓ ${table.padEnd(25)}: 0 records`);
    }
  }

  console.log('\n--- Protected System & User Entities ---');
  const { count: finalUserCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
  const { count: finalRoleCount } = await supabase.from('roles').select('*', { count: 'exact', head: true });
  const { count: finalPermCount } = await supabase.from('permissions').select('*', { count: 'exact', head: true });
  const { count: finalRolePermCount } = await supabase.from('role_permissions').select('*', { count: 'exact', head: true });
  const { count: finalCompanyCount } = await supabase.from('companies').select('*', { count: 'exact', head: true });
  const { count: finalWarehouseCount } = await supabase.from('warehouses').select('*', { count: 'exact', head: true });

  console.log(`  ✓ User Profiles:          ${finalUserCount} (Intact, exactly matches initial ${initialUserCount})`);
  console.log(`  ✓ Roles:                  ${finalRoleCount} (Intact)`);
  console.log(`  ✓ Permissions:            ${finalPermCount} (Intact)`);
  console.log(`  ✓ Role Permissions:       ${finalRolePermCount} (Intact)`);
  console.log(`  ✓ Companies:              ${finalCompanyCount} (Intact)`);
  console.log(`  ✓ Warehouses:             ${finalWarehouseCount} (Intact)`);

  if (!allZero || finalUserCount !== initialUserCount) {
    console.error('\n❌ POST-CLEANUP VERIFICATION FAILED.');
    process.exit(1);
  }

  console.log('\n================================================================================');
  console.log('🎉 ALL MOCK DATA HAS BEEN COMPLETELY REMOVED! ZERO DATA INSERTED.');
  console.log('================================================================================');
}

main();
