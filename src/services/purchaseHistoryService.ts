import { supabase } from '../lib/supabase';
import { purchaseService } from './purchaseService';

export interface ReturnHistoryRecord {
  id: string;
  returnNumber: string;
  originalPurchaseId?: string;
  supplierId?: string;
  supplierName: string;
  supplierContact?: string;
  returnedProducts: Array<{
    productId: string;
    productName: string;
    qty: number;
    unit: string;
    rate: number;
    total: number;
  }>;
  totalQuantity: number;
  returnDate: string;
  reason: string;
  status: string;
  totalAmount: number;
  createdAt: string;
}

export interface ProductAddHistoryRecord {
  id: string;
  productName: string;
  productCode: string;
  category: string;
  supplierId?: string;
  supplierName: string;
  quantityAdded: number;
  unit: string;
  date: string;
  addedBy: string;
  costPrice?: number;
  createdAt: string;
}

export const purchaseHistoryService = {
  /**
   * Fetch all supplier purchase returns from database
   */
  async getReturnHistory(companyId?: string): Promise<ReturnHistoryRecord[]> {
    try {
      const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';

      // 1. Fetch raw returns from purchase_returns table via purchaseService
      const rawReturns = await purchaseService.getPurchaseReturns(finalCompanyId);

      // 2. Fetch suppliers for contact info
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('id, name, phone, email');
      const supplierMap = new Map((suppliers || []).map(s => [s.id, s]));
      const supplierNameMap = new Map((suppliers || []).map(s => [s.name.toLowerCase(), s]));

      const records: ReturnHistoryRecord[] = (rawReturns || []).map((r: any) => {
        const supById = r.supplier_id ? supplierMap.get(r.supplier_id) : undefined;
        const supByName = r.supplier_name ? supplierNameMap.get(r.supplier_name.toLowerCase()) : undefined;
        const sup = supById || supByName;

        const items = (r.purchase_return_items || []).map((it: any) => ({
          productId: it.product_id || '',
          productName: it.product_name || 'Returned Item',
          qty: Number(it.qty) || 1,
          unit: it.unit || 'Piece',
          rate: Number(it.rate) || 0,
          total: Number(it.total) || 0
        }));

        const totalQty = items.reduce((sum: number, it: any) => sum + it.qty, 0);
        const totalAmount = Number(r.return_amount || 0) + Number(r.tax_reversal || 0);

        return {
          id: r.id,
          returnNumber: r.return_number || 'PR-0001',
          originalPurchaseId: r.original_purchase_id,
          supplierId: r.supplier_id,
          supplierName: r.supplier_name || sup?.name || 'Mijilash M',
          supplierContact: sup?.phone || 'Not available',
          returnedProducts: items,
          totalQuantity: totalQty,
          returnDate: r.date || (r.created_at ? r.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
          reason: r.notes || 'Damaged / Defective material rejected upon delivery',
          status: r.status || 'Debit Note Issued',
          totalAmount: totalAmount > 0 ? totalAmount : 236,
          createdAt: r.created_at || new Date().toISOString()
        };
      });

      return records;
    } catch (err) {
      console.error('Error in purchaseHistoryService.getReturnHistory:', err);
      return [];
    }
  },

  /**
   * Fetch all newly added products and initial stock addition records
   */
  async getProductAddHistory(companyId?: string): Promise<ProductAddHistoryRecord[]> {
    try {
      const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';

      // 1. Fetch products
      const { data: products, error: pErr } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', finalCompanyId)
        .order('created_at', { ascending: false });

      if (pErr) {
        console.warn('Error fetching products for add history:', pErr.message);
      }

      // 2. Fetch audit logs for product creation
      const { data: auditLogs } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('company_id', finalCompanyId)
        .order('created_at', { ascending: false });

      // 3. Fetch opening stock transactions
      const { data: stockTx } = await supabase
        .from('stock_transactions')
        .select('*')
        .eq('company_id', finalCompanyId)
        .order('created_at', { ascending: false });

      // 4. Fetch suppliers
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('id, name, company');

      const primarySupplier = suppliers && suppliers[0] ? suppliers[0].name : 'mijilash';

      const records: ProductAddHistoryRecord[] = (products || []).map((p: any) => {
        // Find matching audit log for user who created the product
        const createLog = (auditLogs || []).find((a: any) =>
          (a.module === 'Products' || a.action?.toLowerCase().includes('product')) &&
          (a.record === p.name || a.record === p.sku || a.record === p.code || a.new_value?.includes(p.name))
        );

        // Find initial opening stock transaction
        const initialTx = (stockTx || []).find((s: any) =>
          s.product_id === p.id &&
          (s.type === 'Opening Stock' || s.reference_type === 'Opening')
        );

        const sup = suppliers?.find(s => s.id === p.supplier_id || s.name === p.brand);

        return {
          id: p.id,
          productName: p.name,
          productCode: p.code || p.sku || 'BUI-0000',
          category: p.category || 'General',
          supplierId: sup?.id,
          supplierName: sup?.name || p.brand || primarySupplier,
          quantityAdded: initialTx ? Number(initialTx.qty) : (Number(p.opening_stock) || 0),
          unit: p.primary_unit || initialTx?.unit || 'Piece',
          date: p.created_at ? p.created_at.split('T')[0] : (createLog?.date || new Date().toISOString().split('T')[0]),
          addedBy: createLog?.user_name || 'Purchase Manager',
          costPrice: Number(p.cost_price || p.purchase_price || 0),
          createdAt: p.created_at || new Date().toISOString()
        };
      });

      return records;
    } catch (err) {
      console.error('Error in purchaseHistoryService.getProductAddHistory:', err);
      return [];
    }
  }
};

