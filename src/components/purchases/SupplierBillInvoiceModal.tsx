import React, { useEffect } from 'react';
import { X, Printer, FileText, CheckCircle2, Clock } from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { PurchaseInvoice, CompanyProfile, Supplier, PaymentRecord } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface SupplierBillInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  bill: PurchaseInvoice | null;
  payment?: any | null;
}

/**
 * Generates standalone, pixel-perfect A4 Purchase Invoice HTML for clean browser printing.
 */
function generatePurchaseInvoiceHTML(
  bill: PurchaseInvoice,
  company: CompanyProfile | null | undefined,
  supplierRecord: Supplier | undefined,
  linkedPayment: PaymentRecord | undefined
): string {
  const companyName = company?.companyName || company?.name || 'Universal Billing Platform';
  const companyLogo = company?.logo;
  const companyAddressParts = [
    company?.address,
    company?.city,
    company?.state,
    company?.pincode
  ].filter(Boolean);
  const companyAddressStr = companyAddressParts.length > 0 ? companyAddressParts.join(', ') : 'Corporate Office';
  const companyPhone = company?.phone || '';
  const companyEmail = company?.email || '';
  const companyGstin = company?.gstin || '';
  const companyTerms =
    company?.termsAndConditions ||
    '1. All goods received are verified against purchase order specifications.\n2. Payment terms are subject to mutually agreed billing terms and invoice verification.\n3. Discrepancies, if any, must be reported within 7 business days.';

  const supplierName = bill.supplierName;
  const supplierAddress = supplierRecord?.address || '—';
  const supplierPhone = supplierRecord?.phone || '—';
  const supplierGstin = bill.supplierGstin || supplierRecord?.gstin || '';

  const grandTotal = Number(bill.grandTotal || 0);
  const alreadyPaid = Number(bill.paidAmount || 0);
  const balanceDue = Math.max(0, grandTotal - alreadyPaid);

  const isCompleted = bill.paymentStatus === 'Paid' || (alreadyPaid >= grandTotal && grandTotal > 0);
  const isPartial = !isCompleted && (bill.paymentStatus === 'Partially Paid' || alreadyPaid > 0);
  const statusLabel = isCompleted ? 'COMPLETED' : isPartial ? 'PARTIALLY PAID' : 'PENDING';
  const statusBadgeClass = isCompleted ? 'badge-completed' : isPartial ? 'badge-partial' : 'badge-pending';

  const cleanNotes = (bill.notes || 'Goods received and accepted in store inventory with verified purchase costs and tax itemization.').replace(/PO\s+PO-/gi, 'PO-');
  const cleanTerms = companyTerms;

  const now = new Date();
  const formattedPrintDate =
    now.toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: '2-digit'
    }) +
    ', ' +
    now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

  const itemsRows = (bill.items || []).map((it, idx) => {
    const ord = it.orderedQty !== undefined ? it.orderedQty : it.qty;
    const recv = it.receivedQty !== undefined ? it.receivedQty : it.qty;
    const rate = Number(it.rate) || 0;
    const totalCost = recv * rate;
    const taxRate = Number(it.taxRate) || 0;
    const taxAmt = it.taxAmt !== undefined ? Number(it.taxAmt) : (totalCost * taxRate) / 100;
    const lineTotal = it.total !== undefined ? Number(it.total) : totalCost + taxAmt;

    return `
      <tr>
        <td class="text-center font-mono" style="color: #64748b;">${idx + 1}</td>
        <td class="text-left" style="padding-left: 8px;">
          <div style="font-weight: 700; color: #0f172a;">${it.productName}</div>
          ${it.isUnregistered ? '<span style="font-size: 8px; color: #7e22ce; font-family: monospace; font-weight: 600;">PO Only</span>' : ''}
        </td>
        <td class="text-center font-mono" style="color: #64748b;">${ord}</td>
        <td class="text-center font-mono" style="font-weight: 700; color: #0f172a;">${recv}</td>
        <td class="text-center" style="color: #475569; font-weight: 600;">${it.unit || 'PCS'}</td>
        <td class="text-right font-mono" style="padding-right: 8px; color: #334155;">${formatCurrency(rate)}</td>
        <td class="text-right font-mono" style="padding-right: 8px; font-weight: 700; color: #0f172a;">${formatCurrency(totalCost)}</td>
        <td class="text-center font-mono" style="color: #475569;">${taxRate}%</td>
        <td class="text-right font-mono" style="padding-right: 8px; color: #334155;">${formatCurrency(taxAmt)}</td>
        <td class="text-right font-mono" style="padding-right: 8px; font-weight: 800; color: #0f172a;">${formatCurrency(lineTotal)}</td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>&nbsp;</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 10mm 14mm 12mm 14mm;
      background: #ffffff;
      color: #0f172a;
      font-size: 11px;
      line-height: 1.4;
    }
    .invoice-container {
      width: 100%;
      max-width: 210mm;
      margin: 0 auto;
      background: #ffffff;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .title {
      font-size: 22px;
      font-weight: 900;
      letter-spacing: 1px;
      color: #0f172a;
      text-transform: uppercase;
      margin: 0 0 6px 0;
      line-height: 1.2;
    }
    .two-col-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 12px 0;
      margin-bottom: 14px;
    }
    .card-box {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 10px 14px;
      vertical-align: top;
      width: 50%;
    }
    .card-title {
      font-size: 9px;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      border: 1px solid #cbd5e1;
    }
    .data-table th {
      background: #f8fafc;
      color: #0f172a;
      font-weight: 800;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      padding: 8px 10px;
      border: 1px solid #cbd5e1;
      vertical-align: middle;
    }
    .data-table td {
      padding: 8px 10px;
      border: 1px solid #e2e8f0;
      font-size: 10.5px;
      vertical-align: middle;
    }
    .text-center { text-align: center !important; }
    .text-right { text-align: right !important; }
    .text-left { text-align: left !important; }
    .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .badge-completed {
      background: #dcfce7;
      color: #14532d;
      border: 1px solid #86efac;
    }
    .badge-pending {
      background: #fef3c7;
      color: #78350f;
      border: 1px solid #fde68a;
    }
    .badge-partial {
      background: #dbeafe;
      color: #1e3a8a;
      border: 1px solid #bfdbfe;
    }
    .avoid-break {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .sig-line {
      border-bottom: 1.5px solid #64748b;
      height: 42px;
      width: 200px;
      margin: 0 auto 8px auto;
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <!-- 0. Top Meta Header Bar: Date/Time at Top-Left Corner -->
    <div style="margin-bottom: 10px; font-size: 10px; color: #64748b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <span style="font-weight: 500; color: #475569;">${formattedPrintDate}</span>
    </div>

    <!-- 1. Header: Company Details & Invoice Title -->
    <table class="header-table">
      <tr>
        <td style="vertical-align: middle; width: 58%;">
          ${companyLogo ? `<img src="${companyLogo}" alt="${companyName}" style="max-height: 48px; max-width: 180px; object-fit: contain; margin-bottom: 6px; display: block;" />` : ''}
          <div style="font-size: 17px; font-weight: 900; letter-spacing: 0.3px; text-transform: uppercase; color: #0f172a; margin-bottom: 3px; line-height: 1.2;">
            ${companyName}
          </div>
          <div style="font-size: 10.5px; color: #475569; max-width: 420px; line-height: 1.35;">
            ${companyAddressStr}
          </div>
          ${(companyPhone || companyEmail || companyGstin) ? `
          <div style="font-size: 10px; color: #64748b; margin-top: 4px; line-height: 1.3;">
            ${companyPhone ? `<span><strong>Phone:</strong> ${companyPhone}</span>` : ''}
            ${companyPhone && companyEmail ? `<span style="margin: 0 6px; color: #cbd5e1;">|</span>` : ''}
            ${companyEmail ? `<span><strong>Email:</strong> ${companyEmail}</span>` : ''}
            ${(companyPhone || companyEmail) && companyGstin ? `<span style="margin: 0 6px; color: #cbd5e1;">|</span>` : ''}
            ${companyGstin ? `<span><strong>GSTIN:</strong> ${companyGstin}</span>` : ''}
          </div>` : ''}
        </td>
        <td style="text-align: right; vertical-align: middle; width: 42%;">
          <div class="title" style="margin: 0;">PURCHASE INVOICE</div>
        </td>
      </tr>
    </table>

    <!-- 2. Supplier & Invoice Information (Two-Column Layout) -->
    <table class="two-col-table">
      <tr>
        <td class="card-box" style="width: 50%; vertical-align: top;">
          <div class="card-title">Supplier Details</div>
          <table style="width: 100%; font-size: 10.5px; border-collapse: collapse;">
            <tr>
              <td style="color: #64748b; padding: 3px 0; width: 90px;">Supplier Name:</td>
              <td style="font-weight: 800; color: #0f172a;">${supplierName}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 3px 0; vertical-align: top;">Address:</td>
              <td style="color: #334155; line-height: 1.35;">${supplierAddress}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 3px 0;">Phone:</td>
              <td style="font-weight: 600; color: #334155;">${supplierPhone}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 3px 0;">GSTIN:</td>
              <td class="font-mono" style="font-weight: 700; color: #0f172a;">${supplierGstin || '—'}</td>
            </tr>
          </table>
        </td>
        <td class="card-box" style="width: 50%; vertical-align: top;">
          <div class="card-title">Invoice Details</div>
          <table style="width: 100%; font-size: 10.5px; border-collapse: collapse;">
            <tr>
              <td style="color: #64748b; padding: 3px 0; width: 135px;">Supplier Invoice Number:</td>
              <td class="font-mono text-right" style="font-weight: 800; color: #0f172a;">${bill.supplierInvoiceNumber || bill.invoiceNumber}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 3px 0;">Purchase Order Number:</td>
              <td class="font-mono text-right" style="font-weight: 700; color: #7e22ce;">${bill.purchaseOrderNumber || '—'}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 3px 0;">Invoice Date:</td>
              <td class="text-right" style="font-weight: 600; color: #0f172a;">${formatDate(bill.date)}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 3px 0;">Destination Warehouse:</td>
              <td class="text-right" style="font-weight: 600; color: #0f172a;">${bill.warehouse || 'Main Warehouse'}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- 3. Product Details Table (Clean 10 Columns with Ordered & Received Qty) -->
    <table class="data-table">
      <thead>
        <tr>
          <th class="text-center" style="width: 32px;">S.No</th>
          <th class="text-left" style="padding-left: 8px;">Product Name</th>
          <th class="text-center" style="width: 65px;">Ordered Qty</th>
          <th class="text-center" style="width: 65px;">Received Qty</th>
          <th class="text-center" style="width: 48px;">Unit</th>
          <th class="text-right" style="width: 80px; padding-right: 8px;">Cost / Item</th>
          <th class="text-right" style="width: 80px; padding-right: 8px;">Total Cost</th>
          <th class="text-center" style="width: 50px;">GST %</th>
          <th class="text-right" style="width: 80px; padding-right: 8px;">GST Amount</th>
          <th class="text-right" style="width: 88px; padding-right: 8px;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <!-- 4. Payment Details & Bill Summary (Balanced & Symmetrical) -->
    <table class="two-col-table avoid-break">
      <tr>
        <td class="card-box" style="width: 50%; vertical-align: top;">
          <div class="card-title">Payment Details</div>
          <table style="width: 100%; font-size: 10.5px; border-collapse: collapse;">
            <tr>
              <td style="color: #64748b; padding: 4px 0;">Payment Status:</td>
              <td class="text-right" style="padding: 4px 0;">
                <span class="status-badge ${statusBadgeClass}">${statusLabel}</span>
              </td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 4px 0;">Payment Method:</td>
              <td class="text-right" style="font-weight: 600; color: #334155; padding: 4px 0;">${linkedPayment?.paymentMethod || 'Bank Transfer'}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 4px 0;">Amount Paid:</td>
              <td class="font-mono text-right" style="font-weight: 700; color: #15803d; padding: 4px 0;">${formatCurrency(alreadyPaid)}</td>
            </tr>
            <tr style="border-top: 1.5px solid #0f172a;">
              <td style="font-weight: 900; font-size: 11px; text-transform: uppercase; padding: 7px 0 2px 0; color: #0f172a;">Balance Due:</td>
              <td class="font-mono text-right" style="font-weight: 900; font-size: 13px; padding: 7px 0 2px 0; color: #b45309;">${formatCurrency(balanceDue)}</td>
            </tr>
          </table>
          ${(isCompleted || alreadyPaid > 0) ? `
            <div style="font-size: 9.5px; color: #64748b; text-align: right; margin-top: 4px;">
              Payment Date: <span class="font-mono" style="color: #334155;">${formatDate(linkedPayment?.date || bill.dueDate || bill.date)}</span>
            </div>
          ` : ''}
        </td>

        <td class="card-box" style="width: 50%; vertical-align: top;">
          <div class="card-title">Bill Summary</div>
          <table style="width: 100%; font-size: 10.5px; border-collapse: collapse;">
            <tr>
              <td style="color: #64748b; padding: 4px 0;">Subtotal (Before GST):</td>
              <td class="font-mono text-right" style="font-weight: 600; color: #334155; padding: 4px 0;">${formatCurrency(bill.subtotal)}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 4px 0;">Total GST:</td>
              <td class="font-mono text-right" style="font-weight: 600; color: #334155; padding: 4px 0;">${formatCurrency(bill.taxTotal)}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 4px 0;">Additional Charges:</td>
              <td class="font-mono text-right" style="font-weight: 600; color: #334155; padding: 4px 0;">${formatCurrency(bill.otherCharges || bill.freightCharges || 0)}</td>
            </tr>
            <tr style="border-top: 1.5px solid #0f172a;">
              <td style="font-weight: 900; font-size: 11px; text-transform: uppercase; padding: 7px 0 2px 0; color: #0f172a;">Grand Total:</td>
              <td class="font-mono text-right" style="font-weight: 900; font-size: 13px; padding: 7px 0 2px 0; color: #0f172a;">${formatCurrency(grandTotal)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- 5. Footer: Terms, Notes & Signatures -->
    <div class="footer-section avoid-break">
      <table class="two-col-table avoid-break" style="margin-top: 14px;">
        <tr>
          <td class="card-box" style="width: 50%; vertical-align: top;">
            <div class="card-title">Terms & Conditions</div>
            <div style="font-size: 9.5px; color: #475569; line-height: 1.45; white-space: pre-line;">${cleanTerms}</div>
          </td>
          <td class="card-box" style="width: 50%; vertical-align: top;">
            <div class="card-title">Notes / Remarks</div>
            <div style="font-size: 9.5px; color: #475569; line-height: 1.45;">${cleanNotes}</div>
          </td>
        </tr>
      </table>

      <!-- Signatures -->
      <table style="width: 100%; border-collapse: collapse; margin-top: 32px;">
        <tr>
          <td style="width: 50%; text-align: center; vertical-align: bottom;">
            <div class="sig-line"></div>
            <div style="font-size: 11px; font-weight: 700; color: #0f172a;">Supplier / Carrier Signature</div>
            <div style="font-size: 9.5px; color: #64748b; margin-top: 2px;">Authorized Delivery Representative</div>
          </td>
          <td style="width: 50%; text-align: center; vertical-align: bottom;">
            <div class="sig-line"></div>
            <div style="font-size: 11px; font-weight: 700; color: #0f172a;">Authorized Signature</div>
            <div style="font-size: 9.5px; color: #64748b; margin-top: 2px;">For ${companyName}</div>
          </td>
        </tr>
      </table>

      <div style="text-align: center; margin-top: 22px; font-size: 9.5px; color: #94a3b8; letter-spacing: 0.3px;">
        This is a computer-generated Purchase Invoice.
      </div>
    </div>
  </div>
</body>
</html>`;
}

export const SupplierBillInvoiceModal: React.FC<SupplierBillInvoiceModalProps> = ({
  isOpen,
  onClose,
  bill,
  payment
}) => {
  const { company, suppliers = [], payments = [] } = useERP();

  // Isolate document in print mode: hides sidebar, header, nav, dashboard
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('invoice-modal-open');
      return () => {
        document.body.classList.remove('invoice-modal-open');
      };
    }
  }, [isOpen]);

  if (!isOpen || !bill) return null;

  // Resolve linked Supplier record
  const supplierRecord = suppliers.find(
    s => s.id === bill.supplierId || (s.name && s.name.toLowerCase() === bill.supplierName?.toLowerCase())
  );

  // Resolve linked payment record
  const linkedPayment =
    payment ||
    payments.find(
      p => p.invoiceId === bill.id || (p.reference && bill.invoiceNumber && p.reference.includes(bill.invoiceNumber))
    );

  const grandTotal = Number(bill.grandTotal || 0);
  const alreadyPaid = Number(bill.paidAmount || 0);
  const balanceDue = Math.max(0, grandTotal - alreadyPaid);
  const isCompleted = bill.paymentStatus === 'Paid' || (alreadyPaid >= grandTotal && grandTotal > 0);
  const isPartial = !isCompleted && (bill.paymentStatus === 'Partially Paid' || alreadyPaid > 0);

  const supplierName = bill.supplierName;
  const supplierAddress = supplierRecord?.address || '—';
  const supplierPhone = supplierRecord?.phone || '—';
  const supplierGstin = bill.supplierGstin || supplierRecord?.gstin || '';

  const companyName = company?.companyName || company?.name || 'Universal Billing Platform';
  const companyLogo = company?.logo;
  const companyAddressParts = [
    company?.address,
    company?.city,
    company?.state,
    company?.pincode
  ].filter(Boolean);
  const companyAddressStr = companyAddressParts.length > 0 ? companyAddressParts.join(', ') : 'Corporate Office';
  const companyPhone = company?.phone || '';
  const companyEmail = company?.email || '';
  const companyGstin = company?.gstin || '';
  const companyTerms =
    company?.termsAndConditions ||
    '1. All goods received are verified against purchase order specifications.\n2. Payment terms are subject to mutually agreed billing terms and invoice verification.\n3. Discrepancies, if any, must be reported within 7 business days.';

  const now = new Date();
  const formattedPrintDate =
    now.toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: '2-digit'
    }) +
    ', ' +
    now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

  /**
   * Primary Print Bill Trigger:
   * Uses an isolated hidden iframe with self-contained A4 styling.
   * Completely immune to parent CSS, dark-mode, or layout clipping.
   */
  const handlePrint = () => {
    const html = generatePurchaseInvoiceHTML(bill, company, supplierRecord, linkedPayment);

    // Create an invisible iframe for reliable, isolated printing
    const iframe = document.createElement('iframe');
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
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.warn('Iframe print error, falling back to window.print():', e);
          window.print();
        } finally {
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 3000);
        }
      }, 300);
    } else {
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn overflow-y-auto invoice-modal-backdrop">
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            height: auto !important;
            overflow: visible !important;
          }
          .no-print {
            display: none !important;
          }
          .invoice-modal-backdrop {
            position: static !important;
            inset: auto !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            overflow: visible !important;
            display: block !important;
            width: 100% !important;
            height: auto !important;
          }
          .invoice-modal-container {
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
          }
          .purchase-invoice-screen-view {
            display: none !important;
          }
          .purchase-invoice-print-document {
            display: block !important;
            width: 100% !important;
            background: #ffffff !important;
            color: #111827 !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .print-avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="invoice-modal-container bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl my-auto overflow-hidden flex flex-col max-h-[94vh] print:max-h-none print:h-auto print:shadow-none print:border-none print:m-0 print:p-0 print:max-w-none print:rounded-none">
        {/* ========================================================= */}
        {/* SCREEN ACTION BAR (Top Control Header - Hidden in Print)  */}
        {/* ========================================================= */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/50 no-print">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Purchase Invoice</span>
                <span className="font-mono text-xs font-bold text-purple-600 dark:text-purple-400">
                  #{bill.supplierInvoiceNumber || bill.invoiceNumber}
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* ON-SCREEN MODAL PREVIEW (Hidden during Print)            */}
        {/* ========================================================= */}
        <div className="purchase-invoice-screen-view p-6 sm:p-8 overflow-y-auto flex-1 space-y-6 text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 no-print">
          {/* Header with Company Information & Invoice Metadata */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
            <div>
              {companyLogo && (
                <img
                  src={companyLogo}
                  alt={companyName}
                  className="h-10 max-w-[160px] object-contain mb-2"
                />
              )}
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {companyName}
              </h1>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                {companyAddressStr}
              </p>
              {companyGstin && (
                <p className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-400 mt-0.5">
                  GSTIN: {companyGstin}
                </p>
              )}
              {(companyPhone || companyEmail) && (
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {[companyPhone && `Phone: ${companyPhone}`, companyEmail && `Email: ${companyEmail}`].filter(Boolean).join(' | ')}
                </p>
              )}
            </div>

            <div className="sm:text-right">
              <span className="inline-block px-3 py-1 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-bold text-xs uppercase tracking-wider mb-2">
                PURCHASE INVOICE
              </span>
              <div className="space-y-0.5 font-mono text-xs">
                <div>
                  <span className="text-slate-400">Supplier Invoice Number: </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {bill.supplierInvoiceNumber || bill.invoiceNumber}
                  </span>
                </div>
                {bill.purchaseOrderNumber && (
                  <div>
                    <span className="text-slate-400">Purchase Order Number: </span>
                    <span className="font-bold text-purple-600 dark:text-purple-400">
                      {bill.purchaseOrderNumber}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-slate-400">Invoice Date: </span>
                  <span className="text-slate-800 dark:text-slate-200 font-semibold">
                    {formatDate(bill.date)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Destination Warehouse: </span>
                  <span className="text-slate-800 dark:text-slate-200 font-semibold">
                    {bill.warehouse || 'Main Warehouse'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Supplier Information & Destination Store */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Supplier Details (Vendor)
              </span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {supplierName}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                {supplierAddress}
              </p>
              <div className="mt-2 space-y-0.5 text-[11px] font-mono text-slate-600 dark:text-slate-400">
                {supplierGstin && <div>GSTIN: {supplierGstin}</div>}
                <div>Phone: {supplierPhone}</div>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Destination Store (Delivery Accepted)
              </span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {bill.warehouse || 'Main Warehouse'}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                {companyAddressStr}
              </p>
              <div className="mt-2 text-[11px] text-slate-500">
                Goods verified and accepted into inventory
              </div>
            </div>
          </div>

          {/* Product Details Table (Screen) */}
          <div>
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100/80 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-2.5 py-2.5 w-10 text-center">S.No</th>
                    <th className="px-3 py-2.5">Product Name</th>
                    <th className="px-2.5 py-2.5 text-center w-24">Ordered Qty</th>
                    <th className="px-2.5 py-2.5 text-center w-24">Received Qty</th>
                    <th className="px-2 py-2.5 text-center w-14">Unit</th>
                    <th className="px-2.5 py-2.5 text-right w-24">Cost / Item</th>
                    <th className="px-2.5 py-2.5 text-right w-24">Total Cost</th>
                    <th className="px-2 py-2.5 text-center w-16">GST %</th>
                    <th className="px-2.5 py-2.5 text-right w-24">GST Amount</th>
                    <th className="px-3 py-2.5 text-right w-28">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(bill.items || []).map((it, idx) => {
                    const ord = it.orderedQty !== undefined ? it.orderedQty : it.qty;
                    const recv = it.receivedQty !== undefined ? it.receivedQty : it.qty;
                    const rate = Number(it.rate) || 0;
                    const totalCost = recv * rate;
                    const taxRate = Number(it.taxRate) || 0;
                    const taxAmt = it.taxAmt !== undefined ? Number(it.taxAmt) : (totalCost * taxRate) / 100;
                    const lineTotal = it.total !== undefined ? Number(it.total) : totalCost + taxAmt;

                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="px-2.5 py-2 text-center text-slate-400 font-mono">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-2 font-semibold text-slate-900 dark:text-white">
                          <div>{it.productName}</div>
                          {it.isUnregistered && (
                            <span className="text-[10px] text-purple-600 font-mono">PO Only</span>
                          )}
                        </td>
                        <td className="px-2.5 py-2 text-center font-mono text-slate-500 dark:text-slate-400">
                          {ord}
                        </td>
                        <td className="px-2.5 py-2 text-center font-mono font-bold text-slate-900 dark:text-white">
                          {recv}
                        </td>
                        <td className="px-2 py-2 text-center text-slate-500 font-medium">
                          {it.unit || 'PCS'}
                        </td>
                        <td className="px-2.5 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                          {formatCurrency(rate)}
                        </td>
                        <td className="px-2.5 py-2 text-right font-mono font-semibold text-slate-900 dark:text-white">
                          {formatCurrency(totalCost)}
                        </td>
                        <td className="px-2 py-2 text-center font-mono text-slate-600 dark:text-slate-400">
                          {taxRate}%
                        </td>
                        <td className="px-2.5 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                          {formatCurrency(taxAmt)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-purple-600 dark:text-purple-400">
                          {formatCurrency(lineTotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bill Summary & Payment Information (Screen) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            {/* Payment Information */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
              <h4 className="text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Payment Details
              </h4>

              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Payment Status:</span>
                  {isCompleted ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>COMPLETED</span>
                    </span>
                  ) : isPartial ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      <Clock className="w-3 h-3 text-blue-600" />
                      <span>PARTIALLY PAID</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      <Clock className="w-3 h-3 text-amber-600" />
                      <span>PENDING</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Amount Paid:</span>
                  <span className="font-mono font-bold text-emerald-600">
                    {formatCurrency(alreadyPaid)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Balance Due:</span>
                  <span className="font-mono font-bold text-amber-600">
                    {formatCurrency(balanceDue)}
                  </span>
                </div>

                {(isCompleted || alreadyPaid > 0) && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Payment Date:</span>
                      <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                        {formatDate(linkedPayment?.date || bill.dueDate || bill.date)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Payment Method:</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {linkedPayment?.paymentMethod || 'Bank Transfer'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Bill Summary */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
              <h4 className="text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2">
                Bill Summary
              </h4>

              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                <span>Subtotal (Before GST):</span>
                <span className="font-mono font-semibold">{formatCurrency(bill.subtotal)}</span>
              </div>

              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                <span>Total GST:</span>
                <span className="font-mono font-semibold">{formatCurrency(bill.taxTotal)}</span>
              </div>

              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                <span>Additional Charges:</span>
                <span className="font-mono font-semibold">{formatCurrency(bill.otherCharges || bill.freightCharges || 0)}</span>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-baseline">
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase">
                  Grand Total:
                </span>
                <span className="font-mono font-extrabold text-base text-purple-600 dark:text-purple-400">
                  {formatCurrency(grandTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* DEDICATED PROFESSIONAL A4 PRINT DOCUMENT (In-Page Fallback) */}
        {/* ========================================================= */}
        <div className="hidden print:block purchase-invoice-print-document bg-white text-slate-900 font-sans p-4 sm:p-6 text-xs leading-normal">
          {/* 0. Top Meta Header Bar: Date/Time at Top-Left Corner */}
          <div className="text-[10px] text-slate-500 font-medium mb-3">
            <span>{formattedPrintDate}</span>
          </div>

          {/* 1. Header – Company Details (Top-Left) & PURCHASE INVOICE (Top-Right) */}
          <div className="flex justify-between items-center pb-4 border-b-2 border-slate-900 gap-6">
            <div className="flex items-center gap-4">
              {companyLogo && (
                <img
                  src={companyLogo}
                  alt={companyName}
                  className="h-14 max-w-[180px] object-contain shrink-0"
                />
              )}
              <div className="space-y-1">
                <h1 className="text-lg font-black text-slate-900 tracking-tight uppercase">
                  {companyName}
                </h1>
                <p className="text-xs text-slate-600 max-w-sm leading-relaxed">
                  {companyAddressStr}
                </p>
                {(companyPhone || companyEmail || companyGstin) && (
                  <div className="text-[11px] text-slate-500 space-y-0.5">
                    {companyPhone && <div><strong>Phone:</strong> {companyPhone}</div>}
                    {companyEmail && <div><strong>Email:</strong> {companyEmail}</div>}
                    {companyGstin && <div><strong>GSTIN:</strong> {companyGstin}</div>}
                  </div>
                )}
              </div>
            </div>

            <div className="text-right shrink-0">
              <h2 className="text-2xl font-black text-slate-900 tracking-wider uppercase">
                PURCHASE INVOICE
              </h2>
            </div>
          </div>

          {/* 2. Supplier & Invoice Information (Neatly Aligned 2-Column Layout) */}
          <div className="grid grid-cols-2 gap-6 py-4 border-b border-slate-300 text-xs">
            {/* Supplier Details */}
            <div className="p-3.5 bg-slate-50 rounded-md border border-slate-200 space-y-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1 pb-1 border-b border-slate-200">
                Supplier Details
              </span>
              <div className="flex justify-between">
                <span className="text-slate-600">Supplier Name:</span>
                <span className="font-bold text-slate-900">{supplierName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Address:</span>
                <span className="text-slate-700 text-right max-w-[200px] leading-tight">{supplierAddress}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Phone:</span>
                <span className="font-semibold text-slate-800">{supplierPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">GSTIN:</span>
                <span className="font-mono font-bold text-slate-900">{supplierGstin || '—'}</span>
              </div>
            </div>

            {/* Invoice Details */}
            <div className="p-3.5 bg-slate-50 rounded-md border border-slate-200 space-y-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1 pb-1 border-b border-slate-200">
                Invoice Details
              </span>
              <div className="flex justify-between">
                <span className="text-slate-600">Supplier Invoice Number:</span>
                <span className="font-mono font-bold text-slate-900">
                  {bill.supplierInvoiceNumber || bill.invoiceNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Purchase Order Number:</span>
                <span className="font-mono font-bold text-purple-700">
                  {bill.purchaseOrderNumber || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Invoice Date:</span>
                <span className="font-semibold text-slate-900">{formatDate(bill.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Destination Warehouse:</span>
                <span className="font-semibold text-slate-900">{bill.warehouse || 'Main Warehouse'}</span>
              </div>
            </div>
          </div>

          {/* 3. Product Details Table (Clean Borders & Exact 9 Columns) */}
          <div className="py-4">
            <table className="w-full text-xs text-left border-collapse border border-slate-300">
              <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                <tr>
                  <th className="py-2 px-1.5 text-center border-r border-slate-300 w-8">S.No</th>
                  <th className="py-2 px-2.5 border-r border-slate-300">Product Name</th>
                  <th className="py-2 px-1.5 text-center border-r border-slate-300 w-16">Ordered Qty</th>
                  <th className="py-2 px-1.5 text-center border-r border-slate-300 w-16">Received Qty</th>
                  <th className="py-2 px-1.5 text-center border-r border-slate-300 w-12">Unit</th>
                  <th className="py-2 px-2 text-right border-r border-slate-300 w-20">Cost / Item</th>
                  <th className="py-2 px-2 text-right border-r border-slate-300 w-20">Total Cost</th>
                  <th className="py-2 px-1.5 text-center border-r border-slate-300 w-14">GST %</th>
                  <th className="py-2 px-2 text-right border-r border-slate-300 w-20">GST Amount</th>
                  <th className="py-2 px-2.5 text-right w-24">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(bill.items || []).map((it, idx) => {
                  const ord = it.orderedQty !== undefined ? it.orderedQty : it.qty;
                  const recv = it.receivedQty !== undefined ? it.receivedQty : it.qty;
                  const rate = Number(it.rate) || 0;
                  const totalCost = recv * rate;
                  const taxRate = Number(it.taxRate) || 0;
                  const taxAmt = it.taxAmt !== undefined ? Number(it.taxAmt) : (totalCost * taxRate) / 100;
                  const lineTotal = it.total !== undefined ? Number(it.total) : totalCost + taxAmt;

                  return (
                    <tr key={idx} className="border-b border-slate-200 print-avoid-break">
                      <td className="py-1.5 px-1.5 text-center border-r border-slate-300 font-mono text-slate-600">
                        {idx + 1}
                      </td>
                      <td className="py-1.5 px-2.5 border-r border-slate-300 font-semibold text-slate-900">
                        <div>{it.productName}</div>
                        {it.isUnregistered && (
                          <span className="text-[9px] text-purple-700 font-mono">PO Only Item</span>
                        )}
                      </td>
                      <td className="py-1.5 px-1.5 text-center border-r border-slate-300 font-mono text-slate-600">
                        {ord}
                      </td>
                      <td className="py-1.5 px-1.5 text-center border-r border-slate-300 font-mono font-bold text-slate-900">
                        {recv}
                      </td>
                      <td className="py-1.5 px-1.5 text-center border-r border-slate-300 text-slate-700">
                        {it.unit || 'PCS'}
                      </td>
                      <td className="py-1.5 px-2 text-right border-r border-slate-300 font-mono text-slate-800">
                        {formatCurrency(rate)}
                      </td>
                      <td className="py-1.5 px-2 text-right border-r border-slate-300 font-mono font-semibold text-slate-900">
                        {formatCurrency(totalCost)}
                      </td>
                      <td className="py-1.5 px-1.5 text-center border-r border-slate-300 font-mono text-slate-700">
                        {taxRate}%
                      </td>
                      <td className="py-1.5 px-2 text-right border-r border-slate-300 font-mono text-slate-800">
                        {formatCurrency(taxAmt)}
                      </td>
                      <td className="py-1.5 px-2.5 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(lineTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 4. Payment Details & Bill Summary (Symmetrical & Aligned) */}
          <div className="grid grid-cols-2 gap-6 pt-2 items-start print-avoid-break">
            {/* Payment Details */}
            <div className="p-3.5 rounded-md border border-slate-300 bg-slate-50/60 space-y-2">
              <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1.5">
                Payment Details
              </h4>
              <div className="space-y-1.5 text-xs text-slate-700">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-slate-600">Payment Status:</span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded text-[10px] tracking-wide ${
                      isCompleted
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : isPartial
                        ? 'bg-blue-100 text-blue-900 border border-blue-300'
                        : 'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}
                  >
                    {isCompleted ? 'COMPLETED' : isPartial ? 'PARTIALLY PAID' : 'PENDING'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-600">Payment Method:</span>
                  <span className="text-slate-900 font-medium">
                    {linkedPayment?.paymentMethod || 'Bank Transfer'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-600">Amount Paid:</span>
                  <span className="font-mono font-semibold text-emerald-700">{formatCurrency(alreadyPaid)}</span>
                </div>
                <div className="pt-2 border-t-2 border-slate-900 flex justify-between items-baseline">
                  <span className="font-black text-slate-900 text-sm uppercase">Balance Due:</span>
                  <span className="font-mono font-black text-base text-amber-700">
                    {formatCurrency(balanceDue)}
                  </span>
                </div>
                {(isCompleted || alreadyPaid > 0) && (
                  <div className="text-[10px] text-slate-500 text-right pt-0.5">
                    Payment Date: <span className="font-mono text-slate-700">{formatDate(linkedPayment?.date || bill.dueDate || bill.date)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bill Summary */}
            <div className="p-3.5 rounded-md border border-slate-300 bg-slate-50/60 space-y-2">
              <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1.5">
                Bill Summary
              </h4>
              <div className="space-y-1.5 text-xs text-slate-700">
                <div className="flex justify-between">
                  <span className="font-medium text-slate-600">Subtotal (Before GST):</span>
                  <span className="font-mono font-semibold text-slate-900">{formatCurrency(bill.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-600">Total GST:</span>
                  <span className="font-mono font-semibold text-slate-900">{formatCurrency(bill.taxTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-600">Additional Charges:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatCurrency(bill.otherCharges || bill.freightCharges || 0)}
                  </span>
                </div>
                <div className="pt-2 border-t-2 border-slate-900 flex justify-between items-baseline">
                  <span className="font-black text-slate-900 text-sm uppercase">Grand Total:</span>
                  <span className="font-mono font-black text-base text-slate-900">
                    {formatCurrency(grandTotal)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 5. Footer – Terms & Conditions, Notes & Authorized Signatures */}
          <div className="pt-4 border-t border-slate-300 mt-4 space-y-6 print-avoid-break">
            <div className="grid grid-cols-2 gap-6 text-[10px] text-slate-600">
              <div className="p-3 bg-slate-50 rounded-md border border-slate-200">
                <span className="font-bold uppercase text-slate-800 block mb-1">Terms & Conditions</span>
                <p className="whitespace-pre-line leading-relaxed text-slate-600">{companyTerms}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-md border border-slate-200">
                <span className="font-bold uppercase text-slate-800 block mb-1">Notes / Remarks</span>
                <p className="whitespace-pre-line leading-relaxed text-slate-600">
                  {(bill.notes || 'Goods received and accepted in store inventory with verified purchase costs and tax itemization.').replace(/PO\s+PO-/gi, 'PO-')}
                </p>
              </div>
            </div>

            {/* Signature Blocks */}
            <div className="grid grid-cols-2 gap-6 pt-6">
              <div className="flex flex-col items-center">
                <div className="w-52 border-b-2 border-slate-400 mb-2" />
                <span className="text-xs font-bold text-slate-900">Supplier / Carrier Signature</span>
                <span className="text-[10px] text-slate-500">Authorized Delivery Representative</span>
              </div>

              <div className="flex flex-col items-center">
                <div className="w-52 border-b-2 border-slate-400 mb-2" />
                <span className="text-xs font-bold text-slate-900">Authorized Signature</span>
                <span className="text-[10px] text-slate-600 font-medium">For {companyName}</span>
              </div>
            </div>

            <div className="text-center pt-2 border-t border-slate-200 text-[9px] text-slate-400">
              This is a computer-generated Purchase Invoice.
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* MODAL FOOTER (Hidden during Print)                       */}
        {/* ========================================================= */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40 no-print">
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Bill</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
