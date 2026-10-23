-- Migration 018: Multi-Warehouse Management, Location Types & Extended Stock Transfers
-- ==============================================================================

-- 1. Extend public.warehouses with location types and contact details
ALTER TABLE public.warehouses 
  ADD COLUMN IF NOT EXISTS location_type VARCHAR(50) DEFAULT 'Main Warehouse',
  ADD COLUMN IF NOT EXISTS contact_person VARCHAR(150),
  ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Extend public.stock_transfers with audit timeline fields
ALTER TABLE public.stock_transfers
  ADD COLUMN IF NOT EXISTS created_by VARCHAR(150),
  ADD COLUMN IF NOT EXISTS approved_by VARCHAR(150),
  ADD COLUMN IF NOT EXISTS sent_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS received_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reference_doc VARCHAR(100);

-- 3. Indexes for fast warehouse and stock lookups
CREATE INDEX IF NOT EXISTS idx_warehouses_company_active ON public.warehouses(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_warehouses_type ON public.warehouses(location_type);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_status ON public.stock_transfers(company_id, status);

-- 4. Update atomic transfer function to support multi-stage stock movements (Sent -> Received)
CREATE OR REPLACE FUNCTION public.execute_stock_transfer_atomic(
  p_transfer_id UUID,
  p_new_status VARCHAR,
  p_actor_name VARCHAR DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_transfer RECORD;
  v_item RECORD;
  v_old_status VARCHAR;
BEGIN
  SELECT * INTO v_transfer FROM public.stock_transfers WHERE id = p_transfer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock transfer % not found', p_transfer_id;
  END IF;

  v_old_status := v_transfer.status;

  -- Prevent duplicate status transitions
  IF v_old_status = p_new_status THEN
    RETURN jsonb_build_object('success', true, 'status', p_new_status, 'message', 'Status already set');
  END IF;

  -- 1. Update status and audit dates
  IF p_new_status = 'Approved' THEN
    UPDATE public.stock_transfers
    SET status = p_new_status,
        approved_by = COALESCE(p_actor_name, approved_by),
        updated_at = NOW()
    WHERE id = p_transfer_id;

  ELSIF p_new_status = 'Sent' THEN
    UPDATE public.stock_transfers
    SET status = p_new_status,
        sent_date = NOW(),
        updated_at = NOW()
    WHERE id = p_transfer_id;

    -- Deduct from source warehouse upon dispatch
    IF v_old_status != 'Sent' AND v_old_status != 'Received' THEN
      FOR v_item IN SELECT * FROM public.stock_transfer_items WHERE transfer_id = p_transfer_id LOOP
        -- Deduct from source warehouse balance
        INSERT INTO public.stock_balances (company_id, warehouse_id, product_id, quantity, updated_at)
        VALUES (v_transfer.company_id, v_transfer.from_warehouse_id, v_item.product_id, -v_item.qty, NOW())
        ON CONFLICT (warehouse_id, product_id)
        DO UPDATE SET quantity = stock_balances.quantity - v_item.qty, updated_at = NOW();

        -- Record transaction: Transfer Out
        INSERT INTO public.stock_transactions (
          company_id, date, type, product_id, product_name, warehouse_id, warehouse_to_id,
          qty, unit, reference_type, reference_id, reference_number, notes
        ) VALUES (
          v_transfer.company_id, CURRENT_DATE, 'Stock Transfer', v_item.product_id, v_item.product_name,
          v_transfer.from_warehouse_id, v_transfer.to_warehouse_id,
          -v_item.qty, v_item.unit, 'Transfer Out', p_transfer_id, v_transfer.transfer_number,
          COALESCE(v_transfer.notes, 'Dispatched to destination warehouse')
        );
      END LOOP;
    END IF;

  ELSIF p_new_status = 'Received' THEN
    UPDATE public.stock_transfers
    SET status = p_new_status,
        received_date = NOW(),
        updated_at = NOW()
    WHERE id = p_transfer_id;

    -- If transitioning directly from non-Sent to Received, also deduct from source
    IF v_old_status != 'Sent' THEN
      FOR v_item IN SELECT * FROM public.stock_transfer_items WHERE transfer_id = p_transfer_id LOOP
        INSERT INTO public.stock_balances (company_id, warehouse_id, product_id, quantity, updated_at)
        VALUES (v_transfer.company_id, v_transfer.from_warehouse_id, v_item.product_id, -v_item.qty, NOW())
        ON CONFLICT (warehouse_id, product_id)
        DO UPDATE SET quantity = stock_balances.quantity - v_item.qty, updated_at = NOW();

        INSERT INTO public.stock_transactions (
          company_id, date, type, product_id, product_name, warehouse_id, warehouse_to_id,
          qty, unit, reference_type, reference_id, reference_number, notes
        ) VALUES (
          v_transfer.company_id, CURRENT_DATE, 'Stock Transfer', v_item.product_id, v_item.product_name,
          v_transfer.from_warehouse_id, v_transfer.to_warehouse_id,
          -v_item.qty, v_item.unit, 'Transfer Out', p_transfer_id, v_transfer.transfer_number,
          'Direct warehouse dispatch'
        );
      END LOOP;
    END IF;

    -- Add to destination warehouse balance upon arrival
    FOR v_item IN SELECT * FROM public.stock_transfer_items WHERE transfer_id = p_transfer_id LOOP
      INSERT INTO public.stock_balances (company_id, warehouse_id, product_id, quantity, updated_at)
      VALUES (v_transfer.company_id, v_transfer.to_warehouse_id, v_item.product_id, v_item.qty, NOW())
      ON CONFLICT (warehouse_id, product_id)
      DO UPDATE SET quantity = stock_balances.quantity + v_item.qty, updated_at = NOW();

      INSERT INTO public.stock_transactions (
        company_id, date, type, product_id, product_name, warehouse_id, warehouse_to_id,
        qty, unit, reference_type, reference_id, reference_number, notes
      ) VALUES (
        v_transfer.company_id, CURRENT_DATE, 'Stock Transfer', v_item.product_id, v_item.product_name,
        v_transfer.to_warehouse_id, v_transfer.from_warehouse_id,
        v_item.qty, v_item.unit, 'Transfer In', p_transfer_id, v_transfer.transfer_number,
        'Warehouse receipt completed'
      );
    END LOOP;

  ELSIF p_new_status = 'Cancelled' OR p_new_status = 'Rejected' THEN
    UPDATE public.stock_transfers
    SET status = p_new_status,
        updated_at = NOW()
    WHERE id = p_transfer_id;

    -- If goods were already dispatched ('Sent'), revert stock back to source warehouse
    IF v_old_status = 'Sent' THEN
      FOR v_item IN SELECT * FROM public.stock_transfer_items WHERE transfer_id = p_transfer_id LOOP
        INSERT INTO public.stock_balances (company_id, warehouse_id, product_id, quantity, updated_at)
        VALUES (v_transfer.company_id, v_transfer.from_warehouse_id, v_item.product_id, v_item.qty, NOW())
        ON CONFLICT (warehouse_id, product_id)
        DO UPDATE SET quantity = stock_balances.quantity + v_item.qty, updated_at = NOW();

        INSERT INTO public.stock_transactions (
          company_id, date, type, product_id, product_name, warehouse_id, warehouse_to_id,
          qty, unit, reference_type, reference_id, reference_number, notes
        ) VALUES (
          v_transfer.company_id, CURRENT_DATE, 'Stock Transfer', v_item.product_id, v_item.product_name,
          v_transfer.from_warehouse_id, NULL,
          v_item.qty, v_item.unit, 'Transfer Reversal', p_transfer_id, v_transfer.transfer_number,
          'Reverted dispatch due to transfer cancellation'
        );
      END LOOP;
    END IF;
  ELSE
    UPDATE public.stock_transfers
    SET status = p_new_status,
        updated_at = NOW()
    WHERE id = p_transfer_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'status', p_new_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
