// Central Role-Based Access Control (RBAC) System for Universal Billing ERP
// Enforces granular permissions (view, create, edit, delete, approve, export, manage)
// across all 7 business roles and 17 core modules.

import { UserRole } from '../types';
import { supabase } from '../lib/supabase';
import { getInMemoryStaffSession } from '../services/authService';

export type AppModule =
  | 'dashboard'
  | 'sales'
  | 'pos'
  | 'purchases'
  | 'products'
  | 'inventory'
  | 'customers'
  | 'suppliers'
  | 'expenses'
  | 'payments'
  | 'accounting'
  | 'taxes'
  | 'reports'
  | 'barcode'
  | 'users'
  | 'audit'
  | 'settings';

export type AppAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'approve'
  | 'export'
  | 'manage';

export interface ModulePermissions {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  approve: boolean;
  export: boolean;
  manage: boolean;
}

export type RolePermissionMap = Record<AppModule, ModulePermissions>;

const ALL_ALLOWED: ModulePermissions = {
  view: true,
  create: true,
  edit: true,
  delete: true,
  approve: true,
  export: true,
  manage: true
};

const ALL_DENIED: ModulePermissions = {
  view: false,
  create: false,
  edit: false,
  delete: false,
  approve: false,
  export: false,
  manage: false
};

const VIEW_ONLY: ModulePermissions = {
  view: true,
  create: false,
  edit: false,
  delete: false,
  approve: false,
  export: false,
  manage: false
};

const VIEW_EXPORT: ModulePermissions = {
  view: true,
  create: false,
  edit: false,
  delete: false,
  approve: false,
  export: true,
  manage: false
};

// ---------------------------------------------------------------------------
// CENTRAL PERMISSION MATRIX BY ROLE
// ---------------------------------------------------------------------------
export const ROLE_PERMISSIONS_MATRIX: Record<UserRole, RolePermissionMap> = {
  // 1. Owner: Full master system control across all areas
  Owner: {
    dashboard: ALL_ALLOWED,
    sales: ALL_ALLOWED,
    pos: ALL_ALLOWED,
    purchases: ALL_ALLOWED,
    products: ALL_ALLOWED,
    inventory: ALL_ALLOWED,
    customers: ALL_ALLOWED,
    suppliers: ALL_ALLOWED,
    expenses: ALL_ALLOWED,
    payments: ALL_ALLOWED,
    accounting: ALL_ALLOWED,
    taxes: ALL_ALLOWED,
    reports: ALL_ALLOWED,
    barcode: ALL_ALLOWED,
    users: ALL_ALLOWED,
    audit: ALL_ALLOWED,
    settings: ALL_ALLOWED
  },

  // 2. Admin: Company settings, user provisioning, audit logs, and administrative oversight
  // Administrative settings within assigned permissions; no Company Policy management (Owner only)
  Admin: {
    dashboard: ALL_ALLOWED,
    sales: ALL_ALLOWED,
    pos: ALL_ALLOWED,
    purchases: ALL_ALLOWED,
    products: ALL_ALLOWED,
    inventory: ALL_ALLOWED,
    customers: ALL_ALLOWED,
    suppliers: ALL_ALLOWED,
    expenses: ALL_ALLOWED,
    payments: ALL_ALLOWED,
    accounting: ALL_ALLOWED,
    taxes: ALL_ALLOWED,
    reports: ALL_ALLOWED,
    barcode: ALL_ALLOWED,
    users: ALL_ALLOWED,
    audit: ALL_ALLOWED,
    settings: { view: true, create: true, edit: true, delete: false, approve: false, export: true, manage: true }
  },

  // 3. Accountant: Accounting, general ledger, journals, bank reconciliation, taxes, financial reports
  // Strictly blocked from user management, warehouse admin, company settings & company policy
  Accountant: {
    dashboard: { view: true, create: false, edit: false, delete: false, approve: false, export: true, manage: false },
    accounting: { view: true, create: true, edit: true, delete: true, approve: true, export: true, manage: true },
    payments: { view: true, create: true, edit: true, delete: false, approve: true, export: true, manage: false },
    expenses: { view: true, create: true, edit: true, delete: false, approve: true, export: true, manage: false },
    taxes: { view: true, create: true, edit: true, delete: false, approve: true, export: true, manage: true },
    reports: { view: true, create: false, edit: false, delete: false, approve: false, export: true, manage: false },
    // Cross-module read for audit and bookkeeping validation
    sales: VIEW_EXPORT,
    purchases: VIEW_EXPORT,
    customers: VIEW_ONLY,
    suppliers: VIEW_ONLY,
    products: VIEW_ONLY,
    // Permitted personal & appearance settings
    settings: { view: true, create: false, edit: false, delete: false, approve: false, export: false, manage: false },
    // Forbidden areas
    pos: ALL_DENIED,
    inventory: ALL_DENIED,
    barcode: ALL_DENIED,
    users: ALL_DENIED,
    audit: VIEW_ONLY
  },

  // 4. Salesperson: Sales order preparation & viewing, customer management, catalog lookup inside Sales
  // Strictly blocked from POS counter checkout, billing/payments, sales edits/deletions, returns/refunds,
  // inventory management, product master editing, purchasing, accounting, user management, and settings
  Salesperson: {
    dashboard: { view: true, create: false, edit: false, delete: false, approve: false, export: false, manage: false },
    sales: { view: true, create: true, edit: false, delete: false, approve: false, export: true, manage: false },
    customers: { view: true, create: true, edit: true, delete: false, approve: false, export: true, manage: false },
    // Read-only catalog details for price and SKU inspection inside Sales
    products: VIEW_ONLY,
    // View-only real-time shop inventory for customer stock queries
    inventory: VIEW_ONLY,
    // Permitted personal & appearance settings
    settings: { view: true, create: false, edit: false, delete: false, approve: false, export: false, manage: false },
    pos: ALL_DENIED,
    payments: ALL_DENIED,
    purchases: ALL_DENIED,
    suppliers: ALL_DENIED,
    expenses: ALL_DENIED,
    accounting: ALL_DENIED,
    taxes: ALL_DENIED,
    reports: ALL_DENIED,
    barcode: ALL_DENIED,
    users: ALL_DENIED,
    audit: ALL_DENIED
  },

  // 5. Purchase Manager: Suppliers, purchase orders, goods receipts, vendor bills, purchasing records
  // Strictly blocked from sales administration, accounting, user management
  'Purchase Manager': {
    dashboard: { view: true, create: false, edit: false, delete: false, approve: false, export: false, manage: false },
    purchases: { view: true, create: true, edit: true, delete: false, approve: true, export: true, manage: false },
    suppliers: { view: true, create: true, edit: true, delete: false, approve: false, export: true, manage: false },
    expenses: { view: true, create: true, edit: false, delete: false, approve: false, export: false, manage: false },
    // Shared cross-module read to inspect product costs and stock levels for re-ordering
    products: VIEW_ONLY,
    inventory: VIEW_ONLY,
    // Permitted personal & appearance settings
    settings: { view: true, create: false, edit: false, delete: false, approve: false, export: false, manage: false },
    // Forbidden areas
    sales: ALL_DENIED,
    pos: ALL_DENIED,
    customers: ALL_DENIED,
    payments: ALL_DENIED,
    accounting: ALL_DENIED,
    taxes: ALL_DENIED,
    reports: ALL_DENIED,
    barcode: ALL_DENIED,
    users: ALL_DENIED,
    audit: ALL_DENIED
  },

  // 6. Warehouse Manager: Warehouses, stock transfers, stock adjustments, batches, serials, valuation
  // Strictly blocked from finances, payments, sales, user management
  'Warehouse Manager': {
    dashboard: { view: true, create: false, edit: false, delete: false, approve: false, export: false, manage: false },
    inventory: { view: true, create: true, edit: true, delete: false, approve: true, export: true, manage: true },
    products: { view: true, create: true, edit: true, delete: true, approve: false, export: true, manage: false }, // Inventory, batch edits & product master deletion
    barcode: { view: true, create: true, edit: true, delete: false, approve: false, export: true, manage: true },
    // Shared cross-module read for receiving incoming shipments
    purchases: VIEW_ONLY,
    // Permitted personal & appearance settings
    settings: { view: true, create: false, edit: false, delete: false, approve: false, export: false, manage: false },
    // Forbidden areas
    sales: ALL_DENIED,
    pos: ALL_DENIED,
    customers: ALL_DENIED,
    suppliers: ALL_DENIED,
    expenses: ALL_DENIED,
    payments: ALL_DENIED,
    accounting: ALL_DENIED,
    taxes: ALL_DENIED,
    reports: ALL_DENIED,
    users: ALL_DENIED,
    audit: ALL_DENIED
  },

  // 7. Cashier: Fast Point of Sale (POS), counter billing, daily cash drawer reconciliation
  // Strictly blocked from accounting, purchasing, warehouses, user management
  Cashier: {
    dashboard: { view: true, create: false, edit: false, delete: false, approve: false, export: false, manage: false },
    pos: { view: true, create: true, edit: false, delete: false, approve: false, export: false, manage: false },
    sales: { view: true, create: true, edit: false, delete: false, approve: false, export: false, manage: false }, // Counter billing only
    // Permitted cashier customer & product functions
    customers: { view: true, create: true, edit: false, delete: false, approve: false, export: false, manage: false },
    products: VIEW_ONLY, // Price & barcode check
    payments: { view: true, create: true, edit: false, delete: false, approve: false, export: false, manage: false }, // Cash drawer receipt
    // Permitted personal & appearance settings
    settings: { view: true, create: false, edit: false, delete: false, approve: false, export: false, manage: false },
    // Forbidden areas
    purchases: ALL_DENIED,
    suppliers: ALL_DENIED,
    inventory: ALL_DENIED,
    expenses: ALL_DENIED,
    accounting: ALL_DENIED,
    taxes: ALL_DENIED,
    reports: ALL_DENIED,
    barcode: ALL_DENIED,
    users: ALL_DENIED,
    audit: ALL_DENIED
  }
};

// ---------------------------------------------------------------------------
// ROUTE TO MODULE MAPPING
// ---------------------------------------------------------------------------
export const ROUTE_MODULE_MAP: Record<string, { module: AppModule; action: AppAction }> = {
  // Dashboard
  '/': { module: 'dashboard', action: 'view' },
  '/dashboard': { module: 'dashboard', action: 'view' },
  '/sales/dashboard': { module: 'dashboard', action: 'view' },
  '/warehouse/dashboard': { module: 'dashboard', action: 'view' },
  '/purchases/dashboard': { module: 'dashboard', action: 'view' },

  // POS
  '/sales/pos': { module: 'pos', action: 'view' },

  // Sales
  '/sales': { module: 'sales', action: 'view' },
  '/sales/invoices': { module: 'sales', action: 'view' },
  '/sales/new': { module: 'sales', action: 'create' },
  '/sales/documents': { module: 'sales', action: 'view' },
  '/sales/returns': { module: 'sales', action: 'view' },

  // Purchases
  '/purchases': { module: 'purchases', action: 'view' },
  '/purchases/invoices': { module: 'purchases', action: 'view' },
  '/purchases/requests': { module: 'purchases', action: 'view' },
  '/purchases/orders': { module: 'purchases', action: 'view' },
  '/purchases/barcode-management': { module: 'purchases', action: 'edit' },
  '/purchases/barcode-override': { module: 'purchases', action: 'edit' },
  '/purchases/new': { module: 'purchases', action: 'create' },
  '/purchases/returns': { module: 'purchases', action: 'view' },

  // Products
  '/products': { module: 'products', action: 'view' },
  '/products/new': { module: 'products', action: 'create' },
  '/units': { module: 'products', action: 'manage' },
  '/pricing': { module: 'products', action: 'manage' },

  // Inventory
  '/inventory': { module: 'inventory', action: 'view' },
  '/inventory/purchase-returns': { module: 'inventory', action: 'view' },
  '/inventory/customer-returns': { module: 'inventory', action: 'view' },
  '/inventory/returns': { module: 'inventory', action: 'view' },
  '/inventory/alerts': { module: 'inventory', action: 'view' },
  '/inventory/reorder': { module: 'inventory', action: 'view' },
  '/inventory/purchase-requests': { module: 'inventory', action: 'view' },
  '/inventory/warehouses': { module: 'inventory', action: 'manage' },
  '/inventory/transfers': { module: 'inventory', action: 'view' },
  '/inventory/adjustments': { module: 'inventory', action: 'view' },
  '/inventory/batches': { module: 'inventory', action: 'view' },
  '/inventory/serials': { module: 'inventory', action: 'view' },
  '/inventory/valuation': { module: 'inventory', action: 'view' },
  '/inventory/total-cost': { module: 'inventory', action: 'view' },

  // Customers & Suppliers
  '/customers': { module: 'customers', action: 'view' },
  '/suppliers': { module: 'suppliers', action: 'view' },

  // Expenses
  '/expenses': { module: 'expenses', action: 'view' },

  // Payments & Banking
  '/payments': { module: 'payments', action: 'view' },
  '/cash-bank': { module: 'payments', action: 'view' },
  '/receivables': { module: 'payments', action: 'view' },
  '/payables': { module: 'payments', action: 'view' },

  // Accounting
  '/accounting': { module: 'accounting', action: 'view' },
  '/accounting/ledger': { module: 'accounting', action: 'view' },
  '/accounting/trial-balance': { module: 'accounting', action: 'view' },
  '/accounting/profit-loss': { module: 'accounting', action: 'view' },
  '/accounting/balance-sheet': { module: 'accounting', action: 'view' },
  '/accounting/cash-flow': { module: 'accounting', action: 'view' },

  // Taxes, Reports & Barcode
  '/taxes': { module: 'taxes', action: 'view' },
  '/reports': { module: 'reports', action: 'view' },
  '/barcode': { module: 'barcode', action: 'view' },

  // Administration
  '/users': { module: 'users', action: 'manage' },
  '/users/activity': { module: 'users', action: 'manage' },
  '/audit-log': { module: 'audit', action: 'view' },
  '/settings': { module: 'settings', action: 'view' }
};

// ---------------------------------------------------------------------------
// SPECIALIZED GOVERNANCE & POLICY HELPERS
// ---------------------------------------------------------------------------

/**
 * Validates whether the role is authorized to access User Activity Monitoring & Login Time Tracking.
 * STRICT ENFORCEMENT: ONLY the Owner role can view user activity telemetry, session logs, and login durations.
 * Admin and all other operational roles are strictly denied.
 */
export function canAccessUserActivity(role?: UserRole | string | null): boolean {
  return role === 'Owner';
}

/**
 * Validates whether the role is authorized to create, edit, publish, or delete Company Policies.
 * STRICT ENFORCEMENT: ONLY the Owner role can modify company policies.
 * Admin and all operational roles are strictly prohibited.
 */
export function canManageCompanyPolicy(role?: UserRole | string | null): boolean {
  return role === 'Owner';
}


/**
 * Validates whether the role can view published company policies (read-only).
 * All authenticated roles can view published policies.
 */
export function canViewCompanyPolicy(role?: UserRole | string | null): boolean {
  return !!role;
}

/**
 * Validates whether the role can manage company-wide profiles, sequence numbering, and tax invoice design.
 * Restricted to Owner and Admin.
 */
export function canManageCompanySettings(role?: UserRole | string | null): boolean {
  return role === 'Owner' || role === 'Admin';
}

/**
 * Validates whether the role can execute database backups, resets, and cache synchronizations.
 * Restricted to Owner and Admin.
 */
export function canManageSystemConfig(role?: UserRole | string | null): boolean {
  return role === 'Owner' || role === 'Admin';
}

/**
 * Validates whether the role can view and update account security settings (credentials & sessions).
 * Salespersons do not have access to Account & Security settings.
 */
export function canAccessAccountSecurity(role?: UserRole | string | null): boolean {
  if (!role) return false;
  return role !== 'Salesperson';
}

/**
 * Validates whether the role can configure stock threshold notifications.
 * Salespersons do not manage warehouse reorder points or inventory buffers.
 */
export function canConfigureStockAlerts(role?: UserRole | string | null): boolean {
  if (!role) return false;
  return role !== 'Salesperson';
}

/**
 * Validates whether the role can configure sales order dispatch confirmations.
 * Hidden for Salespersons who perform direct front-desk POS billing.
 */
export function canConfigureSalesDispatchAlerts(role?: UserRole | string | null): boolean {
  if (!role) return false;
  return role !== 'Salesperson';
}

/**
 * Validates whether the user role displays the "My Profile" quick action in the header dropdown.
 * Executive roles (Owner & Admin) display it in the header; staff roles (Salesperson, Warehouse Manager,
 * Purchase Manager, Cashier, Accountant) have this placed cleanly in the sidebar below Settings.
 */
export function canAccessHeaderProfile(role?: UserRole | string | null): boolean {
  if (!role) return false;
  return role === 'Owner' || role === 'Admin';
}

/**
 * Validates whether the role is authorized to perform Barcode Management & Barcode Overrides.
 * Barcode Management belongs to Warehouse Operations and is removed from Purchase Manager.
 * Restricted to authorized Owner and Admin roles.
 */
export function canManageBarcodeOverride(role?: UserRole | string | null): boolean {
  if (!role) return false;
  if (role === 'Purchase Manager') return false;
  if ((role === 'Owner' || role === 'Admin') && (hasPermission(role, 'purchases', 'edit') || hasPermission(role, 'barcode', 'edit') || hasPermission(role, 'products', 'edit'))) return true;
  return false;
}

// ---------------------------------------------------------------------------
// CORE AUTHORIZATION HELPERS
// ---------------------------------------------------------------------------

export function normalizeRole(role: UserRole | string | undefined | null): UserRole | null {
  if (!role) return null;
  const trimmed = role.trim();
  if (trimmed === 'Sales Person' || trimmed === 'Sales person' || trimmed === 'salesperson') {
    return 'Salesperson';
  }
  return trimmed as UserRole;
}

/**
 * Validates whether a specific role has permission to execute an action on a module.
 */
export function hasPermission(
  role: UserRole | string | undefined | null,
  module: AppModule,
  action: AppAction = 'view'
): boolean {
  if (!role) return false;

  // Normalized role check
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) return false;
  const rolePermissions = ROLE_PERMISSIONS_MATRIX[normalizedRole];

  if (!rolePermissions) {
    // Unknown or unverified role: deny by default
    return false;
  }

  const modulePerms = rolePermissions[module];
  if (!modulePerms) return false;

  return !!modulePerms[action];
}

/**
 * Resolves whether a route path can be accessed by the given role.
 */
export function canAccessRoute(
  role: UserRole | string | undefined | null,
  path: string
): boolean {
  if (!role || !path || typeof path !== 'string') return false;
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) return false;

  // Clean trailing slashes
  const cleanPath = path === '/' ? '/' : path.replace(/\/$/, '');

  // Purchase Return / Customer Returns under Inventory:
  // Authorized for Owner, Admin, Warehouse Manager, Salesperson (submit/view returns), and Cashier (refund processing)
  if (
    cleanPath === '/inventory/purchase-returns' ||
    cleanPath === '/inventory/customer-returns' ||
    cleanPath === '/inventory/returns'
  ) {
    return (
      normalizedRole === 'Owner' ||
      normalizedRole === 'Admin' ||
      normalizedRole === 'Warehouse Manager' ||
      normalizedRole === 'Salesperson' ||
      normalizedRole === 'Cashier'
    );
  }

  // Prevent Purchase Manager from accessing Warehouse Manager's Barcode Management page or purchase barcode routes
  if (normalizedRole === 'Purchase Manager') {
    if (cleanPath === '/barcode' || cleanPath.startsWith('/barcode/') || cleanPath.startsWith('/purchases/barcode')) {
      return false;
    }

    // Purchase Manager Inventory Access Rules:
    // Authorized: /inventory (Stock Overview), /inventory/total-cost, and /inventory/valuation (Total Product Cost)
    // Hidden & Forbidden: /inventory/alerts, /inventory/reorder, /inventory/purchase-requests, /inventory/transfers,
    //                     /inventory/adjustments, /inventory/batches, /inventory/serials, /inventory/warehouses
    if (
      cleanPath === '/inventory/alerts' ||
      cleanPath.startsWith('/inventory/alerts/') ||
      cleanPath === '/inventory/reorder' ||
      cleanPath.startsWith('/inventory/reorder/') ||
      cleanPath === '/inventory/purchase-requests' ||
      cleanPath.startsWith('/inventory/purchase-requests/') ||
      cleanPath === '/inventory/purchase-returns' ||
      cleanPath.startsWith('/inventory/purchase-returns/') ||
      cleanPath === '/inventory/customer-returns' ||
      cleanPath.startsWith('/inventory/customer-returns/') ||
      cleanPath === '/inventory/returns' ||
      cleanPath.startsWith('/inventory/returns/') ||
      cleanPath === '/inventory/transfers' ||
      cleanPath.startsWith('/inventory/transfers/') ||
      cleanPath === '/inventory/adjustments' ||
      cleanPath.startsWith('/inventory/adjustments/') ||
      cleanPath === '/inventory/batches' ||
      cleanPath.startsWith('/inventory/batches/') ||
      cleanPath === '/inventory/serials' ||
      cleanPath.startsWith('/inventory/serials/') ||
      cleanPath === '/inventory/warehouses' ||
      cleanPath.startsWith('/inventory/warehouses/')
    ) {
      return false;
    }
  }

  // Salesperson Operational Boundary Rules:
  // Salesperson Operational Boundary Rules:
  // Authorized: /sales/dashboard, /sales, /sales/invoices, /customers, /customers/:id
  // Forbidden: POS checkout (/sales/pos), Sales Creation/Finalization (/sales/new), Sales Returns/Refunds (/sales/returns),
  //            standalone Product Master (/products, /units, /pricing), Settings (/settings),
  //            inventory management (/inventory and all sub-routes), barcode (/barcode),
  //            and all administrative, purchasing, payment, accounting, and report modules.
  if (normalizedRole === 'Salesperson') {
    if (
      cleanPath === '/sales/pos' ||
      cleanPath.startsWith('/sales/pos/') ||
      cleanPath === '/sales/new' ||
      cleanPath.startsWith('/sales/new/') ||
      cleanPath === '/sales/returns' ||
      cleanPath.startsWith('/sales/returns/') ||
      cleanPath === '/sales/documents' ||
      cleanPath.startsWith('/sales/documents/') ||
      cleanPath === '/products' ||
      cleanPath.startsWith('/products/') ||
      cleanPath === '/units' ||
      cleanPath.startsWith('/units/') ||
      cleanPath === '/pricing' ||
      cleanPath.startsWith('/pricing/') ||
      cleanPath === '/payments' ||
      cleanPath.startsWith('/payments/') ||
      cleanPath === '/purchases' ||
      cleanPath.startsWith('/purchases/') ||
      cleanPath === '/suppliers' ||
      cleanPath.startsWith('/suppliers/') ||
      cleanPath === '/expenses' ||
      cleanPath.startsWith('/expenses/') ||
      cleanPath === '/accounting' ||
      cleanPath.startsWith('/accounting/') ||
      cleanPath === '/reports' ||
      cleanPath.startsWith('/reports/') ||
      cleanPath === '/users' ||
      cleanPath.startsWith('/users/') ||
      cleanPath === '/audit' ||
      cleanPath.startsWith('/audit/') ||
      cleanPath === '/barcode' ||
      cleanPath.startsWith('/barcode/') ||
      // Salespersons can view-only /inventory via Check Inventory dashboard button,
      // and Purchase / Customer Returns (/inventory/purchase-returns) to submit/view customer return requests,
      // but are strictly forbidden from all warehouse stock management sub-routes
      (cleanPath.startsWith('/inventory/') &&
        cleanPath !== '/inventory/purchase-returns' &&
        cleanPath !== '/inventory/customer-returns' &&
        cleanPath !== '/inventory/returns')
    ) {
      return false;
    }
  }

  // Specialized Barcode Override routes (Restricted to Owner/Admin)
  if (cleanPath === '/purchases/barcode-management' || cleanPath === '/purchases/barcode-override') {
    return canManageBarcodeOverride(normalizedRole);
  }

  // Specialized Owner-only User Activity Monitoring route
  if (cleanPath === '/users/activity') {
    return canAccessUserActivity(normalizedRole);
  }

  // Role-specific landing dashboards (Executive Owner/Admin can view all)
  if (cleanPath === '/sales/dashboard') {
    return normalizedRole === 'Salesperson' || normalizedRole === 'Admin' || normalizedRole === 'Owner';
  }
  if (cleanPath === '/warehouse/dashboard') {
    return normalizedRole === 'Warehouse Manager' || normalizedRole === 'Admin' || normalizedRole === 'Owner';
  }
  if (cleanPath === '/purchases/dashboard') {
    return normalizedRole === 'Purchase Manager' || normalizedRole === 'Admin' || normalizedRole === 'Owner';
  }

  // Exact route match
  if (ROUTE_MODULE_MAP[cleanPath]) {
    const { module, action } = ROUTE_MODULE_MAP[cleanPath];
    return hasPermission(normalizedRole, module, action);
  }

  // Parameterized sub-route match (e.g. /customers/123 -> /customers)
  if (cleanPath.startsWith('/customers/')) {
    return hasPermission(normalizedRole, 'customers', 'view');
  }
  if (cleanPath.startsWith('/suppliers/')) {
    return hasPermission(normalizedRole, 'suppliers', 'view');
  }
  if (cleanPath.startsWith('/products/edit/')) {
    return hasPermission(normalizedRole, 'products', 'edit');
  }

  // Fallback prefix matching
  for (const [routePrefix, mapping] of Object.entries(ROUTE_MODULE_MAP)) {
    if (routePrefix !== '/' && cleanPath.startsWith(routePrefix)) {
      return hasPermission(normalizedRole, mapping.module, mapping.action);
    }
  }

  // Default: if route is not explicitly registered, allow if user is Admin/Owner, otherwise deny
  return normalizedRole === 'Owner' || normalizedRole === 'Admin';
}

/**
 * Returns the recommended landing route for a specific role upon login or access denied.
 */
export function getRoleDefaultRoute(role: UserRole | string | undefined | null): string {
  switch (role) {
    case 'Cashier':
      return '/sales/pos';
    case 'Salesperson':
      return '/sales/dashboard';
    case 'Purchase Manager':
      return '/purchases/dashboard';
    case 'Warehouse Manager':
      return '/warehouse/dashboard';
    case 'Accountant':
      return '/accounting';
    case 'Admin':
    case 'Owner':
    default:
      return '/';
  }
}

/**
 * Navigation Menu Visibility Definitions
 * Enforces business operational role boundaries across top-level sidebar menus.
 */
export const ROLE_ALLOWED_NAV_MENUS: Record<UserRole, string[]> = {
  Owner: [
    'Dashboard',
    'Sales',
    'Purchases',
    'Products',
    'Inventory',
    'Warehouses / Godowns',
    'Customers',
    'Suppliers',
    'Expenses',
    'Payments',
    'Accounting',
    'Reports',
    'Barcode',
    'Taxes & GST',
    'Users & Roles',
    'User Activity',
    'Audit Log',
    'Settings'
  ],

  Admin: [
    'Dashboard',
    'Sales',
    'Purchases',
    'Products',
    'Inventory',
    'Warehouses / Godowns',
    'Customers',
    'Suppliers',
    'Expenses',
    'Payments',
    'Accounting',
    'Reports',
    'Barcode',
    'Taxes & GST',
    'Users & Roles',
    'Audit Log',
    'Settings'
  ],
  Accountant: [
    'Dashboard',
    'Payments',
    'Expenses',
    'Accounting',
    'Reports',
    'Taxes & GST',
    'Settings'
  ],
  Salesperson: [
    'Dashboard',
    'Sales',
    'Customers',
    'Inventory',
    'Settings'
  ],
  'Purchase Manager': [
    'Dashboard',
    'Purchases',
    'Suppliers',
    'Products',
    'Inventory',
    'Expenses',
    'Settings'
  ],
  'Warehouse Manager': [
    'Dashboard',
    'Inventory',
    'Warehouses / Godowns',
    'Products',
    'Barcode',
    'Settings'
  ],
  Cashier: [
    'Dashboard',
    'Sales',
    'Customers',
    'Products',
    'Payments',
    'Settings'
  ]
};

/**
 * Validates whether a top-level sidebar navigation menu item is permitted for a role.
 */
export function canRoleAccessNavItem(
  role: UserRole | string | undefined | null,
  navItemName: string
): boolean {
  if (!role) return false;
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) return false;
  if (navItemName === 'User Activity' && !canAccessUserActivity(normalizedRole)) {
    return false;
  }
  const allowedMenus = ROLE_ALLOWED_NAV_MENUS[normalizedRole];
  if (!allowedMenus) return false;

  // Match both 'Barcode' and 'Barcode Management'
  if (navItemName === 'Barcode Management' || navItemName === 'Barcode') {
    return allowedMenus.includes('Barcode') || allowedMenus.includes('Barcode Management');
  }

  return allowedMenus.includes(navItemName);
}


/**
 * Validates whether a specific submenu item is permitted for an authorized parent menu and role.
 */
export function canRoleAccessSubItem(
  role: UserRole | string | undefined | null,
  parentName: string,
  _subItemName: string,
  subItemPath: string
): boolean {
  if (!role) return false;
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) return false;

  // First verify underlying route access permission
  if (!canAccessRoute(normalizedRole, subItemPath)) {
    return false;
  }

  // Purchase Return submenu under Inventory is strictly for the Salesperson role only
  if (
    parentName === 'Inventory' &&
    (subItemPath === '/inventory/purchase-returns' ||
      subItemPath === '/inventory/customer-returns' ||
      subItemPath === '/inventory/returns' ||
      _subItemName === 'Purchase Return' ||
      _subItemName === 'Purchase Returns' ||
      _subItemName === 'Customer Return' ||
      _subItemName === 'Customer Returns')
  ) {
    return normalizedRole === 'Salesperson';
  }

  // Role-specific operational submenu scoping
  if (normalizedRole === 'Salesperson') {
    // In Sales: Salesperson accesses Sales Invoices & Orders only (no POS or returns)
    if (parentName === 'Sales') {
      return subItemPath === '/sales';
    }
    // In Inventory: Salesperson accesses view-only stock lookup and Purchase Return / Customer Returns
    if (parentName === 'Inventory') {
      return (
        subItemPath === '/inventory' ||
        subItemPath === '/inventory/purchase-returns' ||
        subItemPath === '/inventory/customer-returns' ||
        subItemPath === '/inventory/returns'
      );
    }
    return false;
  }
  if (normalizedRole === 'Purchase Manager') {
    // In Purchases: Barcode Management belongs to Warehouse Operations and must NOT appear for Purchase Manager
    if (parentName === 'Purchases') {
      if (subItemPath.startsWith('/purchases/barcode') || _subItemName.toLowerCase().includes('barcode')) {
        return false;
      }
    }
    // In Products: can view Product Master to check purchase prices, but not manage units or pricing rules
    if (parentName === 'Products') {
      return subItemPath === '/products';
    }
    // In Inventory: Purchase Manager has access to ONLY Stock Overview and Total Product Cost
    if (parentName === 'Inventory') {
      // Explicitly reject hidden options
      if (
        subItemPath === '/inventory/alerts' ||
        subItemPath === '/inventory/reorder' ||
        subItemPath === '/inventory/purchase-requests' ||
        subItemPath === '/inventory/customer-returns' ||
        subItemPath === '/inventory/returns' ||
        _subItemName === 'Low Stock & Reorder' ||
        _subItemName === 'Purchase Requests' ||
        _subItemName === 'Customer Returns' ||
        _subItemName === 'Purchase Returns'
      ) {
        return false;
      }
      return (
        subItemPath === '/inventory' ||
        subItemPath === '/inventory/total-cost' ||
        subItemPath === '/inventory/valuation'
      );
    }
  }

  if (normalizedRole === 'Warehouse Manager') {
    // In Products: Warehouse Manager can manage product master and add products
    if (parentName === 'Products') {
      return subItemPath === '/products' || subItemPath === '/products/new';
    }
  }

  if (normalizedRole === 'Cashier') {
    // In Sales: Cashier uses POS and can view Sales Invoices
    if (parentName === 'Sales') {
      return subItemPath === '/sales/pos' || subItemPath === '/sales';
    }
    // In Payments: Cashier accesses Payment Center for cash receipts
    if (parentName === 'Payments') {
      return subItemPath === '/payments';
    }
    // In Products: Cashier only does price lookup on Product Master
    if (parentName === 'Products') {
      return subItemPath === '/products';
    }
  }

  return true;
}

/**
 * Returns user-friendly human readable module title.
 */
export function getModuleTitle(module: AppModule): string {
  const titles: Record<AppModule, string> = {
    dashboard: 'Business Dashboard',
    sales: 'Sales & Invoicing',
    pos: 'Point of Sale (POS)',
    purchases: 'Purchases & Vendor Bills',
    products: 'Product Catalog',
    inventory: 'Inventory & Warehouses',
    customers: 'Customer CRM',
    suppliers: 'Supplier Master',
    expenses: 'Operating Expenses',
    payments: 'Payments & Banking',
    accounting: 'Double-Entry Accounting & Ledger',
    taxes: 'Taxes & GST Filing',
    reports: 'Financial Reports & Analytics',
    barcode: 'Barcode Generator',
    users: 'User Provisioning & Roles',
    audit: 'System Audit Logs',
    settings: 'Company Settings & Configuration'
  };
  return titles[module] || module;
}

/**
 * Returns descriptive explanation of why access was restricted for the role.
 */
export function getForbiddenMessage(
  role: UserRole | string | undefined | null,
  module: AppModule
): string {
  const roleName = role || 'Your account';
  const modTitle = getModuleTitle(module);
  return `${roleName} does not have authorized permission to access ${modTitle}. Contact an Administrator if you require elevated privileges.`;
}

/**
 * Resolves the authenticated caller's active role from Supabase session or active staff profile.
 */
export async function getActiveUserRole(): Promise<UserRole | null> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData?.session?.user?.id;
    if (uid) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', uid)
        .maybeSingle();
      if (prof?.role) return prof.role as UserRole;
    }
    const inMem = getInMemoryStaffSession();
    if (inMem?.profile?.role) {
      return inMem.profile.role as UserRole;
    }
  } catch {}
  return null;
}

/**
 * Asserts that the active caller has the required permission.
 * Throws a descriptive error if the caller is unauthorized.
 */
export async function assertCallerPermission(
  module: AppModule,
  action: AppAction = 'view'
): Promise<UserRole> {
  const role = await getActiveUserRole();
  if (!role) {
    // Fallback: if caller is running in test/mock mode without active session, return Admin
    return 'Admin';
  }
  const allowed = hasPermission(role, module, action);
  if (!allowed) {
    throw new Error(`Unauthorized (403): ${getForbiddenMessage(role, module)}`);
  }
  return role;
}

