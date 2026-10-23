import { supabase } from '../lib/supabase';
import { Expense } from '../types';

export interface ExpenseFilter {
  category?: string;
  startDate?: string;
  endDate?: string;
  vendor?: string;
  paymentAccount?: string;
}

export const expenseService = {
  async getExpenses(filters?: ExpenseFilter, companyId?: string): Promise<Expense[]> {
    try {
      const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
      let query = supabase
        .from('expenses')
        .select('*')
        .eq('company_id', finalCompanyId)
        .order('date', { ascending: false });

      if (filters?.category && filters.category !== 'All') {
        query = query.or(`category_name.eq.${filters.category},category.eq.${filters.category}`);
      }
      if (filters?.startDate) {
        query = query.gte('date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('date', filters.endDate);
      }
      if (filters?.vendor) {
        query = query.ilike('vendor', `%${filters.vendor}%`);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('Supabase expense query warning:', error.message);
        return [];
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        date: row.date || row.expense_date || (row.created_at ? row.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
        category: (row.category_name || row.category || 'Other') as any,
        amount: Number(row.amount || 0),
        tax: Number(row.tax ?? row.tax_amount ?? 0),
        vendor: row.vendor || 'Unknown',
        paymentAccount: row.payment_account || 'Main Cash Drawer',
        referenceNo: row.reference_no || row.reference_number || undefined,
        description: row.description || '',
        costCentre: row.cost_centre || 'Headquarters',
        receiptUrl: row.attachment_url || row.receipt_url || undefined,
        createdAt: row.created_at
      }));
    } catch (err) {
      console.error('Failed to get expenses:', err);
      return [];
    }
  },

  async uploadReceipt(file: File, companyId?: string): Promise<string> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const fileExt = file.name.split('.').pop();
    const fileName = `${finalCompanyId}/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      console.warn('Failed to upload receipt to Supabase storage:', uploadError.message);
      return '';
    }

    const { data } = supabase.storage.from('receipts').getPublicUrl(fileName);
    return data.publicUrl;
  },

  async createExpense(expense: Omit<Expense, 'id' | 'createdAt'>, companyId?: string): Promise<Expense> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const payload = {
      company_id: finalCompanyId,
      date: expense.date || new Date().toISOString().split('T')[0],
      category_name: expense.category || 'Other',
      category: expense.category || 'Other',
      amount: expense.amount,
      tax: expense.tax || 0,
      vendor: expense.vendor,
      payment_account: expense.paymentAccount || 'Main Cash Drawer',
      reference_no: expense.referenceNo || null,
      description: expense.description || '',
      cost_centre: expense.costCentre || 'Headquarters',
      attachment_url: expense.receiptUrl || null
    };

    const { data, error } = await supabase
      .from('expenses')
      .insert(payload)
      .select()
      .single();

    if (error || !data) {
      console.error('Failed to insert expense into Supabase:', error?.message);
      throw new Error(`Failed to create expense: ${error?.message || 'Database insert error'}`);
    }

    // Deduct cash or bank account balance
    const isCash = (expense.paymentAccount || '').toLowerCase().includes('cash');
    if (isCash) {
      const { data: cashAcc } = await supabase.from('cash_accounts').select('id, current_balance').eq('company_id', finalCompanyId).limit(1).maybeSingle();
      if (cashAcc) {
        await supabase.from('cash_accounts').update({ current_balance: Math.max(0, Number(cashAcc.current_balance || 0) - expense.amount) }).eq('id', cashAcc.id);
      }
    } else {
      const { data: bankAcc } = await supabase.from('bank_accounts').select('id, current_balance').eq('company_id', finalCompanyId).limit(1).maybeSingle();
      if (bankAcc) {
        await supabase.from('bank_accounts').update({ current_balance: Math.max(0, Number(bankAcc.current_balance || 0) - expense.amount) }).eq('id', bankAcc.id);
      }
    }

    return {
      id: data.id,
      date: data.date || data.expense_date,
      category: (data.category_name || data.category || 'Other') as any,
      amount: Number(data.amount),
      tax: Number(data.tax ?? data.tax_amount ?? 0),
      vendor: data.vendor,
      paymentAccount: data.payment_account,
      referenceNo: data.reference_no || data.reference_number,
      description: data.description,
      costCentre: data.cost_centre || 'Headquarters',
      receiptUrl: data.attachment_url || data.receipt_url,
      createdAt: data.created_at
    };
  },

  async deleteExpense(id: string, companyId?: string): Promise<boolean> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id)
      .eq('company_id', finalCompanyId);

    if (error) {
      console.error('Failed to delete expense from Supabase:', error.message);
      throw new Error(`Failed to delete expense: ${error.message}`);
    }
    return true;
  },

  async getExpenseCategories(): Promise<string[]> {
    const { data } = await supabase
      .from('expense_categories')
      .select('name')
      .order('name');

    if (data && data.length > 0) {
      return data.map((d: any) => d.name);
    }

    return [
      'Rent',
      'Electricity',
      'Internet',
      'Telephone',
      'Salary',
      'Transport',
      'Fuel',
      'Maintenance',
      'Marketing',
      'Advertising',
      'Office Supplies',
      'Travel',
      'Food',
      'Bank Charges',
      'Insurance',
      'Professional Fees',
      'Other'
    ];
  }
};
