-- Migration 010: Double-Entry Accounting, Chart of Accounts, Journal Entries & General Ledger

CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL, -- 'Assets', 'Liabilities', 'Equity', 'Income', 'Expenses'
  sub_category VARCHAR(150) NOT NULL,
  subcategory VARCHAR(150),
  balance NUMERIC(15, 2) DEFAULT 0.00,
  is_debit BOOLEAN DEFAULT TRUE,
  balance_type VARCHAR(10) DEFAULT 'Debit',
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  entry_number VARCHAR(100) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  entry_date DATE DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  narration TEXT,
  reference_type VARCHAR(50), -- 'Sale', 'Purchase', 'Payment', 'Receipt', 'Expense', 'Adjustment'
  reference_id UUID,
  total_debit NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  total_credit NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, entry_number)
);

CREATE TABLE IF NOT EXISTS public.journal_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  account_code VARCHAR(50),
  account_name VARCHAR(255) NOT NULL,
  debit NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  credit NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  narration TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_accounts_company ON public.accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_accounts_code ON public.accounts(code);
CREATE INDEX IF NOT EXISTS idx_accounts_category ON public.accounts(category);
CREATE INDEX IF NOT EXISTS idx_journal_entries_company ON public.journal_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON public.journal_entries(date);
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON public.journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON public.journal_entry_lines(account_id);
