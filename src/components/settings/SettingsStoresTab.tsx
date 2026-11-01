import React, { useState } from 'react';
import {
  Building,
  Plus,
  Search,
  CheckCircle,
  MapPin,
  Edit2
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { DataTable, Column } from '../common/DataTable';
import { Warehouse } from '../../types';
import { Modal } from '../common/Modal';

export const SettingsStoresTab: React.FC = () => {
  const { warehouses = [], addWarehouse, updateWarehouse } = useERP();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Warehouse | null>(null);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [type, setType] = useState<Warehouse['type']>('Main Warehouse');

  const handleOpenAdd = () => {
    setEditingStore(null);
    setName('');
    setCode('');
    setAddress('');
    setType('Main Warehouse');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;

    if (editingStore) {
      await updateWarehouse(editingStore.id, {
        name: name.trim(),
        code: code.trim(),
        address: address.trim() || undefined,
        type
      });
    } else {
      await addWarehouse({
        name: name.trim(),
        code: code.trim(),
        address: address.trim() || '',
        type,
        isActive: true
      });
    }

    setIsModalOpen(false);
  };

  const columns: Column<Warehouse>[] = [
    {
      key: 'code',
      header: 'Code',
      render: row => <span className="font-mono font-bold text-blue-600 text-xs">{row.code}</span>
    },
    {
      key: 'name',
      header: 'Store / Warehouse Name',
      render: row => (
        <div>
          <span className="font-semibold text-slate-900 block">{row.name}</span>
          <span className="text-[10px] text-slate-400">{row.address || 'Central Address'}</span>
        </div>
      )
    },
    {
      key: 'type',
      header: 'Location Type',
      render: row => (
        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
          {row.type}
        </span>
      )
    },
    {
      key: 'isActive',
      header: 'Status',
      align: 'center',
      render: row => (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
          <CheckCircle className="w-3.5 h-3.5" />
          <span>Active</span>
        </span>
      )
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
        <div>
          <span className="text-xs font-bold text-slate-800">Stores, Outlets & Warehouse Locations</span>
          <p className="text-[11px] text-slate-500">Configure retail counter outlets and regional storage warehouses.</p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Location</span>
        </button>
      </div>

      <DataTable
        title="Store & Warehouse Directory"
        subtitle={`Total ${warehouses.length} active locations`}
        columns={columns}
        data={warehouses}
        searchPlaceholder="Search store name or code..."
        searchKeys={['name', 'code', 'type']}
      />

      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingStore ? 'Edit Location' : 'Add Store / Warehouse Location'}
          subtitle="Configure location code, address, and warehouse type"
          size="md"
        >
          <form onSubmit={handleSave} className="space-y-4 pt-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Store / Warehouse Name *</label>
                <input
                  type="text"
                  placeholder="e.g. South Branch Store"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Location Code *</label>
                <input
                  type="text"
                  placeholder="e.g. SOUTH-01"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono uppercase"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Location Type</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as Warehouse['type'])}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="Main Warehouse">Main Warehouse / Central Godown</option>
                <option value="Branch Warehouse">Branch Warehouse</option>
                <option value="Store">Retail Sales Counter / Store</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Physical Address</label>
              <input
                type="text"
                placeholder="Street address or landmark"
                value={address}
                onChange={e => setAddress(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-xs"
              >
                Save Location
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

