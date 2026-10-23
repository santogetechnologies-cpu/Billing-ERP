import fs from 'fs';
import path from 'path';

console.log('================================================================');
console.log(' VERIFICATION SUITE: Simplified Product Pricing Section');
console.log('================================================================\n');

const filePath = path.resolve('src/pages/products/NewProductPage.tsx');
const content = fs.readFileSync(filePath, 'utf8');

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, desc: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${desc}`);
    passCount++;
  } else {
    console.error(`  ✗ FAIL: ${desc}`);
    failCount++;
  }
}

console.log('--- 1. Section Header & Subheading ---');
assert(content.includes('<h2 className="text-sm font-bold text-slate-900">Product Prices</h2>'), 'Section contains "Product Prices" heading');
assert(content.includes('Enter the buying cost and the prices you charge customers.'), 'Section contains description "Enter the buying cost and the prices you charge customers."');

console.log('\n--- 2. Simplified Label Checks ---');
assert(content.includes('Buying Price (₹)'), 'Contains "Buying Price (₹)"');
assert(content.includes('Total Cost per Item (₹)'), 'Contains "Total Cost per Item (₹)"');
assert(content.includes('Selling Price (₹) <span className="text-rose-500">*</span>'), 'Contains "Selling Price (₹)" with required asterisk');
assert(content.includes('Retail Customer Price (₹)'), 'Contains "Retail Customer Price (₹)"');
assert(content.includes('Bulk Purchase Price (₹)'), 'Contains "Bulk Purchase Price (₹)"');
assert(content.includes('Dealer Customer Price (₹)'), 'Contains "Dealer Customer Price (₹)"');
assert(content.includes('MRP – Printed Maximum Price (₹)'), 'Contains "MRP – Printed Maximum Price (₹)"');
assert(content.includes('Lowest Allowed Selling Price (₹)'), 'Contains "Lowest Allowed Selling Price (₹)"');

console.log('\n--- 3. Explanations / Help Text Checks ---');
assert(content.includes('The price paid to the supplier to buy one item.'), 'Buying Price explanation present');
assert(content.includes('The total cost of one item, including purchase cost and any additional costs already supported by the application.'), 'Total Cost per Item explanation present');
assert(content.includes('The normal price charged to a customer. Use this as the default price during billing.'), 'Selling Price explanation present');
assert(content.includes('The price charged when selling individual items to retail customers.'), 'Retail Customer Price explanation present');
assert(content.includes('The price offered when a customer buys in bulk.'), 'Bulk Purchase Price explanation present');
assert(content.includes('The special price offered to dealers.'), 'Dealer Customer Price explanation present');
assert(content.includes('The maximum retail price printed on the product, where applicable.'), 'MRP explanation present');
assert(content.includes('The minimum price the system permits an authorized user to sell at, subject to existing permissions and pricing rules.'), 'Lowest Allowed Selling Price explanation present');

console.log('\n--- 4. Placeholders Verification ---');
assert(content.includes('placeholder="Enter buying price"'), 'Buying Price placeholder is "Enter buying price"');
assert(content.includes('placeholder="Enter total cost per item"'), 'Total Cost placeholder is "Enter total cost per item"');
assert(content.includes('placeholder="Enter selling price"'), 'Selling Price placeholder is "Enter selling price"');
assert(content.includes('placeholder="Enter retail customer price"'), 'Retail Price placeholder is "Enter retail customer price"');
assert(content.includes('placeholder="Enter bulk purchase price"'), 'Bulk Price placeholder is "Enter bulk purchase price"');
assert(content.includes('placeholder="Enter dealer customer price"'), 'Dealer Price placeholder is "Enter dealer customer price"');
assert(content.includes('placeholder="Enter MRP printed price"'), 'MRP placeholder is "Enter MRP printed price"');
assert(content.includes('placeholder="Enter lowest selling price"'), 'Lowest Allowed Selling Price placeholder is "Enter lowest selling price"');

console.log('\n--- 5. Old Technical Labels Displaced in Pricing Grid ---');
assert(!content.includes('<label className="block font-medium text-slate-700 mb-1">Purchase Price (₹)</label>'), 'Old Purchase Price label removed');
assert(!content.includes('Cost Price / COGS (₹)'), 'Old Cost Price / COGS label removed');
assert(!content.includes('Default Selling Price (₹)'), 'Old Default Selling Price label removed');
assert(!content.includes('<label className="block font-medium text-slate-700 mb-1">Retail Price (₹)</label>'), 'Old Retail Price label removed');
assert(!content.includes('<label className="block font-medium text-slate-700 mb-1">Wholesale Price (₹)</label>'), 'Old Wholesale Price label removed');
assert(!content.includes('<label className="block font-medium text-slate-700 mb-1">Dealer Price (₹)</label>'), 'Old Dealer Price label removed');
assert(!content.includes('Maximum Retail Price / MRP (₹)'), 'Old Maximum Retail Price / MRP label removed');
assert(!content.includes('Minimum Floor Price (₹)'), 'Old Minimum Floor Price label removed');

console.log('\n================================================================');
console.log(` RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
console.log('================================================================\n');

if (failCount > 0) {
  process.exit(1);
}
