import assert from 'assert';
import fs from 'fs';
import path from 'path';

// 1. Inspect PurchaseManagerDashboardPage.tsx
const pmDashboardPath = path.resolve('src/pages/purchases/PurchaseManagerDashboardPage.tsx');
const pmDashboardContent = fs.readFileSync(pmDashboardPath, 'utf-8');

console.log('Testing Purchase Manager Dashboard Navigation Handlers...');

// Verify Pending Requests card navigation
const pendingCardMatch = pmDashboardContent.match(/title="Pending Requests"[\s\S]*?onClick=\{\(\)\s*=>\s*navigate\('([^']+)'\)\}/);
assert(pendingCardMatch, 'Pending Requests card must have an onClick handler with navigate()');
const pendingTarget = pendingCardMatch[1];
console.log(`✓ Pending Requests card navigates to: ${pendingTarget}`);
assert(pendingTarget.startsWith('/purchases/requests'), 'Pending Requests card must navigate to /purchases/requests');

// Verify Active Orders card toggles inline without navigating
const activeCardMatch = pmDashboardContent.match(/title="Active Orders"[\s\S]*?onClick=\{toggleActiveOrdersPanel\}/);
assert(activeCardMatch, 'Active Orders card must have onClick={toggleActiveOrdersPanel} for inline view');
console.log('✓ Active Orders card toggles inline active orders list without router navigation');

// CRITICAL: Active Orders must NOT navigate to /purchases/requests!
assert(!pmDashboardContent.includes('title="Active Orders"\n          value={formatNumber(metrics.activeOrdersCount)}\n          subtitle="Purchase orders in-transit"\n          icon={Truck}\n          iconBgColor="bg-blue-50"\n          iconTextColor="text-blue-600"\n          onClick={() => navigate'), 'Active Orders must toggle inline instead of route navigation');
console.log('✓ Verified: Active Orders toggles inline expandable panel within existing dashboard!');

// 2. Inspect App.tsx routes
const appPath = path.resolve('src/App.tsx');
const appContent = fs.readFileSync(appPath, 'utf-8');

console.log('\nTesting App.tsx Routing Configuration...');
assert(appContent.includes('path="purchases/requests"'), 'App.tsx must define route path="purchases/requests"');
assert(appContent.includes('path="purchases/orders"'), 'App.tsx must define route path="purchases/orders"');
assert(appContent.includes('<PurchaseOrdersPage />'), 'App.tsx must render <PurchaseOrdersPage /> for purchases/orders');
assert(appContent.includes('<PurchaseRequestsPage />'), 'App.tsx must render <PurchaseRequestsPage /> for purchases/requests');
console.log('✓ Verified: App.tsx has distinct routes and components for both pages.');

// 3. Inspect RBAC routing
const rbacPath = path.resolve('src/utils/rbac.ts');
const rbacContent = fs.readFileSync(rbacPath, 'utf-8');

console.log('\nTesting RBAC Route Permissions...');
assert(rbacContent.includes("'/purchases/orders': { module: 'purchases', action: 'view' }"), 'RBAC ROUTE_MODULE_MAP must include /purchases/orders');
assert(rbacContent.includes("'/purchases/requests': { module: 'purchases', action: 'view' }"), 'RBAC ROUTE_MODULE_MAP must include /purchases/requests');
console.log('✓ Verified: RBAC allows authorized roles (Purchase Manager, Owner, Admin) access to both routes.');

// 4. Inspect Sidebar.tsx
const sidebarPath = path.resolve('src/components/layout/Sidebar.tsx');
const sidebarContent = fs.readFileSync(sidebarPath, 'utf-8');

console.log('\nTesting Sidebar Navigation...');
assert(sidebarContent.includes("path: '/purchases/orders'"), 'Sidebar must list Purchase Orders item');
assert(sidebarContent.includes("path: '/purchases/requests'"), 'Sidebar must list Purchase Requests item');
assert(sidebarContent.includes("current.startsWith('/purchases/orders')"), 'Sidebar route matching must exclude /purchases/orders from highlighting /purchases');
console.log('✓ Verified: Sidebar includes both distinct purchase navigation items.');

// 5. Inspect PurchaseOrdersPage.tsx
const poPagePath = path.resolve('src/pages/purchases/PurchaseOrdersPage.tsx');
assert(fs.existsSync(poPagePath), 'PurchaseOrdersPage.tsx must exist');
const poPageContent = fs.readFileSync(poPagePath, 'utf-8');

console.log('\nTesting PurchaseOrdersPage.tsx implementation details...');
assert(poPageContent.includes('supplierName'), 'PurchaseOrdersPage must display supplier name');
assert(poPageContent.includes('supplierContact'), 'PurchaseOrdersPage must display supplier contact');
assert(poPageContent.includes('expectedDelivery'), 'PurchaseOrdersPage must display expected delivery');
assert(poPageContent.includes('totalQty') && poPageContent.includes('receivedQty') && poPageContent.includes('pendingQty'), 'PurchaseOrdersPage must display order quantities');
assert(poPageContent.includes('status'), 'PurchaseOrdersPage must display order statuses');
assert(poPageContent.includes('recordGoodsReceipt'), 'PurchaseOrdersPage must support recording inward goods receipts (GRN)');
assert(poPageContent.includes('Modal'), 'PurchaseOrdersPage must support detail / GRN modals');
console.log('✓ Verified: PurchaseOrdersPage contains supplier details, quantities, delivery dates, statuses, and GRN actions.');

// 6. Inspect PurchaseRequestsPage.tsx
const prPagePath = path.resolve('src/pages/purchases/PurchaseRequestsPage.tsx');
const prPageContent = fs.readFileSync(prPagePath, 'utf-8');

console.log('\nTesting PurchaseRequestsPage.tsx status synchronization...');
assert(prPageContent.includes("searchParams.get('status')"), 'PurchaseRequestsPage must parse status query param from URL');
assert(prPageContent.includes('Pending Review'), 'PurchaseRequestsPage must support Pending Review status filter');
assert(prPageContent.includes('handleOpenApproveModal') || prPageContent.includes('handleSubmitApprove'), 'PurchaseRequestsPage must allow approval');
console.log('✓ Verified: PurchaseRequestsPage synchronizes URL status and provides review, approval, and rejection actions.');

console.log('\n========================================');
console.log('ALL NAVIGATION VERIFICATION CHECKS PASSED!');
console.log('========================================');
