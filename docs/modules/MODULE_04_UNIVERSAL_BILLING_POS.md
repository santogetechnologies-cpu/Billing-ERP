# Module 4: Universal Billing & Fast POS System

## 1. Overview
Module 4 establishes the core billing counter interface adhering to **Part B (Universal Screen Flow)** and **Part B6 (Keyboard, Speed & Accessibility)**. The system is designed so that a brand-new user can bill their first basket in under 2 minutes with zero training, and a power user can bill a 20-item basket in under 30 seconds using only the keyboard.

## 2. In-Page Tab Navigation (Part C)
Organized inside [`FastPOSPage.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/pages/sales/FastPOSPage.tsx) without nested sidebar clutter:
1. **`Billing Counter`**: Full-screen billing interface with fast barcode scanner, touch catalogue, live basket, and instant payment.
2. **`Held Bills`** ([`POSHeldBillsDrawer.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/pos/POSHeldBillsDrawer.tsx)): View parked baskets, customer names, line counts, and resume immediately (`F5`).
3. **`Cashier Shift`** ([`POSShiftPanel.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/pos/POSShiftPanel.tsx)): Register opening float, live cash/UPI/card sales breakdown, physical drawer count reconciliation with variance calculation, and shift audit printing.

## 3. The Universal 5-Step Transaction Flow (Part B1)
Every transaction follows the slim visual step indicator ([`POSStepIndicator.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/pos/POSStepIndicator.tsx)):
1. **`SELECT`**: Customer selector pre-filled with Walk-in Customer by default; warehouse pre-filled with active store.
2. **`ENTER`**: Barcode scanning or touch catalogue selection. Quantity input supports typing small units directly (`250g` → `0.250 KG`, `500ml` → `0.500 LTR`, `10in` → `0.254 MTR`). Adding a line takes <200ms.
3. **`REVIEW`**: Summary card updates in real-time with subtotal, tax breakdown, discount, and grand total in high-visibility 32px+ typography.
4. **`CONFIRM`**: Exactly **ONE** primary filled/colored action button: `PAY (F10)`. Displays cash change calculation and tender methods (Cash, UPI, Card).
5. **`DONE`**: Success screen showing invoice number, customer, and next best actions (`Print / Preview`, `New Bill`).

## 4. Engineering Rules & Features
- **Undo Over Confirm (Rule B1)**: Reversible actions (removing a line item, clearing a bill) trigger an 8-second floating "Undo" toast rather than a blocking modal dialog.
- **Auto-Save Drafts (Rule B1)**: In-progress baskets are continuously saved to `universal_billing_pos_draft_cart` and automatically restored if the page is refreshed or reopened.
- **Hardware & Direct Silent Print**: Integrates with the local Node.js print bridge on `127.0.0.1:9191` for instant silent thermal ESC/POS receipt printing with paper cut.
- **Keyboard Shortcuts (Rule B6)**:
  - `F2`: Focus barcode search input
  - `F3`: Customer selection
  - `F4`: Hold bill
  - `F5`: Resume held bills
  - `F6`: Edit line quantity
  - `F8`: Bill discount
  - `F10`: Confirm & pay
  - `Esc`: Clear or cancel
  - `Ctrl+P`: Print preview

