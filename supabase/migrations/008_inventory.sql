-- Migration 008: Multi-Warehouse Inventory, Stock Balances, Transactions & Transfers

CREATE TABLE IF NOT EXISTS public.stock_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(warehouse_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.stock_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  type VARCHAR(50) NOT NULL, -- 'Opening Stock', 'Purchase', 'Sale', 'Sales Return', 'Purchase Return', 'Stock Adjustment', 'Stock Transfer', 'Stock Consumption'
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_name VARCHAR(255) NOT NULL,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  warehouse_to_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  qty NUMERIC(15, 2) NOT NULL, -- positive for inward, negative for outward
  unit VARCHAR(50) DEFAULT 'Piece',
  unit_cost NUMERIC(15, 2) DEFAULT 0.00,
  total_cost NUMERIC(15, 2) DEFAULT 0.00,
  reference_type VARCHAR(50), -- 'Sale', 'Purchase', 'Transfer', 'Adjustment', 'Opening'
  reference_id UUID,
  reference_number VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  transfer_number VARCHAR(100) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  from_warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  to_warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  status VARCHAR(50) DEFAULT 'Requested', -- 'Requested', 'Approved', 'Sent', 'Received'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, transfer_number)
);

CREATE TABLE IF NOT EXISTS public.stock_transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name VARCHAR(255) NOT NULL,
  qty NUMERIC(15, 2) NOT NULL DEFAULT 1.00,
  unit VARCHAR(50) DEFAULT 'Piece',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stock_balances_company ON public.stock_balances(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_balances_warehouse ON public.stock_balances(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_balances_product ON public.stock_balances(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_txns_company ON public.stock_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_txns_product ON public.stock_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_txns_warehouse ON public.stock_transactions(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_txns_date ON public.stock_transactions(date);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_company ON public.stock_transfers(company_id);
