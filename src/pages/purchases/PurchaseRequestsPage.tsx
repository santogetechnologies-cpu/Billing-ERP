import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams, useParams, useLocation } from 'react-router-dom';
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  XCircle,
  HelpCircle,
  Plus,
  Search,
  Filter,
  Eye,
  ArrowLeft,
  Warehouse as WarehouseIcon,
  User as UserIcon,
  AlertTriangle,
  Calendar,
  Send,
  Loader2,
  Truck,
  Package,
  ExternalLink,
  ChevronRight,
  ScanBarcode
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { canManageBarcodeOverride } from '../../utils/rbac';
import { StatCard } from '../../components/common/StatCard';
import { Modal } from '../../components/common/Modal';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatNumber, formatDate } from '../../utils/formatters';
import { purchaseRequestService } from '../../services/purchaseRequestService';
import {
  PurchaseRequest,
  PurchaseRequestPriority
} from '../../types';

const STATUS_TABS = [
  'All',
  'Pending Review',
  'Approved',
  'Ordered',
  'Completed',
  'Rejected'
] as const;

export const PurchaseRequestsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: paramId } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();

  // Selected target ID from URL parameter (/purchases/requests/:id) or query parameter (?id=...)
  const targetId = paramId || searchParams.get('id');

  // Identify base path for navigation (Purchase Manager vs Warehouse Manager module)
  const isInventoryPath = location.pathname.startsWith('/inventory');
  const baseRoute = isInventoryPath ? '/inventory/purchase-requests' : '/purchases/requests';

  const { profile } = useAuth();
  const {
    purchaseRequests,
    warehouses,
    suppliers,
    products,
    createPurchaseRequest,
    updatePurchaseRequestStatus,
    createPurchaseOrderFromRequest,
    recordGoodsReceipt,
    refreshPurchaseRequests
  } = useERP();

  const isExecutive = profile?.role === 'Owner' || profile?.role === 'Admin';
  const isPurchaseManager = profile?.role === 'Purchase Manager' || isExecutive;
  const isWarehouseManager = profile?.role === 'Warehouse Manager';

  // Filters for Main List
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    const raw = searchParams.get('status');
    if (!raw) return 'All';
    const low = raw.toLowerCase();
    if (low === 'pending' || low === 'pending review' || low === 'pending approval') {
      return 'Pending Review';
    }
    return raw;
  });
  const [warehouseFilter, setWarehouseFilter] = useState<string>('All');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Fallback direct request fetcher for direct deep links / page reloads
  const [directFetchedRequest, setDirectFetchedRequest] = useState<PurchaseRequest | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);

  // Active Request for Action Modals (Approve, Reject, PO, Goods Receipt)
  const [activeRequest, setActiveRequest] = useState<PurchaseRequest | null>(null);

  // Sub-action Modals
  const [actionType, setActionType] = useState<
    'APPROVE' | 'REJECT' | 'CLARIFY' | 'RESPOND_CLARIFY' | 'CREATE_PO' | 'RECEIVE_GOODS' | 'NEW_REQUEST' | null
  >(null);

  // Action form states
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [clarificationNotes, setClarificationNotes] = useState<string>('');
  const [clarificationResponse, setClarificationResponse] = useState<string>('');
  const [adjustedQuantities, setAdjustedQuantities] = useState<Record<string, { qty: number; reason: string }>>({});

  // PO Creation form state
  const [poSupplierId, setPoSupplierId] = useState<string>('');
  const [poExpectedDate, setPoExpectedDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().split('T')[0];
  });
  const [poItemRates, setPoItemRates] = useState<Record<string, number>>({});
  const [poNotes, setPoNotes] = useState<string>('');

  // Goods Receipt form state
  const [receiptQuantities, setReceiptQuantities] = useState<Record<string, number>>({});
  const [receiptWarehouseId, setReceiptWarehouseId] = useState<string>('');

  // New Request Form State (Manual multi-item)
  const [newReqWarehouseId, setNewReqWarehouseId] = useState<string>('');
  const [newReqPriority, setNewReqPriority] = useState<PurchaseRequestPriority>('Normal');
  const [newReqReason, setNewReqReason] = useState<string>('');
  const [newReqDate, setNewReqDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [newReqItems, setNewReqItems] = useState<
    Array<{ productId: string; requestedQty: number; estimatedCost: number }>
  >([]);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch or resolve request when targetId is present
  useEffect(() => {
    if (targetId) {
      const match = purchaseRequests.find(r => r.id === targetId);
      if (match) {
        setDirectFetchedRequest(match);
      } else {
        setIsLoadingDetail(true);
        purchaseRequestService
          .getPurchaseRequestById(targetId)
          .then(res => {
            if (res) setDirectFetchedRequest(res);
          })
          .catch(err => console.error('Failed to load purchase request details:', err))
          .finally(() => setIsLoadingDetail(false));
      }
    } else {
      setDirectFetchedRequest(null);
    }
  }, [targetId, purchaseRequests]);

  // Selected request instance for the Dedicated Details View
  const selectedRequest = useMemo(() => {
    if (!targetId) return null;
    return purchaseRequests.find(r => r.id === targetId) || directFetchedRequest;
  }, [targetId, purchaseRequests, directFetchedRequest]);

  // Sync statusFilter from URL query param if present
  useEffect(() => {
    const raw = searchParams.get('status');
    if (raw) {
      const low = raw.toLowerCase();
      if (low === 'pending' || low === 'pending review' || low === 'pending approval') {
        setStatusFilter('Pending Review');
      } else {
        setStatusFilter(raw);
      }
    }
  }, [searchParams]);

  // Filtered List for Main Request List
  const filteredRequests = useMemo(() => {
    return purchaseRequests.filter(req => {
      if (statusFilter !== 'All') {
        if (statusFilter === 'Pending Approval' || statusFilter === 'Pending Review') {
          if (
            req.status !== 'Pending Approval' &&
            req.status !== 'Pending Review' &&
            req.status !== 'Under Review' &&
            req.status !== 'Clarification Requested'
          ) {
            return false;
          }
        } else if (statusFilter === 'Ordered') {
          if (req.status !== 'Ordered' && req.status !== 'Partially Received') {
            return false;
          }
        } else if (req.status !== statusFilter) {
          return false;
        }
      }
      if (warehouseFilter !== 'All' && req.warehouseId !== warehouseFilter) return false;
      if (priorityFilter !== 'All' && req.priority !== priorityFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNum = req.requestNumber.toLowerCase().includes(q);
        const matchWh = req.warehouseName.toLowerCase().includes(q);
        const matchUser = req.requesterName.toLowerCase().includes(q);
        const matchProd = req.items.some(i => i.productName.toLowerCase().includes(q) || (i.sku && i.sku.toLowerCase().includes(q)));
        if (!matchNum && !matchWh && !matchUser && !matchProd) return false;
      }
      return true;
    });
  }, [purchaseRequests, statusFilter, warehouseFilter, priorityFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));

  // Clamping page if count shrinks
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, currentPage, pageSize]);

  // Statistics
  const pendingCount = useMemo(
    () => purchaseRequests.filter(r => r.status === 'Pending Approval' || r.status === 'Pending Review').length,
    [purchaseRequests]
  );
  const underReviewCount = useMemo(
    () => purchaseRequests.filter(r => r.status === 'Under Review' || r.status === 'Clarification Requested').length,
    [purchaseRequests]
  );
  const approvedCount = useMemo(
    () => purchaseRequests.filter(r => r.status === 'Approved').length,
    [purchaseRequests]
  );
  const orderedOrReceivedCount = useMemo(
    () => purchaseRequests.filter(r => r.status === 'Ordered' || r.status === 'Partially Received').length,
    [purchaseRequests]
  );

  // Navigation Handlers
  const handleViewDetails = (reqId: string) => {
    navigate(`${baseRoute}/${reqId}`);
  };

  const handleBackToList = () => {
    navigate(baseRoute);
  };

  // Helper to calculate remaining quantity and receiving status for an item
  const getItemMetrics = (it: {
    requestedQty: number;
    approvedQty?: number | null;
    receivedQty?: number;
    remainingQty?: number;
    receivingStatus?: 'Not Received' | 'Partially Received' | 'Fully Received';
  }) => {
    const target = it.approvedQty !== null && it.approvedQty !== undefined ? it.approvedQty : it.requestedQty;
    const received = Number(it.receivedQty || 0);
    const remaining = it.remainingQty !== undefined ? it.remainingQty : Math.max(0, target - received);

    let status = it.receivingStatus;
    if (!status) {
      if (received <= 0) status = 'Not Received';
      else if (received < target) status = 'Partially Received';
      else status = 'Fully Received';
    }
    return { target, received, remaining, status };
  };

  // Open Approval Modal
  const handleOpenApproveModal = (req: PurchaseRequest) => {
    setActiveRequest(req);
    const initialAdjust: Record<string, { qty: number; reason: string }> = {};
    req.items.forEach(it => {
      initialAdjust[it.id] = {
        qty: it.approvedQty !== null && it.approvedQty !== undefined ? it.approvedQty : it.requestedQty,
        reason: ''
      };
    });
    setAdjustedQuantities(initialAdjust);
    setActionType('APPROVE');
    setFeedbackMsg(null);
  };

  // Submit Approval
  const handleSubmitApprove = async () => {
    if (!activeRequest) return;
    setIsSubmitting(true);
    try {
      const adjustedItems = Object.entries(adjustedQuantities).map(([itemId, val]) => ({
        itemId,
        approvedQty: val.qty,
        adjustmentReason: val.reason.trim() || undefined
      }));

      await updatePurchaseRequestStatus({
        requestId: activeRequest.id,
        status: 'Approved',
        comments: 'Purchase request approved for order creation.',
        adjustedItems
      });

      // Refresh data
      await refreshPurchaseRequests();
      if (targetId) {
        const updated = await purchaseRequestService.getPurchaseRequestById(targetId);
        if (updated) setDirectFetchedRequest(updated);
      }

      setFeedbackMsg({ type: 'success', text: `Purchase request #${activeRequest.requestNumber} approved successfully.` });
      setTimeout(() => {
        setActionType(null);
        setIsSubmitting(false);
      }, 1200);
    } catch (err: any) {
      alert(`Approval error: ${err.message}`);
      setIsSubmitting(false);
    }
  };

  // Submit Rejection
  const handleSubmitReject = async () => {
    if (!activeRequest) return;
    if (!rejectionReason.trim()) {
      alert('Please provide a mandatory rejection reason.');
      return;
    }
    setIsSubmitting(true);
    try {
      await updatePurchaseRequestStatus({
        requestId: activeRequest.id,
        status: 'Rejected',
        rejectionReason: rejectionReason.trim(),
        comments: `Rejected by Purchase Manager: ${rejectionReason.trim()}`
      });

      await refreshPurchaseRequests();
      if (targetId) {
        const updated = await purchaseRequestService.getPurchaseRequestById(targetId);
        if (updated) setDirectFetchedRequest(updated);
      }

      setFeedbackMsg({ type: 'success', text: `Purchase request #${activeRequest.requestNumber} rejected.` });
      setTimeout(() => {
        setActionType(null);
        setIsSubmitting(false);
        setRejectionReason('');
      }, 1200);
    } catch (err: any) {
      alert(`Rejection error: ${err.message}`);
      setIsSubmitting(false);
    }
  };

  // Submit Clarification Request
  const handleSubmitClarify = async () => {
    if (!activeRequest) return;
    if (!clarificationNotes.trim()) {
      alert('Please enter clarification questions for the Warehouse Manager.');
      return;
    }
    setIsSubmitting(true);
    try {
      await updatePurchaseRequestStatus({
        requestId: activeRequest.id,
        status: 'Clarification Requested',
        clarificationNotes: clarificationNotes.trim(),
        comments: `Clarification requested: ${clarificationNotes.trim()}`
      });

      await refreshPurchaseRequests();
      if (targetId) {
        const updated = await purchaseRequestService.getPurchaseRequestById(targetId);
        if (updated) setDirectFetchedRequest(updated);
      }

      setFeedbackMsg({ type: 'success', text: `Clarification request sent to ${activeRequest.requesterName}.` });
      setTimeout(() => {
        setActionType(null);
        setIsSubmitting(false);
        setClarificationNotes('');
      }, 1200);
    } catch (err: any) {
      alert(`Clarification error: ${err.message}`);
      setIsSubmitting(false);
    }
  };

  // Submit Response to Clarification (Warehouse Manager)
  const handleSubmitClarifyResponse = async () => {
    if (!activeRequest) return;
    if (!clarificationResponse.trim()) {
      alert('Please provide a response before submitting.');
      return;
    }
    setIsSubmitting(true);
    try {
      await updatePurchaseRequestStatus({
        requestId: activeRequest.id,
        status: 'Under Review',
        comments: `Clarification provided by ${profile?.full_name || 'Warehouse Manager'}: "${clarificationResponse.trim()}"`
      });

      await refreshPurchaseRequests();
      if (targetId) {
        const updated = await purchaseRequestService.getPurchaseRequestById(targetId);
        if (updated) setDirectFetchedRequest(updated);
      }

      setFeedbackMsg({ type: 'success', text: 'Response submitted! Status updated to Under Review.' });
      setTimeout(() => {
        setActionType(null);
        setIsSubmitting(false);
        setClarificationResponse('');
      }, 1200);
    } catch (err: any) {
      alert(`Response submission error: ${err.message}`);
      setIsSubmitting(false);
    }
  };

  // Open Create PO Modal
  const handleOpenCreatePoModal = (req: PurchaseRequest) => {
    setActiveRequest(req);
    setPoSupplierId(suppliers[0]?.id || '');
    setPoNotes(`Generated from Purchase Request ${req.requestNumber}`);

    const initialRates: Record<string, number> = {};
    req.items.forEach(it => {
      const prod = products.find(p => p.id === it.productId);
      initialRates[it.id] = prod?.purchasePrice || it.estimatedCost || 100;
    });
    setPoItemRates(initialRates);
    setActionType('CREATE_PO');
    setFeedbackMsg(null);
  };

  // Submit Purchase Order
  const handleSubmitCreatePo = async () => {
    if (!activeRequest) return;
    const supplier = suppliers.find(s => s.id === poSupplierId) || suppliers[0];
    if (!supplier) {
      alert('Please select a supplier for this Purchase Order.');
      return;
    }

    setIsSubmitting(true);
    try {
      const itemsPayload = activeRequest.items.map(it => {
        const prod = products.find(p => p.id === it.productId);
        const qtyToOrder = it.approvedQty !== null && it.approvedQty !== undefined ? it.approvedQty : it.requestedQty;
        return {
          productId: it.productId,
          productName: it.productName,
          qty: qtyToOrder,
          rate: poItemRates[it.id] || 0,
          taxRate: prod?.taxRate || 18,
          unit: it.unit
        };
      });

      const { purchaseOrderNumber } = await createPurchaseOrderFromRequest({
        requestId: activeRequest.id,
        supplierId: supplier.id,
        supplierName: supplier.name,
        supplierGstin: supplier.gstin,
        expectedDelivery: poExpectedDate,
        notes: poNotes,
        items: itemsPayload
      });

      await refreshPurchaseRequests();
      if (targetId) {
        const updated = await purchaseRequestService.getPurchaseRequestById(targetId);
        if (updated) setDirectFetchedRequest(updated);
      }

      setFeedbackMsg({
        type: 'success',
        text: `Purchase Order #${purchaseOrderNumber} created and linked to request #${activeRequest.requestNumber}!`
      });

      setTimeout(() => {
        setActionType(null);
        setIsSubmitting(false);
      }, 1500);
    } catch (err: any) {
      alert(`PO creation error: ${err.message}`);
      setIsSubmitting(false);
    }
  };

  // Open Goods Receipt (GRN) Modal
  const handleOpenReceiveGoodsModal = (req: PurchaseRequest) => {
    setActiveRequest(req);
    setReceiptWarehouseId(req.warehouseId);
    const initialRecv: Record<string, number> = {};
    req.items.forEach(it => {
      const target = it.approvedQty !== null && it.approvedQty !== undefined ? it.approvedQty : it.requestedQty;
      const remaining = Math.max(0, target - Number(it.receivedQty || 0));
      initialRecv[it.id] = remaining;
    });
    setReceiptQuantities(initialRecv);
    setActionType('RECEIVE_GOODS');
    setFeedbackMsg(null);
  };

  // Submit Goods Receipt
  const handleSubmitReceiveGoods = async () => {
    if (!activeRequest) return;
    const receivedItems = Object.entries(receiptQuantities)
      .map(([itemId, qty]) => {
        const it = activeRequest.items.find(i => i.id === itemId);
        return {
          itemId,
          productId: it?.productId || '',
          receivedQty: Number(qty)
        };
      })
      .filter(r => r.receivedQty > 0);

    if (receivedItems.length === 0) {
      alert('Please enter at least one quantity greater than zero to receive.');
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await recordGoodsReceipt({
        requestId: activeRequest.id,
        receivedItems,
        receivingWarehouseId: receiptWarehouseId
      });

      await refreshPurchaseRequests();
      if (targetId) {
        const ref = await purchaseRequestService.getPurchaseRequestById(targetId);
        if (ref) setDirectFetchedRequest(ref);
      }

      setFeedbackMsg({
        type: 'success',
        text: `Inward goods confirmed! Inventory updated. Request status: ${updated.status}.`
      });

      setTimeout(() => {
        setActionType(null);
        setIsSubmitting(false);
      }, 1500);
    } catch (err: any) {
      alert(`Receipt recording error: ${err.message}`);
      setIsSubmitting(false);
    }
  };

  // Open New Manual Request Modal
  const handleOpenNewRequestModal = () => {
    setNewReqWarehouseId(warehouses[0]?.id || '');
    setNewReqPriority('Normal');
    setNewReqReason('');
    const firstProd = products[0];
    if (firstProd) {
      setNewReqItems([
        {
          productId: firstProd.id,
          requestedQty: firstProd.reorderLevel ? Math.max(1, firstProd.reorderLevel * 2) : 10,
          estimatedCost: firstProd.purchasePrice || 0
        }
      ]);
    } else {
      setNewReqItems([]);
    }
    setActionType('NEW_REQUEST');
    setFeedbackMsg(null);
  };

  // Submit Manual Multi-Item Request
  const handleSubmitNewRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newReqItems.length === 0) {
      alert('Please add at least one product item to the request.');
      return;
    }

    const wh = warehouses.find(w => w.id === newReqWarehouseId) || warehouses[0];
    if (!wh) {
      alert('Please select a valid receiving warehouse.');
      return;
    }

    setIsSubmitting(true);
    try {
      const itemsPayload = newReqItems.map(it => {
        const prod = products.find(p => p.id === it.productId);
        return {
          productId: it.productId,
          productName: prod?.name || 'Product',
          sku: prod?.sku,
          currentStock: Number(prod?.currentStock || 0),
          warningLimit: prod?.reorderLevel,
          requestedQty: Number(it.requestedQty),
          unit: prod?.primaryUnit || 'Piece',
          estimatedCost: it.estimatedCost || prod?.purchasePrice || 0
        };
      });

      const res = await createPurchaseRequest({
        warehouseId: wh.id,
        warehouseName: wh.name,
        priority: newReqPriority,
        reason: newReqReason,
        requestedDeliveryDate: newReqDate,
        items: itemsPayload
      });

      await refreshPurchaseRequests();

      setFeedbackMsg({ type: 'success', text: `Purchase request #${res.requestNumber} created successfully!` });
      setTimeout(() => {
        setActionType(null);
        setIsSubmitting(false);
      }, 1500);
    } catch (err: any) {
      alert(`Failed to create request: ${err.message}`);
      setIsSubmitting(false);
    }
  };

  // =========================================================================
  // VIEW MODE A: DEDICATED REQUEST DETAILS PAGE
  // =========================================================================
  if (targetId) {
    if (isLoadingDetail && !selectedRequest) {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
          <p className="text-sm font-semibold text-slate-700">Loading purchase request details...</p>
          <p className="text-xs text-slate-400 mt-1">Retrieving request records and product lines</p>
        </div>
      );
    }

    if (!selectedRequest) {
      return (
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs max-w-lg mx-auto my-12">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-900">Purchase Request Not Found</h2>
          <p className="text-xs text-slate-500 mt-1 mb-6">
            The purchase request ID <span className="font-mono font-semibold text-slate-700">{targetId}</span> could not be found or you do not have permission to view it.
          </p>
          <button
            onClick={handleBackToList}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Purchase Requests</span>
          </button>
        </div>
      );
    }

    const items = selectedRequest.items || [];
    const isUrgent = selectedRequest.priority === 'Urgent';
    const isHigh = selectedRequest.priority === 'High';

    return (
      <div className="space-y-6">
        {/* Top Navigation & Back Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <button
            onClick={handleBackToList}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs transition-all cursor-pointer w-fit"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            <span>Back to Purchase Requests</span>
          </button>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Purchase Requests</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-mono font-bold text-indigo-600">{selectedRequest.requestNumber}</span>
          </div>
        </div>

        {/* Request Header Banner */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-mono text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                  {selectedRequest.requestNumber}
                </span>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    isUrgent
                      ? 'bg-rose-100 text-rose-700 border border-rose-200'
                      : isHigh
                      ? 'bg-amber-100 text-amber-700 border border-amber-200'
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  {selectedRequest.priority} Priority
                </span>
                <StatusBadge status={selectedRequest.status} size="md" />
              </div>

              <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5 flex-wrap">
                <span>Submitted on {formatDate(selectedRequest.createdAt)}</span>
                <span className="text-slate-300">•</span>
                <span>
                  Requested by <strong className="text-slate-800 font-semibold">{selectedRequest.requesterName}</strong>
                  {selectedRequest.requesterRole ? ` (${selectedRequest.requesterRole})` : ''}
                </span>
              </p>
            </div>

            {/* Quick Action Matrix for Details Page */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Purchase Manager: Pending Approval Actions */}
              {isPurchaseManager && (selectedRequest.status === 'Pending Approval' || selectedRequest.status === 'Pending Review' || selectedRequest.status === 'Under Review' || selectedRequest.status === 'Clarification Requested') && (
                <>
                  <button
                    onClick={() => {
                      setActiveRequest(selectedRequest);
                      setActionType('CLARIFY');
                      setFeedbackMsg(null);
                    }}
                    className="px-3 py-2 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors cursor-pointer"
                  >
                    Request Clarification
                  </button>

                  <button
                    onClick={() => {
                      setActiveRequest(selectedRequest);
                      setActionType('REJECT');
                      setFeedbackMsg(null);
                    }}
                    className="px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer"
                  >
                    Reject
                  </button>

                  <button
                    onClick={() => handleOpenApproveModal(selectedRequest)}
                    className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    Approve Request
                  </button>
                </>
              )}

              {/* Warehouse Manager: Reply to clarification */}
              {isWarehouseManager && selectedRequest.status === 'Clarification Requested' && (
                <button
                  onClick={() => {
                    setActiveRequest(selectedRequest);
                    setActionType('RESPOND_CLARIFY');
                    setFeedbackMsg(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Reply & Clarify Request
                </button>
              )}

              {/* Purchase Manager: Create PO from approved */}
              {isPurchaseManager && selectedRequest.status === 'Approved' && !selectedRequest.purchaseOrderId && (
                <button
                  onClick={() => handleOpenCreatePoModal(selectedRequest)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Generate Purchase Order</span>
                </button>
              )}

              {/* Warehouse / Purchase Manager: Receive Goods (GRN) */}
              {(selectedRequest.status === 'Ordered' || selectedRequest.status === 'Partially Received') && (
                <button
                  onClick={() => handleOpenReceiveGoodsModal(selectedRequest)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Confirm Inward Goods (GRN)</span>
                </button>
              )}
            </div>
          </div>

          {/* Key Information Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 pt-4 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Receiving Warehouse</span>
              <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                <WarehouseIcon className="w-4 h-4 text-indigo-500 shrink-0" />
                <span className="truncate" title={selectedRequest.warehouseName}>{selectedRequest.warehouseName}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Requested By</span>
              <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                <UserIcon className="w-4 h-4 text-indigo-500 shrink-0" />
                <span className="truncate" title={selectedRequest.requesterName}>{selectedRequest.requesterName}</span>
              </div>
              {selectedRequest.requesterRole && (
                <span className="text-[10px] text-slate-400 block ml-5">{selectedRequest.requesterRole}</span>
              )}
            </div>

            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Target Delivery Date</span>
              <div className="flex items-center gap-1.5 font-mono font-medium text-slate-800">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <span>
                  {selectedRequest.requestedDeliveryDate
                    ? formatDate(selectedRequest.requestedDeliveryDate)
                    : 'Not specified'}
                </span>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Linked Purchase Order</span>
              <div className="font-mono font-bold text-xs mt-0.5">
                {selectedRequest.purchaseOrderNumber ? (
                  <button
                    onClick={() => navigate('/purchases/orders')}
                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                  >
                    <span>{selectedRequest.purchaseOrderNumber}</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                ) : (
                  <span className="text-slate-400">Not generated yet</span>
                )}
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Total Products</span>
              <div className="font-bold text-slate-900 text-sm mt-0.5">
                {items.length} {items.length === 1 ? 'Product' : 'Products'}
              </div>
            </div>
          </div>
        </div>

        {/* Clarification or Rejection Alert Banners */}
        {selectedRequest.status === 'Rejected' && selectedRequest.rejectionReason && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-start gap-3">
            <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-sm mb-0.5">Purchase Request Rejected</span>
              <p className="leading-relaxed">{selectedRequest.rejectionReason}</p>
            </div>
          </div>
        )}

        {selectedRequest.status === 'Clarification Requested' && selectedRequest.clarificationNotes && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold block text-sm mb-0.5">Purchase Manager Inquired:</span>
              <p className="leading-relaxed italic">"{selectedRequest.clarificationNotes}"</p>
              {isWarehouseManager && (
                <button
                  onClick={() => {
                    setActiveRequest(selectedRequest);
                    setActionType('RESPOND_CLARIFY');
                    setFeedbackMsg(null);
                  }}
                  className="mt-3 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Reply & Clarify Request</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Reason / Notes card */}
        {(selectedRequest.reason || selectedRequest.notes) && (
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2 text-xs">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">Request Justification & Notes</h4>
            {selectedRequest.reason && (
              <p className="text-slate-700 leading-relaxed">
                <strong className="text-slate-900 font-semibold">Reason:</strong> {selectedRequest.reason}
              </p>
            )}
            {selectedRequest.notes && (
              <p className="text-slate-700 leading-relaxed">
                <strong className="text-slate-900 font-semibold">Additional Notes:</strong> {selectedRequest.notes}
              </p>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION 3: INDIVIDUAL PRODUCT DISPLAY                                    */}
        {/* ========================================================================= */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-600" />
                <span>Requested Products ({items.length})</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Every product belonging to this request displayed individually with requested, received, and remaining quantities.
              </p>
            </div>
          </div>

          {/* Individual Product Cards View */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((item, idx) => {
              const { remaining, status, target, received } = getItemMetrics(item);
              const progressPercent = target > 0 ? Math.min(100, Math.round((received / target) * 100)) : 0;

              return (
                <div
                  key={item.id || idx}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Header: Product Name, Index, Receiving Status */}
                    <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-slate-100">
                      <div className="flex items-start gap-2.5">
                        <span className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm leading-snug">
                            {item.productName}
                          </h4>
                          <span className="font-mono text-[11px] text-slate-500 block mt-0.5">
                            SKU: {item.sku || 'N/A'}
                          </span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="shrink-0">
                        {status === 'Fully Received' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Fully Received</span>
                          </span>
                        ) : status === 'Partially Received' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <Clock className="w-3 h-3" />
                            <span>Partially Received</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            <span>Not Received</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-3.5 text-xs">
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Requested</span>
                        <span className="font-bold font-mono text-indigo-700 text-xs block mt-0.5">
                          {item.requestedQty} {item.unit}
                        </span>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Received</span>
                        <span className="font-bold font-mono text-emerald-700 text-xs block mt-0.5">
                          {received} {item.unit}
                        </span>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Remaining</span>
                        <span className="font-bold font-mono text-amber-700 text-xs block mt-0.5">
                          {remaining} {item.unit}
                        </span>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Unit</span>
                        <span className="font-semibold text-slate-700 text-xs block mt-0.5">
                          {item.unit}
                        </span>
                      </div>
                    </div>

                    {/* Detailed info */}
                    <div className="space-y-1.5 text-xs text-slate-600">
                      {item.approvedQty !== null && item.approvedQty !== undefined && item.approvedQty !== item.requestedQty && (
                        <div className="flex items-center justify-between text-indigo-700 bg-indigo-50/70 px-2.5 py-1 rounded-lg border border-indigo-100 text-[11px]">
                          <span className="font-medium">Approved Quantity:</span>
                          <span className="font-bold font-mono">{item.approvedQty} {item.unit}</span>
                        </div>
                      )}
                      {item.adjustmentReason && (
                        <p className="text-[11px] text-amber-700 italic bg-amber-50/70 px-2.5 py-1 rounded-lg border border-amber-100">
                          Adjustment reason: {item.adjustmentReason}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                        <span>Current Warehouse Stock:</span>
                        <span className="font-mono font-medium text-slate-700">{item.currentStock || 0} {item.unit}</span>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium mb-1.5">
                      <span>Receiving Progress</span>
                      <span className="font-mono font-bold text-slate-700">{progressPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          progressPercent === 100
                            ? 'bg-emerald-500'
                            : progressPercent > 0
                            ? 'bg-blue-500'
                            : 'bg-slate-300'
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Product Breakdown Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs mt-4">
            <div className="p-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                Product Breakdown Table
              </h4>
              <span className="text-[11px] text-slate-500 font-medium">
                {items.length} product {items.length === 1 ? 'line' : 'lines'}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3 w-10 text-center">#</th>
                    <th className="py-3 px-4">Product Name & SKU</th>
                    <th className="py-3 px-4 text-right">Requested Qty</th>
                    <th className="py-3 px-4 text-right">Received Qty</th>
                    <th className="py-3 px-4 text-right">Remaining Qty</th>
                    <th className="py-3 px-4 text-center">Unit</th>
                    <th className="py-3 px-4 text-center">Receiving Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, idx) => {
                    const { remaining, status, received } = getItemMetrics(item);
                    return (
                      <tr key={item.id || idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-900 block">{item.productName}</span>
                          <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                            SKU: {item.sku || 'N/A'}
                          </span>
                          {item.adjustmentReason && (
                            <span className="text-[10px] text-amber-600 italic block mt-0.5">
                              Adj: {item.adjustmentReason}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-indigo-600">
                          {item.requestedQty} {item.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                          {received} {item.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-amber-600">
                          {remaining} {item.unit}
                        </td>
                        <td className="py-3 px-4 text-center font-medium text-slate-600">
                          {item.unit}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {status === 'Fully Received' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Fully Received
                            </span>
                          ) : status === 'Partially Received' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              Partially Received
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              Not Received
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Audit History Timeline */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-3">
            Request History & Status Transitions
          </h4>
          {(selectedRequest.history || []).length === 0 ? (
            <p className="text-xs text-slate-400 italic">No historical status changes recorded.</p>
          ) : (
            <div className="space-y-3 border-l-2 border-indigo-200 pl-3 ml-2">
              {(selectedRequest.history || []).map((h, i) => (
                <div key={h.id || i} className="relative pb-2 text-xs">
                  <div className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-600 ring-4 ring-white" />
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">{h.userName}</span>
                    <span className="text-[10px] text-slate-400">({h.role || 'Staff'})</span>
                    <span className="text-[10px] text-slate-400 font-mono ml-auto">
                      {formatDate(h.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-bold text-indigo-600">{h.statusTo}</span>
                    {h.comments && <span className="text-slate-600">— {h.comments}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Modals Rendered below */}
        {renderActionModals()}
      </div>
    );
  }

  // =========================================================================
  // VIEW MODE B: MAIN PURCHASE REQUEST LIST (One row per request)
  // =========================================================================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-4.5 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200/80 text-indigo-600 flex items-center justify-center shrink-0">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 truncate sm:whitespace-normal">
              Purchase Requests & Procurement Workflow
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Warehouse replenishment requests, approval matrix, purchase orders, and goods receiving (GRN)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap xl:flex-nowrap shrink-0 xl:justify-end">
          <button
            onClick={() => navigate('/purchases/orders')}
            className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/90 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
            title="View Active Purchase Orders & Deliveries"
          >
            <Truck className="w-4 h-4 text-blue-600" />
            <span>Active Orders</span>
          </button>

          <button
            onClick={() => navigate('/inventory/alerts')}
            className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/90 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
          >
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Low Stock & Reorder</span>
          </button>

          {canManageBarcodeOverride(profile?.role) && (
            <button
              onClick={() => navigate('/purchases/barcode-management')}
              className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/90 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
              title="Supplier Barcode Management & Override"
            >
              <ScanBarcode className="w-4 h-4 text-indigo-600" />
              <span>Barcode Override</span>
            </button>
          )}

          {(isWarehouseManager || isPurchaseManager) && (
            <button
              onClick={handleOpenNewRequestModal}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Create Purchase Request</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Pending Review"
          value={formatNumber(pendingCount)}
          subtitle="Awaiting purchase manager review"
          icon={Clock}
          iconBgColor="bg-amber-50"
          iconTextColor="text-amber-600"
          onClick={() => { setStatusFilter('Pending Review'); setCurrentPage(1); }}
        />
        <StatCard
          title="Under Review / Clarification"
          value={formatNumber(underReviewCount)}
          subtitle="In procurement evaluation"
          icon={HelpCircle}
          iconBgColor="bg-indigo-50"
          iconTextColor="text-indigo-600"
          onClick={() => { setStatusFilter('Pending Review'); setCurrentPage(1); }}
        />
        <StatCard
          title="Approved (Ready for PO)"
          value={formatNumber(approvedCount)}
          subtitle="Authorized for vendor purchase order"
          icon={CheckCircle2}
          iconBgColor="bg-emerald-50"
          iconTextColor="text-emerald-600"
          onClick={() => { setStatusFilter('Approved'); setCurrentPage(1); }}
        />
        <StatCard
          title="Ordered & In Transit"
          value={formatNumber(orderedOrReceivedCount)}
          subtitle="Active supplier purchase orders"
          icon={Truck}
          iconBgColor="bg-blue-50"
          iconTextColor="text-blue-600"
          onClick={() => navigate('/purchases/orders')}
        />
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3.5">
        {/* Row 1: All Warehouses | All Priorities | Search */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-3.5">
          {/* Warehouse Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl shrink-0">
            <WarehouseIcon className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={warehouseFilter}
              onChange={e => { setWarehouseFilter(e.target.value); setCurrentPage(1); }}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer pr-1"
            >
              <option value="All">All Warehouses</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl shrink-0">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={priorityFilter}
              onChange={e => { setPriorityFilter(e.target.value); setCurrentPage(1); }}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer pr-1"
            >
              <option value="All">All Priorities</option>
              <option value="Urgent">Urgent</option>
              <option value="High">High</option>
              <option value="Normal">Normal</option>
            </select>
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by request #, product name, warehouse..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Row 2: Status Segmented Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl border border-slate-200/60">
          {STATUS_TABS.map(st => {
            const isActive = statusFilter === st;
            return (
              <button
                key={st}
                type="button"
                onClick={() => {
                  setStatusFilter(st);
                  setCurrentPage(1);
                }}
                className={`flex-1 sm:flex-initial min-w-[85px] sm:min-w-0 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap text-center cursor-pointer ${
                  isActive
                    ? 'bg-white text-indigo-600 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                {st}
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: MAIN PURCHASE REQUEST TABLE (One row per purchase request)    */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs min-w-[850px]">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4 w-[140px] whitespace-nowrap">Request #</th>
                <th className="py-3 px-4 min-w-[220px]">Product Name</th>
                <th className="py-3 px-3.5 w-[120px] whitespace-nowrap">Date</th>
                <th className="py-3 px-3.5 w-[160px] whitespace-nowrap">Warehouse</th>
                <th className="py-3 px-3.5 w-[120px] text-right whitespace-nowrap">Quantity</th>
                <th className="py-3 px-3 w-[100px] text-center whitespace-nowrap">Priority</th>
                <th className="py-3 px-3.5 w-[130px] text-center whitespace-nowrap">Status</th>
                <th className="py-3 px-4 w-[90px] text-center whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <ClipboardList className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-700">No purchase requests found</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {searchQuery || statusFilter !== 'All'
                        ? 'No purchase requests match your current filters.'
                        : 'Submit a purchase request from the Stock Alerts page or click "Create Purchase Request".'}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedRequests.map(req => {
                  const isUrgent = req.priority === 'Urgent';
                  const isHigh = req.priority === 'High';
                  const itemsCount = req.items?.length || 0;
                  const firstItem = req.items?.[0];
                  const otherItemsCount = itemsCount - 1;
                  const totalRequestedQty = req.items?.reduce((sum, it) => sum + (it.requestedQty || 0), 0) || 0;
                  const firstUnit = firstItem?.unit || 'Piece';

                  return (
                    <tr
                      key={req.id}
                      onClick={() => handleViewDetails(req.id)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      {/* 1. Request Number */}
                      <td className="py-3.5 px-4 font-mono font-bold text-indigo-600 whitespace-nowrap">
                        <span>#{req.requestNumber}</span>
                      </td>

                      {/* 2. Product Name */}
                      <td className="py-3.5 px-4 text-slate-800">
                        {firstItem ? (
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-slate-900 truncate max-w-[200px]" title={firstItem.productName}>
                                {firstItem.productName}
                              </span>
                              {otherItemsCount > 0 && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 whitespace-nowrap">
                                  +{otherItemsCount} more
                                </span>
                              )}
                            </div>
                            {firstItem.sku && (
                              <span className="font-mono text-[10px] text-slate-500 block truncate">
                                SKU: {firstItem.sku}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-xs">No products</span>
                        )}
                      </td>

                      {/* 3. Request Date */}
                      <td className="py-3.5 px-3.5 text-slate-600 font-medium whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{formatDate(req.createdAt)}</span>
                        </div>
                      </td>

                      {/* 4. Warehouse Name */}
                      <td className="py-3.5 px-3.5 text-slate-800 font-medium">
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <WarehouseIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[180px]" title={req.warehouseName}>{req.warehouseName}</span>
                        </div>
                      </td>

                      {/* 5. Quantity */}
                      <td className="py-3.5 px-3.5 text-right font-mono whitespace-nowrap">
                        {itemsCount === 1 && firstItem ? (
                          <span className="font-bold text-slate-800 text-xs tabular-nums">
                            {formatNumber(firstItem.requestedQty)} {firstUnit}
                          </span>
                        ) : itemsCount > 1 ? (
                          <div>
                            <span className="font-bold text-slate-800 text-xs tabular-nums">
                              {formatNumber(totalRequestedQty)} Units
                            </span>
                            <span className="text-[10px] text-slate-400 block tabular-nums">
                              Across {itemsCount} items
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* 6. Priority */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <span
                          className={"inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border " + (isUrgent ? "bg-rose-50 text-rose-700 border-rose-200" : isHigh ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-slate-100 text-slate-700 border-slate-200")}
                        >
                          {req.priority}
                        </span>
                      </td>

                      {/* 7. Request Status */}
                      <td className="py-3.5 px-3.5 text-center whitespace-nowrap">
                        <StatusBadge status={req.status} size="sm" />
                      </td>

                      {/* 8. Actions */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div
                          className="flex items-center justify-center gap-1.5"
                          onClick={e => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => handleViewDetails(req.id)}
                            className="w-8 h-8 text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 rounded-lg transition-colors cursor-pointer flex items-center justify-center shadow-2xs hover:shadow-xs"
                            title="View Details"
                            aria-label="View Details"
                          >
                            <Eye className="w-4 h-4" />
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

        {/* Pagination Footer */}
        {filteredRequests.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-50/70 border-t border-slate-200">
            <span className="text-xs text-slate-500">
              Showing <span className="font-semibold text-slate-700">{(currentPage - 1) * pageSize + 1}</span> to{' ' }
              <span className="font-semibold text-slate-700">
                {Math.min(currentPage * pageSize, filteredRequests.length)}
              </span>{' ' }
              of <span className="font-semibold text-slate-700">{filteredRequests.length}</span> purchase requests
            </span>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
                >
                  Previous
                </button>
                <span className="text-xs font-bold px-2 text-slate-700 font-mono">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Modals Rendered below */}
      {renderActionModals()}
    </div>
  );

  // =========================================================================
  // HELPER: RENDER ACTION MODALS
  // =========================================================================
  function renderActionModals() {
    return (
      <>
        {/* ========================================================================= */}
        {/* 1. APPROVAL MODAL (Optional quantity adjustment)                         */}
        {/* ========================================================================= */}
        <Modal
          isOpen={actionType === 'APPROVE'}
          onClose={() => !isSubmitting && setActionType(null)}
          title="Approve Purchase Request"
          subtitle={`Authorize replenishment for request #${activeRequest?.requestNumber}`}
          size="md"
        >
          <div className="space-y-4 text-xs py-1">
            {feedbackMsg && (
              <div
                className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
                  feedbackMsg.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{feedbackMsg.text}</span>
              </div>
            )}

            <p className="text-slate-600 leading-relaxed">
              You are approving this purchase request. You can adjust the approved quantity if needed and provide an adjustment reason.
            </p>

            {activeRequest?.items.map(it => (
              <div key={it.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span>{it.productName}</span>
                  <span className="text-slate-500 font-normal">
                    Requested: {it.requestedQty} {it.unit}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Approved Qty</label>
                    <input
                      type="number"
                      min="1"
                      value={adjustedQuantities[it.id]?.qty || it.requestedQty}
                      onChange={e => {
                        const val = Math.max(1, Number(e.target.value));
                        setAdjustedQuantities(prev => ({
                          ...prev,
                          [it.id]: { ...prev[it.id], qty: val }
                        }));
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Adjustment Reason (If changed)</label>
                    <input
                      type="text"
                      placeholder="e.g. Budget limitation"
                      value={adjustedQuantities[it.id]?.reason || ''}
                      onChange={e => {
                        const text = e.target.value;
                        setAdjustedQuantities(prev => ({
                          ...prev,
                          [it.id]: { ...prev[it.id], reason: text }
                        }));
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
              <button
                disabled={isSubmitting}
                onClick={() => setActionType(null)}
                className="px-4 py-2 text-slate-600 bg-slate-100 rounded-xl font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={isSubmitting}
                onClick={handleSubmitApprove}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>Confirm Approval</span>
              </button>
            </div>
          </div>
        </Modal>

        {/* ========================================================================= */}
        {/* 2. REJECTION MODAL (Mandatory reason)                                    */}
        {/* ========================================================================= */}
        <Modal
          isOpen={actionType === 'REJECT'}
          onClose={() => !isSubmitting && setActionType(null)}
          title="Reject Purchase Request"
          subtitle={`Mandatory rejection explanation for request #${activeRequest?.requestNumber}`}
          size="md"
        >
          <div className="space-y-4 text-xs py-1">
            {feedbackMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-medium">
                {feedbackMsg.text}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mandatory Rejection Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                placeholder="Explain why this request is rejected (e.g. Budget freeze, alternative warehouse transfer recommended, supplier discontinued)..."
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200">
              <button
                disabled={isSubmitting}
                onClick={() => setActionType(null)}
                className="px-4 py-2 text-slate-600 bg-slate-100 rounded-xl font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={isSubmitting}
                onClick={handleSubmitReject}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                <span>Reject Request</span>
              </button>
            </div>
          </div>
        </Modal>

        {/* ========================================================================= */}
        {/* 3. CLARIFICATION MODAL                                                    */}
        {/* ========================================================================= */}
        <Modal
          isOpen={actionType === 'CLARIFY'}
          onClose={() => !isSubmitting && setActionType(null)}
          title="Request Clarification"
          subtitle={`Ask the Warehouse Manager for details on #${activeRequest?.requestNumber}`}
          size="md"
        >
          <div className="space-y-4 text-xs py-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Clarification Question / Inquiry <span className="text-amber-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Can we fulfill this from Godown B instead? Have you verified physical stock count?"
                value={clarificationNotes}
                onChange={e => setClarificationNotes(e.target.value)}
                className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200">
              <button
                disabled={isSubmitting}
                onClick={() => setActionType(null)}
                className="px-4 py-2 text-slate-600 bg-slate-100 rounded-xl font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={isSubmitting}
                onClick={handleSubmitClarify}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Send Clarification Request</span>
              </button>
            </div>
          </div>
        </Modal>

        {/* ========================================================================= */}
        {/* 4. RESPOND TO CLARIFICATION MODAL (Warehouse Manager)                     */}
        {/* ========================================================================= */}
        <Modal
          isOpen={actionType === 'RESPOND_CLARIFY'}
          onClose={() => !isSubmitting && setActionType(null)}
          title="Reply to Clarification Inquiry"
          subtitle={`Inquiry: "${activeRequest?.clarificationNotes}"`}
          size="md"
        >
          <div className="space-y-4 text-xs py-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Your Response / Justification <span className="text-indigo-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Confirmed physical stock is 0 units, customer order requires delivery this week..."
                value={clarificationResponse}
                onChange={e => setClarificationResponse(e.target.value)}
                className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200">
              <button
                disabled={isSubmitting}
                onClick={() => setActionType(null)}
                className="px-4 py-2 text-slate-600 bg-slate-100 rounded-xl font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={isSubmitting}
                onClick={handleSubmitClarifyResponse}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Submit Clarification</span>
              </button>
            </div>
          </div>
        </Modal>

        {/* ========================================================================= */}
        {/* 5. CREATE PURCHASE ORDER MODAL                                            */}
        {/* ========================================================================= */}
        <Modal
          isOpen={actionType === 'CREATE_PO'}
          onClose={() => !isSubmitting && setActionType(null)}
          title="Generate Purchase Order"
          subtitle={`Convert approved request #${activeRequest?.requestNumber} to Vendor PO`}
          size="lg"
        >
          <div className="space-y-4 text-xs py-1">
            {feedbackMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium">
                {feedbackMsg.text}
              </div>
            )}

            {/* Supplier Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Vendor / Supplier <span className="text-rose-500">*</span>
                </label>
                <select
                  value={poSupplierId}
                  onChange={e => setPoSupplierId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.company || 'Vendor'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Expected Delivery Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  min="2000-01-01"
                  max="2099-12-31"
                  value={poExpectedDate}
                  onChange={e => {
                    let val = e.target.value;
                    if (val) {
                      const parts = val.split('-');
                      if (parts[0] && parts[0].length > 4) parts[0] = parts[0].slice(0, 4);
                      val = parts.join('-');
                    }
                    setPoExpectedDate(val);
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Item Rates */}
            <div>
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block mb-2">
                Item Negotiated Unit Rates
              </span>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {activeRequest?.items.map(it => {
                  const qtyToOrder = it.approvedQty !== null && it.approvedQty !== undefined ? it.approvedQty : it.requestedQty;
                  return (
                    <div key={it.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <span className="font-semibold text-slate-900 block">{it.productName}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Order Qty: {qtyToOrder} {it.unit}
                        </span>
                      </div>
                      <div className="w-36">
                        <label className="text-[9px] text-slate-400 uppercase font-bold block mb-0.5">Rate / Unit (₹)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={poItemRates[it.id] ?? 0}
                          onChange={e => {
                            const val = Math.max(0, Number(e.target.value));
                            setPoItemRates(prev => ({ ...prev, [it.id]: val }));
                          }}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg font-mono font-bold text-xs"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">PO Instructions / Notes</label>
              <textarea
                rows={2}
                value={poNotes}
                onChange={e => setPoNotes(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200">
              <button
                disabled={isSubmitting}
                onClick={() => setActionType(null)}
                className="px-4 py-2 text-slate-600 bg-slate-100 rounded-xl font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={isSubmitting}
                onClick={handleSubmitCreatePo}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Truck className="w-3.5 h-3.5" />}
                <span>Generate Purchase Order</span>
              </button>
            </div>
          </div>
        </Modal>

        {/* ========================================================================= */}
        {/* 6. RECEIVE GOODS MODAL (GRN)                                              */}
        {/* ========================================================================= */}
        <Modal
          isOpen={actionType === 'RECEIVE_GOODS'}
          onClose={() => !isSubmitting && setActionType(null)}
          title="Confirm Inward Goods (GRN)"
          subtitle={`Acknowledge delivery for request #${activeRequest?.requestNumber}`}
          size="md"
        >
          <div className="space-y-4 text-xs py-1">
            {feedbackMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium">
                {feedbackMsg.text}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Receiving Warehouse
              </label>
              <select
                value={receiptWarehouseId}
                onChange={e => setReceiptWarehouseId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
              >
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block mb-2">
                Received Quantities
              </span>
              <div className="space-y-2">
                {activeRequest?.items.map(it => {
                  const target = it.approvedQty !== null && it.approvedQty !== undefined ? it.approvedQty : it.requestedQty;
                  const alreadyReceived = Number(it.receivedQty || 0);
                  const remaining = Math.max(0, target - alreadyReceived);

                  return (
                    <div key={it.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
                      <div>
                        <span className="font-bold text-slate-900 block">{it.productName}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Target: {target} {it.unit} | Received: {alreadyReceived} | Remaining: {remaining}
                        </span>
                      </div>
                      <div className="w-28">
                        <label className="text-[9px] text-slate-400 uppercase font-bold block mb-0.5">Inward Qty</label>
                        <input
                          type="number"
                          min="0"
                          max={remaining}
                          value={receiptQuantities[it.id] ?? 0}
                          onChange={e => {
                            const val = Math.max(0, Math.min(remaining, Number(e.target.value)));
                            setReceiptQuantities(prev => ({ ...prev, [it.id]: val }));
                          }}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg font-mono font-bold text-xs"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200">
              <button
                disabled={isSubmitting}
                onClick={() => setActionType(null)}
                className="px-4 py-2 text-slate-600 bg-slate-100 rounded-xl font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={isSubmitting}
                onClick={handleSubmitReceiveGoods}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
                <span>Confirm Inward Goods</span>
              </button>
            </div>
          </div>
        </Modal>

        {/* ========================================================================= */}
        {/* 7. NEW MANUAL PURCHASE REQUEST MODAL                                      */}
        {/* ========================================================================= */}
        <Modal
          isOpen={actionType === 'NEW_REQUEST'}
          onClose={() => !isSubmitting && setActionType(null)}
          title="Create Warehouse Purchase Request"
          subtitle="Submit replenishment items to the Purchase Manager"
          size="lg"
        >
          <form onSubmit={handleSubmitNewRequest} className="space-y-4 text-xs py-1">
            {feedbackMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium">
                {feedbackMsg.text}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Receiving Warehouse <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newReqWarehouseId}
                  onChange={e => setNewReqWarehouseId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Priority Level
                </label>
                <select
                  value={newReqPriority}
                  onChange={e => setNewReqPriority(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Target Delivery Date
                </label>
                <input
                  type="date"
                  min="2000-01-01"
                  max="2099-12-31"
                  value={newReqDate}
                  onChange={e => {
                    let val = e.target.value;
                    if (val) {
                      const parts = val.split('-');
                      if (parts[0] && parts[0].length > 4) parts[0] = parts[0].slice(0, 4);
                      val = parts.join('-');
                    }
                    setNewReqDate(val);
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Reason for Request
              </label>
              <input
                type="text"
                placeholder="e.g. Critical stock shortage or customer project commitments"
                value={newReqReason}
                onChange={e => setNewReqReason(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Line Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                  Items to Replenish
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const p = products[0];
                    if (p) {
                      setNewReqItems(prev => [
                        ...prev,
                        { productId: p.id, requestedQty: 10, estimatedCost: p.purchasePrice || 0 }
                      ]);
                    }
                  }}
                  className="px-2.5 py-1 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Item</span>
                </button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto">
                {newReqItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="flex-1">
                      <select
                        value={item.productId}
                        onChange={e => {
                          const pid = e.target.value;
                          const p = products.find(x => x.id === pid);
                          setNewReqItems(prev =>
                            prev.map((it, i) =>
                              i === idx
                                ? {
                                    ...it,
                                    productId: pid,
                                    estimatedCost: p?.purchasePrice || 0
                                  }
                                : it
                            )
                          );
                        }}
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                      >
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} (Stock: {p.currentStock} {p.primaryUnit || 'Pcs'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-24">
                      <input
                        type="number"
                        min="1"
                        required
                        placeholder="Qty"
                        value={item.requestedQty}
                        onChange={e => {
                          const val = Math.max(1, Number(e.target.value));
                          setNewReqItems(prev => prev.map((it, i) => (i === idx ? { ...it, requestedQty: val } : it)));
                        }}
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold"
                      />
                    </div>

                    {newReqItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setNewReqItems(prev => prev.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setActionType(null)}
                className="px-4 py-2 text-slate-600 bg-slate-100 rounded-xl font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Submit Purchase Request</span>
              </button>
            </div>
          </form>
        </Modal>
      </>
    );
  }
};

export default PurchaseRequestsPage;
