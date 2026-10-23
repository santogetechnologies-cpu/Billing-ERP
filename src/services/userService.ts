import { supabase } from '../lib/supabase';
import { SystemUser, Permission, AccountStatus, PresenceStatus } from '../types';
import { assertCallerPermission } from '../utils/rbac';
import { USER_CREDENTIALS_STORAGE_KEY } from './authService';
import { presenceService } from './presenceService';
import { auditService } from './auditService';
import { filterSupportedProfilePayload } from '../utils/schemaDetector';

export const userService = {
  async getUsers(companyId?: string): Promise<SystemUser[]> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('company_id', finalCompanyId)
        .order('created_at', { ascending: false });

      if (error || !data || data.length === 0) {
        return [];
      }

      return data.map((d: any) => {
        // 1. Account Status (Enabled / Disabled)
        const accountStatus: AccountStatus =
          d.account_status === 'Disabled' || d.status === 'Disabled' || d.status === 'Inactive'
            ? 'Disabled'
            : 'Enabled';

        // 2. Local presence cache fallback (for instant multi-tab sync)
        const cached = presenceService.getLocalPresenceCache(d.id);
        const lastSeenRaw = d.last_seen_at || d.last_activity_at || cached?.lastSeenAt || d.last_login_at || d.last_login;
        const rawPresence = cached?.presenceStatus || d.presence_status || (d.status === 'Active' ? 'Active' : 'Inactive');

        // 3. True online presence: must have had heartbeat within 2 minutes AND presence !== 'Inactive'
        const isOnline = presenceService.isUserOnline(lastSeenRaw, rawPresence);
        const presenceStatus: PresenceStatus = isOnline ? 'Active' : 'Inactive';

        const lastLoginAt = d.last_login_at || cached?.lastLoginAt || d.last_login;
        const lastLogoutAt = d.last_logout_at || cached?.lastLogoutAt;

        return {
          id: d.id,
          name: d.full_name || 'ERP User',
          email: d.email || 'user@example.com',
          role: (d.role as any) || 'Admin',
          status: accountStatus === 'Disabled' ? 'Inactive' : 'Active', // Backwards compatibility
          accountStatus,
          presenceStatus,
          lastLogin: lastLoginAt ? new Date(lastLoginAt).toLocaleString() : 'Never',
          lastLoginAt,
          lastSeenAt: lastSeenRaw,
          lastLogoutAt
        };
      });
    } catch (err) {
      console.error('Failed to get users:', err);
      return [];
    }
  },

  async createUser(user: Omit<SystemUser, 'id'>, password?: string, companyId?: string): Promise<SystemUser> {
    // 0. Strict RBAC Enforcement: Only Admin & Owner can provision users
    await assertCallerPermission('users', 'create');

    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const normalizedEmail = (user.email || '').trim().toLowerCase();
    const normalizedName = (user.name || '').trim();
    const userAccountStatus: AccountStatus =
      user.accountStatus || ((user.status as any) === 'Inactive' || (user.status as any) === 'Disabled' ? 'Disabled' : 'Enabled');
    const userPresenceStatus: PresenceStatus = user.presenceStatus || 'Inactive';

    // 1. Check if a profile with this email already exists in the company
    try {
      const { data: existingProfiles, error: fetchErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('company_id', finalCompanyId)
        .ilike('email', normalizedEmail)
        .maybeSingle();

      if (!fetchErr && existingProfiles) {
        // User already exists in this company -> update details and return without creating duplicate
        const { data: updated } = await supabase
          .from('profiles')
          .update({
            full_name: normalizedName || existingProfiles.full_name,
            role: user.role || existingProfiles.role,
            status: userAccountStatus === 'Disabled' ? 'Inactive' : 'Active',
            updated_at: new Date().toISOString()
          })
          .eq('id', existingProfiles.id)
          .select()
          .single();

        const res = updated || existingProfiles;
        const accStatus: AccountStatus =
          res.account_status === 'Disabled' || res.status === 'Disabled' || res.status === 'Inactive'
            ? 'Disabled'
            : userAccountStatus;
        return {
          id: res.id,
          name: res.full_name || normalizedName,
          email: res.email || normalizedEmail,
          role: (res.role as any) || user.role,
          status: accStatus === 'Disabled' ? 'Inactive' : 'Active',
          accountStatus: accStatus,
          presenceStatus: userPresenceStatus,
          lastLogin: res.last_login ? new Date(res.last_login).toLocaleString() : 'Never',
          lastLoginAt: res.last_login || res.last_login_at,
          lastSeenAt: res.last_seen_at,
          lastLogoutAt: res.last_logout_at
        };
      }
    } catch (checkErr) {
      console.warn('Pre-check for existing profile encountered a warning:', checkErr);
    }

    // 2. Persist custom credentials if password provided
    if (password && password.trim()) {
      try {
        if (typeof window !== 'undefined') {
          const creds = JSON.parse(localStorage.getItem(USER_CREDENTIALS_STORAGE_KEY) || '{}');
          creds[normalizedEmail] = {
            password: password.trim(),
            updatedAt: new Date().toISOString()
          };
          localStorage.setItem(USER_CREDENTIALS_STORAGE_KEY, JSON.stringify(creds));
        }
      } catch (credErr) {
        console.warn('Failed to persist staff credentials locally:', credErr);
      }
    }

    // 3. Direct insertion into public.profiles
    const finalUserId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : '00000000-0000-0000-0000-' + String(Date.now()).padStart(12, '0').slice(-12);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: finalUserId,
          company_id: finalCompanyId,
          full_name: normalizedName,
          email: normalizedEmail,
          role: user.role,
          status: userAccountStatus === 'Disabled' ? 'Inactive' : 'Active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error || !data) {
        console.warn('Note on Supabase profile insert:', error?.message);
        return {
          id: finalUserId,
          name: normalizedName,
          email: normalizedEmail,
          role: user.role,
          status: userAccountStatus === 'Disabled' ? 'Inactive' : 'Active',
          accountStatus: userAccountStatus,
          presenceStatus: userPresenceStatus,
          lastLogin: 'Never'
        };
      }

      const accStatus: AccountStatus =
        data.account_status === 'Disabled' || data.status === 'Disabled' || data.status === 'Inactive'
          ? 'Disabled'
          : userAccountStatus;

      return {
        id: data.id,
        name: data.full_name || normalizedName,
        email: data.email || normalizedEmail,
        role: (data.role as any) || user.role,
        status: accStatus === 'Disabled' ? 'Inactive' : 'Active',
        accountStatus: accStatus,
        presenceStatus: userPresenceStatus,
        lastLogin: 'Never'
      };
    } catch (dbErr) {
      console.warn('Database user profile sync warning:', dbErr);
      return {
        id: finalUserId,
        name: normalizedName,
        email: normalizedEmail,
        role: user.role,
        status: userAccountStatus === 'Disabled' ? 'Inactive' : 'Active',
        accountStatus: userAccountStatus,
        presenceStatus: userPresenceStatus,
        lastLogin: 'Never'
      };
    }
  },

  async updateUser(id: string, updates: Partial<SystemUser>, companyId?: string): Promise<SystemUser> {
    // 0. Strict RBAC Enforcement: Only Admin & Owner can update users or assign roles
    await assertCallerPermission('users', 'edit');

    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const payload: any = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined) payload.full_name = updates.name;
    if (updates.role !== undefined) payload.role = updates.role;
    if (updates.email !== undefined) payload.email = updates.email;
    if (updates.accountStatus !== undefined) {
      payload.account_status = updates.accountStatus;
      payload.status = updates.accountStatus === 'Disabled' ? 'Inactive' : 'Active';
    } else if (updates.status !== undefined) {
      payload.status = updates.status;
      payload.account_status = (updates.status as any) === 'Inactive' || (updates.status as any) === 'Disabled' ? 'Disabled' : 'Enabled';
    }
    if (updates.presenceStatus !== undefined) {
      payload.presence_status = updates.presenceStatus;
    }

    try {
      const safePayload = await filterSupportedProfilePayload(payload);
      const { data, error } = await supabase
        .from('profiles')
        .update(safePayload)
        .eq('id', id)
        .eq('company_id', finalCompanyId)
        .select()
        .single();

      if (data) {
        const accStatus: AccountStatus =
          data.account_status === 'Disabled' || data.status === 'Disabled' || data.status === 'Inactive'
            ? 'Disabled'
            : 'Enabled';
        return {
          id: data.id,
          name: data.full_name || updates.name || '',
          email: data.email || updates.email || '',
          role: data.role || updates.role || 'Salesperson',
          status: accStatus === 'Disabled' ? 'Inactive' : 'Active',
          accountStatus: accStatus,
          presenceStatus: updates.presenceStatus || (data.presence_status as any) || 'Inactive',
          lastLogin: data.last_login ? new Date(data.last_login).toLocaleString() : 'Recent'
        };
      }
    } catch (err) {
      console.warn('Update user exception:', err);
    }

    const accStatus = (updates.accountStatus || (updates.status === 'Inactive' ? 'Disabled' : 'Enabled')) as AccountStatus;
    return {
      id,
      name: updates.name || 'User',
      email: updates.email || 'user@example.com',
      role: updates.role || 'Salesperson',
      status: accStatus === 'Disabled' ? 'Inactive' : 'Active',
      accountStatus: accStatus,
      presenceStatus: updates.presenceStatus || 'Inactive',
      lastLogin: 'Recent'
    };
  },

  async toggleAccountStatus(
    id: string,
    newStatus: AccountStatus,
    currentUserId?: string,
    companyId?: string
  ): Promise<SystemUser> {
    // 0. Strict RBAC Enforcement
    await assertCallerPermission('users', 'edit');

    // 1. Security check: User cannot disable their own administrator account
    if (currentUserId && id === currentUserId && newStatus === 'Disabled') {
      throw new Error('Security policy: You cannot disable your own administrator account.');
    }

    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';

    try {
      const safePayload = await filterSupportedProfilePayload({
        account_status: newStatus,
        status: newStatus === 'Disabled' ? 'Inactive' : 'Active',
        ...(newStatus === 'Disabled' ? { presence_status: 'Inactive' } : {}),
        updated_at: new Date().toISOString()
      });

      const { data: updated, error } = await supabase
        .from('profiles')
        .update(safePayload)
        .eq('id', id)
        .eq('company_id', finalCompanyId)
        .select()
        .maybeSingle();

      // Record in Audit Log
      try {
        await auditService.logAction(
          'Account Status Changed',
          'Users & Roles',
          updated?.email || id,
          newStatus === 'Enabled' ? 'Disabled' : 'Enabled',
          newStatus,
          finalCompanyId
        );
      } catch {}

      const res = updated || { id, full_name: 'User', email: 'user@example.com', role: 'Staff' };
      return {
        id: res.id,
        name: res.full_name || 'User',
        email: res.email || 'user@example.com',
        role: (res.role as any) || 'Staff',
        status: newStatus === 'Disabled' ? 'Inactive' : 'Active',
        accountStatus: newStatus,
        presenceStatus: 'Inactive',
        lastLogin: res.last_login ? new Date(res.last_login).toLocaleString() : 'Never'
      };
    } catch (err: any) {
      console.error('Toggle account status error:', err);
      throw err;
    }
  },

  async deleteUser(id: string, companyId?: string): Promise<boolean> {
    // 0. Strict RBAC Enforcement: Only Admin & Owner can delete users
    await assertCallerPermission('users', 'delete');

    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id)
      .eq('company_id', finalCompanyId);

    if (error) {
      console.warn('Supabase profile delete warning:', error.message);
    }
    return true;
  },

  async getPermissions(): Promise<Permission[]> {
    const defaultModules = [
      'Dashboard', 'POS / Billing', 'Products & Catalog', 'Customers (CRM)',
      'Suppliers (Vendor)', 'Sales & Invoices', 'Purchases & Bills',
      'Inventory & Stock', 'Expenses', 'Payments & Banking', 'Accounting & Ledger',
      'Reports & Analytics', 'Users & Roles', 'Settings'
    ];

    try {
      const { data } = await supabase.from('permissions').select('*');
      if (data && data.length > 0) {
        return defaultModules.map(mod => ({
          module: mod,
          view: true,
          create: true,
          edit: true,
          delete: mod !== 'Settings',
          approve: true,
          export: true
        }));
      }
    } catch (e) {
      // fallback
    }

    return defaultModules.map(mod => ({
      module: mod,
      view: true,
      create: true,
      edit: true,
      delete: !['Dashboard', 'Settings'].includes(mod),
      approve: true,
      export: true
    }));
  }
};
