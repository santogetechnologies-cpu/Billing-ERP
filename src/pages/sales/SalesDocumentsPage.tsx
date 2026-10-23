import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Plus,
  Printer,
  Eye,
  CheckCircle,
  FileCheck,
  Send,
  Truck,
  RotateCcw,
  Receipt
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { SalesInvoice, SalesDocType } from '../../types';
import { InvoicePrintModal } from '../../components/invoice/InvoicePrintModal';

export const SalesDocumentsPage: React.FC = () => {
  const navigate = useNavigate();
  const { salesInvoices } = useERP();
  const [activeTab, setActiveTab] = useState<string>('all');
  const [selectedDoc, setSelectedDoc] = useState<SalesInvoice | null>(null);
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  const docTypes = [
    { id: 'all', label: 'All Documents' },
    { id: 'quotation', label: 'Quotations' },
    { id: 'estimate', label: 'Estimates' },
    { id: 'sales_order', label: 'Sales Orders' },
    { id: 'proforma_invoice', label: 'Proforma Invoices' },
    { id: 'delivery_challan', label: 'Delivery Challans' },
    { id: 'credit_note', label: 'Credit Notes' }
  ];

  // Real documents from ERP Context
  const allDocuments = salesInvoices;

  const filteredDocs = allDocuments.filter(d => {
    if (activeTab === 'all') return true;
    return d.docType === activeTab;
  });

  const columns: Column<SalesInvoice>[] = [
    {
      key: 'invoiceNumber',
      header: 'Document #',
      render: row => (
        <span className="font-mono font-bold text-blue-600 hover:underline">
          {row.invoiceNumber}
        </span>
      )
    },
    {
      key: 'docType',
      header: 'Type',
      align: 'center',
      render: row => (
        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 capitalize">
          {row.docType.replace('_', ' ')}
        </span>
      )
    },
    {
      key: 'date',
      header: 'Date',
      render: row => formatDate(row.date)
    },
    {
      key: 'customerName',
      header: 'Customer',
      render: row => (
        <span className="font-semibold text-slate-800 block truncate max-w-[220px]">
          {row.customerName}
        </span>
      )
    },
    {
      key: 'items',
      header: 'Items',
      align: 'center',
      render: row => (
        <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full bg-slate-100 font-mono font-bold text-slate-700 text-xs whitespace-nowrap">
          {row.items?.length || 0}
        </span>
      )
    },
    {
      key: 'grandTotal',
      header: 'Value',
      align: 'right',
      render: row => (
        <span className="font-bold text-slate-900">{formatCurrency(row.grandTotal)}</span>
      )
    },
    {
      key: 'paymentStatus',
      header: 'Status',
      align: 'center',
      render: row => <StatusBadge status={row.paymentStatus} size="sm" />
    }
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Commercial Sales Documents
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage Quotations, Estimates, Orders, Proforma, Delivery Challans, and Credit Notes.
          </p>
        </div>

        <button
          onClick={() => navigate('/sales/new')}
          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Document</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto bg-white p-1.5 rounded-xl border border-slate-200">
        {docTypes.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === t.id
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Documents Table */}
      <DataTable
        title="Sales Documents"
        columns={columns}
        data={filteredDocs}
        searchPlaceholder="Search document number, customer..."
        searchKeys={['invoiceNumber', 'customerName', 'docType']}
        onRowClick={row => {
          setSelectedDoc(row);
          setIsPrintOpen(true);
        }}
        actions={row => (
          <button
            onClick={() => {
              setSelectedDoc(row);
              setIsPrintOpen(true);
            }}
            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50"
            title="Print Document"
          >
            <Printer className="w-4 h-4" />
          </button>
        )}
      />

      {/* Print Modal */}
      <InvoicePrintModal
        invoice={selectedDoc}
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
      />
    </div>
  );
};
