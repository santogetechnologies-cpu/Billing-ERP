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
      <div className="relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4 sm:px-6 sm:py-5 rounded-2xl border border-blue-200/60 dark:border-blue-900/40 bg-gradient-to-r from-[#f8fbff] via-[#f0f6ff] to-[#e8f1fd] dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/40 shadow-2xs print:hidden no-print">
        {/* Subtle curved wave pattern on the right side */}
        <div className="absolute right-0 top-0 bottom-0 w-full sm:w-1/2 pointer-events-none overflow-hidden select-none" aria-hidden="true">
          <svg className="absolute right-0 top-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 400 100" fill="none">
            <path d="M120 0 C180 40, 160 80, 260 100 L400 100 L400 0 Z" fill="#dbeafe" fillOpacity="0.45" />
            <path d="M220 0 C260 35, 240 70, 330 100 L400 100 L400 0 Z" fill="#eff6ff" fillOpacity="0.6" />
          </svg>
        </div>

        {/* Left Column: Icon, Title & Subtitle */}
        <div className="relative z-10">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            Customer Details &amp; Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Maintain customer accounts, contact details, classifications, credit terms, and receivable balances.
          </p>
        </div>

        {/* Right Column: Customer Management Illustration & Add Button */}
        <div className="flex items-center gap-4 sm:gap-6 shrink-0 relative z-10 self-start sm:self-auto">
          {/* Customer Management 3D Illustration */}
          <div className="hidden sm:flex items-center justify-center shrink-0 -my-2 select-none pointer-events-none drop-shadow-xs" aria-hidden="true">
            <svg width="105" height="82" viewBox="0 0 110 85" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Grounding Shadow */}
              <ellipse cx="60" cy="78" rx="46" ry="4" fill="#bfdbfe" fillOpacity="0.55" />

              {/* 1. Customer Profile Card */}
              <g id="customer-card">
                {/* Outer Card Frame */}
                <rect x="16" y="14" width="46" height="62" rx="6" fill="#2563eb" />
                {/* Inner Sheet */}
                <rect x="18" y="16" width="42" height="58" rx="4" fill="#ffffff" />

                {/* Top Clip Arch / Loop */}
                <path d="M34 14 C34 8 44 8 44 14" stroke="#1d4ed8" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                {/* Top Clamp Bar */}
                <rect x="29" y="12" width="20" height="7" rx="2" fill="#1e40af" />
                <circle cx="39" cy="15.5" r="1.5" fill="#ffffff" opacity="0.9" />

                {/* Customer Avatar Badge on Card */}
                <circle cx="39" cy="30" r="8.5" fill="#eff6ff" stroke="#bfdbfe" strokeWidth="1" />
                <circle cx="39" cy="28" r="3.2" fill="#2563eb" />
                <path d="M33.5 36.5 C33.5 33 36 33 39 33 C42 33 44.5 33 44.5 36.5" fill="#2563eb" />

                {/* Contact & Detail Lines */}
                {/* Line 1 */}
                <circle cx="24" cy="44" r="2" fill="#3b82f6" />
                <line x1="29" y1="44" x2="52" y2="44" stroke="#93c5fd" strokeWidth="2.5" strokeLinecap="round" />

                {/* Line 2 */}
                <circle cx="24" cy="52" r="2" fill="#3b82f6" />
                <line x1="29" y1="52" x2="49" y2="52" stroke="#93c5fd" strokeWidth="2.5" strokeLinecap="round" />

                {/* Line 3 */}
                <circle cx="24" cy="60" r="2" fill="#3b82f6" />
                <line x1="29" y1="60" x2="45" y2="60" stroke="#93c5fd" strokeWidth="2.5" strokeLinecap="round" />
              </g>

              {/* 2. Amber / Gold User Figure (Right) */}
              <g id="amber-user">
                <circle cx="78" cy="52" r="7.5" fill="#f59e0b" />
                <ellipse cx="76" cy="49" rx="2.5" ry="1.5" fill="#fde68a" opacity="0.8" />
                <path d="M68 76 C68 67 72 63 78 63 C84 63 88 67 88 76 Z" fill="#d97706" />
                <path d="M71 74 C72 68 75 65 78 65" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7" />
              </g>

              {/* 3. Blue User Figure (Front Left) */}
              <g id="blue-user">
                <circle cx="62" cy="54" r="8" fill="#3b82f6" />
                <ellipse cx="60" cy="51" rx="2.5" ry="1.5" fill="#93c5fd" opacity="0.8" />
                <path d="M50 76 C50 67 55 64 62 64 C69 64 74 67 74 76 Z" fill="#2563eb" />
                <path d="M53 74 C54 68 58 66 62 66" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7" />
              </g>
            </svg>
          </div>

          {hasPermission(profile?.role, 'customers', 'create') && (
            <button
              type="button"
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm shadow-blue-500/25 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add New Customer</span>
            </button>
          )}
        </div>
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
