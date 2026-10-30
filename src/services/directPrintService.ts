/**
 * Direct Printing Service for Universal Billing
 * 
 * Supports silent direct printing of bills (58mm / 80mm thermal receipts)
 * and barcode stickers (custom label dimensions) via local printer bridge.
 * Includes graceful automatic fallback to browser print dialog when bridge is offline.
 */

import { SalesInvoice, CompanyProfile } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';

export type ReceiptPaperSize = '58mm' | '80mm' | 'A4';

export interface PrinterConfig {
  directPrintEnabled: boolean;
  bridgeUrl: string; // default "http://127.0.0.1:9191"
  billPrinterName: string; // Selected receipt printer
  billPaperSize: ReceiptPaperSize; // '58mm' | '80mm' | 'A4'
  barcodePrinterName: string; // Selected barcode label printer
  barcodeLabelWidthMm: number; // e.g. 50 mm
  barcodeLabelHeightMm: number; // e.g. 25 mm
  defaultCopies: number; // default copies count
  autoPrintOnSave: boolean; // silent direct print immediately upon invoice creation
  fallbackToBrowserPrint: boolean; // fallback to browser print if bridge is offline
}

export interface PrintResult {
  success: boolean;
  mode: 'direct' | 'fallback_browser' | 'none';
  message: string;
  error?: string;
  printerName?: string;
  bridgeOnline?: boolean;
}

export interface BarcodeLabelData {
  name: string;
  barcode: string;
  sku?: string;
  sellingPrice?: number;
  mrp?: number;
  category?: string;
  batchNumber?: string;
  expiryDate?: string;
}

const STORAGE_KEY = 'universal_billing_printer_config';

export const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  directPrintEnabled: false,
  bridgeUrl: 'http://127.0.0.1:9191',
  billPrinterName: '',
  billPaperSize: '80mm',
  barcodePrinterName: '',
  barcodeLabelWidthMm: 50,
  barcodeLabelHeightMm: 25,
  defaultCopies: 1,
  autoPrintOnSave: false,
  fallbackToBrowserPrint: true
};

class DirectPrintService {
  private configCache: PrinterConfig | null = null;

  /**
   * Get current printer configuration
   */
  getConfig(): PrinterConfig {
    if (this.configCache) return this.configCache;
    let cfg: PrinterConfig = { ...DEFAULT_PRINTER_CONFIG };
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        cfg = { ...DEFAULT_PRINTER_CONFIG, ...JSON.parse(stored) };
      }
    } catch {}
    this.configCache = cfg;
    return cfg;
  }

  /**
   * Save printer configuration
   */
  saveConfig(partial: Partial<PrinterConfig>): PrinterConfig {
    const current = this.getConfig();
    const updated = { ...current, ...partial };
    this.configCache = updated;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    return updated;
  }

  /**
   * Check if local printing bridge daemon is online
   */
  async checkBridgeStatus(customUrl?: string): Promise<{ online: boolean; version?: string; error?: string }> {
    const url = customUrl || this.getConfig().bridgeUrl || 'http://127.0.0.1:9191';
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${url.replace(/\/+$/, '')}/status`, {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        return { online: true, version: data.version || '1.0.0' };
      }
      return { online: false, error: `HTTP ${res.status}: ${res.statusText}` };
    } catch (err: any) {
      return { online: false, error: err?.message || 'Connection refused (bridge not running)' };
    }
  }

  /**
   * Discover installed OS printers via bridge
   */
  async getInstalledPrinters(): Promise<{ name: string; isDefault: boolean; port?: string }[]> {
    const bridgeUrl = this.getConfig().bridgeUrl || 'http://127.0.0.1:9191';
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${bridgeUrl.replace(/\/+$/, '')}/printers`, {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.printers)) {
          return data.printers;
        }
      }
    } catch {}
    return [];
  }

  /**
   * Generate formatted receipt text for 58mm or 80mm paper
   */
  formatReceiptText(invoice: SalesInvoice, company: CompanyProfile, paperSize: '58mm' | '80mm' | 'A4' = '80mm'): string {
    const width = paperSize === '58mm' ? 32 : 46;
    const center = (str: string) => {
      const trimmed = (str || '').trim().slice(0, width);
      const pad = Math.max(0, Math.floor((width - trimmed.length) / 2));
      return ' '.repeat(pad) + trimmed;
    };
    const row2 = (left: string, right: string) => {
      const r = (right || '').trim();
      const maxLeft = width - r.length - 1;
      const l = (left || '').trim().slice(0, maxLeft);
      const spaces = Math.max(1, width - l.length - r.length);
      return l + ' '.repeat(spaces) + r;
    };
    const divider = '='.repeat(width);
    const dashed = '-'.repeat(width);

    const lines: string[] = [];

    // Header
    lines.push(divider);
    lines.push(center(company.name || 'UNIVERSAL BILLING'));
    if (company.city || company.address) {
      lines.push(center([company.address, company.city].filter(Boolean).join(', ')));
    }
    if (company.gstin) {
      lines.push(center(`GSTIN: ${company.gstin}`));
    }
    if (company.phone) {
      lines.push(center(`Phone: ${company.phone}`));
    }
    lines.push(divider);

    // Meta details
    lines.push(row2('TAX INVOICE:', invoice.invoiceNumber));
    lines.push(row2('Date & Time:', formatDate(invoice.date) + (invoice.createdAt ? ` ${new Date(invoice.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '')));
    if (invoice.customerName) {
      lines.push(row2('Customer:', invoice.customerName));
    }
    if (invoice.customerPhone) {
      lines.push(row2('Phone:', invoice.customerPhone));
    }
    if (invoice.customerGstin) {
      lines.push(row2('Cust GSTIN:', invoice.customerGstin));
    }
    lines.push(dashed);

    // Items Header
    if (paperSize === '58mm') {
      lines.push(row2('Item Qty x Rate', 'Total'));
    } else {
      lines.push(row2('Item Description (Qty x Rate)', 'Total'));
    }
    lines.push(dashed);

    // Line items
    for (const item of invoice.items || []) {
      const itemName = item.productName || 'Item';
      const qtyRate = `${item.qty} ${item.unit || 'Pcs'} @ ${formatCurrency(item.rate)}`;
      const totalStr = formatCurrency(item.total);

      lines.push(itemName.slice(0, width));
      lines.push(row2(`  ${qtyRate}`, totalStr));

      if (item.discountAmt > 0) {
        lines.push(row2('  Discount:', `-${formatCurrency(item.discountAmt)}`));
      }
    }
    lines.push(dashed);

    // Totals
    lines.push(row2('Subtotal:', formatCurrency(invoice.subtotal)));
    if (invoice.discountTotal > 0) {
      lines.push(row2('Total Discount:', `-${formatCurrency(invoice.discountTotal)}`));
    }
    if (invoice.taxTotal > 0) {
      lines.push(row2('CGST:', formatCurrency(invoice.cgstTotal || invoice.taxTotal / 2)));
      lines.push(row2('SGST:', formatCurrency(invoice.sgstTotal || invoice.taxTotal / 2)));
      lines.push(row2('Total Tax (GST):', formatCurrency(invoice.taxTotal)));
    }
    if (invoice.roundOff !== 0) {
      lines.push(row2('Round Off:', invoice.roundOff > 0 ? `+${invoice.roundOff.toFixed(2)}` : invoice.roundOff.toFixed(2)));
    }
    lines.push(divider);
    lines.push(row2('GRAND TOTAL:', formatCurrency(invoice.grandTotal)));
    lines.push(divider);

    // Payment details
    lines.push(row2(`Paid (${invoice.paymentMethod}):`, formatCurrency(invoice.paidAmount)));

    // Parse cash tender
    let tendered = 0;
    if (invoice.notes) {
      const match = invoice.notes.match(/Tendered:\s*₹?([\d.]+)/i);
      if (match && match[1]) tendered = parseFloat(match[1]);
    }
    const grand = Number(invoice.grandTotal || 0);
    const paid = Number(invoice.paidAmount || 0);
    if (tendered > grand) {
      lines.push(row2('Cash Tendered:', formatCurrency(tendered)));
      lines.push(row2('Change Returned:', formatCurrency(tendered - grand)));
    } else if (paid > grand) {
      lines.push(row2('Change Returned:', formatCurrency(paid - grand)));
    } else if (grand > paid) {
      lines.push(row2('Balance Due:', formatCurrency(grand - paid)));
    } else {
      lines.push(center('PAID IN FULL'));
    }
    lines.push(dashed);

    // Terms / Footer
    lines.push(center(invoice.terms || 'Thank you for your visit!'));
    lines.push(center('Goods once sold can be exchanged within 7 days.'));
    lines.push(center(`* ${invoice.invoiceNumber} *`));
    lines.push(divider);
    lines.push('\n\n\n\n'); // Spool paper feed

    return lines.join('\r\n');
  }

  /**
   * Format barcode sticker label for direct printing (TSPL & ESC/POS text representation)
   */
  formatBarcodeStickerText(label: BarcodeLabelData, widthMm: number = 50, heightMm: number = 25): string {
    const width = widthMm <= 40 ? 28 : widthMm <= 60 ? 36 : 48;
    const divider = '-'.repeat(width);
    const center = (str: string) => {
      const trimmed = (str || '').trim().slice(0, width);
      const pad = Math.max(0, Math.floor((width - trimmed.length) / 2));
      return ' '.repeat(pad) + trimmed;
    };

    const lines: string[] = [];
    lines.push(divider);
    lines.push(center(label.name || 'Product'));
    if (label.sku) {
      lines.push(center(`SKU: ${label.sku}`));
    }
    lines.push(divider);
    lines.push(center('|||| ||| |||||| ||||| ||||'));
    lines.push(center(label.barcode));
    lines.push(divider);
    if (label.sellingPrice !== undefined) {
      const priceStr = `Price: ${formatCurrency(label.sellingPrice)}`;
      const mrpStr = label.mrp ? ` | MRP: ${formatCurrency(label.mrp)}` : '';
      lines.push(center(priceStr + mrpStr));
    }
    lines.push(divider);
    lines.push('\n\n');
    return lines.join('\r\n');
  }

  /**
   * Direct Print Bill / Receipt
   */
  async printReceipt(
    invoice: SalesInvoice,
    company: CompanyProfile,
    options?: { copies?: number; printerName?: string; paperSize?: ReceiptPaperSize }
  ): Promise<PrintResult> {
    const config = this.getConfig();
    const paperSize = options?.paperSize || config.billPaperSize || '80mm';
    const printerName = options?.printerName || config.billPrinterName;
    const copies = options?.copies || 1;

    // Check if direct printing is enabled
    if (config.directPrintEnabled) {
      const bridgeStatus = await this.checkBridgeStatus(config.bridgeUrl);
      if (bridgeStatus.online) {
        try {
          const content = this.formatReceiptText(invoice, company, paperSize);
          const response = await fetch(`${config.bridgeUrl.replace(/\/+$/, '')}/print`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              printerName: printerName || undefined,
              jobType: 'receipt',
              title: `Bill ${invoice.invoiceNumber}`,
              copies,
              content
            })
          });

          const data = await response.json();
          if (response.ok && data.success) {
            return {
              success: true,
              mode: 'direct',
              printerName: data.printer || printerName || 'Default Receipt Printer',
              message: `Bill #${invoice.invoiceNumber} printed directly to ${data.printer || 'receipt printer'} (${copies} copy/copies).`,
              bridgeOnline: true
            };
          } else {
            const printError = data.error || 'Failed to send receipt to OS spooler';
            if (config.fallbackToBrowserPrint) {
              window.print();
              return {
                success: true,
                mode: 'fallback_browser',
                error: printError,
                message: `Direct printer spool failed (${printError}). Opened browser print dialog as fallback.`,
                bridgeOnline: true
              };
            }
            return {
              success: false,
              mode: 'direct',
              error: printError,
              message: `Direct printing failed: ${printError}`
            };
          }
        } catch (err: any) {
          console.error('[Direct Print Receipt Exception]:', err);
        }
      }
    }

    // Fallback: If direct printing is disabled or bridge offline
    if (config.fallbackToBrowserPrint) {
      window.print();
      return {
        success: true,
        mode: 'fallback_browser',
        message: config.directPrintEnabled
          ? 'Print bridge is currently offline. Opened browser print preview as fallback.'
          : 'Standard print dialog opened (Direct printing is disabled in Settings).'
      };
    }

    return {
      success: false,
      mode: 'none',
      message: 'Direct printing is currently offline and browser fallback is disabled.'
    };
  }

  /**
   * Direct Print Barcode Sticker
   */
  async printBarcodeSticker(
    labelData: BarcodeLabelData,
    copies: number = 1,
    options?: { printerName?: string; widthMm?: number; heightMm?: number }
  ): Promise<PrintResult> {
    const config = this.getConfig();
    const widthMm = options?.widthMm || config.barcodeLabelWidthMm || 50;
    const heightMm = options?.heightMm || config.barcodeLabelHeightMm || 25;
    const printerName = options?.printerName || config.barcodePrinterName;
    const copiesCount = Math.max(1, copies || config.defaultCopies || 1);

    if (config.directPrintEnabled) {
      const bridgeStatus = await this.checkBridgeStatus(config.bridgeUrl);
      if (bridgeStatus.online) {
        try {
          const content = this.formatBarcodeStickerText(labelData, widthMm, heightMm);
          const response = await fetch(`${config.bridgeUrl.replace(/\/+$/, '')}/print`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              printerName: printerName || undefined,
              jobType: 'barcode',
              title: `Barcode ${labelData.barcode}`,
              copies: copiesCount,
              content
            })
          });

          const data = await response.json();
          if (response.ok && data.success) {
            return {
              success: true,
              mode: 'direct',
              printerName: data.printer || printerName || 'Default Label Printer',
              message: `Sent ${copiesCount} barcode sticker(s) for "${labelData.name}" directly to ${data.printer || 'label printer'}.`,
              bridgeOnline: true
            };
          } else {
            const err = data.error || 'Label print spool failed';
            if (config.fallbackToBrowserPrint) {
              window.print();
              return {
                success: true,
                mode: 'fallback_browser',
                error: err,
                message: `Direct printer spool failed (${err}). Opened browser print dialog as fallback.`,
                bridgeOnline: true
              };
            }
            return {
              success: false,
              mode: 'direct',
              error: err,
              message: `Direct label printing failed: ${err}`
            };
          }
        } catch (err: any) {
          console.error('[Direct Print Label Exception]:', err);
        }
      }
    }

    // Fallback: Browser print dialog
    if (config.fallbackToBrowserPrint) {
      window.print();
      return {
        success: true,
        mode: 'fallback_browser',
        message: config.directPrintEnabled
          ? 'Print bridge is currently offline. Opened browser print preview for barcode sticker.'
          : 'Standard print dialog opened (Direct printing is disabled in Settings).'
      };
    }

    return {
      success: false,
      mode: 'none',
      message: 'Direct label printing bridge is offline and browser fallback is disabled.'
    };
  }

  /**
   * Test Print Bill / Receipt
   */
  async testPrintBill(printerName?: string, paperSize: ReceiptPaperSize = '80mm'): Promise<PrintResult> {
    const config = this.getConfig();
    const bridgeUrl = config.bridgeUrl || 'http://127.0.0.1:9191';
    try {
      const res = await fetch(`${bridgeUrl.replace(/\/+$/, '')}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testType: 'receipt',
          printerName: printerName || config.billPrinterName || undefined,
          paperSize
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        return {
          success: true,
          mode: 'direct',
          message: `Test receipt successfully spooled to "${printerName || config.billPrinterName || 'Default Printer'}".`
        };
      }
      return {
        success: false,
        mode: 'direct',
        error: data.error || 'Test print spooling failed',
        message: data.error || 'Failed to print test receipt.'
      };
    } catch (err: any) {
      return {
        success: false,
        mode: 'none',
        error: err?.message || 'Connection refused',
        message: 'Cannot reach direct print bridge on ' + bridgeUrl
      };
    }
  }

  /**
   * Test Print Barcode Label
   */
  async testPrintBarcode(printerName?: string, widthMm: number = 50, heightMm: number = 25): Promise<PrintResult> {
    const config = this.getConfig();
    const bridgeUrl = config.bridgeUrl || 'http://127.0.0.1:9191';
    try {
      const res = await fetch(`${bridgeUrl.replace(/\/+$/, '')}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testType: 'barcode',
          printerName: printerName || config.barcodePrinterName || undefined,
          widthMm,
          heightMm
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        return {
          success: true,
          mode: 'direct',
          message: `Test barcode sticker (${widthMm}x${heightMm}mm) successfully spooled to "${printerName || config.barcodePrinterName || 'Default Printer'}".`
        };
      }
      return {
        success: false,
        mode: 'direct',
        error: data.error || 'Test barcode label spooling failed',
        message: data.error || 'Failed to print test barcode sticker.'
      };
    } catch (err: any) {
      return {
        success: false,
        mode: 'none',
        error: err?.message || 'Connection refused',
        message: 'Cannot reach direct print bridge on ' + bridgeUrl
      };
    }
  }
}

export const directPrintService = new DirectPrintService();
