-- Migration 028: Inventory Stock Alerts & Purchase Request Management Workflow
-- Enables Warehouse Managers to submit purchase requests for low/out-of-stock products
-- Enables Purchase Managers to review, approve, reject, request clarification, convert to PO, and track receipts.

-- 1. Create Purchase Requests Table
CREATE TABLE IF NOT EXISTS public.purchase_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  request_number VARCHAR(100) NOT NULL,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  warehouse_name VARCHAR(255) NOT NULL,
  requester_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  requester_name VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Pending Approval',
  priority VARCHAR(50) NOT NULL DEFAULT 'Normal', -- 'Normal', 'High', 'Urgent'
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

-- 2. Create Purchase Request Line Items Table
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

-- 3. Create Purchase Request Status History & Clarification Audit Table
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

-- 4. Indexes for Rapid Search and Filtering
CREATE INDEX IF NOT EXISTS idx_purchase_requests_company ON public.purchase_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_status ON public.purchase_requests(status);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_warehouse ON public.purchase_requests(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_requester ON public.purchase_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_priority ON public.purchase_requests(priority);
CREATE INDEX IF NOT EXISTS idx_purchase_request_items_req ON public.purchase_request_items(request_id);
CREATE INDEX IF NOT EXISTS idx_purchase_request_items_prod ON public.purchase_request_items(product_id);
CREATE INDEX IF NOT EXISTS idx_purchase_request_history_req ON public.purchase_request_history(request_id);

-- 5. Row-Level Security (RLS)
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_request_history ENABLE ROW LEVEL SECURITY;

-- Company isolation policies
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
