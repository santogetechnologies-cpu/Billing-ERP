import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Plus,
  Eye,
  Edit,
  Trash2,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/rbac';
import { DataTable, Column } from '../../components/common/DataTable';
import { Modal } from '../../components/common/Modal';
import { formatCurrency } from '../../utils/formatters';
import { Supplier } from '../../types';
import { SupplierFormModal } from '../../components/suppliers/SupplierFormModal';
import { SupplierViewModal } from '../../components/suppliers/SupplierViewModal';
import { supabase } from '../../lib/supabase';
import { enrichSuppliersWithDeliveryStatus } from '../../utils/supplierStatus';
import { isTableMarkedMissing, markTableMissing, isTableNotFoundError } from '../../utils/schemaDetector';

export const SuppliersPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { company: companyProfile, suppliers = [], purchaseRequests = [], deleteSupplier } = useERP();

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form modal state (Add / Edit)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [supplierToEdit, setSupplierToEdit] = useState<Supplier | null>(null);

  // View modal state
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [supplierToView, setSupplierToView] = useState<Supplier | null>(null);

  // Delete confirmation modal state
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch purchase orders for delivery status tracking
  const [purchaseOrdersData, setPurchaseOrdersData] = useState<any[]>([]);

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

  // Dynamically enrich suppliers with delivery status while strictly preserving user-set master status
  const suppliersWithStatus = useMemo(() => {
    return enrichSuppliersWithDeliveryStatus(suppliers, {
      purchaseOrders: purchaseOrdersData,
      purchaseRequests,
      preserveSavedStatus: true
    });
  }, [suppliers, purchaseOrdersData, purchaseRequests]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleOpenAdd = () => {
    setSupplierToEdit(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (supplier: Supplier) => {
    setSupplierToEdit(supplier);
    setIsFormModalOpen(true);
  };

  const handleOpenView = (supplier: Supplier) => {
    setSupplierToView(supplier);
    setIsViewModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!supplierToDelete) return;
    try {
      setIsDeleting(true);
      await deleteSupplier(supplierToDelete.id);
      showToast(`Supplier "${supplierToDelete.company || supplierToDelete.name}" deleted successfully.`);
      setSupplierToDelete(null);
    } catch (err: any) {
      showToast(`Failed to delete supplier: ${err?.message || 'Error occurred'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: Column<Supplier>[] = [
    {
      key: 'company',
      header: 'Supplier Name',
      sortable: true,
      width: '19%',
      render: row => (
        <div className="min-w-0 pr-2">
          <span className="font-semibold text-slate-900 dark:text-white block truncate" title={row.company || row.name}>
            {row.company || row.name}
          </span>
          <span className="text-[10px] text-slate-400 font-mono block truncate">
            {row.name && row.name !== row.company ? `Contact: ${row.name}` : ''}
          </span>
        </div>
      )
    },
    {
      key: 'name',
      header: 'Contact Person',
      sortable: true,
      width: '13%',
      render: row => (
        <span className="text-slate-700 dark:text-slate-300 text-xs block truncate">
          {row.name || row.company || '—'}
        </span>
      )
    },
    {
      key: 'phone',
      header: 'Phone Number',
      sortable: true,
      width: '12%',
      render: row => (
        <span className="font-mono text-xs text-slate-700 dark:text-slate-300 block truncate">
          {row.phone || '—'}
        </span>
      )
    },
    {
      key: 'email',
      header: 'Email',
      sortable: true,
      width: '16%',
      render: row => (
        <span className="text-slate-500 text-xs truncate block" title={row.email || undefined}>
          {row.email || '—'}
        </span>
      )
    },
    {
      key: 'gstin',
      header: 'GST Number',
      sortable: true,
      width: '12%',
      render: row => (
        <span className="font-mono text-xs uppercase font-medium text-slate-800 dark:text-slate-200 block truncate">
          {row.gstin || 'Unregistered'}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      align: 'center',
      width: '8%',
      render: row => (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${
            row.status === 'Active'
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              : 'bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              row.status === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
            }`}
          />
          <span>{row.status || 'Active'}</span>
        </span>
      )
    },
    {
      key: 'currentOutstanding',
      header: 'Payable Balance',
      sortable: true,
      align: 'right',
      width: '10%',
      render: row => (
        <span className="font-mono font-bold text-xs text-rose-600 dark:text-rose-400 pr-2.5 block truncate">
          {formatCurrency(row.currentOutstanding || 0)}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-emerald-600 hover:text-emerald-800 text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4.5 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            Supplier Details & Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Maintain supplier vendor profiles, contact persons, phone numbers, addresses, GSTIN master, and accounts payable balances.
          </p>
        </div>

        {hasPermission(profile?.role, 'suppliers', 'create') && (
          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add New Supplier</span>
          </button>
        )}
      </div>

      {/* Table: Full Vertical Scrolling instead of Pagination */}
      <DataTable
        title="Supplier Vendor Directory"
        subtitle={`Total ${suppliers.length} vendors (${suppliersWithStatus.filter(s => s.status === 'Active').length} active)`}
        columns={columns}
        data={suppliersWithStatus}
        searchPlaceholder="Search suppliers by supplier name or phone number..."
        searchKeys={['company', 'name', 'phone', 'email', 'gstin']}
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: [
              { label: 'Active', value: 'Active' },
              { label: 'Inactive', value: 'Inactive' }
            ]
          }
        ]}
        enablePagination={false}
        selectable={false}
        hideHorizontalScroll={true}
        tableFixed={true}
        actionsWidth="10%"
        actions={row => (
          <div className="flex items-center justify-end gap-1 shrink-0">
            {/* View Complete Supplier Details */}
            <button
              type="button"
              onClick={() => handleOpenView(row)}
              className="p-1 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              title="View Supplier Details"
            >
              <Eye className="w-4 h-4" />
            </button>

            {/* Edit Existing Supplier Details */}
            {hasPermission(profile?.role, 'suppliers', 'edit') && (
              <button
                type="button"
                onClick={() => handleOpenEdit(row)}
                className="p-1 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                title="Edit Supplier"
              >
                <Edit className="w-4 h-4" />
              </button>
            )}

            {/* Delete Supplier with Confirmation Popup */}
            {hasPermission(profile?.role, 'suppliers', 'delete') && (
              <button
                type="button"
                onClick={() => setSupplierToDelete(row)}
                className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                title="Delete Supplier"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      />

      {/* Add / Edit Form Modal */}
      <SupplierFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        supplierToEdit={supplierToEdit}
        onSuccess={msg => showToast(msg)}
      />

      {/* View Supplier Details Modal */}
      <SupplierViewModal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        supplier={suppliersWithStatus.find(s => s.id === supplierToView?.id) || suppliers.find(s => s.id === supplierToView?.id) || supplierToView}
        onEdit={s => handleOpenEdit(s)}
      />

      {/* Delete Confirmation Modal */}
      {supplierToDelete && (
        <Modal
          isOpen={Boolean(supplierToDelete)}
          onClose={() => setSupplierToDelete(null)}
          title="Delete Supplier Confirmation"
          subtitle="Step Verification"
          size="sm"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setSupplierToDelete(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete Supplier'}
              </button>
            </div>
          }
        >
          <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-rose-800 dark:text-rose-300 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <div>
                <p className="font-bold">Are you sure you want to delete this supplier?</p>
                <p className="mt-1 text-[11px] leading-relaxed">
                  Supplier: <strong className="text-slate-900 dark:text-white">{supplierToDelete.company || supplierToDelete.name}</strong>
                  {supplierToDelete.phone && ` (${supplierToDelete.phone})`}
                </p>
                <p className="mt-1 text-[10px] text-rose-700 dark:text-rose-400">
                  This action will permanently delete the supplier record from the master database.
                </p>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
