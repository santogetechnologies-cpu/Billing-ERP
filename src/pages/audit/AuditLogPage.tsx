import React, { useState, useMemo } from 'react';
import {
  History,
  Search,
  Filter,
  Download,
  Printer,
  Shield,
  Clock,
  User,
  ArrowRight,
  Layers,
  FileCheck2
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { AuditLog } from '../../types';
import { formatDate } from '../../utils/formatters';

export const AuditLogPage: React.FC = () => {
  const { auditLogs } = useERP();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModule, setSelectedModule] = useState('All');

  const modules = ['All', 'Sales', 'Purchases', 'Products', 'Inventory', 'Payments', 'Accounting', 'Users & Roles', 'Settings'];

  const filteredLogs = useMemo(() => {
    return auditLogs.filter(log => {
      const matchModule = selectedModule === 'All' || log.module === selectedModule;
      const matchSearch =
        log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.record.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.oldValue.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.newValue.toLowerCase().includes(searchTerm.toLowerCase());
      return matchModule && matchSearch;
    });
  }, [auditLogs, selectedModule, searchTerm]);

  const handleExportCSV = () => {
    const headers = ['User', 'Action', 'Module', 'Record Affected', 'Old Value', 'New Value', 'Date', 'Time'];
    const rows = filteredLogs.map(l => [
      `"${l.user}"`,
      `"${l.action}"`,
      `"${l.module}"`,
      `"${l.record}"`,
      `"${l.oldValue}"`,
      `"${l.newValue}"`,
      `"${l.date}"`,
      `"${l.time}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `audit_trail_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getActionBadgeClass = (action: string) => {
    const act = (action || '').toLowerCase();
    if (act.includes('delete') || act.includes('remove')) {
      return 'bg-rose-50 text-rose-700 border border-rose-200/80';
    }
    if (act.includes('create') || act.includes('add') || act.includes('new')) {
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200/80';
    }
    if (act.includes('update') || act.includes('edit') || act.includes('status') || act.includes('adjust') || act.includes('hold')) {
      return 'bg-amber-50 text-amber-700 border border-amber-200/80';
    }
    return 'bg-blue-50 text-blue-700 border border-blue-200/80';
  };

  const getModuleBadgeClass = (module: string) => {
    const mod = (module || '').toLowerCase();
    if (mod.includes('user') || mod.includes('role')) {
      return 'bg-purple-50 text-purple-700 border border-purple-200/80';
    }
    if (mod.includes('sale') || mod.includes('pos')) {
      return 'bg-blue-50 text-blue-700 border border-blue-200/80';
    }
    if (mod.includes('purchase')) {
      return 'bg-cyan-50 text-cyan-700 border border-cyan-200/80';
    }
    if (mod.includes('inventory') || mod.includes('warehouse')) {
      return 'bg-indigo-50 text-indigo-700 border border-indigo-200/80';
    }
    if (mod.includes('accounting') || mod.includes('tax')) {
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200/80';
    }
    if (mod.includes('payment')) {
      return 'bg-teal-50 text-teal-700 border border-teal-200/80';
    }
    return 'bg-slate-100 text-slate-700 border border-slate-200/80';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            System Audit Trail & Compliance Log
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Tamper-evident record of data modifications, price overrides, inventory adjustments and security events.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-emerald-200"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print Trail</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        {/* Module Filter Pills */}
        <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 flex-1 min-w-0 no-scrollbar">
          {modules.map(mod => (
            <button
              key={mod}
              onClick={() => setSelectedModule(mod)}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                selectedModule === mod
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {mod}
            </button>
          ))}
        </div>

        {/* Compact Search Input */}
        <div className="relative w-full sm:w-44 md:w-48 shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search action, user..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Audit Log Table (Prompt #46: User | Action | Module | Record | Old Value | New Value | Date | Time) */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/90 text-slate-500 border-b border-slate-200 uppercase font-semibold text-[10px] tracking-wider select-none">
              <tr>
                <th className="py-3.5 px-4 align-middle whitespace-nowrap min-w-[150px]">
                  Operator / User
                </th>
                <th className="py-3.5 px-4 align-middle whitespace-nowrap min-w-[130px]">
                  Action Taken
                </th>
                <th className="py-3.5 px-4 align-middle whitespace-nowrap min-w-[140px]">
                  Module
                </th>
                <th className="py-3.5 px-4 align-middle whitespace-nowrap min-w-[160px]">
                  Record Identifier
                </th>
                <th className="py-3.5 px-4 align-middle whitespace-nowrap min-w-[130px]">
                  Previous Value
                </th>
                <th className="py-3.5 px-4 align-middle whitespace-nowrap min-w-[180px]">
                  Updated Value
                </th>
                <th className="py-3.5 px-4 align-middle text-right whitespace-nowrap min-w-[150px]">
                  Timestamp
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400 align-middle">
                    No audit records found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const isDeleteAction = log.action?.toLowerCase().includes('delete') || log.action?.toLowerCase().includes('remove');
                  const isOldDeleted = log.oldValue?.toLowerCase() === 'deleted';
                  const isNewRemoved = log.newValue === 'Removed from system' || isDeleteAction;

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors h-13">
                      {/* 1. Operator / User */}
                      <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-[10px] shrink-0 border border-slate-200 shadow-2xs">
                            {log.user ? log.user.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <span className="font-semibold text-slate-900 text-xs">
                            {log.user}
                          </span>
                        </div>
                      </td>

                      {/* 2. Action Taken */}
                      <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap shadow-2xs ${getActionBadgeClass(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                      </td>

                      {/* 3. Module */}
                      <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${getModuleBadgeClass(
                            log.module
                          )}`}
                        >
                          {log.module}
                        </span>
                      </td>

                      {/* 4. Record Identifier / Role Name */}
                      <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded font-mono text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200/70">
                          {log.record}
                        </span>
                      </td>

                      {/* 5. Previous Value / Status */}
                      <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                        {isOldDeleted ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/70 whitespace-nowrap">
                            Deleted
                          </span>
                        ) : log.oldValue === 'None' ? (
                          <span className="text-slate-400 font-mono text-xs whitespace-nowrap">
                            None
                          </span>
                        ) : (
                          <span
                            className="text-slate-600 font-mono text-xs whitespace-nowrap truncate max-w-[160px] block"
                            title={log.oldValue}
                          >
                            {log.oldValue}
                          </span>
                        )}
                      </td>

                      {/* 6. Updated Value / Description */}
                      <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                        {isNewRemoved ? (
                          <span
                            className="text-slate-600 text-xs whitespace-nowrap truncate max-w-[200px] block"
                            title={log.newValue}
                          >
                            {log.newValue}
                          </span>
                        ) : log.newValue?.toLowerCase() === 'deleted' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/70 whitespace-nowrap">
                            Deleted
                          </span>
                        ) : (
                          <span
                            className="text-emerald-700 font-mono font-bold text-xs whitespace-nowrap truncate max-w-[200px] block"
                            title={log.newValue}
                          >
                            {log.newValue}
                          </span>
                        )}
                      </td>

                      {/* 7. Timestamp */}
                      <td className="py-3.5 px-4 text-right align-middle text-slate-400 text-xs whitespace-nowrap font-mono">
                        <div className="inline-flex items-center justify-end gap-1.5 text-slate-400 text-[11px]">
                          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{formatDate(log.date)} • {log.time}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
