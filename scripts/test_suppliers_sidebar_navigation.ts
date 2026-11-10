import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('================================================================================');
console.log('TEST SUITE: SUPPLIERS SIDEBAR DIRECT NAVIGATION');
console.log('================================================================================');

const sidebarPath = path.resolve('src/components/layout/Sidebar.tsx');
const sidebarCode = fs.readFileSync(sidebarPath, 'utf-8');

const appPath = path.resolve('src/App.tsx');
const appCode = fs.readFileSync(appPath, 'utf-8');

const suppliersPagePath = path.resolve('src/pages/suppliers/SuppliersPage.tsx');
const suppliersPageCode = fs.readFileSync(suppliersPagePath, 'utf-8');

// 1. When clicking Suppliers, navigate directly to /suppliers
assert.ok(
  sidebarCode.includes("id: 'suppliers'") && sidebarCode.includes("path: '/suppliers'"),
  '1. Suppliers sidebar item links to /suppliers'
);

// 2. Remove the nested Supplier Details submenu under Suppliers
assert.ok(
  !sidebarCode.includes("id: 'supplier-details'"),
  '2. Nested Supplier Details submenu is completely removed'
);

// 3. Do not expand the submenu: Suppliers has no children array
const suppliersItemMatch = sidebarCode.match(/id:\s*'suppliers',[\s\S]*?section:\s*'Finance & Staff'/);
assert.ok(suppliersItemMatch, '3. Suppliers item found in Sidebar.tsx');
assert.ok(
  !suppliersItemMatch[0].includes('children:'),
  '3. Suppliers item has no children/submenu array'
);

// 4. Highlight Suppliers as the active sidebar item when its page is open
assert.ok(
  sidebarCode.includes("cur === '/suppliers' || cur.startsWith('/suppliers/')"),
  '4. Suppliers highlights as active when on /suppliers or /suppliers/:id'
);

// 5. Preserve all existing Supplier Details functionality, data, forms, and design
assert.ok(suppliersPageCode.includes('Supplier Details & Management'), '5. SuppliersPage title preserved');
assert.ok(suppliersPageCode.includes('Add New Supplier'), '5. SuppliersPage Add button preserved');
assert.ok(suppliersPageCode.includes('SupplierViewModal'), '5. SuppliersPage view modal preserved');
assert.ok(suppliersPageCode.includes('SupplierFormModal'), '5. SuppliersPage form modal preserved');

// 6. Same direct page navigation behavior as Customers
const customersItemMatch = sidebarCode.match(/id:\s*'customers',[\s\S]*?section:\s*'Finance & Staff'/);
assert.ok(customersItemMatch, '6. Customers item found in Sidebar.tsx');
assert.ok(!customersItemMatch[0].includes('children:'), '6. Customers also has no submenu');

// 7. Routes for suppliers exist and render properly
assert.ok(
  appCode.includes('path="suppliers"') && appCode.includes('<SuppliersPage />'),
  '7. Dedicated /suppliers route renders SuppliersPage'
);
assert.ok(
  appCode.includes('path="suppliers/:id"') && appCode.includes('<SupplierProfilePage />'),
  '7. Dedicated /suppliers/:id route renders SupplierProfilePage'
);

console.log('ALL 7 SUPPLIERS NAVIGATION REQUIREMENTS VERIFIED AND PASSED SUCCESSFULLY!');

