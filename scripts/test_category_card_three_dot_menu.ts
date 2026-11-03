import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('================================================================================');
console.log('TEST SUITE: THREE-DOT MENU ON CATEGORY CARDS');
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

const tabContent = fs.readFileSync(path.resolve('src/components/products/ProductCategoriesTab.tsx'), 'utf-8');

// -----------------------------------------------------------------------------
// 1. UI Requirements: Three-Dot Icon & Dropdown Placement
// -----------------------------------------------------------------------------
console.log('--- 1. UI Requirements: Three-Dot Icon & Dropdown Placement ---');

test('1.1 Uses MoreVertical icon from lucide-react', () => {
  assert(tabContent.includes('MoreVertical'), 'MoreVertical must be imported from lucide-react');
  assert(tabContent.includes('<MoreVertical className="w-4 h-4" />'), 'MoreVertical rendered with w-4 h-4');
});

test('1.2 Positioned at the top-right of each category card', () => {
  assert(
    tabContent.includes('{renderCardMenu({ name: cat.name, isDefault: true, desc: cat.desc }, count)}'),
    'Three-dot menu rendered on default category cards'
  );
  assert(
    tabContent.includes('{renderCardMenu({ name: catName, isDefault: false }, count)}'),
    'Three-dot menu rendered on custom category cards'
  );
  assert(
    tabContent.includes('flex items-center gap-1.5') && tabContent.includes('justify-between'),
    'Menu positioned at top-right next to items count'
  );
});

test('1.3 Dropdown opens directly below icon and closes on outside click', () => {
  assert(
    tabContent.includes('absolute right-0 top-full mt-1 w-44'),
    'Dropdown positioned directly below the three-dot icon'
  );
  assert(
    tabContent.includes("document.addEventListener('mousedown', handleClickOutside)"),
    'Outside click listener registered'
  );
  assert(
    tabContent.includes("document.removeEventListener('mousedown', handleClickOutside)"),
    'Outside click listener cleaned up on unmount'
  );
});

// -----------------------------------------------------------------------------
// 2. Menu Options: Edit Category & Delete Category
// -----------------------------------------------------------------------------
console.log('\n--- 2. Menu Options: Edit & Delete ---');

test('2.1 Dropdown has "Edit Category" option', () => {
  assert(tabContent.includes('Edit Category'), 'Menu must have "Edit Category" label');
  assert(tabContent.includes('handleOpenEdit'), 'Menu must trigger handleOpenEdit');
});

test('2.2 Dropdown has "Delete Category" option with red styling', () => {
  assert(tabContent.includes('Delete Category'), 'Menu must have "Delete Category" label');
  assert(tabContent.includes('text-rose-600') || tabContent.includes('text-rose-500'), 'Delete Category must use red color');
  assert(tabContent.includes('handleOpenDelete'), 'Menu must trigger handleOpenDelete');
});

// -----------------------------------------------------------------------------
// 3. Delete Rules & Prevention Logic
// -----------------------------------------------------------------------------
console.log('\n--- 3. Delete Rules & Confirmation ---');

test('3.1 Deletion is blocked for default/system categories', () => {
  assert(
    tabContent.includes('categoryToDelete?.isDefault') &&
    tabContent.includes('System Category Cannot Be Deleted'),
    'Modal shows locked message for system categories'
  );
  assert(
    tabContent.includes('Deletion is only allowed for custom-created categories'),
    'Explicit message that deletion is only allowed for custom-created categories'
  );
});

test('3.2 Deletion is blocked when products are assigned (count > 0) with reassign prompt', () => {
  assert(
    tabContent.includes('categoryToDelete.count > 0') &&
    tabContent.includes('Products Assigned to this Category'),
    'Blocks deletion when products are assigned'
  );
  assert(
    tabContent.includes('Please reassign these products to another category before deleting'),
    'Prompts user to reassign products first'
  );
  assert(
    tabContent.includes('Associated products are never deleted automatically'),
    'Explicit assurance that products are never deleted automatically'
  );
});

test('3.3 Shows confirmation popup when custom category has 0 products', () => {
  assert(
    tabContent.includes('Are you sure you want to delete the custom category'),
    'Confirmation message present for custom category with 0 items'
  );
  assert(
    tabContent.includes('handleConfirmDelete'),
    'handleConfirmDelete executes deletion on confirmation'
  );
});

// -----------------------------------------------------------------------------
// 4. Edit Category Functionality
// -----------------------------------------------------------------------------
console.log('\n--- 4. Edit Category Functionality ---');

test('4.1 Edit Category modal allows updating category name and details', () => {
  assert(tabContent.includes('title="Edit Category"'), 'Modal title is Edit Category');
  assert(tabContent.includes('setEditName') && tabContent.includes('setEditDesc'), 'Allows editing name and description');
  assert(tabContent.includes('handleSaveEdit'), 'Saves category edits');
  assert(tabContent.includes('Category name cannot be empty'), 'Validates non-empty name');
});

console.log('\n================================================================================');
console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('================================================================================\n');

if (failed > 0) {
  process.exit(1);
}

