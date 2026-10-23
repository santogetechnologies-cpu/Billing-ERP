import { supabase } from '../lib/supabase';
import { PaymentRecord, BankAccount, CashAccount } from '../types';
import { assertCallerPermission } from '../utils/rbac';

export const paymentService = {
  async getPayments(filters?: { type?: 'Received' | 'Paid'; partyId?: string; startDate?: string; endDate?: string }, companyId?: string): Promise<PaymentRecord[]> {
    try {
      const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
      let query = supabase
        .from('payments')
        .select('*')
        .eq('company_id', finalCompanyId)
        .order('date', { ascending: false });

      if (filters?.type) {
        query = query.eq('type', filters.type);
      }
      if (filters?.partyId) {
        query = query.eq('party_id', filters.partyId);
      }
      if (filters?.startDate) {
        query = query.gte('date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('date', filters.endDate);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('Supabase payments query warning:', error.message);
        return [];
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        paymentNumber: row.payment_number,
        type: row.type as 'Received' | 'Paid',
        partyType: row.party_type as 'Customer' | 'Supplier',
        partyId: row.party_id,
        partyName: row.party_name,
        amount: Number(row.amount || 0),
        date: row.date || row.payment_date || (row.created_at ? row.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
        paymentMethod: row.payment_method || 'Cash',
        account: row.account_name || row.account || '',
        reference: row.reference || '',
        notes: row.notes || '',
        invoiceId: row.invoice_id || undefined,
        createdAt: row.created_at
      }));
    } catch (err) {
      console.error('Failed to get payments:', err);
      return [];
    }
  },

  async recordPayment(
    payment: Omit<PaymentRecord, 'id' | 'createdAt' | 'paymentNumber'> & { paymentNumber?: string },
    companyId?: string
  ): Promise<PaymentRecord> {
    // 0. Strict RBAC Enforcement: Caller must have 'payments:create' permission
    await assertCallerPermission('payments', 'create');

    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';

    // 1. Idempotency & Safe Retry Check:
    // If this payment is linked to an invoice, check if a payment record was already created
    // (e.g. by public.create_sales_invoice_atomic in PostgreSQL or a retried checkout request).
    if (payment.invoiceId) {
      try {
        const { data: existingPay, error: existErr } = await supabase
          .from('payments')
          .select('*')
          .eq('company_id', finalCompanyId)
          .eq('invoice_id', payment.invoiceId)
          .maybeSingle();

        if (!existErr && existingPay) {
          console.log(`[PaymentService] Existing payment found for invoice ${payment.invoiceId}: ${existingPay.payment_number} (Company: ${finalCompanyId})`);
          return {
            id: existingPay.id,
            paymentNumber: existingPay.payment_number,
            type: existingPay.type as 'Received' | 'Paid',
            partyType: existingPay.party_type as 'Customer' | 'Supplier',
            partyId: existingPay.party_id,
            partyName: existingPay.party_name,
            amount: Number(existingPay.amount || 0),
            date: existingPay.date || existingPay.payment_date || (existingPay.created_at ? existingPay.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
            paymentMethod: existingPay.payment_method || 'Cash',
            account: existingPay.account_name || existingPay.account || '',
            reference: existingPay.reference || '',
            notes: existingPay.notes || '',
            invoiceId: existingPay.invoice_id,
            createdAt: existingPay.created_at
          };
        }
      } catch (err) {
        console.warn('[PaymentService] Error checking existing payment for invoice:', err);
      }
    }

    // 2. Try Atomic RPC (PostgreSQL stored procedure: public.record_payment_atomic(p_payment_json JSONB))
    try {
      const rpcPayload: Record<string, any> = {
        company_id: finalCompanyId,
        type: payment.type,
        party_type: payment.partyType,
        party_id: payment.partyId || null,
        party_name: payment.partyName,
        amount: payment.amount,
        date: payment.date || new Date().toISOString().split('T')[0],
        payment_method: payment.paymentMethod || 'Cash',
        account_name: payment.account || 'Main Cash Drawer',
        reference: payment.reference || null,
        notes: payment.notes || null,
        invoice_id: payment.invoiceId || null
      };

      if (payment.paymentNumber && payment.paymentNumber.trim().length > 0) {
        rpcPayload.payment_number = payment.paymentNumber.trim();
      }

      console.log(`[PaymentService RPC] Calling record_payment_atomic for company: ${finalCompanyId}, type: ${payment.type}, amount: ${payment.amount}`);
      const { data: rpcResult, error: rpcError } = await supabase.rpc('record_payment_atomic', {
        p_payment_json: rpcPayload
      });

      let parsedRpc: any = rpcResult;
      if (typeof parsedRpc === 'string') {
        try {
          parsedRpc = JSON.parse(parsedRpc);
        } catch {
          // not json string
        }
      }

      if (!rpcError && parsedRpc && (parsedRpc.success || parsedRpc.payment_id || parsedRpc.id)) {
        const payId = parsedRpc.payment_id || parsedRpc.id;
        const assignedNumber = parsedRpc.payment_number || payment.paymentNumber;
        console.log(`[PaymentService RPC] Successfully recorded payment ${assignedNumber} (ID: ${payId})`);
        return {
          id: payId,
          paymentNumber: assignedNumber,
          type: payment.type,
          partyType: payment.partyType,
          partyId: payment.partyId,
          partyName: payment.partyName,
          amount: payment.amount,
          date: payment.date || new Date().toISOString().split('T')[0],
          paymentMethod: payment.paymentMethod,
          account: payment.account,
          reference: payment.reference,
          notes: payment.notes,
          invoiceId: payment.invoiceId,
          createdAt: parsedRpc.created_at || new Date().toISOString()
        };
      }

      if (rpcError) {
        console.warn('[PaymentService RPC Warning] record_payment_atomic error, proceeding to direct fallback:', rpcError.message);
      }
    } catch (e: any) {
      console.warn('[PaymentService RPC Warning] record_payment_atomic exception, using direct fallback:', e?.message || e);
    }

    // 3. Direct Fallback Insertion with Concurrency-Safe Database Sequence & Retry Loop
    const docType = payment.type === 'Received' ? 'receipts' : 'payments';
    const prefix = payment.type === 'Received' ? 'REC-' : 'PAY-';
    const maxRetries = 3;
    let finalPaymentNumber = payment.paymentNumber?.trim() || '';
    let insertedRow: any = null;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // If paymentNumber is not set or retrying due to collision:
      if (!finalPaymentNumber || attempt > 1) {
        // A. Attempt database sequence generation via get_next_sequence RPC
        let seqGenerated = false;
        try {
          const { data: seqData, error: seqErr } = await supabase.rpc('get_next_sequence', {
            p_company_id: finalCompanyId,
            p_doc_type: docType
          });
          if (!seqErr && seqData && typeof seqData === 'string') {
            finalPaymentNumber = seqData;
            seqGenerated = true;
          }
        } catch {
          // sequence rpc unavailable
        }

        // B. If get_next_sequence failed, query max existing payment number from DB
        if (!seqGenerated) {
          try {
            const { data: existingRows } = await supabase
              .from('payments')
              .select('payment_number')
              .eq('company_id', finalCompanyId)
              .ilike('payment_number', `${prefix}%`)
              .order('created_at', { ascending: false })
              .limit(20);

            let maxSeq = 1000;
            if (existingRows && existingRows.length > 0) {
              for (const row of existingRows) {
                const match = (row.payment_number || '').match(/(\d+)$/);
                if (match && match[1]) {
                  const val = parseInt(match[1], 10);
                  if (!isNaN(val) && val > maxSeq) maxSeq = val;
                }
              }
            }
            finalPaymentNumber = `${prefix}${maxSeq + attempt}`;
          } catch {
            // High-entropy fallback ensuring uniqueness
            finalPaymentNumber = `${prefix}${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
          }
        }
      }

      console.log(`[PaymentService Direct Insert Attempt ${attempt}/${maxRetries}] Company: ${finalCompanyId}, Payment Number: ${finalPaymentNumber}`);

      const { data, error } = await supabase
        .from('payments')
        .insert({
          company_id: finalCompanyId,
          payment_number: finalPaymentNumber,
          type: payment.type,
          party_type: payment.partyType,
          party_id: payment.partyId || null,
          party_name: payment.partyName,
          amount: payment.amount,
          date: payment.date || new Date().toISOString().split('T')[0],
          payment_method: payment.paymentMethod,
          account_name: payment.account,
          account: payment.account,
          reference: payment.reference || null,
          notes: payment.notes || null,
          invoice_id: payment.invoiceId || null
        })
        .select()
        .single();

      if (!error && data) {
        insertedRow = data;
        console.log(`[PaymentService Direct Insert] Successfully recorded payment ${data.payment_number} (ID: ${data.id})`);
        break;
      }

      lastError = error;
      const isUniqueCollision = error?.code === '23505' ||
        error?.message?.includes('unique constraint') ||
        error?.message?.includes('duplicate key') ||
        error?.message?.includes('payments_company_id_payment_number_key');

      if (isUniqueCollision) {
        console.warn(`[PaymentService] Unique constraint collision on ${finalPaymentNumber} (Attempt ${attempt}). Retrying with next sequence...`);
        finalPaymentNumber = ''; // Force regeneration in next attempt
        continue;
      } else {
        // Non-collision error, do not retry
        break;
      }
    }

    if (!insertedRow) {
      console.error('[PaymentService Direct Insert Error] Failed to insert payment:', lastError?.message);
      throw new Error(`Failed to record payment: ${lastError?.message || 'Database insert error'}`);
    }

    // Update customer or supplier balances for direct fallback
    if (payment.type === 'Received' && payment.partyType === 'Customer' && payment.partyId) {
      const { data: cust } = await supabase.from('customers').select('current_outstanding, total_paid').eq('id', payment.partyId).single();
      if (cust) {
        await supabase.from('customers').update({
          current_outstanding: Math.max(0, Number(cust.current_outstanding || 0) - payment.amount),
          total_paid: Number(cust.total_paid || 0) + payment.amount
        }).eq('id', payment.partyId);
      }
    } else if (payment.type === 'Paid' && payment.partyType === 'Supplier' && payment.partyId) {
      const { data: sup } = await supabase.from('suppliers').select('current_outstanding, total_paid').eq('id', payment.partyId).single();
      if (sup) {
        await supabase.from('suppliers').update({
          current_outstanding: Math.max(0, Number(sup.current_outstanding || 0) - payment.amount),
          total_paid: Number(sup.total_paid || 0) + payment.amount
        }).eq('id', payment.partyId);
      }
    }

    return {
      id: insertedRow.id,
      paymentNumber: insertedRow.payment_number,
      type: insertedRow.type,
      partyType: insertedRow.party_type,
      partyId: insertedRow.party_id,
      partyName: insertedRow.party_name,
      amount: Number(insertedRow.amount),
      date: insertedRow.date || insertedRow.payment_date,
      paymentMethod: insertedRow.payment_method,
      account: insertedRow.account_name || insertedRow.account,
      reference: insertedRow.reference,
      notes: insertedRow.notes,
      invoiceId: insertedRow.invoice_id,
      createdAt: insertedRow.created_at
    };
  },

  async getCashAccounts(companyId?: string): Promise<CashAccount[]> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const { data, error } = await supabase
      .from('cash_accounts')
      .select('*')
      .eq('company_id', finalCompanyId)
      .order('name');

    if (error || !data || data.length === 0) {
      return [];
    }

    return data.map((d: any) => ({
      id: d.id,
      name: d.name,
      currentBalance: Number(d.current_balance || 0),
      openingBalance: Number(d.opening_balance || 0)
    }));
  },

  async createCashAccount(account: { name: string; openingBalance?: number }, companyId?: string): Promise<CashAccount> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const { data, error } = await supabase
      .from('cash_accounts')
      .insert({
        company_id: finalCompanyId,
        name: account.name,
        opening_balance: account.openingBalance || 0,
        current_balance: account.openingBalance || 0
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create cash account: ${error?.message || 'Database error'}`);
    }

    return {
      id: data.id,
      name: data.name,
      openingBalance: Number(data.opening_balance || 0),
      currentBalance: Number(data.current_balance || 0)
    };
  },

  async getBankAccounts(companyId?: string): Promise<BankAccount[]> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('company_id', finalCompanyId)
      .order('account_name');

    if (error || !data || data.length === 0) {
      return [];
    }

    return data.map((d: any) => ({
      id: d.id,
      bankName: d.bank_name || 'Bank',
      accountName: d.account_name || 'Current A/C',
      accountNumber: d.account_number || '',
      ifsc: d.ifsc_code || d.ifsc || '',
      currentBalance: Number(d.current_balance || 0),
      openingBalance: Number(d.opening_balance || 0),
      reconciledBalance: Number(d.current_balance || 0)
    }));
  },

  async createBankAccount(account: { bankName: string; accountName: string; accountNumber: string; ifsc: string; openingBalance?: number }, companyId?: string): Promise<BankAccount> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const { data, error } = await supabase
      .from('bank_accounts')
      .insert({
        company_id: finalCompanyId,
        bank_name: account.bankName,
        account_name: account.accountName,
        account_number: account.accountNumber,
        ifsc: account.ifsc,
        opening_balance: account.openingBalance || 0,
        current_balance: account.openingBalance || 0
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create bank account: ${error?.message || 'Database error'}`);
    }

    return {
      id: data.id,
      bankName: data.bank_name,
      accountName: data.account_name,
      accountNumber: data.account_number,
      ifsc: data.ifsc || data.ifsc_code || '',
      openingBalance: Number(data.opening_balance || 0),
      currentBalance: Number(data.current_balance || 0),
      reconciledBalance: Number(data.current_balance || 0)
    };
  },

  // Delete payment record with company scope
  async deletePayment(id: string, companyId?: string): Promise<boolean> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const { error } = await supabase
      .from('payments')
      .delete()
      .eq('id', id)
      .eq('company_id', finalCompanyId);

    if (error) {
      throw new Error(`Failed to delete payment: ${error.message}`);
    }
    return true;
  }
};
