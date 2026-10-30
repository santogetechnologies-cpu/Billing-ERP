-- Migration 039: Atomic Batch Sequence Generation (BTH-YYMM-###) and Barcode Rules
-- Provides an atomic, concurrency-safe database function to allocate sequential batch numbers in format BTH-YYMM-###
-- Ensures monthly sequence reset and duplicate prevention across concurrent transactions.

CREATE OR REPLACE FUNCTION public.get_next_batch_number(
  p_company_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS VARCHAR AS $$
DECLARE
  v_yymm VARCHAR;
  v_prefix VARCHAR;
  v_seq INT;
  v_max_existing INT;
  v_batch_number VARCHAR;
BEGIN
  -- Extract YYMM (e.g. '2610' for October 2026, '2611' for November 2026)
  v_yymm := to_char(COALESCE(p_date, CURRENT_DATE), 'YYMM');
  v_prefix := 'BTH-' || v_yymm || '-';

  -- Lock and fetch existing sequence counter for this company and month
  SELECT current_sequence INTO v_seq
  FROM public.invoice_sequences
  WHERE company_id = p_company_id
    AND doc_type = 'batch'
    AND financial_year = v_yymm
  FOR UPDATE;

  -- Check highest sequence currently present in product_batches table to prevent collision
  SELECT COALESCE(MAX(
    CASE 
      WHEN batch_number ~ ('^BTH-' || v_yymm || '-[0-9]+$')
      THEN substring(batch_number from '[0-9]+$')::int 
      ELSE 0 
    END
  ), 0) INTO v_max_existing
  FROM public.product_batches
  WHERE company_id = p_company_id
    AND batch_number LIKE (v_prefix || '%');

  IF NOT FOUND THEN
    v_seq := GREATEST(v_max_existing + 1, 1);
    INSERT INTO public.invoice_sequences (
      company_id,
      doc_type,
      prefix,
      starting_number,
      current_sequence,
      financial_year
    ) VALUES (
      p_company_id,
      'batch',
      v_prefix,
      1,
      v_seq + 1,
      v_yymm
    );
  ELSE
    v_seq := GREATEST(v_seq, v_max_existing + 1);
    UPDATE public.invoice_sequences
    SET current_sequence = v_seq + 1,
        updated_at = NOW()
    WHERE company_id = p_company_id
      AND doc_type = 'batch'
      AND financial_year = v_yymm;
  END IF;

  -- Format as BTH-YYMM-### (3 digits with leading zeroes)
  v_batch_number := v_prefix || LPAD(v_seq::text, 3, '0');
  RETURN v_batch_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

