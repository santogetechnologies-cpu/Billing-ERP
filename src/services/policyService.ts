import { supabase } from '../lib/supabase';
import { CompanyPolicy, CompanyPolicyHistory, PolicyStatus } from '../types';

const LOCAL_STORAGE_POLICIES_KEY = 'universal_billing_company_policies';
const LOCAL_STORAGE_HISTORY_KEY = 'universal_billing_company_policy_history';

// Seed initial policies for tenant
const SEED_POLICIES: CompanyPolicy[] = [
  {
    id: 'pol-00000000-0001',
    companyId: '00000000-0000-0000-0000-000000000001',
    code: 'POL-001',
    title: 'Universal Billing Code of Business Conduct & Ethics',
    category: 'General',
    content: 'All staff members must observe the highest standards of financial honesty, transparency, and data confidentiality. Falsification of invoice records, unauthorized stock removals, and off-the-books transactions are strictly prohibited and subject to immediate termination.',
    version: '1.0',
    effectiveDate: '2026-01-01',
    status: 'Published',
    createdByRole: 'Owner',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString()
  },
  {
    id: 'pol-00000000-0002',
    companyId: '00000000-0000-0000-0000-000000000001',
    code: 'POL-002',
    title: 'Warehouse Inventory Integrity & Loss Prevention',
    category: 'Warehouse & Inventory',
    content: 'Physical inventory audits must be reconciled against system stock transactions weekly. Products with active sales history cannot be permanently deleted and must be safely deactivated or archived. Damaged goods must be recorded via authorized Stock Adjustments within 24 hours.',
    version: '1.0',
    effectiveDate: '2026-01-15',
    status: 'Published',
    createdByRole: 'Owner',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString()
  },
  {
    id: 'pol-00000000-0003',
    companyId: '00000000-0000-0000-0000-000000000001',
    code: 'POL-003',
    title: 'Commercial Customer Credit & Collection Standards',
    category: 'Sales & Credit',
    content: 'Customer credit limits must be strictly validated before dispatching goods. Invoices overdue beyond 30 days shall incur 18% p.a. standard interest. No additional credit deliveries are permitted for accounts on hold.',
    version: '1.0',
    effectiveDate: '2026-02-01',
    status: 'Published',
    createdByRole: 'Owner',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString()
  }
];

function getStorage(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) return (globalThis as any).localStorage;
  return null;
}

let memoryPolicies: CompanyPolicy[] = [...SEED_POLICIES];
let memoryHistory: CompanyPolicyHistory[] = [];

function getLocalPolicies(): CompanyPolicy[] {
  try {
    const storage = getStorage();
    if (storage) {
      const data = storage.getItem(LOCAL_STORAGE_POLICIES_KEY);
      if (data) return JSON.parse(data);
    }
  } catch {}
  return memoryPolicies;
}

function saveLocalPolicies(policies: CompanyPolicy[]) {
  memoryPolicies = [...policies];
  try {
    const storage = getStorage();
    if (storage) {
      storage.setItem(LOCAL_STORAGE_POLICIES_KEY, JSON.stringify(policies));
    }
  } catch {}
}

function getLocalHistory(): CompanyPolicyHistory[] {
  try {
    const storage = getStorage();
    if (storage) {
      const data = storage.getItem(LOCAL_STORAGE_HISTORY_KEY);
      if (data) return JSON.parse(data);
    }
  } catch {}
  return memoryHistory;
}

function saveLocalHistory(history: CompanyPolicyHistory[]) {
  memoryHistory = [...history];
  try {
    const storage = getStorage();
    if (storage) {
      storage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(history));
    }
  } catch {}
}

export const policyService = {
  /**
   * Fetches company policies for a given company.
   * - Owner: Receives ALL policies (Draft, Published, Archived).
   * - Staff (non-Owner): Receives ONLY 'Published' policies.
   */
  async getPolicies(companyId: string, role?: string): Promise<CompanyPolicy[]> {
    const isOwner = role === 'Owner';
    const targetCompanyId = companyId || '00000000-0000-0000-0000-000000000001';

    try {
      let query = supabase
        .from('company_policies')
        .select('*')
        .eq('company_id', targetCompanyId);

      if (!isOwner) {
        query = query.eq('status', 'Published');
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map(p => ({
          id: p.id,
          companyId: p.company_id,
          title: p.title,
          code: p.code,
          category: p.category,
          content: p.content,
          version: p.version,
          effectiveDate: p.effective_date,
          status: p.status,
          createdBy: p.created_by,
          createdByRole: p.created_by_role,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
          publishedAt: p.published_at,
          archivedAt: p.archived_at
        }));
      }
    } catch {
      // Fallback to local storage cache
    }

    // Local fallback
    const local = getLocalPolicies().filter(p => p.companyId === targetCompanyId);
    if (isOwner) {
      return local;
    }
    return local.filter(p => p.status === 'Published');
  },

  /**
   * Creates a new company policy.
   * STRICT SECURITY: Only the Owner role is permitted to create policies.
   */
  async createPolicy(
    input: {
      title: string;
      code?: string;
      category: string;
      content: string;
      version?: string;
      effectiveDate?: string;
      status?: PolicyStatus;
    },
    role: string | undefined,
    userId: string | undefined,
    companyId: string
  ): Promise<CompanyPolicy> {
    if (role !== 'Owner') {
      throw new Error('Access Denied: Only the Owner role is authorized to create Company Policies.');
    }

    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const generatedCode = input.code || `POL-${String(Date.now()).slice(-4)}`;
    const newPolicy: CompanyPolicy = {
      id: `pol-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      companyId: finalCompanyId,
      title: input.title,
      code: generatedCode,
      category: input.category || 'General',
      content: input.content,
      version: input.version || '1.0',
      effectiveDate: input.effectiveDate || new Date().toISOString().split('T')[0],
      status: input.status || 'Draft',
      createdBy: userId,
      createdByRole: 'Owner',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      publishedAt: input.status === 'Published' ? new Date().toISOString() : undefined
    };

    // 1. Try Supabase
    try {
      const { data, error } = await supabase
        .from('company_policies')
        .insert({
          company_id: newPolicy.companyId,
          title: newPolicy.title,
          code: newPolicy.code,
          category: newPolicy.category,
          content: newPolicy.content,
          version: newPolicy.version,
          effective_date: newPolicy.effectiveDate,
          status: newPolicy.status,
          created_by: userId,
          created_by_role: 'Owner'
        })
        .select()
        .single();

      if (!error && data) {
        newPolicy.id = data.id;
      }
    } catch {
      // ignore
    }

    // 2. Update local fallback cache
    const policies = getLocalPolicies();
    policies.unshift(newPolicy);
    saveLocalPolicies(policies);

    // 3. Record history
    await this.recordHistory({
      policyId: newPolicy.id,
      action: 'created',
      performedBy: userId,
      performedByName: 'Company Owner',
      performedByRole: 'Owner',
      details: `Created initial policy version ${newPolicy.version} (${newPolicy.status})`
    });

    return newPolicy;
  },

  /**
   * Updates an existing company policy.
   * STRICT SECURITY: Only the Owner role is permitted to edit policies.
   */
  async updatePolicy(
    id: string,
    updates: Partial<CompanyPolicy>,
    role: string | undefined,
    userId: string | undefined,
    companyId: string
  ): Promise<CompanyPolicy> {
    if (role !== 'Owner') {
      throw new Error('Access Denied: Only the Owner role is authorized to edit Company Policies.');
    }

    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';

    // 1. Update Supabase
    try {
      const dbPayload: Record<string, any> = {
        updated_at: new Date().toISOString()
      };
      if (updates.title !== undefined) dbPayload.title = updates.title;
      if (updates.code !== undefined) dbPayload.code = updates.code;
      if (updates.category !== undefined) dbPayload.category = updates.category;
      if (updates.content !== undefined) dbPayload.content = updates.content;
      if (updates.version !== undefined) dbPayload.version = updates.version;
      if (updates.effectiveDate !== undefined) dbPayload.effective_date = updates.effectiveDate;
      if (updates.status !== undefined) {
        dbPayload.status = updates.status;
        if (updates.status === 'Published') dbPayload.published_at = new Date().toISOString();
        if (updates.status === 'Archived') dbPayload.archived_at = new Date().toISOString();
      }

      await supabase
        .from('company_policies')
        .update(dbPayload)
        .eq('id', id)
        .eq('company_id', finalCompanyId);
    } catch {
      // ignore
    }

    // 2. Update local fallback
    const policies = getLocalPolicies();
    const idx = policies.findIndex(p => p.id === id);
    if (idx === -1) {
      throw new Error(`Policy not found with id ${id}`);
    }

    const updated = {
      ...policies[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    policies[idx] = updated;
    saveLocalPolicies(policies);

    // 3. Record history
    await this.recordHistory({
      policyId: id,
      action: 'updated',
      performedBy: userId,
      performedByName: 'Company Owner',
      performedByRole: 'Owner',
      details: `Updated policy details. Version: ${updated.version}, Status: ${updated.status}`
    });

    return updated;
  },

  /**
   * Sets policy status to Published.
   * STRICT SECURITY: Only Owner.
   */
  async publishPolicy(id: string, role: string | undefined, userId: string | undefined, companyId: string): Promise<CompanyPolicy> {
    if (role !== 'Owner') {
      throw new Error('Access Denied: Only the Owner role is authorized to publish Company Policies.');
    }
    return this.updatePolicy(
      id,
      { status: 'Published', publishedAt: new Date().toISOString() },
      role,
      userId,
      companyId
    );
  },

  /**
   * Sets policy status to Archived.
   * STRICT SECURITY: Only Owner.
   */
  async archivePolicy(id: string, role: string | undefined, userId: string | undefined, companyId: string): Promise<CompanyPolicy> {
    if (role !== 'Owner') {
      throw new Error('Access Denied: Only the Owner role is authorized to archive Company Policies.');
    }
    return this.updatePolicy(
      id,
      { status: 'Archived', archivedAt: new Date().toISOString() },
      role,
      userId,
      companyId
    );
  },

  /**
   * Deletes a company policy.
   * STRICT SECURITY: Only Owner.
   */
  async deletePolicy(id: string, role: string | undefined, userId: string | undefined, companyId: string): Promise<boolean> {
    if (role !== 'Owner') {
      throw new Error('Access Denied: Only the Owner role is authorized to delete Company Policies.');
    }

    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';

    try {
      await supabase
        .from('company_policies')
        .delete()
        .eq('id', id)
        .eq('company_id', finalCompanyId);
    } catch {
      // ignore
    }

    const policies = getLocalPolicies().filter(p => p.id !== id);
    saveLocalPolicies(policies);

    await this.recordHistory({
      policyId: id,
      action: 'deleted',
      performedBy: userId,
      performedByName: 'Company Owner',
      performedByRole: 'Owner',
      details: 'Policy permanently deleted by Owner'
    });

    return true;
  },

  /**
   * Fetches audit history for a policy.
   */
  async getPolicyHistory(policyId: string, role: string | undefined): Promise<CompanyPolicyHistory[]> {
    if (role !== 'Owner') {
      throw new Error('Access Denied: Only the Owner role can view policy audit history.');
    }

    try {
      const { data, error } = await supabase
        .from('company_policy_history')
        .select('*')
        .eq('policy_id', policyId)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map(h => ({
          id: h.id,
          policyId: h.policy_id,
          action: h.action,
          performedBy: h.performed_by,
          performedByName: h.performed_by_name,
          performedByRole: h.performed_by_role,
          details: h.details,
          createdAt: h.created_at
        }));
      }
    } catch {}

    return getLocalHistory().filter(h => h.policyId === policyId);
  },

  /**
   * Records an audit history entry.
   */
  async recordHistory(entry: {
    policyId: string;
    action: 'created' | 'updated' | 'published' | 'unpublished' | 'archived' | 'deleted';
    performedBy?: string;
    performedByName?: string;
    performedByRole?: string;
    details?: string;
  }): Promise<void> {
    const historyItem: CompanyPolicyHistory = {
      id: `hist-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      policyId: entry.policyId,
      action: entry.action,
      performedBy: entry.performedBy,
      performedByName: entry.performedByName || 'System',
      performedByRole: entry.performedByRole || 'Owner',
      details: entry.details,
      createdAt: new Date().toISOString()
    };

    try {
      await supabase.from('company_policy_history').insert({
        policy_id: entry.policyId,
        action: entry.action,
        performed_by: entry.performedBy,
        performed_by_name: entry.performedByName,
        performed_by_role: entry.performedByRole,
        details: entry.details
      });
    } catch {}

    const allHist = getLocalHistory();
    allHist.unshift(historyItem);
    saveLocalHistory(allHist);
  }
};
