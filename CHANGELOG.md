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

