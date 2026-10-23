-- Migration 026: Warehouse Manager Stock Alerts & Multi-Warehouse Notification Targeting
-- Enforces that low-stock and limited-stock alerts are delivered exclusively to the assigned Warehouse Manager(s)
-- Prevents stock alert leakage to Sales Persons, Cashiers, unrelated managers, or across multi-tenant companies

-- 1. Extend public.warehouses with manager_id reference
ALTER TABLE public.warehouses
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Create junction table for explicit multi-manager assignments to warehouses
CREATE TABLE IF NOT EXISTS public.warehouse_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(warehouse_id, user_id)
);

-- 3. Extend public.notifications with warehouse_id and product_id for granular targeting
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;

-- 4. Indexes for rapid lookups and low-latency alert queries
CREATE INDEX IF NOT EXISTS idx_warehouses_manager ON public.warehouses(manager_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_managers_lookup ON public.warehouse_managers(warehouse_id, user_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_managers_user ON public.warehouse_managers(user_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_managers_company ON public.warehouse_managers(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_wh_prod ON public.notifications(warehouse_id, product_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);

-- 5. Row-Level Security (RLS) for warehouse_managers
ALTER TABLE public.warehouse_managers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "warehouse_managers_company_isolation" ON public.warehouse_managers;
CREATE POLICY "warehouse_managers_company_isolation" ON public.warehouse_managers
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

-- 6. Granular Row-Level Security (RLS) Policies on Notifications Table
-- Drop blanket company-wide isolation policy
DROP POLICY IF EXISTS "notifications_company_isolation" ON public.notifications;
DROP POLICY IF EXISTS "notifications_select_recipient" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_policy" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_policy" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete_policy" ON public.notifications;

-- SELECT Policy:
-- CRITICAL SECURITY RULE:
-- Stock alerts (low_stock, limited_stock, out_of_stock) are delivered and visible ONLY to the
-- assigned Warehouse Manager(s) for the affected warehouse.
-- Sales Persons, Cashiers, Owners, and unrelated Admins CANNOT view stock alerts unless
-- explicitly assigned to manage that warehouse.
-- Non-stock notifications (payments, invoices, administrative announcements) remain accessible to authorized roles.
CREATE POLICY "notifications_select_recipient" ON public.notifications
  FOR SELECT TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND (
      -- Stock Alerts: Only visible to the assigned recipient who manages that warehouse
      (
        type IN ('low_stock', 'limited_stock', 'out_of_stock')
        AND user_id = auth.uid()
        AND (
          warehouse_id IS NULL
          OR EXISTS (
            SELECT 1 FROM public.warehouses w
            WHERE w.id = notifications.warehouse_id
              AND (
                w.manager_id = auth.uid()
                OR EXISTS (
                  SELECT 1 FROM public.warehouse_managers wm
                  WHERE wm.warehouse_id = w.id AND wm.user_id = auth.uid()
                )
              )
          )
        )
      )
      -- Non-Stock Notifications: Visible to direct recipient, or Admins/Owners for oversight
      OR (
        type NOT IN ('low_stock', 'limited_stock', 'out_of_stock')
        AND (
          user_id = auth.uid()
          OR public.get_user_role() IN ('Owner', 'Admin')
          OR (user_id IS NULL AND public.get_user_role() NOT IN ('Salesperson', 'Cashier'))
        )
      )
    )
  );

-- INSERT Policy: Authenticated users can insert notifications within their company
CREATE POLICY "notifications_insert_policy" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id());

-- UPDATE Policy: Recipients or Admins/Owners can mark notifications as read
CREATE POLICY "notifications_update_policy" ON public.notifications
  FOR UPDATE TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND (
      user_id = auth.uid()
      OR public.get_user_role() IN ('Owner', 'Admin')
    )
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND (
      user_id = auth.uid()
      OR public.get_user_role() IN ('Owner', 'Admin')
    )
  );

-- DELETE Policy: Only Admins and Owners can clear all notifications
CREATE POLICY "notifications_delete_policy" ON public.notifications
  FOR DELETE TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND (
      user_id = auth.uid()
      OR public.get_user_role() IN ('Owner', 'Admin')
    )
  );

-- 7. Secure Backend RPC Function: Dispatch Warehouse Stock Alert
-- Identifies assigned warehouse managers, validates company isolation, deduplicates, and creates targeted alerts
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
  v_created_count INT := 0;
  v_existing_id UUID;
BEGIN
  -- 1. Fetch Product Info
  SELECT company_id, name, COALESCE(sku, name)
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
  -- CRITICAL RULE: NEVER broadcast stock alerts to everyone!
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
        'Warehouse "' || v_warehouse_name || '" has stock alerts for ' || v_product_name || ' (SKU: ' || v_product_sku || '), but no Warehouse Manager is assigned. Please assign a Warehouse Manager.',
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

  -- 5. Determine Alert Type & Content
  IF p_current_stock <= 0 THEN
    v_alert_type := 'out_of_stock';
    v_title := 'Out of Stock: ' || v_product_name;
    v_message := 'Out of Stock: ' || v_product_name || ' (SKU: ' || v_product_sku || ') in Warehouse "' || v_warehouse_name ||
                 '". Available quantity: 0 ' || p_unit || '. Minimum threshold: ' || p_reorder_level || ' ' || p_unit || '.';
  ELSE
    v_alert_type := 'limited_stock';
    v_title := 'Limited Stock: ' || v_product_name;
    v_message := 'Limited Stock: ' || v_product_name || ' (SKU: ' || v_product_sku || ') in Warehouse "' || v_warehouse_name ||
                 '". Current available quantity: ' || p_current_stock || ' ' || p_unit || '. Minimum threshold: ' || p_reorder_level || ' ' || p_unit || '.';
  END IF;

  v_link := '/products?search=' || v_product_sku;

  -- 6. Dispatch targeted notification strictly to each assigned manager (with deduplication)
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

-- 8. Automatic Database Trigger on stock_balances Updates/Inserts
CREATE OR REPLACE FUNCTION public.trg_stock_balances_check_alert()
RETURNS TRIGGER AS $$
DECLARE
  v_reorder_level NUMERIC;
  v_unit VARCHAR;
BEGIN
  SELECT reorder_level, COALESCE(primary_unit, 'Piece')
  INTO v_reorder_level, v_unit
  FROM public.products
  WHERE id = NEW.product_id;

  IF v_reorder_level IS NOT NULL THEN
    PERFORM public.dispatch_warehouse_stock_alert(
      NEW.product_id,
      NEW.warehouse_id,
      NEW.quantity,
      v_reorder_level,
      v_unit
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_stock_balances_alert ON public.stock_balances;
CREATE TRIGGER trg_stock_balances_alert
  AFTER INSERT OR UPDATE OF quantity ON public.stock_balances
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_stock_balances_check_alert();