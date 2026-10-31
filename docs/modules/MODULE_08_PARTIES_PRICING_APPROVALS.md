# Module 8: Commercial Parties, Pricing Architecture & Approvals

## 1. Overview
Module 8 refactors all customer and supplier directories (**Parties**) and multi-tier pricing, commission quotas, and exception workflows (**Pricing & Commission**) into clean, unified screens driven by horizontal in-page tabs (**Part C**).

## 2. In-Page Tab Architecture

### Parties ([`CustomersPage.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/pages/customers/CustomersPage.tsx))
Accessible via `/parties` and `/customers`:
1. **`Customers`** ([`PartyCustomersTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/parties/PartyCustomersTab.tsx)): Retail and wholesale direct customer directory, credit limits, outstanding receivables, and CSV/Excel export.
2. **`Suppliers`** ([`PartySuppliersTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/parties/PartySuppliersTab.tsx)): Vendor master list, GSTIN tracking, payment terms, and payable balances.
3. **`Shops / Dealers`** ([`PartyDealersTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/parties/PartyDealersTab.tsx)): Authorized B2B distributor and franchisee accounts with special credit terms and dealer price lists.
4. **Fast Party Creator** ([`PartyModal.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/parties/PartyModal.tsx)): 2-tap creation modal with progressive disclosure for credit limits, payment terms, and assigned salespersons.

### Pricing & Commission ([`PricingRulesPage.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/pages/products/PricingRulesPage.tsx))
Accessible via `/pricing`:
1. **`Price Lists`** ([`PricingPriceListsTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/pricing/PricingPriceListsTab.tsx)): Multi-tier commercial price matrix (Retail, Wholesale, Dealer, MRP, and Minimum Floor Selling Price).
2. **`Salesperson Price Rules`** ([`PricingSalespersonRulesTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/pricing/PricingSalespersonRulesTab.tsx)): Margin guard policies configuring max discount percentages and return limits per salesperson.
3. **`Commission`** ([`PricingCommissionTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/pricing/PricingCommissionTab.tsx)): Automated commission slab tracking, accrued revenue, paid vs. payable balance ledger.
4. **`Targets`** ([`PricingTargetsTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/pricing/PricingTargetsTab.tsx)): Salesperson monthly quotas, pacing indicators, and visual achievement progress bars.
5. **`Approvals`** ([`PricingApprovalsTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/pricing/PricingApprovalsTab.tsx)): Exception authorization queue for manager approvals on discounts > limits, sub-floor pricing, invoice cancellations, and high-value returns.

