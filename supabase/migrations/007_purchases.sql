-- Migration 007: Purchases, Orders & Purchase Returns

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
  status VARCHAR(50) DEFAULT 'Draft', -- 'Draft', 'Approved', 'Ordered', 'Received', 'Cancelled'
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

CREATE TABLE IF NOT EXISTS public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  invoice_number VARCHAR(100) NOT NULL,
  doc_type VARCHAR(50) DEFAULT 'purchase_invoice',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name VARCHAR(255) NOT NULL,
  supplier_gstin VARCHAR(50),
  subtotal NUMERIC(15, 2) DEFAULT 0.00,
  tax_total NUMERIC(15, 2) DEFAULT 0.00,
  freight_charges NUMERIC(15, 2) DEFAULT 0.00,
  other_charges NUMERIC(15, 2) DEFAULT 0.00,
  grand_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  paid_amount NUMERIC(15, 2) DEFAULT 0.00,
  payment_status VARCHAR(50) DEFAULT 'Unpaid', -- 'Unpaid', 'Partially Paid', 'Paid'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS public.purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name VARCHAR(255) NOT NULL,
  qty NUMERIC(12, 2) NOT NULL DEFAULT 1.00,
  unit VARCHAR(50) DEFAULT 'Piece',
  rate NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  discount NUMERIC(15, 2) DEFAULT 0.00,
  tax_rate NUMERIC(5, 2) DEFAULT 0.00,
  tax_amt NUMERIC(15, 2) DEFAULT 0.00,
  total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.purchase_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  return_number VARCHAR(100) NOT NULL,
  original_purchase_id UUID REFERENCES public.purchases(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name VARCHAR(255) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  return_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  tax_reversal NUMERIC(15, 2) DEFAULT 0.00,
  status VARCHAR(50) DEFAULT 'Debit Note Issued',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, return_number)
);

CREATE TABLE IF NOT EXISTS public.purchase_return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES public.purchase_returns(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name VARCHAR(255) NOT NULL,
  qty NUMERIC(12, 2) NOT NULL DEFAULT 1.00,
  unit VARCHAR(50) DEFAULT 'Piece',
  rate NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_purchases_company ON public.purchases(company_id);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON public.purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON public.purchases(date);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON public.purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product ON public.purchase_items(product_id);
