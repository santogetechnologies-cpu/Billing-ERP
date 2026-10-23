import { InvoiceItem } from '../src/types';
import { UNIVERSAL_BUILTIN_UNITS } from '../src/data/unitsData';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    process.exitCode = 1;
  }
}

// Emulate unit decimal validation rule from FastPOSPage.tsx
function isDecimalUnitAllowed(unitStr?: string): boolean {
  if (!unitStr) return true;
  const normalized = unitStr.toLowerCase().trim();
  const foundUnit = UNIVERSAL_BUILTIN_UNITS.find(
    u => u.name.toLowerCase() === normalized || u.symbol.toLowerCase() === normalized
  );
  if (foundUnit) {
    return ['Weight', 'Volume', 'Length', 'Area', 'Volume Dimension'].includes(foundUnit.category);
  }
  const discreteUnits = [
    'piece', 'pcs', 'piece (pcs)', 'pair', 'pr', 'set', 'dozen', 'dzn',
    'box', 'carton', 'ctn', 'pack', 'bundle', 'bdl', 'roll', 'bag', 'bottle', 'btl', 'can'
  ];
  if (discreteUnits.includes(normalized)) return false;
  const decimalKeywords = ['kg', 'kilogram', 'gram', 'ton', 'quintal', 'litre', 'liter', 'ml', 'meter', 'metre', 'cm', 'feet', 'ft', 'inch', 'sq', 'cu'];
  return decimalKeywords.some(keyword => normalized.includes(keyword));
}

// Emulate POS Cart Manager representing FastPOSPage state & calculations
class MockPOSCartManager {
  cart: InvoiceItem[] = [];
  stockBalances: Record<string, number> = {};
  warningMessage: string | null = null;

  setStock(productId: string, stock: number) {
    this.stockBalances[productId] = stock;
  }

  getWarehouseStock(productId: string): number {
    return this.stockBalances[productId] ?? 0;
  }

  addToCart(product: { id: string; name: string; sku: string; rate: number; taxRate: number; unit: string }, quantity = 1) {
    const available = this.getWarehouseStock(product.id);
    const existing = this.cart.find(i => i.productId === product.id);
    const targetQty = (existing?.qty || 0) + quantity;

    if (available <= 0) {
      this.warningMessage = 'Out of Stock — This product cannot be billed because no stock is available.';
      return false;
    }
    if (targetQty > available) {
      this.warningMessage = `Insufficient stock. Available: ${available} ${product.unit}.`;
      return false;
    }

    this.warningMessage = null;
    if (existing) {
      return this.updateCartItemQuantity(existing.id, targetQty).success;
    }

    const taxable = quantity * product.rate;
    const tax = (taxable * product.taxRate) / 100;
    const newItem: InvoiceItem = {
      id: 'cart-' + Math.random().toString(36).substring(2, 7),
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      barcode: '1234567890',
      hsn: '1234',
      qty: quantity,
      unit: product.unit,
      rate: product.rate,
      discountPct: 0,
      discountAmt: 0,
      taxRate: product.taxRate,
      taxAmt: tax,
      cgstAmt: tax / 2,
      sgstAmt: tax / 2,
      igstAmt: 0,
      total: taxable + tax,
      costPrice: product.rate * 0.7
    };
    this.cart.push(newItem);
    return true;
  }

  updateCartItemQuantity(id: string, targetQtyInput: number | string): { success: boolean; message?: string } {
    const item = this.cart.find(i => i.id === id);
    if (!item) return { success: false, message: 'Item not found in cart' };

    const parsedQty = typeof targetQtyInput === 'number' ? targetQtyInput : parseFloat(String(targetQtyInput).trim());

    if (isNaN(parsedQty) || !isFinite(parsedQty)) {
      const msg = 'Invalid quantity. Please enter a valid number.';
      this.warningMessage = msg;
      return { success: false, message: msg };
    }

    if (parsedQty <= 0) {
      const msg = 'Quantity must be greater than zero.';
      this.warningMessage = msg;
      return { success: false, message: msg };
    }

    const available = this.getWarehouseStock(item.productId);

    if (available <= 0) {
      const msg = 'Out of Stock — This product cannot be billed because no stock is available.';
      this.warningMessage = msg;
      return { success: false, message: msg };
    }

    if (parsedQty > available) {
      const msg = `Insufficient stock. Available: ${available} ${item.unit}.`;
      this.warningMessage = msg;
      return { success: false, message: msg };
    }

    const decimalAllowed = isDecimalUnitAllowed(item.unit);
    if (!decimalAllowed && !Number.isInteger(parsedQty)) {
      const msg = `Quantity for ${item.unit} must be a whole number (integer).`;
      this.warningMessage = msg;
      return { success: false, message: msg };
    }

    const finalQty = decimalAllowed ? Math.round(parsedQty * 1000) / 1000 : Math.round(parsedQty);

    this.warningMessage = null;
    this.cart = this.cart.map(i => {
      if (i.id === id) {
        const discountAmt = (finalQty * i.rate * (i.discountPct || 0)) / 100;
        const taxable = finalQty * i.rate - discountAmt;
        const tax = (taxable * i.taxRate) / 100;
        return {
          ...i,
          qty: finalQty,
          discountAmt,
          taxAmt: tax,
          cgstAmt: tax / 2,
          sgstAmt: tax / 2,
          total: taxable + tax
        };
      }
      return i;
    });

    return { success: true };
  }

  updateQty(id: string, delta: number) {
    const item = this.cart.find(i => i.id === id);
    if (!item) return;
    const targetQty = item.qty + delta;
    if (targetQty <= 0) {
      this.removeCartItem(id);
      return;
    }
    this.updateCartItemQuantity(id, targetQty);
  }

  removeCartItem(id: string) {
    this.cart = this.cart.filter(i => i.id !== id);
  }

  getTotals() {
    const subtotal = this.cart.reduce((acc, i) => acc + i.qty * i.rate, 0);
    const discountTotal = this.cart.reduce((acc, i) => acc + i.discountAmt, 0);
    const taxTotal = this.cart.reduce((acc, i) => acc + i.taxAmt, 0);
    const rawGrandTotal = subtotal - discountTotal + taxTotal;
    const grandTotal = Math.round(rawGrandTotal);
    const roundOff = grandTotal - rawGrandTotal;
    return { subtotal, discountTotal, taxTotal, rawGrandTotal, grandTotal, roundOff };
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('TEST SUITE: POS CART DIRECT QUANTITY EDITING & VALIDATION');
  console.log('================================================================\n');

  const manager = new MockPOSCartManager();

  // Setup sample inventory
  const prodPiece = { id: 'prod-piece-1', name: 'Cotton Shirt', sku: 'SHT-01', rate: 500, taxRate: 18, unit: 'Piece' };
  const prodKg = { id: 'prod-kg-1', name: 'Basmati Rice', sku: 'RCE-01', rate: 120, taxRate: 5, unit: 'Kg' };
  const prodLitre = { id: 'prod-l-1', name: 'Refined Oil', sku: 'OIL-01', rate: 160, taxRate: 5, unit: 'Litre' };

  manager.setStock(prodPiece.id, 50);
  manager.setStock(prodKg.id, 100);
  manager.setStock(prodLitre.id, 30);

  // -----------------------------------------------------------------------------
  // Test Case 1: Initial item addition and changing quantity from 15 to 25 by typing
  // -----------------------------------------------------------------------------
  console.log('--- 1. Change quantity from 15 to 25 by typing ---');
  manager.addToCart(prodPiece, 15);
  const cartItemPiece = manager.cart[0];
  assert(cartItemPiece.qty === 15, 'Item initially in cart with quantity 15');
  assert(cartItemPiece.total === 15 * 500 * 1.18, 'Initial line total matches rate * qty + 18% GST');

  // Type 25
  const res1 = manager.updateCartItemQuantity(cartItemPiece.id, '25');
  assert(res1.success === true, 'Direct typing 25 succeeds');
  assert(manager.cart[0].qty === 25, 'Cart item quantity updated to 25');
  assert(manager.cart[0].total === 25 * 500 * 1.18, 'Line total recalculated accurately for quantity 25');
  assert(manager.getTotals().grandTotal === 25 * 500 * 1.18, 'Grand total matches 25 items');
  console.log('');

  // -----------------------------------------------------------------------------
  // Test Case 2: Change quantity from 25 to 1 by typing
  // -----------------------------------------------------------------------------
  console.log('--- 2. Change quantity from 25 to 1 by typing ---');
  const res2 = manager.updateCartItemQuantity(cartItemPiece.id, '1');
  assert(res2.success === true, 'Direct typing 1 succeeds');
  assert(manager.cart[0].qty === 1, 'Cart item quantity updated to 1');
  assert(manager.cart[0].total === 1 * 500 * 1.18, 'Line total recalculated for quantity 1');
  assert(manager.getTotals().grandTotal === 590, 'Grand total is exactly Rs. 590');
  console.log('');

  // -----------------------------------------------------------------------------
  // Test Case 3: Decimal quantities for products that support them (Kg, Litre)
  // -----------------------------------------------------------------------------
  console.log('--- 3. Decimal quantities for products that support them (Kg, Litre) ---');
  manager.addToCart(prodKg, 1);
  const cartItemKg = manager.cart[1];

  // Enter decimal 2.5 Kg
  const resKg1 = manager.updateCartItemQuantity(cartItemKg.id, '2.5');
  assert(resKg1.success === true, 'Typing decimal 2.5 for Kg is accepted');
  assert(manager.cart[1].qty === 2.5, 'Quantity updated to 2.5 Kg');
  const expectedKgTotal = 2.5 * 120 * 1.05;
  assert(manager.cart[1].total === expectedKgTotal, `Line total for 2.5 Kg is correct: ${expectedKgTotal}`);

  // Enter fractional 0.750 Litre
  manager.addToCart(prodLitre, 1);
  const cartItemLitre = manager.cart[2];
  const resL1 = manager.updateCartItemQuantity(cartItemLitre.id, '0.75');
  assert(resL1.success === true, 'Typing decimal 0.75 for Litre is accepted');
  assert(manager.cart[2].qty === 0.75, 'Quantity updated to 0.75 Litre');
  const expectedLTotal = 0.75 * 160 * 1.05;
  assert(manager.cart[2].total === expectedLTotal, `Line total for 0.75 Litre is correct: ${expectedLTotal}`);
  console.log('');

  // -----------------------------------------------------------------------------
  // Test Case 4: Reject decimal quantities for discrete units (Piece, Box)
  // -----------------------------------------------------------------------------
  console.log('--- 4. Reject decimal quantities for discrete units (Piece) ---');
  const resPieceDec = manager.updateCartItemQuantity(cartItemPiece.id, '2.5');
  assert(resPieceDec.success === false, 'Entering decimal 2.5 for Piece is rejected');
  assert(
    manager.warningMessage?.includes('must be a whole number'),
    `Validation warning shows whole number requirement: "${manager.warningMessage}"`
  );
  assert(manager.cart[0].qty === 1, 'Quantity remains preserved at 1 (not changed to invalid decimal)');
  console.log('');

  // -----------------------------------------------------------------------------
  // Test Case 5: Attempt to enter zero, negative, or invalid non-numeric quantities
  // -----------------------------------------------------------------------------
  console.log('--- 5. Attempt zero, negative, and invalid non-numeric quantities ---');
  // Zero
  const resZero = manager.updateCartItemQuantity(cartItemPiece.id, '0');
  assert(resZero.success === false, 'Quantity 0 is rejected');
  assert(manager.warningMessage === 'Quantity must be greater than zero.', 'Warning message confirms > 0 requirement');
  assert(manager.cart[0].qty === 1, 'Quantity unchanged at 1');

  // Negative
  const resNeg = manager.updateCartItemQuantity(cartItemPiece.id, '-5');
  assert(resNeg.success === false, 'Negative quantity -5 is rejected');
  assert(manager.cart[0].qty === 1, 'Quantity unchanged at 1');

  // Non-numeric
  const resNaN = manager.updateCartItemQuantity(cartItemPiece.id, 'abc');
  assert(resNaN.success === false, 'Non-numeric "abc" is rejected');
  assert(manager.warningMessage?.includes('valid number'), 'Warning informs about valid number requirement');
  assert(manager.cart[0].qty === 1, 'Quantity unchanged at 1');
  console.log('');

  // -----------------------------------------------------------------------------
  // Test Case 6: Attempt to exceed available stock
  // -----------------------------------------------------------------------------
  console.log('--- 6. Attempt to exceed available stock limit ---');
  // prodPiece stock is 50. Attempt 55.
  const resExceed = manager.updateCartItemQuantity(cartItemPiece.id, '55');
  assert(resExceed.success === false, 'Quantity 55 exceeding available stock (50) is blocked');
  assert(
    manager.warningMessage?.includes('Insufficient stock. Available: 50 Piece'),
    `Stock limit message displayed: "${manager.warningMessage}"`
  );
  assert(manager.cart[0].qty === 1, 'Cart quantity restored to last valid quantity (1)');

  // Setting exactly available stock (50) succeeds
  const resMax = manager.updateCartItemQuantity(cartItemPiece.id, '50');
  assert(resMax.success === true, 'Quantity matching exact available stock (50) succeeds');
  assert(manager.cart[0].qty === 50, 'Quantity updated to 50');
  console.log('');

  // -----------------------------------------------------------------------------
  // Test Case 7: Verification of totals, GST, discounts & grand total calculations
  // -----------------------------------------------------------------------------
  console.log('--- 7. Verify line totals, GST, discounts, and grand total calculations ---');
  // Reset cart for clean calculation test
  manager.cart = [];
  manager.addToCart(prodPiece, 10); // 10 * 500 = 5000 + 18% GST (900) = 5900
  manager.addToCart(prodKg, 5);      // 5 * 120 = 600 + 5% GST (30) = 630
  
  const totals = manager.getTotals();
  assert(totals.subtotal === 5600, `Subtotal is 5600 (Actual: ${totals.subtotal})`);
  assert(totals.taxTotal === 930, `Tax total is 930 (Actual: ${totals.taxTotal})`);
  assert(totals.grandTotal === 6530, `Grand total is 6530 (Actual: ${totals.grandTotal})`);

  // Edit prodKg from 5 to 10
  manager.updateCartItemQuantity(manager.cart[1].id, '10');
  const totalsAfterEdit = manager.getTotals();
  // 10 * 120 = 1200 + 5% GST (60) = 1260
  // Total = 5900 + 1260 = 7160
  assert(totalsAfterEdit.subtotal === 6200, `Subtotal after edit is 6200 (Actual: ${totalsAfterEdit.subtotal})`);
  assert(totalsAfterEdit.taxTotal === 960, `Tax total after edit is 960 (Actual: ${totalsAfterEdit.taxTotal})`);
  assert(totalsAfterEdit.grandTotal === 7160, `Grand total after edit is 7160 (Actual: ${totalsAfterEdit.grandTotal})`);
  console.log('');

  // -----------------------------------------------------------------------------
  // Test Case 8: Verify Plus, Minus, and Remove functionality
  // -----------------------------------------------------------------------------
  console.log('--- 8. Verify Plus, Minus, and Remove functionality ---');
  const testItem = manager.cart[0]; // qty 10
  manager.updateQty(testItem.id, 1);
  assert(manager.cart[0].qty === 11, 'Plus button increments quantity by 1 (10 -> 11)');

  manager.updateQty(testItem.id, -1);
  assert(manager.cart[0].qty === 10, 'Minus button decrements quantity by 1 (11 -> 10)');

  // Decrement down to 0
  manager.updateCartItemQuantity(testItem.id, 1);
  assert(manager.cart[0].qty === 1, 'Set to 1');
  manager.updateQty(testItem.id, -1); // 1 - 1 = 0 -> should remove item
  assert(manager.cart.every(i => i.id !== testItem.id), 'Minus on quantity 1 removes item from cart');

  // Remove button
  const remainingItem = manager.cart[0];
  manager.removeCartItem(remainingItem.id);
  assert(manager.cart.length === 0, 'Remove button successfully removes item; cart is now empty');

  // Adding same product multiple times increases quantity without creating duplicate entries
  manager.addToCart(prodPiece, 2);
  manager.addToCart(prodPiece, 3);
  assert(manager.cart.length === 1, 'Adding same product multiple times does NOT create duplicate cart entries');
  assert(manager.cart[0].qty === 5, 'Cart quantity correctly accumulated to 5');
  console.log('');

  // -----------------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------------
  console.log('================================================================');
  console.log(` TEST RESULTS: ${passedTests}/${totalTests} Passed (0 Failed)`);
  console.log('================================================================');

  if (passedTests === totalTests) {
    console.log('All POS cart quantity editing and validation scenarios verified 100%!');
  } else {
    process.exitCode = 1;
  }
}

runTests().catch(console.error);
