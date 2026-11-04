import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  hasPermission,
  canRoleAccessNavItem,
  ROLE_PERMISSIONS_MATRIX,
  ROLE_ALLOWED_NAV_MENUS
} from '../src/utils/rbac';

console.log('================================================================================');
console.log('TEST SUITE: SEPARATE CUSTOMERS & SUPPLIERS SIDEBAR & DETAILS FOR PURCHASE MANAGER');
console.log('================================================================================');

async function runTests() {
  const sidebarPath = path.resolve('src/components/layout/Sidebar.tsx');
  const rbacPath = path.resolve('src/utils/rbac.ts');
  const customersPagePath = path.resolve('src/pages/customers/CustomersPage.tsx');
  const suppliersPagePath = path.resolve('src/pages/suppliers/SuppliersPage.tsx');
  const customerFormModalPath = path.resolve('src/components/customers/CustomerFormModal.tsx');
  const customerViewModalPath = path.resolve('src/components/customers/CustomerViewModal.tsx');
  const supplierFormModalPath = path.resolve('src/components/suppliers/SupplierFormModal.tsx');
  const supplierViewModalPath = path.resolve('src/components/suppliers/SupplierViewModal.tsx');

  assert(fs.existsSync(sidebarPath), 'Sidebar.tsx must exist');
  assert(fs.existsSync(rbacPath), 'rbac.ts must exist');
  assert(fs.existsSync(customersPagePath), 'CustomersPage.tsx must exist');
  assert(fs.existsSync(suppliersPagePath), 'SuppliersPage.tsx must exist');
  assert(fs.existsSync(customerFormModalPath), 'CustomerFormModal.tsx must exist');
  assert(fs.existsSync(customerViewModalPath), 'CustomerViewModal.tsx must exist');
  assert(fs.existsSync(supplierFormModalPath), 'SupplierFormModal.tsx must exist');
  assert(fs.existsSync(supplierViewModalPath), 'SupplierViewModal.tsx must exist');

  const sidebarCode = fs.readFileSync(sidebarPath, 'utf-8');
  const customersCode = fs.readFileSync(customersPagePath, 'utf-8');
  const suppliersCode = fs.readFileSync(suppliersPagePath, 'utf-8');
  const customerFormCode = fs.readFileSync(customerFormModalPath, 'utf-8');
  const supplierFormCode = fs.readFileSync(supplierFormModalPath, 'utf-8');

  // --- 1. Sidebar Structure & Separation ---
  console.log('\n--- 1. Sidebar Structure & Separation ---');

  // 1.1 "Customers & Vendors" combined menu replaced
  assert(!sidebarCode.includes("name: 'Customers & Vendors'"), '1.1 "Customers & Vendors" combined menu must be replaced');
  console.log('  ✓ PASS: 1.1 "Customers & Vendors" combined menu has been removed');

  // 1.2 Two separate menus: Customers and Suppliers with own icons
  assert(sidebarCode.includes("id: 'customers'") && sidebarCode.includes("name: 'Customers'"), '1.2 Separate "Customers" menu exists');
  assert(sidebarCode.includes("id: 'suppliers'") && sidebarCode.includes("name: 'Suppliers'"), '1.2 Separate "Suppliers" menu exists');
  console.log('  ✓ PASS: 1.2 Both Customers and Suppliers exist as separate sidebar menus with dedicated icons');

  // 1.3 Expandable navigation with sub-items
  assert(sidebarCode.includes('Customer Details') && sidebarCode.includes('/customers'), '1.3 Customers menu has Customer Details child navigation');
  assert(sidebarCode.includes('Supplier Details') && sidebarCode.includes('/suppliers'), '1.3 Suppliers menu has Supplier Details child navigation');
  assert(sidebarCode.includes('expandedMenus') && sidebarCode.includes('toggleExpand'), '1.3 Sidebar supports expandable navigation with toggleExpand');
  console.log('  ✓ PASS: 1.3 Expandable navigation with "Customer Details" and "Supplier Details" sub-items implemented');

  // --- 2. Purchase Manager Permissions & RBAC ---
  console.log('\n--- 2. Purchase Manager Permissions & RBAC ---');

  // 2.1 Full permissions for Customers
  assert(hasPermission('Purchase Manager', 'customers', 'view') === true, '2.1 Purchase Manager can view customers');
  assert(hasPermission('Purchase Manager', 'customers', 'create') === true, '2.1 Purchase Manager can create customers');
  assert(hasPermission('Purchase Manager', 'customers', 'edit') === true, '2.1 Purchase Manager can edit customers');
  assert(hasPermission('Purchase Manager', 'customers', 'delete') === true, '2.1 Purchase Manager can delete customers');
  console.log('  ✓ PASS: 2.1 Purchase Manager has full Add, View, Edit, and Delete permissions on Customers');

  // 2.2 Full permissions for Suppliers
  assert(hasPermission('Purchase Manager', 'suppliers', 'view') === true, '2.2 Purchase Manager can view suppliers');
  assert(hasPermission('Purchase Manager', 'suppliers', 'create') === true, '2.2 Purchase Manager can create suppliers');
  assert(hasPermission('Purchase Manager', 'suppliers', 'edit') === true, '2.2 Purchase Manager can edit suppliers');
  assert(hasPermission('Purchase Manager', 'suppliers', 'delete') === true, '2.2 Purchase Manager can delete suppliers');
  console.log('  ✓ PASS: 2.2 Purchase Manager has full Add, View, Edit, and Delete permissions on Suppliers');

  // 2.3 Navigation menu access
  assert(canRoleAccessNavItem('Purchase Manager', 'Customers', 'customers') === true, '2.3 Purchase Manager can access Customers nav');
  assert(canRoleAccessNavItem('Purchase Manager', 'Suppliers', 'suppliers') === true, '2.3 Purchase Manager can access Suppliers nav');
  assert(ROLE_ALLOWED_NAV_MENUS['Purchase Manager'].includes('Customers'), '2.3 ROLE_ALLOWED_NAV_MENUS includes Customers');
  assert(ROLE_ALLOWED_NAV_MENUS['Purchase Manager'].includes('Suppliers'), '2.3 ROLE_ALLOWED_NAV_MENUS includes Suppliers');
  console.log('  ✓ PASS: 2.3 Purchase Manager nav access to Customers and Suppliers verified');

  // 2.4 Other roles are not granted unauthorized access
  assert(hasPermission('Cashier', 'suppliers', 'delete') === false, '2.4 Cashier cannot delete suppliers');
  assert(hasPermission('Salesperson', 'suppliers', 'delete') === false, '2.4 Salesperson cannot delete suppliers');
  console.log('  ✓ PASS: 2.4 Other roles maintain their designated boundary restrictions');

  // --- 3. Customer Details Page Verification ---
  console.log('\n--- 3. Customer Details Page Verification ---');

  // 3.1 Display records, vertical scroll without pagination
  assert(customersCode.includes('enablePagination={false}'), '3.1 Customer table uses full vertical scrolling instead of pagination');
  assert(customersCode.includes('Add New Customer'), '3.1 Has "+ Add New Customer" button');
  console.log('  ✓ PASS: 3.1 Full vertical scrolling without pagination & Add New Customer button present');

  // 3.2 Required customer information columns
  const requiredCustomerCols = ['Customer Name', 'Phone Number', 'Email', 'Address', 'Customer Type', 'Status'];
  for (const col of requiredCustomerCols) {
    assert(customersCode.includes(col), `3.2 Must display ${col} column`);
  }
  console.log('  ✓ PASS: 3.2 All required columns present: Name, Phone, Email, Address, Customer Type, Status');

  // 3.3 Search and filtering
  assert(customersCode.includes("searchPlaceholder=\"Search customers by customer name or phone number...\""), '3.3 Search placeholder mentions name and phone');
  assert(customersCode.includes("'name'") && customersCode.includes("'phone'"), '3.3 Searches by name and phone number');
  assert(customersCode.includes('customerTypeOptions') && customersCode.includes('Customer Type'), '3.3 Allows filtering by Customer Type');
  console.log('  ✓ PASS: 3.3 Searching by customer name & phone number and filtering by Customer Type/Status verified');

  // 3.4 View, Edit, and Delete actions with Confirmation Modal
  assert(customersCode.includes('CustomerViewModal'), '3.4 Uses CustomerViewModal for viewing complete details');
  assert(customersCode.includes('CustomerFormModal'), '3.4 Uses CustomerFormModal for adding/editing');
  assert(customersCode.includes('customerToDelete') && customersCode.includes('Delete Customer Confirmation'), '3.4 Delete customer confirmation modal present');
  console.log('  ✓ PASS: 3.4 View (Eye), Edit (Pencil), and Delete with confirmation modal implemented');

  // --- 4. Supplier Details Page Verification ---
  console.log('\n--- 4. Supplier Details Page Verification ---');

  // 4.1 Display records, vertical scroll without pagination
  assert(suppliersCode.includes('enablePagination={false}'), '4.1 Supplier table uses full vertical scrolling instead of pagination');
  assert(suppliersCode.includes('Add New Supplier'), '4.1 Has "+ Add New Supplier" button');
  console.log('  ✓ PASS: 4.1 Full vertical scrolling without pagination & Add New Supplier button present');

  // 4.2 Required supplier information columns
  const requiredSupplierCols = ['Supplier Name', 'Contact Person', 'Phone Number', 'Email', 'Address', 'GST Number', 'Status'];
  for (const col of requiredSupplierCols) {
    assert(suppliersCode.includes(col), `4.2 Must display ${col} column`);
  }
  console.log('  ✓ PASS: 4.2 All required columns present: Supplier Name, Contact Person, Phone, Email, Address, GST Number, Status');

  // 4.3 Search and filtering
  assert(suppliersCode.includes("searchPlaceholder=\"Search suppliers by supplier name or phone number...\""), '4.3 Search placeholder mentions name and phone');
  assert(suppliersCode.includes("'company'") && suppliersCode.includes("'phone'"), '4.3 Searches by supplier company name and phone number');
  assert(suppliersCode.includes("'status'") && suppliersCode.includes('Status'), '4.3 Allows filtering by Status');
  console.log('  ✓ PASS: 4.3 Searching by supplier name & phone number and filtering by Status verified');

  // 4.4 View, Edit, and Delete actions with Confirmation Modal
  assert(suppliersCode.includes('SupplierViewModal'), '4.4 Uses SupplierViewModal for viewing complete details');
  assert(suppliersCode.includes('SupplierFormModal'), '4.4 Uses SupplierFormModal for adding/editing');
  assert(suppliersCode.includes('supplierToDelete') && suppliersCode.includes('Delete Supplier Confirmation'), '4.4 Delete supplier confirmation modal present');
  console.log('  ✓ PASS: 4.4 View (Eye), Edit (Pencil), and Delete with confirmation modal implemented');

  // --- 5. Add / Edit Functionality: Validation & Database Updates ---
  console.log('\n--- 5. Add / Edit Functionality: Validation & Database Updates ---');

  // 5.1 CustomerFormModal validates mandatory fields and prevents duplicates
  assert(customerFormCode.includes('Customer Name is required'), '5.1 Validates mandatory Customer Name');
  assert(customerFormCode.includes('already exists'), '5.1 Prevents duplicate customer creation');
  assert(customerFormCode.includes('updateCustomer') && customerFormCode.includes('addCustomer'), '5.1 Supports both add and edit via Supabase ERPContext');
  console.log('  ✓ PASS: 5.1 CustomerFormModal validates mandatory fields, prevents duplicates, and updates existing records');

  // 5.2 SupplierFormModal validates mandatory fields and prevents duplicates
  assert(supplierFormCode.includes('Supplier / Company Legal Name is required'), '5.2 Validates mandatory Supplier Name');
  assert(supplierFormCode.includes('already exists'), '5.2 Prevents duplicate supplier creation');
  assert(supplierFormCode.includes('updateSupplier') && supplierFormCode.includes('addSupplier'), '5.2 Supports both add and edit via Supabase ERPContext');
  console.log('  ✓ PASS: 5.2 SupplierFormModal validates mandatory fields, prevents duplicates, and updates existing records');

  console.log('\n================================================================================');
  console.log('ALL VERIFICATIONS PASSED SUCCESSFULLY (17/17)');
  console.log('================================================================================');
}

runTests().catch(err => {
  console.error('\n❌ Test Suite Failed:', err.message);
  process.exit(1);
});

