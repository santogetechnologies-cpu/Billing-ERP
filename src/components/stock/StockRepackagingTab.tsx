import React, { useState, useMemo } from 'react';
import {
  Boxes,
  Plus,
  Scale,
  Printer,
  TrendingUp,
  Tag,
  DollarSign,
  Package,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  QrCode,
  FileSpreadsheet,
  ArrowRight,
  Layers,
  Trash2,
  Eye,
  Check
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { Product, ProductRepackagingRun, RepackagingOutputItem } from '../../types';
import { formatCurrency, formatDate, formatNumber } from '../../utils/formatters';
import { Modal } from '../common/Modal';
import { directPrintService } from '../../services/directPrintService';

export const StockRepackagingTab: React.FC = () => {
  const { products, warehouses, company, repackagingRuns, createRepackagingRun } = useERP();
  const { profile } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRun, setSelectedRun] = useState<ProductRepackagingRun | null>(null);
  const [isPrintLabelsOpen, setIsPrintLabelsOpen] = useState(false);
  const [labelPrintRun, setLabelPrintRun] = useState<ProductRepackagingRun | null>(null);
  const [selectedLabelIndex, setSelectedLabelIndex] = useState<number>(0);
  const [labelsCountToPrint, setLabelsCountToPrint] = useState<number>(10);
  const [isPrinting, setIsPrinting] = useState(false);

  // Form State for New Repackaging
  const [sourceProductId, setSourceProductId] = useState<string>('');
  const [sourceQtyUsed, setSourceQtyUsed] = useState<number>(100);
  const [packagingCost, setPackagingCost] = useState<number>(150);
  const [laborCost, setLaborCost] = useState<number>(100);
  const [warehouseId, setWarehouseId] = useState<string>(
    company.defaultWarehouseId || warehouses[0]?.id || 'main'
  );
  const [notes, setNotes] = useState<string>('');

  // Repackaged Output Items
  const [outputs, setOutputs] = useState<
    {
      packSize: number;
      packUnit: string;
      outputQty: number;
      sellingPrice: number;
      variantName: string;
      barcode: string;
    }[]
  >([
    {
      packSize: 0.1, // 100g
      packUnit: 'Pkt',
      outputQty: 200,
      sellingPrice: 8,
      variantName: '100g Packet',
      barcode: `EAN-${Date.now().toString().slice(-6)}1`
    },
    {
      packSize: 0.25, // 250g
      packUnit: 'Pkt',
      outputQty: 120,
      sellingPrice: 18,
      variantName: '250g Packet',
      barcode: `EAN-${Date.now().toString().slice(-6)}2`
    },
    {
      packSize: 1.0, // 1kg
      packUnit: 'Bag',
      outputQty: 50,
      sellingPrice: 60,
      variantName: '1kg Bag',
      barcode: `EAN-${Date.now().toString().slice(-6)}3`
    }
  ]);

  const selectedSourceProduct = useMemo(() => {
    return products.find(p => p.id === sourceProductId);
  }, [products, sourceProductId]);

  // Bulk cost calculations
  const sourceCostPerUnit = selectedSourceProduct?.purchasePrice || selectedSourceProduct?.costPrice || 40;
  const sourceTotalCost = sourceQtyUsed * sourceCostPerUnit;
  const totalProductionCost = sourceTotalCost + Number(packagingCost || 0) + Number(laborCost || 0);

  // Output calculations
  const totalOutputWeight = useMemo(() => {
    return outputs.reduce((sum, item) => sum + (Number(item.packSize) * Number(item.outputQty)), 0);
  }, [outputs]);

  const weightDifference = sourceQtyUsed - totalOutputWeight;
  const shrinkageLossCost = weightDifference > 0 ? (weightDifference * sourceCostPerUnit) : 0;

  // Projected Revenue & Profit Calculations
  const totalProjectedRevenue = useMemo(() => {
    return outputs.reduce((sum, item) => sum + (Number(item.outputQty) * Number(item.sellingPrice)), 0);
  }, [outputs]);

  const projectedGrossProfit = totalProjectedRevenue - totalProductionCost;
  const projectedMarginPct = totalProjectedRevenue > 0
    ? (projectedGrossProfit / totalProjectedRevenue) * 100
    : 0;

  // Aggregate Performance Metrics across all historical runs
  const totalBatchesProcessed = repackagingRuns.length;
  const totalRawBulkConvertedKg = repackagingRuns.reduce((sum, r) => sum + (r.sourceQtyUsed || 0), 0);
  const totalPacketsProduced = repackagingRuns.reduce((sum, r) => {
    return sum + r.outputs.reduce((s, o) => s + (o.outputQty || 0), 0);
  }, 0);
  const totalProjectedRevenueAll = repackagingRuns.reduce((sum, r) => sum + (r.totalProjectedRevenue || 0), 0);
  const totalProductionCostAll = repackagingRuns.reduce((sum, r) => sum + (r.totalProductionCost || 0), 0);
  const totalValueAddProfit = totalProjectedRevenueAll - totalProductionCostAll;

  const handleAddOutputRow = () => {
    const nextIdx = outputs.length + 1;
    setOutputs(prev => [
      ...prev,
      {
        packSize: 0.5,
        packUnit: 'Pkt',
        outputQty: 20,
        sellingPrice: 32,
        variantName: `Variant ${nextIdx}`,
        barcode: `EAN-${Date.now().toString().slice(-6)}${nextIdx}`
      }
    ]);
  };

  const handleRemoveOutputRow = (index: number) => {
    if (outputs.length <= 1) return;
    setOutputs(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateOutput = (index: number, field: string, value: any) => {
    setOutputs(prev =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    );
  };

  const handleSubmitRepackaging = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceProductId || !selectedSourceProduct || outputs.length === 0) {
      alert('Please select a valid bulk source product and specify at least one packed output.');
      return;
    }

    if (sourceQtyUsed > selectedSourceProduct.currentStock) {
      if (!confirm(`Warning: Bulk source current stock is only ${selectedSourceProduct.currentStock} ${selectedSourceProduct.primaryUnit}. Proceed anyway?`)) {
        return;
      }
    }

    // Allocate landed cost per packet proportionally based on weight share
    const preparedOutputs: RepackagingOutputItem[] = outputs.map(item => {
      const weightShare = (Number(item.packSize) * Number(item.outputQty)) / (totalOutputWeight || 1);
      const allocatedTotalCost = totalProductionCost * weightShare;
      const costPerUnit = Math.round((allocatedTotalCost / (item.outputQty || 1)) * 100) / 100;
      const expectedRevenue = item.outputQty * item.sellingPrice;

      const targetProductName = `${selectedSourceProduct.name} - ${item.packSize}${selectedSourceProduct.primaryUnit || 'kg'} (${item.packUnit})`;

      return {
        targetProductId: `prod-pack-${item.packSize}-${Date.now()}`,
        targetProductName,
        packSize: Number(item.packSize),
        packUnit: item.packUnit,
        outputQty: Number(item.outputQty),
        costPerUnit,
        sellingPrice: Number(item.sellingPrice),
        expectedRevenue,
        barcode: item.barcode || `${Date.now().toString().slice(-8)}`,
        batchNumber: `BAT-${Date.now().toString().slice(-5)}`
      };
    });

    const wh = warehouses.find(w => w.id === warehouseId) || warehouses[0];

    try {
      const created = await createRepackagingRun({
        date: new Date().toISOString().split('T')[0],
        sourceProductId: selectedSourceProduct.id,
        sourceProductName: selectedSourceProduct.name,
        sourceUnit: selectedSourceProduct.primaryUnit || 'kg',
        sourceQtyUsed: Number(sourceQtyUsed),
        sourceCostPerUnit,
        sourceTotalCost,
        packagingMaterialCost: Number(packagingCost || 0),
        laborAndOverheadCost: Number(laborCost || 0),
        totalProductionCost,
        outputs: preparedOutputs,
        totalOutputWeightOrVolume: totalOutputWeight,
        wasteOrLossQty: Math.max(0, weightDifference),
        wasteOrLossCost: Math.max(0, shrinkageLossCost),
        totalProjectedRevenue,
        projectedGrossProfit,
        projectedMarginPercent: Math.round(projectedMarginPct * 10) / 10,
        warehouseId: wh?.id || 'main',
        warehouseName: wh?.name || 'Main Store',
        notes: notes.trim(),
        operatorName: profile?.fullName || 'Production Supervisor'
      });

      setIsModalOpen(false);
      setLabelPrintRun(created);
      setIsPrintLabelsOpen(true);
    } catch (err: any) {
      alert(`Error saving repackaging conversion: ${err?.message || 'Failed to process'}`);
    }
  };

  const handlePrintLabelsNow = async () => {
    if (!labelPrintRun) return;
    const item = labelPrintRun.outputs[selectedLabelIndex];
    if (!item) return;

    setIsPrinting(true);
    try {
      // Print via browser print preview or local thermal bridge
      const printWindow = window.open('', '_blank', 'width=450,height=600');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Print Labels - ${item.targetProductName}</title>
              <style>
                @page { size: 50mm 25mm; margin: 0; }
                body { font-family: monospace, sans-serif; margin: 0; padding: 4px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
                .label-box { width: 48mm; height: 23mm; border: 1px dashed #ccc; padding: 2px 4px; box-sizing: border-box; text-align: center; display: flex; flex-direction: column; justify-content: space-between; page-break-after: always; }
                .company-name { font-size: 8px; font-weight: bold; text-transform: uppercase; }
                .prod-name { font-size: 9px; font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin: 1px 0; }
                .barcode-code { font-size: 13px; font-weight: bold; letter-spacing: 2px; border: 1px solid #000; padding: 1px 4px; display: inline-block; }
                .price-row { display: flex; justify-content: space-between; font-size: 8px; font-weight: bold; }
                .mrp-strike { text-decoration: line-through; color: #555; }
              </style>
            </head>
            <body>
              ${Array.from({ length: labelsCountToPrint }).map(() => `
                <div class="label-box">
                  <div class="company-name">${company.name || 'Universal Store'}</div>
                  <div class="prod-name">${item.targetProductName}</div>
                  <div class="barcode-code">||| ${item.barcode || '12345678'} |||</div>
                  <div class="price-row">
                    <span>Net: ${item.packSize} ${labelPrintRun.sourceUnit}</span>
                    <span class="mrp-strike">MRP: ${formatCurrency(Math.round(item.sellingPrice * 1.15))}</span>
                    <span>OUR: ${formatCurrency(item.sellingPrice)}</span>
                  </div>
                </div>
              `).join('')}
              <script>
                window.onload = function() { window.print(); window.close(); }
              </script>
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Repackaging Batches
          </span>
          <span className="text-xl font-black text-slate-900 dark:text-white">
            {formatNumber(totalBatchesProcessed)}
          </span>
          <span className="text-[10px] text-slate-500 block">Completed transformations</span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Bulk Converted
          </span>
          <span className="text-xl font-black text-blue-600">
            {formatNumber(totalRawBulkConvertedKg)} <span className="text-xs font-semibold">kg / L</span>
          </span>
          <span className="text-[10px] text-slate-500 block">Deducted from raw inventory</span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Finished Packets
          </span>
          <span className="text-xl font-black text-indigo-600">
            {formatNumber(totalPacketsProduced)} <span className="text-xs font-semibold">pkts</span>
          </span>
          <span className="text-[10px] text-slate-500 block">Added to store shelf inventory</span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Projected Added Value
          </span>
          <span className="text-xl font-black text-emerald-600">
            {formatCurrency(totalValueAddProfit)}
          </span>
          <span className="text-[10px] text-slate-500 block">Revenue potential over cost</span>
        </div>
      </div>

      {/* Action Header Banner */}
      <div className="p-4.5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl border border-slate-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold border border-blue-400/30">
            <Scale className="w-3 h-3" />
            <span>Bulk-to-Retail Repackaging & Assembly</span>
          </div>
          <h2 className="text-base font-black tracking-tight">
            Convert Bulk Purchases to Packed Variants & Print Barcodes
          </h2>
          <p className="text-xs text-slate-300 max-w-xl">
            Take bulk goods (e.g. 100kg Sugar bag) and repack into consumer sizes (100g, 250g, 1kg packets). Automatically deducts bulk stock, creates packet items, computes landed cost, and tracks profit yield.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Repackaging Conversion</span>
        </button>
      </div>

      {/* Historical Repackaging Conversions Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Repackaging & Product Transformation Log</span>
          </h3>
          <span className="text-[11px] text-slate-400 font-mono">
            {repackagingRuns.length} conversion records
          </span>
        </div>

        {repackagingRuns.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Package className="w-10 h-10 text-slate-300 mx-auto stroke-1" />
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              No Repackaging Conversions Yet
            </p>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              Tap "New Repackaging Conversion" to unpack a 100kg bulk bag into 100g, 250g, or 1kg pouches with instant barcode labeling.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto text-[11px]">
            <table className="w-full text-left divide-y divide-slate-100 dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="p-3">Run #</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Bulk Source Item</th>
                  <th className="p-3">Qty Used</th>
                  <th className="p-3">Total Cost</th>
                  <th className="p-3">Packets Produced</th>
                  <th className="p-3">Projected Revenue</th>
                  <th className="p-3">Gross Margin</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-600 dark:text-slate-300">
                {repackagingRuns.map(run => {
                  const packetsSum = run.outputs.reduce((s, o) => s + o.outputQty, 0);

                  return (
                    <tr key={run.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="p-3 font-mono font-bold text-blue-600">{run.conversionNumber}</td>
                      <td className="p-3">{formatDate(run.date)}</td>
                      <td className="p-3 font-bold text-slate-900 dark:text-white">
                        {run.sourceProductName}
                      </td>
                      <td className="p-3 font-bold">
                        {run.sourceQtyUsed} {run.sourceUnit}
                      </td>
                      <td className="p-3 text-rose-600 font-bold">
                        {formatCurrency(run.totalProductionCost)}
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-indigo-600">{packetsSum} packets</span>
                        <span className="block text-[10px] text-slate-400 truncate max-w-[140px]">
                          {run.outputs.map(o => `${o.outputQty}x ${o.packSize}${run.sourceUnit}`).join(', ')}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-emerald-600">
                        {formatCurrency(run.totalProjectedRevenue)}
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full text-[10px]">
                          <TrendingUp className="w-3 h-3" />
                          +{formatCurrency(run.projectedGrossProfit)} ({run.projectedMarginPercent}%)
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setLabelPrintRun(run);
                              setIsPrintLabelsOpen(true);
                            }}
                            title="Print Barcode Labels"
                            className="p-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedRun(run)}
                            title="View Details"
                            className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* MODAL: START NEW REPACKAGING CONVERSION */}
      {/* ===================================================================== */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Start Bulk Repackaging & Conversion"
        size="2xl"
      >
        <form onSubmit={handleSubmitRepackaging} className="space-y-5 text-xs">
          {/* Section 1: Bulk Source Item Selection */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-3">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Package className="w-4 h-4 text-blue-600" />
              <span>1. Bulk Source Material</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Select Bulk Product to Repack
                </label>
                <select
                  required
                  value={sourceProductId}
                  onChange={e => setSourceProductId(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  <option value="">-- Choose bulk raw product --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Stock: {p.currentStock} {p.primaryUnit} @ {formatCurrency(p.purchasePrice || p.costPrice)}/{p.primaryUnit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Quantity to Consume ({selectedSourceProduct?.primaryUnit || 'Units'})
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  required
                  value={sourceQtyUsed}
                  onChange={e => setSourceQtyUsed(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                />
              </div>
            </div>

            {selectedSourceProduct && (
              <div className="flex items-center justify-between text-[11px] pt-1 text-slate-500">
                <span>Current Available Stock: <strong>{selectedSourceProduct.currentStock} {selectedSourceProduct.primaryUnit}</strong></span>
                <span>Material Cost: <strong>{formatCurrency(sourceTotalCost)}</strong></span>
              </div>
            )}
          </div>

          {/* Section 2: Conversion Overheads (Packaging Material & Packing Labor) */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-3">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-amber-500" />
              <span>2. Packaging & Labor Overheads</span>
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Packaging Pouches / Boxes / Stickers (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={packagingCost}
                  onChange={e => setPackagingCost(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Packing Labor & Operations Cost (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={laborCost}
                  onChange={e => setLaborCost(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
              <span>Total Landed Conversion Cost:</span>
              <span className="text-rose-600 text-sm font-black">{formatCurrency(totalProductionCost)}</span>
            </div>
          </div>

          {/* Section 3: Output Packaged Variants */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Boxes className="w-4 h-4 text-emerald-600" />
                <span>3. Finished Packaged Variants to Create / Restock</span>
              </h4>
              <button
                type="button"
                onClick={handleAddOutputRow}
                className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-lg font-bold text-[11px] hover:bg-blue-100 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Add Variant
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {outputs.map((out, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 grid grid-cols-12 gap-2 items-center"
                >
                  <div className="col-span-3">
                    <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Variant Label</label>
                    <input
                      type="text"
                      required
                      value={out.variantName}
                      onChange={e => handleUpdateOutput(idx, 'variantName', e.target.value)}
                      placeholder="e.g. 100g Packet"
                      className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Pack Size</label>
                    <input
                      type="number"
                      step="any"
                      min="0.001"
                      required
                      value={out.packSize}
                      onChange={e => handleUpdateOutput(idx, 'packSize', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Packets</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={out.outputQty}
                      onChange={e => handleUpdateOutput(idx, 'outputQty', parseInt(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Sale Rate (₹)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      required
                      value={out.sellingPrice}
                      onChange={e => handleUpdateOutput(idx, 'sellingPrice', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-emerald-600"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Barcode</label>
                    <input
                      type="text"
                      value={out.barcode}
                      onChange={e => handleUpdateOutput(idx, 'barcode', e.target.value)}
                      placeholder="Barcode"
                      className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-mono font-bold"
                    />
                  </div>

                  <div className="col-span-1 text-right pt-3">
                    <button
                      type="button"
                      onClick={() => handleRemoveOutputRow(idx)}
                      disabled={outputs.length <= 1}
                      className="text-slate-400 hover:text-rose-500 disabled:opacity-30 cursor-pointer p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Weight Discrepancy & Revenue Preview Card */}
            <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300">
                  <Scale className="w-4 h-4" />
                  <span>Weight Verification:</span>
                </span>
                <span className={weightDifference === 0 ? 'text-emerald-600 font-black' : 'text-amber-600 font-bold'}>
                  {totalOutputWeight} {selectedSourceProduct?.primaryUnit || 'kg'} packed of {sourceQtyUsed} {selectedSourceProduct?.primaryUnit || 'kg'} consumed
                  {weightDifference !== 0 && ` (${weightDifference > 0 ? `${weightDifference}kg shrinkage/loss` : `${Math.abs(weightDifference)}kg surplus`})`}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-blue-200/40 text-[11px]">
                <div>
                  <span className="text-slate-500 block">Total Packaged Revenue:</span>
                  <strong className="text-emerald-600 font-black text-xs">{formatCurrency(totalProjectedRevenue)}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Total Conversion Cost:</span>
                  <strong className="text-rose-600 font-black text-xs">{formatCurrency(totalProductionCost)}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Projected Profit Yield:</span>
                  <strong className="text-indigo-600 font-black text-xs">
                    +{formatCurrency(projectedGrossProfit)} ({Math.round(projectedMarginPct)}%)
                  </strong>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Convert & Update Stock</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* ===================================================================== */}
      {/* MODAL: PRINT BARCODE LABELS FOR OUTPUT PACKS */}
      {/* ===================================================================== */}
      <Modal
        isOpen={isPrintLabelsOpen}
        onClose={() => setIsPrintLabelsOpen(false)}
        title="Print Barcode Stickers for Repackaged Items"
        size="lg"
      >
        {labelPrintRun && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
              <span className="font-bold text-slate-900 dark:text-white block">
                Repackaging Run: {labelPrintRun.conversionNumber} ({labelPrintRun.sourceProductName})
              </span>
              <p className="text-[11px] text-slate-500">
                Choose the packaged packet size and print thermal sticker labels with barcode, weight, and pricing for your store shelves.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block font-bold text-slate-700 dark:text-slate-300">
                Select Output Packet Variant to Label:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {labelPrintRun.outputs.map((out, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSelectedLabelIndex(idx);
                      setLabelsCountToPrint(out.outputQty);
                    }}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      selectedLabelIndex === idx
                        ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 shadow-2xs font-bold'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <span className="block font-bold truncate">{out.targetProductName}</span>
                    <span className="text-[11px] block mt-0.5 text-slate-500">
                      {out.outputQty} pkts @ {formatCurrency(out.sellingPrice)}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 block mt-1">
                      {out.barcode}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Label Preview Card */}
            {labelPrintRun.outputs[selectedLabelIndex] && (
              <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center space-y-2 text-center max-w-xs mx-auto">
                <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">
                  {company.name || 'Universal ERP Store'}
                </span>
                <span className="font-bold text-xs text-slate-900 dark:text-white">
                  {labelPrintRun.outputs[selectedLabelIndex].targetProductName}
                </span>
                <div className="p-2 bg-slate-100 dark:bg-slate-900 rounded font-mono font-bold text-xs tracking-widest border border-slate-200 dark:border-slate-800">
                  ||| {labelPrintRun.outputs[selectedLabelIndex].barcode} |||
                </div>
                <div className="flex items-center gap-3 text-[11px] font-bold">
                  <span>Net: {labelPrintRun.outputs[selectedLabelIndex].packSize} {labelPrintRun.sourceUnit}</span>
                  <span className="text-emerald-600 text-sm">
                    {formatCurrency(labelPrintRun.outputs[selectedLabelIndex].sellingPrice)}
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <label className="font-bold text-slate-700 dark:text-slate-300">Stickers to Print:</label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={labelsCountToPrint}
                  onChange={e => setLabelsCountToPrint(parseInt(e.target.value) || 1)}
                  className="w-20 px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-center"
                />
              </div>

              <button
                type="button"
                onClick={handlePrintLabelsNow}
                disabled={isPrinting}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 text-xs disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                <span>{isPrinting ? 'Printing...' : 'Print Barcode Labels'}</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ===================================================================== */}
      {/* MODAL: VIEW CONVERSION RUN DETAILS */}
      {/* ===================================================================== */}
      {selectedRun && (
        <Modal
          isOpen={Boolean(selectedRun)}
          onClose={() => setSelectedRun(null)}
          title={`Repackaging Run Details: ${selectedRun.conversionNumber}`}
          size="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <span className="text-[10px] text-slate-400 block font-bold">Date</span>
                <span className="font-bold">{formatDate(selectedRun.date)}</span>
              </div>
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <span className="text-[10px] text-slate-400 block font-bold">Bulk Consumed</span>
                <span className="font-bold">{selectedRun.sourceQtyUsed} {selectedRun.sourceUnit}</span>
              </div>
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <span className="text-[10px] text-slate-400 block font-bold">Total Cost</span>
                <span className="font-bold text-rose-600">{formatCurrency(selectedRun.totalProductionCost)}</span>
              </div>
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <span className="text-[10px] text-slate-400 block font-bold">Gross Yield</span>
                <span className="font-bold text-emerald-600">+{formatCurrency(selectedRun.projectedGrossProfit)}</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <table className="w-full text-left divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                <thead className="bg-slate-50 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="p-2.5">Output Variant</th>
                    <th className="p-2.5">Pack Size</th>
                    <th className="p-2.5">Quantity</th>
                    <th className="p-2.5">Cost/Pkt</th>
                    <th className="p-2.5">Sale Price</th>
                    <th className="p-2.5">Expected Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-600 dark:text-slate-300">
                  {selectedRun.outputs.map((out, idx) => (
                    <tr key={idx}>
                      <td className="p-2.5 font-bold text-slate-900 dark:text-white">{out.targetProductName}</td>
                      <td className="p-2.5">{out.packSize} {selectedRun.sourceUnit}</td>
                      <td className="p-2.5 font-bold">{out.outputQty} {out.packUnit}</td>
                      <td className="p-2.5 text-slate-500">{formatCurrency(out.costPerUnit)}</td>
                      <td className="p-2.5 font-bold text-emerald-600">{formatCurrency(out.sellingPrice)}</td>
                      <td className="p-2.5 font-bold">{formatCurrency(out.expectedRevenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedRun(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
