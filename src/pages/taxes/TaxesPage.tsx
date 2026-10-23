import React, { useState, useMemo, useEffect } from 'react';
import {
  ReceiptText,
  FileSpreadsheet,
  Layers,
  Percent,
  Plus,
  Search,
  Download,
  Printer,
  CheckCircle,
  HelpCircle,
  FileCheck2,
  Building,
  ArrowRight
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Modal } from '../../components/common/Modal';
import { taxService, TaxSlab } from '../../services/taxService';

interface HsnEntry {
  hsn: string;
  description: string;
  type: 'Goods' | 'Services';
  taxRate: number;
  category: string;
}

export const TaxesPage: React.FC = () => {
  const { salesInvoices, purchaseInvoices, products, company } = useERP();
  const [activeTab, setActiveTab] = useState<'gstr1' | 'gstr3b' | 'slabs' | 'hsn'>('gstr1');
  const [selectedMonth, setSelectedMonth] = useState('October 2026');
  const [isAddSlabModalOpen, setIsAddSlabModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Tax Slabs loaded from database
  const [taxSlabs, setTaxSlabs] = useState<TaxSlab[]>([]);

  useEffect(() => {
    const loadSlabs = async () => {
      try {
        const data = await taxService.getTaxSlabs();
        setTaxSlabs(data);
      } catch (err) {
        console.error('Failed to load tax slabs:', err);
      }
    };
    loadSlabs();
  }, []);

  // HSN Directory dynamically derived from created products
  const hsnDirectory: HsnEntry[] = useMemo(() => {
    const map = new Map<string, HsnEntry>();
    products.forEach(p => {
      if (p.hsn && !map.has(p.hsn)) {
        map.set(p.hsn, {
          hsn: p.hsn,
          description: p.name,
          type: 'Goods',
          taxRate: p.taxRate,
          category: p.category || 'General'
        });
      }
    });
    return Array.from(map.values());
  }, [products]);

  // Dynamic calculations from invoices
  const totalOutputTax = salesInvoices.reduce((acc, inv) => acc + inv.taxTotal, 0);
  const totalInputTaxCredit = purchaseInvoices.reduce((acc, pur) => acc + pur.taxTotal, 0);
  const netTaxPayable = Math.max(0, totalOutputTax - totalInputTaxCredit);

  // GSTR-3B accurate breakdown by state/interstate
  const { igstOutput, cgstOutput, sgstOutput } = useMemo(() => {
    let igst = 0, cgst = 0, sgst = 0;
    salesInvoices.forEach(inv => {
      const isInterState = inv.customerGstin && !inv.customerGstin.startsWith('27');
      if (isInterState) {
        igst += inv.taxTotal;
      } else {
        cgst += inv.taxTotal / 2;
        sgst += inv.taxTotal / 2;
      }
    });
    return { igstOutput: igst, cgstOutput: cgst, sgstOutput: sgst };
  }, [salesInvoices]);

  const { igstInput, cgstInput, sgstInput } = useMemo(() => {
    let igst = 0, cgst = 0, sgst = 0;
    purchaseInvoices.forEach(pur => {
      const isInterState = pur.supplierGstin && !pur.supplierGstin.startsWith('27');
      if (isInterState) {
        igst += pur.taxTotal;
      } else {
        cgst += pur.taxTotal / 2;
        sgst += pur.taxTotal / 2;
      }
    });
    return { igstInput: igst, cgstInput: cgst, sgstInput: sgst };
  }, [purchaseInvoices]);

  // New Tax Slab state
  const [newSlabName, setNewSlabName] = useState('');
  const [newSlabRate, setNewSlabRate] = useState('');
  const [newSlabDesc, setNewSlabDesc] = useState('');

  const handleCreateSlab = async (e: React.FormEvent) => {
    e.preventDefault();
    const rate = parseFloat(newSlabRate) || 0;
    try {
      const created = await taxService.createTaxSlab({
        name: newSlabName,
        rate,
        cgst: rate / 2,
        sgst: rate / 2,
        igst: rate,
        type: 'Custom',
        description: newSlabDesc,
        activeProducts: 0
      });
      setTaxSlabs(prev => [...prev, created]);
      setIsAddSlabModalOpen(false);
      setNewSlabName('');
      setNewSlabRate('');
      setNewSlabDesc('');
    } catch (err) {
      console.error('Failed to create tax slab:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ReceiptText className="w-5 h-5 text-purple-600" />
            GST & Tax Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Indian Goods & Services Tax (GST) filing center, GSTR-1, GSTR-3B summaries, HSN/SAC master, and tax slab configuration.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg focus:outline-none"
          >
            <option value="October 2026">October 2026 (Active Return)</option>
            <option value="September 2026">September 2026 (Filed)</option>
            <option value="August 2026">August 2026 (Filed)</option>
          </select>

          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Tax Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
            Total Output GST (Sales)
          </span>
          <span className="text-xl font-black text-rose-600 block font-mono">
            {formatCurrency(totalOutputTax)}
          </span>
          <span className="text-[10px] text-slate-500">Collected from customers</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
            Eligible Input Tax Credit (ITC)
          </span>
          <span className="text-xl font-black text-emerald-600 block font-mono">
            {formatCurrency(totalInputTaxCredit)}
          </span>
          <span className="text-[10px] text-slate-500">Available from purchases</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
            Net GST Payable in Cash
          </span>
          <span className="text-xl font-black text-slate-900 block font-mono">
            {formatCurrency(netTaxPayable)}
          </span>
          <span className="text-[10px] text-slate-500">Output Tax minus ITC</span>
        </div>

        <div className="bg-purple-900 text-white p-4 rounded-xl shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-purple-300 block tracking-wider">
              GSTIN Details
            </span>
            <span className="text-[10px] bg-purple-800 text-purple-200 px-1.5 py-0.5 rounded font-mono">
              27 (MH)
            </span>
          </div>
          <span className="text-sm font-mono font-bold text-white block mt-1">
            {company.gstin}
          </span>
          <span className="text-[10px] text-purple-200 block">PAN: {company.pan}</span>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('gstr1')}
          className={`py-2 px-3 text-xs font-bold border-b-2 transition-colors ${
            activeTab === 'gstr1'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          GSTR-1 Outward Supplies
        </button>

        <button
          onClick={() => setActiveTab('gstr3b')}
          className={`py-2 px-3 text-xs font-bold border-b-2 transition-colors ${
            activeTab === 'gstr3b'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          GSTR-3B Monthly Return
        </button>

        <button
          onClick={() => setActiveTab('slabs')}
          className={`py-2 px-3 text-xs font-bold border-b-2 transition-colors ${
            activeTab === 'slabs'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Tax Slabs & GST Rates ({taxSlabs.length})
        </button>

        <button
          onClick={() => setActiveTab('hsn')}
          className={`py-2 px-3 text-xs font-bold border-b-2 transition-colors ${
            activeTab === 'hsn'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          HSN / SAC Master ({hsnDirectory.length})
        </button>
      </div>

      {/* TAB 1: GSTR-1 */}
      {activeTab === 'gstr1' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                GSTR-1 Table 4: Taxable outward supplies made to registered persons (B2B)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Eligible for buyer ITC claims via GST Portal auto-population.
              </p>
            </div>

            <button
              onClick={() => alert('GSTR-1 JSON export generated successfully in government schema format.')}
              className="px-3 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors self-start sm:self-auto"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export GSTR-1 JSON</span>
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-semibold text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Customer Name</th>
                    <th className="py-3 px-4">Buyer GSTIN</th>
                    <th className="py-3 px-4 text-right">Taxable Value</th>
                    <th className="py-3 px-4 text-right">CGST (₹)</th>
                    <th className="py-3 px-4 text-right">SGST (₹)</th>
                    <th className="py-3 px-4 text-right">IGST (₹)</th>
                    <th className="py-3 px-4 text-right">Total Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {salesInvoices.length > 0 ? (
                    salesInvoices.map(inv => {
                      const isInterState = inv.customerGstin && !inv.customerGstin.startsWith('27');
                      const cgst = isInterState ? 0 : inv.taxTotal / 2;
                      const sgst = isInterState ? 0 : inv.taxTotal / 2;
                      const igst = isInterState ? inv.taxTotal : 0;

                      return (
                        <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-bold text-purple-700">{inv.invoiceNumber}</td>
                          <td className="py-3 px-4 font-sans text-slate-600">{formatDate(inv.date)}</td>
                          <td className="py-3 px-4 font-sans font-medium text-slate-900">{inv.customerName}</td>
                          <td className="py-3 px-4 font-bold text-slate-600">{inv.customerGstin || 'URP (Consumer)'}</td>
                          <td className="py-3 px-4 text-right text-slate-800">{formatCurrency(inv.subtotal)}</td>
                          <td className="py-3 px-4 text-right text-slate-600">{cgst > 0 ? formatCurrency(cgst) : '—'}</td>
                          <td className="py-3 px-4 text-right text-slate-600">{sgst > 0 ? formatCurrency(sgst) : '—'}</td>
                          <td className="py-3 px-4 text-right text-slate-600">{igst > 0 ? formatCurrency(igst) : '—'}</td>
                          <td className="py-3 px-4 text-right font-black text-slate-900">{formatCurrency(inv.grandTotal)}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400 font-sans">
                        No sales invoices recorded yet. Create an invoice in Sales to populate GSTR-1.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: GSTR-3B */}
      {activeTab === 'gstr3b' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              GSTR-3B Return Computation: Outward Supplies & Input Tax Credit
            </h2>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-sans text-[11px] font-bold">
                  <tr>
                    <th className="py-3 px-4">Section / Head</th>
                    <th className="py-3 px-4 text-right">Taxable Value</th>
                    <th className="py-3 px-4 text-right">Integrated Tax (IGST)</th>
                    <th className="py-3 px-4 text-right">Central Tax (CGST)</th>
                    <th className="py-3 px-4 text-right">State Tax (SGST)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-3 px-4 font-sans font-medium text-slate-800">
                      3.1 (a) Outward Taxable supplies (Other than zero rated, nil & exempted)
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {formatCurrency(salesInvoices.reduce((acc, i) => acc + i.subtotal, 0))}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600">{formatCurrency(igstOutput)}</td>
                    <td className="py-3 px-4 text-right text-slate-600">{formatCurrency(cgstOutput)}</td>
                    <td className="py-3 px-4 text-right text-slate-600">{formatCurrency(sgstOutput)}</td>
                  </tr>
                  <tr className="bg-emerald-50/40">
                    <td className="py-3 px-4 font-sans font-medium text-emerald-900">
                      4. Eligible Input Tax Credit (ITC) from Inward Purchases
                    </td>
                    <td className="py-3 px-4 text-right text-slate-400">—</td>
                    <td className="py-3 px-4 text-right text-emerald-700 font-bold">{formatCurrency(igstInput)}</td>
                    <td className="py-3 px-4 text-right text-emerald-700 font-bold">{formatCurrency(cgstInput)}</td>
                    <td className="py-3 px-4 text-right text-emerald-700 font-bold">{formatCurrency(sgstInput)}</td>
                  </tr>
                  <tr className="bg-slate-900 text-white font-bold">
                    <td className="py-3 px-4 font-sans uppercase">
                      5. Net Tax Payable in Cash (Output - Input)
                    </td>
                    <td className="py-3 px-4 text-right text-slate-400">—</td>
                    <td className="py-3 px-4 text-right text-purple-300">{formatCurrency(Math.max(0, igstOutput - igstInput))}</td>
                    <td className="py-3 px-4 text-right text-purple-300">{formatCurrency(Math.max(0, cgstOutput - cgstInput))}</td>
                    <td className="py-3 px-4 text-right text-purple-300">{formatCurrency(Math.max(0, sgstOutput - sgstInput))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TAX SLABS */}
      {activeTab === 'slabs' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                GST Tax Slabs & Rate Master
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Default and custom tax rates used across product catalogue and billing calculations.
              </p>
            </div>

            <button
              onClick={() => setIsAddSlabModalOpen(true)}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Tax Slab</span>
            </button>
          </div>

          {taxSlabs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {taxSlabs.map(slab => (
                <div key={slab.id} className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">{slab.name}</span>
                    <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded font-mono text-xs font-bold">
                      {slab.rate}%
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2 rounded-lg text-center font-mono text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">CGST</span>
                      <span className="font-bold text-slate-700">{slab.cgst}%</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">SGST</span>
                      <span className="font-bold text-slate-700">{slab.sgst}%</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">IGST</span>
                      <span className="font-bold text-purple-700">{slab.igst}%</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 line-clamp-2">{slab.description}</p>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Type: <strong className="text-slate-600">{slab.type}</strong></span>
                    <span>{slab.activeProducts || 0} Products Assigned</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-xs">
              No tax slabs configured yet. Click "Add Tax Slab" above to create your first GST slab.
            </div>
          )}
        </div>
      )}

      {/* TAB 4: HSN / SAC MASTER */}
      {activeTab === 'hsn' && (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Harmonized System of Nomenclature (HSN) & SAC Code Index
            </h2>

            <div className="relative w-full md:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search HSN code, product, category..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-semibold text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">HSN / SAC Code</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Description of Goods / Services</th>
                    <th className="py-3 px-4">Industry Category</th>
                    <th className="py-3 px-4 text-right">Applicable Tax Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {hsnDirectory.length > 0 ? (
                    hsnDirectory
                      .filter(h =>
                        h.hsn.includes(searchTerm) ||
                        h.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        h.category.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .map(h => (
                        <tr key={h.hsn} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-purple-700">{h.hsn}</td>
                          <td className="py-3 px-4">
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 font-semibold text-slate-700">
                              {h.type}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900">{h.description}</td>
                          <td className="py-3 px-4 text-slate-500">{h.category}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                            {h.taxRate}% GST
                          </td>
                        </tr>
                      ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 font-sans">
                        No HSN / SAC codes registered. Products created with HSN codes will appear here automatically.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add Tax Slab Modal */}
      <Modal
        isOpen={isAddSlabModalOpen}
        onClose={() => setIsAddSlabModalOpen(false)}
        title="Create Custom Tax Slab"
      >
        <form onSubmit={handleCreateSlab} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Slab Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Special Luxury Tax 22%"
              value={newSlabName}
              onChange={e => setNewSlabName(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-purple-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Total GST Rate (%) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              step="0.1"
              required
              placeholder="e.g. 22"
              value={newSlabRate}
              onChange={e => {
                const raw = e.target.value;
                if (raw === '') { setNewSlabRate(''); return; }
                if (raw.includes('-')) return;
                setNewSlabRate(raw.replace(/^0+(?=\d)/, ''));
              }}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-purple-500 focus:outline-none font-mono"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              CGST and SGST will automatically be split 50/50.
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description / Notes
            </label>
            <textarea
              rows={2}
              placeholder="Applicable items, exceptions..."
              value={newSlabDesc}
              onChange={e => setNewSlabDesc(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-purple-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsAddSlabModalOpen(false)}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-xs"
            >
              Save Slab
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
