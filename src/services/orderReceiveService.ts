import {
  PurchaseRequest,
  PurchaseInvoice,
  Supplier,
  Warehouse,
  Product,
  SupplierDeliveryStatus,
  SupplierDeliveryGroup,
  SupplierDeliveryProductItem,
  SupplierDeliveryPurchaseOrderSummary,
  RecordSupplierDeliveryInput,
  SupplierDeliveryReceiptResult
} from '../types';
import { purchaseRequestService } from './purchaseRequestService';
import { productService } from './productService';
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
   * Helper function to match supplier using actual database relationships.
   * Never falls back to suppliers[0] arbitrarily.
   */
  private resolveSupplierDetails(params: {
    explicitSupplierId?: string;
    explicitSupplierName?: string;
    supplierMapById: Map<string, Supplier>;
    supplierMapByName: Map<string, Supplier>;
    fallbackIdPrefix: string;
  }): {
    supplierId: string;
    supplierName: string;
    supplierCompany?: string;
    supplierContact: string;
    supplierPhone?: string;
    supplierEmail?: string;
    supplierGstin?: string;
    supplierAddress?: string;
  } {
    const { explicitSupplierId, explicitSupplierName, supplierMapById, supplierMapByName, fallbackIdPrefix } = params;

    let matchedSupplier: Supplier | undefined;
    if (explicitSupplierId) {
      matchedSupplier = supplierMapById.get(explicitSupplierId);
    }
    if (!matchedSupplier && explicitSupplierName) {
      matchedSupplier = supplierMapByName.get(explicitSupplierName.trim().toLowerCase());
    }

    const resolvedId = matchedSupplier?.id || explicitSupplierId || (explicitSupplierName ? `vendor-${explicitSupplierName.toLowerCase().replace(/\s+/g, '-')}` : fallbackIdPrefix);
    const supplierName = matchedSupplier?.name || explicitSupplierName || 'Unassigned Supplier';
    const supplierCompany = matchedSupplier?.company || supplierName;
    const supplierContact = (matchedSupplier?.phone && matchedSupplier.phone.trim()) ||
      (matchedSupplier?.email && matchedSupplier.email.trim()) ||
      'Not available';

    return {
      supplierId: resolvedId,
      supplierName,
      supplierCompany,
      supplierContact,
      supplierPhone: matchedSupplier?.phone,
      supplierEmail: matchedSupplier?.email,
      supplierGstin: matchedSupplier?.gstin,
      supplierAddress: matchedSupplier?.address
    };
  }

  /**
   * Groups purchase orders by their actual supplier ID into Supplier Delivery Groups.
   * If a supplier has multiple approved purchase orders, all their outstanding
   * products are shown together while preserving each product's original PO reference.
   */
  getSupplierDeliveryGroups(params: {
    purchaseRequests: PurchaseRequest[];
    purchaseInvoices?: PurchaseInvoice[];
    suppliers?: Supplier[];
    warehouses?: Warehouse[];
    products?: Product[];
    todayStr?: string;
  }): SupplierDeliveryGroup[] {
    const {
      purchaseRequests = [],
      purchaseInvoices = [],
      suppliers = [],
      warehouses = [],
      products = [],
      todayStr
    } = params;

    const today = todayStr || new Date().toISOString().split('T')[0];

    // Maps for fast lookups
    const supplierById = new Map<string, Supplier>();
    const supplierByName = new Map<string, Supplier>();
    suppliers.forEach(s => {
      if (s.id) supplierById.set(s.id, s);
      if (s.name) supplierByName.set(s.name.trim().toLowerCase(), s);
      if (s.company) supplierByName.set(s.company.trim().toLowerCase(), s);
    });

    const productMap = new Map<string, Product>();
    products.forEach(p => {
      if (p.id) productMap.set(p.id, p);
      if (p.name) productMap.set(p.name.trim().toLowerCase(), p);
    });

    const warehouseMap = new Map<string, Warehouse>();
    warehouses.forEach(w => {
      if (w.id) warehouseMap.set(w.id, w);
    });

    // Helper to find supplier invoice from purchase bills
    const findSupplierInvoiceNumber = (orderId: string, orderNumber: string, reqId?: string, reqNumber?: string): { invoiceNumber?: string; hasBill: boolean } => {
      const match = purchaseInvoices.find(inv => {
        if (inv.docType !== 'purchase_invoice' && inv.docType !== 'purchase_receipt') return false;
        if (orderId && (inv.purchaseOrderId === orderId || inv.id === orderId)) return true;
        if (orderNumber && (inv.purchaseOrderNumber === orderNumber || inv.referenceNumber === orderNumber)) return true;
        if (reqId && inv.purchaseRequestId === reqId) return true;
        if (reqNumber && inv.purchaseRequestNumber === reqNumber) return true;
        return false;
      });

      if (match && match.invoiceNumber) {
        return { invoiceNumber: match.invoiceNumber, hasBill: true };
      }
      return { hasBill: false };
    };

    // Intermediate collection of individual POs
    interface ExtractedPO {
      orderId: string;
      orderNumber: string;
      purchaseOrderId?: string;
      purchaseRequestId?: string;
      supplierId: string;
      supplierName: string;
      supplierCompany?: string;
      supplierContact: string;
      supplierPhone?: string;
      supplierEmail?: string;
      supplierGstin?: string;
      supplierAddress?: string;
      warehouseId: string;
      warehouseName: string;
      expectedDeliveryDate: string;
      docType?: string;
      orderDate?: string;
      hasSupplierBill: boolean;
      supplierInvoiceNumber?: string;
      items: SupplierDeliveryProductItem[];
    }

    const extractedPOs: ExtractedPO[] = [];
    const processedOrderKeys = new Set<string>();

    // 1. Process purchase requests that are Ordered, Partially Received, Completed, or have a PO
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
      processedOrderKeys.add(orderNumber.toLowerCase());
      processedOrderKeys.add(pr.id.toLowerCase());
      if (pr.purchaseOrderId) processedOrderKeys.add(pr.purchaseOrderId.toLowerCase());

      // Find linked purchase_order doc in purchaseInvoices
      const linkedPoInv = purchaseInvoices.find(inv =>
        (pr.purchaseOrderId && (inv.id === pr.purchaseOrderId || inv.purchaseOrderId === pr.purchaseOrderId)) ||
        (pr.purchaseOrderNumber && (inv.invoiceNumber === pr.purchaseOrderNumber || inv.purchaseOrderNumber === pr.purchaseOrderNumber || inv.referenceNumber === pr.purchaseOrderNumber))
      );

      // Resolve supplier information using actual database relations
      let explicitSupplierId = pr.supplierId || linkedPoInv?.supplierId;
      let explicitSupplierName = pr.supplierName || linkedPoInv?.supplierName;

      // Check linked bill if supplierId still missing
      const billLink = findSupplierInvoiceNumber(pr.purchaseOrderId || pr.id, orderNumber, pr.id, pr.requestNumber);
      if (!explicitSupplierId && billLink.hasBill) {
        const bill = purchaseInvoices.find(b => b.invoiceNumber === billLink.invoiceNumber);
        if (bill?.supplierId) explicitSupplierId = bill.supplierId;
        if (!explicitSupplierName && bill?.supplierName) explicitSupplierName = bill.supplierName;
      }

      // Check PR history vendor comment
      if (!explicitSupplierName && pr.history) {
        for (const h of pr.history) {
          if (h.comments) {
            const m = h.comments.match(/Vendor:\s*([^)]+)/i);
            if (m && m[1]) {
              explicitSupplierName = m[1].trim();
              break;
            }
          }
        }
      }

      const supp = this.resolveSupplierDetails({
        explicitSupplierId,
        explicitSupplierName,
        supplierMapById: supplierById,
        supplierMapByName: supplierByName,
        fallbackIdPrefix: `unassigned-${pr.id}`
      });

      const warehouseId = pr.warehouseId || 'wh-default';
      const warehouse = warehouseMap.get(warehouseId);
      const warehouseName = pr.warehouseName || warehouse?.name || 'Main Warehouse';

      let rawItems = pr.items && pr.items.length > 0 ? pr.items : [];
      if (rawItems.length === 0 && linkedPoInv?.items && linkedPoInv.items.length > 0) {
        rawItems = linkedPoInv.items as any;
      }
      if (rawItems.length === 0) {
        continue;
      }

      const items: SupplierDeliveryProductItem[] = rawItems.map((it: any, idx: number) => {
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
        const rate = Number(it.estimatedCost || it.rate || it.cost || prod?.purchasePrice || prod?.costPrice || 0);

        let recStatus: SupplierDeliveryStatus = 'Pending';
        if (received === 0) recStatus = 'Pending';
        else if (pending === 0) recStatus = 'Received / Completed';
        else recStatus = 'Partially Received';

        return {
          id: `${orderNumber}_${it.id || idx}`,
          orderId: pr.id,
          orderNumber,
          purchaseOrderId: pr.purchaseOrderId,
          purchaseRequestId: pr.id,
          itemId: it.id || `item-${idx}`,
          productId: prodId || prod?.id || `prod-${idx}`,
          productName: prodName || prod?.name || 'Item',
          sku: it.sku || prod?.sku || 'SKU-N/A',
          unit: it.unit || prod?.primaryUnit || 'Piece',
          orderedQty: ordered,
          previouslyReceivedQty: received,
          pendingQty: pending,
          currentStock: prod?.currentStock || 0,
          rate,
          totalValue: ordered * rate,
          requiresBatch: Boolean(prod?.batchTracking),
          requiresExpiry: Boolean(prod?.expiryTracking),
          batchNumber: prod?.batchNumber || '',
          expiryDate: prod?.expiryDate || '',
          expectedDeliveryDate: pr.requestedDeliveryDate || pr.createdAt?.split('T')[0] || today,
          receivingStatus: recStatus
        };
      });

      extractedPOs.push({
        orderId: pr.id,
        orderNumber,
        purchaseOrderId: pr.purchaseOrderId,
        purchaseRequestId: pr.id,
        supplierId: supp.supplierId,
        supplierName: supp.supplierName,
        supplierCompany: supp.supplierCompany,
        supplierContact: supp.supplierContact,
        supplierPhone: supp.supplierPhone,
        supplierEmail: supp.supplierEmail,
        supplierGstin: supp.supplierGstin || pr.supplierGstin,
        supplierAddress: supp.supplierAddress,
        warehouseId,
        warehouseName,
        expectedDeliveryDate: pr.requestedDeliveryDate || pr.createdAt?.split('T')[0] || today,
        docType: 'purchase_order',
        orderDate: pr.createdAt?.split('T')[0] || today,
        hasSupplierBill: billLink.hasBill,
        supplierInvoiceNumber: billLink.invoiceNumber,
        items
      });
    }

    // 2. Process standalone POs in purchaseInvoices (with docType === 'purchase_order')
    for (const inv of purchaseInvoices) {
      if (inv.docType === 'purchase_order') {
        const poNum = inv.invoiceNumber || inv.referenceNumber || inv.id;
        if (processedOrderKeys.has(poNum.toLowerCase()) || processedOrderKeys.has(inv.id.toLowerCase())) {
          continue;
        }

        const supp = this.resolveSupplierDetails({
          explicitSupplierId: inv.supplierId,
          explicitSupplierName: inv.supplierName,
          supplierMapById: supplierById,
          supplierMapByName: supplierByName,
          fallbackIdPrefix: `unassigned-${inv.id}`
        });

        const warehouseId = inv.warehouse || 'wh-default';
        const warehouse = warehouseMap.get(warehouseId);
        const warehouseName = warehouse?.name || 'Main Warehouse';

        const rawItems = (inv.items && inv.items.length > 0)
          ? inv.items
          : (inv as any).purchase_order_items || (inv as any).purchase_items || [];
        if (rawItems.length === 0) {
          continue;
        }

        const items: SupplierDeliveryProductItem[] = rawItems.map((it: any, idx: number) => {
          const prodId = it.productId || it.product_id;
          const prodName = it.productName || it.product_name;
          const prod = productMap.get(prodId) || (prodName ? productMap.get(prodName.trim().toLowerCase()) : undefined);

          const ordered = Number(it.qty || it.ordered_qty || it.requestedQty || it.approvedQty || 0);
          const received = Math.max(0, Number(it.receivedQty || it.received_qty || 0));
          const pending = Math.max(0, ordered - received);
          const rate = Number(it.rate || it.cost || prod?.purchasePrice || prod?.costPrice || 0);

          let recStatus: SupplierDeliveryStatus = 'Pending';
          if (received === 0) recStatus = 'Pending';
          else if (pending === 0) recStatus = 'Received / Completed';
          else recStatus = 'Partially Received';

          return {
            id: `${poNum}_${it.id || idx}`,
            orderId: inv.id,
            orderNumber: poNum,
            purchaseOrderId: inv.id,
            purchaseRequestId: (inv as any).purchaseRequestId || (inv as any).purchase_request_id,
            itemId: it.id || `item-${idx}`,
            productId: prodId || prod?.id || `prod-${idx}`,
            productName: prodName || prod?.name || 'Item',
            sku: it.sku || prod?.sku || 'SKU-N/A',
            unit: it.unit || prod?.primaryUnit || 'Piece',
            orderedQty: ordered,
            previouslyReceivedQty: received,
            pendingQty: pending,
            currentStock: prod?.currentStock || 0,
            rate,
            totalValue: ordered * rate,
            requiresBatch: Boolean(prod?.batchTracking),
            requiresExpiry: Boolean(prod?.expiryTracking),
            batchNumber: prod?.batchNumber || '',
            expiryDate: prod?.expiryDate || '',
            expectedDeliveryDate: inv.dueDate || inv.date || today,
            receivingStatus: recStatus
          };
        });

        const billLink = findSupplierInvoiceNumber(inv.id, poNum);

        extractedPOs.push({
          orderId: inv.id,
          orderNumber: poNum,
          purchaseOrderId: inv.id,
          supplierId: supp.supplierId,
          supplierName: supp.supplierName,
          supplierCompany: supp.supplierCompany,
          supplierContact: supp.supplierContact,
          supplierPhone: supp.supplierPhone,
          supplierEmail: supp.supplierEmail,
          supplierGstin: supp.supplierGstin || inv.supplierGstin,
          supplierAddress: supp.supplierAddress,
          warehouseId,
          warehouseName,
          expectedDeliveryDate: inv.dueDate || inv.date || today,
          docType: 'purchase_order',
          orderDate: inv.date || today,
          hasSupplierBill: billLink.hasBill,
          supplierInvoiceNumber: billLink.invoiceNumber,
          items
        });
      }
    }

    // 3. GROUP BY ACTUAL SUPPLIER ID (and destination warehouse)
    const groupsMap = new Map<string, SupplierDeliveryGroup>();

    for (const po of extractedPOs) {
      // Grouping key: supplier ID and warehouse ID
      const groupKey = `${po.supplierId}__${po.warehouseId}`;
      let group = groupsMap.get(groupKey);

      const poOrdered = po.items.reduce((sum, i) => sum + i.orderedQty, 0);
      const poReceived = po.items.reduce((sum, i) => sum + i.previouslyReceivedQty, 0);
      const poPending = po.items.reduce((sum, i) => sum + i.pendingQty, 0);
      const poValue = po.items.reduce((sum, i) => sum + i.totalValue, 0);

      let poStatus: SupplierDeliveryStatus = 'Pending';
      if (poReceived === 0) poStatus = 'Pending';
      else if (poPending === 0) poStatus = 'Received / Completed';
      else poStatus = 'Partially Received';

      const poSummary: SupplierDeliveryPurchaseOrderSummary = {
        orderId: po.orderId,
        orderNumber: po.orderNumber,
        purchaseOrderId: po.purchaseOrderId,
        purchaseRequestId: po.purchaseRequestId,
        docType: po.docType,
        orderDate: po.orderDate,
        expectedDeliveryDate: po.expectedDeliveryDate,
        orderedQty: poOrdered,
        previouslyReceivedQty: poReceived,
        pendingQty: poPending,
        productsCount: po.items.length,
        totalValue: poValue,
        hasSupplierBill: po.hasSupplierBill,
        supplierInvoiceNumber: po.supplierInvoiceNumber,
        deliveryStatus: poStatus
      };

      if (!group) {
        group = {
          id: `deliv-${po.supplierId}-${po.warehouseId}`,
          supplierId: po.supplierId,
          supplierName: po.supplierName,
          supplierCompany: po.supplierCompany,
          supplierContact: po.supplierContact,
          supplierPhone: po.supplierPhone,
          supplierEmail: po.supplierEmail,
          supplierGstin: po.supplierGstin,
          supplierAddress: po.supplierAddress,
          warehouseId: po.warehouseId,
          warehouseName: po.warehouseName,
          purchaseOrders: [poSummary],
          purchaseOrderNumbers: [po.orderNumber],
          purchaseOrderIds: [po.orderId],
          items: [...po.items],
          purchaseOrdersCount: 1,
          productsPendingCount: po.items.filter(i => i.pendingQty > 0).length,
          totalOrderedQuantity: poOrdered,
          totalPreviouslyReceivedQuantity: poReceived,
          totalOutstandingQuantity: poPending,
          totalDeliveryValue: poValue,
          expectedDeliveryDate: po.expectedDeliveryDate,
          isOverdue: false,
          deliveryStatus: 'Pending',
          hasSupplierBill: po.hasSupplierBill,
          supplierInvoiceNumber: po.supplierInvoiceNumber
        };
        groupsMap.set(groupKey, group);
      } else {
        // Merge into existing supplier delivery group
        group.purchaseOrders.push(poSummary);
        if (!group.purchaseOrderNumbers.includes(po.orderNumber)) {
          group.purchaseOrderNumbers.push(po.orderNumber);
        }
        if (!group.purchaseOrderIds.includes(po.orderId)) {
          group.purchaseOrderIds.push(po.orderId);
        }
        group.items.push(...po.items);
        group.purchaseOrdersCount = group.purchaseOrders.length;
        group.totalOrderedQuantity += poOrdered;
        group.totalPreviouslyReceivedQuantity += poReceived;
        group.totalOutstandingQuantity += poPending;
        group.totalDeliveryValue += poValue;
        group.productsPendingCount = group.items.filter(i => i.pendingQty > 0).length;

        if (po.expectedDeliveryDate && (!group.expectedDeliveryDate || po.expectedDeliveryDate < group.expectedDeliveryDate)) {
          group.expectedDeliveryDate = po.expectedDeliveryDate;
        }

        if (po.hasSupplierBill) {
          group.hasSupplierBill = true;
          if (po.supplierInvoiceNumber && !group.supplierInvoiceNumber?.includes(po.supplierInvoiceNumber)) {
            group.supplierInvoiceNumber = group.supplierInvoiceNumber
              ? `${group.supplierInvoiceNumber}, ${po.supplierInvoiceNumber}`
              : po.supplierInvoiceNumber;
          }
        }
      }
    }

    // Compute overall status and overdue flag
    const groups = Array.from(groupsMap.values())
      .filter(g => g.items.length > 0 && g.totalOrderedQuantity > 0)
      .map(g => {
      let status: SupplierDeliveryStatus = 'Pending';
      if (g.totalPreviouslyReceivedQuantity === 0) {
        status = 'Pending';
      } else if (g.totalOutstandingQuantity === 0) {
        status = 'Received / Completed';
      } else {
        status = 'Partially Received';
      }

      const isOverdue = status !== 'Received / Completed' && Boolean(g.expectedDeliveryDate && g.expectedDeliveryDate < today);

      return {
        ...g,
        deliveryStatus: status,
        isOverdue
      };
    });

    // Sort order:
    // 1. Groups with pending quantities (actionable) first
    // 2. Overdue first
    // 3. Expected delivery date ascending
    // 4. Completed groups at the end
    return groups.sort((a, b) => {
      const aActive = a.deliveryStatus !== 'Received / Completed';
      const bActive = b.deliveryStatus !== 'Received / Completed';
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;

      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;

      return (a.expectedDeliveryDate || '').localeCompare(b.expectedDeliveryDate || '');
    });
  }

  /**
   * Backwards compatible: returns PO-level OrderReceiveItem array.
   */
  getOrderReceiveList(params: {
    purchaseRequests: PurchaseRequest[];
    purchaseInvoices?: PurchaseInvoice[];
    suppliers?: Supplier[];
    warehouses?: Warehouse[];
    products?: Product[];
    todayStr?: string;
  }): OrderReceiveItem[] {
    const groups = this.getSupplierDeliveryGroups(params);
    const results: OrderReceiveItem[] = [];

    for (const group of groups) {
      for (const po of group.purchaseOrders) {
        const poItems = group.items.filter(i => i.orderId === po.orderId || i.orderNumber === po.orderNumber);
        const productNames = poItems.map(i => i.productName);

        results.push({
          id: po.orderId,
          orderNumber: po.orderNumber,
          purchaseOrderId: po.purchaseOrderId,
          purchaseRequestId: po.purchaseRequestId,
          supplierId: group.supplierId,
          supplierName: group.supplierName,
          supplierContact: group.supplierContact,
          supplierPhone: group.supplierPhone,
          supplierEmail: group.supplierEmail,
          supplierGstin: group.supplierGstin,
          supplierAddress: group.supplierAddress,
          supplierInvoiceNumber: po.supplierInvoiceNumber || group.supplierInvoiceNumber || 'Pending Supplier Bill',
          hasSupplierBill: po.hasSupplierBill || group.hasSupplierBill,
          orderedProductsSummary: productNames.length > 0 ? productNames.join(', ') : 'No products',
          productsCount: po.productsCount,
          orderedQuantity: po.orderedQty,
          previouslyReceivedQuantity: po.previouslyReceivedQty,
          pendingQuantity: po.pendingQty,
          expectedDeliveryDate: po.expectedDeliveryDate || group.expectedDeliveryDate,
          isOverdue: po.deliveryStatus !== 'Received / Completed' && Boolean(po.expectedDeliveryDate && po.expectedDeliveryDate < (params.todayStr || new Date().toISOString().split('T')[0])),
          deliveryStatus: po.deliveryStatus,
          warehouseId: group.warehouseId,
          warehouseName: group.warehouseName,
          items: poItems.map(it => ({
            id: it.itemId,
            productId: it.productId,
            productName: it.productName,
            sku: it.sku,
            unit: it.unit,
            orderedQty: it.orderedQty,
            previouslyReceivedQty: it.previouslyReceivedQty,
            pendingQty: it.pendingQty,
            currentStock: it.currentStock,
            rate: it.rate
          })),
          history: [],
          createdAt: po.orderDate || new Date().toISOString()
        });
      }
    }

    return results;
  }

  /**
   * Confirms a single PO goods receipt (atomic stock update).
   */
  async confirmGoodsReceipt(
    input: RecordOrderReceiveInput,
    companyId?: string,
    user?: { id: string; name: string; role?: string }
  ): Promise<any> {
    await assertCallerPermission('inventory', 'create');

    const {
      orderId,
      purchaseRequestId,
      receivingWarehouseId,
      supplierInvoiceNumber,
      deliveryRemarks,
      receivedItems
    } = input;

    const totalArrived = receivedItems.reduce((sum, item) => sum + (Number(item.arrivedQty) || 0), 0);
    if (totalArrived <= 0) {
      throw new Error('Please enter at least one positive received quantity to confirm goods receipt.');
    }

    for (const item of receivedItems) {
      const arrived = Number(item.arrivedQty) || 0;
      const damaged = Math.max(0, Number(item.damagedQty) || 0);
      if (damaged > arrived) {
        throw new Error(`Damaged quantity (${damaged}) cannot exceed arrived quantity (${arrived}) for item #${item.productId}.`);
      }
    }

    const targetRequestId = purchaseRequestId || orderId;

    return purchaseRequestService.recordGoodsReceipt(
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
  }

  /**
   * Confirms a Supplier-Wise Delivery across one or multiple Purchase Orders.
   * Updates each PO independently, increments stock only for accepted quantities,
   * excludes damaged items from stock, and creates batch records where applicable.
   */
  async confirmSupplierDelivery(
    input: RecordSupplierDeliveryInput,
    companyId?: string,
    user?: { id: string; name: string; role?: string }
  ): Promise<SupplierDeliveryReceiptResult> {
    await assertCallerPermission('inventory', 'create');

    const {
      supplierId,
      receivingWarehouseId,
      supplierInvoiceNumber,
      deliveryRemarks,
      receivedItems
    } = input;

    if (!receivedItems || receivedItems.length === 0) {
      throw new Error('No items provided in supplier delivery receipt.');
    }

    const totalArrived = receivedItems.reduce((sum, it) => sum + (Number(it.arrivedQty) || 0), 0);
    if (totalArrived <= 0) {
      throw new Error('Please enter at least one positive received quantity to confirm goods receipt.');
    }

    // Validate damaged <= arrived for each item
    for (const it of receivedItems) {
      const arrived = Number(it.arrivedQty) || 0;
      const damaged = Math.max(0, Number(it.damagedQty) || 0);
      if (damaged > arrived) {
        throw new Error(`Damaged quantity (${damaged}) cannot exceed arrived quantity (${arrived}) for product #${it.productId}.`);
      }
    }

    // Group received items by their original purchase order/request
    const itemsByOrder = new Map<string, typeof receivedItems>();
    for (const it of receivedItems) {
      const orderKey = it.purchaseRequestId || it.purchaseOrderId || it.orderId;
      const list = itemsByOrder.get(orderKey) || [];
      list.push(it);
      itemsByOrder.set(orderKey, list);
    }

    const updatedOrders: Array<{
      orderId: string;
      orderNumber: string;
      status: string;
      receivedQty: number;
      acceptedQty: number;
    }> = [];

    let totalAcceptedAcrossOrders = 0;
    let totalDamagedAcrossOrders = 0;

    // Process each PO independently to update its line items and status correctly
    for (const [orderId, orderItems] of itemsByOrder.entries()) {
      const itemsPayload = orderItems.map(it => {
        const arrived = Math.max(0, Number(it.arrivedQty) || 0);
        const damaged = Math.max(0, Number(it.damagedQty) || 0);
        const accepted = it.acceptedQty !== undefined ? Number(it.acceptedQty) : Math.max(0, arrived - damaged);

        totalAcceptedAcrossOrders += accepted;
        totalDamagedAcrossOrders += damaged;

        return {
          itemId: it.itemId,
          productId: it.productId,
          receivedQty: arrived,
          damagedQty: damaged,
          acceptedQty: accepted
        };
      });

      // Execute atomic goods receipt for this PO
      const prRes = await purchaseRequestService.recordGoodsReceipt(
        {
          requestId: orderId,
          receivingWarehouseId,
          invoiceNumber: supplierInvoiceNumber,
          notes: deliveryRemarks,
          receivedItems: itemsPayload
        },
        companyId,
        user
      );

      // Handle batch tracking creation if batch details are provided
      for (const it of orderItems) {
        const arrived = Math.max(0, Number(it.arrivedQty) || 0);
        const damaged = Math.max(0, Number(it.damagedQty) || 0);
        const accepted = it.acceptedQty !== undefined ? Number(it.acceptedQty) : Math.max(0, arrived - damaged);

        if (it.batchNumber && it.batchNumber.trim() && accepted > 0) {
          try {
            await productService.createBatch(
              {
                productId: it.productId,
                productName: 'Product',
                warehouseId: receivingWarehouseId,
                batchNumber: it.batchNumber.trim(),
                expiryDate: it.expiryDate || '',
                mfgDate: it.mfgDate || '',
                purchaseDate: new Date().toISOString().split('T')[0],
                cost: 0,
                qty: accepted,
                status: 'Active'
              },
              companyId
            );
          } catch (batchErr) {
            console.warn('Batch creation note during supplier receipt:', batchErr);
          }
        }
      }

      updatedOrders.push({
        orderId: prRes.id,
        orderNumber: prRes.purchaseOrderNumber || prRes.requestNumber,
        status: prRes.status,
        receivedQty: itemsPayload.reduce((s, i) => s + i.receivedQty, 0),
        acceptedQty: itemsPayload.reduce((s, i) => s + i.acceptedQty, 0)
      });
    }

    return {
      supplierId,
      updatedOrders,
      totalAcceptedQty: totalAcceptedAcrossOrders,
      totalDamagedQty: totalDamagedAcrossOrders
    };
  }
}

export const orderReceiveService = new OrderReceiveService();
