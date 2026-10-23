import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { GlobalSearch } from '../common/GlobalSearch';
import { NotificationsDrawer } from '../common/NotificationsDrawer';
import { SetupWizardModal } from '../setup/SetupWizardModal';

export const AppLayout: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isSetupWizardOpen, setIsSetupWizardOpen] = useState(false);

  const navigate = useNavigate();

  // Keyboard shortcut listener: Ctrl+Q / Cmd+Q -> Global Search, F2 -> POS Billing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'q') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      } else if (e.key === 'F2') {
        e.preventDefault();
        navigate('/sales/pos');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  return (
    <div className="h-screen max-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-slate-100/70 to-blue-50/40 flex">
      {/* Sidebar */}
      <Sidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 h-screen max-h-screen overflow-hidden transition-all duration-300 ${
          isCollapsed ? 'lg:pl-18' : 'lg:pl-56'
        }`}
      >
        <Header
          onToggleMobileMenu={() => setIsMobileOpen(true)}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          onOpenSetupWizard={() => setIsSetupWizardOpen(true)}
        />

        <main
          style={{ overscrollBehavior: 'contain' }}
          className="flex-1 overflow-y-auto overscroll-contain min-h-0 w-full"
        >
          <div className="px-3 sm:px-4 md:px-5 lg:px-6 py-3.5 sm:py-4 lg:py-4 w-full animate-fadeIn">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Global Overlays */}
      <GlobalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <NotificationsDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />
      <SetupWizardModal
        isOpen={isSetupWizardOpen}
        onClose={() => setIsSetupWizardOpen(false)}
      />
    </div>
  );
};
