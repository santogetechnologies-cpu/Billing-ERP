import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  CreditCard,
  History,
  Eye,
  Check,
  X,
  Search,
  Filter,
  RefreshCw,
  Building2,
  DollarSign,
  Calendar,
  AlertCircle,
  FileCheck,
  Send,
  ArrowRight
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { hasPermission } from '../../utils/rbac';
import { PaymentMethod, PaymentRecord } from '../../types';
import {
  supplierBillService,
  SupplierBillItem,
  SupplierBillTab,
  SupplierBillSummary
} from '../../services/supplierBillService';
import { Modal } from '../common/Modal';

interface SupplierBillsSectionProps {
  initialTab?: SupplierBillTab;
}

export const SupplierBillsSection: React.FC<SupplierBillsSectionProps> = ({
  initialTab = 'Pending Review'
}) => {
  const { profile } = useAuth();
  const { company, suppliers, refreshData } = useERP();

  const [activeTab, setActiveTab] = useState<SupplierBillTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState('All');
  const [isLoading, setIsLoading] = useState(false);
  const [dataSummary, setDataSummary] = useState<SupplierBillSummary>({
    bills: [],
    counts: {
      pendingReview: 0,
      approvedForPayment: 0,
      partiallyPaid: 0,
      paid: 0,
      overdue: 0,
      all: 0
    },
    totals: {
      totalBillsAmount: 0,
      pendingReviewAmount: 0,
      approvedAmount: 0,
      partiallyPaidAmount: 0,
      paidAmount: 0,
      overdueAmount: 0
    }
  });

  // Modals state
  const [selectedBillForDetails, setSelectedBillForDetails] = useState<SupplierBillItem | null>(null);
  const [selectedBillForVerify, setSelectedBillForVerify] = useState<SupplierBillItem | null>(null);
  const [selectedBillForPayment, setSelectedBillForPayment] = useState<SupplierBillItem | null>(null);
  const [selectedBillForHistory, setSelectedBillForHistory] = useState<SupplierBillItem | null>(null);

  // Verification Form State
  const [verifyAction, setVerifyAction] = useState<'Approve' | 'Correct'>('Approve');
  const [verifyNotes, setVerifyNotes] = useState('');
  const [isSubmittingVerify, setIsSubmittingVerify] = useState(false);

  // Payment Form State
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Bank Transfer');
  const [paymentAccount, setPaymentAccount] = useState('Main Operating A/C');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Payment History State
  const [billPaymentsList, setBillPaymentsList] = useState<PaymentRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Feedback Notification banner
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const canApprove = hasPermission(profile?.role, 'payments', 'approve') || profile?.role === 'Accountant' || profile?.role === 'Admin' || profile?.role === 'Owner';
  const canPay = hasPermission(profile?.role, 'payments', 'create') || profile?.role === 'Accountant' || profile?.role === 'Admin' || profile?.role === 'Owner';

  // Load bills
  const loadBills = useCallback(async () => {
    setIsLoading(true);
    try {
      const summary = await supplierBillService.getSupplierBills(company?.id, {
        tab: activeTab,
        search: searchQuery,
        supplierId: selectedSupplierFilter
      });
      setDataSummary(summary);
    } catch (err: any) {
      console.warn('Error loading supplier bills:', err);
    } finally {
      setIsLoading(false);
    }
  }, [company?.id, activeTab, searchQuery, selectedSupplierFilter]);

  useEffect(() => {
    loadBills();
  }, [loadBills]);

  // Check and send due notifications periodically
  useEffect(() => {
    if (profile?.role === 'Accountant' || profile?.role === 'Admin' || profile?.role === 'Owner') {
      supplierBillService.checkAndSendBillDueNotifications(company?.id);
    }
  }, [company?.id, profile?.role]);

  // Handle Verify Action
  const handleOpenVerifyModal = (bill: SupplierBillItem) => {
    setSelectedBillForVerify(bill);
    setVerifyAction('Approve');
    setVerifyNotes('');
  };

  const handleSubmitVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBillForVerify || isSubmittingVerify) return;

    setIsSubmittingVerify(true);
    try {
      const newStatus = verifyAction === 'Approve' ? 'Approved for Payment' : 'Correction Requested';
      await supplierBillService.verifySupplierBill(
        {
          billId: selectedBillForVerify.id,
          status: newStatus,
          notes: verifyNotes,
          userProfile: profile
            ? {
                id: profile.id,
                fullName: (profile as any).full_name || (profile as any).fullName || profile.email || 'Accountant',
                role: profile.role || 'Accountant'
              }
            : undefined
        },
        company?.id
      );

      setFeedback({
        type: 'success',
        message: verifyAction === 'Approve'
          ? `Bill #${selectedBillForVerify.invoiceNumber} verified and approved for payment!`
          : `Bill #${selectedBillForVerify.invoiceNumber} flagged for correction. Purchase Manager has been notified.`
      });

      setSelectedBillForVerify(null);
      await loadBills();
      if (refreshData) await refreshData();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Failed to update bill verification: ${err.message || 'Error occurred'}`
      });
    } finally {
      setIsSubmittingVerify(false);
    }
  };

  // Handle Payment Action
  const handleOpenPaymentModal = (bill: SupplierBillItem) => {
    setSelectedBillForPayment(bill);
    setPaymentAmount(String(bill.balanceDue));
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod('Bank Transfer');
    setPaymentAccount('Main Operating A/C');
    setPaymentReference(`INV-${bill.invoiceNumber}`);
    setPaymentNotes(`Payment for Supplier Bill #${bill.invoiceNumber}`);
  };

  const parsedPaymentAmount = Number(paymentAmount) || 0;
  const paymentBalanceRemaining = useMemo(() => {
    if (!selectedBillForPayment) return 0;
    return Math.max(0, selectedBillForPayment.balanceDue - parsedPaymentAmount);
  }, [selectedBillForPayment, parsedPaymentAmount]);

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBillForPayment || isSubmittingPayment) return;

    if (parsedPaymentAmount <= 0) {
      alert('Payment amount must be greater than zero.');
      return;
    }

    if (parsedPaymentAmount > selectedBillForPayment.balanceDue) {
      alert(`Payment cannot exceed remaining balance of ${formatCurrency(selectedBillForPayment.balanceDue)}.`);
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const { payment, updatedBill } = await supplierBillService.recordSupplierBillPayment(
        {
          billId: selectedBillForPayment.id,
          amount: parsedPaymentAmount,
          paymentMethod,
          date: paymentDate,
          account: paymentAccount,
          reference: paymentReference,
          notes: paymentNotes,
          userProfile: profile
            ? {
                id: profile.id,
                fullName: (profile as any).full_name || (profile as any).fullName || profile.email || 'Accountant',
                role: profile.role || 'Accountant'
              }
            : undefined
        },
        company?.id
      );

      setFeedback({
        type: 'success',
        message: `Payment of ${formatCurrency(parsedPaymentAmount)} recorded successfully (Receipt: ${payment.paymentNumber}). Remaining Balance: ${formatCurrency(updatedBill.balanceDue)}.`
      });

      setSelectedBillForPayment(null);
      await loadBills();
      if (refreshData) await refreshData();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Failed to record payment: ${err.message || 'Error'}`
      });
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Handle Payment History Modal
  const handleOpenPaymentHistory = async (bill: SupplierBillItem) => {
    setSelectedBillForHistory(bill);
    setIsLoadingHistory(true);
    try {
      const history = await supplierBillService.getBillPaymentHistory(bill.id, company?.id);
      setBillPaymentsList(history);
    } catch (err) {
      console.warn('Failed to load bill payments history:', err);
      setBillPaymentsList([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const tabs: Array<{ id: SupplierBillTab; label: string; count: number; color: string }> = [
    {
      id: 'Pending Review',
      label: 'Pending Review',
      count: dataSummary.counts.pendingReview,
      color: 'bg-amber-100 text-amber-800 border-amber-200'
    },
    {
      id: 'Approved for Payment',
      label: 'Approved for Payment',
      count: dataSummary.counts.approvedForPayment,
      color: 'bg-blue-100 text-blue-800 border-blue-200'
    },
    {
      id: 'Partially Paid',
      label: 'Partially Paid',
      count: dataSummary.counts.partiallyPaid,
      color: 'bg-purple-100 text-purple-800 border-purple-200'
    },
    {
      id: 'Paid',
      label: 'Paid',
      count: dataSummary.counts.paid,
      color: 'bg-emerald-100 text-emerald-800 border-emerald-200'
    },
    {
      id: 'Overdue',
      label: 'Overdue',
      count: dataSummary.counts.overdue,
      color: 'bg-rose-100 text-rose-800 border-rose-200'
    },
    {
      id: 'All',
      label: 'All Bills',
      count: dataSummary.counts.all,
      color: 'bg-slate-100 text-slate-700 border-slate-200'
    }
  ];

  return (
    <div className="space-y-5">
      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs shadow-xs transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-semibold">{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 rounded-md hover:bg-black/5 text-slate-500"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Section Header & KPI Summary */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-blue-600" />
              Supplier Bills & Payments
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Verify supplier invoices against Purchase Orders, approve for disbursement, and record payments with real-time balance tracking.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => loadBills()}
              disabled={isLoading}
              className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* 5 Tab Navigation Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/70'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-white/20 text-white' : tab.color
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Supplier Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by Bill #, PO #, PR #, or Supplier..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={selectedSupplierFilter}
              onChange={e => setSelectedSupplierFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 w-full sm:w-48 cursor-pointer"
            >
              <option value="All">All Suppliers</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>
                  {s.company || s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Bills Table (11 Columns Required) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/90 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-3">Supplier Bill #</th>
                <th className="py-3 px-3">PO Number</th>
                <th className="py-3 px-3">PR Number</th>
                <th className="py-3 px-3 min-w-[150px]">Supplier Name</th>
                <th className="py-3 px-3">Bill Date</th>
                <th className="py-3 px-3">Due Date</th>
                <th className="py-3 px-3 text-right">Total Bill Amount</th>
                <th className="py-3 px-3 text-right">Amount Paid</th>
                <th className="py-3 px-3 text-right">Balance Due</th>
                <th className="py-3 px-3 text-center">Payment Status</th>
                <th className="py-3 px-3 text-center min-w-[170px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <span className="w-5 h-5 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin inline-block mr-2" />
                    Loading supplier bills...
                  </td>
                </tr>
              ) : dataSummary.bills.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-500">
                    <FileCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">No supplier bills found in this tab.</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {activeTab === 'Pending Review'
                        ? 'New bills recorded by the Purchase Manager will automatically appear here for verification.'
                        : 'No bills match the selected filter criteria.'}
                    </p>
                  </td>
                </tr>
              ) : (
                dataSummary.bills.map(bill => {
                  return (
                    <tr key={bill.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* 1. Supplier Bill Number */}
                      <td className="py-3 px-3">
                        <div className="font-mono font-bold text-blue-700">{bill.invoiceNumber}</div>
                        {bill.supplierInvoiceNumber && bill.supplierInvoiceNumber !== bill.invoiceNumber && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            Inv: {bill.supplierInvoiceNumber}
                          </div>
                        )}
                        {bill.hasDiscrepancy && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-[9px] font-semibold border border-amber-200 mt-0.5"
                            title={bill.discrepancyNotes || 'Discrepancy detected against PO'}
                          >
                            <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                            <span>Discrepancy</span>
                          </span>
                        )}
                        {bill.verificationStatus === 'Correction Requested' && (
                          <span className="inline-block px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded text-[9px] font-semibold border border-rose-200 mt-0.5">
                            Correction Requested
                          </span>
                        )}
                        {bill.verificationStatus === 'Approved for Payment' && (
                          <span className="inline-block px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[9px] font-semibold border border-emerald-200 mt-0.5">
                            Verified
                          </span>
                        )}
                      </td>

                      {/* 2. Purchase Order Number */}
                      <td className="py-3 px-3 font-mono text-slate-700">
                        {bill.purchaseOrderNumber ? (
                          <span className="font-semibold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                            {bill.purchaseOrderNumber}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Direct Bill</span>
                        )}
                      </td>

                      {/* 3. Purchase Request Number */}
                      <td className="py-3 px-3 font-mono text-slate-600">
                        {bill.purchaseRequestNumber ? (
                          <span className="font-medium text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded text-[11px]">
                            {bill.purchaseRequestNumber}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      {/* 4. Supplier Name */}
                      <td className="py-3 px-3 font-medium text-slate-900">
                        <div className="truncate max-w-[180px] font-semibold">{bill.supplierName}</div>
                        {bill.supplierGstin && (
                          <div className="text-[10px] text-slate-400 font-mono">GST: {bill.supplierGstin}</div>
                        )}
                      </td>

                      {/* 5. Bill Date */}
                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                        {formatDate(bill.date)}
                      </td>

                      {/* 6. Due Date */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {bill.dueDate ? (
                          <div className={bill.isOverdue ? 'text-rose-600 font-bold flex items-center gap-1' : 'text-slate-700'}>
                            {bill.isOverdue && <AlertTriangle className="w-3 h-3 text-rose-600 inline" />}
                            <span>{formatDate(bill.dueDate)}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* 7. Total Bill Amount */}
                      <td className="py-3 px-3 text-right font-bold text-slate-900">
                        {formatCurrency(bill.grandTotal)}
                      </td>

                      {/* 8. Amount Paid */}
                      <td className="py-3 px-3 text-right text-emerald-700 font-semibold">
                        {formatCurrency(bill.paidAmount || 0)}
                      </td>

                      {/* 9. Balance Due */}
                      <td className="py-3 px-3 text-right font-bold text-rose-600">
                        {formatCurrency(bill.balanceDue)}
                      </td>

                      {/* 10. Payment Status */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            bill.paymentStatus === 'Paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : bill.paymentStatus === 'Partially Paid'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {bill.paymentStatus || 'Unpaid'}
                        </span>
                      </td>

                      {/* 11. Actions */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* View Bill Details */}
                          <button
                            type="button"
                            onClick={() => setSelectedBillForDetails(bill)}
                            title="View Bill Details"
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Verify Bill (Accountant Review) */}
                          {canApprove && (
                            <button
                              type="button"
                              onClick={() => handleOpenVerifyModal(bill)}
                              title={bill.verificationStatus === 'Approved for Payment' ? 'Re-verify Bill' : 'Verify Bill for Payment'}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                bill.verificationStatus === 'Approved for Payment'
                                  ? 'text-emerald-700 hover:bg-emerald-50'
                                  : 'text-amber-600 hover:bg-amber-50 hover:text-amber-800 font-bold'
                              }`}
                            >
                              <FileCheck className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Record Payment */}
                          {canPay && bill.balanceDue > 0 && (
                            <button
                              type="button"
                              onClick={() => handleOpenPaymentModal(bill)}
                              title="Record Supplier Payment"
                              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-semibold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                            >
                              <CreditCard className="w-3 h-3" />
                              <span>Pay</span>
                            </button>
                          )}

                          {/* Payment History */}
                          <button
                            type="button"
                            onClick={() => handleOpenPaymentHistory(bill)}
                            title="View Payment History"
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
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

      {/* MODAL 1: Bill Details Modal */}
      {selectedBillForDetails && (
        <Modal
          isOpen={Boolean(selectedBillForDetails)}
          onClose={() => setSelectedBillForDetails(null)}
          title={`Supplier Bill #${selectedBillForDetails.invoiceNumber}`}
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Supplier</span>
                <strong className="text-slate-900">{selectedBillForDetails.supplierName}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">PO Number</span>
                <span className="font-mono text-blue-700 font-bold">
                  {selectedBillForDetails.purchaseOrderNumber || 'Direct Purchase'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Request Number</span>
                <span className="font-mono text-purple-700 font-bold">
                  {selectedBillForDetails.purchaseRequestNumber || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Verification</span>
                <span className="font-semibold text-slate-900">
                  {selectedBillForDetails.verificationStatus || 'Pending Review'}
                </span>
              </div>
            </div>

            {Boolean(selectedBillForDetails.hasDiscrepancy || selectedBillForDetails.discrepancyNotes) && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-[10px] uppercase text-amber-800">
                    Discrepancy Warning Flagged Against PO
                  </span>
                  <p className="mt-0.5 text-amber-800">
                    {selectedBillForDetails.discrepancyNotes ||
                      'Invoiced rates or quantities differ from the approved Purchase Order.'}
                  </p>
                </div>
              </div>
            )}

            {selectedBillForDetails.correctionNotes && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800">
                <span className="font-bold block text-[10px] uppercase">Accountant Correction Notes:</span>
                <p className="mt-0.5">{selectedBillForDetails.correctionNotes}</p>
              </div>
            )}

            {/* Line items */}
            <div>
              <h4 className="font-bold text-slate-800 mb-2">Purchased Items & Rates</h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead className="bg-slate-100 text-slate-600 uppercase text-[9px] font-bold">
                    <tr>
                      <th className="py-2 px-3">Item</th>
                      <th className="py-2 px-3 text-right">Qty</th>
                      <th className="py-2 px-3 text-right">Rate</th>
                      <th className="py-2 px-3 text-right">Tax Rate</th>
                      <th className="py-2 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedBillForDetails.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 font-medium text-slate-800">{it.productName}</td>
                        <td className="py-2 px-3 text-right">{it.qty} {it.unit}</td>
                        <td className="py-2 px-3 text-right">{formatCurrency(it.rate)}</td>
                        <td className="py-2 px-3 text-right">{it.taxRate}%</td>
                        <td className="py-2 px-3 text-right font-bold">{formatCurrency(it.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial summary */}
            <div className="flex justify-between items-center pt-2 border-t border-slate-200">
              <div className="text-slate-500 text-[11px]">
                Paid: <strong className="text-emerald-700">{formatCurrency(selectedBillForDetails.paidAmount || 0)}</strong>
              </div>
              <div className="text-right">
                <span className="text-slate-500 text-[11px] block">Balance Outstanding:</span>
                <span className="text-base font-bold text-rose-600">
                  {formatCurrency(selectedBillForDetails.balanceDue)}
                </span>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 2: Verify Bill Modal (Accountant Verification) */}
      {selectedBillForVerify && (
        <Modal
          isOpen={Boolean(selectedBillForVerify)}
          onClose={() => setSelectedBillForVerify(null)}
          title={`Verify Supplier Bill #${selectedBillForVerify.invoiceNumber}`}
        >
          <form onSubmit={handleSubmitVerification} className="space-y-4 text-xs">
            <p className="text-slate-600">
              Verify invoice details submitted by Purchase Manager against supplier details and purchase orders before authorizing payment disbursement.
            </p>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Supplier:</span>
                <strong className="text-slate-900">{selectedBillForVerify.supplierName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Linked Purchase Order:</span>
                <strong className="font-mono text-blue-700">
                  {selectedBillForVerify.purchaseOrderNumber || 'Direct Purchase'}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Invoice Amount:</span>
                <strong className="font-bold text-slate-900">
                  {formatCurrency(selectedBillForVerify.grandTotal)}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Due Date:</span>
                <strong className="text-slate-900">
                  {selectedBillForVerify.dueDate ? formatDate(selectedBillForVerify.dueDate) : 'Immediate'}
                </strong>
              </div>
            </div>

            {Boolean(selectedBillForVerify.hasDiscrepancy || selectedBillForVerify.discrepancyNotes) && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-[10px] uppercase text-amber-800">
                    Attention: Discrepancy Detected Against PO
                  </span>
                  <p className="mt-0.5 text-amber-800">
                    {selectedBillForVerify.discrepancyNotes ||
                      'Invoiced rates or quantities differ from the approved Purchase Order.'}
                  </p>
                </div>
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-800 mb-1">Verification Decision</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setVerifyAction('Approve')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    verifyAction === 'Approve'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500/20'
                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>Approve for Payment</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Bill is verified. Moves directly to Approved for Payment tab.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setVerifyAction('Correct')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    verifyAction === 'Correct'
                      ? 'bg-rose-50 border-rose-500 text-rose-900 ring-2 ring-rose-500/20'
                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5 text-rose-700">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    <span>Flag for Correction</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Send back to Purchase Manager with specific adjustment instructions.
                  </p>
                </button>
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                {verifyAction === 'Approve' ? 'Verification Notes (Optional)' : 'Reason / Correction Instructions (Required)'}
              </label>
              <textarea
                rows={3}
                value={verifyNotes}
                onChange={e => setVerifyNotes(e.target.value)}
                required={verifyAction === 'Correct'}
                placeholder={
                  verifyAction === 'Approve'
                    ? 'Verified rates and receiving documents. Approved for payment release.'
                    : 'Specify discrepancies in rates, quantities, tax, or missing GRN...'
                }
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedBillForVerify(null)}
                className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingVerify}
                className={`px-4 py-1.5 text-white rounded-lg font-semibold shadow-xs flex items-center gap-1.5 ${
                  verifyAction === 'Approve'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {isSubmittingVerify ? (
                  <span>Saving...</span>
                ) : verifyAction === 'Approve' ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirm Approval</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Correction Request</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 3: Record Payment Modal */}
      {selectedBillForPayment && (
        <Modal
          isOpen={Boolean(selectedBillForPayment)}
          onClose={() => setSelectedBillForPayment(null)}
          title={`Record Supplier Payment — Bill #${selectedBillForPayment.invoiceNumber}`}
        >
          <form onSubmit={handleSubmitPayment} className="space-y-4 text-xs">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Supplier:</span>
                <strong className="text-slate-900">{selectedBillForPayment.supplierName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Invoice Amount:</span>
                <span className="font-semibold text-slate-800">
                  {formatCurrency(selectedBillForPayment.grandTotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Already Paid:</span>
                <span className="text-emerald-700 font-semibold">
                  {formatCurrency(selectedBillForPayment.paidAmount || 0)}
                </span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-slate-200">
                <span className="font-bold text-slate-800">Remaining Balance:</span>
                <strong className="font-bold text-rose-600">
                  {formatCurrency(selectedBillForPayment.balanceDue)}
                </strong>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-800 mb-1">Payment Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedBillForPayment.balanceDue}
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-blue-700 focus:bg-white text-sm"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Payment Date *</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Payment Method *</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer font-medium"
                >
                  <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                  <option value="UPI">UPI / Digital</option>
                  <option value="Cheque">Bank Cheque</option>
                  <option value="Cash">Cash Voucher</option>
                  <option value="Card">Debit / Credit Card</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Disbursement Account *</label>
                <input
                  type="text"
                  value={paymentAccount}
                  onChange={e => setPaymentAccount(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Transaction Reference / UTR #</label>
              <input
                type="text"
                value={paymentReference}
                onChange={e => setPaymentReference(e.target.value)}
                placeholder="e.g. UTR198273641 or Cheque #8912"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Payment Notes / Memo</label>
              <input
                type="text"
                value={paymentNotes}
                onChange={e => setPaymentNotes(e.target.value)}
                placeholder="Optional bookkeeping notes"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>

            {/* Dynamic Balance Preview */}
            <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500 block">Status after payment:</span>
                <strong className={paymentBalanceRemaining === 0 ? 'text-emerald-700' : 'text-purple-700'}>
                  {paymentBalanceRemaining === 0 ? 'Fully Paid' : 'Partially Paid'}
                </strong>
              </div>
              <div className="text-right">
                <span className="text-slate-500 block">Remaining Balance:</span>
                <strong className="text-slate-900 font-mono">
                  {formatCurrency(paymentBalanceRemaining)}
                </strong>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedBillForPayment(null)}
                className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingPayment || parsedPaymentAmount <= 0}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSubmittingPayment ? (
                  <span>Recording...</span>
                ) : (
                  <>
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Confirm & Post Payment</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 4: Payment History Modal */}
      {selectedBillForHistory && (
        <Modal
          isOpen={Boolean(selectedBillForHistory)}
          onClose={() => setSelectedBillForHistory(null)}
          title={`Payment History — Bill #${selectedBillForHistory.invoiceNumber}`}
        >
          <div className="space-y-4 text-xs">
            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Supplier</span>
                <strong className="text-slate-900">{selectedBillForHistory.supplierName}</strong>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Paid</span>
                <strong className="text-emerald-700 text-sm">
                  {formatCurrency(selectedBillForHistory.paidAmount || 0)}
                </strong>
              </div>
            </div>

            {isLoadingHistory ? (
              <div className="py-8 text-center text-slate-400">Loading payment records...</div>
            ) : billPaymentsList.length === 0 ? (
              <div className="py-8 text-center text-slate-500">
                <CreditCard className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                <p>No payments recorded yet for this bill.</p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead className="bg-slate-100 text-slate-600 uppercase text-[9px] font-bold">
                    <tr>
                      <th className="py-2 px-3">Receipt #</th>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Method</th>
                      <th className="py-2 px-3">Account</th>
                      <th className="py-2 px-3">Reference</th>
                      <th className="py-2 px-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {billPaymentsList.map(pay => (
                      <tr key={pay.id}>
                        <td className="py-2 px-3 font-mono font-bold text-blue-700">{pay.paymentNumber}</td>
                        <td className="py-2 px-3 text-slate-600">{formatDate(pay.date)}</td>
                        <td className="py-2 px-3 font-medium text-slate-800">{pay.paymentMethod}</td>
                        <td className="py-2 px-3 text-slate-600">{pay.account || 'Main'}</td>
                        <td className="py-2 px-3 font-mono text-slate-500">{pay.reference || '—'}</td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-700">
                          {formatCurrency(pay.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
