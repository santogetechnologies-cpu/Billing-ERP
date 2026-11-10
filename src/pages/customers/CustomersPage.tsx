import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
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
import { Customer, CustomerType } from '../../types';
import { CustomerFormModal } from '../../components/customers/CustomerFormModal';
import { CustomerViewModal } from '../../components/customers/CustomerViewModal';

export const CustomersPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { customers = [], deleteCustomer } = useERP();

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form modal state (Add / Edit)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);

  // View modal state
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [customerToView, setCustomerToView] = useState<Customer | null>(null);

  // Delete confirmation modal state
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleOpenAdd = () => {
    setCustomerToEdit(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (customer: Customer) => {
    setCustomerToEdit(customer);
    setIsFormModalOpen(true);
  };

  const handleOpenView = (customer: Customer) => {
    setCustomerToView(customer);
    setIsViewModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!customerToDelete) return;
    try {
      setIsDeleting(true);
      await deleteCustomer(customerToDelete.id);
      showToast(`Customer "${customerToDelete.name}" deleted successfully.`);
      setCustomerToDelete(null);
    } catch (err: any) {
      showToast(`Failed to delete customer: ${err?.message || 'Error occurred'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Unique customer types for filter
  const customerTypeOptions = useMemo(() => {
    const types = Array.from(new Set(customers.map(c => c.type || 'Retail')));
    return types.map(t => ({ label: t, value: t }));
  }, [customers]);

  // Columns definition
  const columns: Column<Customer>[] = [
    {
      key: 'name',
      header: 'Customer Name',
      sortable: true,
      width: '22%',
      render: row => (
        <div className="min-w-0 pr-2">
          <span className="font-semibold text-slate-900 dark:text-white block truncate" title={row.name}>
            {row.name}
          </span>
          <span className="text-[10px] text-slate-400 font-mono block truncate">
            {row.gstin ? `GSTIN: ${row.gstin}` : 'Unregistered'}
          </span>
        </div>
      )
    },
    {
      key: 'phone',
      header: 'Phone Number',
      sortable: true,
      width: '14%',
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
      width: '18%',
      render: row => (
        <span className="text-slate-500 text-xs truncate block" title={row.email || undefined}>
          {row.email || '—'}
        </span>
      )
    },
    {
      key: 'type',
      header: 'Customer Type',
      sortable: true,
      align: 'center',
      width: '14%',
      render: row => (
        <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
          {row.type || 'Retail'}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      align: 'center',
      width: '10%',
      render: row => (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${
            row.status === 'Active'
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              : row.status === 'Blocked'
              ? 'bg-rose-100 text-rose-800 border border-rose-200'
              : 'bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              row.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-400'
            }`}
          />
          <span>{row.status || 'Active'}</span>
        </span>
      )
    },
    {
      key: 'currentOutstanding',
      header: 'Receivable Due',
      sortable: true,
      align: 'right',
      width: '12%',
      render: row => {
        const bal = row.currentOutstanding || 0;
        return (
          <span
            className={`font-mono font-bold text-xs pr-3 block truncate ${
              bal > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {formatCurrency(bal)}
          </span>
        );
      }
    }
  ];

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between shadow-sm animate-fadeIn print:hidden no-print">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-emerald-600 hover:text-emerald-800 text-xs font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4.5 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs print:hidden no-print">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            Customer Details & Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Maintain customer accounts, contact details, classifications, credit terms, and receivable balances.
          </p>
        </div>

        {hasPermission(profile?.role, 'customers', 'create') && (
          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add New Customer</span>
          </button>
        )}
      </div>

      {/* Table: Full Vertical Scrolling instead of Pagination */}
      <DataTable
        title="Customer Directory"
        subtitle={`Total ${customers.length} customer records`}
        columns={columns}
        data={customers}
        searchPlaceholder="Search customers by customer name or phone number..."
        searchKeys={['name', 'phone', 'email', 'gstin']}
        filters={[
          {
            key: 'type',
            label: 'Customer Type',
            options: customerTypeOptions
          },
          {
            key: 'status',
            label: 'Status',
            options: [
              { label: 'Active', value: 'Active' },
              { label: 'Inactive', value: 'Inactive' },
              { label: 'Blocked', value: 'Blocked' }
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
            {/* View Complete Details */}
            <button
              type="button"
              onClick={() => handleOpenView(row)}
              className="p-1 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              title="View Customer Details"
            >
              <Eye className="w-4 h-4" />
            </button>

            {/* Edit Customer Details */}
            {hasPermission(profile?.role, 'customers', 'edit') && (
              <button
                type="button"
                onClick={() => handleOpenEdit(row)}
                className="p-1 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                title="Edit Customer"
              >
                <Edit className="w-4 h-4" />
              </button>
            )}

            {/* Delete Customer with Confirmation Popup */}
            {hasPermission(profile?.role, 'customers', 'delete') && (
              <button
                type="button"
                onClick={() => setCustomerToDelete(row)}
                className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                title="Delete Customer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      />

      {/* Add / Edit Form Modal */}
      <CustomerFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        customerToEdit={customerToEdit}
        onSuccess={msg => showToast(msg)}
      />

      {/* View Customer Details Modal */}
      <CustomerViewModal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        customer={customerToView}
        onEdit={c => handleOpenEdit(c)}
      />

      {/* Delete Confirmation Modal */}
      {customerToDelete && (
        <Modal
          isOpen={Boolean(customerToDelete)}
          onClose={() => setCustomerToDelete(null)}
          title="Delete Customer Confirmation"
          subtitle="Step Verification"
          size="sm"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setCustomerToDelete(null)}
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
                {isDeleting ? 'Deleting...' : 'Delete Customer'}
              </button>
            </div>
          }
        >
          <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-rose-800 dark:text-rose-300 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <div>
                <p className="font-bold">Are you sure you want to delete this customer?</p>
                <p className="mt-1 text-[11px] leading-relaxed">
                  Customer: <strong className="text-slate-900 dark:text-white">{customerToDelete.name}</strong>
                  {customerToDelete.phone && ` (${customerToDelete.phone})`}
                </p>
                <p className="mt-1 text-[10px] text-rose-700 dark:text-rose-400">
                  This action will permanently delete the customer record from the master database.
                </p>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
