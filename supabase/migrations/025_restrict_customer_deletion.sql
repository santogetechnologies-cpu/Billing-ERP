-- Migration 025: Remove Customer Delete Permission for Sales Person & Enforce Backend Deletion Security
-- Strictly prohibits Sales Persons from deleting customer records via RLS and PostgreSQL triggers
-- Preserves customer deletion privileges for Admins and Owners
-- Enforces financial integrity: prevents deletion of customers with linked invoices or payments

-- 1. Ensure Salesperson role has can_delete = FALSE for customers module in role_permissions
DO $$
DECLARE
  v_role_id UUID;
  v_perm_id UUID;
BEGIN
  SELECT id INTO v_role_id FROM public.roles WHERE name = 'Salesperson' LIMIT 1;
  SELECT id INTO v_perm_id FROM public.permissions WHERE module = 'customers' LIMIT 1;

  IF v_role_id IS NOT NULL AND v_perm_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id, can_view, can_create, can_edit, can_delete, can_approve, can_export)
    VALUES (v_role_id, v_perm_id, TRUE, TRUE, TRUE, FALSE, FALSE, TRUE)
    ON CONFLICT (role_id, permission_id)
    DO UPDATE SET
      can_delete = FALSE,
      can_view = TRUE,
      can_create = TRUE,
      can_edit = TRUE;
  END IF;
END $$;

-- 2. Drop existing blanket company isolation policy on customers if present
DROP POLICY IF EXISTS "customers_company_isolation" ON public.customers;
DROP POLICY IF EXISTS "customers_select_isolation" ON public.customers;
DROP POLICY IF EXISTS "customers_insert_isolation" ON public.customers;
DROP POLICY IF EXISTS "customers_update_isolation" ON public.customers;
DROP POLICY IF EXISTS "customers_delete_isolation" ON public.customers;

-- 3. Granular Row-Level Security (RLS) Policies on Customers Table

-- SELECT: Permitted to authenticated users within their company
CREATE POLICY "customers_select_isolation" ON public.customers
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

-- INSERT: Permitted to authenticated users within their company
CREATE POLICY "customers_insert_isolation" ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id());

-- UPDATE: Permitted to authenticated users within their company
CREATE POLICY "customers_update_isolation" ON public.customers
  FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

-- DELETE: Strictly restricted to Owner and Admin roles (Salesperson explicitly blocked)
CREATE POLICY "customers_delete_isolation" ON public.customers
  FOR DELETE TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND (
      public.get_user_role() IN ('Owner', 'Admin')
      OR public.user_has_permission('customers', 'delete')
    )
    AND (
      public.get_user_role() IS DISTINCT FROM 'Salesperson'
    )
  );

-- 4. Database-Level Trigger for Defense-in-Depth Security & Transaction Integrity
CREATE OR REPLACE FUNCTION public.prevent_unauthorized_customer_deletion()
RETURNS TRIGGER AS $$
DECLARE
  v_role text;
BEGIN
  -- Retrieve caller role from trusted auth context
  v_role := public.get_user_role();

  -- Rule 1: Explicitly forbid Sales Persons from deleting any customer record
  IF v_role = 'Salesperson' THEN
    RAISE EXCEPTION 'Access Denied (403): Sales Persons are strictly forbidden from deleting customer records.';
  END IF;

  -- Rule 2: Ensure caller is Admin or Owner, or possesses explicit delete privilege
  IF v_role IS NOT NULL AND v_role NOT IN ('Owner', 'Admin') THEN
    IF NOT public.user_has_permission('customers', 'delete') THEN
      RAISE EXCEPTION 'Access Denied (403): Role "%" is not authorized to delete customer records.', v_role;
    END IF;
  END IF;

  -- Rule 3: Integrity Check - Prevent deleting customers with linked sales invoices or orders
  IF EXISTS (SELECT 1 FROM public.sales WHERE customer_id = OLD.id LIMIT 1) THEN
    RAISE EXCEPTION 'Integrity Violation (409): Customer "%" cannot be deleted because sales invoices or orders are linked to this account.', OLD.name;
  END IF;

  -- Rule 4: Integrity Check - Prevent deleting customers with linked payment receipts
  IF EXISTS (SELECT 1 FROM public.payments WHERE party_id = OLD.id LIMIT 1) THEN
    RAISE EXCEPTION 'Integrity Violation (409): Customer "%" cannot be deleted because payment transactions are linked to this account.', OLD.name;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach Trigger to public.customers
DROP TRIGGER IF EXISTS trg_prevent_unauthorized_customer_deletion ON public.customers;
CREATE TRIGGER trg_prevent_unauthorized_customer_deletion
  BEFORE DELETE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_unauthorized_customer_deletion();
