-- Migration 016: Fix Multi-Tenant Signup, Dynamic Company Allocation & RLS Isolation
-- Addresses: User data overwriting and data loss across multi-tenant user sessions

-- 1. Update Companies RLS Policies: Allow authenticated users to create a company during onboarding
DROP POLICY IF EXISTS "Users can access their company" ON public.companies;
DROP POLICY IF EXISTS "Users can insert companies" ON public.companies;
DROP POLICY IF EXISTS "Users can view and update their company" ON public.companies;

CREATE POLICY "Users can insert companies" ON public.companies
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view and update their company" ON public.companies
  FOR ALL TO authenticated
  USING (id = public.get_user_company_id())
  WITH CHECK (id = public.get_user_company_id());

-- 2. Update Profiles RLS Policies: Allow viewing colleagues in the same company and managing self
DROP POLICY IF EXISTS "Users can manage own profile or view company colleagues" ON public.profiles;

CREATE POLICY "Users can manage own profile or view company colleagues" ON public.profiles
  FOR ALL TO authenticated
  USING (id = auth.uid() OR company_id = public.get_user_company_id())
  WITH CHECK (id = auth.uid() OR company_id = public.get_user_company_id());

-- 3. Automatic Provisioning Trigger for New Companies
-- Creates initial sequences, default warehouse, and default chart of accounts upon company insertion
CREATE OR REPLACE FUNCTION public.handle_new_company_provisioning()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert default warehouse
  INSERT INTO public.warehouses (company_id, name, code, is_default, address)
  VALUES (NEW.id, 'Main Warehouse', 'MAIN', true, 'Headquarters')
  ON CONFLICT DO NOTHING;

  -- Insert default invoice sequences
  INSERT INTO public.invoice_sequences (company_id, doc_type, prefix, next_number)
  VALUES
    (NEW.id, 'sales', 'INV-', 1),
    (NEW.id, 'purchases', 'PUR-', 1),
    (NEW.id, 'quotations', 'EST-', 1),
    (NEW.id, 'payments', 'PAY-', 1),
    (NEW.id, 'receipts', 'REC-', 1),
    (NEW.id, 'expenses', 'EXP-', 1),
    (NEW.id, 'transfers', 'TRF-', 1)
  ON CONFLICT DO NOTHING;

  -- Insert default units
  INSERT INTO public.product_units (company_id, name, symbol, is_base)
  VALUES
    (NEW.id, 'Piece', 'Pcs', true),
    (NEW.id, 'Kilogram', 'Kg', true),
    (NEW.id, 'Meter', 'm', true),
    (NEW.id, 'Box', 'Box', false)
  ON CONFLICT DO NOTHING;

  -- Insert default system chart of accounts
  INSERT INTO public.accounts (company_id, code, name, category, balance, balance_type, is_system)
  VALUES
    (NEW.id, '1001', 'Cash Account', 'Assets', 0, 'Debit', true),
    (NEW.id, '1002', 'Bank Account', 'Assets', 0, 'Debit', true),
    (NEW.id, '1003', 'Accounts Receivable', 'Assets', 0, 'Debit', true),
    (NEW.id, '1004', 'Inventory Asset', 'Assets', 0, 'Debit', true),
    (NEW.id, '2001', 'Accounts Payable', 'Liabilities', 0, 'Credit', true),
    (NEW.id, '2002', 'GST Output Payable', 'Liabilities', 0, 'Credit', true),
    (NEW.id, '4001', 'Sales Account', 'Income', 0, 'Credit', true),
    (NEW.id, '5001', 'Cost of Goods Sold', 'Expenses', 0, 'Debit', true),
    (NEW.id, '5002', 'Operating Expenses', 'Expenses', 0, 'Debit', true)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_new_company_provisioning ON public.companies;
CREATE TRIGGER trg_new_company_provisioning
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_company_provisioning();
