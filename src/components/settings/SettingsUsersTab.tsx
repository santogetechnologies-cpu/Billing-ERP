import React, { useState } from 'react';
import {
  Users,
  Plus,
  Shield,
  Search,
  CheckCircle,
  XCircle,
  Lock,
  Edit2
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { DataTable, Column } from '../common/DataTable';
import { SystemUser, UserRole } from '../../types';
import { Modal } from '../common/Modal';

export const SettingsUsersTab: React.FC = () => {
  const { users = [], addUser, updateUser } = useERP();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('Cashier');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');

  const roles: UserRole[] = [
    'Owner',
    'Admin',
    'Cashier',
    'Salesperson',
    'Accountant',
    'Warehouse Manager',
    'Purchase Manager'
  ];

  const handleOpenAdd = () => {
    setEditingUser(null);
    setName('');
    setEmail('');
    setRole('Cashier');
    setPhone('');
    setPin('');
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    if (editingUser) {
      updateUser(editingUser.id, {
        name: name.trim(),
        fullName: name.trim(),
        role,
        phone: phone.trim() || undefined
      });
    } else {
      addUser({
        name: name.trim(),
        fullName: name.trim(),
        email: email.trim(),
        role,
        status: 'Active',
        presenceStatus: 'Inactive',
        lastLogin: 'Never',
        phone: phone.trim() || undefined,
        accountStatus: 'Enabled'
      });
    }

    setIsModalOpen(false);
  };

  const columns: Column<SystemUser>[] = [
    {
      key: 'fullName',
      header: 'User Name & Email',
      render: row => (
        <div>
          <span className="font-semibold text-slate-900 block">{row.fullName || 'User'}</span>
          <span className="text-[10px] text-slate-400 font-mono">{row.email}</span>
        </div>
      )
    },
    {
      key: 'role',
      header: 'Assigned Role',
      render: row => (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          {row.role}
        </span>
      )
    },
    {
      key: 'accountStatus',
      header: 'Account Status',
      align: 'center',
      render: row => (
        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
          row.accountStatus === 'Enabled' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
        }`}>
          {row.accountStatus}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
        <div>
          <span className="text-xs font-bold text-slate-800">User Access & Role-Based Permissions</span>
          <p className="text-[11px] text-slate-500">Manage cashier logins, salesperson accounts, and manager roles.</p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Invite / Add User</span>
        </button>
      </div>

      <DataTable
        title="Active Team Members"
        subtitle={`Total ${users.length} registered system users`}
        columns={columns}
        data={users}
        searchPlaceholder="Search by name, email, or role..."
        searchKeys={['fullName', 'email', 'role']}
      />

      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingUser ? 'Edit User Profile' : 'Invite New Team Member'}
          subtitle="Configure role, permissions, and sign-in credentials"
          size="md"
        >
          <form onSubmit={handleSave} className="space-y-4 pt-2 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                placeholder="e.g. Ramesh Kumar"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  placeholder="user@business.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  required
                  disabled={Boolean(editingUser)}
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assigned Role *</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  {roles.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Phone Number (Optional)</label>
              <input
                type="tel"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-xs"
              >
                {editingUser ? 'Save Changes' : 'Create User Account'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

