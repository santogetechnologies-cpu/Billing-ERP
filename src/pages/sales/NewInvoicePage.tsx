import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Trash2,
  Search,
  ScanBarcode,
  AlertTriangle,
  CheckCircle,
  ArrowLeft,
  Printer,
  Save,
  HelpCircle,
  Building,
  User,
  Calendar,
  CreditCard,
  X,
  Check
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { sortProductsAZ } from '../../utils/sortUtils';
import { SalesInvoice, InvoiceItem, SalesDocType, PaymentMethod, PaymentStatus } from '../../types';
import { InvoicePrintModal } from '../../components/invoice/InvoicePrintModal';

export const NewInvoicePage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const {
    company,
    products,
    customers,
    warehouses,
    createSalesInvoice,
    salesInvoices,
    getWarehouseStock
  } = useERP();

  // Salesperson is strictly blocked from invoice creation and billing
  useEffect(() => {
    if (profile?.role === 'Salesperson') {
      navigate('/sales', { replace: true });
    }
  }, [profile, navigate]);

  // Document Number generation (Prompt #39: Safe sequence numbering, NEVER array.length)
  const nextInvoiceNumber = useMemo(() => {
    let maxSeq = (company.invoiceStartingNumber || 1001) - 1;
    salesInvoices.forEach(s => {
      const match = (s.invoiceNumber || '').match(/-(\d+)$/);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    });
    const nextNum = maxSeq + 1;
    return `${company.invoicePrefix || 'INV'}-${(company.financialYear || '2026-2027').split('-')[0]}-${nextNum}`;
  }, [company, salesInvoices]);

  // Form State
  const [docType, setDocType] = useState<SalesDocType>('tax_invoice');
  const [invoiceNumber, setInvoiceNumber] = useState(nextInvoiceNumber);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id || '');
  const [warehouseId, setWarehouseId] = useState(
    warehouses.find(w => w.isDefault && (w.isActive ?? true))?.id ||
    warehouses.find(w => (w.isActive ?? true))?.id ||
    warehouses[0]?.id || ''
  );

  // Synchronize warehouseId and customer when data loads from database
  useEffect(() => {
    if (warehouses.length === 0) return;
    setWarehouseId(prev => {
      if (prev && warehouses.some(w => w.id === prev && (w.isActive ?? true))) return prev;
      const def = warehouses.find(w => w.isDefault && (w.isActive ?? true)) ||
                  warehouses.find(w => (w.isActive ?? true)) ||
                  warehouses[0];
      return def?.id || '';
    });
  }, [warehouses]);

  useEffect(() => {
    if (customers.length === 0) return;
    setSelectedCustomerId(prev => {
      if (prev && customers.some(c => c.id === prev)) return prev;
      return customers[0]?.id || '';
    });
  }, [customers]);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Bank Transfer');
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState(company.termsAndConditions);
  const [stockWarningMessage, setStockWarningMessage] = useState<string | null>(null);

  // Line Items
  const [items, setItems] = useState<InvoiceItem[]>([]);

  // Created invoice for printing preview
  const [createdInvoice, setCreatedInvoice] = useState<SalesInvoice | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const isSavingRef = useRef(false);

  // Return to billing with a clean form ready for the next bill
  const handleStartNewBill = () => {
    setCreatedInvoice(null);
    setSaveSuccessMessage(null);
    setStockWarningMessage(null);
    setItems([]);
    setPaidAmount('');
    setNotes('');
    let maxSeq = 1000;
    salesInvoices.forEach(s => {
      const match = (s.invoiceNumber || '').match(/INV-.*?(\d+)$/);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    });
    setInvoiceNumber(`INV-${(company.financialYear || '2026-2027').split('-')[0]}-${maxSeq + 1}`);
  };

  // Active Customer Details & Credit Check
  const activeCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId) || customers[0];
  }, [customers, selectedCustomerId]);

  // Calculate live item values & totals
  const calculatedItems = useMemo(() => {
    return items.map(item => {
      const iQty = Number(item.qty) || 0;
      const iRate = Number(item.rate) || 0;
      const iDisc = Number(item.discountPct) || 0;
      const iTax = Number(item.taxRate) || 0;
      const taxable = iQty * iRate * (1 - iDisc / 100);
      const discountVal = (iQty * iRate * iDisc) / 100;
      const taxVal = (taxable * iTax) / 100;
      const cgst = taxVal / 2;
      const sgst = taxVal / 2;
      const total = taxable + taxVal;

      return {
        ...item,
        discountAmt: discountVal,
        taxAmt: taxVal,
        cgstAmt: cgst,
        sgstAmt: sgst,
        igstAmt: 0,
        total
      };
    });
  }, [items]);

  const subtotal = calculatedItems.reduce((acc, i) => acc + (Number(i.qty) || 0) * (Number(i.rate) || 0), 0);
  const discountTotal = calculatedItems.reduce((acc, i) => acc + i.discountAmt, 0);
  const taxTotal = calculatedItems.reduce((acc, i) => acc + i.taxAmt, 0);
  const cgstTotal = taxTotal / 2;
  const sgstTotal = taxTotal / 2;
  const rawGrandTotal = subtotal - discountTotal + taxTotal;
  const roundedGrandTotal = Math.round(rawGrandTotal);
  const roundOff = roundedGrandTotal - rawGrandTotal;
  const numPaidAmount = Number(paidAmount) || 0;

  // Credit Limit Exceeded Warning
  const isCreditExceeded =
    activeCustomer &&
    activeCustomer.creditLimit > 0 &&
    activeCustomer.currentOutstanding + (roundedGrandTotal - numPaidAmount) >
      activeCustomer.creditLimit;

  const excessCreditAmount =
    isCreditExceeded && activeCustomer
      ? activeCustomer.currentOutstanding +
        (roundedGrandTotal - numPaidAmount) -
        activeCustomer.creditLimit
      : 0;

  // Add Item Row
  const addItemRow = () => {
    // Pick first product with positive stock in warehouse if available
    const inStockProd = products.find(p => getWarehouseStock(warehouseId, p.id) > 0) || products[0];
    if (!inStockProd) {
      alert('Please create products in your catalog first.');
      return;
    }

    const available = getWarehouseStock(warehouseId, inStockProd.id);
    if (available <= 0) {
      setStockWarningMessage('Out of Stock — This product cannot be billed because no stock is available.');
    }

    const newItem: InvoiceItem = {
      id: 'item-' + Date.now() + Math.random().toString(36).substring(2, 5),
      productId: inStockProd.id,
      productName: inStockProd.name,
      sku: inStockProd.sku,
      barcode: inStockProd.barcode,
      hsn: inStockProd.hsn,
      qty: 1,
      unit: inStockProd.primaryUnit,
      rate: inStockProd.sellingPrice,
      discountPct: 0,
      discountAmt: 0,
      taxRate: inStockProd.taxRate,
      taxAmt: 0,
      cgstAmt: 0,
      sgstAmt: 0,
      igstAmt: 0,
      total: 0,
      costPrice: inStockProd.costPrice
    };
    setItems(prev => [...prev, newItem]);
  };

  // Remove Item Row
  const removeItemRow = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  // Update Item field with immediate stock availability validation
  const updateItemField = (id: string, field: keyof InvoiceItem, value: any) => {
    setItems(prev =>
      prev.map(i => {
        if (i.id === id) {
          if (field === 'productId') {
            const prod = products.find(p => p.id === value);
            if (prod) {
              const available = getWarehouseStock(warehouseId, prod.id);
              if (available <= 0) {
                setStockWarningMessage('Out of Stock — This product cannot be billed because no stock is available.');
              } else if (Number(i.qty) > available) {
                setStockWarningMessage(`Insufficient stock. Available: ${available} ${prod.primaryUnit}.`);
              } else {
                setStockWarningMessage(null);
              }

              return {
                ...i,
                productId: prod.id,
                productName: prod.name,
                sku: prod.sku,
                barcode: prod.barcode,
                hsn: prod.hsn,
                unit: prod.primaryUnit,
                rate: prod.sellingPrice,
                taxRate: prod.taxRate,
                costPrice: prod.costPrice
              };
            }
          }

          if (field === 'qty') {
            const available = getWarehouseStock(warehouseId, i.productId);
            const numQty = Number(value) || 0;
            if (available <= 0 && numQty > 0) {
              setStockWarningMessage('Out of Stock — This product cannot be billed because no stock is available.');
            } else if (numQty > available) {
              setStockWarningMessage(`Insufficient stock. Available: ${available} ${i.unit}.`);
            } else {
              setStockWarningMessage(null);
            }
          }

          return { ...i, [field]: value };
        }
        return i;
      })
    );
  };

  // Barcode / SKU quick scanner add with strict stock validation
  const [scannerInput, setScannerInput] = useState('');
  const handleScannerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannerInput.trim()) return;

    const query = scannerInput.trim().toLowerCase();
    const found = products.find(
      p =>
        p.barcode.toLowerCase() === query ||
        p.sku.toLowerCase() === query ||
        p.code.toLowerCase() === query
    );

    if (found) {
      const available = getWarehouseStock(warehouseId, found.id);
      const existing = items.find(i => i.productId === found.id);
      const targetQty = (existing ? Number(existing.qty) : 0) + 1;

      // Strict stock validation rule 1: Zero stock
      if (available <= 0) {
        setStockWarningMessage('Out of Stock — This product cannot be billed because no stock is available.');
        alert('Out of Stock — This product cannot be billed because no stock is available.');
        return;
      }

      // Strict stock validation rule 2: Insufficient stock
      if (targetQty > available) {
        const msg = `Insufficient stock. Available: ${available} ${found.primaryUnit}.`;
        setStockWarningMessage(msg);
        alert(msg);
        return;
      }

      setStockWarningMessage(null);
      if (existing) {
        updateItemField(existing.id, 'qty', existing.qty + 1);
      } else {
        const newItem: InvoiceItem = {
          id: 'item-' + Date.now(),
          productId: found.id,
          productName: found.name,
          sku: found.sku,
          barcode: found.barcode,
          hsn: found.hsn,
          qty: 1,
          unit: found.primaryUnit,
          rate: found.sellingPrice,
          discountPct: 0,
          discountAmt: 0,
          taxRate: found.taxRate,
          taxAmt: 0,
          cgstAmt: 0,
          sgstAmt: 0,
          igstAmt: 0,
          total: 0,
          costPrice: found.costPrice
        };
        setItems(prev => [...prev, newItem]);
      }
      setScannerInput('');
    } else {
      alert(`No product found with barcode/SKU "${scannerInput}"`);
    }
  };

  // Submit invoice with authoritative pre-transaction stock validation
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!activeCustomer) {
      alert('Please select a valid customer.');
      return;
    }

    if (items.length === 0) {
      alert('Please add at least one line item.');
      return;
    }

    // Strict stock availability validation before submitting transaction
    const affectsStock = docType === 'tax_invoice' || docType === 'delivery_challan' || docType === 'sales_order';
    if (affectsStock) {
      const requestedMap = new Map<string, { qty: number; unit: string; name: string }>();
      for (const item of calculatedItems) {
        if (!item.productId) continue;
        const cur = requestedMap.get(item.productId) || { qty: 0, unit: item.unit || 'Pcs', name: item.productName };
        cur.qty += Number(item.qty) || 0;
        requestedMap.set(item.productId, cur);
      }

      for (const [prodId, req] of requestedMap.entries()) {
        const available = getWarehouseStock(warehouseId, prodId);
        const prod = products.find(p => p.id === prodId);
        const unit = req.unit || prod?.primaryUnit || 'Pcs';

        if (available <= 0) {
          setStockWarningMessage('Out of Stock — This product cannot be billed because no stock is available.');
          alert('Out of Stock — This product cannot be billed because no stock is available.');
          return;
        }

        if (req.qty > available) {
          const msg = `Insufficient stock. Available: ${available} ${unit}.`;
          setStockWarningMessage(msg);
          alert(msg);
          return;
        }
      }
    }

    // Prompt #38: Credit Limit Enforcement
    if (isCreditExceeded) {
      const confirmProceed = window.confirm(
        `Credit limit exceeded by ${formatCurrency(excessCreditAmount)} for customer "${activeCustomer.name}".\n\nCredit Limit: ${formatCurrency(activeCustomer.creditLimit)}\nCurrent Balance: ${formatCurrency(activeCustomer.currentOutstanding)}\nNew Invoice: ${formatCurrency(roundedGrandTotal - (Number(paidAmount) || 0))}\n\nDo you want to proceed with Manager Approval Override?`
      );
      if (!confirmProceed) {
        return;
      }
    }

    // Requirement 7: If the invoice has already been saved, printing it again must reuse the same saved invoice ID and invoice number. Never create another invoice or deduct stock again.
    if (createdInvoice && createdInvoice.id) {
      setIsPrintModalOpen(true);
      return;
    }

    // Requirement 8: Prevent duplicate save operations from repeated clicks, print callbacks or page refreshes.
    if (isSavingRef.current || isSubmitting) return;

    isSavingRef.current = true;
    setIsSubmitting(true);
    try {
      const numPaid = Number(paidAmount) || 0;
      let paymentStatus: PaymentStatus = 'Unpaid';
      if (numPaid >= roundedGrandTotal) {
        paymentStatus = 'Paid';
      } else if (numPaid > 0) {
        paymentStatus = 'Partially Paid';
      }

      const newInvoice = await createSalesInvoice({
        invoiceNumber,
        docType,
        date,
        dueDate,
        customerId: activeCustomer.id,
        customerName: activeCustomer.name,
        customerPhone: activeCustomer.phone,
        customerGstin: activeCustomer.gstin,
        customerAddress: activeCustomer.address,
        warehouseId,
        items: calculatedItems,
        subtotal,
        discountTotal,
        taxTotal,
        cgstTotal,
        sgstTotal,
        igstTotal: 0,
        roundOff,
        grandTotal: roundedGrandTotal,
        paidAmount: numPaid,
        paymentStatus,
        paymentMethod,
        notes,
        terms
      });

      setStockWarningMessage(null);
      // Requirement 9: Show a clear success message such as "Invoice saved successfully" after the database confirms the save.
      setSaveSuccessMessage(`Invoice saved successfully (${newInvoice.invoiceNumber})`);
      setCreatedInvoice(newInvoice);
      // Requirement 2: After successful saving, open or remain on a dedicated Saved Invoice Preview screen instead of automatically navigating back to the billing page.
      setIsPrintModalOpen(true);
    } catch (err: any) {
      // Requirement 10: If saving fails, show an error and do not display a false success message.
      const errMsg = err?.message || 'Failed to create invoice';
      setStockWarningMessage(errMsg);
      setSaveSuccessMessage(null);
      setCreatedInvoice(null);
      alert(errMsg);
    } finally {
      isSavingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/sales')}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Generate Sales Invoice
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Create GST compliant tax invoice, deduct warehouse stock and record accounting ledgers.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/sales')}
            className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || (!createdInvoice && items.length === 0)}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                <span>Generating...</span>
              </>
            ) : createdInvoice ? (
              <>
                <Printer className="w-3.5 h-3.5" />
                <span>Print Bill</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Generate & Print</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Save Success Banner */}
      {createdInvoice && (
        <div
          id="invoice-page-saved-banner"
          className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-emerald-800 shadow-2xs animate-fadeIn"
        >
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Check className="w-4 h-4 stroke-[2.5]" />
            </span>
            <div>
              <p className="font-bold text-sm text-emerald-950">Invoice saved successfully</p>
              <p className="text-xs text-emerald-700">
                Invoice #{createdInvoice.invoiceNumber} recorded in database &bull; Stock balance deducted &bull; Ledgers posted
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>View / Print Bill</span>
            </button>
            <button
              type="button"
              onClick={handleStartNewBill}
              className="px-3.5 py-1.5 bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-900 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Start New Bill
            </button>
          </div>
        </div>
      )}

      {/* Credit Limit Alert Banner */}
      {isCreditExceeded && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900 animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold">Customer Credit Warning:</span>{' '}
              {activeCustomer.name} has credit limit of {formatCurrency(activeCustomer.creditLimit)}.
              Current balance {formatCurrency(activeCustomer.currentOutstanding)}. This invoice will
              exceed limit by{' '}
              <strong className="text-rose-700">{formatCurrency(excessCreditAmount)}</strong>.
            </div>
          </div>
          <span className="px-2 py-0.5 rounded bg-amber-200/80 font-bold text-[10px] text-amber-900 uppercase">
            Manager Override Permitted
          </span>
        </div>
      )}

      {/* Section 1: Customer & Invoice Metadata */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
          <User className="w-4 h-4 text-blue-600" />
          Customer Information & Billing Details
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Customer Selector */}
          <div className="sm:col-span-2">
            <label className="block font-medium text-slate-700 mb-1">
              Select Customer <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedCustomerId}
              onChange={e => {
                setSelectedCustomerId(e.target.value);
                const c = customers.find(cust => cust.id === e.target.value);
                if (c && c.creditDays) {
                  const newDue = new Date(Date.now() + c.creditDays * 24 * 60 * 60 * 1000)
                    .toISOString()
                    .split('T')[0];
                  setDueDate(newDue);
                }
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} — Outstanding: {formatCurrency(c.currentOutstanding)} ({c.type})
                </option>
              ))}
            </select>

            {activeCustomer && (
              <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg flex flex-wrap items-center justify-between text-[11px] text-slate-600 gap-2">
                <span>
                  <strong>GSTIN:</strong> {activeCustomer.gstin || 'Unregistered'}
                </span>
                <span>
                  <strong>Phone:</strong> {activeCustomer.phone}
                </span>
                <span>
                  <strong>Credit Limit:</strong> {formatCurrency(activeCustomer.creditLimit)}
                </span>
                <span className="font-semibold text-blue-600">
                  Credit Period: {activeCustomer.creditDays} Days
                </span>
              </div>
            )}
          </div>

          {/* Invoice Number */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">Invoice Number</label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={e => setInvoiceNumber(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Document Type */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">Document Type</label>
            <select
              value={docType}
              onChange={e => setDocType(e.target.value as SalesDocType)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="tax_invoice">Tax Invoice (Standard GST)</option>
              <option value="pos_invoice">POS Cash Bill</option>
              <option value="quotation">Quotation / Quotation</option>
              <option value="estimate">Sales Estimate</option>
              <option value="sales_order">Sales Order</option>
              <option value="proforma_invoice">Proforma Invoice</option>
              <option value="delivery_challan">Delivery Challan</option>
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">Invoice Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Due Date */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Dispatch Warehouse */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">Dispatch Hub</label>
            <select
              value={warehouseId}
              onChange={e => setWarehouseId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              {warehouses.filter(w => w.isActive ?? true).map(w => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code}){w.isDefault ? ' — Primary Hub' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
              <option value="UPI">UPI Instant QR</option>
              <option value="Cash">Cash Counter</option>
              <option value="Card">Debit / Credit Card</option>
              <option value="Cheque">Cheque</option>
              <option value="Credit">Credit Term</option>
            </select>
          </div>
        </div>
      </div>

      {/* Section 2: Barcode Quick Scan & Line Items Table */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-4">
        {stockWarningMessage && (
          <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg flex items-center justify-between text-rose-800 text-xs font-semibold shadow-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{stockWarningMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setStockWarningMessage(null)}
              className="p-1 hover:bg-rose-100 rounded text-rose-500"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Line Items & Products</h2>
            <p className="text-xs text-slate-500">Scan barcode, search SKU or select from inventory catalog</p>
          </div>

          {/* Barcode Fast Scan Input */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <ScanBarcode className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={scannerInput}
                onChange={e => setScannerInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleScannerSubmit(e);
                }}
                placeholder="Scan Barcode / SKU & Enter..."
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 w-64"
              />
            </div>
            <button
              type="button"
              onClick={handleScannerSubmit}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
            >
              Add
            </button>
          </div>
        </div>

        {/* Items Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-2 w-8 text-center">#</th>
                <th className="py-2.5 px-2 min-w-[240px]">Product / Item</th>
                <th className="py-2.5 px-2 w-24">HSN</th>
                <th className="py-2.5 px-2 w-24 text-right">Quantity</th>
                <th className="py-2.5 px-2 w-20">Unit</th>
                <th className="py-2.5 px-2 w-28 text-right">Rate (₹)</th>
                <th className="py-2.5 px-2 w-20 text-right">Disc %</th>
                <th className="py-2.5 px-2 w-20 text-right">GST %</th>
                <th className="py-2.5 px-2 w-28 text-right">Tax (₹)</th>
                <th className="py-2.5 px-2 w-32 text-right">Total (₹)</th>
                <th className="py-2.5 px-2 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {calculatedItems.map((item, idx) => {
                const stockInWh = getWarehouseStock(warehouseId, item.productId);
                const isOutOfStock = stockInWh <= 0;
                const isInsufficient = Number(item.qty) > stockInWh;

                return (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="py-2 px-2 text-center text-slate-400 font-mono">{idx + 1}</td>

                    {/* Product Selector */}
                    <td className="py-2 px-2">
                      <select
                        value={item.productId}
                        onChange={e => updateItemField(item.id, 'productId', e.target.value)}
                        className={`w-full px-2 py-1.5 border rounded text-slate-900 font-semibold focus:outline-none focus:ring-1 ${
                          isOutOfStock ? 'bg-rose-50 border-rose-300 text-rose-900 focus:ring-rose-500' : 'bg-slate-50 border-slate-200 focus:ring-blue-500'
                        }`}
                      >
                        {sortProductsAZ(products).map(p => {
                          const pStock = getWarehouseStock(warehouseId, p.id);
                          const pStatus =
                            pStock <= 0
                              ? 'Out of Stock'
                              : p.reorderLevel !== null && p.reorderLevel !== undefined && pStock <= p.reorderLevel
                              ? 'Limited'
                              : 'In Stock';
                          return (
                            <option key={p.id} value={p.id}>
                              {p.name} ({pStatus} - {pStock} {p.primaryUnit} | ₹{p.sellingPrice})
                            </option>
                          );
                        })}
                      </select>
                      {isOutOfStock ? (
                        <span className="text-[10px] text-rose-600 font-bold flex items-center gap-1 mt-0.5">
                          <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0 inline" />
                          Out of Stock — This product cannot be billed because no stock is available.
                        </span>
                      ) : isInsufficient ? (
                        <span className="text-[10px] text-rose-600 font-bold flex items-center flex-wrap gap-1 mt-0.5">
                          <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0 inline" />
                          <span>Insufficient stock. Available: {stockInWh} {item.unit}.</span>
                          <button
                            type="button"
                            onClick={() => updateItemField(item.id, 'qty', stockInWh)}
                            className="ml-1 px-1.5 py-0.2 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded text-[9px] font-bold cursor-pointer"
                          >
                            Set to {stockInWh}
                          </button>
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                          SKU: {item.sku} | Barcode: {item.barcode} | Avail: {stockInWh} {item.unit}
                        </span>
                      )}
                    </td>

                    {/* HSN */}
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        value={item.hsn}
                        onChange={e => updateItemField(item.id, 'hsn', e.target.value)}
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-slate-700 font-mono text-center"
                      />
                    </td>

                    {/* Quantity */}
                    <td className="py-2 px-2 text-right">
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={item.qty}
                        onChange={e => {
                          const raw = e.target.value;
                          if (raw === '') { updateItemField(item.id, 'qty', ''); return; }
                          if (raw.includes('-')) return;
                          updateItemField(item.id, 'qty', raw.replace(/^0+(?=\d)/, ''));
                        }}
                        placeholder="1"
                        className={`w-full px-2 py-1 border rounded font-bold text-right ${
                          isOutOfStock || isInsufficient
                            ? 'bg-rose-50 border-rose-300 text-rose-900 focus:ring-1 focus:ring-rose-500'
                            : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`}
                      />
                    </td>

                  {/* Unit */}
                  <td className="py-2 px-2">
                    <span className="text-slate-600 font-medium px-2 py-1 bg-slate-100 rounded block text-center">
                      {item.unit}
                    </span>
                  </td>

                  {/* Unit Rate */}
                  <td className="py-2 px-2 text-right">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={item.rate}
                      onChange={e => {
                        const raw = e.target.value;
                        if (raw === '') { updateItemField(item.id, 'rate', ''); return; }
                        if (raw.includes('-')) return;
                        updateItemField(item.id, 'rate', raw.replace(/^0+(?=\d)/, ''));
                      }}
                      placeholder="0"
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded font-semibold text-slate-900 text-right"
                    />
                  </td>

                  {/* Discount % */}
                  <td className="py-2 px-2 text-right">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      value={item.discountPct}
                      onChange={e => {
                        const raw = e.target.value;
                        if (raw === '') { updateItemField(item.id, 'discountPct', ''); return; }
                        if (raw.includes('-')) return;
                        updateItemField(item.id, 'discountPct', raw.replace(/^0+(?=\d)/, ''));
                      }}
                      placeholder="0"
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-slate-700 text-right"
                    />
                  </td>

                  {/* Tax Rate % */}
                  <td className="py-2 px-2 text-right">
                    <select
                      value={item.taxRate}
                      onChange={e =>
                        updateItemField(item.id, 'taxRate', Number(e.target.value))
                      }
                      className="w-full px-1.5 py-1 bg-slate-50 border border-slate-200 rounded text-slate-700 text-right font-medium"
                    >
                      <option value={0}>0%</option>
                      <option value={5}>5%</option>
                      <option value={12}>12%</option>
                      <option value={18}>18%</option>
                      <option value={28}>28%</option>
                    </select>
                  </td>

                  {/* Tax Amount */}
                  <td className="py-2 px-2 text-right text-slate-600 font-medium">
                    {formatCurrency(item.taxAmt)}
                  </td>

                  {/* Row Total */}
                  <td className="py-2 px-2 text-right font-bold text-slate-900">
                    {formatCurrency(item.total)}
                  </td>

                  {/* Delete Row */}
                  <td className="py-2 px-2 text-center">
                    <button
                      type="button"
                      onClick={() => removeItemRow(item.id)}
                      disabled={items.length <= 1}
                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          </table>
        </div>

        <button
          type="button"
          onClick={addItemRow}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add Another Product Row
        </button>
      </div>

      {/* Section 3: Summary Totals & Payment Tender */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Notes & Terms */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Invoice Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Reference PO #49281, urgent project site dispatch"
              className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Terms & Conditions
            </label>
            <textarea
              rows={3}
              value={terms}
              onChange={e => setTerms(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Calculation Totals Box */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
            Invoice Summary & Settlement
          </h3>

          <div className="space-y-2 text-xs text-slate-700">
            <div className="flex justify-between">
              <span>Gross Subtotal:</span>
              <span className="font-semibold text-slate-900">{formatCurrency(subtotal)}</span>
            </div>

            {discountTotal > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Total Discount:</span>
                <span>-{formatCurrency(discountTotal)}</span>
              </div>
            )}

            <div className="flex justify-between">
              <span>CGST Output (Intra-state 50%):</span>
              <span>{formatCurrency(cgstTotal)}</span>
            </div>

            <div className="flex justify-between">
              <span>SGST Output (Intra-state 50%):</span>
              <span>{formatCurrency(sgstTotal)}</span>
            </div>

            {roundOff !== 0 && (
              <div className="flex justify-between text-slate-500">
                <span>Round Off:</span>
                <span>{roundOff > 0 ? `+${roundOff.toFixed(2)}` : roundOff.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between py-2 border-t-2 border-slate-900 text-base font-black text-slate-900">
              <span>NET PAYABLE TOTAL:</span>
              <span className="text-blue-600">{formatCurrency(roundedGrandTotal)}</span>
            </div>

            {/* Paid Amount Input */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="font-bold text-slate-800 block">Amount Received Today:</span>
                <span className="text-[10px] text-slate-400">
                  Enter ₹0 for full credit, or full amount if paid
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPaidAmount(String(roundedGrandTotal))}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold"
                >
                  Full Paid
                </button>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={paidAmount}
                  onChange={e => {
                    const raw = e.target.value;
                    if (raw === '') { setPaidAmount(''); return; }
                    if (raw.includes('-')) return;
                    setPaidAmount(raw.replace(/^0+(?=\d)/, ''));
                  }}
                  placeholder="0"
                  className="w-32 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-right text-emerald-700 text-sm focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-between text-xs font-bold text-rose-600 pt-1">
              <span>Remaining Balance to Customer Ledger:</span>
              <span>{formatCurrency(Math.max(0, roundedGrandTotal - numPaidAmount))}</span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="submit"
              disabled={isSubmitting || (!createdInvoice && items.length === 0)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs flex items-center justify-center gap-2 text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                  <span>Processing & Generating Invoice...</span>
                </>
              ) : createdInvoice ? (
                <>
                  <Printer className="w-4 h-4" />
                  <span>Print Bill (#{createdInvoice.invoiceNumber})</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Complete Billing & Print Invoice</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Invoice Preview Modal on Save */}
      <InvoicePrintModal
        invoice={createdInvoice}
        isOpen={isPrintModalOpen}
        showSuccessBanner={true}
        preventBackdropClose={true}
        closeButtonLabel="Close / Back to Billing"
        onClose={() => {
          setIsPrintModalOpen(false);
          // Requirement 6: Do not automatically navigate away after saving or printing. Return to the billing page only when the user clicks Close / Back to Billing.
          handleStartNewBill();
        }}
      />
    </form>
  );
};
