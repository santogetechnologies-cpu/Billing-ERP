-- ============================================================================
-- Migration 031: Consolidated Schema for Warehouse Managers & Purchase Requests
-- ============================================================================
-- Execute this entire script in your Supabase SQL Editor:
-- Dashboard: https://supabase.com/dashboard/project/zdygiubhmxuonzqchehp/sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. WAREHOUSES EXTENSIONS & MULTI-MANAGER ASSIGNMENTS
-- ----------------------------------------------------------------------------
ALTER TABLE public.warehouses
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS location_type VARCHAR(50) DEFAULT 'Main Warehouse',
  ADD COLUMN IF NOT EXISTS contact_person VARCHAR(255),
  ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

CREATE TABLE IF NOT EXISTS public.warehouse_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(warehouse_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_warehouses_manager ON public.warehouses(manager_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_managers_lookup ON public.warehouse_managers(warehouse_id, user_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_managers_user ON public.warehouse_managers(user_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_managers_company ON public.warehouse_managers(company_id);

ALTER TABLE public.warehouse_managers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "warehouse_managers_company_isolation" ON public.warehouse_managers;
CREATE POLICY "warehouse_managers_company_isolation" ON public.warehouse_managers
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

-- ----------------------------------------------------------------------------
-- 2. NOTIFICATIONS EXTENSIONS
-- ----------------------------------------------------------------------------
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_wh_prod ON public.notifications(warehouse_id, product_id);

-- ----------------------------------------------------------------------------
-- 3. PURCHASE REQUESTS MANAGEMENT SYSTEM
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  request_number VARCHAR(100) NOT NULL,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  warehouse_name VARCHAR(255) NOT NULL,
  requester_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  requester_name VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Pending Approval',
  priority VARCHAR(50) NOT NULL DEFAULT 'Normal',
  reason TEXT,
  requested_delivery_date DATE,
  notes TEXT,
  reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewer_name VARCHAR(255),
  rejection_reason TEXT,
  clarification_notes TEXT,
  purchase_order_id UUID REFERENCES public.purchases(id) ON DELETE SET NULL,
  purchase_order_number VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, request_number)
);

CREATE TABLE IF NOT EXISTS public.purchase_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.purchase_requests(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name VARCHAR(255) NOT NULL,
  sku VARCHAR(100),
  current_stock NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  warning_limit NUMERIC(12, 2),
  requested_qty NUMERIC(12, 2) NOT NULL DEFAULT 1.00,
  approved_qty NUMERIC(12, 2),
  received_qty NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  unit VARCHAR(50) DEFAULT 'Piece',
  estimated_cost NUMERIC(15, 2) DEFAULT 0.00,
  adjustment_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.purchase_request_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.purchase_requests(id) ON DELETE CASCADE,
  status_from VARCHAR(50),
  status_to VARCHAR(50) NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_name VARCHAR(255) NOT NULL,
  role VARCHAR(50),
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_requests_company ON public.purchase_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_status ON public.purchase_requests(status);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_warehouse ON public.purchase_requests(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_requester ON public.purchase_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_priority ON public.purchase_requests(priority);
CREATE INDEX IF NOT EXISTS idx_purchase_request_items_req ON public.purchase_request_items(request_id);
CREATE INDEX IF NOT EXISTS idx_purchase_request_items_prod ON public.purchase_request_items(product_id);
CREATE INDEX IF NOT EXISTS idx_purchase_request_history_req ON public.purchase_request_history(request_id);

ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_request_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "purchase_requests_company_isolation" ON public.purchase_requests;
CREATE POLICY "purchase_requests_company_isolation" ON public.purchase_requests
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "purchase_request_items_company_isolation" ON public.purchase_request_items;
CREATE POLICY "purchase_request_items_company_isolation" ON public.purchase_request_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.purchase_requests pr
      WHERE pr.id = purchase_request_items.request_id
        AND pr.company_id = public.get_user_company_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.purchase_requests pr
      WHERE pr.id = purchase_request_items.request_id
        AND pr.company_id = public.get_user_company_id()
    )
  );

DROP POLICY IF EXISTS "purchase_request_history_company_isolation" ON public.purchase_request_history;
CREATE POLICY "purchase_request_history_company_isolation" ON public.purchase_request_history
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.purchase_requests pr
      WHERE pr.id = purchase_request_history.request_id
        AND pr.company_id = public.get_user_company_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.purchase_requests pr
      WHERE pr.id = purchase_request_history.request_id
        AND pr.company_id = public.get_user_company_id()
    )
  );

-- ----------------------------------------------------------------------------
-- 4. PURCHASE ORDERS COMPATIBILITY TABLE (Optional standalone PO table)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  order_number VARCHAR(100) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery DATE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name VARCHAR(255) NOT NULL,
  subtotal NUMERIC(15, 2) DEFAULT 0.00,
  tax_total NUMERIC(15, 2) DEFAULT 0.00,
  grand_total NUMERIC(15, 2) DEFAULT 0.00,
  status VARCHAR(50) DEFAULT 'Draft',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, order_number)
);

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name VARCHAR(255) NOT NULL,
  qty NUMERIC(12, 2) NOT NULL DEFAULT 1.00,
  unit VARCHAR(50) DEFAULT 'Piece',
  rate NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  tax_rate NUMERIC(5, 2) DEFAULT 0.00,
  tax_amt NUMERIC(15, 2) DEFAULT 0.00,
  total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "purchase_orders_company_isolation" ON public.purchase_orders;
CREATE POLICY "purchase_orders_company_isolation" ON public.purchase_orders
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "purchase_order_items_company_isolation" ON public.purchase_order_items;
CREATE POLICY "purchase_order_items_company_isolation" ON public.purchase_order_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.purchase_orders po
      WHERE po.id = purchase_order_items.order_id
        AND po.company_id = public.get_user_company_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.purchase_orders po
      WHERE po.id = purchase_order_items.order_id
        AND po.company_id = public.get_user_company_id()
    )
  );

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
