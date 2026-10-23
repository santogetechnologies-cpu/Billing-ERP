import React, { useState, useEffect, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Activity,
  Users,
  Clock,
  Calendar,
  Filter,
  Search,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Zap,
  SlidersHorizontal,
  ChevronRight,
  TrendingUp,
  Sparkles,
  Info
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useERP } from '../../context/ERPContext';
import { canAccessUserActivity } from '../../utils/rbac';
import { UserActivitySummary, ActivityOverviewStats, UserRole } from '../../types';
import { userActivityService } from '../../services/userActivityService';
import { SessionHistoryModal } from './SessionHistoryModal';
import { StatCard } from '../../components/common/StatCard';

export const UserActivityMonitoringPage: React.FC = () => {
  const { profile } = useAuth();
  const { company } = useERP();

  // 1. Strict Owner-Only Access Guard
  const isOwner = canAccessUserActivity(profile?.role);

  // States
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [userSummaries, setUserSummaries] = useState<UserActivitySummary[]>([]);
  const [overviewStats, setOverviewStats] = useState<ActivityOverviewStats>({
    activeUsersCount: 0,
    inactiveUsersCount: 0,
    totalSessionsToday: 0,
    avgSessionDurationSeconds: 0
  });

  // Metric Toggle: Individual Session Duration vs Total Login Duration
  const [metricViewMode, setMetricViewMode] = useState<'individual' | 'total'>('individual');

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('ALL');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | 'Active' | 'Inactive'>('ALL');
  const [datePreset, setDatePreset] = useState<'today' | '7days' | '30days' | 'custom'>('today');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Sorting
  const [sortField, setSortField] = useState<'loginTime' | 'totalDuration' | 'lastLogin' | 'lastActivity' | 'name'>('loginTime');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modal State
  const [selectedUserForHistory, setSelectedUserForHistory] = useState<UserActivitySummary | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);

  // Live ticking seconds counter for active sessions on the page
  const [tick, setTick] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute actual date range from selected preset
  const dateRangeBounds = useMemo(() => {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    if (datePreset === 'today') {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return { start, end, label: 'Today' };
    }

    if (datePreset === '7days') {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      return { start, end, label: 'Last 7 Days' };
    }

    if (datePreset === '30days') {
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      return { start, end, label: 'Last 30 Days' };
    }

    // Custom
    const start = customStartDate ? new Date(`${customStartDate}T00:00:00`) : new Date(0);
    const customEnd = customEndDate ? new Date(`${customEndDate}T23:59:59`) : end;
    return {
      start,
      end: customEnd,
      label: `${customStartDate} to ${customEndDate}`
    };
  }, [datePreset, customStartDate, customEndDate]);

  // Load telemetry data from service
  const loadActivityData = async (showRefreshSpin = false) => {
    if (!isOwner) return;

    if (showRefreshSpin) setIsRefreshing(true);
    else setLoading(true);

    try {
      const data = await userActivityService.getUserActivityMonitoringData({
        companyId: company?.id,
        startDate: dateRangeBounds.start,
        endDate: dateRangeBounds.end
      });

      setUserSummaries(data.userSummaries);
      setOverviewStats(data.overviewStats);
    } catch (err) {
      console.error('Failed to load user activity data:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadActivityData();
  }, [isOwner, company?.id, dateRangeBounds.start.getTime(), dateRangeBounds.end.getTime()]);

  // Filtered & Sorted Users
  const processedUsers = useMemo(() => {
    let result = [...userSummaries];

    // Search query (name or email)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      );
    }

    // User filter
    if (selectedUserFilter !== 'ALL') {
      result = result.filter(u => u.userId === selectedUserFilter);
    }

    // Role filter
    if (selectedRoleFilter !== 'ALL') {
      result = result.filter(u => u.role === selectedRoleFilter);
    }

    // Status filter
    if (selectedStatusFilter !== 'ALL') {
      result = result.filter(u => u.status === selectedStatusFilter);
    }

    // Sorting
    result.sort((a, b) => {
      let comparison = 0;

      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === 'totalDuration') {
        comparison = (a.totalDurationSeconds || 0) - (b.totalDurationSeconds || 0);
      } else if (sortField === 'lastLogin') {
        const timeA = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0;
        const timeB = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0;
        comparison = timeA - timeB;
      } else if (sortField === 'lastActivity') {
        const timeA = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
        const timeB = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
        comparison = timeA - timeB;
      } else {
        // default: loginTime
        const timeA = a.currentLoginAt ? new Date(a.currentLoginAt).getTime() : 0;
        const timeB = b.currentLoginAt ? new Date(b.currentLoginAt).getTime() : 0;
        comparison = timeA - timeB;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [userSummaries, searchQuery, selectedUserFilter, selectedRoleFilter, selectedStatusFilter, sortField, sortOrder]);

  // If unauthorized non-Owner, deny access immediately
  if (!isOwner) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mb-4 shadow-sm">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Access Restricted (403)</h2>
        <p className="text-sm text-slate-500 max-w-md mt-2">
          The User Activity Monitoring & Login Time Tracking System contains confidential business telemetry accessible strictly to the <strong>Owner</strong>.
        </p>
        <button
          onClick={() => window.location.replace('/')}
          className="mt-6 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const getRoleBadgeClass = (role: string) => {
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
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Warehouse Manager':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'Cashier':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 pb-12 w-full animate-fadeIn">
      {/* 1. Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="p-2 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  User Activity Monitoring
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                  Owner Exclusive Telemetry
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time user session tracking, presence telemetry, login duration and activity auditing.
              </p>
            </div>
          </div>
        </div>

        {/* Header Action Controls */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
          <button
            onClick={() => loadActivityData(true)}
            disabled={isRefreshing || loading}
            className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
            title="Refresh Live Session Telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-purple-600' : 'text-slate-500'}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Refresh Activity'}</span>
          </button>
        </div>
      </div>

      {/* 2. Primary KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Users Right Now */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Active Right Now</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {overviewStats.activeUsersCount}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              / {overviewStats.activeUsersCount + overviewStats.inactiveUsersCount} Users
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            <span>{overviewStats.inactiveUsersCount} inactive / logged out</span>
          </div>
        </div>

        {/* Card 2: Total Sessions Today */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Sessions Today</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {overviewStats.totalSessionsToday}
            </span>
            <span className="text-xs text-slate-500 font-medium">Sessions</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-mono">
            Avg Duration: {userActivityService.formatDuration(overviewStats.avgSessionDurationSeconds)}
          </div>
        </div>

        {/* Metric Mode Toggle Header for Cards 3 & 4 */}
        {/* Card 3: Longest Session OR Highest Total Duration */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              {metricViewMode === 'individual' ? 'Longest Individual Session' : 'Highest Total Duration'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Flame className="w-4 h-4 text-purple-600" />
            </div>
          </div>
          <div className="mt-2">
            {metricViewMode === 'individual' ? (
              overviewStats.longestIndividualSessionUser ? (
                <>
                  <div className="text-base font-bold text-slate-900 truncate" title={overviewStats.longestIndividualSessionUser.name}>
                    {overviewStats.longestIndividualSessionUser.name}
                  </div>
                  <div className="text-sm font-bold text-purple-700 font-mono mt-0.5">
                    {userActivityService.formatDuration(overviewStats.longestIndividualSessionUser.durationSeconds)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {userActivityService.formatDateTime(overviewStats.longestIndividualSessionUser.sessionDate)}
                  </div>
                </>
              ) : (
                <div className="text-xs text-slate-400 mt-2">No completed sessions yet</div>
              )
            ) : (
              overviewStats.highestTotalDurationUser ? (
                <>
                  <div className="text-base font-bold text-slate-900 truncate" title={overviewStats.highestTotalDurationUser.name}>
                    {overviewStats.highestTotalDurationUser.name}
                  </div>
                  <div className="text-sm font-bold text-purple-700 font-mono mt-0.5">
                    {userActivityService.formatDuration(overviewStats.highestTotalDurationUser.durationSeconds)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Accumulated in {dateRangeBounds.label}
                  </div>
                </>
              ) : (
                <div className="text-xs text-slate-400 mt-2">No total duration records</div>
              )
            )}
          </div>
        </div>

        {/* Card 4: Shortest Completed Session OR Lowest Total Duration */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              {metricViewMode === 'individual' ? 'Shortest Completed Session' : 'Lowest Total Duration'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <div className="mt-2">
            {metricViewMode === 'individual' ? (
              overviewStats.shortestCompletedSessionUser ? (
                <>
                  <div className="text-base font-bold text-slate-900 truncate" title={overviewStats.shortestCompletedSessionUser.name}>
                    {overviewStats.shortestCompletedSessionUser.name}
                  </div>
                  <div className="text-sm font-bold text-amber-700 font-mono mt-0.5">
                    {userActivityService.formatDuration(overviewStats.shortestCompletedSessionUser.durationSeconds)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {userActivityService.formatDateTime(overviewStats.shortestCompletedSessionUser.sessionDate)}
                  </div>
                </>
              ) : (
                <div className="text-xs text-slate-400 mt-2">No completed sessions yet</div>
              )
            ) : (
              overviewStats.lowestTotalDurationUser ? (
                <>
                  <div className="text-base font-bold text-slate-900 truncate" title={overviewStats.lowestTotalDurationUser.name}>
                    {overviewStats.lowestTotalDurationUser.name}
                  </div>
                  <div className="text-sm font-bold text-amber-700 font-mono mt-0.5">
                    {userActivityService.formatDuration(overviewStats.lowestTotalDurationUser.durationSeconds)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Lowest in {dateRangeBounds.label}
                  </div>
                </>
              ) : (
                <div className="text-xs text-slate-400 mt-2">No records found</div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Metric Mode Switch Banner */}
      <div className="bg-white px-4.5 py-3 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <Info className="w-4 h-4 text-purple-600 shrink-0" />
          <span>
            <strong>Display Metric:</strong> Switch extreme session calculations between single session lengths vs accumulated login time.
          </span>
        </div>

        <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200/80 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setMetricViewMode('individual')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              metricViewMode === 'individual'
                ? 'bg-white text-purple-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Individual Session Duration
          </button>
          <button
            type="button"
            onClick={() => setMetricViewMode('total')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              metricViewMode === 'total'
                ? 'bg-white text-purple-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Total Login Duration
          </button>
        </div>
      </div>

      {/* 3. Search & Filters Panel */}
      <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3.5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search Box */}
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search user by name or email..."
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200/90 rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
            />
          </div>

          {/* User Filter Dropdown */}
          <div className="md:col-span-3">
            <select
              value={selectedUserFilter}
              onChange={e => setSelectedUserFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200/90 rounded-xl text-slate-800 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 cursor-pointer"
            >
              <option value="ALL">All Users ({userSummaries.length})</option>
              {userSummaries.map(u => (
                <option key={u.userId} value={u.userId}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          {/* Role Filter Dropdown */}
          <div className="md:col-span-3">
            <select
              value={selectedRoleFilter}
              onChange={e => setSelectedRoleFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200/90 rounded-xl text-slate-800 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 cursor-pointer"
            >
              <option value="ALL">All Roles</option>
              <option value="Owner">Owner</option>
              <option value="Admin">Admin</option>
              <option value="Accountant">Accountant</option>
              <option value="Salesperson">Salesperson</option>
              <option value="Purchase Manager">Purchase Manager</option>
              <option value="Warehouse Manager">Warehouse Manager</option>
              <option value="Cashier">Cashier</option>
            </select>
          </div>

          {/* Status Filter Dropdown */}
          <div className="md:col-span-2">
            <select
              value={selectedStatusFilter}
              onChange={e => setSelectedStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200/90 rounded-xl text-slate-800 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 cursor-pointer"
            >
              <option value="ALL">All Status</option>
              <option value="Active">Active Only</option>
              <option value="Inactive">Inactive Only</option>
            </select>
          </div>
        </div>

        {/* Second Row: Date Presets & Custom Range */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-500 mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" /> Date Filter:
            </span>
            <button
              onClick={() => setDatePreset('today')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                datePreset === 'today'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setDatePreset('7days')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                datePreset === '7days'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => setDatePreset('30days')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                datePreset === '30days'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              Last 30 Days
            </button>
            <button
              onClick={() => setDatePreset('custom')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                datePreset === 'custom'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              Custom Range
            </button>
          </div>

          {datePreset === 'custom' && (
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <input
                type="date"
                value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
                className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
                className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono"
              />
            </div>
          )}
        </div>
      </div>

      {/* 4. User Activity Monitoring Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>All Users Activity Telemetry</span>
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-200/70 text-slate-700">
                {processedUsers.length} Users Listed
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Click any user row to view individual session history and granular device telemetry.
            </p>
          </div>

          {/* Quick Sort Selector */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 self-start sm:self-auto">
            <span>Sort By:</span>
            <select
              value={sortField}
              onChange={e => setSortField(e.target.value as any)}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-none cursor-pointer"
            >
              <option value="loginTime">Current Login Time</option>
              <option value="totalDuration">Total Session Duration</option>
              <option value="lastLogin">Last Login</option>
              <option value="lastActivity">Last Activity</option>
              <option value="name">User Name</option>
            </select>
            <button
              onClick={() => setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
              title={`Toggle sort order (${sortOrder === 'asc' ? 'Ascending' : 'Descending'})`}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-24 text-center text-slate-400 flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm font-medium">Loading user activity and presence records...</p>
          </div>
        ) : processedUsers.length === 0 ? (
          <div className="py-24 text-center text-slate-500">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-base font-semibold text-slate-700">No users match your filter criteria</p>
            <p className="text-xs text-slate-400 mt-1">Try resetting search query, role filter, or date range.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 text-slate-600 border-b border-slate-200 font-semibold select-none">
                  <th
                    onClick={() => toggleSort('name')}
                    className="py-3 px-3.5 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>User</span>
                      {sortField === 'name' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-purple-600" /> : <ArrowDown className="w-3 h-3 text-purple-600" />)}
                    </div>
                  </th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Email / Username</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Status</th>
                  <th
                    onClick={() => toggleSort('loginTime')}
                    className="py-3 px-3.5 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Current Login</span>
                      {sortField === 'loginTime' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-purple-600" /> : <ArrowDown className="w-3 h-3 text-purple-600" />)}
                    </div>
                  </th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Current Session</th>
                  <th
                    onClick={() => toggleSort('totalDuration')}
                    className="py-3 px-3.5 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap text-right"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Total Duration</span>
                      {sortField === 'totalDuration' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-purple-600" /> : <ArrowDown className="w-3 h-3 text-purple-600" />)}
                    </div>
                  </th>
                  <th className="py-3 px-3.5 whitespace-nowrap text-right">Avg Session</th>
                  <th className="py-3 px-3.5 whitespace-nowrap text-right">Longest</th>
                  <th className="py-3 px-3.5 whitespace-nowrap text-right">Shortest</th>
                  <th
                    onClick={() => toggleSort('lastActivity')}
                    className="py-3 px-3.5 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Last Activity</span>
                      {sortField === 'lastActivity' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-purple-600" /> : <ArrowDown className="w-3 h-3 text-purple-600" />)}
                    </div>
                  </th>
                  <th className="py-3 px-3.5 text-center whitespace-nowrap">Sessions</th>
                  <th className="py-3 px-3.5 text-center whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {processedUsers.map(user => {
                  const isUserActive = user.status === 'Active';
                  
                  // Live current session duration
                  let liveSessionDuration = user.currentSessionDurationSeconds;
                  if (isUserActive && user.currentLoginAt) {
                    const loginTime = new Date(user.currentLoginAt).getTime();
                    liveSessionDuration = Math.max(0, Math.floor((Date.now() - loginTime) / 1000));
                  }

                  return (
                    <tr
                      key={user.userId}
                      onClick={() => {
                        setSelectedUserForHistory(user);
                        setIsHistoryModalOpen(true);
                      }}
                      className={`hover:bg-purple-50/20 cursor-pointer transition-colors group ${
                        isUserActive ? 'bg-emerald-50/15' : ''
                      }`}
                    >
                      {/* User & Role */}
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-linear-to-tr from-purple-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs shrink-0">
                            {(user.name || 'U').substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 group-hover:text-purple-700 block transition-colors leading-tight">
                              {user.name}
                            </span>
                            <span className={`inline-block mt-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold border ${getRoleBadgeClass(user.role)}`}>
                              {user.role}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Email / Username */}
                      <td className="py-3 px-3.5 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                        {user.email}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {isUserActive ? (
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Active</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            <span className="w-2 h-2 rounded-full bg-slate-400" />
                            <span>Inactive</span>
                          </div>
                        )}
                      </td>

                      {/* Current Login Time */}
                      <td className="py-3 px-3.5 text-slate-800 whitespace-nowrap">
                        {isUserActive && user.currentLoginAt ? (
                          <span className="font-medium text-emerald-700">
                            {userActivityService.formatDateTime(user.currentLoginAt)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Current Session Duration */}
                      <td className="py-3 px-3.5 font-mono whitespace-nowrap">
                        {isUserActive && user.currentLoginAt ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                            {userActivityService.formatDuration(liveSessionDuration)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Total Login Duration */}
                      <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        {userActivityService.formatDuration(user.totalDurationSeconds)}
                      </td>

                      {/* Average Session Duration */}
                      <td className="py-3 px-3.5 text-right font-mono text-slate-600 whitespace-nowrap">
                        {userActivityService.formatDuration(user.avgSessionDurationSeconds)}
                      </td>

                      {/* Longest Session */}
                      <td className="py-3 px-3.5 text-right font-mono text-purple-700 font-semibold whitespace-nowrap">
                        {userActivityService.formatDuration(user.longestSessionSeconds)}
                      </td>

                      {/* Shortest Session */}
                      <td className="py-3 px-3.5 text-right font-mono text-amber-700 whitespace-nowrap">
                        {userActivityService.formatDuration(user.shortestSessionSeconds)}
                      </td>

                      {/* Last Activity / Heartbeat */}
                      <td className="py-3 px-3.5 text-slate-600 whitespace-nowrap" title={user.lastActivityAt || undefined}>
                        {user.lastActivityAt ? (
                          <span className="text-[11px]">
                            {userActivityService.formatDateTime(user.lastActivityAt)}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Never</span>
                        )}
                      </td>

                      {/* Number of sessions */}
                      <td className="py-3 px-3.5 text-center font-bold text-slate-800 whitespace-nowrap">
                        {user.sessionCount}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setSelectedUserForHistory(user);
                            setIsHistoryModalOpen(true);
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-all cursor-pointer flex items-center gap-1 mx-auto"
                        >
                          <Eye className="w-3 h-3" />
                          <span>History</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Session History Modal */}
      <SessionHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        userSummary={selectedUserForHistory}
        dateRangeLabel={dateRangeBounds.label}
        startDate={dateRangeBounds.start}
        endDate={dateRangeBounds.end}
      />
    </div>
  );
};
