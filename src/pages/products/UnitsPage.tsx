import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Ruler,
  Plus,
  ArrowRightLeft,
  Check,
  Scale,
  Box,
  Layers,
  Sparkles,
  Trash2,
  Pencil
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { Unit, UnitConversion, UnitCategory } from '../../types';
import { Modal } from '../../components/common/Modal';
import {
  UNIVERSAL_BUILTIN_UNITS,
  isBuiltInUnit,
  isCustomUnit,
  matchesUnitCategory,
  normalizeUnitKey
} from '../../data/unitsData';

export const UnitsPage: React.FC = () => {
  const navigate = useNavigate();
  const { units, conversions, addUnit, updateUnit, deleteUnit, checkUnitUsage, addConversion, updateConversion, deleteConversion } = useERP();

  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [isAddUnitOpen, setIsAddUnitOpen] = useState(false);
  const [isAddConvOpen, setIsAddConvOpen] = useState(false);

  // New unit form
  const [unitName, setUnitName] = useState('');
  const [unitSymbol, setUnitSymbol] = useState('');
  const [unitCategory, setUnitCategory] = useState<UnitCategory>('Packaging');

  // Edit unit form
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [editName, setEditName] = useState('');
  const [editSymbol, setEditSymbol] = useState('');
  const [editCategory, setEditCategory] = useState<UnitCategory>('Packaging');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingConv, setIsSubmittingConv] = useState(false);

  // New conversion form
  const [fromUnit, setFromUnit] = useState('Box');
  const [toUnit, setToUnit] = useState('Piece');
  const [factor, setFactor] = useState<string>('24');
  const [convNotes, setConvNotes] = useState('');

  // Edit conversion form
  const [editingConv, setEditingConv] = useState<UnitConversion | null>(null);
  const [editFromUnit, setEditFromUnit] = useState('Box');
  const [editToUnit, setEditToUnit] = useState('Piece');
  const [editFactor, setEditFactor] = useState<string>('24');
  const [editConvNotes, setEditConvNotes] = useState('');

  const unitCategories = ['All', 'Count', 'Weight', 'Volume', 'Length', 'Area', 'Volume Dimension', 'Packaging', 'Custom'];

  // Distinct, deduplicated options for conversion rule dropdowns
  // Combines all saved company custom units and universal built-in units
  const conversionUnitOptions = useMemo(() => {
    const seen = new Set<string>();
    const list: { value: string; label: string; name: string; symbol: string; isCustom?: boolean }[] = [];

    const formatLabel = (name: string, symbol: string) => {
      const cleanName = (name || '').trim();
      const cleanSym = (symbol || '').trim();
      if (!cleanSym || cleanName.toLowerCase() === cleanSym.toLowerCase()) {
        return cleanName;
      }
      return `${cleanName} (${cleanSym})`;
    };

    // 1. Company units (including all saved custom units)
    (units || []).forEach(u => {
      if (!u) return;
      const cleanName = (u.name || '').trim();
      const cleanSym = (u.symbol || '').trim();
      if (!cleanName && !cleanSym) return;

      const nameKey = normalizeUnitKey(cleanName);
      const symbolKey = normalizeUnitKey(cleanSym);

      if ((nameKey && seen.has(nameKey)) || (symbolKey && seen.has(symbolKey))) return;
      if (nameKey) seen.add(nameKey);
      if (symbolKey) seen.add(symbolKey);

      list.push({
        value: cleanName || cleanSym,
        name: cleanName || cleanSym,
        symbol: cleanSym || cleanName,
        label: formatLabel(cleanName, cleanSym),
        isCustom: u.isCustom
      });
    });

    // 2. Canonical built-in units (if not already included)
    UNIVERSAL_BUILTIN_UNITS.forEach(bu => {
      const cleanName = (bu.name || '').trim();
      const cleanSym = (bu.symbol || '').trim();
      const nameKey = normalizeUnitKey(cleanName);
      const symbolKey = normalizeUnitKey(cleanSym);

      if ((nameKey && seen.has(nameKey)) || (symbolKey && seen.has(symbolKey))) return;
      if (nameKey) seen.add(nameKey);
      if (symbolKey) seen.add(symbolKey);

      list.push({
        value: cleanName || cleanSym,
        name: cleanName || cleanSym,
        symbol: cleanSym || cleanName,
        label: formatLabel(cleanName, cleanSym),
        isCustom: false
      });
    });

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [units]);

  // Filtering Logic:
  // - All: built-in units + custom units
  // - Custom: all user-created units (regardless of category) + any unit with category 'Custom'
  // - Any other category: built-in units assigned to that category + custom units assigned to that category
  const filteredUnits = useMemo(() => {
    const seenIds = new Set<string>();
    const seenKeys = new Set<string>();
    const result: Unit[] = [];
    for (const u of units) {
      if (!u || seenIds.has(u.id)) continue;
      const nameKey = normalizeUnitKey(u.name);
      const symbolKey = normalizeUnitKey(u.symbol);
      if ((nameKey && seenKeys.has(nameKey)) || (symbolKey && seenKeys.has(symbolKey))) continue;
      if (matchesUnitCategory(u, activeCategory)) {
        seenIds.add(u.id);
        if (nameKey) seenKeys.add(nameKey);
        if (symbolKey) seenKeys.add(symbolKey);
        result.push(u);
      }
    }
    return result;
  }, [units, activeCategory]);

  const handleOpenAddUnit = () => {
    if (activeCategory !== 'All' && activeCategory !== 'Custom') {
      setUnitCategory(activeCategory as UnitCategory);
    } else {
      setUnitCategory('Packaging');
    }
    setUnitName('');
    setUnitSymbol('');
    setIsAddUnitOpen(true);
  };

  const handleAddUnitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = unitName.trim();
    const trimmedSymbol = unitSymbol.trim();
    if (!trimmedName || !trimmedSymbol) return;

    // Check if unit name or symbol already exists in standard or custom units
    const duplicate = units.find(
      u => u.name.trim().toLowerCase() === trimmedName.toLowerCase() ||
           u.symbol.trim().toLowerCase() === trimmedSymbol.toLowerCase()
    );
    if (duplicate) {
      alert(`Unit "${duplicate.name}" with symbol "${duplicate.symbol}" already exists!`);
      return;
    }

    setIsSubmitting(true);
    try {
      await addUnit({
        name: trimmedName,
        symbol: trimmedSymbol,
        category: unitCategory
      });
      setUnitName('');
      setUnitSymbol('');
      setIsAddUnitOpen(false);
    } catch (err: any) {
      alert(`Error creating unit: ${err?.message || 'Failed to save unit'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditUnit = (unit: Unit) => {
    setEditingUnit(unit);
    setEditName(unit.name);
    setEditSymbol(unit.symbol);
    setEditCategory(unit.category || 'Packaging');
  };

  const handleEditUnitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUnit) return;
    const trimmedName = editName.trim();
    const trimmedSymbol = editSymbol.trim();
    if (!trimmedName || !trimmedSymbol) return;

    // Check collision with another unit
    const duplicate = units.find(
      u => u.id !== editingUnit.id && (
        u.name.trim().toLowerCase() === trimmedName.toLowerCase() ||
        u.symbol.trim().toLowerCase() === trimmedSymbol.toLowerCase()
      )
    );
    if (duplicate) {
      alert(`Another unit "${duplicate.name}" with symbol "${duplicate.symbol}" already exists!`);
      return;
    }

    setIsSubmitting(true);
    try {
      await updateUnit(editingUnit.id, {
        name: trimmedName,
        symbol: trimmedSymbol,
        category: editCategory
      });
      setEditingUnit(null);
    } catch (err: any) {
      alert(`Error updating unit: ${err?.message || 'Failed to update unit'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUnit = async (unit: Unit) => {
    // Safety check: protect units in use from unsafe deletion
    try {
      const usage = await checkUnitUsage(unit);
      if (usage.inUse) {
        alert(`Cannot delete unit "${unit.name}" (${unit.symbol}): It is currently in use by ${usage.reasons.join(', ')}. Please reassign them first to preserve transaction history.`);
        return;
      }
    } catch (e) {
      // Continue to confirmation if usage check fails
    }

    if (!window.confirm(`Are you sure you want to permanently delete custom unit "${unit.name}" (${unit.symbol})? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteUnit(unit.id);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete unit.');
    }
  };

  const handleOpenAddConv = () => {
    if (conversionUnitOptions.length >= 2) {
      const boxOpt = conversionUnitOptions.find(o => o.value.toLowerCase() === 'box' || o.name.toLowerCase() === 'box');
      const pieceOpt = conversionUnitOptions.find(o => o.value.toLowerCase() === 'piece' || o.name.toLowerCase() === 'piece');

      const defaultFrom = boxOpt ? boxOpt.value : conversionUnitOptions[0].value;
      const defaultTo = pieceOpt && pieceOpt.value.toLowerCase() !== defaultFrom.toLowerCase()
        ? pieceOpt.value
        : (conversionUnitOptions.find(o => o.value.toLowerCase() !== defaultFrom.toLowerCase())?.value || conversionUnitOptions[1].value);

      setFromUnit(defaultFrom);
      setToUnit(defaultTo);
    }
    setFactor('24');
    setConvNotes('');
    setIsAddConvOpen(true);
  };

  const handleAddConvSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numFactor = Number(factor);
    if (!numFactor || numFactor <= 0 || isNaN(numFactor)) {
      alert('Conversion factor must be a valid positive number greater than 0.');
      return;
    }
    const cleanFrom = fromUnit.trim();
    const cleanTo = toUnit.trim();
    if (!cleanFrom || !cleanTo) {
      alert('Please select both a source unit and a target unit.');
      return;
    }
    if (cleanFrom.toLowerCase() === cleanTo.toLowerCase()) {
      alert('Source unit and target unit cannot be the same unit. Please select different units.');
      return;
    }

    setIsSubmittingConv(true);
    try {
      await addConversion({
        fromUnit: cleanFrom,
        toUnit: cleanTo,
        factor: numFactor,
        notes: convNotes.trim() || `1 ${cleanFrom} = ${numFactor} ${cleanTo}`
      });
      setConvNotes('');
      setIsAddConvOpen(false);
    } catch (err: any) {
      alert(`Error saving conversion rule: ${err?.message || 'Failed to save conversion'}`);
    } finally {
      setIsSubmittingConv(false);
    }
  };

  const handleOpenEditConv = (conv: UnitConversion) => {
    setEditingConv(conv);
    setEditFromUnit(conv.fromUnit);
    setEditToUnit(conv.toUnit);
    setEditFactor(String(conv.factor));
    setEditConvNotes(conv.notes || '');
  };

  const handleEditConvSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingConv) return;

    const numFactor = Number(editFactor);
    if (!numFactor || numFactor <= 0 || isNaN(numFactor)) {
      alert('Conversion factor must be a valid positive number greater than 0.');
      return;
    }
    const cleanFrom = editFromUnit.trim();
    const cleanTo = editToUnit.trim();
    if (!cleanFrom || !cleanTo) {
      alert('Please select both a source unit and a target unit.');
      return;
    }
    if (cleanFrom.toLowerCase() === cleanTo.toLowerCase()) {
      alert('Source unit and target unit cannot be the same unit. Please select different units.');
      return;
    }

    setIsSubmittingConv(true);
    try {
      await updateConversion(editingConv.id, {
        fromUnit: cleanFrom,
        toUnit: cleanTo,
        factor: numFactor,
        notes: editConvNotes.trim() || `1 ${cleanFrom} = ${numFactor} ${cleanTo}`
      });
      setEditingConv(null);
    } catch (err: any) {
      alert(`Error updating conversion rule: ${err?.message || 'Failed to update conversion'}`);
    } finally {
      setIsSubmittingConv(false);
    }
  };

  const handleDeleteConversion = async (conv: UnitConversion) => {
    if (!window.confirm(`Are you sure you want to delete conversion rule "1 ${conv.fromUnit} = ${conv.factor} ${conv.toUnit}"?`)) {
      return;
    }
    try {
      await deleteConversion(conv.id);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete conversion rule');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Ruler className="w-5 h-5 text-blue-600" />
            Unit of Measurement (UOM) & Conversions
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Standard commercial metrics, packaging bundles, and automatic secondary unit conversion ratios.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenAddUnit}
            className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Custom Unit</span>
          </button>

          <button
            onClick={handleOpenAddConv}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>New Conversion Rule</span>
          </button>
        </div>
      </div>

      {/* Conversion Demonstrations Box */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Active Unit Conversion Specifications
            </h2>
            <p className="text-xs text-slate-500">
              Configured packaging ratios for dual-unit inventory & automatic billing math
            </p>
          </div>
          <span className="text-xs text-blue-600 font-semibold">
            {conversions.length} Rules Active
          </span>
        </div>

        {conversions.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {conversions.map(conv => (
              <div
                key={conv.id}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:shadow-xs transition-all space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold text-slate-400 uppercase text-[10px]">
                    Conversion
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditConv(conv)}
                      title="Edit Conversion Rule"
                      className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteConversion(conv)}
                      title="Delete Conversion Rule"
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <span className="p-1 rounded bg-blue-50 text-blue-600">
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
                <div className="text-sm font-black text-slate-900 font-mono">
                  1 {conv.fromUnit} = {conv.factor} {conv.toUnit}
                </div>
                <p className="text-[11px] text-slate-500 truncate">{conv.notes || 'General Ratio'}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center text-slate-400 text-xs">
            No conversion rules configured yet. Click "New Conversion Rule" above to create packaging ratios (e.g. 1 Box = 24 Pcs).
          </div>
        )}
      </div>

      {/* Built-in & Custom Units Catalog */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-4">
        <div className="border-b border-slate-100 pb-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Measurement Units Catalog</h2>
              <p className="text-xs text-slate-500">
                Commercial units + custom units automatically matched across relevant categories
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              Showing {filteredUnits.length} units in {activeCategory}
            </span>
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {unitCategories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  activeCategory === cat
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Units Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {filteredUnits.map(unit => {
            const isCustom = isCustomUnit(unit);

            return (
              <div
                key={unit.id}
                className="relative group p-3.5 bg-white rounded-xl border border-slate-200/80 hover:border-blue-300 hover:shadow-xs transition-all text-center space-y-1.5 shadow-2xs"
              >
                {isCustom && (
                  <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 p-0.5 rounded-md shadow-2xs border border-slate-200/60 z-10">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEditUnit(unit);
                      }}
                      className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title={`Edit custom unit "${unit.name}"`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteUnit(unit);
                      }}
                      className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                      title={`Delete custom unit "${unit.name}"`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <span className="text-xl font-bold text-slate-900 block font-mono">
                  {unit.symbol}
                </span>
                <span className="text-xs font-semibold text-slate-700 block truncate" title={unit.name}>
                  {unit.name}
                </span>
                <div className="flex items-center justify-center gap-1 pt-0.5">
                  <span className="text-[10px] font-medium text-slate-500 px-1.5 py-0.5 bg-slate-100 rounded inline-block">
                    {unit.category}
                  </span>
                  {isCustom && (
                    <span className="text-[9px] font-bold text-blue-700 px-1.5 py-0.5 bg-blue-50 border border-blue-200/70 rounded inline-block">
                      Custom
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {filteredUnits.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-400 text-xs">
              No units found under &quot;{activeCategory}&quot;. Click &quot;Add Custom Unit&quot; above to define one.
            </div>
          )}
        </div>
      </div>

      {/* Add Custom Unit Modal */}
      <Modal
        isOpen={isAddUnitOpen}
        onClose={() => setIsAddUnitOpen(false)}
        title="Add Custom Measurement Unit"
        subtitle="Define a new unit of measurement for your specialized products"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsAddUnitOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              onClick={handleAddUnitSubmit}
              disabled={isSubmitting}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Unit'}
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 mb-1">Unit Full Name</label>
            <input
              type="text"
              required
              value={unitName}
              onChange={e => setUnitName(e.target.value)}
              placeholder="e.g. Packet, Drum"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Symbol / Abbreviation</label>
            <input
              type="text"
              required
              value={unitSymbol}
              onChange={e => setUnitSymbol(e.target.value)}
              placeholder="e.g. Pkt, Drm"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Measurement Category</label>
            <select
              value={unitCategory}
              onChange={e => setUnitCategory(e.target.value as UnitCategory)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
            >
              <option value="Packaging">Packaging</option>
              <option value="Weight">Weight</option>
              <option value="Count">Count</option>
              <option value="Volume">Volume</option>
              <option value="Length">Length</option>
              <option value="Area">Area</option>
              <option value="Volume Dimension">Volume Dimension</option>
              <option value="Custom">Custom</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* Edit Custom Unit Modal */}
      <Modal
        isOpen={Boolean(editingUnit)}
        onClose={() => setEditingUnit(null)}
        title="Edit Custom Measurement Unit"
        subtitle="Update unit details, symbol abbreviation, or measurement category"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setEditingUnit(null)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              onClick={handleEditUnitSubmit}
              disabled={isSubmitting}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 mb-1">Unit Full Name</label>
            <input
              type="text"
              required
              value={editName}
              onChange={e => setEditName(e.target.value)}
              placeholder="e.g. Packet, Drum"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Symbol / Abbreviation</label>
            <input
              type="text"
              required
              value={editSymbol}
              onChange={e => setEditSymbol(e.target.value)}
              placeholder="e.g. Pkt, Drm"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Measurement Category</label>
            <select
              value={editCategory}
              onChange={e => setEditCategory(e.target.value as UnitCategory)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
            >
              <option value="Packaging">Packaging</option>
              <option value="Weight">Weight</option>
              <option value="Count">Count</option>
              <option value="Volume">Volume</option>
              <option value="Length">Length</option>
              <option value="Area">Area</option>
              <option value="Volume Dimension">Volume Dimension</option>
              <option value="Custom">Custom</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* Add Conversion Rule Modal */}
      <Modal
        isOpen={isAddConvOpen}
        onClose={() => setIsAddConvOpen(false)}
        title="Add Unit Conversion Rule"
        subtitle="Example: 1 Meter = 0.75 Kg (Steel Rod) or 1 Box = 24 Pieces"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsAddConvOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleAddConvSubmit}
              disabled={isSubmittingConv}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmittingConv ? 'Saving...' : 'Save Conversion'}
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-3 gap-2 items-center">
            <div>
              <label className="block font-medium text-slate-700 mb-1">From Unit</label>
              <select
                id="conv-from-unit-select"
                value={fromUnit}
                onChange={e => setFromUnit(e.target.value)}
                className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-800 text-xs"
              >
                {conversionUnitOptions.map(u => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-center pt-5 font-bold text-slate-400">=</div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">To Unit</label>
              <select
                id="conv-to-unit-select"
                value={toUnit}
                onChange={e => setToUnit(e.target.value)}
                className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-800 text-xs"
              >
                {conversionUnitOptions.map(u => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Multiplier Factor</label>
            <input
              type="number"
              step="any"
              min="0.0001"
              value={factor}
              onChange={e => {
                const raw = e.target.value;
                if (raw === '') { setFactor(''); return; }
                if (raw.includes('-')) return;
                setFactor(raw.replace(/^0+(?=\d)/, ''));
              }}
              placeholder="50"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Notes / Description</label>
            <input
              type="text"
              value={convNotes}
              onChange={e => setConvNotes(e.target.value)}
              placeholder="e.g. Standard 50kg bag or 12mm TMT Steel Rod"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-200 font-mono text-center font-bold text-blue-900">
            Preview: 1 {fromUnit} = {factor || '1'} {toUnit}
          </div>
        </div>
      </Modal>

      {/* Edit Conversion Rule Modal */}
      <Modal
        isOpen={Boolean(editingConv)}
        onClose={() => setEditingConv(null)}
        title="Edit Unit Conversion Rule"
        subtitle="Update packaging ratio or multiplier for dual-unit inventory & automatic billing math"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setEditingConv(null)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
              disabled={isSubmittingConv}
            >
              Cancel
            </button>
            <button
              onClick={handleEditConvSubmit}
              disabled={isSubmittingConv}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmittingConv ? 'Updating...' : 'Update Conversion'}
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-3 gap-2 items-center">
            <div>
              <label className="block font-medium text-slate-700 mb-1">From Unit</label>
              <select
                value={editFromUnit}
                onChange={e => setEditFromUnit(e.target.value)}
                className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-800 text-xs"
              >
                {conversionUnitOptions.map(u => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-center pt-5 font-bold text-slate-400">=</div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">To Unit</label>
              <select
                value={editToUnit}
                onChange={e => setEditToUnit(e.target.value)}
                className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-800 text-xs"
              >
                {conversionUnitOptions.map(u => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Multiplier Factor</label>
            <input
              type="number"
              step="any"
              min="0.0001"
              value={editFactor}
              onChange={e => {
                const raw = e.target.value;
                if (raw === '') { setEditFactor(''); return; }
                if (raw.includes('-')) return;
                setEditFactor(raw.replace(/^0+(?=\d)/, ''));
              }}
              placeholder="50"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Notes / Description</label>
            <input
              type="text"
              value={editConvNotes}
              onChange={e => setEditConvNotes(e.target.value)}
              placeholder="e.g. Standard 50kg bag or 12mm TMT Steel Rod"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-200 font-mono text-center font-bold text-blue-900">
            Preview: 1 {editFromUnit} = {editFactor || '1'} {editToUnit}
          </div>
        </div>
      </Modal>
    </div>
  );
};
