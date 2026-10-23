import { Supplier, PurchaseRequest } from '../types';

/**
 * Normalizes supplier identifiers for reliable cross-referencing.
 */
function normalizeStr(str?: string | null): string {
  return (str || '').trim().toLowerCase();
}

/**
 * Extracts a vendor name from a purchase request's audit history comments.
 */
export function extractSupplierNameFromRequest(req: PurchaseRequest): string | null {
  if (req.history) {
    for (const h of req.history) {
      if (h.comments && h.comments.includes('Vendor:')) {
        const match = h.comments.match(/Vendor:\s*([^)]+)/);
        if (match && match[1]) {
          return match[1].trim();
        }
      }
    }
  }
  return null;
}

/**
 * Checks whether an order row is linked to a specific supplier.
 */
function doesOrderMatchSupplier(
  order: any,
  targetId?: string | null,
  targetName?: string | null
): boolean {
  const normTargetId = normalizeStr(targetId);
  const normTargetName = normalizeStr(targetName);

  const poSuppId = normalizeStr(order.supplier_id || order.supplierId);
  const poSuppName = normalizeStr(order.supplier_name || order.supplierName);

  if (normTargetId && poSuppId && normTargetId === poSuppId) {
    return true;
  }
  if (normTargetName && poSuppName && normTargetName === poSuppName) {
    return true;
  }
  return false;
}

/**
 * Evaluates whether a purchase order has pending delivery obligations.
 * Returns true if the order is active, requiring delivery, and not yet fulfilled or cancelled.
 */
export function isPurchaseOrderActiveDelivery(po: any): boolean {
  if (!po) return false;

  const rawStatus = (po.status || 'Ordered').trim();
  const statusLower = rawStatus.toLowerCase();

  // Cancelled or rejected orders do not represent active delivery obligations
  if (statusLower === 'cancelled' || statusLower === 'rejected') {
    return false;
  }

  // Calculate ordered vs received quantities
  let orderedQty = 0;
  let receivedQty = 0;

  const items = po.purchase_order_items || po.items || [];
  if (Array.isArray(items) && items.length > 0) {
    items.forEach((it: any) => {
      const oq = Number(it.qty || it.orderedQty || it.requestedQty || 0);
      const rq = Number(it.receivedQty || it.received_qty || 0);
      orderedQty += oq;
      receivedQty += rq;
    });
  } else {
    orderedQty = Number(po.qty || 1);
    receivedQty = Number(po.received_qty || 0);
  }

  const pendingQty = Math.max(0, orderedQty - receivedQty);

  // Fully delivered / completed orders are closed
  if (statusLower === 'completed' || statusLower === 'delivered') {
    return false;
  }
  if (orderedQty > 0 && pendingQty === 0) {
    return false;
  }

  // If there are pending units, or order is in Ordered / In Transit / Partially Received state
  return pendingQty > 0 || statusLower === 'ordered' || statusLower === 'in transit' || statusLower === 'partially received';
}

/**
 * Evaluates whether a purchase request has pending delivery obligations.
 */
export function isPurchaseRequestActiveDelivery(req: PurchaseRequest): boolean {
  if (!req) return false;

  const statusLower = (req.status || '').toLowerCase();
  const isOrderStage = statusLower === 'ordered' || statusLower === 'partially received';
  if (!isOrderStage) return false;

  let orderedQty = 0;
  let receivedQty = 0;

  (req.items || []).forEach(it => {
    const targetQty = it.approvedQty !== null && it.approvedQty !== undefined ? it.approvedQty : it.requestedQty;
    orderedQty += Number(targetQty || 0);
    receivedQty += Number(it.receivedQty || 0);
  });

  const pendingQty = Math.max(0, orderedQty - receivedQty);
  return pendingQty > 0 || statusLower === 'ordered';
}

/**
 * Calculates whether a supplier is Active or Inactive based on pending delivery obligations.
 *
 * Rules:
 * - Active: The supplier has at least one purchase order that requires delivery and is not yet completed.
 * - Inactive: The supplier has no pending deliveries (all assigned delivery orders are completed/closed).
 * - Cancelled or rejected orders do not keep a supplier Active.
 * - Historical purchase bills/invoices without pending deliveries do not make a supplier Active.
 * - Supplier contact details and history are 100% preserved.
 */
export function determineSupplierStatus(
  supplierId: string | null | undefined,
  supplierName: string | null | undefined,
  context: {
    purchaseOrders?: any[];
    purchaseRequests?: PurchaseRequest[];
  }
): 'Active' | 'Inactive' {
  const normId = normalizeStr(supplierId);
  const normName = normalizeStr(supplierName);

  if (!normId && !normName) {
    return 'Inactive';
  }

  const processedOrderKeys = new Set<string>();

  // 1. Inspect purchase orders
  const orders = context.purchaseOrders || [];
  for (const po of orders) {
    if (doesOrderMatchSupplier(po, normId, normName)) {
      const orderKey = po.order_number || po.invoice_number || po.id;
      if (orderKey) processedOrderKeys.add(String(orderKey).trim().toLowerCase());

      if (isPurchaseOrderActiveDelivery(po)) {
        return 'Active';
      }
    }
  }

  // 2. Inspect purchase requests in Ordered / In Transit / Partially Received state
  const requests = context.purchaseRequests || [];
  for (const req of requests) {
    const poNum = req.purchaseOrderNumber || req.purchaseOrderId;
    if (poNum && processedOrderKeys.has(String(poNum).trim().toLowerCase())) {
      continue;
    }

    const suppNameFromReq = extractSupplierNameFromRequest(req);
    const matchesSupplier =
      (normId && (normalizeStr((req as any).supplierId) === normId || normalizeStr((req as any).supplier_id) === normId)) ||
      (normName && (normalizeStr(suppNameFromReq) === normName || normalizeStr((req as any).supplierName) === normName));

    if (matchesSupplier && isPurchaseRequestActiveDelivery(req)) {
      return 'Active';
    }
  }

  // No active delivery obligations found
  return 'Inactive';
}

/**
 * Maps a list of suppliers and returns updated supplier objects with automatic Active / Inactive delivery statuses.
 * Preserves all contact info, bank details, and purchase records.
 */
export function enrichSuppliersWithDeliveryStatus(
  suppliers: Supplier[],
  context: {
    purchaseOrders?: any[];
    purchaseRequests?: PurchaseRequest[];
  }
): Supplier[] {
  return (suppliers || []).map(sup => {
    const autoStatus = determineSupplierStatus(sup.id, sup.name || sup.company, context);
    return {
      ...sup,
      status: autoStatus
    };
  });
}
