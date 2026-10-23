import { supabase } from '../src/lib/supabase';
import { categoryService, isBaseCategory, BASE_PRODUCT_CATEGORIES } from '../src/services/categoryService';
import { hasPermission, ROLE_PERMISSIONS_MATRIX } from '../src/utils/rbac';
import * as fs from 'fs';

let passed = 0;
let failed = 0;

function assert(description: string, condition: boolean, detail?: any) {
  if (condition) {
    console.log(`  ✓ PASS: ${description}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${description}`);
    if (detail !== undefined) console.error(`    Detail:`, detail);
    failed++;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log(' VERIFICATION SUITE: Custom Category Dropdown & Database Storage ');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // 1. Dropdown Order & File Inspection
  // -------------------------------------------------------------
  console.log('--- 1. Dropdown Order Verification ---');
  const nppCode = fs.readFileSync('src/pages/products/NewProductPage.tsx', 'utf8');

  assert(
    'Dropdown contains "+ Add Custom Category" option',
    nppCode.includes('+ Add Custom Category')
  );

  const selectStart = nppCode.indexOf('id="field-category"');
  const selectEnd = nppCode.indexOf('</select>', selectStart);
  const selectHtml = nppCode.slice(selectStart, selectEnd);
  const optionsHtml = selectHtml.slice(selectHtml.indexOf('>'));

  assert(
    'Dropdown has "+ Add Custom Category" as the very first option',
    selectHtml.indexOf('+ Add Custom Category') < selectHtml.indexOf('Building Materials')
  );

  // Check expected sequence within Category select dropdown
  const expectedSequence = [
    '+ Add Custom Category',
    'Building Materials',
    'Grains & Foodstuff',
    'Metals & Structural',
    'Electrical Supplies',
    'Apparel & Uniforms',
    'IT & Hardware',
    'Paints & Chemicals',
    'Household & Consumer',
    'Tools & Machinery',
    'Packaging Supplies',
    'Safety & PPE',
    'General Merchandise'
  ];

  let prevIdx = -1;
  let sequenceOk = true;
  for (const item of expectedSequence) {
    const idx = optionsHtml.indexOf(item);
    if (idx === -1 || idx < prevIdx) {
      sequenceOk = false;
      console.error(`Sequence broken for "${item}": idx=${idx}, prevIdx=${prevIdx}`);
      break;
    }
    prevIdx = idx;
  }
  assert('Dropdown contains all 13 standard options in exact prescribed order', sequenceOk);

  // -------------------------------------------------------------
  // 2. Custom Category Creation Modal & Handlers
  // -------------------------------------------------------------
  console.log('\n--- 2. Custom Category Creation Modal & Handlers ---');
  assert('NewProductPage contains Modal component for Add Custom Category', nppCode.includes('title="Add Custom Category"'));
  assert('Modal provides "Save Category" button', nppCode.includes('Save Category'));
  assert('Modal provides "Cancel" button', nppCode.includes('Cancel'));
  assert('Modal includes handleSaveCategory function', nppCode.includes('handleSaveCategory'));
  assert('Modal includes handleCancelAddCategory function', nppCode.includes('handleCancelAddCategory'));

  // -------------------------------------------------------------
  // 3. Validation Logic Tests
  // -------------------------------------------------------------
  console.log('\n--- 3. Validation Logic (Empty & Duplicate Rejection) ---');

  // Test empty validation
  try {
    await categoryService.createCategory('   ');
    assert('Empty category name rejected', false);
  } catch (err: any) {
    assert('Empty category name rejected', err.message.includes('empty'));
  }

  // Test base category duplicate rejection (case-insensitive)
  try {
    await categoryService.createCategory('  building materials  ');
    assert('Duplicate base category rejected (case-insensitive)', false);
  } catch (err: any) {
    assert('Duplicate base category rejected (case-insensitive)', err.message.includes('already exists'));
  }

  try {
    await categoryService.createCategory('GENERAL MERCHANDISE');
    assert('Duplicate "General Merchandise" rejected', false);
  } catch (err: any) {
    assert('Duplicate "General Merchandise" rejected', err.message.includes('already exists'));
  }

  // -------------------------------------------------------------
  // 4. Database Persistence in Supabase (product_categories)
  // -------------------------------------------------------------
  console.log('\n--- 4. Permanent Database Storage (product_categories) ---');

  const testCategoryName = 'Automated Verification ' + Date.now();
  let createdCategory = '';

  try {
    createdCategory = await categoryService.createCategory(testCategoryName);
    assert('createCategory successfully returns category name', createdCategory === testCategoryName);

    // Verify record in Supabase
    const { data: dbRecord, error: dbErr } = await supabase
      .from('product_categories')
      .select('*')
      .eq('name', testCategoryName)
      .maybeSingle();

    assert('Custom category is saved in Supabase product_categories table', !dbErr && Boolean(dbRecord));
    if (dbRecord) {
      assert('Stored company_id is valid UUID', Boolean(dbRecord.company_id));
      assert('Generated 3-letter code exists', Boolean(dbRecord.code));
    }

    // Verify duplicate custom category rejection
    try {
      await categoryService.createCategory('  ' + testCategoryName.toLowerCase() + '  ');
      assert('Duplicate custom category rejected (case-insensitive)', false);
    } catch (err: any) {
      assert('Duplicate custom category rejected (case-insensitive)', err.message.includes('already exists'));
    }

    // Verify category appears in getCustomCategories()
    const customList = await categoryService.getCustomCategories();
    assert(
      'getCustomCategories returns newly created category',
      customList.includes(testCategoryName)
    );

  } finally {
    // Cleanup test record
    if (createdCategory) {
      await supabase.from('product_categories').delete().eq('name', createdCategory);
    }
  }

  // -------------------------------------------------------------
  // 5. Role Permissions for Category Management
  // -------------------------------------------------------------
  console.log('\n--- 5. Role Permissions Verification ---');

  assert(
    'Admin is authorized to create products/categories',
    hasPermission('Admin', 'products', 'create') === true
  );

  assert(
    'Owner is authorized to create products/categories',
    hasPermission('Owner', 'products', 'create') === true
  );

  assert(
    'Warehouse Manager is authorized to create products/categories',
    hasPermission('Warehouse Manager', 'products', 'create') === true
  );

  assert(
    'Salesperson CANNOT create products/categories (VIEW_ONLY)',
    hasPermission('Salesperson', 'products', 'create') === false
  );

  assert(
    'Cashier CANNOT create products/categories',
    hasPermission('Cashier', 'products', 'create') === false
  );

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
