import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Plus,
  Eye,
  Trash2
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/rbac';
import { DataTable, Column } from '../../components/common/DataTable';
import { formatCurrency } from '../../utils/formatters';
import { Supplier } from '../../types';
import { AddSupplierModal } from '../../components/suppliers/AddSupplierModal';
import { supabase } from '../../lib/supabase';
import { enrichSuppliersWithDeliveryStatus } from '../../utils/supplierStatus';
import { isTableMarkedMissing, markTableMissing, isTableNotFoundError } from '../../utils/schemaDetector';

export const SuppliersPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { company: companyProfile, suppliers, purchaseRequests, addSupplier, deleteSupplier } = useERP();

  const [purchaseOrdersData, setPurchaseOrdersData] = useState<any[]>([]);

  // Fetch purchase orders for accurate delivery obligation tracking
  useEffect(() => {
    const targetCompId = companyProfile?.id || '00000000-0000-0000-0000-000000000001';
    const fetchOrders = async () => {
      if (!isTableMarkedMissing('purchase_orders')) {
        try {
          const { data: poData, error: poErr } = await supabase
            .from('purchase_orders')
            .select('*, purchase_order_items(*)')
            .eq('company_id', targetCompId);
          if (!poErr && poData) {
            setPurchaseOrdersData(poData);
            return;
          }
          if (poErr && isTableNotFoundError(poErr)) {
            markTableMissing('purchase_orders');
          }
        } catch (err) {
          if (isTableNotFoundError(err)) {
            markTableMissing('purchase_orders');
          }
        }
      }

      try {
        const { data: pData } = await supabase
          .from('purchases')
          .select('*')
          .eq('company_id', targetCompId)
          .eq('doc_type', 'purchase_order');
        if (pData) setPurchaseOrdersData(pData);
      } catch {}
    };
    fetchOrders();
  }, [companyProfile?.id]);

  // Dynamically enrich suppliers with automatic delivery status
  const suppliersWithStatus = useMemo(() => {
    return enrichSuppliersWithDeliveryStatus(suppliers, {
      purchaseOrders: purchaseOrdersData,
      purchaseRequests
    });
  }, [suppliers, purchaseOrdersData, purchaseRequests]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const columns: Column<Supplier>[] = [
    {
      key: 'company',
      header: 'Supplier / Company',
      width: '24%',
      render: row => {
        const hasDifferentContact = row.name && row.name.trim().toLowerCase() !== (row.company || '').trim().toLowerCase();
        return (
          <div className="min-w-0 pr-2">
            <span className="font-semibold text-slate-900 block truncate" title={row.company}>
              {row.company}
            </span>
            <span
              className="text-[10px] text-slate-400 font-mono block truncate"
              title={hasDifferentContact ? `Contact: ${row.name} • GSTIN: ${row.gstin || 'Unregistered'}` : `GSTIN: ${row.gstin || 'Unregistered'}`}
            >
              {hasDifferentContact ? `Contact: ${row.name} • ` : ''}GSTIN: {row.gstin || 'Unregistered'}
            </span>
          </div>
        );
      }
    },
    {
      key: 'phone',
      header: 'Phone',
      width: '10%',
      render: row => <span className="font-mono text-[11px] text-slate-700 block truncate">{row.phone || '—'}</span>
    },
    {
      key: 'email',
      header: 'Email',
      width: '13%',
      render: row => <span className="text-slate-500 text-xs truncate block" title={row.email || undefined}>{row.email || '—'}</span>
    },
    {
      key: 'currentOutstanding',
      header: 'Payable Balance',
      width: '14%',
      align: 'right',
      render: row => (
        <span className="font-semibold text-rose-600 font-sans tracking-tight">{formatCurrency(row.currentOutstanding)}</span>
      )
    },
    {
      key: 'totalPurchases',
      header: 'Total Purchases',
      width: '14%',
      align: 'right',
      render: row => (
        <span className="font-semibold text-slate-900 font-sans tracking-tight">{formatCurrency(row.totalPurchases)}</span>
      )
    },
    {
      key: 'creditDays',
      header: 'Credit Terms',
      width: '11%',
      align: 'center',
      render: row => (
        <span className="text-slate-600 font-medium whitespace-nowrap">{row.creditDays ? `${row.creditDays} Days` : '0 Days'}</span>
      )
    },
    {
      key: 'status',
      header: 'Delivery Status',
      width: '14%',
      align: 'center',
      render: row => (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${
          row.status === 'Active'
            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
            : 'bg-slate-100 text-slate-600 border border-slate-200'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            row.status === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
          }`} />
          <span>{row.status}</span>
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            Supplier Vendor Management & Payables
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Supplier vendor profiles, accounts payable balances, procurement histories and bank details.
          </p>
        </div>

        {hasPermission(profile?.role, 'suppliers', 'create') && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add New Supplier</span>
          </button>
        )}
      </div>

      <DataTable
        title="Supplier Vendor Registry"
        subtitle={`Total ${suppliers.length} vendors (${suppliersWithStatus.filter(s => s.status === 'Active').length} active deliveries)`}
        columns={columns}
        data={suppliersWithStatus}
        searchPlaceholder="Search supplier by company, contact person, phone, GSTIN..."
        searchKeys={['company', 'name', 'phone', 'email', 'gstin']}
        onRowClick={row => navigate(`/suppliers/${row.id}`)}
        selectable={false}
        hideHorizontalScroll={true}
        tableFixed={true}
        actions={row => (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => navigate(`/suppliers/${row.id}`)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50"
              title="View Supplier Profile"
            >
              <Eye className="w-4 h-4" />
            </button>
            {hasPermission(profile?.role, 'suppliers', 'delete') && (
              <button
                onClick={async e => {
                  e.stopPropagation();
                  if (window.confirm(`Delete supplier ${row.company || row.name}?`)) {
                    try {
                      await deleteSupplier(row.id);
                    } catch (err: any) {
                      alert(`Failed to delete supplier: ${err?.message || 'Error occurred'}`);
                    }
                  }
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      />

      {/* Add Supplier Modal */}
      <AddSupplierModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  );
};
