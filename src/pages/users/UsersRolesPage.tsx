import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  LayoutGrid,
  List,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Shield,
  Mail,
  Clock,
  ArrowRight,
  ShieldCheck,
  Check,
  X,
  Eye,
  EyeOff,
  UserCheck,
  AlertTriangle,
  Loader2,
  Lock,
  Sparkles,
  Radio,
  Power,
  Activity,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { SystemUser, UserRole, AccountStatus, PresenceStatus } from '../../types';
import { Modal } from '../../components/common/Modal';
import { ROLE_PERMISSIONS_MATRIX, AppModule, AppAction } from '../../utils/rbac';
import { presenceService } from '../../services/presenceService';

export const UsersRolesPage: React.FC = () => {
  const { user: authUser } = useAuth();
  const { users, addUser, updateUser, deleteUser, toggleAccountStatus, permissions, updatePermission } = useERP();

  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [presenceFilter, setPresenceFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [accountStatusFilter, setAccountStatusFilter] = useState<'All' | 'Enabled' | 'Disabled'>('All');
  const [userViewMode, setUserViewMode] = useState<'grid' | 'table'>('table');

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add User Form State
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('Salesperson');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Edit User Form State
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('Salesperson');
  const [editAccountStatus, setEditAccountStatus] = useState<AccountStatus>('Enabled');

  // Role details
  const [expandedRole, setExpandedRole] = useState<UserRole | null>(null);

  const defaultRoles: UserRole[] = [
    'Owner',
    'Admin',
    'Accountant',
    'Salesperson',
    'Purchase Manager',
    'Warehouse Manager',
    'Cashier'
  ];

  // Assignable staff roles (Owner is a reserved master role and cannot be assigned to new team members)
  const assignableRoles: UserRole[] = [
    'Admin',
    'Accountant',
    'Salesperson',
    'Purchase Manager',
    'Warehouse Manager',
    'Cashier'
  ];

  // RBAC Permission Matrix View State
  const [matrixRole, setMatrixRole] = useState<'All' | UserRole>('All');
  const [matrixSearch, setMatrixSearch] = useState('');

  const allModuleDefs: { id: AppModule; name: string; category: string; desc: string }[] = [
    { id: 'dashboard', name: 'Dashboard & Metrics', category: 'General', desc: 'KPI summaries, quick metrics, operational overview' },
    { id: 'sales', name: 'Sales & Invoicing', category: 'Sales', desc: 'Invoices, orders, credit notes, sales tax documents' },
    { id: 'pos', name: 'Point of Sale (POS)', category: 'Sales', desc: 'Quick counter retail billing and cashier register' },
    { id: 'customers', name: 'Customer Management', category: 'Sales', desc: 'Customer directories, contact records, payment ledger' },
    { id: 'purchases', name: 'Purchases & Bills', category: 'Procurement', desc: 'Purchase orders, vendor bills, goods receipts' },
    { id: 'suppliers', name: 'Supplier Management', category: 'Procurement', desc: 'Supplier master directory, vendor contact information' },
    { id: 'products', name: 'Product Catalog', category: 'Inventory', desc: 'Items, SKU pricing, barcodes, product classification' },
    { id: 'inventory', name: 'Warehouse & Stock', category: 'Inventory', desc: 'Warehouses, transfers, adjustments, batches, serials' },
    { id: 'barcode', name: 'Barcode Generation', category: 'Inventory', desc: 'Product barcode design, label printing, SKU tags' },
    { id: 'payments', name: 'Payments & Banking', category: 'Finance', desc: 'Bank accounts, cash books, receivables, payables' },
    { id: 'expenses', name: 'Expense Tracking', category: 'Finance', desc: 'Operational expense vouchers and category logs' },
    { id: 'accounting', name: 'Double-Entry Accounting', category: 'Finance', desc: 'Chart of accounts, general ledger, journal entries' },
    { id: 'taxes', name: 'Taxes & GST Filing', category: 'Finance', desc: 'GST reports, tax slabs, input/output tax liability' },
    { id: 'reports', name: 'Business Reports', category: 'Analytics', desc: 'Profit & Loss, balance sheets, executive analytics' },
    { id: 'users', name: 'User & Staff Provisioning', category: 'Administration', desc: 'Team member credentials, role assignments, security' },
    { id: 'audit', name: 'Audit & Compliance Logs', category: 'Administration', desc: 'System activity history and compliance audit trail' },
    { id: 'settings', name: 'Company Settings', category: 'Administration', desc: 'Business profile, invoice templates, financial configurations' }
  ];

  const granularActions: { id: AppAction; label: string }[] = [
    { id: 'view', label: 'View' },
    { id: 'create', label: 'Create' },
    { id: 'edit', label: 'Edit' },
    { id: 'delete', label: 'Delete' },
    { id: 'approve', label: 'Approve' },
    { id: 'export', label: 'Export' },
    { id: 'manage', label: 'Manage' }
  ];

  const roleDescriptions: Record<UserRole, { desc: string; accessSummary: string; color: string }> = {
    Owner: {
      desc: 'Full unrestricted master access across all business finances, settings, reports, and staff management.',
      accessSummary: 'Full System Control',
      color: 'purple'
    },
    Admin: {
      desc: 'Manages company settings, user provisioning, general master records, and audits.',
      accessSummary: 'Administrative Oversight',
      color: 'blue'
    },
    Accountant: {
      desc: 'Full access to double-entry ledger, bank reconciliation, journals, chart of accounts, and tax reporting.',
      accessSummary: 'Accounting & Finances',
      color: 'emerald'
    },
    Salesperson: {
      desc: 'Creates customer quotes, sales orders, tax invoices, and handles payment collections.',
      accessSummary: 'Sales & Customer Billing',
      color: 'amber'
    },
    'Purchase Manager': {
      desc: 'Manages suppliers, purchase orders, goods receipts, and vendor bills.',
      accessSummary: 'Purchasing & Vendors',
      color: 'cyan'
    },
    'Warehouse Manager': {
      desc: 'Tracks warehouse stocks, handles product transfers, stock adjustments, and batches.',
      accessSummary: 'Inventory & Stock Logistics',
      color: 'indigo'
    },
    Cashier: {
      desc: 'Fast front-desk point of sale, customer billing, and daily cash drawer reconciliation.',
      accessSummary: 'POS & Counter Sales',
      color: 'rose'
    }
  };

  useEffect(() => {
    if (isAddModalOpen) {
      setNewName('');
      setNewEmail('');
      setNewRole('Salesperson');
      setNewPassword('');
      setShowPassword(false);
    }
  }, [isAddModalOpen]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim() || isSubmitting) return;

    const trimmedPass = newPassword.trim();
    if (trimmedPass && trimmedPass.length < 6) {
      alert('Password must be at least 6 characters long.');
      return;
    }

    const emailNorm = newEmail.trim().toLowerCase();
    const existing = users.find(u => u.email.toLowerCase() === emailNorm);
    if (existing) {
      const confirmOverwrite = window.confirm(
        `A user with email "${newEmail.trim()}" already exists (${existing.name} - ${existing.role}). Do you want to update their details?`
      );
      if (!confirmOverwrite) return;
    }

    const finalPassword = trimmedPass.length >= 6 ? trimmedPass : 'TempPassword#2026';

    try {
      setIsSubmitting(true);
      await addUser(
        {
          name: newName.trim(),
          email: newEmail.trim(),
          role: newRole,
          status: 'Active',
          accountStatus: 'Enabled',
          presenceStatus: 'Inactive',
          lastLogin: 'Never'
        },
        finalPassword
      );
      setIsAddModalOpen(false);
    } catch (err: any) {
      alert(err?.message || 'Failed to create user. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (user: SystemUser) => {
    setSelectedUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditAccountStatus(user.accountStatus === 'Disabled' || user.status === 'Inactive' ? 'Disabled' : 'Enabled');
    setIsEditModalOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !editName.trim() || !editEmail.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await updateUser(selectedUser.id, {
        name: editName.trim(),
        email: editEmail.trim(),
        role: editRole,
        accountStatus: editAccountStatus,
        status: editAccountStatus === 'Disabled' ? 'Inactive' : 'Active'
      });

      setIsEditModalOpen(false);
      setSelectedUser(null);
    } catch (err: any) {
      alert(err?.message || 'Failed to update user. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleAccountStatus = async (targetUser: SystemUser) => {
    if (authUser && targetUser.id === authUser.id) {
      alert('Security policy: You cannot disable your own administrator account.');
      return;
    }
    const nextStatus: AccountStatus = targetUser.accountStatus === 'Disabled' ? 'Enabled' : 'Disabled';
    const actionLabel = nextStatus === 'Disabled' ? 'disable' : 'enable';
    if (!window.confirm(`Are you sure you want to ${actionLabel} login access for "${targetUser.name}" (${targetUser.email})?`)) {
      return;
    }
    try {
      await toggleAccountStatus(targetUser.id, nextStatus);
    } catch (err: any) {
      alert(err?.message || 'Failed to update account status.');
    }
  };

  const openDeleteModal = (user: SystemUser) => {
    setSelectedUser(user);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!selectedUser) return;
    await deleteUser(selectedUser.id);
    setIsDeleteModalOpen(false);
    setSelectedUser(null);
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'Owner':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Admin':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Accountant':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Salesperson':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Purchase Manager':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      case 'Warehouse Manager':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Cashier':
        return 'bg-rose-50 text-rose-700 border-rose-200';
    }
  };

  // Filtered Users list
  const filteredUsers = users.filter(u => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.role.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'All' || u.role === roleFilter;
    const matchesPresence = presenceFilter === 'All' || u.presenceStatus === presenceFilter;
    const matchesAccountStatus = accountStatusFilter === 'All' || u.accountStatus === accountStatusFilter;
    return matchesSearch && matchesRole && matchesPresence && matchesAccountStatus;
  });

  const onlineUsersCount = users.filter(u => u.presenceStatus === 'Active').length;
  const offlineUsersCount = users.filter(u => u.presenceStatus !== 'Active').length;
  const enabledUsersCount = users.filter(u => u.accountStatus !== 'Disabled').length;
  const disabledUsersCount = users.filter(u => u.accountStatus === 'Disabled').length;

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Users className="w-4.5 h-4.5" />
            </div>
            User Management Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Create, view, and organize team members, access roles, and system privileges.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add New User</span>
          </button>
        </div>
      </div>

      {/* 2. Stat KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* All Users */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('users');
            setPresenceFilter('All');
            setAccountStatusFilter('All');
            setRoleFilter('All');
            setSearchTerm('');
          }}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            activeTab === 'users' && presenceFilter === 'All' && accountStatusFilter === 'All' && roleFilter === 'All'
              ? 'bg-blue-50/50 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
              : 'bg-white border-slate-200/90 hover:border-blue-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] uppercase font-bold tracking-wider">Total Staff</span>
            <Users className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <span className="text-2xl font-bold text-slate-900 block font-mono mt-1">
            {users.length}
          </span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Registered team members</span>
        </button>

        {/* Online Now (Active Presence) */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('users');
            setPresenceFilter('Active');
            setAccountStatusFilter('All');
            setSearchTerm('');
          }}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            activeTab === 'users' && presenceFilter === 'Active'
              ? 'bg-emerald-50/50 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
              : 'bg-white border-slate-200/90 hover:border-emerald-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] uppercase font-bold tracking-wider">Online Presence</span>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <Radio className="w-3.5 h-3.5 text-emerald-600" />
            </div>
          </div>
          <span className="text-2xl font-bold text-emerald-700 block font-mono mt-1">
            {onlineUsersCount}
          </span>
          <span className="text-[11px] text-emerald-600 font-semibold mt-0.5 block">Heartbeat active (&lt; 2 mins)</span>
        </button>

        {/* Enabled Accounts */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('users');
            setAccountStatusFilter('Enabled');
            setPresenceFilter('All');
            setSearchTerm('');
          }}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            activeTab === 'users' && accountStatusFilter === 'Enabled'
              ? 'bg-indigo-50/50 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
              : 'bg-white border-slate-200/90 hover:border-indigo-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] uppercase font-bold tracking-wider">Enabled Accounts</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <span className="text-2xl font-bold text-indigo-700 block font-mono mt-1">
            {enabledUsersCount}
          </span>
          <span className="text-[11px] text-indigo-600 font-semibold mt-0.5 block">Authorized to login</span>
        </button>

        {/* Disabled Accounts */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('users');
            setAccountStatusFilter('Disabled');
            setPresenceFilter('All');
            setSearchTerm('');
          }}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            activeTab === 'users' && accountStatusFilter === 'Disabled'
              ? 'bg-rose-50/50 border-rose-500 ring-2 ring-rose-500/20 shadow-xs'
              : 'bg-white border-slate-200/90 hover:border-rose-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] uppercase font-bold tracking-wider">Disabled Accounts</span>
            <XCircle className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <span className="text-2xl font-bold text-rose-700 block font-mono mt-1">
            {disabledUsersCount}
          </span>
          <span className="text-[11px] text-rose-600 font-semibold mt-0.5 block">Suspended / blocked</span>
        </button>
      </div>

      {/* TAB 1: TEAM MEMBERS */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Simple Search & Filters Toolbar */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative w-full md:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, email, or role..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-8.5 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Role Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
                <Filter className="w-3 h-3 text-slate-400" />
                <select
                  value={roleFilter}
                  onChange={e => setRoleFilter(e.target.value)}
                  className="bg-transparent text-slate-700 font-medium focus:outline-none cursor-pointer text-xs"
                >
                  <option value="All">All Roles ({users.length})</option>
                  {defaultRoles.map(r => (
                    <option key={r} value={r}>
                      {r} ({users.filter(u => u.role === r).length})
                    </option>
                  ))}
                </select>
              </div>

              {/* Login Presence Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
                <Radio className="w-3 h-3 text-emerald-500" />
                <select
                  value={presenceFilter}
                  onChange={e => setPresenceFilter(e.target.value as any)}
                  className="bg-transparent text-slate-700 font-medium focus:outline-none cursor-pointer text-xs"
                >
                  <option value="All">All Presence ({users.length})</option>
                  <option value="Active">Online Active ({onlineUsersCount})</option>
                  <option value="Inactive">Offline Inactive ({offlineUsersCount})</option>
                </select>
              </div>

              {/* Account Status Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
                <ShieldCheck className="w-3 h-3 text-indigo-500" />
                <select
                  value={accountStatusFilter}
                  onChange={e => setAccountStatusFilter(e.target.value as any)}
                  className="bg-transparent text-slate-700 font-medium focus:outline-none cursor-pointer text-xs"
                >
                  <option value="All">All Accounts ({users.length})</option>
                  <option value="Enabled">Enabled ({enabledUsersCount})</option>
                  <option value="Disabled">Disabled ({disabledUsersCount})</option>
                </select>
              </div>

              {/* Grid / Table Segmented Button */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setUserViewMode('grid')}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    userViewMode === 'grid'
                      ? 'bg-white text-blue-600 shadow-xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Grid Cards View"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Grid</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUserViewMode('table')}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    userViewMode === 'table'
                      ? 'bg-white text-blue-600 shadow-xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Table List View"
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Table</span>
                </button>
              </div>
            </div>
          </div>

          {/* EMPTY STATE */}
          {filteredUsers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center shadow-2xs">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800">No users found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                No team members match your current search or filter criteria.
              </p>
              {(searchTerm || roleFilter !== 'All' || presenceFilter !== 'All' || accountStatusFilter !== 'All') && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setRoleFilter('All');
                    setPresenceFilter('All');
                    setAccountStatusFilter('All');
                  }}
                  className="mt-4 px-3.5 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          ) : userViewMode === 'grid' ? (
            /* GRID VIEW (CARDS) */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredUsers.map(user => {
                const initial = user.name ? user.name.charAt(0).toUpperCase() : 'U';
                const isOnline = user.presenceStatus === 'Active';
                const isEnabled = user.accountStatus !== 'Disabled';
                const isSelf = authUser?.id === user.id;

                return (
                  <div
                    key={user.id}
                    className="bg-white rounded-2xl border border-slate-200/90 p-4.5 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all flex flex-col justify-between group"
                  >
                    <div>
                      {/* Top Bar: Avatar & Badges */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative shrink-0">
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-bold text-base flex items-center justify-center shadow-xs">
                              {initial}
                            </div>
                            {/* Green online dot if online, gray dot if offline */}
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                                isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                              }`}
                              title={isOnline ? 'Active Online' : 'Inactive Offline'}
                            />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-slate-900 text-sm truncate group-hover:text-blue-600 transition-colors" title={user.name}>
                              {user.name}
                            </h3>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${getRoleBadge(user.role)}`}>
                                {user.role}
                              </span>
                              {isSelf && (
                                <span className="text-[10px] text-blue-600 font-semibold">(You)</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Presence Badge: Green if Active, Gray if Inactive */}
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                            isOnline
                              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                              : 'text-slate-600 bg-slate-100 border-slate-200'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                          {isOnline ? 'Active' : 'Inactive'}
                        </span>
                      </div>

                      {/* Account Status Badge: Green if Enabled, Red if Disabled */}
                      <div className="mt-3 flex items-center justify-between text-xs">
                        <span className="text-[11px] text-slate-500 font-medium">Account Access:</span>
                        <button
                          type="button"
                          onClick={() => handleToggleAccountStatus(user)}
                          disabled={isSelf}
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${
                            !isEnabled
                              ? 'text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100'
                              : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                          } ${isSelf ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                          title={isSelf ? 'Cannot self-disable' : `Click to toggle account access`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${!isEnabled ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                          {isEnabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </div>

                      {/* Contact / Email */}
                      <div className="mt-2.5 text-xs">
                        <a
                          href={`mailto:${user.email}`}
                          className="flex items-center gap-1.5 text-slate-600 hover:text-blue-600 font-mono text-[11px] truncate transition-colors"
                          title={user.email}
                        >
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{user.email}</span>
                        </a>
                      </div>

                      {/* Activity Details */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1 text-[10px] text-slate-500">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-slate-400">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>Last Login:</span>
                          </span>
                          <span className="font-medium text-slate-700">{user.lastLogin || 'Never'}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-slate-400">
                            <Activity className="w-3 h-3 text-slate-400" />
                            <span>Last Seen:</span>
                          </span>
                          <span className="font-semibold text-slate-800" title={user.lastSeenAt || 'Never'}>
                            {presenceService.formatActivityTime(user.lastSeenAt)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-slate-400">
                            <Power className="w-3 h-3 text-slate-400" />
                            <span>Last Logout:</span>
                          </span>
                          <span className="font-medium text-slate-600" title={user.lastLogoutAt || 'Never'}>
                            {presenceService.formatActivityTime(user.lastLogoutAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleAccountStatus(user)}
                        disabled={isSelf}
                        className={`py-1.5 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 border transition-colors ${
                          isSelf
                            ? 'text-slate-400 bg-slate-50 border-slate-200 cursor-not-allowed opacity-60'
                            : isEnabled
                            ? 'text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-200 cursor-pointer'
                            : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200 cursor-pointer'
                        }`}
                        title={isSelf ? 'Cannot self-disable' : isEnabled ? 'Disable Account' : 'Enable Account'}
                      >
                        <Power className="w-3 h-3" />
                        <span>{isEnabled ? 'Disable' : 'Enable'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditModal(user)}
                        className="flex-1 py-1.5 px-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3 text-slate-500" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openDeleteModal(user)}
                        className="py-1.5 px-2.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                        title="Delete user"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* TABLE VIEW (LIST WITH COMPLETE TRACKING) */
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-semibold text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">User</th>
                      <th className="py-3.5 px-4">Email</th>
                      <th className="py-3.5 px-4">Role</th>
                      <th className="py-3.5 px-4">Account Status</th>
                      <th className="py-3.5 px-4">Login Presence</th>
                      <th className="py-3.5 px-4">Last Login</th>
                      <th className="py-3.5 px-4">Last Seen</th>
                      <th className="py-3.5 px-4">Last Logout</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map(user => {
                      const initial = user.name ? user.name.charAt(0).toUpperCase() : 'U';
                      const isOnline = user.presenceStatus === 'Active';
                      const isEnabled = user.accountStatus !== 'Disabled';
                      const isSelf = authUser?.id === user.id;

                      return (
                        <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-2xs">
                                  {initial}
                                </div>
                                <span
                                  className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                                    isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                                  }`}
                                  title={isOnline ? 'Online now' : 'Offline'}
                                />
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 block">{user.name}</span>
                                {isSelf && (
                                  <span className="text-[10px] text-blue-600 font-semibold">(You)</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600">{user.email}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getRoleBadge(user.role)}`}>
                              {user.role}
                            </span>
                          </td>
                          {/* Account Status: Red if Disabled, Emerald if Enabled */}
                          <td className="py-3 px-4">
                            <button
                              type="button"
                              onClick={() => handleToggleAccountStatus(user)}
                              disabled={isSelf}
                              className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full border transition-all ${
                                !isEnabled
                                  ? 'text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100'
                                  : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                              } ${isSelf ? 'opacity-80 cursor-not-allowed' : 'cursor-pointer'}`}
                              title={isSelf ? 'Cannot self-disable' : `Click to toggle account access to ${isEnabled ? 'Disabled' : 'Enabled'}`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${!isEnabled ? 'bg-rose-500' : 'bg-emerald-500'}`}
                              />
                              {isEnabled ? 'Enabled' : 'Disabled'}
                            </button>
                          </td>
                          {/* Login Presence: Green pulse if Active, Gray if Inactive */}
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                                isOnline
                                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                  : 'text-slate-600 bg-slate-100 border-slate-200'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isOnline ? 'bg-emerald-500 animate-pulse ring-2 ring-emerald-400/40' : 'bg-slate-400'
                                }`}
                              />
                              {isOnline ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                            {user.lastLogin || 'Never'}
                          </td>
                          <td className="py-3 px-4 text-slate-700 text-[11px] font-semibold whitespace-nowrap" title={user.lastSeenAt || 'Never'}>
                            {presenceService.formatActivityTime(user.lastSeenAt)}
                          </td>
                          <td className="py-3 px-4 text-slate-500 text-[11px] whitespace-nowrap" title={user.lastLogoutAt || 'Never'}>
                            {presenceService.formatActivityTime(user.lastLogoutAt)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Quick Power Toggle */}
                              <button
                                type="button"
                                onClick={() => handleToggleAccountStatus(user)}
                                disabled={isSelf}
                                className={`p-1 rounded transition-colors ${
                                  isSelf
                                    ? 'text-slate-300 cursor-not-allowed'
                                    : isEnabled
                                    ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer'
                                    : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer'
                                }`}
                                title={isSelf ? 'Cannot disable self' : isEnabled ? 'Disable Account' : 'Enable Account'}
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditModal(user)}
                                className="p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                title="Edit user"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openDeleteModal(user)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                title="Delete user"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
        </div>
      )}

      {/* TAB 2: ROLES & PERMISSIONS */}
      {activeTab === 'roles' && (
        <div className="space-y-4">
          <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs">
            <h2 className="text-sm font-bold text-slate-900">Configured System Roles</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Each user is assigned one of these 7 pre-configured security profiles governing what they can see and do in the ERP.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {defaultRoles.map(role => {
              const assignedCount = users.filter(u => u.role === role).length;
              const meta = roleDescriptions[role];
              const isExpanded = expandedRole === role;

              return (
                <div
                  key={role}
                  className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${getRoleBadge(role)}`}>
                        {role}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        {assignedCount} {assignedCount === 1 ? 'user' : 'users'}
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-900 text-sm mt-3">{meta.accessSummary}</h3>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{meta.desc}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRoleFilter(role);
                        setActiveTab('users');
                      }}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span>View assigned staff</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setExpandedRole(isExpanded ? null : role)}
                      className="text-[11px] font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      {isExpanded ? 'Hide Details' : 'Privileges'}
                    </button>
                  </div>

                  {/* Expanded role details */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          Authorized Modules
                        </span>
                        <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> Live Enforced
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto pr-1">
                        {allModuleDefs.map(mod => {
                          const perms = ROLE_PERMISSIONS_MATRIX[role]?.[mod.id];
                          if (!perms || !perms.view) return null;
                          const isFull = perms.manage && perms.create && perms.edit && perms.delete;
                          return (
                            <span
                              key={mod.id}
                              className={`px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 ${
                                isFull
                                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              <Check className="w-2.5 h-2.5 text-emerald-600" />
                              {mod.name}
                              {isFull && <span className="text-[9px] text-purple-500 font-bold">Full</span>}
                            </span>
                          );
                        })}
                      </div>

                      {/* Forbidden Modules */}
                      {role !== 'Owner' && role !== 'Admin' && (
                        <div className="pt-2 border-t border-slate-100">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                            Restricted Modules
                          </span>
                          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                            {allModuleDefs.map(mod => {
                              const perms = ROLE_PERMISSIONS_MATRIX[role]?.[mod.id];
                              if (perms && perms.view) return null;
                              return (
                                <span
                                  key={mod.id}
                                  className="px-2 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-100 flex items-center gap-1"
                                >
                                  <Lock className="w-2.5 h-2.5 text-rose-500" />
                                  {mod.name}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="pt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setMatrixRole(role);
                            const el = document.getElementById('rbac-permission-matrix');
                            el?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3 text-blue-500" />
                          <span>View in RBAC Matrix</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* INTERACTIVE RBAC PERMISSION MATRIX TABLE */}
          <div
            id="rbac-permission-matrix"
            className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 space-y-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                    <ShieldCheck className="w-4 h-4" />
                  </span>
                  <h3 className="font-bold text-slate-900 text-base">
                    Central Permission Matrix (RBAC Inspector)
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Granular permission matrix enforced across routes, navigation, action handlers, APIs, and PostgreSQL database policies.
                </p>
              </div>

              {/* Stats badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/80">
                  7 Business Roles
                </span>
                <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                  17 Modules
                </span>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                  7 Granular Actions
                </span>
              </div>
            </div>

            {/* Matrix Filters */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2 border-t border-slate-100">
              {/* Role filter buttons */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                <span className="text-xs font-semibold text-slate-500 mr-1 shrink-0">Filter Role:</span>
                <button
                  type="button"
                  onClick={() => setMatrixRole('All')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                    matrixRole === 'All'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                  }`}
                >
                  All Roles Matrix
                </button>
                {defaultRoles.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setMatrixRole(r)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                      matrixRole === r
                        ? `${getRoleBadge(r)} shadow-xs`
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>

              {/* Search modules */}
              <div className="relative w-full lg:w-64 shrink-0">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search modules..."
                  value={matrixSearch}
                  onChange={e => setMatrixSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200/80">
                    <th className="p-3 font-bold text-slate-700 min-w-[180px]">Module & Function</th>
                    <th className="p-3 font-semibold text-slate-500 w-[120px]">Category</th>
                    {matrixRole === 'All' ? (
                      defaultRoles.map(r => (
                        <th key={r} className="p-3 font-bold text-center text-slate-700 min-w-[110px]">
                          {r}
                        </th>
                      ))
                    ) : (
                      <>
                        {granularActions.map(act => (
                          <th key={act.id} className="p-3 font-bold text-center text-slate-700 w-[70px]">
                            {act.label}
                          </th>
                        ))}
                        <th className="p-3 font-bold text-center text-slate-700 w-[120px]">Overall Scope</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allModuleDefs
                    .filter(mod => {
                      if (!matrixSearch.trim()) return true;
                      const q = matrixSearch.toLowerCase();
                      return (
                        mod.name.toLowerCase().includes(q) ||
                        mod.category.toLowerCase().includes(q) ||
                        mod.desc.toLowerCase().includes(q) ||
                        mod.id.toLowerCase().includes(q)
                      );
                    })
                    .map(mod => {
                      return (
                        <tr key={mod.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-3 border-b border-slate-100">
                            <span className="font-bold text-slate-800 block text-xs">{mod.name}</span>
                            <span className="text-[11px] text-slate-400 block line-clamp-1">{mod.desc}</span>
                          </td>
                          <td className="p-3 border-b border-slate-100">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                              {mod.category}
                            </span>
                          </td>

                          {/* All Roles Matrix View */}
                          {matrixRole === 'All' ? (
                            defaultRoles.map(r => {
                              const perms = ROLE_PERMISSIONS_MATRIX[r]?.[mod.id];
                              if (!perms || !perms.view) {
                                return (
                                  <td key={r} className="p-3 text-center border-b border-slate-100">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-600 border border-rose-100">
                                      <Lock className="w-2.5 h-2.5" /> No Access
                                    </span>
                                  </td>
                                );
                              }
                              const isFull = perms.manage && perms.create && perms.edit && perms.delete;
                              const isReadWrite = perms.create || perms.edit;
                              return (
                                <td key={r} className="p-3 text-center border-b border-slate-100">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                      isFull
                                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                        : isReadWrite
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                                    }`}
                                  >
                                    <Check className="w-2.5 h-2.5" />
                                    {isFull ? 'Full Access' : isReadWrite ? 'Read/Write' : 'Read Only'}
                                  </span>
                                </td>
                              );
                            })
                          ) : (
                            /* Single Role Granular Actions View */
                            <>
                              {granularActions.map(act => {
                                const isAllowed = !!ROLE_PERMISSIONS_MATRIX[matrixRole]?.[mod.id]?.[act.id];
                                return (
                                  <td key={act.id} className="p-3 text-center border-b border-slate-100">
                                    {isAllowed ? (
                                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 inline-flex items-center justify-center font-bold text-xs mx-auto">
                                        <Check className="w-3 h-3 text-emerald-700" />
                                      </span>
                                    ) : (
                                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-300 inline-flex items-center justify-center font-bold text-xs mx-auto">
                                        -
                                      </span>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="p-3 text-center border-b border-slate-100">
                                {(() => {
                                  const perms = ROLE_PERMISSIONS_MATRIX[matrixRole]?.[mod.id];
                                  if (!perms || !perms.view) {
                                    return (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-600 border border-rose-100">
                                        <Lock className="w-2.5 h-2.5" /> Forbidden
                                      </span>
                                    );
                                  }
                                  const isFull = perms.manage && perms.create && perms.edit && perms.delete;
                                  const isReadWrite = perms.create || perms.edit;
                                  return (
                                    <span
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                        isFull
                                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                          : isReadWrite
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                                      }`}
                                    >
                                      <Check className="w-2.5 h-2.5" />
                                      {isFull ? 'Full Access' : isReadWrite ? 'Read & Write' : 'Read Only'}
                                    </span>
                                  );
                                })()}
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* Architecture Assurance Banner */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-slate-600">
              <div className="flex items-start gap-3">
                <span className="p-1 rounded bg-blue-100 text-blue-700 mt-0.5 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </span>
                <div>
                  <span className="font-bold text-slate-900 block">Multi-Layer RBAC Architecture Enforcement</span>
                  <span className="text-slate-500 text-[11px] leading-relaxed">
                    Permissions are enforced at all layers: <strong>Route Guarding</strong> (blocks direct URL access with Access Denied 403 page), <strong>Navigation Filtering</strong> (hides forbidden menus and fast actions), <strong>Service API Assertion</strong> (<code className="bg-slate-200/80 px-1 py-0.5 rounded text-[10px]">assertCallerPermission</code> checks user role before executing database writes), and <strong>PostgreSQL RLS Policies</strong>.
                  </span>
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Check className="w-3 h-3 text-emerald-600" /> Database RLS Active
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  <Check className="w-3 h-3 text-blue-600" /> 119 Live Rules
                </span>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* MODAL 1: ADD USER */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Team Member"
        subtitle="Create credentials and assign a role profile for a new user"
      >
        <form onSubmit={handleCreateUser} className="space-y-4" autoComplete="off">
          {/* Decoy fields to stop aggressive browser autofill */}
          <div style={{ position: 'absolute', opacity: 0, height: 0, width: 0, overflow: 'hidden' }} aria-hidden="true">
            <input type="text" tabIndex={-1} autoComplete="username" />
            <input type="password" tabIndex={-1} autoComplete="current-password" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Rahul Sharma"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email Address <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              required
              placeholder="e.g. rahul@company.com"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-1 focus:ring-blue-500 focus:outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Role <span className="text-rose-500">*</span>
            </label>
            <select
              value={newRole}
              onChange={e => setNewRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer"
            >
              {assignableRoles.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">Initial Password</label>
              <button
                type="button"
                onClick={() => setNewPassword('TempPassword#2026')}
                className="text-[11px] text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
              >
                Use default password
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                minLength={6}
                placeholder="Leave blank for default (TempPassword#2026)"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className={`w-full px-3 py-2 pr-10 text-xs border rounded-xl focus:outline-none font-mono [&::-ms-reveal]:hidden [&::-ms-clear]:hidden ${
                  newPassword && newPassword.length < 6
                    ? 'border-rose-300 focus:ring-1 focus:ring-rose-500'
                    : 'border-slate-300 focus:ring-1 focus:ring-blue-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {newPassword && newPassword.length < 6 ? (
              <span className="text-[10px] text-rose-500 mt-1 block font-medium">
                Password must be at least 6 characters (currently {newPassword.length}).
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 mt-1 block">
                Default password: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">TempPassword#2026</code> (min. 6 characters)
              </span>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-medium hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                'Create User'
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: EDIT USER */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedUser(null);
        }}
        title="Edit Team Member"
        subtitle="Update user details, role profile, and active status"
      >
        <form onSubmit={handleUpdateUser} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={editName}
              onChange={e => setEditName(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email Address <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              required
              value={editEmail}
              onChange={e => setEditEmail(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-1 focus:ring-blue-500 focus:outline-none font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Assigned Role <span className="text-rose-500">*</span>
              </label>
              <select
                value={editRole}
                onChange={e => setEditRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer"
              >
                {(selectedUser?.role === 'Owner' ? (['Owner', ...assignableRoles] as UserRole[]) : assignableRoles).map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Account Access Status</label>
              <select
                value={editAccountStatus}
                disabled={selectedUser?.id === authUser?.id}
                onChange={e => setEditAccountStatus(e.target.value as AccountStatus)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="Enabled">Enabled (Permitted to log in)</option>
                <option value="Disabled">Disabled (Login blocked)</option>
              </select>
              {selectedUser?.id === authUser?.id && (
                <span className="text-[10px] text-amber-600 block mt-1 font-medium">
                  Self-disable prohibited: You cannot disable your own administrator account.
                </span>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                setIsEditModalOpen(false);
                setSelectedUser(null);
              }}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-medium hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: DELETE CONFIRMATION */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedUser(null);
        }}
        title="Remove Team Member"
      >
        <div className="space-y-4">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-800">
              <span className="font-bold block">Are you sure you want to remove this user?</span>
              This will remove <strong>{selectedUser?.name}</strong> ({selectedUser?.email}) from the active staff directory.
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setSelectedUser(null);
              }}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-medium hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDeleteUser}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
            >
              Yes, Remove User
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
