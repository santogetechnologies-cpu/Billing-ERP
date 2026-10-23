-- Migration 014: Stored Procedures & Atomic Transactions

-- 13. CONCURRENCY-SAFE SEQUENCE & SKU GENERATION FUNCTIONS
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_next_sequence(
  p_company_id UUID,
  p_doc_type VARCHAR,
  p_fy VARCHAR DEFAULT NULL
)
RETURNS VARCHAR AS $$
DECLARE
  v_prefix VARCHAR;
  v_seq INT;
  v_target_fy VARCHAR;
  v_comp_prefix VARCHAR;
  v_comp_start INT;
  v_formatted VARCHAR;
BEGIN
  IF p_fy IS NOT NULL AND p_fy != '' THEN
    v_target_fy := p_fy;
  ELSE
    SELECT 
      COALESCE(
        c.financial_year,
        CASE 
          WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 4 
          THEN EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || (EXTRACT(YEAR FROM CURRENT_DATE) + 1)::TEXT
          ELSE (EXTRACT(YEAR FROM CURRENT_DATE) - 1)::TEXT || '-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT
        END
      ),
      COALESCE(c.invoice_prefix, 'INV-'),
      COALESCE(c.invoice_starting_number, 1)
    INTO v_target_fy, v_comp_prefix, v_comp_start
    FROM public.companies c
    WHERE c.id = p_company_id;
  END IF;

  IF v_target_fy IS NULL THEN
    v_target_fy := CASE 
      WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 4 
      THEN EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || (EXTRACT(YEAR FROM CURRENT_DATE) + 1)::TEXT
      ELSE (EXTRACT(YEAR FROM CURRENT_DATE) - 1)::TEXT || '-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT
    END;
  END IF;

  SELECT prefix, current_sequence INTO v_prefix, v_seq
  FROM public.invoice_sequences
  WHERE company_id = p_company_id AND doc_type = p_doc_type AND financial_year = v_target_fy
  FOR UPDATE;

  IF NOT FOUND THEN
    v_prefix := CASE p_doc_type
      WHEN 'sales' THEN COALESCE(v_comp_prefix, 'INV-')
      WHEN 'pos' THEN 'POS-'
      WHEN 'purchases' THEN 'PUR-'
      WHEN 'quotations' THEN 'EST-'
      WHEN 'estimates' THEN 'EST-'
      WHEN 'sales_orders' THEN 'SO-'
      WHEN 'sales_returns' THEN 'SR-'
      WHEN 'purchase_returns' THEN 'PR-'
      WHEN 'payments' THEN 'PAY-'
      WHEN 'receipts' THEN 'REC-'
      WHEN 'expenses' THEN 'EXP-'
      WHEN 'transfers' THEN 'TRF-'
      ELSE 'DOC-'
    END;
    v_seq := COALESCE(v_comp_start, 1);

    INSERT INTO public.invoice_sequences (company_id, doc_type, prefix, starting_number, current_sequence, financial_year)
    VALUES (p_company_id, p_doc_type, v_prefix, v_seq, v_seq + 1, v_target_fy);
  ELSE
    UPDATE public.invoice_sequences
    SET current_sequence = current_sequence + 1, updated_at = NOW()
    WHERE company_id = p_company_id AND doc_type = p_doc_type AND financial_year = v_target_fy;
  END IF;

  v_formatted := v_prefix || LPAD(v_seq::text, 4, '0');
  RETURN v_formatted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.generate_next_sku(
  p_company_id UUID,
  p_category VARCHAR DEFAULT 'General',
  p_product_name VARCHAR DEFAULT 'Product'
)
RETURNS VARCHAR AS $$
DECLARE
  v_cat_code VARCHAR;
  v_prod_code VARCHAR;
  v_seq INT;
  v_sku VARCHAR;
BEGIN
  v_cat_code := UPPER(SUBSTRING(COALESCE(NULLIF(p_category, ''), 'GEN'), 1, 3));
  v_prod_code := UPPER(SUBSTRING(REGEXP_REPLACE(COALESCE(NULLIF(p_product_name, ''), 'PRD'), '[^a-zA-Z]', '', 'g'), 1, 3));
  IF LENGTH(v_prod_code) = 0 THEN v_prod_code := 'PRD'; END IF;

  -- Atomic sequence count for SKU
  SELECT COUNT(*) + 1 INTO v_seq
  FROM public.products
  WHERE company_id = p_company_id;

  v_sku := v_cat_code || '-' || v_prod_code || '-' || LPAD(v_seq::text, 5, '0');

  -- Ensure absolute uniqueness
  WHILE EXISTS (SELECT 1 FROM public.products WHERE company_id = p_company_id AND sku = v_sku) LOOP
    v_seq := v_seq + 1;
    v_sku := v_cat_code || '-' || v_prod_code || '-' || LPAD(v_seq::text, 5, '0');
  END LOOP;

  RETURN v_sku;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==============================================================================
-- 13B. ATOMIC PRODUCT CREATION TRANSACTION (Product, Barcode, Stock, Unit Conversion)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.create_product_atomic(p_product_json JSONB)
RETURNS JSONB AS $$
DECLARE
  v_company_id UUID;
  v_product_id UUID;
  v_name VARCHAR;
  v_sku VARCHAR;
  v_barcode VARCHAR;
  v_code VARCHAR;
  v_category VARCHAR;
  v_subcategory VARCHAR;
  v_brand VARCHAR;
  v_description TEXT;
  v_hsn VARCHAR;
  v_tax_rate NUMERIC(5, 2);
  v_purchase_price NUMERIC(15, 2);
  v_cost_price NUMERIC(15, 2);
  v_selling_price NUMERIC(15, 2);
  v_retail_price NUMERIC(15, 2);
  v_wholesale_price NUMERIC(15, 2);
  v_dealer_price NUMERIC(15, 2);
  v_mrp NUMERIC(15, 2);
  v_min_selling_price NUMERIC(15, 2);
  v_reorder_level NUMERIC(12, 2);
  v_opening_stock NUMERIC(12, 2);
  v_opening_stock_val NUMERIC(15, 2);
  v_primary_unit VARCHAR;
  v_secondary_unit VARCHAR;
  v_conversion_factor NUMERIC(12, 4);
  v_warehouse_val VARCHAR;
  v_warehouse_id UUID;
  v_rack VARCHAR;
  v_batch_tracking BOOLEAN;
  v_serial_tracking BOOLEAN;
  v_expiry_tracking BOOLEAN;
  v_is_active BOOLEAN;
  v_created_at TIMESTAMPTZ;
BEGIN
  v_company_id := (p_product_json->>'company_id')::UUID;
  v_name := TRIM(COALESCE(p_product_json->>'name', ''));
  IF v_name = '' THEN
    RAISE EXCEPTION 'Product name is mandatory.';
  END IF;

  v_sku := UPPER(TRIM(COALESCE(p_product_json->>'sku', '')));
  IF v_sku = '' THEN
    v_sku := public.generate_next_sku(v_company_id, p_product_json->>'category', v_name);
  END IF;

  -- Verify SKU Uniqueness inside company
  IF EXISTS (SELECT 1 FROM public.products WHERE company_id = v_company_id AND LOWER(sku) = LOWER(v_sku)) THEN
    RAISE EXCEPTION 'SKU % already exists. Please choose a unique SKU.', v_sku;
  END IF;

  v_code := COALESCE(NULLIF(TRIM(p_product_json->>'code'), ''), v_sku);
  v_barcode := COALESCE(NULLIF(TRIM(p_product_json->>'barcode'), ''), v_sku);
  v_category := COALESCE(NULLIF(TRIM(p_product_json->>'category'), ''), 'General');
  v_subcategory := COALESCE(NULLIF(TRIM(p_product_json->>'subcategory'), ''), v_category);
  v_brand := COALESCE(TRIM(p_product_json->>'brand'), '');
  v_description := COALESCE(p_product_json->>'description', '');
  v_hsn := COALESCE(TRIM(p_product_json->>'hsn'), '');
  v_tax_rate := COALESCE((p_product_json->>'tax_rate')::NUMERIC, 0.00);
  v_purchase_price := COALESCE((p_product_json->>'purchase_price')::NUMERIC, 0.00);
  v_cost_price := COALESCE((p_product_json->>'cost_price')::NUMERIC, 0.00);
  v_selling_price := COALESCE((p_product_json->>'selling_price')::NUMERIC, 0.00);
  IF v_selling_price <= 0 THEN
    RAISE EXCEPTION 'Selling price must be greater than 0.';
  END IF;

  v_retail_price := COALESCE((p_product_json->>'retail_price')::NUMERIC, v_selling_price);
  v_wholesale_price := COALESCE((p_product_json->>'wholesale_price')::NUMERIC, 0.00);
  v_dealer_price := COALESCE((p_product_json->>'dealer_price')::NUMERIC, 0.00);
  v_mrp := COALESCE((p_product_json->>'mrp')::NUMERIC, v_selling_price);
  v_min_selling_price := COALESCE((p_product_json->>'min_selling_price')::NUMERIC, 0.00);
  v_reorder_level := COALESCE((p_product_json->>'reorder_level')::NUMERIC, 0.00);
  v_opening_stock := COALESCE((p_product_json->>'opening_stock')::NUMERIC, 0.00);
  v_opening_stock_val := v_opening_stock * v_cost_price;
  v_primary_unit := COALESCE(NULLIF(TRIM(p_product_json->>'primary_unit'), ''), 'Piece');
  v_secondary_unit := NULLIF(TRIM(p_product_json->>'secondary_unit'), '');
  v_conversion_factor := COALESCE((p_product_json->>'conversion_factor')::NUMERIC, 1.0000);
  v_warehouse_val := p_product_json->>'warehouse';
  v_rack := COALESCE(TRIM(p_product_json->>'rack'), '');
  v_batch_tracking := COALESCE((p_product_json->>'batch_tracking')::BOOLEAN, FALSE);
  v_serial_tracking := COALESCE((p_product_json->>'serial_tracking')::BOOLEAN, FALSE);
  v_expiry_tracking := COALESCE((p_product_json->>'expiry_tracking')::BOOLEAN, FALSE);
  v_is_active := COALESCE((p_product_json->>'is_active')::BOOLEAN, TRUE);

  -- Resolve warehouse UUID
  IF v_warehouse_val IS NOT NULL AND v_warehouse_val != '' THEN
    SELECT id INTO v_warehouse_id
    FROM public.warehouses
    WHERE company_id = v_company_id AND (id::text = v_warehouse_val OR code = v_warehouse_val)
    LIMIT 1;
  END IF;

  IF v_warehouse_id IS NULL THEN
    SELECT id INTO v_warehouse_id
    FROM public.warehouses
    WHERE company_id = v_company_id
    ORDER BY is_default DESC, created_at ASC
    LIMIT 1;
  END IF;

  -- 1. Insert product
  INSERT INTO public.products (
    company_id, name, code, sku, barcode, category, subcategory, brand, description,
    hsn, hsn_sac, tax_rate, purchase_price, cost_price, selling_price, retail_price,
    wholesale_price, dealer_price, mrp, min_selling_price, reorder_level,
    opening_stock, opening_stock_value, current_stock, primary_unit, secondary_unit,
    conversion_factor, default_warehouse_id, warehouse, rack, batch_tracking,
    serial_tracking, expiry_tracking, is_active
  ) VALUES (
    v_company_id, v_name, v_code, v_sku, v_barcode, v_category, v_subcategory, v_brand, v_description,
    v_hsn, v_hsn, v_tax_rate, v_purchase_price, v_cost_price, v_selling_price, v_retail_price,
    v_wholesale_price, v_dealer_price, v_mrp, v_min_selling_price, v_reorder_level,
    v_opening_stock, v_opening_stock_val, v_opening_stock, v_primary_unit, v_secondary_unit,
    v_conversion_factor, v_warehouse_id, COALESCE(v_warehouse_val, ''), v_rack, v_batch_tracking,
    v_serial_tracking, v_expiry_tracking, v_is_active
  ) RETURNING id, created_at INTO v_product_id, v_created_at;

  -- 2. Insert primary barcode
  IF v_barcode IS NOT NULL AND v_barcode != '' THEN
    INSERT INTO public.product_barcodes (
      product_id, barcode, barcode_value, barcode_type, is_primary
    ) VALUES (
      v_product_id, v_barcode, v_barcode, 'Code 128', TRUE
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- 3. Insert opening stock into balances and transactions if opening_stock > 0
  IF v_opening_stock > 0 AND v_warehouse_id IS NOT NULL THEN
    INSERT INTO public.stock_balances (
      company_id, warehouse_id, product_id, quantity, updated_at
    ) VALUES (
      v_company_id, v_warehouse_id, v_product_id, v_opening_stock, NOW()
    ) ON CONFLICT (warehouse_id, product_id)
    DO UPDATE SET quantity = stock_balances.quantity + EXCLUDED.quantity, updated_at = NOW();

    INSERT INTO public.stock_transactions (
      company_id, date, type, product_id, product_name, warehouse_id, qty, unit,
      unit_cost, total_cost, reference_type, notes
    ) VALUES (
      v_company_id, CURRENT_DATE, 'Opening Stock', v_product_id, v_name, v_warehouse_id,
      v_opening_stock, v_primary_unit, v_cost_price, v_opening_stock_val, 'Opening',
      'Initial opening stock master'
    );
  END IF;

  -- 4. Insert unit conversion if specified
  IF v_secondary_unit IS NOT NULL AND v_secondary_unit != '' AND v_conversion_factor > 0 THEN
    INSERT INTO public.unit_conversions (
      company_id, from_unit, to_unit, factor, notes
    ) VALUES (
      v_company_id, v_secondary_unit, v_primary_unit, v_conversion_factor,
      '1 ' || v_secondary_unit || ' = ' || v_conversion_factor || ' ' || v_primary_unit
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- 5. Audit Log
  INSERT INTO public.audit_logs (
    company_id, user_name, action, module, record, new_value, time
  ) VALUES (
    v_company_id, 'System User', 'Create Product', 'Products', v_name,
    'SKU: ' || v_sku, TO_CHAR(NOW(), 'HH24:MI:SS')
  );

  RETURN jsonb_build_object(
    'id', v_product_id,
    'name', v_name,
    'sku', v_sku,
    'barcode', v_barcode,
    'created_at', v_created_at,
    'status', 'success'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==============================================================================
-- 14. ATOMIC SALES INVOICE TRANSACTION (Multi-Entity, Complete Rollback)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.create_sales_invoice_atomic(p_sale_json JSONB)
RETURNS JSONB AS $$
DECLARE
  v_company_id UUID;
  v_sale_id UUID;
  v_invoice_number VARCHAR;
  v_doc_type VARCHAR;
  v_customer_id UUID;
  v_customer_name VARCHAR;
  v_customer_gstin VARCHAR;
  v_grand_total NUMERIC(15, 2);
  v_subtotal NUMERIC(15, 2);
  v_tax_total NUMERIC(15, 2);
  v_cgst_total NUMERIC(15, 2);
  v_sgst_total NUMERIC(15, 2);
  v_igst_total NUMERIC(15, 2);
  v_round_off NUMERIC(8, 2);
  v_paid_amount NUMERIC(15, 2);
  v_payment_status VARCHAR;
  v_payment_method VARCHAR;
  v_warehouse_id UUID;
  v_item RECORD;
  v_total_cogs NUMERIC(15, 2) := 0.00;
  v_journal_id UUID;
  v_ar_account_id UUID;
  v_sales_account_id UUID;
  v_tax_account_id UUID;
  v_cogs_account_id UUID;
  v_inv_account_id UUID;
  v_cash_bank_account_id UUID;
  v_cust_outstanding NUMERIC(15, 2) := 0.00;
  v_cust_limit NUMERIC(15, 2) := 0.00;
  v_limit_action VARCHAR := 'warn';
  v_is_finalized_sale BOOLEAN;
BEGIN
  v_company_id := (p_sale_json->>'company_id')::UUID;
  v_customer_id := (p_sale_json->>'customer_id')::UUID;
  v_customer_name := COALESCE(p_sale_json->>'customer_name', 'Walk-in Customer');
  v_customer_gstin := p_sale_json->>'customer_gstin';
  v_warehouse_id := (p_sale_json->>'warehouse_id')::UUID;
  v_doc_type := COALESCE(p_sale_json->>'doc_type', 'Tax Invoice');
  v_subtotal := COALESCE((p_sale_json->>'subtotal')::NUMERIC, 0);
  v_tax_total := COALESCE((p_sale_json->>'tax_total')::NUMERIC, 0);
  v_cgst_total := COALESCE((p_sale_json->>'cgst_total')::NUMERIC, 0);
  v_sgst_total := COALESCE((p_sale_json->>'sgst_total')::NUMERIC, 0);
  v_igst_total := COALESCE((p_sale_json->>'igst_total')::NUMERIC, 0);
  v_round_off := COALESCE((p_sale_json->>'round_off')::NUMERIC, 0);
  v_grand_total := COALESCE((p_sale_json->>'grand_total')::NUMERIC, 0);
  v_paid_amount := COALESCE((p_sale_json->>'paid_amount')::NUMERIC, 0);
  v_payment_status := COALESCE(p_sale_json->>'payment_status', 'Unpaid');
  v_payment_method := COALESCE(p_sale_json->>'payment_method', 'Cash');

  -- Determine if document affects stock & accounting (Prompt #12: Document Types separation)
  v_is_finalized_sale := v_doc_type IN ('Tax Invoice', 'pos_invoice', 'Bill of Supply');

  -- Verify Credit Limit if sale is finalized and on credit (Prompt #38)
  IF v_is_finalized_sale AND v_customer_id IS NOT NULL AND (v_grand_total - v_paid_amount) > 0 THEN
    SELECT current_outstanding, credit_limit INTO v_cust_outstanding, v_cust_limit
    FROM public.customers WHERE id = v_customer_id;

    SELECT COALESCE(credit_limit_action, 'warn') INTO v_limit_action
    FROM public.company_settings WHERE company_id = v_company_id;

    IF v_cust_limit > 0 AND (v_cust_outstanding + (v_grand_total - v_paid_amount)) > v_cust_limit THEN
      IF v_limit_action = 'block' THEN
        RAISE EXCEPTION 'Credit limit of ₹% exceeded by ₹%. Invoice creation blocked.',
          v_cust_limit, (v_cust_outstanding + (v_grand_total - v_paid_amount) - v_cust_limit);
      END IF;
    END IF;
  END IF;

  -- Concurrency-safe sequence generation
  IF p_sale_json->>'invoice_number' IS NOT NULL AND length(p_sale_json->>'invoice_number') > 0 THEN
    v_invoice_number := p_sale_json->>'invoice_number';
  ELSE
    v_invoice_number := public.get_next_sequence(
      v_company_id,
      CASE WHEN v_doc_type = 'pos_invoice' THEN 'pos' ELSE 'sales' END
    );
  END IF;

  -- 1. Insert Sales Record
  INSERT INTO public.sales (
    company_id, warehouse_id, invoice_number, doc_type, date, due_date,
    customer_id, customer_name, customer_phone, customer_gstin,
    customer_address, billing_address, shipping_address,
    subtotal, discount_total, tax_total, cgst_total, sgst_total, igst_total,
    round_off, grand_total, paid_amount, payment_status, payment_method, notes, terms
  ) VALUES (
    v_company_id, v_warehouse_id, v_invoice_number, v_doc_type,
    COALESCE((p_sale_json->>'date')::DATE, CURRENT_DATE),
    COALESCE((p_sale_json->>'due_date')::DATE, CURRENT_DATE + INTERVAL '30 days'),
    v_customer_id, v_customer_name, p_sale_json->>'customer_phone', v_customer_gstin,
    p_sale_json->>'customer_address', p_sale_json->>'billing_address', p_sale_json->>'shipping_address',
    v_subtotal, COALESCE((p_sale_json->>'discount_total')::NUMERIC, 0),
    v_tax_total, v_cgst_total, v_sgst_total, v_igst_total, v_round_off,
    v_grand_total, v_paid_amount, v_payment_status, v_payment_method,
    p_sale_json->>'notes', p_sale_json->>'terms'
  ) RETURNING id INTO v_sale_id;

  -- 2. Insert Items & Process Inventory (Only if finalized or delivery challan)
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_sale_json->'items') AS x(
    product_id UUID, product_name VARCHAR, sku VARCHAR, barcode VARCHAR, hsn_sac VARCHAR, hsn VARCHAR,
    qty NUMERIC, unit VARCHAR, rate NUMERIC, cost_price NUMERIC, discount_pct NUMERIC,
    discount_amt NUMERIC, tax_rate NUMERIC, tax_amt NUMERIC, cgst_amt NUMERIC, sgst_amt NUMERIC,
    igst_amt NUMERIC, total NUMERIC, batch_number VARCHAR, serial_number VARCHAR
  ) LOOP
    INSERT INTO public.sales_items (
      sale_id, product_id, product_name, sku, barcode, hsn_sac, hsn,
      qty, unit, rate, cost_price, discount_pct, discount_amt,
      tax_rate, tax_amt, cgst_amt, sgst_amt, igst_amt, total,
      batch_number, serial_number
    ) VALUES (
      v_sale_id, v_item.product_id, v_item.product_name, v_item.sku, v_item.barcode,
      COALESCE(v_item.hsn_sac, v_item.hsn), COALESCE(v_item.hsn, v_item.hsn_sac),
      v_item.qty, v_item.unit, v_item.rate, COALESCE(v_item.cost_price, 0),
      v_item.discount_pct, v_item.discount_amt, v_item.tax_rate, v_item.tax_amt,
      v_item.cgst_amt, v_item.sgst_amt, v_item.igst_amt, v_item.total,
      v_item.batch_number, v_item.serial_number
    );

    -- Calculate real COGS from product cost
    v_total_cogs := v_total_cogs + (v_item.qty * COALESCE(v_item.cost_price, 0));

    -- Decrement inventory ONLY for finalized sales or delivery challan (Prompt #12)
    IF (v_is_finalized_sale OR v_doc_type = 'delivery_challan') AND v_item.product_id IS NOT NULL THEN
      UPDATE public.products
      SET current_stock = current_stock - v_item.qty, updated_at = NOW()
      WHERE id = v_item.product_id;

      IF v_warehouse_id IS NOT NULL THEN
        INSERT INTO public.stock_balances (company_id, warehouse_id, product_id, quantity, updated_at)
        VALUES (v_company_id, v_warehouse_id, v_item.product_id, -v_item.qty, NOW())
        ON CONFLICT (warehouse_id, product_id)
        DO UPDATE SET quantity = stock_balances.quantity - EXCLUDED.quantity, updated_at = NOW();
      END IF;

      INSERT INTO public.stock_transactions (
        company_id, date, type, product_id, product_name, warehouse_id,
        qty, unit, unit_cost, total_cost, reference_type, reference_id, reference_number, notes
      ) VALUES (
        v_company_id, CURRENT_DATE, 'Sale', v_item.product_id, v_item.product_name,
        COALESCE(v_warehouse_id, (SELECT id FROM public.warehouses WHERE company_id = v_company_id LIMIT 1)),
        -v_item.qty, v_item.unit, COALESCE(v_item.cost_price, 0), (v_item.qty * COALESCE(v_item.cost_price, 0)),
        'Sale', v_sale_id, v_invoice_number, 'Sales Invoice billing'
      );
    END IF;
  END LOOP;

  -- 3. Update Customer Balance (Only for finalized sales)
  IF v_is_finalized_sale AND v_customer_id IS NOT NULL THEN
    UPDATE public.customers
    SET
      current_outstanding = current_outstanding + (v_grand_total - v_paid_amount),
      total_purchased = total_purchased + v_grand_total,
      total_paid = total_paid + v_paid_amount,
      updated_at = NOW()
    WHERE id = v_customer_id;
  END IF;

  -- 4. Double-Entry Accounting Journal (Only for finalized sales, Prompt #27)
  IF v_is_finalized_sale THEN
    SELECT id INTO v_ar_account_id FROM public.accounts WHERE company_id = v_company_id AND (code = '1040' OR name ILIKE '%Receivable%') LIMIT 1;
    SELECT id INTO v_sales_account_id FROM public.accounts WHERE company_id = v_company_id AND (code = '4010' OR name ILIKE '%Sales%') LIMIT 1;
    SELECT id INTO v_tax_account_id FROM public.accounts WHERE company_id = v_company_id AND (code = '2020' OR name ILIKE '%GST Output%') LIMIT 1;
    SELECT id INTO v_cogs_account_id FROM public.accounts WHERE company_id = v_company_id AND (code = '5010' OR name ILIKE '%Cost of Goods%') LIMIT 1;
    SELECT id INTO v_inv_account_id FROM public.accounts WHERE company_id = v_company_id AND (code = '1050' OR name ILIKE '%Inventory%') LIMIT 1;

    IF v_ar_account_id IS NOT NULL AND v_sales_account_id IS NOT NULL THEN
      INSERT INTO public.journal_entries (
        company_id, entry_number, date, entry_date, description, narration, reference_type, reference_id, total_debit, total_credit
      ) VALUES (
        v_company_id, 'JV-' || v_invoice_number, CURRENT_DATE, CURRENT_DATE,
        'Sales Invoice ' || v_invoice_number || ' to ' || v_customer_name,
        'Sales revenue recognition', 'Sale', v_sale_id, v_grand_total, v_grand_total
      ) RETURNING id INTO v_journal_id;

      -- Line 1: Debit Accounts Receivable (Full Amount)
      INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, account_code, account_name, debit, credit, narration)
      VALUES (v_journal_id, v_ar_account_id, '1040', 'Accounts Receivable', v_grand_total, 0.00, 'Customer Receivable');

      -- Line 2: Credit Sales Revenue (Subtotal)
      INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, account_code, account_name, debit, credit, narration)
      VALUES (v_journal_id, v_sales_account_id, '4010', 'Sales Revenue', 0.00, v_subtotal, 'Sales Revenue Subtotal');

      -- Line 3: Credit GST Output Tax (Tax Total)
      IF v_tax_total > 0 AND v_tax_account_id IS NOT NULL THEN
        INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, account_code, account_name, debit, credit, narration)
        VALUES (v_journal_id, v_tax_account_id, '2020', 'GST Output Tax Payable', 0.00, v_tax_total, 'GST Output Liability');
      END IF;

      -- Line 4 & 5: COGS and Inventory Asset (Prompt #27: Debit COGS, Credit Inventory)
      IF v_total_cogs > 0 AND v_cogs_account_id IS NOT NULL AND v_inv_account_id IS NOT NULL THEN
        INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, account_code, account_name, debit, credit, narration)
        VALUES (v_journal_id, v_cogs_account_id, '5010', 'Cost of Goods Sold (COGS)', v_total_cogs, 0.00, 'COGS expense');

        INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, account_code, account_name, debit, credit, narration)
        VALUES (v_journal_id, v_inv_account_id, '1050', 'Inventory Asset', 0.00, v_total_cogs, 'Inventory valuation reduction');
      END IF;
    END IF;

    -- 5. Record Tender if Tendered Immediately (POS / Cash Sale)
    IF v_paid_amount > 0 THEN
      INSERT INTO public.payments (
        company_id, payment_number, type, party_type, party_id, party_name,
        amount, date, payment_method, account_name, invoice_id, notes
      ) VALUES (
        v_company_id, 'REC-' || v_invoice_number, 'Received', 'Customer',
        v_customer_id, v_customer_name, v_paid_amount, CURRENT_DATE,
        v_payment_method, 'Main Cash Drawer', v_sale_id, 'Immediate settlement at checkout'
      );
    END IF;
  END IF;

  -- 6. Insert System Audit Log
  INSERT INTO public.audit_logs (
    company_id, user_name, action, module, record, old_value, new_value, date, time
  ) VALUES (
    v_company_id, COALESCE(p_sale_json->>'user_name', 'System User'),
    'Created ' || v_doc_type, 'Sales', v_invoice_number, 'Draft',
    'Total: ₹' || v_grand_total::text || ' (' || v_customer_name || ')',
    CURRENT_DATE, TO_CHAR(NOW(), 'HH12:MI AM')
  );

  RETURN jsonb_build_object(
    'success', true,
    'sale_id', v_sale_id,
    'invoice_number', v_invoice_number,
    'grand_total', v_grand_total,
    'cogs', v_total_cogs
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==============================================================================
-- 15. ATOMIC SALES RETURN TRANSACTION (Inventory, Tax & Accounting Reversal)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.process_sales_return_atomic(p_return_json JSONB)
RETURNS JSONB AS $$
DECLARE
  v_company_id UUID;
  v_return_id UUID;
  v_return_number VARCHAR;
  v_sale_id UUID;
  v_customer_id UUID;
  v_customer_name VARCHAR;
  v_return_amount NUMERIC(15, 2);
  v_tax_reversal NUMERIC(15, 2);
  v_item RECORD;
  v_warehouse_id UUID;
  v_journal_id UUID;
  v_ar_account_id UUID;
  v_sales_ret_account_id UUID;
  v_tax_account_id UUID;
BEGIN
  v_company_id := (p_return_json->>'company_id')::UUID;
  v_sale_id := (p_return_json->>'sale_id')::UUID;
  v_customer_id := (p_return_json->>'customer_id')::UUID;
  v_customer_name := COALESCE(p_return_json->>'customer_name', 'Customer');
  v_return_amount := COALESCE((p_return_json->>'return_amount')::NUMERIC, 0);
  v_tax_reversal := COALESCE((p_return_json->>'tax_reversal')::NUMERIC, 0);
  v_warehouse_id := (p_return_json->>'warehouse_id')::UUID;

  IF p_return_json->>'return_number' IS NOT NULL AND length(p_return_json->>'return_number') > 0 THEN
    v_return_number := p_return_json->>'return_number';
  ELSE
    v_return_number := public.get_next_sequence(v_company_id, 'sales_returns');
  END IF;

  -- 1. Insert Sales Return Header
  INSERT INTO public.sales_returns (
    company_id, return_number, original_sale_id, customer_id, customer_name,
    date, return_amount, tax_reversal, refund_status, reason, notes
  ) VALUES (
    v_company_id, v_return_number, v_sale_id, v_customer_id, v_customer_name,
    COALESCE((p_return_json->>'date')::DATE, CURRENT_DATE),
    v_return_amount, v_tax_reversal,
    COALESCE(p_return_json->>'refund_status', 'Credit Note Issued'),
    p_return_json->>'reason', p_return_json->>'notes'
  ) RETURNING id INTO v_return_id;

  -- 2. Items & Restock Inventory
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_return_json->'items') AS x(
    product_id UUID, product_name VARCHAR, qty NUMERIC, unit VARCHAR, rate NUMERIC, tax_rate NUMERIC, tax_amt NUMERIC, total NUMERIC
  ) LOOP
    INSERT INTO public.sales_return_items (
      return_id, product_id, product_name, qty, unit, rate, tax_rate, tax_amt, total
    ) VALUES (
      v_return_id, v_item.product_id, v_item.product_name, v_item.qty, v_item.unit,
      v_item.rate, COALESCE(v_item.tax_rate, 0), COALESCE(v_item.tax_amt, 0), v_item.total
    );

    IF v_item.product_id IS NOT NULL THEN
      UPDATE public.products
      SET current_stock = current_stock + v_item.qty, updated_at = NOW()
      WHERE id = v_item.product_id;

      IF v_warehouse_id IS NOT NULL THEN
        INSERT INTO public.stock_balances (company_id, warehouse_id, product_id, quantity, updated_at)
        VALUES (v_company_id, v_warehouse_id, v_item.product_id, v_item.qty, NOW())
        ON CONFLICT (warehouse_id, product_id)
        DO UPDATE SET quantity = stock_balances.quantity + EXCLUDED.quantity, updated_at = NOW();
      END IF;

      INSERT INTO public.stock_transactions (
        company_id, date, type, product_id, product_name, warehouse_id,
        qty, unit, unit_cost, total_cost, reference_type, reference_id, reference_number, notes
      ) VALUES (
        v_company_id, CURRENT_DATE, 'Sales Return', v_item.product_id, v_item.product_name,
        COALESCE(v_warehouse_id, (SELECT id FROM public.warehouses WHERE company_id = v_company_id LIMIT 1)),
        v_item.qty, v_item.unit, v_item.rate, v_item.total, 'Return', v_return_id, v_return_number, 'Customer goods return'
      );
    END IF;
  END LOOP;

  -- 3. Adjust Customer Outstanding
  IF v_customer_id IS NOT NULL THEN
    UPDATE public.customers
    SET
      current_outstanding = GREATEST(0, current_outstanding - v_return_amount),
      updated_at = NOW()
    WHERE id = v_customer_id;
  END IF;

  -- 4. Accounting Reversal Entry
  SELECT id INTO v_ar_account_id FROM public.accounts WHERE company_id = v_company_id AND (code = '1040' OR name ILIKE '%Receivable%') LIMIT 1;
  SELECT id INTO v_sales_ret_account_id FROM public.accounts WHERE company_id = v_company_id AND (code = '4020' OR name ILIKE '%Return%' OR name ILIKE '%Sales%') LIMIT 1;
  SELECT id INTO v_tax_account_id FROM public.accounts WHERE company_id = v_company_id AND (code = '2020' OR name ILIKE '%GST Output%') LIMIT 1;

  IF v_ar_account_id IS NOT NULL AND v_sales_ret_account_id IS NOT NULL THEN
    INSERT INTO public.journal_entries (
      company_id, entry_number, date, entry_date, description, narration, reference_type, reference_id, total_debit, total_credit
    ) VALUES (
      v_company_id, 'JV-CN-' || v_return_number, CURRENT_DATE, CURRENT_DATE,
      'Credit Note ' || v_return_number || ' for ' || v_customer_name,
      'Sales return reversal', 'Return', v_return_id, v_return_amount, v_return_amount
    ) RETURNING id INTO v_journal_id;

    -- Debit Sales Returns (or Sales Revenue reversal)
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, account_code, account_name, debit, credit, narration)
    VALUES (v_journal_id, v_sales_ret_account_id, '4020', 'Sales Returns & Allowances', v_return_amount - v_tax_reversal, 0.00, 'Revenue Reversal');

    -- Debit GST Output (Tax reversal)
    IF v_tax_reversal > 0 AND v_tax_account_id IS NOT NULL THEN
      INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, account_code, account_name, debit, credit, narration)
      VALUES (v_journal_id, v_tax_account_id, '2020', 'GST Output Tax Payable', v_tax_reversal, 0.00, 'Tax liability reversal');
    END IF;

    -- Credit Accounts Receivable (Reduce customer balance)
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, account_code, account_name, debit, credit, narration)
    VALUES (v_journal_id, v_ar_account_id, '1040', 'Accounts Receivable', 0.00, v_return_amount, 'Customer balance reduction');
  END IF;

  -- 5. Audit Log
  INSERT INTO public.audit_logs (
    company_id, user_name, action, module, record, old_value, new_value, date, time
  ) VALUES (
    v_company_id, COALESCE(p_return_json->>'user_name', 'System User'),
    'Processed Sales Return', 'Sales Returns', v_return_number, 'Pending',
    'Credit Note: ₹' || v_return_amount::text || ' for ' || v_customer_name,
    CURRENT_DATE, TO_CHAR(NOW(), 'HH12:MI AM')
  );

  RETURN jsonb_build_object(
    'success', true,
    'return_id', v_return_id,
    'return_number', v_return_number,
    'return_amount', v_return_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==============================================================================
-- 16. ATOMIC PURCHASE BILL TRANSACTION
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.create_purchase_invoice_atomic(p_purchase_json JSONB)
RETURNS JSONB AS $$
DECLARE
  v_company_id UUID;
  v_purchase_id UUID;
  v_invoice_number VARCHAR;
  v_supplier_id UUID;
  v_supplier_name VARCHAR;
  v_grand_total NUMERIC(15, 2);
  v_subtotal NUMERIC(15, 2);
  v_tax_total NUMERIC(15, 2);
  v_paid_amount NUMERIC(15, 2);
  v_warehouse_id UUID;
  v_item RECORD;
  v_journal_id UUID;
  v_ap_account_id UUID;
  v_inv_account_id UUID;
  v_input_tax_account_id UUID;
BEGIN
  v_company_id := (p_purchase_json->>'company_id')::UUID;
  v_supplier_id := (p_purchase_json->>'supplier_id')::UUID;
  v_supplier_name := COALESCE(p_purchase_json->>'supplier_name', 'Supplier');
  v_warehouse_id := (p_purchase_json->>'warehouse_id')::UUID;
  v_subtotal := COALESCE((p_purchase_json->>'subtotal')::NUMERIC, 0);
  v_tax_total := COALESCE((p_purchase_json->>'tax_total')::NUMERIC, 0);
  v_grand_total := COALESCE((p_purchase_json->>'grand_total')::NUMERIC, 0);
  v_paid_amount := COALESCE((p_purchase_json->>'paid_amount')::NUMERIC, 0);

  IF p_purchase_json->>'invoice_number' IS NOT NULL AND length(p_purchase_json->>'invoice_number') > 0 THEN
    v_invoice_number := p_purchase_json->>'invoice_number';
  ELSE
    v_invoice_number := public.get_next_sequence(v_company_id, 'purchases');
  END IF;

  -- 1. Insert Purchase Header
  INSERT INTO public.purchases (
    company_id, warehouse_id, invoice_number, doc_type, date, due_date,
    supplier_id, supplier_name, supplier_gstin, subtotal, tax_total,
    freight_charges, other_charges, grand_total, paid_amount, payment_status, notes
  ) VALUES (
    v_company_id, v_warehouse_id, v_invoice_number,
    COALESCE(p_purchase_json->>'doc_type', 'purchase_invoice'),
    COALESCE((p_purchase_json->>'date')::DATE, CURRENT_DATE),
    COALESCE((p_purchase_json->>'due_date')::DATE, CURRENT_DATE + INTERVAL '30 days'),
    v_supplier_id, v_supplier_name, p_purchase_json->>'supplier_gstin',
    v_subtotal, v_tax_total,
    COALESCE((p_purchase_json->>'freight_charges')::NUMERIC, 0),
    COALESCE((p_purchase_json->>'other_charges')::NUMERIC, 0),
    v_grand_total, v_paid_amount,
    COALESCE(p_purchase_json->>'payment_status', 'Unpaid'),
    p_purchase_json->>'notes'
  ) RETURNING id INTO v_purchase_id;

  -- 2. Items & Inventory Increment
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_purchase_json->'items') AS x(
    product_id UUID, product_name VARCHAR, qty NUMERIC, unit VARCHAR,
    rate NUMERIC, discount NUMERIC, tax_rate NUMERIC, tax_amt NUMERIC, total NUMERIC
  ) LOOP
    INSERT INTO public.purchase_items (
      purchase_id, product_id, product_name, qty, unit, rate, discount, tax_rate, tax_amt, total
    ) VALUES (
      v_purchase_id, v_item.product_id, v_item.product_name, v_item.qty, v_item.unit,
      v_item.rate, v_item.discount, v_item.tax_rate, v_item.tax_amt, v_item.total
    );

    IF v_item.product_id IS NOT NULL THEN
      UPDATE public.products
      SET
        current_stock = current_stock + v_item.qty,
        cost_price = v_item.rate,
        updated_at = NOW()
      WHERE id = v_item.product_id;

      IF v_warehouse_id IS NOT NULL THEN
        INSERT INTO public.stock_balances (company_id, warehouse_id, product_id, quantity, updated_at)
        VALUES (v_company_id, v_warehouse_id, v_item.product_id, v_item.qty, NOW())
        ON CONFLICT (warehouse_id, product_id)
        DO UPDATE SET quantity = stock_balances.quantity + EXCLUDED.quantity, updated_at = NOW();
      END IF;

      INSERT INTO public.stock_transactions (
        company_id, date, type, product_id, product_name, warehouse_id,
        qty, unit, unit_cost, total_cost, reference_type, reference_id, reference_number, notes
      ) VALUES (
        v_company_id, CURRENT_DATE, 'Purchase', v_item.product_id, v_item.product_name,
        COALESCE(v_warehouse_id, (SELECT id FROM public.warehouses WHERE company_id = v_company_id LIMIT 1)),
        v_item.qty, v_item.unit, v_item.rate, v_item.total, 'Purchase', v_purchase_id, v_invoice_number, 'Stock procurement'
      );
    END IF;
  END LOOP;

  -- 3. Update Supplier Payable
  IF v_supplier_id IS NOT NULL THEN
    UPDATE public.suppliers
    SET
      current_outstanding = current_outstanding + (v_grand_total - v_paid_amount),
      total_purchases = total_purchases + v_grand_total,
      total_paid = total_paid + v_paid_amount,
      updated_at = NOW()
    WHERE id = v_supplier_id;
  END IF;

  -- 4. Accounting Journal
  SELECT id INTO v_ap_account_id FROM public.accounts WHERE company_id = v_company_id AND (code = '2010' OR name ILIKE '%Payable%') LIMIT 1;
  SELECT id INTO v_inv_account_id FROM public.accounts WHERE company_id = v_company_id AND (code = '1050' OR name ILIKE '%Inventory%') LIMIT 1;
  SELECT id INTO v_input_tax_account_id FROM public.accounts WHERE company_id = v_company_id AND (code = '1060' OR name ILIKE '%GST Input%') LIMIT 1;

  IF v_ap_account_id IS NOT NULL AND v_inv_account_id IS NOT NULL THEN
    INSERT INTO public.journal_entries (
      company_id, entry_number, date, entry_date, description, narration, reference_type, reference_id, total_debit, total_credit
    ) VALUES (
      v_company_id, 'JV-' || v_invoice_number, CURRENT_DATE, CURRENT_DATE,
      'Purchase Bill ' || v_invoice_number || ' from ' || v_supplier_name,
      'Inventory procurement', 'Purchase', v_purchase_id, v_grand_total, v_grand_total
    ) RETURNING id INTO v_journal_id;

    -- Debit Inventory Asset
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, account_code, account_name, debit, credit, narration)
    VALUES (v_journal_id, v_inv_account_id, '1050', 'Inventory Asset', v_subtotal, 0.00, 'Inventory asset intake');

    -- Debit Input GST if tax > 0
    IF v_tax_total > 0 AND v_input_tax_account_id IS NOT NULL THEN
      INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, account_code, account_name, debit, credit, narration)
      VALUES (v_journal_id, v_input_tax_account_id, '1060', 'GST Input Tax Credit', v_tax_total, 0.00, 'Input GST credit');
    END IF;

    -- Credit Accounts Payable
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, account_code, account_name, debit, credit, narration)
    VALUES (v_journal_id, v_ap_account_id, '2010', 'Accounts Payable', 0.00, v_grand_total, 'Supplier payable liability');
  END IF;

  -- 5. Audit Log
  INSERT INTO public.audit_logs (
    company_id, user_name, action, module, record, old_value, new_value, date, time
  ) VALUES (
    v_company_id, COALESCE(p_purchase_json->>'user_name', 'Purchase Manager'),
    'Created Purchase Bill', 'Purchases', v_invoice_number, 'Draft',
    'Total: ₹' || v_grand_total::text || ' (' || v_supplier_name || ')',
    CURRENT_DATE, TO_CHAR(NOW(), 'HH12:MI AM')
  );

  RETURN jsonb_build_object(
    'success', true,
    'purchase_id', v_purchase_id,
    'invoice_number', v_invoice_number,
    'grand_total', v_grand_total
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==============================================================================
-- 17. ATOMIC PURCHASE RETURN / DEBIT NOTE TRANSACTION
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.process_purchase_return_atomic(p_return_json JSONB)
RETURNS JSONB AS $$
DECLARE
  v_company_id UUID;
  v_return_id UUID;
  v_return_number VARCHAR;
  v_purchase_id UUID;
  v_supplier_id UUID;
  v_supplier_name VARCHAR;
  v_return_amount NUMERIC(15, 2);
  v_tax_reversal NUMERIC(15, 2);
  v_warehouse_id UUID;
  v_item RECORD;
  v_journal_id UUID;
  v_ap_account_id UUID;
  v_inv_account_id UUID;
BEGIN
  v_company_id := (p_return_json->>'company_id')::UUID;
  v_purchase_id := (p_return_json->>'purchase_id')::UUID;
  v_supplier_id := (p_return_json->>'supplier_id')::UUID;
  v_supplier_name := COALESCE(p_return_json->>'supplier_name', 'Supplier');
  v_return_amount := COALESCE((p_return_json->>'return_amount')::NUMERIC, 0);
  v_tax_reversal := COALESCE((p_return_json->>'tax_reversal')::NUMERIC, 0);
  v_warehouse_id := (p_return_json->>'warehouse_id')::UUID;

  IF p_return_json->>'return_number' IS NOT NULL AND length(p_return_json->>'return_number') > 0 THEN
    v_return_number := p_return_json->>'return_number';
  ELSE
    v_return_number := public.get_next_sequence(v_company_id, 'purchase_returns');
  END IF;

  -- 1. Insert Purchase Return Record
  INSERT INTO public.purchase_returns (
    company_id, return_number, original_purchase_id, supplier_id, supplier_name,
    date, return_amount, tax_reversal, status, notes
  ) VALUES (
    v_company_id, v_return_number, v_purchase_id, v_supplier_id, v_supplier_name,
    COALESCE((p_return_json->>'date')::DATE, CURRENT_DATE),
    v_return_amount, v_tax_reversal,
    COALESCE(p_return_json->>'status', 'Debit Note Issued'),
    p_return_json->>'notes'
  ) RETURNING id INTO v_return_id;

  -- 2. Items & Stock Reduction
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_return_json->'items') AS x(
    product_id UUID, product_name VARCHAR, qty NUMERIC, unit VARCHAR, rate NUMERIC, total NUMERIC
  ) LOOP
    INSERT INTO public.purchase_return_items (
      return_id, product_id, product_name, qty, unit, rate, total
    ) VALUES (
      v_return_id, v_item.product_id, v_item.product_name, v_item.qty, v_item.unit, v_item.rate, v_item.total
    );

    IF v_item.product_id IS NOT NULL THEN
      UPDATE public.products
      SET current_stock = GREATEST(0, current_stock - v_item.qty), updated_at = NOW()
      WHERE id = v_item.product_id;

      IF v_warehouse_id IS NOT NULL THEN
        INSERT INTO public.stock_balances (company_id, warehouse_id, product_id, quantity, updated_at)
        VALUES (v_company_id, v_warehouse_id, v_item.product_id, -v_item.qty, NOW())
        ON CONFLICT (warehouse_id, product_id)
        DO UPDATE SET quantity = stock_balances.quantity - EXCLUDED.quantity, updated_at = NOW();
      END IF;

      INSERT INTO public.stock_transactions (
        company_id, date, type, product_id, product_name, warehouse_id,
        qty, unit, unit_cost, total_cost, reference_type, reference_id, reference_number, notes
      ) VALUES (
        v_company_id, CURRENT_DATE, 'Purchase Return', v_item.product_id, v_item.product_name,
        COALESCE(v_warehouse_id, (SELECT id FROM public.warehouses WHERE company_id = v_company_id LIMIT 1)),
        -v_item.qty, v_item.unit, v_item.rate, v_item.total, 'Debit Note', v_return_id, v_return_number, 'Supplier return'
      );
    END IF;
  END LOOP;

  -- 3. Adjust Supplier Payable
  IF v_supplier_id IS NOT NULL THEN
    UPDATE public.suppliers
    SET
      current_outstanding = GREATEST(0, current_outstanding - v_return_amount),
      updated_at = NOW()
    WHERE id = v_supplier_id;
  END IF;

  -- 4. Accounting Reversal Entry
  SELECT id INTO v_ap_account_id FROM public.accounts WHERE company_id = v_company_id AND (code = '2010' OR name ILIKE '%Payable%') LIMIT 1;
  SELECT id INTO v_inv_account_id FROM public.accounts WHERE company_id = v_company_id AND (code = '1050' OR name ILIKE '%Inventory%') LIMIT 1;

  IF v_ap_account_id IS NOT NULL AND v_inv_account_id IS NOT NULL THEN
    INSERT INTO public.journal_entries (
      company_id, entry_number, date, entry_date, description, narration, reference_type, reference_id, total_debit, total_credit
    ) VALUES (
      v_company_id, 'JV-DN-' || v_return_number, CURRENT_DATE, CURRENT_DATE,
      'Debit Note ' || v_return_number || ' to ' || v_supplier_name,
      'Purchase return reversal', 'Debit Note', v_return_id, v_return_amount, v_return_amount
    ) RETURNING id INTO v_journal_id;

    -- Debit Accounts Payable
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, account_code, account_name, debit, credit, narration)
    VALUES (v_journal_id, v_ap_account_id, '2010', 'Accounts Payable', v_return_amount, 0.00, 'Supplier liability reduction');

    -- Credit Inventory Asset
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, account_code, account_name, debit, credit, narration)
    VALUES (v_journal_id, v_inv_account_id, '1050', 'Inventory Asset', 0.00, v_return_amount, 'Inventory asset reduction');
  END IF;

  -- 5. Audit Log
  INSERT INTO public.audit_logs (
    company_id, user_name, action, module, record, old_value, new_value, date, time
  ) VALUES (
    v_company_id, COALESCE(p_return_json->>'user_name', 'System User'),
    'Processed Purchase Return', 'Purchase Returns', v_return_number, 'Pending',
    'Debit Note: ₹' || v_return_amount::text || ' to ' || v_supplier_name,
    CURRENT_DATE, TO_CHAR(NOW(), 'HH12:MI AM')
  );

  RETURN jsonb_build_object(
    'success', true,
    'return_id', v_return_id,
    'return_number', v_return_number,
    'return_amount', v_return_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==============================================================================
-- 18. ATOMIC PAYMENT TRANSACTION (Receipt / Payment with Double-Entry)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.record_payment_atomic(p_payment_json JSONB)
RETURNS JSONB AS $$
DECLARE
  v_company_id UUID;
  v_payment_id UUID;
  v_payment_number VARCHAR;
  v_type VARCHAR;
  v_party_type VARCHAR;
  v_party_id UUID;
  v_party_name VARCHAR;
  v_amount NUMERIC(15, 2);
  v_method VARCHAR;
  v_account_name VARCHAR;
  v_journal_id UUID;
  v_cash_bank_account_id UUID;
  v_sub_account_id UUID;
BEGIN
  v_company_id := (p_payment_json->>'company_id')::UUID;
  v_type := p_payment_json->>'type';
  v_party_type := p_payment_json->>'party_type';
  v_party_id := (p_payment_json->>'party_id')::UUID;
  v_party_name := COALESCE(p_payment_json->>'party_name', 'Party');
  v_amount := COALESCE((p_payment_json->>'amount')::NUMERIC, 0);
  v_method := COALESCE(p_payment_json->>'payment_method', 'Cash');
  v_account_name := COALESCE(p_payment_json->>'account_name', 'Main Cash Drawer');

  IF p_payment_json->>'payment_number' IS NOT NULL AND length(p_payment_json->>'payment_number') > 0 THEN
    v_payment_number := p_payment_json->>'payment_number';
  ELSE
    v_payment_number := public.get_next_sequence(
      v_company_id,
      CASE WHEN v_type = 'Received' THEN 'receipts' ELSE 'payments' END
    );
  END IF;

  -- 1. Insert Payment
  INSERT INTO public.payments (
    company_id, payment_number, type, party_type, party_id, party_name,
    amount, date, payment_method, account_name, account, reference, notes, invoice_id
  ) VALUES (
    v_company_id, v_payment_number, v_type, v_party_type, v_party_id, v_party_name,
    v_amount, COALESCE((p_payment_json->>'date')::DATE, CURRENT_DATE),
    v_method, v_account_name, v_account_name,
    p_payment_json->>'reference', p_payment_json->>'notes',
    (p_payment_json->>'invoice_id')::UUID
  ) RETURNING id INTO v_payment_id;

  -- 2. Update Outstanding Balances
  IF v_type = 'Received' AND v_party_type = 'Customer' AND v_party_id IS NOT NULL THEN
    UPDATE public.customers
    SET
      current_outstanding = GREATEST(0, current_outstanding - v_amount),
      total_paid = total_paid + v_amount,
      updated_at = NOW()
    WHERE id = v_party_id;
  ELSIF v_type = 'Paid' AND v_party_type = 'Supplier' AND v_party_id IS NOT NULL THEN
    UPDATE public.suppliers
    SET
      current_outstanding = GREATEST(0, current_outstanding - v_amount),
      total_paid = total_paid + v_amount,
      updated_at = NOW()
    WHERE id = v_party_id;
  END IF;

  -- 3. Double-Entry Accounting Journal (Prompt #24, #27)
  IF v_method = 'Cash' THEN
    SELECT id INTO v_cash_bank_account_id FROM public.accounts WHERE company_id = v_company_id AND (code = '1010' OR name ILIKE '%Cash%') LIMIT 1;
  ELSE
    SELECT id INTO v_cash_bank_account_id FROM public.accounts WHERE company_id = v_company_id AND (code = '1020' OR name ILIKE '%Bank%') LIMIT 1;
  END IF;

  IF v_type = 'Received' THEN
    -- Customer Receipt: Debit Cash/Bank, Credit Accounts Receivable
    SELECT id INTO v_sub_account_id FROM public.accounts WHERE company_id = v_company_id AND (code = '1040' OR name ILIKE '%Receivable%') LIMIT 1;

    IF v_cash_bank_account_id IS NOT NULL AND v_sub_account_id IS NOT NULL THEN
      INSERT INTO public.journal_entries (
        company_id, entry_number, date, entry_date, description, narration, reference_type, reference_id, total_debit, total_credit
      ) VALUES (
        v_company_id, 'JV-' || v_payment_number, CURRENT_DATE, CURRENT_DATE,
        'Payment received from ' || v_party_name, 'Customer settlement', 'Receipt', v_payment_id, v_amount, v_amount
      ) RETURNING id INTO v_journal_id;

      INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, account_code, account_name, debit, credit, narration)
      VALUES (v_journal_id, v_cash_bank_account_id, '1010', 'Cash / Bank', v_amount, 0.00, 'Funds Inflow');

      INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, account_code, account_name, debit, credit, narration)
      VALUES (v_journal_id, v_sub_account_id, '1040', 'Accounts Receivable', 0.00, v_amount, 'Receivable cleared');
    END IF;
  ELSE
    -- Supplier Payment: Debit Accounts Payable, Credit Cash/Bank
    SELECT id INTO v_sub_account_id FROM public.accounts WHERE company_id = v_company_id AND (code = '2010' OR name ILIKE '%Payable%') LIMIT 1;

    IF v_cash_bank_account_id IS NOT NULL AND v_sub_account_id IS NOT NULL THEN
      INSERT INTO public.journal_entries (
        company_id, entry_number, date, entry_date, description, narration, reference_type, reference_id, total_debit, total_credit
      ) VALUES (
        v_company_id, 'JV-' || v_payment_number, CURRENT_DATE, CURRENT_DATE,
        'Payment made to ' || v_party_name, 'Supplier settlement', 'Payment', v_payment_id, v_amount, v_amount
      ) RETURNING id INTO v_journal_id;

      INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, account_code, account_name, debit, credit, narration)
      VALUES (v_journal_id, v_sub_account_id, '2010', 'Accounts Payable', v_amount, 0.00, 'Payable cleared');

      INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, account_code, account_name, debit, credit, narration)
      VALUES (v_journal_id, v_cash_bank_account_id, '1010', 'Cash / Bank', 0.00, v_amount, 'Funds Outflow');
    END IF;
  END IF;

  -- 4. Audit Log
  INSERT INTO public.audit_logs (
    company_id, user_name, action, module, record, old_value, new_value, date, time
  ) VALUES (
    v_company_id, COALESCE(p_payment_json->>'user_name', 'Accountant'),
    'Recorded ' || v_type, 'Payments', v_payment_number, 'Pending',
    '₹' || v_amount::text || ' (' || v_party_name || ')',
    CURRENT_DATE, TO_CHAR(NOW(), 'HH12:MI AM')
  );

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'payment_number', v_payment_number,
    'amount', v_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==============================================================================
-- 19. ATOMIC STOCK TRANSFER STAGE WORKFLOW (Requested -> Approved -> Sent -> Received)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.execute_stock_transfer_atomic(
  p_transfer_id UUID,
  p_new_status VARCHAR
)
RETURNS JSONB AS $$
DECLARE
  v_transfer RECORD;
  v_item RECORD;
BEGIN
  SELECT * INTO v_transfer FROM public.stock_transfers WHERE id = p_transfer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock transfer % not found', p_transfer_id;
  END IF;

  -- Update status
  UPDATE public.stock_transfers
  SET status = p_new_status, updated_at = NOW()
  WHERE id = p_transfer_id;

  -- Stock movement takes effect ONLY when state reaches 'Received' (Prompt #18)
  IF p_new_status = 'Received' THEN
    FOR v_item IN SELECT * FROM public.stock_transfer_items WHERE transfer_id = p_transfer_id LOOP
      -- Deduct from source warehouse
      INSERT INTO public.stock_balances (company_id, warehouse_id, product_id, quantity, updated_at)
      VALUES (v_transfer.company_id, v_transfer.from_warehouse_id, v_item.product_id, -v_item.qty, NOW())
      ON CONFLICT (warehouse_id, product_id)
      DO UPDATE SET quantity = stock_balances.quantity - EXCLUDED.quantity, updated_at = NOW();

      -- Add to destination warehouse
      INSERT INTO public.stock_balances (company_id, warehouse_id, product_id, quantity, updated_at)
      VALUES (v_transfer.company_id, v_transfer.to_warehouse_id, v_item.product_id, v_item.qty, NOW())
      ON CONFLICT (warehouse_id, product_id)
      DO UPDATE SET quantity = stock_balances.quantity + EXCLUDED.quantity, updated_at = NOW();

      -- Record stock transaction out
      INSERT INTO public.stock_transactions (
        company_id, date, type, product_id, product_name, warehouse_id, warehouse_to_id,
        qty, unit, reference_type, reference_id, reference_number, notes
      ) VALUES (
        v_transfer.company_id, CURRENT_DATE, 'Stock Transfer', v_item.product_id, v_item.product_name,
        v_transfer.from_warehouse_id, v_transfer.to_warehouse_id,
        -v_item.qty, v_item.unit, 'Transfer Out', p_transfer_id, v_transfer.transfer_number, 'Warehouse dispatch'
      );

      -- Record stock transaction in
      INSERT INTO public.stock_transactions (
        company_id, date, type, product_id, product_name, warehouse_id, warehouse_to_id,
        qty, unit, reference_type, reference_id, reference_number, notes
      ) VALUES (
        v_transfer.company_id, CURRENT_DATE, 'Stock Transfer', v_item.product_id, v_item.product_name,
        v_transfer.to_warehouse_id, v_transfer.from_warehouse_id,
        v_item.qty, v_item.unit, 'Transfer In', p_transfer_id, v_transfer.transfer_number, 'Warehouse receipt'
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', true, 'status', p_new_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==============================================================================
-- 20. REAL FINANCIAL DASHBOARD ANALYTICS (NO HARDCODED RATIOS / COGS)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_analytics(p_company_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_sales_today NUMERIC(15, 2);
  v_purchases_today NUMERIC(15, 2);
  v_expenses_today NUMERIC(15, 2);
  v_stock_value NUMERIC(15, 2);
  v_receivables NUMERIC(15, 2);
  v_payables NUMERIC(15, 2);
  v_total_sales NUMERIC(15, 2);
  v_total_sales_returns NUMERIC(15, 2);
  v_total_purchases NUMERIC(15, 2);
  v_total_purchases_returns NUMERIC(15, 2);
  v_total_expenses NUMERIC(15, 2);
  v_net_sales NUMERIC(15, 2);
  v_real_cogs NUMERIC(15, 2);
  v_gross_profit NUMERIC(15, 2);
  v_net_profit NUMERIC(15, 2);
  v_low_stock_count INT;
  v_unpaid_invoices_count INT;
BEGIN
  -- Daily figures
  SELECT COALESCE(SUM(grand_total), 0) INTO v_sales_today
  FROM public.sales
  WHERE company_id = p_company_id AND date = CURRENT_DATE AND doc_type IN ('Tax Invoice', 'pos_invoice', 'Bill of Supply');

  SELECT COALESCE(SUM(grand_total), 0) INTO v_purchases_today
  FROM public.purchases
  WHERE company_id = p_company_id AND date = CURRENT_DATE;

  SELECT COALESCE(SUM(amount), 0) INTO v_expenses_today
  FROM public.expenses
  WHERE company_id = p_company_id AND date = CURRENT_DATE;

  -- Live Asset Balances
  SELECT COALESCE(SUM(current_stock * cost_price), 0) INTO v_stock_value
  FROM public.products
  WHERE company_id = p_company_id AND is_active = TRUE;

  SELECT COALESCE(SUM(current_outstanding), 0) INTO v_receivables
  FROM public.customers
  WHERE company_id = p_company_id;

  SELECT COALESCE(SUM(current_outstanding), 0) INTO v_payables
  FROM public.suppliers
  WHERE company_id = p_company_id;

  -- Real Cumulative Calculations (Prompt #31: Real P&L Formulas)
  SELECT COALESCE(SUM(subtotal), 0) INTO v_total_sales
  FROM public.sales
  WHERE company_id = p_company_id AND doc_type IN ('Tax Invoice', 'pos_invoice', 'Bill of Supply');

  SELECT COALESCE(SUM(return_amount), 0) INTO v_total_sales_returns
  FROM public.sales_returns
  WHERE company_id = p_company_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_expenses
  FROM public.expenses
  WHERE company_id = p_company_id;

  v_net_sales := v_total_sales - v_total_sales_returns;

  -- Real COGS from Sales Items (Historical cost basis)
  SELECT COALESCE(SUM(si.qty * si.cost_price), 0) INTO v_real_cogs
  FROM public.sales_items si
  JOIN public.sales s ON s.id = si.sale_id
  WHERE s.company_id = p_company_id AND s.doc_type IN ('Tax Invoice', 'pos_invoice', 'Bill of Supply');

  v_gross_profit := v_net_sales - v_real_cogs;
  v_net_profit := v_gross_profit - v_total_expenses;

  SELECT COUNT(*) INTO v_low_stock_count
  FROM public.products
  WHERE company_id = p_company_id AND is_active = TRUE AND current_stock <= reorder_level;

  SELECT COUNT(*) INTO v_unpaid_invoices_count
  FROM public.sales
  WHERE company_id = p_company_id AND payment_status != 'Paid' AND doc_type IN ('Tax Invoice', 'pos_invoice', 'Bill of Supply');

  RETURN jsonb_build_object(
    'sales_today', v_sales_today,
    'purchases_today', v_purchases_today,
    'expenses_today', v_expenses_today,
    'stock_value', v_stock_value,
    'receivables', v_receivables,
    'payables', v_payables,
    'gross_profit', v_gross_profit,
    'net_profit', v_net_profit,
    'profit_margin', CASE WHEN v_net_sales > 0 THEN ROUND((v_net_profit / v_net_sales * 100), 1) ELSE 0 END,
    'low_stock_count', v_low_stock_count,
    'unpaid_invoices_count', v_unpaid_invoices_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


