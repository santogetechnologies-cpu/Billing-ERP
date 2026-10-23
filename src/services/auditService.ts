import { supabase } from '../lib/supabase';
import { AuditLog } from '../types';

export const auditService = {
  async getAuditLogs(filters?: { module?: string; startDate?: string; endDate?: string } | string, companyId?: string): Promise<AuditLog[]> {
    try {
      const finalCompanyId = (typeof filters === 'string' ? filters : companyId) || '00000000-0000-0000-0000-000000000001';
      const actualFilters = typeof filters === 'object' ? filters : undefined;
      let query = supabase
        .from('audit_logs')
        .select('*')
        .eq('company_id', finalCompanyId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (actualFilters?.module && actualFilters.module !== 'All') {
        query = query.eq('module', actualFilters.module);
      }
      if (actualFilters?.startDate) {
        query = query.gte('created_at', actualFilters.startDate);
      }
      if (actualFilters?.endDate) {
        query = query.lte('created_at', actualFilters.endDate);
      }

      const { data, error } = await query;
      if (error || !data || data.length === 0) {
        return [];
      }

      return data.map((d: any) => ({
        id: d.id,
        user: d.user_name || 'System Admin',
        action: d.action,
        module: d.module,
        record: d.record || d.record_identifier || '',
        oldValue: d.old_value || 'None',
        newValue: d.new_value || 'None',
        date: d.date || (d.created_at ? d.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
        time: d.time || (d.created_at ? new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '12:00 PM')
      }));
    } catch (err) {
      console.error('Failed to get audit logs:', err);
      return [];
    }
  },

  async logAction(action: string, module: string, record: string, oldValue: string, newValue: string, companyId?: string): Promise<void> {
    try {
      const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      const { error } = await supabase.from('audit_logs').insert({
        company_id: finalCompanyId,
        user_name: 'Current User (Active)',
        action,
        module,
        record: record || 'System',
        old_value: oldValue || 'None',
        new_value: newValue || 'None',
        date: dateStr,
        time: timeStr
      });
      if (error) {
        console.warn('Note on Supabase audit log insert:', error.message);
      }
    } catch (e) {
      console.warn('Could not record audit log in Supabase:', e);
    }
  }
};
