import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Printer,
  FileText,
  CheckCircle2,
  AlertCircle,
  Search,
  Plus,
  Trash2,
  Calendar,
  Save,
  Check,
  User,
  Phone,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { customerService } from '../../services/customerService';
import { supabase } from '../../lib/supabase';
import { Customer, Product } from '../../types';
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters';
import { sortProductsAZ } from '../../utils/sortUtils';

export interface BulkOrderLineItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  availableStock: number;
  quantity: number;
  unit: string;
  originalUnitPrice: number;
  discountPercent: number; // Discount (%)
  discountAmount: number;  // Discount Amount = Original Unit Price * Discount (%) / 100
  finalUnitPrice: number;  // Final Unit Price = Original Unit Price - Discount Amount
  totalAmount: number;     // Total Amount = Quantity * Final Unit Price
  taxRate: number;         // GST %
  taxAmt: number;          // GST Amount = Total Amount * Tax Rate / 100
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generateQuotationPrintHTML(
  company: any,
  billNumber: string,
  orderDate: string,
  validUntil: string,
  customerName: string,
  customerPhone: string,
  lineItems: BulkOrderLineItem[],
  summary: { subtotal: number; totalDiscount: number; gstTotal: number; grandTotal: number },
  isExpired: boolean
): string {
  const items = lineItems.filter(i => i.productName && i.productName.trim());
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title></title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      width: 100%;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 11px;
      line-height: 1.45;
      color: #0f172a;
      background: #ffffff;
      padding: 12mm 15mm;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .quotation-container {
      width: 100%;
      max-width: 100%;
      margin: 0 auto;
    }
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 14px;
      margin-bottom: 14px;
    }
    .company-title {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
      text-transform: uppercase;
    }
    .company-meta {
      font-size: 11px;
      color: #475569;
      margin-top: 4px;
      max-width: 380px;
      line-height: 1.4;
    }
    .quote-meta-box {
      text-align: right;
    }
    .badge-quotation {
      display: inline-block;
      padding: 3px 9px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background: ${isExpired ? '#fee2e2' : '#eff6ff'};
      color: ${isExpired ? '#991b1b' : '#1e40af'};
      border: 1px solid ${isExpired ? '#f87171' : '#bfdbfe'};
      margin-bottom: 6px;
    }
    .quote-num {
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
      font-family: ui-monospace, SFMono-Regular, monospace;
    }
    .quote-date {
      font-size: 11px;
      color: #475569;
      margin-top: 2px;
      font-family: ui-monospace, SFMono-Regular, monospace;
    }
    .cust-section {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 12px;
    }
    .section-label {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      margin-bottom: 3px;
    }
    .cust-name {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
    }
    .cust-phone {
      font-size: 11px;
      color: #475569;
      font-family: ui-monospace, SFMono-Regular, monospace;
      margin-top: 2px;
    }
    .notice-box {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 14px;
      font-size: 11px;
      color: #92400e;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      overflow: hidden;
    }
    th {
      background: #f1f5f9;
      color: #334155;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 7px 8px;
      border-bottom: 1px solid #cbd5e1;
    }
    td {
      padding: 7px 8px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 11px;
      color: #0f172a;
    }
    tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    tr:nth-child(even) {
      background: #f8fafc;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .mono { font-family: ui-monospace, SFMono-Regular, monospace; }
    .bold { font-weight: 700; }
    .summary-grid {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
      margin-top: 8px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .signature-area {
      width: 200px;
      padding-top: 48px;
    }
    .signature-line {
      border-bottom: 1px solid #94a3b8;
      margin-bottom: 6px;
    }
    .signature-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
    }
    .totals-card {
      width: 270px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 11px;
      color: #475569;
    }
    .totals-row.grand-total {
      margin-top: 6px;
      padding-top: 8px;
      border-top: 2px solid #cbd5e1;
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
    }
    .footer-note {
      text-align: center;
      margin-top: 24px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      font-size: 10px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="quotation-container">
    <!-- Header: Company Name & Contact Details -->
    <div class="header-row">
      <div>
        <div class="company-title">${escapeHtml(company?.name || 'UNIVERSAL ENTERPRISE ERP')}</div>
        <div class="company-meta">
          ${company?.address ? escapeHtml(company.address) + '<br/>' : ''}
          ${company?.phone ? 'Phone: ' + escapeHtml(company.phone) : ''}
          ${company?.email ? ' | Email: ' + escapeHtml(company.email) : ''}
          ${company?.gstin ? '<br/><strong>GSTIN: ' + escapeHtml(company.gstin) + '</strong>' : ''}
        </div>
      </div>
      <div class="quote-meta-box">
        <span class="badge-quotation">${isExpired ? 'QUOTATION (EXPIRED)' : 'COMMERCIAL QUOTATION'}</span>
        <div class="quote-num">${escapeHtml(billNumber)}</div>
        <div class="quote-date">Date: ${formatDate(orderDate)}</div>
        <div class="quote-date" style="color: ${isExpired ? '#dc2626' : '#2563eb'}; font-weight: 700;">
          Valid Until: ${formatDate(validUntil)}
        </div>
      </div>
    </div>

    <!-- Customer Details -->
    <div class="cust-section">
      <div class="section-label">Customer Details</div>
      <div class="cust-name">${escapeHtml(customerName || 'Valued Customer')}</div>
      ${customerPhone ? `<div class="cust-phone">Phone: ${escapeHtml(customerPhone)}</div>` : ''}
    </div>

    <!-- Quotation Validity Notice -->
    <div class="notice-box">
      <strong>Notice:</strong> &ldquo;This quotation is valid until the specified date. Prices may change after the validity period.&rdquo;
    </div>

    <!-- Product Details Table -->
    <table>
      <thead>
        <tr>
          <th style="width: 28px;" class="text-center">#</th>
          <th>Product Name</th>
          <th style="width: 50px;" class="text-center">Quantity</th>
          <th style="width: 45px;" class="text-center">Unit</th>
          <th style="width: 85px;" class="text-right">Original Unit Price</th>
          <th style="width: 65px;" class="text-center">Discount (%)</th>
          <th style="width: 80px;" class="text-right">Discount Amount</th>
          <th style="width: 80px;" class="text-right">Final Unit Price</th>
          <th style="width: 85px;" class="text-right">Total Product Amount</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item, idx) => `
          <tr>
            <td class="text-center mono" style="color: #64748b;">${idx + 1}</td>
            <td class="bold">${escapeHtml(item.productName)}</td>
            <td class="text-center mono bold">${item.quantity}</td>
            <td class="text-center">${escapeHtml(item.unit || 'Piece')}</td>
            <td class="text-right mono">₹${formatNumber(item.originalUnitPrice)}</td>
            <td class="text-center mono" style="color: #2563eb;">${item.discountPercent > 0 ? item.discountPercent + '%' : '0%'}</td>
            <td class="text-right mono" style="color: #059669; font-weight: 600;">${item.discountAmount > 0 ? '-₹' + formatNumber(item.discountAmount) : '₹0'}</td>
            <td class="text-right mono bold">₹${formatNumber(item.finalUnitPrice)}</td>
            <td class="text-right mono bold">₹${formatNumber(item.totalAmount)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- Financial Summary & Authorized Signature -->
    <div class="summary-grid">
      <div class="signature-area">
        <div class="signature-line"></div>
        <div class="signature-label">Authorized Signature</div>
      </div>
      <div class="totals-card">
        <div class="totals-row">
          <span>Subtotal:</span>
          <span class="mono bold">₹${formatNumber(summary.subtotal)}</span>
        </div>
        <div class="totals-row" style="color: #059669;">
          <span>Total Discount:</span>
          <span class="mono bold">- ₹${formatNumber(summary.totalDiscount)}</span>
        </div>
        <div class="totals-row">
          <span>GST (if applicable):</span>
          <span class="mono bold">+ ₹${formatNumber(summary.gstTotal)}</span>
        </div>
        <div class="totals-row grand-total">
          <span>Grand Total:</span>
          <span class="mono bold" style="color: #1d4ed8;">₹${formatNumber(summary.grandTotal)}</span>
        </div>
      </div>
    </div>

    <!-- Footer Note -->
    <div class="footer-note">
      Thank you for your business. For questions regarding this quotation, please contact us.
    </div>
  </div>
</body>
</html>`;
}

export interface BulkOrderBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (orderData?: any) => void;
}

export const BulkOrderBillModal: React.FC<BulkOrderBillModalProps> = ({
  isOpen,
  onClose,
  onSaved
}) => {
  const navigate = useNavigate();
  const { company, products: contextProducts, warehouses, refreshData } = useERP();

  // 1. Quotation Details: Keep only Quotation Number, Quotation Date, Valid Until
  const [billNumber, setBillNumber] = useState<string>(() => {
    const random = Math.floor(1000 + Math.random() * 9000);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `QT-${dateStr}-${random}`;
  });
  const [orderDate, setOrderDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split('T')[0];
  });

  // 2. Customer Details: Keep only Customer Name and Phone Number
  const [customersList, setCustomersList] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState<boolean>(false);

  // 3. Product Details: Table items
  const [lineItems, setLineItems] = useState<BulkOrderLineItem[]>([]);
  const [activeSearchRowId, setActiveSearchRowId] = useState<string | null>(null);

  // Feedback states
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Products from catalog
  const catalogProducts = useMemo(() => {
    return sortProductsAZ(contextProducts || []);
  }, [contextProducts]);

  // Check Expiry: Mark quotation as Expired after the validity date
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const isExpired = useMemo(() => {
    if (!validUntil) return false;
    return todayStr > validUntil;
  }, [validUntil, todayStr]);

  // Load customers & isolate document on modal open
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('quotation-modal-open');
      loadCustomers();
      if (lineItems.length === 0) {
        addLineItem();
      }
      setSaveSuccess(null);
      setErrorMessage(null);
      return () => {
        document.body.classList.remove('quotation-modal-open');
        document.body.classList.remove('quotation-print-active');
      };
    }
  }, [isOpen]);

  const loadCustomers = async () => {
    try {
      const data = await customerService.getCustomers({ limit: 100 }, company?.id);
      setCustomersList(data || []);
    } catch (err) {
      console.warn('Could not load customers for quotation modal:', err);
    }
  };

  // Customer selection helper
  const handleSelectCustomer = (cust: Customer) => {
    setSelectedCustomerId(cust.id);
    setCustomerName(cust.name || '');
    setCustomerPhone(cust.phone || '');
    setCustomerSearchQuery('');
    setIsCustomerDropdownOpen(false);
  };

  const filteredCustomers = useMemo(() => {
    const q = (customerSearchQuery || customerName || '').trim().toLowerCase();
    if (!q) return customersList.slice(0, 6);
    return customersList.filter(
      c => (c.name && c.name.toLowerCase().includes(q)) || (c.phone && c.phone.includes(q))
    ).slice(0, 6);
  }, [customersList, customerSearchQuery, customerName]);

  // 3. Add Product Line Item
  const addLineItem = (prod?: Product) => {
    const id = `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    if (prod) {
      const origPrice = Number(prod.sellingPrice || prod.retailPrice || prod.costPrice || 0);
      const taxRate = Number(prod.taxRate ?? 18);
      const qty = 1;
      const discPct = 0;
      const discAmt = 0;
      const finalUnit = origPrice;
      const totalAmt = qty * finalUnit;
      const taxAmt = (totalAmt * taxRate) / 100;

      const newItem: BulkOrderLineItem = {
        id,
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku || prod.code || '',
        availableStock: Number(prod.currentStock || 0),
        quantity: qty,
        unit: prod.primaryUnit || 'Piece',
        originalUnitPrice: origPrice,
        discountPercent: discPct,
        discountAmount: discAmt,
        finalUnitPrice: finalUnit,
        totalAmount: totalAmt,
        taxRate,
        taxAmt
      };
      setLineItems(prev => [...prev, newItem]);
    } else {
      const newItem: BulkOrderLineItem = {
        id,
        productId: '',
        productName: '',
        sku: '',
        availableStock: 0,
        quantity: 1,
        unit: 'Piece',
        originalUnitPrice: 0,
        discountPercent: 0,
        discountAmount: 0,
        finalUnitPrice: 0,
        totalAmount: 0,
        taxRate: 18,
        taxAmt: 0
      };
      setLineItems(prev => [...prev, newItem]);
    }
  };

  // 4. Update Line Item Field with Automatic Calculations
  const updateLineItem = (id: string, updates: Partial<BulkOrderLineItem>) => {
    setLineItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        const merged = { ...item, ...updates };

        const origPrice = Math.max(0, Number(merged.originalUnitPrice || 0));
        const qty = Math.max(1, Number(merged.quantity || 1));
        const discPct = Math.min(100, Math.max(0, Number(merged.discountPercent || 0)));
        const taxRate = Math.max(0, Number(merged.taxRate ?? 18));

        // Required Automatic Calculations:
        // 1. Discount Amount = Original Unit Price * Discount Percentage
        const discountAmount = Math.round(((origPrice * discPct) / 100) * 100) / 100;

        // 2. Final Unit Price = Original Unit Price - Discount Amount
        const finalUnitPrice = Math.max(0, Math.round((origPrice - discountAmount) * 100) / 100);

        // 3. Final Total = Quantity * Final Unit Price
        const totalAmount = Math.round((qty * finalUnitPrice) * 100) / 100;

        // 4. GST Amount (if applicable)
        const taxAmt = Math.round(((totalAmount * taxRate) / 100) * 100) / 100;

        return {
          ...merged,
          originalUnitPrice: origPrice,
          quantity: qty,
          discountPercent: discPct,
          discountAmount,
          finalUnitPrice,
          totalAmount,
          taxRate,
          taxAmt
        };
      })
    );
  };

  // Matching Products from Master for Autocomplete
  const getMatchingProducts = (currentText: string) => {
    const query = (currentText || '').trim().toLowerCase();
    if (!query) {
      return catalogProducts.slice(0, 8);
    }
    return catalogProducts
      .filter(p =>
        (p.name && p.name.toLowerCase().includes(query)) ||
        (p.sku && p.sku.toLowerCase().includes(query)) ||
        (p.barcode && p.barcode.includes(query))
      )
      .slice(0, 8);
  };

  // Select Product from Master
  const handleProductSelectDirect = (id: string, prod: any) => {
    const origPrice = Number(prod.sellingPrice || prod.retailPrice || prod.costPrice || 0);
    const taxRate = Number(prod.taxRate ?? 18);
    const stock = Number(prod.currentStock || 0);

    updateLineItem(id, {
      productId: prod.id,
      productName: prod.name,
      sku: prod.sku || prod.code || '',
      availableStock: stock,
      unit: prod.primaryUnit || 'Piece',
      originalUnitPrice: origPrice,
      taxRate: taxRate
    });
    setActiveSearchRowId(null);
  };

  // Typing Product Name
  const handleProductNameChange = (id: string, text: string) => {
    setActiveSearchRowId(id);
    const exactMatch = catalogProducts.find(
      p => p.name?.toLowerCase() === text.trim().toLowerCase()
    );

    if (exactMatch) {
      handleProductSelectDirect(id, exactMatch);
    } else {
      updateLineItem(id, {
        productName: text,
        productId: ''
      });
    }
  };

  // Clear or Remove Line Item
  const clearProduct = (id: string) => {
    updateLineItem(id, {
      productId: '',
      productName: '',
      sku: '',
      availableStock: 0,
      originalUnitPrice: 0,
      discountPercent: 0,
      discountAmount: 0,
      finalUnitPrice: 0,
      totalAmount: 0
    });
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length <= 1) {
      clearProduct(id);
      return;
    }
    setLineItems(prev => prev.filter(i => i.id !== id));
  };

  // 4. Live Automatic Summary Calculations
  const summary = useMemo(() => {
    let subtotal = 0;      // Original Total = sum(Quantity * Original Unit Price)
    let totalDiscount = 0; // Total Discount = sum(Quantity * Discount Amount)
    let gstTotal = 0;      // GST (if applicable) = sum(taxAmt)
    let grandTotal = 0;    // Grand Total = Subtotal - Total Discount + GST
    let totalQty = 0;

    lineItems.forEach(item => {
      const origLine = item.quantity * item.originalUnitPrice;
      const discLine = item.quantity * item.discountAmount;
      const taxLine = item.taxAmt;

      subtotal += origLine;
      totalDiscount += discLine;
      gstTotal += taxLine;
      totalQty += item.quantity;
    });

    subtotal = Math.round(subtotal * 100) / 100;
    totalDiscount = Math.round(totalDiscount * 100) / 100;
    gstTotal = Math.round(gstTotal * 100) / 100;
    grandTotal = Math.round((subtotal - totalDiscount + gstTotal) * 100) / 100;

    return {
      subtotal,
      totalDiscount,
      gstTotal,
      grandTotal,
      totalQty
    };
  }, [lineItems]);

  // 5 & 6. Handle Save (Draft or Quotation)
  const handleSave = async (isDraft: boolean) => {
    setErrorMessage(null);

    // Validation
    if (!validUntil) {
      setErrorMessage('Please specify the mandatory "Valid Until" date.');
      return;
    }

    if (!customerName.trim()) {
      setErrorMessage('Please enter customer name.');
      return;
    }

    const validItems = lineItems.filter(i => i.productName.trim() && i.quantity > 0);
    if (validItems.length === 0) {
      setErrorMessage('Please add at least one product with a valid name and quantity.');
      return;
    }

    setIsSaving(true);
    try {
      const targetCompanyId = company?.id || '00000000-0000-0000-0000-000000000001';
      // Mark as Expired after expiry date
      const orderStatus = isExpired ? 'Expired' : isDraft ? 'Draft' : 'Quotation';
      const actualDocType = 'quotation';

      // Rich JSON Metadata
      const quotationMeta = {
        docType: actualDocType,
        orderStatus,
        validUntil,
        isExpired,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        subtotal: summary.subtotal,
        totalDiscount: summary.totalDiscount,
        gstTotal: summary.gstTotal,
        grandTotal: summary.grandTotal,
        validityNotice: 'This quotation is valid until the specified date. Prices may change after the validity period.'
      };

      const metaPrefix = '<!-- UB_BULK_ORDER_META:';
      const metaSuffix = ' -->';
      const combinedNotes = `Quotation valid until ${validUntil}. Prices may change after validity period.\n${metaPrefix}${JSON.stringify(quotationMeta)}${metaSuffix}`;

      // Insert into purchases table
      const purchasePayload = {
        company_id: targetCompanyId,
        invoice_number: billNumber,
        doc_type: actualDocType,
        date: orderDate,
        due_date: validUntil,
        supplier_id: null,
        supplier_name: customerName.trim(),
        subtotal: Math.max(0, summary.subtotal - summary.totalDiscount),
        tax_total: summary.gstTotal,
        freight_charges: 0,
        other_charges: 0,
        grand_total: summary.grandTotal,
        paid_amount: 0,
        payment_status: isExpired ? 'Expired' : isDraft ? 'Draft' : 'Unpaid',
        notes: combinedNotes
      };

      const { data: purchaseData, error: purchaseError } = await supabase
        .from('purchases')
        .insert(purchasePayload)
        .select()
        .single();

      if (purchaseError || !purchaseData) {
        throw new Error(purchaseError?.message || 'Failed to save quotation.');
      }

      // Insert line items into purchase_items table
      const purchaseItemsPayload = validItems.map(item => ({
        purchase_id: purchaseData.id,
        product_id: item.productId && item.productId.length === 36 ? item.productId : null,
        product_name: item.productName.trim(),
        qty: item.quantity,
        unit: item.unit || 'Piece',
        rate: item.finalUnitPrice,
        discount: Math.round(item.quantity * item.discountAmount * 100) / 100,
        tax_rate: item.taxRate,
        tax_amt: item.taxAmt,
        total: item.totalAmount
      }));

      const { error: itemsError } = await supabase
        .from('purchase_items')
        .insert(purchaseItemsPayload);

      if (itemsError) {
        console.warn('Items insert warning:', itemsError.message);
      }

      // Auto-save new customer for fast reuse
      if (!selectedCustomerId && customerName.trim()) {
        try {
          await supabase.from('customers').insert({
            company_id: targetCompanyId,
            name: customerName.trim(),
            phone: customerPhone.trim() || null,
            customer_type: 'Retail'
          });
        } catch {}
      }

      setSaveSuccess(
        isDraft
          ? `Quotation Draft #${billNumber} saved successfully!`
          : isExpired
          ? `Quotation #${billNumber} saved (Marked as Expired).`
          : `Quotation #${billNumber} saved successfully!`
      );

      if (refreshData) {
        try {
          await refreshData();
        } catch {}
      }

      setTimeout(() => {
        if (onSaved) onSaved(purchaseData);
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error occurred while saving quotation.');
    } finally {
      setIsSaving(false);
    }
  };

  // Print Quotation Handler: prints ONLY the quotation document, completely excluding background content, then redirects to main Dashboard
  const handlePrint = () => {
    document.body.classList.add('quotation-print-active');
    const originalDocumentTitle = document.title;
    document.title = '';

    const html = generateQuotationPrintHTML(
      company,
      billNumber,
      orderDate,
      validUntil,
      customerName,
      customerPhone,
      lineItems,
      summary,
      isExpired
    );

    let redirected = false;
    const finishAndRedirect = () => {
      if (redirected) return;
      redirected = true;
      document.title = originalDocumentTitle;
      const existingIframe = document.getElementById('quotation-print-iframe');
      if (existingIframe && document.body.contains(existingIframe)) {
        document.body.removeChild(existingIframe);
      }
      document.body.classList.remove('quotation-print-active');
      onClose();
      navigate('/');
    };

    // Create an invisible iframe for reliable, 100% isolated single-document printing
    const iframe = document.createElement('iframe');
    iframe.id = 'quotation-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();

      setTimeout(() => {
        try {
          const iframeWin = iframe.contentWindow;
          if (iframeWin) {
            iframeWin.addEventListener('afterprint', finishAndRedirect, { once: true });
          }
          window.addEventListener('afterprint', finishAndRedirect, { once: true });
          iframeWin?.focus();
          iframeWin?.print();
        } catch (e) {
          console.warn('Iframe print error, falling back to window.print():', e);
          window.print();
        } finally {
          // Fallback timer: in Chromium iframe.print() blocks execution, so this runs after print dialog closes
          setTimeout(finishAndRedirect, 350);
        }
      }, 250);
    } else {
      window.print();
      setTimeout(finishAndRedirect, 350);
    }
  };

  // Cancel Handler: close modal and return to the unchanged Dashboard without saving or route change
  const handleCancel = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) handleCancel(); }}
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static print:inset-auto quotation-modal-backdrop"
    >
      {/* Modal Container */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-5xl max-h-[96vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 print:border-none print:shadow-none print:max-w-none print:max-h-none print:w-full quotation-modal-container"
      >
        
        {/* Top Header - Hidden in Print */}
        <div className="p-4 sm:px-6 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-400 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Quotation Form
                </h2>
                {isExpired ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-400/30 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Expired
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30">
                    Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Quick quotation generator with automatic pricing, discounts, and validity tracking.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback / Alert Banners */}
        {saveSuccess && (
          <div className="p-3 bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 px-6 shrink-0 print:hidden animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{saveSuccess}</span>
          </div>
        )}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2 px-6 shrink-0 print:hidden animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 print:p-0 print:overflow-visible">
          {/* Main Quotation Form - Hidden in Print */}
          <div className="space-y-5 print:hidden">
            {/* 1. Quotation Details: Keep ONLY Quotation Number, Quotation Date, Valid Until */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      1. Quotation Details
                    </h3>
                  </div>
                  {isExpired && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-rose-600" /> Quotation Expired
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Quotation Number
                    </label>
                    <input
                      type="text"
                      value={billNumber}
                      onChange={e => setBillNumber(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Quotation Date
                    </label>
                    <input
                      type="date"
                      value={orderDate}
                      onChange={e => setOrderDate(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Valid Until <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={validUntil}
                      onChange={e => setValidUntil(e.target.value)}
                      required
                      className={`w-full h-9 px-3 rounded-lg border font-mono focus:outline-none focus:ring-2 ${
                        isExpired
                          ? 'border-rose-400 bg-rose-50/50 text-rose-900 focus:ring-rose-500/20 focus:border-rose-500'
                          : 'border-slate-200 bg-white text-slate-900 focus:ring-blue-500/20 focus:border-blue-500'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* 2. Customer Details: Keep ONLY Customer Name and Phone Number */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <User className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    2. Customer Details
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                  {/* Customer Name */}
                  <div className="relative">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Customer Name <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search or enter customer name..."
                        value={customerName}
                        onChange={e => {
                          setCustomerName(e.target.value);
                          setCustomerSearchQuery(e.target.value);
                          setIsCustomerDropdownOpen(true);
                          setSelectedCustomerId('');
                        }}
                        onFocus={() => setIsCustomerDropdownOpen(true)}
                        onBlur={() => setTimeout(() => setIsCustomerDropdownOpen(false), 250)}
                        className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        required
                      />
                    </div>

                    {/* Customer Autocomplete Dropdown */}
                    {isCustomerDropdownOpen && filteredCustomers.length > 0 && (
                      <div className="absolute top-full left-0 z-40 mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden py-1 max-h-48 overflow-y-auto">
                        <div className="px-3 py-1 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Existing Customers
                        </div>
                        {filteredCustomers.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onMouseDown={e => {
                              e.preventDefault();
                              handleSelectCustomer(c);
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors flex items-center justify-between text-xs cursor-pointer border-b border-slate-50 last:border-0"
                          >
                            <span className="font-semibold text-slate-800">{c.name}</span>
                            {c.phone && (
                              <span className="text-slate-500 font-mono text-[11px]">{c.phone}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Phone Number */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        placeholder="+91 98765 43210"
                        value={customerPhone}
                        onChange={e => setCustomerPhone(e.target.value)}
                        className="w-full h-9 pl-8 pr-3 rounded-lg border border-slate-200 bg-white text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Product Details Table */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      3. Product Details
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => addLineItem()}
                    className="h-8 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Product</span>
                  </button>
                </div>

                {/* Table */}
                <div className="border border-slate-200 rounded-xl overflow-x-auto min-h-[180px]">
                  <table className="w-full text-left text-xs min-w-[760px]">
                    <thead className="bg-slate-100 text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3 w-8 text-center font-bold">#</th>
                        <th className="py-2.5 px-3 min-w-[220px] font-bold">Product Name</th>
                        <th className="py-2.5 px-2 text-center w-20 font-bold">Quantity</th>
                        <th className="py-2.5 px-2 text-center w-20 font-bold">Unit</th>
                        <th className="py-2.5 px-2 text-right w-28 font-bold">Original Unit Price</th>
                        <th className="py-2.5 px-2 text-center w-24 font-bold">Discount (%)</th>
                        <th className="py-2.5 px-2 text-right w-28 font-bold">Discount Amount</th>
                        <th className="py-2.5 px-2 text-right w-28 font-bold">Final Unit Price</th>
                        <th className="py-2.5 px-3 text-right w-28 font-bold">Total Amount</th>
                        <th className="py-2.5 px-2 text-center w-12 font-bold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lineItems.map((item, idx) => {
                        const matchingProds = getMatchingProducts(item.productName);
                        const isSearchOpen = activeSearchRowId === item.id;

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                            {/* # */}
                            <td className="py-2.5 px-3 text-center font-mono text-slate-400 font-bold">
                              {idx + 1}
                            </td>

                            {/* 1. Product Name (Searchable from Product Master) */}
                            <td className="py-2.5 px-3 relative">
                              <div className="relative">
                                <div className="relative flex items-center">
                                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                                  <input
                                    type="text"
                                    value={item.productName}
                                    onChange={e => handleProductNameChange(item.id, e.target.value)}
                                    onFocus={() => setActiveSearchRowId(item.id)}
                                    onBlur={() => setTimeout(() => setActiveSearchRowId(null), 250)}
                                    placeholder="Select from Product Master or type..."
                                    className="w-full h-8 pl-8 pr-7 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                  />
                                  {item.productName && (
                                    <button
                                      type="button"
                                      onClick={() => clearProduct(item.id)}
                                      className="absolute right-2 p-0.5 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                                      title="Clear product"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>

                                {/* Autocomplete Dropdown */}
                                {isSearchOpen && (
                                  <div className="absolute top-full left-0 z-50 mt-1 w-full min-w-[300px] max-w-[400px] bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden py-1 max-h-52 overflow-y-auto">
                                    <div className="px-3 py-1 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex justify-between items-center">
                                      <span>Product Master Catalog</span>
                                      <span>{matchingProds.length} matches</span>
                                    </div>
                                    {matchingProds.length > 0 ? (
                                      matchingProds.map(p => (
                                        <button
                                          key={p.id}
                                          type="button"
                                          onMouseDown={e => {
                                            e.preventDefault();
                                            handleProductSelectDirect(item.id, p);
                                          }}
                                          className="w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors border-b border-slate-50 last:border-0 flex items-center justify-between gap-2 group cursor-pointer"
                                        >
                                          <div className="min-w-0 flex-1">
                                            <div className="font-semibold text-xs text-slate-900 group-hover:text-blue-700 truncate">
                                              {p.name}
                                            </div>
                                            <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                                              {p.primaryUnit && <span>Unit: {p.primaryUnit}</span>}
                                              {p.currentStock !== undefined && (
                                                <span className={p.currentStock > 0 ? 'text-emerald-600' : 'text-slate-400'}>
                                                  Stock: {p.currentStock}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                          <div className="text-right shrink-0">
                                            <span className="font-mono font-bold text-xs text-slate-900 block">
                                              ₹{formatNumber(p.sellingPrice || p.retailPrice || p.costPrice || 0)}
                                            </span>
                                          </div>
                                        </button>
                                      ))
                                    ) : (
                                      <div className="p-3 text-center text-xs text-slate-500">
                                        No master product found. You can enter unit and price manually.
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* 2. Quantity */}
                            <td className="py-2.5 px-2 text-center">
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={e => updateLineItem(item.id, { quantity: Number(e.target.value) })}
                                className="w-18 h-8 px-2 text-center font-mono font-bold text-xs rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              />
                            </td>

                            {/* 3. Unit */}
                            <td className="py-2.5 px-2 text-center">
                              <input
                                type="text"
                                value={item.unit}
                                onChange={e => updateLineItem(item.id, { unit: e.target.value })}
                                placeholder="Piece"
                                className="w-16 h-8 px-1 text-center font-medium text-xs rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              />
                            </td>

                            {/* 4. Original Unit Price (Auto-fetched from Product Master) */}
                            <td className="py-2.5 px-2 text-right">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.originalUnitPrice || ''}
                                onChange={e => updateLineItem(item.id, { originalUnitPrice: Number(e.target.value) })}
                                placeholder="0.00"
                                className="w-24 h-8 px-2 text-right font-mono font-semibold text-xs rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              />
                            </td>

                            {/* 5. Discount (%) */}
                            <td className="py-2.5 px-2 text-center">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                value={item.discountPercent || ''}
                                onChange={e => updateLineItem(item.id, { discountPercent: Number(e.target.value) })}
                                placeholder="0"
                                className="w-18 h-8 px-2 text-center font-mono font-bold text-xs rounded-lg border border-slate-200 text-blue-700 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              />
                            </td>

                            {/* 6. Discount Amount (Auto-calculated: Original Unit Price * Discount %) */}
                            <td className="py-2.5 px-2 text-right">
                              <span className="font-mono font-semibold text-emerald-600 block text-xs">
                                ₹{formatNumber(item.discountAmount)}
                              </span>
                            </td>

                            {/* 7. Final Unit Price (Auto-calculated: Original Unit Price - Discount Amount) */}
                            <td className="py-2.5 px-2 text-right">
                              <span className="font-mono font-bold text-slate-900 block text-xs">
                                ₹{formatNumber(item.finalUnitPrice)}
                              </span>
                            </td>

                            {/* 8. Total Amount (Auto-calculated: Quantity * Final Unit Price) */}
                            <td className="py-2.5 px-3 text-right">
                              <span className="font-mono font-bold text-blue-600 block text-xs">
                                ₹{formatNumber(item.totalAmount)}
                              </span>
                            </td>

                            {/* 9. Action (Remove Product) */}
                            <td className="py-2.5 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => removeLineItem(item.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Remove Product"
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
              </div>

              {/* 4 & 5. Automatic Calculations Display & Quotation Validity */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 5. Quotation Validity Notice */}
                <div className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 ${
                  isExpired
                    ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                    : 'bg-amber-50/70 border-amber-200 text-amber-900'
                }`}>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock className={`w-4 h-4 shrink-0 ${isExpired ? 'text-rose-600' : 'text-amber-600'}`} />
                      <h4 className="text-xs font-bold uppercase tracking-wider">
                        {isExpired ? 'Quotation Expired' : 'Quotation Validity Notice'}
                      </h4>
                    </div>
                    <p className="text-xs leading-relaxed font-medium">
                      &ldquo;This quotation is valid until the specified date. Prices may change after the validity period.&rdquo;
                    </p>
                  </div>

                  <div className="pt-2 border-t border-amber-200/60 text-xs font-mono flex items-center justify-between">
                    <span className="text-slate-600">Validity Expiry Date:</span>
                    <span className={`font-bold ${isExpired ? 'text-rose-700' : 'text-amber-800'}`}>
                      {validUntil ? formatDate(validUntil) : 'Not specified'} {isExpired ? '(EXPIRED)' : ''}
                    </span>
                  </div>
                </div>

                {/* 4. Live Automatic Summary */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/80 shadow-2xs space-y-2.5 text-xs">
                  <h3 className="text-xs font-bold text-slate-800 border-b border-slate-200 pb-2 flex items-center justify-between">
                    <span>Summary</span>
                    <span className="text-[11px] text-slate-500 font-mono font-normal">
                      Items: {lineItems.filter(i => i.productName.trim()).length} ({summary.totalQty} total qty)
                    </span>
                  </h3>

                  <div className="space-y-2 pt-1 text-slate-700 font-medium">
                    {/* Subtotal (Quantity * Original Unit Price) */}
                    <div className="flex justify-between items-center">
                      <span>Subtotal:</span>
                      <span className="font-mono text-slate-900 font-semibold">
                        ₹{formatNumber(summary.subtotal)}
                      </span>
                    </div>

                    {/* Total Discount */}
                    <div className="flex justify-between items-center text-emerald-600 font-semibold">
                      <span>Total Discount:</span>
                      <span className="font-mono">- ₹{formatNumber(summary.totalDiscount)}</span>
                    </div>

                    {/* GST (if applicable) */}
                    <div className="flex justify-between items-center">
                      <span>GST (if applicable):</span>
                      <span className="font-mono text-slate-800">+ ₹{formatNumber(summary.gstTotal)}</span>
                    </div>

                    {/* Grand Total */}
                    <div className="flex justify-between items-center p-3 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-xs mt-2">
                      <span className="tracking-tight uppercase text-xs font-bold text-blue-100">
                        Grand Total:
                      </span>
                      <span className="font-mono text-base font-bold">
                        ₹{formatNumber(summary.grandTotal)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* DEDICATED PROFESSIONAL A4 QUOTATION PRINT DOCUMENT */}
            <div id="quotation-print-container" className="hidden print:block quotation-print-document bg-white p-6 sm:p-8 text-slate-900 space-y-6 print:border-none print:p-0 print:m-0 print:max-w-none">
              
              {/* Document Header: Company Details & Quotation Number/Date */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5">
                <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                    {company?.name || 'UNIVERSAL ENTERPRISE ERP'}
                  </h1>
                  <p className="text-xs text-slate-600 mt-1 max-w-sm leading-relaxed">
                    {company?.address || 'Industrial Area Phase 2, Mumbai, MH - 400001'}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Phone: {company?.phone || '+91 98765 00000'} | Email: {company?.email || 'sales@universalbilling.com'}
                  </p>
                  {company?.gstin && (
                    <p className="text-xs font-mono font-bold text-slate-800 mt-1">
                      GSTIN: {company.gstin}
                    </p>
                  )}
                </div>

                <div className="text-right">
                  <span className={`inline-block px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border mb-2 ${
                    isExpired
                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                      : 'bg-blue-100 text-blue-800 border-blue-200'
                  }`}>
                    {isExpired ? 'QUOTATION (EXPIRED)' : 'COMMERCIAL QUOTATION'}
                  </span>
                  <div className="text-xs space-y-0.5 font-mono">
                    <p className="font-bold text-slate-900 text-sm">
                      {billNumber}
                    </p>
                    <p className="text-slate-600">Date: {formatDate(orderDate)}</p>
                    <p className={`font-bold ${isExpired ? 'text-rose-700' : 'text-blue-700'}`}>
                      Valid Until: {formatDate(validUntil)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Customer Details */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Customer Details
                </span>
                <p className="font-bold text-slate-900 text-sm">{customerName || 'Valued Customer'}</p>
                {customerPhone && <p className="text-slate-600 mt-0.5 font-mono">Phone: {customerPhone}</p>}
              </div>

              {/* Quotation Validity Notice */}
              <div className="p-3 rounded-lg bg-amber-50/80 border border-amber-200 text-amber-900 text-xs">
                <p className="font-semibold">Notice:</p>
                <p className="text-[11px] mt-0.5">
                  &ldquo;This quotation is valid until the specified date. Prices may change after the validity period.&rdquo;
                </p>
              </div>

              {/* Product Details Table */}
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-[10px] font-bold text-slate-700 uppercase tracking-wider border-b border-slate-300">
                    <tr>
                      <th className="py-2.5 px-3 w-8 text-center">#</th>
                      <th className="py-2.5 px-3">Product Name</th>
                      <th className="py-2.5 px-2 text-center w-20">Quantity</th>
                      <th className="py-2.5 px-2 text-center w-16">Unit</th>
                      <th className="py-2.5 px-2 text-right w-24">Original Unit Price</th>
                      <th className="py-2.5 px-2 text-center w-20">Discount (%)</th>
                      <th className="py-2.5 px-2 text-right w-24">Discount Amount</th>
                      <th className="py-2.5 px-2 text-right w-24">Final Unit Price</th>
                      <th className="py-2.5 px-3 text-right w-28">Total Product Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {lineItems
                      .filter(i => i.productName && i.productName.trim())
                      .map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 print-avoid-break">
                          <td className="py-2 px-3 text-center font-mono text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-900">
                            {item.productName}
                          </td>
                          <td className="py-2 px-2 text-center font-mono font-bold">
                            {item.quantity}
                          </td>
                          <td className="py-2 px-2 text-center text-slate-700">
                            {item.unit}
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-slate-700">
                            ₹{formatNumber(item.originalUnitPrice)}
                          </td>
                          <td className="py-2 px-2 text-center font-mono text-blue-700">
                            {item.discountPercent > 0 ? `${item.discountPercent}%` : '0%'}
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-emerald-600 font-semibold">
                            {item.discountAmount > 0 ? `-₹${formatNumber(item.discountAmount)}` : '₹0'}
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">
                            ₹{formatNumber(item.finalUnitPrice)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                            ₹{formatNumber(item.totalAmount)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Summary & Authorized Signature */}
              <div className="grid grid-cols-2 gap-6 pt-3 print-avoid-break">
                <div className="text-xs space-y-3">
                  <div className="pt-14">
                    <div className="w-48 border-b border-slate-400 mb-1.5"></div>
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                      Authorized Signature
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-mono font-semibold text-slate-900">₹{formatNumber(summary.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Total Discount:</span>
                    <span className="font-mono">- ₹{formatNumber(summary.totalDiscount)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>GST (if applicable):</span>
                    <span className="font-mono">+ ₹{formatNumber(summary.gstTotal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-bold text-slate-900 p-2.5 rounded-lg bg-white border border-slate-200 shadow-2xs mt-1">
                    <span>Grand Total:</span>
                    <span className="font-mono text-base text-blue-700 font-bold">
                      ₹{formatNumber(summary.grandTotal)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Thank You Note */}
              <div className="text-center pt-4 border-t border-slate-200 text-xs text-slate-400">
                Thank you for your business. For questions regarding this quotation, please contact us.
              </div>
            </div>
        </div>

        {/* Bottom Actions: Keep ONLY Print Quotation and Cancel */}
        <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden">
          <div>
            <button
              type="button"
              onClick={handlePrint}
              className="h-9 px-4 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/90 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print Quotation</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleCancel}
              className="h-9 px-4 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/90 rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
            >
              Cancel
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
