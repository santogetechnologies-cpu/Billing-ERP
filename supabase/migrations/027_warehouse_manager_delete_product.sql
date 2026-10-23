-- Migration 027: Enable Product Deletion for Warehouse Manager with Strict Security & Data Integrity
-- 1. Grants delete permission on 'products' module to 'Warehouse Manager' in role_permissions
-- 2. Preserves Admin and Owner privileges; strictly blocks Salesperson and other roles
-- 3. Row-Level Security (RLS) enforcement on public.products for granular DELETE isolation
-- 4. Defense-in-depth BEFORE DELETE trigger enforcing tenant isolation, role auth, and historical transaction protection
-- 5. Helper function check_product_deletion_eligibility for pre-flight integrity verification

-- 1. Ensure 'Warehouse Manager' has delete privilege on products in role_permissions
DO $$
DECLARE
  v_wm_role_id UUID;
  v_sp_role_id UUID;
  v_perm_id UUID;
BEGIN
  -- Retrieve permissions record for products module
  SELECT id INTO v_perm_id FROM public.permissions WHERE module = 'products' LIMIT 1;
  
  -- If permissions table does not have 'products', insert it
  IF v_perm_id IS NULL THEN
    INSERT INTO public.permissions (module, description)
    VALUES ('products', 'Product Master, SKU catalog, pricing rules and inventory definitions')
    RETURNING id INTO v_perm_id;
  END IF;

  -- 1A. Grant delete permission to Warehouse Manager
  SELECT id INTO v_wm_role_id FROM public.roles WHERE name = 'Warehouse Manager' LIMIT 1;
  IF v_wm_role_id IS NOT NULL AND v_perm_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (
      role_id, permission_id, can_view, can_create, can_edit, can_delete, can_approve, can_export
    )
    VALUES (v_wm_role_id, v_perm_id, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE)
    ON CONFLICT (role_id, permission_id)
    DO UPDATE SET
      can_delete = TRUE,
      can_view = TRUE,
      can_create = TRUE,
      can_edit = TRUE,
      can_export = TRUE;
  END IF;

  -- 1B. Strictly ensure Salesperson has can_delete = FALSE on products
  SELECT id INTO v_sp_role_id FROM public.roles WHERE name = 'Salesperson' LIMIT 1;
  IF v_sp_role_id IS NOT NULL AND v_perm_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (
      role_id, permission_id, can_view, can_create, can_edit, can_delete, can_approve, can_export
    )
    VALUES (v_sp_role_id, v_perm_id, TRUE, FALSE, FALSE, FALSE, FALSE, FALSE)
    ON CONFLICT (role_id, permission_id)
    DO UPDATE SET can_delete = FALSE;
  END IF;
END $$;

-- 2. Drop existing blanket company isolation policy on products if present
DROP POLICY IF EXISTS "products_company_isolation" ON public.products;
DROP POLICY IF EXISTS "products_select_isolation" ON public.products;
DROP POLICY IF EXISTS "products_insert_isolation" ON public.products;
DROP POLICY IF EXISTS "products_update_isolation" ON public.products;
DROP POLICY IF EXISTS "products_delete_isolation" ON public.products;

-- 3. Granular Row-Level Security (RLS) Policies on Products Table

-- SELECT: Permitted to authenticated users within their company
CREATE POLICY "products_select_isolation" ON public.products
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

-- INSERT: Permitted to Owner, Admin, and authorized roles (e.g. Warehouse Manager)
CREATE POLICY "products_insert_isolation" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND (
      public.get_user_role() IN ('Owner', 'Admin')
      OR public.user_has_permission('products', 'create')
    )
  );

-- UPDATE: Permitted to Owner, Admin, and authorized roles (e.g. Warehouse Manager)
CREATE POLICY "products_update_isolation" ON public.products
  FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND (
      public.get_user_role() IN ('Owner', 'Admin')
      OR public.user_has_permission('products', 'edit')
    )
  );

-- DELETE: Strictly restricted to Owner, Admin, and Warehouse Manager (with products.delete permission)
-- Salesperson, Cashier, Accountant, Purchase Manager are explicitly blocked
CREATE POLICY "products_delete_isolation" ON public.products
  FOR DELETE TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND (
      public.get_user_role() IN ('Owner', 'Admin')
      OR (
        public.get_user_role() = 'Warehouse Manager'
        AND public.user_has_permission('products', 'delete')
      )
    )
    AND (
      public.get_user_role() IS DISTINCT FROM 'Salesperson'
      AND public.get_user_role() IS DISTINCT FROM 'Cashier'
      AND public.get_user_role() IS DISTINCT FROM 'Accountant'
      AND public.get_user_role() IS DISTINCT FROM 'Purchase Manager'
    )
  );

-- 4. Pre-Flight Deletion Eligibility Checker Function
CREATE OR REPLACE FUNCTION public.check_product_deletion_eligibility(
  p_product_id UUID,
  p_company_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_company_id UUID;
  v_prod RECORD;
  v_stock NUMERIC := 0;
  v_stock_balances_count INT := 0;
  v_sales_count INT := 0;
  v_purchases_count INT := 0;
  v_transactions_count INT := 0;
  v_transfers_count INT := 0;
  v_batches_count INT := 0;
  v_serials_count INT := 0;
  v_reasons TEXT[] := ARRAY[]::TEXT[];
  v_can_delete BOOLEAN := TRUE;
BEGIN
  v_company_id := COALESCE(p_company_id, public.get_user_company_id());

  SELECT * INTO v_prod FROM public.products
  WHERE id = p_product_id AND (v_company_id IS NULL OR company_id = v_company_id);

  IF v_prod.id IS NULL THEN
    RETURN jsonb_build_object(
      'can_delete', FALSE,
      'reasons', jsonb_build_array('Product does not exist or does not belong to your company.'),
      'error', 'Not found'
    );
  END IF;

  -- 1. Check current stock
  v_stock := COALESCE(v_prod.current_stock, 0);
  IF v_stock != 0 THEN
    v_can_delete := FALSE;
    v_reasons := array_append(v_reasons, 'Product has active inventory stock (' || v_stock || ' ' || COALESCE(v_prod.primary_unit, 'Units') || '). Adjust stock to 0 before deletion.');
  END IF;

  -- 2. Check non-zero warehouse stock balances
  SELECT COUNT(*) INTO v_stock_balances_count
  FROM public.stock_balances
  WHERE product_id = p_product_id AND quantity != 0;
  IF v_stock_balances_count > 0 THEN
    v_can_delete := FALSE;
    v_reasons := array_append(v_reasons, 'Non-zero stock balances exist across ' || v_stock_balances_count || ' warehouse location(s).');
  END IF;

  -- 3. Check historical sales invoices
  SELECT COUNT(*) INTO v_sales_count
  FROM public.sales_items
  WHERE product_id = p_product_id;
  IF v_sales_count > 0 THEN
    v_can_delete := FALSE;
    v_reasons := array_append(v_reasons, 'Product is referenced by ' || v_sales_count || ' historical sales invoice item(s). Deactivation is required to preserve financial records.');
  END IF;

  -- 4. Check historical purchase bills
  SELECT COUNT(*) INTO v_purchases_count
  FROM public.purchase_items
  WHERE product_id = p_product_id;
  IF v_purchases_count > 0 THEN
    v_can_delete := FALSE;
    v_reasons := array_append(v_reasons, 'Product is referenced by ' || v_purchases_count || ' purchase bill item(s). Deactivation is required to preserve accounting records.');
  END IF;

  -- 5. Check historical stock movements / transactions
  SELECT COUNT(*) INTO v_transactions_count
  FROM public.stock_transactions
  WHERE product_id = p_product_id;
  IF v_transactions_count > 0 THEN
    v_can_delete := FALSE;
    v_reasons := array_append(v_reasons, 'Product has ' || v_transactions_count || ' historical stock ledger transaction(s).');
  END IF;

  -- 6. Check stock transfers
  SELECT COUNT(*) INTO v_transfers_count
  FROM public.stock_transfer_items
  WHERE product_id = p_product_id;
  IF v_transfers_count > 0 THEN
    v_can_delete := FALSE;
    v_reasons := array_append(v_reasons, 'Product is linked to ' || v_transfers_count || ' warehouse stock transfer(s).');
  END IF;

  -- 7. Check batches with remaining quantity
  SELECT COUNT(*) INTO v_batches_count
  FROM public.product_batches
  WHERE product_id = p_product_id AND qty != 0;
  IF v_batches_count > 0 THEN
    v_can_delete := FALSE;
    v_reasons := array_append(v_reasons, 'Product has ' || v_batches_count || ' active batch(es) with remaining inventory.');
  END IF;

  -- 8. Check serial numbers
  SELECT COUNT(*) INTO v_serials_count
  FROM public.product_serial_numbers
  WHERE product_id = p_product_id;
  IF v_serials_count > 0 THEN
    v_can_delete := FALSE;
    v_reasons := array_append(v_reasons, 'Product has ' || v_serials_count || ' registered serial number(s).');
  END IF;

  RETURN jsonb_build_object(
    'can_delete', v_can_delete,
    'reasons', to_jsonb(v_reasons),
    'stock', v_stock,
    'stock_balances_count', v_stock_balances_count,
    'sales_count', v_sales_count,
    'purchases_count', v_purchases_count,
    'transactions_count', v_transactions_count,
    'transfers_count', v_transfers_count,
    'batches_count', v_batches_count,
    'serials_count', v_serials_count
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 5. Database-Level Trigger for Defense-in-Depth Security & Transaction Integrity
CREATE OR REPLACE FUNCTION public.prevent_unauthorized_product_deletion()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
  v_user_company_id UUID;
BEGIN
  -- 1. Tenant Security: Prevent deleting products belonging to another company
  v_user_company_id := public.get_user_company_id();
  IF v_user_company_id IS NOT NULL AND OLD.company_id IS DISTINCT FROM v_user_company_id THEN
    RAISE EXCEPTION 'Cross-Tenant Violation (403): Cannot delete products belonging to another company.';
  END IF;

  -- 2. Role-Based Access Control
  v_role := public.get_user_role();
  IF v_role IS NOT NULL THEN
    -- Rule 2A: Explicitly forbid Sales Persons from deleting any product record
    IF v_role = 'Salesperson' THEN
      RAISE EXCEPTION 'Access Denied (403): Sales Persons are strictly forbidden from deleting product records.';
    END IF;

    -- Rule 2B: Explicitly forbid unauthorized roles
    IF v_role IN ('Cashier', 'Accountant', 'Purchase Manager') THEN
      RAISE EXCEPTION 'Access Denied (403): Role "%" is not authorized to delete product records.', v_role;
    END IF;

    -- Rule 2C: Verify authorized roles (Owner, Admin, Warehouse Manager)
    IF v_role NOT IN ('Owner', 'Admin', 'Warehouse Manager') THEN
      IF NOT public.user_has_permission('products', 'delete') THEN
        RAISE EXCEPTION 'Access Denied (403): Role "%" is not authorized to delete product records.', v_role;
      END IF;
    END IF;

    -- Rule 2D: Ensure Warehouse Manager possesses explicit delete privilege
    IF v_role = 'Warehouse Manager' THEN
      IF NOT public.user_has_permission('products', 'delete') THEN
        RAISE EXCEPTION 'Access Denied (403): Warehouse Manager lacks permission to delete products.';
      END IF;
    END IF;
  END IF;

  -- 3. Integrity Checks: Protect Financial Records and Historical Transactions
  -- Rule 3A: Prevent deleting products with non-zero current stock
  IF COALESCE(OLD.current_stock, 0) != 0 THEN
    RAISE EXCEPTION 'Integrity Violation (409): Product "%" (SKU: %) cannot be deleted because it currently has active inventory stock (% units). Adjust stock to 0 or archive the product.', OLD.name, OLD.sku, OLD.current_stock;
  END IF;

  -- Rule 3B: Prevent deleting products with non-zero warehouse balances
  IF EXISTS (SELECT 1 FROM public.stock_balances WHERE product_id = OLD.id AND quantity != 0 LIMIT 1) THEN
    RAISE EXCEPTION 'Integrity Violation (409): Product "%" (SKU: %) cannot be deleted because warehouse stock balances are non-zero. Archive the product instead.', OLD.name, OLD.sku;
  END IF;

  -- Rule 3C: Prevent deleting products with linked sales invoices
  IF EXISTS (SELECT 1 FROM public.sales_items WHERE product_id = OLD.id LIMIT 1) THEN
    RAISE EXCEPTION 'Integrity Violation (409): Product "%" (SKU: %) cannot be permanently deleted because historical sales invoices reference this item. Archive the product instead.', OLD.name, OLD.sku;
  END IF;

  -- Rule 3D: Prevent deleting products with linked purchase bills
  IF EXISTS (SELECT 1 FROM public.purchase_items WHERE product_id = OLD.id LIMIT 1) THEN
    RAISE EXCEPTION 'Integrity Violation (409): Product "%" (SKU: %) cannot be permanently deleted because historical purchase invoices reference this item. Archive the product instead.', OLD.name, OLD.sku;
  END IF;

  -- Rule 3E: Prevent deleting products with historical stock movements
  IF EXISTS (SELECT 1 FROM public.stock_transactions WHERE product_id = OLD.id LIMIT 1) THEN
    RAISE EXCEPTION 'Integrity Violation (409): Product "%" (SKU: %) cannot be permanently deleted because historical stock movement records exist. Archive the product instead.', OLD.name, OLD.sku;
  END IF;

  -- Rule 3F: Prevent deleting products with linked stock transfers
  IF EXISTS (SELECT 1 FROM public.stock_transfer_items WHERE product_id = OLD.id LIMIT 1) THEN
    RAISE EXCEPTION 'Integrity Violation (409): Product "%" (SKU: %) cannot be deleted because stock transfer records exist. Archive the product instead.', OLD.name, OLD.sku;
  END IF;

  -- Rule 3G: Prevent deleting products with active batch inventory
  IF EXISTS (SELECT 1 FROM public.product_batches WHERE product_id = OLD.id AND qty != 0 LIMIT 1) THEN
    RAISE EXCEPTION 'Integrity Violation (409): Product "%" (SKU: %) cannot be deleted because active batches with inventory stock exist.', OLD.name, OLD.sku;
  END IF;

  -- Rule 3H: Prevent deleting products with registered serial numbers
  IF EXISTS (SELECT 1 FROM public.product_serial_numbers WHERE product_id = OLD.id LIMIT 1) THEN
    RAISE EXCEPTION 'Integrity Violation (409): Product "%" (SKU: %) cannot be deleted because registered serial numbers exist.', OLD.name, OLD.sku;
  END IF;

  -- If product has 0 stock and no historical records, clean up empty 0-quantity balances before returning OLD
  DELETE FROM public.stock_balances WHERE product_id = OLD.id AND quantity = 0;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Attach Trigger to public.products
DROP TRIGGER IF EXISTS trg_prevent_unauthorized_product_deletion ON public.products;
CREATE TRIGGER trg_prevent_unauthorized_product_deletion
  BEFORE DELETE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_unauthorized_product_deletion();
