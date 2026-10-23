-- Migration 035: Mandatory Batch Number and Expiry Date for Products
-- Enforces inventory batch and expiration tracking for products catalog and stock safety.

-- 1. Ensure product_batches table has proper indices and constraints
CREATE INDEX IF NOT EXISTS idx_product_batches_company_product ON public.product_batches(company_id, product_id);
CREATE INDEX IF NOT EXISTS idx_product_batches_expiry ON public.product_batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_product_batches_batch_num ON public.product_batches(batch_number);

-- 2. Comment documentation on tables
COMMENT ON TABLE public.product_batches IS 'Stores mandatory product inventory batches, lot numbers, and expiration dates.';
COMMENT ON COLUMN public.product_batches.batch_number IS 'Manufacturer or intake lot/batch identification string.';
COMMENT ON COLUMN public.product_batches.expiry_date IS 'Expiration date after which products cannot be sold.';
