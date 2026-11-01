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
  Check,
  Gift,
  Boxes as UnboxIcon,
  ChevronRight
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import {
  Product,
  ProductRepackagingRun,
  RepackagingOutputItem,
  ComboKitRun,
  ComboKitComponent,
  DebundlingRun
} from '../../types';
import { formatCurrency, formatDate, formatNumber } from '../../utils/formatters';
import { Modal } from '../common/Modal';

export const StockRepackagingTab: React.FC = () => {
  const {
    products,
    warehouses,
    company,
    repackagingRuns,
    createRepackagingRun,
    comboKitRuns,
    createComboKitRun,
    debundlingRuns,
    createDebundlingRun
  } = useERP();
  const { profile } = useAuth();

  const [activeSubTab, setActiveSubTab] = useState<'repackaging' | 'combo_kits' | 'debundling'>('repackaging');

  // =========================================================================
  // SUB-TAB 1: BULK REPACKAGING STATE
  // =========================================================================
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRun, setSelectedRun] = useState<ProductRepackagingRun | null>(null);
  const [isPrintLabelsOpen, setIsPrintLabelsOpen] = useState(false);
  const [labelPrintRun, setLabelPrintRun] = useState<ProductRepackagingRun | null>(null);
  const [selectedLabelIndex, setSelectedLabelIndex] = useState<number>(0);
  const [labelsCountToPrint, setLabelsCountToPrint] = useState<number>(10);
  const [isPrinting, setIsPrinting] = useState(false);

  const [sourceProductId, setSourceProductId] = useState<string>('');
  const [sourceQtyUsed, setSourceQtyUsed] = useState<number>(100);
  const [packagingCost, setPackagingCost] = useState<number>(150);
  const [laborCost, setLaborCost] = useState<number>(100);
  const [warehouseId, setWarehouseId] = useState<string>(
    company.defaultWarehouseId || warehouses[0]?.id || 'main'
  );
  const [notes, setNotes] = useState<string>('');

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
      packSize: 0.1,
      packUnit: 'Pkt',
      outputQty: 200,
      sellingPrice: 8,
      variantName: '100g Packet',
      barcode: `EAN-${Date.now().toString().slice(-6)}1`
    },
    {
      packSize: 0.25,
      packUnit: 'Pkt',
      outputQty: 120,
      sellingPrice: 18,
      variantName: '250g Packet',
      barcode: `EAN-${Date.now().toString().slice(-6)}2`
    },
    {
      packSize: 1.0,
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

  const sourceCostPerUnit = selectedSourceProduct?.purchasePrice || selectedSourceProduct?.costPrice || 40;
  const sourceTotalCost = sourceQtyUsed * sourceCostPerUnit;
  const totalProductionCost = sourceTotalCost + Number(packagingCost || 0) + Number(laborCost || 0);

  const totalOutputWeight = useMemo(() => {
    return outputs.reduce((sum, item) => sum + (Number(item.packSize) * Number(item.outputQty)), 0);
  }, [outputs]);

  const weightDifference = sourceQtyUsed - totalOutputWeight;
  const shrinkageLossCost = weightDifference > 0 ? (weightDifference * sourceCostPerUnit) : 0;

  const totalProjectedRevenue = useMemo(() => {
    return outputs.reduce((sum, item) => sum + (Number(item.outputQty) * Number(item.sellingPrice)), 0);
  }, [outputs]);

  const projectedGrossProfit = totalProjectedRevenue - totalProductionCost;
  const projectedMarginPct = totalProjectedRevenue > 0
    ? (projectedGrossProfit / totalProjectedRevenue) * 100
    : 0;

  // =========================================================================
  // SUB-TAB 2: COMBO KITTING / GIFT HAMPER (BOM) STATE
  // =========================================================================
  const [isKitModalOpen, setIsKitModalOpen] = useState(false);
  const [comboName, setComboName] = useState<string>('Festival Gift Hamper');
  const [comboSku, setComboSku] = useState<string>(`KIT-${Date.now().toString().slice(-4)}`);
  const [comboBarcode, setComboBarcode] = useState<string>(`EAN-${Date.now().toString().slice(-6)}`);
  const [kitsToProduce, setKitsToProduce] = useState<number>(50);
  const [kitAssemblyLabor, setKitAssemblyLabor] = useState<number>(200);
  const [kitPackagingCost, setKitPackagingCost] = useState<number>(300);
  const [kitSellingPrice, setKitSellingPrice] = useState<number>(899);

  const [kitComponents, setKitComponents] = useState<
    { productId: string; qty: number }[]
  >([
    { productId: products[0]?.id || '', qty: 1 },
    { productId: products[1]?.id || '', qty: 1 }
  ]);

  const resolvedKitComponents = useMemo(() => {
    return kitComponents.map(c => {
      const p = products.find(prod => prod.id === c.productId);
      return {
        productId: c.productId,
        productName: p?.name || 'Item',
        qty: c.qty,
        unit: p?.primaryUnit || 'Pcs',
        costPrice: p?.costPrice || p?.purchasePrice || 100
      };
    });
  }, [kitComponents, products]);

  const totalComponentCostPerKit = resolvedKitComponents.reduce(
    (sum, c) => sum + (c.costPrice * c.qty),
    0
  );
  const totalComponentsBatchCost = totalComponentCostPerKit * kitsToProduce;
  const totalKitLandedCost = totalComponentsBatchCost + Number(kitAssemblyLabor || 0) + Number(kitPackagingCost || 0);
  const costPerSingleKit = kitsToProduce > 0 ? (totalKitLandedCost / kitsToProduce) : 0;
  const totalKitProjectedRevenue = kitsToProduce * kitSellingPrice;
  const totalKitGrossProfit = totalKitProjectedRevenue - totalKitLandedCost;

  // =========================================================================
  // SUB-TAB 3: DE-BUNDLING (CASE-TO-UNITS) STATE
  // =========================================================================
  const [isDebundleModalOpen, setIsDebundleModalOpen] = useState(false);
  const [debundleCaseProductId, setDebundleCaseProductId] = useState<string>('');
  const [casesToOpen, setCasesToOpen] = useState<number>(5);
  const [unitsPerCase, setUnitsPerCase] = useState<number>(24);
  const [looseProductName, setLooseProductName] = useState<string>('');
  const [looseSellingPrice, setLooseSellingPrice] = useState<number>(20);

  const selectedCaseProduct = useMemo(() => {
    return products.find(p => p.id === debundleCaseProductId);
  }, [products, debundleCaseProductId]);

  const caseCost = selectedCaseProduct?.purchasePrice || selectedCaseProduct?.costPrice || 240;
  const totalCasesCost = casesToOpen * caseCost;
  const totalLooseProduced = casesToOpen * unitsPerCase;
  const costPerLooseUnit = totalLooseProduced > 0 ? (totalCasesCost / totalLooseProduced) : 0;
  const totalDebundleRevenue = totalLooseProduced * looseSellingPrice;

  // Aggregate Metrics across all transformation runs
  const totalBulkKgConverted = repackagingRuns.reduce((sum: number, r: ProductRepackagingRun) => sum + (r.sourceQtyUsed || 0), 0);
  const totalPacketsProduced = repackagingRuns.reduce((sum: number, r: ProductRepackagingRun) => {
    return sum + r.outputs.reduce((s: number, o: RepackagingOutputItem) => s + (o.outputQty || 0), 0);
  }, 0);
  const totalKitsProduced = comboKitRuns.reduce((sum, k) => sum + k.kitsProduced, 0);
  const totalCasesDebundled = debundlingRuns.reduce((sum, d) => sum + d.casesOpened, 0);

  // Handlers for Bulk Repackaging
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

  // Handlers for Combo Kit
  const handleSubmitComboKit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comboName.trim() || resolvedKitComponents.length === 0 || kitsToProduce <= 0) return;

    const wh = warehouses.find(w => w.id === warehouseId) || warehouses[0];

    try {
      await createComboKitRun({
        comboProductName: comboName.trim(),
        comboSku: comboSku.trim(),
        comboBarcode: comboBarcode.trim(),
        kitsProduced: kitsToProduce,
        components: resolvedKitComponents,
        totalComponentCost: totalComponentsBatchCost,
        assemblyLaborCost: Number(kitAssemblyLabor || 0),
        packagingCost: Number(kitPackagingCost || 0),
        totalLandedCost: totalKitLandedCost,
        costPerKit: Math.round(costPerSingleKit * 100) / 100,
        sellingPrice: Number(kitSellingPrice),
        projectedRevenue: totalKitProjectedRevenue,
        grossMarginPct: totalKitProjectedRevenue > 0 ? Math.round(((totalKitGrossProfit / totalKitProjectedRevenue) * 100) * 10) / 10 : 0,
        warehouseId: wh?.id || 'main',
        warehouseName: wh?.name || 'Main Store',
        notes: `Assembled ${kitsToProduce} kits`
      });

      setIsKitModalOpen(false);
    } catch (err: any) {
      alert(`Error assembling combo kit: ${err?.message || 'Failed'}`);
    }
  };

  // Handlers for De-bundling
  const handleSubmitDebundling = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseProduct || casesToOpen <= 0 || unitsPerCase <= 0) return;

    const looseName = looseProductName.trim() || `${selectedCaseProduct.name} (Single Piece)`;
    const wh = warehouses.find(w => w.id === warehouseId) || warehouses[0];

    try {
      await createDebundlingRun({
        caseProductId: selectedCaseProduct.id,
        caseProductName: selectedCaseProduct.name,
        casesOpened: casesToOpen,
        caseCostPrice: caseCost,
        totalCaseCost: totalCasesCost,
        looseProductId: `prod-loose-${Date.now()}`,
        looseProductName: looseName,
        looseBarcode: `EAN-${Date.now().toString().slice(-6)}`,
        unitsPerCase,
        totalLooseUnitsProduced: totalLooseProduced,
        costPerUnit: Math.round(costPerLooseUnit * 100) / 100,
        sellingPricePerUnit: Number(looseSellingPrice),
        projectedRevenue: totalDebundleRevenue,
        grossMarginPct: totalDebundleRevenue > 0 ? Math.round((((totalDebundleRevenue - totalCasesCost) / totalDebundleRevenue) * 100) * 10) / 10 : 0,
        warehouseId: wh?.id || 'main',
        warehouseName: wh?.name || 'Main Store',
        notes: `Unboxed ${casesToOpen} cases into ${totalLooseProduced} pieces`
      });

      setIsDebundleModalOpen(false);
    } catch (err: any) {
      alert(`Error de-bundling cases: ${err?.message || 'Failed'}`);
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn text-xs">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Bulk Repackaging
          </span>
          <span className="text-xl font-black text-blue-600">
            {formatNumber(totalBulkKgConverted)} <span className="text-xs font-semibold">kg / L</span>
          </span>
          <span className="text-[10px] text-slate-500 block">{formatNumber(totalPacketsProduced)} consumer packets created</span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Combo Kits / Hampers
          </span>
          <span className="text-xl font-black text-purple-600">
            {formatNumber(totalKitsProduced)} <span className="text-xs font-semibold">kits</span>
          </span>
          <span className="text-[10px] text-slate-500 block">Multi-item gift hampers assembled</span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Cases De-Bundled
          </span>
          <span className="text-xl font-black text-amber-600">
            {formatNumber(totalCasesDebundled)} <span className="text-xs font-semibold">cases</span>
          </span>
          <span className="text-[10px] text-slate-500 block">Unpacked into loose shelf units</span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Transformation Modes
          </span>
          <span className="text-xl font-black text-emerald-600">3 Modes</span>
          <span className="text-[10px] text-slate-500 block">Bulk Repack · Kits · De-bundling</span>
        </div>
      </div>

      {/* Sub-Tabs Selector */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('repackaging')}
            className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'repackaging'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>1. Bulk-to-Retail Repackaging ({repackagingRuns.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('combo_kits')}
            className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'combo_kits'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            <Gift className="w-4 h-4" />
            <span>2. Combo Kits & Hampers ({comboKitRuns.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('debundling')}
            className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'debundling'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            <UnboxIcon className="w-4 h-4" />
            <span>3. Case De-Bundling & Unboxing ({debundlingRuns.length})</span>
          </button>
        </div>

        {activeSubTab === 'repackaging' && (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Bulk Repackaging</span>
          </button>
        )}

        {activeSubTab === 'combo_kits' && (
          <button
            type="button"
            onClick={() => setIsKitModalOpen(true)}
            className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Assemble Combo Kit / Hamper</span>
          </button>
        )}

        {activeSubTab === 'debundling' && (
          <button
            type="button"
            onClick={() => setIsDebundleModalOpen(true)}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Unbox Master Case</span>
          </button>
        )}
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: BULK REPACKAGING TABLE */}
      {/* ===================================================================== */}
      {activeSubTab === 'repackaging' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
          {repackagingRuns.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Package className="w-10 h-10 text-slate-300 mx-auto stroke-1" />
              <p className="font-bold text-slate-700 dark:text-slate-300">No Bulk Repackaging Runs</p>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                Convert a 100kg bulk bag into 100g, 250g, or 1kg consumer packets with thermal barcode labels.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto text-[11px]">
              <table className="w-full text-left divide-y divide-slate-100 dark:divide-slate-800">
                <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="p-3">Run #</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Bulk Item Consumed</th>
                    <th className="p-3">Packets Produced</th>
                    <th className="p-3">Total Cost</th>
                    <th className="p-3">Projected Revenue</th>
                    <th className="p-3">Gross Margin</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-600 dark:text-slate-300">
                  {repackagingRuns.map((run: ProductRepackagingRun) => {
                    const packetsSum = run.outputs.reduce((s: number, o: RepackagingOutputItem) => s + o.outputQty, 0);

                    return (
                      <tr key={run.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="p-3 font-mono font-bold text-blue-600">{run.conversionNumber}</td>
                        <td className="p-3">{formatDate(run.date)}</td>
                        <td className="p-3 font-bold text-slate-900 dark:text-white">
                          {run.sourceProductName} ({run.sourceQtyUsed} {run.sourceUnit})
                        </td>
                        <td className="p-3">
                          <span className="font-bold text-indigo-600">{packetsSum} packets</span>
                          <span className="block text-[10px] text-slate-400">
                            {run.outputs.map((o: RepackagingOutputItem) => `${o.outputQty}x ${o.packSize}${run.sourceUnit}`).join(', ')}
                          </span>
                        </td>
                        <td className="p-3 text-rose-600 font-bold">{formatCurrency(run.totalProductionCost)}</td>
                        <td className="p-3 font-bold text-emerald-600">{formatCurrency(run.totalProjectedRevenue)}</td>
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
      )}

      {/* ===================================================================== */}
      {/* TAB 2: COMBO KITTING TABLE */}
      {/* ===================================================================== */}
      {activeSubTab === 'combo_kits' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
          {comboKitRuns.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Gift className="w-10 h-10 text-purple-300 mx-auto stroke-1" />
              <p className="font-bold text-slate-700 dark:text-slate-300">No Combo Kits or Hampers Assembled</p>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                Assemble multiple different products (e.g. 1 Oil + 1 Rice + 1 Ghee) into a single sellable Combo Kit SKU.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto text-[11px]">
              <table className="w-full text-left divide-y divide-slate-100 dark:divide-slate-800">
                <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="p-3">Kit #</th>
                    <th className="p-3">Combo Name</th>
                    <th className="p-3">Kits Produced</th>
                    <th className="p-3">Components Included</th>
                    <th className="p-3">Cost / Kit</th>
                    <th className="p-3">Sale Price</th>
                    <th className="p-3">Gross Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-600 dark:text-slate-300">
                  {comboKitRuns.map(k => (
                    <tr key={k.id}>
                      <td className="p-3 font-mono font-bold text-purple-600">{k.kitNumber}</td>
                      <td className="p-3 font-bold text-slate-900 dark:text-white">{k.comboProductName}</td>
                      <td className="p-3 font-bold text-purple-600">{k.kitsProduced} kits</td>
                      <td className="p-3 text-slate-500 truncate max-w-xs">
                        {k.components.map((c: ComboKitComponent) => `${c.qty}x ${c.productName}`).join(' + ')}
                      </td>
                      <td className="p-3 text-rose-600 font-bold">{formatCurrency(k.costPerKit)}</td>
                      <td className="p-3 font-bold text-emerald-600">{formatCurrency(k.sellingPrice)}</td>
                      <td className="p-3">
                        <span className="font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full text-[10px]">
                          +{formatCurrency(k.sellingPrice - k.costPerKit)} ({k.grossMarginPct}%)
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: DE-BUNDLING TABLE */}
      {/* ===================================================================== */}
      {activeSubTab === 'debundling' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
          {debundlingRuns.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <UnboxIcon className="w-10 h-10 text-amber-300 mx-auto stroke-1" />
              <p className="font-bold text-slate-700 dark:text-slate-300">No Master Cases De-Bundled Yet</p>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                Break open master cartons (e.g. Case of 24 Cans) to credit individual units to shelf inventory.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto text-[11px]">
              <table className="w-full text-left divide-y divide-slate-100 dark:divide-slate-800">
                <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="p-3">Debundle #</th>
                    <th className="p-3">Master Case Item</th>
                    <th className="p-3">Cases Opened</th>
                    <th className="p-3">Loose Units Produced</th>
                    <th className="p-3">Unit Landed Cost</th>
                    <th className="p-3">Unit Sale Price</th>
                    <th className="p-3">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-600 dark:text-slate-300">
                  {debundlingRuns.map(d => (
                    <tr key={d.id}>
                      <td className="p-3 font-mono font-bold text-amber-600">{d.debundleNumber}</td>
                      <td className="p-3 font-bold text-slate-900 dark:text-white">{d.caseProductName}</td>
                      <td className="p-3 font-bold">{d.casesOpened} cases</td>
                      <td className="p-3 font-bold text-emerald-600">
                        {d.totalLooseUnitsProduced} units ({d.unitsPerCase}/case)
                      </td>
                      <td className="p-3 text-slate-500">{formatCurrency(d.costPerUnit)}</td>
                      <td className="p-3 font-bold text-emerald-600">{formatCurrency(d.sellingPricePerUnit)}</td>
                      <td className="p-3">
                        <span className="font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full text-[10px]">
                          {d.grossMarginPct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1: BULK REPACKAGING */}
      {/* ===================================================================== */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Start Bulk Repackaging & Conversion"
        size="2xl"
      >
        <form onSubmit={handleSubmitRepackaging} className="space-y-4 text-xs">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-3">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Package className="w-4 h-4 text-blue-600" />
              <span>1. Bulk Source Material</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Select Bulk Product</label>
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
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Quantity to Consume</label>
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
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-3">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-amber-500" />
              <span>2. Packaging & Labor Overheads</span>
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Packaging Materials (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={packagingCost}
                  onChange={e => setPackagingCost(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Packing Labor (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={laborCost}
                  onChange={e => setLaborCost(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Boxes className="w-4 h-4 text-emerald-600" />
                <span>3. Finished Packaged Variants</span>
              </h4>
              <button
                type="button"
                onClick={handleAddOutputRow}
                className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Add Variant
              </button>
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {outputs.map((out, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 grid grid-cols-12 gap-2 items-center"
                >
                  <div className="col-span-3">
                    <label className="text-[10px] font-bold text-slate-400 block">Variant Name</label>
                    <input
                      type="text"
                      required
                      value={out.variantName}
                      onChange={e => handleUpdateOutput(idx, 'variantName', e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 block">Pack Size</label>
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
                    <label className="text-[10px] font-bold text-slate-400 block">Packets</label>
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
                    <label className="text-[10px] font-bold text-slate-400 block">Sale Price</label>
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
                    <label className="text-[10px] font-bold text-slate-400 block">Barcode</label>
                    <input
                      type="text"
                      value={out.barcode}
                      onChange={e => handleUpdateOutput(idx, 'barcode', e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-mono font-bold"
                    />
                  </div>
                  <div className="col-span-1 text-right pt-3">
                    <button
                      type="button"
                      onClick={() => handleRemoveOutputRow(idx)}
                      disabled={outputs.length <= 1}
                      className="text-slate-400 hover:text-rose-500 disabled:opacity-30 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 flex items-center justify-between font-bold text-xs">
              <span>Output Weight: {totalOutputWeight} {selectedSourceProduct?.primaryUnit || 'kg'} of {sourceQtyUsed} consumed</span>
              <span className="text-emerald-600">Revenue: {formatCurrency(totalProjectedRevenue)} (+{Math.round(projectedMarginPct)}%)</span>
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
      {/* MODAL 2: COMBO KITTING / GIFT HAMPER (BOM) */}
      {/* ===================================================================== */}
      <Modal
        isOpen={isKitModalOpen}
        onClose={() => setIsKitModalOpen(false)}
        title="Assemble Combo Kit / Gift Hamper (BOM)"
        size="xl"
      >
        <form onSubmit={handleSubmitComboKit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Combo Product Name</label>
              <input
                type="text"
                required
                value={comboName}
                onChange={e => setComboName(e.target.value)}
                placeholder="e.g. Festival Gift Hamper"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Number of Kits to Produce</label>
              <input
                type="number"
                min="1"
                required
                value={kitsToProduce}
                onChange={e => setKitsToProduce(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
              />
            </div>
          </div>

          {/* Child Components Selection */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
            <span className="font-bold text-slate-800 dark:text-slate-200 block">Components Included in 1 Kit:</span>
            {resolvedKitComponents.map((comp, idx) => (
              <div key={idx} className="flex items-center justify-between text-[11px] bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="font-bold text-slate-800 dark:text-slate-200">{comp.qty}x {comp.productName}</span>
                <span className="text-slate-500 font-mono">Cost: {formatCurrency(comp.costPrice * comp.qty)}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Assembly & Packaging (₹)</label>
              <input
                type="number"
                min="0"
                value={kitPackagingCost}
                onChange={e => setKitPackagingCost(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Retail Selling Price / Kit (₹)</label>
              <input
                type="number"
                min="0"
                required
                value={kitSellingPrice}
                onChange={e => setKitSellingPrice(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-emerald-600"
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/40 flex items-center justify-between font-bold">
            <span>Cost per Kit: {formatCurrency(costPerSingleKit)}</span>
            <span className="text-emerald-600">Profit / Kit: +{formatCurrency(kitSellingPrice - costPerSingleKit)}</span>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsKitModalOpen(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Assemble & Credit {kitsToProduce} Kits</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* ===================================================================== */}
      {/* MODAL 3: CASE DE-BUNDLING */}
      {/* ===================================================================== */}
      <Modal
        isOpen={isDebundleModalOpen}
        onClose={() => setIsDebundleModalOpen(false)}
        title="Unbox Master Case into Loose Shelf Units"
        size="md"
      >
        <form onSubmit={handleSubmitDebundling} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Select Master Case Product</label>
            <select
              required
              value={debundleCaseProductId}
              onChange={e => setDebundleCaseProductId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold cursor-pointer"
            >
              <option value="">-- Choose case product to open --</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} (Stock: {p.currentStock} {p.primaryUnit} @ {formatCurrency(p.costPrice || p.purchasePrice)})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Cases to Open</label>
              <input
                type="number"
                min="1"
                required
                value={casesToOpen}
                onChange={e => setCasesToOpen(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Pieces per Case</label>
              <input
                type="number"
                min="1"
                required
                value={unitsPerCase}
                onChange={e => setUnitsPerCase(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Single Unit Sale Rate (₹)</label>
              <input
                type="number"
                min="0"
                required
                value={looseSellingPrice}
                onChange={e => setLooseSellingPrice(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-emerald-600"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Output Units Count</label>
              <div className="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold text-emerald-600">
                {totalLooseProduced} pieces produced
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsDebundleModalOpen(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Unbox & Credit {totalLooseProduced} Pieces</span>
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
                  <span className="text-[10px] font-mono text-slate-400 block mt-1">{out.barcode}</span>
                </button>
              ))}
            </div>

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
                onClick={() => {
                  const item = labelPrintRun.outputs[selectedLabelIndex];
                  if (!item) return;
                  const printWin = window.open('', '_blank', 'width=450,height=600');
                  if (printWin) {
                    printWin.document.write(`
                      <html><head><title>Labels</title><style>@page{size:50mm 25mm;margin:0;}body{font-family:monospace;padding:4px;text-align:center;}.box{width:48mm;height:23mm;border:1px dashed #ccc;padding:2px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;page-break-after:always;}</style></head><body>
                      ${Array.from({ length: labelsCountToPrint }).map(() => `
                        <div class="box">
                          <div style="font-size:8px;font-weight:bold;">${company.name || 'Universal Store'}</div>
                          <div style="font-size:9px;font-weight:bold;">${item.targetProductName}</div>
                          <div style="font-size:12px;font-weight:bold;border:1px solid #000;">||| ${item.barcode} |||</div>
                          <div style="font-size:8px;display:flex;justify-content:space-between;"><span>Net: ${item.packSize}${labelPrintRun.sourceUnit}</span><span>OUR: ₹${item.sellingPrice}</span></div>
                        </div>
                      `).join('')}
                      <script>window.onload=function(){window.print();window.close();}</script></body></html>
                    `);
                    printWin.document.close();
                  }
                }}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print Barcode Labels</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
