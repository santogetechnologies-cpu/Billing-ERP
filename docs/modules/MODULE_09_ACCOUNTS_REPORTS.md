# Module 9: Unified Accounts & Financial Reports

## 1. Overview
Module 9 consolidates all financial accounting ledgers (**Accounts**) and executive intelligence dashboards (**Reports**) into clean, unified screens driven by horizontal in-page tabs (**Part C**).

## 2. In-Page Tab Architecture

### Accounts ([`ChartOfAccountsPage.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/pages/accounting/ChartOfAccountsPage.tsx))
Accessible via `/accounts` and `/accounting`:
1. **`Ledgers`** ([`AccountsLedgersTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/accounts/AccountsLedgersTab.tsx)): Chart of Accounts master grouped across Assets, Liabilities, Equity, Income, and Expenses with quick account addition.
2. **`Payments`** ([`AccountsPaymentsTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/accounts/AccountsPaymentsTab.tsx)): Unified cashflow transactions tracking both Inward customer receipts and Outward supplier disbursements.
3. **`Expenses`** ([`AccountsExpensesTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/accounts/AccountsExpensesTab.tsx)): Operational expense voucher registry with cost center classification and expense addition modal.
4. **`Day Book`** ([`AccountsDayBookTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/accounts/AccountsDayBookTab.tsx)): Chronological financial day book journal of all daily transactions with debit/credit balance reconciliation.
5. **`Bank`** ([`AccountsBankTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/accounts/AccountsBankTab.tsx)): Cash and bank accounts ledger, liquid capital tracker, and merchant settlement accounts.
6. **`Tax`** ([`AccountsTaxTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/accounts/AccountsTaxTab.tsx)): GST liability reconciliation comparing Output Tax collected on sales against Input Tax Credit (ITC) paid on purchases.

### Reports ([`ReportsPage.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/pages/reports/ReportsPage.tsx))
Accessible via `/reports`:
1. **`Sales`** ([`ReportSalesTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/reports/ReportSalesTab.tsx)): Comprehensive turnover and transaction sales register.
2. **`Purchases`** ([`ReportPurchasesTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/reports/ReportPurchasesTab.tsx)): Vendor procurement spend and inward tax register.
3. **`Stock`** ([`ReportStockTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/reports/ReportStockTab.tsx)): Inventory valuation and asset ledger.
4. **`Profit`** ([`ReportProfitTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/reports/ReportProfitTab.tsx)): Commercial Profit & Loss statement (Revenue - COGS - Expenses = Net Profit).
5. **`Tax`** ([`ReportTaxTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/reports/ReportTaxTab.tsx)): GSTR-1 and GSTR-3B statutory return schedules.
6. **`Statements`** ([`ReportStatementsTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/reports/ReportStatementsTab.tsx)): Financial position balance sheet summary (Assets = Liabilities + Equity).
7. **`Salesperson`** ([`ReportSalespersonTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/reports/ReportSalespersonTab.tsx)): Representative performance ranking and commission accrual.
8. **`Cashier Shifts`** ([`ReportCashierShiftsTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/reports/ReportCashierShiftsTab.tsx)): Cashier shift register and physical drawer count variance audit trail.

