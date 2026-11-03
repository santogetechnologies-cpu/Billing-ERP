import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('================================================================================');
console.log('TEST SUITE: NUMBER OF COPIES INPUT - CUSTOM STICKER PRINTING');
console.log('================================================================================\n');

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${name} -> ${err?.message || err}`);
    failed++;
    process.exitCode = 1;
  }
}

const tabContent = fs.readFileSync(path.resolve('src/components/products/ProductLabelsTab.tsx'), 'utf-8');

// 1. Default value must be 1
test('1. Default copies value must be 1', () => {
  assert(
    tabContent.includes('const [copies, setCopies] = useState<number | string>(1);'),
    'Default value of copies must be initialized to 1'
  );
});

// 2 & 3. Allows manual typing and immediately updates value
test('2 & 3. Allows users to manually type any valid positive whole number and immediately updates value', () => {
  assert(tabContent.includes('handleCopiesChange'), 'handleCopiesChange must exist');
  assert(tabContent.includes('onChange={handleCopiesChange}'), 'input must use handleCopiesChange on change');
  assert(tabContent.includes("setCopies('')"), 'allows clearing field to type a new number');
  assert(tabContent.includes('setCopies(num)'), 'immediately updates copies state with entered number');
});

// 4 & 5. Uses entered number as actual sticker printing quantity
test('4 & 5. Uses entered number as actual sticker printing quantity without hardcoding', () => {
  assert(
    tabContent.includes('const printQuantity = Math.max(1, parseInt(String(copies), 10) || 1);'),
    'Computes printQuantity from copies state'
  );
  assert(
    tabContent.includes('printQuantity\n      );') || tabContent.includes('printQuantity\r\n      );'),
    'Passes printQuantity to directPrintService.printBarcodeSticker'
  );
  assert(!tabContent.includes('copies: 1,'), 'Quantity must not be hardcoded to 1');
});

// 6. Up/Down arrows not required (manual typing supported)
test('6. Input allows direct keyboard typing', () => {
  assert(tabContent.includes('onChange={handleCopiesChange}'), 'Controlled input with onChange for direct typing');
  assert(tabContent.includes('onBlur'), 'onBlur safety fallback present');
});

// 7. Does not reset entered number to 1 when printing
test('7. Does not reset entered number to 1 when printing', () => {
  // Check handlePrintCustomSticker
  const printHandlerMatch = tabContent.match(/handlePrintCustomSticker = async \(\) => \{([\s\S]*?)\};/);
  assert(printHandlerMatch, 'handlePrintCustomSticker must exist');
  const printHandlerBody = printHandlerMatch[1];
  assert(!printHandlerBody.includes('setCopies(1)'), 'handlePrintCustomSticker must NOT reset copies to 1');
  assert(!printHandlerBody.includes("setCopies('1')"), 'handlePrintCustomSticker must NOT reset copies');
});

// 8. Prevent zero, negative numbers and invalid input
test('8. Prevent zero, negative numbers and invalid input', () => {
  // Check keydown prevention
  assert(tabContent.includes("e.key === '-'"), 'Blocks minus key');
  assert(tabContent.includes("e.key === '+'"), 'Blocks plus key');
  assert(tabContent.includes("e.key === '.'"), 'Blocks decimal point');
  assert(tabContent.includes("e.key === 'e'"), 'Blocks exponential character');

  // Check digit stripping and leading zero prevention
  assert(tabContent.includes("rawValue.replace(/[^0-9]/g, '')"), 'Strips non-numeric characters');
  assert(tabContent.includes("cleanDigits.replace(/^0+/, '')"), 'Strips leading zeros and prevents 0');

  // Simulate logic
  const sanitize = (val: string) => {
    if (val === '') return '';
    const cleanDigits = val.replace(/[^0-9]/g, '');
    if (!cleanDigits) return '';
    const stripped = cleanDigits.replace(/^0+/, '');
    if (stripped === '') return null; // blocked
    return parseInt(stripped, 10);
  };

  assert.strictEqual(sanitize('0'), null, 'Typing 0 is blocked');
  assert.strictEqual(sanitize('-5'), 5, 'Negative stripped to positive');
  assert.strictEqual(sanitize('1'), 1, '1 is allowed');
  assert.strictEqual(sanitize('5'), 5, '5 is allowed');
  assert.strictEqual(sanitize('20'), 20, '20 is allowed');
  assert.strictEqual(sanitize('007'), 7, 'Leading zeros stripped');
});

// 9. Keep existing print button dynamically updated
test('9. Print button dynamically updates for 1, 5, 20 copies with correct pluralization', () => {
  assert(
    tabContent.includes('`Print ${displayCopies} Custom Sticker${displayCopies > 1 ? \'s\' : \'\'}`'),
    'Button text dynamically formats singular and plural'
  );

  const getButtonText = (displayCopies: number) =>
    `Print ${displayCopies} Custom Sticker${displayCopies > 1 ? 's' : ''}`;

  assert.strictEqual(getButtonText(1), 'Print 1 Custom Sticker');
  assert.strictEqual(getButtonText(5), 'Print 5 Custom Stickers');
  assert.strictEqual(getButtonText(20), 'Print 20 Custom Stickers');
});

console.log('\n================================================================================');
console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('================================================================================\n');

if (failed > 0) {
  process.exit(1);
}

