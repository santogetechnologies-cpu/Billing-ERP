# Changelog — Universal Billing & ERP System

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased] - 2026-10-31

### Module 1: Shell & Navigation Redesign
#### Added
- Reusable [`Tabs.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/common/Tabs.tsx) component supporting pill/underline variants, badges, icons, and `?tab=` URL synchronization.
- Quick `+ New` button in header for instant creation of Bills, Products, Customers, and Purchase Orders.
- Clean route aliases in [`App.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/App.tsx): `/pos`, `/stock`, `/parties`, and `/accounts`.
- Dedicated module README: [`docs/modules/MODULE_01_NAVIGATION.md`](file:///c:/Users/Admin/Desktop/Billing-ERP/docs/modules/MODULE_01_NAVIGATION.md).

#### Changed
- Refactored [`Sidebar.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/layout/Sidebar.tsx) from 900+ lines of nested submenus into the universal 10-item list + pinned Settings:
  1. Dashboard
  2. Billing (POS)
  3. Sales
  4. Purchases
  5. Stock
  6. Products
  7. Parties
  8. Pricing & Commission
  9. Accounts
  10. Reports
  - Pinned: Settings
- Refactored [`Header.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/layout/Header.tsx) to provide page title, branch switcher, `Ctrl+K` search button, `+ New` dropdown, notification bell, and user presence menu.
- Refactored [`AppLayout.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/layout/AppLayout.tsx) to handle `Ctrl+K`, `Ctrl+Q`, and `F2` global shortcuts and persistent sidebar collapse state.
- Updated RBAC navigation matrix in [`rbac.ts`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/utils/rbac.ts) to strictly reflect the 10 universal menus.

#### Removed
- Nested collapsible submenu accordions in the sidebar.
- Redundant second sidebar and duplicate menu entries (`Warehouses` top-level duplicate).


### Module 2: Universal Unit System Engine
#### Added
- Universal 9-Unit System engine: [`src/utils/universalUnitSystem.ts`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/utils/universalUnitSystem.ts) with fixed units (`PCS`, `STRIP`, `TAB`, `BOX`, `SET`, `KG`, `LTR`, `MTR`, `SQF`).
- Automated test suite: [`scripts/test-units.cjs`](file:///c:/Users/Admin/Desktop/Billing-ERP/scripts/test-units.cjs) verifying 11 test cases across conversions, rounding, pharma cut-strip, natural input parsing, and barcode scale integration.
- Natural language quantity parser supporting direct entry like `250g` (0.250 KG), `500ml` (0.500 LTR), `10in` (0.254 MTR), `45cm` (0.450 MTR).
- Automated Cut-Strip pharma blister pack math (opens 1 STRIP into 10 TABs, tracks loose counter tablets).
- Weighing-scale barcode parser for weight-embedded and price-embedded labels.
- Module documentation: [`docs/modules/MODULE_02_UNIT_SYSTEM.md`](file:///c:/Users/Admin/Desktop/Billing-ERP/docs/modules/MODULE_02_UNIT_SYSTEM.md).

#### Changed
- Standardized [`src/data/unitsData.ts`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/data/unitsData.ts) around the 9 universal units, removing legacy unit proliferation.
- Integrated natural small-unit input parsing into [`src/components/pos/POSQuantitySelector.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/pos/POSQuantitySelector.tsx).
- Added `npm run test:units` script to [`package.json`](file:///c:/Users/Admin/Desktop/Billing-ERP/package.json).

### Module 3: Product Master Overhaul
#### Added
- Universal Product Master Modal: [`src/components/products/ProductMasterModal.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/products/ProductMasterModal.tsx) with progressive disclosure (essentials visible by default, advanced tracking under 'More options') and post-save action flow.
- Categories Tab: [`src/components/products/ProductCategoriesTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/products/ProductCategoriesTab.tsx) displaying department counts and inline addition.
- Price Lists View Tab: [`src/components/products/ProductPriceListsTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/products/ProductPriceListsTab.tsx) comparing Cost, Retail, Wholesale, Dealer, MRP, and Floor Minimum prices.
- Import / Export Tab: [`src/components/products/ProductImportExportTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/products/ProductImportExportTab.tsx) with template download, live export, and row error validation preview.
- Labels & Barcodes Tab: [`src/components/products/ProductLabelsTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/products/ProductLabelsTab.tsx) with live sticker preview and direct silent printing.
- Module documentation: [`docs/modules/MODULE_03_PRODUCT_MASTER.md`](file:///c:/Users/Admin/Desktop/Billing-ERP/docs/modules/MODULE_03_PRODUCT_MASTER.md).

#### Changed
- Refactored [`src/pages/products/ProductListPage.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/pages/products/ProductListPage.tsx) into a single unified 5-tab screen with one primary `+ New Product` action button.

### Module 4: Universal Billing & Fast POS
#### Added
- Universal 5-Step Transaction Indicator: [`src/components/pos/POSStepIndicator.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/pos/POSStepIndicator.tsx) implementing `SELECT → ENTER → REVIEW → CONFIRM → DONE`.
- POS Keyboard Shortcuts Bar: [`src/components/pos/POSKeyboardBar.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/pos/POSKeyboardBar.tsx) with `F2`-`F10`, `Esc`, and `Ctrl+P` shortcuts.
- Held Bills Drawer: [`src/components/pos/POSHeldBillsDrawer.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/pos/POSHeldBillsDrawer.tsx) for parking and resuming in-progress customer baskets (`F4`/`F5`).
- Cashier Shift & Drawer Panel: [`src/components/pos/POSShiftPanel.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/pos/POSShiftPanel.tsx) with opening float, live cash/UPI/card sales breakdown, physical cash count reconciliation with variance calculation, and shift audit printing.
- Module documentation: [`docs/modules/MODULE_04_UNIVERSAL_BILLING_POS.md`](file:///c:/Users/Admin/Desktop/Billing-ERP/docs/modules/MODULE_04_UNIVERSAL_BILLING_POS.md).

#### Changed
- Completely redesigned [`src/pages/sales/FastPOSPage.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/pages/sales/FastPOSPage.tsx) into a full-screen, high-speed POS terminal with in-page tabs (`Billing Counter`, `Held Bills`, `Cashier Shift`).
- Added 8-second floating Undo toast for line deletion and cart clearing (Undo over confirm).
- Integrated auto-saving drafts into `localStorage` so in-progress bills are never lost.

### Module 5: Sales Module Redesign
#### Added
- Universal Sales Document Creator: [`src/components/sales/SalesDocumentModal.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/sales/SalesDocumentModal.tsx) implementing the 5-step flow for Invoices, Quotations, and Sales Orders.
- Quotations Tab: [`src/components/sales/SalesQuotationsTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/sales/SalesQuotationsTab.tsx) with one-click conversion to Tax Invoice.
- Sales Orders Tab: [`src/components/sales/SalesOrdersTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/sales/SalesOrdersTab.tsx) with one-click fulfillment and invoice generation.
- Sales Returns Tab: [`src/components/sales/SalesReturnsTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/sales/SalesReturnsTab.tsx) with credit note calculation, inventory reversal, and cashier manager PIN authorization checks.
- Payments Received Tab: [`src/components/sales/SalesPaymentsReceivedTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/sales/SalesPaymentsReceivedTab.tsx) with live collections ledger and method breakdown.
- Module documentation: [`docs/modules/MODULE_05_SALES.md`](file:///c:/Users/Admin/Desktop/Billing-ERP/docs/modules/MODULE_05_SALES.md).

#### Changed
- Consolidated fragmented sales routes into a unified 5-tab screen: [`src/pages/sales/SalesInvoicesPage.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/pages/sales/SalesInvoicesPage.tsx) (`Invoices`, `Quotations`, `Orders`, `Returns`, `Payments Received`).
- Enforced one primary action button per screen matching tab context.


### Module 6: Purchases & Inward Goods Management
#### Added
- Universal Purchase Document Creator: [`src/components/purchases/PurchaseDocumentModal.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/purchases/PurchaseDocumentModal.tsx) implementing the 5-step flow (`SELECT → ENTER → REVIEW → CONFIRM → DONE`) for Purchase Orders and Purchase Bills.
- Purchase Orders Tab: [`src/components/purchases/PurchaseOrdersTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/purchases/PurchaseOrdersTab.tsx) with search, live PO status, and one-click GRN receiving transition.
- Goods Received (GRN) Tab: [`src/components/purchases/PurchaseGoodsReceivedTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/purchases/PurchaseGoodsReceivedTab.tsx) with FEFO batch number generation, expiry date intake, and automated stock intake.
- Purchase Returns Tab: [`src/components/purchases/PurchaseReturnsTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/purchases/PurchaseReturnsTab.tsx) for vendor debit note creation, defect logging, and CSV/Excel data export.
- Payments Made Tab: [`src/components/purchases/PurchasePaymentsMadeTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/purchases/PurchasePaymentsMadeTab.tsx) tracking outward disbursements, supplier balances, payment modes, and payment vouchers.
- Module documentation: [`docs/modules/MODULE_06_PURCHASES.md`](file:///c:/Users/Admin/Desktop/Billing-ERP/docs/modules/MODULE_06_PURCHASES.md).

#### Changed
- Consolidated fragmented purchase pages into a unified 5-tab screen: [`src/pages/purchases/PurchaseInvoicesPage.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/pages/purchases/PurchaseInvoicesPage.tsx) (`Orders (PO)`, `Goods Received (GRN)`, `Bills`, `Returns`, `Payments made`).
- Unified header with ONE contextual primary button and URL search parameter tab persistence.


### Module 7: Stock & Warehouses Management
#### Added
- Universal Stock Adjustment Modal: [`src/components/stock/StockAdjustmentModal.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/stock/StockAdjustmentModal.tsx) with the 5-step flow (`SELECT → ENTER → REVIEW → CONFIRM → DONE`) and standardized reason codes.
- Current Stock Tab: [`src/components/stock/StockCurrentTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/stock/StockCurrentTab.tsx) displaying warehouse valuation, physical unit totals, and retail potential.
- Low Stock Tab: [`src/components/stock/StockLowTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/stock/StockLowTab.tsx) with reorder matrix, shortage calculations, and procurement links.
- Expiring Batches Tab: [`src/components/stock/StockExpiringTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/stock/StockExpiringTab.tsx) with FEFO days-remaining tracking and expiration risk valuation.
- Movements Tab: [`src/components/stock/StockMovementsTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/stock/StockMovementsTab.tsx) with comprehensive inventory transaction audit trail.
- Inter-Warehouse Transfers Tab: [`src/components/stock/StockTransfersTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/stock/StockTransfersTab.tsx) supporting dispatch, challan generation, and destination receipt.
- Physical Counts Tab: [`src/components/stock/StockCountsTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/stock/StockCountsTab.tsx) for shelf counting and 1-click automated variance reconciliation.
- Adjustments Tab: [`src/components/stock/StockAdjustmentsTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/stock/StockAdjustmentsTab.tsx) with loss write-off metrics and adjustment history.
- Module documentation: [`docs/modules/MODULE_07_STOCK.md`](file:///c:/Users/Admin/Desktop/Billing-ERP/docs/modules/MODULE_07_STOCK.md).

#### Changed
- Consolidated fragmented inventory screens into a single 7-tab screen: [`src/pages/inventory/InventoryDashboardPage.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/pages/inventory/InventoryDashboardPage.tsx) (`Current`, `Low`, `Expiring`, `Movements`, `Transfers`, `Counts`, `Adjustments`).
- Maintained strict role-based separation for salespersons via [`SalespersonInventoryPage.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/pages/inventory/SalespersonInventoryPage.tsx).


### Module 8: Commercial Parties, Pricing Architecture & Approvals Queue
#### Added
- Universal Party Modal: [`src/components/parties/PartyModal.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/parties/PartyModal.tsx) with 2-tap fast creation and progressive disclosure for credit limits, payment terms, and assigned salespersons.
- Customers Tab: [`src/components/parties/PartyCustomersTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/parties/PartyCustomersTab.tsx) for direct retail and wholesale customer receivable management.
- Suppliers Tab: [`src/components/parties/PartySuppliersTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/parties/PartySuppliersTab.tsx) tracking vendor payables and GST profiles.
- Shops/Dealers Tab: [`src/components/parties/PartyDealersTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/parties/PartyDealersTab.tsx) for B2B distributor and franchisee network accounts.
- Price Lists Tab: [`src/components/pricing/PricingPriceListsTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/pricing/PricingPriceListsTab.tsx) comparing Retail, Wholesale, Dealer, MRP, and Minimum Floor prices.
- Salesperson Price Rules Tab: [`src/components/pricing/PricingSalespersonRulesTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/pricing/PricingSalespersonRulesTab.tsx) enforcing discount ceilings and return limits.
- Commission Tab: [`src/components/pricing/PricingCommissionTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/pricing/PricingCommissionTab.tsx) with automated slab calculation and payout balance tracking.
- Targets Tab: [`src/components/pricing/PricingTargetsTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/pricing/PricingTargetsTab.tsx) with monthly sales quota progress bars.
- Approvals Queue Tab: [`src/components/pricing/PricingApprovalsTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/pricing/PricingApprovalsTab.tsx) for manager authorization on discount overrides, sub-floor pricing, and high-value returns.
- Module documentation: [`docs/modules/MODULE_08_PARTIES_PRICING_APPROVALS.md`](file:///c:/Users/Admin/Desktop/Billing-ERP/docs/modules/MODULE_08_PARTIES_PRICING_APPROVALS.md).

#### Changed
- Refactored [`src/pages/customers/CustomersPage.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/pages/customers/CustomersPage.tsx) into a unified Parties screen with 3 horizontal tabs (`Customers`, `Suppliers`, `Shops / Dealers`).
- Redesigned [`src/pages/products/PricingRulesPage.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/pages/products/PricingRulesPage.tsx) into a 5-tab commercial hub (`Price Lists`, `Salesperson Price Rules`, `Commission`, `Targets`, `Approvals`).


### Module 9: Unified Accounts & Financial Reports
#### Added
- General Ledgers Tab: [`src/components/accounts/AccountsLedgersTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/accounts/AccountsLedgersTab.tsx) with Chart of Accounts master grouped across standard accounting categories.
- Payments Cashflow Tab: [`src/components/accounts/AccountsPaymentsTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/accounts/AccountsPaymentsTab.tsx) tracking inflows, outflows, and net liquidity.
- Expenses Tab: [`src/components/accounts/AccountsExpensesTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/accounts/AccountsExpensesTab.tsx) for recording and categorizing business overheads.
- Day Book Tab: [`src/components/accounts/AccountsDayBookTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/accounts/AccountsDayBookTab.tsx) for chronological daily transaction journal auditing.
- Bank Accounts Tab: [`src/components/accounts/AccountsBankTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/accounts/AccountsBankTab.tsx) tracking liquid bank and cash drawer capital.
- Tax Reconciliation Tab: [`src/components/accounts/AccountsTaxTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/accounts/AccountsTaxTab.tsx) comparing output GST liability against input tax credits.
- Executive Report Tabs:
  - Sales Report: [`src/components/reports/ReportSalesTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/reports/ReportSalesTab.tsx)
  - Purchases Spend: [`src/components/reports/ReportPurchasesTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/reports/ReportPurchasesTab.tsx)
  - Stock Asset Valuation: [`src/components/reports/ReportStockTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/reports/ReportStockTab.tsx)
  - Profit & Loss Statement: [`src/components/reports/ReportProfitTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/reports/ReportProfitTab.tsx)
  - Tax GSTR Schedules: [`src/components/reports/ReportTaxTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/reports/ReportTaxTab.tsx)
  - Balance Sheet Statement: [`src/components/reports/ReportStatementsTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/reports/ReportStatementsTab.tsx)
  - Salesperson League: [`src/components/reports/ReportSalespersonTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/reports/ReportSalespersonTab.tsx)
  - Cashier Shift Audit Log: [`src/components/reports/ReportCashierShiftsTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/reports/ReportCashierShiftsTab.tsx)
- Module documentation: [`docs/modules/MODULE_09_ACCOUNTS_REPORTS.md`](file:///c:/Users/Admin/Desktop/Billing-ERP/docs/modules/MODULE_09_ACCOUNTS_REPORTS.md).

#### Changed
- Consolidated fragmented financial accounting pages into a unified 6-tab screen: [`src/pages/accounting/ChartOfAccountsPage.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/pages/accounting/ChartOfAccountsPage.tsx) (`Ledgers`, `Payments`, `Expenses`, `Day Book`, `Bank`, `Tax`).
- Consolidated reports into a clean 8-tab executive analytics screen: [`src/pages/reports/ReportsPage.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/pages/reports/ReportsPage.tsx) (`Sales`, `Purchases`, `Stock`, `Profit`, `Tax`, `Statements`, `Salesperson`, `Cashier Shifts`).


### Module 10: Settings (Admin), Guided Onboarding & Production Polish
#### Added
- Universal 5-Step Guided Onboarding Wizard: [`src/components/onboarding/GuidedOnboardingModal.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/onboarding/GuidedOnboardingModal.tsx) configuring business type, company GSTIN, stores, sample industry demo products, and operating mode.
- Interactive Role Quick Start Checklist: [`src/components/dashboard/RoleQuickStartCard.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/dashboard/RoleQuickStartCard.tsx) tailored for Cashier, Salesperson, Accountant, Warehouse Manager, and Admin roles.
- Settings In-Page Tabs:
  - Users & Roles: [`src/components/settings/SettingsUsersTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/settings/SettingsUsersTab.tsx)
  - Business Identity: [`src/components/settings/SettingsBusinessTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/settings/SettingsBusinessTab.tsx)
  - Taxes & GST Slabs: [`src/components/settings/SettingsTaxesTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/settings/SettingsTaxesTab.tsx)
  - Stores & Warehouses: [`src/components/settings/SettingsStoresTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/settings/SettingsStoresTab.tsx)
  - Hardware Printers: [`src/components/settings/SettingsPrintersTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/settings/SettingsPrintersTab.tsx)
  - Database Backup: [`src/components/settings/SettingsBackupTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/settings/SettingsBackupTab.tsx)
  - Advanced & Small-Shop Mode: [`src/components/settings/SettingsAdvancedTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/settings/SettingsAdvancedTab.tsx)
- Module documentation: [`docs/modules/MODULE_10_SETTINGS_ONBOARDING.md`](file:///c:/Users/Admin/Desktop/Billing-ERP/docs/modules/MODULE_10_SETTINGS_ONBOARDING.md).

#### Changed
- Redesigned pinned Settings screen: [`src/pages/settings/SettingsPage.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/pages/settings/SettingsPage.tsx) into the 7-tab administrative control center.
- Integrated Guided Onboarding and Role Quick Start checklists into [`src/pages/dashboard/DashboardPage.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/pages/dashboard/DashboardPage.tsx).
