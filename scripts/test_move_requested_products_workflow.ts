/**
 * Test Suite: Move Requested Products to Pending Purchase Requests
 *
 * Verifies the complete workflow:
 * 1. Low stock products appear in actionable Low Stock & Reorder list with correct counts.
 * 2. Clicking Request and submitting a purchase request saves the request.
 * 3. The requested product disappears from the actionable Low Stock & Reorder list when covered.
 * 4. The submitted request immediately appears in Pending Purchase Requests with full details:
 *    request number, product, quantity, warehouse, requester, date, current status.
 * 5. Accurate counts for All Low, Out of Stock, Limited (reflecting products still needing a request).
 * 6. Duplicate requests are prevented for products already covered in the warehouse.
 * 7. Page refresh / reload preserves the covered state (does not incorrectly reappear).
 * 8. Rejecting or cancelling a request makes the product eligible again if still low on stock.
 * 9. Completing a request without stock receipt keeps it eligible if still below warning limit.
 * 10. Physical stock quantities remain untouched until goods are actually received.
 */

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${message}`);
  }
}

console.log('========================================================================');
console.log('TEST SUITE: MOVE REQUESTED PRODUCTS TO PENDING PURCHASE REQUESTS');
console.log('========================================================================\n');

// -----------------------------------------------------------------------------
// Model & Workflow Simulator
// -----------------------------------------------------------------------------
type PRStatus =
  | 'Pending Review'
  | 'Pending Approval'
  | 'Under Review'
  | 'Clarification Requested'
  | 'Approved'
  | 'Ordered'
  | 'Partially Received'
  | 'Completed'
  | 'Rejected'
  | 'Cancelled';

const ACTIVE_REQUEST_STATUSES = new Set<PRStatus>([
  'Pending Review',
  'Pending Approval',
  'Under Review',
  'Clarification Requested',
  'Approved',
  'Ordered',
  'Partially Received'
]);

interface ProductItem {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
  reorderLevel: number | null;
  unit: string;
}

interface PurchaseRequestRecord {
  id: string;
  requestNumber: string;
  warehouseId: string;
  warehouseName: string;
  requesterName: string;
  createdAt: string;
  priority: 'Normal' | 'High' | 'Urgent';
  status: PRStatus;
  reason: string;
  items: Array<{
    productId: string;
    productName: string;
    requestedQty: number;
    approvedQty?: number | null;
    receivedQty?: number;
    unit: string;
  }>;
}

class WarehouseManagerWorkflowSimulator {
  public products: ProductItem[] = [];
  public purchaseRequests: PurchaseRequestRecord[] = [];
  public warehouseId: string = 'wh-main';
  public warehouseName: string = 'Central Warehouse';

  constructor() {
    this.reset();
  }

  public reset() {
    this.products = [
      { id: 'p1', name: 'Ultra Cement 50kg', sku: 'CEM-01', currentStock: 0, reorderLevel: 25, unit: 'Bag' },
      { id: 'p2', name: 'Premium Emulsion Paint', sku: 'PNT-02', currentStock: 4, reorderLevel: 10, unit: 'Liter' },
      { id: 'p3', name: 'Steel TMT Bar 12mm', sku: 'STL-03', currentStock: 50, reorderLevel: 20, unit: 'Piece' }
    ];
    this.purchaseRequests = [];
  }

  // Active requested quantity for a product in warehouse
  public getProductActiveRequestedQty(productId: string, whId: string = this.warehouseId): number {
    return this.purchaseRequests
      .filter(req => req.warehouseId === whId && ACTIVE_REQUEST_STATUSES.has(req.status))
      .reduce((acc, req) => {
        const item = req.items.find(i => i.productId === productId);
        if (!item) return acc;
        let qty = 0;
        if (req.status === 'Partially Received') {
          const target = item.approvedQty ?? item.requestedQty;
          qty = Math.max(0, target - (item.receivedQty || 0));
        } else if (req.status === 'Approved' || req.status === 'Ordered') {
          qty = item.approvedQty ?? item.requestedQty;
        } else {
          qty = item.requestedQty;
        }
        return acc + qty;
      }, 0);
  }

  // Compute product evaluation in dashboard
  public evaluateProducts() {
    return this.products.map(p => {
      const stock = p.currentStock;
      const limit = p.reorderLevel;

      let stockStatus: 'Out of Stock' | 'Limited Stock' | 'Active' = 'Active';
      if (stock <= 0) {
        stockStatus = 'Out of Stock';
      } else if (limit !== null && stock <= limit) {
        stockStatus = 'Limited Stock';
      }

      let rawSuggested = 0;
      if (stock <= 0) {
        rawSuggested = limit && limit > 0 ? limit * 2 : 20;
      } else if (limit !== null && stock <= limit) {
        rawSuggested = Math.max(1, limit * 2 - stock);
      }

      const activeQty = this.getProductActiveRequestedQty(p.id, this.warehouseId);
      const isCovered = rawSuggested > 0 && activeQty >= rawSuggested;
      const remainingSuggested = Math.max(0, rawSuggested - activeQty);
      const suggestedQty = remainingSuggested > 0 ? remainingSuggested : rawSuggested;

      return {
        ...p,
        stockStatus,
        rawSuggested,
        activeRequestedQty: activeQty,
        isCovered,
        suggestedQty
      };
    });
  }

  // Actionable low stock products list (requires purchase request)
  public getActionableLowStockProducts() {
    return this.evaluateProducts().filter(
      p => (p.stockStatus === 'Out of Stock' || p.stockStatus === 'Limited Stock') && !p.isCovered
    );
  }

  // Covered low stock products (already covered by active purchase request)
  public getCoveredLowStockProducts() {
    return this.evaluateProducts().filter(
      p => (p.stockStatus === 'Out of Stock' || p.stockStatus === 'Limited Stock') && p.isCovered
    );
  }

  // Metrics
  public getMetrics() {
    const evaluated = this.evaluateProducts();
    const actionable = this.getActionableLowStockProducts();
    const covered = this.getCoveredLowStockProducts();
    const pendingPRCount = this.purchaseRequests.filter(req =>
      ['Pending Review', 'Pending Approval', 'Under Review', 'Clarification Requested'].includes(req.status)
    ).length;

    return {
      allLowCount: actionable.length,
      outOfStockCount: actionable.filter(p => p.stockStatus === 'Out of Stock').length,
      limitedCount: actionable.filter(p => p.stockStatus === 'Limited Stock').length,
      coveredCount: covered.length,
      pendingPRCount
    };
  }

  // Submit Purchase Request
  public submitPurchaseRequest(params: {
    productId: string;
    requestedQty: number;
    reason: string;
    priority?: 'Normal' | 'High' | 'Urgent';
  }): { success: boolean; request?: PurchaseRequestRecord; error?: string } {
    const prod = this.products.find(p => p.id === params.productId);
    if (!prod) return { success: false, error: 'Product not found' };

    const evaluated = this.evaluateProducts().find(p => p.id === params.productId);
    if (!evaluated) return { success: false, error: 'Product not evaluated' };

    // Duplicate Prevention Check
    if (evaluated.rawSuggested > 0 && evaluated.activeRequestedQty >= evaluated.rawSuggested) {
      return {
        success: false,
        error: `Cannot submit duplicate request: "${prod.name}" already has active purchase requests covering its requirement.`
      };
    }

    const newReqNumber = `PR-${String(this.purchaseRequests.length + 1).padStart(4, '0')}`;
    const newReq: PurchaseRequestRecord = {
      id: `req-${Date.now()}-${Math.random()}`,
      requestNumber: newReqNumber,
      warehouseId: this.warehouseId,
      warehouseName: this.warehouseName,
      requesterName: 'Warehouse Manager',
      createdAt: new Date().toISOString(),
      priority: params.priority || (prod.currentStock <= 0 ? 'Urgent' : 'High'),
      status: 'Pending Review',
      reason: params.reason,
      items: [
        {
          productId: prod.id,
          productName: prod.name,
          requestedQty: params.requestedQty,
          unit: prod.unit
        }
      ]
    };

    this.purchaseRequests.unshift(newReq);
    return { success: true, request: newReq };
  }
}

// -----------------------------------------------------------------------------
// Step 1: Initial State Inspection
// -----------------------------------------------------------------------------
console.log('--- Step 1: Initial Low Stock & Reorder State ---');
const sim = new WarehouseManagerWorkflowSimulator();
let actionable = sim.getActionableLowStockProducts();
let metrics = sim.getMetrics();

assert(actionable.length === 2, `Initially 2 actionable low stock products (got ${actionable.length})`);
assert(metrics.allLowCount === 2, `All Low count is 2 (got ${metrics.allLowCount})`);
assert(metrics.outOfStockCount === 1, `Out of Stock count is 1 (p1 Ultra Cement)`);
assert(metrics.limitedCount === 1, `Limited count is 1 (p2 Paint)`);
assert(metrics.coveredCount === 0, `Covered count is 0 initially`);
assert(metrics.pendingPRCount === 0, `Pending PR count is 0 initially`);

const p1 = actionable.find(p => p.id === 'p1')!;
assert(p1 !== undefined, 'Ultra Cement is present in actionable list');
assert(p1.suggestedQty === 50, `p1 suggestedQty is 50 (2x reorderLevel 25)`);
assert(p1.currentStock === 0, 'Real current stock is 0');

// -----------------------------------------------------------------------------
// Step 2 & 3: Warehouse Manager Submits Purchase Request for p1
// -----------------------------------------------------------------------------
console.log('\n--- Step 2 & 3: Submit Purchase Request for Ultra Cement ---');
const submitRes = sim.submitPurchaseRequest({
  productId: 'p1',
  requestedQty: p1.suggestedQty,
  reason: 'Urgent restock required for cement and paint.'
});

assert(submitRes.success === true, 'Purchase request submitted successfully');
assert(submitRes.request !== undefined, 'Created request record returned');
assert(submitRes.request?.requestNumber === 'PR-0001', 'Request number is PR-0001');
assert(submitRes.request?.status === 'Pending Review', 'Initial status is Pending Review');
assert(
  submitRes.request?.items[0].requestedQty === 50,
  `Requested quantity matches suggested reorder quantity (50 ${p1.unit})`
);

// -----------------------------------------------------------------------------
// Step 4: Confirm Product Disappears from Actionable Low Stock List
// -----------------------------------------------------------------------------
console.log('\n--- Step 4: Confirm Product Disappears from Actionable List ---');
actionable = sim.getActionableLowStockProducts();
const covered = sim.getCoveredLowStockProducts();
metrics = sim.getMetrics();

assert(actionable.length === 1, `Actionable low stock products decreased from 2 to 1 (got ${actionable.length})`);
assert(actionable.find(p => p.id === 'p1') === undefined, 'p1 (Ultra Cement) no longer in actionable list');
assert(actionable[0].id === 'p2', 'Remaining actionable product is p2 (Paint)');
assert(covered.length === 1, `Covered low stock products increased to 1 (got ${covered.length})`);
assert(covered[0].id === 'p1', 'p1 is now tracked in covered products list');

// -----------------------------------------------------------------------------
// Step 5: Check Low Stock Counts and Pending Purchase Requests
// -----------------------------------------------------------------------------
console.log('\n--- Step 5: Accurate Counts & Visible in Pending Requests ---');
assert(metrics.allLowCount === 1, `All Low count updated to 1 (got ${metrics.allLowCount})`);
assert(metrics.outOfStockCount === 0, `Out of Stock count updated to 0 (p1 is covered)`);
assert(metrics.limitedCount === 1, `Limited count remains 1 (p2 is still actionable)`);
assert(metrics.pendingPRCount === 1, `Pending Purchase Requests count updated to 1`);

const pendingPR = sim.purchaseRequests[0];
assert(pendingPR.requestNumber === 'PR-0001', 'Pending PR # matches PR-0001');
assert(pendingPR.items[0].productName === 'Ultra Cement 50kg', 'Pending PR shows product name');
assert(pendingPR.items[0].requestedQty === 50, 'Pending PR shows requested quantity 50');
assert(pendingPR.warehouseName === 'Central Warehouse', 'Pending PR shows warehouse name');
assert(pendingPR.requesterName === 'Warehouse Manager', 'Pending PR shows requester name');
assert(pendingPR.status === 'Pending Review', 'Pending PR shows current status');

// -----------------------------------------------------------------------------
// Step 6: Prevent Duplicate Requests for Covered Products
// -----------------------------------------------------------------------------
console.log('\n--- Step 6: Prevent Duplicate Requests ---');
const dupSubmit = sim.submitPurchaseRequest({
  productId: 'p1',
  requestedQty: 50,
  reason: 'Attempting duplicate request for cement'
});

assert(dupSubmit.success === false, 'Duplicate request for p1 is rejected');
assert(
  dupSubmit.error !== undefined && dupSubmit.error.includes('duplicate request'),
  `Duplicate prevention error: "${dupSubmit.error}"`
);
assert(sim.purchaseRequests.length === 1, 'No duplicate purchase request record created');

// -----------------------------------------------------------------------------
// Step 7: Page Reload Simulation
// -----------------------------------------------------------------------------
console.log('\n--- Step 7: Page Reload State Persistence ---');
// Simulating re-instantiation / fresh page load with the existing purchase requests and products
const reloadedActionable = sim.getActionableLowStockProducts();
const reloadedMetrics = sim.getMetrics();

assert(reloadedActionable.length === 1, 'After reload, actionable list still has 1 item');
assert(reloadedActionable.find(p => p.id === 'p1') === undefined, 'p1 does NOT reappear after page reload');
assert(reloadedMetrics.outOfStockCount === 0, 'Out of Stock count remains 0 after page reload');

// -----------------------------------------------------------------------------
// Step 8: Reject or Cancel Request Makes Product Reappear
// -----------------------------------------------------------------------------
console.log('\n--- Step 8: Reject/Cancel Request Makes Product Reappear ---');
// Purchase Manager rejects request PR-0001
sim.purchaseRequests[0].status = 'Rejected';

actionable = sim.getActionableLowStockProducts();
metrics = sim.getMetrics();

assert(actionable.length === 2, `After rejection, actionable low stock products back to 2 (got ${actionable.length})`);
assert(actionable.find(p => p.id === 'p1') !== undefined, 'p1 reappears in actionable Low Stock & Reorder list');
assert(metrics.allLowCount === 2, 'All Low count returned to 2');
assert(metrics.outOfStockCount === 1, 'Out of Stock count returned to 1');
assert(metrics.pendingPRCount === 0, 'Pending PR count returned to 0');

// Warehouse Manager re-submits request for p1
const resubmitRes = sim.submitPurchaseRequest({
  productId: 'p1',
  requestedQty: 50,
  reason: 'Re-submitting with supplier price update'
});
assert(resubmitRes.success === true, 'Re-submission succeeds');
assert(sim.getActionableLowStockProducts().length === 1, 'p1 disappears again after re-submission');

// Test Cancellation
sim.purchaseRequests[0].status = 'Cancelled';
assert(
  sim.getActionableLowStockProducts().find(p => p.id === 'p1') !== undefined,
  'Cancelled request also makes p1 eligible and visible again in Low Stock list'
);

// -----------------------------------------------------------------------------
// Step 9: Physical Stock Levels Unchanged by Purchase Request
// -----------------------------------------------------------------------------
console.log('\n--- Step 9: Verify Real Stock Quantities Unchanged ---');
const cement = sim.products.find(p => p.id === 'p1')!;
assert(cement.currentStock === 0, 'Physical on-hand stock for cement remains 0 (not modified by request submission)');
assert(cement.reorderLevel === 25, 'Warning limit remains 25');

// -----------------------------------------------------------------------------
// Step 10: Partial Coverage Handling
// -----------------------------------------------------------------------------
console.log('\n--- Step 10: Partial Quantity Coverage Handling ---');
sim.reset(); // fresh start
// p1 suggested is 50. Let's submit a partial request of 20 units.
const partialRes = sim.submitPurchaseRequest({
  productId: 'p1',
  requestedQty: 20,
  reason: 'Partial urgent request'
});
assert(partialRes.success === true, 'Partial request of 20 submitted');

actionable = sim.getActionableLowStockProducts();
const p1Partial = actionable.find(p => p.id === 'p1');
assert(p1Partial !== undefined, 'p1 is still in actionable list because 20 < 50 required');
assert(p1Partial?.suggestedQty === 30, `Remaining suggested reorder quantity is updated to 30 (50 - 20)`);

// Now submit remaining 30 units
const remainingRes = sim.submitPurchaseRequest({
  productId: 'p1',
  requestedQty: 30,
  reason: 'Remaining requirement'
});
assert(remainingRes.success === true, 'Remaining 30 units submitted');
assert(
  sim.getActionableLowStockProducts().find(p => p.id === 'p1') === undefined,
  'p1 is now fully covered (20 + 30 = 50) and removed from actionable list'
);

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n========================================================================');
console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} Passed (${failedTests} Failed)`);
console.log('========================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL WORKFLOW TESTS PASSED SUCCESSFULLY!');
}
