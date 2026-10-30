import React, { useState, useMemo } from 'react';
import {
  RotateCcw,
  Boxes,
  Search,
  Filter,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  CreditCard,
  Building,
  AlertTriangle,
  FileText,
  Eye,
  Edit2,
  Info,
  DollarSign,
  Package,
  ArrowRight,
  ShieldCheck,
  Check,
  Tag,
  Calendar,
  Save
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import {
  CustomerReturn,
  CreateCustomerReturnInput,
  UpdateCustomerReturnInput,
  CustomerReturnCondition,
  CustomerReturnStatus,
  CustomerReturnRefundStatus,
  SalesInvoice,
  InvoiceItem
} from '../../types';
import { formatCurrency, formatDate, formatNumber } from '../../utils/formatters';
import { Modal } from '../../components/common/Modal';

// Formats date with time for detailed audit views
const formatDateTime = (dateStr?: string): string => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const dateFormatted = d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    if (dateStr.length <= 10) {
      return dateFormatted;
    }
    const timeFormatted = d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    return `${dateFormatted} at ${timeFormatted}`;
  } catch {
    return dateStr;
  }
};

// Formats detailed stock status and quarantine explanation
const getStockUpdateStatus = (ret: CustomerReturn): { label: string; badgeClass: string; description: string } => {
  if (ret.returnStatus === 'Stock Restocked' || ret.restockedAt) {
    if (ret.condition === 'Resalable') {
      return {
        label: 'Stock Restocked',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        description: `Added +${formatNumber(ret.returnedQty)} ${ret.unit || 'Piece'} to available warehouse stock.`
      };
    } else {
      return {
        label: 'Quarantined (Non-Sellable)',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
        description: `Logged in quarantine ledger (${ret.condition}). Sellable stock was preserved.`
      };
    }
  }
  if (ret.returnStatus === 'Approved') {
    return {
      label: 'Awaiting Warehouse Restock',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
      description: 'Approved by manager. Awaiting physical intake at warehouse.'
    };
  }
  if (ret.returnStatus === 'Rejected') {
    return {
      label: 'Not Restocked (Rejected)',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
      description: 'Return request rejected. Inventory stock was not modified.'
    };
  }
  return {
    label: 'Pending Inspection',
    badgeClass: 'bg-slate-50 text-slate-700 border-slate-200',
    description: 'Awaiting inspection. Available inventory is currently unchanged.'
  };
};

export const CustomerReturnsPage: React.FC = () => {
  const {
    customerReturns,
    salesInvoices,
    products,
    warehouses,
    addCustomerReturn,
    updateCustomerReturn,
    approveCustomerReturn,
    rejectCustomerReturn,
    restockCustomerReturn,
    refundCustomerReturn
  } = useERP();
  const { profile } = useAuth();

  const userRole = profile?.role || 'Admin';
  const isSalesperson = userRole === 'Salesperson';
  const isCashier = userRole === 'Cashier';
  const isWarehouseManager = userRole === 'Warehouse Manager';
  const isOwnerOrAdmin = userRole === 'Owner' || userRole === 'Admin';

  // Authorization flags
  const canApproveOrReject = isOwnerOrAdmin;
  const canRestock = isOwnerOrAdmin || isWarehouseManager;
  const canRefund = isOwnerOrAdmin || isCashier;
  const canCreateReturn = true; // Salesperson, Warehouse Manager, Cashier, Owner, Admin
  const canEditReturn = isSalesperson || isOwnerOrAdmin;

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'REFUNDED'>('ALL');
  const [conditionFilter, setConditionFilter] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Modals & Record Detail Lookup
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [modalInvoiceSearch, setModalInvoiceSearch] = useState('');
  const [inspectingReturnId, setInspectingReturnId] = useState<string | null>(null);

  // Fetch full details of the return record by its unique record ID
  const inspectingReturn = useMemo(() => {
    if (!inspectingReturnId) return null;
    return customerReturns.find(r => r.id === inspectingReturnId) || null;
  }, [inspectingReturnId, customerReturns]);

  const setInspectingReturn = (ret: CustomerReturn | null) => {
    setInspectingReturnId(ret ? ret.id : null);
  };

  const [restockTarget, setRestockTarget] = useState<CustomerReturn | null>(null);
  const [selectedRestockWarehouseId, setSelectedRestockWarehouseId] = useState<string>('');
  const [refundTarget, setRefundTarget] = useState<CustomerReturn | null>(null);
  const [refundMethod, setRefundMethod] = useState<string>('Bank');
  const [refundAmountInput, setRefundAmountInput] = useState<string>('');
  const [rejectTarget, setRejectTarget] = useState<CustomerReturn | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Return State (Integrated into View Details modal)
  const [isEditingInspect, setIsEditingInspect] = useState(false);
  const [editingReturn, setEditingReturn] = useState<CustomerReturn | null>(null);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerPhone, setEditCustomerPhone] = useState('');
  const [editReturnedQty, setEditReturnedQty] = useState('');
  const [editReason, setEditReason] = useState('Customer Return');
  const [editCondition, setEditCondition] = useState<CustomerReturnCondition>('Resalable');
  const [editWarehouseId, setEditWarehouseId] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Activates editing mode directly within the View Return Details form
  const startEditingInspect = (ret: CustomerReturn) => {
    setEditingReturn(ret);
    setEditCustomerName(ret.customerName || '');
    setEditCustomerPhone(ret.customerPhone || '');
    setEditReturnedQty(String(ret.returnedQty || ''));
    setEditReason(ret.reason || 'Customer Return');
    setEditCondition(ret.condition || 'Resalable');
    setEditWarehouseId(ret.warehouseId || warehouses[0]?.id || '');
    setEditNotes(ret.notes || '');
    setEditError(null);
    setIsEditingInspect(true);
  };

  const cancelEditingInspect = () => {
    setIsEditingInspect(false);
    setEditError(null);
  };

  const handleCloseInspect = () => {
    if (!isSavingEdit) {
      setInspectingReturn(null);
      setIsEditingInspect(false);
      setEditingReturn(null);
      setEditError(null);
    }
  };

  // Keep handleOpenEditModal for programmatic triggers, which now opens in-form editing
  const handleOpenEditModal = (ret: CustomerReturn) => {
    setInspectingReturn(ret);
    startEditingInspect(ret);
  };

  const targetEditingReturn = editingReturn || inspectingReturn;

  // Max eligible quantity for return being edited (cannot exceed soldQty minus OTHER valid returns)
  const editingReturnMaxEligible = useMemo(() => {
    if (!targetEditingReturn) return 0;
    const otherReturnsSum = customerReturns
      .filter(r => r.originalInvoiceId === targetEditingReturn.originalInvoiceId &&
                   r.productId === targetEditingReturn.productId &&
                   r.id !== targetEditingReturn.id &&
                   r.returnStatus !== 'Rejected')
      .reduce((sum, r) => sum + Number(r.returnedQty || 0), 0);
    return Math.max(0, targetEditingReturn.soldQty - otherReturnsSum);
  }, [targetEditingReturn, customerReturns]);

  // Live stock delta adjustment preview for the edit form
  const editingStockDeltaPreview = useMemo(() => {
    if (!targetEditingReturn) return { delta: 0, explanation: '', isRestocked: false };
    const isRestocked = targetEditingReturn.returnStatus === 'Stock Restocked' || Boolean(targetEditingReturn.restockedAt);
    if (!isRestocked) {
      return {
        delta: 0,
        explanation: 'This return is pending and has not updated warehouse stock yet. Edits will not alter live stock balances.',
        isRestocked: false
      };
    }

    const oldSellable = targetEditingReturn.condition === 'Resalable' ? Number(targetEditingReturn.returnedQty || 0) : 0;
    const newQty = Number(editReturnedQty) || 0;
    const newSellable = editCondition === 'Resalable' ? newQty : 0;
    const delta = newSellable - oldSellable;

    let explanation = '';
    if (delta > 0) {
      explanation = `+${delta} ${targetEditingReturn.unit || 'Piece'} will be added to available inventory stock.`;
    } else if (delta < 0) {
      explanation = `${delta} ${targetEditingReturn.unit || 'Piece'} will be deducted from available inventory stock.`;
    } else {
      explanation = 'No net change in sellable stock balance.';
    }

    if (targetEditingReturn.warehouseId && editWarehouseId && targetEditingReturn.warehouseId !== editWarehouseId) {
      const oldWh = warehouses.find(w => w.id === targetEditingReturn.warehouseId)?.name || 'Previous Godown';
      const newWh = warehouses.find(w => w.id === editWarehouseId)?.name || 'New Godown';
      explanation += ` Stock will be moved from ${oldWh} to ${newWh}.`;
    }

    return { delta, explanation, isRestocked: true };
  }, [targetEditingReturn, editReturnedQty, editCondition, editWarehouseId, warehouses]);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeReturn = editingReturn || inspectingReturn;
    if (!activeReturn || isSavingEdit) return;
    setEditError(null);

    const qty = Number(editReturnedQty);
    if (isNaN(qty) || qty <= 0) {
      setEditError('Returned quantity must be greater than zero.');
      return;
    }
    if (qty > editingReturnMaxEligible) {
      setEditError(
        `Returned quantity (${qty}) cannot exceed maximum allowed (${editingReturnMaxEligible}). Original sold: ${activeReturn.soldQty}.`
      );
      return;
    }
    if (!editCustomerName.trim()) {
      setEditError('Customer name cannot be empty.');
      return;
    }

    setIsSavingEdit(true);
    try {
      const selectedWh = warehouses.find(w => w.id === editWarehouseId);
      const input: UpdateCustomerReturnInput = {
        customerName: editCustomerName.trim(),
        customerPhone: editCustomerPhone.trim() || undefined,
        returnedQty: qty,
        reason: editReason,
        condition: editCondition,
        warehouseId: editWarehouseId || undefined,
        warehouseName: selectedWh?.name || activeReturn.warehouseName,
        notes: editNotes.trim() || undefined
      };

      const result = await updateCustomerReturn(activeReturn.id, input);
      showToast(`Return ${activeReturn.returnNumber} updated successfully.`);
      const updated = result;
      setEditingReturn(updated);
      setIsEditingInspect(false);
      if (inspectingReturnId === updated.id) {
        setInspectingReturn(updated);
      }
    } catch (err: any) {
      console.error('Failed to update customer return:', err);
      setEditError(err.message || 'Failed to update return. Please check inventory stock levels and try again.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };


  // ---------------------------------------------------------------------------
  // Filtered Returns List
  // ---------------------------------------------------------------------------
  const filteredReturns = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return customerReturns.filter(r => {
      // 1. Text Search
      if (q) {
        const matchNum = r.returnNumber.toLowerCase().includes(q);
        const matchInv = r.originalInvoiceNumber.toLowerCase().includes(q);
        const matchCust = r.customerName.toLowerCase().includes(q);
        const matchPhone = r.customerPhone ? r.customerPhone.toLowerCase().includes(q) : false;
        const matchProd = r.productName.toLowerCase().includes(q);
        const matchSku = r.sku ? r.sku.toLowerCase().includes(q) : false;
        const matchBarcode = r.barcode ? r.barcode.toLowerCase().includes(q) : false;
        if (!matchNum && !matchInv && !matchCust && !matchPhone && !matchProd && !matchSku && !matchBarcode) {
          return false;
        }
      }

      // 2. Status Filter
      if (statusFilter === 'PENDING') {
        if (isSalesperson) return false;
        if (r.returnStatus !== 'Pending Review') return false;
      }
      if (statusFilter === 'APPROVED') {
        const isApprovedStatus = r.returnStatus === 'Approved' || r.returnStatus === 'Stock Restocked' || (isSalesperson && r.returnStatus !== 'Rejected');
        if (!isApprovedStatus) return false;
      }
      if (statusFilter === 'REJECTED' && r.returnStatus !== 'Rejected') return false;
      if (statusFilter === 'COMPLETED' && r.returnStatus !== 'Stock Restocked') return false;
      if (statusFilter === 'REFUNDED' && r.refundStatus !== 'Refunded') return false;

      // 3. Condition Filter
      if (conditionFilter !== 'ALL' && r.condition !== conditionFilter) return false;

      // 4. Date Range Filter
      if (startDate) {
        const retDate = (r.returnDate || '').split('T')[0];
        if (retDate < startDate) return false;
      }
      if (endDate) {
        const retDate = (r.returnDate || '').split('T')[0];
        if (retDate > endDate) return false;
      }

      return true;
    });
  }, [customerReturns, searchQuery, statusFilter, conditionFilter, startDate, endDate]);

  // ---------------------------------------------------------------------------
  // Create Return Form State
  // ---------------------------------------------------------------------------
  const eligibleInvoices = useMemo(() => {
    return salesInvoices.filter(inv => inv.docType !== 'credit_note');
  }, [salesInvoices]);

  const searchedEligibleInvoices = useMemo(() => {
    const q = modalInvoiceSearch.toLowerCase().trim();
    if (!q) return eligibleInvoices;
    return eligibleInvoices.filter(inv =>
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.customerName.toLowerCase().includes(q) ||
      (inv.customerPhone && inv.customerPhone.toLowerCase().includes(q))
    );
  }, [eligibleInvoices, modalInvoiceSearch]);

  const [formInvoiceId, setFormInvoiceId] = useState('');
  const [formProductId, setFormProductId] = useState('');
  const [formReturnedQty, setFormReturnedQty] = useState('');
  const [formReason, setFormReason] = useState('Customer Return');
  const [formCondition, setFormCondition] = useState<CustomerReturnCondition>('Resalable');
  const [formWarehouseId, setFormWarehouseId] = useState('');
  const [formReturnDate, setFormReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Selected Invoice object
  const selectedInvoice = useMemo(() => {
    return eligibleInvoices.find(inv => inv.id === formInvoiceId);
  }, [eligibleInvoices, formInvoiceId]);

  // Items from selected invoice
  const invoiceItems = useMemo(() => {
    return selectedInvoice?.items || [];
  }, [selectedInvoice]);

  // Selected Item on the invoice
  const selectedItem = useMemo(() => {
    return invoiceItems.find(it => it.productId === formProductId);
  }, [invoiceItems, formProductId]);

  // Selected Product Master record (for live current stock display)
  const selectedProductMaster = useMemo(() => {
    return products.find(p => p.id === formProductId);
  }, [products, formProductId]);

  // Calculate remaining eligible return quantity for selected product
  const remainingEligibleQty = useMemo(() => {
    if (!selectedInvoice || !selectedItem) return 0;
    const previousReturns = customerReturns
      .filter(r => r.originalInvoiceId === selectedInvoice.id && r.productId === selectedItem.productId && r.returnStatus !== 'Rejected')
      .reduce((sum, r) => sum + Number(r.returnedQty || 0), 0);

    return Math.max(0, selectedItem.qty - previousReturns);
  }, [selectedInvoice, selectedItem, customerReturns]);

  // Reset form when invoice changes
  const handleInvoiceChange = (invId: string) => {
    setFormInvoiceId(invId);
    const inv = eligibleInvoices.find(i => i.id === invId);
    if (inv && inv.items.length > 0) {
      setFormProductId(inv.items[0].productId);
      setFormReturnedQty('1');
      if (inv.warehouseId) {
        setFormWarehouseId(inv.warehouseId);
      } else if (warehouses.length > 0) {
        const def = warehouses.find(w => w.isDefault) || warehouses[0];
        setFormWarehouseId(def.id);
      }
    } else {
      setFormProductId('');
      setFormReturnedQty('');
    }
    setFormError(null);
  };

  const handleOpenCreateModal = () => {
    setModalInvoiceSearch('');
    if (eligibleInvoices.length > 0) {
      handleInvoiceChange(eligibleInvoices[0].id);
    }
    setFormReturnDate(new Date().toISOString().split('T')[0]);
    setFormCondition('Resalable');
    setFormReason('Customer Return');
    setFormNotes('');
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setFormError(null);

    if (!selectedInvoice || !selectedItem) {
      setFormError('Please select a valid original invoice and product item.');
      return;
    }

    const qty = Number(formReturnedQty);
    if (isNaN(qty) || qty <= 0) {
      setFormError('Returned quantity must be greater than zero.');
      return;
    }
    if (qty > remainingEligibleQty) {
      setFormError(`Returned quantity (${qty}) exceeds remaining eligible quantity (${remainingEligibleQty}).`);
      return;
    }

    const wh = warehouses.find(w => w.id === formWarehouseId) || warehouses.find(w => w.isDefault) || warehouses[0];
    const unitPrice = selectedItem.rate || (selectedItem.total / selectedItem.qty);
    const refundAmount = Math.round(unitPrice * qty);

    // Direct Return: Sales Person role updates inventory stock immediately upon submit
    const isDirectReturn = isSalesperson;

    const input: CreateCustomerReturnInput = {
      originalInvoiceId: selectedInvoice.id,
      originalInvoiceNumber: selectedInvoice.invoiceNumber,
      returnDate: formReturnDate,
      customerId: selectedInvoice.customerId,
      customerName: selectedInvoice.customerName,
      customerPhone: selectedInvoice.customerPhone,
      productId: selectedItem.productId,
      productName: selectedItem.productName,
      sku: selectedItem.sku,
      barcode: selectedItem.barcode,
      soldQty: selectedItem.qty,
      returnedQty: qty,
      unit: selectedItem.unit || 'Piece',
      unitPrice,
      refundAmount,
      reason: formReason,
      condition: formCondition,
      warehouseId: wh?.id,
      warehouseName: wh?.name,
      notes: formNotes,
      directRestock: isDirectReturn,
      returnStatus: isDirectReturn ? 'Approved' : 'Pending Review'
    };

    setIsSubmitting(true);
    try {
      const created = await addCustomerReturn(input);
      setIsCreateModalOpen(false);
      if (isDirectReturn || created.returnStatus === 'Approved' || created.returnStatus === 'Stock Restocked') {
        showToast('Product returned successfully. Inventory stock has been updated.');
      } else {
        showToast(`Customer Return ${created.returnNumber} submitted successfully.`);
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit customer return.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Action Handlers
  // ---------------------------------------------------------------------------
  const handleApprove = async (ret: CustomerReturn) => {
    try {
      const updated = await approveCustomerReturn(ret.id);
      showToast(`Return ${updated.returnNumber} has been approved.`);
    } catch (err: any) {
      alert(err.message || 'Failed to approve return.');
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTarget) return;
    try {
      const updated = await rejectCustomerReturn(rejectTarget.id, rejectionReasonInput || 'Rejected per manager inspection');
      setRejectTarget(null);
      setRejectionReasonInput('');
      showToast(`Return ${updated.returnNumber} was rejected.`);
    } catch (err: any) {
      alert(err.message || 'Failed to reject return.');
    }
  };

  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockTarget) return;

    try {
      const targetWh = warehouses.find(w => w.id === selectedRestockWarehouseId) || warehouses[0];
      const res = await restockCustomerReturn(
        restockTarget.id,
        targetWh?.id,
        profile?.id,
        profile?.full_name || 'Warehouse Staff'
      );
      setRestockTarget(null);
      showToast(res.message);
    } catch (err: any) {
      alert(err.message || 'Failed to restock returned item.');
    }
  };

  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundTarget) return;

    const amt = parseFloat(refundAmountInput);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid refund amount.');
      return;
    }

    try {
      const updated = await refundCustomerReturn(
        refundTarget.id,
        refundMethod,
        amt,
        profile?.id,
        profile?.full_name || 'Cashier'
      );
      setRefundTarget(null);
      showToast(`Refund of ₹${updated.refundAmount} via ${refundMethod} processed for ${updated.returnNumber}.`);
    } catch (err: any) {
      alert(err.message || 'Failed to process refund.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-emerald-800 text-xs font-medium animate-fadeIn shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-emerald-600 hover:text-emerald-800">
            ✕
          </button>
        </div>
      )}

      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-indigo-600" />
              <span>Purchase Return Management</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Inventory 
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage products returned by customers and return eligible stock to inventory when appropriate.
          </p>
        </div>

        {canCreateReturn && (
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs hover:shadow-sm transition-all cursor-pointer self-start sm:self-auto shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>New Purchase Return</span>
          </button>
        )}
      </div>

      {/* 2. Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
        {/* Search Bar */}
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search return ID, invoice #, customer name, phone, product, SKU, barcode..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-9 text-xs bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 placeholder-slate-400 transition-all shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1 cursor-pointer"
              title="Clear search query"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          {/* Condition Filter */}
          <div className="h-9 px-3 bg-slate-50 hover:bg-slate-100/60 border border-slate-200 rounded-xl flex items-center gap-2 transition-colors shadow-2xs">
            <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-xs text-slate-400 font-medium">Condition:</span>
            <select
              value={conditionFilter}
              onChange={e => setConditionFilter(e.target.value)}
              className="text-xs text-slate-700 bg-transparent border-0 focus:ring-0 cursor-pointer outline-none font-medium pr-1"
              aria-label="Filter by Condition"
            >
              <option value="ALL">All Conditions</option>
              <option value="Resalable">Resalable</option>
              <option value="Damaged">Damaged</option>
              <option value="Defective">Defective</option>
              <option value="Expired">Expired</option>
            </select>
          </div>

          {/* Date Filter: Start Date */}
          <div className="h-9 px-3 bg-slate-50 hover:bg-slate-100/60 border border-slate-200 rounded-xl flex items-center gap-2 transition-colors shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-xs text-slate-400 font-medium">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="text-xs text-slate-700 bg-transparent border-0 focus:ring-0 cursor-pointer outline-none font-medium"
              aria-label="From Date"
            />
          </div>

          {/* Date Filter: End Date */}
          <div className="h-9 px-3 bg-slate-50 hover:bg-slate-100/60 border border-slate-200 rounded-xl flex items-center gap-2 transition-colors shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-xs text-slate-400 font-medium">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="text-xs text-slate-700 bg-transparent border-0 focus:ring-0 cursor-pointer outline-none font-medium"
              aria-label="To Date"
            />
          </div>
        </div>
      </div>

      {/* 4. Customer Returns Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Customer Return Directory ({filteredReturns.length} records)
            </h2>
            <p className="text-[11px] text-slate-500">
              Verified return transactions, condition inspections, and restock logs
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Info className="w-3.5 h-3.5" />
            <span>Strict stock isolation applied</span>
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse table-auto sm:table-fixed">
            <thead className="bg-slate-50/90 text-slate-700 font-semibold uppercase text-[11px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3.5 pl-5 pr-3 text-left w-[14%] sm:w-[130px]">Return ID</th>
                <th className="py-3.5 px-3 text-left w-[15%] sm:w-[140px]">Original Bill / Invoice</th>
                <th className="py-3.5 px-3 text-left w-[18%] sm:w-[150px]">Customer Name</th>
                <th className="py-3.5 px-3 text-left w-[24%] sm:w-[200px]">Product Name & SKU</th>
                <th className="py-3.5 px-3 text-center w-[13%] sm:w-[110px]">Returned Qty</th>
                <th className="py-3.5 px-3 text-center w-[10%] sm:w-[100px]">Return Status</th>
                <th className="py-3.5 pl-2 pr-5 text-center w-[6%] sm:w-[70px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RotateCcw className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600 text-sm">No purchase returns found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {customerReturns.length === 0
                        ? 'No purchase returns have been recorded yet. Click "New Purchase Return" to submit a return.'
                        : 'No return records match the active search or filter selection.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredReturns.map(ret => {
                  return (
                    <tr
                      key={ret.id}
                      className="hover:bg-slate-50/70 transition-colors group cursor-pointer border-b border-slate-100 last:border-b-0"
                      onClick={() => setInspectingReturn(ret)}
                    >
                      {/* 1. Return ID */}
                      <td className="py-3.5 pl-5 pr-3 align-middle font-mono font-bold text-indigo-700">
                        {ret.returnNumber}
                      </td>

                      {/* 2. Original Bill/Invoice Number */}
                      <td className="py-3.5 px-3 align-middle">
                        <span className="font-mono font-semibold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded text-[11px] border border-slate-200">
                          {ret.originalInvoiceNumber}
                        </span>
                      </td>

                      {/* 3. Customer Name */}
                      <td className="py-3.5 px-3 align-middle">
                        <div className="font-bold text-slate-900 truncate" title={ret.customerName}>{ret.customerName}</div>
                        {ret.customerPhone && (
                          <div className="text-[11px] text-slate-400 font-normal">{ret.customerPhone}</div>
                        )}
                      </td>

                      {/* 4. Product Name and SKU */}
                      <td className="py-3.5 px-3 align-middle">
                        <div className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors truncate" title={ret.productName}>
                          {ret.productName}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5 truncate">
                          SKU: {ret.sku || ret.barcode || '—'}
                        </div>
                      </td>

                      {/* 5. Returned Quantity and Unit */}
                      <td className="py-3.5 px-3 text-center align-middle font-mono">
                        <span className="font-bold text-slate-900">
                          {formatNumber(ret.returnedQty)}
                        </span>{' '}
                        <span className="text-[11px] text-slate-500 font-normal">{ret.unit || 'Piece'}</span>
                        <div className="text-[10px] text-slate-400 font-normal">
                          (sold: {ret.soldQty})
                        </div>
                      </td>

                      {/* 6. Return Status */}
                      <td className="py-3.5 px-3 text-center align-middle">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                            ret.returnStatus === 'Approved' || ret.returnStatus === 'Stock Restocked'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : ret.returnStatus === 'Rejected'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {ret.returnStatus === 'Stock Restocked'
                            ? 'Approved'
                            : isSalesperson && ret.returnStatus === 'Pending Review'
                            ? 'Approved'
                            : ret.returnStatus === 'Pending Review'
                            ? 'Pending'
                            : ret.returnStatus}
                        </span>
                      </td>

                      {/* 7. Actions */}
                      <td className="py-3.5 pl-2 pr-5 text-center align-middle">
                        <div className="flex items-center justify-center gap-1.5" onClick={e => e.stopPropagation()}>
                          {/* View Return Details (Eye Icon) */}
                          <button
                            type="button"
                            onClick={() => setInspectingReturn(ret)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 transition-colors cursor-pointer shadow-2xs"
                            title="View Return Details"
                            aria-label="View Return Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Approve (Manager/Owner only) */}
                          {canApproveOrReject && ret.returnStatus === 'Pending Review' && (
                            <button
                              onClick={() => handleApprove(ret)}
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                              title="Approve Customer Return"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}

                          {/* Reject (Manager/Owner only) */}
                          {canApproveOrReject && ret.returnStatus === 'Pending Review' && (
                            <button
                              onClick={() => {
                                setRejectTarget(ret);
                                setRejectionReasonInput('');
                              }}
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Reject Customer Return"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}

                          {/* Restock (Warehouse Manager / Owner / Admin) */}
                          {canRestock && ret.returnStatus === 'Approved' && (
                            <button
                              onClick={() => {
                                setRestockTarget(ret);
                                setSelectedRestockWarehouseId(ret.warehouseId || warehouses[0]?.id || '');
                              }}
                              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                              title="Restock to Warehouse"
                            >
                              <Boxes className="w-4 h-4" />
                            </button>
                          )}

                          {/* Process Refund (Cashier / Owner / Admin) */}
                          {canRefund && ret.refundStatus !== 'Refunded' && ret.returnStatus !== 'Rejected' && (
                            <button
                              onClick={() => {
                                setRefundTarget(ret);
                                setRefundAmountInput(String(ret.refundAmount || 0));
                                setRefundMethod('Bank');
                              }}
                              className="p-1.5 rounded-lg text-purple-600 hover:bg-purple-50 transition-colors cursor-pointer"
                              title="Process Customer Refund"
                            >
                              <CreditCard className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* MODAL 1: Create New Customer Return                                    */}
      {/* --------------------------------------------------------------------- */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Record Purchase Return"
        size="lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Original Bill Search & Selector */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-700 font-semibold">
                Find Original Bill / Invoice <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-slate-400">Search by invoice #, customer name, or phone</span>
            </div>
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search invoice number, customer name, or phone number..."
                value={modalInvoiceSearch}
                onChange={e => setModalInvoiceSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-indigo-500"
              />
              {modalInvoiceSearch && (
                <button
                  type="button"
                  onClick={() => setModalInvoiceSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
            <select
              value={formInvoiceId}
              onChange={e => handleInvoiceChange(e.target.value)}
              required
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium focus:bg-white focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">-- Choose Sales Invoice ({searchedEligibleInvoices.length} found) --</option>
              {searchedEligibleInvoices.map(inv => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoiceNumber} — {inv.customerName} {inv.customerPhone ? `(${inv.customerPhone})` : ''} ({formatDate(inv.date)}) [₹{formatNumber(inv.grandTotal)}]
                </option>
              ))}
            </select>
          </div>

          {/* Populated Customer Information */}
          {selectedInvoice && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 gap-3 text-slate-700">
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Customer Name</span>
                <span className="font-bold text-slate-900">{selectedInvoice.customerName}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Customer Contact</span>
                <span className="font-mono text-slate-800">{selectedInvoice.customerPhone || 'N/A'}</span>
              </div>
            </div>
          )}

          {/* Product Selection on this Invoice */}
          {selectedInvoice && (
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Select Product on Invoice <span className="text-rose-500">*</span>
              </label>
              <select
                value={formProductId}
                onChange={e => {
                  setFormProductId(e.target.value);
                  setFormReturnedQty('1');
                }}
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium focus:bg-white focus:ring-1 focus:ring-indigo-500"
              >
                {invoiceItems.map(item => (
                  <option key={item.productId} value={item.productId}>
                    {item.productName} — Sold: {item.qty} {item.unit || 'Piece'} @ ₹{formatNumber(item.rate || (item.total / item.qty))}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Quantity verification & input */}
          {selectedItem && (
            <div className="grid grid-cols-4 gap-2.5">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Sold Qty</span>
                <span className="font-mono font-bold text-slate-800 text-sm">
                  {selectedItem.qty} <span className="text-[10px] text-slate-500 font-normal">{selectedItem.unit || 'Piece'}</span>
                </span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Remaining Eligible Quantity</span>
                <span className="font-mono font-bold text-emerald-700 text-sm">
                  {remainingEligibleQty} <span className="text-[10px] text-slate-500 font-normal">{selectedItem.unit || 'Piece'}</span>
                </span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Current Stock</span>
                <span className="font-mono font-bold text-indigo-700 text-sm">
                  {formatNumber(selectedProductMaster?.currentStock || 0)} <span className="text-[10px] text-slate-500 font-normal">{selectedItem.unit || 'Piece'}</span>
                </span>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Return Qty <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={remainingEligibleQty}
                  value={formReturnedQty}
                  onChange={e => setFormReturnedQty(e.target.value)}
                  required
                  placeholder="Qty"
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 font-bold font-mono focus:ring-1 focus:ring-indigo-500"
                />
                {formCondition === 'Resalable' && Number(formReturnedQty) > 0 && (
                  <span className="block text-[9px] text-emerald-600 font-semibold mt-0.5">
                    ➔ New Stock: {(selectedProductMaster?.currentStock || 0) + Number(formReturnedQty)}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Product Condition */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Physical Product Condition <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['Resalable', 'Damaged', 'Defective', 'Expired'] as CustomerReturnCondition[]).map(cond => (
                <button
                  type="button"
                  key={cond}
                  onClick={() => setFormCondition(cond)}
                  className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${
                    formCondition === cond
                      ? cond === 'Resalable'
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-800 font-bold ring-1 ring-emerald-500/20'
                        : 'bg-amber-50 border-amber-400 text-amber-800 font-bold ring-1 ring-amber-500/20'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 font-medium'
                  }`}
                >
                  <span className="block text-xs">{cond}</span>
                  <span className="block text-[9px] text-slate-400 font-normal">
                    {cond === 'Resalable' ? 'Restocks to stock' : 'Quarantine only'}
                  </span>
                </button>
              ))}
            </div>
            {formCondition === 'Resalable' ? (
              <div className="mt-1.5 p-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-1.5 text-[11px] text-emerald-800 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span><strong>Resalable:</strong> Returned quantity will immediately add to available warehouse inventory stock.</span>
              </div>
            ) : (
              <div className="mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-1.5 text-[11px] text-amber-800 font-medium">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span><strong>{formCondition} Product:</strong> Recorded separately in quarantine tracking. Will <strong>NOT</strong> be added to sellable stock to prevent selling unusable goods.</span>
              </div>
            )}
          </div>

          {/* Destination Warehouse & Return Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Destination Warehouse</label>
              <select
                value={formWarehouseId}
                onChange={e => setFormWarehouseId(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium focus:bg-white"
              >
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.name} {w.isDefault ? '(Default Godown)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Return Date</label>
              <input
                type="date"
                value={formReturnDate}
                onChange={e => setFormReturnDate(e.target.value)}
                required
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium focus:bg-white"
              />
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Return Reason <span className="text-rose-500">*</span>
            </label>
            <select
              value={formReason}
              onChange={e => setFormReason(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium focus:bg-white mb-2"
            >
              <option value="Customer Return">Customer Return</option>
              <option value="Wrong Item">Wrong Item</option>
              <option value="Damaged in Transit">Damaged in Transit</option>
              <option value="Defective Product">Defective Product</option>
              <option value="Expired Product">Expired Product</option>
              <option value="Other">Other (specify in notes)</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Inspection Notes / Supporting Details</label>
            <textarea
              rows={2}
              value={formNotes}
              onChange={e => setFormNotes(e.target.value)}
              placeholder="e.g. Unopened container, original seal verified. Batch #2026-B1."
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              {isSalesperson ? (
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Direct Return: Stock updates immediately upon submit.
                </span>
              ) : (
                <span>
                  Starts as <strong>Pending Review</strong>. Inventory is not modified.
                </span>
              )}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 cursor-pointer font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Updating Stock...</span>
                  </>
                ) : (
                  <span>Submit Return</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* --------------------------------------------------------------------- */}
      {/* MODAL 2: Return Inspection Details                                     */}
      {/* --------------------------------------------------------------------- */}
      {/* --------------------------------------------------------------------- */}
      {/* MODAL 2: View Return Details (Clean, Read-Only Full Details Panel)     */}
      {/* --------------------------------------------------------------------- */}
      <Modal
        isOpen={Boolean(inspectingReturn)}
        onClose={handleCloseInspect}
        title={
          inspectingReturn
            ? isEditingInspect
              ? `Edit Return Details — ${inspectingReturn.returnNumber}`
              : `Return Details — ${inspectingReturn.returnNumber}`
            : 'Return Details'
        }
        subtitle={inspectingReturn ? `Original Bill #${inspectingReturn.originalInvoiceNumber}` : undefined}
        size="lg"
      >
        {inspectingReturn && (
          isEditingInspect ? (
            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              {editError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {/* Read-Only Reference Information */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                  Original Sale Reference (Read-Only)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-700">
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">Return ID</span>
                    <span className="font-mono font-bold text-indigo-700 text-xs">
                      {inspectingReturn.returnNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">Original Invoice</span>
                    <span className="font-mono font-bold text-slate-800 text-xs">
                      {inspectingReturn.originalInvoiceNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">Product & SKU</span>
                    <span className="font-semibold text-slate-900 block truncate" title={inspectingReturn.productName}>
                      {inspectingReturn.productName}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      SKU: {inspectingReturn.sku || inspectingReturn.barcode || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">Original Sold Qty</span>
                    <span className="font-mono font-bold text-slate-800 text-xs">
                      {inspectingReturn.soldQty} {inspectingReturn.unit || 'Piece'}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Rate: {formatCurrency(inspectingReturn.unitPrice)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Editable Customer Details */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-3">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                  Customer Details
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Customer Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editCustomerName}
                      onChange={e => setEditCustomerName(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium focus:bg-white focus:ring-1 focus:ring-indigo-500"
                      placeholder="Customer full name"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Customer Phone Number</label>
                    <input
                      type="tel"
                      value={editCustomerPhone}
                      onChange={e => setEditCustomerPhone(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium focus:bg-white focus:ring-1 focus:ring-indigo-500"
                      placeholder="e.g. +91 9876543210"
                    />
                  </div>
                </div>
              </div>

              {/* Editable Quantity & Condition */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-3">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                  Returned Quantity & Product Condition
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-700 font-semibold">
                        Returned Quantity ({inspectingReturn.unit || 'Piece'}) <span className="text-rose-500">*</span>
                      </label>
                      <span className="text-[10px] text-slate-500">
                        Max Allowed: <strong className="text-indigo-700">{editingReturnMaxEligible}</strong>
                      </span>
                    </div>
                    <input
                      type="number"
                      min="1"
                      max={editingReturnMaxEligible}
                      value={editReturnedQty}
                      onChange={e => setEditReturnedQty(e.target.value)}
                      required
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-mono font-bold focus:bg-white focus:ring-1 focus:ring-indigo-500"
                    />
                    <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                      <span>Current: {inspectingReturn.returnedQty}</span>
                      {Number(editReturnedQty) !== inspectingReturn.returnedQty && (
                        <span className="font-semibold text-indigo-600">
                          Qty Change: {Number(editReturnedQty) > inspectingReturn.returnedQty ? '+' : ''}{Number(editReturnedQty) - inspectingReturn.returnedQty}
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Destination Warehouse</label>
                    <select
                      value={editWarehouseId}
                      onChange={e => setEditWarehouseId(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium focus:bg-white focus:ring-1 focus:ring-indigo-500"
                    >
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id}>
                          {w.name} {w.isDefault ? '(Default Godown)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Condition Selector */}
                <div>
                  <label className="block text-slate-700 font-semibold mb-1.5">
                    Product Condition <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(['Resalable', 'Damaged', 'Defective', 'Expired'] as CustomerReturnCondition[]).map(cond => (
                      <button
                        key={cond}
                        type="button"
                        onClick={() => setEditCondition(cond)}
                        className={`p-2 rounded-lg border text-center transition-all cursor-pointer font-medium ${
                          editCondition === cond
                            ? cond === 'Resalable'
                              ? 'bg-emerald-50 border-emerald-400 text-emerald-800 ring-2 ring-emerald-500/20 font-bold'
                              : 'bg-amber-50 border-amber-400 text-amber-800 ring-2 ring-amber-500/20 font-bold'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <span className="block text-xs">{cond}</span>
                        <span className="block text-[9px] text-slate-400 font-normal">
                          {cond === 'Resalable' ? 'Sellable stock' : 'Quarantine only'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Inventory Safety & Delta Preview */}
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1 text-[11px] text-blue-900">
                <div className="flex items-center gap-1.5 font-bold text-blue-800">
                  <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Inventory Safety & Delta Adjustment</span>
                </div>
                <p className="text-slate-600">
                  {editingStockDeltaPreview.explanation}
                </p>
                <p className="text-[10px] text-slate-500 font-medium">
                  * Safe update guarantee: Only the difference between old and new values is applied. Existing stock will never be duplicated.
                </p>
              </div>

              {/* Reason & Notes */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Return Reason <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={editReason}
                    onChange={e => setEditReason(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium focus:bg-white"
                  >
                    <option value="Customer Return">Customer Return</option>
                    <option value="Wrong Item">Wrong Item</option>
                    <option value="Damaged in Transit">Damaged in Transit</option>
                    <option value="Defective Product">Defective Product</option>
                    <option value="Expired Product">Expired Product</option>
                    <option value="Other">Other (specify in notes)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Notes / Supporting Details</label>
                  <textarea
                    rows={2}
                    value={editNotes}
                    onChange={e => setEditNotes(e.target.value)}
                    placeholder="Additional inspection notes or return reason details..."
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white"
                  />
                </div>
              </div>

              {/* Save and Cancel Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isSavingEdit}
                  onClick={cancelEditingInspect}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 cursor-pointer font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSavingEdit ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 text-xs">
            {/* 1. Header Overview Cards: Statuses & Stock Impact */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {/* Return Status */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                  Return Status
                </span>
                <div className="mt-1">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      inspectingReturn.returnStatus === 'Approved' || inspectingReturn.returnStatus === 'Stock Restocked'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : inspectingReturn.returnStatus === 'Rejected'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {inspectingReturn.returnStatus === 'Stock Restocked'
                      ? 'Approved'
                      : isSalesperson && inspectingReturn.returnStatus === 'Pending Review'
                      ? 'Approved'
                      : inspectingReturn.returnStatus || 'Approved'}
                  </span>
                </div>
              </div>

              {/* Refund Status */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                  Refund Status
                </span>
                <div className="mt-1">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      inspectingReturn.refundStatus === 'Refunded'
                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {inspectingReturn.refundStatus || 'Pending'}
                  </span>
                </div>
              </div>

              {/* Stock Update Status */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl sm:col-span-2">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                  Stock Update Status
                </span>
                <div className="mt-1">
                  {(() => {
                    const stockInfo = getStockUpdateStatus(inspectingReturn);
                    return (
                      <div>
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${stockInfo.badgeClass}`}>
                          {stockInfo.label}
                        </span>
                        <p className="text-[11px] text-slate-500 mt-1 font-medium">
                          {stockInfo.description}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* 2. Core Return Specs & Customer Information */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
              <h4 className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                Transaction & Customer Details
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-slate-700">
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase">Return ID</span>
                  <span className="font-mono font-bold text-indigo-700 text-sm">
                    {inspectingReturn.returnNumber || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase">Original Bill / Invoice</span>
                  <span className="font-mono font-bold text-slate-800 text-sm">
                    {inspectingReturn.originalInvoiceNumber || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase">Return Date & Time</span>
                  <span className="font-medium text-slate-800">
                    {formatDateTime(inspectingReturn.createdAt || inspectingReturn.returnDate)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase">Customer Name</span>
                  <span className="font-bold text-slate-900">
                    {inspectingReturn.customerName || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase">Customer Phone</span>
                  <span className="font-mono text-slate-800">
                    {inspectingReturn.customerPhone || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase">Warehouse Name</span>
                  <span className="font-medium text-slate-800">
                    {inspectingReturn.warehouseName || '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Product & Quantity Information */}
            <div className="bg-indigo-50/40 p-4 rounded-xl border border-indigo-100 space-y-3">
              <h4 className="text-[11px] font-bold uppercase text-indigo-700 tracking-wider">
                Product & Quantity Details
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase">Product Name</span>
                  <span className="font-bold text-slate-900 text-sm block">
                    {inspectingReturn.productName || '—'}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    SKU: {inspectingReturn.sku || inspectingReturn.barcode || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase">Returned Qty</span>
                  <span className="font-mono font-bold text-indigo-900 text-sm">
                    {formatNumber(inspectingReturn.returnedQty)} <span className="text-xs font-normal text-slate-500">{inspectingReturn.unit || 'Piece'}</span>
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase">Original Qty Sold</span>
                  <span className="font-mono font-bold text-slate-700 text-sm">
                    {formatNumber(inspectingReturn.soldQty)} <span className="text-xs font-normal text-slate-500">{inspectingReturn.unit || 'Piece'}</span>
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-indigo-100/70 grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase">Product Condition</span>
                  <span
                    className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      inspectingReturn.condition === 'Resalable'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : inspectingReturn.condition === 'Damaged'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : inspectingReturn.condition === 'Defective'
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : 'bg-purple-100 text-purple-800 border border-purple-200'
                    }`}
                  >
                    {inspectingReturn.condition || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase">Unit Rate / Price</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {inspectingReturn.unitPrice ? formatCurrency(inspectingReturn.unitPrice) : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase">Refund Value</span>
                  <span className="font-mono font-bold text-emerald-700">
                    {inspectingReturn.refundAmount ? formatCurrency(inspectingReturn.refundAmount) : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* 4. Reason & Inspection Notes */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
              <h4 className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                Reason & Additional Information
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase mb-1">Return Reason</span>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium">
                    {inspectingReturn.reason || '—'}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase mb-1">Notes / Additional Info</span>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-600">
                    {inspectingReturn.notes || '—'}
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Audit & Activity Trail */}
            <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                Activity & Audit History
              </span>
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span>Created By: <strong className="text-slate-800">{inspectingReturn.createdByName || '—'}</strong></span>
                <span className="text-slate-400">{formatDateTime(inspectingReturn.createdAt)}</span>
              </div>
              {inspectingReturn.approvedAt && (
                <div className="flex flex-wrap items-center justify-between gap-1 border-t border-slate-200/50 pt-1">
                  <span>Approved By: <strong className="text-slate-800">{inspectingReturn.approvedByName || '—'}</strong></span>
                  <span className="text-slate-400">{formatDateTime(inspectingReturn.approvedAt)}</span>
                </div>
              )}
              {inspectingReturn.restockedAt && (
                <div className="flex flex-wrap items-center justify-between gap-1 border-t border-slate-200/50 pt-1">
                  <span>Restocked By: <strong className="text-slate-800">{inspectingReturn.restockedByName || '—'}</strong></span>
                  <span className="text-slate-400">{formatDateTime(inspectingReturn.restockedAt)}</span>
                </div>
              )}
              {inspectingReturn.refundedAt && (
                <div className="flex flex-wrap items-center justify-between gap-1 border-t border-slate-200/50 pt-1">
                  <span>
                    Refund Processed By: <strong className="text-slate-800">{inspectingReturn.refundedByName || '—'}</strong> via {inspectingReturn.refundMethod || 'Bank'}
                  </span>
                  <span className="text-slate-400">{formatDateTime(inspectingReturn.refundedAt)}</span>
                </div>
              )}
            </div>

            {/* Audit Trail for Edits */}
            {inspectingReturn.auditTrail && inspectingReturn.auditTrail.length > 0 && (
              <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-200 text-[11px] text-slate-700 space-y-2">
                <span className="text-[10px] text-amber-800 font-bold uppercase tracking-wider block">
                  Edit History & Audit Trail ({inspectingReturn.auditTrail.length} change{inspectingReturn.auditTrail.length > 1 ? 's' : ''})
                </span>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {inspectingReturn.auditTrail.map((log, idx) => (
                    <div key={idx} className="flex flex-wrap items-center justify-between text-[11px] border-b border-amber-100 pb-1 last:border-0 last:pb-0">
                      <div>
                        <span className="font-semibold text-slate-800">{log.field}:</span>{' '}
                        <span className="line-through text-slate-400 font-mono">{String(log.oldValue ?? '—')}</span>
                        <span className="mx-1 text-slate-400">→</span>
                        <span className="font-semibold text-emerald-700 font-mono">{String(log.newValue ?? '—')}</span>
                      </div>
                      <div className="text-slate-400 text-[10px]">
                        by {log.editedBy} • {formatDateTime(log.date)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="pt-2 flex items-center justify-between">
              <div>
                {inspectingReturn.updatedByName && (
                  <span className="text-[11px] text-slate-400">
                    Last edited by <strong className="text-slate-600">{inspectingReturn.updatedByName}</strong>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {canEditReturn && (
                  <button
                    type="button"
                    onClick={() => startEditingInspect(inspectingReturn)}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-xs cursor-pointer shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit Return</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCloseInspect}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg text-xs cursor-pointer shadow-xs transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
          )
        )}
      </Modal>

      {/* --------------------------------------------------------------------- */}
      {/* MODAL 3: Warehouse Restock Confirmation                                */}
      {/* --------------------------------------------------------------------- */}
      <Modal
        isOpen={Boolean(restockTarget)}
        onClose={() => setRestockTarget(null)}
        title={restockTarget ? `Restock ${restockTarget.productName}` : 'Restock to Warehouse'}
        size="md"
      >
        {restockTarget && (
          <form onSubmit={handleRestockSubmit} className="space-y-4 text-xs">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900">
              <p className="font-semibold">
                You are about to process returned goods into physical warehouse custody.
              </p>
              <p className="text-[11px] text-blue-700 mt-1">
                Product Condition: <strong>{restockTarget.condition}</strong>
              </p>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Select Receiving Godown / Warehouse <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedRestockWarehouseId}
                onChange={e => setSelectedRestockWarehouseId(e.target.value)}
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium focus:bg-white"
              >
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.name} {w.isDefault ? '(Main Godown)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Item:</span>
                <span className="font-bold text-slate-800">{restockTarget.productName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Quantity:</span>
                <span className="font-mono font-bold text-slate-800">{restockTarget.returnedQty} {restockTarget.unit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sellable Stock Impact:</span>
                <span className={`font-bold ${restockTarget.condition === 'Resalable' ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {restockTarget.condition === 'Resalable' ? `+${restockTarget.returnedQty} to Available Stock` : '0 (Routed to Quarantine)'}
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRestockTarget(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 cursor-pointer font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold cursor-pointer shadow-xs"
              >
                Confirm Restocking
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* --------------------------------------------------------------------- */}
      {/* MODAL 4: Process Customer Refund                                       */}
      {/* --------------------------------------------------------------------- */}
      <Modal
        isOpen={Boolean(refundTarget)}
        onClose={() => setRefundTarget(null)}
        title={refundTarget ? `Process Refund for ${refundTarget.returnNumber}` : 'Customer Refund'}
        size="md"
      >
        {refundTarget && (
          <form onSubmit={handleRefundSubmit} className="space-y-4 text-xs">
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-purple-900">
              <p className="font-semibold">
                Issue refund for returned goods to customer {refundTarget.customerName}.
              </p>
              <p className="text-[11px] text-purple-700 mt-1">
                Original Invoice: <strong>{refundTarget.originalInvoiceNumber}</strong> | Product: {refundTarget.productName}
              </p>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Refund Payment Method <span className="text-rose-500">*</span>
              </label>
              <select
                value={refundMethod}
                onChange={e => setRefundMethod(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium focus:bg-white"
              >
                <option value="Bank">Bank (Direct Transfer)</option>
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Credit Note">Credit Note (Customer Balance Adjustment)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Refund Amount (₹) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={refundAmountInput}
                onChange={e => setRefundAmountInput(e.target.value)}
                required
                className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 font-bold font-mono focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <p className="text-[10px] text-slate-500">
              * Note: Processing a refund updates the refund ledger and settlement status. It does <strong>NOT</strong> modify inventory or add stock again.
            </p>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRefundTarget(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 cursor-pointer font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold cursor-pointer shadow-xs"
              >
                Confirm Refund
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* --------------------------------------------------------------------- */}
      {/* MODAL 5: Reject Return Modal                                          */}
      {/* --------------------------------------------------------------------- */}
      <Modal
        isOpen={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        title={rejectTarget ? `Reject Return ${rejectTarget.returnNumber}` : 'Reject Return'}
        size="sm"
      >
        {rejectTarget && (
          <form onSubmit={handleRejectSubmit} className="space-y-4 text-xs">
            <p className="text-slate-600">
              Are you sure you want to reject this return request for <strong>{rejectTarget.customerName}</strong>?
              Inventory will not be restocked and no refund will be issued.
            </p>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Rejection Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={rejectionReasonInput}
                onChange={e => setRejectionReasonInput(e.target.value)}
                placeholder="e.g. Return window expired / physical damage caused after customer acceptance."
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 cursor-pointer font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold cursor-pointer shadow-xs"
              >
                Confirm Rejection
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

