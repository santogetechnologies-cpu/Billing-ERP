import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Settings,
  Users,
  Building2,
  FileText,
  Store,
  Printer,
  HardDriveDownload,
  Sliders,
  GitFork
} from 'lucide-react';
import { Tabs, TabItem } from '../../components/common/Tabs';
import { SettingsUsersTab } from '../../components/settings/SettingsUsersTab';
import { SettingsBusinessTab } from '../../components/settings/SettingsBusinessTab';
import { SettingsTaxesTab } from '../../components/settings/SettingsTaxesTab';
import { SettingsStoresTab } from '../../components/settings/SettingsStoresTab';
import { SettingsPrintersTab } from '../../components/settings/SettingsPrintersTab';
import { SettingsBackupTab } from '../../components/settings/SettingsBackupTab';
import { SettingsAdvancedTab } from '../../components/settings/SettingsAdvancedTab';
import { SettingsWorkflowsTab } from '../../components/settings/SettingsWorkflowsTab';

export const SettingsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>(() => searchParams.get('tab') || 'business');

  // Sync ?tab= in URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  // Part C: Settings (Admin) Tabs:
  // Users & Roles · Business · Taxes · Stores · Printers · Backup · Advanced
  const settingsTabs: TabItem[] = [
    { id: 'users', label: 'Users & Roles', icon: Users },
    { id: 'business', label: 'Business', icon: Building2 },
    { id: 'taxes', label: 'Taxes', icon: FileText },
    { id: 'stores', label: 'Stores', icon: Store },
    { id: 'printers', label: 'Printers', icon: Printer },
    { id: 'backup', label: 'Backup', icon: HardDriveDownload },
    { id: 'advanced', label: 'Advanced', icon: Sliders },
    { id: 'workflows', label: 'System Workflows & A-to-Z Guide', icon: GitFork }
  ];

  return (
    <div className="space-y-4">
      {/* Universal Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-700" />
            System Administration & Settings
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Store identity, GST tax configuration, user access roles, multi-warehouse routing, hardware printers, and data backups.
          </p>
        </div>
      </div>

      {/* In-Page Horizontal Tabs */}
      <Tabs
        tabs={settingsTabs}
        activeTab={activeTab}
        onChange={tab => {
          setActiveTab(tab);
          setSearchParams({ tab });
        }}
      />

      {/* Tab 1: Users & Roles */}
      {activeTab === 'users' && <SettingsUsersTab />}

      {/* Tab 2: Business Profile */}
      {activeTab === 'business' && <SettingsBusinessTab />}

      {/* Tab 3: Taxes */}
      {activeTab === 'taxes' && <SettingsTaxesTab />}

      {/* Tab 4: Stores & Warehouses */}
      {activeTab === 'stores' && <SettingsStoresTab />}

      {/* Tab 5: Printers */}
      {activeTab === 'printers' && <SettingsPrintersTab />}

      {/* Tab 6: Backup & Snapshots */}
      {activeTab === 'backup' && <SettingsBackupTab />}

      {/* Tab 7: Advanced & Small-Shop Mode */}
      {activeTab === 'advanced' && <SettingsAdvancedTab />}

      {/* Tab 8: System Workflows & Operations Guide */}
      {activeTab === 'workflows' && <SettingsWorkflowsTab />}
    </div>
  );
};
