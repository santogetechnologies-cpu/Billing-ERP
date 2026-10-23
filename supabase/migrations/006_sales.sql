-- Migration 006: Sales Invoices, Quotations, Orders & Returns

CREATE TABLE IF NOT EXISTS public.quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  quotation_number VARCHAR(100) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name VARCHAR(255) NOT NULL,
  subtotal NUMERIC(15, 2) DEFAULT 0.00,
  discount_total NUMERIC(15, 2) DEFAULT 0.00,
  tax_total NUMERIC(15, 2) DEFAULT 0.00,
  grand_total NUMERIC(15, 2) DEFAULT 0.00,
  status VARCHAR(50) DEFAULT 'Draft', -- 'Draft', 'Sent', 'Accepted', 'Rejected', 'Converted'
  notes TEXT,
  terms TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, quotation_number)
);

CREATE TABLE IF NOT EXISTS public.quotation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS public.sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  order_number VARCHAR(100) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date DATE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name VARCHAR(255) NOT NULL,
  subtotal NUMERIC(15, 2) DEFAULT 0.00,
  discount_total NUMERIC(15, 2) DEFAULT 0.00,
  tax_total NUMERIC(15, 2) DEFAULT 0.00,
  grand_total NUMERIC(15, 2) DEFAULT 0.00,
  status VARCHAR(50) DEFAULT 'Pending', -- 'Pending', 'Confirmed', 'Dispatched', 'Delivered', 'Cancelled'
  notes TEXT,
  terms TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, order_number)
);

CREATE TABLE IF NOT EXISTS public.sales_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  invoice_number VARCHAR(100) NOT NULL,
  doc_type VARCHAR(50) DEFAULT 'Tax Invoice', -- 'Tax Invoice', 'Bill of Supply', 'Proforma Invoice', 'Delivery Challan'
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_gstin VARCHAR(50),
  billing_address TEXT,
  shipping_address TEXT,
  subtotal NUMERIC(15, 2) DEFAULT 0.00,
  discount_total NUMERIC(15, 2) DEFAULT 0.00,
  tax_total NUMERIC(15, 2) DEFAULT 0.00,
  cgst_total NUMERIC(15, 2) DEFAULT 0.00,
  sgst_total NUMERIC(15, 2) DEFAULT 0.00,
  igst_total NUMERIC(15, 2) DEFAULT 0.00,
  round_off NUMERIC(8, 2) DEFAULT 0.00,
  grand_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  paid_amount NUMERIC(15, 2) DEFAULT 0.00,
  payment_status VARCHAR(50) DEFAULT 'Unpaid', -- 'Unpaid', 'Partially Paid', 'Paid'
  payment_method VARCHAR(50) DEFAULT 'Cash', -- 'Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque', 'Credit'
  notes TEXT,
  terms TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS public.sales_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name VARCHAR(255) NOT NULL,
  sku VARCHAR(100),
  hsn_sac VARCHAR(50),
  qty NUMERIC(12, 2) NOT NULL DEFAULT 1.00,
  unit VARCHAR(50) DEFAULT 'Piece',
  rate NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  discount_pct NUMERIC(5, 2) DEFAULT 0.00,
  discount_amt NUMERIC(15, 2) DEFAULT 0.00,
  tax_rate NUMERIC(5, 2) DEFAULT 0.00,
  tax_amt NUMERIC(15, 2) DEFAULT 0.00,
  cgst_rate NUMERIC(5, 2) DEFAULT 0.00,
  cgst_amt NUMERIC(15, 2) DEFAULT 0.00,
  sgst_rate NUMERIC(5, 2) DEFAULT 0.00,
  sgst_amt NUMERIC(15, 2) DEFAULT 0.00,
  igst_rate NUMERIC(5, 2) DEFAULT 0.00,
  igst_amt NUMERIC(15, 2) DEFAULT 0.00,
  total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sales_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  return_number VARCHAR(100) NOT NULL,
  original_sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name VARCHAR(255) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  return_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  tax_reversal NUMERIC(15, 2) DEFAULT 0.00,
  refund_status VARCHAR(50) DEFAULT 'Credit Note Issued',
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, return_number)
);

CREATE TABLE IF NOT EXISTS public.sales_return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES public.sales_returns(id) ON DELETE CASCADE,
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sales_company ON public.sales(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON public.sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON public.sales(date);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_num ON public.sales(invoice_number);
CREATE INDEX IF NOT EXISTS idx_sales_items_sale ON public.sales_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sales_items_product ON public.sales_items(product_id);
CREATE INDEX IF NOT EXISTS idx_returns_company ON public.sales_returns(company_id);
