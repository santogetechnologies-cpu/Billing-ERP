import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Zap,
  ShoppingCart,
  ShoppingBag,
  Package,
  Users,
  BadgePercent,
  BookOpen,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogOut,
  Building,
  Building2,
  Truck,
  QrCode,
  Store,
  Wallet,
  Scale,
  Warehouse
} from 'lucide-react';

import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { canRoleAccessNavItem } from '../../utils/rbac';
import { UserProfileModal } from '../auth/UserProfileModal';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export interface UniversalNavSubItem {
  id: string;
  name: string;
  path: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string | number;
}

export interface UniversalNavItem {
  id: string;
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  badgeColor?: 'brand' | 'warning' | 'danger' | 'neutral';
  matchExact?: boolean;
  section: string;
  children?: UniversalNavSubItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile
}) => {
  const { company, heldInvoices, inboundOrders } = useERP();
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Expandable submenus state
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    if (location.pathname.startsWith('/suppliers')) init['suppliers'] = true;
    return init;
  });

  // Auto-expand menu when active path changes
  useEffect(() => {
    if (location.pathname.startsWith('/suppliers')) {
      setExpandedMenus(prev => ({ ...prev, suppliers: true }));
    }
  }, [location.pathname]);

  const toggleExpand = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setExpandedMenus(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Close mobile sidebar on route change
  useEffect(() => {
    onCloseMobile();
  }, [location.pathname]);

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const heldBillsCount = heldInvoices?.length || 0;
  const pendingOrdersCount = inboundOrders?.filter(o => o.status === 'Pending Confirmation' || o.status === 'Confirmed')?.length || 0;

  // Complete Navigation Items grouped into 4 distinct functional sections
  const allNavItems: UniversalNavItem[] = [
    // Section 1: Billing & Sales
    {
      id: 'dashboard',
      name: 'Dashboard',
      path: '/',
      icon: LayoutDashboard,
      matchExact: true,
      section: 'Billing & Sales'
    },
    {
      id: 'pos',
      name: 'POS Fast Billing',
      path: '/sales/pos',
      icon: Zap,
      badge: heldBillsCount > 0 ? heldBillsCount : undefined,
      badgeColor: 'brand',
      section: 'Billing & Sales'
    },
    {
      id: 'sales',
      name: 'Sales Invoices',
      path: '/sales',
      icon: ShoppingCart,
      section: 'Billing & Sales'
    },
    {
      id: 'delivery_hub',
      name: 'Route & Delivery',
      path: '/sales/hub',
      icon: Truck,
      badge: pendingOrdersCount > 0 ? pendingOrdersCount : undefined,
      badgeColor: 'warning',
      section: 'Billing & Sales'
    },

    // Section 2: Products & Inventory
    {
      id: 'products',
      name: 'Products & Catalog',
      path: '/products',
      icon: Package,
      section: 'Inventory & Stock'
    },
    {
      id: 'warehouses',
      name: 'Warehouse',
      path: '/inventory/warehouses',
      icon: Warehouse,
      section: 'Inventory & Stock'
    },
    {
      id: 'conversion',
      name: 'Repackaging / BOM',
      path: '/inventory/conversion',
      icon: Scale,
      section: 'Inventory & Stock'
    },
    {
      id: 'purchases',
      name: 'Purchases & PO',
      path: '/purchases',
      icon: ShoppingBag,
      section: 'Inventory & Stock'
    },
    {
      id: 'barcode',
      name: 'Barcodes & Labels',
      path: '/barcode',
      icon: QrCode,
      section: 'Inventory & Stock'
    },

    // Section 3: Finance & People
    {
      id: 'accounts',
      name: 'Accounts & Daybook',
      path: '/accounting',
      icon: BookOpen,
      section: 'Finance & Staff'
    },
    {
      id: 'payroll',
      name: 'Staff & Payroll',
      path: '/payroll',
      icon: Wallet,
      section: 'Finance & Staff'
    },
    {
      id: 'customers',
      name: 'Customers',
      path: '/customers',
      icon: Users,
      section: 'Finance & Staff'
    },
    {
      id: 'suppliers',
      name: 'Suppliers',
      path: '/suppliers',
      icon: Building2,
      section: 'Finance & Staff',
      children: [
        {
          id: 'supplier-details',
          name: 'Supplier Details',
          path: '/suppliers',
          icon: Building
        }
      ]
    },
    {
      id: 'pricing',
      name: 'Rates & Rules',
      path: '/pricing',
      icon: BadgePercent,
      section: 'Finance & Staff'
    },

    // Section 4: Reports & Online
    {
      id: 'storefront',
      name: 'Online Catalog',
      path: '/storefront',
      icon: Store,
      section: 'Analytics & Online'
    },
    {
      id: 'reports',
      name: 'Reports & P&L',
      path: '/reports',
      icon: BarChart3,
      section: 'Analytics & Online'
    }
  ];

  // RBAC Filtering: Only render items permitted for logged-in role
  const permittedNavItems = allNavItems.filter(item =>
    canRoleAccessNavItem(profile?.role, item.name, item.id)
  );

  const canAccessSettings = canRoleAccessNavItem(profile?.role, 'Settings', 'settings');

  // Exact mutually-exclusive active matching logic
  const isItemActive = (item: UniversalNavItem): boolean => {
    const cur = location.pathname.replace(/\/+$/, '') || '/';
    const tgt = item.path.replace(/\/+$/, '') || '/';

    if (item.id === 'dashboard') {
      return cur === '/' || cur === '/dashboard' || cur === '/warehouse/dashboard' || cur === '/sales/dashboard' || cur === '/purchases/dashboard';
    }

    if (item.id === 'pos') {
      return cur === '/sales/pos' || cur.startsWith('/sales/pos/');
    }

    if (item.id === 'sales') {
      if (cur.startsWith('/sales/pos') || cur.startsWith('/sales/hub') || cur === '/salesperson-hub') return false;
      return cur === '/sales' || cur.startsWith('/sales/');
    }

    if (item.id === 'delivery_hub') {
      return cur === '/sales/hub' || cur.startsWith('/sales/hub') || cur === '/salesperson-hub';
    }

    if (item.id === 'payroll') {
      return cur === '/payroll' || cur.startsWith('/payroll') || cur === '/hr' || cur.startsWith('/hr/');
    }

    if (item.id === 'storefront') {
      return cur === '/storefront' || cur === '/catalog' || cur === '/customer-portal';
    }

    if (item.id === 'barcode') {
      return cur === '/barcode' || cur.startsWith('/barcode');
    }

    if (item.id === 'conversion') {
      return cur === '/inventory/conversion' || cur === '/inventory/repackaging';
    }

    if (item.id === 'purchases') {
      return cur === '/purchases' || cur.startsWith('/purchases/');
    }

    if (item.id === 'warehouses' || item.id === 'warehouse') {
      return (
        cur === '/inventory/warehouses' || cur.startsWith('/inventory/warehouses/') ||
        cur === '/warehouses' ||
        cur.startsWith('/warehouses/')
      );
    }

    if (item.id === 'products') {
      return cur === '/products' || cur.startsWith('/products/') || cur === '/units';
    }

    if (item.id === 'customers') {
      return cur === '/customers' || cur.startsWith('/customers/') || cur === '/customer-details';
    }

    if (item.id === 'suppliers') {
      return cur === '/suppliers' || cur.startsWith('/suppliers/');
    }

    if (item.id === 'parties') {
      return cur === '/customers' || cur.startsWith('/customers/') || cur === '/suppliers' || cur.startsWith('/suppliers/') || cur === '/parties';
    }

    if (item.id === 'pricing') {
      return cur === '/pricing' || cur.startsWith('/pricing/');
    }

    if (item.id === 'accounts') {
      return (
        cur === '/accounting' ||
        cur.startsWith('/accounting/') ||
        cur === '/expenses' ||
        cur.startsWith('/expenses/')
      );
    }

    if (item.id === 'reports') {
      return cur === '/reports' || cur.startsWith('/reports/');
    }

    return cur === tgt || cur.startsWith(`${tgt}/`);
  };

  const isSettingsActive =
    location.pathname.startsWith('/settings') ||
    location.pathname.startsWith('/users') ||
    location.pathname.startsWith('/audit-log') ||
    location.pathname.startsWith('/taxes');

  // Group permitted items by section
  const sections = Array.from(new Set(permittedNavItems.map(i => i.section)));

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
        />
      )}

      {/* Main Sidebar Shell */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 flex flex-col bg-slate-900 border-r border-slate-800 text-slate-300 transition-all duration-300 select-none ${
          isCollapsed ? 'w-18' : 'w-64'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand / Store Header */}
        <div className="h-14 flex items-center justify-between px-3 border-b border-slate-800/80 bg-slate-950/50 shrink-0">
          <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-xs shrink-0">
              {company.logo ? (
                <img src={company.logo} alt={company.name} className="w-full h-full object-cover rounded-lg" />
              ) : (
                <Building2 className="w-4.5 h-4.5 text-white" />
              )}
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <h1 className="font-semibold text-xs text-white truncate leading-tight">
                  {company.name || 'Universal ERP'}
                </h1>
                <p className="text-[10px] text-slate-400 truncate">
                  {company.businessType || 'Retail & Distribution'}
                </p>
              </div>
            )}
          </div>

          {/* Desktop Collapse Toggle */}
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:flex p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Navigation Items List with Compact Height to prevent vertical scrolling */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3 no-scrollbar">
          {sections.map(sectionName => {
            const sectionItems = permittedNavItems.filter(i => i.section === sectionName);
            if (sectionItems.length === 0) return null;

            return (
              <div key={sectionName} className="space-y-0.5">
                {!isCollapsed && (
                  <p className="px-2 pb-1 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                    {sectionName}
                  </p>
                )}
                {sectionItems.map(item => {
                  const active = isItemActive(item);
                  const Icon = item.icon;
                  const hasChildren = item.children && item.children.length > 0;
                  const isExpanded = !!expandedMenus[item.id];

                  if (hasChildren) {
                    return (
                      <div key={item.id} className="space-y-0.5">
                        <NavLink
                          to={item.path}
                          onClick={() => {
                            setExpandedMenus(prev => ({ ...prev, [item.id]: !prev[item.id] }));
                          }}
                          title={isCollapsed ? item.name : undefined}
                          className={`group flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer ${
                            active
                              ? 'bg-blue-600 text-white font-semibold shadow-xs shadow-blue-600/30'
                              : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                          } ${isCollapsed ? 'justify-center px-0' : ''}`}
                        >
                          <Icon
                            className={`w-4 h-4 shrink-0 transition-colors ${
                              active ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                            }`}
                          />

                          {!isCollapsed && (
                            <span className="flex-1 truncate tracking-tight text-[11px]">{item.name}</span>
                          )}

                          {!isCollapsed && item.badge !== undefined && (
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                active
                                  ? 'bg-white text-blue-700'
                                  : item.badgeColor === 'brand'
                                  ? 'bg-blue-500/20 text-blue-300'
                                  : item.badgeColor === 'warning'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-slate-700 text-slate-300'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}

                          {!isCollapsed && (
                            <span
                              onClick={(e) => toggleExpand(item.id, e)}
                              className="p-0.5 text-slate-400 hover:text-white rounded transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                            </span>
                          )}
                        </NavLink>

                        {/* Child sub-items */}
                        {!isCollapsed && isExpanded && item.children && (
                          <div className="pl-4 space-y-0.5 pt-0.5 pb-0.5 border-l border-slate-800/80 ml-4 animate-fadeIn">
                            {item.children.map(subItem => {
                              const SubIcon = subItem.icon;
                              const isSubActive = location.pathname === subItem.path || (subItem.path !== '/' && location.pathname.startsWith(`${subItem.path}/`));

                              return (
                                <NavLink
                                  key={subItem.id}
                                  to={subItem.path}
                                  className={`flex items-center gap-2 px-2.5 py-1 rounded-md text-[11px] transition-colors cursor-pointer ${
                                    isSubActive
                                      ? 'text-blue-400 font-semibold bg-blue-500/10'
                                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                                  }`}
                                >
                                  {SubIcon ? (
                                    <SubIcon className={`w-3.5 h-3.5 shrink-0 ${isSubActive ? 'text-blue-400' : 'text-slate-400'}`} />
                                  ) : (
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSubActive ? 'bg-blue-400' : 'bg-slate-500'}`} />
                                  )}
                                  <span className="truncate">{subItem.name}</span>
                                </NavLink>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <NavLink
                      key={item.id}
                      to={item.path}
                      title={isCollapsed ? item.name : undefined}
                      className={`group flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer ${
                        active
                          ? 'bg-blue-600 text-white font-semibold shadow-xs shadow-blue-600/30'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                      } ${isCollapsed ? 'justify-center px-0' : ''}`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          active ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                        }`}
                      />

                      {!isCollapsed && (
                        <span className="flex-1 truncate tracking-tight text-[11px]">{item.name}</span>
                      )}

                      {!isCollapsed && item.badge !== undefined && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                            active
                              ? 'bg-white text-blue-700'
                              : item.badgeColor === 'brand'
                              ? 'bg-blue-500/20 text-blue-300'
                              : item.badgeColor === 'warning'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Pinned Bottom Area: Settings & User Profile */}
        <div className="p-2 border-t border-slate-800/80 bg-slate-950/40 space-y-1 shrink-0">
          {/* Pinned Settings Item */}
          {canAccessSettings && (
            <NavLink
              to="/settings"
              title={isCollapsed ? 'Settings' : undefined}
              className={`group flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                isSettingsActive
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              } ${isCollapsed ? 'justify-center px-0' : ''}`}
            >
              <Settings
                className={`w-4 h-4 shrink-0 ${
                  isSettingsActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              />
              {!isCollapsed && <span className="flex-1 truncate text-[11px]">Settings</span>}
            </NavLink>
          )}

          {/* User Account / Session */}
          <div
            className={`flex items-center gap-2 p-1.5 rounded-lg bg-slate-800/40 hover:bg-slate-800/80 text-slate-300 transition-colors ${
              isCollapsed ? 'justify-center' : ''
            }`}
          >
            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              title="View profile"
              className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
            >
              <div className="w-7 h-7 rounded-md bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 text-[11px] font-bold shrink-0">
                {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : 'U'}
              </div>
              {!isCollapsed && (
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-white truncate leading-tight">{profile?.fullName || 'User'}</p>
                  <p className="text-[9px] text-slate-400 truncate leading-none mt-0.5">{profile?.role || 'Staff'}</p>
                </div>
              )}
            </button>

            {!isCollapsed && (
              <button
                type="button"
                onClick={handleLogout}
                title="Sign out"
                aria-label="Sign out"
                className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-700/60 rounded-md transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* User Profile Modal */}
      {isProfileModalOpen && (
        <UserProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
      )}
    </>
  );
};
