import React, { useState } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  HelpCircle,
  RotateCcw,
  Clock,
  UserCheck,
  Send,
  CheckCircle2,
  AlertCircle,
  FileText,
  Package,
  User,
  ArrowRight
} from 'lucide-react';
import { Modal } from '../common/Modal';
import {
  CustomerSupportCase,
  CustomerSupportCategory,
  CustomerSupportCaseStatus,
  Customer,
  Product,
  SystemUser
} from '../../types';
import { sortProductsAZ } from '../../utils/sortUtils';
import { customerSupportService } from '../../services/customerSupportService';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';

interface CustomerSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer?: Customer;
  existingCase?: CustomerSupportCase | null;
  onCaseUpdated?: (updatedCase: CustomerSupportCase) => void;
  onCaseCreated?: (newCase: CustomerSupportCase) => void;
}

export const CustomerSupportModal: React.FC<CustomerSupportModalProps> = ({
  isOpen,
  onClose,
  customer,
  existingCase,
  onCaseUpdated,
  onCaseCreated
}) => {
  const { products, company } = useERP();
  const { user, profile } = useAuth();

  // Create Mode state
  const [category, setCategory] = useState<CustomerSupportCategory>('customer_complaint');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [followupDue, setFollowupDue] = useState<string>('');
  const [returnQuantity, setReturnQuantity] = useState<string>('1');
  const [returnReason, setReturnReason] = useState<string>('Defective / Damaged');
  const [originalRef, setOriginalRef] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // View / Edit Mode state
  const [newNote, setNewNote] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [forwardNotice, setForwardNotice] = useState<string | null>(null);

  const isSalesperson = profile?.role === 'Salesperson';

  // Handle case creation
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || isSubmitting || !customer) return;

    setIsSubmitting(true);
    try {
      const selectedProduct = products.find(p => p.id === selectedProductId);
      let fullDescription = description.trim();
      if (category === 'customer_return_request') {
        const detailsHeader = `[Return / Replacement Details: Qty ${returnQuantity || 1} | Reason: ${returnReason} | Ref: ${originalRef || 'None'}]`;
        fullDescription = `${detailsHeader}\n${fullDescription}`;
      }

      const newRecord = await customerSupportService.createSupportCase(
        {
          customerId: customer.id,
          category,
          title: title.trim(),
          description: fullDescription,
          productId: selectedProductId || null,
          assignedSalespersonId: isSalesperson ? user?.id : customer.assignedSalespersonId || null,
          followupDue: followupDue || null
        },
        company?.id,
        customer,
        selectedProduct,
        user?.id
      );

      onCaseCreated?.(newRecord);
      onClose();
      // Reset form
      setTitle('');
      setDescription('');
      setSelectedProductId('');
      setFollowupDue('');
      setReturnQuantity('1');
      setReturnReason('Defective / Damaged');
      setOriginalRef('');
    } catch (err) {
      console.error('Failed to create customer support case:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle adding note
  const handleAddNote = async () => {
    if (!existingCase || !newNote.trim() || isActionLoading) return;
    setIsActionLoading(true);
    try {
      const authorName = profile?.full_name || profile?.email || user?.email || 'Sales Person';
      const added = await customerSupportService.addSupportCaseNote(
        existingCase.id,
        newNote.trim(),
        authorName,
        profile?.role || 'Salesperson',
        company?.id
      );

      const updated: CustomerSupportCase = {
        ...existingCase,
        notes: [...(existingCase.notes || []), added]
      };
      onCaseUpdated?.(updated);
      setNewNote('');
    } catch (err) {
      console.error('Failed to add note:', err);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle status update
  const handleStatusChange = async (newStatus: CustomerSupportCaseStatus) => {
    if (!existingCase || isActionLoading) return;
    setIsActionLoading(true);
    try {
      const updated = await customerSupportService.updateSupportCaseStatus(
        existingCase.id,
        newStatus,
        resolutionNotes.trim() || undefined,
        company?.id
      );

      if (updated) {
        onCaseUpdated?.(updated);
      }
    } catch (err) {
      console.error('Failed to update case status:', err);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle forwarding return request for management approval
  const handleForwardReturn = async () => {
    if (!existingCase || isActionLoading) return;
    setIsActionLoading(true);
    try {
      const authorName = profile?.full_name || profile?.email || user?.email || 'Sales Person';
      const forwarded = await customerSupportService.forwardReturnRequestForApproval(
        existingCase.id,
        'Customer return/replacement requested. Salesperson logged details and forwarded for Cashier/Admin authorization.',
        authorName,
        company?.id
      );
      if (forwarded) {
        onCaseUpdated?.(forwarded);
      }
      setForwardNotice('Forwarded to management! Return & refund authorization remains with Cashier and Admin.');
    } catch (err) {
      console.error('Failed to forward return request:', err);
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        existingCase
          ? `Support Case ${existingCase.caseNumber}`
          : 'Log Customer Support Case & Complaint'
      }
      size="lg"
    >
      {existingCase ? (
        // VIEW / MANAGE CASE MODE
        <div className="space-y-4">
          {/* Header Metadata Banner */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800">{existingCase.title}</span>
              {existingCase.priority === 'High' && (
                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold text-[10px] flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" /> HIGH PRIORITY
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 text-[11px]">
                Status:
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                  existingCase.status === 'Resolved' || existingCase.status === 'Closed'
                    ? 'bg-emerald-100 text-emerald-700'
                    : existingCase.status === 'In Progress'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {existingCase.status}
              </span>
            </div>
          </div>

          {/* Description & Product Info */}
          <div className="bg-white p-3.5 border border-slate-200 rounded-xl space-y-2 text-xs">
            <p className="text-slate-700 leading-relaxed font-normal">{existingCase.description}</p>
            {(existingCase.customerName || existingCase.productName) && (
              <div className="flex flex-wrap gap-4 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                {existingCase.customerName && (
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <strong>Customer:</strong> {existingCase.customerName}
                  </span>
                )}
                {existingCase.productName && (
                  <span className="flex items-center gap-1">
                    <Package className="w-3.5 h-3.5 text-slate-400" />
                    <strong>Product:</strong> {existingCase.productName}
                  </span>
                )}
                {existingCase.followupDue && (
                  <span className="flex items-center gap-1 text-amber-600 font-medium">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <strong>Follow-up Due:</strong> {new Date(existingCase.followupDue).toLocaleString()}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Return & Replacement Role Boundary Notice (Requirement 4 & 8) */}
          {existingCase.category === 'customer_return_request' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-2">
              <div className="flex items-start gap-2 text-amber-800">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Return & Replacement Processing Boundary</p>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    Sales Persons are authorized to record customer return reasons and forward requests. Actual refund processing, invoice cancellation, and inventory restorations require authorized Cashier or Admin approval.
                  </p>
                </div>
              </div>
              {!existingCase.isEscalated && (
                <button
                  type="button"
                  onClick={handleForwardReturn}
                  disabled={isActionLoading}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" /> Forward for Manager Authorization
                </button>
              )}
              {forwardNotice && (
                <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {forwardNotice}
                </p>
              )}
            </div>
          )}

          {/* Internal Progress Notes Section */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Internal Case Notes & Updates
            </h4>
            <div className="max-h-36 overflow-y-auto space-y-2 bg-slate-50/70 p-2.5 rounded-xl border border-slate-200 text-xs">
              {(!existingCase.notes || existingCase.notes.length === 0) ? (
                <p className="text-slate-400 italic text-center py-2 text-[11px]">No internal notes recorded yet.</p>
              ) : (
                existingCase.notes.map(n => (
                  <div key={n.id} className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span className="font-bold text-slate-700">{n.author} {n.authorRole ? `(${n.authorRole})` : ''}</span>
                      <span>{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-slate-700 text-xs">{n.text}</p>
                  </div>
                ))
              )}
            </div>

            {/* Add note input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="Add progress note or customer update..."
                className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
              />
              <button
                type="button"
                onClick={handleAddNote}
                disabled={!newNote.trim() || isActionLoading}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50 cursor-pointer"
              >
                Add Note
              </button>
            </div>
          </div>

          {/* Status Actions */}
          <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">Update Status:</span>
              <button
                type="button"
                onClick={() => handleStatusChange('In Progress')}
                className={`px-2.5 py-1 text-xs rounded-md font-medium border cursor-pointer ${
                  existingCase.status === 'In Progress'
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                In Progress
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange('Pending Customer Information')}
                className={`px-2.5 py-1 text-xs rounded-md font-medium border cursor-pointer ${
                  existingCase.status === 'Pending Customer Information'
                    ? 'bg-amber-50 border-amber-300 text-amber-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Pending Info
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange('Resolved')}
                className={`px-2.5 py-1 text-xs rounded-md font-medium border cursor-pointer ${
                  existingCase.status === 'Resolved'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-emerald-50'
                }`}
              >
                Mark Resolved
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      ) : (
        // CREATE CASE MODE
        <form onSubmit={handleCreate} className="space-y-4 text-xs">
          {/* Category Selector across the 6 Master Prompt categories */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Case Category</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'customer_complaint', label: '1. Customer Complaint', icon: ShieldAlert, color: 'text-rose-600', badge: 'High Priority' },
                { id: 'customer_product_damage', label: '2. Product Damage & Defect', icon: AlertTriangle, color: 'text-amber-600', badge: 'High Priority' },
                { id: 'customer_support_request', label: '3. Support Request', icon: HelpCircle, color: 'text-blue-600' },
                { id: 'customer_return_request', label: '4. Return / Replacement', icon: RotateCcw, color: 'text-purple-600', badge: 'High Priority' },
                { id: 'customer_followup', label: '5. Follow-up Reminder', icon: Clock, color: 'text-orange-600' },
                { id: 'customer_update', label: '6. Customer Update', icon: UserCheck, color: 'text-emerald-600' }
              ].map(cat => {
                const Icon = cat.icon;
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id as CustomerSupportCategory)}
                    className={`p-2 rounded-lg border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/70 border-blue-500 shadow-2xs ring-1 ring-blue-500'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${cat.color}`} />
                      <span className="font-semibold text-slate-800 text-[11px] leading-tight truncate">
                        {cat.label}
                      </span>
                    </div>
                    {cat.badge && (
                      <span className="mt-1 text-[9px] font-bold text-rose-600 uppercase">
                        {cat.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product selector if relevant */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Relevant Product (Optional)
            </label>
            <select
              value={selectedProductId}
              onChange={e => setSelectedProductId(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            >
              <option value="">-- No specific product / general inquiry --</option>
              {sortProductsAZ(products).map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
          </div>

          {/* Return / Replacement Specific Inputs (Requirement 4) */}
          {category === 'customer_return_request' && (
            <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl space-y-3">
              <span className="font-bold text-purple-900 text-xs flex items-center gap-1">
                <RotateCcw className="w-3.5 h-3.5 text-purple-600" /> Return & Replacement Specific Details
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Return Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={returnQuantity}
                    onChange={e => setReturnQuantity(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Return Reason</label>
                  <select
                    value={returnReason}
                    onChange={e => setReturnReason(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    <option value="Defective / Damaged">Defective / Damaged</option>
                    <option value="Wrong Item Received">Wrong Item Received</option>
                    <option value="Missing Item / Parts">Missing Item / Parts</option>
                    <option value="Poor Product Quality">Poor Product Quality</option>
                    <option value="Expired Product">Expired Product</option>
                    <option value="Dissatisfied with Purchase">Dissatisfied with Purchase</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Original Invoice / Ref</label>
                  <input
                    type="text"
                    value={originalRef}
                    onChange={e => setOriginalRef(e.target.value)}
                    placeholder="e.g. INV-2026-0012"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Case Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Wrong paint can received by customer"
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Detailed Description</label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Enter exact customer issue, product code, batch, and assistance requested..."
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
            />
          </div>

          {/* Follow-up Due Date */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Follow-up Due Date & Time (Optional)
            </label>
            <input
              type="datetime-local"
              value={followupDue}
              onChange={e => setFollowupDue(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim() || !description.trim()}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {isSubmitting ? 'Creating...' : 'Log & Dispatch Notification'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
