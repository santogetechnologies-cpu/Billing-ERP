# Module 3: Product Master Overhaul (Peanuts to Electric Vehicles)

## 1. Overview
Module 3 implements **Part F** of the specification, consolidating all product creation, pricing, batch/serial tracking, inventory alerts, imports, and barcode labeling into a unified, high-performance product management system.

## 2. In-Page Tab Architecture
Following **Part C**, all product variants and workflows are organized inside one single screen via horizontal tabs:
1. **`All`**: Complete catalogue data table with search (<100ms), category filter chips, stock status indicators (`In Stock`, `Low Stock`, `Out of Stock`), direct silent barcode printing, inline editing, and deletion checks.
2. **`Categories`**: Category grid displaying product counts per category, descriptions, and one-tap category creation.
3. **`Price lists (view)`**: Matrix view comparing Cost, Retail, Wholesale, Dealer/Shop, and Floor Minimum prices with tier filters.
4. **`Import / Export`**: Standard Excel/CSV template download with sample rows, live full-catalogue export, drag-and-drop upload preview with row-level error validation reporting (never imports silently), and bulk price updates.
5. **`Labels & Barcodes`**: Barcode label designer with dimension presets (`50x25mm`, `38x25mm`, `100x50mm`), price/MRP/category toggles, live barcode canvas preview, and silent print bridge integration.

## 3. The Universal Product Master Modal (`ProductMasterModal.tsx`)
Adheres to the universal flow: `Add Product → Basic details → (optional) More options → Save → Done`

### 3.1 Visible by Default (The Essentials)
- **Product Name**: Required, auto-focused.
- **Category**: Pre-filled or selectable from dropdown.
- **Base Unit**: Strictly mapped to the 9 Universal Units (`PCS`, `STRIP`, `TAB`, `BOX`, `SET`, `KG`, `LTR`, `MTR`, `SQF`).
- **Sale Price**: Currency-aware numeric input.
- **Tax Group**: Standard GST/VAT slabs (0%, 5%, 12%, 18%, 28%).
- **Opening Stock & Warehouse**: Warehouse allocation for initial inventory.
- **Auto-generated Code & Barcode**: Generated automatically if left blank.

### 3.2 Progressive Disclosure: "More Options"
Toggled via a single non-intrusive button:
- **Batch + Expiry Switch**: Captures batch code and expiration for medicines and food; triggers FEFO sales and expiry warnings.
- **Serial / IMEI / VIN / Chassis Switch**: Unit-level tracking for electronics and vehicles; enables serial number tracking.
- **Service / Labor Item Switch**: Bills without inventory deductions.
- **Bundle / Combo Kit Switch**: Deducts component items from stock on sale.
- **Price Tiers**: Wholesale price, Dealer/Shop price, MRP, and Floor Minimum price.
- **Reorder Rules**: Stock warning limit, HSN/SAC code, brand/manufacturer, and description.

### 3.3 Post-Save "Done" Screen
Offers next best actions:
- `Print Label`: Spools barcode sticker to printer via local bridge.
- `Add Another`: Resets form for rapid sequential entry.
- `Done`: Closes modal and updates table live.

