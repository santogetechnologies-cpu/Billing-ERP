import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
  Plus,
  RotateCcw
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { hasPermission, canAccessRoute } from '../../utils/rbac';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { PurchaseInvoice } from '../../types';

export const PurchaseInvoicesPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { purchaseInvoices } = useERP();

  // Table Columns (6 defined + Checkbox column automatically managed by DataTable)
  const columns: Column<PurchaseInvoice>[] = [
    {
      key: 'invoiceNumber',
      header: 'Purchase Bill #',
      render: row => (
        <span className="font-mono font-bold text-blue-600">{row.invoiceNumber}</span>
      )
    },
    {
      key: 'date',
      header: 'Bill Date',
      render: row => formatDate(row.date)
    },
    {
      key: 'supplierName',
      header: 'Supplier / Vendor',
      render: row => (
        <div>
          <span className="font-semibold text-slate-800 block truncate max-w-[220px]">
            {row.supplierName}
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            GSTIN: {row.supplierGstin || 'Unregistered'}
          </span>
        </div>
      )
    },
    {
      key: 'grandTotal',
      header: 'Bill Value',
      align: 'right',
      render: row => (
        <span className="font-bold text-slate-900">{formatCurrency(row.grandTotal)}</span>
      )
    },
    {
      key: 'paidAmount',
      header: 'Paid Amount',
      align: 'right',
      render: row => (
        <span className="font-medium text-slate-600">{formatCurrency(row.paidAmount || 0)}</span>
      )
    },
    {
      key: 'paymentStatus',
      header: 'Payment Status',
      align: 'center',
      render: row => <StatusBadge status={row.paymentStatus} size="sm" />
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-indigo-600" />
            Purchases & Inward Goods Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Supplier purchase invoices, goods receipt notes (GRN), purchase orders and payables.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canAccessRoute(profile?.role, '/purchases/returns') && (
            <button
              onClick={() => navigate('/purchases/returns')}
              className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Purchase Returns</span>
            </button>
          )}

          {hasPermission(profile?.role, 'purchases', 'create') && (
            <button
              onClick={() => navigate('/purchases/new')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Purchase Bill</span>
            </button>
          )}
        </div>
      </div>

      {/* Supplier Purchase Bills Table */}
      <DataTable
        title="Supplier Purchase Bills"
        subtitle={`Total ${purchaseInvoices.length} purchase invoices recorded`}
        columns={columns}
        data={purchaseInvoices}
        searchPlaceholder="Search purchase bill #, supplier name, GSTIN..."
        searchKeys={['invoiceNumber', 'supplierName', 'supplierGstin', 'paymentStatus']}
        filters={[
          {
            key: 'paymentStatus',
            label: 'Payment Status',
            options: [
              { label: 'Paid', value: 'Paid' },
              { label: 'Partially Paid', value: 'Partially Paid' },
              { label: 'Unpaid', value: 'Unpaid' }
            ]
          }
        ]}
      />
    </div>
  );
};

export default PurchaseInvoicesPage;
