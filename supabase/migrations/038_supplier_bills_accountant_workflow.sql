-- 038_supplier_bills_accountant_workflow.sql
-- Enables automatic linking of Purchase Requests and Purchase Orders to recorded Supplier Purchase Bills
-- and provides verification status tracking for the Accountant payment review workflow.

DO $$
BEGIN
    -- 1. Add PO and PR linkage columns to purchases table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'purchase_order_id') THEN
        ALTER TABLE public.purchases ADD COLUMN purchase_order_id UUID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'purchase_order_number') THEN
        ALTER TABLE public.purchases ADD COLUMN purchase_order_number TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'purchase_request_id') THEN
        ALTER TABLE public.purchases ADD COLUMN purchase_request_id UUID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'purchase_request_number') THEN
        ALTER TABLE public.purchases ADD COLUMN purchase_request_number TEXT;
    END IF;

    -- 2. Add Accountant Verification Workflow columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'verification_status') THEN
        ALTER TABLE public.purchases ADD COLUMN verification_status TEXT DEFAULT 'Pending Review';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'verified_by') THEN
        ALTER TABLE public.purchases ADD COLUMN verified_by UUID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'verified_by_name') THEN
        ALTER TABLE public.purchases ADD COLUMN verified_by_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'verified_at') THEN
        ALTER TABLE public.purchases ADD COLUMN verified_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'correction_notes') THEN
        ALTER TABLE public.purchases ADD COLUMN correction_notes TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'correction_requested_at') THEN
        ALTER TABLE public.purchases ADD COLUMN correction_requested_at TIMESTAMPTZ;
    END IF;
END $$;

-- 3. Create performance indexes for Accountant dashboard queries
CREATE INDEX IF NOT EXISTS idx_purchases_company_verification ON public.purchases(company_id, verification_status);
CREATE INDEX IF NOT EXISTS idx_purchases_po_id ON public.purchases(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchases_pr_id ON public.purchases(purchase_request_id);

-- 4. Set default verification_status for existing non-return purchases if null
UPDATE public.purchases
SET verification_status = 'Pending Review'
WHERE verification_status IS NULL AND (doc_type IS NULL OR doc_type = 'purchase_invoice');
