import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Menu,
  Search,
  Bell,
  Building,
  RotateCcw,
  Sparkles,
  CheckCircle,
  ChevronDown,
  UserCheck,
  Plus,
  Zap,
  Package,
  Users,
  ShoppingBag
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
  const location = useLocation();
  const navigate = useNavigate();

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showQuickCreateMenu, setShowQuickCreateMenu] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const quickCreateRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (quickCreateRef.current && !quickCreateRef.current.contains(e.target as Node)) {
        setShowQuickCreateMenu(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;
  const canShowHeaderProfile = canAccessHeaderProfile(profile?.role);

  // Compute Page Title from URL Path
  const getPageTitle = (): string => {
    const path = location.pathname;
    if (path === '/' || path === '/dashboard') return 'Dashboard';
    if (path.startsWith('/sales/pos')) return 'Point of Sale (POS)';
    if (path.startsWith('/sales')) return 'Sales';
    if (path.startsWith('/purchases')) return 'Purchases';
    if (path.startsWith('/inventory') || path.startsWith('/stock')) return 'Stock Management';
    if (path.startsWith('/products')) return 'Products';
    if (path.startsWith('/customers') || path.startsWith('/suppliers') || path.startsWith('/parties')) return 'Parties Directory';
    if (path.startsWith('/pricing')) return 'Pricing & Commission';
    if (path.startsWith('/accounting') || path.startsWith('/accounts')) return 'Accounts & Ledgers';
    if (path.startsWith('/reports')) return 'Reports & Analytics';
    if (path.startsWith('/settings')) return 'Settings';
    return 'Universal ERP';
  };

  return (
    <header className="h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800 px-4 flex items-center justify-between shrink-0 sticky top-0 z-30 shadow-2xs">
      {/* Left: Mobile Toggle & Page Title & Store Switcher */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          aria-label="Open navigation menu"
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 active:scale-95 transition-all lg:hidden cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-base font-semibold text-slate-900 dark:text-white tracking-tight leading-tight">
            {getPageTitle()}
          </h1>
        </div>

        {/* Store / Warehouse Switcher (Part B2) */}
        {hasPermission(profile?.role, 'inventory', 'view') && (
          <div className="hidden sm:flex items-center gap-1.5 ml-2 bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 transition-all">
            <Building className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedWarehouse}
              onChange={e => setSelectedWarehouse(e.target.value)}
              aria-label="Select store or warehouse"
              className="bg-transparent font-medium text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
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

      {/* Center: Global Search Bar (Ctrl+K) */}
      <div className="flex-1 max-w-md mx-4 hidden md:block">
        <button
          onClick={onOpenSearch}
          className="w-full flex items-center justify-between px-3.5 py-1.5 text-xs bg-slate-50 hover:bg-white dark:bg-slate-800/60 dark:hover:bg-slate-800 border border-slate-200/90 dark:border-slate-700 hover:border-blue-400 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 shadow-2xs transition-all cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <span>Search products, invoices, customers...</span>
          </div>
          <kbd className="inline-flex items-center gap-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 shadow-2xs">
            Ctrl + K
          </kbd>
        </button>
      </div>

      {/* Right: Quick Create "+ New", Setup Wizard, Notifications & User */}
      <div className="flex items-center gap-2">
        {/* Mobile Search Trigger */}
        <button
          onClick={onOpenSearch}
          aria-label="Search"
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 active:scale-95 transition-all md:hidden cursor-pointer"
        >
          <Search className="w-5 h-5" />
        </button>

        {/* Quick Create "+ New" Button & Dropdown (Part C) */}
        <div className="relative" ref={quickCreateRef}>
          <button
            onClick={() => setShowQuickCreateMenu(!showQuickCreateMenu)}
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span className="hidden sm:inline">New</span>
            <ChevronDown className="w-3 h-3 text-blue-200" />
          </button>

          {showQuickCreateMenu && (
            <div className="absolute right-0 mt-1.5 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 py-1.5 z-50 text-xs animate-fadeIn">
              <button
                onClick={() => {
                  setShowQuickCreateMenu(false);
                  navigate('/sales/pos');
                }}
                className="w-full px-3 py-2 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 flex items-center gap-2.5 cursor-pointer font-medium"
              >
                <Zap className="w-4 h-4 text-amber-500" />
                <span>New Bill (POS)</span>
              </button>

              <button
                onClick={() => {
                  setShowQuickCreateMenu(false);
                  navigate('/products?action=new');
                }}
                className="w-full px-3 py-2 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 flex items-center gap-2.5 cursor-pointer font-medium"
              >
                <Package className="w-4 h-4 text-blue-500" />
                <span>New Product</span>
              </button>

              <button
                onClick={() => {
                  setShowQuickCreateMenu(false);
                  navigate('/customers?action=new');
                }}
                className="w-full px-3 py-2 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 flex items-center gap-2.5 cursor-pointer font-medium"
              >
                <Users className="w-4 h-4 text-emerald-500" />
                <span>New Customer</span>
              </button>

              <button
                onClick={() => {
                  setShowQuickCreateMenu(false);
                  navigate('/purchases?tab=orders&action=new_po');
                }}
                className="w-full px-3 py-2 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 flex items-center gap-2.5 cursor-pointer font-medium"
              >
                <ShoppingBag className="w-4 h-4 text-purple-500" />
                <span>New Purchase Order (PO)</span>
              </button>
            </div>
          )}
        </div>

        {/* Setup Wizard Button (Admin/Owner only) */}
        {hasPermission(profile?.role, 'settings', 'manage') && (
          <button
            onClick={onOpenSetupWizard}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
            title="Setup Wizard"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Wizard</span>
          </button>
        )}

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={onOpenNotifications}
            aria-label="View notifications"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 relative cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Current User Active Presence Indicator */}
        <UserPresenceBadge size="sm" className="hidden sm:inline-flex" />

        {/* User Profile & Account Menu */}
        <div className="relative ml-1" ref={profileMenuRef}>
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            type="button"
            className="flex items-center gap-2 p-1 pl-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <div className="w-7 h-7 rounded-full bg-linear-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
              {(profile?.fullName || user?.email || 'Admin').substring(0, 2).toUpperCase()}
            </div>
            <div className="hidden xl:block text-left">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block leading-tight">
                {profile?.fullName || user?.email?.split('@')[0] || 'Administrator'}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                {profile?.role || 'Company Admin'}
              </span>
            </div>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-1.5 w-60 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 py-2 z-50 text-xs animate-fadeIn">
              <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700">
                <p className="font-semibold text-slate-900 dark:text-white">{company.name || 'Universal ERP'}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">GSTIN: {company.gstin || 'Unset'}</p>
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
                    className="w-full px-3 py-2 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center gap-2 cursor-pointer font-medium border-b border-slate-100 dark:border-slate-700"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                    <span>My Profile</span>
                  </button>
                )}

                <button
                  onClick={async () => {
                    setShowProfileMenu(false);
                    await signOut();
                    navigate('/login', { replace: true });
                  }}
                  className="w-full px-3 py-2 text-left text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer font-medium"
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
      {isProfileModalOpen && (
        <UserProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
        />
      )}
    </header>
  );
};
