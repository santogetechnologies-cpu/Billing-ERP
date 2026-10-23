import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu,
  Search,
  Bell,
  Building,
  RotateCcw,
  Sparkles,
  CheckCircle,
  ChevronDown,
  UserCheck
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { hasPermission, canAccessHeaderProfile } from '../../utils/rbac';
import { UserProfileModal } from '../auth/UserProfileModal';
import { UserPresenceBadge } from '../common/UserPresenceBadge';

interface HeaderProps {
  onToggleMobileMenu: () => void;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  onOpenSetupWizard: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleMobileMenu,
  onOpenSearch,
  onOpenNotifications,
  onOpenSetupWizard
}) => {
  const {
    company,
    notifications,
    warehouses,
    selectedWarehouse,
    setSelectedWarehouse
  } = useERP();
  const { user, profile, signOut } = useAuth();

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const navigate = useNavigate();

  const unreadCount = notifications.filter(n => !n.read).length;

  const canShowHeaderProfile = canAccessHeaderProfile(profile?.role);

  return (
    <header className="h-16 glass-header px-4 flex items-center justify-between shrink-0 sticky top-0 z-30 shadow-2xs">
      {/* Left: Mobile Toggle & Warehouse Selector */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100/80 active:scale-95 transition-all lg:hidden cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Warehouse Selector (Only visible if role has inventory view permission) */}
        {hasPermission(profile?.role, 'inventory', 'view') && (
          <div className="hidden sm:flex items-center gap-2 bg-slate-50/80 hover:bg-white border border-slate-200/90 hover:border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 transition-all shadow-2xs">
            <Building className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400 font-medium">Branch:</span>
            <select
              value={selectedWarehouse}
              onChange={e => setSelectedWarehouse(e.target.value)}
              className="bg-transparent font-medium text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="All Warehouses">All Warehouses & Stores</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.code}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Center: Global Search Bar (Ctrl+Q) */}
      <div className="flex-1 max-w-md mx-4 hidden md:block">
        <button
          onClick={onOpenSearch}
          className="w-full flex items-center justify-between px-3 py-1.5 text-xs bg-slate-50/80 hover:bg-white border border-slate-200/90 hover:border-blue-300/80 rounded-lg text-slate-500 hover:text-slate-700 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <span>Search products, invoices, customers...</span>
          </div>
          <kbd className="inline-flex items-center gap-0.5 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 shadow-2xs">
            Ctrl + Q
          </kbd>
        </button>
      </div>

      {/* Right: Quick Actions, Setup Wizard, Notifications & User */}
      <div className="flex items-center gap-2">
        {/* Mobile search trigger */}
        <button
          onClick={onOpenSearch}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100/80 active:scale-95 transition-all md:hidden cursor-pointer"
          title="Search"
        >
          <Search className="w-5 h-5" />
        </button>


        {/* Setup Wizard Button (Admin/Owner only) */}
        {hasPermission(profile?.role, 'settings', 'manage') && (
          <button
            onClick={onOpenSetupWizard}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
            title="Setup Wizard"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Setup Wizard</span>
          </button>
        )}

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={onOpenNotifications}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 relative"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Current User Active Presence Indicator */}
        <UserPresenceBadge size="sm" className="hidden sm:inline-flex" />

        {/* User Profile & Account Menu */}
        <div className="relative ml-1">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 p-1 pl-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-linear-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
              {(profile?.full_name || user?.email || 'Admin').substring(0, 2).toUpperCase()}
            </div>
            <div className="hidden xl:block text-left">
              <span className="text-xs font-semibold text-slate-800 block leading-tight">
                {profile?.full_name || user?.email?.split('@')[0] || 'Administrator'}
              </span>
              <span className="text-[10px] text-slate-500 font-medium">
                {profile?.role || 'Company Admin'}
              </span>
            </div>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {showProfileMenu && (
            <div
              className="absolute right-0 mt-1.5 w-60 glass-dropdown rounded-xl py-2 z-40 text-xs animate-fadeIn"
              onClick={() => setShowProfileMenu(false)}
            >
              <div className="px-3 py-2 border-b border-slate-100">
                <p className="font-semibold text-slate-900">{company.name}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">GSTIN: {company.gstin}</p>
                <p className="text-[10px] text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> System Online & Synced
                </p>
              </div>

              <div className="pt-1">
                {canShowHeaderProfile && (
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      setIsProfileModalOpen(true);
                    }}
                    className="w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer font-medium border-b border-slate-100"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                    <span>My Profile</span>
                  </button>
                )}

                <button
                  onClick={async () => {
                    await signOut();
                    navigate('/login', { replace: true });
                  }}
                  className="w-full px-3 py-2 text-left text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer font-medium"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </header>
  );
};
