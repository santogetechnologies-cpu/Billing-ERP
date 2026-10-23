-- Migration 019: Manual Stock Warning Limit and Inventory Status Notifications
-- Allows manual minimum stock threshold per product, with NULL representing "Not Set"

-- 1. Ensure products.reorder_level does not silently assign a default of 10.00 for new products without a configured limit
ALTER TABLE public.products ALTER COLUMN reorder_level DROP DEFAULT;

-- 2. Ensure notifications table has compatible columns and indexes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'is_read'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN is_read BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'read'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN read BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- 3. Helpful indexes for stock queries and notifications
CREATE INDEX IF NOT EXISTS idx_products_reorder_level ON public.products(reorder_level);
CREATE INDEX IF NOT EXISTS idx_notifications_company_read ON public.notifications(company_id, is_read);
