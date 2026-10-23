import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  AlertTriangle,
  Clock,
  CheckCircle2,
  DollarSign,
  AlertCircle,
  Package,
  Calendar,
  Check,
  ClipboardList,
  AlertOctagon,
  ShieldAlert,
  HelpCircle,
  RotateCcw,
  UserCheck,
  User,
  ArrowRight,
  Filter
} from 'lucide-react';
import { Drawer } from './Drawer';
import { Modal } from './Modal';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/rbac';
import {
  sortNotifications,
  resolveInvoiceFromNotification,
  resolvePaymentFromNotification,
  isCustomerSupportNotification
} from '../../services/notificationService';
import { NotificationItem, SalesInvoice, PaymentRecord } from '../../types';
import { InvoicePrintModal } from '../invoice/InvoicePrintModal';
import { PaymentDetailModal } from '../payment/PaymentDetailModal';

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({ isOpen, onClose }) => {
  const {
    notifications,
    markNotificationAsRead,
    clearNotifications,
    markAllNotificationsAsRead,
    salesInvoices,
    payments
  } = useERP();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  // Selected records for opening detail modals directly from notification panel
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);
  const [errorAlert, setErrorAlert] = useState<{
    title: string;
    message: string;
    actionText?: string;
    actionLink?: string;
  } | null>(null);

  // Filter states
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'read'>('all');

  const currentRole = profile?.role || (user as any)?.role;
  const isSalesperson = currentRole === 'Salesperson';

  // Enforce required ordering: Unread notifications first (newest first), read below (newest first)
  const sortedNotifications = useMemo(() => {
    return sortNotifications(notifications);
  }, [notifications]);

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.read).length;
  }, [notifications]);

  // Filtered notifications list based on category, priority, and read status
  const displayedNotifications = useMemo(() => {
    let list = sortedNotifications;

    if (categoryFilter !== 'all') {
      list = list.filter(n => n.type === categoryFilter || n.category === categoryFilter);
    }

    if (priorityFilter !== 'all') {
      list = list.filter(n => n.priority === priorityFilter);
    }

    if (readFilter === 'unread') {
      list = list.filter(n => !n.read);
    } else if (readFilter === 'read') {
      list = list.filter(n => n.read);
    }

    return list;
  }, [sortedNotifications, categoryFilter, priorityFilter, readFilter]);

  const handleNotificationClick = async (item: NotificationItem) => {
    // 1. Mark as read immediately upon clicking
    try {
      if (!item.read) {
        await markNotificationAsRead(item.id);
      }
    } catch (err) {
      console.warn('Could not mark notification as read:', err);
    }

    // 2. Overdue Invoice Notification Handler
    if (item.type === 'overdue_invoice') {
      if (!hasPermission(currentRole, 'sales', 'view')) {
        setErrorAlert({
          title: 'Access Restricted',
          message: 'You do not have permission to view sales invoices. Please contact your company administrator for authorized financial access.'
        });
        return;
      }

      const resolution = resolveInvoiceFromNotification(item, salesInvoices);
      if (resolution.invoice) {
        setSelectedInvoice(resolution.invoice);
        return;
      }

      setErrorAlert({
        title: 'Invoice Not Found',
        message: resolution.error || `The invoice associated with this alert (${resolution.identifier}) could not be located in your records.`,
        actionText: 'View Invoices Directory',
        actionLink: '/sales'
      });
      return;
    }

    // 3. Payment Received Notification Handler
    if (item.type === 'payment_received') {
      if (!hasPermission(currentRole, 'payments', 'view')) {
        setErrorAlert({
          title: 'Access Restricted',
          message: 'You do not have permission to view payment records. Please contact your company administrator for authorized financial access.'
        });
        return;
      }

      const resolution = resolvePaymentFromNotification(item, payments);
      if (resolution.payment) {
        setSelectedPayment(resolution.payment);
        return;
      }

      setErrorAlert({
        title: 'Payment Record Not Found',
        message: resolution.error || `The payment transaction associated with this alert (${resolution.identifier}) could not be located in your records.`,
        actionText: 'View Payment Registry',
        actionLink: '/payments'
      });
      return;
    }

    // 4. Working Action Link Handler: Customer Support Cases or General Links
    if (item.link) {
      let targetLink = item.link;
      if (currentRole === 'Purchase Manager' && targetLink.startsWith('/inventory/purchase-requests')) {
        targetLink = targetLink.replace('/inventory/purchase-requests', '/purchases/requests');
      }
      navigate(targetLink);
      onClose();
      return;
    }

    // Fallback if no link: if customerId is present, navigate to customer profile
    if (item.customerId) {
      navigate(`/customers/${item.customerId}${item.caseId ? `?caseId=${item.caseId}` : ''}`);
      onClose();
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      // Customer Support Categories (Master Prompt Section 7)
      case 'customer_complaint':
        return <ShieldAlert className="w-4 h-4 text-rose-600" />;
      case 'customer_product_damage':
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      case 'customer_support_request':
        return <HelpCircle className="w-4 h-4 text-blue-600" />;
      case 'customer_return_request':
        return <RotateCcw className="w-4 h-4 text-purple-600" />;
      case 'customer_followup':
        return <Clock className="w-4 h-4 text-orange-600" />;
      case 'customer_update':
        return <UserCheck className="w-4 h-4 text-emerald-600" />;

      // Operational Alerts
      case 'purchase_request':
        return <ClipboardList className="w-4 h-4 text-indigo-600" />;
      case 'limited_stock':
      case 'low_stock':
        return <Package className="w-4 h-4 text-amber-600" />;
      case 'out_of_stock':
        return <Package className="w-4 h-4 text-rose-600" />;
      case 'stock_damage':
        return <AlertOctagon className="w-4 h-4 text-rose-600" />;
      case 'expiring_batch':
        return <Calendar className="w-4 h-4 text-orange-600" />;
      case 'overdue_invoice':
        return <Clock className="w-4 h-4 text-rose-600" />;
      case 'credit_limit':
        return <AlertTriangle className="w-4 h-4 text-purple-600" />;
      case 'payment_received':
        return <DollarSign className="w-4 h-4 text-emerald-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-blue-600" />;
    }
  };

  const getBg = (type: string) => {
    switch (type) {
      case 'customer_complaint':
        return 'bg-rose-50 border-rose-200';
      case 'customer_product_damage':
        return 'bg-amber-50 border-amber-200';
      case 'customer_support_request':
        return 'bg-blue-50 border-blue-200';
      case 'customer_return_request':
        return 'bg-purple-50 border-purple-200';
      case 'customer_followup':
        return 'bg-orange-50 border-orange-200';
      case 'customer_update':
        return 'bg-emerald-50 border-emerald-200';
      case 'purchase_request':
        return 'bg-indigo-50 border-indigo-200';
      case 'limited_stock':
      case 'low_stock':
        return 'bg-amber-50 border-amber-200';
      case 'out_of_stock':
      case 'stock_damage':
      case 'overdue_invoice':
        return 'bg-rose-50 border-rose-200';
      case 'expiring_batch':
        return 'bg-orange-50 border-orange-200';
      case 'credit_limit':
        return 'bg-purple-50 border-purple-200';
      case 'payment_received':
        return 'bg-emerald-50 border-emerald-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  const getCategoryLabel = (type: string) => {
    switch (type) {
      case 'customer_complaint':
        return 'Complaint';
      case 'customer_product_damage':
        return 'Product Damage';
      case 'customer_support_request':
        return 'Support Request';
      case 'customer_return_request':
        return 'Return Request';
      case 'customer_followup':
        return 'Follow-up Due';
      case 'customer_update':
        return 'Customer Update';
      default:
        return type.replace(/_/g, ' ');
    }
  };

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title={isSalesperson ? 'Sales Person Support Alerts' : 'ERP System Alerts'}
        subtitle={`${unreadCount} unread ${isSalesperson ? 'customer support alerts' : 'notifications'}`}
        footer={
          <div className="flex items-center justify-between w-full">
            <button
              onClick={clearNotifications}
              className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Clear all
            </button>
            <button
              onClick={() => {
                if (markAllNotificationsAsRead) {
                  markAllNotificationsAsRead().catch(() => {});
                } else {
                  notifications.filter(n => !n.read).forEach(n => markNotificationAsRead(n.id).catch(() => {}));
                }
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" /> Mark all as read
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          {/* Filter Bar: Category Tabs & Priority Selector (Section 7) */}
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2 text-xs">
            {/* Category pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] scrollbar-none">
              {[
                { id: 'all', label: 'All' },
                { id: 'customer_complaint', label: 'Complaints', high: true },
                { id: 'customer_product_damage', label: 'Damage & Defects' },
                { id: 'customer_support_request', label: 'Support' },
                { id: 'customer_return_request', label: 'Returns' },
                { id: 'customer_followup', label: 'Follow-ups' },
                { id: 'customer_update', label: 'Updates' }
              ].map(tab => {
                const isSelected = categoryFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setCategoryFilter(tab.id)}
                    className={`px-2 py-1 rounded-md font-semibold shrink-0 transition-colors cursor-pointer flex items-center gap-1 ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>{tab.label}</span>
                    {tab.high && (
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Priority & Read Filter Row */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60 text-[11px]">
              <div className="flex items-center gap-1">
                <span className="text-slate-400 font-medium">Priority:</span>
                <select
                  value={priorityFilter}
                  onChange={e => setPriorityFilter(e.target.value)}
                  className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[11px] text-slate-700 focus:outline-hidden"
                >
                  <option value="all">All</option>
                  <option value="High">High Priority</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <span className="text-slate-400 font-medium">Status:</span>
                <select
                  value={readFilter}
                  onChange={e => setReadFilter(e.target.value as any)}
                  className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[11px] text-slate-700 focus:outline-hidden"
                >
                  <option value="all">All</option>
                  <option value="unread">Unread Only</option>
                  <option value="read">Read Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Notifications List */}
          {displayedNotifications.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400 mb-2" />
              <p className="text-sm font-medium text-slate-700">No notifications found</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {categoryFilter !== 'all' || priorityFilter !== 'all' || readFilter !== 'all'
                  ? 'No alerts match your active filter selection.'
                  : 'All caught up! No active customer alerts.'}
              </p>
            </div>
          ) : (
            displayedNotifications.map(item => {
              const isComplaint = item.type === 'customer_complaint';
              const isHighPriority = item.priority === 'High' || isComplaint;

              return (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer relative ${
                    isHighPriority
                      ? item.read
                        ? 'bg-rose-50/20 border-rose-200 hover:border-rose-300'
                        : 'bg-rose-50/50 border-rose-300 shadow-xs ring-1 ring-rose-200/50 hover:border-rose-400'
                      : item.read
                      ? 'bg-white border-slate-200 opacity-80 hover:opacity-100 hover:border-slate-300'
                      : 'bg-white border-blue-200 shadow-2xs hover:border-blue-400'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg border shrink-0 ${getBg(item.type)}`}>
                      {getIcon(item.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* Top Badges & Time */}
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {/* Prominent High Priority Badge */}
                          {isHighPriority && (
                            <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white font-bold text-[9px] uppercase tracking-wider flex items-center gap-0.5 shadow-2xs">
                              <ShieldAlert className="w-2.5 h-2.5" /> High Priority
                            </span>
                          )}
                          {/* Category Badge */}
                          <span className="px-1.5 py-0.2 rounded bg-slate-100 border border-slate-200 text-slate-600 font-medium text-[10px]">
                            {getCategoryLabel(item.type)}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                          {item.timestamp}
                        </span>
                      </div>

                      {/* Title & Message */}
                      <h4 className="text-xs font-semibold text-slate-900 leading-snug">
                        {item.title}
                      </h4>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                        {item.message}
                      </p>

                      {/* Customer & Product Metadata (Section 7) */}
                      {(item.customerName || item.productName || item.caseStatus) && (
                        <div className="flex flex-wrap items-center gap-2 mt-2 pt-1.5 border-t border-slate-100 text-[10px] text-slate-500">
                          {item.customerName && (
                            <span className="flex items-center gap-1 font-medium text-slate-700">
                              <User className="w-3 h-3 text-slate-400" />
                              {item.customerName}
                            </span>
                          )}
                          {item.productName && (
                            <span className="flex items-center gap-1 text-slate-600">
                              <Package className="w-3 h-3 text-slate-400" />
                              {item.productName}
                            </span>
                          )}
                          {item.caseStatus && (
                            <span
                              className={`px-1.5 py-0.2 rounded font-semibold ${
                                item.caseStatus === 'Resolved' || item.caseStatus === 'Closed'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {item.caseStatus}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Working Action Link Button */}
                      <div className="mt-2.5 flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 group">
                          {item.actionText || 'View Case'}
                          <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                        </span>

                        {!item.read && (
                          <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" title="Unread" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Drawer>

      {/* Overdue Invoice Print & Details Modal */}
      <InvoicePrintModal
        invoice={selectedInvoice}
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
      />

      {/* Payment Received Voucher & Details Modal */}
      <PaymentDetailModal
        payment={selectedPayment}
        isOpen={!!selectedPayment}
        onClose={() => setSelectedPayment(null)}
        onViewInvoice={inv => {
          setSelectedPayment(null);
          setSelectedInvoice(inv);
        }}
      />

      {/* Notification Alert / Missing Record Modal */}
      <Modal
        isOpen={!!errorAlert}
        onClose={() => setErrorAlert(null)}
        title={errorAlert?.title || 'Notice'}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            {errorAlert?.actionLink && (
              <button
                onClick={() => {
                  const target = errorAlert.actionLink!;
                  setErrorAlert(null);
                  navigate(target);
                  onClose();
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                {errorAlert.actionText || 'Go to Page'}
              </button>
            )}
            <button
              onClick={() => setErrorAlert(null)}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        }
      >
        <div className="flex items-start gap-3 py-2">
          <div className="p-2 rounded-xl bg-rose-50 text-rose-600 shrink-0 border border-rose-200">
            {errorAlert?.title?.toLowerCase().includes('restricted') ? (
              <ShieldAlert className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
          </div>
          <div className="text-xs text-slate-700 leading-relaxed font-medium">
            {errorAlert?.message}
          </div>
        </div>
      </Modal>
    </>
  );
};
