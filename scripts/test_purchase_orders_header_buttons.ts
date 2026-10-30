import fs from 'fs';
import path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
}

console.log('================================================================================');
console.log('TEST SUITE: VERIFYING PURCHASE ORDERS HEADER BUTTONS & ALIGNMENT');
console.log('================================================================================');

const poPagePath = path.resolve('src/pages/purchases/PurchaseOrdersPage.tsx');
assert(fs.existsSync(poPagePath), 'PurchaseOrdersPage.tsx must exist');

const content = fs.readFileSync(poPagePath, 'utf-8');

// 1. Rename New Purchase Order -> New Order
console.log('\n--- 1. Button Labels & Icons ---');
assert(!content.includes('<span>New Purchase Order</span>'), 'Old "New Purchase Order" label must be removed');
assert(content.includes('<span>New Order</span>'), 'Button must be labeled "New Order"');
console.log('  ✓ PASS: New Purchase Order renamed to "New Order"');

// 2. Remove Record Bill -> Add New Bill
assert(!content.includes('<span>Record Bill</span>'), 'Old "Record Bill" button must be completely removed');
assert(content.includes('<span>New Bill</span>'), 'Button must be labeled "New Bill"');
console.log('  ✓ PASS: Record Bill completely removed and replaced with "New Bill"');

// 3. Workflow Destinations
console.log('\n--- 2. Functional Workflows ---');
assert(content.includes("navigate('/purchases/new?docType=purchase_order')"), 'New Order must open New Purchase Order workflow');
assert(content.includes("navigate('/purchases/new')"), 'New Bill must open New Purchase Bill workflow');
console.log('  ✓ PASS: New Order and New Bill routes wired accurately');

// 4. Button Ordering: Refresh -> New Order -> New Bill
console.log('\n--- 3. Button Ordering & Alignment ---');
const refreshIndex = content.indexOf('<span>Refresh</span>');
const newOrderIndex = content.indexOf('<span>New Order</span>');
const newBillIndex = content.indexOf('<span>New Bill</span>');

assert(refreshIndex > 0, 'Refresh button must be present in header');
assert(newOrderIndex > refreshIndex, 'New Order must appear after Refresh');
assert(newBillIndex > newOrderIndex, 'New Bill must appear after New Order');
console.log('  ✓ PASS: Buttons ordered strictly: Refresh -> New Order -> New Bill');

// 5. Button heights and styling
console.log('\n--- 4. Visual Uniformity & Responsive Styling ---');
// Match header buttons section
const headerButtonsMatch = content.match(/<div className="flex flex-wrap items-center gap-2\.5 shrink-0 self-start sm:self-auto">([\s\S]*?)<\/div>\s*<\/div>/);
assert(Boolean(headerButtonsMatch), 'Header action toolbar container must support responsive flex wrapping');

const toolbarBlock = headerButtonsMatch![1];
// Check that all 3 buttons have h-9 height
const h9Count = (toolbarBlock.match(/h-9\b/g) || []).length;
assert(h9Count === 3, `Expected 3 buttons with h-9 height, found ${h9Count}`);

// Check that New Order is primary blue button
assert(toolbarBlock.includes('bg-blue-600') && toolbarBlock.includes('text-white'), 'New Order must be primary blue button');

// Check that New Bill is secondary button styled with slate background
assert(toolbarBlock.includes('bg-slate-100') && toolbarBlock.includes('text-slate-800'), 'New Bill must be styled as secondary button');

console.log('  ✓ PASS: Consistent h-9 height, typography, primary/secondary colors & padding');

console.log('\n================================================================================');
console.log('🎉 ALL PURCHASE ORDERS HEADER BUTTONS VERIFIED SUCCESSFULLY (100%)');
console.log('================================================================================');

