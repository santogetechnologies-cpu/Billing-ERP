-- Migration 036: Warehouse Manager Notification Rules & Idempotent Deduplication
-- Implements exact notification titles, messages, priorities, links, and duplicate prevention
-- for Warehouse Managers: Out of Stock Alerts, Limited Stock Alerts, and Batch Expiry reminders.

-- 1. Ensure notifications table has dedup_key index for high-speed idempotent prevention
CREATE INDEX IF NOT EXISTS idx_notifications_dedup_key ON public.notifications(company_id, user_id, type, is_read);

-- 2. Update dispatch_warehouse_stock_alert function with exact prompt titles & formatting
CREATE OR REPLACE FUNCTION public.dispatch_warehouse_stock_alert(
  p_product_id UUID,
  p_warehouse_id UUID,
  p_current_stock NUMERIC,
  p_reorder_level NUMERIC,
  p_unit VARCHAR DEFAULT 'Piece'
)
RETURNS JSONB AS $$
DECLARE
  v_company_id UUID;
  v_product_name VARCHAR;
  v_product_sku VARCHAR;
  v_warehouse_name VARCHAR;
  v_manager_rec RECORD;
  v_manager_ids UUID[] := ARRAY[]::UUID[];
  v_m_id UUID;
  v_alert_type VARCHAR;
  v_title VARCHAR;
  v_message VARCHAR;
  v_link VARCHAR;
  v_priority VARCHAR;
  v_created_count INT := 0;
  v_existing_id UUID;
  v_sku_str VARCHAR;
BEGIN
  -- 1. Fetch Product Info
  SELECT company_id, name, sku
  INTO v_company_id, v_product_name, v_product_sku
  FROM public.products
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Product not found');
  END IF;

  -- 2. Fetch Warehouse Info
  SELECT name, manager_id
  INTO v_warehouse_name, v_m_id
  FROM public.warehouses
  WHERE id = p_warehouse_id AND company_id = v_company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Warehouse not found or company mismatch');
  END IF;

  -- Add primary manager if assigned
  IF v_m_id IS NOT NULL THEN
    v_manager_ids := array_append(v_manager_ids, v_m_id);
  END IF;

  -- Add explicitly assigned managers from junction table
  FOR v_manager_rec IN
    SELECT user_id FROM public.warehouse_managers
    WHERE warehouse_id = p_warehouse_id AND company_id = v_company_id
  LOOP
    IF NOT (v_manager_rec.user_id = ANY(v_manager_ids)) THEN
      v_manager_ids := array_append(v_manager_ids, v_manager_rec.user_id);
    END IF;
  END LOOP;

  -- 3. If NO manager is assigned to this warehouse:
  -- Record the missing assignment for administrators and exit.
  IF array_length(v_manager_ids, 1) IS NULL OR array_length(v_manager_ids, 1) = 0 THEN
    SELECT id INTO v_existing_id
    FROM public.notifications
    WHERE company_id = v_company_id
      AND warehouse_id = p_warehouse_id
      AND type = 'system'
      AND title = 'Missing Warehouse Manager Assignment'
      AND is_read = FALSE
    LIMIT 1;

    IF v_existing_id IS NULL THEN
      INSERT INTO public.notifications (
        company_id, user_id, warehouse_id, product_id,
        title, message, type, link, is_read, read
      ) VALUES (
        v_company_id, NULL, p_warehouse_id, p_product_id,
        'Missing Warehouse Manager Assignment',
        'Warehouse "' || v_warehouse_name || '" has stock alerts for ' || v_product_name || COALESCE(' (SKU: ' || v_product_sku || ')', '') || ', but no Warehouse Manager is assigned. Please assign a Warehouse Manager.',
        'system', '/warehouses', FALSE, FALSE
      );
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'created', 0,
      'missing_manager', true,
      'message', 'No Warehouse Manager assigned; administrative notice recorded.'
    );
  END IF;

  -- 4. If stock is replenished above threshold, auto-resolve previous unread stock alerts
  IF p_current_stock > p_reorder_level THEN
    UPDATE public.notifications
    SET is_read = TRUE, read = TRUE
    WHERE company_id = v_company_id
      AND warehouse_id = p_warehouse_id
      AND product_id = p_product_id
      AND type IN ('low_stock', 'limited_stock', 'out_of_stock')
      AND is_read = FALSE;

    RETURN jsonb_build_object('success', true, 'resolved', true);
  END IF;

  -- 5. Format SKU string
  IF v_product_sku IS NOT NULL AND TRIM(v_product_sku) != '' THEN
    v_sku_str := ' (SKU: ' || v_product_sku || ')';
  ELSE
    v_sku_str := '';
  END IF;

  -- 6. Determine Alert Type, Title, Message, Priority & Link
  -- Rule 1: Out of Stock Alert
  -- Title: Out of Stock Alert
  -- Message: Cement (SKU: BUI-CEM-00001) is out of stock in Main Central Warehouse.
  -- Priority: Critical
  -- Action: View Product
  --
  -- Rule 2: Limited Stock Alert
  -- Title: Limited Stock Alert
  -- Message: Paint (SKU: PAI-PAI-00005) has 8 Piece remaining in Main Central Warehouse. Warning limit: 10 Piece.
  -- Priority: High
  -- Action: View Product
  IF p_current_stock <= 0 THEN
    v_alert_type := 'out_of_stock';
    v_title := 'Out of Stock Alert';
    v_message := v_product_name || v_sku_str || ' is out of stock in ' || v_warehouse_name || '.';
    v_priority := 'Critical';
  ELSE
    v_alert_type := 'limited_stock';
    v_title := 'Limited Stock Alert';
    v_message := v_product_name || v_sku_str || ' has ' || p_current_stock || ' ' || p_unit || ' remaining in ' || v_warehouse_name || '. Warning limit: ' || p_reorder_level || ' ' || p_unit || '.';
    v_priority := 'High';
  END IF;

  IF v_product_sku IS NOT NULL AND TRIM(v_product_sku) != '' THEN
    v_link := '/products?search=' || v_product_sku;
  ELSE
    v_link := '/products?search=' || v_product_name;
  END IF;

  -- 7. Dispatch targeted notification strictly to each assigned manager (with deduplication)
  FOREACH v_m_id IN ARRAY v_manager_ids LOOP
    SELECT id INTO v_existing_id
    FROM public.notifications
    WHERE user_id = v_m_id
      AND warehouse_id = p_warehouse_id
      AND product_id = p_product_id
      AND type = v_alert_type
      AND is_read = FALSE
    LIMIT 1;

    IF v_existing_id IS NULL THEN
      INSERT INTO public.notifications (
        company_id, user_id, warehouse_id, product_id,
        title, message, type, link, is_read, read
      ) VALUES (
        v_company_id, v_m_id, p_warehouse_id, p_product_id,
        v_title, v_message, v_alert_type, v_link, FALSE, FALSE
      );
      v_created_count := v_created_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'created', v_created_count,
    'recipients', array_length(v_manager_ids, 1),
    'warehouse', v_warehouse_name,
    'product', v_product_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Stored Procedure for End-of-Day Expiry Reminders (callable via cron / backend runner)
CREATE OR REPLACE FUNCTION public.check_eod_batch_expiry_reminders(
  p_company_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_comp RECORD;
  v_batch_count INT := 0;
  v_manager_rec RECORD;
  v_notif_count INT := 0;
  v_today DATE := CURRENT_DATE;
  v_window_end DATE := CURRENT_DATE + INTERVAL '30 days';
  v_msg TEXT;
  v_existing_id UUID;
BEGIN
  FOR v_comp IN
    SELECT id, name FROM public.companies
    WHERE (p_company_id IS NULL OR id = p_company_id)
  LOOP
    -- Group expiring batches by assigned manager
    FOR v_manager_rec IN
      SELECT
        w.manager_id,
        COUNT(pb.id) as expiring_count
      FROM public.product_batches pb
      JOIN public.warehouses w ON w.id = pb.warehouse_id
      WHERE pb.company_id = v_comp.id
        AND pb.expiry_date >= v_today
        AND pb.expiry_date <= v_window_end
        AND pb.qty > 0
        AND w.manager_id IS NOT NULL
      GROUP BY w.manager_id
      HAVING COUNT(pb.id) > 0
    LOOP
      -- Check if reminder already sent today for this manager
      SELECT id INTO v_existing_id
      FROM public.notifications
      WHERE company_id = v_comp.id
        AND user_id = v_manager_rec.manager_id
        AND type = 'expiring_batches'
        AND title = 'End-of-Day Expiry Reminder'
        AND created_at::DATE = v_today
      LIMIT 1;

      IF v_existing_id IS NULL THEN
        IF v_manager_rec.expiring_count = 1 THEN
          v_msg := '1 batch across your assigned warehouses is approaching expiry. Review the batch list before closing for the day.';
        ELSE
          v_msg := v_manager_rec.expiring_count || ' batches across your assigned warehouses are approaching expiry. Review the batch list before closing for the day.';
        END IF;

        INSERT INTO public.notifications (
          company_id, user_id, title, message, type, link, is_read, read
        ) VALUES (
          v_comp.id, v_manager_rec.manager_id,
          'End-of-Day Expiry Reminder',
          v_msg,
          'expiring_batches',
          '/inventory/batches',
          FALSE, FALSE
        );
        v_notif_count := v_notif_count + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'reminders_created', v_notif_count,
    'business_date', v_today
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
