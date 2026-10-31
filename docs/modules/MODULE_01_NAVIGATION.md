# Module 1: Universal Shell & Navigation Redesign

## 1. Overview
Module 1 transforms the application's cluttered multi-level navigation into a clean, minimal, single-sidebar architecture complying with **Part C** and **Part B2** of the Universal ERP specifications.

## 2. Key Architecture Decisions
- **Single Sidebar Only**: Exactly one main sidebar. All nested/expandable menus, sub-sidebars, and secondary navigation columns have been eliminated.
- **Strict 10 Navigation Items Maximum** (+ 1 pinned Settings item at bottom):
  1. `Dashboard` (`/` or `/dashboard`)
  2. `Billing (POS)` (`/sales/pos` or `/pos`)
  3. `Sales` (`/sales`)
  4. `Purchases` (`/purchases`)
  5. `Stock` (`/inventory` or `/stock`)
  6. `Products` (`/products`)
  7. `Parties` (`/customers` or `/parties`)
  8. `Pricing & Commission` (`/pricing`)
  9. `Accounts` (`/accounting` or `/accounts`)
  10. `Reports` (`/reports`)
  - **Pinned Settings**: `/settings` (separated by divider at bottom, accessible to Admin/Owner).
- **In-Page Tabs**: All category variations, statuses, and sub-views are rendered as horizontal tabs inside the page using the newly built reusable `Tabs.tsx` component.
- **Top Header Bar**:
  - Store/Warehouse switcher with auto branch detection.
  - Global search (`Ctrl+K` and `Ctrl+Q` keyboard shortcuts) with multi-entity lookup.
  - "+ New" quick-create dropdown for instant billing, product creation, customer registration, and PO generation.
  - Real-time notification bell and cashier presence badge.

## 3. Reusable Components Created / Updated
- [`src/components/common/Tabs.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/common/Tabs.tsx): Reusable, keyboard-accessible tab component supporting counts, status badges, underline and pill variants, and automatic `?tab=` URL synchronization.
- [`src/components/layout/Sidebar.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/layout/Sidebar.tsx): Universal 10-item sidebar with collapse state persistence and RBAC role visibility.
- [`src/components/layout/Header.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/layout/Header.tsx): Clean top bar with Ctrl+K search, store switcher, and quick-create menu.
- [`src/components/layout/AppLayout.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/layout/AppLayout.tsx): Layout skeleton binding the universal sidebar and header.

## 4. Verification & Testing
- Validated role visibility across all 7 roles (Admin, Cashier, Salesperson, Purchase Manager, Warehouse Manager, Accountant, Owner).
- Validated mutual exclusion of active route highlighting.
- Verified collapse state storage in `localStorage` (`universal_billing_sidebar_collapsed`).
- Verified keyboard listeners for `Ctrl+K`, `Ctrl+Q`, and `F2`.

