import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Printer,
  FileText,
  Eye,
  CheckCircle,
  AlertCircle,
  Download,
  Calendar,
  RotateCcw,
  Zap,
  Package,
  Search,
  ShoppingCart,
  User,
  AlertTriangle,
  Minus,
  Trash2,
  Clock,
  Send,
  Warehouse as WarehouseIcon,
  CheckCircle2,
  PackageCheck
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/rbac';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters';
import { SalesInvoice, Product, InvoiceItem, HeldInvoice } from '../../types';
import { InvoicePrintModal } from '../../components/invoice/InvoicePrintModal';
import { Modal } from '../../components/common/Modal';

export const SalesInvoicesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const targetInvoiceId = searchParams.get('invoiceId') || searchParams.get('id');
  const targetInvoiceNumber = searchParams.get('invoiceNumber');
  const initialTab = searchParams.get('tab') || (searchParams.get('filter') === 'today' ? 'invoices' : 'orders');
  const initialAction = searchParams.get('action');

  const { profile } = useAuth();
  const isSalesperson = profile?.role === 'Salesperson';

  const {
    salesInvoices,
    company,
    products,
    customers,
    warehouses,
    createSalesInvoice,
    holdInvoice,
    getWarehouseStock
  } = useERP();

  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(null);
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  // Salesperson Tabs: 'orders' | 'invoices' | 'products'
  const [salesTab, setSalesTab] = useState<'orders' | 'invoices' | 'products'>(
    initialTab === 'products' ? 'products' : initialTab === 'invoices' ? 'invoices' : 'orders'
  );

  // Product Catalog Search & Category Filter
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Prepare Sales Order Modal State
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(initialAction === 'new-order');
  const [orderCustomerId, setOrderCustomerId] = useState<string>(customers[0]?.id || '');
  const [orderWarehouseId, setOrderWarehouseId] = useState<string>(
    warehouses.find(w => w.isDefault && (w.isActive ?? true))?.id ||
    warehouses.find(w => (w.isActive ?? true))?.id ||
    warehouses[0]?.id || ''
  );
  const [orderItems, setOrderItems] = useState<InvoiceItem[]>([]);
  const [orderNotes, setOrderNotes] = useState('');
  const [selectedProductToAdd, setSelectedProductToAdd] = useState<string>('');
  const [addQty, setAddQty] = useState<number>(1);
  const [stockWarning, setStockWarning] = useState<string | null>(null);
  const [orderSuccessNumber, setOrderSuccessNumber] = useState<string | null>(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // Synchronize customers and warehouses when loaded
  useEffect(() => {
    if (customers.length > 0 && !orderCustomerId) {
      setOrderCustomerId(customers[0].id);
    }
  }, [customers, orderCustomerId]);

  useEffect(() => {
    if (warehouses.length > 0 && !orderWarehouseId) {
      const def = warehouses.find(w => w.isDefault && (w.isActive ?? true)) || warehouses[0];
      if (def) setOrderWarehouseId(def.id);
    }
  }, [warehouses, orderWarehouseId]);

  // Synchronize URL query params
  useEffect(() => {
    if (initialAction === 'new-order') {
      setIsOrderModalOpen(true);
    }
  }, [initialAction]);

  // Auto-open target invoice if navigated from notification or external link
  const openedTargetRef = useRef<string | null>(null);
  useEffect(() => {
    const targetKey = targetInvoiceId || targetInvoiceNumber;
    if (targetKey && salesInvoices.length > 0 && openedTargetRef.current !== targetKey) {
      const match = salesInvoices.find(
        inv =>
          (targetInvoiceId && inv.id === targetInvoiceId) ||
          (targetInvoiceNumber && inv.invoiceNumber.toLowerCase() === targetInvoiceNumber.toLowerCase())
      );
      if (match) {
        openedTargetRef.current = targetKey;
        setSelectedInvoice(match);
        setIsPrintOpen(true);
      }
    }
  }, [targetInvoiceId, targetInvoiceNumber, salesInvoices]);

  const handlePrintClick = (invoice: SalesInvoice, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedInvoice(invoice);
    setIsPrintOpen(true);
  };

  // Distinct product categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return ['All', ...Array.from(set)];
  }, [products]);

  // Filtered products for lookup
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchCat = selectedCategory === 'All' || p.category === selectedCategory;
      const q = productSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q));
      return matchCat && matchSearch;
    });
  }, [products, selectedCategory, productSearch]);

  // Prepared Sales Orders (docType === 'sales_order' or 'quotation')
  const preparedSalesOrders = useMemo(() => {
    return salesInvoices.filter(
      inv => inv.docType === 'sales_order' || inv.docType === 'quotation' || inv.docType === 'estimate'
    );
  }, [salesInvoices]);

  // Confirmed Sales Invoices (docType !== 'sales_order')
  const confirmedInvoices = useMemo(() => {
    const isTodayFilter = searchParams.get('filter') === 'today';
    const todayStr = new Date().toISOString().split('T')[0];
    return salesInvoices.filter(inv => {
      const isInvoice = inv.docType !== 'sales_order' && inv.docType !== 'quotation';
      if (!isInvoice) return false;
      if (isTodayFilter) return inv.date === todayStr;
      return true;
    });
  }, [salesInvoices, searchParams]);

  // Order item adding with strict stock validation
  const handleAddItemToOrder = (productToAdd?: Product) => {
    const prod = productToAdd || products.find(p => p.id === selectedProductToAdd);
    if (!prod) return;

    const available = getWarehouseStock(orderWarehouseId, prod.id);

    // 1. Check out of stock
    if (available <= 0) {
      setStockWarning(`Out of Stock — "${prod.name}" cannot be added because 0 units are available in this warehouse.`);
      return;
    }

    // 2. Check existing in cart
    const existingIndex = orderItems.findIndex(i => i.productId === prod.id);
    const existingQty = existingIndex >= 0 ? orderItems[existingIndex].qty : 0;
    const requestedTotal = existingQty + addQty;

    // 3. Prevent selection exceeding available stock
    if (requestedTotal > available) {
      setStockWarning(
        `Quantity limit exceeded: "${prod.name}" has only ${available} ${prod.primaryUnit || 'units'} available. Cannot order ${requestedTotal}.`
      );
      return;
    }

    setStockWarning(null);

    const rate = Number(prod.sellingPrice || 0);
    const taxRate = Number(prod.taxRate || 0);
    const itemSubtotal = rate * (existingIndex >= 0 ? requestedTotal : addQty);
    const taxAmt = (itemSubtotal * taxRate) / 100;
    const total = itemSubtotal + taxAmt;

    if (existingIndex >= 0) {
      const updated = [...orderItems];
      updated[existingIndex] = {
        ...updated[existingIndex],
        qty: requestedTotal,
        taxAmt,
        total
      };
      setOrderItems(updated);
    } else {
      const newItem: InvoiceItem = {
        id: 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku || '',
        barcode: prod.barcode || '',
        hsn: prod.hsn || '',
        qty: addQty,
        unit: prod.primaryUnit || 'Piece',
        rate,
        discountPct: 0,
        discountAmt: 0,
        taxRate,
        taxAmt,
        cgstAmt: taxRate > 0 ? taxAmt / 2 : 0,
        sgstAmt: taxRate > 0 ? taxAmt / 2 : 0,
        igstAmt: 0,
        total,
        costPrice: Number(prod.purchasePrice || prod.costPrice || 0)
      };
      setOrderItems([...orderItems, newItem]);
    }

    setSelectedProductToAdd('');
    setAddQty(1);
  };

  const handleUpdateItemQty = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      setOrderItems(orderItems.filter(i => i.productId !== productId));
      return;
    }

    const available = getWarehouseStock(orderWarehouseId, productId);
    if (newQty > available) {
      setStockWarning(`Cannot set quantity to ${newQty}: Only ${available} available in stock.`);
      return;
    }
    setStockWarning(null);

    setOrderItems(
      orderItems.map(item => {
        if (item.productId === productId) {
          const itemSubtotal = item.rate * newQty;
          const taxAmt = (itemSubtotal * item.taxRate) / 100;
          return {
            ...item,
            qty: newQty,
            taxAmt,
            cgstAmt: item.taxRate > 0 ? taxAmt / 2 : 0,
            sgstAmt: item.taxRate > 0 ? taxAmt / 2 : 0,
            total: itemSubtotal + taxAmt
          };
        }
        return item;
      })
    );
  };

  const handleRemoveOrderItem = (productId: string) => {
    setOrderItems(orderItems.filter(i => i.productId !== productId));
  };

  // Order Calculations
  const { orderSubtotal, orderTaxTotal, orderGrandTotal } = useMemo(() => {
    const sub = orderItems.reduce((acc, i) => acc + i.rate * i.qty, 0);
    const tax = orderItems.reduce((acc, i) => acc + i.taxAmt, 0);
    return {
      orderSubtotal: sub,
      orderTaxTotal: tax,
      orderGrandTotal: sub + tax
    };
  }, [orderItems]);

  // Submit & Hand Over to Cashier
  const handleHandoverToCashier = async () => {
    if (orderItems.length === 0 || isSubmittingOrder) return;

    const cust = customers.find(c => c.id === orderCustomerId) || customers[0];
    if (!cust) {
      alert('Please select a customer for this order.');
      return;
    }

    setIsSubmittingOrder(true);
    setStockWarning(null);

    try {
      const orderNumber = `SO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      // 1. Create persistent Sales Order record (docType: 'sales_order')
      // Note: docType 'sales_order' does NOT deduct inventory and does NOT take payment!
      await createSalesInvoice({
        invoiceNumber: orderNumber,
        docType: 'sales_order',
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        customerId: cust.id,
        customerName: cust.name,
        customerPhone: cust.phone,
        customerGstin: cust.gstin,
        customerAddress: cust.address,
        warehouseId: orderWarehouseId,
        items: orderItems,
        subtotal: orderSubtotal,
        discountTotal: 0,
        taxTotal: orderTaxTotal,
        cgstTotal: orderTaxTotal / 2,
        sgstTotal: orderTaxTotal / 2,
        igstTotal: 0,
        roundOff: 0,
        grandTotal: orderGrandTotal,
        paidAmount: 0,
        paymentStatus: 'Unpaid',
        paymentMethod: 'Cash',
        notes: orderNotes ? `Handover notes: ${orderNotes}` : 'Prepared by Sales Person for Cashier checkout',
        terms: company.termsAndConditions
      });

      // 2. Also register in heldInvoices so Cashier sees it in the FastPOS Held Invoices drawer
      const held: HeldInvoice = {
        id: `so-${Date.now()}`,
        heldAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        customerName: `${cust.name} (${orderNumber})`,
        items: orderItems,
        subtotal: orderSubtotal,
        taxTotal: orderTaxTotal,
        grandTotal: orderGrandTotal,
        note: `Sales Order #${orderNumber}`
      };
      holdInvoice(held);

      setOrderSuccessNumber(orderNumber);
      setOrderItems([]);
      setOrderNotes('');
    } catch (err: any) {
      alert(`Failed to prepare sales order: ${err?.message || 'Error occurred'}`);
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Standard Columns for Non-Salesperson Roles
  const standardColumns: Column<SalesInvoice>[] = [
    {
      key: 'invoiceNumber',
      header: 'Invoice #',
      render: row => (
        <span className="font-mono font-bold text-blue-600 hover:underline">
          {row.invoiceNumber}
        </span>
      )
    },
    {
      key: 'date',
      header: 'Date',
      render: row => formatDate(row.date)
    },
    {
      key: 'customerName',
      header: 'Customer',
      render: row => (
        <div>
          <span className="font-semibold text-slate-800 block truncate max-w-[220px]">
            {row.customerName}
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            {row.customerGstin || 'Unregistered'}
          </span>
        </div>
      )
    },
    {
      key: 'items',
      header: 'Items',
      align: 'center',
      render: row => (
        <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full bg-slate-100 font-mono font-bold text-slate-700 text-xs whitespace-nowrap">
          {row.items?.length || 0}
        </span>
      )
    },
    {
      key: 'grandTotal',
      header: 'Amount',
      align: 'right',
      render: row => (
        <span className="font-bold text-slate-900">{formatCurrency(row.grandTotal)}</span>
      )
    },
    {
      key: 'paidAmount',
      header: 'Paid',
      align: 'right',
      render: row => (
        <span className="font-medium text-slate-600">{formatCurrency(row.paidAmount)}</span>
      )
    },
    {
      key: 'paymentStatus',
      header: 'Status',
      align: 'center',
      render: row => <StatusBadge status={row.paymentStatus} size="sm" />
    },
    {
      key: 'paymentMethod',
      header: 'Mode',
      align: 'center',
      render: row => (
        <span className="text-[11px] text-slate-500 font-medium px-2 py-0.5 bg-slate-50 rounded border border-slate-200">
          {row.paymentMethod}
        </span>
      )
    }
  ];

  // ---------------------------------------------------------------------------
  // A. SALESPERSON TAILORED VIEW (Orders, Invoices, Product & Stock Lookup)
  // ---------------------------------------------------------------------------
  if (isSalesperson) {
    return (
      <div className="space-y-5">
        {/* Top Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-blue-600" />
                <span>Sales Records &amp; Order Status</span>
              </h1>
              <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                View Only
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              View authorized customer purchase records, sales order statuses, and receipt slips. Counter billing and payment processing are handled by the Cashier.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/inventory')}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Package className="w-4 h-4 text-slate-500" />
              <span>Check Live Stock</span>
            </button>
            <button
              onClick={() => navigate('/customers')}
              className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <User className="w-4 h-4 text-blue-600" />
              <span>Customer Directory</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-1 overflow-x-auto">
          <button
            onClick={() => {
              setSalesTab('invoices');
              setSearchParams({ tab: 'invoices' });
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              salesTab === 'invoices'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Confirmed Invoices ({confirmedInvoices.length})</span>
          </button>

          <button
            onClick={() => {
              setSalesTab('orders');
              setSearchParams({ tab: 'orders' });
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              salesTab === 'orders'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <PackageCheck className="w-4 h-4" />
            <span>Sales Orders &amp; Quotations ({preparedSalesOrders.length})</span>
          </button>
        </div>

        {/* ================= TAB 1: SALES ORDERS ================= */}
        {salesTab === 'orders' && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Sales Orders &amp; Quotation History
                </h2>
                <p className="text-xs text-slate-500">
                  Orders submitted for cashier counter billing and customer assistance.
                </p>
              </div>
            </div>

            {preparedSalesOrders.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <PackageCheck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="font-semibold text-slate-700">No prepared sales orders yet</p>
                <p className="text-xs text-slate-400 mt-1">
                  Click &quot;New Sales Order&quot; to prepare an order and hand it over to the Cashier.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-3">Order #</th>
                      <th className="py-3 px-3">Date</th>
                      <th className="py-3 px-3">Customer</th>
                      <th className="py-3 px-3 text-center">Items</th>
                      <th className="py-3 px-3 text-right">Order Value</th>
                      <th className="py-3 px-3 text-center">Handover Status</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preparedSalesOrders.map(order => {
                      const isCompleted = order.paymentStatus === 'Paid';
                      return (
                        <tr
                          key={order.id}
                          onClick={() => {
                            setSelectedInvoice(order);
                            setIsPrintOpen(true);
                          }}
                          className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                        >
                          <td className="py-3 px-3 font-mono font-bold text-blue-600">
                            {order.invoiceNumber}
                          </td>
                          <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">
                            {formatDate(order.date)}
                          </td>
                          <td className="py-3 px-3 font-medium text-slate-900">
                            {order.customerName}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-semibold text-slate-700">
                            {order.items?.length || 0}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-slate-900 font-mono">
                            {formatCurrency(order.grandTotal)}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {isCompleted ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Completed &amp; Paid</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                <Clock className="w-3 h-3" />
                                <span>Prepared — Awaiting Cashier Checkout</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                setSelectedInvoice(order);
                                setIsPrintOpen(true);
                              }}
                              className="px-2.5 py-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-medium transition-colors"
                              title="View Order Slip"
                            >
                              <Eye className="w-3.5 h-3.5 inline mr-1" />
                              <span>View Slip</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: CONFIRMED INVOICES ================= */}
        {salesTab === 'invoices' && (
          <DataTable
            title="Confirmed Sales Invoices"
            subtitle={`Showing ${confirmedInvoices.length} billed transactions`}
            columns={standardColumns}
            data={confirmedInvoices}
            searchPlaceholder="Search invoice #, customer name..."
            searchKeys={['invoiceNumber', 'customerName', 'paymentStatus']}
            onRowClick={row => {
              setSelectedInvoice(row);
              setIsPrintOpen(true);
            }}
            actions={row => (
              <button
                onClick={e => handlePrintClick(row, e)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                title="Print / View Invoice"
              >
                <Printer className="w-4 h-4" />
              </button>
            )}
          />
        )}



        

        {/* Invoice / Order Print Modal */}
        <InvoicePrintModal
          invoice={selectedInvoice}
          isOpen={isPrintOpen}
          onClose={() => setIsPrintOpen(false)}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // B. STANDARD VIEW (Admin, Owner, Accountant, Cashier)
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Sales Invoices &amp; Billing
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage tax invoices, thermal cash receipts, export GSTR-1 data and print billing documents.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasPermission(profile?.role, 'pos', 'view') && (
            <button
              onClick={() => navigate('/sales/pos')}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-white" />
              <span>POS Fast Billing</span>
            </button>
          )}

          {hasPermission(profile?.role, 'sales', 'create') && (
            <button
              onClick={() => navigate('/sales/new')}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Tax Invoice</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Invoices Table */}
      <DataTable
        title="All Sales Invoices"
        subtitle={`Showing ${salesInvoices.length} invoices generated for ${company.name}`}
        columns={standardColumns}
        data={salesInvoices}
        searchPlaceholder="Search by invoice number, customer name, GSTIN..."
        searchKeys={['invoiceNumber', 'customerName', 'customerGstin', 'paymentStatus']}
        filters={[
          {
            key: 'paymentStatus',
            label: 'Status',
            options: [
              { label: 'Paid', value: 'Paid' },
              { label: 'Partially Paid', value: 'Partially Paid' },
              { label: 'Unpaid', value: 'Unpaid' }
            ]
          }
        ]}
        onRowClick={row => {
          setSelectedInvoice(row);
          setIsPrintOpen(true);
        }}
        actions={row => (
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={e => handlePrintClick(row, e)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
              title="Print / View Invoice"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={e => {
                e.stopPropagation();
                navigate('/sales/returns');
              }}
              className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
              title="Process Return"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        )}
      />

      {/* Invoice Print & View Modal */}
      <InvoicePrintModal
        invoice={selectedInvoice}
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
      />
    </div>
  );
};
