import {
  PurchaseRequest,
  PurchaseInvoice,
  Supplier,
  Warehouse,
  Product
} from '../types';
import { purchaseRequestService } from './purchaseRequestService';
import { assertCallerPermission } from '../utils/rbac';

export type OrderDeliveryStatus = 'Pending' | 'Partially Received' | 'Received / Completed';

export interface OrderReceiveProductItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  orderedQty: number;
  previouslyReceivedQty: number;
  pendingQty: number;
  currentStock?: number;
  rate?: number;
}

export interface OrderReceiveHistoryEntry {
  id: string;
  date: string;
  receivedBy: string;
  role?: string;
  statusFrom?: string;
  statusTo: string;
  comments?: string;
}

export interface OrderReceiveItem {
  id: string; // Purchase Request ID or PO ID
  orderNumber: string; // Purchase Order / Bill Number
  purchaseOrderId?: string;
  purchaseRequestId?: string;
  supplierId?: string;
  supplierName: string;
  supplierContact: string;
  supplierPhone?: string;
  supplierEmail?: string;
  supplierGstin?: string;
  supplierAddress?: string;
  supplierInvoiceNumber: string;
  hasSupplierBill: boolean;
  purchaseInvoiceId?: string;
  orderedProductsSummary: string;
  productsCount: number;
  orderedQuantity: number;
  previouslyReceivedQuantity: number;
  pendingQuantity: number;
  expectedDeliveryDate: string;
  isOverdue: boolean;
  deliveryStatus: OrderDeliveryStatus;
  warehouseId: string;
  warehouseName: string;
  items: OrderReceiveProductItem[];
  history: OrderReceiveHistoryEntry[];
  notes?: string;
  createdAt: string;
}

export interface RecordOrderReceiveInput {
  orderId: string;
  purchaseRequestId?: string;
  purchaseOrderId?: string;
  receivingWarehouseId: string;
  supplierInvoiceNumber?: string;
  deliveryRemarks?: string;
  receivedItems: Array<{
    itemId: string;
    productId: string;
    arrivedQty: number;
    damagedQty: number;
    acceptedQty: number;
  }>;
}

export class OrderReceiveService {
  /**
   * Aggregates and returns all orders awaiting receipt and received deliveries.
   */
  getOrderReceiveList(params: {
    purchaseRequests: PurchaseRequest[];
    purchaseInvoices?: PurchaseInvoice[];
    suppliers?: Supplier[];
    warehouses?: Warehouse[];
    products?: Product[];
    todayStr?: string;
  }): OrderReceiveItem[] {
    const {
      purchaseRequests = [],
      purchaseInvoices = [],
      suppliers = [],
      warehouses = [],
      products = [],
      todayStr
    } = params;

    const today = todayStr || new Date().toISOString().split('T')[0];
    const results: OrderReceiveItem[] = [];
    const processedOrderNumbers = new Set<string>();

    // Helper map for quick supplier lookup
    const supplierMap = new Map<string, Supplier>();
    suppliers.forEach(s => {
      if (s.id) supplierMap.set(s.id, s);
      if (s.name) supplierMap.set(s.name.trim().toLowerCase(), s);
    });

    // Helper map for product SKU lookup
    const productMap = new Map<string, Product>();
    products.forEach(p => {
      if (p.id) productMap.set(p.id, p);
      if (p.name) productMap.set(p.name.trim().toLowerCase(), p);
    });

    // Helper map for warehouse lookup
    const warehouseMap = new Map<string, Warehouse>();
    warehouses.forEach(w => {
      if (w.id) warehouseMap.set(w.id, w);
    });

    // Helper function to resolve supplier invoice number from purchase invoices
    const findSupplierInvoiceNumber = (pr: PurchaseRequest): { invoiceNumber: string; hasBill: boolean; billId?: string } => {
      const match = purchaseInvoices.find(inv => {
        if (inv.docType !== 'purchase_invoice' && inv.docType !== 'purchase_receipt') return false;
        if (pr.purchaseOrderId && inv.purchaseOrderId === pr.purchaseOrderId) return true;
        if (pr.purchaseOrderNumber && (inv.purchaseOrderNumber === pr.purchaseOrderNumber || inv.referenceNumber === pr.purchaseOrderNumber)) return true;
        if (pr.id && inv.purchaseRequestId === pr.id) return true;
        if (pr.requestNumber && inv.purchaseRequestNumber === pr.requestNumber) return true;
        return false;
      });

      if (match && match.invoiceNumber) {
        return {
          invoiceNumber: match.invoiceNumber,
          hasBill: true,
          billId: match.id
        };
      }

      return {
        invoiceNumber: 'Pending Supplier Bill',
        hasBill: false
      };
    };

    // 1. Process purchase requests that are in Ordered, Partially Received, Completed, or Approved with a PO
    const eligibleRequests = purchaseRequests.filter(pr => {
      return (
        pr.status === 'Ordered' ||
        pr.status === 'Partially Received' ||
        pr.status === 'Completed' ||
        Boolean(pr.purchaseOrderNumber || pr.purchaseOrderId)
      );
    });

    for (const pr of eligibleRequests) {
      const orderNumber = pr.purchaseOrderNumber || pr.requestNumber || `PO-${pr.id.slice(0, 8)}`;
      processedOrderNumbers.add(orderNumber.toLowerCase());

      // Resolve supplier information
      let matchedSupplier: Supplier | undefined;
      // Look through PR history comments for recorded supplier info
      let supplierNameCandidate = '';
      if (pr.history) {
        for (const h of pr.history) {
          if (h.comments) {
            const vendorMatch = h.comments.match(/Vendor:\s*([^)]+)/i);
            if (vendorMatch && vendorMatch[1]) {
              supplierNameCandidate = vendorMatch[1].trim();
              break;
            }
          }
        }
      }

      // If supplier candidate found, match supplier
      if (supplierNameCandidate) {
        matchedSupplier = supplierMap.get(supplierNameCandidate.toLowerCase());
      }

      // If not, check if any purchase invoice linked has supplier
      const billLink = findSupplierInvoiceNumber(pr);
      if (!matchedSupplier && billLink.hasBill && billLink.billId) {
        const bill = purchaseInvoices.find(b => b.id === billLink.billId);
        if (bill) {
          matchedSupplier = supplierMap.get(bill.supplierId) || (bill.supplierName ? supplierMap.get(bill.supplierName.trim().toLowerCase()) : undefined);
          if (!supplierNameCandidate && bill.supplierName) {
            supplierNameCandidate = bill.supplierName;
          }
        }
      }

      // Fallback: If still no supplier candidate, check suppliers list
      if (!matchedSupplier && suppliers.length > 0) {
        matchedSupplier = suppliers[0];
        supplierNameCandidate = matchedSupplier.name;
      }

      const finalSupplierName = matchedSupplier?.name || supplierNameCandidate || 'Registered Supplier';
      const supplierContact = (matchedSupplier?.phone && matchedSupplier.phone.trim()) ||
        (matchedSupplier?.email && matchedSupplier.email.trim()) ||
        'Not available';

      // Map line items
      let rawPrItems = pr.items && pr.items.length > 0 ? pr.items : [];
      if (rawPrItems.length === 0 && (pr.purchaseOrderId || pr.purchaseOrderNumber)) {
        const poInv = purchaseInvoices.find(inv =>
          (pr.purchaseOrderId && (inv.id === pr.purchaseOrderId || inv.purchaseOrderId === pr.purchaseOrderId)) ||
          (pr.purchaseOrderNumber && (inv.invoiceNumber === pr.purchaseOrderNumber || inv.purchaseOrderNumber === pr.purchaseOrderNumber || inv.referenceNumber === pr.purchaseOrderNumber))
        );
        if (poInv && poInv.items && poInv.items.length > 0) {
          rawPrItems = poInv.items as any;
        }
      }

      let totalOrderedQty = 0;
      let totalReceivedQty = 0;

      const orderItems: OrderReceiveProductItem[] = rawPrItems.map((it: any, idx: number) => {
        const prodId = it.productId || it.product_id;
        const prodName = it.productName || it.product_name;
        const prod = productMap.get(prodId) || (prodName ? productMap.get(prodName.trim().toLowerCase()) : undefined);
        const ordered = Number(
          it.approvedQty !== null && it.approvedQty !== undefined && it.approvedQty > 0
            ? it.approvedQty
            : (it.requestedQty ?? it.qty ?? it.quantity ?? it.ordered_qty ?? it.orderedQty ?? 0)
        ) || 0;
        const received = Math.max(0, Number(it.receivedQty || it.received_qty || 0));
        const pending = Math.max(0, ordered - received);

        totalOrderedQty += ordered;
        totalReceivedQty += received;

        return {
          id: it.id || `pr-item-${idx}`,
          productId: prodId || prod?.id || `item-${idx}`,
          productName: prodName || prod?.name || 'Item',
          sku: it.sku || prod?.sku || 'SKU-N/A',
          unit: it.unit || prod?.primaryUnit || 'Piece',
          orderedQty: ordered,
          previouslyReceivedQty: received,
          pendingQty: pending,
          currentStock: prod?.currentStock || 0,
          rate: it.estimatedCost || it.rate || prod?.purchasePrice || prod?.costPrice || 0
        };
      });

      const pendingQuantity = Math.max(0, totalOrderedQty - totalReceivedQty);

      // Determine delivery status:
      // - Pending: Nothing received yet
      // - Partially Received: Some items or quantities remain outstanding
      // - Received / Completed: All required quantities have been received and accepted
      let deliveryStatus: OrderDeliveryStatus = 'Pending';
      if (totalReceivedQty === 0) {
        deliveryStatus = 'Pending';
      } else if (pendingQuantity > 0) {
        deliveryStatus = 'Partially Received';
      } else {
        deliveryStatus = 'Received / Completed';
      }

      // Format expected delivery date
      const expectedDeliveryDate = pr.requestedDeliveryDate || pr.createdAt?.split('T')[0] || today;
      const isOverdue = deliveryStatus !== 'Received / Completed' && Boolean(expectedDeliveryDate && expectedDeliveryDate < today);

      // Warehouse name resolution
      const warehouse = warehouseMap.get(pr.warehouseId);
      const warehouseName = pr.warehouseName || warehouse?.name || 'Main Warehouse';

      // History entries
      const historyEntries: OrderReceiveHistoryEntry[] = (pr.history || []).map(h => ({
        id: h.id,
        date: h.createdAt,
        receivedBy: h.userName || 'Warehouse Staff',
        role: h.role,
        statusFrom: h.statusFrom,
        statusTo: h.statusTo,
        comments: h.comments
      }));

      // Ordered products summary
      const productNames = orderItems.map(i => i.productName);
      const orderedProductsSummary = productNames.length > 0
        ? productNames.join(', ')
        : 'No products';

      results.push({
        id: pr.id,
        orderNumber,
        purchaseOrderId: pr.purchaseOrderId,
        purchaseRequestId: pr.id,
        supplierId: matchedSupplier?.id,
        supplierName: finalSupplierName,
        supplierContact,
        supplierPhone: matchedSupplier?.phone,
        supplierEmail: matchedSupplier?.email,
        supplierGstin: matchedSupplier?.gstin,
        supplierAddress: matchedSupplier?.address,
        supplierInvoiceNumber: billLink.invoiceNumber,
        hasSupplierBill: billLink.hasBill,
        purchaseInvoiceId: billLink.billId,
        orderedProductsSummary,
        productsCount: orderItems.length,
        orderedQuantity: totalOrderedQty,
        previouslyReceivedQuantity: totalReceivedQty,
        pendingQuantity,
        expectedDeliveryDate,
        isOverdue,
        deliveryStatus,
        warehouseId: pr.warehouseId,
        warehouseName,
        items: orderItems,
        history: historyEntries,
        notes: pr.notes,
        createdAt: pr.createdAt
      });
    }

    // 2. Also check if there are standalone purchase bills with doc_type 'purchase_order' not already covered
    for (const inv of purchaseInvoices) {
      if (inv.docType === 'purchase_order') {
        const poNum = inv.invoiceNumber || inv.referenceNumber || inv.id;
        if (processedOrderNumbers.has(poNum.toLowerCase())) {
          continue;
        }

        const linkedPr = purchaseRequests.find(r =>
          (inv.id && r.purchaseOrderId === inv.id) ||
          (poNum && r.purchaseOrderNumber === poNum) ||
          r.id === (inv as any).purchase_request_id ||
          r.id === (inv as any).purchaseRequestId ||
          Boolean(inv.notes && r.requestNumber && inv.notes.includes(r.requestNumber))
        );

        let sup = supplierMap.get(inv.supplierId) || (inv.supplierName ? supplierMap.get(inv.supplierName.trim().toLowerCase()) : undefined);
        if (!sup && linkedPr) {
          sup = supplierMap.get((linkedPr as any).supplierId) || ((linkedPr as any).supplierName ? supplierMap.get((linkedPr as any).supplierName.trim().toLowerCase()) : undefined);
        }
        if (!sup && suppliers.length > 0) {
          sup = suppliers[0];
        }
        const supplierName = sup?.company || sup?.name || inv.supplierName || 'Registered Supplier';
        const supplierContact = (sup?.phone && sup.phone.trim()) || (sup?.email && sup.email.trim()) || 'Not available';

        const rawItems = (inv.items && inv.items.length > 0)
          ? inv.items
          : (inv as any).purchase_order_items && (inv as any).purchase_order_items.length > 0
          ? (inv as any).purchase_order_items
          : (inv as any).purchase_items && (inv as any).purchase_items.length > 0
          ? (inv as any).purchase_items
          : linkedPr?.items || [];

        let totalOrderedQty = 0;
        let totalReceivedQty = 0;
        const items: OrderReceiveProductItem[] = rawItems.map((it: any, idx: number) => {
          const prodId = it.productId || it.product_id;
          const prodName = it.productName || it.product_name;
          const prod = productMap.get(prodId) || (prodName ? productMap.get(prodName.trim().toLowerCase()) : undefined);
          const ordered = Number(it.qty || it.ordered_qty || it.requestedQty || it.approvedQty || 0);
          const received = Math.max(0, Number(it.receivedQty || it.received_qty || 0));
          const pending = Math.max(0, ordered - received);
          totalOrderedQty += ordered;
          totalReceivedQty += received;

          return {
            id: it.id || `po-item-${idx}`,
            productId: prodId || prod?.id || `item-${idx}`,
            productName: prodName || prod?.name || 'Item',
            sku: it.sku || prod?.sku || 'SKU-N/A',
            unit: it.unit || prod?.primaryUnit || 'Piece',
            orderedQty: ordered,
            previouslyReceivedQty: received,
            pendingQty: pending,
            currentStock: prod?.currentStock || 0,
            rate: it.rate || it.unit_cost || prod?.purchasePrice || prod?.costPrice || 0
          };
        });

        // Check if there is an accompanying purchase invoice
        const bill = purchaseInvoices.find(b => b.docType === 'purchase_invoice' && (b.purchaseOrderId === inv.id || b.purchaseOrderNumber === poNum || b.referenceNumber === poNum));

        const pendingQuantity = Math.max(0, totalOrderedQty - totalReceivedQty);
        let deliveryStatus: OrderDeliveryStatus = 'Pending';
        if (totalReceivedQty === 0) {
          deliveryStatus = 'Pending';
        } else if (pendingQuantity > 0) {
          deliveryStatus = 'Partially Received';
        } else {
          deliveryStatus = 'Received / Completed';
        }

        const warehouseId = inv.warehouse || linkedPr?.warehouseId || warehouses[0]?.id || '00000000-0000-0000-0000-000000000002';
        const warehouse = warehouseMap.get(warehouseId);
        const warehouseName = warehouse?.name || (inv as any).warehouseName || linkedPr?.warehouseName || 'Main Warehouse';

        results.push({
          id: inv.id,
          orderNumber: poNum,
          purchaseOrderId: inv.id,
          purchaseRequestId: linkedPr?.id,
          supplierId: inv.supplierId || sup?.id,
          supplierName,
          supplierContact,
          supplierPhone: sup?.phone,
          supplierEmail: sup?.email,
          supplierGstin: inv.supplierGstin || sup?.gstin,
          supplierAddress: sup?.address,
          supplierInvoiceNumber: bill?.invoiceNumber || 'Pending Supplier Bill',
          hasSupplierBill: Boolean(bill),
          purchaseInvoiceId: bill?.id,
          orderedProductsSummary: items.map(i => i.productName).join(', ') || 'No products',
          productsCount: items.length,
          orderedQuantity: totalOrderedQty,
          previouslyReceivedQuantity: totalReceivedQty,
          pendingQuantity,
          expectedDeliveryDate: inv.dueDate || inv.date || today,
          isOverdue: Boolean((inv.dueDate || inv.date) && (inv.dueDate || inv.date) < today),
          deliveryStatus,
          warehouseId,
          warehouseName,
          items,
          history: [],
          notes: inv.notes,
          createdAt: inv.createdAt || new Date().toISOString()
        });
      }
    }

    // Sort order:
    // 1. Pending & Partially Received first
    // 2. Overdue first within active
    // 3. Expected delivery date ascending
    // 4. Completed at the end
    return results.sort((a, b) => {
      const isAActive = a.deliveryStatus !== 'Received / Completed';
      const isBActive = b.deliveryStatus !== 'Received / Completed';
      if (isAActive && !isBActive) return -1;
      if (!isAActive && isBActive) return 1;

      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;

      return (a.expectedDeliveryDate || '').localeCompare(b.expectedDeliveryDate || '');
    });
  }

  /**
   * Confirms and saves goods receipt, updating stock atomically for accepted items only.
   */
  async confirmGoodsReceipt(
    input: RecordOrderReceiveInput,
    companyId?: string,
    user?: { id: string; name: string; role?: string }
  ): Promise<any> {
    // Strict RBAC: only authorized warehouse manager / admin / owner can confirm goods receipt
    await assertCallerPermission('inventory', 'create');

    const {
      orderId,
      purchaseRequestId,
      receivingWarehouseId,
      supplierInvoiceNumber,
      deliveryRemarks,
      receivedItems
    } = input;

    // Validation 1: At least one item has arrivedQty > 0
    const totalArrived = receivedItems.reduce((sum, item) => sum + (Number(item.arrivedQty) || 0), 0);
    if (totalArrived <= 0) {
      throw new Error('Please enter at least one positive received quantity to confirm goods receipt.');
    }

    // Validation 2: Damaged quantity cannot exceed arrived quantity
    for (const item of receivedItems) {
      const arrived = Number(item.arrivedQty) || 0;
      const damaged = Math.max(0, Number(item.damagedQty) || 0);
      if (damaged > arrived) {
        throw new Error(`Damaged quantity (${damaged}) cannot exceed arrived quantity (${arrived}) for item #${item.productId}.`);
      }
    }

    const targetRequestId = purchaseRequestId || orderId;

    // Use purchaseRequestService.recordGoodsReceipt to atomically update stock, log stock transaction,
    // and transition status to Partially Received or Completed.
    const res = await purchaseRequestService.recordGoodsReceipt(
      {
        requestId: targetRequestId,
        receivingWarehouseId,
        invoiceNumber: supplierInvoiceNumber,
        notes: deliveryRemarks,
        receivedItems: receivedItems.map(it => ({
          itemId: it.itemId,
          productId: it.productId,
          receivedQty: it.arrivedQty,
          damagedQty: it.damagedQty,
          acceptedQty: it.acceptedQty
        }))
      },
      companyId,
      user
    );

    return res;
  }
}

export const orderReceiveService = new OrderReceiveService();
