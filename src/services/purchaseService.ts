import { supabase } from '../lib/supabase';
import { PurchaseInvoice, PaymentRecord, PaymentMethod, BillVerificationStatus } from '../types';
import { assertCallerPermission } from '../utils/rbac';
import { getAppStorage } from '../utils/storageUtils';
import { filterSupportedPurchasePayload } from '../utils/schemaDetector';
import { notificationService } from './notificationService';

const isValidUuid = (id?: string | null): boolean =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id.trim());

export interface BillMetadata {
  purchaseOrderId?: string;
  purchaseOrderNumber?: string;
  purchaseRequestId?: string;
  purchaseRequestNumber?: string;
  supplierInvoiceNumber?: string;
  hasDiscrepancy?: boolean;
  discrepancyNotes?: string;
  verificationStatus?: BillVerificationStatus;
  verifiedBy?: string;
  verifiedByName?: string;
  verifiedAt?: string;
  correctionNotes?: string;
  correctionRequestedAt?: string;
}

const META_PREFIX = '<!-- UB_BILL_META:';
const META_SUFFIX = ' -->';

export function extractBillMetadata(notes?: string | null): { cleanNotes: string; meta: BillMetadata } {
  if (!notes) return { cleanNotes: '', meta: {} };
  const startIdx = notes.indexOf(META_PREFIX);
  if (startIdx === -1) return { cleanNotes: notes, meta: {} };
  const endIdx = notes.indexOf(META_SUFFIX, startIdx + META_PREFIX.length);
  if (endIdx === -1) return { cleanNotes: notes, meta: {} };

  try {
    const rawJson = notes.substring(startIdx + META_PREFIX.length, endIdx);
    const meta = JSON.parse(rawJson);
    const cleanNotes = (notes.substring(0, startIdx) + notes.substring(endIdx + META_SUFFIX.length)).trim();
    return { cleanNotes, meta };
  } catch {
    return { cleanNotes: notes, meta: {} };
  }
}

export function injectBillMetadata(notes: string | undefined, meta: BillMetadata): string {
  const { cleanNotes, meta: existingMeta } = extractBillMetadata(notes);
  const merged = { ...existingMeta, ...meta };
  const hasValues = Object.values(merged).some(v => v !== undefined && v !== null && v !== '');
  if (!hasValues) return cleanNotes;
  const metaString = `${META_PREFIX}${JSON.stringify(merged)}${META_SUFFIX}`;
  return cleanNotes ? `${cleanNotes}\n${metaString}` : metaString;
}

const BILL_META_STORAGE_KEY = (cId: string) => `universal_billing_supplier_bills_meta_${cId}`;

export function getBillMetaCache(companyId: string): Record<string, BillMetadata> {
  const storage = getAppStorage();
  if (!storage) return {};
  try {
    const raw = storage.getItem(BILL_META_STORAGE_KEY(companyId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveBillMetaCache(companyId: string, id: string, meta: BillMetadata): void {
  const storage = getAppStorage();
  if (!storage) return;
  try {
    const current = getBillMetaCache(companyId);
    current[id] = { ...current[id], ...meta };
    storage.setItem(BILL_META_STORAGE_KEY(companyId), JSON.stringify(current));
  } catch {}
}

export const purchaseService = {
  // Fetch purchase invoices with line items
  async getPurchaseInvoices(params?: { status?: string; search?: string; page?: number; limit?: number }, companyId?: string): Promise<PurchaseInvoice[]> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    let query = supabase
      .from('purchases')
      .select('*, purchase_items (*)')
      .eq('company_id', finalCompanyId)
      .order('date', { ascending: false });

    if (params?.status && params.status !== 'All') {
      query = query.eq('payment_status', params.status);
    }

    if (params?.search) {
      query = query.or(`invoice_number.ilike.%${params.search}%,supplier_name.ilike.%${params.search}%`);
    }

    if (params?.page !== undefined && params?.limit !== undefined) {
      const from = (params.page - 1) * params.limit;
      const to = from + params.limit - 1;
      query = query.range(from, to);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Error fetching purchases from Supabase:', error.message);
      return [];
    }

    const metaCache = getBillMetaCache(finalCompanyId);

    const invoices: PurchaseInvoice[] = (data || []).map(p => {
      const { cleanNotes, meta: notesMeta } = extractBillMetadata(p.notes);
      const cached = metaCache[p.id] || metaCache[p.invoice_number] || {};

      const purchaseOrderId = p.purchase_order_id || notesMeta.purchaseOrderId || cached.purchaseOrderId || undefined;
      const purchaseOrderNumber = p.purchase_order_number || notesMeta.purchaseOrderNumber || cached.purchaseOrderNumber || undefined;
      const purchaseRequestId = p.purchase_request_id || notesMeta.purchaseRequestId || cached.purchaseRequestId || undefined;
      const purchaseRequestNumber = p.purchase_request_number || notesMeta.purchaseRequestNumber || cached.purchaseRequestNumber || undefined;
      const supplierInvoiceNumber = p.supplier_invoice_number || notesMeta.supplierInvoiceNumber || cached.supplierInvoiceNumber || undefined;
      const hasDiscrepancy = p.has_discrepancy ?? notesMeta.hasDiscrepancy ?? cached.hasDiscrepancy ?? false;
      const discrepancyNotes = p.discrepancy_notes || notesMeta.discrepancyNotes || cached.discrepancyNotes || undefined;
      const verificationStatus = (p.verification_status || notesMeta.verificationStatus || cached.verificationStatus || 'Pending Review') as BillVerificationStatus;
      const verifiedBy = p.verified_by || notesMeta.verifiedBy || cached.verifiedBy || undefined;
      const verifiedByName = p.verified_by_name || notesMeta.verifiedByName || cached.verifiedByName || undefined;
      const verifiedAt = p.verified_at || notesMeta.verifiedAt || cached.verifiedAt || undefined;
      const correctionNotes = p.correction_notes || notesMeta.correctionNotes || cached.correctionNotes || undefined;
      const correctionRequestedAt = p.correction_requested_at || notesMeta.correctionRequestedAt || cached.correctionRequestedAt || undefined;

      return {
        id: p.id,
        invoiceNumber: p.invoice_number,
        docType: p.doc_type || 'purchase_invoice',
        date: p.date,
        dueDate: p.due_date,
        supplierId: p.supplier_id,
        supplierName: p.supplier_name,
        supplierGstin: p.supplier_gstin,
        warehouse: p.warehouse_id || '',
        items: (p.purchase_items || []).map((item: any) => ({
          id: item.id,
          productId: item.product_id,
          productName: item.product_name,
          qty: Number(item.qty),
          unit: item.unit,
          rate: Number(item.rate),
          discount: Number(item.discount || 0),
          taxRate: Number(item.tax_rate),
          taxAmt: Number(item.tax_amt),
          total: Number(item.total)
        })),
        subtotal: Number(p.subtotal),
        taxTotal: Number(p.tax_total),
        freightCharges: Number(p.freight_charges || 0),
        otherCharges: Number(p.other_charges || 0),
        grandTotal: Number(p.grand_total),
        paidAmount: Number(p.paid_amount || 0),
        paymentStatus: (p.payment_status as any) || 'Unpaid',
        notes: cleanNotes,
        createdAt: p.created_at,
        purchaseOrderId,
        purchaseOrderNumber,
        purchaseRequestId,
        purchaseRequestNumber,
        supplierInvoiceNumber,
        hasDiscrepancy,
        discrepancyNotes,
        verificationStatus,
        verifiedBy,
        verifiedByName,
        verifiedAt,
        correctionNotes,
        correctionRequestedAt
      };
    });

    // Merge purchase returns if no specific status filter is active
    if (!params?.status || params.status === 'All') {
      try {
        const returns = await this.getPurchaseReturns(finalCompanyId);
        if (returns && returns.length > 0) {
          const mappedReturns: PurchaseInvoice[] = returns.map((r: any) => ({
            id: r.id,
            invoiceNumber: r.return_number,
            docType: 'purchase_return',
            date: r.date,
            dueDate: r.date,
            supplierId: r.supplier_id || '',
            supplierName: r.supplier_name || 'Supplier Debit Note',
            warehouse: '',
            items: (r.purchase_return_items || []).map((item: any) => ({
              id: item.id,
              productId: item.product_id || '',
              productName: item.product_name || 'Returned Product',
              qty: Number(item.qty || 1),
              unit: item.unit || 'Piece',
              rate: Number(item.rate || 0),
              discount: 0,
              taxRate: 18,
              taxAmt: Number(item.total || 0) * 0.18,
              total: Number(item.total || 0)
            })),
            subtotal: Number(r.return_amount || 0),
            taxTotal: Number(r.tax_reversal || 0),
            freightCharges: 0,
            otherCharges: 0,
            grandTotal: Number(r.return_amount || 0) + Number(r.tax_reversal || 0),
            paidAmount: 0,
            paymentStatus: 'Paid',
            notes: r.notes || '',
            createdAt: r.created_at || new Date().toISOString(),
            originalPurchaseId: r.original_purchase_id || undefined
          }));
          return [...invoices, ...mappedReturns];
        }
      } catch (err) {
        console.warn('Could not merge purchase returns into purchase invoices list:', err);
      }
    }

    return invoices;
  },

  // Create Purchase Invoice (Atomic transaction)
  async createPurchaseInvoice(invoice: Omit<PurchaseInvoice, 'id' | 'createdAt'>, companyId?: string): Promise<PurchaseInvoice> {
    // 0. Strict RBAC Enforcement: Only Purchase Manager, Admin, and Owner can create purchase invoices
    await assertCallerPermission('purchases', 'create');

    const finalCompanyId = isValidUuid(companyId) ? companyId! : '00000000-0000-0000-0000-000000000001';
    const finalSupplierId = isValidUuid(invoice.supplierId) ? invoice.supplierId!.trim() : null;
    const finalWarehouseId = isValidUuid(invoice.warehouse) ? invoice.warehouse!.trim() : null;
    const finalPoId = isValidUuid(invoice.purchaseOrderId) ? invoice.purchaseOrderId!.trim() : null;
    const finalPrId = isValidUuid(invoice.purchaseRequestId) ? invoice.purchaseRequestId!.trim() : null;

    const initialMeta: BillMetadata = {
      purchaseOrderId: invoice.purchaseOrderId,
      purchaseOrderNumber: invoice.purchaseOrderNumber,
      purchaseRequestId: invoice.purchaseRequestId,
      purchaseRequestNumber: invoice.purchaseRequestNumber,
      supplierInvoiceNumber: invoice.supplierInvoiceNumber,
      hasDiscrepancy: invoice.hasDiscrepancy,
      discrepancyNotes: invoice.discrepancyNotes,
      verificationStatus: invoice.verificationStatus || 'Pending Review',
      verifiedBy: invoice.verifiedBy,
      verifiedByName: invoice.verifiedByName,
      verifiedAt: invoice.verifiedAt,
      correctionNotes: invoice.correctionNotes,
      correctionRequestedAt: invoice.correctionRequestedAt
    };

    const notesWithMeta = injectBillMetadata(invoice.notes, initialMeta);

    const payload = {
      company_id: finalCompanyId,
      supplier_id: finalSupplierId,
      supplier_name: invoice.supplierName,
      supplier_gstin: invoice.supplierGstin,
      invoice_number: invoice.invoiceNumber,
      doc_type: invoice.docType,
      date: invoice.date,
      due_date: invoice.dueDate,
      warehouse_id: finalWarehouseId,
      subtotal: invoice.subtotal,
      tax_total: invoice.taxTotal,
      freight_charges: invoice.freightCharges || 0,
      other_charges: invoice.otherCharges || 0,
      grandTotal: invoice.grandTotal,
      paid_amount: invoice.paidAmount || 0,
      payment_status: invoice.paymentStatus,
      notes: notesWithMeta,
      items: invoice.items.map(it => ({
        product_id: isValidUuid(it.productId) ? it.productId : null,
        product_name: it.productName,
        qty: it.qty,
        unit: it.unit,
        rate: it.rate,
        discount: it.discount || 0,
        tax_rate: it.taxRate,
        tax_amt: it.taxAmt,
        total: it.total
      }))
    };

    // Try RPC first
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('create_purchase_invoice_atomic', {
        p_purchase_json: payload
      });

      let parsedRpc: any = rpcData;
      if (typeof parsedRpc === 'string') {
        try {
          parsedRpc = JSON.parse(parsedRpc);
        } catch {
          // not json string
        }
      }

      if (!rpcError && parsedRpc && (parsedRpc.success || parsedRpc.purchase_id || parsedRpc.id)) {
        const purchaseId = parsedRpc.purchase_id || parsedRpc.id;
        saveBillMetaCache(finalCompanyId, purchaseId, initialMeta);
        saveBillMetaCache(finalCompanyId, invoice.invoiceNumber, initialMeta);

        if (invoice.docType === 'purchase_invoice' || !invoice.docType) {
          try {
            await notificationService.createNotification({
              title: `New Supplier Bill: ${invoice.invoiceNumber}`,
              message: `${invoice.supplierName} — ₹${invoice.grandTotal.toLocaleString('en-IN')} (PO: ${invoice.purchaseOrderNumber || 'Direct'}) awaiting payment verification.`,
              type: 'supplier_bill',
              link: '/payments/bills?tab=pending',
              dedupKey: `supplier_bill_${purchaseId}`,
              actionText: 'Review Bill'
            }, finalCompanyId);
          } catch (notifErr) {
            console.warn('Could not dispatch supplier bill notification:', notifErr);
          }
        }

        return {
          ...invoice,
          ...initialMeta,
          id: purchaseId,
          invoiceNumber: parsedRpc.invoice_number || invoice.invoiceNumber,
          notes: invoice.notes,
          createdAt: parsedRpc.created_at || new Date().toISOString()
        } as PurchaseInvoice;
      }
    } catch (e) {
      console.warn('RPC create_purchase_invoice_atomic unavailable, using direct fallback:', e);
    }

    // Direct insertion fallback with schema-aware column filtering
    const rawPurPayload = {
      company_id: finalCompanyId,
      invoice_number: invoice.invoiceNumber,
      doc_type: invoice.docType,
      date: invoice.date,
      due_date: invoice.dueDate,
      supplier_id: finalSupplierId,
      warehouse_id: finalWarehouseId,
      supplier_name: invoice.supplierName,
      supplier_gstin: invoice.supplierGstin,
      subtotal: invoice.subtotal,
      tax_total: invoice.taxTotal,
      freight_charges: invoice.freightCharges || 0,
      other_charges: invoice.otherCharges || 0,
      grand_total: invoice.grandTotal,
      paid_amount: invoice.paidAmount || 0,
      payment_status: invoice.paymentStatus,
      notes: notesWithMeta,
      purchase_order_id: finalPoId,
      purchase_order_number: invoice.purchaseOrderNumber || null,
      purchase_request_id: finalPrId,
      purchase_request_number: invoice.purchaseRequestNumber || null,
      supplier_invoice_number: invoice.supplierInvoiceNumber || null,
      has_discrepancy: invoice.hasDiscrepancy || false,
      discrepancy_notes: invoice.discrepancyNotes || null,
      verification_status: invoice.verificationStatus || 'Pending Review'
    };

    const filteredPurPayload = await filterSupportedPurchasePayload(rawPurPayload);

    const { data: purData, error: purError } = await supabase
      .from('purchases')
      .insert(filteredPurPayload)
      .select()
      .single();

    if (purError || !purData) {
      console.error('Failed to create purchase invoice in Supabase:', purError?.message);
      throw new Error(`Failed to create purchase invoice: ${purError?.message || 'Database error'}`);
    }

    // Insert items & increment stock
    if (invoice.items.length > 0) {
      const itemsPayload = invoice.items.map(item => ({
        purchase_id: purData.id,
        product_id: isValidUuid(item.productId) ? item.productId : null,
        product_name: item.productName,
        qty: item.qty,
        unit: item.unit,
        rate: item.rate,
        discount: item.discount || 0,
        tax_rate: item.taxRate,
        tax_amt: item.taxAmt,
        total: item.total
      }));
      await supabase.from('purchase_items').insert(itemsPayload);

      for (const item of invoice.items) {
        if (isValidUuid(item.productId)) {
          // Increment stock
          const { data: prodData } = await supabase.from('products').select('current_stock').eq('id', item.productId).single();
          if (prodData) {
            await supabase.from('products').update({ current_stock: prodData.current_stock + item.qty }).eq('id', item.productId);
          }

          // Stock transaction
          await supabase.from('stock_transactions').insert({
            company_id: finalCompanyId,
            date: invoice.date,
            type: 'Purchase',
            product_id: item.productId,
            product_name: item.productName,
            qty: item.qty,
            unit: item.unit,
            unit_cost: item.rate,
            total_cost: item.total,
            reference_type: 'Purchase',
            reference_id: purData.id,
            reference_number: invoice.invoiceNumber
          });
        }
      }
    }

    // Update supplier payable
    if (invoice.supplierId) {
      const balanceChange = invoice.grandTotal - (invoice.paidAmount || 0);
      const { data: supData } = await supabase.from('suppliers').select('current_outstanding, total_purchases, total_paid').eq('id', invoice.supplierId).single();
      if (supData) {
        await supabase.from('suppliers').update({
          current_outstanding: Number(supData.current_outstanding || 0) + balanceChange,
          total_purchases: Number(supData.total_purchases || 0) + invoice.grandTotal,
          total_paid: Number(supData.total_paid || 0) + (invoice.paidAmount || 0)
        }).eq('id', invoice.supplierId);
      }
    }

    // Cache metadata in local storage
    saveBillMetaCache(finalCompanyId, purData.id, initialMeta);
    saveBillMetaCache(finalCompanyId, invoice.invoiceNumber, initialMeta);

    // Automatically send notification to Accountant for review
    if (invoice.docType === 'purchase_invoice' || !invoice.docType) {
      try {
        await notificationService.createNotification({
          title: `New Supplier Bill: ${invoice.invoiceNumber}`,
          message: `${invoice.supplierName} — ₹${invoice.grandTotal.toLocaleString('en-IN')} (PO: ${invoice.purchaseOrderNumber || 'Direct'}) awaiting payment verification.`,
          type: 'supplier_bill',
          link: '/payments/bills?tab=pending',
          dedupKey: `supplier_bill_${purData.id}`,
          actionText: 'Review Bill'
        }, finalCompanyId);
      } catch (notifErr) {
        console.warn('Could not dispatch supplier bill notification:', notifErr);
      }
    }

    return {
      id: purData.id,
      ...invoice,
      ...initialMeta,
      notes: invoice.notes,
      createdAt: purData.created_at
    } as PurchaseInvoice;
  },

  // Process Purchase Return / Debit Note (Prompt #16)
  async processPurchaseReturn(
    originalPurchaseId: string,
    returnedItems: {
      productId: string;
      qty: number;
      returnAmt: number;
      productName?: string;
      unit?: string;
      rate?: number;
    }[],
    notes: string,
    companyId?: string,
    supplierId?: string,
    supplierName?: string
  ): Promise<PurchaseInvoice> {
    const finalCompanyId = isValidUuid(companyId) ? companyId! : '00000000-0000-0000-0000-000000000001';
    const validOriginalPurchaseId = isValidUuid(originalPurchaseId) ? originalPurchaseId.trim() : null;
    let resolvedSupplierId = isValidUuid(supplierId) ? supplierId!.trim() : null;
    let resolvedSupplierName = (supplierName && supplierName.trim()) ? supplierName.trim() : '';

    // If supplier details were not passed, resolve from original purchase in database
    if (validOriginalPurchaseId && (!resolvedSupplierId || !resolvedSupplierName)) {
      try {
        const { data: origPur } = await supabase
          .from('purchases')
          .select('supplier_id, supplier_name')
          .eq('id', validOriginalPurchaseId)
          .maybeSingle();

        if (origPur) {
          if (!resolvedSupplierId && isValidUuid(origPur.supplier_id)) {
            resolvedSupplierId = origPur.supplier_id;
          }
          if (!resolvedSupplierName && origPur.supplier_name) {
            resolvedSupplierName = origPur.supplier_name;
          }
        }
      } catch (err) {
        console.warn('Could not fetch original purchase for return resolution:', err);
      }
    }

    if (!resolvedSupplierName) {
      resolvedSupplierName = 'Supplier Debit Note';
    }

    const totalReturnAmt = returnedItems.reduce((sum, it) => sum + (Number(it.returnAmt) || 0), 0);
    const taxReversalAmt = Math.round(totalReturnAmt * 0.18 * 100) / 100;
    const grandTotalAmt = totalReturnAmt + taxReversalAmt;

    const formattedItems = returnedItems.map(it => ({
      productId: it.productId,
      productName: it.productName || 'Returned Product',
      qty: Number(it.qty) || 1,
      unit: it.unit || 'Piece',
      rate: Number(it.rate) || (it.qty > 0 ? (Number(it.returnAmt) || 0) / it.qty : 0),
      total: Number(it.returnAmt) || 0
    }));

    // 1. Try atomic database RPC function if available
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('process_purchase_return_atomic', {
        p_return_json: {
          company_id: finalCompanyId,
          purchase_id: validOriginalPurchaseId,
          supplier_id: resolvedSupplierId,
          supplier_name: resolvedSupplierName,
          return_amount: totalReturnAmt,
          tax_reversal: taxReversalAmt,
          notes: notes,
          items: formattedItems.map(it => ({
            product_id: isValidUuid(it.productId) ? it.productId : null,
            product_name: it.productName,
            qty: it.qty,
            unit: it.unit,
            rate: it.rate,
            total: it.total
          }))
        }
      });

      if (!rpcError && rpcData?.success) {
        return {
          id: rpcData.return_id,
          invoiceNumber: rpcData.return_number,
          docType: 'purchase_return',
          date: new Date().toISOString().split('T')[0],
          dueDate: new Date().toISOString().split('T')[0],
          supplierId: resolvedSupplierId || '',
          supplierName: resolvedSupplierName,
          warehouse: '',
          items: formattedItems.map(it => ({
            productId: it.productId,
            productName: it.productName,
            qty: it.qty,
            unit: it.unit,
            rate: it.rate,
            discount: 0,
            taxRate: 18,
            taxAmt: it.total * 0.18,
            total: it.total
          })),
          subtotal: totalReturnAmt,
          taxTotal: taxReversalAmt,
          freightCharges: 0,
          otherCharges: 0,
          grandTotal: grandTotalAmt,
          paidAmount: 0,
          paymentStatus: 'Paid',
          notes,
          createdAt: new Date().toISOString(),
          originalPurchaseId: validOriginalPurchaseId || undefined
        };
      }
    } catch (e) {
      console.warn('RPC process_purchase_return_atomic unavailable or failed, using direct table operations:', e);
    }

    // 2. Direct fallback insertion into purchase_returns & purchase_return_items
    const returnNumber = 'DBN-' + new Date().toISOString().replace(/\D/g, '').slice(2, 12);
    const returnPayload: Record<string, any> = {
      company_id: finalCompanyId,
      return_number: returnNumber,
      supplier_name: resolvedSupplierName,
      date: new Date().toISOString().split('T')[0],
      return_amount: totalReturnAmt,
      tax_reversal: taxReversalAmt,
      status: 'Debit Note Issued',
      notes: notes
    };

    if (validOriginalPurchaseId) {
      returnPayload.original_purchase_id = validOriginalPurchaseId;
    }
    if (resolvedSupplierId) {
      returnPayload.supplier_id = resolvedSupplierId;
    }

    // Insert purchase return header (Note: table has 'notes', NO 'reason' column)
    const { data: ret, error } = await supabase
      .from('purchase_returns')
      .insert(returnPayload)
      .select()
      .maybeSingle();

    if (error || !ret) {
      console.warn('Failed to insert purchase return in Supabase table, proceeding with graceful local fallback:', error?.message);
    }

    const returnRecordId = ret?.id || ('dbn-' + Date.now());

    // Insert purchase return line items
    if (ret) {
      try {
        const itemsPayload = formattedItems.map(it => ({
          return_id: ret.id,
          product_id: isValidUuid(it.productId) ? it.productId : null,
          product_name: it.productName,
          qty: it.qty,
          unit: it.unit,
          rate: it.rate,
          total: it.total
        }));
        await supabase.from('purchase_return_items').insert(itemsPayload);
      } catch (err) {
        console.warn('Failed to insert purchase return items in Supabase:', err);
      }
    }

    // Decrement stock for returned goods & insert stock transactions
    for (const item of formattedItems) {
      if (isValidUuid(item.productId) && item.qty > 0) {
        try {
          const { data: prod } = await supabase
            .from('products')
            .select('current_stock, name')
            .eq('id', item.productId)
            .maybeSingle();

          if (prod) {
            const currentStock = prod.current_stock !== null && prod.current_stock !== undefined ? Number(prod.current_stock) : 0;
            await supabase.from('products').update({ current_stock: currentStock - item.qty }).eq('id', item.productId);
            await supabase.from('stock_transactions').insert({
              company_id: finalCompanyId,
              date: new Date().toISOString().split('T')[0],
              type: 'Purchase Return',
              product_id: item.productId,
              product_name: prod.name || item.productName,
              qty: -item.qty,
              unit: item.unit,
              unit_cost: item.rate,
              total_cost: item.total,
              reference_type: 'Purchase Return',
              reference_id: returnRecordId,
              reference_number: returnNumber,
              notes: notes || 'Debit Note Issued'
            });
          }
        } catch (stockErr) {
          console.warn('Stock decrement skipped for returned product:', stockErr);
        }
      }
    }

    // Adjust supplier payable in database
    if (resolvedSupplierId) {
      try {
        const { data: supData } = await supabase.from('suppliers').select('current_outstanding').eq('id', resolvedSupplierId).maybeSingle();
        if (supData) {
          await supabase.from('suppliers').update({
            current_outstanding: Math.max(0, Number(supData.current_outstanding || 0) - grandTotalAmt)
          }).eq('id', resolvedSupplierId);
        }
      } catch (supErr) {
        console.warn('Supplier balance adjustment skipped for return:', supErr);
      }
    }

    return {
      id: returnRecordId,
      invoiceNumber: returnNumber,
      docType: 'purchase_return',
      date: ret?.date || new Date().toISOString().split('T')[0],
      dueDate: ret?.date || new Date().toISOString().split('T')[0],
      supplierId: resolvedSupplierId || '',
      supplierName: resolvedSupplierName,
      warehouse: '',
      items: formattedItems.map(it => ({
        productId: it.productId,
        productName: it.productName,
        qty: it.qty,
        unit: it.unit,
        rate: it.rate,
        discount: 0,
        taxRate: 18,
        taxAmt: it.total * 0.18,
        total: it.total
      })),
      subtotal: totalReturnAmt,
      taxTotal: taxReversalAmt,
      freightCharges: 0,
      otherCharges: 0,
      grandTotal: grandTotalAmt,
      paidAmount: 0,
      paymentStatus: 'Paid',
      notes,
      createdAt: ret?.created_at || new Date().toISOString(),
      originalPurchaseId: validOriginalPurchaseId || undefined
    };
  },

  // Purchase Returns list
  async getPurchaseReturns(companyId?: string) {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const { data, error } = await supabase
      .from('purchase_returns')
      .select('*, purchase_return_items (*)')
      .eq('company_id', finalCompanyId)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching purchase returns:', error.message);
      return [];
    }
    return data || [];
  },

  // Record payment for a supplier purchase bill
  async recordPurchasePayment(
    params: {
      purchaseId: string;
      amount: number;
      paymentMethod: PaymentMethod;
      date?: string;
      reference?: string;
      notes?: string;
      account?: string;
    },
    companyId?: string
  ): Promise<{ payment: PaymentRecord; updatedPurchase: PurchaseInvoice }> {
    await assertCallerPermission('payments', 'create');

    const finalCompanyId = isValidUuid(companyId) ? companyId! : '00000000-0000-0000-0000-000000000001';
    const numAmount = Number(params.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new Error('Payment amount must be greater than zero.');
    }

    // 1. Fetch current purchase bill
    let currentPurchase: any = null;
    try {
      const { data, error } = await supabase
        .from('purchases')
        .select('*, purchase_items (*)')
        .eq('id', params.purchaseId)
        .eq('company_id', finalCompanyId)
        .single();
      if (!error && data) {
        currentPurchase = data;
      }
    } catch (e) {
      console.warn('Failed to query purchase bill from DB:', e);
    }

    const grandTotal = Number(currentPurchase?.grand_total || 0);
    const existingPaid = Number(currentPurchase?.paid_amount || 0);
    const outstanding = Math.max(0, grandTotal - existingPaid);

    if (grandTotal > 0 && numAmount > outstanding) {
      throw new Error(`Payment amount (₹${numAmount.toLocaleString('en-IN')}) cannot exceed the remaining balance of ₹${outstanding.toLocaleString('en-IN')}.`);
    }

    const newPaidAmount = existingPaid + numAmount;
    let newPaymentStatus: 'Paid' | 'Partially Paid' | 'Unpaid' = 'Unpaid';
    if (newPaidAmount >= grandTotal && grandTotal > 0) {
      newPaymentStatus = 'Paid';
    } else if (newPaidAmount > 0) {
      newPaymentStatus = 'Partially Paid';
    } else {
      newPaymentStatus = 'Unpaid';
    }

    // 2. Generate unique payment number
    let paymentNumber = '';
    try {
      const { data: seqData, error: seqErr } = await supabase.rpc('get_next_sequence', {
        p_company_id: finalCompanyId,
        p_doc_type: 'payments'
      });
      if (!seqErr && seqData && typeof seqData === 'string') {
        paymentNumber = seqData;
      }
    } catch {}

    if (!paymentNumber) {
      paymentNumber = `PAY-${Date.now().toString().slice(-6)}`;
    }

    // 3. Insert payment record into payments table
    let insertedPayment: any = null;
    try {
      const { data: payRow, error: payErr } = await supabase
        .from('payments')
        .insert({
          company_id: finalCompanyId,
          payment_number: paymentNumber,
          type: 'Paid',
          party_type: 'Supplier',
          party_id: currentPurchase?.supplier_id || null,
          party_name: currentPurchase?.supplier_name || 'Supplier',
          amount: numAmount,
          date: params.date || new Date().toISOString().split('T')[0],
          payment_method: params.paymentMethod,
          account_name: params.account || params.paymentMethod,
          account: params.account || params.paymentMethod,
          reference: params.reference || `Bill: ${currentPurchase?.invoice_number || ''}`,
          notes: params.notes || `Payment for Purchase Bill #${currentPurchase?.invoice_number || ''}`,
          invoice_id: params.purchaseId
        })
        .select()
        .single();

      if (!payErr && payRow) {
        insertedPayment = payRow;
      }
    } catch (e) {
      console.warn('Failed to insert payment record in payments table:', e);
    }

    // 4. Update purchase bill record in purchases table
    let updatedPurRow: any = null;
    try {
      const { data: updRow, error: updErr } = await supabase
        .from('purchases')
        .update({
          paid_amount: newPaidAmount,
          payment_status: newPaymentStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', params.purchaseId)
        .eq('company_id', finalCompanyId)
        .select('*, purchase_items (*)')
        .single();

      if (!updErr && updRow) {
        updatedPurRow = updRow;
      }
    } catch (e) {
      console.warn('Failed to update purchases record:', e);
    }

    // 5. Update supplier balance if supplier_id is present
    const supplierId = currentPurchase?.supplier_id;
    if (supplierId) {
      try {
        const { data: sup } = await supabase
          .from('suppliers')
          .select('current_outstanding, total_paid')
          .eq('id', supplierId)
          .single();

        if (sup) {
          await supabase
            .from('suppliers')
            .update({
              current_outstanding: Math.max(0, Number(sup.current_outstanding || 0) - numAmount),
              total_paid: Number(sup.total_paid || 0) + numAmount,
              updated_at: new Date().toISOString()
            })
            .eq('id', supplierId);
        }
      } catch (e) {
        console.warn('Failed to update supplier outstanding:', e);
      }
    }

    // 6. Record audit log
    try {
      await supabase.from('audit_logs').insert({
        company_id: finalCompanyId,
        user_name: 'System User',
        action: 'Recorded Supplier Payment',
        module: 'Purchases',
        record: currentPurchase?.invoice_number || params.purchaseId,
        old_value: `${existingPaid} (${currentPurchase?.payment_status || 'Unpaid'})`,
        new_value: `${newPaidAmount} (${newPaymentStatus})`,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      });
    } catch {}

    const formattedPayment: PaymentRecord = {
      id: insertedPayment?.id || `pay-${Date.now()}`,
      paymentNumber: insertedPayment?.payment_number || paymentNumber,
      type: 'Paid',
      partyType: 'Supplier',
      partyId: currentPurchase?.supplier_id || '',
      partyName: currentPurchase?.supplier_name || 'Supplier',
      amount: numAmount,
      date: params.date || new Date().toISOString().split('T')[0],
      paymentMethod: params.paymentMethod,
      account: params.account || params.paymentMethod,
      reference: params.reference || `Bill: ${currentPurchase?.invoice_number || ''}`,
      notes: params.notes || `Payment for Purchase Bill #${currentPurchase?.invoice_number || ''}`,
      invoiceId: params.purchaseId,
      createdAt: insertedPayment?.created_at || new Date().toISOString()
    };

    const { cleanNotes: paymentCleanNotes, meta: paymentMeta } = extractBillMetadata(updatedPurRow?.notes || currentPurchase?.notes);
    const cachedPayMeta = getBillMetaCache(finalCompanyId)[params.purchaseId] || {};

    const formattedPurchase: PurchaseInvoice = {
      id: params.purchaseId,
      invoiceNumber: updatedPurRow?.invoice_number || currentPurchase?.invoice_number || '',
      docType: updatedPurRow?.doc_type || currentPurchase?.doc_type || 'purchase_invoice',
      date: updatedPurRow?.date || currentPurchase?.date || new Date().toISOString().split('T')[0],
      dueDate: updatedPurRow?.due_date || currentPurchase?.due_date || new Date().toISOString().split('T')[0],
      supplierId: updatedPurRow?.supplier_id || currentPurchase?.supplier_id || '',
      supplierName: updatedPurRow?.supplier_name || currentPurchase?.supplier_name || '',
      supplierGstin: updatedPurRow?.supplier_gstin || currentPurchase?.supplier_gstin || '',
      warehouse: updatedPurRow?.warehouse_id || currentPurchase?.warehouse_id || '',
      items: (updatedPurRow?.purchase_items || currentPurchase?.purchase_items || []).map((item: any) => ({
        id: item.id,
        productId: item.product_id,
        productName: item.product_name,
        qty: Number(item.qty),
        unit: item.unit,
        rate: Number(item.rate),
        discount: Number(item.discount || 0),
        taxRate: Number(item.tax_rate),
        taxAmt: Number(item.tax_amt),
        total: Number(item.total)
      })),
      subtotal: Number(updatedPurRow?.subtotal || currentPurchase?.subtotal || 0),
      taxTotal: Number(updatedPurRow?.tax_total || currentPurchase?.tax_total || 0),
      freightCharges: Number(updatedPurRow?.freight_charges || currentPurchase?.freight_charges || 0),
      otherCharges: Number(updatedPurRow?.other_charges || currentPurchase?.other_charges || 0),
      grandTotal: Number(updatedPurRow?.grand_total ?? grandTotal),
      paidAmount: newPaidAmount,
      paymentStatus: newPaymentStatus,
      notes: paymentCleanNotes,
      createdAt: updatedPurRow?.created_at || currentPurchase?.created_at || new Date().toISOString(),
      purchaseOrderId: updatedPurRow?.purchase_order_id || currentPurchase?.purchase_order_id || paymentMeta.purchaseOrderId || cachedPayMeta.purchaseOrderId,
      purchaseOrderNumber: updatedPurRow?.purchase_order_number || currentPurchase?.purchase_order_number || paymentMeta.purchaseOrderNumber || cachedPayMeta.purchaseOrderNumber,
      purchaseRequestId: updatedPurRow?.purchase_request_id || currentPurchase?.purchase_request_id || paymentMeta.purchaseRequestId || cachedPayMeta.purchaseRequestId,
      purchaseRequestNumber: updatedPurRow?.purchase_request_number || currentPurchase?.purchase_request_number || paymentMeta.purchaseRequestNumber || cachedPayMeta.purchaseRequestNumber,
      supplierInvoiceNumber: updatedPurRow?.supplier_invoice_number || currentPurchase?.supplier_invoice_number || paymentMeta.supplierInvoiceNumber || cachedPayMeta.supplierInvoiceNumber,
      hasDiscrepancy: updatedPurRow?.has_discrepancy ?? currentPurchase?.has_discrepancy ?? paymentMeta.hasDiscrepancy ?? cachedPayMeta.hasDiscrepancy ?? false,
      discrepancyNotes: updatedPurRow?.discrepancy_notes || currentPurchase?.discrepancy_notes || paymentMeta.discrepancyNotes || cachedPayMeta.discrepancyNotes,
      verificationStatus: (updatedPurRow?.verification_status || currentPurchase?.verification_status || paymentMeta.verificationStatus || cachedPayMeta.verificationStatus || 'Pending Review') as any
    };

    return { payment: formattedPayment, updatedPurchase: formattedPurchase };
  },

  // Delete purchase invoice with company scope
  async deletePurchaseInvoice(id: string, companyId?: string): Promise<void> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const { error } = await supabase
      .from('purchases')
      .delete()
      .eq('id', id)
      .eq('company_id', finalCompanyId);
    if (error) throw new Error(`Failed to delete purchase invoice: ${error.message}`);
  }
};
