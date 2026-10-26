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
  Info,
  DollarSign,
  Package,
  ArrowRight,
  ShieldCheck,
  Check
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import {
  CustomerReturn,
  CreateCustomerReturnInput,
  CustomerReturnCondition,
  CustomerReturnStatus,
  CustomerReturnRefundStatus,
  SalesInvoice,
  InvoiceItem
} from '../../types';
import { formatCurrency, formatDate, formatNumber } from '../../utils/formatters';
import { Modal } from '../../components/common/Modal';

export const CustomerReturnsPage: React.FC = () => {
  const {
    customerReturns,
    salesInvoices,
    products,
    warehouses,
    addCustomerReturn,
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

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'RESTOCKED' | 'REFUNDED'>('ALL');
  const [conditionFilter, setConditionFilter] = useState<string>('ALL');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [inspectingReturn, setInspectingReturn] = useState<CustomerReturn | null>(null);
  const [restockTarget, setRestockTarget] = useState<CustomerReturn | null>(null);
  const [selectedRestockWarehouseId, setSelectedRestockWarehouseId] = useState<string>('');
  const [refundTarget, setRefundTarget] = useState<CustomerReturn | null>(null);
  const [refundMethod, setRefundMethod] = useState<string>('Bank');
  const [refundAmountInput, setRefundAmountInput] = useState<string>('');
  const [rejectTarget, setRejectTarget] = useState<CustomerReturn | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState<string>('');

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // ---------------------------------------------------------------------------
  // KPI Metrics Calculation
  // ---------------------------------------------------------------------------
  const metrics = useMemo(() => {
    let pendingCount = 0;
    let approvedCount = 0;
    let restockedCount = 0;
    let refundedCount = 0;
    let totalRefundValue = 0;

    customerReturns.forEach(r => {
      totalRefundValue += Number(r.refundAmount || 0);
      if (r.returnStatus === 'Pending Review') pendingCount++;
      else if (r.returnStatus === 'Approved') approvedCount++;
      else if (r.returnStatus === 'Stock Restocked') restockedCount++;

      if (r.refundStatus === 'Refunded') refundedCount++;
    });

    return {
      total: customerReturns.length,
      pending: pendingCount,
      approved: approvedCount,
      restocked: restockedCount,
      refunded: refundedCount,
      totalRefundValue
    };
  }, [customerReturns]);

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
      if (statusFilter === 'PENDING' && r.returnStatus !== 'Pending Review') return false;
      if (statusFilter === 'APPROVED' && r.returnStatus !== 'Approved') return false;
      if (statusFilter === 'REJECTED' && r.returnStatus !== 'Rejected') return false;
      if (statusFilter === 'RESTOCKED' && r.returnStatus !== 'Stock Restocked') return false;
      if (statusFilter === 'REFUNDED' && r.refundStatus !== 'Refunded') return false;

      // 3. Condition Filter
      if (conditionFilter !== 'ALL' && r.condition !== conditionFilter) return false;

      return true;
    });
  }, [customerReturns, searchQuery, statusFilter, conditionFilter]);

  // ---------------------------------------------------------------------------
  // Create Return Form State
  // ---------------------------------------------------------------------------
  const eligibleInvoices = useMemo(() => {
    return salesInvoices.filter(inv => inv.docType !== 'credit_note');
  }, [salesInvoices]);

  const [formInvoiceId, setFormInvoiceId] = useState('');
  const [formProductId, setFormProductId] = useState('');
  const [formReturnedQty, setFormReturnedQty] = useState('');
  const [formReason, setFormReason] = useState('Customer received wrong product / specification mismatch');
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
    if (eligibleInvoices.length > 0) {
      handleInvoiceChange(eligibleInvoices[0].id);
    }
    setFormReturnDate(new Date().toISOString().split('T')[0]);
    setFormCondition('Resalable');
    setFormReason('Customer received wrong product / specification mismatch');
    setFormNotes('');
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      notes: formNotes
    };

    try {
      const created = await addCustomerReturn(input);
      setIsCreateModalOpen(false);
      showToast(`Customer Return ${created.returnNumber} submitted successfully (Pending Review).`);
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit customer return.');
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
              <span>Customer Returns</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Inventory Inbound
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage customer returns of sold merchandise, inspection workflows, godown restocking, and refund processing.
          </p>
        </div>

        {canCreateReturn && (
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs hover:shadow-sm transition-all cursor-pointer self-start sm:self-auto shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>New Customer Return</span>
          </button>
        )}
      </div>

      {/* 2. KPI Summary Cards (Interactive Filter Shortcuts) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total Returns */}
        <button
          onClick={() => setStatusFilter('ALL')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'ALL'
              ? 'bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs'
              : 'bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/50 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Returns</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{metrics.total}</div>
          <p className="text-[11px] text-slate-500 mt-1">Value: {formatCurrency(metrics.totalRefundValue)}</p>
        </button>

        {/* Pending Review */}
        <button
          onClick={() => setStatusFilter('PENDING')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'PENDING'
              ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-500/20 shadow-xs'
              : 'bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/50 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Pending Review</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-700">{metrics.pending}</div>
          <p className="text-[11px] text-slate-500 mt-1">Awaiting manager inspection</p>
        </button>

        {/* Approved */}
        <button
          onClick={() => setStatusFilter('APPROVED')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'APPROVED'
              ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-500/20 shadow-xs'
              : 'bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/50 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">Approved</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-blue-700">{metrics.approved}</div>
          <p className="text-[11px] text-slate-500 mt-1">Ready for warehouse restocking</p>
        </button>

        {/* Stock Restocked */}
        <button
          onClick={() => setStatusFilter('RESTOCKED')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'RESTOCKED'
              ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
              : 'bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/50 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Restocked</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-700">{metrics.restocked}</div>
          <p className="text-[11px] text-slate-500 mt-1">Added to warehouse stock</p>
        </button>

        {/* Refunded */}
        <button
          onClick={() => setStatusFilter('REFUNDED')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'REFUNDED'
              ? 'bg-purple-50/70 border-purple-300 ring-2 ring-purple-500/20 shadow-xs'
              : 'bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/50 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">Refunded</span>
            <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-purple-700">{metrics.refunded}</div>
          <p className="text-[11px] text-slate-500 mt-1">Settled payments</p>
        </button>
      </div>

      {/* 3. Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search return ID, invoice #, customer name, phone, product, SKU, barcode..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-800 placeholder-slate-400"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">
              ✕
            </button>
          )}
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="text-xs text-slate-700 bg-transparent border-0 focus:ring-0 cursor-pointer outline-none font-medium"
              aria-label="Filter by Status"
            >
              <option value="ALL">All Returns</option>
              <option value="PENDING">Pending Review</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="RESTOCKED">Stock Restocked</option>
              <option value="REFUNDED">Refunded</option>
            </select>
          </div>

          {/* Condition Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
            <span className="text-xs text-slate-400 font-medium">Condition:</span>
            <select
              value={conditionFilter}
              onChange={e => setConditionFilter(e.target.value)}
              className="text-xs text-slate-700 bg-transparent border-0 focus:ring-0 cursor-pointer outline-none font-medium"
              aria-label="Filter by Condition"
            >
              <option value="ALL">All Conditions</option>
              <option value="Resalable">Resalable</option>
              <option value="Damaged">Damaged</option>
              <option value="Defective">Defective</option>
              <option value="Expired">Expired</option>
            </select>
          </div>

          {(searchQuery || statusFilter !== 'ALL' || conditionFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
                setConditionFilter('ALL');
              }}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-2 py-1.5 cursor-pointer whitespace-nowrap"
            >
              Reset Filters
            </button>
          )}
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

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/90 text-slate-700 font-semibold uppercase text-[11px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3.5 pl-5 pr-3 text-left min-w-[120px]">Return ID</th>
                <th className="py-3.5 px-3 text-left min-w-[130px]">Original Invoice / Bill</th>
                <th className="py-3.5 px-3 text-left min-w-[100px]">Return Date</th>
                <th className="py-3.5 px-3 text-left min-w-[160px]">Customer Name</th>
                <th className="py-3.5 px-3 text-left min-w-[180px]">Product Name</th>
                <th className="py-3.5 px-3 text-left min-w-[120px]">SKU / Barcode</th>
                <th className="py-3.5 px-3 text-center min-w-[110px]">Returned Qty</th>
                <th className="py-3.5 px-3 text-left min-w-[160px]">Return Reason</th>
                <th className="py-3.5 px-3 text-center min-w-[110px]">Refund Status</th>
                <th className="py-3.5 px-3 text-center min-w-[120px]">Return Status</th>
                <th className="py-3.5 pl-3 pr-5 text-center min-w-[110px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <RotateCcw className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600 text-sm">No customer returns found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {customerReturns.length === 0
                        ? 'No customer returns have been recorded yet. Click "New Customer Return" to submit a return.'
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
                      {/* Return ID */}
                      <td className="py-3.5 pl-5 pr-3 align-middle font-mono font-bold text-indigo-700">
                        {ret.returnNumber}
                      </td>

                      {/* Original Invoice */}
                      <td className="py-3.5 px-3 align-middle">
                        <span className="font-mono font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px] border border-slate-200">
                          {ret.originalInvoiceNumber}
                        </span>
                      </td>

                      {/* Return Date */}
                      <td className="py-3.5 px-3 align-middle text-slate-600 font-mono text-[11px]">
                        {formatDate(ret.returnDate)}
                      </td>

                      {/* Customer Name */}
                      <td className="py-3.5 px-3 align-middle">
                        <div className="font-bold text-slate-900">{ret.customerName}</div>
                        {ret.customerPhone && (
                          <div className="text-[11px] text-slate-400 font-normal">{ret.customerPhone}</div>
                        )}
                      </td>

                      {/* Product Name */}
                      <td className="py-3.5 px-3 align-middle">
                        <div className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {ret.productName}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span
                            className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider ${
                              ret.condition === 'Resalable'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : ret.condition === 'Damaged'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : ret.condition === 'Defective'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-purple-50 text-purple-700 border border-purple-200'
                            }`}
                          >
                            {ret.condition}
                          </span>
                        </div>
                      </td>

                      {/* SKU / Barcode */}
                      <td className="py-3.5 px-3 align-middle font-mono text-slate-600 text-xs">
                        <div>{ret.sku || ret.barcode || '—'}</div>
                      </td>

                      {/* Returned Quantity and Unit */}
                      <td className="py-3.5 px-3 text-center align-middle font-mono">
                        <span className="font-bold text-slate-900">
                          {formatNumber(ret.returnedQty)}
                        </span>{' '}
                        <span className="text-[11px] text-slate-500 font-normal">{ret.unit}</span>
                        <div className="text-[10px] text-slate-400 font-normal">
                          (sold: {ret.soldQty})
                        </div>
                      </td>

                      {/* Return Reason */}
                      <td className="py-3.5 px-3 align-middle max-w-[200px] truncate text-slate-700 text-xs" title={ret.reason}>
                        {ret.reason}
                      </td>

                      {/* Refund Status */}
                      <td className="py-3.5 px-3 text-center align-middle">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                            ret.refundStatus === 'Refunded'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : ret.refundStatus === 'Rejected'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {ret.refundStatus}
                        </span>
                        {ret.refundStatus === 'Refunded' && ret.refundMethod && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            via {ret.refundMethod}
                          </div>
                        )}
                      </td>

                      {/* Return Status */}
                      <td className="py-3.5 px-3 text-center align-middle">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                            ret.returnStatus === 'Stock Restocked'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : ret.returnStatus === 'Approved'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : ret.returnStatus === 'Rejected'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {ret.returnStatus}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 pl-3 pr-5 text-center align-middle">
                        <div className="flex items-center justify-center gap-1.5" onClick={e => e.stopPropagation()}>
                          {/* View Inspection */}
                          <button
                            onClick={() => setInspectingReturn(ret)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                            title="View Return Details"
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
        title="Create Customer Return"
        size="lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Original Invoice Selector */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Select Original Sales Invoice / Bill <span className="text-rose-500">*</span>
            </label>
            <select
              value={formInvoiceId}
              onChange={e => handleInvoiceChange(e.target.value)}
              required
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium focus:bg-white focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">-- Choose Sales Invoice --</option>
              {eligibleInvoices.map(inv => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoiceNumber} — {inv.customerName} ({formatDate(inv.date)}) [₹{formatNumber(inv.grandTotal)}]
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
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Sold Quantity</span>
                <span className="font-mono font-bold text-slate-800 text-sm">
                  {selectedItem.qty} {selectedItem.unit || 'Piece'}
                </span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Eligible to Return</span>
                <span className="font-mono font-bold text-emerald-700 text-sm">
                  {remainingEligibleQty} {selectedItem.unit || 'Piece'}
                </span>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Quantity Returning <span className="text-rose-500">*</span>
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
            <p className="text-[10px] text-slate-500 mt-1">
              * Note: Only items marked <strong>Resalable</strong> will enter available inventory upon approval. Damaged, Defective, or Expired items are strictly kept out of sellable stock.
            </p>
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
              <option value="Customer received wrong product / specification mismatch">Customer received wrong product / specification mismatch</option>
              <option value="Defective / Quality issue on delivery">Defective / Quality issue on delivery</option>
              <option value="Damaged packaging during transit">Damaged packaging during transit</option>
              <option value="Customer changed mind / surplus project stock">Customer changed mind / surplus project stock</option>
              <option value="Expired stock returned">Expired stock returned</option>
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
              Starts as <strong>Pending Review</strong>. Inventory is not modified.
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 cursor-pointer font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold cursor-pointer shadow-xs"
              >
                Submit Customer Return
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* --------------------------------------------------------------------- */}
      {/* MODAL 2: Return Inspection Details                                     */}
      {/* --------------------------------------------------------------------- */}
      <Modal
        isOpen={Boolean(inspectingReturn)}
        onClose={() => setInspectingReturn(null)}
        title={inspectingReturn ? `Customer Return ${inspectingReturn.returnNumber}` : 'Return Details'}
        size="md"
      >
        {inspectingReturn && (
          <div className="space-y-4 text-xs">
            {/* Statuses Header */}
            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Return Status</span>
                <span className="font-bold text-slate-900 text-sm">{inspectingReturn.returnStatus}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Refund Status</span>
                <span className="font-bold text-indigo-700 text-sm">{inspectingReturn.refundStatus}</span>
              </div>
            </div>

            {/* Main Specs */}
            <div className="grid grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block">Original Invoice</span>
                <span className="font-mono font-bold text-slate-800">{inspectingReturn.originalInvoiceNumber}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block">Return Date</span>
                <span className="font-mono text-slate-800">{formatDate(inspectingReturn.returnDate)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block">Customer</span>
                <span className="font-bold text-slate-900">{inspectingReturn.customerName}</span>
                <span className="text-[11px] text-slate-500 block">{inspectingReturn.customerPhone || 'No phone'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block">Destination Warehouse</span>
                <span className="font-medium text-slate-800">{inspectingReturn.warehouseName || 'Main Godown'}</span>
              </div>
            </div>

            {/* Product & Quantity */}
            <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl">
              <span className="text-[10px] text-indigo-700 font-semibold uppercase block mb-1">Returned Product</span>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 text-sm">{inspectingReturn.productName}</div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    SKU: {inspectingReturn.sku || 'N/A'} | Condition: <strong>{inspectingReturn.condition}</strong>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-base text-indigo-900">
                    {inspectingReturn.returnedQty} {inspectingReturn.unit}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Est. Value: {formatCurrency(inspectingReturn.refundAmount)}
                  </div>
                </div>
              </div>
            </div>

            {/* Reason & Notes */}
            <div className="space-y-2">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block mb-0.5">Reason</span>
                <p className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800">
                  {inspectingReturn.reason}
                </p>
              </div>
              {inspectingReturn.notes && (
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block mb-0.5">Notes</span>
                  <p className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-600">
                    {inspectingReturn.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Timeline Audit */}
            <div className="border-t border-slate-100 pt-3 space-y-1 text-[11px] text-slate-500">
              <div>Submitted by: <strong className="text-slate-700">{inspectingReturn.createdByName || 'Staff'}</strong> on {formatDate(inspectingReturn.createdAt)}</div>
              {inspectingReturn.approvedAt && (
                <div>Approved by: <strong className="text-slate-700">{inspectingReturn.approvedByName || 'Manager'}</strong> on {formatDate(inspectingReturn.approvedAt)}</div>
              )}
              {inspectingReturn.restockedAt && (
                <div>Restocked by: <strong className="text-slate-700">{inspectingReturn.restockedByName || 'Warehouse'}</strong> on {formatDate(inspectingReturn.restockedAt)}</div>
              )}
              {inspectingReturn.refundedAt && (
                <div>Refunded by: <strong className="text-slate-700">{inspectingReturn.refundedByName || 'Cashier'}</strong> via {inspectingReturn.refundMethod} on {formatDate(inspectingReturn.refundedAt)}</div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setInspectingReturn(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
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
