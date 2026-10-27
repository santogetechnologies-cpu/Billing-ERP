import { supabase } from '../lib/supabase';
import {
  CustomerReturn,
  CreateCustomerReturnInput,
  UpdateCustomerReturnInput,
  CustomerReturnCondition,
  CustomerReturnStatus,
  Product
} from '../types';
import { getAppStorage } from '../utils/storageUtils';
import { inventoryService } from './inventoryService';
import {
  isTableMarkedMissing,
  markTableMissing,
  isTableNotFoundError,
  markTableAvailable
} from '../utils/schemaDetector';

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

    // 1. Try Supabase customer_returns table if available in schema cache
    if (!isTableMarkedMissing('customer_returns')) {
      try {
        const { data, error } = await supabase
          .from('customer_returns')
          .select('*')
          .eq('company_id', finalCompanyId)
          .order('created_at', { ascending: false });

        if (error) {
          if (isTableNotFoundError(error)) {
            markTableMissing('customer_returns');
          }
        } else if (data) {
          markTableAvailable('customer_returns');
          if (data.length > 0) {
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
        }
      } catch {
        // Fall back gracefully
      }
    }

    // 2. Synchronize / fallback with local app storage
    const storage = getAppStorage();
    if (storage) {
      try {
        const raw = storage.getItem(CUSTOMER_RETURNS_STORAGE_KEY(finalCompanyId));
        if (raw) {
          const cached: CustomerReturn[] = JSON.parse(raw);
          const cachedMap = new Map(cached.map(c => [c.id, c]));
          // Merge: prioritize local state if local is newer or contains local mutations
          returns = returns.map(r => {
            const local = cachedMap.get(r.id);
            if (!local) return r;
            const remoteTime = new Date(r.updatedAt || r.createdAt || 0).getTime();
            const localTime = new Date(local.updatedAt || local.createdAt || 0).getTime();
            return localTime >= remoteTime ? local : r;
          });
          cached.forEach(c => {
            if (!returns.some(r => r.id === c.id)) {
              returns.push(c);
            }
          });
        }
      } catch {}
    }

    // 3. Migrate existing Sales Person direct-return records to 'Approved'
    // Directly completed returns under the salesperson direct-return workflow are marked Approved
    // Unrelated records (e.g. multi-step admin/warehouse manager approval flows or rejected records) remain untouched.
    let hasMigrationChanges = false;
    returns = returns.map(r => {
      const isMultiStageManagerWorkflow = Boolean(
        (r.approvedByName && /manager|admin|supervisor|operations/i.test(r.approvedByName)) ||
        (r.restockedByName && /manager|admin|godown|warehouse staff/i.test(r.restockedByName))
      );

      const isSalesDirectWorkflow = !isMultiStageManagerWorkflow && Boolean(
        r.directRestock ||
        (r as any).isDirectReturn ||
        (r.approvedByName && r.approvedByName.toLowerCase().includes('sales')) ||
        (r.restockedByName && r.restockedByName.toLowerCase().includes('sales')) ||
        (r.createdByName && r.createdByName.toLowerCase().includes('sales') && !r.approvedByName) ||
        (r.originalInvoiceNumber && r.originalInvoiceNumber.startsWith('POS') && !r.rejectionReason)
      );

      if (isSalesDirectWorkflow && r.returnStatus !== 'Rejected' && r.returnStatus !== 'Approved') {
        hasMigrationChanges = true;
        return {
          ...r,
          directRestock: true,
          returnStatus: 'Approved' as CustomerReturnStatus,
          approvedAt: r.approvedAt || r.restockedAt || r.createdAt || new Date().toISOString(),
          approvedByName: r.approvedByName || r.createdByName || 'Sales Person'
        };
      }
      return r;
    });

    if (hasMigrationChanges) {
      if (storage) {
        try {
          storage.setItem(CUSTOMER_RETURNS_STORAGE_KEY(finalCompanyId), JSON.stringify(returns));
        } catch {}
      }
      if (!isTableMarkedMissing('customer_returns')) {
        for (const r of returns) {
          if (r.returnStatus === 'Approved') {
            supabase
              .from('customer_returns')
              .update({
                return_status: 'Approved',
                approved_at: r.approvedAt,
                approved_by_name: r.approvedByName
              })
              .eq('id', r.id)
              .then(() => {}, () => {});
          }
        }
      }
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
    companyId?: string,
    excludeReturnId?: string
  ): Promise<number> {
    const allReturns = await this.getCustomerReturns(companyId);
    const existingReturnedQty = allReturns
      .filter(r => r.originalInvoiceId === invoiceId && r.productId === productId && r.returnStatus !== 'Rejected' && r.id !== excludeReturnId)
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

    // Anti-duplicate protection: prevent duplicate submissions within 5 seconds for same invoice & product
    const recentDuplicate = existingList.find(
      r => r.originalInvoiceId === input.originalInvoiceId &&
           r.productId === input.productId &&
           r.returnedQty === input.returnedQty &&
           (Date.now() - new Date(r.createdAt || 0).getTime() < 5000)
    );
    if (recentDuplicate) {
      return recentDuplicate;
    }

    const returnNumber = this.generateReturnNumber(existingList.length);
    const calculatedRefundAmount = input.refundAmount !== undefined ? input.refundAmount : input.unitPrice * input.returnedQty;
    const isDirect = Boolean(input.directRestock || (input as any).isDirectReturn);

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
      returnStatus: input.returnStatus || (isDirect ? 'Approved' : 'Pending Review'),
      refundStatus: 'Pending',
      notes: input.notes,
      createdBy: input.createdBy,
      createdByName: input.createdByName,
      approvedBy: isDirect ? (input.createdBy || 'sales-person') : undefined,
      approvedByName: isDirect ? (input.createdByName || 'Sales Person') : undefined,
      approvedAt: isDirect ? nowIso : undefined,
      restockedBy: isDirect ? (input.createdBy || 'sales-person') : undefined,
      restockedByName: isDirect ? (input.createdByName || 'Sales Person') : undefined,
      restockedAt: isDirect ? nowIso : undefined,
      directRestock: isDirect,
      isDirectReturn: isDirect,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    // If Direct Return workflow (e.g. Sales Person), immediately update inventory & record ledger
    if (isDirect) {
      const warehouseId = input.warehouseId || 'wh-central-001';

      if (returnRecord.condition === 'Resalable') {
        // A. Increment Product Master current_stock
        try {
          const { data: prod } = await supabase
            .from('products')
            .select('current_stock')
            .eq('id', returnRecord.productId)
            .single();

          if (prod) {
            const newStock = Math.max(0, Number(prod.current_stock || 0) + returnRecord.returnedQty);
            await supabase
              .from('products')
              .update({ current_stock: newStock, updated_at: nowIso })
              .eq('id', returnRecord.productId);
          }
        } catch (e) {
          console.warn('Supabase product stock increment note:', e);
        }

        // Also update local storage product cache if present
        const prodStorage = getAppStorage();
        if (prodStorage) {
          try {
            const prodKey = `universal_billing_products_${finalCompanyId}`;
            const rawP = prodStorage.getItem(prodKey);
            if (rawP) {
              const prods = JSON.parse(rawP);
              if (Array.isArray(prods)) {
                const pIdx = prods.findIndex((p: any) => p.id === returnRecord.productId);
                if (pIdx >= 0) {
                  const nextVal = Math.max(0, Number(prods[pIdx].currentStock ?? prods[pIdx].stock ?? 0) + returnRecord.returnedQty);
                  prods[pIdx].currentStock = nextVal;
                  prods[pIdx].stock = nextVal;
                  prodStorage.setItem(prodKey, JSON.stringify(prods));
                }
              }
            }
          } catch {}
        }

        // B. Increment warehouse stock balance
        try {
          await inventoryService.updateStockBalance(
            warehouseId,
            returnRecord.productId,
            returnRecord.returnedQty,
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
              productId: returnRecord.productId,
              productName: returnRecord.productName,
              qty: returnRecord.returnedQty,
              unit: returnRecord.unit,
              warehouse: warehouseId,
              referenceDoc: returnRecord.returnNumber,
              notes: `Customer return recorded by ${returnRecord.createdByName || 'Sales Person'} (Return ID: ${returnRecord.returnNumber}). Reason: ${returnRecord.reason}`,
              updateBalance: false
            },
            finalCompanyId
          );
        } catch (e) {
          console.warn('Ledger stock movement note:', e);
        }
      } else {
        // Non-resalable: Damaged, Defective, Expired - recorded separately in quarantine ledger
        try {
          await inventoryService.recordStockMovement(
            {
              type: `Customer Return (${returnRecord.condition} - Quarantine)`,
              productId: returnRecord.productId,
              productName: returnRecord.productName,
              qty: returnRecord.returnedQty,
              unit: returnRecord.unit,
              warehouse: warehouseId,
              referenceDoc: returnRecord.returnNumber,
              notes: `Customer returned non-sellable stock (${returnRecord.condition}) recorded by ${returnRecord.createdByName || 'Sales Person'} (Return ID: ${returnRecord.returnNumber}). Kept in quarantine, sellable stock preserved. Reason: ${returnRecord.reason}`,
              updateBalance: false
            },
            finalCompanyId
          );
        } catch (e) {
          console.warn('Quarantine ledger movement note:', e);
        }
      }
    }

    // Try Supabase insert if table is available
    if (!isTableMarkedMissing('customer_returns')) {
      try {
        const { error } = await supabase.from('customer_returns').insert({
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
          approved_by: returnRecord.approvedBy,
          approved_by_name: returnRecord.approvedByName,
          approved_at: returnRecord.approvedAt,
          restocked_by: returnRecord.restockedBy,
          restocked_by_name: returnRecord.restockedByName,
          restocked_at: returnRecord.restockedAt,
          created_at: nowIso,
          updated_at: nowIso
        });
        if (error && isTableNotFoundError(error)) {
          markTableMissing('customer_returns');
        }
      } catch {}
    }

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
   * Updates an existing customer return record.
   * If stock has already been restocked, safely recalculates the exact inventory delta:
   * - Only applies difference between old and new quantities; never double-counts.
   * - Validates inventory consistency to prevent negative stock.
   * - Enforces eligible return quantity limits against the original sale.
   * - Records audit history of changes.
   */
  async updateCustomerReturn(
    returnId: string,
    input: UpdateCustomerReturnInput,
    companyId?: string
  ): Promise<{
    updatedReturn: CustomerReturn;
    auditLogs: Array<{ field: string; oldValue: any; newValue: any }>;
    productStockDelta: number;
    warehouseStockDeltas: Array<{ warehouseId: string; delta: number }>;
  }> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const nowIso = new Date().toISOString();
    const list = await this.getCustomerReturns(finalCompanyId);
    const existing = list.find(r => r.id === returnId);

    if (!existing) {
      throw new Error(`Customer return record (${returnId}) not found.`);
    }

    const oldCondition = existing.condition;
    const newCondition = input.condition !== undefined ? input.condition : existing.condition;
    const oldQty = Number(existing.returnedQty);
    const newQty = input.returnedQty !== undefined ? Number(input.returnedQty) : oldQty;
    const oldWarehouseId = existing.warehouseId || 'wh-central-001';
    const newWarehouseId = input.warehouseId !== undefined ? input.warehouseId : oldWarehouseId;
    const newWarehouseName = input.warehouseName !== undefined ? input.warehouseName : existing.warehouseName;

    if (newQty <= 0) {
      throw new Error('Returned quantity must be greater than zero.');
    }

    // 1. Validate quantity against original invoice sold quantity minus other returns
    const maxEligible = await this.getRemainingEligibleQty(
      existing.originalInvoiceId,
      existing.productId,
      existing.soldQty,
      finalCompanyId,
      returnId
    );

    if (newQty > maxEligible) {
      throw new Error(
        `Returned quantity (${newQty}) exceeds remaining eligible quantity (${maxEligible}) for this invoice item.`
      );
    }

    let productStockDelta = 0;
    const warehouseStockDeltas: Array<{ warehouseId: string; delta: number }> = [];

    // 2. Inventory Safety & Recalculation if already restocked
    const isRestocked = existing.returnStatus === 'Stock Restocked' || Boolean(existing.restockedAt);

    if (isRestocked) {
      const oldSellableQty = oldCondition === 'Resalable' ? oldQty : 0;
      const newSellableQty = newCondition === 'Resalable' ? newQty : 0;

      productStockDelta = newSellableQty - oldSellableQty;

      if (oldWarehouseId === newWarehouseId) {
        const whDelta = newSellableQty - oldSellableQty;
        if (whDelta !== 0) {
          warehouseStockDeltas.push({ warehouseId: oldWarehouseId, delta: whDelta });
        }
      } else {
        if (oldSellableQty > 0) {
          warehouseStockDeltas.push({ warehouseId: oldWarehouseId, delta: -oldSellableQty });
        }
        if (newSellableQty > 0) {
          warehouseStockDeltas.push({ warehouseId: newWarehouseId, delta: newSellableQty });
        }
      }

      // Check product-level inventory consistency
      if (productStockDelta < 0) {
        let currentProdStock: number | null = null;
        try {
          const { data: prod } = await supabase
            .from('products')
            .select('current_stock, name')
            .eq('id', existing.productId)
            .maybeSingle();
          if (prod && prod.current_stock !== undefined && prod.current_stock !== null) {
            currentProdStock = Number(prod.current_stock);
          }
        } catch {}

        if (currentProdStock === null) {
          const storage = getAppStorage();
          if (storage) {
            try {
              const rawP = storage.getItem(`universal_billing_products_${finalCompanyId}`);
              if (rawP) {
                const prods = JSON.parse(rawP);
                const p = prods.find((x: any) => x.id === existing.productId);
                if (p) {
                  currentProdStock = Number(p.currentStock ?? p.stock ?? 0);
                }
              }
            } catch {}
          }
        }

        const effectiveStock = currentProdStock !== null ? currentProdStock : 0;
        if (effectiveStock + productStockDelta < 0) {
          throw new Error(
            `Cannot reduce returned quantity by ${Math.abs(productStockDelta)}: available product stock (${effectiveStock}) would become negative.`
          );
        }
      }

      // Check warehouse-level inventory consistency
      for (const whDelta of warehouseStockDeltas) {
        if (whDelta.delta < 0) {
          const whBal = await inventoryService.getStockBalance(whDelta.warehouseId, existing.productId, finalCompanyId);
          if (whBal + whDelta.delta < 0) {
            throw new Error(
              `Cannot reduce warehouse inventory by ${Math.abs(whDelta.delta)}: available stock in warehouse (${whBal}) is insufficient.`
            );
          }
        }
      }

      // Execute inventory updates if any delta exists
      if (productStockDelta !== 0) {
        // A. Update Product Master in Supabase
        try {
          const { data: prod } = await supabase
            .from('products')
            .select('current_stock')
            .eq('id', existing.productId)
            .maybeSingle();

          if (prod) {
            const nextStock = Math.max(0, Number(prod.current_stock || 0) + productStockDelta);
            await supabase
              .from('products')
              .update({ current_stock: nextStock, updated_at: nowIso })
              .eq('id', existing.productId);
          }
        } catch (e) {
          console.warn('Supabase product master update note:', e);
        }

        // Also update local storage product cache
        const prodStorage = getAppStorage();
        if (prodStorage) {
          try {
            const prodKey = `universal_billing_products_${finalCompanyId}`;
            const rawP = prodStorage.getItem(prodKey);
            if (rawP) {
              const prods = JSON.parse(rawP);
              if (Array.isArray(prods)) {
                const pIdx = prods.findIndex((p: any) => p.id === existing.productId);
                if (pIdx >= 0) {
                  const nextVal = Math.max(0, Number(prods[pIdx].currentStock ?? prods[pIdx].stock ?? 0) + productStockDelta);
                  prods[pIdx].currentStock = nextVal;
                  prods[pIdx].stock = nextVal;
                  prodStorage.setItem(prodKey, JSON.stringify(prods));
                }
              }
            }
          } catch {}
        }
      }

      // B. Update Warehouse Balances
      for (const whDelta of warehouseStockDeltas) {
        try {
          await inventoryService.updateStockBalance(
            whDelta.warehouseId,
            existing.productId,
            whDelta.delta,
            finalCompanyId
          );
        } catch (e) {
          console.warn('Warehouse balance adjustment note:', e);
        }
      }

      // C. Record Stock Movement Ledger
      if (productStockDelta !== 0 || oldWarehouseId !== newWarehouseId || oldCondition !== newCondition) {
        try {
          await inventoryService.recordStockMovement(
            {
              type: productStockDelta >= 0 ? 'Sales Return Adjustment (Increase)' : 'Sales Return Adjustment (Reduction)',
              productId: existing.productId,
              productName: existing.productName,
              qty: productStockDelta !== 0 ? Math.abs(productStockDelta) : newQty,
              unit: existing.unit,
              warehouse: newWarehouseId,
              referenceDoc: existing.returnNumber,
              notes: `Customer return edited by ${input.updatedByName || 'Sales Person'} (Return ID: ${existing.returnNumber}). Old: ${oldQty} (${oldCondition}), New: ${newQty} (${newCondition}). Stock delta: ${productStockDelta > 0 ? '+' : ''}${productStockDelta}.`,
              updateBalance: false
            },
            finalCompanyId
          );
        } catch (e) {
          console.warn('Ledger movement note:', e);
        }
      }
    }

    // 3. Track Audit Trail for all changed fields
    const auditLogs: Array<{ field: string; oldValue: any; newValue: any }> = [];

    if (input.customerName !== undefined && input.customerName !== existing.customerName) {
      auditLogs.push({ field: 'customerName', oldValue: existing.customerName, newValue: input.customerName });
      existing.customerName = input.customerName;
    }
    if (input.customerPhone !== undefined && input.customerPhone !== existing.customerPhone) {
      auditLogs.push({ field: 'customerPhone', oldValue: existing.customerPhone || '—', newValue: input.customerPhone });
      existing.customerPhone = input.customerPhone;
    }
    if (input.reason !== undefined && input.reason !== existing.reason) {
      auditLogs.push({ field: 'reason', oldValue: existing.reason, newValue: input.reason });
      existing.reason = input.reason;
    }
    if (input.condition !== undefined && input.condition !== existing.condition) {
      auditLogs.push({ field: 'condition', oldValue: existing.condition, newValue: input.condition });
      existing.condition = input.condition;
    }
    if (input.returnedQty !== undefined && Number(input.returnedQty) !== oldQty) {
      auditLogs.push({ field: 'returnedQty', oldValue: oldQty, newValue: Number(input.returnedQty) });
      existing.returnedQty = Number(input.returnedQty);
      existing.refundAmount = input.refundAmount !== undefined ? input.refundAmount : Math.round(existing.unitPrice * existing.returnedQty);
    }
    if (input.warehouseId !== undefined && input.warehouseId !== existing.warehouseId) {
      auditLogs.push({ field: 'warehouse', oldValue: existing.warehouseName || existing.warehouseId, newValue: newWarehouseName || input.warehouseId });
      existing.warehouseId = input.warehouseId;
      if (newWarehouseName) existing.warehouseName = newWarehouseName;
    }
    if (input.notes !== undefined && input.notes !== existing.notes) {
      auditLogs.push({ field: 'notes', oldValue: existing.notes || '—', newValue: input.notes });
      existing.notes = input.notes;
    }

    existing.updatedAt = nowIso;
    existing.updatedBy = input.updatedBy;
    existing.updatedByName = input.updatedByName;

    if (!existing.auditTrail) {
      existing.auditTrail = [];
    }
    for (const log of auditLogs) {
      existing.auditTrail.push({
        date: nowIso,
        editedBy: input.updatedByName || 'Sales Person',
        field: log.field,
        oldValue: log.oldValue,
        newValue: log.newValue
      });
    }

    // 4. Persist to Supabase if table is available
    if (!isTableMarkedMissing('customer_returns')) {
      try {
        const { error } = await supabase
          .from('customer_returns')
          .update({
            customer_name: existing.customerName,
            customer_phone: existing.customerPhone,
            reason: existing.reason,
            condition: existing.condition,
            returned_qty: existing.returnedQty,
            refund_amount: existing.refundAmount,
            warehouse_id: existing.warehouseId,
            warehouse_name: existing.warehouseName,
            notes: existing.notes,
            updated_at: nowIso
          })
          .eq('id', returnId);

        if (error && isTableNotFoundError(error)) {
          markTableMissing('customer_returns');
        }
      } catch {}
    }

    // 5. Persist to Local Storage
    const storage = getAppStorage();
    if (storage) {
      try {
        const raw = storage.getItem(CUSTOMER_RETURNS_STORAGE_KEY(finalCompanyId));
        const currentStored: CustomerReturn[] = raw ? JSON.parse(raw) : [];
        const updatedList = currentStored.map(r => r.id === existing.id ? existing : r);
        storage.setItem(CUSTOMER_RETURNS_STORAGE_KEY(finalCompanyId), JSON.stringify(updatedList));
      } catch {}
    }

    return {
      updatedReturn: existing,
      auditLogs,
      productStockDelta,
      warehouseStockDeltas
    };
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

    // Persist update if table is available
    if (!isTableMarkedMissing('customer_returns')) {
      try {
        const { error } = await supabase
          .from('customer_returns')
          .update({
            return_status: 'Approved',
            approved_by: reviewerId,
            approved_by_name: reviewerName,
            approved_at: nowIso,
            updated_at: nowIso
          })
          .eq('id', returnId);
        if (error && isTableNotFoundError(error)) {
          markTableMissing('customer_returns');
        }
      } catch {}
    }

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

    if (!isTableMarkedMissing('customer_returns')) {
      try {
        const { error } = await supabase
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
        if (error && isTableNotFoundError(error)) {
          markTableMissing('customer_returns');
        }
      } catch {}
    }

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
            notes: `Customer return restocked (Resalable) from invoice ${existing.originalInvoiceNumber}. Reason: ${existing.reason}`,
            updateBalance: false
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
            notes: `Customer returned non-sellable stock (${existing.condition}). Logged to quarantine. Reason: ${existing.reason}`,
            updateBalance: false
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

    if (!isTableMarkedMissing('customer_returns')) {
      try {
        const { error } = await supabase
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
        if (error && isTableNotFoundError(error)) {
          markTableMissing('customer_returns');
        }
      } catch {}
    }

    const storage = getAppStorage();
    if (storage) {
      try {
        storage.setItem(CUSTOMER_RETURNS_STORAGE_KEY(finalCompanyId), JSON.stringify(list));
      } catch {}
    }

    return {
      returnRecord: existing,
      restocked: existing.condition === 'Resalable',
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

    if (!isTableMarkedMissing('customer_returns')) {
      try {
        const { error } = await supabase
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
        if (error && isTableNotFoundError(error)) {
          markTableMissing('customer_returns');
        }
      } catch {}
    }

    const storage = getAppStorage();
    if (storage) {
      try {
        storage.setItem(CUSTOMER_RETURNS_STORAGE_KEY(finalCompanyId), JSON.stringify(list));
      } catch {}
    }

    return existing;
  }
};
