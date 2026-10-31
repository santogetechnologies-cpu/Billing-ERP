import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Users,
  Plus,
  Building,
  Building2,
  Phone,
  Mail,
  CreditCard,
  RotateCcw
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { Tabs, TabItem } from '../../components/common/Tabs';
import { PartyCustomersTab } from '../../components/parties/PartyCustomersTab';
import { PartySuppliersTab } from '../../components/parties/PartySuppliersTab';
import { PartyDealersTab } from '../../components/parties/PartyDealersTab';
import { PartyModal } from '../../components/parties/PartyModal';
import { Customer, Supplier } from '../../types';

export const CustomersPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { customers = [], suppliers = [] } = useERP();

  const [activeTab, setActiveTab] = useState<string>(() => searchParams.get('tab') || 'customers');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<Customer | Supplier | null>(null);

  // Sync ?tab= in URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  // Tab Badge counts
  const retailCustomers = useMemo(() => customers.filter(c => c.type !== 'Dealer'), [customers]);
  const dealerShops = useMemo(() => customers.filter(c => c.type === 'Dealer'), [customers]);

  const partyTabs: TabItem[] = [
    { id: 'customers', label: 'Customers', count: retailCustomers.length, icon: Users },
    { id: 'suppliers', label: 'Suppliers', count: suppliers.length, icon: Building2 },
    { id: 'dealers', label: 'Shops / Dealers', count: dealerShops.length, icon: Building }
  ];

  const handleOpenAdd = () => {
    setEditingParty(null);
    setIsModalOpen(true);
  };

  const handleEditCustomer = (c: Customer) => {
    setEditingParty(c);
    setIsModalOpen(true);
  };

  const handleEditSupplier = (s: Supplier) => {
    setEditingParty(s);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Universal Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            Commercial Parties & Contacts
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Customer receivables, supplier payables, dealer accounts, credit terms, and GSTIN master.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ New Party</span>
        </button>
      </div>

      {/* In-Page Horizontal Tabs */}
      <Tabs
        tabs={partyTabs}
        activeTab={activeTab}
        onChange={tab => {
          setActiveTab(tab);
          setSearchParams({ tab });
        }}
      />

      {/* Tab 1: Customers */}
      {activeTab === 'customers' && (
        <PartyCustomersTab onEditCustomer={handleEditCustomer} />
      )}

      {/* Tab 2: Suppliers */}
      {activeTab === 'suppliers' && (
        <PartySuppliersTab onEditSupplier={handleEditSupplier} />
      )}

      {/* Tab 3: Shops / Dealers */}
      {activeTab === 'dealers' && (
        <PartyDealersTab onEditDealer={handleEditCustomer} />
      )}

      {/* Reusable Party Modal */}
      <PartyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialPartyType={activeTab === 'suppliers' ? 'Supplier' : activeTab === 'dealers' ? 'Dealer' : 'Customer'}
        editingParty={editingParty}
      />
    </div>
  );
};
