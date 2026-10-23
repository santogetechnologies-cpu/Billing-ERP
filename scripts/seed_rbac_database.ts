// Seeder Script for Supabase PostgreSQL Roles, Permissions, and Role Permissions
import { createClient } from '@supabase/supabase-js';
import { ROLE_PERMISSIONS_MATRIX, AppModule, AppAction } from '../src/utils/rbac';
import { UserRole } from '../src/types';

const supabaseUrl = 'https://zdygiubhmxuonzqchehp.supabase.co';
const supabaseAnonKey = 'sb_publishable_zzlKCAxfsUya4_UePohgnA_QvR8Cz6Q';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const rolesData: { name: UserRole; description: string; is_system: boolean }[] = [
  {
    name: 'Owner',
    description: 'Full unrestricted master access across all business finances, settings, reports, and staff management.',
    is_system: true
  },
  {
    name: 'Admin',
    description: 'Manages company settings, user provisioning, general master records, and audits.',
    is_system: true
  },
  {
    name: 'Accountant',
    description: 'Full access to double-entry ledger, bank reconciliation, journals, chart of accounts, and tax reporting.',
    is_system: true
  },
  {
    name: 'Salesperson',
    description: 'Creates customer quotes, sales orders, tax invoices, and handles payment collections.',
    is_system: true
  },
  {
    name: 'Purchase Manager',
    description: 'Manages suppliers, purchase orders, goods receipts, and vendor bills.',
    is_system: true
  },
  {
    name: 'Warehouse Manager',
    description: 'Tracks warehouse stocks, handles product transfers, stock adjustments, and batches.',
    is_system: true
  },
  {
    name: 'Cashier',
    description: 'Fast front-desk point of sale, customer billing, and daily cash drawer reconciliation.',
    is_system: true
  }
];

const modulesData: { module: AppModule; description: string }[] = [
  { module: 'dashboard', description: 'Business Dashboard & KPI Overview' },
  { module: 'sales', description: 'Sales Invoicing, Quotes & Credit Notes' },
  { module: 'pos', description: 'Fast Point of Sale & Counter Billing' },
  { module: 'purchases', description: 'Purchase Orders & Vendor Bills' },
  { module: 'products', description: 'Product Catalog, SKUs & Units' },
  { module: 'inventory', description: 'Stock Balances, Transfers & Warehouses' },
  { module: 'customers', description: 'Customer Directory & Credit Terms' },
  { module: 'suppliers', description: 'Vendor & Supplier Management' },
  { module: 'expenses', description: 'Operating Expenses & Vouchers' },
  { module: 'payments', description: 'Payment Allocations & Cash/Bank Accounts' },
  { module: 'accounting', description: 'Double-Entry Ledger, Journals & P&L' },
  { module: 'taxes', description: 'Tax Rates & GST Return Filing' },
  { module: 'reports', description: 'Financial & Inventory Analytics' },
  { module: 'barcode', description: 'Barcode Generator & Label Printing' },
  { module: 'users', description: 'User Provisioning & Role Assignments' },
  { module: 'audit', description: 'System Audit Logs & Security History' },
  { module: 'settings', description: 'Company Settings & Master Configurations' }
];

async function seed() {
  console.log('Seeding RBAC roles, permissions, and role_permissions in Supabase...');

  // 1. Seed Roles
  console.log('1. Inserting roles...');
  for (const r of rolesData) {
    const { data: existing } = await supabase.from('roles').select('id').eq('name', r.name).maybeSingle();
    if (!existing) {
      await supabase.from('roles').insert(r);
    }
  }

  const { data: allRoles } = await supabase.from('roles').select('id, name');
  const roleMap = new Map((allRoles || []).map(r => [r.name as UserRole, r.id]));
  console.log(`✓ Roles confirmed: ${roleMap.size} roles.`);

  // 2. Seed Modules / Permissions
  console.log('2. Inserting permissions/modules...');
  for (const m of modulesData) {
    const { data: existing } = await supabase.from('permissions').select('id').eq('module', m.module).maybeSingle();
    if (!existing) {
      await supabase.from('permissions').insert(m);
    }
  }

  const { data: allPerms } = await supabase.from('permissions').select('id, module');
  const permMap = new Map((allPerms || []).map(p => [p.module as AppModule, p.id]));
  console.log(`✓ Permissions confirmed: ${permMap.size} modules.`);

  // 3. Seed Role Permissions
  console.log('3. Inserting role_permissions matrix...');
  let insertedCount = 0;
  for (const [roleName, modules] of Object.entries(ROLE_PERMISSIONS_MATRIX)) {
    const roleId = roleMap.get(roleName as UserRole);
    if (!roleId) continue;

    for (const [moduleName, actions] of Object.entries(modules)) {
      const permId = permMap.get(moduleName as AppModule);
      if (!permId) continue;

      const { data: existing } = await supabase
        .from('role_permissions')
        .select('id')
        .eq('role_id', roleId)
        .eq('permission_id', permId)
        .maybeSingle();

      const payload = {
        role_id: roleId,
        permission_id: permId,
        can_view: actions.view,
        can_create: actions.create,
        can_edit: actions.edit,
        can_delete: actions.delete,
        can_approve: actions.approve,
        can_export: actions.export
      };

      if (existing) {
        await supabase.from('role_permissions').update(payload).eq('id', existing.id);
      } else {
        await supabase.from('role_permissions').insert(payload);
      }
      insertedCount++;
    }
  }

  console.log(`✓ Role permissions matrix successfully seeded (${insertedCount} entries).`);
}

seed().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});
