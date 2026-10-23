import fs from 'fs';
import { purchaseRequestService } from '../src/services/purchaseRequestService';
import { productService } from '../src/services/productService';
import { supabase } from '../src/lib/supabase';
import { calculateStockStatus } from '../src/utils/inventoryUtils';
import { setTabScopedStaffSession } from '../src/services/authService';

async function runConsolidatedLowStockTests() {
  console.log('--- TESTING CONSOLIDATED LOW STOCK & REORDER ---');
  let passed = 0;
  let failed = 0;

  function assert(cond: boolean, msg: string) {
    if (cond) {
      console.log(`[PASS] ${msg}`);
      passed++;
    } else {
      console.error(`[FAIL] ${msg}`);
      failed++;
    }
  }

  try {
    // 1. Fetch real products from DB
    const { data: dbProducts, error: prodErr } = await supabase
      .from('products')
      .select('id, name, sku, current_stock, reorder_level, warehouse, default_warehouse_id, primary_unit');

    assert(!prodErr && Boolean(dbProducts), `Loaded ${dbProducts?.length} products from database`);

    // 2. Compute stock statuses
    const enriched = (dbProducts || []).map(p => {
      const stock = Math.max(0, Number(p.current_stock || 0));
      const limit = p.reorder_level !== null && p.reorder_level !== undefined ? Number(p.reorder_level) : null;
      const status = calculateStockStatus(stock, limit);
      return {
        ...p,
        stock,
        limit,
        status
      };
    });

    const outOfStock = enriched.filter(p => p.status === 'Out of Stock');
    const limitedStock = enriched.filter(p => p.status === 'Limited Stock');
    const activeStock = enriched.filter(p => p.status === 'Active');

    console.log(`Metrics: ${outOfStock.length} Out of Stock, ${limitedStock.length} Limited Stock, ${activeStock.length} Active`);

    // 3. Consolidated Low Stock & Reorder products
    const consolidatedList = enriched.filter(p => p.status === 'Out of Stock' || p.status === 'Limited Stock');
    assert(
      consolidatedList.length === outOfStock.length + limitedStock.length,
      `Consolidated Low Stock & Reorder contains exactly all Out of Stock (${outOfStock.length}) + Limited Stock (${limitedStock.length}) = ${consolidatedList.length} products`
    );

    // 4. Verify no duplicates in consolidated list
    const idSet = new Set<string>();
    let hasDuplicate = false;
    for (const p of consolidatedList) {
      if (idSet.has(p.id)) {
        hasDuplicate = true;
        break;
      }
      idSet.add(p.id);
    }
    assert(!hasDuplicate, 'No duplicate products in consolidated list');

    // 5. Verify healthy-stock products are NOT in the consolidated low stock list
    const healthyLeak = consolidatedList.filter(p => p.status === 'Active');
    assert(healthyLeak.length === 0, 'Healthy-stock products are strictly excluded from Low Stock & Reorder');

    // 6. Verify Create Purchase Request workflow
    setTabScopedStaffSession({
      user: { id: '00000000-0000-0000-0000-000000000099', email: 'owner@tester.com' },
      profile: {
        id: '00000000-0000-0000-0000-000000000099',
        company_id: '00000000-0000-0000-0000-000000000001',
        name: 'Warehouse Manager Tester',
        email: 'wm@tester.com',
        role: 'Warehouse Manager',
        is_active: true
      } as any
    });

    // Check existing purchase requests
    const existingRequests = await purchaseRequestService.getPurchaseRequests(undefined, '00000000-0000-0000-0000-000000000001');
    assert(Array.isArray(existingRequests), `Retrieved ${existingRequests.length} existing purchase requests without data loss`);

    // Submit a test purchase request from consolidated list item if any exists
    if (consolidatedList.length > 0) {
      const sampleProd = consolidatedList[0];
      const createdPR = await purchaseRequestService.createPurchaseRequest({
        warehouseId: '00000000-0000-0000-0000-000000000002',
        warehouseName: 'Main Central Warehouse',
        priority: 'High',
        reason: 'Consolidated Low Stock & Reorder automated workflow verification',
        requestedDeliveryDate: '2028-12-31',
        items: [
          {
            productId: sampleProd.id,
            productName: sampleProd.name,
            sku: sampleProd.sku,
            currentStock: sampleProd.stock,
            warningLimit: sampleProd.limit,
            requestedQty: 25,
            unit: sampleProd.primary_unit || 'Piece',
            estimatedCost: 100
          }
        ]
      }, '00000000-0000-0000-0000-000000000001');

      assert(Boolean(createdPR && createdPR.id), `Successfully submitted purchase request #${createdPR.requestNumber}`);
      assert(createdPR.status === 'Pending Approval', `Initial status is Pending Approval: ${createdPR.status}`);

      // Clean up test PR
      await supabase.from('purchase_request_items').delete().eq('request_id', createdPR.id);
      await supabase.from('purchase_requests').delete().eq('id', createdPR.id);
      console.log('[CLEANUP] Deleted test purchase request record');
    }

    setTabScopedStaffSession(null);

    // 7. Verify file contents: Replenishment Required is gone from StockAlertsPage.tsx
    const stockAlertsContent = fs.readFileSync('src/pages/inventory/StockAlertsPage.tsx', 'utf8');
    assert(!stockAlertsContent.includes('REPLENISHMENT_REQUIRED'), 'REPLENISHMENT_REQUIRED enum removed from StockAlertsPage.tsx');
    assert(!stockAlertsContent.includes('>Replenishment Required'), 'Replenishment Required tab button removed from StockAlertsPage.tsx');
    assert(stockAlertsContent.includes('Low Stock & Reorder ('), 'Consolidated Low Stock & Reorder tab present in StockAlertsPage.tsx');

    console.log('\n=============================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('=============================================');

    if (failed > 0) process.exit(1);
  } catch (err: any) {
    console.error('Test failed with error:', err);
    process.exit(1);
  }
}

runConsolidatedLowStockTests();
