import React from 'react';
import {
  Building,
  Search,
  Download,
  Phone,
  Mail,
  Edit,
  Tag,
  CreditCard
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { DataTable, Column } from '../common/DataTable';
import { formatCurrency } from '../../utils/formatters';
import { Customer } from '../../types';
import { exportToExcel, exportToCSV } from '../../utils/exportUtils';

interface PartyDealersTabProps {
  onEditDealer?: (dealer: Customer) => void;
}

export const PartyDealersTab: React.FC<PartyDealersTabProps> = ({ onEditDealer }) => {
  const { customers = [] } = useERP();

  const dealers = customers.filter(c => c.type === 'Dealer');

  const handleExportCSV = () => {
    const data = dealers.map(d => ({
      'Dealer Shop Name': d.name,
      'Phone': d.phone || '—',
      'GSTIN': d.gstin || 'Unregistered',
      'Receivable Balance': d.currentOutstanding || 0,
      'Credit Limit': d.creditLimit || 0,
      'Credit Days': d.creditDays || 30,
      'State': d.state || '—'
    }));
    exportToCSV(data, 'Dealer_Shops_Registry');
  };

  const handleExportXLSX = () => {
    const data = dealers.map(d => ({
      'Dealer Shop Name': d.name,
      'Phone': d.phone || '—',
      'GSTIN': d.gstin || 'Unregistered',
      'Receivable Balance': d.currentOutstanding || 0,
      'Credit Limit': d.creditLimit || 0,
      'Credit Days': d.creditDays || 30,
      'State': d.state || '—'
    }));
    exportToExcel(data, 'Dealer_Shops_Registry');
  };

  const columns: Column<Customer>[] = [
    {
      key: 'name',
      header: 'Shop / Dealer Account',
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
      key: 'creditDays',
      header: 'Credit Terms',
      render: row => (
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
          Net {row.creditDays || 30} Days
        </span>
      )
    },
    {
      key: 'creditLimit',
      header: 'Credit Limit',
      align: 'right',
      render: row => (
        <span className="font-mono text-slate-600 text-xs tabular-nums">
          {row.creditLimit ? formatCurrency(row.creditLimit) : 'No Limit'}
        </span>
      )
    },
    {
      key: 'currentOutstanding',
      header: 'Current Due',
      align: 'right',
      render: row => {
        const bal = row.currentOutstanding || 0;
        return (
          <span className={`font-mono font-bold tabular-nums ${bal > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {formatCurrency(bal)}
          </span>
        );
      }
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: row => (
        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
          row.status === 'Active'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-slate-100 text-slate-700'
        }`}>
          {row.status || 'Active'}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-4">
      {/* Action / Export Bar */}
      <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
        <span className="text-xs text-slate-500 font-medium">
          Total {dealers.length} registered shops, dealers, and franchise partners
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
        title="B2B Shop & Dealer Directory"
        subtitle="Wholesale trade partners with dealer price list access"
        columns={columns}
        data={dealers}
        searchPlaceholder="Search dealer name, phone, GSTIN..."
        searchKeys={['name', 'phone', 'gstin', 'email']}
        actions={row => (
          <div className="flex items-center gap-1">
            {onEditDealer && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEditDealer(row);
                }}
                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                title="Edit Dealer"
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

