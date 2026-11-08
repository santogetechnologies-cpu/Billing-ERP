-- 041_customer_return_complaints_and_photos.sql
-- Add purchase_date, return_problem, complaint_description, and photos columns to customer_returns table

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customer_returns' AND column_name = 'purchase_date') THEN
        ALTER TABLE public.customer_returns ADD COLUMN purchase_date DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customer_returns' AND column_name = 'return_problem') THEN
        ALTER TABLE public.customer_returns ADD COLUMN return_problem VARCHAR(100);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customer_returns' AND column_name = 'complaint_description') THEN
        ALTER TABLE public.customer_returns ADD COLUMN complaint_description TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customer_returns' AND column_name = 'photos') THEN
        ALTER TABLE public.customer_returns ADD COLUMN photos JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- Performance index for return problems
CREATE INDEX IF NOT EXISTS idx_customer_returns_problem ON public.customer_returns(return_problem);

