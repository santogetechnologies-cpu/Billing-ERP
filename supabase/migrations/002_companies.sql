-- Migration 002: Multi-Tenant Companies, Branches, Warehouses, Settings & Sequences

CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  logo_url TEXT,
  business_type VARCHAR(100) DEFAULT 'Trading',
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100) DEFAULT 'India',
  pincode VARCHAR(20),
  phone VARCHAR(50),
  email VARCHAR(150),
  website VARCHAR(150),
  gstin VARCHAR(50),
  pan VARCHAR(50),
  tax_registration VARCHAR(50),
  currency VARCHAR(10) DEFAULT 'INR',
  currency_symbol VARCHAR(10) DEFAULT '₹',
  financial_year VARCHAR(20),
  invoice_prefix VARCHAR(20) DEFAULT 'INV-',
  invoice_starting_number INT DEFAULT 1,
  bank_name VARCHAR(150),
  account_name VARCHAR(150),
  account_number VARCHAR(100),
  ifsc_code VARCHAR(50),
  upi_id VARCHAR(100),
  terms_conditions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  code VARCHAR(50) NOT NULL,
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(150),
  is_head_office BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  name VARCHAR(150) NOT NULL,
  code VARCHAR(50) NOT NULL,
  address TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS public.company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  primary_color VARCHAR(50) DEFAULT 'blue',
  paper_size VARCHAR(20) DEFAULT 'A4',
  show_logo BOOLEAN DEFAULT TRUE,
  show_qr BOOLEAN DEFAULT TRUE,
  show_bank_details BOOLEAN DEFAULT TRUE,
  show_terms BOOLEAN DEFAULT TRUE,
  auto_generate_sku BOOLEAN DEFAULT TRUE,
  sku_prefix VARCHAR(20) DEFAULT 'SKU',
  default_tax_rate NUMERIC(5,2) DEFAULT 18.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.invoice_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  doc_type VARCHAR(50) NOT NULL, -- 'sales', 'purchases', 'quotations', 'estimates', 'payments', 'expenses', 'transfers'
  prefix VARCHAR(20) NOT NULL,
  starting_number INT DEFAULT 1,
  current_sequence INT DEFAULT 1,
  financial_year VARCHAR(20),
  reset_annually BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, doc_type, financial_year)
);

CREATE TABLE IF NOT EXISTS public.document_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  doc_type VARCHAR(50) NOT NULL,
  title VARCHAR(100),
  header_text TEXT,
  footer_text TEXT,
  terms_conditions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, doc_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_branches_company ON public.branches(company_id);
CREATE INDEX IF NOT EXISTS idx_warehouses_company ON public.warehouses(company_id);
CREATE INDEX IF NOT EXISTS idx_inv_seq_company ON public.invoice_sequences(company_id, doc_type);
