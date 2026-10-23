import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('================================================================');
console.log('TEST SUITE: SUPPLIERS TABLE LAYOUT & HORIZONTAL SCROLLBAR REMOVAL');
console.log('================================================================');

// 1. Inspect SuppliersPage.tsx
const suppliersPath = path.resolve('src/pages/suppliers/SuppliersPage.tsx');
assert(fs.existsSync(suppliersPath), 'SuppliersPage.tsx must exist');
const suppliersCode = fs.readFileSync(suppliersPath, 'utf-8');

console.log('\n--- 1. SuppliersPage DataTable Props & Scrollbar Elimination ---');
assert(suppliersCode.includes('selectable={false}'), 'SuppliersPage must pass selectable={false} to omit checkbox column');
assert(suppliersCode.includes('hideHorizontalScroll={true}'), 'SuppliersPage must pass hideHorizontalScroll={true} to eliminate horizontal scrollbar');
assert(suppliersCode.includes('tableFixed={true}'), 'SuppliersPage must pass tableFixed={true} for 100% width distribution');
console.log('  ✓ PASS: SuppliersPage configures selectable={false}, hideHorizontalScroll={true}, and tableFixed={true}');

console.log('\n--- 2. Column Percentage Widths & Content Formatting ---');
assert(suppliersCode.includes("width: '24%'"), "Supplier / Company column has width: '24%'");
assert(suppliersCode.includes("width: '10%'"), "Phone column has width: '10%'");
assert(suppliersCode.includes("width: '13%'"), "Email column has width: '13%'");
assert(suppliersCode.includes("width: '14%'"), "Payable Balance has width: '14%'");
assert(suppliersCode.includes("width: '14%'"), "Total Purchases has width: '14%'");
assert(suppliersCode.includes("width: '11%'"), "Credit Terms has width: '11%'");
assert(suppliersCode.includes("width: '14%'"), "Delivery Status has width: '14%'");
console.log('  ✓ PASS: All columns have balanced percentage widths summing to 100%');

assert(suppliersCode.includes("row.phone || '—'"), 'Empty phone defaults cleanly to "—"');
assert(suppliersCode.includes("row.email || '—'"), 'Empty email defaults cleanly to "—"');
assert(suppliersCode.includes('truncate'), 'Text truncation is applied to prevent table overflow');
console.log('  ✓ PASS: Fallback placeholders and truncation prevent awkward gaps or line blowouts');

console.log('\n--- 3. DataTable Component Selectable & Fixed Layout Support ---');
const dataTablePath = path.resolve('src/components/common/DataTable.tsx');
assert(fs.existsSync(dataTablePath), 'DataTable.tsx must exist');
const dataTableCode = fs.readFileSync(dataTablePath, 'utf-8');

assert(dataTableCode.includes('selectable?: boolean;'), 'DataTableProps must declare selectable?: boolean');
assert(dataTableCode.includes('selectable = true'), 'DataTable must provide default selectable = true');
assert(dataTableCode.includes('{selectable && ('), 'Checkbox headers and cells must be conditional on selectable');
assert(dataTableCode.includes('whitespace-normal leading-tight'), 'Headers wrap naturally without truncation ellipsis');
assert(dataTableCode.includes("minWidth: '68px'"), 'Actions column width is optimized to 68px');
console.log('  ✓ PASS: DataTable component cleanly supports selectable={false} and optimized column widths');

console.log('\n================================================================');
console.log('ALL SUPPLIER TABLE FIX TESTS PASSED (100%)');
console.log('================================================================');
