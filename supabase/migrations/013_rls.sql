-- Migration 013: Row Level Security (RLS) & Multi-Tenant Company Isolation

-- Helper function to retrieve the active user's company ID
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Enable RLS on all tenant tables
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_barcodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_serial_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 1. Profiles policy (User can view/edit their own profile; can view colleagues in same company)
CREATE POLICY "Users can manage own profile or view company colleagues" ON public.profiles
  FOR ALL TO authenticated
  USING (id = auth.uid() OR company_id = public.get_user_company_id())
  WITH CHECK (id = auth.uid() OR company_id = public.get_user_company_id());

-- 2. Companies policy
CREATE POLICY "Users can access their company" ON public.companies
  FOR ALL TO authenticated
  USING (id = public.get_user_company_id())
  WITH CHECK (id = public.get_user_company_id());

-- 3. Generic tenant isolation policies for core entities
DO $$
DECLARE
  tbl text;
  company_tables text[] := ARRAY[
    'branches', 'warehouses', 'company_settings', 'customers', 'suppliers',
    'product_categories', 'product_brands', 'products', 'product_batches',
    'product_serial_numbers', 'stock_balances', 'stock_transactions',
    'stock_transfers', 'quotations', 'sales_orders', 'sales', 'sales_returns',
    'purchase_orders', 'purchases', 'purchase_returns', 'expense_categories',
    'expenses', 'cash_accounts', 'bank_accounts', 'payments', 'accounts',
    'journal_entries', 'invoice_sequences', 'document_settings', 'audit_logs',
    'notifications'
  ];
BEGIN
  FOREACH tbl IN ARRAY company_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_company_isolation" ON public.%s', tbl, tbl);
    EXECUTE format('CREATE POLICY "%s_company_isolation" ON public.%s FOR ALL TO authenticated USING (company_id = public.get_user_company_id()) WITH CHECK (company_id = public.get_user_company_id())', tbl, tbl);
  END LOOP;
END $$;

-- 4. Shared or Child Table Policies
CREATE POLICY "sales_items_policy" ON public.sales_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sales WHERE sales.id = sales_items.sale_id AND sales.company_id = public.get_user_company_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sales WHERE sales.id = sales_items.sale_id AND sales.company_id = public.get_user_company_id()));

CREATE POLICY "purchase_items_policy" ON public.purchase_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchases WHERE purchases.id = purchase_items.purchase_id AND purchases.company_id = public.get_user_company_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.purchases WHERE purchases.id = purchase_items.purchase_id AND purchases.company_id = public.get_user_company_id()));

CREATE POLICY "journal_entry_lines_policy" ON public.journal_entry_lines
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.journal_entries WHERE journal_entries.id = journal_entry_lines.journal_entry_id AND journal_entries.company_id = public.get_user_company_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.journal_entries WHERE journal_entries.id = journal_entry_lines.journal_entry_id AND journal_entries.company_id = public.get_user_company_id()));

-- Allow reading public/shared reference tables
CREATE POLICY "public_units_select" ON public.product_units FOR SELECT TO authenticated USING (company_id IS NULL OR company_id = public.get_user_company_id());
CREATE POLICY "public_taxes_select" ON public.taxes FOR SELECT TO authenticated USING (company_id IS NULL OR company_id = public.get_user_company_id());
