import { supabase } from '../lib/supabase';
import { Customer } from '../types';
import { assertCallerPermission } from '../utils/rbac';

export const customerService = {
  // Fetch customers with search and pagination
  async getCustomers(params?: { search?: string; page?: number; limit?: number }, companyId?: string): Promise<Customer[]> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    let query = supabase
      .from('customers')
      .select('*')
      .eq('company_id', finalCompanyId)
      .order('name');

    if (params?.search) {
      query = query.or(`name.ilike.%${params.search}%,phone.ilike.%${params.search}%,gstin.ilike.%${params.search}%`);
    }

    if (params?.page !== undefined && params?.limit !== undefined) {
      const from = (params.page - 1) * params.limit;
      const to = from + params.limit - 1;
      query = query.range(from, to);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Error fetching customers from Supabase:', error.message);
      return [];
    }

    return (data || []).map(c => ({
      id: c.id,
      name: c.name,
      type: c.customer_type || 'Retail',
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      gstin: c.gstin || '',
      pan: c.pan || '',
      state: c.state || '',
      country: c.country || 'India',
      creditLimit: Number(c.credit_limit) || 0,
      creditDays: Number(c.credit_days) || 30,
      openingBalance: Number(c.opening_balance) || 0,
      currentOutstanding: Number(c.current_outstanding) || 0,
      totalPurchased: Number(c.total_purchased) || 0,
      totalPaid: Number(c.total_paid) || 0,
      notes: c.notes,
      status: (c.status as any) || 'Active',
      createdAt: c.created_at
    }));
  },

  // Get customer by ID
  async getCustomerById(id: string): Promise<Customer | null> {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      name: data.name,
      type: data.customer_type || 'Retail',
      phone: data.phone || '',
      email: data.email || '',
      address: data.address || '',
      gstin: data.gstin || '',
      pan: data.pan || '',
      state: data.state || '',
      country: data.country || 'India',
      creditLimit: Number(data.credit_limit) || 0,
      creditDays: Number(data.credit_days) || 30,
      openingBalance: Number(data.opening_balance) || 0,
      currentOutstanding: Number(data.current_outstanding) || 0,
      totalPurchased: Number(data.total_purchased) || 0,
      totalPaid: Number(data.total_paid) || 0,
      notes: data.notes,
      status: data.status || 'Active',
      createdAt: data.created_at
    } as Customer;
  },

  // Create new customer - throws error if DB operation fails
  async createCustomer(c: Omit<Customer, 'id' | 'createdAt' | 'currentOutstanding' | 'totalPurchased' | 'totalPaid'>, companyId?: string): Promise<Customer> {
    // 0. Strict RBAC Enforcement: caller must have 'customers:create' permission
    await assertCallerPermission('customers', 'create');

    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const dbPayload = {
      company_id: finalCompanyId,
      name: c.name,
      customer_type: c.type,
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      gstin: c.gstin || '',
      pan: c.pan || '',
      state: c.state || '',
      country: c.country || 'India',
      credit_limit: c.creditLimit || 0,
      credit_days: c.creditDays || 30,
      opening_balance: c.openingBalance || 0,
      current_outstanding: c.openingBalance || 0,
      total_purchased: 0,
      total_paid: 0,
      notes: c.notes || '',
      status: c.status || 'Active'
    };

    const { data, error } = await supabase
      .from('customers')
      .insert(dbPayload)
      .select()
      .single();

    if (error || !data) {
      console.error('Failed to insert customer into Supabase:', error?.message);
      throw new Error(`Failed to create customer: ${error?.message || 'Database insert error'}`);
    }

    return {
      id: data.id,
      name: data.name,
      type: data.customer_type,
      phone: data.phone,
      email: data.email,
      address: data.address,
      gstin: data.gstin,
      pan: data.pan,
      state: data.state,
      country: data.country,
      creditLimit: Number(data.credit_limit),
      creditDays: Number(data.credit_days),
      openingBalance: Number(data.opening_balance),
      currentOutstanding: Number(data.current_outstanding),
      totalPurchased: Number(data.total_purchased),
      totalPaid: Number(data.total_paid),
      notes: data.notes,
      status: data.status,
      createdAt: data.created_at
    };
  },

  // Update customer
  async updateCustomer(id: string, updates: Partial<Customer>, companyId?: string) {
    // 0. Strict RBAC Enforcement: caller must have 'customers:edit' permission
    await assertCallerPermission('customers', 'edit');

    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const dbPayload: Record<string, any> = {
      updated_at: new Date().toISOString()
    };
    if (updates.name !== undefined) dbPayload.name = updates.name;
    if (updates.type !== undefined) dbPayload.customer_type = updates.type;
    if (updates.phone !== undefined) dbPayload.phone = updates.phone;
    if (updates.email !== undefined) dbPayload.email = updates.email;
    if (updates.address !== undefined) dbPayload.address = updates.address;
    if (updates.gstin !== undefined) dbPayload.gstin = updates.gstin;
    if (updates.pan !== undefined) dbPayload.pan = updates.pan;
    if (updates.state !== undefined) dbPayload.state = updates.state;
    if (updates.country !== undefined) dbPayload.country = updates.country;
    if (updates.creditLimit !== undefined) dbPayload.credit_limit = updates.creditLimit;
    if (updates.creditDays !== undefined) dbPayload.credit_days = updates.creditDays;
    if (updates.currentOutstanding !== undefined) dbPayload.current_outstanding = updates.currentOutstanding;
    if (updates.totalPurchased !== undefined) dbPayload.total_purchased = updates.totalPurchased;
    if (updates.totalPaid !== undefined) dbPayload.total_paid = updates.totalPaid;
    if (updates.status !== undefined) dbPayload.status = updates.status;
    if (updates.notes !== undefined) dbPayload.notes = updates.notes;

    const { data, error } = await supabase
      .from('customers')
      .update(dbPayload)
      .eq('id', id)
      .eq('company_id', finalCompanyId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update customer: ${error.message}`);
    return data;
  },

  // Delete customer with strict RBAC authorization and financial integrity protection
  async deleteCustomer(id: string, companyId?: string) {
    // 0. Strict RBAC Enforcement: Only roles with 'customers:delete' permission (Admin & Owner) can delete customers.
    // Salesperson explicitly has delete: false and will be rejected with 403 Forbidden.
    await assertCallerPermission('customers', 'delete');

    // 1. Financial Ledger & Historical Integrity Check: Prevent deleting customer with existing sales invoices
    const { data: linkedSales, error: salesCheckErr } = await supabase
      .from('sales')
      .select('id, invoice_number')
      .eq('customer_id', id)
      .limit(1);

    if (!salesCheckErr && linkedSales && linkedSales.length > 0) {
      throw new Error(
        `Integrity Violation (409): Customer cannot be deleted because sales invoice (${linkedSales[0].invoice_number}) is linked to this account. Historical ledger records must remain intact.`
      );
    }

    // 2. Financial Ledger & Historical Integrity Check: Prevent deleting customer with existing payment receipts
    const { data: linkedPayments, error: paymentCheckErr } = await supabase
      .from('payments')
      .select('id, payment_number')
      .eq('party_id', id)
      .limit(1);

    if (!paymentCheckErr && linkedPayments && linkedPayments.length > 0) {
      throw new Error(
        `Integrity Violation (409): Customer cannot be deleted because payment receipt (${linkedPayments[0].payment_number}) is linked to this account.`
      );
    }

    // 3. Perform delete scoped strictly to the authenticated user's company
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id)
      .eq('company_id', finalCompanyId);

    if (error) throw new Error(`Failed to delete customer: ${error.message}`);
  },

  // Customer Transaction History & Ledger
  async getCustomerLedger(customerId: string) {
    const [salesRes, paymentsRes] = await Promise.all([
      supabase.from('sales').select('id, invoice_number, date, grand_total, payment_status').eq('customer_id', customerId).order('date', { ascending: false }),
      supabase.from('payments').select('id, payment_number, date, amount, payment_method').eq('party_id', customerId).eq('type', 'Received').order('date', { ascending: false })
    ]);

    return {
      invoices: salesRes.data || [],
      payments: paymentsRes.data || []
    };
  }
};
