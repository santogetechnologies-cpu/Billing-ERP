import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Printer,
  Download,
  Share2,
  X,
  FileText,
  Receipt,
  Check,
  Building,
  QrCode,
  ArrowLeft,
  Zap,
  Settings,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { SalesInvoice } from '../../types';
import { useERP } from '../../context/ERPContext';
import { formatCurrency, formatDate, numberToWordsIndian } from '../../utils/formatters';
import { BarcodeCanvas } from '../barcode/BarcodeCanvas';
import { ModalCloseButton } from '../common/ModalCloseButton';
import { directPrintService, ReceiptPaperSize, PrinterConfig } from '../../services/directPrintService';

export interface InvoicePrintModalProps {
  invoice: SalesInvoice | null;
  isOpen: boolean;
  onClose: () => void;
  defaultFormat?: 'A4' | 'Thermal' | '80mm' | '58mm';
  showSuccessBanner?: boolean;
  preventBackdropClose?: boolean;
  closeButtonLabel?: string;
}

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({
  invoice,
  isOpen,
  onClose,
  defaultFormat = 'A4',
  showSuccessBanner = true,
  preventBackdropClose = true,
  closeButtonLabel = 'Close / Back to Billing'
}) => {
  const { company } = useERP();
  
  // Resolve initial format: if 'Thermal' is passed, default to 80mm or configured size
  const initialResolvedFormat = useMemo<'A4' | '80mm' | '58mm'>(() => {
    if (defaultFormat === '58mm') return '58mm';
    if (defaultFormat === '80mm') return '80mm';
    if (defaultFormat === 'Thermal') {
      const cfg = directPrintService.getConfig();
      return cfg.billPaperSize === '58mm' ? '58mm' : '80mm';
    }
    return 'A4';
  }, [defaultFormat]);

  const [format, setFormat] = useState<'A4' | '80mm' | '58mm'>(initialResolvedFormat);
  const [copied, setCopied] = useState(false);
  const [isPrintingDirect, setIsPrintingDirect] = useState(false);
  const [printerConfig, setPrinterConfig] = useState<PrinterConfig>(() => directPrintService.getConfig());
  const [printFeedback, setPrintFeedback] = useState<{
    type: 'success' | 'info' | 'error';
    message: string;
    printerName?: string;
  } | null>(null);

  const autoPrintedRef = useRef<string | null>(null);

  // Sync format with defaultFormat whenever the modal opens
  useEffect(() => {
    if (isOpen) {
      setFormat(initialResolvedFormat);
      const cfg = directPrintService.getConfig();
      setPrinterConfig(cfg);
      setPrintFeedback(null);
    }
  }, [isOpen, initialResolvedFormat]);

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('invoice-modal-open');
      return () => {
        document.body.classList.remove('invoice-modal-open');
      };
    }
  }, [isOpen]);

  // Auto-print on save if configured
  useEffect(() => {
    if (
      isOpen &&
      invoice &&
      printerConfig.directPrintEnabled &&
      printerConfig.autoPrintOnSave &&
      autoPrintedRef.current !== invoice.id
    ) {
      autoPrintedRef.current = invoice.id;
      // Auto-trigger direct print once silently
      const timer = setTimeout(() => {
        handlePrint();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [isOpen, invoice?.id, printerConfig.directPrintEnabled, printerConfig.autoPrintOnSave]);

  // Formatted date and time from transaction
  const invoiceDateTime = useMemo(() => {
    if (!invoice) return '';
    const dateFormatted = formatDate(invoice.date);
    let timeFormatted = '';
    if (invoice.createdAt) {
      try {
        const d = new Date(invoice.createdAt);
        if (!isNaN(d.getTime())) {
          timeFormatted = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
      } catch {}
    }
    if (!timeFormatted) {
      timeFormatted = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return `${dateFormatted} ${timeFormatted}`;
  }, [invoice]);

  // Extract tender, change, and balance details
  const { cashTenderedNum, changeReturnedNum, balanceDueNum } = useMemo(() => {
    if (!invoice) return { cashTenderedNum: 0, changeReturnedNum: 0, balanceDueNum: 0 };
    let tendered = 0;
    if (invoice.notes) {
      const match = invoice.notes.match(/Tendered:\s*₹?([\d.]+)/i);
      if (match && match[1]) {
        tendered = parseFloat(match[1]);
      }
    }
    const paid = Number(invoice.paidAmount || 0);
    const grand = Number(invoice.grandTotal || 0);
    let change = 0;
    if (tendered > grand) {
      change = tendered - grand;
    } else if (paid > grand) {
      change = paid - grand;
    }
    const due = Math.max(0, grand - paid);
    return {
      cashTenderedNum: tendered || paid,
      changeReturnedNum: change,
      balanceDueNum: due
    };
  }, [invoice]);

  if (!isOpen || !invoice) return null;

  // Print Bill handler - Direct print when configured, fallback to browser print, keeps modal open
  const handlePrint = async () => {
    if (!invoice) return;
    setIsPrintingDirect(true);
    setPrintFeedback(null);

    try {
      const result = await directPrintService.printReceipt(invoice, company, {
        paperSize: format,
        copies: 1
      });

      if (result.success) {
        if (result.mode === 'direct') {
          setPrintFeedback({
            type: 'success',
            message: result.message,
            printerName: result.printerName
          });
        } else {
          setPrintFeedback({
            type: 'info',
            message: result.message
          });
        }
      } else {
        setPrintFeedback({
          type: 'error',
          message: result.message || 'Printing failed. Check printer configuration.'
        });
      }
    } catch (err: any) {
      setPrintFeedback({
        type: 'error',
        message: err?.message || 'Error occurred while spooling print job.'
      });
    } finally {
      setIsPrintingDirect(false);
    }
  };

  // Download PDF handler - sets document title to invoice number for PDF filename and triggers print dialog
  const handleDownloadPdf = () => {
    const originalTitle = document.title;
    if (invoice?.invoiceNumber) {
      document.title = `Invoice_${invoice.invoiceNumber}`;
    }
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1500);
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="invoice-modal-backdrop fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:static print:inset-auto print:z-auto print:p-0 print:bg-white print:backdrop-blur-none print:overflow-visible print:block print:w-full print:h-auto"
      onClick={preventBackdropClose ? undefined : onClose}
    >
      <div
        className="invoice-modal-container relative w-full max-w-5xl 2xl:max-w-6xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh] print:max-h-none print:h-auto print:overflow-visible print:border-none print:shadow-none print:rounded-none print:w-full print:max-w-none print:bg-white print:static print:block"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Control Bar (Hidden during print) */}
        <div className="no-print px-4 sm:px-6 py-2.5 bg-slate-50/95 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          {/* Left: Format Selector & Direct Print Status */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0">
              Format:
            </span>
            <div className="inline-flex items-center bg-white border border-slate-200/90 rounded-lg p-0.5 text-xs shadow-2xs shrink-0">
              <button
                type="button"
                onClick={() => setFormat('58mm')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium text-xs transition-colors cursor-pointer ${
                  format === '58mm' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
                title="58mm Compact Thermal Receipt (2 inch)"
              >
                <Receipt className="w-3.5 h-3.5 shrink-0" />
                <span>58mm Thermal</span>
              </button>
              <button
                type="button"
                onClick={() => setFormat('80mm')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium text-xs transition-colors cursor-pointer ${
                  format === '80mm' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
                title="80mm Standard POS Thermal Receipt (3 inch)"
              >
                <Receipt className="w-3.5 h-3.5 shrink-0" />
                <span>80mm POS</span>
              </button>
              <button
                type="button"
                onClick={() => setFormat('A4')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium text-xs transition-colors cursor-pointer ${
                  format === 'A4' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
                title="Standard A4 GST Tax Invoice"
              >
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span>A4 Tax Invoice</span>
              </button>
            </div>

            {/* Direct Print Status Pill */}
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border shrink-0 ${
                printerConfig.directPrintEnabled
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold'
                  : 'bg-white text-slate-600 border-slate-200'
              }`}
              title={
                printerConfig.directPrintEnabled
                  ? `Silent Direct Print Enabled -> ${printerConfig.billPrinterName || 'Default POS Printer'}`
                  : 'Direct Print Disabled -> Browser preview dialog will be used'
              }
            >
              {printerConfig.directPrintEnabled ? (
                <>
                  <Zap className="w-3 h-3 text-emerald-600 fill-emerald-600 shrink-0" />
                  <span className="hidden sm:inline">Direct Print:</span>
                  <span className="font-bold truncate max-w-[120px]">
                    {printerConfig.billPrinterName || 'Active POS'}
                  </span>
                </>
              ) : (
                <>
                  <Printer className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>Browser Print</span>
                </>
              )}
            </div>
          </div>

          {/* Right: Modal Close Button */}
          <div className="flex items-center gap-2 shrink-0">
            <ModalCloseButton onClose={onClose} autoHandleEscape={true} />
          </div>
        </div>

        {/* Print Feedback Banner (Success / Info / Error) */}
        {printFeedback && (
          <div
            className={`no-print mx-4 sm:mx-6 mt-3 px-4 py-2 rounded-xl flex items-center justify-between gap-3 text-xs shadow-2xs animate-fadeIn ${
              printFeedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                : printFeedback.type === 'info'
                ? 'bg-blue-50 text-blue-900 border border-blue-200'
                : 'bg-rose-50 text-rose-900 border border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {printFeedback.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : printFeedback.type === 'info' ? (
                <Printer className="w-4 h-4 text-blue-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="font-semibold">{printFeedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setPrintFeedback(null)}
              className="text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Required Banner: Prominent Database Save Confirmation Banner */}
        {showSuccessBanner && (
          <div
            id="invoice-save-success-banner"
            className="no-print mx-4 sm:mx-6 mt-3 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-emerald-800 shadow-2xs shrink-0"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              </span>
              <div>
                <p className="font-bold text-xs sm:text-sm text-emerald-950">
                  Invoice saved successfully
                </p>
                <p className="text-[11px] text-emerald-700">
                  Invoice #{invoice.invoiceNumber} recorded in database &bull; Stock balance updated &bull; Preview is ready
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                #{invoice.invoiceNumber}
              </span>
            </div>
          </div>
        )}

        {/* Printable Invoice Container */}
        <div className="invoice-preview-viewport flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/60 print:p-0 print:bg-white print:overflow-visible print:block flex flex-col items-center">
          {format === 'A4' ? (
            /* =================== A4 GST TAX INVOICE =================== */
            <div
              id="printable-invoice"
              className="invoice-document-paper w-full max-w-3xl bg-white p-6 sm:p-8 rounded-xl border border-slate-200 shadow-sm text-slate-800 print:border-none print:shadow-none print:rounded-none print:p-0 print:max-w-none print:w-full text-xs min-h-fit"
            >
              {/* Header: Company & Tax Invoice Badge */}
              <div className="invoice-avoid-break print:break-inside-avoid flex items-start justify-between border-b-2 border-slate-800 pb-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-lg">
                      U
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-slate-900 tracking-tight leading-none uppercase">
                        {company.name}
                      </h2>
                      <p className="text-[10px] text-slate-500 font-semibold tracking-wide uppercase mt-0.5">
                        Universal Commercial ERP & Supply Chain
                      </p>
                    </div>
                  </div>
                  {(company.address || company.city) && (
                    <p className="text-[11px] text-slate-600 max-w-md mt-2">
                      {[company.address, company.city && company.pincode ? `${company.city} - ${company.pincode}` : (company.city || company.pincode), company.state, company.country].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {([company.gstin && `GSTIN: ${company.gstin}`, company.pan && `PAN: ${company.pan}`, company.phone && `Phone: ${company.phone}`].filter(Boolean).length > 0) && (
                    <p className="text-[11px] text-slate-600">
                      {[company.gstin && `GSTIN: ${company.gstin}`, company.pan && `PAN: ${company.pan}`, company.phone && `Phone: ${company.phone}`].filter(Boolean).join(' | ')}
                    </p>
                  )}
                  {([company.email && `Email: ${company.email}`, company.website && `Web: ${company.website}`].filter(Boolean).length > 0) && (
                    <p className="text-[11px] text-slate-600">
                      {[company.email && `Email: ${company.email}`, company.website && `Web: ${company.website}`].filter(Boolean).join(' | ')}
                    </p>
                  )}
                </div>

                <div className="text-right space-y-1">
                  <div className="inline-block px-3 py-1 bg-slate-900 text-white font-bold text-xs rounded uppercase tracking-wider">
                    TAX INVOICE
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium">Original for Recipient</p>
                  <div className="pt-2">
                    <BarcodeCanvas value={invoice.invoiceNumber} height={36} showText={false} />
                    <p className="font-mono font-bold text-xs mt-1 text-slate-900">{invoice.invoiceNumber}</p>
                  </div>
                </div>
              </div>

              {/* Invoice Meta Grid */}
              <div className="invoice-avoid-break print:break-inside-avoid grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-b border-slate-200 bg-slate-50/50 px-3 rounded-lg my-4">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Invoice Date</span>
                  <span className="font-bold text-slate-800">{formatDate(invoice.date)}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Due Date</span>
                  <span className="font-bold text-slate-800">{formatDate(invoice.dueDate)}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Payment Method</span>
                  <span className="font-bold text-slate-800">{invoice.paymentMethod}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Payment Status</span>
                  <span className={`font-bold ${invoice.paymentStatus === 'Paid' ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {invoice.paymentStatus}
                  </span>
                </div>
              </div>

              {/* Customer / Billed To Section */}
              <div className="invoice-avoid-break print:break-inside-avoid grid grid-cols-1 sm:grid-cols-2 gap-6 py-2 border-b border-slate-200 pb-4">
                <div>
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Billed To (Customer Details)
                  </h4>
                  <p className="font-bold text-sm text-slate-900">{invoice.customerName}</p>
                  <p className="text-slate-600 text-[11px] mt-0.5">{invoice.customerAddress || 'Customer Address'}</p>
                  <p className="text-slate-600 text-[11px]">
                    <strong>GSTIN:</strong> {invoice.customerGstin || 'Unregistered'}
                  </p>
                  {invoice.customerPhone && (
                    <p className="text-slate-600 text-[11px]">
                      <strong>Phone:</strong> {invoice.customerPhone}
                    </p>
                  )}
                </div>

                <div>
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Dispatched From / Branch
                  </h4>
                  <p className="font-bold text-xs text-slate-800">{company.name}</p>
                  <p className="text-slate-600 text-[11px] mt-0.5">Warehouse: {invoice.warehouseId || 'Main Hub'}</p>
                  <p className="text-slate-600 text-[11px]">Place of Supply: Maharashtra (State Code 27)</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="py-4 overflow-x-auto print:overflow-visible">
                <table className="w-full text-left text-xs border border-slate-200">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-2 text-center w-8">#</th>
                      <th className="py-2 px-2">Item Description</th>
                      <th className="py-2 px-2 text-center">HSN/SAC</th>
                      <th className="py-2 px-2 text-right">Qty</th>
                      <th className="py-2 px-2 text-right">Unit Rate</th>
                      <th className="py-2 px-2 text-right">Disc %</th>
                      <th className="py-2 px-2 text-right">Taxable</th>
                      <th className="py-2 px-2 text-right">GST</th>
                      <th className="py-2 px-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoice.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 print:break-inside-avoid">
                        <td className="py-2 px-2 text-center font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-2 px-2">
                          <span className="font-semibold text-slate-900 block">{item.productName}</span>
                          <span className="text-[10px] text-slate-500 font-mono">SKU: {item.sku}</span>
                          {item.serialNumber && (
                            <span className="text-[10px] text-blue-600 font-mono block">
                              S/N: {item.serialNumber}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center font-mono text-slate-600">{item.hsn || '—'}</td>
                        <td className="py-2 px-2 text-right font-medium text-slate-800">
                          {item.qty} {item.unit}
                        </td>
                        <td className="py-2 px-2 text-right text-slate-700">{formatCurrency(item.rate)}</td>
                        <td className="py-2 px-2 text-right text-slate-500">{item.discountPct}%</td>
                        <td className="py-2 px-2 text-right font-medium text-slate-800">
                          {formatCurrency(item.qty * item.rate - item.discountAmt)}
                        </td>
                        <td className="py-2 px-2 text-right text-slate-600">
                          {formatCurrency(item.taxAmt)} ({item.taxRate}%)
                        </td>
                        <td className="py-2 px-2 text-right font-bold text-slate-900">
                          {formatCurrency(item.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals & Tax Calculation Breakdown */}
              <div className="invoice-avoid-break print:break-inside-avoid grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 pb-4 border-t border-slate-200">
                <div className="space-y-3">
                  {/* Amount in words */}
                  <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Total Amount In Words:
                    </span>
                    <p className="font-bold text-xs text-slate-800 italic mt-0.5">
                      {numberToWordsIndian(invoice.grandTotal)}
                    </p>
                  </div>

                  {/* Bank & UPI QR Payment */}
                  <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-200/80 flex items-start gap-4">
                    <div className="space-y-1 flex-1 text-[11px]">
                      <span className="font-bold text-blue-900 block text-xs">Bank Transfer Details</span>
                      <p className="text-slate-700"><strong>Bank:</strong> {company.bankName}</p>
                      <p className="text-slate-700"><strong>A/C No:</strong> {company.accountNumber}</p>
                      <p className="text-slate-700"><strong>IFSC:</strong> {company.ifscCode}</p>
                      <p className="text-slate-700"><strong>UPI VPA:</strong> {company.upiId}</p>
                    </div>
                    <div className="text-center shrink-0">
                      <BarcodeCanvas value={`upi://pay?pa=${company.upiId}&pn=${encodeURIComponent(company.name)}&am=${invoice.grandTotal}&cu=INR`} type="QR Code" height={60} showText={false} />
                      <span className="text-[9px] font-semibold text-slate-500 block mt-1">Scan to Pay UPI</span>
                    </div>
                  </div>
                </div>

                {/* Calculation summary */}
                <div className="space-y-1.5 text-xs text-slate-700 self-end">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>Taxable Subtotal:</span>
                    <span className="font-medium">{formatCurrency(invoice.subtotal)}</span>
                  </div>
                  {invoice.discountTotal > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100 text-emerald-600">
                      <span>Total Discount:</span>
                      <span>-{formatCurrency(invoice.discountTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>CGST Output Tax:</span>
                    <span>{formatCurrency(invoice.cgstTotal)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>SGST Output Tax:</span>
                    <span>{formatCurrency(invoice.sgstTotal)}</span>
                  </div>
                  {invoice.roundOff !== 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100 text-slate-500">
                      <span>Round Off:</span>
                      <span>{invoice.roundOff > 0 ? `+${invoice.roundOff.toFixed(2)}` : invoice.roundOff.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 border-t-2 border-slate-900 text-base font-black text-slate-900">
                    <span>Grand Total:</span>
                    <span className="text-blue-600">{formatCurrency(invoice.grandTotal)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-slate-600 font-semibold text-xs">
                    <span>Paid Amount:</span>
                    <span>{formatCurrency(invoice.paidAmount)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-xs font-bold text-rose-600">
                    <span>Balance Due:</span>
                    <span>{formatCurrency(Math.max(0, invoice.grandTotal - invoice.paidAmount))}</span>
                  </div>
                </div>
              </div>

              {/* Terms and Signatory Footer */}
              <div className="invoice-avoid-break print:break-inside-avoid grid grid-cols-2 gap-6 pt-6 border-t border-slate-200 mt-4 text-[10px] text-slate-500">
                <div>
                  <span className="font-bold uppercase text-slate-600 block mb-1">Terms & Conditions</span>
                  <p className="whitespace-pre-line leading-relaxed">{invoice.terms || company.termsAndConditions}</p>
                </div>
                <div className="text-right flex flex-col justify-between items-end">
                  <span className="font-semibold text-slate-800">For {company.name}</span>
                  <div className="w-32 border-b border-slate-400 mt-12 mb-1" />
                  <span className="font-medium text-slate-600">Authorized Signatory</span>
                </div>
              </div>
            </div>
          ) : (
            /* =================== 58mm / 80mm THERMAL POS RECEIPT =================== */
            <div
              id="printable-thermal-receipt"
              className={`invoice-document-paper bg-white rounded-lg border border-slate-200 shadow-sm text-slate-900 print:border-none print:shadow-none print:rounded-none print:p-0 font-mono leading-tight space-y-2.5 min-h-fit ${
                format === '58mm'
                  ? 'w-56 p-3 text-[10px] print:w-56'
                  : 'w-72 p-4 text-[11px] print:w-72'
              }`}
            >
              {/* Company Header */}
              <div className="text-center space-y-1 border-b border-dashed border-slate-300 pb-2.5">
                <h3 className={`font-bold tracking-tight uppercase text-slate-900 ${format === '58mm' ? 'text-xs' : 'text-sm'}`}>
                  {company.name}
                </h3>
                {(company.address || company.city) && (
                  <p className="text-[10px] text-slate-600">
                    {[company.address, company.city && company.pincode ? `${company.city} - ${company.pincode}` : (company.city || company.pincode), company.state].filter(Boolean).join(', ')}
                  </p>
                )}
                {([company.gstin && `GSTIN: ${company.gstin}`, company.pan && `PAN: ${company.pan}`].filter(Boolean).length > 0) && (
                  <p className="text-[10px] text-slate-700 font-medium">
                    {[company.gstin && `GSTIN: ${company.gstin}`, company.pan && `PAN: ${company.pan}`].filter(Boolean).join(' | ')}
                  </p>
                )}
                {([company.phone && `Ph: ${company.phone}`, company.email].filter(Boolean).length > 0) && (
                  <p className="text-[10px] text-slate-600">
                    {[company.phone && `Ph: ${company.phone}`, company.email].filter(Boolean).join(' | ')}
                  </p>
                )}
                <div className="text-[10px] sm:text-[11px] font-black uppercase pt-1 tracking-wider text-slate-900">
                  *** {invoice.docType === 'pos_invoice' ? 'RETAIL POS CASH RECEIPT' : 'TAX INVOICE RECEIPT'} ***
                </div>
                <div className="text-[9px] text-slate-400 uppercase tracking-widest font-sans">
                  [{format === '58mm' ? '58mm Roll Format' : '80mm Roll Format'}]
                </div>
              </div>

              {/* Receipt Metadata */}
              <div className="border-b border-dashed border-slate-300 pb-2 space-y-0.5 text-[10px]">
                <div className="flex justify-between">
                  <span>Bill No:</span>
                  <span className="font-bold font-mono text-slate-900">{invoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date & Time:</span>
                  <span className="font-medium text-slate-800">{invoiceDateTime}</span>
                </div>
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span className={`font-bold truncate text-slate-800 ${format === '58mm' ? 'max-w-[110px]' : 'max-w-[150px]'}`}>
                    {invoice.customerName}
                  </span>
                </div>
                {invoice.customerPhone && (
                  <div className="flex justify-between">
                    <span>Phone:</span>
                    <span>{invoice.customerPhone}</span>
                  </div>
                )}
                {invoice.customerGstin && (
                  <div className="flex justify-between">
                    <span>Cust GSTIN:</span>
                    <span className="font-mono">{invoice.customerGstin}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Pay Mode:</span>
                  <span className="font-semibold text-slate-800">{invoice.paymentMethod}</span>
                </div>
              </div>

              {/* Items Breakdown */}
              <div className="border-b border-dashed border-slate-300 pb-2">
                <div className="flex justify-between font-bold border-b border-slate-200 pb-1 text-[10px] uppercase text-slate-700">
                  <span>Item & Rate</span>
                  <span>Qty</span>
                  <span>Total</span>
                </div>
                <div className="divide-y divide-slate-100 py-1 space-y-1.5">
                  {(invoice.items || []).map((item, idx) => (
                    <div key={item.id || idx} className="pt-1 text-[10px]">
                      <div className="flex justify-between font-semibold text-slate-900">
                        <span className={`truncate ${format === '58mm' ? 'max-w-[120px]' : 'max-w-[170px]'}`}>
                          {item.productName}
                        </span>
                        <span className="font-bold">{formatCurrency(item.total)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>
                          {item.qty} {item.unit || 'Pcs'} @ {formatCurrency(item.rate)}
                        </span>
                        {item.discountAmt > 0 && (
                          <span className="text-emerald-600 font-medium">
                            Disc: -{formatCurrency(item.discountAmt)}
                          </span>
                        )}
                      </div>
                      {item.taxRate > 0 && (
                        <div className="text-[9px] text-slate-400">
                          GST {item.taxRate}% ({formatCurrency(item.taxAmt || 0)}) {item.hsn ? `| HSN: ${item.hsn}` : ''}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals & Tax Summary */}
              <div className="space-y-1 text-xs border-b border-dashed border-slate-300 pb-2">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(invoice.subtotal)}</span>
                </div>
                {invoice.discountTotal > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Total Discount:</span>
                    <span>-{formatCurrency(invoice.discountTotal)}</span>
                  </div>
                )}
                {invoice.taxTotal > 0 && (
                  <>
                    <div className="flex justify-between text-slate-500 text-[10px]">
                      <span>CGST:</span>
                      <span>{formatCurrency(invoice.cgstTotal || invoice.taxTotal / 2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 text-[10px]">
                      <span>SGST:</span>
                      <span>{formatCurrency(invoice.sgstTotal || invoice.taxTotal / 2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Total Tax (GST):</span>
                      <span>{formatCurrency(invoice.taxTotal)}</span>
                    </div>
                  </>
                )}
                {invoice.roundOff !== 0 && (
                  <div className="flex justify-between text-slate-500 text-[10px]">
                    <span>Round Off:</span>
                    <span>{invoice.roundOff > 0 ? `+${invoice.roundOff.toFixed(2)}` : invoice.roundOff.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-sm border-t border-slate-900 pt-1.5 text-slate-900">
                  <span>GRAND TOTAL:</span>
                  <span>{formatCurrency(invoice.grandTotal)}</span>
                </div>
                <div className="flex justify-between text-[11px] font-semibold text-emerald-700 pt-1">
                  <span>Paid ({invoice.paymentMethod}):</span>
                  <span>{formatCurrency(invoice.paidAmount)}</span>
                </div>
                {cashTenderedNum > invoice.grandTotal && (
                  <div className="flex justify-between text-[10px] text-slate-600">
                    <span>Cash Tendered:</span>
                    <span>{formatCurrency(cashTenderedNum)}</span>
                  </div>
                )}
                {changeReturnedNum > 0 && (
                  <div className="flex justify-between text-[11px] font-bold text-blue-700 bg-blue-50 px-1 py-0.5 rounded">
                    <span>Change to Return:</span>
                    <span>{formatCurrency(changeReturnedNum)}</span>
                  </div>
                )}
                {balanceDueNum > 0 ? (
                  <div className="flex justify-between text-[11px] font-bold text-rose-600">
                    <span>Balance Due:</span>
                    <span>{formatCurrency(balanceDueNum)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-[10px] text-emerald-600 font-semibold">
                    <span>Payment Status:</span>
                    <span>PAID IN FULL</span>
                  </div>
                )}
              </div>

              {/* Barcode & Footer */}
              <div className="text-center pt-2 space-y-1.5">
                <BarcodeCanvas value={invoice.invoiceNumber} height={format === '58mm' ? 26 : 32} showText={false} />
                <p className="font-mono text-[9px] text-slate-700">{invoice.invoiceNumber}</p>
                <p className="text-[10px] text-slate-600 whitespace-pre-line font-sans">
                  {invoice.terms || 'Thank you for your visit! Goods once sold can be exchanged within 7 days with bill.'}
                </p>
                <p className="text-[9px] text-slate-400">Powered by Universal ERP</p>
              </div>
            </div>
          )}

        </div>

        {/* Bottom Pinned Footer Actions (Fixed at bottom of modal) */}
        <div className="no-print w-full px-4 sm:px-6 py-3 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 shadow-xs">
          <div className="text-xs text-slate-600 text-center sm:text-left">
            <span className="font-bold text-slate-800">Saved Invoice:</span>{' '}
            <span className="font-mono font-bold text-blue-600">#{invoice.invoiceNumber}</span> &bull; Total:{' '}
            <span className="font-bold text-slate-900">{formatCurrency(invoice.grandTotal)}</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Share */}
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer shadow-2xs shrink-0"
              title="Share invoice link"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copied ? 'Copied' : 'Share'}</span>
            </button>

            {/* Required Action 1: Download PDF */}
            <button
              type="button"
              id="download-pdf-btn"
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 rounded-lg shadow-2xs transition-colors cursor-pointer shrink-0"
              title="Download or save invoice as PDF"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Download PDF</span>
            </button>

            {/* Required Action 2: Print Bill */}
            <button
              type="button"
              id="print-bill-btn"
              disabled={isPrintingDirect}
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg shadow-2xs transition-colors cursor-pointer shrink-0"
              title={printerConfig.directPrintEnabled ? 'Direct silent print to receipt printer' : 'Print bill to receipt or document printer'}
            >
              {isPrintingDirect ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Printing...</span>
                </>
              ) : (
                <>
                  <Printer className="w-3.5 h-3.5" />
                  <span>{printerConfig.directPrintEnabled ? 'Direct Print Bill' : 'Print Bill'}</span>
                </>
              )}
            </button>

            {/* Required Action 3: Close / Back to Billing */}
            <button
              type="button"
              id="close-back-to-billing-btn"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-300 hover:bg-slate-200 hover:text-slate-900 rounded-lg shadow-2xs transition-colors cursor-pointer shrink-0"
              title="Close saved invoice preview and return to billing"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-slate-600" />
              <span>{closeButtonLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
