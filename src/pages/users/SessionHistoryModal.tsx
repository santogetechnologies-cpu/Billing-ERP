import React, { useState, useEffect } from 'react';
import {
  Clock,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Shield,
  Activity,
  History,
  Info
} from 'lucide-react';
import { UserActivitySummary, UserSession } from '../../types';
import { userActivityService } from '../../services/userActivityService';
import { ModalCloseButton } from '../../components/common/ModalCloseButton';

interface SessionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  userSummary: UserActivitySummary | null;
  dateRangeLabel?: string;
  startDate?: Date | string;
  endDate?: Date | string;
}

export const SessionHistoryModal: React.FC<SessionHistoryModalProps> = ({
  isOpen,
  onClose,
  userSummary,
  dateRangeLabel = 'Selected Period',
  startDate,
  endDate
}) => {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [liveDuration, setLiveDuration] = useState<number>(0);

  useEffect(() => {
    if (!isOpen || !userSummary) return;

    let isMounted = true;
    setLoading(true);

    const loadSessions = async () => {
      try {
        const history = await userActivityService.getUserSessionHistory(
          userSummary.userId,
          undefined,
          {
            start: startDate ? new Date(startDate) : undefined,
            end: endDate ? new Date(endDate) : undefined
          }
        );
        if (isMounted) {
          setSessions(history);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load user session history:', err);
        if (isMounted) setLoading(false);
      }
    };

    loadSessions();

    return () => {
      isMounted = false;
    };
  }, [isOpen, userSummary?.userId, startDate, endDate]);

  // Live timer tick for active sessions
  useEffect(() => {
    if (!isOpen || !userSummary || userSummary.status !== 'Active' || !userSummary.currentLoginAt) {
      return;
    }

    const updateTimer = () => {
      const loginMs = new Date(userSummary.currentLoginAt!).getTime();
      const elapsed = Math.max(0, Math.floor((Date.now() - loginMs) / 1000));
      setLiveDuration(elapsed);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isOpen, userSummary?.status, userSummary?.currentLoginAt]);

  if (!isOpen || !userSummary) return null;

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

  const getStatusBadge = (status: string, isCurrentLiveActive: boolean = false) => {
    if (status === 'Active' || isCurrentLiveActive) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Active Session
        </span>
      );
    }
    if (status === 'Completed') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
          <CheckCircle2 className="w-3 h-3 text-blue-500" />
          Completed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
        <AlertTriangle className="w-3 h-3 text-amber-500" />
        Expired / Interrupted
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4.5 bg-slate-50 border-b border-slate-200/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center shadow-xs">
              {(userSummary.name || 'U').substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  {userSummary.name}
                </h2>
                <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${getRoleBadgeClass(userSummary.role)}`}>
                  {userSummary.role}
                </span>
                {getStatusBadge(userSummary.status)}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                <span>{userSummary.email}</span>
                <span>•</span>
                <span className="font-mono text-slate-400">ID: {userSummary.userId.slice(0, 8)}...</span>
              </p>
            </div>
          </div>

          <ModalCloseButton onClose={onClose} autoHandleEscape size="md" />
        </div>

        {/* Telemetry Summary Stats Card */}
        <div className="px-6 py-3.5 bg-white border-b border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[11px] font-medium text-slate-500 block">Total Login Duration</span>
            <span className="text-sm font-bold text-slate-900 mt-0.5 block font-mono">
              {userActivityService.formatDuration(userSummary.totalDurationSeconds)}
            </span>
            <span className="text-[10px] text-slate-400">{dateRangeLabel}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[11px] font-medium text-slate-500 block">Sessions Recorded</span>
            <span className="text-sm font-bold text-slate-900 mt-0.5 block">
              {userSummary.sessionCount} session{userSummary.sessionCount === 1 ? '' : 's'}
            </span>
            <span className="text-[10px] text-slate-400">In selected filter</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[11px] font-medium text-slate-500 block">Average Session</span>
            <span className="text-sm font-bold text-slate-900 mt-0.5 block font-mono">
              {userActivityService.formatDuration(userSummary.avgSessionDurationSeconds)}
            </span>
            <span className="text-[10px] text-slate-400">Completed average</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[11px] font-medium text-slate-500 block">Longest Session</span>
            <span className="text-sm font-bold text-emerald-700 mt-0.5 block font-mono">
              {userActivityService.formatDuration(userSummary.longestSessionSeconds)}
            </span>
            <span className="text-[10px] text-slate-400">
              Shortest: {userActivityService.formatDuration(userSummary.shortestSessionSeconds)}
            </span>
          </div>
        </div>

        {/* Sessions List Table */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-4 h-4 text-slate-400" />
              <span>Detailed Session History ({sessions.length})</span>
            </h3>
            <span className="text-xs text-slate-500">
              Timestamps in your local timezone
            </span>
          </div>

          {loading ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm font-medium">Loading session audit records...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="py-16 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <History className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No session records found</p>
              <p className="text-xs text-slate-400 mt-1">
                No login events recorded for this user in {dateRangeLabel}.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs bg-white">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                    <th className="py-3 px-3.5">Session ID</th>
                    <th className="py-3 px-3.5">Status</th>
                    <th className="py-3 px-3.5">Login Time</th>
                    <th className="py-3 px-3.5">Logout Time</th>
                    <th className="py-3 px-3.5 text-right">Duration</th>
                    <th className="py-3 px-3.5">Last Heartbeat</th>
                    <th className="py-3 px-3.5">Client & Device</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sessions.map((session, idx) => {
                    const isLiveActive = session.status === 'Active' && userSummary.status === 'Active';
                    const displayDuration = isLiveActive && liveDuration > 0
                      ? liveDuration
                      : session.durationSeconds;

                    return (
                      <tr
                        key={session.id || idx}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isLiveActive ? 'bg-emerald-50/20' : ''
                        }`}
                      >
                        <td className="py-3 px-3.5 font-mono text-[11px] text-slate-500">
                          {session.id ? session.id.slice(0, 8) : `sess-${idx + 1}`}
                        </td>
                        <td className="py-3 px-3.5">
                          {getStatusBadge(session.status, isLiveActive)}
                        </td>
                        <td className="py-3 px-3.5 text-slate-800 font-medium whitespace-nowrap">
                          {userActivityService.formatDateTime(session.loginAt)}
                        </td>
                        <td className="py-3 px-3.5 text-slate-600 whitespace-nowrap">
                          {session.logoutAt ? (
                            userActivityService.formatDateTime(session.logoutAt)
                          ) : isLiveActive ? (
                            <span className="text-emerald-600 font-semibold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              In Progress
                            </span>
                          ) : (
                            <span className="text-amber-600 italic">Interrupted (Timeout)</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-semibold text-slate-900 whitespace-nowrap">
                          {userActivityService.formatDuration(displayDuration)}
                        </td>
                        <td className="py-3 px-3.5 text-slate-500 text-[11px] whitespace-nowrap">
                          {userActivityService.formatDateTime(session.lastHeartbeatAt)}
                        </td>
                        <td className="py-3 px-3.5 text-slate-500 text-[11px] max-w-xs truncate" title={session.deviceInfo}>
                          <span className="flex items-center gap-1.5">
                            <Laptop className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{session.deviceInfo || 'Web Browser'}</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <span>
              <strong>Owner Security Policy:</strong> Sessions without clean logouts are expired automatically after 120 seconds of inactivity. Durations for expired sessions are computed up to the last verified heartbeat timestamp rather than assuming an arbitrary logout time.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
