-- Migration 011: GST Tax Slabs & HSN/SAC Master Directory

CREATE TABLE IF NOT EXISTS public.taxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE, -- NULL for default system tax slabs
  name VARCHAR(100) NOT NULL,
  rate NUMERIC(5, 2) NOT NULL,
  cgst NUMERIC(5, 2) NOT NULL,
  sgst NUMERIC(5, 2) NOT NULL,
  igst NUMERIC(5, 2) NOT NULL,
  type VARCHAR(50) DEFAULT 'Regular', -- 'Regular', 'Zero Rated', 'Exempt', 'Custom'
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tax_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hsn_sac VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'Goods', -- 'Goods' or 'Services'
  tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
  category VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(hsn_sac)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_taxes_company ON public.taxes(company_id);
CREATE INDEX IF NOT EXISTS idx_tax_rates_hsn ON public.tax_rates(hsn_sac);
