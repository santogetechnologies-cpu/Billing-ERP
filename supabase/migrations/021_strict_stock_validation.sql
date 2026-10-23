-- Migration 021: Strict Stock Availability Validation Before Selling & Atomic Concurrency Protection
-- ==============================================================================
-- 1. Validates that available stock is strictly positive and sufficient before confirming any sale.
-- 2. If available stock <= 0: blocks the sale with "No stock available for this product."
-- 3. If requested quantity > available stock: blocks the sale with "Insufficient stock. Available quantity: [quantity] [unit]."
-- 4. Employs FOR UPDATE row locks to prevent race conditions during concurrent sales of the same stock unit.
-- 5. Multi-warehouse aware: verifies stock specifically for the selected warehouse.

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
  v_cust_outstanding NUMERIC(15, 2) := 0.00;
  v_cust_limit NUMERIC(15, 2) := 0.00;
  v_limit_action VARCHAR := 'warn';
  v_is_finalized_sale BOOLEAN;

  -- Stock validation variables
  v_prod_rec RECORD;
  v_wh_stock NUMERIC(15, 2);
  v_is_default_wh BOOLEAN;
  v_available_stock NUMERIC(15, 2);
  v_warehouse_count INTEGER;
  v_unit_label VARCHAR;
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

  -- Determine if document affects stock & accounting
  v_is_finalized_sale := v_doc_type IN ('Tax Invoice', 'tax_invoice', 'pos_invoice', 'Bill of Supply', 'bill_of_supply');

  -- ==============================================================================
  -- PRE-VALIDATION 1: Strict Stock Availability Check with Concurrency Row Locks
  -- ==============================================================================
  IF (v_is_finalized_sale OR v_doc_type = 'delivery_challan') THEN
    SELECT COUNT(*) INTO v_warehouse_count FROM public.warehouses WHERE company_id = v_company_id;

    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_sale_json->'items') AS x(
      product_id UUID, product_name VARCHAR, qty NUMERIC, unit VARCHAR
    ) LOOP
      IF v_item.product_id IS NOT NULL THEN
        -- Lock product row FOR UPDATE to serialize concurrent sales of this product
        SELECT id, name, primary_unit, current_stock INTO v_prod_rec
        FROM public.products
        WHERE id = v_item.product_id
        FOR UPDATE;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Product % not found in product catalog', v_item.product_id;
        END IF;

        v_unit_label := COALESCE(v_item.unit, v_prod_rec.primary_unit, 'Pcs');
        v_available_stock := COALESCE(v_prod_rec.current_stock, 0);

        -- Multi-warehouse stock calculation
        IF v_warehouse_id IS NOT NULL THEN
          SELECT quantity INTO v_wh_stock
          FROM public.stock_balances
          WHERE warehouse_id = v_warehouse_id AND product_id = v_item.product_id
          FOR UPDATE;

          IF FOUND THEN
            -- Available stock in selected warehouse cannot exceed overall product stock or warehouse balance
            v_available_stock := LEAST(COALESCE(v_prod_rec.current_stock, 0), v_wh_stock);
          ELSE
            -- Check if this is the default warehouse or if there is only 1 warehouse
            SELECT is_default INTO v_is_default_wh
            FROM public.warehouses
            WHERE id = v_warehouse_id;

            IF v_is_default_wh IS TRUE OR v_warehouse_count <= 1 THEN
              v_available_stock := COALESCE(v_prod_rec.current_stock, 0);
            ELSE
              v_available_stock := 0;
            END IF;
          END IF;
        END IF;

        -- Exact validation rule 1: Zero or negative available stock
        IF v_available_stock <= 0 THEN
          RAISE EXCEPTION 'Out of Stock — This product cannot be billed because no stock is available.';
        END IF;

        -- Exact validation rule 2: Insufficient available quantity
        IF v_item.qty > v_available_stock THEN
          RAISE EXCEPTION 'Insufficient stock. Available: % %.', v_available_stock, v_unit_label;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- ==============================================================================
  -- PRE-VALIDATION 2: Verify Customer Credit Limit if sale is on credit
  -- ==============================================================================
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

    -- Decrement inventory ONLY for finalized sales or delivery challan
    IF (v_is_finalized_sale OR v_doc_type = 'delivery_challan') AND v_item.product_id IS NOT NULL THEN
      UPDATE public.products
      SET current_stock = current_stock - v_item.qty, updated_at = NOW()
      WHERE id = v_item.product_id;

      IF v_warehouse_id IS NOT NULL THEN
        INSERT INTO public.stock_balances (company_id, warehouse_id, product_id, quantity, updated_at)
        VALUES (v_company_id, v_warehouse_id, v_item.product_id, -v_item.qty, NOW())
        ON CONFLICT (warehouse_id, product_id)
        DO UPDATE SET quantity = stock_balances.quantity - v_item.qty, updated_at = NOW();
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

  -- 4. Double-Entry Accounting Journal (Only for finalized sales)
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
        VALUES (v_journal_id, v_tax_account_id, '2020', 'GST Output Tax', 0.00, v_tax_total, 'GST Output on Sale');
      END IF;

      -- Line 4 & 5: Inventory Valuation (COGS)
      IF v_total_cogs > 0 AND v_cogs_account_id IS NOT NULL AND v_inv_account_id IS NOT NULL THEN
        INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, account_code, account_name, debit, credit, narration)
        VALUES (v_journal_id, v_cogs_account_id, '5010', 'Cost of Goods Sold', v_total_cogs, 0.00, 'COGS for Invoice');

        INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, account_code, account_name, debit, credit, narration)
        VALUES (v_journal_id, v_inv_account_id, '1050', 'Inventory Asset', 0.00, v_total_cogs, 'Inventory reduction for Sale');
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'sale_id', v_sale_id,
    'invoice_number', v_invoice_number,
    'created_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
