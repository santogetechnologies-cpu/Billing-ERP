# Module 2: Universal Unit System Engine

## 1. Overview
Module 2 establishes the Universal 9-Unit System defined in **Part E** of the specification, supporting everything from loose peanuts by gram/kg, medicines with cut-strip blister packs, liquids by ml/liter, fabric by meters/inches, tiles by sq ft, to high-value serialized vehicles and discrete electronics.

## 2. The 9 Universal Units

| Code | Name | Category | Decimal Rule | Covers |
|---|---|---|---|---|
| `PCS` | Pieces / Numbers | Count | Whole numbers (0 decimals) | Clothes, electronics, toys, books, tools, packets, cans, jars, bottles, syrup, vehicles (~90% of retail) |
| `STRIP` | Strip | Pharma | Whole numbers (0 decimals) | Standard pharma tablet/capsule blister packs |
| `TAB` | Tablet / Capsule | Pharma | Whole numbers (0 decimals) | Loose pills when a strip is cut and sold singly |
| `BOX` | Box / Pack | Packaging | Whole numbers (0 decimals) | Multipacks, wholesale bundles, cigarette packs, soda cases |
| `SET` | Set / Pair | Count | Whole numbers (0 decimals) | Pair of shoes, sofa set, dinner set |
| `KG` | Kilogram | Weight | Decimal, 3 places (`0.001`) | Loose groceries, vegetables, meat, scrap, nails, chemical powders (e.g. 250g = 0.250 KG) |
| `LTR` | Liter | Volume | Decimal, 3 places (`0.001`) | All liquids: oil, milk, paint, fuel, liquid chemicals (e.g. 500ml = 0.500 LTR) |
| `MTR` | Meter | Length | Decimal, 3 places (`0.001`) | All lengths: fabric, rope, wire, pipes, gauze (e.g. 10in = 0.254 MTR) |
| `SQF` | Square Feet | Area | Decimal, 2 places (`0.01`) | Tiles, marble, glass, plywood, banners |

## 3. Core Engine Rules Implemented

### 3.1 Base Unit Storage & Conversion
- Every product stores stock in its designated **base unit**.
- Line items on sales, purchases, and transfers preserve the original entered unit and conversion factor for clear receipt printing.

### 3.2 Cut-Strip Pharma Flow
- At the billing counter, when a customer purchases loose tablets (e.g. 3 `TAB`) of a product stocked in `STRIP`s:
  - The engine automatically calculates the strip deduction: 1 `STRIP` down, 10 `TAB` up.
  - 3 `TAB` are sold, leaving 7 `TAB` loose in counter stock.
  - Displays an instant notification notice to the cashier with zero extra friction.

### 3.3 Natural Small-Unit Input Parsing
- Cashiers can type small units directly into the counter quantity field:
  - `250g` or `250 gm` → converted to `0.250 KG`
  - `500ml` → converted to `0.500 LTR`
  - `10in` or `10 inches` → converted to `0.254 MTR`
  - `45cm` → converted to `0.450 MTR`
  - `5ft` → converted to `1.524 MTR`

### 3.4 Barcode Weighing Scale Integration
- Parses standard 13-digit retail barcode labels:
  - Weight-embedded barcodes (prefixes `20`, `22`, `02`): extracts 5-digit item code and 5-digit weight in grams, converting to `KG`.
  - Price-embedded barcodes (prefixes `21`, `23`): extracts item code and total price.

## 4. Automated Test Suite
- Automated test script: [`scripts/test-units.cjs`](file:///c:/Users/Admin/Desktop/Billing-ERP/scripts/test-units.cjs)
- **11 / 11 Automated Test Cases Passed**:
  1. Exactly 9 Universal Unit Codes defined
  2. Discrete units reject/round decimals to whole integers
  3. Decimal units enforce precise fractional precision (3 places for KG/LTR/MTR, 2 for SQF)
  4. Natural language: 250g converts to 0.250 KG
  5. Natural language: 500ml converts to 0.500 LTR
  6. Natural language: 10in converts to 0.254 MTR
  7. Natural language: 45cm converts to 0.450 MTR
  8. Pharma Cut-Strip: Selling 3 TAB with 0 loose opens 1 STRIP (10 TAB), leaves 7 TAB
  9. Pharma Cut-Strip: Selling 4 TAB with 7 loose deducts 0 STRIP, leaves 3 TAB
  10. Pharma Cut-Strip: Selling 15 TAB with 3 loose opens 2 STRIPs, leaves 8 TAB
  11. Weight-embedded scale barcode parses item code and weight in KG

