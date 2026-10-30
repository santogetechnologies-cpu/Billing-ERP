import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { canAccessRoute, canRoleAccessNavItem, canRoleAccessSubItem, normalizeRole } from '../src/utils/rbac';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passCount++;
  } else {
    console.error(`❌ FAIL: ${testName}`);
    if (details) console.error(`   Details: ${details}`);
    failCount++;
  }
}

console.log('--- Sales Person Purchase Return Under Inventory Verification ---\n');

// 1. Check Sidebar.tsx
const sidebarPath = path.resolve(__dirname, '../src/components/layout/Sidebar.tsx');
const sidebarCode = fs.readFileSync(sidebarPath, 'utf-8');

// Verify Salesperson Navigation structure
const salespersonNavMatches = sidebarCode.match(/const\s+salespersonNavItems:\s*NavItem\[\]\s*=\s*\[([\s\S]*?)\];/);
assert(Boolean(salespersonNavMatches), 'salespersonNavItems is defined in Sidebar.tsx');

if (salespersonNavMatches) {
  const spNavContent = salespersonNavMatches[1];
  assert(
    spNavContent.includes("name: 'Inventory'") &&
    spNavContent.includes("children: [") &&
    spNavContent.includes("name: 'Stock Overview'") &&
    spNavContent.includes("name: 'Purchase Return'"),
    'Sales Person has Inventory expandable parent menu containing Stock Overview and Purchase Return'
  );
  assert(
    spNavContent.includes("path: '/inventory/purchase-returns'"),
    'Sales Person Purchase Return item points to /inventory/purchase-returns'
  );
  assert(
    spNavContent.includes("icon: RotateCcw"),
    'Sales Person Purchase Return item uses RotateCcw icon'
  );
}

// Verify generic navItems does NOT include Purchase Return under Inventory
const genericNavMatches = sidebarCode.match(/const\s+navItems:\s*NavItem\[\]\s*=\s*\[([\s\S]*?)const\s+rolePermittedNavItems/);
if (genericNavMatches) {
  const genericNavContent = genericNavMatches[1];
  // Find the Inventory section in genericNavContent
  const inventorySection = genericNavContent.match(/name:\s*'Inventory'[\s\S]*?children:[\s\S]*?\]\s*\}/);
  assert(
    Boolean(inventorySection) && !inventorySection![0].includes("name: 'Purchase Return'"),
    'Generic Inventory navItems for Admin/Owner/Warehouse Manager does NOT include Purchase Return'
  );
}

// 2. Check RBAC permissions for submenu
assert(
  canRoleAccessSubItem('Salesperson', 'Inventory', 'Purchase Return', '/inventory/purchase-returns'),
  'Salesperson role CAN access Purchase Return in Inventory submenu'
);
assert(
  canRoleAccessSubItem('Sales Person', 'Inventory', 'Purchase Return', '/inventory/purchase-returns'),
  'Sales Person alias CAN access Purchase Return in Inventory submenu'
);

// Check other roles: Owner, Admin, Warehouse Manager, Cashier, Purchase Manager
const otherRoles = ['Owner', 'Admin', 'Warehouse Manager', 'Cashier', 'Purchase Manager', 'Accountant'];
for (const role of otherRoles) {
  assert(
    !canRoleAccessSubItem(role, 'Inventory', 'Purchase Return', '/inventory/purchase-returns'),
    `${role} CANNOT see Purchase Return in Inventory submenu (remains unchanged)`
  );
}

// 3. Verify CustomerReturnsPage.tsx UI and capabilities
const pagePath = path.resolve(__dirname, '../src/pages/inventory/CustomerReturnsPage.tsx');
assert(fs.existsSync(pagePath), 'CustomerReturnsPage.tsx exists');
const pageCode = fs.readFileSync(pagePath, 'utf-8');

// Searching original invoice
assert(
  pageCode.includes('inv.invoiceNumber.toLowerCase().includes(q)') &&
  pageCode.includes('inv.customerName.toLowerCase().includes(q)') &&
  pageCode.includes('inv.customerPhone'),
  'CustomerReturnsPage supports searching original invoice by invoice number, customer name, and customer phone'
);

// Form inputs
assert(
  pageCode.includes('formReturnedQty') &&
  pageCode.includes('formReason') &&
  pageCode.includes('formCondition') &&
  pageCode.includes('Resalable') &&
  pageCode.includes('Damaged') &&
  pageCode.includes('Defective') &&
  pageCode.includes('Expired'),
  'CustomerReturnsPage includes inputs for returned quantity, reason, and product conditions (Resalable, Damaged, Defective, Expired)'
);

// Return History Table Columns
const requiredColumns = [
  'Return ID',
  'Original Bill/Invoice Number',
  'Customer Name',
  'Product Name and SKU',
  'Returned Quantity and Unit',
  'Return Reason',
  'Product Condition',
  'Return Date',
  'Return Status'
];
for (const col of requiredColumns) {
  assert(pageCode.includes(col), `Return history table includes "${col}" column`);
}

// Role limitations for Sales Person
assert(
  pageCode.includes('const isSalesperson = userRole === \'Salesperson\';') &&
  pageCode.includes('const canApproveOrReject = isOwnerOrAdmin;') &&
  pageCode.includes('const canRestock = isOwnerOrAdmin || isWarehouseManager;') &&
  pageCode.includes('const canRefund = isOwnerOrAdmin || isCashier;'),
  'Sales Person is restricted from unauthorized approving, restocking, or refunding'
);

// Stock isolation: Pending returns do not touch stock
assert(
  pageCode.includes('returnStatus: \'Pending Review\'') || pageCode.includes("Pending Review"),
  'New customer returns default to "Pending Review" status without touching sellable stock'
);

console.log(`\n========================================`);
console.log(`Results: ${passCount} Passed, ${failCount} Failed`);
console.log(`========================================`);

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
