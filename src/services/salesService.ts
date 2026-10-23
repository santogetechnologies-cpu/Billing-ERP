import { supabase } from '../lib/supabase';
import { SalesInvoice } from '../types';
import { assertCallerPermission } from '../utils/rbac';

export const salesService = {
  // Fetch sales invoices with items
  async getSalesInvoices(params?: { status?: string; search?: string; page?: number; limit?: number }, companyId?: string): Promise<SalesInvoice[]> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    let query = supabase
      .from('sales')
      .select('*, sales_items (*)')
      .eq('company_id', finalCompanyId)
      .order('date', { ascending: false });

    if (params?.status && params.status !== 'All') {
      query = query.eq('payment_status', params.status);
    }

    if (params?.search) {
      query = query.or(`invoice_number.ilike.%${params.search}%,customer_name.ilike.%${params.search}%`);
    }

    if (params?.page !== undefined && params?.limit !== undefined) {
      const from = (params.page - 1) * params.limit;
      const to = from + params.limit - 1;
      query = query.range(from, to);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Error fetching sales invoices from Supabase:', error.message);
      return [];
    }

    return (data || []).map(s => ({
      id: s.id,
      invoiceNumber: s.invoice_number,
      docType: s.doc_type || 'tax_invoice',
      date: s.date,
      dueDate: s.due_date,
      customerId: s.customer_id,
      customerName: s.customer_name,
      customerPhone: s.customer_phone,
      customerGstin: s.customer_gstin,
      customerAddress: s.customer_address,
      warehouseId: s.warehouse_id || '',
      items: (s.sales_items || []).map((item: any) => ({
        id: item.id,
        productId: item.product_id,
        productName: item.product_name,
        sku: item.sku || '',
        barcode: item.barcode || '',
        hsn: item.hsn_sac || '',
        qty: Number(item.qty),
        unit: item.unit,
        rate: Number(item.rate),
        discountPct: Number(item.discount_pct || 0),
        discountAmt: Number(item.discount_amt || 0),
        taxRate: Number(item.tax_rate),
        taxAmt: Number(item.tax_amt),
        cgstAmt: Number(item.cgst_amt || 0),
        sgstAmt: Number(item.sgst_amt || 0),
        igstAmt: Number(item.igst_amt || 0),
        total: Number(item.total),
        costPrice: Number(item.cost_price || 0)
      })),
      subtotal: Number(s.subtotal),
      discountTotal: Number(s.discount_total || 0),
      taxTotal: Number(s.tax_total),
      cgstTotal: Number(s.cgst_total || 0),
      sgstTotal: Number(s.sgst_total || 0),
      igstTotal: Number(s.igst_total || 0),
      roundOff: Number(s.round_off || 0),
      grandTotal: Number(s.grand_total),
      paidAmount: Number(s.paid_amount || 0),
      paymentStatus: (s.payment_status as any) || 'Unpaid',
      paymentMethod: (s.payment_method as any) || 'Cash',
      notes: s.notes,
      terms: s.terms,
      createdAt: s.created_at
    }));
  },

  // Create Sales Invoice (Atomic Transaction via RPC)
  async createSalesInvoice(invoice: Omit<SalesInvoice, 'id' | 'createdAt'>, companyId?: string): Promise<SalesInvoice> {
    // 0. Strict RBAC Enforcement: Only Salesperson, Cashier, Admin, and Owner can create sales invoices
    await assertCallerPermission('sales', 'create');

    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const payload = {
      company_id: finalCompanyId,
      customer_id: invoice.customerId,
      customer_name: invoice.customerName,
      customer_gstin: invoice.customerGstin,
      invoice_number: invoice.invoiceNumber,
      doc_type: invoice.docType,
      date: invoice.date,
      due_date: invoice.dueDate,
      warehouse_id: invoice.warehouseId,
      subtotal: invoice.subtotal,
      discount_total: invoice.discountTotal,
      tax_total: invoice.taxTotal,
      cgst_total: invoice.cgstTotal,
      sgst_total: invoice.sgstTotal,
      igst_total: invoice.igstTotal,
      round_off: invoice.roundOff,
      grand_total: invoice.grandTotal,
      paid_amount: invoice.paidAmount,
      payment_status: invoice.paymentStatus,
      payment_method: invoice.paymentMethod,
      notes: invoice.notes,
      terms: invoice.terms,
      items: invoice.items.map(it => ({
        product_id: it.productId,
        product_name: it.productName,
        sku: it.sku || '',
        barcode: it.barcode || '',
        hsn_sac: it.hsn || '',
        qty: it.qty,
        unit: it.unit,
        rate: it.rate,
        discount_pct: it.discountPct || 0,
        discount_amt: it.discountAmt || 0,
        tax_rate: it.taxRate,
        tax_amt: it.taxAmt,
        cgst_amt: it.cgstAmt || 0,
        sgst_amt: it.sgstAmt || 0,
        igst_amt: it.igstAmt || 0,
        total: it.total,
        cost_price: it.costPrice || 0
      }))
    };

    // Authoritative Pre-Transaction Stock Validation
    const isStockDeducting = invoice.docType === 'tax_invoice' || invoice.docType === 'delivery_challan' || invoice.docType === 'pos_invoice';
    if (isStockDeducting && invoice.items.length > 0) {
      const requestedMap = new Map<string, { qty: number; unit: string; name: string }>();
      for (const it of invoice.items) {
        if (!it.productId) continue;
        const cur = requestedMap.get(it.productId) || { qty: 0, unit: it.unit || 'Pcs', name: it.productName };
        cur.qty += Number(it.qty) || 0;
        requestedMap.set(it.productId, cur);
      }

      for (const [prodId, req] of requestedMap.entries()) {
        let availableStock = 0;
        let unitLabel = req.unit;

        const { data: prod } = await supabase
          .from('products')
          .select('current_stock, primary_unit')
          .eq('id', prodId)
          .single();

        const prodCurrentStock = prod?.current_stock !== null && prod?.current_stock !== undefined ? Number(prod.current_stock) : 0;
        if (prod?.primary_unit) unitLabel = prod.primary_unit;

        if (prodCurrentStock <= 0) {
          throw new Error('Out of Stock — This product cannot be billed because no stock is available.');
        }

        if (invoice.warehouseId) {
          const { data: whBal } = await supabase
            .from('stock_balances')
            .select('quantity')
            .eq('warehouse_id', invoice.warehouseId)
            .eq('product_id', prodId)
            .maybeSingle();

          if (whBal) {
            const whQty = Number(whBal.quantity || 0);
            availableStock = Math.min(prodCurrentStock, whQty);
          } else {
            const { data: wh } = await supabase
              .from('warehouses')
              .select('is_default')
              .eq('id', invoice.warehouseId)
              .maybeSingle();

            if (wh?.is_default) {
              availableStock = prodCurrentStock;
            } else {
              availableStock = 0;
            }
          }
        } else {
          availableStock = prodCurrentStock;
        }

        if (availableStock <= 0) {
          throw new Error('Out of Stock — This product cannot be billed because no stock is available.');
        }

        if (req.qty > availableStock) {
          throw new Error(`Insufficient stock. Available: ${availableStock} ${unitLabel}.`);
        }
      }
    }

    // Try RPC first for transactional consistency
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('create_sales_invoice_atomic', {
        p_sale_json: payload
      });

      let parsedRpc: any = rpcData;
      if (typeof parsedRpc === 'string') {
        try {
          parsedRpc = JSON.parse(parsedRpc);
        } catch {
          // not json string
        }
      }

      if (!rpcError && parsedRpc && (parsedRpc.success || parsedRpc.sale_id || parsedRpc.id)) {
        const saleId = parsedRpc.sale_id || parsedRpc.id;
        return {
          ...invoice,
          id: saleId,
          invoiceNumber: parsedRpc.invoice_number || invoice.invoiceNumber,
          createdAt: parsedRpc.created_at || new Date().toISOString()
        } as SalesInvoice;
      }

      if (rpcError) {
        const errMsg = rpcError.message || '';
        // Authoritative stock validation exceptions from RPC must never be swallowed or bypassed!
        if (
          errMsg.includes('Out of Stock') ||
          errMsg.includes('No stock available') ||
          errMsg.includes('Insufficient stock') ||
          errMsg.includes('Credit limit of')
        ) {
          throw new Error(errMsg);
        }
      }

      // Safe Retry Handling: If invoice_number already exists (unique violation), fetch and return existing sale
      const isUniqueInvoiceErr = rpcError?.code === '23505' ||
        rpcError?.message?.includes('sales_company_id_invoice_number_key') ||
        rpcError?.message?.includes('invoice_number');

      if (isUniqueInvoiceErr && invoice.invoiceNumber) {
        console.log(`[SalesService Safe Retry] Invoice ${invoice.invoiceNumber} already exists in DB. Retrieving existing record.`);
        const { data: existingSale } = await supabase
          .from('sales')
          .select('*, sales_items (*)')
          .eq('company_id', finalCompanyId)
          .eq('invoice_number', invoice.invoiceNumber)
          .maybeSingle();

        if (existingSale) {
          return {
            id: existingSale.id,
            invoiceNumber: existingSale.invoice_number,
            docType: existingSale.doc_type || 'tax_invoice',
            date: existingSale.date,
            dueDate: existingSale.due_date,
            customerId: existingSale.customer_id,
            customerName: existingSale.customer_name,
            customerPhone: existingSale.customer_phone,
            customerGstin: existingSale.customer_gstin,
            customerAddress: existingSale.customer_address,
            warehouseId: existingSale.warehouse_id || '',
            items: (existingSale.sales_items || []).map((item: any) => ({
              id: item.id,
              productId: item.product_id,
              productName: item.product_name,
              sku: item.sku || '',
              barcode: item.barcode || '',
              hsn: item.hsn_sac || '',
              qty: Number(item.qty),
              unit: item.unit,
              rate: Number(item.rate),
              discountPct: Number(item.discount_pct || 0),
              discountAmt: Number(item.discount_amt || 0),
              taxRate: Number(item.tax_rate),
              taxAmt: Number(item.tax_amt),
              cgstAmt: Number(item.cgst_amt || 0),
              sgstAmt: Number(item.sgst_amt || 0),
              igstAmt: Number(item.igst_amt || 0),
              total: Number(item.total),
              costPrice: Number(item.cost_price || 0)
            })),
            subtotal: Number(existingSale.subtotal),
            discountTotal: Number(existingSale.discount_total || 0),
            taxTotal: Number(existingSale.tax_total),
            cgstTotal: Number(existingSale.cgst_total || 0),
            sgstTotal: Number(existingSale.sgst_total || 0),
            igstTotal: Number(existingSale.igst_total || 0),
            roundOff: Number(existingSale.round_off || 0),
            grandTotal: Number(existingSale.grand_total),
            paidAmount: Number(existingSale.paid_amount || 0),
            paymentStatus: (existingSale.payment_status as any) || 'Unpaid',
            paymentMethod: (existingSale.payment_method as any) || 'Cash',
            notes: existingSale.notes,
            terms: existingSale.terms,
            createdAt: existingSale.created_at
          } as SalesInvoice;
        }
      }
    } catch (e: any) {
      if (
        e?.message?.includes('Out of Stock') ||
        e?.message?.includes('No stock available') ||
        e?.message?.includes('Insufficient stock') ||
        e?.message?.includes('Credit limit of')
      ) {
        throw e;
      }
      console.warn('RPC create_sales_invoice_atomic exception, attempting direct transactional insert:', e?.message || e);
    }

    // Direct insert fallback if RPC not installed
    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .insert({
        company_id: finalCompanyId,
        invoice_number: invoice.invoiceNumber,
        doc_type: invoice.docType,
        date: invoice.date,
        due_date: invoice.dueDate,
        customer_id: invoice.customerId,
        customer_name: invoice.customerName,
        customer_gstin: invoice.customerGstin,
        subtotal: invoice.subtotal,
        discount_total: invoice.discountTotal,
        tax_total: invoice.taxTotal,
        cgst_total: invoice.cgstTotal,
        sgst_total: invoice.sgstTotal,
        igst_total: invoice.igstTotal,
        round_off: invoice.roundOff,
        grand_total: invoice.grandTotal,
        paid_amount: invoice.paidAmount,
        payment_status: invoice.paymentStatus,
        payment_method: invoice.paymentMethod,
        notes: invoice.notes,
        terms: invoice.terms
      })
      .select()
      .single();

    if (saleError || !saleData) {
      // Check if existing sale on unique collision
      if ((saleError?.code === '23505' || saleError?.message?.includes('invoice_number')) && invoice.invoiceNumber) {
        const { data: existingSale } = await supabase
          .from('sales')
          .select('*, sales_items (*)')
          .eq('company_id', finalCompanyId)
          .eq('invoice_number', invoice.invoiceNumber)
          .maybeSingle();

        if (existingSale) {
          return {
            id: existingSale.id,
            invoiceNumber: existingSale.invoice_number,
            docType: existingSale.doc_type || 'tax_invoice',
            date: existingSale.date,
            dueDate: existingSale.due_date,
            customerId: existingSale.customer_id,
            customerName: existingSale.customer_name,
            customerPhone: existingSale.customer_phone,
            customerGstin: existingSale.customer_gstin,
            customerAddress: existingSale.customer_address,
            warehouseId: existingSale.warehouse_id || '',
            items: (existingSale.sales_items || []).map((item: any) => ({
              id: item.id,
              productId: item.product_id,
              productName: item.product_name,
              sku: item.sku || '',
              barcode: item.barcode || '',
              hsn: item.hsn_sac || '',
              qty: Number(item.qty),
              unit: item.unit,
              rate: Number(item.rate),
              discountPct: Number(item.discount_pct || 0),
              discountAmt: Number(item.discount_amt || 0),
              taxRate: Number(item.tax_rate),
              taxAmt: Number(item.tax_amt),
              cgstAmt: Number(item.cgst_amt || 0),
              sgstAmt: Number(item.sgst_amt || 0),
              igstAmt: Number(item.igst_amt || 0),
              total: Number(item.total),
              costPrice: Number(item.cost_price || 0)
            })),
            subtotal: Number(existingSale.subtotal),
            discountTotal: Number(existingSale.discount_total || 0),
            taxTotal: Number(existingSale.tax_total),
            cgstTotal: Number(existingSale.cgst_total || 0),
            sgstTotal: Number(existingSale.sgst_total || 0),
            igstTotal: Number(existingSale.igst_total || 0),
            roundOff: Number(existingSale.round_off || 0),
            grandTotal: Number(existingSale.grand_total),
            paidAmount: Number(existingSale.paid_amount || 0),
            paymentStatus: (existingSale.payment_status as any) || 'Unpaid',
            paymentMethod: (existingSale.payment_method as any) || 'Cash',
            notes: existingSale.notes,
            terms: existingSale.terms,
            createdAt: existingSale.created_at
          } as SalesInvoice;
        }
      }

      console.error('Failed to insert sales invoice in Supabase:', saleError?.message);
      throw new Error(`Failed to create sales invoice: ${saleError?.message || 'Database insert error'}`);
    }

    // Insert items
    if (invoice.items.length > 0) {
      const itemsPayload = invoice.items.map(item => ({
        sale_id: saleData.id,
        product_id: item.productId,
        product_name: item.productName,
        sku: item.sku || '',
        barcode: item.barcode || '',
        hsn_sac: item.hsn || '',
        qty: item.qty,
        unit: item.unit,
        rate: item.rate,
        discount_pct: item.discountPct || 0,
        discount_amt: item.discountAmt || 0,
        tax_rate: item.taxRate,
        tax_amt: item.taxAmt,
        cgst_amt: item.cgstAmt || 0,
        sgst_amt: item.sgstAmt || 0,
        igst_amt: item.igstAmt || 0,
        total: item.total,
        cost_price: item.costPrice || 0
      }));
      const { error: itemsError } = await supabase.from('sales_items').insert(itemsPayload);
      if (itemsError) {
        console.error('Failed to insert sales items:', itemsError.message);
      }

      // Decrement stock for completed sales (Prompt #12: quotations do NOT reduce stock)
      if (invoice.docType === 'tax_invoice' || invoice.docType === 'delivery_challan' || invoice.docType === 'pos_invoice') {
        for (const item of invoice.items) {
          if (item.productId) {
            try {
              await supabase.rpc('decrement_product_stock', {
                p_product_id: item.productId,
                p_qty: item.qty
              });
            } catch {
              const { data } = await supabase.from('products').select('current_stock').eq('id', item.productId).single();
              if (data) {
                const currentStock = data.current_stock !== null && data.current_stock !== undefined ? Number(data.current_stock) : 0;
                await supabase.from('products').update({ current_stock: currentStock - item.qty }).eq('id', item.productId);
              }
            }

            // Decrement warehouse stock balance if warehouseId provided
            if (invoice.warehouseId) {
              const { data: curBal } = await supabase
                .from('stock_balances')
                .select('quantity')
                .eq('warehouse_id', invoice.warehouseId)
                .eq('product_id', item.productId)
                .maybeSingle();
              const newBal = (Number(curBal?.quantity || 0)) - item.qty;
              await supabase
                .from('stock_balances')
                .upsert(
                  {
                    company_id: finalCompanyId,
                    warehouse_id: invoice.warehouseId,
                    product_id: item.productId,
                    quantity: newBal,
                    updated_at: new Date().toISOString()
                  },
                  { onConflict: 'warehouse_id,product_id' }
                );
            }

            // Record stock transaction
            await supabase.from('stock_transactions').insert({
              company_id: finalCompanyId,
              date: invoice.date,
              type: 'Sale',
              product_id: item.productId,
              product_name: item.productName,
              warehouse_id: invoice.warehouseId || null,
              qty: -item.qty,
              unit: item.unit,
              unit_cost: item.rate,
              total_cost: item.total,
              reference_type: 'Sale',
              reference_id: saleData.id,
              reference_number: invoice.invoiceNumber
            });
          }
        }
      }
    }

    // Update customer outstanding if applicable
    if (invoice.customerId && invoice.docType === 'tax_invoice') {
      const balanceChange = invoice.grandTotal - invoice.paidAmount;
      const { data: custData } = await supabase.from('customers').select('current_outstanding, total_purchased, total_paid').eq('id', invoice.customerId).single();
      if (custData) {
        await supabase.from('customers').update({
          current_outstanding: Number(custData.current_outstanding || 0) + balanceChange,
          total_purchased: Number(custData.total_purchased || 0) + invoice.grandTotal,
          total_paid: Number(custData.total_paid || 0) + invoice.paidAmount
        }).eq('id', invoice.customerId);
      }
    }

    return {
      ...invoice,
      id: saleData.id,
      createdAt: saleData.created_at
    };
  },

  // Process Sales Return (Credit Note)
  async createSalesReturn(originalInvoiceId: string, returnedItems: { productId: string; qty: number; returnAmt: number }[], notes: string, companyId?: string): Promise<SalesInvoice> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const totalReturnAmt = returnedItems.reduce((sum, it) => sum + it.returnAmt, 0);

    // Try RPC first (process_sales_return_atomic)
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('process_sales_return_atomic', {
        p_company_id: finalCompanyId,
        p_original_sale_id: originalInvoiceId,
        p_return_items: returnedItems,
        p_reason: notes
      });

      if (!rpcError && rpcData?.success) {
        return {
          id: rpcData.return_id,
          invoiceNumber: rpcData.return_number,
          docType: 'credit_note',
          date: new Date().toISOString().split('T')[0],
          dueDate: new Date().toISOString().split('T')[0],
          customerId: '',
          customerName: 'Sales Return',
          warehouseId: '',
          items: returnedItems.map(it => ({
            id: it.productId,
            productId: it.productId,
            productName: 'Returned Item',
            sku: '',
            barcode: '',
            hsn: '',
            qty: it.qty,
            unit: 'Pcs',
            rate: it.qty > 0 ? it.returnAmt / it.qty : 0,
            discountPct: 0,
            discountAmt: 0,
            taxRate: 18,
            taxAmt: it.returnAmt * 0.18,
            cgstAmt: (it.returnAmt * 0.18) / 2,
            sgstAmt: (it.returnAmt * 0.18) / 2,
            igstAmt: 0,
            total: it.returnAmt,
            costPrice: 0
          })),
          subtotal: totalReturnAmt,
          discountTotal: 0,
          taxTotal: totalReturnAmt * 0.18,
          cgstTotal: (totalReturnAmt * 0.18) / 2,
          sgstTotal: (totalReturnAmt * 0.18) / 2,
          igstTotal: 0,
          roundOff: 0,
          grandTotal: totalReturnAmt,
          paidAmount: 0,
          paymentStatus: 'Paid',
          paymentMethod: 'Credit',
          notes,
          createdAt: new Date().toISOString()
        };
      }
    } catch (e) {
      console.warn('RPC process_sales_return_atomic unavailable, using direct fallback:', e);
    }

    // Direct fallback insertion
    const returnNumber = 'CRN-' + new Date().toISOString().replace(/\D/g, '').slice(2, 12);
    const { data: ret, error } = await supabase
      .from('sales_returns')
      .insert({
        company_id: finalCompanyId,
        return_number: returnNumber,
        original_sale_id: originalInvoiceId,
        return_amount: totalReturnAmt,
        tax_reversal: totalReturnAmt * 0.18,
        reason: notes,
        notes: notes
      })
      .select()
      .single();

    if (error || !ret) {
      console.error('Failed to insert sales return in Supabase:', error?.message);
      throw new Error(`Failed to process sales return: ${error?.message || 'Database insert error'}`);
    }

    // Restore inventory for each returned item
    for (const item of returnedItems) {
      if (item.productId && item.qty > 0) {
        const { data: prod } = await supabase.from('products').select('current_stock, name').eq('id', item.productId).single();
        if (prod) {
          await supabase.from('products').update({ current_stock: prod.current_stock + item.qty }).eq('id', item.productId);
          await supabase.from('stock_transactions').insert({
            company_id: finalCompanyId,
            date: new Date().toISOString().split('T')[0],
            type: 'Sales Return',
            product_id: item.productId,
            product_name: prod.name,
            qty: item.qty,
            unit: 'Pcs',
            unit_cost: item.returnAmt / item.qty,
            total_cost: item.returnAmt,
            reference_type: 'Sales Return',
            reference_id: ret.id,
            reference_number: returnNumber
          });
        }
      }
    }

    return {
      id: ret.id,
      invoiceNumber: returnNumber,
      docType: 'credit_note',
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date().toISOString().split('T')[0],
      customerId: '',
      customerName: 'Sales Return',
      warehouseId: '',
      items: returnedItems.map(item => ({
        id: item.productId,
        productId: item.productId,
        productName: 'Returned Item',
        sku: '',
        barcode: '',
        hsn: '',
        qty: item.qty,
        unit: 'Pcs',
        rate: item.qty > 0 ? item.returnAmt / item.qty : 0,
        discountPct: 0,
        discountAmt: 0,
        taxRate: 18,
        taxAmt: item.returnAmt * 0.18,
        cgstAmt: (item.returnAmt * 0.18) / 2,
        sgstAmt: (item.returnAmt * 0.18) / 2,
        igstAmt: 0,
        total: item.returnAmt,
        costPrice: 0
      })),
      subtotal: totalReturnAmt,
      discountTotal: 0,
      taxTotal: totalReturnAmt * 0.18,
      cgstTotal: (totalReturnAmt * 0.18) / 2,
      sgstTotal: (totalReturnAmt * 0.18) / 2,
      igstTotal: 0,
      roundOff: 0,
      grandTotal: totalReturnAmt,
      paidAmount: 0,
      paymentStatus: 'Paid',
      paymentMethod: 'Credit',
      notes: notes,
      createdAt: ret.created_at
    };
  },

  // Fetch sales returns
  async getSalesReturns(companyId?: string) {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const { data, error } = await supabase
      .from('sales_returns')
      .select('*, sales_return_items (*)')
      .eq('company_id', finalCompanyId)
      .order('date', { ascending: false });

    if (error) {
      console.warn('Error fetching sales returns:', error.message);
      return [];
    }
    return data || [];
  },

  // Fetch quotations
  async getQuotations(companyId?: string) {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const { data, error } = await supabase
      .from('quotations')
      .select('*, quotation_items (*)')
      .eq('company_id', finalCompanyId)
      .order('date', { ascending: false });

    if (error) {
      console.warn('Error fetching quotations:', error.message);
      return [];
    }
    return data || [];
  },

  async createQuotation(quote: any, companyId?: string) {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const docNumber = quote.docNumber || 'QTN-' + new Date().toISOString().replace(/\D/g, '').slice(2, 10);
    const { data, error } = await supabase
      .from('quotations')
      .insert({
        company_id: finalCompanyId,
        quotation_number: docNumber,
        customer_id: quote.customerId,
        customer_name: quote.customerName,
        date: quote.date,
        valid_until: quote.validUntil,
        subtotal: quote.subtotal,
        tax_total: quote.taxTotal,
        grand_total: quote.grandTotal,
        status: quote.status || 'Draft',
        notes: quote.notes,
        terms: quote.terms
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create quotation: ${error.message}`);
    return data;
  },

  // Delete sales invoice with company scope
  async deleteSalesInvoice(id: string, companyId?: string): Promise<void> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const { error } = await supabase
      .from('sales')
      .delete()
      .eq('id', id)
      .eq('company_id', finalCompanyId);
    if (error) throw new Error(`Failed to delete sales invoice: ${error.message}`);
  }
};
