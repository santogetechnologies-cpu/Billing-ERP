-- Migration 030: Purchase Manager Barcode Management and Supplier Barcode Override
-- Allows authorized Purchase Managers to assign barcodes manually and override barcodes for incoming supplier/manufacturer packaging (e.g., snacks)
-- Records audit logs and allows optional selling price updates.

CREATE TABLE IF NOT EXISTS public.barcode_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_name VARCHAR(255) NOT NULL,
  sku VARCHAR(100) NOT NULL,
  method VARCHAR(50) NOT NULL, -- 'MANUAL_ENTRY' or 'SUPPLIER_OVERRIDE'
  old_barcode VARCHAR(100),
  new_barcode VARCHAR(100) NOT NULL,
  old_selling_price NUMERIC(15, 2),
  new_selling_price NUMERIC(15, 2),
  price_updated BOOLEAN DEFAULT FALSE,
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  purchase_order_number VARCHAR(100),
  reason TEXT,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_name VARCHAR(255) NOT NULL,
  user_role VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optimize queries for product lookups, barcode uniqueness checks, and chronological audit history
CREATE INDEX IF NOT EXISTS idx_barcode_audit_logs_company ON public.barcode_audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_barcode_audit_logs_product ON public.barcode_audit_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_barcode_audit_logs_new_barcode ON public.barcode_audit_logs(new_barcode);
CREATE INDEX IF NOT EXISTS idx_barcode_audit_logs_created_at ON public.barcode_audit_logs(created_at DESC);

-- Supplementary indexes on product_barcodes for quick scanning resolution
CREATE INDEX IF NOT EXISTS idx_product_barcodes_val ON public.product_barcodes(barcode_value);

-- Enable RLS
ALTER TABLE public.barcode_audit_logs ENABLE ROW LEVEL SECURITY;

-- Select policy: company members can view barcode audit logs
CREATE POLICY "Company members can view barcode audit logs"
  ON public.barcode_audit_logs
  FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  ));

-- Insert policy: strictly restricted to Purchase Manager, Admin, and Owner
CREATE POLICY "Authorized purchase roles can record barcode audit logs"
  ON public.barcode_audit_logs
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('Purchase Manager', 'Owner', 'Admin')
    )
  );
