-- Migration 009: Expenses, Cash/Bank Accounts & Unified Payments

CREATE TABLE IF NOT EXISTS public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  code VARCHAR(50),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, name)
);

CREATE TABLE IF NOT EXISTS public.cash_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL, -- 'Main Cash Drawer', 'Petty Cash Float', 'POS Counter Cash'
  opening_balance NUMERIC(15, 2) DEFAULT 0.00,
  current_balance NUMERIC(15, 2) DEFAULT 0.00,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, name)
);

CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  bank_name VARCHAR(150) NOT NULL,
  account_name VARCHAR(150) NOT NULL,
  account_number VARCHAR(100) NOT NULL,
  ifsc VARCHAR(50),
  opening_balance NUMERIC(15, 2) DEFAULT 0.00,
  current_balance NUMERIC(15, 2) DEFAULT 0.00,
  reconciled_balance NUMERIC(15, 2) DEFAULT 0.00,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, account_number)
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  category_name VARCHAR(150) NOT NULL,
  amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  tax NUMERIC(15, 2) DEFAULT 0.00,
  vendor VARCHAR(255) NOT NULL,
  payment_account VARCHAR(150) NOT NULL,
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  cash_account_id UUID REFERENCES public.cash_accounts(id) ON DELETE SET NULL,
  description TEXT,
  attachment_url TEXT,
  cost_centre VARCHAR(100) DEFAULT 'General',
  reference_no VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  payment_number VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'Received' (from customer) or 'Paid' (to supplier)
  party_type VARCHAR(50) NOT NULL, -- 'Customer' or 'Supplier'
  party_id UUID,
  party_name VARCHAR(255) NOT NULL,
  amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method VARCHAR(50) DEFAULT 'Cash', -- 'Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card'
  account_name VARCHAR(150),
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  cash_account_id UUID REFERENCES public.cash_accounts(id) ON DELETE SET NULL,
  reference VARCHAR(100),
  notes TEXT,
  invoice_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, payment_number)
);

CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL,
  invoice_number VARCHAR(100),
  allocated_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_expenses_company ON public.expenses(company_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date);
CREATE INDEX IF NOT EXISTS idx_payments_company ON public.payments(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_party ON public.payments(party_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON public.payments(date);
