# Module 7: Unified Stock & Inventory Management

## 1. Overview
Module 7 refactors the entire inventory and warehouse system into a single high-efficiency screen organized by horizontal in-page tabs (**Part C**) and driven by the universal 5-step transactional flow (**Part B1**).

## 2. In-Page Tab Architecture
Organized inside [`InventoryDashboardPage.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/pages/inventory/InventoryDashboardPage.tsx):

1. **`Current`** ([`StockCurrentTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/stock/StockCurrentTab.tsx)):
   - Warehouse-filtered inventory valuation with physical units counter, purchase cost valuation, and retail potential value.
   - Live status badges (`In Stock`, `Low Stock`, `Out of Stock`) and direct quick adjustments.
   - Excel and CSV data export.

2. **`Low`** ([`StockLowTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/stock/StockLowTab.tsx)):
   - Reorder priority matrix displaying critical shortages and zero-unit items.
   - Calculates deficit quantity and estimated replenishment cost.
   - 1-click "Order" action transitioning directly to Purchase Order generation.

3. **`Expiring`** ([`StockExpiringTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/stock/StockExpiringTab.tsx)):
   - FEFO (First Expired First Out) ledger with days-left countdown and expiration risk valuation.
   - Filterable by 30-day, 60-day, 90-day, and expired categories.

4. **`Movements`** ([`StockMovementsTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/stock/StockMovementsTab.tsx)):
   - Full inventory audit trail covering purchases, sales, transfers, adjustments, and customer returns.
   - Shows movement type, reference documents, and audit notes.

5. **`Transfers`** ([`StockTransfersTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/stock/StockTransfersTab.tsx)):
   - Inter-warehouse transfer dispatch and receiving workflow.
   - 1-click "Receive Goods" updates destination warehouse stock upon arrival.

6. **`Counts`** ([`StockCountsTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/stock/StockCountsTab.tsx)):
   - Physical inventory audit station comparing shelf counts with system stock.
   - Real-time variance computation with one-click automated reconciliation.

7. **`Adjustments`** ([`StockAdjustmentsTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/stock/StockAdjustmentsTab.tsx)):
   - Stock loss write-off, damage tracking, and physical correction history.
   - Summary statistics on inventory written off vs. positive additions.

## 3. The Universal Stock Adjustment Modal (`StockAdjustmentModal.tsx`)
Adheres to the strict 5-step flow: `SELECT → ENTER → REVIEW → CONFIRM → DONE`:
- **Select**: Pick warehouse and product with live stock preview.
- **Enter**: Adjustment direction (+ or -), quantity, and standardized reason code (damage, shrinkage, expiry, audit).
- **Review**: Real-time before-and-after balance preview.
- **Confirm**: ONE primary filled button: `Confirm & Save Adjustment`.
- **Done**: Feedback confirmation with option to adjust another item.

