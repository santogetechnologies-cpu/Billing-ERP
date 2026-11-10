import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('================================================================================');
console.log('TEST SUITE: CUSTOMERS SIDEBAR NAVIGATION ALIGNMENT');
console.log('================================================================================');

const sidebarPath = path.resolve('src/components/layout/Sidebar.tsx');
const sidebarCode = fs.readFileSync(sidebarPath, 'utf-8');

const appPath = path.resolve('src/App.tsx');
const appCode = fs.readFileSync(appPath, 'utf-8');

const customersPagePath = path.resolve('src/pages/customers/CustomersPage.tsx');
const customersPageCode = fs.readFileSync(customersPagePath, 'utf-8');

// 1. Direct navigation without submenu for Customers
assert.ok(
  sidebarCode.includes("id: 'customers'") && sidebarCode.includes("path: '/customers'"),
  '1. Customers sidebar item links to /customers'
);

assert.ok(
  !sidebarCode.includes("id: 'customer-details'"),
  '2. Nested Customer Details submenu is completely removed'
);

// 3. Customers does not have children in allNavItems
const customersItemMatch = sidebarCode.match(/id:\s*'customers',[\s\S]*?section:\s*'Finance & Staff'/);
assert.ok(customersItemMatch, '3. Customers item found in Sidebar.tsx');
assert.ok(
  !customersItemMatch[0].includes('children:'),
  '3. Customers item has no children/submenu array'
);

// 4. Dedicated Customer page routes
assert.ok(
  appCode.includes('path="customers"') && appCode.includes('<CustomersPage />'),
  '4. Dedicated /customers route renders CustomersPage'
);
assert.ok(
  appCode.includes('path="customers/:id"') && appCode.includes('<CustomerProfilePage />'),
  '4. Dedicated /customers/:id route renders CustomerProfilePage'
);

// 5. Active highlight logic for Customers
assert.ok(
  sidebarCode.includes("cur === '/customers' || cur.startsWith('/customers/')"),
  '5. Customers highlights as active when on /customers or /customers/:id'
);

// 6. Existing Customers page content, design, and functionality preserved
assert.ok(customersPageCode.includes('Customer Details & Management'), '6. CustomersPage title preserved');
assert.ok(customersPageCode.includes('Add New Customer'), '6. CustomersPage Add button preserved');
assert.ok(customersPageCode.includes('CustomerViewModal'), '6. CustomersPage view modal preserved');
assert.ok(customersPageCode.includes('CustomerFormModal'), '6. CustomersPage form modal preserved');

// 7. Suppliers navigation preserved unchanged
assert.ok(
  sidebarCode.includes("id: 'suppliers'") && sidebarCode.includes("name: 'Suppliers'"),
  '7. Suppliers sidebar item preserved'
);
assert.ok(
  sidebarCode.includes("id: 'supplier-details'") && sidebarCode.includes("name: 'Supplier Details'"),
  '7. Suppliers sub-navigation preserved'
);

console.log('ALL 7 REQUIREMENTS VERIFIED AND PASSED SUCCESSFULLY!');
