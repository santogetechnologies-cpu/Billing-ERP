import { supabase } from '../lib/supabase';
import { Account } from '../types';
import { assertCallerPermission } from '../utils/rbac';

export interface JournalEntryLine {
  id?: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  narration?: string;
}

export interface JournalEntry {
  id: string;
  entryNumber: string;
  date: string;
  narration: string;
  referenceType?: string;
  referenceId?: string;
  totalDebit: number;
  totalCredit: number;
  lines: JournalEntryLine[];
  createdAt: string;
}

export interface TrialBalanceItem {
  id: string;
  code: string;
  name: string;
  category: string;
  subCategory?: string;
  openingDr: number;
  openingCr: number;
  periodDr: number;
  periodCr: number;
  closingDr: number;
  closingCr: number;
}

export const accountingService = {
  async getAccounts(companyId?: string): Promise<Account[]> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('company_id', finalCompanyId)
        .order('code');

      if (error || !data || data.length === 0) {
        return [];
      }

      return data.map((d: any) => ({
        id: d.id,
        code: d.code,
        name: d.name,
        category: d.category,
        subCategory: d.subcategory || d.sub_category || '',
        balance: Number(d.balance || 0),
        isDebit: (d.balance_type || 'Debit') === 'Debit'
      }));
    } catch (err) {
      console.error('Failed to get accounts:', err);
      return [];
    }
  },

  async createAccount(account: Omit<Account, 'id'>, companyId?: string): Promise<Account> {
    // 0. Strict RBAC Enforcement: Only Accountant, Admin, and Owner can create accounts
    await assertCallerPermission('accounting', 'create');

    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const payload = {
      company_id: finalCompanyId,
      code: account.code,
      name: account.name,
      category: account.category,
      subcategory: account.subCategory,
      sub_category: account.subCategory,
      balance: account.balance,
      balance_type: account.isDebit ? 'Debit' : 'Credit',
      is_system: false
    };

    const { data, error } = await supabase
      .from('accounts')
      .insert(payload)
      .select()
      .single();

    if (error || !data) {
      console.error('Failed to insert account in Supabase:', error?.message);
      throw new Error(`Failed to create account: ${error?.message || 'Database insert error'}`);
    }

    return {
      id: data.id,
      code: data.code,
      name: data.name,
      category: data.category,
      subCategory: data.subcategory || data.sub_category,
      balance: Number(data.balance),
      isDebit: (data.balance_type || 'Debit') === 'Debit'
    };
  },

  async getJournalEntries(startDate?: string, endDate?: string, companyId?: string): Promise<JournalEntry[]> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    try {
      let query = supabase
        .from('journal_entries')
        .select(`
          id, entry_number, entry_date, narration, reference_type, reference_id, total_debit, total_credit, created_at,
          journal_entry_lines (
            id, account_id, account_code, account_name, debit, credit, narration
          )
        `)
        .eq('company_id', finalCompanyId)
        .order('entry_date', { ascending: false });

      if (startDate) query = query.gte('entry_date', startDate);
      if (endDate) query = query.lte('entry_date', endDate);

      const { data, error } = await query;
      if (error || !data) return [];

      return data.map((row: any) => ({
        id: row.id,
        entryNumber: row.entry_number,
        date: row.entry_date,
        narration: row.narration || '',
        referenceType: row.reference_type,
        referenceId: row.reference_id,
        totalDebit: Number(row.total_debit || 0),
        totalCredit: Number(row.total_credit || 0),
        createdAt: row.created_at,
        lines: (row.journal_entry_lines || []).map((l: any) => ({
          id: l.id,
          accountId: l.account_id,
          accountCode: l.account_code,
          accountName: l.account_name,
          debit: Number(l.debit || 0),
          credit: Number(l.credit || 0),
          narration: l.narration
        }))
      }));
    } catch (err) {
      console.error('Failed to get journal entries:', err);
      return [];
    }
  },

  async createJournalEntry(entry: {
    date: string;
    narration: string;
    referenceType?: string;
    referenceId?: string;
    lines: { accountId: string; accountCode: string; accountName: string; debit: number; credit: number; narration?: string }[];
  }, companyId?: string): Promise<JournalEntry> {
    // 0. Strict RBAC Enforcement: Only Accountant, Admin, and Owner can create journal entries
    await assertCallerPermission('accounting', 'create');

    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const totalDebit = entry.lines.reduce((acc, l) => acc + (l.debit || 0), 0);
    const totalCredit = entry.lines.reduce((acc, l) => acc + (l.credit || 0), 0);

    // Prompt #27: Double Entry Accounting Check - Debit MUST equal Credit
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`Double-entry unbalance: Total Debits (₹${totalDebit.toFixed(2)}) must equal Total Credits (₹${totalCredit.toFixed(2)})`);
    }

    const entryNumber = 'JV-' + new Date().toISOString().replace(/\D/g, '').slice(2, 10);

    const { data: header, error: headerError } = await supabase
      .from('journal_entries')
      .insert({
        company_id: finalCompanyId,
        entry_number: entryNumber,
        entry_date: entry.date,
        narration: entry.narration,
        reference_type: entry.referenceType,
        reference_id: entry.referenceId,
        total_debit: totalDebit,
        total_credit: totalCredit
      })
      .select()
      .single();

    if (headerError || !header) {
      console.error('Failed to insert journal entry header:', headerError?.message);
      throw new Error(`Failed to record journal voucher: ${headerError?.message || 'Database error'}`);
    }

    const linesPayload = entry.lines.map(l => ({
      journal_entry_id: header.id,
      account_id: l.accountId,
      account_code: l.accountCode,
      account_name: l.accountName,
      debit: l.debit,
      credit: l.credit,
      narration: l.narration || entry.narration
    }));

    const { error: linesError } = await supabase.from('journal_entry_lines').insert(linesPayload);
    if (linesError) {
      console.error('Failed to insert journal entry lines:', linesError.message);
      throw new Error(`Failed to insert journal lines: ${linesError.message}`);
    }

    return {
      id: header.id,
      entryNumber: header.entry_number,
      date: header.entry_date,
      narration: header.narration,
      referenceType: header.reference_type,
      referenceId: header.reference_id,
      totalDebit: Number(header.total_debit),
      totalCredit: Number(header.total_credit),
      createdAt: header.created_at,
      lines: entry.lines
    };
  },

  async getTrialBalance(companyId?: string): Promise<TrialBalanceItem[]> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const accounts = await this.getAccounts(finalCompanyId);

    // Fetch all lines
    const { data: lines } = await supabase
      .from('journal_entry_lines')
      .select('account_id, debit, credit');

    const movementsByAccount: Record<string, { dr: number; cr: number }> = {};
    (lines || []).forEach((l: any) => {
      if (!movementsByAccount[l.account_id]) {
        movementsByAccount[l.account_id] = { dr: 0, cr: 0 };
      }
      movementsByAccount[l.account_id].dr += Number(l.debit || 0);
      movementsByAccount[l.account_id].cr += Number(l.credit || 0);
    });

    return accounts.map(acc => {
      const isDebitAcc = acc.category === 'Assets' || acc.category === 'Expenses';
      const m = movementsByAccount[acc.id] || { dr: 0, cr: 0 };
      
      const periodDr = m.dr;
      const periodCr = m.cr;
      
      // Calculate genuine net balance
      const netMovement = isDebitAcc ? (periodDr - periodCr) : (periodCr - periodDr);
      const totalBalance = (acc.balance || 0) + (m.dr > 0 || m.cr > 0 ? netMovement : 0);
      
      const closingDr = isDebitAcc ? Math.max(0, totalBalance) : (totalBalance < 0 ? Math.abs(totalBalance) : 0);
      const closingCr = !isDebitAcc ? Math.max(0, totalBalance) : (totalBalance < 0 ? Math.abs(totalBalance) : 0);

      return {
        id: acc.id,
        code: acc.code,
        name: acc.name,
        category: acc.category,
        subCategory: acc.subCategory,
        openingDr: isDebitAcc ? (acc.balance || 0) : 0,
        openingCr: !isDebitAcc ? (acc.balance || 0) : 0,
        periodDr,
        periodCr,
        closingDr,
        closingCr
      };
    });
  }
};
