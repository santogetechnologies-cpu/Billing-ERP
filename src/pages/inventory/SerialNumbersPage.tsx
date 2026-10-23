import React, { useState } from 'react';
import {
  ShieldCheck,
  Plus,
  Package,
  Users,
  FileText,
  Clock,
  CheckCircle,
  Search,
  Check
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatDate } from '../../utils/formatters';
import { SerialNumber } from '../../types';
import { Modal } from '../../components/common/Modal';

export const SerialNumbersPage: React.FC = () => {
  const { serialNumbers, products, customers, addSerialNumber } = useERP();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New serial form
  const [productId, setProductId] = useState(products[0]?.id || '');
  const [serialNumber, setSerialNumber] = useState('');
  const [warrantyMonths, setWarrantyMonths] = useState<string>('12');
  const [customerId, setCustomerId] = useState('');

  const handleCreateSerial = (e: React.FormEvent) => {
    e.preventDefault();
    const prod = products.find(p => p.id === productId);
    if (!prod) {
      alert('Please select a valid product first.');
      return;
    }
    const cust = customers.find(c => c.id === customerId);

    let maxSeq = 1000;
    serialNumbers.forEach(s => {
      const match = (s.serialNumber || '').match(/SN-.*?(\d+)$/);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    });
    const autoSN = `SN-${String(maxSeq + 1).padStart(6, '0')}`;

    addSerialNumber({
      productId: prod.id,
      productName: prod.name,
      serialNumber: serialNumber || autoSN,
      purchaseDate: new Date().toISOString().split('T')[0],
      warrantyMonths: Number(warrantyMonths) || 0,
      warrantyStatus: cust ? 'Active' : 'In Stock',
      customerId: cust?.id,
      customerName: cust?.name,
      invoiceNumber: undefined
    });

    setIsModalOpen(false);
  };

  const columns: Column<SerialNumber>[] = [
    {
      key: 'serialNumber',
      header: 'Serial Number',
      width: '16%',
      render: row => (
        <span className="font-mono font-bold text-blue-600">{row.serialNumber}</span>
      )
    },
    {
      key: 'productName',
      header: 'Product',
      width: '24%',
      render: row => (
        <span className="font-semibold text-slate-900 block truncate" title={row.productName}>
          {row.productName}
        </span>
      )
    },
    {
      key: 'customerName',
      header: 'Assigned Customer',
      width: '18%',
      render: row => (
        <span className="text-slate-800 font-medium truncate block" title={row.customerName || 'In Warehouse Stock'}>
          {row.customerName || 'In Warehouse Stock'}
        </span>
      )
    },
    {
      key: 'invoiceNumber',
      header: 'Invoice #',
      width: '12%',
      render: row => (
        <span className="font-mono text-slate-600">{row.invoiceNumber || '—'}</span>
      )
    },
    {
      key: 'purchaseDate',
      header: 'Sold / Issued Date',
      width: '14%',
      render: row => formatDate(row.purchaseDate)
    },
    {
      key: 'warrantyMonths',
      header: 'Warranty',
      align: 'center',
      width: '8%',
      render: row => (
        <span className="font-medium text-slate-700">{row.warrantyMonths} Months</span>
      )
    },
    {
      key: 'warrantyStatus',
      header: 'Warranty Status',
      align: 'center',
      width: '8%',
      render: row => <StatusBadge status={row.warrantyStatus} size="sm" />
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            Serial Number & Warranty Lifecycle Tracking
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            End-to-end trace: Product → Serial Number → Customer → Invoice → Warranty Period.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Register Serial Number</span>
        </button>
      </div>

      {/* Serial Numbers DataTable */}
      <DataTable
        title="Serialized Asset Master"
        subtitle={`Total ${serialNumbers.length} serialized products tracked`}
        columns={columns}
        data={serialNumbers}
        searchPlaceholder="Search serial number, product, customer or invoice..."
        searchKeys={['serialNumber', 'productName', 'customerName', 'invoiceNumber']}
        hideHorizontalScroll={true}
        filters={[
          {
            key: 'warrantyStatus',
            label: 'Warranty Status',
            options: [
              { label: 'Active', value: 'Active' },
              { label: 'In Stock', value: 'In Stock' },
              { label: 'Expired', value: 'Expired' }
            ]
          }
        ]}
      />

      {/* New Serial Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Register Unit Serial Number"
        subtitle="Associate serial code with equipment and warranty coverage"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsModalOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateSerial}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Register Serial
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 mb-1">Select Product</label>
            <select
              value={productId}
              onChange={e => setProductId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
            >
              {products
                .filter(p => p.serialTracking || p.category.includes('IT') || p.category.includes('Tools'))
                .map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Serial Number</label>
            <input
              type="text"
              required
              value={serialNumber}
              onChange={e => setSerialNumber(e.target.value.toUpperCase())}
              placeholder="e.g. DELL-SN-998128"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Warranty Term (Months)</label>
            <input
              type="number"
              min="0"
              value={warrantyMonths}
              onChange={e => {
                const raw = e.target.value;
                if (raw === '') { setWarrantyMonths(''); return; }
                if (raw.includes('-')) return;
                setWarrantyMonths(raw.replace(/^0+(?=\d)/, ''));
              }}
              placeholder="0"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Assign Customer (Optional / Leave blank if In Stock)
            </label>
            <select
              value={customerId}
              onChange={e => setCustomerId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
            >
              <option value="">Unassigned (In Stock)</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
};
