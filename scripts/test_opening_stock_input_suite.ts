import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { cleanQuantityInput } from '../src/pages/products/InitialStockPage';

console.log('--- RUNNING OPENING STOCK INPUT & UNIT DISPLAY TEST SUITE ---');

// 1. Verify default zero & leading zero stripping
console.log('Test 1: cleanQuantityInput behaviors');
assert.strictEqual(cleanQuantityInput('02'), '2', '02 should become 2');
assert.strictEqual(cleanQuantityInput('025'), '25', '025 should become 25');
assert.strictEqual(cleanQuantityInput('05'), '5', '05 should become 5');
assert.strictEqual(cleanQuantityInput('010'), '10', '010 should become 10');
assert.strictEqual(cleanQuantityInput('00'), '0', '00 should become 0');
assert.strictEqual(cleanQuantityInput('000'), '0', '000 should become 0');
assert.strictEqual(cleanQuantityInput('0'), '0', '0 should remain 0');

// 2. Verify decimal handling
console.log('Test 2: Decimal input handling');
assert.strictEqual(cleanQuantityInput('0.5'), '0.5', '0.5 must be preserved');
assert.strictEqual(cleanQuantityInput('0.'), '0.', '0. must be preserved during typing');
assert.strictEqual(cleanQuantityInput('0.05'), '0.05', '0.05 must be preserved');
assert.strictEqual(cleanQuantityInput('12.75'), '12.75', '12.75 must be preserved');

// 3. Verify deletion / empty state
console.log('Test 3: Empty string / clearing');
assert.strictEqual(cleanQuantityInput(''), '', 'Empty string must remain empty during editing');

// 4. Verify negative sign stripping
console.log('Test 4: Negative sign handling');
assert.strictEqual(cleanQuantityInput('-5'), '5', '-5 should strip minus sign');
assert.strictEqual(cleanQuantityInput('-0'), '0', '-0 should strip minus sign');

// 5. Verify InitialStockPage layout & attributes
console.log('Test 5: InitialStockPage file structure');
const initialStockContent = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/products/InitialStockPage.tsx'), 'utf-8');
assert(initialStockContent.includes('onFocus={e => e.target.select()}'), 'Must include select on focus');
assert(initialStockContent.includes('cleanQuantityInput(e.target.value)'), 'Must call cleanQuantityInput in onChange');
assert(initialStockContent.includes('border-l border-slate-200 text-[11px] font-semibold text-slate-600 whitespace-nowrap select-none shrink-0'), 'Must use dedicated addon badge for unit label');
assert(!initialStockContent.includes('absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 font-medium'), 'Must NOT have absolute unit label inside input');

// 6. Verify NewProductPage layout & attributes
console.log('Test 6: NewProductPage file structure');
const newProductContent = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/products/NewProductPage.tsx'), 'utf-8');
assert(newProductContent.includes('id="field-openingStock"'), 'Must have opening stock field');
assert(!newProductContent.includes('absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-500 pointer-events-none'), 'Must NOT have absolute overlapping unit label in openingStock');
assert(!newProductContent.includes('absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400 pointer-events-none'), 'Must NOT have absolute overlapping unit label in reorderLevel');

console.log('ALL TESTS PASSED SUCCESSFULLY! ✅');
