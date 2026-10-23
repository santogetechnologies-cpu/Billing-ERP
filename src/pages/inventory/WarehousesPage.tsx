import React, { useState, useMemo } from 'react';
import {
  Building,
  Plus,
  Search,
  Filter,
  Eye,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Warehouse as WarehouseIcon,
  Store,
  Boxes,
  MapPin,
  Phone,
  User,
  AlertTriangle,
  ArrowRightLeft,
  LayoutGrid,
  List,
  ShieldCheck,
  RefreshCw,
  Loader2,
  Package
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { Warehouse, WarehouseType } from '../../types';
import { Modal } from '../../components/common/Modal';
import { formatCurrency } from '../../utils/formatters';
import { useNavigate } from 'react-router-dom';

const LOCATION_TYPES: WarehouseType[] = [
  'Main Warehouse',
  'Branch Warehouse',
  'Godown',
  'Store',
  'Other Location'
];

export const WarehousesPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    warehouses,
    stockBalances,
    products,
    users,
    addWarehouse,
    updateWarehouse,
    deleteWarehouse,
    toggleWarehouseStatus,
    refreshStockBalances,
    getWarehouseStock
  } = useERP();

  const eligibleManagers = useMemo(() => {
    return (users || []).filter(u => u.role === 'Warehouse Manager' || u.role === 'Admin' || u.role === 'Owner');
  }, [users]);

  // View state
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stockSearchTerm, setStockSearchTerm] = useState('');

  // Form state
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formType, setFormType] = useState<WarehouseType>('Main Warehouse');
  const [formAddress, setFormAddress] = useState('');
  const [formContactPerson, setFormContactPerson] = useState('');
  const [formManagerId, setFormManagerId] = useState<string>('');
  const [formPhone, setFormPhone] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setSelectedWarehouse(null);
    setFormName('');
    // Auto generate code prefix
    const count = warehouses.length + 1;
    setFormCode(`WH-LOC-${count.toString().padStart(2, '0')}`);
    setFormType('Branch Warehouse');
    setFormAddress('');
    setFormContactPerson('');
    setFormManagerId('');
    setFormPhone('');
    setFormDescription('');
    setFormIsActive(true);
    setFormIsDefault(warehouses.length === 0);
    setFormError(null);
    setIsFormModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (wh: Warehouse) => {
    setSelectedWarehouse(wh);
    setFormName(wh.name);
    setFormCode(wh.code);
    setFormType(wh.locationType || wh.type || 'Main Warehouse');
    setFormAddress(wh.address || '');
    setFormContactPerson(wh.contactPerson || wh.managerName || '');
    setFormManagerId(wh.managerId || wh.managerIds?.[0] || '');
    setFormPhone(wh.phone || '');
    setFormDescription(wh.description || '');
    setFormIsActive(wh.isActive ?? true);
    setFormIsDefault(Boolean(wh.isDefault));
    setFormError(null);
    setIsFormModalOpen(true);
  };

  // Open Stock Modal
  const handleOpenStockModal = (wh: Warehouse) => {
    setSelectedWarehouse(wh);
    setStockSearchTerm('');
    setIsStockModalOpen(true);
  };

  // Open Delete Modal
  const handleOpenDeleteModal = (wh: Warehouse) => {
    setSelectedWarehouse(wh);
    setIsDeleteModalOpen(true);
  };

  // Save Warehouse (Create or Edit)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!formName.trim()) {
      setFormError('Warehouse name is required.');
      return;
    }
    if (!formCode.trim()) {
      setFormError('Warehouse code is required.');
      return;
    }

    // Code uniqueness check (excluding self)
    const codeExists = warehouses.some(
      w => w.code.toLowerCase() === formCode.trim().toLowerCase() && (!selectedWarehouse || w.id !== selectedWarehouse.id)
    );
    if (codeExists) {
      setFormError(`Warehouse code "${formCode.trim().toUpperCase()}" is already assigned to another location.`);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const assignedUser = (users || []).find(u => u.id === formManagerId);
    const resolvedContact = assignedUser ? assignedUser.name : formContactPerson.trim();
    const managerPayload = {
      managerId: formManagerId || null,
      managerName: resolvedContact,
      managerIds: formManagerId ? [formManagerId] : []
    };

    try {
      if (selectedWarehouse) {
        await updateWarehouse(selectedWarehouse.id, {
          name: formName.trim(),
          code: formCode.trim().toUpperCase(),
          type: formType,
          locationType: formType,
          address: formAddress.trim(),
          contactPerson: resolvedContact,
          phone: formPhone.trim(),
          description: formDescription.trim(),
          isActive: formIsActive,
          isDefault: formIsDefault,
          ...managerPayload
        });
      } else {
        await addWarehouse({
          name: formName.trim(),
          code: formCode.trim().toUpperCase(),
          type: formType,
          locationType: formType,
          address: formAddress.trim(),
          contactPerson: resolvedContact,
          phone: formPhone.trim(),
          description: formDescription.trim(),
          isActive: formIsActive,
          isDefault: formIsDefault,
          ...managerPayload
        });
      }

      setIsFormModalOpen(false);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save warehouse location.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!selectedWarehouse || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await deleteWarehouse(selectedWarehouse.id);
      setIsDeleteModalOpen(false);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete warehouse');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle active/inactive
  const handleToggleStatus = async (wh: Warehouse) => {
    const nextStatus = !(wh.isActive ?? true);
    try {
      await toggleWarehouseStatus(wh.id, nextStatus);
    } catch (err: any) {
      alert(`Could not change status: ${err?.message || 'Error'}`);
    }
  };

  // Calculate stats for a given warehouse
  const getWarehouseStats = (whId: string, whCode: string) => {
    let skuCount = 0;
    let totalUnits = 0;
    let totalValuation = 0;

    products.forEach(p => {
      const stock = getWarehouseStock(whId, p.id);
      if (stock > 0) {
        skuCount++;
        totalUnits += stock;
        totalValuation += stock * (p.purchasePrice || p.costPrice || 0);
      }
    });

    return { skuCount, totalUnits, totalValuation };
  };

  // Aggregated Top Metric Stats
  const topMetrics = useMemo(() => {
    const totalLocations = warehouses.length;
    const activeLocations = warehouses.filter(w => w.isActive ?? true).length;
    let companyTotalStockUnits = 0;
    let companyTotalValue = 0;

    products.forEach(p => {
      companyTotalStockUnits += p.currentStock || 0;
      companyTotalValue += (p.currentStock || 0) * (p.purchasePrice || p.costPrice || 0);
    });

    const defaultHub = warehouses.find(w => w.isDefault);

    return {
      totalLocations,
      activeLocations,
      companyTotalStockUnits,
      companyTotalValue,
      defaultHubName: defaultHub ? defaultHub.name : 'Not set'
    };
  }, [warehouses, products]);

  // Filtered warehouses
  const filteredWarehouses = useMemo(() => {
    return warehouses.filter(w => {
      const matchesSearch =
        w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (w.contactPerson && w.contactPerson.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (w.address && w.address.toLowerCase().includes(searchTerm.toLowerCase()));

      const locType = w.locationType || w.type || 'Main Warehouse';
      const matchesType = typeFilter === 'All' || locType === typeFilter;

      const isActive = w.isActive ?? true;
      const matchesStatus =
        statusFilter === 'All' ||
        (statusFilter === 'Active' && isActive) ||
        (statusFilter === 'Inactive' && !isActive);

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [warehouses, searchTerm, typeFilter, statusFilter]);

  // Products breakdown for selected warehouse
  const selectedWarehouseProducts = useMemo(() => {
    if (!selectedWarehouse) return [];
    return products
      .map(p => {
        const qty = getWarehouseStock(selectedWarehouse.id, p.id);
        const cost = p.purchasePrice || p.costPrice || 0;
        return {
          product: p,
          qty,
          cost,
          valuation: qty * cost
        };
      })
      .filter(item => {
        if (!stockSearchTerm.trim()) return true;
        const q = stockSearchTerm.toLowerCase();
        return (
          item.product.name.toLowerCase().includes(q) ||
          item.product.sku.toLowerCase().includes(q) ||
          item.product.category.toLowerCase().includes(q)
        );
      });
  }, [selectedWarehouse, products, getWarehouseStock, stockSearchTerm]);

  // Helper for type styling
  const getTypeBadge = (type?: string) => {
    switch (type) {
      case 'Main Warehouse':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Branch Warehouse':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Godown':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Store':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600">
              <WarehouseIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                Multi-Warehouse Management
                <span className="text-xs px-2.5 py-0.5 font-semibold bg-blue-50 text-blue-700 border border-blue-200/60 rounded-full">
                  {warehouses.length} Locations
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Maintain distinct inventory balances across central warehouses, godowns, branch hubs, and retail outlets.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => refreshStockBalances()}
            title="Refresh Live Balances"
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => navigate('/inventory/transfers')}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-200/80"
          >
            <ArrowRightLeft className="w-4 h-4 text-blue-600" />
            <span>Stock Transfers</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Warehouse</span>
          </button>
        </div>
      </div>

      {/* Key Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Total Locations</span>
            <Building className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{topMetrics.totalLocations}</div>
          <p className="text-[11px] text-slate-500">
            {topMetrics.activeLocations} active • {topMetrics.totalLocations - topMetrics.activeLocations} inactive
          </p>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Primary Receiving Hub</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-base font-bold text-slate-900 truncate" title={topMetrics.defaultHubName}>
            {topMetrics.defaultHubName}
          </div>
          <p className="text-[11px] text-emerald-600 font-medium">Default dispatch & PO receipt</p>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Total In-Stock Units</span>
            <Boxes className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-indigo-700">
            {topMetrics.companyTotalStockUnits.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500">Summed across all facilities</p>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Inventory Asset Value</span>
            <Store className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {formatCurrency(topMetrics.companyTotalValue)}
          </div>
          <p className="text-[11px] text-slate-500">Based on purchase cost price</p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by name, code, contact person, or address..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Location Type Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700"
            >
              <option value="All">All Types</option>
              {LOCATION_TYPES.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700"
          >
            <option value="All">All Status</option>
            <option value="Active">Active Only</option>
            <option value="Inactive">Inactive Only</option>
          </select>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-end md:self-auto">
          <button
            onClick={() => setViewMode('cards')}
            className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
              viewMode === 'cards' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
            }`}
            title="Card Layout"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
              viewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
            }`}
            title="Table Layout"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Warehouse Content Display */}
      {filteredWarehouses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <WarehouseIcon className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No Warehouses Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchTerm || typeFilter !== 'All' || statusFilter !== 'All'
              ? 'No warehouse locations match your current search and filter criteria.'
              : 'Add your primary warehouse, storage godowns, and branch stores to maintain segregated stock.'}
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add First Warehouse</span>
          </button>
        </div>
      ) : viewMode === 'cards' ? (
        /* Card Layout */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
          {filteredWarehouses.map(wh => {
            const locType = wh.locationType || wh.type || 'Main Warehouse';
            const isActive = wh.isActive ?? true;
            const stats = getWarehouseStats(wh.id, wh.code);

            return (
              <div
                key={wh.id}
                className={`bg-white rounded-2xl border transition-all hover:shadow-md flex flex-col justify-between ${
                  isActive ? 'border-slate-200/90 shadow-2xs' : 'border-slate-200 bg-slate-50/50 opacity-80'
                }`}
              >
                <div className="p-5 space-y-3.5">
                  {/* Card Top: Badges & Status */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                        {wh.code}
                      </span>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg border ${getTypeBadge(locType)}`}>
                        {locType}
                      </span>
                      {wh.isDefault && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                          Primary Hub
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => handleToggleStatus(wh)}
                      title={isActive ? 'Click to deactivate' : 'Click to activate'}
                      className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border transition-colors flex items-center gap-1 ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                      }`}
                    >
                      {isActive ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 text-rose-600" /> Inactive
                        </>
                      )}
                    </button>
                  </div>

                  {/* Warehouse Title & Address */}
                  <div>
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600">{wh.name}</h3>
                    {wh.address ? (
                      <p className="text-xs text-slate-500 mt-1 flex items-start gap-1.5 line-clamp-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                        <span>{wh.address}</span>
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 mt-1 italic">No address provided</p>
                    )}
                  </div>

                  {/* Contact Person & Phone */}
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-1 border-t border-slate-100">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Assigned Manager</span>
                      <span className="font-semibold text-slate-800 flex items-center gap-1 truncate mt-0.5" title={wh.managerName || wh.contactPerson || 'Unassigned'}>
                        <User className="w-3 h-3 text-blue-500 shrink-0" />
                        {wh.managerName || wh.contactPerson || <span className="text-slate-400 font-normal italic">Unassigned</span>}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Phone</span>
                      <span className="font-medium text-slate-800 flex items-center gap-1 truncate mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        {wh.phone || '—'}
                      </span>
                    </div>
                  </div>

                  {/* Inventory Summary Metrics */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400">Total SKUs</div>
                      <div className="text-sm font-bold text-slate-800">{stats.skuCount}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400">Stock Qty</div>
                      <div className="text-sm font-bold text-indigo-600">{stats.totalUnits.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400">Stock Value</div>
                      <div className="text-sm font-bold text-emerald-700 truncate">{formatCurrency(stats.totalValuation)}</div>
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="p-3 bg-slate-50/60 border-t border-slate-100 rounded-b-2xl flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleOpenStockModal(wh)}
                    className="flex-1 py-1.5 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <Eye className="w-3.5 h-3.5 text-blue-600" />
                    <span>View Stock</span>
                  </button>

                  <button
                    onClick={() => handleOpenEditModal(wh)}
                    className="p-1.5 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl transition-colors"
                    title="Edit Warehouse"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleOpenDeleteModal(wh)}
                    className="p-1.5 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 rounded-xl transition-colors"
                    title="Delete Warehouse"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table Layout */
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Warehouse</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Contact & Phone</th>
                  <th className="py-3 px-3 text-center">SKUs</th>
                  <th className="py-3 px-3 text-right">Stock Qty</th>
                  <th className="py-3 px-3 text-right">Asset Value</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredWarehouses.map(wh => {
                  const locType = wh.locationType || wh.type || 'Main Warehouse';
                  const isActive = wh.isActive ?? true;
                  const stats = getWarehouseStats(wh.id, wh.code);

                  return (
                    <tr key={wh.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="font-mono text-[11px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/60">
                            {wh.code}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              {wh.name}
                              {wh.isDefault && (
                                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                                  Default
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate max-w-xs">{wh.address || '—'}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border ${getTypeBadge(locType)}`}>
                          {locType}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800 flex items-center gap-1">
                          <User className="w-3 h-3 text-blue-500 shrink-0" />
                          {wh.managerName || wh.contactPerson || <span className="text-slate-400 font-normal italic">Unassigned</span>}
                        </div>
                        <div className="text-[11px] text-slate-500">{wh.phone || '—'}</div>
                      </td>

                      <td className="py-3 px-3 text-center font-bold text-slate-700">{stats.skuCount}</td>

                      <td className="py-3 px-3 text-right font-bold text-indigo-700">
                        {stats.totalUnits.toLocaleString()}
                      </td>

                      <td className="py-3 px-3 text-right font-bold text-emerald-700">
                        {formatCurrency(stats.totalValuation)}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleToggleStatus(wh)}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenStockModal(wh)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Stock Breakdown"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(wh)}
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenDeleteModal(wh)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Warehouse Create / Edit Modal */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={selectedWarehouse ? `Edit Warehouse: ${selectedWarehouse.name}` : 'Add New Warehouse Location'}
        subtitle="Configure physical store, branch hub, godown, or dispatch facility"
        size="lg"
        footer={
          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsFormModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmitForm}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-60 flex items-center gap-1.5 shadow-xs transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{selectedWarehouse ? 'Update Warehouse' : 'Create Warehouse'}</span>
              )}
            </button>
          </div>
        }
      >
        <form onSubmit={handleSubmitForm} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Warehouse Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="e.g. East Coast Distribution Hub"
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Unique Warehouse Code <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formCode}
                onChange={e => setFormCode(e.target.value.toUpperCase())}
                placeholder="e.g. WH-EAST-01"
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Location Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={formType}
                onChange={e => setFormType(e.target.value as WarehouseType)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-medium"
              >
                {LOCATION_TYPES.map(t => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Assigned Warehouse Manager</label>
              <select
                value={formManagerId}
                onChange={e => {
                  const mId = e.target.value;
                  setFormManagerId(mId);
                  const matched = (users || []).find(u => u.id === mId);
                  if (matched && !formContactPerson) {
                    setFormContactPerson(matched.name);
                  }
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-medium"
              >
                <option value="">-- Unassigned (Company Inventory Team) --</option>
                {eligibleManagers.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.role}) — {m.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Contact Person Name</label>
              <input
                type="text"
                value={formContactPerson}
                onChange={e => setFormContactPerson(e.target.value)}
                placeholder="e.g. Rajesh Sharma (Manager)"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
              <input
                type="tel"
                value={formPhone}
                onChange={e => setFormPhone(e.target.value)}
                placeholder="e.g. +91 98765 43210"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-medium"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Address / Location Details</label>
              <input
                type="text"
                value={formAddress}
                onChange={e => setFormAddress(e.target.value)}
                placeholder="e.g. Shed 14, Industrial Area Phase II, Chennai"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Description / Notes (Optional)</label>
            <textarea
              rows={2}
              value={formDescription}
              onChange={e => setFormDescription(e.target.value)}
              placeholder="e.g. Temperature controlled bulk storage facility for raw materials..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-medium"
            />
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-900 block">Active Status</span>
                <span className="text-[11px] text-slate-500">
                  Active locations can receive purchase goods and participate in stock transfers.
                </span>
              </div>
              <input
                type="checkbox"
                checked={formIsActive}
                onChange={e => setFormIsActive(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200/80">
              <div>
                <span className="font-semibold text-slate-900 block">Set as Primary Central Hub</span>
                <span className="text-[11px] text-slate-500">
                  Automatically pre-selected for purchase bills and sales order dispatch.
                </span>
              </div>
              <input
                type="checkbox"
                checked={formIsDefault}
                onChange={e => setFormIsDefault(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Warehouse Stock Breakdown Modal */}
      <Modal
        isOpen={isStockModalOpen}
        onClose={() => setIsStockModalOpen(false)}
        title={`Stock Inventory: ${selectedWarehouse?.name || ''}`}
        subtitle={`Warehouse Code: ${selectedWarehouse?.code || ''} • Location Type: ${selectedWarehouse?.locationType || selectedWarehouse?.type || ''}`}
        size="lg"
        footer={
          <div className="flex justify-between items-center w-full">
            <div className="text-xs text-slate-500">
              Showing <span className="font-bold text-slate-800">{selectedWarehouseProducts.length}</span> stocked products
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsStockModalOpen(false);
                  navigate('/inventory/transfers');
                }}
                className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Transfer From This Warehouse</span>
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-3.5 text-xs">
          {/* Search inside modal */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={stockSearchTerm}
              onChange={e => setStockSearchTerm(e.target.value)}
              placeholder="Search products in this warehouse by name, SKU, category..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
            />
          </div>

          {selectedWarehouseProducts.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <Package className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="font-semibold text-slate-700">No products stocked in this warehouse</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Transfer stock to this location or receive purchase bills here.
              </p>
            </div>
          ) : (
            <div className="max-h-[380px] overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-[10px] uppercase font-semibold text-slate-500">
                  <tr>
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3 text-right">Available Qty</th>
                    <th className="py-2.5 px-3 text-right">Unit Cost</th>
                    <th className="py-2.5 px-3 text-right">Stock Valuation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {selectedWarehouseProducts.map(({ product, qty, cost, valuation }) => (
                    <tr key={product.id} className="hover:bg-slate-50/60">
                      <td className="py-2 px-3 font-semibold text-slate-900">{product.name}</td>
                      <td className="py-2 px-3 font-mono text-[11px] text-slate-500">{product.sku}</td>
                      <td className="py-2 px-3 text-right font-bold">
                        <span className={qty > 0 ? 'text-indigo-700' : 'text-slate-400'}>
                          {qty.toLocaleString()} {product.primaryUnit}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right text-slate-600">{formatCurrency(cost)}</td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-700">{formatCurrency(valuation)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirm Warehouse Deletion"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleConfirmDelete}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <span>Confirm Delete</span>
              )}
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Are you sure you want to delete this warehouse?</p>
              <p className="text-[11px] text-amber-700 mt-1">
                Warehouse: <strong className="text-slate-900">{selectedWarehouse?.name}</strong> ({selectedWarehouse?.code})
              </p>
            </div>
          </div>
          <p className="text-slate-500">
            Note: Warehouses containing active in-stock inventory or pending stock transfers cannot be deleted and will be archived instead to prevent inventory corruption.
          </p>
        </div>
      </Modal>
    </div>
  );
};
