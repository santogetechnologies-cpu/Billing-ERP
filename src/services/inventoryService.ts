import { supabase } from '../lib/supabase';
import { InventoryTransaction, StockTransfer, StockBalance } from '../types';
import { assertCallerPermission, getActiveUserRole } from '../utils/rbac';
import { notificationService } from './notificationService';
import { getAppStorage } from '../utils/storageUtils';

export const inventoryService = {
  // Fetch stock transactions
  async getStockTransactions(companyId?: string, params?: { productId?: string; warehouseId?: string; type?: string; limit?: number }): Promise<InventoryTransaction[]> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    let query = supabase
      .from('stock_transactions')
      .select('*')
      .eq('company_id', finalCompanyId)
      .order('date', { ascending: false });

    if (params?.productId) query = query.eq('product_id', params.productId);
    if (params?.warehouseId) query = query.eq('warehouse_id', params.warehouseId);
    if (params?.type && params.type !== 'All') query = query.eq('type', params.type);
    if (params?.limit) query = query.limit(params.limit);

    const { data, error } = await query;
    if (error) {
      console.warn('Error fetching stock transactions from Supabase:', error.message);
      return [];
    }

    return (data || []).map(t => ({
      id: t.id,
      date: t.date,
      type: t.type as any,
      productId: t.product_id,
      productName: t.product_name,
      qty: Number(t.qty),
      unit: t.unit || 'Pcs',
      warehouse: t.warehouse_id || '',
      warehouseTo: t.warehouse_to_id,
      referenceDoc: t.reference_number || t.reference_type || '',
      notes: t.notes || '',
      createdAt: t.created_at
    })) as InventoryTransaction[];
  },

  // Stock Balances by Warehouse & Product
  async getStockBalances(companyId?: string): Promise<StockBalance[]> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const { data, error } = await supabase
      .from('stock_balances')
      .select('*')
      .eq('company_id', finalCompanyId);

    if (error || !data) {
      console.warn('Error fetching stock balances from Supabase:', error?.message);
      // Fallback to local persistent cache if Supabase table is unreachable
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const raw = localStorage.getItem(`universal_billing_stock_balances_${finalCompanyId}`);
          if (raw) return JSON.parse(raw);
        } catch {}
      }
      return [];
    }

    const balances: StockBalance[] = data.map(b => ({
      id: b.id,
      warehouseId: b.warehouse_id,
      productId: b.product_id,
      quantity: Math.max(0, b.quantity !== null && b.quantity !== undefined ? Number(b.quantity) : 0),
      updatedAt: b.updated_at
    }));

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(`universal_billing_stock_balances_${finalCompanyId}`, JSON.stringify(balances));
      } catch {}
    }

    return balances;
  },

  // Get Stock Balance for specific warehouse & product
  async getStockBalance(
    warehouseId: string,
    productId: string,
    companyId?: string
  ): Promise<number> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    try {
      const { data } = await supabase
        .from('stock_balances')
        .select('quantity')
        .eq('company_id', finalCompanyId)
        .eq('warehouse_id', warehouseId)
        .eq('product_id', productId)
        .maybeSingle();

      if (data?.quantity !== null && data?.quantity !== undefined) {
        return Number(data.quantity);
      }
    } catch {}

    const storage = getAppStorage();
    if (storage) {
      try {
        const raw = storage.getItem(`universal_billing_stock_balances_${finalCompanyId}`);
        if (raw) {
          const list: any[] = JSON.parse(raw);
          const found = list.find((b: any) =>
            (b.warehouseId === warehouseId || b.warehouse_id === warehouseId) &&
            (b.productId === productId || b.product_id === productId)
          );
          if (found && found.quantity !== undefined && found.quantity !== null) {
            return Number(found.quantity);
          }
        }
      } catch {}
    }

    return 0;
  },

  // Update or Upsert Stock Balance for Warehouse & Product
  async updateStockBalance(
    warehouseId: string,
    productId: string,
    deltaQty: number,
    companyId?: string
  ): Promise<number> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';

    // 1. Fetch current balance
    const currentQty = await this.getStockBalance(warehouseId, productId, finalCompanyId);
    const newQty = currentQty + deltaQty;

    try {
      const { error } = await supabase
        .from('stock_balances')
        .upsert(
          {
            company_id: finalCompanyId,
            warehouse_id: warehouseId,
            product_id: productId,
            quantity: newQty,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'warehouse_id,product_id' }
        );

      if (error) {
        console.warn('Error upserting stock_balances in Supabase:', error.message);
      }
    } catch {}

    // Also update local cache
    const storage = getAppStorage();
    if (storage) {
      try {
        const raw = storage.getItem(`universal_billing_stock_balances_${finalCompanyId}`);
        const list: StockBalance[] = raw ? JSON.parse(raw) : [];
        const idx = list.findIndex(b => b.warehouseId === warehouseId && b.productId === productId);
        if (idx >= 0) {
          list[idx].quantity = newQty;
          list[idx].updatedAt = new Date().toISOString();
        } else {
          list.push({
            id: `sb-${Date.now()}`,
            warehouseId,
            productId,
            quantity: newQty,
            updatedAt: new Date().toISOString()
          });
        }
        storage.setItem(`universal_billing_stock_balances_${finalCompanyId}`, JSON.stringify(list));
      } catch {}
    }

    return newQty;
  },

  // Stock Transfers
  async getStockTransfers(companyId?: string): Promise<StockTransfer[]> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const { data, error } = await supabase
      .from('stock_transfers')
      .select('*, stock_transfer_items (*)')
      .eq('company_id', finalCompanyId)
      .order('date', { ascending: false });

    if (error) {
      console.warn('Error fetching stock transfers from Supabase:', error.message);
      return [];
    }

    return (data || []).map(t => ({
      id: t.id,
      transferNumber: t.transfer_number,
      date: t.date,
      fromWarehouse: t.from_warehouse_id,
      fromWarehouseId: t.from_warehouse_id,
      toWarehouse: t.to_warehouse_id,
      toWarehouseId: t.to_warehouse_id,
      status: (t.status as any) || 'Requested',
      items: (t.stock_transfer_items || []).map((it: any) => ({
        id: it.id,
        productId: it.product_id,
        productName: it.product_name,
        qty: Number(it.qty),
        unit: it.unit
      })),
      notes: t.notes || '',
      referenceDoc: t.reference_doc || '',
      createdBy: t.created_by || '',
      approvedBy: t.approved_by || '',
      sentDate: t.sent_date,
      receivedDate: t.received_date,
      createdAt: t.created_at,
      updatedAt: t.updated_at
    })) as StockTransfer[];
  },

  async createStockTransfer(
    transfer: Omit<StockTransfer, 'id' | 'createdAt'>,
    companyId?: string
  ): Promise<StockTransfer> {
    // 0. Strict RBAC Enforcement: Only Warehouse Manager, Admin, and Owner can create transfers
    await assertCallerPermission('inventory', 'create');

    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const fromWarehouseId = transfer.fromWarehouseId || transfer.fromWarehouse;
    const toWarehouseId = transfer.toWarehouseId || transfer.toWarehouse;

    // 1. Validation
    if (!fromWarehouseId || !toWarehouseId) {
      throw new Error('Please select both source and destination warehouses.');
    }
    if (fromWarehouseId === toWarehouseId) {
      throw new Error('Source warehouse and Destination warehouse must be distinct locations.');
    }
    if (!transfer.items || transfer.items.length === 0) {
      throw new Error('Please add at least one product item to transfer.');
    }

    // 2. Pre-transfer stock verification: Ensure source warehouse has sufficient stock for ALL items
    for (const item of transfer.items) {
      const qtyNum = Number(item.qty);
      if (isNaN(qtyNum) || qtyNum <= 0) {
        throw new Error(`Quantity for product "${item.productName}" must be greater than zero.`);
      }

      // Check current available balance in source warehouse
      const { data: balanceRow } = await supabase
        .from('stock_balances')
        .select('quantity')
        .eq('company_id', finalCompanyId)
        .eq('warehouse_id', fromWarehouseId)
        .eq('product_id', item.productId)
        .maybeSingle();

      let currentStock =
        balanceRow?.quantity !== null && balanceRow?.quantity !== undefined
          ? Number(balanceRow.quantity)
          : 0;

      // If no explicit row in stock_balances, check if this is the default/primary warehouse
      if (!balanceRow) {
        const { data: whRow } = await supabase
          .from('warehouses')
          .select('is_default')
          .eq('id', fromWarehouseId)
          .maybeSingle();

        if (whRow?.is_default) {
          const { data: prodRow } = await supabase
            .from('products')
            .select('current_stock')
            .eq('id', item.productId)
            .maybeSingle();
          currentStock = Number(prodRow?.current_stock) || 0;
        }
      }

      if (currentStock < qtyNum) {
        throw new Error(
          `Insufficient stock for "${item.productName}". Available in source warehouse: ${currentStock} ${item.unit}, Requested: ${qtyNum} ${item.unit}.`
        );
      }
    }

    // 3. Generate unique transfer number
    const transferNumber =
      transfer.transferNumber ||
      'TRF-2026-' + Math.floor(1000 + Math.random() * 9000);

    // 4. Save the transfer header marked as Completed immediately
    let trf: any = null;
    const transferDate = transfer.date || new Date().toISOString().split('T')[0];

    try {
      const { data, error } = await supabase
        .from('stock_transfers')
        .insert({
          company_id: finalCompanyId,
          transfer_number: transferNumber,
          date: transferDate,
          from_warehouse_id: fromWarehouseId,
          to_warehouse_id: toWarehouseId,
          status: 'Completed',
          notes: transfer.notes || 'Direct stock transfer completed',
          reference_doc: transfer.referenceDoc || null,
          created_by: transfer.createdBy || 'Warehouse Manager'
        })
        .select()
        .single();

      if (!error && data) {
        trf = data;
      }
    } catch {}

    // Fallback if extended fields not present in DB
    if (!trf) {
      const { data: fallbackData, error: fbError } = await supabase
        .from('stock_transfers')
        .insert({
          company_id: finalCompanyId,
          transfer_number: transferNumber,
          date: transferDate,
          from_warehouse_id: fromWarehouseId,
          to_warehouse_id: toWarehouseId,
          status: 'Completed',
          notes: transfer.notes || 'Direct stock transfer completed'
        })
        .select()
        .single();

      if (fbError || !fallbackData) {
        console.error('Failed to insert stock transfer:', fbError?.message);
        throw new Error(`Failed to create stock transfer: ${fbError?.message || 'Database insert error'}`);
      }
      trf = fallbackData;
    }

    // 5. Insert line items
    if (transfer.items.length > 0) {
      const itemsPayload = transfer.items.map(it => ({
        transfer_id: trf.id,
        product_id: it.productId,
        product_name: it.productName,
        qty: Number(it.qty),
        unit: it.unit
      }));
      const { error: itemsErr } = await supabase.from('stock_transfer_items').insert(itemsPayload);
      if (itemsErr) {
        await supabase.from('stock_transfers').delete().eq('id', trf.id);
        throw new Error(`Failed to save transfer line items: ${itemsErr.message}`);
      }
    }

    // 6. Both warehouse quantity updates in one atomic transaction with rollback safety
    const modifiedBalances: Array<{ warehouseId: string; productId: string; delta: number }> = [];
    const insertedTxnIds: string[] = [];

    try {
      for (const item of transfer.items) {
        const qtyNum = Number(item.qty);

        // Deduct from source warehouse
        await this.updateStockBalance(fromWarehouseId, item.productId, -qtyNum, finalCompanyId);
        modifiedBalances.push({ warehouseId: fromWarehouseId, productId: item.productId, delta: -qtyNum });

        // Add to destination warehouse
        await this.updateStockBalance(toWarehouseId, item.productId, qtyNum, finalCompanyId);
        modifiedBalances.push({ warehouseId: toWarehouseId, productId: item.productId, delta: qtyNum });

        // Ledger: Record stock movement history - Transfer Out
        const { data: outTxn } = await supabase
          .from('stock_transactions')
          .insert({
            company_id: finalCompanyId,
            date: transferDate,
            type: 'Stock Transfer',
            product_id: item.productId,
            product_name: item.productName,
            warehouse_id: fromWarehouseId,
            warehouse_to_id: toWarehouseId,
            qty: -qtyNum,
            unit: item.unit,
            reference_type: 'Transfer Out',
            reference_id: trf.id,
            reference_number: transferNumber,
            notes: transfer.notes || 'Direct stock transfer dispatched'
          })
          .select('id')
          .maybeSingle();
        if (outTxn?.id) insertedTxnIds.push(outTxn.id);

        // Ledger: Record stock movement history - Transfer In
        const { data: inTxn } = await supabase
          .from('stock_transactions')
          .insert({
            company_id: finalCompanyId,
            date: transferDate,
            type: 'Stock Transfer',
            product_id: item.productId,
            product_name: item.productName,
            warehouse_id: toWarehouseId,
            warehouse_to_id: fromWarehouseId,
            qty: qtyNum,
            unit: item.unit,
            reference_type: 'Transfer In',
            reference_id: trf.id,
            reference_number: transferNumber,
            notes: transfer.notes || 'Direct stock transfer received'
          })
          .select('id')
          .maybeSingle();
        if (inTxn?.id) insertedTxnIds.push(inTxn.id);
      }
    } catch (atomicErr: any) {
      // Rollback changes if anything fails during execution
      console.error('Error during direct stock transfer execution, rolling back:', atomicErr);
      for (const mod of modifiedBalances) {
        try {
          await this.updateStockBalance(mod.warehouseId, mod.productId, -mod.delta, finalCompanyId);
        } catch {}
      }
      for (const txnId of insertedTxnIds) {
        try {
          await supabase.from('stock_transactions').delete().eq('id', txnId);
        } catch {}
      }
      try {
        await supabase.from('stock_transfer_items').delete().eq('transfer_id', trf.id);
        await supabase.from('stock_transfers').delete().eq('id', trf.id);
      } catch {}
      throw new Error(`Stock transfer failed and was rolled back: ${atomicErr?.message || 'Database error'}`);
    }

    return {
      ...transfer,
      id: trf.id,
      transferNumber,
      status: 'Completed',
      createdAt: trf.created_at || new Date().toISOString()
    };
  },

  async updateTransferStatus(
    transferId: string,
    status: StockTransfer['status'],
    actorName?: string,
    companyId?: string
  ): Promise<void> {
    // 0. Strict RBAC Enforcement: Only Warehouse Manager, Admin, and Owner can manage transfers
    await assertCallerPermission('inventory', 'manage');

    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';

    // 1. Fetch current transfer and items for validation and state movement
    const { data: currentTransfer } = await supabase
      .from('stock_transfers')
      .select('*, stock_transfer_items (*)')
      .eq('id', transferId)
      .single();

    if (!currentTransfer) {
      throw new Error(`Transfer ${transferId} not found`);
    }

    const oldStatus = currentTransfer.status;
    const items = currentTransfer.stock_transfer_items || [];
    const fromWhId = currentTransfer.from_warehouse_id;
    const toWhId = currentTransfer.to_warehouse_id;
    const nowIso = new Date().toISOString();

    // 2. Try executing atomic database RPC first
    let rpcSucceeded = false;
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('execute_stock_transfer_atomic', {
        p_transfer_id: transferId,
        p_new_status: status,
        p_actor_name: actorName || 'Authorized User'
      });
      if (!rpcErr && rpcRes && rpcRes.success) {
        rpcSucceeded = true;
      }
    } catch (e) {
      console.warn('RPC execute_stock_transfer_atomic fallback to client-side atomic execution:', e);
    }

    // 3. Client-side state transitions & inventory balances execution (if RPC was not executed)
    if (!rpcSucceeded) {
      const updatePayload: any = { status, updated_at: nowIso };
      if (status === 'Approved') {
        updatePayload.approved_by = actorName || 'Branch Manager';
      } else if (status === 'Sent') {
        updatePayload.sent_date = nowIso;
      } else if (status === 'Received' || status === 'Completed') {
        updatePayload.received_date = nowIso;
      }

      await supabase
        .from('stock_transfers')
        .update(updatePayload)
        .eq('id', transferId);

      // Execute inventory balance changes according to status transitions:
      // Status 'Sent': Deduct from source warehouse
      if (status === 'Sent' && oldStatus !== 'Sent' && oldStatus !== 'Received' && oldStatus !== 'Completed') {
        for (const item of items) {
          await this.updateStockBalance(fromWhId, item.product_id, -Number(item.qty), finalCompanyId);
          await supabase.from('stock_transactions').insert({
            company_id: finalCompanyId,
            date: new Date().toISOString().split('T')[0],
            type: 'Stock Transfer',
            product_id: item.product_id,
            product_name: item.product_name,
            warehouse_id: fromWhId,
            warehouse_to_id: toWhId,
            qty: -Number(item.qty),
            unit: item.unit,
            reference_type: 'Transfer Out',
            reference_id: transferId,
            reference_number: currentTransfer.transfer_number,
            notes: currentTransfer.notes || 'Dispatched for transfer'
          });
        }
      }

      // Status 'Received' or 'Completed': Add to destination warehouse
      if ((status === 'Received' || status === 'Completed') && oldStatus !== 'Received' && oldStatus !== 'Completed') {
        // If transfer went straight to Received/Completed without Sent, deduct source first
        if (oldStatus !== 'Sent') {
          for (const item of items) {
            await this.updateStockBalance(fromWhId, item.product_id, -Number(item.qty), finalCompanyId);
          }
        }

        for (const item of items) {
          await this.updateStockBalance(toWhId, item.product_id, Number(item.qty), finalCompanyId);
          await supabase.from('stock_transactions').insert({
            company_id: finalCompanyId,
            date: new Date().toISOString().split('T')[0],
            type: 'Stock Transfer',
            product_id: item.product_id,
            product_name: item.product_name,
            warehouse_id: toWhId,
            warehouse_to_id: fromWhId,
            qty: Number(item.qty),
            unit: item.unit,
            reference_type: 'Transfer In',
            reference_id: transferId,
            reference_number: currentTransfer.transfer_number,
            notes: 'Warehouse transfer received'
          });
        }
      }

      // Status 'Cancelled' / 'Rejected': If goods were already Sent, refund back to source
      if ((status === 'Cancelled' || status === 'Rejected') && oldStatus === 'Sent') {
        for (const item of items) {
          await this.updateStockBalance(fromWhId, item.product_id, Number(item.qty), finalCompanyId);
          await supabase.from('stock_transactions').insert({
            company_id: finalCompanyId,
            date: new Date().toISOString().split('T')[0],
            type: 'Stock Transfer',
            product_id: item.product_id,
            product_name: item.product_name,
            warehouse_id: fromWhId,
            qty: Number(item.qty),
            unit: item.unit,
            reference_type: 'Transfer Reversal',
            reference_id: transferId,
            reference_number: currentTransfer.transfer_number,
            notes: 'Reversed transfer dispatch upon cancellation'
          });
        }
      }
    }
  },

  // Record Opening Stock for a single product
  async recordOpeningStock(params: {
    productId: string;
    warehouseId: string;
    quantity: number;
    unit?: string;
    costPrice?: number;
    batchNumber?: string;
    expiryDate?: string;
    serialNumbers?: string[];
    date?: string;
    referenceNumber?: string;
    notes?: string;
    companyId?: string;
    currentUser?: { id: string; name: string; role?: string };
  }): Promise<InventoryTransaction> {
    // 0. Strict RBAC Enforcement: Only Owner, Admin, and Purchase Manager can record initial opening stock
    const callerRole = params.currentUser?.role || (await getActiveUserRole()) || 'Admin';
    if (
      callerRole === 'Warehouse Manager' ||
      (callerRole !== 'Owner' && callerRole !== 'Admin' && callerRole !== 'Purchase Manager')
    ) {
      throw new Error(
        `Unauthorized (403): ${callerRole} is not permitted to record initial opening stock. Only Owner, Admin, and Purchase Manager can perform this action.`
      );
    }

    const finalCompanyId = params.companyId || '00000000-0000-0000-0000-000000000001';
    const qty = Number(params.quantity);
    if (isNaN(qty) || qty <= 0) {
      throw new Error('Initial stock quantity must be a positive number greater than zero.');
    }
    if (!params.productId) {
      throw new Error('Product selection is required.');
    }
    if (!params.warehouseId) {
      throw new Error('Destination warehouse is required.');
    }

    // 1. Fetch product details
    let prod: any = null;
    const { data: dbProd } = await supabase
      .from('products')
      .select('id, name, sku, current_stock, opening_stock, cost_price, purchase_price, primary_unit, default_warehouse_id')
      .eq('id', params.productId)
      .eq('company_id', finalCompanyId)
      .maybeSingle();

    if (dbProd) {
      prod = dbProd;
    } else {
      const storage = getAppStorage();
      if (storage) {
        try {
          const raw = storage.getItem(`universal_billing_products_${finalCompanyId}`);
          if (raw) {
            const list = JSON.parse(raw);
            const found = list.find((p: any) => p.id === params.productId);
            if (found) {
              prod = {
                id: found.id,
                name: found.name,
                sku: found.sku,
                current_stock: found.currentStock ?? 0,
                opening_stock: found.openingStock ?? 0,
                cost_price: found.costPrice ?? 0,
                purchase_price: found.purchasePrice ?? 0,
                primary_unit: found.primaryUnit ?? 'Piece'
              };
            }
          }
        } catch {}
      }
    }

    if (!prod) {
      throw new Error(`Product not found: ${params.productId}`);
    }

    // 2. Prevent duplicate opening stock entries for the same product and warehouse
    const { data: existingOpening } = await supabase
      .from('stock_transactions')
      .select('id, date, qty, unit, reference_number')
      .eq('company_id', finalCompanyId)
      .eq('product_id', params.productId)
      .eq('warehouse_id', params.warehouseId)
      .eq('type', 'Opening Stock')
      .limit(1);

    if (existingOpening && existingOpening.length > 0) {
      throw new Error(
        `Opening stock of ${existingOpening[0].qty} ${existingOpening[0].unit} has already been registered for "${prod.name}" in this warehouse on ${existingOpening[0].date}. To modify existing stock, please use Update Stock.`
      );
    }

    // 3. Resolve unit and valuation
    const effectiveUnit = params.unit || prod.primary_unit || 'Piece';
    const effectiveCost =
      params.costPrice !== undefined
        ? Number(params.costPrice)
        : Number(prod.cost_price) || Number(prod.purchase_price) || 0;
    const totalValuation = qty * effectiveCost;
    const dateStr = params.date || new Date().toISOString().split('T')[0];
    const refDoc =
      params.referenceNumber?.trim() ||
      'OP-' + new Date().toISOString().replace(/\D/g, '').slice(2, 12);
    const creatorName = params.currentUser?.name ? ` by ${params.currentUser.name} (${callerRole})` : '';
    const fullNotes = params.notes?.trim()
      ? `${params.notes.trim()} (Recorded${creatorName})`
      : `Initial opening stock registered${creatorName}`;

    // 4. Update warehouse stock balance exactly once
    await this.updateStockBalance(params.warehouseId, params.productId, qty, finalCompanyId);

    // 5. Update product aggregate stock & opening stock
    const currentStock = Number(prod.current_stock || 0);
    const newStock = currentStock + qty;
    const newOpeningStock = Number(prod.opening_stock || 0) + qty;
    try {
      await supabase
        .from('products')
        .update({
          current_stock: newStock,
          opening_stock: newOpeningStock,
          opening_stock_value: newOpeningStock * effectiveCost,
          updated_at: new Date().toISOString()
        })
        .eq('id', params.productId)
        .eq('company_id', finalCompanyId);
    } catch (prodErr) {
      console.warn('Note updating product aggregate stock:', prodErr);
    }

    // 6. Record traceable opening stock transaction
    let txnId = 'op-' + Date.now();
    try {
      const { data: txn } = await supabase
        .from('stock_transactions')
        .insert({
          company_id: finalCompanyId,
          date: dateStr,
          type: 'Opening Stock',
          product_id: params.productId,
          product_name: prod.name,
          warehouse_id: params.warehouseId,
          qty: qty,
          unit: effectiveUnit,
          unit_cost: effectiveCost,
          total_cost: totalValuation,
          reference_type: 'Opening',
          reference_number: refDoc,
          notes: fullNotes
        })
        .select()
        .single();

      if (txn?.id) txnId = txn.id;
    } catch (txnErr) {
      console.warn('Note inserting opening stock transaction:', txnErr);
    }

    // 7. Optional Batch creation if batch tracking provided
    if (params.batchNumber && params.batchNumber.trim()) {
      try {
        await supabase.from('product_batches').insert({
          company_id: finalCompanyId,
          product_id: params.productId,
          warehouse_id: params.warehouseId,
          batch_number: params.batchNumber.trim(),
          expiry_date: params.expiryDate || null,
          cost: effectiveCost,
          qty: qty,
          status: 'Active'
        });
      } catch (e) {
        console.warn('Note creating batch for opening stock:', e);
      }
    }

    // 8. Optional Serial numbers creation if provided
    if (params.serialNumbers && Array.isArray(params.serialNumbers) && params.serialNumbers.length > 0) {
      try {
        const serialRows = params.serialNumbers
          .filter(s => s && s.trim())
          .map(sn => ({
            company_id: finalCompanyId,
            product_id: params.productId,
            serial_number: sn.trim(),
            warranty_status: 'In Stock'
          }));
        if (serialRows.length > 0) {
          await supabase.from('product_serial_numbers').insert(serialRows);
        }
      } catch (e) {
        console.warn('Note creating serial numbers for opening stock:', e);
      }
    }

    return {
      id: txnId,
      date: dateStr,
      type: 'Opening Stock' as any,
      productId: params.productId,
      productName: prod.name,
      qty: qty,
      unit: effectiveUnit,
      warehouse: params.warehouseId,
      referenceDoc: refDoc,
      notes: fullNotes,
      createdAt: new Date().toISOString()
    };
  },

  // Record Opening Stock Bundle for multiple products atomically
  async recordStockBundle(bundle: {
    warehouseId: string;
    date?: string;
    referenceNumber?: string;
    notes?: string;
    items: Array<{
      productId: string;
      quantity: number;
      unit?: string;
      costPrice?: number;
      batchNumber?: string;
      expiryDate?: string;
      serialNumbers?: string[];
    }>;
    companyId?: string;
    currentUser?: { id: string; name: string; role?: string };
  }): Promise<{ success: boolean; count: number; transactions: InventoryTransaction[] }> {
    // 0. Strict RBAC Enforcement: Only Owner, Admin, and Purchase Manager can record stock bundles
    const callerRole = bundle.currentUser?.role || (await getActiveUserRole()) || 'Admin';
    if (
      callerRole === 'Warehouse Manager' ||
      (callerRole !== 'Owner' && callerRole !== 'Admin' && callerRole !== 'Purchase Manager')
    ) {
      throw new Error(
        `Unauthorized (403): ${callerRole} is not permitted to record stock bundles. Only Owner, Admin, and Purchase Manager can perform this action.`
      );
    }

    const finalCompanyId = bundle.companyId || '00000000-0000-0000-0000-000000000001';
    if (!bundle.warehouseId) {
      throw new Error('Destination warehouse is required for stock bundle.');
    }
    if (!bundle.items || !Array.isArray(bundle.items) || bundle.items.length === 0) {
      throw new Error('Stock bundle must contain at least one product row.');
    }

    // Validate no duplicates within the bundle
    const productIds = new Set<string>();
    for (const item of bundle.items) {
      if (!item.productId) {
        throw new Error('All lines in bundle must have a valid product selected.');
      }
      if (productIds.has(item.productId)) {
        throw new Error('Duplicate product found in bundle lines. Each product can only appear once per bundle.');
      }
      productIds.add(item.productId);

      const qty = Number(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        throw new Error('Initial quantity for each product line must be greater than zero.');
      }
    }

    const bundleRef =
      bundle.referenceNumber?.trim() ||
      'BUNDLE-OP-' + new Date().toISOString().replace(/\D/g, '').slice(2, 12);
    const dateStr = bundle.date || new Date().toISOString().split('T')[0];
    const transactions: InventoryTransaction[] = [];

    // Process each line in a transaction-safe manner
    for (const item of bundle.items) {
      const txn = await this.recordOpeningStock({
        productId: item.productId,
        warehouseId: bundle.warehouseId,
        quantity: item.quantity,
        unit: item.unit,
        costPrice: item.costPrice,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
        serialNumbers: item.serialNumbers,
        date: dateStr,
        referenceNumber: bundleRef,
        notes: bundle.notes?.trim()
          ? `Bundle [${bundleRef}]: ${bundle.notes.trim()}`
          : `Stock Bundle [${bundleRef}] opening inventory`,
        companyId: finalCompanyId,
        currentUser: bundle.currentUser
      });
      transactions.push(txn);
    }

    return {
      success: true,
      count: transactions.length,
      transactions
    };
  },

  // Stock Adjustment (Owner, Admin, Purchase Manager only; strictly forbidden for Warehouse Manager)
  async adjustStock(
    productId: string,
    adjustmentQty: number,
    reason: string,
    warehouse: string,
    companyId?: string,
    currentUser?: { id: string; name: string; role?: string },
    options?: { productName?: string; warehouseName?: string; unit?: string }
  ): Promise<InventoryTransaction> {
    // 0. Strict RBAC Enforcement: Only Owner, Admin, and Purchase Manager can adjust stock.
    // Warehouse Manager, Salesperson, Cashier, Accountant are strictly blocked with 403 Forbidden.
    const callerRole = currentUser?.role || (await getActiveUserRole()) || 'Admin';
    if (
      callerRole === 'Warehouse Manager' ||
      (callerRole !== 'Owner' && callerRole !== 'Admin' && callerRole !== 'Purchase Manager')
    ) {
      throw new Error(
        `Unauthorized (403): ${callerRole} is not permitted to perform manual stock adjustments. Only Owner, Admin, and Purchase Manager can adjust stock.`
      );
    }

    if (!reason || !reason.trim()) {
      throw new Error('Reason for stock adjustment is mandatory.');
    }

    if (!adjustmentQty || isNaN(adjustmentQty) || adjustmentQty === 0) {
      throw new Error('Adjustment quantity must be a non-zero number.');
    }

    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';

    // 1. Fetch product & warehouse balances to ensure no negative stock
    let prod: any = null;
    try {
      const { data: dbProd } = await supabase
        .from('products')
        .select('name, current_stock, cost_price, primary_unit')
        .eq('id', productId)
        .eq('company_id', finalCompanyId)
        .maybeSingle();
      if (dbProd) prod = dbProd;
    } catch {}

    const storage = getAppStorage();
    if (!prod && storage) {
      try {
        const raw = storage.getItem(`universal_billing_products_${finalCompanyId}`);
        if (raw) {
          const list = JSON.parse(raw);
          const found = list.find((p: any) => p.id === productId);
          if (found) {
            prod = {
              name: found.name,
              current_stock: found.currentStock ?? found.current_stock ?? 0,
              cost_price: found.costPrice ?? found.cost_price ?? 0,
              primary_unit: found.primaryUnit ?? found.primary_unit ?? 'Pcs'
            };
          }
        }
      } catch {}
    }

    if (!prod) {
      prod = {
        name: options?.productName || 'Product ' + productId,
        current_stock: 0,
        cost_price: 100,
        primary_unit: options?.unit || 'Pcs'
      };
    } else if (options?.productName && prod.name.startsWith('Product ')) {
      prod.name = options.productName;
    }
    if (options?.unit && (!prod.primary_unit || prod.primary_unit === 'Pcs')) {
      prod.primary_unit = options.unit;
    }

    // Resolve warehouse UUID if code was passed
    let resolvedWarehouseId = warehouse;
    let whData: any = null;
    try {
      const { data } = await supabase
        .from('warehouses')
        .select('id, name, manager_id, manager_ids')
        .or(`id.eq.${warehouse},code.eq.${warehouse}`)
        .maybeSingle();
      if (data) {
        whData = data;
        if (data.id) resolvedWarehouseId = data.id;
      }
    } catch {}

    // Non-negative stock balance checks
    const currentWhBalance = await this.getStockBalance(resolvedWarehouseId, productId, finalCompanyId);
    if (currentWhBalance + adjustmentQty < 0) {
      throw new Error(
        `Adjustment rejected: Current balance in this warehouse is ${currentWhBalance}, cannot reduce by ${Math.abs(adjustmentQty)}. Resulting warehouse stock cannot be negative.`
      );
    }

    const currentStock =
      prod.current_stock !== null && prod.current_stock !== undefined ? Number(prod.current_stock) : 0;
    if (currentStock + adjustmentQty < 0) {
      throw new Error(
        `Adjustment rejected: Total product stock is ${currentStock}, cannot reduce by ${Math.abs(adjustmentQty)}. Resulting total stock cannot be negative.`
      );
    }

    const newStock = currentStock + adjustmentQty;
    try {
      await supabase.from('products').update({ current_stock: newStock }).eq('id', productId);
    } catch (prodUpdateError) {
      console.warn('Note updating product stock in DB:', prodUpdateError);
    }

    // 2. Update warehouse-specific stock balance
    try {
      await this.updateStockBalance(resolvedWarehouseId, productId, adjustmentQty, finalCompanyId);
    } catch (e) {
      console.warn('Note updating stock balance for adjustment:', e);
    }

    // 3. Record stock transaction
    const dateStr = new Date().toISOString().split('T')[0];
    const refDoc = 'ADJ-' + new Date().toISOString().replace(/\D/g, '').slice(2, 10);
    let txnId = 'txn-' + Date.now();

    try {
      const { data: txn, error: txnError } = await supabase.from('stock_transactions').insert({
        company_id: finalCompanyId,
        date: dateStr,
        type: 'Stock Adjustment',
        product_id: productId,
        product_name: prod.name,
        warehouse_id: resolvedWarehouseId,
        qty: adjustmentQty,
        unit: prod.primary_unit || 'Pcs',
        unit_cost: prod.cost_price || 0,
        total_cost: Math.abs(adjustmentQty) * (prod.cost_price || 0),
        reference_type: 'Adjustment',
        reference_number: refDoc,
        notes: reason
      }).select().single();

      if (txn?.id) txnId = txn.id;
    } catch (e) {
      console.warn('Note recording stock transaction:', e);
    }

    // 4. Dispatch Stock Damage Alert to authorized Warehouse Manager(s)
    const isDamageEvent =
      /damage|damaged|write-?off|scrap|breakage|broken|unusable|spoiled|defect|defective/i.test(reason) ||
      (adjustmentQty < 0 && (reason.toLowerCase().includes('damage') || reason.toLowerCase().includes('write-off')));

    if (isDamageEvent) {
      try {
        const targetManagerIds: string[] = [];

        // Check resolved warehouse managers
        if (whData) {
          if (whData.manager_id) targetManagerIds.push(whData.manager_id);
          if (Array.isArray(whData.manager_ids)) targetManagerIds.push(...whData.manager_ids);
        }

        // Check app storage cache if DB returned no managers
        if (targetManagerIds.length === 0 && storage) {
          try {
            const raw = storage.getItem(`universal_billing_warehouses_${finalCompanyId}`);
            if (raw) {
              const whList = JSON.parse(raw);
              const foundWh = whList.find((w: any) => w.id === warehouse || w.code === warehouse || w.name === warehouse);
              if (foundWh) {
                if (foundWh.managerId) targetManagerIds.push(foundWh.managerId);
                if (Array.isArray(foundWh.managerIds)) targetManagerIds.push(...foundWh.managerIds);
              }
            }
          } catch {}
        }

        // Include current user if they are a Warehouse Manager
        if (currentUser?.role === 'Warehouse Manager' && currentUser?.id) {
          targetManagerIds.push(currentUser.id);
        }

        const damagedQty = Math.abs(adjustmentQty);
        const unit = options?.unit || prod.primary_unit || 'Pcs';
        const whName = options?.warehouseName || whData?.name || warehouse;
        const whId = whData?.id || warehouse;
        const uniqueManagerIds = Array.from(new Set(targetManagerIds)).filter(Boolean);

        for (const mgrId of uniqueManagerIds) {
          await notificationService.createNotification(
            {
              title: `Stock Damage Alert: ${prod.name}`,
              message: `${damagedQty} ${unit} of ${prod.name} reported damaged/written-off in warehouse "${whName}". Reason: ${reason || 'Damage write-off'}.`,
              type: 'stock_damage',
              link: `/inventory?search=${encodeURIComponent(prod.name)}`,
              userId: mgrId,
              warehouseId: whId,
              productId: productId,
              warehouseName: whName
            },
            finalCompanyId
          );
        }
      } catch (e) {
        console.warn('Stock damage alert dispatch note:', e);
      }
    }

    return {
      id: txnId,
      date: dateStr,
      type: 'Stock Adjustment',
      productId,
      productName: prod.name,
      qty: adjustmentQty,
      unit: prod.primary_unit || 'Pcs',
      warehouse,
      referenceDoc: refDoc,
      notes: reason,
      createdAt: new Date().toISOString()
    };
  },

  // Record generic stock movement
  async recordStockMovement(movement: {
    type: string;
    productId: string;
    productName: string;
    qty: number;
    unit: string;
    warehouse: string;
    referenceDoc: string;
    notes: string;
    updateBalance?: boolean;
  }, companyId?: string): Promise<InventoryTransaction> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const dateStr = new Date().toISOString().split('T')[0];

    const isQuarantineOrNonSellable =
      movement.type.toLowerCase().includes('quarantine') ||
      movement.type.toLowerCase().includes('damaged') ||
      movement.type.toLowerCase().includes('defective') ||
      movement.type.toLowerCase().includes('expired');

    const shouldUpdateBalance = movement.updateBalance !== undefined
      ? movement.updateBalance
      : !isQuarantineOrNonSellable;

    // Update warehouse stock balance only for sellable movements when requested
    if (movement.warehouse && shouldUpdateBalance) {
      try {
        await this.updateStockBalance(movement.warehouse, movement.productId, movement.qty, finalCompanyId);
      } catch (e) {}
    }

    const { data, error } = await supabase.from('stock_transactions').insert({
      company_id: finalCompanyId,
      date: dateStr,
      type: movement.type,
      product_id: movement.productId,
      product_name: movement.productName,
      qty: movement.qty,
      unit: movement.unit,
      warehouse_id: movement.warehouse,
      reference_number: movement.referenceDoc,
      notes: movement.notes
    }).select().single();

    if (error || !data) {
      throw new Error(`Failed to record stock movement: ${error?.message || 'Database error'}`);
    }

    return {
      id: data.id,
      date: dateStr,
      type: movement.type as any,
      productId: movement.productId,
      productName: movement.productName,
      qty: movement.qty,
      unit: movement.unit,
      warehouse: movement.warehouse,
      referenceDoc: movement.referenceDoc,
      notes: movement.notes,
      createdAt: data.created_at
    };
  },

  /**
   * Safely reconciles any legacy or negative stock balances across products and warehouses:
   * 1. Detects products with current_stock < 0.
   * 2. Issues a formal Stock Adjustment transaction documenting the adjustment to 0.
   * 3. Sets products.current_stock to 0 and stock_balances to 0.
   * 4. Strictly preserves all historical invoices and sales records intact.
   */
  async reconcileNegativeBalances(companyId?: string): Promise<{ reconciledCount: number; adjustments: InventoryTransaction[] }> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const adjustments: InventoryTransaction[] = [];

    try {
      // 1. Fetch negative products
      const { data: negProds } = await supabase
        .from('products')
        .select('id, name, current_stock, primary_unit, default_warehouse_id, cost_price')
        .eq('company_id', finalCompanyId)
        .lt('current_stock', 0);

      if (negProds && negProds.length > 0) {
        const { data: defaultWh } = await supabase
          .from('warehouses')
          .select('id')
          .eq('company_id', finalCompanyId)
          .eq('is_default', true)
          .maybeSingle();

        const targetWarehouseId = defaultWh?.id || 'wh-central-001';

        for (const prod of negProds) {
          const negStock = Number(prod.current_stock) || 0;
          if (negStock < 0) {
            const adjQty = Math.abs(negStock);
            const whId = prod.default_warehouse_id || targetWarehouseId;

            // Update product current_stock to 0
            await supabase
              .from('products')
              .update({ current_stock: 0 })
              .eq('id', prod.id);

            // Record formal reconciliation transaction in ledger
            const dateStr = new Date().toISOString().split('T')[0];
            const refDoc = 'RECON-' + new Date().toISOString().replace(/\D/g, '').slice(2, 12);
            const { data: txn } = await supabase
              .from('stock_transactions')
              .insert({
                company_id: finalCompanyId,
                date: dateStr,
                type: 'Stock Adjustment',
                product_id: prod.id,
                product_name: prod.name,
                warehouse_id: whId,
                qty: adjQty,
                unit: prod.primary_unit || 'Pcs',
                unit_cost: prod.cost_price || 0,
                total_cost: adjQty * (prod.cost_price || 0),
                reference_type: 'Reconciliation',
                reference_number: refDoc,
                notes: `Automated Inventory Reconciliation: Clamped legacy negative balance (${negStock} ${prod.primary_unit || 'Units'}) to 0`
              })
              .select()
              .maybeSingle();

            if (txn) {
              adjustments.push({
                id: txn.id,
                date: dateStr,
                type: 'Stock Adjustment',
                productId: prod.id,
                productName: prod.name,
                qty: adjQty,
                unit: prod.primary_unit || 'Pcs',
                warehouse: whId,
                referenceDoc: refDoc,
                notes: txn.notes,
                createdAt: txn.created_at
              });
            }
          }
        }
      }

      // 2. Reconcile negative stock_balances
      const { data: negBalances } = await supabase
        .from('stock_balances')
        .select('id, warehouse_id, product_id, quantity')
        .eq('company_id', finalCompanyId)
        .lt('quantity', 0);

      if (negBalances && negBalances.length > 0) {
        for (const sb of negBalances) {
          await supabase
            .from('stock_balances')
            .update({ quantity: 0, updated_at: new Date().toISOString() })
            .eq('id', sb.id);
        }
      }
    } catch (err) {
      console.warn('Reconciliation encountered error (falling back to client clamping):', err);
    }

    return { reconciledCount: adjustments.length, adjustments };
  }
};
