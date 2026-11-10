import { supabase } from '../src/lib/supabase';
import { purchaseService } from '../src/services/purchaseService';

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

async function testFetchAll() {
  console.log('--- Testing Return History Fetch ---');
  const rawReturns = await purchaseService.getPurchaseReturns();
  const { data: suppliers } = await supabase.from('suppliers').select('id, name, phone, email');
  const supplierMap = new Map((suppliers || []).map(s => [s.id, s]));

  const returnRecords: ReturnHistoryRecord[] = (rawReturns || []).map((r: any) => {
    const sup = r.supplier_id ? supplierMap.get(r.supplier_id) : undefined;
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
      returnNumber: r.return_number || 'RET-0001',
      originalPurchaseId: r.original_purchase_id,
      supplierId: r.supplier_id,
      supplierName: r.supplier_name || sup?.name || 'Supplier',
      supplierContact: sup?.phone || '',
      returnedProducts: items,
      totalQuantity: totalQty,
      returnDate: r.date || r.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
      reason: r.notes || 'Damaged / Defective goods returned to vendor',
      status: r.status || 'Debit Note Issued',
      totalAmount: totalAmount,
      createdAt: r.created_at || new Date().toISOString()
    };
  });

  console.log('Return records count:', returnRecords.length);
  console.log('Sample return record:', returnRecords[0]);

  console.log('\n--- Testing Product Add History Fetch ---');
  const { data: products } = await supabase.from('products').select('*').order('created_at', { ascending: false });
  const { data: auditLogs } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false });
  const { data: stockTx } = await supabase.from('stock_transactions').select('*').order('created_at', { ascending: false });

  const productAddRecords: ProductAddHistoryRecord[] = (products || []).map((p: any) => {
    const createLog = (auditLogs || []).find((a: any) =>
      (a.module === 'Products' || a.action?.toLowerCase().includes('product')) &&
      (a.record === p.name || a.record === p.sku || a.record === p.code || a.new_value?.includes(p.name))
    );

    const initialTx = (stockTx || []).find((s: any) =>
      s.product_id === p.id &&
      (s.type === 'Opening Stock' || s.reference_type === 'Opening')
    );

    const sup = suppliers?.find(s => s.id === p.supplier_id || s.name === p.brand);

    return {
      id: p.id,
      productName: p.name,
      productCode: p.code || p.sku || 'SKU-001',
      category: p.category || 'General',
      supplierId: sup?.id,
      supplierName: sup?.name || p.brand || (suppliers && suppliers[0] ? suppliers[0].name : 'Primary Supplier'),
      quantityAdded: initialTx ? initialTx.qty : (Number(p.opening_stock) || 0),
      unit: p.primary_unit || initialTx?.unit || 'Piece',
      date: p.created_at ? p.created_at.split('T')[0] : (createLog?.date || new Date().toISOString().split('T')[0]),
      addedBy: createLog?.user_name || 'Purchase Manager',
      costPrice: Number(p.cost_price || p.purchase_price || 0),
      createdAt: p.created_at || new Date().toISOString()
    };
  });

  console.log('Product add records count:', productAddRecords.length);
  console.log('Sample product add record:', productAddRecords[0]);
}

testFetchAll().catch(console.error);

