-- ============================================================================
-- UNIVERSAL BILLING: COMBINED MIGRATION SCRIPT FOR MISSING TABLES
-- Run this script in your Supabase Dashboard: SQL Editor -> New Query -> Run
-- Fixes:
--   1. 404 on customer_support_cases
--   2. 404 on customer_returns
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Part 1: customer_support_cases & Salesperson Support Notification Schema
-- ----------------------------------------------------------------------------

-- 1. Extend public.customers with assigned_salesperson_id
ALTER TABLE IF EXISTS public.customers
  ADD COLUMN IF NOT EXISTS assigned_salesperson_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customers_assigned_sp ON public.customers(assigned_salesperson_id);

-- 2. Extend public.notifications with customer support metadata
ALTER TABLE IF EXISTS public.notifications
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'Normal',
  ADD COLUMN IF NOT EXISTS category VARCHAR(50),
  ADD COLUMN IF NOT EXISTS case_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS case_status VARCHAR(50) DEFAULT 'Open',
  ADD COLUMN IF NOT EXISTS followup_due TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dedup_key VARCHAR(255),
  ADD COLUMN IF NOT EXISTS is_escalated BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_notifications_category ON public.notifications(category);
CREATE INDEX IF NOT EXISTS idx_notifications_customer ON public.notifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_notifications_dedup_key ON public.notifications(dedup_key);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON public.notifications(priority);

-- 3. Create customer_support_cases table
CREATE TABLE IF NOT EXISTS public.customer_support_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  case_number VARCHAR(50) NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'Normal',
  status VARCHAR(50) NOT NULL DEFAULT 'Open',
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.sales_invoices(id) ON DELETE SET NULL,
  assigned_salesperson_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  followup_due TIMESTAMPTZ,
  resolution_notes TEXT,
  notes JSONB DEFAULT '[]'::jsonb,
  is_escalated BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_cases_company ON public.customer_support_cases(company_id);
CREATE INDEX IF NOT EXISTS idx_support_cases_customer ON public.customer_support_cases(customer_id);
CREATE INDEX IF NOT EXISTS idx_support_cases_sp ON public.customer_support_cases(assigned_salesperson_id);
CREATE INDEX IF NOT EXISTS idx_support_cases_status ON public.customer_support_cases(status);
CREATE INDEX IF NOT EXISTS idx_support_cases_category ON public.customer_support_cases(category);

ALTER TABLE public.customer_support_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_cases_select_policy" ON public.customer_support_cases;
CREATE POLICY "support_cases_select_policy" ON public.customer_support_cases
  FOR SELECT TO authenticated
  USING (
    company_id = public.get_user_company_id()
  );

DROP POLICY IF EXISTS "support_cases_insert_policy" ON public.customer_support_cases;
CREATE POLICY "support_cases_insert_policy" ON public.customer_support_cases
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.get_user_company_id()
  );

DROP POLICY IF EXISTS "support_cases_update_policy" ON public.customer_support_cases;
CREATE POLICY "support_cases_update_policy" ON public.customer_support_cases
  FOR UPDATE TO authenticated
  USING (
    company_id = public.get_user_company_id()
  );


-- ----------------------------------------------------------------------------
-- Part 2: customer_returns Table & RLS Policies
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.customer_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  return_number VARCHAR(50) NOT NULL,
  original_invoice_id UUID NOT NULL REFERENCES public.sales_invoices(id) ON DELETE CASCADE,
  original_invoice_number VARCHAR(50) NOT NULL,
  return_date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(50),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_name VARCHAR(255) NOT NULL,
  sku VARCHAR(100),
  barcode VARCHAR(100),
  sold_qty NUMERIC(15, 3) NOT NULL DEFAULT 0,
  returned_qty NUMERIC(15, 3) NOT NULL DEFAULT 1,
  unit VARCHAR(50) DEFAULT 'Piece',
  unit_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
  refund_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  condition VARCHAR(50) NOT NULL DEFAULT 'Resalable',
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  warehouse_name VARCHAR(255),
  return_status VARCHAR(50) NOT NULL DEFAULT 'Pending Review',
  refund_status VARCHAR(50) NOT NULL DEFAULT 'Pending',
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by_name VARCHAR(255),
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by_name VARCHAR(255),
  approved_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  rejected_by_name VARCHAR(255),
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  restocked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  restocked_by_name VARCHAR(255),
  restocked_at TIMESTAMPTZ,
  refunded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  refunded_by_name VARCHAR(255),
  refunded_at TIMESTAMPTZ,
  refund_method VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_returns_company ON public.customer_returns(company_id);
CREATE INDEX IF NOT EXISTS idx_customer_returns_invoice ON public.customer_returns(original_invoice_id);
CREATE INDEX IF NOT EXISTS idx_customer_returns_customer ON public.customer_returns(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_returns_product ON public.customer_returns(product_id);
CREATE INDEX IF NOT EXISTS idx_customer_returns_status ON public.customer_returns(return_status);
CREATE INDEX IF NOT EXISTS idx_customer_returns_number ON public.customer_returns(return_number);

ALTER TABLE public.customer_returns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_returns_select_policy" ON public.customer_returns;
CREATE POLICY "customer_returns_select_policy" ON public.customer_returns
  FOR SELECT TO authenticated
  USING (
    company_id = public.get_user_company_id()
  );

DROP POLICY IF EXISTS "customer_returns_insert_policy" ON public.customer_returns;
CREATE POLICY "customer_returns_insert_policy" ON public.customer_returns
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.get_user_company_id()
  );

DROP POLICY IF EXISTS "customer_returns_update_policy" ON public.customer_returns;
CREATE POLICY "customer_returns_update_policy" ON public.customer_returns
  FOR UPDATE TO authenticated
  USING (
    company_id = public.get_user_company_id()
  );

DROP POLICY IF EXISTS "customer_returns_delete_policy" ON public.customer_returns;
CREATE POLICY "customer_returns_delete_policy" ON public.customer_returns
  FOR DELETE TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND public.get_user_role() IN ('Owner', 'Admin')
  );

-- Auto-update updated_at timestamp trigger
CREATE OR REPLACE FUNCTION public.set_customer_returns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_customer_returns_updated_at ON public.customer_returns;
CREATE TRIGGER trg_customer_returns_updated_at
  BEFORE UPDATE ON public.customer_returns
  FOR EACH ROW
  EXECUTE FUNCTION public.set_customer_returns_updated_at();

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
