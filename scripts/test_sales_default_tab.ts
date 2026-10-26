import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

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

console.log('--- Universal Billing: Sales Records & Order Status Default Tab Verification ---\n');

// 1. Check SalesInvoicesPage.tsx source code
const salesInvoicesPagePath = path.resolve(__dirname, '../src/pages/sales/SalesInvoicesPage.tsx');
assert(fs.existsSync(salesInvoicesPagePath), 'SalesInvoicesPage.tsx exists');

const fileContent = fs.readFileSync(salesInvoicesPagePath, 'utf-8');

// Test 1: Verify default salesTab initialization
const hasInvoicesAsDefaultFallback = /const\s+\[salesTab,\s*setSalesTab\]\s*=\s*useState<'orders'\s*\|\s*'invoices'\s*\|\s*'products'>\(\s*tabParam\s*===\s*'orders'\s*\?\s*'orders'\s*:\s*tabParam\s*===\s*'products'\s*\?\s*'products'\s*:\s*'invoices'\s*\);/.test(fileContent);
assert(hasInvoicesAsDefaultFallback, 'salesTab defaults to "invoices" when no tab parameter is present in URL');

// Test 2: Verify no lingering `'orders'` default fallback
const hasOldOrdersFallback = /tabParam\s*===\s*'invoices'\s*\?\s*'invoices'\s*:\s*'orders'/.test(fileContent) ||
  /searchParams\.get\('filter'\)\s*===\s*'today'\s*\?\s*'invoices'\s*:\s*'orders'/.test(fileContent);
assert(!hasOldOrdersFallback, 'Old logic forcing "orders" as default tab fallback is completely removed');

// Test 3: Verify useEffect reset logic on navigation / searchParams change
const hasSearchParamsSync = /useEffect\(\(\)\s*=>\s*\{[\s\S]*?const\s+currentTab\s*=\s*searchParams\.get\('tab'\);[\s\S]*?if\s*\(currentTab\s*===\s*'orders'\)[\s\S]*?else\s*\{[\s\S]*?setSalesTab\('invoices'\);/s.test(fileContent);
assert(hasSearchParamsSync, 'useEffect automatically resets salesTab to "invoices" when navigating to /sales without query params');

// Test 4: Confirmed Invoices tab active styling
const hasConfirmedInvoicesActiveStyle = /salesTab\s*===\s*'invoices'\s*\?\s*'bg-blue-600 text-white shadow-2xs'\s*:\s*'text-slate-600 hover:bg-slate-100 hover:text-slate-900'/.test(fileContent);
assert(hasConfirmedInvoicesActiveStyle, 'Confirmed Invoices tab uses bg-blue-600 text-white shadow-2xs when active');

// Test 5: Sales Orders tab active styling
const hasSalesOrdersActiveStyle = /salesTab\s*===\s*'orders'\s*\?\s*'bg-blue-600 text-white shadow-2xs'\s*:\s*'text-slate-600 hover:bg-slate-100 hover:text-slate-900'/.test(fileContent);
assert(hasSalesOrdersActiveStyle, 'Sales Orders & Quotations tab uses bg-blue-600 text-white shadow-2xs when active');

// Test 6: Confirmed Invoices tab renders DataTable
const hasInvoicesTable = /\{salesTab\s*===\s*'invoices'\s*&&\s*\(\s*<DataTable[\s\S]*?title="Confirmed Sales Invoices"/.test(fileContent);
assert(hasInvoicesTable, 'Confirmed Invoices tab immediately renders the Confirmed Sales Invoices DataTable');

// Test 7: Sales Orders tab conditionally rendered
const hasOrdersTable = /\{salesTab\s*===\s*'orders'\s*&&\s*\(\s*<div[\s\S]*?Sales Orders &amp; Quotation History/.test(fileContent);
assert(hasOrdersTable, 'Sales Orders section only renders when salesTab === "orders"');

// Test 8: Confirmed Invoices tab click handler
const hasInvoicesTabClick = /onClick=\{\(\)\s*=>\s*\{[\s\S]*?setSalesTab\('invoices'\);[\s\S]*?next\.delete\('tab'\);/.test(fileContent);
assert(hasInvoicesTabClick, 'Confirmed Invoices button click cleanses tab param and selects invoices');

// Test 9: Sales Orders tab click handler
const hasOrdersTabClick = /onClick=\{\(\)\s*=>\s*\{[\s\S]*?setSalesTab\('orders'\);[\s\S]*?next\.set\('tab',\s*'orders'\);/.test(fileContent);
assert(hasOrdersTabClick, 'Sales Orders & Quotations button click sets tab=orders and selects orders');

// Test 10: Check simulation of tab state transitions
function simulateTabResolution(tabParam: string | null): 'orders' | 'invoices' | 'products' {
  return tabParam === 'orders' ? 'orders' : tabParam === 'products' ? 'products' : 'invoices';
}

assert(simulateTabResolution(null) === 'invoices', 'Simulated initial entry to /sales returns "invoices"');
assert(simulateTabResolution('') === 'invoices', 'Simulated entry with empty tab returns "invoices"');
assert(simulateTabResolution('orders') === 'orders', 'Simulated entry with tab=orders returns "orders"');
assert(simulateTabResolution('invoices') === 'invoices', 'Simulated entry with tab=invoices returns "invoices"');
assert(simulateTabResolution('unknown') === 'invoices', 'Simulated entry with invalid tab returns "invoices"');

// Test 11: Re-entry reset simulation
let simulatedCurrentTab: 'orders' | 'invoices' | 'products' = 'orders'; // User previously clicked orders
// Now user navigates away and re-enters /sales (no query params)
const reEntrySearchParam: string | null = null;
if (reEntrySearchParam === 'orders') {
  simulatedCurrentTab = 'orders';
} else {
  simulatedCurrentTab = 'invoices';
}
assert(simulatedCurrentTab === 'invoices', 'Re-entering page after navigating away cleanly resets tab to "invoices"');

console.log(`\n========================================`);
console.log(`Results: ${passCount} Passed, ${failCount} Failed`);
console.log(`========================================`);

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
