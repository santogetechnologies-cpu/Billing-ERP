import fs from 'fs';
import path from 'path';

console.log('================================================================');
console.log(' VERIFICATION: Removal of "+ New Transaction" for ALL Users');
console.log('================================================================\n');

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

// 1. Check Header.tsx
const headerPath = path.resolve('src/components/layout/Header.tsx');
const headerCode = fs.readFileSync(headerPath, 'utf8');

assert(!headerCode.includes('New Transaction'), 'Header.tsx does NOT contain "New Transaction"');
assert(!headerCode.includes('showQuickMenu'), 'Header.tsx does NOT contain showQuickMenu state');
assert(!headerCode.includes('hasAnyQuickAction'), 'Header.tsx does NOT contain hasAnyQuickAction condition');
assert(!headerCode.includes('canCreateSales'), 'Header.tsx does NOT contain canCreateSales quick action');

// 2. Check AppLayout.tsx and Sidebar.tsx
const appLayoutCode = fs.readFileSync(path.resolve('src/components/layout/AppLayout.tsx'), 'utf8');
const sidebarCode = fs.readFileSync(path.resolve('src/components/layout/Sidebar.tsx'), 'utf8');

assert(!appLayoutCode.includes('New Transaction'), 'AppLayout.tsx does NOT contain "New Transaction"');
assert(!sidebarCode.includes('New Transaction'), 'Sidebar.tsx does NOT contain "New Transaction"');

// 3. Scan all source files in src/
const allSrcFiles: string[] = [];
function scan(dir: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) scan(full);
    else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts') || entry.name.endsWith('.html'))) {
      allSrcFiles.push(full);
    }
  }
}
scan('src');

let foundInFiles: string[] = [];
for (const file of allSrcFiles) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.toLowerCase().includes('new transaction')) {
    foundInFiles.push(file);
  }
}

assert(foundInFiles.length === 0, `Scanned ${allSrcFiles.length} files: 0 occurrences of "New Transaction" found`);

console.log('\n================================================================');
console.log(` RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
console.log('================================================================\n');

if (failCount > 0) process.exit(1);
process.exit(0);
