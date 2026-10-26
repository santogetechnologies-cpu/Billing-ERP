/**
 * Backend Scheduled Job: End-of-Day Expiry Reminder
 * 
 * Runs at the end of each business day at the configured closing time.
 * Evaluates batches that are in their 30-day expiry-warning window across
 * assigned warehouses, and dispatches a single daily reminder to each
 * responsible Warehouse Manager.
 * 
 * Usage:
 *   npx tsx scripts/run_eod_expiry_reminder.ts [--force] [--company <id>] [--date YYYY-MM-DD]
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { getBusinessDayConfig, stockAlertService } from '../src/services/stockAlertService';
import { notificationService } from '../src/services/notificationService';
import { Batch, CompanyProfile, Warehouse, NotificationItem } from '../src/types';

// Load .env manually if present
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] || '';
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
} catch {}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://zdygiubhmxuonzqchehp.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkeWdpdWJobXh1b256cWNoZWhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAxMTQxOTMsImV4cCI6MjA1NTY5MDE5M30.4i4k30YI-3B_b4Xo8Z3_qJ8p_mP0_qJ8p_mP0';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface CliArgs {
  force: boolean;
  companyId?: string;
  forceDate?: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = { force: false };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--force') {
      result.force = true;
    } else if (args[i] === '--company' && args[i + 1]) {
      result.companyId = args[++i];
    } else if (args[i] === '--date' && args[i + 1]) {
      result.forceDate = args[++i];
    }
  }

  return result;
}

async function runScheduledReminderJob() {
  const args = parseArgs();
  console.log(`[EOD Expiry Scheduler] Starting run at ${new Date().toISOString()} (force: ${args.force})...`);

  // 1. Fetch companies
  let compQuery = supabase.from('companies').select('*');
  if (args.companyId) {
    compQuery = compQuery.eq('id', args.companyId);
  }
  const { data: companies, error: compErr } = await compQuery;
  const targetCompanies =
    companies && companies.length > 0
      ? companies
      : [
          {
            id: args.companyId || '00000000-0000-0000-0000-000000000001',
            name: 'Universal Billing Company',
            closing_time: '18:00',
            timezone: 'Asia/Kolkata'
          }
        ];

  let totalRemindersSent = 0;

  for (const comp of targetCompanies) {
    console.log(`\n[EOD Expiry Scheduler] Evaluating company: "${comp.name}" (${comp.id})`);

    const companyProfile: Partial<CompanyProfile> = {
      id: comp.id,
      name: comp.name,
      ...comp
    };

    const bConfig = getBusinessDayConfig(companyProfile);
    const businessDate = args.forceDate || bConfig.currentBusinessDate;
    console.log(`[EOD Expiry Scheduler] Configured Timezone: ${bConfig.timezone}, Closing Time: ${bConfig.closingTime}, Date: ${businessDate}`);

    if (!args.force && !bConfig.isAfterClosingTime) {
      console.log(`[EOD Expiry Scheduler] Skipping: Current time has not yet reached closing time (${bConfig.closingTime}).`);
      continue;
    }

    // 2. Fetch warehouses
    const { data: warehouses } = await supabase
      .from('warehouses')
      .select('*, warehouse_managers(user_id)')
      .eq('company_id', comp.id);

    const formattedWarehouses: Warehouse[] = (warehouses || []).map((w: any) => ({
      id: w.id,
      name: w.name,
      code: w.code,
      address: w.address || '',
      managerId: w.manager_id,
      managerIds: [
        ...(w.manager_id ? [w.manager_id] : []),
        ...(w.warehouse_managers ? w.warehouse_managers.map((m: any) => m.user_id) : [])
      ],
      isActive: w.is_active ?? true
    }));

    // 3. Fetch batches
    const { data: batchesRaw } = await supabase
      .from('product_batches')
      .select('*, products(id, name, sku)')
      .eq('company_id', comp.id);

    const formattedBatches: Batch[] = (batchesRaw || []).map((b: any) => ({
      id: b.id,
      productId: b.product_id,
      productName: b.products?.name || b.product_name || 'Product',
      batchNumber: b.batch_number,
      mfgDate: b.mfg_date,
      expiryDate: b.expiry_date,
      purchaseDate: b.purchase_date,
      cost: Number(b.cost || 0),
      qty: Number(b.qty || 0),
      status: b.status || 'Active',
      warehouseId: b.warehouse_id
    }));

    // 4. Fetch existing notifications for deduplication
    const existingNotifs = await notificationService.getNotifications(comp.id);

    // 5. Run EOD reminder logic
    const reminders = await stockAlertService.checkEndOfDayExpiryReminder({
      batches: formattedBatches,
      companyId: comp.id,
      company: companyProfile,
      warehouses: formattedWarehouses,
      forceDate: businessDate,
      forceCheck: args.force,
      existingNotifications: existingNotifs,
      createNotification: async (notif, cId) => {
        return await notificationService.createNotification(notif, cId || comp.id);
      }
    });

    console.log(`[EOD Expiry Scheduler] Reminders dispatched for "${comp.name}": ${reminders.length}`);
    for (const r of reminders) {
      console.log(`  -> Sent to user "${r.userId || 'admin'}": ${r.message}`);
    }

    totalRemindersSent += reminders.length;
  }

  console.log(`\n[EOD Expiry Scheduler] Run finished. Total reminders dispatched: ${totalRemindersSent}.`);
}

runScheduledReminderJob().catch(err => {
  console.error('[EOD Expiry Scheduler] Fatal error during scheduled run:', err);
  process.exit(1);
});
