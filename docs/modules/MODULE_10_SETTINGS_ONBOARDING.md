# Module 10: Settings (Admin), Guided Onboarding & Production Polish

## 1. Overview
Module 10 completes the redesign by delivering:
1. Pinned **Settings (Admin)** screen organized with the 7 horizontal in-page tabs (**Part C**).
2. Universal 5-step **Guided Onboarding Wizard** tailored for all 7 business types with starter demo catalogs (**Part B7**).
3. **Role-Based Quick Start Checklists** on dashboards for Cashier, Salesperson, Accountant, Warehouse Manager, and Admin (**Part B7**).
4. **Small-Shop Mode Toggle** in Settings &gt; Advanced to simplify the app for single-counter stores or scale up to multi-counter retail malls.

## 2. In-Page Tab Architecture

### Settings ([`SettingsPage.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/pages/settings/SettingsPage.tsx))
Pinned at the bottom of the sidebar, accessible via `/settings`:

1. **`Users & Roles`** ([`SettingsUsersTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/settings/SettingsUsersTab.tsx)):
   - System users registry, role permissions assignment (Cashier, Salesperson, Accountant, Warehouse Manager, Admin), and invite modal.

2. **`Business`** ([`SettingsBusinessTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/settings/SettingsBusinessTab.tsx)):
   - Commercial identity, trading name, GSTIN, PAN, invoice series prefix (`INV-`), bank details printed on receipts, and standard terms.

3. **`Taxes`** ([`SettingsTaxesTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/settings/SettingsTaxesTab.tsx)):
   - Indian GST tax slabs (0%, 5%, 12%, 18%, 28%), tax-inclusive pricing toggle, and composition scheme switch.

4. **`Stores`** ([`SettingsStoresTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/settings/SettingsStoresTab.tsx)):
   - Multi-warehouse and outlet location directory with code, type (Main Godown, Branch, Counter Store), and address.

5. **`Printers`** ([`SettingsPrintersTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/settings/SettingsPrintersTab.tsx)):
   - Hardware printer integration (80mm/58mm thermal receipts, ESC/POS, barcode labels, and A4 invoice printers).

6. **`Backup`** ([`SettingsBackupTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/settings/SettingsBackupTab.tsx)):
   - Instant full database snapshot download (`.json`), backup archive verification, and data safety guarantees.

7. **`Advanced`** ([`SettingsAdvancedTab.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/settings/SettingsAdvancedTab.tsx)):
   - Small-Shop Mode switch (hides enterprise modules for single-counter retail simplicity), multi-warehouse routing toggle, FEFO batch/expiry tracking, IMEI/serial tracking, negative stock billing, and scanner audio feedback.

## 3. Guided Onboarding & Role Quick Starts

### Guided First-Run Setup Wizard ([`GuidedOnboardingModal.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/onboarding/GuidedOnboardingModal.tsx))
5-step setup wizard implementing Part B7:
- **Step 1: Business Type**: Select from 7 industries (Grocery, Pharmacy, Clothing, Electronics, Vehicles, Hardware, Retail Mall).
- **Step 2: Business & Tax**: Company name, GSTIN, phone, and billing address.
- **Step 3: Stores**: Primary store location and dispatch godown.
- **Step 4: Starter Products**: Installs demo catalog items configured for the chosen industry (e.g. Paracetamol cut-strips with FEFO batch for Pharma, Loose rice in KG for Grocery, Tiles in SQF for Hardware, Mobiles with serial numbers for Electronics).
- **Step 5: Operational Mode**: Select between Small-Shop Mode (single counter) or Enterprise Multi-Department Mode.

### Role Quick Start Card ([`RoleQuickStartCard.tsx`](file:///c:/Users/Admin/Desktop/Billing-ERP/src/components/dashboard/RoleQuickStartCard.tsx))
- Dismissible interactive checklist rendered on the dashboard tailored to the logged-in user's role (Cashier, Salesperson, Accountant, Warehouse Manager, or Admin).
- Provides instant progress tracking and 1-click launch shortcuts into primary workflows.
