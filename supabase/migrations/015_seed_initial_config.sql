-- Migration 015: Master Root Company & Warehouse Baseline Config
INSERT INTO public.companies (
  id, name, business_type, address, city, state, country, pincode,
  currency, currency_symbol, terms_conditions
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Universal ERP Enterprise',
  'Trading & Distribution',
  'Industrial Area Phase 2',
  'Mumbai',
  'Maharashtra',
  'India',
  '400001',
  'INR',
  '₹',
  'Goods once sold are subject to standard company warranty and terms.'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  currency = EXCLUDED.currency,
  currency_symbol = EXCLUDED.currency_symbol;

INSERT INTO public.warehouses (
  id, company_id, name, code, is_default, address
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Main Central Warehouse',
  'WH-MAIN',
  true,
  'Central Hub, Bay 1'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_units (company_id, name, symbol, is_base)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Piece', 'Pcs', true),
  ('00000000-0000-0000-0000-000000000001', 'Box', 'Box', false),
  ('00000000-0000-0000-0000-000000000001', 'Bag', 'Bag', false),
  ('00000000-0000-0000-0000-000000000001', 'Kilogram', 'Kg', true),
  ('00000000-0000-0000-0000-000000000001', 'Meter', 'm', true)
ON CONFLICT DO NOTHING;


