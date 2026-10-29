const fs = require('fs');

let content = fs.readFileSync('src/utils/rbac.ts', 'utf8');

// 1. Update Purchase Manager products permission in ROLE_PERMISSIONS_MATRIX
content = content.replace(
  `  'Purchase Manager': {\n    dashboard: { view: true, create: false, edit: false, delete: false, approve: false, export: false, manage: false },\n    purchases: { view: true, create: true, edit: true, delete: false, approve: true, export: true, manage: false },\n    suppliers: { view: true, create: true, edit: true, delete: false, approve: false, export: true, manage: false },\n    expenses: { view: true, create: true, edit: false, delete: false, approve: false, export: false, manage: false },\n    // Shared cross-module read to inspect product costs and stock levels for re-ordering\n    products: VIEW_ONLY,`,
  `  'Purchase Manager': {\n    dashboard: { view: true, create: false, edit: false, delete: false, approve: false, export: false, manage: false },\n    purchases: { view: true, create: true, edit: true, delete: false, approve: true, export: true, manage: false },\n    suppliers: { view: true, create: true, edit: true, delete: false, approve: false, export: true, manage: false },\n    expenses: { view: true, create: true, edit: false, delete: false, approve: false, export: false, manage: false },\n    // Authorized product management, initial stock, bundles, and stock updates\n    products: { view: true, create: true, edit: true, delete: false, approve: false, export: true, manage: false },`
);

// Fallback replace with \r\n
content = content.replace(
  `  'Purchase Manager': {\r\n    dashboard: { view: true, create: false, edit: false, delete: false, approve: false, export: false, manage: false },\r\n    purchases: { view: true, create: true, edit: true, delete: false, approve: true, export: true, manage: false },\r\n    suppliers: { view: true, create: true, edit: true, delete: false, approve: false, export: true, manage: false },\r\n    expenses: { view: true, create: true, edit: false, delete: false, approve: false, export: false, manage: false },\r\n    // Shared cross-module read to inspect product costs and stock levels for re-ordering\r\n    products: VIEW_ONLY,`,
  `  'Purchase Manager': {\r\n    dashboard: { view: true, create: false, edit: false, delete: false, approve: false, export: false, manage: false },\r\n    purchases: { view: true, create: true, edit: true, delete: false, approve: true, export: true, manage: false },\r\n    suppliers: { view: true, create: true, edit: true, delete: false, approve: false, export: true, manage: false },\r\n    expenses: { view: true, create: true, edit: false, delete: false, approve: false, export: false, manage: false },\r\n    // Authorized product management, initial stock, bundles, and stock updates\r\n    products: { view: true, create: true, edit: true, delete: false, approve: false, export: true, manage: false },`
);

// 2. Update Warehouse Manager products permission in ROLE_PERMISSIONS_MATRIX
content = content.replace(
  `    inventory: { view: true, create: true, edit: true, delete: false, approve: true, export: true, manage: true },\n    products: { view: true, create: true, edit: true, delete: true, approve: false, export: true, manage: false }, // Inventory, batch edits & product master deletion`,
  `    inventory: { view: true, create: true, edit: true, delete: false, approve: true, export: true, manage: true },\n    products: VIEW_ONLY, // View-only catalog for assigned warehouse stock & availability; no create, edit, or delete`
);
content = content.replace(
  `    inventory: { view: true, create: true, edit: true, delete: false, approve: true, export: true, manage: true },\r\n    products: { view: true, create: true, edit: true, delete: true, approve: false, export: true, manage: false }, // Inventory, batch edits & product master deletion`,
  `    inventory: { view: true, create: true, edit: true, delete: false, approve: true, export: true, manage: true },\r\n    products: VIEW_ONLY, // View-only catalog for assigned warehouse stock & availability; no create, edit, or delete`
);

// 3. Add helper functions canManageProducts, canManageInitialStock, canUpdateStock, canPerformManualStockAdjustment
const helperCode = `
/**
 * Validates whether the role can create products and edit product master information.
 * Restricted to Owner, Admin, and Purchase Manager. Strictly denied for Warehouse Manager.
 */
export function canManageProducts(role?: UserRole | string | null): boolean {
  if (!role) return false;
  const normalized = normalizeRole(role);
  return normalized === 'Owner' || normalized === 'Admin' || normalized === 'Purchase Manager';
}

/**
 * Validates whether the role can manage initial stock and stock bundles.
 * Restricted to Owner, Admin, and Purchase Manager. Strictly denied for Warehouse Manager.
 */
export function canManageInitialStock(role?: UserRole | string | null): boolean {
  if (!role) return false;
  const normalized = normalizeRole(role);
  return normalized === 'Owner' || normalized === 'Admin' || normalized === 'Purchase Manager';
}

/**
 * Validates whether the role can manage existing stock updates.
 * Restricted to Owner, Admin, and Purchase Manager. Strictly denied for Warehouse Manager.
 */
export function canUpdateStock(role?: UserRole | string | null): boolean {
  if (!role) return false;
  const normalized = normalizeRole(role);
  return normalized === 'Owner' || normalized === 'Admin' || normalized === 'Purchase Manager';
}

/**
 * Validates whether the role is authorized to perform manual stock adjustments.
 * Restricted to Owner, Admin, and Purchase Manager. Strictly denied for Warehouse Manager.
 */
export function canPerformManualStockAdjustment(role?: UserRole | string | null): boolean {
  if (!role) return false;
  const normalized = normalizeRole(role);
  return normalized === 'Owner' || normalized === 'Admin' || normalized === 'Purchase Manager';
}
`;

if (!content.includes('canManageProducts')) {
  content = content.replace(
    'export function canManageBarcodeOverride',
    helperCode + '\nexport function canManageBarcodeOverride'
  );
}

// 4. Update ROUTE_MODULE_MAP for initial-stock and update-stock
if (!content.includes('/products/initial-stock')) {
  content = content.replace(
    `  // Products\n  '/products': { module: 'products', action: 'view' },\n  '/products/new': { module: 'products', action: 'create' },`,
    `  // Products\n  '/products': { module: 'products', action: 'view' },\n  '/products/new': { module: 'products', action: 'create' },\n  '/products/initial-stock': { module: 'products', action: 'create' },\n  '/products/update-stock': { module: 'products', action: 'edit' },`
  );
  content = content.replace(
    `  // Products\r\n  '/products': { module: 'products', action: 'view' },\r\n  '/products/new': { module: 'products', action: 'create' },`,
    `  // Products\r\n  '/products': { module: 'products', action: 'view' },\r\n  '/products/new': { module: 'products', action: 'create' },\r\n  '/products/initial-stock': { module: 'products', action: 'create' },\r\n  '/products/update-stock': { module: 'products', action: 'edit' },`
  );
}

// 5. Update canAccessRoute for product routes and inventory adjustments
const routeChecks = `
  // Product Initial Stock & Update Stock: restricted to Owner, Admin, Purchase Manager
  if (
    cleanPath === '/products/initial-stock' ||
    cleanPath.startsWith('/products/initial-stock/') ||
    cleanPath === '/products/update-stock' ||
    cleanPath.startsWith('/products/update-stock/')
  ) {
    return canManageInitialStock(normalizedRole);
  }

  // Product Creation & Editing: restricted to Owner, Admin, Purchase Manager (Warehouse Manager strictly denied)
  if (
    cleanPath === '/products/new' ||
    cleanPath.startsWith('/products/new/') ||
    cleanPath.startsWith('/products/edit/')
  ) {
    return canManageProducts(normalizedRole);
  }

  // Inventory Adjustments (manual stock adjustment): restricted to Owner, Admin, Purchase Manager (Warehouse Manager strictly denied)
  if (
    cleanPath === '/inventory/adjustments' ||
    cleanPath.startsWith('/inventory/adjustments/')
  ) {
    return canPerformManualStockAdjustment(normalizedRole);
  }
`;

if (!content.includes('cleanPath === \'/products/initial-stock\'')) {
  content = content.replace(
    '  // Clean trailing slashes\n  const cleanPath = path === \'/\' ? \'/\' : path.replace(/\\/$/, \'\');',
    '  // Clean trailing slashes\n  const cleanPath = path === \'/\' ? \'/\' : path.replace(/\\/$/, \'\');\n' + routeChecks
  );
  content = content.replace(
    '  // Clean trailing slashes\r\n  const cleanPath = path === \'/\' ? \'/\' : path.replace(/\\/$/, \'\');',
    '  // Clean trailing slashes\r\n  const cleanPath = path === \'/\' ? \'/\' : path.replace(/\\/$/, \'\');\r\n' + routeChecks
  );
}

// 6. Update canRoleAccessSubItem for Product / Products menu
const subItemLogic = `
  // Product / Products parent submenu scoping:
  if (parentName === 'Product' || parentName === 'Products') {
    if (subItemPath === '/products/initial-stock' || _subItemName === 'Initial Stock') {
      return canManageInitialStock(normalizedRole);
    }
    if (subItemPath === '/products/update-stock' || _subItemName === 'Update Stock') {
      return canUpdateStock(normalizedRole);
    }
    if (subItemPath === '/products' || _subItemName === 'Product Master') {
      return hasPermission(normalizedRole, 'products', 'view');
    }
    return canManageProducts(normalizedRole);
  }
`;

if (!content.includes('parentName === \'Product\' || parentName === \'Products\'')) {
  content = content.replace(
    '  // Role-specific operational submenu scoping',
    subItemLogic + '\n  // Role-specific operational submenu scoping'
  );
  content = content.replace(
    '  // Role-specific operational submenu scoping',
    subItemLogic + '\r\n  // Role-specific operational submenu scoping'
  );
}

// 7. Update Warehouse Manager submenu rules in canRoleAccessSubItem
content = content.replace(
  `  if (normalizedRole === 'Warehouse Manager') {\n    // In Products: Warehouse Manager can manage product master and add products\n    if (parentName === 'Products') {\n      return subItemPath === '/products' || subItemPath === '/products/new';\n    }\n    // In Inventory: Warehouse Manager can access all inventory subitems including Order Receive\n    if (parentName === 'Inventory') {\n      return true;\n    }\n  }`,
  `  if (normalizedRole === 'Warehouse Manager') {\n    // In Product: Warehouse Manager can view Product Master only; Initial Stock and Update Stock are forbidden\n    if (parentName === 'Product' || parentName === 'Products') {\n      return subItemPath === '/products' && (_subItemName === 'Product Master' || _subItemName === 'Products');\n    }\n    // In Inventory: Warehouse Manager cannot access manual adjustments\n    if (parentName === 'Inventory') {\n      if (subItemPath === '/inventory/adjustments' || _subItemName.toLowerCase().includes('adjustment')) {\n        return false;\n      }\n      return true;\n    }\n  }`
);
content = content.replace(
  `  if (normalizedRole === 'Warehouse Manager') {\r\n    // In Products: Warehouse Manager can manage product master and add products\r\n    if (parentName === 'Products') {\r\n      return subItemPath === '/products' || subItemPath === '/products/new';\r\n    }\r\n    // In Inventory: Warehouse Manager can access all inventory subitems including Order Receive\r\n    if (parentName === 'Inventory') {\r\n      return true;\r\n    }\r\n  }`,
  `  if (normalizedRole === 'Warehouse Manager') {\r\n    // In Product: Warehouse Manager can view Product Master only; Initial Stock and Update Stock are forbidden\r\n    if (parentName === 'Product' || parentName === 'Products') {\r\n      return subItemPath === '/products' && (_subItemName === 'Product Master' || _subItemName === 'Products');\r\n    }\r\n    // In Inventory: Warehouse Manager cannot access manual adjustments\r\n    if (parentName === 'Inventory') {\r\n      if (subItemPath === '/inventory/adjustments' || _subItemName.toLowerCase().includes('adjustment')) {\r\n        return false;\r\n      }\r\n      return true;\r\n    }\r\n  }`
);

// 8. Update Purchase Manager submenu rules in canRoleAccessSubItem
content = content.replace(
  `    // In Products: can view Product Master to check purchase prices, but not manage units or pricing rules\n    if (parentName === 'Products') {\n      return subItemPath === '/products';\n    }`,
  `    // In Product: can access Product Master, Initial Stock, and Update Stock\n    if (parentName === 'Product' || parentName === 'Products') {\n      return (\n        subItemPath === '/products' ||\n        subItemPath === '/products/initial-stock' ||\n        subItemPath === '/products/update-stock'\n      );\n    }`
);
content = content.replace(
  `    // In Products: can view Product Master to check purchase prices, but not manage units or pricing rules\r\n    if (parentName === 'Products') {\r\n      return subItemPath === '/products';\r\n    }`,
  `    // In Product: can access Product Master, Initial Stock, and Update Stock\r\n    if (parentName === 'Product' || parentName === 'Products') {\r\n      return (\r\n        subItemPath === '/products' ||\r\n        subItemPath === '/products/initial-stock' ||\r\n        subItemPath === '/products/update-stock'\r\n      );\r\n    }`
);

// 9. Update canRoleAccessNavItem to handle both 'Product' and 'Products'
content = content.replace(
  `  // Match both 'Barcode' and 'Barcode Management'`,
  `  // Match both 'Product' and 'Products'\n  if (navItemName === 'Product' || navItemName === 'Products') {\n    return allowedMenus.includes('Product') || allowedMenus.includes('Products');\n  }\n\n  // Match both 'Barcode' and 'Barcode Management'`
);
content = content.replace(
  `  // Match both 'Barcode' and 'Barcode Management'`,
  `  // Match both 'Product' and 'Products'\r\n  if (navItemName === 'Product' || navItemName === 'Products') {\r\n    return allowedMenus.includes('Product') || allowedMenus.includes('Products');\r\n  }\r\n\r\n  // Match both 'Barcode' and 'Barcode Management'`
);

// Write back
fs.writeFileSync('src/utils/rbac.ts', content, 'utf8');
console.log('Successfully updated src/utils/rbac.ts');
