import React, { useState } from 'react';
import {
  ShieldAlert,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  User,
  Eye,
  Lock,
  ArrowRight
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { DataTable, Column } from '../common/DataTable';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Modal } from '../common/Modal';

interface ApprovalRequest {
  id: string;
  requestType: 'Discount > Limit' | 'Price < Floor' | 'Return > Limit' | 'Bill Cancellation';
  requesterName: string;
  requesterRole: string;
  documentRef: string;
  customerOrProduct: string;
  requestedValue: string;
  allowedLimit: string;
  createdAt: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  notes: string;
}

export const PricingApprovalsTab: React.FC = () => {
  const [requests, setRequests] = useState<ApprovalRequest[]>([
    {
      id: 'app-1',
      requestType: 'Discount > Limit',
      requesterName: 'Aakash Verma',
      requesterRole: 'Salesperson',
      documentRef: 'POS-2026-0891',
      customerOrProduct: 'Sony 55" 4K Bravia TV',
      requestedValue: '12% Discount (₹7,800)',
      allowedLimit: '5% Max (₹3,250)',
      createdAt: new Date().toISOString(),
      status: 'Pending',
      notes: 'Customer buying complete home theatre bundle with soundbar.'
    },
    {
      id: 'app-2',
      requestType: 'Price < Floor',
      requesterName: 'Priya Patel',
      requesterRole: 'Salesperson',
      documentRef: 'INV-2026-0412',
      customerOrProduct: 'Cement 50kg UltraTech',
      requestedValue: '₹340 / Bag',
      allowedLimit: '₹355 Min Floor',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      status: 'Pending',
      notes: 'Bulk order of 500 bags for commercial construction site.'
    },
    {
      id: 'app-3',
      requestType: 'Return > Limit',
      requesterName: 'Rahul Sen',
      requesterRole: 'Cashier',
      documentRef: 'RET-2026-0045',
      customerOrProduct: 'Lenovo ThinkPad Laptop',
      requestedValue: '₹62,000 Refund',
      allowedLimit: '₹5,000 Cashier Max',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      status: 'Pending',
      notes: 'Customer returned sealed box with original invoice within 24 hours.'
    }
  ]);

  const [selectedReq, setSelectedReq] = useState<ApprovalRequest | null>(null);

  const handleApprove = (id: string) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'Approved' } : r));
    setSelectedReq(null);
  };

  const handleReject = (id: string) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'Rejected' } : r));
    setSelectedReq(null);
  };

  const pendingCount = requests.filter(r => r.status === 'Pending').length;

  const columns: Column<ApprovalRequest>[] = [
    {
      key: 'requestType',
      header: 'Exception Type',
      render: row => {
        const isCritical = row.requestType === 'Price < Floor' || row.requestType === 'Bill Cancellation';
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
            isCritical ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}>
            <AlertTriangle className="w-3 h-3" />
            <span>{row.requestType}</span>
          </span>
        );
      }
    },
    {
      key: 'documentRef',
      header: 'Reference Document',
      render: row => <span className="font-mono font-bold text-blue-600 text-xs">{row.documentRef}</span>
    },
    {
      key: 'customerOrProduct',
      header: 'Product / Customer',
      render: row => <span className="font-medium text-slate-900 block truncate max-w-xs">{row.customerOrProduct}</span>
    },
    {
      key: 'requestedValue',
      header: 'Requested vs Allowed',
      render: row => (
        <div>
          <span className="font-semibold text-rose-600 block text-xs">{row.requestedValue}</span>
          <span className="text-[10px] text-slate-400">Limit: {row.allowedLimit}</span>
        </div>
      )
    },
    {
      key: 'requesterName',
      header: 'Requester',
      render: row => (
        <div>
          <span className="font-medium text-slate-800 block text-xs">{row.requesterName}</span>
          <span className="text-[10px] text-slate-400">{row.requesterRole}</span>
        </div>
      )
    },
    {
      key: 'status',
      header: 'Approval Status',
      align: 'center',
      render: row => (
        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
          row.status === 'Approved'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : row.status === 'Rejected'
            ? 'bg-slate-100 text-slate-600'
            : 'bg-amber-100 text-amber-800 border border-amber-200'
        }`}>
          {row.status}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Lock className="w-4 h-4 text-rose-600" />
            Commercial Escalation & Approval Queue
          </h2>
          <p className="text-xs text-slate-500">
            Authorizations for discount overrides, sub-floor pricing, invoice cancellations, and high-value returns.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            {pendingCount} Pending Approvals
          </span>
        </div>
      </div>

      <DataTable
        title="Exception Authorizations"
        subtitle="Review and approve exception requests from POS and billing terminals"
        columns={columns}
        data={requests}
        searchPlaceholder="Search reference #, product, or requester..."
        searchKeys={['documentRef', 'customerOrProduct', 'requesterName', 'requestType']}
        onRowClick={row => setSelectedReq(row)}
        actions={row => row.status === 'Pending' ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleApprove(row.id);
              }}
              className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-xs font-semibold cursor-pointer"
            >
              Approve
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleReject(row.id);
              }}
              className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded text-xs font-semibold cursor-pointer"
            >
              Reject
            </button>
          </div>
        ) : null}
      />

      {/* Review Modal */}
      {selectedReq && (
        <Modal
          isOpen={Boolean(selectedReq)}
          onClose={() => setSelectedReq(null)}
          title={`Authorization: ${selectedReq.requestType}`}
          subtitle={`Requested by ${selectedReq.requesterName} on ${formatDate(selectedReq.createdAt)}`}
          size="md"
        >
          <div className="space-y-4 pt-2 text-xs">
            <div className="p-4 bg-slate-50 rounded-xl space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Document Reference:</span>
                <span className="font-mono font-bold text-blue-700">{selectedReq.documentRef}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Item / Target:</span>
                <span className="font-semibold text-slate-900">{selectedReq.customerOrProduct}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Requested Value:</span>
                <span className="font-bold text-rose-600">{selectedReq.requestedValue}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Standard Allowed Limit:</span>
                <span className="text-slate-700">{selectedReq.allowedLimit}</span>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <span className="text-slate-500 block mb-0.5">Justification Note:</span>
                <span className="text-slate-800 italic">{selectedReq.notes}</span>
              </div>
            </div>

            {selectedReq.status === 'Pending' ? (
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => handleReject(selectedReq.id)}
                  className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-semibold cursor-pointer"
                >
                  Reject Override
                </button>
                <button
                  type="button"
                  onClick={() => handleApprove(selectedReq.id)}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold cursor-pointer shadow-xs"
                >
                  Authorize Exception
                </button>
              </div>
            ) : (
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedReq(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

