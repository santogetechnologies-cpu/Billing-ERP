-- Migration 020: Preserve Negative Stock Balances & Remove Unintended Zero Clamping
-- Ensures inventory calculations, stock transactions, and balances preserve signed quantities.

-- 1. Update process_purchase_return RPC function to remove GREATEST(0, ...)
CREATE OR REPLACE FUNCTION public.process_purchase_return(
  p_purchase_id UUID,
  p_returned_items JSONB,
  p_notes TEXT DEFAULT NULL,
  p_company_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id UUID;
  v_purchase RECORD;
  v_return_id UUID;
  v_return_number VARCHAR(100);
  v_seq_num BIGINT;
  v_item RECORD;
  v_return_amount NUMERIC(15, 2) := 0;
  v_warehouse_id UUID;
BEGIN
  v_company_id := COALESCE(p_company_id, public.get_user_company_id());
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Company ID could not be determined';
  END IF;

  SELECT * INTO v_purchase FROM public.purchases
  WHERE id = p_purchase_id AND company_id = v_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase invoice % not found', p_purchase_id;
  END IF;

  v_warehouse_id := v_purchase.warehouse_id;

  SELECT next_seq INTO v_seq_num
  FROM public.document_sequences
  WHERE company_id = v_company_id AND doc_type = 'purchase_return'
  FOR UPDATE;

  IF NOT FOUND THEN
    v_seq_num := 1;
    INSERT INTO public.document_sequences (company_id, doc_type, next_seq)
    VALUES (v_company_id, 'purchase_return', 2);
  ELSE
    UPDATE public.document_sequences
    SET next_seq = next_seq + 1, updated_at = NOW()
    WHERE company_id = v_company_id AND doc_type = 'purchase_return';
  END IF;

  v_return_number := 'DN-' || LPAD(v_seq_num::TEXT, 5, '0');

  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_returned_items) AS (
    product_id UUID, product_name VARCHAR, qty NUMERIC, unit VARCHAR, rate NUMERIC, return_amt NUMERIC
  ) LOOP
    v_return_amount := v_return_amount + COALESCE(v_item.return_amt, v_item.qty * v_item.rate);
  END LOOP;

  INSERT INTO public.purchase_returns (
    company_id, original_purchase_id, return_number, date, supplier_id,
    supplier_name, total_returned_amount, notes, status
  ) VALUES (
    v_company_id, p_purchase_id, v_return_number, CURRENT_DATE, v_purchase.supplier_id,
    v_purchase.supplier_name, v_return_amount, p_notes, 'Completed'
  ) RETURNING id INTO v_return_id;

  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_returned_items) AS (
    product_id UUID, product_name VARCHAR, qty NUMERIC, unit VARCHAR, rate NUMERIC, total NUMERIC
  ) LOOP
    INSERT INTO public.purchase_return_items (
      return_id, product_id, product_name, qty, unit, rate, total
    ) VALUES (
      v_return_id, v_item.product_id, v_item.product_name, v_item.qty, v_item.unit, v_item.rate, v_item.total
    );

    IF v_item.product_id IS NOT NULL THEN
      -- Preserves actual negative stock if return causes shortage (removed GREATEST(0, ...))
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
        v_company_id, CURRENT_DATE, 'Purchase Return', v_item.product_id, v_item.product_name,
        COALESCE(v_warehouse_id, (SELECT id FROM public.warehouses WHERE company_id = v_company_id LIMIT 1)),
        -v_item.qty, v_item.unit, v_item.rate, v_item.total, 'Debit Note', v_return_id, v_return_number, 'Supplier return'
      );
    END IF;
  END LOOP;

  RETURN v_return_id;
END;
$$;
