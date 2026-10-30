import fs from 'fs';
import path from 'path';
import { supabase } from '../src/lib/supabase';

async function backup() {
  console.log('=== STARTING DATABASE BACKUP ===');
  const backupTables = [
    'products',
    'product_barcodes',
    'stock_transactions',
    'stock_transfers',
    'stock_transfer_items',
    'sales',
    'sales_items',
    'payments',
    'customers',
    'suppliers',
    'notifications',
    'audit_logs'
  ];

  const backupData: Record<string, any[]> = {};

  for (const table of backupTables) {
    let allRows: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.error(`Error backing up ${table}:`, error.message);
        break;
      }
      if (data && data.length > 0) {
        allRows = allRows.concat(data);
        if (data.length < pageSize) hasMore = false;
        else page++;
      } else {
        hasMore = false;
      }
    }

    backupData[table] = allRows;
    console.log(`Backed up ${table}: ${allRows.length} rows`);
  }

  const scratchDir = 'C:\\Users\\mijil\\.gemini\\antigravity\\brain\\66fef0be-4cdb-4d28-9702-f07be6cce9e5\\scratch';
  if (!fs.existsSync(scratchDir)) {
    fs.mkdirSync(scratchDir, { recursive: true });
  }

  const backupFile = path.join(scratchDir, 'db_backup_pre_cleanup.json');
  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
  console.log(`\n✅ Backup successfully saved to: ${backupFile}`);
}

backup();

