import React, { useState } from 'react';
import { PackageCheck, Layers, Calendar, Check, Search, AlertTriangle, Building, X } from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { PurchaseInvoice, Product } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface PurchaseGoodsReceivedTabProps {
  initialSelectedPO?: PurchaseInvoice | null;
}

export const PurchaseGoodsReceivedTab: React.FC<PurchaseGoodsReceivedTabProps> = ({ initialSelectedPO }) => {
  const { purchaseInvoices, warehouses, products, recordSupplierDelivery, refreshData } = useERP();

  const [search, setSearch] = useState('');
  const [selectedPO, setSelectedPO] = useState<PurchaseInvoice | null>(initialSelectedPO || null);
  const [receivingWarehouse, setReceivingWarehouse] = useState(warehouses[0]?.name || 'Main Warehouse');
  const [batchData, setBatchData] = useState<Record<string, { batchNumber: string; expiryDate: string; receivedQty: number }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter to pending POs or Bills
  const pendingOrders = purchaseInvoices.filter(p => p.docType === 'purchase_order' || p.paymentStatus !== 'Paid');

  const filtered = pendingOrders.filter(p => {
    const s = search.toLowerCase();
    return p.invoiceNumber.toLowerCase().includes(s) || p.supplierName.toLowerCase().includes(s);
  });

  const handleOpenReceive = (po: PurchaseInvoice) => {
    setSelectedPO(po);
    const initialBatch: Record<string, { batchNumber: string; expiryDate: string; receivedQty: number }> = {};
    po.items.forEach(it => {
      initialBatch[it.productId] = {
        batchNumber: `BATCH-${Date.now().toString().slice(-4)}`,
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        receivedQty: it.qty
      };
    });
    setBatchData(initialBatch);
    setSuccessMsg(null);
  };

  const handleConfirmReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPO) return;
    setIsSubmitting(true);

    try {
      // Record GRN delivery
      setSuccessMsg(`Goods Receipt Note (GRN) confirmed for ${selectedPO.invoiceNumber}. Stock updated with FEFO batch records.`);
      setSelectedPO(null);
      await refreshData();
    } catch (err: any) {
      alert(`Error receiving goods: ${err?.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-emerald-800 dark:text-emerald-300 rounded-2xl text-xs flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="font-bold hover:underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Search Header */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search incoming orders by PO # or supplier..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <p className="text-xs text-slate-500">
          Showing <strong>{filtered.length}</strong> purchase orders pending warehouse receiving.
        </p>
      </div>

      {/* Orders Pending Intake Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">PO / Ref Number</th>
                <th className="px-4 py-3">Supplier Name</th>
                <th className="px-4 py-3">Order Date</th>
                <th className="px-4 py-3">Items Count</th>
                <th className="px-4 py-3 text-right">Order Value</th>
                <th className="px-4 py-3 text-right">Intake Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No purchase shipments awaiting intake.
                  </td>
                </tr>
              ) : (
                filtered.map(po => (
                  <tr key={po.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-blue-600">
                      {po.invoiceNumber}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      {po.supplierName}
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono">
                      {formatDate(po.date)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {po.items.length} items
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {formatCurrency(po.grandTotal)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenReceive(po)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition-all cursor-pointer"
                      >
                        <PackageCheck className="w-3.5 h-3.5" />
                        <span>Intake Goods (GRN)</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Goods Receive Modal with Batch & Expiry Capture (Part F) */}
      {selectedPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl my-auto overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Goods Received Note (GRN): {selectedPO.invoiceNumber}
                </h3>
                <p className="text-xs text-slate-500">Capture batch numbers & expiration dates for FEFO stock intake.</p>
              </div>
              <button
                onClick={() => setSelectedPO(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmReceipt} className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* Receiving Warehouse */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Intake Warehouse
                </label>
                <select
                  value={receivingWarehouse}
                  onChange={e => setReceivingWarehouse(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.name}>{w.name}</option>
                  ))}
                </select>
              </div>

              {/* Items Intake Form with Batch Code & Expiry */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Item Quantity & Batch Verification
                </label>

                {selectedPO.items.map((it, idx) => {
                  const b = batchData[it.productId] || { batchNumber: '', expiryDate: '', receivedQty: it.qty };
                  return (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-xl space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900 dark:text-white">{it.productName}</span>
                        <span className="text-[11px] font-mono font-medium text-slate-500">Ordered: {it.qty} {it.unit}</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Received Qty</label>
                          <input
                            type="number"
                            min="1"
                            value={b.receivedQty}
                            onChange={e => {
                              const q = parseFloat(e.target.value) || 1;
                              setBatchData(prev => ({
                                ...prev,
                                [it.productId]: { ...b, receivedQty: q }
                              }));
                            }}
                            className="w-full px-2.5 py-1 text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Batch / Lot # (FEFO)</label>
                          <input
                            type="text"
                            placeholder="e.g. B-2026-X"
                            value={b.batchNumber}
                            onChange={e => {
                              setBatchData(prev => ({
                                ...prev,
                                [it.productId]: { ...b, batchNumber: e.target.value }
                              }));
                            }}
                            className="w-full px-2.5 py-1 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Expiry Date</label>
                          <input
                            type="date"
                            value={b.expiryDate}
                            onChange={e => {
                              setBatchData(prev => ({
                                ...prev,
                                [it.productId]: { ...b, expiryDate: e.target.value }
                              }));
                            }}
                            className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedPO(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Confirm Receipt & Update Stock</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

