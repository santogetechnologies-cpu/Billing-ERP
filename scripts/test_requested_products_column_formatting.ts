import fs from 'fs';
import path from 'path';

function runTests() {
  console.log('--- Testing Requested Products Column Formatting in PurchaseRequestsPage.tsx ---');

  const filePath = path.resolve('src/pages/purchases/PurchaseRequestsPage.tsx');
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  // Test 1: Check Requested Products table header has responsive min width
  const hasMinWHeader = content.includes('<th className="py-3 px-4 min-w-[260px] sm:min-w-[300px]">Requested Products</th>');
  console.log('Test 1 - Header has responsive min-width:', hasMinWHeader);
  if (!hasMinWHeader) {
    throw new Error('Test 1 Failed: Requested Products header missing responsive min-w class');
  }

  // Test 2: Check all 7 <td> in the table row have align-top
  const tdMatches = content.match(/<td className="[^"]*align-top[^"]*">/g);
  console.log('Test 2 - Count of <td> with align-top:', tdMatches ? tdMatches.length : 0);
  if (!tdMatches || tdMatches.length < 7) {
    throw new Error(`Test 2 Failed: Expected at least 7 <td> with align-top, found ${tdMatches ? tdMatches.length : 0}`);
  }

  // Test 3: Check Requested Products cell has align-top and min-w
  const hasRequestedProductsTd = content.includes('<td className="py-3.5 px-4 align-top min-w-[260px] sm:min-w-[300px]">');
  console.log('Test 3 - Requested Products td has align-top and responsive min-w:', hasRequestedProductsTd);
  if (!hasRequestedProductsTd) {
    throw new Error('Test 3 Failed: Requested Products td missing align-top or min-w');
  }

  // Test 4: Check list structure with vertical spacing
  const hasUlList = content.includes('<ul className="space-y-1.5 list-none p-0 m-0">');
  console.log('Test 4 - <ul> has consistent vertical spacing space-y-1.5:', hasUlList);
  if (!hasUlList) {
    throw new Error('Test 4 Failed: <ul> with space-y-1.5 not found');
  }

  // Test 5: Check list item format with dash, product name, em-dash, and qty unit
  const hasListItemFormat =
    content.includes('<span className="text-slate-400 font-bold select-none shrink-0">-</span>') &&
    content.includes('<span className="font-medium text-slate-900 break-words">') &&
    content.includes('<span className="text-slate-400 font-normal select-none shrink-0">—</span>') &&
    content.includes('{qty} {unit}') &&
    content.includes('whitespace-nowrap');
  console.log('Test 5 - <li> matches "- Product Name — Qty Unit" format:', hasListItemFormat);
  if (!hasListItemFormat) {
    throw new Error('Test 5 Failed: <li> item formatting does not match required format');
  }

  // Test 6: Check empty product list fallback
  const hasEmptyFallback = content.includes('No products listed');
  console.log('Test 6 - Fallback for empty products list:', hasEmptyFallback);
  if (!hasEmptyFallback) {
    throw new Error('Test 6 Failed: Missing empty items fallback');
  }

  // Test 7: Verify that individual table rows are NOT created for products (one row per request)
  const isOneRowPerRequest = content.includes('filteredRequests.map(req => {') &&
    content.includes('<tr key={req.id}');
  console.log('Test 7 - Request row remains single row per request:', isOneRowPerRequest);
  if (!isOneRowPerRequest) {
    throw new Error('Test 7 Failed: Request table row structure altered');
  }

  console.log('\nAll 7 Requested Products Column Formatting Tests PASSED successfully!');
}

runTests();
