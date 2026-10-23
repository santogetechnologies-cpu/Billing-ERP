-- ==============================================================================
-- Migration 017: Concurrency-Safe Payment Generation & POS Idempotency
-- ==============================================================================
-- Fixes: POS Checkout duplicate key value violates unique constraint "payments_company_id_payment_number_key"
-- Guarantees:
-- 1. Idempotent payment recording: If a payment already exists for an invoice, it returns the existing record.
-- 2. Concurrency-safe atomic sequence generation using public.get_next_sequence().
-- 3. Overloaded RPC signatures to support both JSONB payload and flat parameter invocation.
-- 4. Preserves the UNIQUE(company_id, payment_number) constraint on public.payments.

-- 1. Overloaded public.record_payment_atomic(p_payment_json JSONB) with Idempotency Guard
CREATE OR REPLACE FUNCTION public.record_payment_atomic(p_payment_json JSONB)
RETURNS JSONB AS $$
DECLARE
  v_company_id UUID;
  v_payment_id UUID;
  v_payment_number VARCHAR;
  v_type VARCHAR;
  v_party_type VARCHAR;
  v_party_id UUID;
  v_party_name VARCHAR;
  v_amount NUMERIC(15, 2);
  v_method VARCHAR;
  v_account_name VARCHAR;
  v_invoice_id UUID;
  v_journal_id UUID;
  v_cash_bank_account_id UUID;
  v_sub_account_id UUID;
  v_existing_id UUID;
  v_existing_number VARCHAR;
BEGIN
  v_company_id := (p_payment_json->>'company_id')::UUID;
  v_type := COALESCE(p_payment_json->>'type', 'Received');
  v_party_type := COALESCE(p_payment_json->>'party_type', 'Customer');
  v_party_id := (p_payment_json->>'party_id')::UUID;
  v_party_name := COALESCE(p_payment_json->>'party_name', 'Party');
  v_amount := COALESCE((p_payment_json->>'amount')::NUMERIC, 0);
  v_method := COALESCE(p_payment_json->>'payment_method', 'Cash');
  v_account_name := COALESCE(p_payment_json->>'account_name', 'Main Cash Drawer');
  v_invoice_id := (p_payment_json->>'invoice_id')::UUID;

  -- 1. Idempotency Check: If invoice_id is specified, verify if payment already exists
  IF v_invoice_id IS NOT NULL THEN
    SELECT id, payment_number INTO v_existing_id, v_existing_number
    FROM public.payments
    WHERE company_id = v_company_id AND invoice_id = v_invoice_id
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'already_recorded', true,
        'payment_id', v_existing_id,
        'id', v_existing_id,
        'payment_number', v_existing_number,
        'amount', v_amount
      );
    END IF;
  END IF;

  -- 2. Concurrency-Safe Sequence Generation
  IF p_payment_json->>'payment_number' IS NOT NULL AND length(p_payment_json->>'payment_number') > 0 THEN
    v_payment_number := p_payment_json->>'payment_number';
  ELSE
    v_payment_number := public.get_next_sequence(
      v_company_id,
      CASE WHEN v_type = 'Received' THEN 'receipts' ELSE 'payments' END
    );
  END IF;

  -- 3. Insert Payment Record
  INSERT INTO public.payments (
    company_id, payment_number, type, party_type, party_id, party_name,
    amount, date, payment_method, account_name, account, reference, notes, invoice_id
  ) VALUES (
    v_company_id, v_payment_number, v_type, v_party_type, v_party_id, v_party_name,
    v_amount, COALESCE((p_payment_json->>'date')::DATE, CURRENT_DATE),
    v_method, v_account_name, v_account_name,
    p_payment_json->>'reference', p_payment_json->>'notes',
    v_invoice_id
  ) RETURNING id INTO v_payment_id;

  -- 4. Update Outstanding Balances
  IF v_type = 'Received' AND v_party_type = 'Customer' AND v_party_id IS NOT NULL THEN
    UPDATE public.customers
    SET
      current_outstanding = GREATEST(0, current_outstanding - v_amount),
      total_paid = total_paid + v_amount,
      updated_at = NOW()
    WHERE id = v_party_id;
  ELSIF v_type = 'Paid' AND v_party_type = 'Supplier' AND v_party_id IS NOT NULL THEN
    UPDATE public.suppliers
    SET
      current_outstanding = GREATEST(0, current_outstanding - v_amount),
      total_paid = total_paid + v_amount,
      updated_at = NOW()
    WHERE id = v_party_id;
  END IF;

  -- 5. Double-Entry Accounting Journal
  IF v_method = 'Cash' THEN
    SELECT id INTO v_cash_bank_account_id FROM public.accounts WHERE company_id = v_company_id AND (code = '1010' OR name ILIKE '%Cash%') LIMIT 1;
  ELSE
    SELECT id INTO v_cash_bank_account_id FROM public.accounts WHERE company_id = v_company_id AND (code = '1020' OR name ILIKE '%Bank%') LIMIT 1;
  END IF;

  IF v_type = 'Received' THEN
    SELECT id INTO v_sub_account_id FROM public.accounts WHERE company_id = v_company_id AND (code = '1040' OR name ILIKE '%Receivable%') LIMIT 1;
    IF v_cash_bank_account_id IS NOT NULL AND v_sub_account_id IS NOT NULL THEN
      INSERT INTO public.journal_entries (
        company_id, entry_number, date, entry_date, description, narration, reference_type, reference_id, total_debit, total_credit
      ) VALUES (
        v_company_id, 'JV-' || v_payment_number, CURRENT_DATE, CURRENT_DATE,
        'Payment received from ' || v_party_name, 'Customer settlement', 'Receipt', v_payment_id, v_amount, v_amount
      ) RETURNING id INTO v_journal_id;

      INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, account_code, account_name, debit, credit, narration)
      VALUES (v_journal_id, v_cash_bank_account_id, '1010', 'Cash / Bank', v_amount, 0.00, 'Funds Inflow');

      INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, account_code, account_name, debit, credit, narration)
      VALUES (v_journal_id, v_sub_account_id, '1040', 'Accounts Receivable', 0.00, v_amount, 'Receivable cleared');
    END IF;
  ELSE
    SELECT id INTO v_sub_account_id FROM public.accounts WHERE company_id = v_company_id AND (code = '2010' OR name ILIKE '%Payable%') LIMIT 1;
    IF v_cash_bank_account_id IS NOT NULL AND v_sub_account_id IS NOT NULL THEN
      INSERT INTO public.journal_entries (
        company_id, entry_number, date, entry_date, description, narration, reference_type, reference_id, total_debit, total_credit
      ) VALUES (
        v_company_id, 'JV-' || v_payment_number, CURRENT_DATE, CURRENT_DATE,
        'Payment made to ' || v_party_name, 'Supplier settlement', 'Payment', v_payment_id, v_amount, v_amount
      ) RETURNING id INTO v_journal_id;

      INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, account_code, account_name, debit, credit, narration)
      VALUES (v_journal_id, v_sub_account_id, '2010', 'Accounts Payable', v_amount, 0.00, 'Payable cleared');

      INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, account_code, account_name, debit, credit, narration)
      VALUES (v_journal_id, v_cash_bank_account_id, '1010', 'Cash / Bank', 0.00, v_amount, 'Funds Outflow');
    END IF;
  END IF;

  -- 6. Audit Log
  INSERT INTO public.audit_logs (
    company_id, user_name, action, module, record, old_value, new_value, date, time
  ) VALUES (
    v_company_id, COALESCE(p_payment_json->>'user_name', 'System User'),
    'Recorded ' || v_type, 'Payments', v_payment_number, 'Pending',
    'Settlement: ₹' || v_amount::text || ' (' || v_party_name || ')',
    CURRENT_DATE, TO_CHAR(NOW(), 'HH12:MI AM')
  );

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'id', v_payment_id,
    'payment_number', v_payment_number,
    'amount', v_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Flat Parameter Overload for public.record_payment_atomic
-- Prevents RPC failure if called with individual parameters instead of p_payment_json
CREATE OR REPLACE FUNCTION public.record_payment_atomic(
  p_company_id UUID,
  p_type VARCHAR DEFAULT 'Received',
  p_party_type VARCHAR DEFAULT 'Customer',
  p_party_id UUID DEFAULT NULL,
  p_party_name VARCHAR DEFAULT 'Party',
  p_amount NUMERIC DEFAULT 0,
  p_date DATE DEFAULT CURRENT_DATE,
  p_payment_method VARCHAR DEFAULT 'Cash',
  p_account VARCHAR DEFAULT 'Main Cash Drawer',
  p_reference VARCHAR DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_invoice_id UUID DEFAULT NULL,
  p_payment_number VARCHAR DEFAULT NULL
)
RETURNS JSONB AS $$
BEGIN
  RETURN public.record_payment_atomic(
    jsonb_build_object(
      'company_id', p_company_id,
      'type', p_type,
      'party_type', p_party_type,
      'party_id', p_party_id,
      'party_name', p_party_name,
      'amount', p_amount,
      'date', p_date,
      'payment_method', p_payment_method,
      'account_name', p_account,
      'reference', p_reference,
      'notes', p_notes,
      'invoice_id', p_invoice_id,
      'payment_number', p_payment_number
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
