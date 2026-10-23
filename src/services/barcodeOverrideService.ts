import { supabase } from '../lib/supabase';
import {
  Product,
  BarcodeAuditLog,
  BarcodeOverrideInput,
  BarcodeValidationResult
} from '../types';
import { productService } from './productService';
import { barcodeService } from './barcodeService';
import { canManageBarcodeOverride } from '../utils/rbac';
import { getAppStorage } from '../utils/storageUtils';
import { isTableMarkedMissing, markTableMissing, isTableNotFoundError } from '../utils/schemaDetector';

const AUDIT_STORAGE_KEY = (cId: string) => `universal_billing_barcode_audit_logs_${cId}`;
const PRODUCTS_STORAGE_KEY = (cId: string) => `universal_billing_products_${cId}`;

export const barcodeOverrideService = {
  /**
   * Helper to retrieve products seamlessly from Supabase and cache
   */
  async getAllProducts(companyId?: string): Promise<Product[]> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    let products: Product[] = [];
    try {
      products = await productService.getProducts(undefined, finalCompanyId);
    } catch {}

    const storage = getAppStorage();
    if (storage) {
      try {
        const raw = storage.getItem(PRODUCTS_STORAGE_KEY(finalCompanyId));
        if (raw) {
          const cached: Product[] = JSON.parse(raw);
          const map = new Map(products.map(p => [p.id, p]));
          cached.forEach(c => {
            if (!map.has(c.id)) {
              products.push(c);
            } else {
              const idx = products.findIndex(p => p.id === c.id);
              if (idx !== -1) products[idx] = c;
            }
          });
        }
      } catch {}
    }
    return products;
  },

  /**
   * Validates whether a barcode is already assigned to a different product.
   * Enforces strict uniqueness while allowing assigning to the same product.
   */
  async validateBarcode(
    newBarcode: string,
    targetProductId: string,
    companyId?: string
  ): Promise<BarcodeValidationResult> {
    const trimmed = (newBarcode || '').trim();
    if (!trimmed) {
      return {
        isValid: false,
        conflict: false,
        conflictingProduct: null,
        message: 'Barcode cannot be empty.'
      };
    }

    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';

    // 1. Fetch current catalog products
    const products = await this.getAllProducts(finalCompanyId);

    // 2. Find any product matching this barcode in products table
    const conflictingProd = products.find(
      p => p.barcode && p.barcode.trim().toLowerCase() === trimmed.toLowerCase()
    );

    if (conflictingProd) {
      if (conflictingProd.id === targetProductId) {
        return {
          isValid: true,
          conflict: false,
          isSameAsCurrent: true,
          conflictingProduct: null,
          message: 'This is already the active barcode assigned to this product.'
        };
      }

      return {
        isValid: false,
        conflict: true,
        isSameAsCurrent: false,
        conflictingProduct: {
          id: conflictingProd.id,
          name: conflictingProd.name,
          sku: conflictingProd.sku,
          barcode: conflictingProd.barcode
        },
        message: `Barcode "${trimmed}" is already assigned to "${conflictingProd.name}" (SKU: ${conflictingProd.sku}).`
      };
    }

    // 3. Check secondary product_barcodes table
    try {
      const { data: barcodeRow } = await supabase
        .from('product_barcodes')
        .select('product_id, barcode_value')
        .eq('barcode_value', trimmed)
        .maybeSingle();

      if (barcodeRow?.product_id && barcodeRow.product_id !== targetProductId) {
        const prod = products.find(p => p.id === barcodeRow.product_id);
        return {
          isValid: false,
          conflict: true,
          isSameAsCurrent: false,
          conflictingProduct: prod ? {
            id: prod.id,
            name: prod.name,
            sku: prod.sku,
            barcode: prod.barcode
          } : null,
          message: `Barcode "${trimmed}" is registered to another catalog product.`
        };
      }
    } catch {}

    return {
      isValid: true,
      conflict: false,
      isSameAsCurrent: false,
      conflictingProduct: null
    };
  },

  /**
   * Looks up a product by scanned barcode, SKU, or product code
   */
  async findProductByBarcodeOrCode(
    query: string,
    companyId?: string
  ): Promise<Product | null> {
    const trimmed = (query || '').trim();
    if (!trimmed) return null;

    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';

    // 1. Direct barcode lookup
    const direct = await barcodeService.lookupProductByBarcode(trimmed);
    if (direct) return direct;

    // 2. Search catalog
    const all = await this.getAllProducts(finalCompanyId);
    const match = all.find(
      p =>
        (p.barcode && p.barcode.trim().toLowerCase() === trimmed.toLowerCase()) ||
        (p.sku && p.sku.trim().toLowerCase() === trimmed.toLowerCase()) ||
        (p.code && p.code.trim().toLowerCase() === trimmed.toLowerCase())
    );

    return match || null;
  },

  /**
   * Executes Barcode Assignment (Method A) or Barcode Override (Method B).
   * - Strictly enforces RBAC: Purchase Manager, Owner, or Admin ONLY.
   * - Validates barcode uniqueness and non-negative selling price.
   * - Updates Product Master barcode and optional selling price.
   * - Logs full audit trail with old/new barcode, user, timestamp, and reason.
   * - Preserves product ID, SKU, stock balances, and historical sales/purchases.
   */
  async executeBarcodeOverride(
    input: BarcodeOverrideInput,
    user: { id: string; name: string; role?: string },
    companyId?: string
  ): Promise<{ product: Product; auditLog: BarcodeAuditLog }> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';

    // 1. RBAC Security Check: Only Purchase Manager (or authorized Admin/Owner)
    if (!canManageBarcodeOverride(user.role)) {
      throw new Error(
        `Access Denied: Role "${user.role || 'User'}" is not authorized to manage or override product barcodes. Only Purchase Managers have permission.`
      );
    }

    // 2. Validate input
    const trimmedBarcode = (input.newBarcode || '').trim();
    if (!trimmedBarcode) {
      throw new Error('A valid barcode number is required.');
    }

    if (!input.productId) {
      throw new Error('Target product ID is required.');
    }

    if (!input.reason?.trim()) {
      throw new Error('Please provide a mandatory reason for updating this product barcode.');
    }

    if (input.updatePrice && (input.newSellingPrice === undefined || input.newSellingPrice === null || isNaN(input.newSellingPrice) || input.newSellingPrice < 0)) {
      throw new Error('When updating selling price, the price must be a valid non-negative amount.');
    }

    // 3. Fetch existing product
    const allProducts = await this.getAllProducts(finalCompanyId);
    const existingProduct = allProducts.find(p => p.id === input.productId);
    if (!existingProduct) {
      throw new Error(`Product with ID "${input.productId}" not found in catalog.`);
    }

    // 4. Validate barcode uniqueness against all other products
    const validation = await this.validateBarcode(trimmedBarcode, input.productId, finalCompanyId);
    if (validation.conflict) {
      throw new Error(validation.message || `Barcode "${trimmedBarcode}" conflicts with another product.`);
    }

    const oldBarcode = existingProduct.barcode || '';
    const oldSellingPrice = existingProduct.sellingPrice !== undefined ? Number(existingProduct.sellingPrice) : null;
    const priceUpdated = Boolean(input.updatePrice && input.newSellingPrice !== undefined && input.newSellingPrice !== oldSellingPrice);
    const finalSellingPrice = priceUpdated && input.newSellingPrice !== undefined ? Number(input.newSellingPrice) : (oldSellingPrice ?? 0);

    const nowIso = new Date().toISOString();
    const auditId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'bca-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);

    // 5. Construct updated product preserving all historical keys
    const updatedProduct: Product = {
      ...existingProduct,
      barcode: trimmedBarcode,
      ...(priceUpdated ? {
        sellingPrice: finalSellingPrice,
        retailPrice: finalSellingPrice
      } : {})
    };

    // 6. Construct audit log entry
    const auditLog: BarcodeAuditLog = {
      id: auditId,
      companyId: finalCompanyId,
      productId: existingProduct.id,
      productName: existingProduct.name,
      sku: existingProduct.sku,
      method: input.method,
      oldBarcode,
      newBarcode: trimmedBarcode,
      oldSellingPrice,
      newSellingPrice: priceUpdated ? finalSellingPrice : oldSellingPrice,
      priceUpdated,
      purchaseOrderId: input.purchaseOrderId || null,
      purchaseOrderNumber: input.purchaseOrderNumber || null,
      reason: input.reason.trim(),
      userId: user.id || '00000000-0000-0000-0000-000000000000',
      userName: user.name || 'Purchase Manager',
      userRole: user.role || 'Purchase Manager',
      createdAt: nowIso
    };

    // 7. Update in Supabase
    try {
      // A. Update products table
      const updatePayload: Record<string, any> = {
        barcode: trimmedBarcode,
        updated_at: nowIso
      };
      if (priceUpdated) {
        updatePayload.selling_price = finalSellingPrice;
        updatePayload.retail_price = finalSellingPrice;
      }

      await supabase
        .from('products')
        .update(updatePayload)
        .eq('id', existingProduct.id);

      // B. Upsert product_barcodes table for scanner resolution
      await supabase.from('product_barcodes').upsert(
        {
          product_id: existingProduct.id,
          barcode_value: trimmedBarcode,
          barcode_type: 'Code 128',
          is_primary: true
        },
        { onConflict: 'product_id' }
      );

      // C. Insert into barcode_audit_logs if available
      if (!isTableMarkedMissing('barcode_audit_logs')) {
        const { error: logErr } = await supabase.from('barcode_audit_logs').insert({
          id: auditLog.id,
          company_id: finalCompanyId,
          product_id: auditLog.productId,
          product_name: auditLog.productName,
          sku: auditLog.sku,
          method: auditLog.method,
          old_barcode: auditLog.oldBarcode,
          new_barcode: auditLog.newBarcode,
          old_selling_price: auditLog.oldSellingPrice,
          new_selling_price: auditLog.newSellingPrice,
          price_updated: auditLog.priceUpdated,
          purchase_order_id: auditLog.purchaseOrderId,
          purchase_order_number: auditLog.purchaseOrderNumber,
          reason: auditLog.reason,
          user_id: auditLog.userId,
          user_name: auditLog.userName,
          user_role: auditLog.userRole,
          created_at: nowIso
        });
        if (logErr && isTableNotFoundError(logErr)) {
          markTableMissing('barcode_audit_logs');
        }
      }

      // D. Insert into general audit_logs
      await supabase.from('audit_logs').insert({
        company_id: finalCompanyId,
        user_id: user.id || null,
        user_name: user.name || 'Purchase Manager',
        action: input.method === 'SUPPLIER_OVERRIDE' ? 'BARCODE_OVERRIDE' : 'BARCODE_ASSIGN',
        module: 'purchases',
        record: `Product: ${existingProduct.name} (${existingProduct.sku})`,
        old_value: JSON.stringify({ barcode: oldBarcode, sellingPrice: oldSellingPrice }),
        new_value: JSON.stringify({ barcode: trimmedBarcode, sellingPrice: finalSellingPrice, reason: input.reason }),
        date: nowIso.split('T')[0],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    } catch (dbErr: any) {
      if (isTableNotFoundError(dbErr)) {
        markTableMissing('barcode_audit_logs');
      } else {
        console.warn('Supabase barcode override update notice:', dbErr);
      }
    }

    // 8. Update Local Storage Cache for offline resilience
    const storage = getAppStorage();
    if (storage) {
      try {
        // Update product cache
        const rawProds = storage.getItem(PRODUCTS_STORAGE_KEY(finalCompanyId));
        if (rawProds) {
          const list: Product[] = JSON.parse(rawProds);
          const idx = list.findIndex(p => p.id === existingProduct.id);
          if (idx !== -1) {
            list[idx] = updatedProduct;
            storage.setItem(PRODUCTS_STORAGE_KEY(finalCompanyId), JSON.stringify(list));
          }
        }

        // Save audit log cache
        const rawAudit = storage.getItem(AUDIT_STORAGE_KEY(finalCompanyId));
        const auditList: BarcodeAuditLog[] = rawAudit ? JSON.parse(rawAudit) : [];
        auditList.unshift(auditLog);
        storage.setItem(AUDIT_STORAGE_KEY(finalCompanyId), JSON.stringify(auditList));
      } catch {}
    }

    return { product: updatedProduct, auditLog };
  },

  /**
   * Retrieves audit logs of barcode changes
   */
  async getBarcodeAuditLogs(
    params?: { productId?: string; search?: string },
    companyId?: string
  ): Promise<BarcodeAuditLog[]> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    let logs: BarcodeAuditLog[] = [];

    if (!isTableMarkedMissing('barcode_audit_logs')) {
      try {
        let query = supabase
          .from('barcode_audit_logs')
          .select('*')
          .eq('company_id', finalCompanyId)
          .order('created_at', { ascending: false });

        if (params?.productId) {
          query = query.eq('product_id', params.productId);
        }

        const { data, error } = await query;
        if (!error && data) {
          logs = data.map((d: any) => ({
            id: d.id,
            companyId: d.company_id,
            productId: d.product_id,
            productName: d.product_name,
            sku: d.sku,
            method: d.method,
            oldBarcode: d.old_barcode,
            newBarcode: d.new_barcode,
            oldSellingPrice: d.old_selling_price !== null ? Number(d.old_selling_price) : null,
            newSellingPrice: d.new_selling_price !== null ? Number(d.new_selling_price) : null,
            priceUpdated: Boolean(d.price_updated),
            purchaseOrderId: d.purchase_order_id,
            purchaseOrderNumber: d.purchase_order_number,
            reason: d.reason,
            userId: d.user_id,
            userName: d.user_name,
            userRole: d.user_role,
            createdAt: d.created_at
          }));
        } else if (error && isTableNotFoundError(error)) {
          markTableMissing('barcode_audit_logs');
        }
      } catch (err: any) {
        if (isTableNotFoundError(err)) {
          markTableMissing('barcode_audit_logs');
        }
      }
    }

    // Merge with local storage cache
    const storage = getAppStorage();
    if (storage) {
      try {
        const raw = storage.getItem(AUDIT_STORAGE_KEY(finalCompanyId));
        if (raw) {
          const cached: BarcodeAuditLog[] = JSON.parse(raw);
          const existingIds = new Set(logs.map(l => l.id));
          cached.forEach(c => {
            if (!existingIds.has(c.id)) logs.push(c);
          });
        }
      } catch {}
    }

    logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (params?.search) {
      const q = params.search.toLowerCase();
      logs = logs.filter(
        l =>
          l.productName.toLowerCase().includes(q) ||
          l.sku.toLowerCase().includes(q) ||
          l.newBarcode.toLowerCase().includes(q) ||
          (l.oldBarcode && l.oldBarcode.toLowerCase().includes(q)) ||
          l.reason.toLowerCase().includes(q)
      );
    }

    return logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
};
