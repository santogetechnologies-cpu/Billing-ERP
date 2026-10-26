-- ============================================================================
-- Migration 037: Customer Purchase Returns Management
-- Supports registering and processing customer returns against original sales invoices
-- Tracks item condition (Resalable, Damaged, Defective, Expired)
-- Enforces quarantine / stock isolation until authorized and received
-- ============================================================================

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
  condition VARCHAR(50) NOT NULL DEFAULT 'Resalable', -- 'Resalable', 'Damaged', 'Defective', 'Expired'
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  warehouse_name VARCHAR(255),
  return_status VARCHAR(50) NOT NULL DEFAULT 'Pending Review', -- 'Pending Review', 'Approved', 'Rejected', 'Stock Restocked'
  refund_status VARCHAR(50) NOT NULL DEFAULT 'Pending', -- 'Pending', 'Refunded', 'Rejected', 'No Refund Required'
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

-- Indexes for high-performance lookup
CREATE INDEX IF NOT EXISTS idx_customer_returns_company ON public.customer_returns(company_id);
CREATE INDEX IF NOT EXISTS idx_customer_returns_invoice ON public.customer_returns(original_invoice_id);
CREATE INDEX IF NOT EXISTS idx_customer_returns_customer ON public.customer_returns(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_returns_product ON public.customer_returns(product_id);
CREATE INDEX IF NOT EXISTS idx_customer_returns_status ON public.customer_returns(return_status);
CREATE INDEX IF NOT EXISTS idx_customer_returns_number ON public.customer_returns(return_number);

-- Enable Row Level Security
ALTER TABLE public.customer_returns ENABLE ROW LEVEL SECURITY;

-- Multi-tenant Company Isolation Policies
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
