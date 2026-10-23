import { StockStatusType } from '../types';

/**
 * Calculates stock status dynamically using the product's current stock quantity
 * and its manually configured Stock Warning Limit threshold.
 *
 * Priorities:
 * 1. If available stock is zero or less (or missing/invalid) -> 'Out of Stock'
 * 2. If warning limit is not configured (null, undefined, or empty) -> 'Not Set'
 * 3. If available stock is less than or equal to warning limit -> 'Limited Stock'
 * 4. Otherwise -> 'Active'
 */
export function calculateStockStatus(
  currentStock: number | null | undefined,
  reorderLevel: number | null | undefined
): StockStatusType {
  // 1. Missing, null, undefined, non-numeric, or zero/negative stock clamped to 0 -> Out of Stock (never Active even if warning limit is 0)
  const rawStock = currentStock !== null && currentStock !== undefined && !isNaN(Number(currentStock)) ? Number(currentStock) : 0;
  const stock = Math.max(0, rawStock);

  if (stock <= 0) {
    return 'Out of Stock';
  }

  // 2. Check if warning limit threshold is configured
  const hasThreshold =
    reorderLevel !== null &&
    reorderLevel !== undefined &&
    reorderLevel !== ('' as any) &&
    !isNaN(Number(reorderLevel));

  if (!hasThreshold) {
    // Available stock is positive and no lower threshold is set
    return 'Active';
  }

  const limit = Number(reorderLevel);

  // 3. Available stock is at or below the configured warning limit
  if (stock <= limit) {
    return 'Limited Stock';
  }

  // 4. Available stock is strictly above warning limit
  return 'Active';
}

/**
 * Helper to determine if a product has a valid configured stock warning limit.
 */
export function hasWarningLimit(reorderLevel: number | null | undefined): boolean {
  return (
    reorderLevel !== null &&
    reorderLevel !== undefined &&
    reorderLevel !== ('' as any) &&
    !isNaN(Number(reorderLevel)) &&
    Number(reorderLevel) >= 0
  );
}

export interface StockValidationResult {
  valid: boolean;
  errorMessage?: string;
  availableStock: number;
  unit: string;
}

/**
 * Validates stock availability for selling a product.
 * Returns valid: true if enough stock is available.
 * If available stock is 0: "No stock available — This product cannot be billed because no stock is available."
 * If requested quantity > available stock: "Insufficient stock. Available: [quantity] [unit]."
 */
export function validateStockAvailability(
  availableStock: number | null | undefined,
  requestedQty: number,
  unit = 'Pcs'
): StockValidationResult {
  const available = Math.max(0, availableStock !== null && availableStock !== undefined ? Number(availableStock) : 0);
  const requested = Number(requestedQty) || 0;
  const safeUnit = unit || 'Pcs';

  if (available <= 0) {
    return {
      valid: false,
      errorMessage: 'No stock available — This product cannot be billed because no stock is available.',
      availableStock: 0,
      unit: safeUnit
    };
  }

  if (requested > available) {
    return {
      valid: false,
      errorMessage: `Insufficient stock. Available: ${available} ${safeUnit}.`,
      availableStock: available,
      unit: safeUnit
    };
  }

  return {
    valid: true,
    availableStock: available,
    unit: safeUnit
  };
}

export interface CartStockCheckItem {
  productId: string;
  productName?: string;
  qty: number;
  unit?: string;
}

/**
 * Aggregates requested quantities by product and validates against available stock.
 */
export function validateCartStock(
  items: CartStockCheckItem[],
  getStockForProduct: (productId: string) => { available: number; unit: string }
): StockValidationResult {
  const aggregated: Record<string, { qty: number; unit: string; productName?: string }> = {};

  for (const item of items) {
    if (!item.productId) continue;
    if (!aggregated[item.productId]) {
      aggregated[item.productId] = {
        qty: 0,
        unit: item.unit || 'Pcs',
        productName: item.productName
      };
    }
    aggregated[item.productId].qty += Number(item.qty) || 0;
  }

  for (const [productId, req] of Object.entries(aggregated)) {
    const stockInfo = getStockForProduct(productId);
    const available = stockInfo?.available !== undefined ? stockInfo.available : 0;
    const unit = stockInfo?.unit || req.unit || 'Pcs';

    const result = validateStockAvailability(available, req.qty, unit);
    if (!result.valid) {
      return result;
    }
  }

  return {
    valid: true,
    availableStock: 0,
    unit: ''
  };
}

