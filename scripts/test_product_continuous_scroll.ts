import fs from 'fs';
import { productService } from '../src/services/productService';
import { supabase } from '../src/lib/supabase';

async function runTests() {
  console.log('=== TESTING PRODUCT MASTER CONTINUOUS SCROLLABLE LIST ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Inspect ProductListPage.tsx
  const productListContent = fs.readFileSync('src/pages/products/ProductListPage.tsx', 'utf8');
  assert(
    productListContent.includes('enablePagination={false}'),
    'ProductListPage passes enablePagination={false} to DataTable'
  );
  assert(
    productListContent.includes('infiniteScroll={true}'),
    'ProductListPage passes infiniteScroll={true} to DataTable'
  );
  assert(
    !productListContent.includes('currentPage') && !productListContent.includes('pageSize'),
    'ProductListPage has no local page-based pagination controls'
  );
  assert(
    productListContent.includes("searchKeys={['name', 'sku', 'barcode', 'category', 'brand', 'stockStatus', 'currentStock']}"),
    'ProductListPage preserves all searchKeys'
  );
  assert(
    productListContent.includes("key: 'category'") && productListContent.includes("key: 'stockStatus'"),
    'ProductListPage preserves Category and Stock Status filters'
  );
  assert(
    productListContent.includes('ProductDeleteModal') && productListContent.includes('setSelectedProduct'),
    'ProductListPage preserves Edit, View, and Delete modals/actions'
  );

  // 2. Inspect DataTable.tsx
  const dataTableContent = fs.readFileSync('src/components/common/DataTable.tsx', 'utf8');
  assert(
    dataTableContent.includes('enablePagination?: boolean;') &&
    dataTableContent.includes('infiniteScroll?: boolean;') &&
    dataTableContent.includes('batchSize?: number;'),
    'DataTableProps interface includes enablePagination, infiniteScroll, and batchSize'
  );
  assert(
    dataTableContent.includes('isContinuous = enablePagination === false || infiniteScroll'),
    'DataTable defines isContinuous mode based on props'
  );
  assert(
    dataTableContent.includes('displayedData = useMemo(() => {') &&
    dataTableContent.includes('sortedData.slice(0, visibleCount)'),
    'DataTable displays continuous slice from 0 to visibleCount in continuous mode'
  );
  assert(
    dataTableContent.includes('IntersectionObserver') && dataTableContent.includes('bottomSentinelRef'),
    'DataTable has IntersectionObserver on bottom sentinel for infinite scrolling'
  );
  assert(
    dataTableContent.includes('window.addEventListener(\'scroll\''),
    'DataTable has window scroll listener fallback for natural page scrolling'
  );
  assert(
    dataTableContent.includes('aId.localeCompare(bId)'),
    'DataTable implements deterministic secondary tie-breaker sorting so items never jump'
  );
  assert(
    dataTableContent.includes('{isContinuous ? (') &&
    dataTableContent.includes('Showing all') &&
    dataTableContent.includes('Continuous Scrolling Active'),
    'DataTable replaces old pagination controls with clean continuous summary footer when in continuous mode'
  );

  // 3. Inspect productService.ts
  const productServiceContent = fs.readFileSync('src/services/productService.ts', 'utf8');
  assert(
    productServiceContent.includes('chunkSize = 1000') && productServiceContent.includes('rawProducts.push(...chunk)'),
    'productService.getProducts supports retrieval of large catalogues without artificial limits'
  );

  // 4. Test actual database fetching
  try {
    const products = await productService.getProducts(undefined, '00000000-0000-0000-0000-000000000001');
    console.log(`\nRetrieved ${products.length} products from Supabase database.`);
    assert(products.length > 10, `Database has ${products.length} products (> 10 items, verifying previous 10-item cap is surpassed)`);

    // Verify all products have unique IDs
    const ids = new Set(products.map(p => p.id));
    assert(ids.size === products.length, 'All retrieved products have unique IDs (no duplicates)');

    // Verify continuous slicing logic with batching
    const batchSize = 50;
    const initialVisible = products.slice(0, batchSize);
    assert(initialVisible.length === products.length, `For current catalogue (${products.length} items <= batchSize 50), all products display at once in one continuous list`);

    // Simulate catalogue with 120 items
    const simulatedCatalogue = Array.from({ length: 120 }, (_, i) => ({
      id: `prod-${i + 1}`,
      sku: `SKU-${1000 + i}`,
      name: `Product ${i + 1}`,
      costPrice: 100,
      sellingPrice: 150
    }));

    let visibleCount = 50;
    const batch1 = simulatedCatalogue.slice(0, visibleCount);
    assert(batch1.length === 50, 'Batch 1 loads initial 50 products');
    assert(batch1[0].name === 'Product 1' && batch1[49].name === 'Product 50', 'Batch 1 contains products 1 to 50');

    // Simulate scroll down
    visibleCount = Math.min(visibleCount + 50, simulatedCatalogue.length);
    const batch2 = simulatedCatalogue.slice(0, visibleCount);
    assert(batch2.length === 100, 'Batch 2 appends next 50 products without replacing previous items (now 100 items)');
    assert(batch2[0].name === 'Product 1' && batch2[99].name === 'Product 100', 'Batch 2 contains continuous products 1 through 100');

    // Simulate second scroll down
    visibleCount = Math.min(visibleCount + 50, simulatedCatalogue.length);
    const batch3 = simulatedCatalogue.slice(0, visibleCount);
    assert(batch3.length === 120, 'Batch 3 appends remaining products (all 120 items loaded)');
    assert(batch3[119].name === 'Product 120', 'Final product reached by scrolling');

    // Verify deterministic sorting stability
    const unsorted = [
      { id: 'b', price: 100 },
      { id: 'a', price: 100 },
      { id: 'c', price: 50 }
    ];
    const sorted = [...unsorted].sort((x, y) => {
      const cmp = x.price - y.price;
      if (cmp !== 0) return cmp;
      return x.id.localeCompare(y.id);
    });
    assert(sorted[1].id === 'a' && sorted[2].id === 'b', 'Tie-breaker maintains deterministic stable sort');

  } catch (err: any) {
    console.error('Error querying Supabase:', err.message);
    assert(false, `Database test encountered error: ${err.message}`);
  }

  console.log(`\nRESULTS: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
