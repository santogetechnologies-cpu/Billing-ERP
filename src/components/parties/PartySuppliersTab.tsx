import React from 'react';
import {
  Building2,
  Search,
  Download,
  Phone,
  Mail,
  Edit,
  Trash2,
  CreditCard
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { DataTable, Column } from '../common/DataTable';
import { formatCurrency } from '../../utils/formatters';
import { Supplier } from '../../types';
import { exportToExcel, exportToCSV } from '../../utils/exportUtils';

interface PartySuppliersTabProps {
  onEditSupplier?: (supplier: Supplier) => void;
}

export const PartySuppliersTab: React.FC<PartySuppliersTabProps> = ({ onEditSupplier }) => {
  const { suppliers = [] } = useERP();

  const handleExportCSV = () => {
    const data = suppliers.map(s => ({
      'Supplier Name': s.name,
      'Phone': s.phone || '—',
      'GSTIN': s.gstin || 'Unregistered',
      'Payable Balance': s.currentOutstanding || 0,
      'Payment Terms': s.paymentTerms || 'Net 30',
      'State': s.state || '—'
    }));
    exportToCSV(data, 'Suppliers_Vendor_List');
  };

  const handleExportXLSX = () => {
    const data = suppliers.map(s => ({
      'Supplier Name': s.name,
      'Phone': s.phone || '—',
      'GSTIN': s.gstin || 'Unregistered',
      'Payable Balance': s.currentOutstanding || 0,
      'Payment Terms': s.paymentTerms || 'Net 30',
      'State': s.state || '—'
    }));
    exportToExcel(data, 'Suppliers_Vendor_List');
  };

  const columns: Column<Supplier>[] = [
    {
      key: 'name',
      header: 'Supplier / Vendor',
      render: row => (
        <div>
          <span className="font-semibold text-slate-900 block truncate max-w-xs">{row.name}</span>
          <span className="text-[10px] text-slate-400 font-mono">
            {row.phone ? `Ph: ${row.phone}` : ''} {row.gstin ? `• GSTIN: ${row.gstin}` : '• Unregistered'}
          </span>
        </div>
      )
    },
    {
      key: 'paymentTerms',
      header: 'Payment Terms',
      render: row => (
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
          {row.paymentTerms || 'Net 30'}
        </span>
      )
    },
    {
      key: 'totalPurchases',
      header: 'Lifetime Purchases',
      align: 'right',
      render: row => (
        <span className="font-mono text-slate-600 text-xs tabular-nums">
          {formatCurrency(row.totalPurchases || 0)}
        </span>
      )
    },
    {
      key: 'currentOutstanding',
      header: 'Payable Due',
      align: 'right',
      render: row => {
        const bal = row.currentOutstanding || 0;
        return (
          <span className={`font-mono font-bold tabular-nums ${bal > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
            {formatCurrency(bal)}
          </span>
        );
      }
    }
  ];

  return (
    <div className="space-y-4">
      {/* Action / Export Bar */}
      <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
        <span className="text-xs text-slate-500 font-medium">
          Total {suppliers.length} active registered supplier vendors
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>CSV</span>
          </button>
          <button
            onClick={handleExportXLSX}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Excel</span>
          </button>
        </div>
      </div>

      {/* Main Table */}
      <DataTable
        title="Supplier Vendor Registry"
        subtitle="Track vendor payables, supplier GSTINs, and procurement history"
        columns={columns}
        data={suppliers}
        searchPlaceholder="Search supplier name, phone, GSTIN..."
        searchKeys={['name', 'phone', 'gstin', 'email']}
        actions={row => (
          <div className="flex items-center gap-1">
            {onEditSupplier && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEditSupplier(row);
                }}
                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                title="Edit Supplier"
              >
                <Edit className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      />
    </div>
  );
};

