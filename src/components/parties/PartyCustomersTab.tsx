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
  FileText,
  MessageCircle,
  QrCode
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
  const { customers = [], company } = useERP();

  const retailAndWholesale = customers.filter(c => c.type !== 'Dealer');

  const handleSendWhatsAppReminder = (customer: Customer) => {
    if (!customer.phone) {
      alert(`Customer ${customer.name} does not have a phone number registered.`);
      return;
    }
    const cleanPhone = customer.phone.replace(/[^0-9]/g, '');
    const phoneWithCode = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const balance = customer.currentOutstanding || 0;
    const storeName = company?.name || 'Our Store';
    const upiId = company?.upiId || '';

    let text = `*Payment Reminder from ${storeName}*\n\nDear *${customer.name}*,\nThis is a friendly reminder that your outstanding balance on your ledger account is *${formatCurrency(balance)}*.\n`;
    if (upiId && balance > 0) {
      const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(storeName)}&am=${balance}&cu=INR`;
      text += `\n*Quick Online Pay (UPI):*\n• UPI ID: ${upiId}\n• Direct UPI Pay Link: ${upiUrl}\n`;
    }
    text += `\nPlease clear this payment at your earliest convenience or share the payment slip if already paid.\n\nThank you for choosing *${storeName}*!`;

    const waUrl = `https://wa.me/${phoneWithCode}?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

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
            {row.phone && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSendWhatsAppReminder(row);
                }}
                className={`p-1.5 rounded cursor-pointer transition-colors ${
                  (row.currentOutstanding || 0) > 0
                    ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-800 font-medium'
                    : 'text-slate-400 hover:text-emerald-600 hover:bg-slate-100'
                }`}
                title={`Send WhatsApp Khata Reminder (${formatCurrency(row.currentOutstanding || 0)})`}
              >
                <MessageCircle className="w-3.5 h-3.5" />
              </button>
            )}
            {onViewStatement && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onViewStatement(row);
                }}
                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded cursor-pointer"
                title="View Statement & Ledgers"
              >
                <FileText className="w-3.5 h-3.5" />
              </button>
            )}
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

