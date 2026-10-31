# Module 6: Unified Purchases & Inward Goods Management

## 1. Overview
Module 6 unifies all inward procurement, purchase orders, goods receipt notes (GRN), supplier bills, debit notes (returns), and outward payments into a single seamless screen organized by horizontal in-page tabs (**Part C**) and guided by the universal 5-step transaction flow (**Part B1**).

## 2. In-Page Tab Architecture
Organized inside [`PurchaseInvoicesPage.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/pages/purchases/PurchaseInvoicesPage.tsx):

1. **`Orders (PO)`** ([`PurchaseOrdersTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/purchases/PurchaseOrdersTab.tsx)):
   - Lists purchase orders with live supplier search and PO status.
   - One-click "Receive Goods" transitions directly into GRN intake.
   - Primary button "+ New Purchase Order" opens the 5-step document creator.

2. **`Goods Received (GRN)`** ([`PurchaseGoodsReceivedTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/purchases/PurchaseGoodsReceivedTab.tsx)):
   - Complete inward receiving station with FEFO batch number generation and expiry tracking.
   - Automatically restocks inventory across designated warehouses upon confirmation.

3. **`Bills`** ([`PurchaseInvoicesPage.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/pages/purchases/PurchaseInvoicesPage.tsx)):
   - Supplier tax bills with receiving status badges (`Fully Received`, `Partially Received`, `Pending Delivery`, `Direct Receipt`).
   - Detailed modal with original invoice breakdown, tax calculations, and payment history.
   - Direct bill creation via the universal document modal.

4. **`Returns`** ([`PurchaseReturnsTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/purchases/PurchaseReturnsTab.tsx)):
   - Vendor debit notes for damaged material, quality rejections, or rate disputes.
   - Reverses stock balance and reduces supplier payables.
   - Excel and CSV data export capabilities.

5. **`Payments made`** ([`PurchasePaymentsMadeTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/purchases/PurchasePaymentsMadeTab.tsx)):
   - Outward payment disbursement vouchers for Bank Transfer, UPI, Cheque, Cash, and Card.
   - Outstanding payables counter across all vendors.
   - Fast voucher entry with balance-due validation.

## 3. The Universal Purchase Document Creator (`PurchaseDocumentModal.tsx`)
Adheres strictly to the 5-step transactional flow: `SELECT → ENTER → REVIEW → CONFIRM → DONE`
- Supports creating Purchase Orders and Standard Purchase Bills.
- **Select**: Vendor/Supplier picker with GSTIN auto-fill and receiving warehouse selection.
- **Enter**: Line items with universal unit selector (`PCS`, `BOX`, `KG`, etc.), purchase rates, and tax.
- **Review**: Financial summary displaying subtotal, freight, GST totals, and payable balance.
- **Confirm**: Exactly ONE primary filled button: `Save Document`.
- **Done**: Quick next actions (`Print Document`, `Create Another`, `View Bills`).

