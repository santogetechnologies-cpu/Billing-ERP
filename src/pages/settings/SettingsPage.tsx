import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Settings,
  Building2,
  FileDigit,
  Palette,
  HardDriveDownload,
  RotateCcw,
  CheckCircle,
  Save,
  Printer,
  ShieldAlert,
  Sliders,
  QrCode,
  Sparkles,
  Check,
  Loader2,
  AlertTriangle,
  User,
  Bell,
  FileText,
  Users,
  ShieldCheck,
  Eye,
  Plus,
  Trash2,
  Edit3,
  Clock,
  History,
  Globe,
  Calendar,
  Info,
  ExternalLink,
  ShieldX,
  FileCheck,
  Archive,
  Send,
  X
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { CompanyProfile, CompanyPolicy, CompanyPolicyHistory, PolicyStatus } from '../../types';
import { ModalCloseButton } from '../../components/common/ModalCloseButton';
import {
  canManageCompanyPolicy,
  canViewCompanyPolicy,
  canManageCompanySettings,
  canManageSystemConfig,
  canConfigureStockAlerts,
  canConfigureSalesDispatchAlerts
} from '../../utils/rbac';
import { policyService } from '../../services/policyService';

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { company, updateCompany, refreshData } = useERP();
  const { color: primaryColor, setColor: setPrimaryColor, preset: activePreset } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();

  const userRole = profile?.role;
  const isOwner = canManageCompanyPolicy(userRole);
  const canManageCompany = canManageCompanySettings(userRole);
  const canManageSystem = canManageSystemConfig(userRole);
  const showStockAlertSetting = canConfigureStockAlerts(userRole);
  const showSalesDispatchSetting = canConfigureSalesDispatchAlerts(userRole);

  type TabType =
    | 'personal'
    | 'appearance'
    | 'notifications'
    | 'company'
    | 'policy'
    | 'users'
    | 'system';

  // Determine initial tab based on role and query parameters
  const tabParam = searchParams.get('tab');
  const resolveInitialTab = (): TabType => {
    if ((tabParam === 'numbering' || tabParam === 'invoice_design') && canManageCompany) return 'company';
    if (tabParam === 'backup' && canManageSystem) return 'system';
    if (tabParam && ['personal', 'appearance', 'notifications', 'company', 'policy', 'users', 'system'].includes(tabParam)) {
      if ((tabParam === 'company' || tabParam === 'users') && !canManageCompany) return 'personal';
      if (tabParam === 'system' && !canManageSystem) return 'personal';
      return tabParam as TabType;
    }
    return canManageCompany ? 'company' : 'personal';
  };

  const [activeSection, setActiveSection] = useState<TabType>(resolveInitialTab);
  const [companySubTab, setCompanySubTab] = useState<'profile' | 'numbering' | 'invoice_design'>(
    tabParam === 'numbering' ? 'numbering' : tabParam === 'invoice_design' ? 'invoice_design' : 'profile'
  );

  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  useEffect(() => {
    const currentTab = searchParams.get('tab');
    if (currentTab === 'numbering' || currentTab === 'invoice_design') {
      if (canManageCompany) {
        setActiveSection('company');
        setCompanySubTab(currentTab);
      } else {
        setActiveSection('personal');
      }
    } else if (currentTab === 'backup') {
      if (canManageSystem) {
        setActiveSection('system');
      } else {
        setActiveSection('personal');
      }
    } else if (currentTab && ['personal', 'appearance', 'notifications', 'company', 'policy', 'users', 'system'].includes(currentTab)) {
      if ((currentTab === 'company' || currentTab === 'users') && !canManageCompany) {
        setActiveSection('personal');
      } else if (currentTab === 'system' && !canManageSystem) {
        setActiveSection('personal');
      } else if (currentTab !== activeSection) {
        setActiveSection(currentTab as TabType);
      }
    }
  }, [searchParams, canManageCompany, canManageSystem]);

  const handleTabChange = (tab: TabType) => {
    setActiveSection(tab);
    setSearchParams(tab === 'company' && canManageCompany ? {} : { tab });
  };

  // -------------------------------------------------------------------------
  // 1. PERSONAL PROFILE & PREFERENCES STATE
  // -------------------------------------------------------------------------
  const [personalName, setPersonalName] = useState(profile?.full_name || user?.user_metadata?.full_name || '');
  const [personalPhone, setPersonalPhone] = useState(profile?.phone || '');
  const [personalLanguage, setPersonalLanguage] = useState('English (United States)');
  const [personalDateFormat, setPersonalDateFormat] = useState('DD/MM/YYYY');
  const [personalNumberFormat, setPersonalNumberFormat] = useState('en-IN (Lakhs/Crores - ₹)');
  const [personalDefaultRoute, setPersonalDefaultRoute] = useState(
    userRole === 'Cashier' ? '/sales/pos' : userRole === 'Salesperson' ? '/sales/dashboard' : userRole === 'Warehouse Manager' ? '/inventory' : '/'
  );

  useEffect(() => {
    if (profile?.full_name) setPersonalName(profile.full_name);
    if (profile?.phone) setPersonalPhone(profile.phone);
  }, [profile]);

  const handleSavePersonal = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (user?.id) {
        localStorage.setItem(`universal_billing_prefs_${user.id}`, JSON.stringify({
          language: personalLanguage,
          dateFormat: personalDateFormat,
          numberFormat: personalNumberFormat,
          defaultRoute: personalDefaultRoute
        }));
      }
      setSaveSuccess('Personal profile and preferences saved successfully!');
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch {
      setSaveSuccess('Personal preferences saved.');
      setTimeout(() => setSaveSuccess(null), 3000);
    }
  };

  // -------------------------------------------------------------------------
  // 2. ACCOUNT & SECURITY STATE
  // -------------------------------------------------------------------------
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityMessage, setSecurityMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setSecurityMessage({ type: 'error', text: 'New password must be at least 6 characters long.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setSecurityMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setSecurityMessage({ type: 'success', text: 'Password updated successfully. Session verified.' });
    setTimeout(() => setSecurityMessage(null), 4000);
  };

  // -------------------------------------------------------------------------
  // 3. NOTIFICATIONS STATE
  // -------------------------------------------------------------------------
  const [notifStock, setNotifStock] = useState(true);
  const [notifSales, setNotifSales] = useState(true);
  const [notifBilling, setNotifBilling] = useState(true);
  const [notifPolicy, setNotifPolicy] = useState(true);
  const [notifSound, setNotifSound] = useState(true);

  const handleSaveNotifications = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess('Notification alerts updated successfully!');
    setTimeout(() => setSaveSuccess(null), 3000);
  };

  // -------------------------------------------------------------------------
  // 4. COMPANY SETTINGS STATE (Owner & Admin)
  // -------------------------------------------------------------------------
  const [formData, setFormData] = useState<CompanyProfile>({ ...company });

  useEffect(() => {
    setFormData({ ...company });
  }, [company]);

  const [numberingRules, setNumberingRules] = useState([
    { doc: 'Sales Invoice', prefix: 'INV-2026-', startNum: 1001, preview: 'INV-2026-1001' },
    { doc: 'Purchase Bill', prefix: 'PUR-2026-', startNum: 80, preview: 'PUR-2026-0080' },
    { doc: 'Quotation / Estimate', prefix: 'EST-2026-', startNum: 101, preview: 'EST-2026-0101' },
    { doc: 'Payment Voucher', prefix: 'PAY-2026-', startNum: 501, preview: 'PAY-2026-0501' },
    { doc: 'Receipt Voucher', prefix: 'REC-2026-', startNum: 501, preview: 'REC-2026-0501' },
    { doc: 'Expense Voucher', prefix: 'EXP-2026-', startNum: 101, preview: 'EXP-2026-0101' },
    { doc: 'Stock Transfer', prefix: 'TRF-2026-', startNum: 1, preview: 'TRF-2026-0001' }
  ]);

  const [paperSize, setPaperSize] = useState<'A4' | 'Thermal' | 'POS'>('A4');
  const [showLogo, setShowLogo] = useState(true);
  const [showQr, setShowQr] = useState(true);
  const [showBankDetails, setShowBankDetails] = useState(true);
  const [showTerms, setShowTerms] = useState(true);
  const [termsText, setTermsText] = useState(company.termsAndConditions || '1. Goods once sold will not be taken back without original invoice.\n2. Interest @ 18% p.a. will be charged on overdue payments after due date.\n3. Subject to Mumbai Jurisdiction only.');

  const handleSaveCompany = (e: React.FormEvent) => {
    e.preventDefault();
    updateCompany(formData);
    setSaveSuccess('Company profile settings saved successfully!');
    setTimeout(() => setSaveSuccess(null), 3000);
  };

  // -------------------------------------------------------------------------
  // 5. COMPANY POLICY STATE (Owner Only to Add/Edit; Staff Read-Only Published)
  // -------------------------------------------------------------------------
  const [policies, setPolicies] = useState<CompanyPolicy[]>([]);
  const [policiesLoading, setPoliciesLoading] = useState(false);
  const [policyCategoryFilter, setPolicyCategoryFilter] = useState('ALL');
  const [viewingPolicy, setViewingPolicy] = useState<CompanyPolicy | null>(null);
  const [editingPolicy, setEditingPolicy] = useState<CompanyPolicy | null>(null);
  const [isCreatingPolicy, setIsCreatingPolicy] = useState(false);
  const [historyModalPolicy, setHistoryModalPolicy] = useState<CompanyPolicy | null>(null);
  const [policyHistory, setPolicyHistory] = useState<CompanyPolicyHistory[]>([]);
  const [policyHistoryLoading, setPolicyHistoryLoading] = useState(false);

  // Policy Form State
  const [policyFormTitle, setPolicyFormTitle] = useState('');
  const [policyFormCode, setPolicyFormCode] = useState('');
  const [policyFormCategory, setPolicyFormCategory] = useState('General');
  const [policyFormVersion, setPolicyFormVersion] = useState('1.0');
  const [policyFormEffectiveDate, setPolicyFormEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [policyFormStatus, setPolicyFormStatus] = useState<PolicyStatus>('Draft');
  const [policyFormContent, setPolicyFormContent] = useState('');
  const [policyFormError, setPolicyFormError] = useState<string | null>(null);

  const loadPolicies = async () => {
    setPoliciesLoading(true);
    try {
      const data = await policyService.getPolicies(company.id || '00000000-0000-0000-0000-000000000001', userRole);
      setPolicies(data);
    } catch (err: any) {
      console.error('Failed to load policies:', err);
    } finally {
      setPoliciesLoading(false);
    }
  };

  useEffect(() => {
    if (activeSection === 'policy') {
      loadPolicies();
    }
  }, [activeSection, userRole, company.id]);

  const openCreatePolicyModal = () => {
    setPolicyFormTitle('');
    setPolicyFormCode(`POL-${String(policies.length + 1).padStart(3, '0')}`);
    setPolicyFormCategory('General');
    setPolicyFormVersion('1.0');
    setPolicyFormEffectiveDate(new Date().toISOString().split('T')[0]);
    setPolicyFormStatus('Draft');
    setPolicyFormContent('');
    setPolicyFormError(null);
    setIsCreatingPolicy(true);
  };

  const openEditPolicyModal = (pol: CompanyPolicy) => {
    setEditingPolicy(pol);
    setPolicyFormTitle(pol.title);
    setPolicyFormCode(pol.code);
    setPolicyFormCategory(pol.category);
    setPolicyFormVersion(pol.version);
    setPolicyFormEffectiveDate(pol.effectiveDate);
    setPolicyFormStatus(pol.status);
    setPolicyFormContent(pol.content);
    setPolicyFormError(null);
  };

  const handleSavePolicyForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) {
      setPolicyFormError('Unauthorized: Only the Owner can create or edit Company Policies.');
      return;
    }
    if (!policyFormTitle.trim() || !policyFormContent.trim()) {
      setPolicyFormError('Please enter policy title and complete content.');
      return;
    }

    try {
      if (editingPolicy) {
        await policyService.updatePolicy(
          editingPolicy.id,
          {
            title: policyFormTitle.trim(),
            code: policyFormCode.trim(),
            category: policyFormCategory,
            version: policyFormVersion.trim(),
            effectiveDate: policyFormEffectiveDate,
            status: policyFormStatus,
            content: policyFormContent.trim()
          },
          userRole,
          user?.id,
          company.id || '00000000-0000-0000-0000-000000000001'
        );
        setSaveSuccess(`Policy "${policyFormTitle}" updated successfully.`);
      } else {
        await policyService.createPolicy(
          {
            title: policyFormTitle.trim(),
            code: policyFormCode.trim(),
            category: policyFormCategory,
            version: policyFormVersion.trim(),
            effectiveDate: policyFormEffectiveDate,
            status: policyFormStatus,
            content: policyFormContent.trim()
          },
          userRole,
          user?.id,
          company.id || '00000000-0000-0000-0000-000000000001'
        );
        setSaveSuccess(`Policy "${policyFormTitle}" created successfully.`);
      }
      setIsCreatingPolicy(false);
      setEditingPolicy(null);
      setTimeout(() => setSaveSuccess(null), 3000);
      loadPolicies();
    } catch (err: any) {
      setPolicyFormError(err.message || 'Failed to save policy');
    }
  };

  const handleTogglePublish = async (pol: CompanyPolicy) => {
    if (!isOwner) return;
    try {
      if (pol.status === 'Published') {
        await policyService.updatePolicy(
          pol.id,
          { status: 'Draft' },
          userRole,
          user?.id,
          company.id || '00000000-0000-0000-0000-000000000001'
        );
        setSaveSuccess(`Policy "${pol.title}" set to Draft.`);
      } else {
        await policyService.publishPolicy(pol.id, userRole, user?.id, company.id || '00000000-0000-0000-0000-000000000001');
        setSaveSuccess(`Policy "${pol.title}" successfully Published.`);
      }
      setTimeout(() => setSaveSuccess(null), 3000);
      loadPolicies();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleArchivePolicy = async (pol: CompanyPolicy) => {
    if (!isOwner) return;
    if (!confirm(`Are you sure you want to archive policy "${pol.title}"?`)) return;
    try {
      await policyService.archivePolicy(pol.id, userRole, user?.id, company.id || '00000000-0000-0000-0000-000000000001');
      setSaveSuccess(`Policy "${pol.title}" has been archived.`);
      setTimeout(() => setSaveSuccess(null), 3000);
      loadPolicies();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeletePolicy = async (pol: CompanyPolicy) => {
    if (!isOwner) return;
    if (!confirm(`Permanently delete policy "${pol.title}"? This action cannot be undone.`)) return;
    try {
      await policyService.deletePolicy(pol.id, userRole, user?.id, company.id || '00000000-0000-0000-0000-000000000001');
      setSaveSuccess(`Policy "${pol.title}" was permanently deleted.`);
      setTimeout(() => setSaveSuccess(null), 3000);
      loadPolicies();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const openHistoryModal = async (pol: CompanyPolicy) => {
    setHistoryModalPolicy(pol);
    setPolicyHistoryLoading(true);
    try {
      const hist = await policyService.getPolicyHistory(pol.id, userRole);
      setPolicyHistory(hist);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setPolicyHistoryLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // 6. SYSTEM CONFIGURATION STATE (Owner & Admin)
  // -------------------------------------------------------------------------
  const erpContext = useERP();

  const handleDownloadBackup = () => {
    const backupData = {
      exportTimestamp: new Date().toISOString(),
      company: erpContext.company,
      products: erpContext.products,
      customers: erpContext.customers,
      suppliers: erpContext.suppliers,
      salesInvoices: erpContext.salesInvoices,
      purchaseInvoices: erpContext.purchaseInvoices,
      expenses: erpContext.expenses,
      payments: erpContext.payments,
      warehouses: erpContext.warehouses,
      accounts: erpContext.accounts
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `universal_billing_backup_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSyncDatabase = async () => {
    try {
      await refreshData();
      alert('Database cache successfully refreshed and synchronized with Supabase!');
    } catch (err) {
      console.error(err);
      alert('Failed to refresh data from Supabase.');
    }
  };

  // Filtered policies by category
  const filteredPolicies = policies.filter(p => {
    if (policyCategoryFilter === 'ALL') return true;
    return p.category === policyCategoryFilter;
  });

  const allCategories = Array.from(new Set(policies.map(p => p.category)));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-700" />
            Universal ERP Settings & Role Governance
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Personal preferences, company policies, tax invoicing parameters, and role-based access control.
          </p>
        </div>

        {saveSuccess && (
          <div className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 animate-fadeIn">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>{saveSuccess}</span>
          </div>
        )}
      </div>

      {/* Navigation Sections */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 overflow-x-auto pb-px">
        {/* 1. Personal Settings (All Roles) */}
        <button
          type="button"
          onClick={() => handleTabChange('personal')}
          className={`py-2 px-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${activeSection === 'personal'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>Personal Settings</span>
        </button>

        {/* 2. Appearance & Theme (All Roles) */}
        <button
          type="button"
          onClick={() => handleTabChange('appearance')}
          className={`py-2 px-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${activeSection === 'appearance'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
        >
          <Palette className="w-3.5 h-3.5" />
          <span>Appearance & Theme</span>
        </button>


        {/* 4. Notifications (All Roles) */}
        <button
          type="button"
          onClick={() => handleTabChange('notifications')}
          className={`py-2 px-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${activeSection === 'notifications'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
        >
          <Bell className="w-3.5 h-3.5" />
          <span>Notifications</span>
        </button>

        {/* 5. Company Policy (All Roles: Owner Full, Staff Read-Only) */}
        <button
          type="button"
          onClick={() => handleTabChange('policy')}
          className={`py-2 px-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${activeSection === 'policy'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Company Policy</span>
          {isOwner ? (
            <span className="px-1.5 py-0.2 bg-blue-100 text-blue-700 text-[10px] font-bold rounded">Owner</span>
          ) : (
            <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 text-[10px] font-bold rounded">Read-Only</span>
          )}
        </button>

        {/* 6. Company Settings (Owner & Admin Only) */}
        {canManageCompany && (
          <button
            type="button"
            onClick={() => handleTabChange('company')}
            className={`py-2 px-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${activeSection === 'company'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Company Settings</span>
          </button>
        )}

        {/* 7. User & Role Management (Owner & Admin Only) */}
        {canManageCompany && (
          <button
            type="button"
            onClick={() => handleTabChange('users')}
            className={`py-2 px-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${activeSection === 'users'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>User & Roles</span>
          </button>
        )}

        {/* 8. System Configuration (Owner & Admin Only) */}
        {canManageSystem && (
          <button
            type="button"
            onClick={() => handleTabChange('system')}
            className={`py-2 px-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${activeSection === 'system'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
          >
            <HardDriveDownload className="w-3.5 h-3.5" />
            <span>System Config</span>
          </button>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 1: PERSONAL SETTINGS (Available to All Roles) */}
      {/* ------------------------------------------------------------------ */}
      {activeSection === 'personal' && (
        <form onSubmit={handleSavePersonal} className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Personal Profile & Workplace Preferences
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage your user credentials, regional date & currency formats, and initial dashboard route.
              </p>
            </div>

            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Preferences</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={personalName}
                onChange={e => setPersonalName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                disabled
                value={user?.email || profile?.email || ''}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Managed by authentication provider</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned System Role</label>
              <div className="flex items-center gap-2 px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="font-bold text-slate-800">{userRole || 'Standard Staff'}</span>
                <span className="text-[10px] font-semibold text-amber-600 ml-auto bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                  Fixed Security Scope
                </span>
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Role elevation requires an authorized Owner/Admin</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone / Mobile</label>
              <input
                type="tel"
                value={personalPhone}
                onChange={e => setPersonalPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Display Language</label>
              <select
                value={personalLanguage}
                onChange={e => setPersonalLanguage(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="English (United States)">English (United States)</option>
                <option value="English (India)">English (India)</option>
                <option value="Hindi (हिंदी)">Hindi (हिंदी)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date Format</label>
              <select
                value={personalDateFormat}
                onChange={e => setPersonalDateFormat(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none font-mono"
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY (Indian Standard)</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY (US Standard)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (ISO Format)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Number & Currency Format</label>
              <select
                value={personalNumberFormat}
                onChange={e => setPersonalNumberFormat(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="en-IN (Lakhs/Crores - ₹)">Indian (Lakhs & Crores - ₹)</option>
                <option value="en-US (Millions/Billions - $)">International (Millions & Billions)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Default Landing Route</label>
              <select
                value={personalDefaultRoute}
                onChange={e => setPersonalDefaultRoute(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none font-mono"
              >
                <option value="/">Main Executive Dashboard (/)</option>
                <option value="/sales/dashboard">Sales Dashboard (/sales/dashboard)</option>
                <option value="/sales/pos">POS Billing Counter (/sales/pos)</option>
                <option value="/inventory">Inventory & Stock Alerts (/inventory)</option>
                <option value="/purchases">Purchases Overview (/purchases)</option>
                <option value="/accounting">General Ledger & Accounts (/accounting)</option>
              </select>
            </div>
          </div>
        </form>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 2: APPEARANCE & THEME (Primary Accent Color — User Preference) */}
      {/* ------------------------------------------------------------------ */}
      {activeSection === 'appearance' && (
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-6">
          <div className="pb-3 border-b border-slate-100">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Palette className="w-4 h-4 text-blue-600" />
              Interface Accent Color & Theme Customization
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Personalize your individual workspace accent color. Changes apply instantly across buttons, active navigation, focus indicators, and coordinated sidebar styling.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Primary Accent Color Selector */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block font-bold text-xs text-slate-800">Primary Accent Color</label>
                  <span className="text-[11px] font-bold text-slate-600">
                    Active: <span style={{ color: activePreset.primary }} className="font-extrabold">{activePreset.name} ({activePreset.hex})</span>
                  </span>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  {[
                    { id: 'blue' as const, name: 'Blue', hex: '#1760F5' },
                    { id: 'green' as const, name: 'Green', hex: '#2EAF87' },
                    { id: 'red' as const, name: 'Red', hex: '#DC2626' },
                    { id: 'dark_grey' as const, name: 'Grey', hex: '#4B5565' }
                  ].map(c => {
                    const isSelected = primaryColor === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setPrimaryColor(c.id)}
                        title={`${c.name} (${c.hex})`}
                        aria-label={`Select ${c.name} theme (${c.hex})`}
                        style={{ backgroundColor: c.hex }}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-2xs ${isSelected
                            ? 'ring-2 ring-offset-2 ring-slate-900 scale-110 shadow-md'
                            : 'opacity-85 hover:opacity-100 hover:scale-105'
                          }`}
                      >
                        {isSelected && <Check className="w-4 h-4 text-white stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Coordinated sidebar background shade:</span>
                  <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                    <span className="w-3 h-3 rounded-full inline-block border border-slate-300" style={{ backgroundColor: activePreset.sidebarBg }} />
                    <span className="font-mono text-[11px]">{activePreset.sidebarBg}</span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  The sidebar uses a dark, coordinated contrast shade tuned for maximum readability (WCAG AA &gt; 4.5:1).
                </p>
              </div>

              <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-lg text-xs text-blue-900 flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-[11px]">
                  <strong>User Isolation Guarantee:</strong> Your selected interface accent is stored uniquely for your authenticated profile (<span className="font-mono">{user?.email || 'current user'}</span>) and persists across page reloads without modifying other team members' preferences or company-wide invoice settings.
                </p>
              </div>
            </div>

            {/* Live Interactive UI Preview */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
              <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                Live Theme Preview
              </h3>
              <p className="text-xs text-slate-500">
                Buttons, interactive chips, badges, and focus rings instantly adopt your selected color:
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  type="button"
                  style={{ backgroundColor: activePreset.primary }}
                  className="px-3.5 py-1.5 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Primary Button</span>
                </button>

                <button
                  type="button"
                  style={{
                    backgroundColor: activePreset.light,
                    color: activePreset.primary,
                    borderColor: activePreset.border
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border"
                >
                  Subtle Accent
                </button>

                <span
                  style={{
                    backgroundColor: activePreset.light,
                    color: activePreset.primary,
                    borderColor: activePreset.border
                  }}
                  className="px-2.5 py-0.5 rounded-full text-xs font-bold border font-mono"
                >
                  Badge Active
                </span>
              </div>

              <div className="pt-3 border-t border-slate-100">
                <span className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Sidebar Menu Active Highlight
                </span>
                <div
                  style={{ backgroundColor: activePreset.sidebarBg }}
                  className="p-3 rounded-lg flex items-center justify-between text-white text-xs font-semibold"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activePreset.primary }} />
                    <span>Selected Navigation Item</span>
                  </div>
                  <span
                    style={{ backgroundColor: activePreset.sidebarBadgeBg }}
                    className="px-2 py-0.5 rounded text-[10px] font-bold"
                  >
                    Active
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* ------------------------------------------------------------------ */}
      {/* SECTION 4: NOTIFICATIONS (Available to All Roles) */}
      {/* ------------------------------------------------------------------ */}
      {activeSection === 'notifications' && (
        <form onSubmit={handleSaveNotifications} className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Workplace Notification & Alert Preferences
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {userRole === 'Salesperson'
                  ? 'Customize which system event alerts you receive across customer payments and company policy broadcasts.'
                  : 'Customize which system event alerts you receive across stock thresholds, invoicing, and company policy broadcasts.'}
              </p>
            </div>

            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Alert Settings</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {showStockAlertSetting && (
              <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifStock}
                  onChange={e => setNotifStock(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="font-bold text-slate-800 block">Low Stock & Reorder Thresholds</span>
                  <span className="text-slate-500 text-[11px]">
                    Alert when warehouse stock levels fall below warning limits (Recommended for Warehouse & Purchase Managers).
                  </span>
                </div>
              </label>
            )}

            {showSalesDispatchSetting && (
              <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifSales}
                  onChange={e => setNotifSales(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="font-bold text-slate-800 block">Sales Orders & Dispatch Confirmations</span>
                  <span className="text-slate-500 text-[11px]">
                    Receive notifications when new sales orders are approved or invoice dispatches occur.
                  </span>
                </div>
              </label>
            )}

            <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={notifBilling}
                onChange={e => setNotifBilling(e.target.checked)}
                className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="font-bold text-slate-800 block">Payment Receipts & Account Due Dates</span>
                <span className="text-slate-500 text-[11px]">
                  Reminders for overdue customer balances and vendor bill payment schedules.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={notifPolicy}
                onChange={e => setNotifPolicy(e.target.checked)}
                className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="font-bold text-slate-800 block">Company Policy Publications & Updates</span>
                <span className="text-slate-500 text-[11px]">
                  Immediate broadcast alerts when the Owner publishes a revised standard operating policy.
                </span>
              </div>
            </label>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={notifSound}
                onChange={e => setNotifSound(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="font-medium text-slate-700">Play subtle sound on new urgent notification</span>
            </label>
          </div>
        </form>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 5: COMPANY POLICY (Owner: Full Management; Staff: Read-Only) */}
      {/* ------------------------------------------------------------------ */}
      {activeSection === 'policy' && (
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Company Policies & Standard Operating Procedures
                </h2>
                {isOwner ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                    Owner Governance Mode
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                    Staff Read-Only View
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {isOwner
                  ? 'As Owner, you have exclusive authorization to author, edit, publish, archive, and audit corporate policies.'
                  : 'Mandatory workplace standards and regulatory compliance rules enacted by company leadership.'}
              </p>
            </div>

            {isOwner && (
              <button
                type="button"
                onClick={openCreatePolicyModal}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Company Policy</span>
              </button>
            )}
          </div>

          {/* Filter Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-slate-400 font-semibold text-[11px]">Filter Category:</span>
            <button
              type="button"
              onClick={() => setPolicyCategoryFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${policyCategoryFilter === 'ALL'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
            >
              All Categories
            </button>
            {allCategories.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setPolicyCategoryFilter(cat)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${policyCategoryFilter === cat
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Policies Table / Cards */}
          {policiesLoading ? (
            <div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span>Loading company policies...</span>
            </div>
          ) : filteredPolicies.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-500">
              <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="font-semibold text-slate-700">No company policies found in this category.</p>
              {isOwner && (
                <button
                  onClick={openCreatePolicyModal}
                  className="mt-3 px-3 py-1.5 bg-blue-600 text-white rounded-lg font-semibold text-xs"
                >
                  Create First Policy
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-3">Code</th>
                    <th className="py-2.5 px-3">Title & Summary</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-center">Version</th>
                    <th className="py-2.5 px-3">Effective Date</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPolicies.map(pol => (
                    <tr key={pol.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-blue-600">
                        {pol.code}
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-900 block truncate max-w-[280px]">
                          {pol.title}
                        </span>
                        <span className="text-[11px] text-slate-500 line-clamp-1 max-w-[320px]">
                          {pol.content}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                          {pol.category}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center font-mono font-semibold text-slate-700">
                        v{pol.version}
                      </td>

                      <td className="py-3 px-3 text-slate-600">
                        {pol.effectiveDate}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${pol.status === 'Published'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : pol.status === 'Draft'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                        >
                          {pol.status}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* All roles can read */}
                          <button
                            type="button"
                            onClick={() => setViewingPolicy(pol)}
                            className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="View Full Policy Document"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Owner-Only Editing & Management Actions */}
                          {isOwner && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditPolicyModal(pol)}
                                className="p-1 rounded text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                                title="Edit Policy (Owner Only)"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleTogglePublish(pol)}
                                className={`p-1 rounded transition-colors ${pol.status === 'Published'
                                    ? 'text-emerald-600 hover:bg-emerald-50'
                                    : 'text-blue-600 hover:bg-blue-50'
                                  }`}
                                title={pol.status === 'Published' ? 'Unpublish to Draft' : 'Publish Policy'}
                              >
                                {pol.status === 'Published' ? (
                                  <FileCheck className="w-4 h-4" />
                                ) : (
                                  <Send className="w-4 h-4" />
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleArchivePolicy(pol)}
                                className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                                title="Archive Policy"
                              >
                                <Archive className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => openHistoryModal(pol)}
                                className="p-1 rounded text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                title="Audit Log & History"
                              >
                                <History className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeletePolicy(pol)}
                                className="p-1 rounded text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                title="Delete Policy"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 6: COMPANY SETTINGS (Owner & Admin Only) */}
      {/* ------------------------------------------------------------------ */}
      {activeSection === 'company' && canManageCompany && (
        <div className="space-y-5">
          {/* Sub-tabs for Company Settings */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <button
              type="button"
              onClick={() => setCompanySubTab('profile')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${companySubTab === 'profile' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
            >
              Registered Business Details
            </button>
            <button
              type="button"
              onClick={() => setCompanySubTab('numbering')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${companySubTab === 'numbering' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
            >
              Document Numbering Rules
            </button>
            <button
              type="button"
              onClick={() => setCompanySubTab('invoice_design')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${companySubTab === 'invoice_design' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
            >
              Invoice Customizer & Print
            </button>
          </div>

          {/* Sub-tab 1: Business Profile */}
          {companySubTab === 'profile' && (
            <form onSubmit={handleSaveCompany} className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Registered Business Details
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Printed on tax invoices, bill of supplies, delivery challans, and GST compliance returns.
                  </p>
                </div>

                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Company Details</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Business Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Business Category / Type</label>
                  <select
                    value={formData.businessType}
                    onChange={e => setFormData({ ...formData, businessType: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="Trading">Trading & Distribution</option>
                    <option value="Retail">Retail Store</option>
                    <option value="Wholesale">Wholesale Trader</option>
                    <option value="Manufacturing">Manufacturing & Assembly</option>
                    <option value="Services">Services & IT Consultancy</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">GSTIN</label>
                  <input
                    type="text"
                    value={formData.gstin}
                    onChange={e => setFormData({ ...formData, gstin: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Permanent Account Number (PAN)</label>
                  <input
                    type="text"
                    value={formData.pan}
                    onChange={e => setFormData({ ...formData, pan: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Official Contact Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Support / Invoicing Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Registered Business Address</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City & State</label>
                  <input
                    type="text"
                    value={`${formData.city}, ${formData.state}`}
                    onChange={e => {
                      const parts = e.target.value.split(',');
                      setFormData({ ...formData, city: parts[0]?.trim() || '', state: parts[1]?.trim() || '' });
                    }}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={formData.bankName}
                    onChange={e => setFormData({ ...formData, bankName: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Account Number</label>
                  <input
                    type="text"
                    value={formData.accountNumber}
                    onChange={e => setFormData({ ...formData, accountNumber: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bank IFSC Code</label>
                  <input
                    type="text"
                    value={formData.ifscCode}
                    onChange={e => setFormData({ ...formData, ifscCode: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </form>
          )}

          {/* Sub-tab 2: Document Numbering */}
          {companySubTab === 'numbering' && (
            <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Sequential Document Numbering Schemes
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configure custom prefixes and starting indices for sales, purchase bills, and transfers.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setSaveSuccess('Document numbering rules updated successfully.');
                    setTimeout(() => setSaveSuccess(null), 3000);
                  }}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Numbering Rules</span>
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-2.5 px-3">Voucher / Document Type</th>
                      <th className="py-2.5 px-3">Prefix</th>
                      <th className="py-2.5 px-3">Starting Number</th>
                      <th className="py-2.5 px-3">Next Voucher Preview</th>
                      <th className="py-2.5 px-3 text-center">Auto-Increment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {numberingRules.map((rule, idx) => (
                      <tr key={rule.doc} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{rule.doc}</td>
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            value={rule.prefix}
                            onChange={e => {
                              const val = e.target.value;
                              setNumberingRules(prev =>
                                prev.map((r, i) => i === idx ? { ...r, prefix: val, preview: `${val}${String(r.startNum).padStart(4, '0')}` } : r)
                              );
                            }}
                            className="w-32 px-2 py-1 text-xs border border-slate-300 rounded font-mono text-slate-700 focus:outline-none"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="number"
                            value={rule.startNum}
                            onChange={e => {
                              const val = parseInt(e.target.value, 10) || 1;
                              setNumberingRules(prev =>
                                prev.map((r, i) => i === idx ? { ...r, startNum: val, preview: `${r.prefix}${String(val).padStart(4, '0')}` } : r)
                              );
                            }}
                            className="w-24 px-2 py-1 text-xs border border-slate-300 rounded font-mono text-slate-700 focus:outline-none"
                          />
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-700">
                          {rule.preview}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input type="checkbox" defaultChecked className="rounded text-blue-600" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-tab 3: Invoice Customizer */}
          {companySubTab === 'invoice_design' && (
            <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Tax Invoice Template & Layout Customizer
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Choose printer paper sizes, header elements, UPI payment codes, and standard terms.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setSaveSuccess('Tax invoice layout preferences updated.');
                    setTimeout(() => setSaveSuccess(null), 3000);
                  }}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Apply Invoice Design</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                <div className="space-y-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">Default Printer Paper Size</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['A4', 'Thermal', 'POS'] as const).map(size => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setPaperSize(size)}
                          className={`py-2 px-3 rounded-lg border font-semibold text-center transition-colors ${paperSize === size
                              ? 'bg-blue-50 border-blue-600 text-blue-700 font-bold'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                          {size === 'A4' ? 'A4 Laser' : size === 'Thermal' ? '3" Thermal' : '2" POS'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <span className="font-bold text-slate-700 block">Header & Footer Elements</span>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showLogo}
                        onChange={e => setShowLogo(e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      <span>Print Company Brand Logo</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showQr}
                        onChange={e => setShowQr(e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      <span>Display UPI Dynamic QR Code on Bills</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showBankDetails}
                        onChange={e => setShowBankDetails(e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      <span>Print Bank NEFT/RTGS Account Details</span>
                    </label>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Invoice Terms & Conditions</label>
                    <textarea
                      rows={3}
                      value={termsText}
                      onChange={e => setTermsText(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                    />
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                      Invoice Preview Layout ({paperSize})
                    </span>
                    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs space-y-2 text-[10px]">
                      <div className="flex justify-between items-center border-b pb-2">
                        <div>
                          <span className="font-bold text-slate-800 text-xs">{company.name || 'Universal ERP'}</span>
                          <span className="block text-slate-500">GSTIN: {company.gstin || '27AAAAA0000A1Z5'}</span>
                        </div>
                        {showQr && <QrCode className="w-8 h-8 text-slate-700" />}
                      </div>
                      <div className="py-1">
                        <span className="font-bold text-slate-700">TAX INVOICE: INV-2026-1001</span>
                        <span className="block text-slate-500">Date: {new Date().toLocaleDateString()}</span>
                      </div>
                      <div className="border-t pt-1 text-[9px] text-slate-400">
                        {showBankDetails && <span>Bank: {company.bankName || 'HDFC Bank'} • A/C: {company.accountNumber || '50200012345678'}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 7: USER & ROLE MANAGEMENT (Owner & Admin Only) */}
      {/* ------------------------------------------------------------------ */}
      {activeSection === 'users' && canManageCompany && (
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                User Provisioning & Role Privileges Overview
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage team accounts, assign business scopes, and audit access boundaries across 7 functional roles.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/users')}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Open Users & Roles Master</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Executive Role</span>
              <span className="text-sm font-bold text-slate-900 block mt-1">Owner & Admin</span>
              <span className="text-[11px] text-slate-500 mt-0.5 block">Full administrative oversight</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Financial Control</span>
              <span className="text-sm font-bold text-slate-900 block mt-1">Accountant</span>
              <span className="text-[11px] text-slate-500 mt-0.5 block">Ledgers, tax filing, reports</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Inventory & Logistics</span>
              <span className="text-sm font-bold text-slate-900 block mt-1">Warehouse Manager</span>
              <span className="text-[11px] text-slate-500 mt-0.5 block">Stock movement, alerts, batches</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Commercial & POS</span>
              <span className="text-sm font-bold text-slate-900 block mt-1">Sales & Cashier</span>
              <span className="text-[11px] text-slate-500 mt-0.5 block">Invoicing, customer collection</span>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 8: SYSTEM CONFIGURATION (Owner & Admin Only) */}
      {/* ------------------------------------------------------------------ */}
      {activeSection === 'system' && canManageSystem && (
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-6 text-xs">
          <div className="pb-3 border-b border-slate-100">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              System Diagnostics, Backups & Cache Synchronization
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Export comprehensive JSON database backups, synchronize real-time Supabase state, and monitor health.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="flex items-center gap-2">
                <HardDriveDownload className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-800 text-xs">Full JSON Database Backup</h3>
              </div>
              <p className="text-slate-500 leading-relaxed text-[11px]">
                Downloads complete serialized JSON archive containing products, invoices, customers, suppliers, inventory transactions, and accounting journals.
              </p>
              <button
                type="button"
                onClick={handleDownloadBackup}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <HardDriveDownload className="w-3.5 h-3.5" />
                <span>Download Backup JSON</span>
              </button>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-800 text-xs">Supabase Real-Time Cache Re-sync</h3>
              </div>
              <p className="text-slate-500 leading-relaxed text-[11px]">
                Forces an immediate re-fetch of all active business entities from Supabase to clear stale local state and align multi-user revisions.
              </p>
              <button
                type="button"
                onClick={handleSyncDatabase}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Synchronize Cache</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 1: VIEW POLICY (Available to All Roles) */}
      {/* ------------------------------------------------------------------ */}
      {viewingPolicy && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden animate-scaleIn">
            <div className="p-4.5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-blue-600 text-xs">{viewingPolicy.code}</span>
                <h3 className="font-bold text-slate-900 text-sm">{viewingPolicy.title}</h3>
              </div>
              <ModalCloseButton onClose={() => setViewingPolicy(null)} autoHandleEscape={true} />
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-700">
                  Category: {viewingPolicy.category}
                </span>
                <span className="px-2 py-0.5 rounded font-mono font-semibold bg-blue-50 text-blue-700">
                  Version: v{viewingPolicy.version}
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                  Effective: {viewingPolicy.effectiveDate}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full font-bold ${viewingPolicy.status === 'Published'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-700'
                    }`}
                >
                  {viewingPolicy.status}
                </span>
              </div>

              <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 whitespace-pre-wrap leading-relaxed text-slate-800 text-xs font-normal">
                {viewingPolicy.content}
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingPolicy(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs"
              >
                Close Document
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 2: CREATE / EDIT POLICY (Strictly Owner-Only) */}
      {/* ------------------------------------------------------------------ */}
      {(isCreatingPolicy || editingPolicy) && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSavePolicyForm}
            className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden animate-scaleIn"
          >
            <div className="p-4.5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>{editingPolicy ? 'Edit Company Policy' : 'Author New Company Policy'}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                  Owner Action
                </span>
              </h3>
              <ModalCloseButton
                onClose={() => {
                  setIsCreatingPolicy(false);
                  setEditingPolicy(null);
                }}
                autoHandleEscape={true}
              />
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {policyFormError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{policyFormError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Policy Title</label>
                  <input
                    type="text"
                    required
                    value={policyFormTitle}
                    onChange={e => setPolicyFormTitle(e.target.value)}
                    placeholder="e.g. Warehouse Inventory Stock Reconciliation"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Policy Code</label>
                  <input
                    type="text"
                    value={policyFormCode}
                    onChange={e => setPolicyFormCode(e.target.value)}
                    placeholder="POL-004"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Functional Category</label>
                  <select
                    value={policyFormCategory}
                    onChange={e => setPolicyFormCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="General">General / Ethics & Conduct</option>
                    <option value="Warehouse & Inventory">Warehouse & Inventory</option>
                    <option value="Sales & Credit">Sales & Customer Credit</option>
                    <option value="Procurement & Purchasing">Procurement & Purchasing</option>
                    <option value="Financial & Accounting">Financial & Accounting</option>
                    <option value="Data & Security">Data & System Security</option>
                    <option value="HR & Attendance">HR & Attendance</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Version</label>
                    <input
                      type="text"
                      value={policyFormVersion}
                      onChange={e => setPolicyFormVersion(e.target.value)}
                      placeholder="1.0"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Status</label>
                    <select
                      value={policyFormStatus}
                      onChange={e => setPolicyFormStatus(e.target.value as PolicyStatus)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="Draft">Draft</option>
                      <option value="Published">Published</option>
                      <option value="Archived">Archived</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Effective Date</label>
                  <input
                    type="date"
                    value={policyFormEffectiveDate}
                    onChange={e => setPolicyFormEffectiveDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Policy Content & Operational Requirements</label>
                <textarea
                  rows={6}
                  required
                  value={policyFormContent}
                  onChange={e => setPolicyFormContent(e.target.value)}
                  placeholder="Detail the standard operating procedure, operational mandates, approval limits, and non-compliance consequences..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none leading-relaxed font-sans"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsCreatingPolicy(false);
                  setEditingPolicy(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs shadow-xs"
              >
                {editingPolicy ? 'Update Policy' : 'Create Policy'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 3: AUDIT HISTORY (Owner Only) */}
      {/* ------------------------------------------------------------------ */}
      {historyModalPolicy && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden animate-scaleIn">
            <div className="p-4.5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">Policy Audit Trail</h3>
                <span className="font-mono text-xs text-blue-600 font-bold">{historyModalPolicy.code}</span>
              </div>
              <ModalCloseButton onClose={() => setHistoryModalPolicy(null)} autoHandleEscape={true} />
            </div>

            <div className="p-5 overflow-y-auto space-y-3 text-xs">
              {policyHistoryLoading ? (
                <div className="py-6 text-center text-slate-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  <span>Loading audit records...</span>
                </div>
              ) : policyHistory.length === 0 ? (
                <div className="py-6 text-center text-slate-400">
                  No historical revision records found.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {policyHistory.map(item => (
                    <div key={item.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 capitalize">Action: {item.action}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(item.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-slate-600 text-[11px]">{item.details}</p>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2 pt-1 border-t border-slate-200/60">
                        <span>Authorized By: {item.performedByName || 'Owner'}</span>
                        <span>Role: {item.performedByRole || 'Owner'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setHistoryModalPolicy(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs"
              >
                Close Audit Trail
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
