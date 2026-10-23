import { supabase } from '../lib/supabase';
import { Supplier } from '../types';

export const supplierService = {
  // Fetch suppliers with search and pagination
  async getSuppliers(params?: { search?: string; page?: number; limit?: number }, companyId?: string): Promise<Supplier[]> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    let query = supabase
      .from('suppliers')
      .select('*')
      .eq('company_id', finalCompanyId)
      .order('name');

    if (params?.search) {
      query = query.or(`name.ilike.%${params.search}%,company.ilike.%${params.search}%,phone.ilike.%${params.search}%`);
    }

    if (params?.page !== undefined && params?.limit !== undefined) {
      const from = (params.page - 1) * params.limit;
      const to = from + params.limit - 1;
      query = query.range(from, to);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Error fetching suppliers from Supabase:', error.message);
      return [];
    }

    return (data || []).map(s => ({
      id: s.id,
      name: s.name,
      company: s.company || '',
      phone: s.phone || '',
      email: s.email || '',
      address: s.address || '',
      gstin: s.gstin || '',
      pan: s.pan || '',
      creditDays: Number(s.credit_days) || 30,
      openingBalance: Number(s.opening_balance) || 0,
      currentOutstanding: Number(s.current_outstanding) || 0,
      totalPurchases: Number(s.total_purchases) || 0,
      totalPaid: Number(s.total_paid) || 0,
      bankDetails: s.bank_name ? {
        bankName: s.bank_name,
        accountNumber: s.account_number || '',
        ifsc: s.ifsc_code || '',
        accountName: s.company || s.name || ''
      } : undefined,
      notes: s.notes,
      status: (s.status as any) || 'Active',
      createdAt: s.created_at
    }));
  },

  // Get supplier by ID
  async getSupplierById(id: string): Promise<Supplier | null> {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      name: data.name,
      company: data.company || '',
      phone: data.phone || '',
      email: data.email || '',
      address: data.address || '',
      gstin: data.gstin || '',
      pan: data.pan || '',
      creditDays: Number(data.credit_days) || 30,
      openingBalance: Number(data.opening_balance) || 0,
      currentOutstanding: Number(data.current_outstanding) || 0,
      totalPurchases: Number(data.total_purchases) || 0,
      totalPaid: Number(data.total_paid) || 0,
      bankDetails: data.bank_name ? {
        bankName: data.bank_name,
        accountNumber: data.account_number || '',
        ifsc: data.ifsc_code || '',
        accountName: data.company || data.name || ''
      } : undefined,
      notes: data.notes,
      status: data.status || 'Active',
      createdAt: data.created_at
    } as Supplier;
  },

  // Create new supplier - throws error if DB fails
  async createSupplier(s: Omit<Supplier, 'id' | 'createdAt' | 'currentOutstanding' | 'totalPurchases' | 'totalPaid'>, companyId?: string): Promise<Supplier> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const dbPayload = {
      company_id: finalCompanyId,
      name: s.name,
      company: s.company || '',
      phone: s.phone || '',
      email: s.email || '',
      address: s.address || '',
      gstin: s.gstin || '',
      pan: s.pan || '',
      credit_days: s.creditDays || 30,
      opening_balance: s.openingBalance || 0,
      current_outstanding: s.openingBalance || 0,
      total_purchases: 0,
      total_paid: 0,
      bank_name: s.bankDetails?.bankName || null,
      account_number: s.bankDetails?.accountNumber || null,
      ifsc_code: s.bankDetails?.ifsc || null,
      notes: s.notes || '',
      status: s.status || 'Active'
    };

    const { data, error } = await supabase
      .from('suppliers')
      .insert(dbPayload)
      .select()
      .single();

    if (error || !data) {
      console.error('Failed to insert supplier into Supabase:', error?.message);
      throw new Error(`Failed to create supplier: ${error?.message || 'Database insert error'}`);
    }

    return {
      id: data.id,
      name: data.name,
      company: data.company,
      phone: data.phone,
      email: data.email,
      address: data.address,
      gstin: data.gstin,
      pan: data.pan,
      creditDays: Number(data.credit_days),
      openingBalance: Number(data.opening_balance),
      currentOutstanding: Number(data.current_outstanding),
      totalPurchases: Number(data.total_purchases),
      totalPaid: Number(data.total_paid),
      bankDetails: data.bank_name ? {
        bankName: data.bank_name,
        accountNumber: data.account_number,
        ifsc: data.ifsc_code,
        accountName: data.company || data.name
      } : undefined,
      notes: data.notes,
      status: data.status,
      createdAt: data.created_at
    };
  },

  // Update supplier
  async updateSupplier(id: string, updates: Partial<Supplier>, companyId?: string) {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const dbPayload: Record<string, any> = {
      updated_at: new Date().toISOString()
    };
    if (updates.name !== undefined) dbPayload.name = updates.name;
    if (updates.company !== undefined) dbPayload.company = updates.company;
    if (updates.phone !== undefined) dbPayload.phone = updates.phone;
    if (updates.email !== undefined) dbPayload.email = updates.email;
    if (updates.address !== undefined) dbPayload.address = updates.address;
    if (updates.gstin !== undefined) dbPayload.gstin = updates.gstin;
    if (updates.pan !== undefined) dbPayload.pan = updates.pan;
    if (updates.creditDays !== undefined) dbPayload.credit_days = updates.creditDays;
    if (updates.currentOutstanding !== undefined) dbPayload.current_outstanding = updates.currentOutstanding;
    if (updates.totalPurchases !== undefined) dbPayload.total_purchases = updates.totalPurchases;
    if (updates.totalPaid !== undefined) dbPayload.total_paid = updates.totalPaid;
    if (updates.status !== undefined) dbPayload.status = updates.status;
    if (updates.notes !== undefined) dbPayload.notes = updates.notes;
    if (updates.bankDetails !== undefined) {
      dbPayload.bank_name = updates.bankDetails.bankName;
      dbPayload.account_number = updates.bankDetails.accountNumber;
      dbPayload.ifsc_code = updates.bankDetails.ifsc;
    }

    const { data, error } = await supabase
      .from('suppliers')
      .update(dbPayload)
      .eq('id', id)
      .eq('company_id', finalCompanyId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update supplier: ${error.message}`);
    return data;
  },

  // Delete supplier with primary key and company scope
  async deleteSupplier(id: string, companyId?: string) {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const { error } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', id)
      .eq('company_id', finalCompanyId);
    if (error) throw new Error(`Failed to delete supplier: ${error.message}`);
  },

  // Supplier Ledger & Transactions
  async getSupplierLedger(supplierId: string) {
    const [purchasesRes, paymentsRes] = await Promise.all([
      supabase.from('purchases').select('id, invoice_number, date, grand_total, payment_status').eq('supplier_id', supplierId).order('date', { ascending: false }),
      supabase.from('payments').select('id, payment_number, date, amount, payment_method').eq('party_id', supplierId).eq('type', 'Paid').order('date', { ascending: false })
    ]);

    return {
      purchases: purchasesRes.data || [],
      payments: paymentsRes.data || []
    };
  }
};
