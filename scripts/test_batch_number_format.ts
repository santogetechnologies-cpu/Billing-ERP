import fs from 'fs';
import path from 'path';
import { productService } from '../src/services/productService';

console.log('================================================================================');
console.log('TEST SUITE: BATCH NUMBER AUTO-GENERATION FORMAT & REGENERATION');
console.log('================================================================================');

let passed = 0;
let failed = 0;

function assert(condition: boolean, desc: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${desc}`);
    failed++;
  }
}

async function runTests() {
  const now = new Date();
  const currentYY = String(now.getFullYear()).slice(-2);
  const currentMM = String(now.getMonth() + 1).padStart(2, '0');
  const expectedPrefix = `BTH-${currentYY}${currentMM}-`;

  console.log(`\n--- 1. Format & Current Date Dynamic Generation (YY=${currentYY}, MM=${currentMM}) ---`);
  const batch1 = await productService.generateNextBatchNumber();
  console.log(`  Generated Batch 1: ${batch1}`);
  assert(batch1.startsWith(expectedPrefix), `Batch starts with current year & month prefix (${expectedPrefix})`);
  assert(/^BTH-\d{4}-\d{3}$/.test(batch1), `Batch strictly matches BTH-YYMM-### format (${batch1})`);

  console.log('\n--- 2. Sequential Increment & Duplicate Prevention ---');
  const batch2 = await productService.generateNextBatchNumber(undefined, undefined, [batch1]);
  console.log(`  Generated Batch 2 (after ${batch1}): ${batch2}`);
  assert(batch2.startsWith(expectedPrefix), `Batch 2 starts with ${expectedPrefix}`);
  assert(batch2 !== batch1, `Batch 2 is not equal to Batch 1 (No duplicate)`);

  const num1 = parseInt(batch1.split('-')[2], 10);
  const num2 = parseInt(batch2.split('-')[2], 10);
  assert(num2 === num1 + 1, `Sequential number incremented correctly (${num1} -> ${num2})`);

  console.log('\n--- 3. Month Transition Reset Sequence (Requirement 4) ---');
  // Simulate next month (e.g. December 2026 if current is November 2026)
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 15);
  const nextMonthYY = String(nextMonthDate.getFullYear()).slice(-2);
  const nextMonthMM = String(nextMonthDate.getMonth() + 1).padStart(2, '0');
  const nextMonthPrefix = `BTH-${nextMonthYY}${nextMonthMM}-`;

  const nextMonthBatch = await productService.generateNextBatchNumber(undefined, nextMonthDate.toISOString().split('T')[0]);
  console.log(`  Generated Next Month Batch (${nextMonthDate.toISOString().split('T')[0]}): ${nextMonthBatch}`);
  assert(nextMonthBatch.startsWith(nextMonthPrefix), `Next month batch starts with ${nextMonthPrefix}`);
  assert(nextMonthBatch === `${nextMonthPrefix}001`, `Sequence resets to 001 for new month (${nextMonthBatch})`);

  console.log('\n--- 4. Regenerate Support & Duplicates Exclusion (Requirement 5 & 6) ---');
  const regenBatch = await productService.generateNextBatchNumber(undefined, undefined, [batch1, batch2]);
  console.log(`  Regenerate with [${batch1}, ${batch2}] excluded: ${regenBatch}`);
  assert(regenBatch !== batch1 && regenBatch !== batch2, 'Regenerated batch excludes existing in-form batches');
  const regenNum = parseInt(regenBatch.split('-')[2], 10);
  assert(regenNum > num2, `Regenerated number advances to next sequential number (${regenNum} > ${num2})`);

  console.log('\n--- 5. UI Codebase Verification: Format Hints, Regenerate Buttons, & Dynamic Placeholders ---');
  const filesToCheck = [
    { name: 'InitialStockPage.tsx', path: 'src/pages/products/InitialStockPage.tsx' },
    { name: 'UpdateStockPage.tsx', path: 'src/pages/products/UpdateStockPage.tsx' },
    { name: 'NewProductPage.tsx', path: 'src/pages/products/NewProductPage.tsx' },
    { name: 'BatchManagementPage.tsx', path: 'src/pages/inventory/BatchManagementPage.tsx' }
  ];

  for (const f of filesToCheck) {
    const content = fs.readFileSync(path.resolve(f.path), 'utf8');
    assert(content.includes('Format: BTH-YYMM-###'), `${f.name} contains format hint 'Format: BTH-YYMM-###'`);
    assert(content.includes('Regenerate'), `${f.name} contains Regenerate button`);
    assert(!content.includes('placeholder="e.g. BTH-2610-001"'), `${f.name} does NOT contain obsolete hardcoded placeholder`);
    assert(!content.includes('placeholder="e.g. BAT-2026-001"'), `${f.name} does NOT contain obsolete BAT-2026-001 placeholder`);
  }

  console.log('\n--- 6. No Expiry Date Pollution in Generation Logic ---');
  const initialStockContent = fs.readFileSync(path.resolve('src/pages/products/InitialStockPage.tsx'), 'utf8');
  assert(!initialStockContent.includes('generateNextBatchNumber(item.expiryDate'), 'InitialStockPage does NOT pass expiry date to generateNextBatchNumber');

  const updateStockContent = fs.readFileSync(path.resolve('src/pages/products/UpdateStockPage.tsx'), 'utf8');
  assert(!updateStockContent.includes('getNextBatch(expiryDate'), 'UpdateStockPage does NOT pass expiry date to getNextBatch');

  console.log('\n================================================================================');
  console.log(`TOTAL TESTS: ${passed + failed}`);
  console.log(`PASSED:      ${passed}`);
  console.log(`FAILED:      ${failed}`);
  console.log('================================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
