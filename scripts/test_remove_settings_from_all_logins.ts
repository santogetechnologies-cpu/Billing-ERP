import fs from 'fs';
import path from 'path';
import { canRoleAccessNavItem, ROLE_ALLOWED_NAV_MENUS } from '../src/utils/rbac';
import { UserRole } from '../src/types';

console.log('================================================================================');
console.log('TEST SUITE: REMOVE SETTINGS NAVIGATION FROM ALL USER LOGINS');
console.log('================================================================================');

let passed = 0;
let failed = 0;

function assert(condition: boolean, desc: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${desc}`);
    failed++;
  }
}

const allRoles: UserRole[] = [
  'Owner',
  'Admin',
  'Accountant',
  'Salesperson',
  'Purchase Manager',
  'Warehouse Manager',
  'Cashier'
];

console.log('\n--- 1. RBAC Check: canRoleAccessNavItem returns false for Settings across all roles ---');
for (const role of allRoles) {
  const byId = canRoleAccessNavItem(role, 'Settings', 'settings');
  const byName = canRoleAccessNavItem(role, 'Settings');
  assert(!byId, `canRoleAccessNavItem('${role}', 'Settings', 'settings') must return false`);
  assert(!byName, `canRoleAccessNavItem('${role}', 'Settings') must return false`);

  const allowedMenus = ROLE_ALLOWED_NAV_MENUS[role] || [];
  assert(!allowedMenus.includes('Settings'), `ROLE_ALLOWED_NAV_MENUS['${role}'] must NOT contain 'Settings'`);
}

console.log('\n--- 2. Sidebar.tsx Verification ---');
const sidebarPath = path.resolve('src/components/layout/Sidebar.tsx');
const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');

assert(!sidebarContent.includes('to="/settings"'), 'Sidebar.tsx must NOT contain to="/settings"');
assert(!sidebarContent.includes('canAccessSettings'), 'Sidebar.tsx must NOT contain canAccessSettings');
assert(!sidebarContent.includes('isSettingsActive'), 'Sidebar.tsx must NOT contain isSettingsActive');
assert(!/import\s*\{[^}]*\bSettings\b[^}]*\}\s*from\s*['"]lucide-react['"]/.test(sidebarContent), 'Sidebar.tsx must NOT import Settings from lucide-react');

console.log('\n--- 3. Verify Key Core Permissions are Preserved ---');
assert(canRoleAccessNavItem('Purchase Manager', 'Purchases', 'purchases'), 'Purchase Manager can access Purchases');
assert(canRoleAccessNavItem('Purchase Manager', 'Suppliers', 'suppliers'), 'Purchase Manager can access Suppliers');
assert(canRoleAccessNavItem('Purchase Manager', 'Customers', 'customers'), 'Purchase Manager can access Customers');
assert(canRoleAccessNavItem('Purchase Manager', 'Warehouse', 'warehouse'), 'Purchase Manager can access Warehouse');
assert(canRoleAccessNavItem('Warehouse Manager', 'Warehouse', 'warehouse'), 'Warehouse Manager can access Warehouse');
assert(canRoleAccessNavItem('Accountant', 'Accounting', 'accounting'), 'Accountant can access Accounting');
assert(canRoleAccessNavItem('Salesperson', 'Sales', 'sales'), 'Salesperson can access Sales');

console.log('\n================================================================================');
console.log(`TOTAL TESTS: ${passed + failed}`);
console.log(`PASSED:      ${passed}`);
console.log(`FAILED:      ${failed}`);
console.log('================================================================================');

if (failed > 0) {
  process.exit(1);
}

