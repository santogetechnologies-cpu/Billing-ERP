import React, { useState } from 'react';
import { Download, Upload, FileSpreadsheet, AlertTriangle, Check, Loader2, ArrowRight } from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import * as XLSX from 'xlsx';
import { UNIVERSAL_UNIT_LIST, normalizeUniversalUnit } from '../../utils/universalUnitSystem';

interface ParsedRow {
  rowNumber: number;
  name: string;
  category: string;
  baseUnit: string;
  sellingPrice: number;
  costPrice: number;
  taxRate: number;
  openingStock: number;
  sku: string;
  barcode: string;
  errors: string[];
}

export const ProductImportExportTab: React.FC = () => {
  const { products, addProduct, refreshData } = useERP();
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importSummary, setImportSummary] = useState<{ imported: number; failed: number } | null>(null);

  // Download Sample Excel Template
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Product Name': 'Paracetamol 500mg (Sample Pharma)',
        'Category': 'Pharmacy',
        'Base Unit (PCS/STRIP/TAB/BOX/SET/KG/LTR/MTR/SQF)': 'STRIP',
        'Sale Price': 35.0,
        'Cost Price': 22.0,
        'Tax Rate %': 12,
        'Opening Stock': 100,
        'Product Code / SKU': 'PARA-500',
        'Barcode': '8901234567890'
      },
      {
        'Product Name': 'Basmati Rice Premium (Sample Grocery)',
        'Category': 'Groceries',
        'Base Unit (PCS/STRIP/TAB/BOX/SET/KG/LTR/MTR/SQF)': 'KG',
        'Sale Price': 120.0,
        'Cost Price': 90.0,
        'Tax Rate %': 0,
        'Opening Stock': 250.5,
        'Product Code / SKU': 'RICE-BAS-01',
        'Barcode': '8909876543210'
      },
      {
        'Product Name': 'Ceramic Floor Tiles 2x2 (Sample Hardware)',
        'Category': 'Hardware',
        'Base Unit (PCS/STRIP/TAB/BOX/SET/KG/LTR/MTR/SQF)': 'SQF',
        'Sale Price': 65.0,
        'Cost Price': 45.0,
        'Tax Rate %': 18,
        'Opening Stock': 500,
        'Product Code / SKU': 'TILE-2X2-WHITE',
        'Barcode': '8905678123456'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Product_Template');
    XLSX.writeFile(wb, 'Universal_Billing_Product_Import_Template.xlsx');
  };

  // Export Catalogue to Excel
  const handleExportCatalogue = () => {
    const exportData = products.map(p => ({
      'Product Name': p.name,
      'SKU': p.sku,
      'Barcode': p.barcode,
      'Category': p.category,
      'Base Unit': p.primaryUnit,
      'Cost Price': p.costPrice || p.purchasePrice || 0,
      'Selling Price': p.sellingPrice,
      'Wholesale Price': p.wholesalePrice || p.sellingPrice,
      'Dealer Price': p.dealerPrice || p.sellingPrice,
      'Tax Rate %': p.taxRate,
      'Current Stock': p.currentStock,
      'Reorder Level': p.reorderLevel || 5
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, `Products_Catalogue_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Upload and parse CSV / XLSX
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportSummary(null);
    const reader = new FileReader();

    reader.onload = evt => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws);

        const rows: ParsedRow[] = rawJson.map((row, idx) => {
          const rowNum = idx + 2;
          const errors: string[] = [];

          const rawName = row['Product Name'] || row['name'] || row['Product'] || '';
          if (!String(rawName).trim()) {
            errors.push('Missing product name');
          }

          const rawUnit = row['Base Unit (PCS/STRIP/TAB/BOX/SET/KG/LTR/MTR/SQF)'] || row['Base Unit'] || row['unit'] || 'PCS';
          const unit = normalizeUniversalUnit(rawUnit);

          const rawPrice = parseFloat(row['Sale Price'] || row['sellingPrice'] || row['Price'] || '0');
          if (isNaN(rawPrice) || rawPrice < 0) {
            errors.push('Invalid sale price');
          }

          const rawCost = parseFloat(row['Cost Price'] || row['costPrice'] || '0');
          const rawStock = parseFloat(row['Opening Stock'] || row['currentStock'] || '0');

          return {
            rowNumber: rowNum,
            name: String(rawName).trim(),
            category: String(row['Category'] || row['category'] || 'General').trim(),
            baseUnit: unit,
            sellingPrice: rawPrice || 0,
            costPrice: isNaN(rawCost) ? 0 : rawCost,
            taxRate: parseFloat(row['Tax Rate %'] || row['taxRate'] || '18') || 0,
            openingStock: isNaN(rawStock) ? 0 : rawStock,
            sku: String(row['Product Code / SKU'] || row['sku'] || '').trim(),
            barcode: String(row['Barcode'] || row['barcode'] || '').trim(),
            errors
          };
        });

        setParsedRows(rows);
      } catch (err: any) {
        alert('Failed to parse file: ' + err.message);
      }
    };

    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // Commit Import
  const handleCommitImport = async () => {
    const validRows = parsedRows.filter(r => r.errors.length === 0);
    if (validRows.length === 0) return;

    setIsProcessing(true);
    let imported = 0;
    let failed = 0;

    for (const r of validRows) {
      try {
        await addProduct({
          name: r.name,
          category: r.category,
          primaryUnit: r.baseUnit,
          sellingPrice: r.sellingPrice,
          purchasePrice: r.costPrice,
          costPrice: r.costPrice,
          retailPrice: r.sellingPrice,
          mrp: r.sellingPrice,
          minSellingPrice: r.costPrice,
          taxRate: r.taxRate,
          openingStock: r.openingStock,
          openingStockValue: r.openingStock * r.costPrice,
          currentStock: r.openingStock,
          sku: r.sku || `SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          code: r.sku || `SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          barcode: r.barcode || String(Math.floor(100000000000 + Math.random() * 900000000000)),
          brand: 'General',
          description: 'Imported via CSV/Excel template',
          hsn: '',
          warehouse: 'Main Warehouse',
          rack: '',
          batchTracking: false,
          serialTracking: false,
          expiryTracking: false,
          isActive: true
        });
        imported++;
      } catch {
        failed++;
      }
    }

    setIsProcessing(false);
    setImportSummary({ imported, failed });
    setParsedRows([]);
    await refreshData();
  };

  const validCount = parsedRows.filter(r => r.errors.length === 0).length;
  const errorCount = parsedRows.filter(r => r.errors.length > 0).length;

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Download Template & Upload Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Template & Export Card */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Download & Export</h3>
              <p className="text-xs text-slate-500">Standard Excel templates and live stock backup.</p>
            </div>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400">
            Download our standard 9-unit pre-formatted template with sample rows for groceries, pharma, and hardware.
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
            >
              <Download className="w-4 h-4 text-blue-600" />
              <span>Download Excel Template</span>
            </button>

            <button
              type="button"
              onClick={handleExportCatalogue}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>Export All Products ({products.length})</span>
            </button>
          </div>
        </div>

        {/* Upload File Card */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Import Catalogue</h3>
              <p className="text-xs text-slate-500">Upload .xlsx or .csv files with row validation preview.</p>
            </div>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400">
            Never imports silently. Inspect rows, error flags, and converted 9-unit codes before saving to database.
          </p>

          <div>
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs cursor-pointer transition-all">
              <Upload className="w-4 h-4" />
              <span>Choose Excel / CSV File</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {importSummary && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-emerald-800 dark:text-emerald-300 rounded-2xl text-xs flex items-center justify-between">
          <span>Import complete! Successfully saved <strong>{importSummary.imported}</strong> products ({importSummary.failed} failed).</span>
          <button
            onClick={() => setImportSummary(null)}
            className="text-emerald-700 font-bold hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Upload Preview & Row Error Report Table (Part F Rule) */}
      {parsedRows.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden space-y-3 p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Import Preview ({parsedRows.length} Rows Detected)
              </h4>
              <p className="text-xs text-slate-500">
                <span className="text-emerald-600 font-semibold">{validCount} valid</span>
                {errorCount > 0 && (
                  <span className="text-rose-600 font-semibold ml-2">({errorCount} require attention)</span>
                )}
              </p>
            </div>

            <button
              type="button"
              disabled={isProcessing || validCount === 0}
              onClick={handleCommitImport}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Confirm & Save {validCount} Products</span>
                </>
              )}
            </button>
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold sticky top-0">
                <tr>
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Product Name</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Unit</th>
                  <th className="px-3 py-2 text-right">Sale Price</th>
                  <th className="px-3 py-2 text-right">Opening Stock</th>
                  <th className="px-3 py-2">Validation Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {parsedRows.map(r => (
                  <tr
                    key={r.rowNumber}
                    className={r.errors.length > 0 ? 'bg-rose-50/50 dark:bg-rose-950/20' : 'hover:bg-slate-50/50'}
                  >
                    <td className="px-3 py-2 font-mono text-slate-400">{r.rowNumber}</td>
                    <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-200">{r.name || '—'}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{r.category}</td>
                    <td className="px-3 py-2 font-bold text-blue-600">{r.baseUnit}</td>
                    <td className="px-3 py-2 text-right font-mono font-medium">{r.sellingPrice}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.openingStock}</td>
                    <td className="px-3 py-2">
                      {r.errors.length === 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                          <Check className="w-3.5 h-3.5" /> Valid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600">
                          <AlertTriangle className="w-3.5 h-3.5" /> {r.errors.join(', ')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

