-- Migration 042: Product Barcode Type & Manual / Manufacturer Barcode Assignment
-- Supports Auto Generated and Manufacturer / Manual barcode tracking

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS barcode_type VARCHAR(50) DEFAULT 'Auto Generated',
  ADD COLUMN IF NOT EXISTS manufacturer_barcode VARCHAR(100),
  ADD COLUMN IF NOT EXISTS is_manufacturer_barcode_active BOOLEAN DEFAULT FALSE;

-- Optimize queries for product barcode lookups and POS scanning
CREATE INDEX IF NOT EXISTS idx_products_barcode_type ON public.products(barcode_type);
CREATE INDEX IF NOT EXISTS idx_products_manufacturer_barcode ON public.products(manufacturer_barcode);

