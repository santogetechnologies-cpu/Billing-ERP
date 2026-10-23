-- Migration 004: Products, Units, Categories, Brands, Barcodes, Batches & Serials

CREATE TABLE IF NOT EXISTS public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  code VARCHAR(50),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, name)
);

CREATE TABLE IF NOT EXISTS public.product_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, name)
);

CREATE TABLE IF NOT EXISTS public.product_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE, -- NULL for standard built-in units
  name VARCHAR(100) NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  category VARCHAR(50) DEFAULT 'Count',
  is_base BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.unit_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  from_unit_id UUID NOT NULL REFERENCES public.product_units(id) ON DELETE CASCADE,
  to_unit_id UUID NOT NULL REFERENCES public.product_units(id) ON DELETE CASCADE,
  factor NUMERIC(15, 6) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100),
  sku VARCHAR(100) NOT NULL,
  barcode VARCHAR(100),
  category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  category VARCHAR(150) DEFAULT 'General',
  subcategory VARCHAR(150),
  brand_id UUID REFERENCES public.product_brands(id) ON DELETE SET NULL,
  brand VARCHAR(150),
  description TEXT,
  hsn_sac VARCHAR(50),
  hsn VARCHAR(50),
  tax_rate NUMERIC(5, 2) DEFAULT 18.00,
  purchase_price NUMERIC(15, 2) DEFAULT 0.00,
  cost_price NUMERIC(15, 2) DEFAULT 0.00,
  selling_price NUMERIC(15, 2) DEFAULT 0.00,
  wholesale_price NUMERIC(15, 2) DEFAULT 0.00,
  retail_price NUMERIC(15, 2) DEFAULT 0.00,
  dealer_price NUMERIC(15, 2) DEFAULT 0.00,
  mrp NUMERIC(15, 2) DEFAULT 0.00,
  min_selling_price NUMERIC(15, 2) DEFAULT 0.00,
  reorder_level NUMERIC(12, 2) DEFAULT 10.00,
  opening_stock NUMERIC(12, 2) DEFAULT 0.00,
  opening_stock_value NUMERIC(15, 2) DEFAULT 0.00,
  current_stock NUMERIC(12, 2) DEFAULT 0.00,
  primary_unit VARCHAR(50) DEFAULT 'Piece',
  primary_unit_id UUID REFERENCES public.product_units(id) ON DELETE SET NULL,
  secondary_unit VARCHAR(50),
  secondary_unit_id UUID REFERENCES public.product_units(id) ON DELETE SET NULL,
  conversion_factor NUMERIC(12, 4) DEFAULT 1.0,
  default_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  warehouse VARCHAR(150),
  rack VARCHAR(50),
  batch_tracking BOOLEAN DEFAULT FALSE,
  serial_tracking BOOLEAN DEFAULT FALSE,
  expiry_tracking BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, sku)
);

CREATE TABLE IF NOT EXISTS public.product_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tier_name VARCHAR(50) NOT NULL, -- 'retail', 'wholesale', 'dealer', 'special'
  price NUMERIC(15, 2) NOT NULL,
  min_quantity NUMERIC(12, 2) DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.product_barcodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  barcode_type VARCHAR(50) DEFAULT 'Code 128',
  barcode_value VARCHAR(100) NOT NULL,
  is_primary BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.product_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  batch_number VARCHAR(100) NOT NULL,
  mfg_date DATE,
  expiry_date DATE,
  purchase_date DATE,
  cost NUMERIC(15, 2) DEFAULT 0.00,
  qty NUMERIC(12, 2) DEFAULT 0.00,
  status VARCHAR(50) DEFAULT 'Active', -- 'Active', 'Expiring Soon', 'Expired', 'Low Stock'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.product_serial_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  serial_number VARCHAR(150) NOT NULL,
  customer_id UUID,
  customer_name VARCHAR(255),
  invoice_number VARCHAR(100),
  purchase_date DATE,
  warranty_months INT DEFAULT 12,
  warranty_status VARCHAR(50) DEFAULT 'In Stock', -- 'In Stock', 'Active', 'Expired'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, serial_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_company ON public.products(company_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_batches_product ON public.product_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_serials_product ON public.product_serial_numbers(product_id);
