/**
 * Product and inventory sorting utilities for UNIVERSAL BILLING.
 *
 * Rules:
 * 1. Default A -> Z by product name.
 * 2. Case-insensitive comparison (e.g. 'chair', 'Cement', 'paint' => 'Cement', 'chair', 'paint').
 * 3. Ignore leading and trailing spaces when comparing names.
 * 4. Deterministic secondary tie-breaker using SKU (alphabetical/numeric case-insensitive).
 * 5. Deterministic tertiary tie-breaker using product ID.
 * 6. Preserves separate products even if names are identical.
 */

export function extractProductName(item: any): string {
  if (!item) return '';
  if (typeof item === 'string') return item.trim();
  if (typeof item.product === 'object' && item.product) {
    return (item.product.name ?? item.product.productName ?? '').trim();
  }
  return (item.name ?? item.productName ?? item.title ?? '').trim();
}

export function extractProductSku(item: any): string {
  if (!item) return '';
  if (typeof item.product === 'object' && item.product) {
    return (item.product.sku ?? item.product.code ?? '').trim();
  }
  return (item.sku ?? item.code ?? '').trim();
}

export function extractProductId(item: any): string {
  if (!item) return '';
  if (typeof item.product === 'object' && item.product) {
    return (item.product.id ?? '').trim();
  }
  return (item.id ?? item.productId ?? '').trim();
}

export function compareProductsAZ<T = any>(a: T, b: T): number {
  const nameA = extractProductName(a);
  const nameB = extractProductName(b);

  // 1. Primary sort: Case-insensitive comparison
  const nameCmp = nameA.localeCompare(nameB, undefined, { sensitivity: 'base', numeric: true });
  if (nameCmp !== 0) return nameCmp;

  // 2. Exact casing fallback if names are identical except for case
  const caseCmp = nameA.localeCompare(nameB, undefined, { numeric: true });
  if (caseCmp !== 0) return caseCmp;

  // 3. Secondary tie-breaker: SKU (case-insensitive + numeric)
  const skuA = extractProductSku(a);
  const skuB = extractProductSku(b);
  const skuCmp = skuA.localeCompare(skuB, undefined, { sensitivity: 'base', numeric: true });
  if (skuCmp !== 0) return skuCmp;

  // 4. Tertiary tie-breaker: ID
  const idA = extractProductId(a);
  const idB = extractProductId(b);
  return idA.localeCompare(idB);
}

export function sortProductsAZ<T = any>(list: T[]): T[] {
  if (!Array.isArray(list)) return [];
  return [...list].sort(compareProductsAZ);
}
