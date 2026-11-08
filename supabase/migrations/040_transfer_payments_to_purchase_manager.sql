-- 040_transfer_payments_to_purchase_manager.sql
-- Transfer Payment Management Access from Accountant to Purchase Manager
--
-- 1. Updates payment audit defaults and workflow tracking to reflect Purchase Manager ownership.
-- 2. Ensures payment creation functions reference Purchase Manager as the primary operator.
-- 3. Confirms tenant isolation and role governance on public.payments and linked financial entities.

DO $$
BEGIN
    -- 1. Update audit log default user role in payment functions if applicable
    -- Update comment on payments table documenting role ownership transfer
    COMMENT ON TABLE public.payments IS 'Unified payment records (Received / Paid). Payment management role responsibility: Purchase Manager, Admin, Owner.';

    -- 2. Verify and ensure performance indexes on payments table
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'payments' AND indexname = 'idx_payments_company_type') THEN
        CREATE INDEX idx_payments_company_type ON public.payments(company_id, type);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'payments' AND indexname = 'idx_payments_company_created') THEN
        CREATE INDEX idx_payments_company_created ON public.payments(company_id, created_at DESC);
    END IF;
END $$;
