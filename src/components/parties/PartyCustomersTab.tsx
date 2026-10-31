import React, { useState } from 'react';
import {
  Users,
  Search,
  Download,
  Phone,
  Mail,
  Building,
  CreditCard,
  Edit,
  Trash2,
  FileText
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { DataTable, Column } from '../common/DataTable';
import { formatCurrency } from '../../utils/formatters';
import { Customer } from '../../types';
import { exportToExcel, exportToCSV } from '../../utils/exportUtils';

interface PartyCustomersTabProps {
  onEditCustomer?: (customer: Customer) => void;
  onViewStatement?: (customer: Customer) => void;
}

export const PartyCustomersTab: React.FC<PartyCustomersTabProps> = ({
  onEditCustomer,
  onViewStatement
}) => {
  const { customers = [] } = useERP();

  const retailAndWholesale = customers.filter(c => c.type !== 'Dealer');

  const handleExportCSV = () => {
    const data = retailAndWholesale.map(c => ({
      'Customer Name': c.name,
      'Type': c.type,
      'Phone': c.phone || '—',
      'GSTIN': c.gstin || 'Unregistered',
      'Outstanding Balance': c.currentOutstanding || 0,
      'Credit Limit': c.creditLimit || 0,
      'State': c.state || '—'
    }));
    exportToCSV(data, 'Customer_Ledger_List');
  };

  const handleExportXLSX = () => {
    const data = retailAndWholesale.map(c => ({
      'Customer Name': c.name,
      'Type': c.type,
      'Phone': c.phone || '—',
      'GSTIN': c.gstin || 'Unregistered',
      'Outstanding Balance': c.currentOutstanding || 0,
      'Credit Limit': c.creditLimit || 0,
      'State': c.state || '—'
    }));
    exportToExcel(data, 'Customer_Ledger_List');
  };

  const columns: Column<Customer>[] = [
    {
      key: 'name',
      header: 'Customer Name',
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
      key: 'type',
      header: 'Category',
      render: row => (
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
          {row.type || 'Retail'}
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
      header: 'Receivable Due',
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
          Total {retailAndWholesale.length} direct customer accounts
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
        title="Customer Directory"
        subtitle="Manage customer receivables, credit terms, and GST profiles"
        columns={columns}
        data={retailAndWholesale}
        searchPlaceholder="Search customer name, phone, GSTIN..."
        searchKeys={['name', 'phone', 'gstin', 'email']}
        actions={row => (
          <div className="flex items-center gap-1">
            {onEditCustomer && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEditCustomer(row);
                }}
                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                title="Edit Customer"
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

