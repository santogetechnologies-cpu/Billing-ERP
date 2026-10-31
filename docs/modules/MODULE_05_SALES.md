# Module 5: Unified Sales Management

## 1. Overview
Module 5 refactors the Sales module into a single high-efficiency screen organized by in-page horizontal tabs (**Part C**) and driven by the universal 5-step transactional flow (**Part B1**).

## 2. In-Page Tab Architecture
Organized inside [`SalesInvoicesPage.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/pages/sales/SalesInvoicesPage.tsx):
1. **`Invoices`**: All confirmed tax invoices with live search, payment status badges (`Paid`, `Unpaid`, `Partially Paid`), payment method indicators, and direct print preview.
2. **`Quotations`** ([`SalesQuotationsTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/sales/SalesQuotationsTab.tsx)): Proforma price quotes with customer details, quote expiration, and one-click "Convert to Invoice" workflow.
3. **`Orders`** ([`SalesOrdersTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/sales/SalesOrdersTab.tsx)): Sales orders with warehouse allocation and one-click "Fulfill & Generate Invoice" action.
4. **`Returns`** ([`SalesReturnsTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/sales/SalesReturnsTab.tsx)): Customer sales returns and credit notes with line-item return quantity inputs, inventory restock reversal, and manager authorization PIN validation for returns exceeding role thresholds.
5. **`Payments Received`** ([`SalesPaymentsReceivedTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/sales/SalesPaymentsReceivedTab.tsx)): Receipts ledger tracking cash, UPI, card, and bank collections with live total sum.

## 3. The Universal Sales Document Creator (`SalesDocumentModal.tsx`)
Adheres to the universal 5-step flow: `SELECT → ENTER → REVIEW → CONFIRM → DONE`
- Supports creating Invoices, Quotations, and Sales Orders with a unified interface.
- **Select**: Customer and dispatch warehouse.
- **Enter**: Search/scan catalogue products, line quantities, rates, and tax rates.
- **Review**: Real-time subtotal, taxes (GST), and grand total.
- **Confirm**: Exactly **ONE** primary filled button: `Save Document`.
- **Done**: Next actions offered (`Print Document`, `Create Another`, `Done`).

