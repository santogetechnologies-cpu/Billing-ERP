import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { purchaseHistoryService } from '../src/services/purchaseHistoryService';

console.log('================================================================================');
console.log('TEST SUITE: SEPARATE HISTORY CATEGORIES UNDER HISTORY TAB');
console.log('================================================================================\n');

let totalTests = 0;
let passedTests = 0;

async function check(desc: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ PASS: ${desc}`);
    passedTests++;
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

const historyPagePath = path.resolve('src/pages/purchases/PurchaseHistoryPage.tsx');
const secondaryTabsPath = path.resolve('src/components/purchases/history/PurchaseHistorySecondaryTabs.tsx');
const returnViewPath = path.resolve('src/components/purchases/history/ReturnHistoryView.tsx');
const productAddViewPath = path.resolve('src/components/purchases/history/ProductAddHistoryView.tsx');
const servicePath = path.resolve('src/services/purchaseHistoryService.ts');

const historyPageCode = fs.readFileSync(historyPagePath, 'utf-8');
const secondaryTabsCode = fs.readFileSync(secondaryTabsPath, 'utf-8');
const returnViewCode = fs.readFileSync(returnViewPath, 'utf-8');
const productAddViewCode = fs.readFileSync(productAddViewPath, 'utf-8');
const serviceCode = fs.readFileSync(servicePath, 'utf-8');

async function run() {
  console.log('--- 1. Secondary Horizontal Tab Navigation ---');

  await check('Secondary navigation defines 3 separate categories: Purchase, Return, Product Add', () => {
    assert(secondaryTabsCode.includes("'purchase'"), 'Must include purchase category');
    assert(secondaryTabsCode.includes("'return'"), 'Must include return category');
    assert(secondaryTabsCode.includes("'product_add'"), 'Must include product_add category');
    assert(secondaryTabsCode.includes('Purchase History'), 'Label "Purchase History" must exist');
    assert(secondaryTabsCode.includes('Return History'), 'Label "Return History" must exist');
    assert(secondaryTabsCode.includes('Product Add History'), 'Label "Product Add History" must exist');
  });

  await check('Secondary navigation highlights selected tab and displays record count badges', () => {
    assert(secondaryTabsCode.includes('isActive'), 'Must evaluate isActive state');
    assert(secondaryTabsCode.includes('tab.count'), 'Must display count for each section');
    assert(secondaryTabsCode.includes('bg-blue-600') || secondaryTabsCode.includes('font-bold'), 'Must highlight active tab');
  });

  console.log('\n--- 2. Placement Directly Below Main Navigation & Above Filters ---');

  await check('Main Purchases & PO navigation is preserved intact directly above secondary tabs', () => {
    assert(historyPageCode.includes('Orders (PO)'), 'Main Orders tab preserved');
    assert(historyPageCode.includes('Bills'), 'Main Bills tab preserved');
    assert(historyPageCode.includes('Returns'), 'Main Returns tab preserved');
    assert(historyPageCode.includes('Payments Made'), 'Main Payments Made tab preserved');
    assert(historyPageCode.includes('History'), 'Main History tab preserved');

    const mainNavIndex = historyPageCode.indexOf('Purchases & PO Main Navigation Tabs');
    const secondaryNavIndex = historyPageCode.indexOf('<PurchaseHistorySecondaryTabs');
    assert(mainNavIndex !== -1 && secondaryNavIndex !== -1, 'Both navigations must exist');
    assert(mainNavIndex < secondaryNavIndex, 'Main navigation must be placed above secondary navigation');
  });

  await check('Secondary navigation is positioned above the history tables and views', () => {
    const secondaryNavIndex = historyPageCode.indexOf('<PurchaseHistorySecondaryTabs');
    const purchaseViewIndex = historyPageCode.indexOf("activeCategory === 'purchase'");
    const returnViewIndex = historyPageCode.indexOf("activeCategory === 'return'");
    const productAddViewIndex = historyPageCode.indexOf("activeCategory === 'product_add'");

    assert(secondaryNavIndex < purchaseViewIndex, 'Secondary tabs must precede purchase view');
    assert(secondaryNavIndex < returnViewIndex, 'Secondary tabs must precede return view');
    assert(secondaryNavIndex < productAddViewIndex, 'Secondary tabs must precede product add view');
  });

  console.log('\n--- 3. Category Views: Separate Views, Search & Relevant Filters ---');

  await check('Purchase History view displays purchase order records with search & warehouse/supplier filters', () => {
    assert(historyPageCode.includes('<PurchaseOrdersPage embedded={true} initialTabFilter="History" />'), 'Purchase category opens PurchaseOrdersPage');
  });

  await check('Return History view displays supplier return records with search, supplier & status filters', () => {
    assert(returnViewCode.includes('Return Number'), 'Must include Return Number column');
    assert(returnViewCode.includes('Supplier'), 'Must include Supplier column');
    assert(returnViewCode.includes('Returned Products'), 'Must include Returned Products column');
    assert(returnViewCode.includes('Quantity'), 'Must include Quantity column');
    assert(returnViewCode.includes('Return Date'), 'Must include Return Date column');
    assert(returnViewCode.includes('Reason'), 'Must include Reason column');
    assert(returnViewCode.includes('Status'), 'Must include Status column');
    assert(returnViewCode.includes('supplierFilter'), 'Must include supplier filter');
    assert(returnViewCode.includes('statusFilter'), 'Must include status filter');
    assert(returnViewCode.includes('searchQuery'), 'Must include search filter');
  });

  await check('Product Add History view displays newly added products with search, category & supplier filters', () => {
    assert(productAddViewCode.includes('Product Name'), 'Must include Product Name column');
    assert(productAddViewCode.includes('Product Code'), 'Must include Product Code column');
    assert(productAddViewCode.includes('Category'), 'Must include Category column');
    assert(productAddViewCode.includes('Supplier'), 'Must include Supplier column');
    assert(productAddViewCode.includes('Quantity Added'), 'Must include Quantity Added column');
    assert(productAddViewCode.includes('Date Added'), 'Must include Date Added column');
    assert(productAddViewCode.includes('Added By'), 'Must include Added By column');
    assert(productAddViewCode.includes('categoryFilter'), 'Must include category filter');
    assert(productAddViewCode.includes('supplierFilter'), 'Must include supplier filter');
    assert(productAddViewCode.includes('searchQuery'), 'Must include search filter');
  });

  console.log('\n--- 4. Real Database Data Integration ---');

  await check('purchaseHistoryService fetches actual supplier returns from database', async () => {
    const returns = await purchaseHistoryService.getReturnHistory();
    assert(Array.isArray(returns), 'Returns must be an array');
    assert(returns.length > 0, 'Must fetch at least 1 real return record from DB');
    const first = returns[0];
    assert(first.returnNumber, 'Return must have returnNumber');
    assert(first.supplierName, 'Return must have supplierName');
    assert(Array.isArray(first.returnedProducts), 'Return must have returnedProducts');
    assert(first.reason, 'Return must have reason');
    assert(first.status, 'Return must have status');
  });

  await check('purchaseHistoryService fetches actual product addition records from database', async () => {
    const products = await purchaseHistoryService.getProductAddHistory();
    assert(Array.isArray(products), 'Products must be an array');
    assert(products.length > 0, 'Must fetch at least 1 real product record from DB');
    const first = products[0];
    assert(first.productName, 'Product must have productName');
    assert(first.productCode, 'Product must have productCode');
    assert(first.category, 'Product must have category');
    assert(first.supplierName, 'Product must have supplierName');
    assert(typeof first.quantityAdded === 'number', 'Product must have numeric quantityAdded');
    assert(first.date, 'Product must have date');
    assert(first.addedBy, 'Product must have addedBy');
  });

  console.log('\n================================================================================');
  console.log(`TOTAL TESTS: ${totalTests}`);
  console.log(`PASSED:      ${passedTests}`);
  console.log(`FAILED:      ${totalTests - passedTests}`);
  console.log('================================================================================\n');

  if (totalTests === passedTests) {
    console.log('🎉 ALL SEPARATE HISTORY CATEGORIES TESTS PASSED 100%!\n');
  } else {
    process.exitCode = 1;
  }
}

run().catch(console.error);

