import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
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
  ArrowRight
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

export interface NotificationCategoryTab {
  id: string;
  label: string;
  high?: boolean;
}

export const NOTIFICATION_CATEGORY_TABS: NotificationCategoryTab[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'customer_complaint', label: 'Complaints', high: true },
  { id: 'customer_product_damage', label: 'Product Damage', high: true },
  { id: 'customer_support_request', label: 'Support' },
  { id: 'customer_return_request', label: 'Returns & Replacements', high: true },
  { id: 'customer_followup', label: 'Follow-ups' },
  { id: 'customer_update', label: 'Customer Updates' }
];

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

  // Category tabs centering and smooth navigation
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const prevCategoryFilterRef = useRef<string>(categoryFilter);

  const centerTab = useCallback((tabId: string, smooth: boolean = true) => {
    const container = tabsContainerRef.current;
    const tabEl = tabRefs.current.get(tabId);
    if (!container || !tabEl) return;

    const containerRect = container.getBoundingClientRect();
    const tabRect = tabEl.getBoundingClientRect();

    if (containerRect.width === 0) return;

    // Calculate distance needed to position the tab's center at container's center
    const tabCenter = tabRect.left + tabRect.width / 2;
    const containerCenter = containerRect.left + containerRect.width / 2;
    const offset = tabCenter - containerCenter;

    // If already centered within 1.5 pixels, avoid redundant scroll
    if (Math.abs(offset) < 1.5) return;

    const currentScrollLeft = container.scrollLeft;
    const targetScrollLeft = currentScrollLeft + offset;
    const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);
    const clampedScrollLeft = Math.max(0, Math.min(maxScrollLeft, targetScrollLeft));

    if (Math.abs(clampedScrollLeft - currentScrollLeft) < 1.5) return;

    container.scrollTo({
      left: clampedScrollLeft,
      behavior: smooth ? 'smooth' : 'auto'
    });
  }, []);

  const handleTabClick = (tabId: string) => {
    setCategoryFilter(tabId);
    centerTab(tabId, true);
  };

  const handleTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = index;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextIndex = (index + 1) % NOTIFICATION_CATEGORY_TABS.length;
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      nextIndex = (index - 1 + NOTIFICATION_CATEGORY_TABS.length) % NOTIFICATION_CATEGORY_TABS.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextIndex = NOTIFICATION_CATEGORY_TABS.length - 1;
    } else {
      return;
    }

    const nextTab = NOTIFICATION_CATEGORY_TABS[nextIndex];
    if (nextTab) {
      setCategoryFilter(nextTab.id);
      const nextEl = tabRefs.current.get(nextTab.id);
      nextEl?.focus();
      centerTab(nextTab.id, true);
    }
  };

  // Center selected tab when active category changes or drawer opens
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      centerTab(categoryFilter, prevCategoryFilterRef.current !== categoryFilter);
      prevCategoryFilterRef.current = categoryFilter;
    }, 60);

    return () => clearTimeout(timer);
  }, [categoryFilter, isOpen, centerTab]);

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

    if (categoryFilter === 'unread') {
      list = list.filter(n => !n.read);
    } else if (categoryFilter !== 'all') {
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

    // 4. Customer Support Cases & Customer Updates Handler
    if (isCustomerSupportNotification(item)) {
      if (item.customerId) {
        navigate(`/customers/${item.customerId}${item.caseId ? `?caseId=${item.caseId}` : ''}`);
        onClose();
        return;
      }
      if (item.link) {
        navigate(item.link);
        onClose();
        return;
      }
      navigate('/customers');
      onClose();
      return;
    }

    // 5. Working Action Link Handler: General Operational Links
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
      case 'expiring_batches':
      case 'eod_expiry':
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
      case 'expiring_batches':
      case 'eod_expiry':
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
      case 'out_of_stock':
        return 'Out of Stock';
      case 'limited_stock':
        return 'Limited Stock';
      case 'expiring_batch':
        return 'Expiring Soon';
      case 'expiring_batches':
      case 'eod_expiry':
        return 'Expiry Reminder';
      case 'purchase_request':
        return 'Purchase Request';
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
              onClick={async () => {
                try {
                  if (markAllNotificationsAsRead) {
                    await markAllNotificationsAsRead();
                  } else {
                    await Promise.all(
                      notifications.filter(n => !n.read).map(n => markNotificationAsRead(n.id))
                    );
                  }
                } catch (err: any) {
                  setErrorAlert({
                    title: 'Update Failed',
                    message: err?.message || 'Failed to mark all notifications as read. Please try again.'
                  });
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
            <div
              ref={tabsContainerRef}
              role="tablist"
              aria-label="Notification Categories"
              className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] scrollbar-none [&::-webkit-scrollbar]:hidden"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {NOTIFICATION_CATEGORY_TABS.map((tab, idx) => {
                const isSelected = categoryFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    ref={el => {
                      if (el) tabRefs.current.set(tab.id, el);
                      else tabRefs.current.delete(tab.id);
                    }}
                    role="tab"
                    aria-selected={isSelected}
                    tabIndex={isSelected ? 0 : -1}
                    data-tab-id={tab.id}
                    type="button"
                    onClick={() => handleTabClick(tab.id)}
                    onKeyDown={e => handleTabKeyDown(e, idx)}
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
                  <option value="Critical">Critical</option>
                  <option value="High">High Priority</option>
                  <option value="Normal">Normal</option>
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
              const isCriticalPriority = item.priority === 'Critical';
              const isHighPriority = item.priority === 'High' || isComplaint;

              return (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer relative ${
                    isCriticalPriority
                      ? item.read
                        ? 'bg-rose-50/25 border-rose-300 hover:border-rose-400'
                        : 'bg-rose-50/60 border-rose-400 shadow-xs ring-1 ring-rose-300 hover:border-rose-500'
                      : isHighPriority
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
                          {/* Prominent Critical Priority Badge */}
                          {isCriticalPriority && (
                            <span className="px-1.5 py-0.5 rounded-full bg-rose-700 text-white font-bold text-[9px] uppercase tracking-wider flex items-center gap-0.5 shadow-2xs">
                              <AlertOctagon className="w-2.5 h-2.5" /> Critical
                            </span>
                          )}
                          {/* Prominent High Priority Badge */}
                          {!isCriticalPriority && isHighPriority && (
                            <span className="px-1.5 py-0.5 rounded-full bg-amber-600 text-white font-bold text-[9px] uppercase tracking-wider flex items-center gap-0.5 shadow-2xs">
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
                          {item.actionText || (
                            item.type === 'customer_complaint'
                              ? 'View Complaint'
                              : item.type === 'customer_product_damage'
                              ? 'View Case'
                              : item.type === 'customer_support_request'
                              ? 'View Support Request'
                              : item.type === 'customer_return_request'
                              ? 'Review Request'
                              : item.type === 'customer_followup'
                              ? 'View Case'
                              : item.type === 'customer_update'
                              ? item.caseId ? 'View Case' : 'View Customer'
                              : item.type === 'out_of_stock' || item.type === 'limited_stock' || item.type === 'low_stock'
                              ? 'View Product'
                              : item.type === 'purchase_request'
                              ? 'View Purchase Request'
                              : item.type === 'expiring_batch'
                              ? 'View Batch & Expiry Management'
                              : item.type === 'expiring_batches' || item.type === 'eod_expiry'
                              ? 'View Expiring Batches'
                              : isCustomerSupportNotification(item)
                              ? 'View Case'
                              : 'View Details'
                          )}
                          <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                        </span>

                        {!item.read && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await markNotificationAsRead(item.id);
                                } catch (err: any) {
                                  setErrorAlert({
                                    title: 'Update Failed',
                                    message: err?.message || 'Failed to mark notification as read.'
                                  });
                                }
                              }}
                              className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-blue-600 hover:bg-blue-50 px-1.5 py-0.5 rounded transition-colors"
                              title="Mark as read"
                            >
                              <Check className="w-3 h-3" />
                              <span className="hidden sm:inline">Mark read</span>
                            </button>
                            <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" title="Unread" />
                          </div>
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
