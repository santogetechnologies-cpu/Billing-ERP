import { supabase } from '../lib/supabase';
import {
  CustomerReturn,
  CreateCustomerReturnInput,
  CustomerReturnCondition,
  Product
} from '../types';
import { getAppStorage } from '../utils/storageUtils';
import { inventoryService } from './inventoryService';

const CUSTOMER_RETURNS_STORAGE_KEY = (cId: string) => `universal_billing_customer_returns_${cId}`;

export const customerReturnService = {
  /**
   * Generates a sequential, professional customer return reference: RET-YYYY-XXXX
   */
  generateReturnNumber(existingCount: number = 0): string {
    const year = new Date().getFullYear();
    const seq = existingCount + 1;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `RET-${year}-${String(seq).padStart(4, '0')}`;
  },

  /**
   * Retrieves all customer return records for the company
   */
  async getCustomerReturns(companyId?: string): Promise<CustomerReturn[]> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    let returns: CustomerReturn[] = [];

    // 1. Try Supabase customer_returns table if available
    try {
      const { data, error } = await supabase
        .from('customer_returns')
        .select('*')
        .eq('company_id', finalCompanyId)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        returns = data.map((d: any) => ({
          id: d.id,
          companyId: d.company_id,
          returnNumber: d.return_number,
          originalInvoiceId: d.original_invoice_id,
          originalInvoiceNumber: d.original_invoice_number,
          returnDate: d.return_date,
          customerId: d.customer_id,
          customerName: d.customer_name,
          customerPhone: d.customer_phone,
          productId: d.product_id,
          productName: d.product_name,
          sku: d.sku,
          barcode: d.barcode,
          soldQty: Number(d.sold_qty || 0),
          returnedQty: Number(d.returned_qty || 0),
          unit: d.unit || 'Piece',
          unitPrice: Number(d.unit_price || 0),
          refundAmount: Number(d.refund_amount || 0),
          reason: d.reason || '',
          condition: (d.condition || 'Resalable') as CustomerReturnCondition,
          warehouseId: d.warehouse_id,
          warehouseName: d.warehouse_name,
          returnStatus: d.return_status || 'Pending Review',
          refundStatus: d.refund_status || 'Pending',
          notes: d.notes,
          createdBy: d.created_by,
          createdByName: d.created_by_name,
          approvedBy: d.approved_by,
          approvedByName: d.approved_by_name,
          approvedAt: d.approved_at,
          rejectedBy: d.rejected_by,
          rejectedByName: d.rejected_by_name,
          rejectedAt: d.rejected_at,
          rejectionReason: d.rejection_reason,
          restockedBy: d.restocked_by,
          restockedByName: d.restocked_by_name,
          restockedAt: d.restocked_at,
          refundedBy: d.refunded_by,
          refundedByName: d.refunded_by_name,
          refundedAt: d.refunded_at,
          refundMethod: d.refund_method,
          createdAt: d.created_at,
          updatedAt: d.updated_at
        }));
      }
    } catch {}

    // 2. Synchronize / fallback with local app storage
    const storage = getAppStorage();
    if (storage) {
      try {
        const raw = storage.getItem(CUSTOMER_RETURNS_STORAGE_KEY(finalCompanyId));
        if (raw) {
          const cached: CustomerReturn[] = JSON.parse(raw);
          const map = new Map(returns.map(r => [r.id, r]));
          cached.forEach(c => {
            if (!map.has(c.id)) {
              returns.push(c);
            }
          });
        }
      } catch {}
    }

    // Sort newest return date first
    return returns.sort((a, b) => new Date(b.createdAt || b.returnDate).getTime() - new Date(a.createdAt || a.returnDate).getTime());
  },

  /**
   * Calculates the remaining returnable quantity for an item from a specific invoice.
   * Prevents customer returns from exceeding originally sold quantity minus previous returns.
   */
  async getRemainingEligibleQty(
    invoiceId: string,
    productId: string,
    originalSoldQty: number,
    companyId?: string
  ): Promise<number> {
    const allReturns = await this.getCustomerReturns(companyId);
    const existingReturnedQty = allReturns
      .filter(r => r.originalInvoiceId === invoiceId && r.productId === productId && r.returnStatus !== 'Rejected')
      .reduce((sum, r) => sum + Number(r.returnedQty || 0), 0);

    return Math.max(0, originalSoldQty - existingReturnedQty);
  },

  /**
   * Creates a new Customer Return request.
   * Stock is NOT modified at this stage (remains Pending Review).
   */
  async createCustomerReturn(
    input: CreateCustomerReturnInput,
    companyId?: string
  ): Promise<CustomerReturn> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const nowIso = new Date().toISOString();

    if (!input.originalInvoiceId || !input.productId) {
      throw new Error('Original sales invoice and product must be selected.');
    }
    if (input.returnedQty <= 0) {
      throw new Error('Returned quantity must be greater than zero.');
    }

    // Check remaining returnable quantity
    const remaining = await this.getRemainingEligibleQty(
      input.originalInvoiceId,
      input.productId,
      input.soldQty,
      finalCompanyId
    );
    if (input.returnedQty > remaining) {
      throw new Error(`Returned quantity (${input.returnedQty}) exceeds remaining eligible quantity (${remaining}).`);
    }

    const existingList = await this.getCustomerReturns(finalCompanyId);
    const returnNumber = this.generateReturnNumber(existingList.length);
    const calculatedRefundAmount = input.refundAmount !== undefined ? input.refundAmount : input.unitPrice * input.returnedQty;

    const returnRecord: CustomerReturn = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ret_${Date.now()}`,
      companyId: finalCompanyId,
      returnNumber,
      originalInvoiceId: input.originalInvoiceId,
      originalInvoiceNumber: input.originalInvoiceNumber,
      returnDate: input.returnDate || nowIso.split('T')[0],
      customerId: input.customerId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      productId: input.productId,
      productName: input.productName,
      sku: input.sku,
      barcode: input.barcode,
      soldQty: input.soldQty,
      returnedQty: input.returnedQty,
      unit: input.unit || 'Piece',
      unitPrice: input.unitPrice,
      refundAmount: calculatedRefundAmount,
      reason: input.reason,
      condition: input.condition || 'Resalable',
      warehouseId: input.warehouseId,
      warehouseName: input.warehouseName,
      returnStatus: 'Pending Review',
      refundStatus: 'Pending',
      notes: input.notes,
      createdBy: input.createdBy,
      createdByName: input.createdByName,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    // Try Supabase insert
    try {
      await supabase.from('customer_returns').insert({
        id: returnRecord.id,
        company_id: finalCompanyId,
        return_number: returnRecord.returnNumber,
        original_invoice_id: returnRecord.originalInvoiceId,
        original_invoice_number: returnRecord.originalInvoiceNumber,
        return_date: returnRecord.returnDate,
        customer_id: returnRecord.customerId,
        customer_name: returnRecord.customerName,
        customer_phone: returnRecord.customerPhone,
        product_id: returnRecord.productId,
        product_name: returnRecord.productName,
        sku: returnRecord.sku,
        barcode: returnRecord.barcode,
        sold_qty: returnRecord.soldQty,
        returned_qty: returnRecord.returnedQty,
        unit: returnRecord.unit,
        unit_price: returnRecord.unitPrice,
        refund_amount: returnRecord.refundAmount,
        reason: returnRecord.reason,
        condition: returnRecord.condition,
        warehouse_id: returnRecord.warehouseId,
        warehouse_name: returnRecord.warehouseName,
        return_status: returnRecord.returnStatus,
        refund_status: returnRecord.refundStatus,
        notes: returnRecord.notes,
        created_by: returnRecord.createdBy,
        created_by_name: returnRecord.createdByName,
        created_at: nowIso,
        updated_at: nowIso
      });
    } catch {}

    // Persist to local app storage
    const storage = getAppStorage();
    if (storage) {
      try {
        const raw = storage.getItem(CUSTOMER_RETURNS_STORAGE_KEY(finalCompanyId));
        const list: CustomerReturn[] = raw ? JSON.parse(raw) : [];
        storage.setItem(
          CUSTOMER_RETURNS_STORAGE_KEY(finalCompanyId),
          JSON.stringify([returnRecord, ...list.filter(r => r.id !== returnRecord.id)])
        );
      } catch {}
    }

    return returnRecord;
  },

  /**
   * Approves a customer return.
   * Requirement 4: Pending review has no stock change. Approving prepares for restocking.
   */
  async approveReturn(
    returnId: string,
    reviewerId?: string,
    reviewerName?: string,
    companyId?: string
  ): Promise<CustomerReturn> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const nowIso = new Date().toISOString();
    const list = await this.getCustomerReturns(finalCompanyId);
    const existing = list.find(r => r.id === returnId);

    if (!existing) {
      throw new Error('Customer return record not found.');
    }
    if (existing.returnStatus === 'Rejected') {
      throw new Error('A rejected return cannot be approved.');
    }

    existing.returnStatus = 'Approved';
    existing.approvedBy = reviewerId;
    existing.approvedByName = reviewerName;
    existing.approvedAt = nowIso;
    existing.updatedAt = nowIso;

    // Persist update
    try {
      await supabase
        .from('customer_returns')
        .update({
          return_status: 'Approved',
          approved_by: reviewerId,
          approved_by_name: reviewerName,
          approved_at: nowIso,
          updated_at: nowIso
        })
        .eq('id', returnId);
    } catch {}

    const storage = getAppStorage();
    if (storage) {
      try {
        storage.setItem(CUSTOMER_RETURNS_STORAGE_KEY(finalCompanyId), JSON.stringify(list));
      } catch {}
    }

    return existing;
  },

  /**
   * Rejects a customer return.
   * Requirement 4: Rejected returns do NOT change inventory stock.
   */
  async rejectReturn(
    returnId: string,
    reason: string,
    reviewerId?: string,
    reviewerName?: string,
    companyId?: string
  ): Promise<CustomerReturn> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const nowIso = new Date().toISOString();
    const list = await this.getCustomerReturns(finalCompanyId);
    const existing = list.find(r => r.id === returnId);

    if (!existing) {
      throw new Error('Customer return record not found.');
    }
    if (existing.returnStatus === 'Stock Restocked') {
      throw new Error('Cannot reject a return that has already been restocked into warehouse inventory.');
    }

    existing.returnStatus = 'Rejected';
    existing.refundStatus = 'Rejected';
    existing.rejectionReason = reason;
    existing.rejectedBy = reviewerId;
    existing.rejectedByName = reviewerName;
    existing.rejectedAt = nowIso;
    existing.updatedAt = nowIso;

    try {
      await supabase
        .from('customer_returns')
        .update({
          return_status: 'Rejected',
          refund_status: 'Rejected',
          rejection_reason: reason,
          rejected_by: reviewerId,
          rejected_by_name: reviewerName,
          rejected_at: nowIso,
          updated_at: nowIso
        })
        .eq('id', returnId);
    } catch {}

    const storage = getAppStorage();
    if (storage) {
      try {
        storage.setItem(CUSTOMER_RETURNS_STORAGE_KEY(finalCompanyId), JSON.stringify(list));
      } catch {}
    }

    return existing;
  },

  /**
   * Restocks the verified returned product into inventory stock.
   *
   * Requirement 4 Rules:
   * - Approved + Resalable: Adds verified quantity to warehouse's available stock.
   * - Approved + Damaged/Defective/Expired: Does NOT add to sellable stock. Records in damaged/quarantine stock ledger.
   * - Idempotency: Duplicate calls or page refresh NEVER double-adds inventory.
   */
  async restockReturn(
    returnId: string,
    destinationWarehouseId?: string,
    destinationWarehouseName?: string,
    restockedById?: string,
    restockedByName?: string,
    companyId?: string
  ): Promise<{ returnRecord: CustomerReturn; restocked: boolean; message: string }> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const nowIso = new Date().toISOString();
    const list = await this.getCustomerReturns(finalCompanyId);
    const existing = list.find(r => r.id === returnId);

    if (!existing) {
      throw new Error('Customer return record not found.');
    }

    // Anti-duplicate protection: never restock twice
    if (existing.returnStatus === 'Stock Restocked' || existing.restockedAt) {
      return {
        returnRecord: existing,
        restocked: false,
        message: `Return ${existing.returnNumber} has already been restocked on ${existing.restockedAt?.split('T')[0]}.`
      };
    }

    if (existing.returnStatus === 'Rejected') {
      throw new Error('Cannot restock a rejected customer return.');
    }

    const warehouseId = destinationWarehouseId || existing.warehouseId;
    const warehouseName = destinationWarehouseName || existing.warehouseName;

    if (!warehouseId) {
      throw new Error('Destination warehouse must be specified for restocking.');
    }

    existing.warehouseId = warehouseId;
    if (warehouseName) existing.warehouseName = warehouseName;

    // 1. If Resalable: Increment sellable stock in product master & warehouse balance
    if (existing.condition === 'Resalable') {
      // A. Increment Product Master current_stock
      try {
        const { data: prod } = await supabase
          .from('products')
          .select('current_stock')
          .eq('id', existing.productId)
          .single();

        if (prod) {
          const newStock = Math.max(0, Number(prod.current_stock || 0) + existing.returnedQty);
          await supabase
            .from('products')
            .update({ current_stock: newStock, updated_at: nowIso })
            .eq('id', existing.productId);
        }
      } catch (e) {
        console.warn('Supabase product stock increment note:', e);
      }

      // B. Increment warehouse stock balance
      try {
        await inventoryService.updateStockBalance(
          warehouseId,
          existing.productId,
          existing.returnedQty,
          finalCompanyId
        );
      } catch (e) {
        console.warn('Supabase warehouse balance increment note:', e);
      }

      // C. Record stock movement transaction in ledger
      try {
        await inventoryService.recordStockMovement(
          {
            type: 'Sales Return',
            productId: existing.productId,
            productName: existing.productName,
            qty: existing.returnedQty,
            unit: existing.unit,
            warehouse: warehouseId,
            referenceDoc: existing.returnNumber,
            notes: `Customer return restocked (Resalable) from invoice ${existing.originalInvoiceNumber}. Reason: ${existing.reason}`
          },
          finalCompanyId
        );
      } catch (e) {
        console.warn('Ledger stock movement note:', e);
      }
    } else {
      // 2. If Damaged / Defective / Expired:
      // Do NOT add to sellable stock. Record in quarantine ledger transaction.
      try {
        await inventoryService.recordStockMovement(
          {
            type: `Customer Return (${existing.condition} - Quarantine)`,
            productId: existing.productId,
            productName: existing.productName,
            qty: existing.returnedQty,
            unit: existing.unit,
            warehouse: warehouseId,
            referenceDoc: existing.returnNumber,
            notes: `Customer returned non-sellable stock (${existing.condition}). Logged to quarantine. Reason: ${existing.reason}`
          },
          finalCompanyId
        );
      } catch (e) {
        console.warn('Quarantine ledger movement note:', e);
      }
    }

    // Mark as restocked
    existing.returnStatus = 'Stock Restocked';
    existing.restockedBy = restockedById;
    existing.restockedByName = restockedByName;
    existing.restockedAt = nowIso;
    existing.updatedAt = nowIso;

    try {
      await supabase
        .from('customer_returns')
        .update({
          return_status: 'Stock Restocked',
          warehouse_id: warehouseId,
          warehouse_name: warehouseName,
          restocked_by: restockedById,
          restocked_by_name: restockedByName,
          restocked_at: nowIso,
          updated_at: nowIso
        })
        .eq('id', returnId);
    } catch {}

    const storage = getAppStorage();
    if (storage) {
      try {
        storage.setItem(CUSTOMER_RETURNS_STORAGE_KEY(finalCompanyId), JSON.stringify(list));
      } catch {}
    }

    return {
      returnRecord: existing,
      restocked: true,
      message: existing.condition === 'Resalable'
        ? `Successfully restocked ${existing.returnedQty} ${existing.unit} to ${warehouseName || 'Godown'}.`
        : `Logged ${existing.returnedQty} ${existing.unit} to ${existing.condition} quarantine tracking. Sellable stock was preserved.`
    };
  },

  /**
   * Processes the refund for a customer return.
   * Requirement 5: Track refund status separately from stock status.
   * Does NOT alter inventory quantities.
   */
  async processRefund(
    returnId: string,
    refundMethod: string = 'Bank',
    refundAmount?: number,
    refundedById?: string,
    refundedByName?: string,
    companyId?: string
  ): Promise<CustomerReturn> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const nowIso = new Date().toISOString();
    const list = await this.getCustomerReturns(finalCompanyId);
    const existing = list.find(r => r.id === returnId);

    if (!existing) {
      throw new Error('Customer return record not found.');
    }

    // Anti-duplicate protection for refunds
    if (existing.refundStatus === 'Refunded' || existing.refundedAt) {
      return existing;
    }

    const finalRefundAmt = refundAmount !== undefined ? refundAmount : existing.refundAmount;

    existing.refundStatus = 'Refunded';
    existing.refundAmount = finalRefundAmt;
    existing.refundMethod = refundMethod;
    existing.refundedBy = refundedById;
    existing.refundedByName = refundedByName;
    existing.refundedAt = nowIso;
    existing.updatedAt = nowIso;

    try {
      await supabase
        .from('customer_returns')
        .update({
          refund_status: 'Refunded',
          refund_amount: finalRefundAmt,
          refund_method: refundMethod,
          refunded_by: refundedById,
          refunded_by_name: refundedByName,
          refunded_at: nowIso,
          updated_at: nowIso
        })
        .eq('id', returnId);
    } catch {}

    const storage = getAppStorage();
    if (storage) {
      try {
        storage.setItem(CUSTOMER_RETURNS_STORAGE_KEY(finalCompanyId), JSON.stringify(list));
      } catch {}
    }

    return existing;
  }
};
