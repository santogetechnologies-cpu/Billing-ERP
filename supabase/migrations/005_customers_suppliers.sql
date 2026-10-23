-- Migration 005: Customers & Suppliers Masters

CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  customer_type VARCHAR(50) DEFAULT 'Retail', -- 'Retail', 'Wholesale', 'Corporate', 'Dealer', 'Distributor'
  phone VARCHAR(50),
  email VARCHAR(150),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100) DEFAULT 'India',
  pincode VARCHAR(20),
  gstin VARCHAR(50),
  pan VARCHAR(50),
  credit_limit NUMERIC(15, 2) DEFAULT 0.00,
  credit_days INT DEFAULT 30,
  opening_balance NUMERIC(15, 2) DEFAULT 0.00,
  current_outstanding NUMERIC(15, 2) DEFAULT 0.00,
  total_purchased NUMERIC(15, 2) DEFAULT 0.00,
  total_paid NUMERIC(15, 2) DEFAULT 0.00,
  price_tier VARCHAR(50) DEFAULT 'retail',
  notes TEXT,
  status VARCHAR(20) DEFAULT 'Active', -- 'Active', 'Inactive', 'Blocked'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  company VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(150),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100) DEFAULT 'India',
  pincode VARCHAR(20),
  gstin VARCHAR(50),
  pan VARCHAR(50),
  credit_days INT DEFAULT 30,
  opening_balance NUMERIC(15, 2) DEFAULT 0.00,
  current_outstanding NUMERIC(15, 2) DEFAULT 0.00,
  total_purchases NUMERIC(15, 2) DEFAULT 0.00,
  total_paid NUMERIC(15, 2) DEFAULT 0.00,
  bank_name VARCHAR(150),
  account_number VARCHAR(100),
  ifsc_code VARCHAR(50),
  notes TEXT,
  status VARCHAR(20) DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customers_company ON public.customers(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_gstin ON public.customers(gstin);
CREATE INDEX IF NOT EXISTS idx_suppliers_company ON public.suppliers(company_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_phone ON public.suppliers(phone);
