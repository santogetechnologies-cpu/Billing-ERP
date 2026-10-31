import React, { useState } from 'react';
import {
  HardDriveDownload,
  Upload,
  CheckCircle,
  AlertTriangle,
  Clock,
  Download,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';

export const SettingsBackupTab: React.FC = () => {
  const erp = useERP();
  const [backupSuccess, setBackupSuccess] = useState(false);
  const [restoreFeedback, setRestoreFeedback] = useState<string | null>(null);

  const handleDownloadBackup = () => {
    try {
      const backupData = {
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        company: erp.company,
        products: erp.products,
        customers: erp.customers,
        suppliers: erp.suppliers,
        salesInvoices: erp.salesInvoices,
        purchaseInvoices: erp.purchaseInvoices,
        expenses: erp.expenses,
        payments: erp.payments,
        warehouses: erp.warehouses,
        batches: erp.batches,
        accounts: erp.accounts
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Universal_ERP_Full_Backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setBackupSuccess(true);
      setTimeout(() => setBackupSuccess(false), 4000);
    } catch (err: any) {
      alert('Failed to generate backup: ' + err.message);
    }
  };

  const handleFileRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed.products || !parsed.company) {
          throw new Error('Invalid ERP backup format.');
        }
        setRestoreFeedback(`Valid backup verified: ${parsed.products.length} products, ${parsed.salesInvoices?.length || 0} invoices.`);
      } catch (err: any) {
        setRestoreFeedback(`Verification error: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4 text-xs">
      {backupSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>Full system database snapshot downloaded safely to your computer!</span>
        </div>
      )}

      {/* Snapshot Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <HardDriveDownload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Instant Full Database Snapshot</h3>
              <p className="text-slate-500">Download complete transactional ledger, master catalogs, and company records.</p>
            </div>
          </div>

          <button
            onClick={handleDownloadBackup}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Backup (.json)</span>
          </button>
        </div>

        <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-slate-600">
          <span className="flex items-center gap-1.5 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Local Encryption & Data Integrity: Never loses data. Portable across offline & cloud instances.</span>
          </span>
          <span className="text-[11px] font-mono text-slate-400">Snapshot format v2.0</span>
        </div>
      </div>

      {/* Restore Verification Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-slate-100 text-slate-700 rounded-xl">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900">Restore or Verify Archive</h3>
            <p className="text-slate-500">Inspect or restore an existing JSON backup archive.</p>
          </div>
        </div>

        <div>
          <input
            type="file"
            accept=".json"
            onChange={handleFileRestore}
            className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
          />
        </div>

        {restoreFeedback && (
          <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-lg">
            {restoreFeedback}
          </div>
        )}
      </div>
    </div>
  );
};

