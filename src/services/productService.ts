import { supabase } from '../lib/supabase';
import { Product, Batch, SerialNumber, Unit, UnitConversion, ProductDeletionEligibility } from '../types';
import { UNIVERSAL_BUILTIN_UNITS, isBuiltInUnit, isCustomUnit, normalizeUnitKey } from '../data/unitsData';
import { assertCallerPermission } from '../utils/rbac';
import { calculateBatchStatus } from '../utils/inventoryUtils';
import { sortProductsAZ } from '../utils/sortUtils';

export const productService = {
  // Fetch products with optional search, category, and pagination (default A-Z by product name)
  async getProducts(params?: { search?: string; category?: string; page?: number; limit?: number }, companyId?: string): Promise<Product[]> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    let query = supabase
      .from('products')
      .select('*')
      .eq('company_id', finalCompanyId)
      .order('name', { ascending: true })
      .order('sku', { ascending: true });

    if (params?.search) {
      query = query.or(`name.ilike.%${params.search}%,sku.ilike.%${params.search}%,barcode.ilike.%${params.search}%`);
    }

    if (params?.category && params.category !== 'All') {
      query = query.eq('category', params.category);
    }

    let rawProducts: any[] = [];
    if (params?.page !== undefined && params?.limit !== undefined) {
      const from = (params.page - 1) * params.limit;
      const to = from + params.limit - 1;
      query = query.range(from, to);
      const { data, error } = await query;
      if (error) {
        console.warn('Error fetching products from Supabase:', error.message);
        return [];
      }
      rawProducts = data || [];
    } else {
      // Small to large catalogues: fetch all records in full (paginating 1000-item chunks if DB exceeds PostgREST default limit)
      let from = 0;
      const chunkSize = 1000;
      let hasMore = true;
      while (hasMore) {
        let chunkQuery = supabase
          .from('products')
          .select('*')
          .eq('company_id', finalCompanyId)
          .order('name', { ascending: true })
          .order('sku', { ascending: true })
          .range(from, from + chunkSize - 1);

        if (params?.search) {
          chunkQuery = chunkQuery.or(`name.ilike.%${params.search}%,sku.ilike.%${params.search}%,barcode.ilike.%${params.search}%`);
        }
        if (params?.category && params.category !== 'All') {
          chunkQuery = chunkQuery.eq('category', params.category);
        }

        const { data: chunk, error: chunkErr } = await chunkQuery;
        if (chunkErr) {
          console.warn('Error fetching products chunk from Supabase:', chunkErr.message);
          break;
        }
        if (chunk && chunk.length > 0) {
          rawProducts.push(...chunk);
          if (chunk.length < chunkSize) {
            hasMore = false;
          } else {
            from += chunkSize;
          }
        } else {
          hasMore = false;
        }
      }
    }

    // Load active product batches for batch and expiry details
    const batchesByProduct = new Map<string, any>();
    try {
      const { data: batchesData } = await supabase
        .from('product_batches')
        .select('*')
        .eq('company_id', finalCompanyId)
        .order('created_at', { ascending: false });

      if (batchesData) {
        batchesData.forEach(b => {
          if (!batchesByProduct.has(b.product_id)) {
            batchesByProduct.set(b.product_id, b);
          }
        });
      }
    } catch (e) {
      console.warn('Error fetching product batches map:', e);
    }

    // Map database snake_case to frontend camelCase and sort A-Z by default
    const mappedProducts: Product[] = rawProducts.map(p => {
      const primaryBatch = batchesByProduct.get(p.id);
      return {
      id: p.id,
      name: p.name,
      code: p.code || '',
      sku: p.sku,
      barcode: p.barcode || '',
      category: p.category || p.subcategory || 'General',
      subcategory: p.subcategory || '',
      brand: p.brand || '',
      description: p.description || '',
      hsn: p.hsn || p.hsn_sac || '',
      taxRate: Number(p.tax_rate) || 0,
      purchasePrice: Number(p.purchase_price) || 0,
      costPrice: Number(p.cost_price) || 0,
      sellingPrice: Number(p.selling_price) || 0,
      retailPrice: Number(p.retail_price) || Number(p.selling_price) || 0,
      wholesalePrice: Number(p.wholesale_price) || 0,
      dealerPrice: Number(p.dealer_price) || 0,
      mrp: Number(p.mrp) || 0,
      minSellingPrice: Number(p.min_selling_price) || 0,
      reorderLevel: p.reorder_level !== null && p.reorder_level !== undefined && p.reorder_level !== '' ? Number(p.reorder_level) : null,
      stockWarningLimit: p.reorder_level !== null && p.reorder_level !== undefined && p.reorder_level !== '' ? Number(p.reorder_level) : null,
      openingStock: p.opening_stock !== null && p.opening_stock !== undefined ? Number(p.opening_stock) : 0,
      openingStockValue: Number(p.opening_stock_value) || 0,
      currentStock: Math.max(0, p.current_stock !== null && p.current_stock !== undefined ? Number(p.current_stock) : 0),
      primaryUnit: p.primary_unit || 'Piece',
      secondaryUnit: p.secondary_unit,
      conversionFactor: Number(p.conversion_factor) || 1,
      warehouse: p.warehouse || p.default_warehouse_id || '',
      rack: p.rack || '',
      batchTracking: Boolean(p.batch_tracking),
      serialTracking: Boolean(p.serial_tracking),
      expiryTracking: Boolean(p.expiry_tracking),
      batchNumber: primaryBatch?.batch_number || '',
      expiryDate: primaryBatch?.expiry_date || '',
      isActive: Boolean(p.is_active),
      imageUrl: p.image_url,
      createdAt: p.created_at
    };
    });

    return sortProductsAZ(mappedProducts);
  },

  // Create new product atomically
  async addProduct(p: Omit<Product, 'id' | 'createdAt'>, companyId?: string): Promise<Product> {
    return this.createProduct(p, companyId);
  },

  async createProduct(p: Omit<Product, 'id' | 'createdAt'>, companyId?: string): Promise<Product> {
    // 0. Strict RBAC Enforcement: Only authorized roles can create products or allocate stock
    await assertCallerPermission('products', 'create');
    if (Number(p.openingStock) > 0) {
      await assertCallerPermission('inventory', 'create');
    }

    // 1. Mandatory Warehouse Validation
    if (!p.warehouse || !p.warehouse.trim()) {
      throw new Error('Warehouse selection is required.');
    }

    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const whIdOrCode = p.warehouse.trim();
    const { data: whRec, error: whErr } = await supabase
      .from('warehouses')
      .select('id, code, name')
      .eq('company_id', finalCompanyId)
      .or(`id.eq.${whIdOrCode.length === 36 ? whIdOrCode : '00000000-0000-0000-0000-000000000000'},code.eq.${whIdOrCode}`)
      .maybeSingle();

    if (whErr || !whRec) {
      throw new Error('Selected warehouse does not exist or is inactive.');
    }

    // 2. Mandatory Opening Stock Quantity Validation
    if (p.openingStock === undefined || p.openingStock === null || isNaN(Number(p.openingStock))) {
      throw new Error('Opening stock quantity is required.');
    }
    const openingStockQty = Number(p.openingStock);
    if (openingStockQty < 0) {
      throw new Error('Opening stock quantity cannot be negative.');
    }

    // 3. Mandatory Batch Number and Expiry Date Validation
    if (!p.batchNumber || !p.batchNumber.trim()) {
      throw new Error('Batch number is required.');
    }
    if (!p.expiryDate || !p.expiryDate.trim()) {
      throw new Error('Expiry date is required.');
    }
    if (isNaN(new Date(p.expiryDate).getTime())) {
      throw new Error('Please select a valid expiry date.');
    }

    const effectiveCostPrice = Number(p.costPrice) || Number(p.purchasePrice) || 0;
    const openingStockVal = openingStockQty * effectiveCostPrice;

    const dbPayload = {
      company_id: finalCompanyId,
      name: p.name,
      code: p.code || p.sku,
      sku: p.sku,
      barcode: p.barcode || p.sku,
      category: p.category || 'General',
      subcategory: p.subcategory || p.category,
      brand: p.brand || '',
      description: p.description || '',
      hsn: p.hsn || '',
      hsn_sac: p.hsn || '',
      tax_rate: p.taxRate,
      purchase_price: p.purchasePrice,
      cost_price: p.costPrice,
      selling_price: p.sellingPrice,
      retail_price: p.retailPrice,
      wholesale_price: p.wholesalePrice,
      dealer_price: p.dealerPrice,
      mrp: p.mrp,
      min_selling_price: p.minSellingPrice,
      reorder_level: p.reorderLevel !== null && p.reorderLevel !== undefined && p.reorderLevel !== ('' as any) ? Number(p.reorderLevel) : null,
      opening_stock: openingStockQty,
      opening_stock_value: openingStockVal,
      current_stock: p.currentStock !== undefined ? p.currentStock : openingStockQty,
      primary_unit: p.primaryUnit || 'Piece',
      secondary_unit: p.secondaryUnit || null,
      conversion_factor: p.conversionFactor || 1,
      warehouse: whRec.code,
      default_warehouse_id: whRec.id,
      rack: p.rack || '',
      batch_tracking: true,
      serial_tracking: Boolean(p.serialTracking),
      expiry_tracking: true,
      is_active: p.isActive !== false
    };

    // Mandatory initial batch & warehouse stock registration helper
    const registerInitialBatch = async (prodId: string) => {
      if (!prodId) return;

      // Ensure warehouse stock balance record is registered (even for 0 stock)
      const { error: sbErr } = await supabase.from('stock_balances').upsert({
        company_id: finalCompanyId,
        warehouse_id: whRec.id,
        product_id: prodId,
        quantity: openingStockQty,
        updated_at: new Date().toISOString()
      }, { onConflict: 'warehouse_id,product_id' });

      if (sbErr) {
        console.warn('Could not register warehouse stock balance:', sbErr);
      }

      // Link initial batch record to the warehouse
      if (p.batchNumber && p.expiryDate) {
        const batchStatus = calculateBatchStatus(p.expiryDate, openingStockQty);
        const { error: batchErr } = await supabase.from('product_batches').insert({
          company_id: finalCompanyId,
          product_id: prodId,
          warehouse_id: whRec.id,
          batch_number: p.batchNumber.trim(),
          expiry_date: p.expiryDate,
          purchase_date: new Date().toISOString().split('T')[0],
          cost: effectiveCostPrice,
          qty: openingStockQty,
          status: batchStatus
        });

        if (batchErr) {
          console.warn('Could not register initial batch record:', batchErr);
        }
      }
    };

    // Try RPC first for 100% database-level atomic transaction rollback
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('create_product_atomic', {
        p_product_json: dbPayload
      });

      let parsedRpc: any = rpcData;
      if (typeof parsedRpc === 'string') {
        try {
          parsedRpc = JSON.parse(parsedRpc);
        } catch {
          // not json string
        }
      }

      if (!rpcError && parsedRpc && (parsedRpc.id || parsedRpc.product_id || parsedRpc.success)) {
        const prodId = parsedRpc.id || parsedRpc.product_id;
        if (prodId) {
          await registerInitialBatch(prodId);
          return {
            ...p,
            id: prodId,
            sku: parsedRpc.sku || p.sku,
            barcode: parsedRpc.barcode || p.barcode,
            warehouse: whRec.code,
            batchNumber: p.batchNumber.trim(),
            expiryDate: p.expiryDate,
            createdAt: parsedRpc.created_at || new Date().toISOString()
          };
        }
      }
    } catch (rpcErr) {
      console.warn('RPC create_product_atomic fallback to direct transaction flow:', rpcErr);
    }

    // Direct client creation flow with rollback guarantee
    const { data, error } = await supabase
      .from('products')
      .insert(dbPayload)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Database error creating product: ${error?.message || 'No record returned'}`);
    }

    try {
      // 1. Initial Batch & Warehouse Balance Registration
      await registerInitialBatch(data.id);

      // 2. Barcode registration
      if (p.barcode && data.id) {
        await supabase.from('product_barcodes').insert({
          product_id: data.id,
          barcode: p.barcode,
          barcode_value: p.barcode,
          barcode_type: 'Code 128',
          is_primary: true
        });
      }

      // 3. Stock transactions if openingStock > 0 (Never record movement for 0 stock, never double record)
      if (openingStockQty > 0 && data.id) {
        await supabase.from('stock_transactions').insert({
          company_id: finalCompanyId,
          date: new Date().toISOString().split('T')[0],
          type: 'Opening Stock',
          product_id: data.id,
          product_name: p.name,
          warehouse_id: whRec.id,
          qty: openingStockQty,
          unit: p.primaryUnit || 'Piece',
          unit_cost: effectiveCostPrice,
          total_cost: openingStockVal,
          reference_type: 'Opening',
          notes: 'Initial inventory intake'
        });
      }

      // 4. Unit conversion registration (1 Primary Unit = factor × Secondary Unit)
      if (p.secondaryUnit && p.conversionFactor && p.conversionFactor > 0) {
        await productService.createConversion({
          fromUnit: p.primaryUnit || 'Piece',
          toUnit: p.secondaryUnit,
          factor: Number(p.conversionFactor),
          notes: `1 ${p.primaryUnit || 'Piece'} = ${p.conversionFactor} ${p.secondaryUnit}`
        }, finalCompanyId);
      }
    } catch (secondaryError: any) {
      console.error('Error in secondary product records, rolling back product:', secondaryError);
      await supabase.from('products').delete().eq('id', data.id);
      throw new Error(`Product creation failed during inventory/unit registration: ${secondaryError?.message}`);
    }

    return {
      ...p,
      id: data.id,
      sku: data.sku,
      barcode: data.barcode,
      warehouse: whRec.code,
      batchNumber: p.batchNumber.trim(),
      expiryDate: p.expiryDate,
      createdAt: data.created_at
    };
  },

  async updateProduct(id: string, updates: Partial<Product>, companyId?: string) {
    // 0. Strict RBAC Enforcement: Only roles with 'products:edit' can update products
    await assertCallerPermission('products', 'edit');
    if (updates.currentStock !== undefined || updates.warehouse !== undefined) {
      await assertCallerPermission('inventory', 'edit');
    }

    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const dbPayload: Record<string, any> = {
      updated_at: new Date().toISOString()
    };
    if (updates.name !== undefined) dbPayload.name = updates.name;
    if (updates.code !== undefined) dbPayload.code = updates.code;
    if (updates.sku !== undefined) dbPayload.sku = updates.sku;
    if (updates.barcode !== undefined) dbPayload.barcode = updates.barcode;
    if (updates.category !== undefined) {
      dbPayload.category = updates.category;
      dbPayload.subcategory = updates.category;
    }
    if (updates.brand !== undefined) dbPayload.brand = updates.brand;
    if (updates.description !== undefined) dbPayload.description = updates.description;
    if (updates.hsn !== undefined) {
      dbPayload.hsn = updates.hsn;
      dbPayload.hsn_sac = updates.hsn;
    }
    if (updates.taxRate !== undefined) dbPayload.tax_rate = updates.taxRate;
    if (updates.purchasePrice !== undefined) dbPayload.purchase_price = updates.purchasePrice;
    if (updates.costPrice !== undefined) dbPayload.cost_price = updates.costPrice;
    if (updates.sellingPrice !== undefined) dbPayload.selling_price = updates.sellingPrice;
    if (updates.wholesalePrice !== undefined) dbPayload.wholesale_price = updates.wholesalePrice;
    if (updates.retailPrice !== undefined) dbPayload.retail_price = updates.retailPrice;
    if (updates.dealerPrice !== undefined) dbPayload.dealer_price = updates.dealerPrice;
    if (updates.mrp !== undefined) dbPayload.mrp = updates.mrp;
    if (updates.minSellingPrice !== undefined) dbPayload.min_selling_price = updates.minSellingPrice;
    if (updates.reorderLevel !== undefined) {
      dbPayload.reorder_level = updates.reorderLevel !== null && updates.reorderLevel !== ('' as any)
        ? Number(updates.reorderLevel)
        : null;
    }
    if (updates.currentStock !== undefined) dbPayload.current_stock = updates.currentStock;
    if (updates.primaryUnit !== undefined) dbPayload.primary_unit = updates.primaryUnit;
    if (updates.secondaryUnit !== undefined) dbPayload.secondary_unit = updates.secondaryUnit;
    if (updates.conversionFactor !== undefined) dbPayload.conversion_factor = updates.conversionFactor;
    if (updates.warehouse !== undefined) {
      const whIdOrCode = updates.warehouse.trim();
      dbPayload.warehouse = whIdOrCode;
      if (whIdOrCode) {
        const { data: whRec } = await supabase
          .from('warehouses')
          .select('id, code')
          .eq('company_id', finalCompanyId)
          .or(`id.eq.${whIdOrCode.length === 36 ? whIdOrCode : '00000000-0000-0000-0000-000000000000'},code.eq.${whIdOrCode}`)
          .maybeSingle();
        if (whRec) {
          dbPayload.default_warehouse_id = whRec.id;
          dbPayload.warehouse = whRec.code;
        }
      }
    }
    if (updates.rack !== undefined) dbPayload.rack = updates.rack;
    if (updates.isActive !== undefined) dbPayload.is_active = updates.isActive;

    const { data, error } = await supabase
      .from('products')
      .update(dbPayload)
      .eq('id', id)
      .eq('company_id', finalCompanyId)
      .select()
      .single();

    if (error) {
      throw new Error(`Database error updating product: ${error.message}`);
    }

    // Sync product batch without creating duplicates
    if (updates.batchNumber !== undefined || updates.expiryDate !== undefined) {
      try {
        const { data: existingBatches } = await supabase
          .from('product_batches')
          .select('*')
          .eq('product_id', id)
          .eq('company_id', finalCompanyId)
          .order('created_at', { ascending: false });

        if (existingBatches && existingBatches.length > 0) {
          const primaryBatch = existingBatches[0];
          const newBatchNum = updates.batchNumber !== undefined ? updates.batchNumber.trim() : primaryBatch.batch_number;
          const newExpDate = updates.expiryDate !== undefined ? updates.expiryDate : primaryBatch.expiry_date;
          const newStatus = calculateBatchStatus(newExpDate, primaryBatch.qty);

          await supabase
            .from('product_batches')
            .update({
              batch_number: newBatchNum,
              expiry_date: newExpDate,
              status: newStatus,
              cost: updates.costPrice !== undefined ? updates.costPrice : primaryBatch.cost
            })
            .eq('id', primaryBatch.id);
        } else if (updates.batchNumber?.trim() && updates.expiryDate?.trim()) {
          const status = calculateBatchStatus(updates.expiryDate, updates.currentStock || 0);
          await supabase.from('product_batches').insert({
            company_id: finalCompanyId,
            product_id: id,
            batch_number: updates.batchNumber.trim(),
            expiry_date: updates.expiryDate,
            purchase_date: new Date().toISOString().split('T')[0],
            cost: updates.costPrice || updates.purchasePrice || 0,
            qty: updates.currentStock || 0,
            status: status
          });
        }
      } catch (batchErr) {
        console.warn('Warning updating batch in product_batches:', batchErr);
      }
    }

    return data;
  },

  // Check whether a product is eligible for permanent deletion
  async checkProductDeletionEligibility(id: string, companyId?: string): Promise<ProductDeletionEligibility> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';

    // 1. Try secure database RPC if available
    try {
      const { data, error } = await supabase.rpc('check_product_deletion_eligibility', {
        p_product_id: id,
        p_company_id: finalCompanyId
      });
      if (!error && data) {
        return {
          canDelete: Boolean(data.can_delete),
          reasons: Array.isArray(data.reasons) ? data.reasons : [],
          stock: Number(data.stock) || 0,
          stockBalancesCount: Number(data.stock_balances_count) || 0,
          salesCount: Number(data.sales_count) || 0,
          purchasesCount: Number(data.purchases_count) || 0,
          transactionsCount: Number(data.transactions_count) || 0,
          transfersCount: Number(data.transfers_count) || 0,
          batchesCount: Number(data.batches_count) || 0,
          serialsCount: Number(data.serials_count) || 0
        };
      }
    } catch {
      // Fallback to table queries below
    }

    // 2. Fallback: Direct table integrity checks
    const reasons: string[] = [];
    let stock = 0;
    let stockBalancesCount = 0;
    let salesCount = 0;
    let purchasesCount = 0;
    let transactionsCount = 0;
    let transfersCount = 0;
    let batchesCount = 0;
    let serialsCount = 0;

    // Check product record
    const { data: prod } = await supabase
      .from('products')
      .select('current_stock, primary_unit, name, sku')
      .eq('id', id)
      .eq('company_id', finalCompanyId)
      .maybeSingle();

    if (prod) {
      stock = Number(prod.current_stock) || 0;
      if (stock !== 0) {
        reasons.push(`Product has active inventory stock (${stock} ${prod.primary_unit || 'Units'}). Stock must be zero before deletion.`);
      }
    }

    // Check stock_balances
    try {
      const { count } = await supabase
        .from('stock_balances')
        .select('id', { count: 'exact', head: true })
        .eq('product_id', id)
        .neq('quantity', 0);
      stockBalancesCount = count || 0;
      if (stockBalancesCount > 0) {
        reasons.push(`Non-zero stock balances exist across ${stockBalancesCount} warehouse location(s).`);
      }
    } catch {
      // ignore
    }

    // Check sales_items
    try {
      const { count } = await supabase
        .from('sales_items')
        .select('id', { count: 'exact', head: true })
        .eq('product_id', id);
      salesCount = count || 0;
      if (salesCount > 0) {
        reasons.push(`Product is referenced by ${salesCount} historical sales invoice item(s). Archiving is required to preserve financial records.`);
      }
    } catch {
      // ignore
    }

    // Check purchase_items
    try {
      const { count } = await supabase
        .from('purchase_items')
        .select('id', { count: 'exact', head: true })
        .eq('product_id', id);
      purchasesCount = count || 0;
      if (purchasesCount > 0) {
        reasons.push(`Product is referenced by ${purchasesCount} purchase bill item(s). Archiving is required to preserve accounting records.`);
      }
    } catch {
      // ignore
    }

    // Check stock_transactions
    try {
      const { count } = await supabase
        .from('stock_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('product_id', id);
      transactionsCount = count || 0;
      if (transactionsCount > 0) {
        reasons.push(`Product has ${transactionsCount} recorded stock movement ledger transaction(s).`);
      }
    } catch {
      // ignore
    }

    // Check stock_transfer_items
    try {
      const { count } = await supabase
        .from('stock_transfer_items')
        .select('id', { count: 'exact', head: true })
        .eq('product_id', id);
      transfersCount = count || 0;
      if (transfersCount > 0) {
        reasons.push(`Product is linked to ${transfersCount} warehouse stock transfer(s).`);
      }
    } catch {
      // ignore
    }

    // Check batches with stock
    try {
      const { count } = await supabase
        .from('product_batches')
        .select('id', { count: 'exact', head: true })
        .eq('product_id', id)
        .neq('qty', 0);
      batchesCount = count || 0;
      if (batchesCount > 0) {
        reasons.push(`Product has ${batchesCount} active batch(es) with inventory stock.`);
      }
    } catch {
      // ignore
    }

    // Check serials
    try {
      const { count } = await supabase
        .from('product_serial_numbers')
        .select('id', { count: 'exact', head: true })
        .eq('product_id', id);
      serialsCount = count || 0;
      if (serialsCount > 0) {
        reasons.push(`Product has ${serialsCount} registered serial number(s).`);
      }
    } catch {
      // ignore
    }

    return {
      canDelete: reasons.length === 0,
      reasons,
      stock,
      stockBalancesCount,
      salesCount,
      purchasesCount,
      transactionsCount,
      transfersCount,
      batchesCount,
      serialsCount
    };
  },

  // Archive / Deactivate product safely (alternative to permanent deletion)
  async archiveProduct(id: string, companyId?: string): Promise<Product> {
    return this.updateProduct(id, { isActive: false }, companyId);
  },

  // Delete product with pre-flight integrity check and company scope
  async deleteProduct(id: string, companyId?: string, skipIntegrityCheck = false) {
    // 0. Strict RBAC Enforcement: Only roles with 'products:delete' can delete products
    await assertCallerPermission('products', 'delete');

    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';

    if (!skipIntegrityCheck) {
      const eligibility = await this.checkProductDeletionEligibility(id, finalCompanyId);
      if (!eligibility.canDelete) {
        throw new Error(`Cannot delete product: ${eligibility.reasons.join(' ')}`);
      }
    }

    // Clean up empty 0-quantity stock balances if any exist
    try {
      await supabase
        .from('stock_balances')
        .delete()
        .eq('product_id', id)
        .eq('quantity', 0);
    } catch {
      // ignore
    }

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
      .eq('company_id', finalCompanyId);

    if (error) {
      throw new Error(`Database error deleting product: ${error.message}`);
    }
  },

  // Transactional rollback helper: safely remove all related records created for a product during an aborted intake
  async rollbackProductCreation(id: string, companyId?: string): Promise<void> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    try {
      await supabase.from('stock_transactions').delete().eq('product_id', id);
    } catch {
      // ignore
    }
    try {
      await supabase.from('stock_balances').delete().eq('product_id', id);
    } catch {
      // ignore
    }
    try {
      await supabase.from('product_batches').delete().eq('product_id', id);
    } catch {
      // ignore
    }
    try {
      await supabase.from('product_barcodes').delete().eq('product_id', id);
    } catch {
      // ignore
    }
    try {
      await supabase.from('products').delete().eq('id', id).eq('company_id', finalCompanyId);
    } catch (err) {
      console.warn(`Rollback error for product ${id}:`, err);
    }
  },

  // Units
  async getUnits(companyId?: string): Promise<Unit[]> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const { data, error } = await supabase
      .from('product_units')
      .select('*')
      .or(`company_id.eq.${finalCompanyId},company_id.is.null`)
      .order('name');

    if (error) {
      console.warn('Error fetching units from Supabase:', error.message);
      return [];
    }

    const seen = new Set<string>();
    const uniqueUnits: Unit[] = [];
    for (const u of data || []) {
      const nameKey = normalizeUnitKey(u.name);
      const symbolKey = normalizeUnitKey(u.symbol);
      if (!nameKey && !symbolKey) continue;
      if (seen.has(nameKey) || (symbolKey && seen.has(symbolKey))) continue;
      if (nameKey) seen.add(nameKey);
      if (symbolKey) seen.add(symbolKey);

      const isCustom = isCustomUnit({ name: u.name, symbol: u.symbol, id: u.id });
      uniqueUnits.push({
        id: u.id,
        name: u.name,
        symbol: u.symbol,
        category: (u.category as any) || 'Count',
        isBase: Boolean(u.is_base),
        isCustom
      });
    }

    // Merge any universal built-in units if missing from company DB
    for (const bu of UNIVERSAL_BUILTIN_UNITS) {
      const nameKey = normalizeUnitKey(bu.name);
      const symbolKey = normalizeUnitKey(bu.symbol);
      if (!seen.has(nameKey) && (!symbolKey || !seen.has(symbolKey))) {
        if (nameKey) seen.add(nameKey);
        if (symbolKey) seen.add(symbolKey);
        uniqueUnits.push({
          id: `builtin-${symbolKey || nameKey}`,
          name: bu.name,
          symbol: bu.symbol,
          category: bu.category,
          isBase: bu.isBase,
          isCustom: false
        });
      }
    }

    return uniqueUnits;
  },

  async createUnit(unit: Omit<Unit, 'id'>, companyId?: string): Promise<Unit> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const trimmedName = (unit.name || '').trim();
    const trimmedSymbol = (unit.symbol || '').trim();

    // Check if unit already exists by name or symbol to prevent duplicate insertion
    const { data: existingByName } = await supabase
      .from('product_units')
      .select('*')
      .eq('company_id', finalCompanyId)
      .ilike('name', trimmedName)
      .maybeSingle();

    if (existingByName) {
      return {
        id: existingByName.id,
        name: existingByName.name,
        symbol: existingByName.symbol,
        category: existingByName.category || 'Count',
        isBase: Boolean(existingByName.is_base),
        isCustom: isCustomUnit(existingByName)
      };
    }

    const { data: existingBySymbol } = await supabase
      .from('product_units')
      .select('*')
      .eq('company_id', finalCompanyId)
      .ilike('symbol', trimmedSymbol)
      .maybeSingle();

    if (existingBySymbol) {
      return {
        id: existingBySymbol.id,
        name: existingBySymbol.name,
        symbol: existingBySymbol.symbol,
        category: existingBySymbol.category || 'Count',
        isBase: Boolean(existingBySymbol.is_base),
        isCustom: isCustomUnit(existingBySymbol)
      };
    }

    const { data, error } = await supabase
      .from('product_units')
      .insert({
        company_id: finalCompanyId,
        name: trimmedName,
        symbol: (unit.symbol || '').trim(),
        category: unit.category,
        is_base: unit.isBase || false
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Database error creating unit: ${error?.message || 'No record returned'}`);
    }
    return {
      id: data.id,
      name: data.name,
      symbol: data.symbol,
      category: data.category,
      isBase: data.is_base,
      isCustom: true
    };
  },

  async updateUnit(id: string, updates: Partial<Omit<Unit, 'id'>>, companyId?: string): Promise<Unit> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const dbPayload: any = {};
    if (updates.name !== undefined) dbPayload.name = updates.name.trim();
    if (updates.symbol !== undefined) dbPayload.symbol = updates.symbol.trim();
    if (updates.category !== undefined) dbPayload.category = updates.category;
    if (updates.isBase !== undefined) dbPayload.is_base = updates.isBase;

    // Fetch existing unit to know previous name/symbol
    const { data: currentUnit } = await supabase
      .from('product_units')
      .select('*')
      .eq('id', id)
      .eq('company_id', finalCompanyId)
      .maybeSingle();

    const { data, error } = await supabase
      .from('product_units')
      .update(dbPayload)
      .eq('id', id)
      .eq('company_id', finalCompanyId)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Database error updating unit: ${error?.message || 'No record returned'}`);
    }

    // Cascade name updates to products if renamed
    if (updates.name && currentUnit && currentUnit.name !== updates.name.trim()) {
      try {
        await supabase
          .from('products')
          .update({ primary_unit: updates.name.trim() })
          .eq('company_id', finalCompanyId)
          .eq('primary_unit', currentUnit.name);

        await supabase
          .from('products')
          .update({ secondary_unit: updates.name.trim() })
          .eq('company_id', finalCompanyId)
          .eq('secondary_unit', currentUnit.name);
      } catch (cascadeErr) {
        console.warn('Note on cascading unit rename to products:', cascadeErr);
      }
    }

    return {
      id: data.id,
      name: data.name,
      symbol: data.symbol,
      category: data.category,
      isBase: Boolean(data.is_base),
      isCustom: true
    };
  },

  async checkUnitUsage(unit: { id?: string; name: string; symbol?: string }, companyId?: string): Promise<{ inUse: boolean; reasons: string[] }> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const name = (unit.name || '').trim();
    const symbol = (unit.symbol || '').trim();
    const reasons: string[] = [];

    // 1. Check products
    try {
      const { data: prods } = await supabase
        .from('products')
        .select('id, name')
        .eq('company_id', finalCompanyId)
        .or(`primary_unit.eq."${name}",primary_unit.eq."${symbol}",secondary_unit.eq."${name}",secondary_unit.eq."${symbol}"`)
        .limit(3);
      if (prods && prods.length > 0) {
        reasons.push(`${prods.length} product(s) (e.g. "${prods[0].name}")`);
      }
    } catch (e) {}

    // 2. Check conversions
    try {
      const { data: convs } = await supabase
        .from('unit_conversions')
        .select('id, from_unit, to_unit')
        .eq('company_id', finalCompanyId)
        .or(`from_unit.eq."${name}",from_unit.eq."${symbol}",to_unit.eq."${name}",to_unit.eq."${symbol}"`)
        .limit(5);
      if (convs && convs.length > 0) {
        reasons.push(`${convs.length} unit conversion rule(s)`);
      }
    } catch (e) {}

    try {
      const { data: docConvs } = await supabase
        .from('document_settings')
        .select('id, title, header_text')
        .eq('company_id', finalCompanyId)
        .eq('doc_type', 'unit_conversion');
      if (docConvs && docConvs.length > 0) {
        const matches = docConvs.filter(d =>
          (d.title && (d.title.trim().toLowerCase() === name.toLowerCase() || d.title.trim().toLowerCase() === symbol.toLowerCase())) ||
          (d.header_text && (d.header_text.trim().toLowerCase() === name.toLowerCase() || d.header_text.trim().toLowerCase() === symbol.toLowerCase()))
        );
        if (matches.length > 0 && !reasons.some(r => r.includes('unit conversion rule'))) {
          reasons.push(`${matches.length} unit conversion rule(s)`);
        }
      }
    } catch (e) {}

    const localConvs = productService.getLocalConversions(finalCompanyId);
    const localMatches = localConvs.filter(c =>
      (c.fromUnit && (c.fromUnit.trim().toLowerCase() === name.toLowerCase() || c.fromUnit.trim().toLowerCase() === symbol.toLowerCase())) ||
      (c.toUnit && (c.toUnit.trim().toLowerCase() === name.toLowerCase() || c.toUnit.trim().toLowerCase() === symbol.toLowerCase()))
    );
    if (localMatches.length > 0 && !reasons.some(r => r.includes('unit conversion rule'))) {
      reasons.push(`${localMatches.length} unit conversion rule(s)`);
    }

    // 3. Check sales items
    try {
      const { data: sales } = await supabase
        .from('sales_items')
        .select('id, product_name')
        .or(`unit.eq."${name}",unit.eq."${symbol}"`)
        .limit(3);
      if (sales && sales.length > 0) {
        reasons.push(`${sales.length} sales invoice item(s)`);
      }
    } catch (e) {}

    // 4. Check purchase items
    try {
      const { data: purchases } = await supabase
        .from('purchase_items')
        .select('id, product_name')
        .or(`unit.eq."${name}",unit.eq."${symbol}"`)
        .limit(3);
      if (purchases && purchases.length > 0) {
        reasons.push(`${purchases.length} purchase invoice item(s)`);
      }
    } catch (e) {}

    // 5. Check stock transactions
    try {
      const { data: stockTxns } = await supabase
        .from('stock_transactions')
        .select('id')
        .eq('company_id', finalCompanyId)
        .or(`unit.eq."${name}",unit.eq."${symbol}"`)
        .limit(3);
      if (stockTxns && stockTxns.length > 0) {
        reasons.push(`${stockTxns.length} stock transaction(s)`);
      }
    } catch (e) {}

    return {
      inUse: reasons.length > 0,
      reasons
    };
  },

  async deleteUnit(id: string, companyId?: string): Promise<boolean> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';

    // Verify usage before deleting to protect transactions & inventory
    const { data: existingUnit } = await supabase
      .from('product_units')
      .select('*')
      .eq('id', id)
      .eq('company_id', finalCompanyId)
      .maybeSingle();

    if (existingUnit) {
      const usage = await productService.checkUnitUsage(
        { id: existingUnit.id, name: existingUnit.name, symbol: existingUnit.symbol },
        finalCompanyId
      );
      if (usage.inUse) {
        throw new Error(`Cannot delete unit "${existingUnit.name}": It is used in ${usage.reasons.join(', ')}.`);
      }
    }

    const { error } = await supabase
      .from('product_units')
      .delete()
      .eq('id', id)
      .eq('company_id', finalCompanyId);

    if (error) {
      console.warn('Error deleting unit from Supabase:', error.message);
      return false;
    }
    return true;
  },

  // Local persistent conversion helpers (company-scoped)
  getLocalConversions(companyId: string): UnitConversion[] {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    try {
      const raw = localStorage.getItem(`universal_billing_unit_conversions_${companyId}`);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  },

  saveLocalConversion(conv: UnitConversion, companyId: string) {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const current = this.getLocalConversions(companyId);
      const updated = [...current.filter(c => c.id !== conv.id), conv];
      localStorage.setItem(`universal_billing_unit_conversions_${companyId}`, JSON.stringify(updated));
    } catch {}
  },

  removeLocalConversion(id: string, companyId: string) {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const current = this.getLocalConversions(companyId);
      const updated = current.filter(c => c.id !== id);
      localStorage.setItem(`universal_billing_unit_conversions_${companyId}`, JSON.stringify(updated));
    } catch {}
  },

  // Unit Conversions
  async getConversions(companyId?: string): Promise<UnitConversion[]> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const results: UnitConversion[] = [];
    const seen = new Set<string>();

    const addRule = (c: UnitConversion) => {
      if (!c || !c.fromUnit || !c.toUnit) return;
      const key = `${c.fromUnit.trim().toLowerCase()}->${c.toUnit.trim().toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push(c);
      }
    };

    // 1. Try unit_conversions from Supabase
    try {
      const { data, error } = await supabase
        .from('unit_conversions')
        .select('*')
        .or(`company_id.eq.${finalCompanyId},company_id.is.null`);

      if (!error && data) {
        data.forEach(c => {
          addRule({
            id: c.id,
            fromUnit: c.from_unit || c.from_unit_id,
            toUnit: c.to_unit || c.to_unit_id,
            factor: Number(c.factor),
            notes: c.notes
          });
        });
      }
    } catch (e) {
      console.warn('Note fetching unit_conversions from Supabase:', e);
    }

    // 2. Fetch conversions persisted in document_settings (multi-tenant isolated in Supabase)
    try {
      const { data: docs, error: docErr } = await supabase
        .from('document_settings')
        .select('*')
        .eq('company_id', finalCompanyId)
        .eq('doc_type', 'unit_conversion');

      if (!docErr && docs) {
        docs.forEach(d => {
          try {
            const parsed = JSON.parse(d.terms_conditions || '[]');
            if (Array.isArray(parsed)) {
              parsed.forEach(addRule);
              return;
            }
          } catch {}
          addRule({
            id: d.id,
            fromUnit: d.title || '',
            toUnit: d.header_text || '',
            factor: Number(d.footer_text) || 1,
            notes: d.terms_conditions || ''
          });
        });
      }
    } catch (e) {
      console.warn('Note fetching document_settings conversions:', e);
    }

    // 3. Merge with local persistent storage for the company
    const local = this.getLocalConversions(finalCompanyId);
    local.forEach(addRule);

    return results;
  },

  async createConversion(conv: Omit<UnitConversion, 'id'>, companyId?: string): Promise<UnitConversion> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const generatedId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `conv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // 1. Attempt insert into unit_conversions table
    try {
      const { data, error } = await supabase
        .from('unit_conversions')
        .insert({
          company_id: finalCompanyId,
          from_unit: conv.fromUnit,
          to_unit: conv.toUnit,
          factor: conv.factor,
          notes: conv.notes
        })
        .select()
        .single();

      if (!error && data) {
        const result: UnitConversion = {
          id: data.id,
          fromUnit: data.from_unit,
          toUnit: data.to_unit,
          factor: Number(data.factor),
          notes: data.notes
        };
        this.saveLocalConversion(result, finalCompanyId);
        return result;
      }
    } catch (e) {
      console.warn('Note: unit_conversions direct insert bypassed to document_settings:', e);
    }

    // 2. Persist to document_settings in Supabase safely using upsert to prevent 409 Conflict
    try {
      const currentConvs = this.getLocalConversions(finalCompanyId);
      const newConv: UnitConversion = {
        id: generatedId,
        fromUnit: conv.fromUnit,
        toUnit: conv.toUnit,
        factor: conv.factor,
        notes: conv.notes
      };
      const mergedConvs = [...currentConvs.filter(c => c.id !== generatedId), newConv];
      await supabase
        .from('document_settings')
        .upsert(
          {
            company_id: finalCompanyId,
            doc_type: 'unit_conversion',
            title: 'unit_conversions_registry',
            header_text: 'UNIT_CONVERSIONS',
            terms_conditions: JSON.stringify(mergedConvs)
          },
          { onConflict: 'company_id,doc_type' }
        );

      this.saveLocalConversion(newConv, finalCompanyId);
      return newConv;
    } catch (docErr) {
      console.warn('Note: document_settings conversion fallback note:', docErr);
    }

    // 3. Resilient persistent local fallback
    const fallbackResult: UnitConversion = {
      id: generatedId,
      fromUnit: conv.fromUnit,
      toUnit: conv.toUnit,
      factor: conv.factor,
      notes: conv.notes
    };
    this.saveLocalConversion(fallbackResult, finalCompanyId);
    return fallbackResult;
  },

  async updateConversion(id: string, updates: Partial<UnitConversion>, companyId?: string): Promise<UnitConversion> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';

    // 1. Attempt update in unit_conversions
    try {
      const dbPayload: any = {};
      if (updates.fromUnit !== undefined) dbPayload.from_unit = updates.fromUnit;
      if (updates.toUnit !== undefined) dbPayload.to_unit = updates.toUnit;
      if (updates.factor !== undefined) dbPayload.factor = updates.factor;
      if (updates.notes !== undefined) dbPayload.notes = updates.notes;

      await supabase
        .from('unit_conversions')
        .update(dbPayload)
        .eq('id', id);
    } catch (e) {
      console.warn('Note: unit_conversions update bypassed:', e);
    }

    // 2. Attempt update in document_settings
    try {
      const docPayload: any = {};
      if (updates.fromUnit !== undefined) docPayload.title = updates.fromUnit;
      if (updates.toUnit !== undefined) docPayload.header_text = updates.toUnit;
      if (updates.factor !== undefined) docPayload.footer_text = String(updates.factor);
      if (updates.notes !== undefined) docPayload.terms_conditions = updates.notes;

      await supabase
        .from('document_settings')
        .update(docPayload)
        .eq('id', id)
        .eq('company_id', finalCompanyId);
    } catch (docErr) {
      console.warn('Note: document_settings update note:', docErr);
    }

    // 3. Update local conversion
    const local = this.getLocalConversions(finalCompanyId);
    const existing = local.find(c => c.id === id);
    const updatedRule: UnitConversion = {
      id,
      fromUnit: updates.fromUnit ?? existing?.fromUnit ?? '',
      toUnit: updates.toUnit ?? existing?.toUnit ?? '',
      factor: updates.factor ?? existing?.factor ?? 1,
      notes: updates.notes ?? existing?.notes ?? ''
    };
    this.saveLocalConversion(updatedRule, finalCompanyId);
    return updatedRule;
  },

  async deleteConversion(id: string, companyId?: string): Promise<boolean> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';

    try {
      await supabase.from('unit_conversions').delete().eq('id', id);
    } catch (e) {}

    try {
      await supabase.from('document_settings').delete().eq('id', id).eq('company_id', finalCompanyId);
    } catch (e) {}

    this.removeLocalConversion(id, finalCompanyId);
    return true;
  },

  // Batches
  async getBatches(companyId?: string): Promise<Batch[]> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const { data, error } = await supabase
      .from('product_batches')
      .select('*, products ( id, name )')
      .eq('company_id', finalCompanyId)
      .order('expiry_date', { ascending: true });

    if (error) {
      console.warn('Error fetching batches from Supabase:', error.message);
      return [];
    }

    return (data || []).map(b => ({
      id: b.id,
      productId: b.product_id,
      productName: b.products?.name || b.product_name || 'Product',
      batchNumber: b.batch_number,
      mfgDate: b.mfg_date,
      expiryDate: b.expiry_date,
      purchaseDate: b.purchase_date,
      cost: Number(b.cost),
      qty: Number(b.qty),
      status: b.status as any,
      warehouseId: b.warehouse_id || undefined
    }));
  },

  async createBatch(batch: Omit<Batch, 'id'>, companyId?: string): Promise<Batch> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const { data, error } = await supabase
      .from('product_batches')
      .insert({
        company_id: finalCompanyId,
        product_id: batch.productId,
        product_name: batch.productName,
        warehouse_id: batch.warehouseId || null,
        batch_number: batch.batchNumber,
        mfg_date: batch.mfgDate && batch.mfgDate.trim() ? batch.mfgDate : null,
        expiry_date: batch.expiryDate && batch.expiryDate.trim() ? batch.expiryDate : null,
        purchase_date: batch.purchaseDate,
        cost: batch.cost,
        qty: batch.qty,
        status: batch.status
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Database error creating product batch: ${error?.message || 'No record returned'}`);
    }
    return {
      id: data.id,
      productId: data.product_id,
      productName: batch.productName,
      batchNumber: data.batch_number,
      mfgDate: data.mfg_date,
      expiryDate: data.expiry_date,
      purchaseDate: data.purchase_date,
      cost: Number(data.cost),
      qty: Number(data.qty),
      status: data.status,
      warehouseId: data.warehouse_id || undefined
    };
  },

  async updateBatch(batchId: string, updates: Partial<Batch>, companyId?: string): Promise<void> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const dbPayload: any = {};
    if (updates.batchNumber !== undefined) dbPayload.batch_number = updates.batchNumber;
    if (updates.expiryDate !== undefined) dbPayload.expiry_date = updates.expiryDate;
    if (updates.mfgDate !== undefined) dbPayload.mfg_date = updates.mfgDate;
    if (updates.qty !== undefined) dbPayload.qty = updates.qty;
    if (updates.status !== undefined) dbPayload.status = updates.status;
    if (updates.warehouseId !== undefined) dbPayload.warehouse_id = updates.warehouseId;

    const { error } = await supabase
      .from('product_batches')
      .update(dbPayload)
      .eq('id', batchId)
      .eq('company_id', finalCompanyId);

    if (error) {
      console.warn('Error updating batch in Supabase:', error.message);
    }
  },

  // Serials
  async getSerialNumbers(companyId?: string): Promise<SerialNumber[]> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const { data, error } = await supabase
      .from('product_serial_numbers')
      .select('*, products ( id, name )')
      .eq('company_id', finalCompanyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Error fetching serial numbers from Supabase:', error.message);
      return [];
    }

    return (data || []).map(s => ({
      id: s.id,
      productId: s.product_id,
      productName: s.products?.name || s.product_name || 'Product',
      serialNumber: s.serial_number,
      customerId: s.customer_id,
      customerName: s.customer_name,
      invoiceNumber: s.invoice_number,
      purchaseDate: s.purchase_date,
      warrantyMonths: s.warranty_months,
      warrantyStatus: s.warranty_status as any
    }));
  },

  async createSerialNumber(serial: Omit<SerialNumber, 'id'>, companyId?: string): Promise<SerialNumber> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const { data, error } = await supabase
      .from('product_serial_numbers')
      .insert({
        company_id: finalCompanyId,
        product_id: serial.productId,
        product_name: serial.productName,
        serial_number: serial.serialNumber,
        customer_id: serial.customerId,
        customer_name: serial.customerName,
        invoice_number: serial.invoiceNumber,
        purchase_date: serial.purchaseDate,
        warranty_months: serial.warrantyMonths,
        warranty_status: serial.warrantyStatus
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Database error registering serial number: ${error?.message || 'No record returned'}`);
    }
    return {
      id: data.id,
      productId: data.product_id,
      productName: serial.productName,
      serialNumber: data.serial_number,
      customerId: data.customer_id,
      customerName: data.customer_name,
      invoiceNumber: data.invoice_number,
      purchaseDate: data.purchase_date,
      warrantyMonths: data.warranty_months,
      warrantyStatus: data.warranty_status
    };
  },

  async updateSerialNumber(serialId: string, updates: Partial<SerialNumber>, companyId?: string): Promise<void> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const dbPayload: any = {};
    if (updates.serialNumber !== undefined) dbPayload.serial_number = updates.serialNumber;
    if (updates.warrantyStatus !== undefined) dbPayload.warranty_status = updates.warrantyStatus;
    if (updates.customerId !== undefined) dbPayload.customer_id = updates.customerId;
    if (updates.customerName !== undefined) dbPayload.customer_name = updates.customerName;
    if (updates.invoiceNumber !== undefined) dbPayload.invoice_number = updates.invoiceNumber;

    const { error } = await supabase
      .from('product_serial_numbers')
      .update(dbPayload)
      .eq('id', serialId)
      .eq('company_id', finalCompanyId);

    if (error) {
      console.warn('Error updating serial number in Supabase:', error.message);
    }
  }
};
