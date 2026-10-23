import { supabase } from '../lib/supabase';
import { UserRole, UserSession, UserSessionStatus, UserActivitySummary, ActivityOverviewStats, SystemUser } from '../types';
import { canAccessUserActivity, getActiveUserRole } from '../utils/rbac';
import { userService } from './userService';
import { presenceService, ONLINE_THRESHOLD_MS } from './presenceService';
import { isTableMarkedMissing, markTableMissing, isTableNotFoundError } from '../utils/schemaDetector';

export const ACTIVE_SESSION_STORAGE_KEY = 'erp_active_session_id';
export const LOCAL_SESSIONS_STORAGE_KEY = 'erp_user_sessions_cache';
export const HEARTBEAT_TIMEOUT_SECONDS = 120; // 2 minutes cutoff for stale sessions

export interface SessionStartOptions {
  id: string;
  email?: string;
  name?: string;
  role?: UserRole;
  companyId?: string;
}

export interface ActivityFilterOptions {
  companyId?: string;
  userId?: string;
  role?: string;
  status?: 'All' | 'Active' | 'Inactive';
  startDate?: Date | string;
  endDate?: Date | string;
  search?: string;
}

class UserActivityService {
  /**
   * Helper: Get client browser and device signature
   */
  private getDeviceMetadata(): string {
    if (typeof window === 'undefined') return 'Server/Node';
    try {
      const ua = navigator.userAgent;
      let browser = 'Web Browser';
      if (ua.includes('Edg/')) browser = 'Microsoft Edge';
      else if (ua.includes('Chrome/')) browser = 'Google Chrome';
      else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Apple Safari';
      else if (ua.includes('Firefox/')) browser = 'Mozilla Firefox';

      let os = 'Unknown OS';
      if (ua.includes('Windows')) os = 'Windows';
      else if (ua.includes('Mac OS')) os = 'macOS';
      else if (ua.includes('Linux')) os = 'Linux';
      else if (ua.includes('Android')) os = 'Android';
      else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

      const screenRes = typeof window.screen !== 'undefined'
        ? `${window.screen.width}x${window.screen.height}`
        : '';

      return `${browser} on ${os}${screenRes ? ` (${screenRes})` : ''}`;
    } catch {
      return 'Web Client';
    }
  }

  /**
   * Helper: Generate a robust UUID v4
   */
  private generateUuid(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private inMemorySessions: UserSession[] = [];
  private inMemoryActiveSessionId: string | null = null;

  /**
   * Reads cached sessions from localStorage (browser) or in-memory array (Node/SSR)
   */
  getLocalSessions(): UserSession[] {
    if (typeof window === 'undefined') {
      return this.inMemorySessions;
    }
    try {
      const data = localStorage.getItem(LOCAL_SESSIONS_STORAGE_KEY);
      const parsed = data ? JSON.parse(data) : [];
      return parsed.length > 0 ? parsed : this.inMemorySessions;
    } catch {
      return this.inMemorySessions;
    }
  }

  /**
   * Writes sessions to localStorage cache and in-memory fallback
   */
  saveLocalSessions(sessions: UserSession[]): void {
    this.inMemorySessions = sessions;
    if (typeof window === 'undefined') return;
    try {
      // Keep most recent 500 sessions in local cache to conserve space
      const trimmed = sessions.slice(0, 500);
      localStorage.setItem(LOCAL_SESSIONS_STORAGE_KEY, JSON.stringify(trimmed));
    } catch {}
  }

  /**
   * Gets the active session ID for the current browser tab/window
   */
  getActiveSessionId(): string | null {
    if (typeof window === 'undefined') {
      return this.inMemoryActiveSessionId;
    }
    try {
      return sessionStorage.getItem(ACTIVE_SESSION_STORAGE_KEY) || this.inMemoryActiveSessionId;
    } catch {
      return this.inMemoryActiveSessionId;
    }
  }

  /**
   * Directly updates a session in local storage/cache (useful for tests or realtime sync)
   */
  updateSession(sessionId: string, updates: Partial<UserSession>): UserSession | null {
    const sessions = this.getLocalSessions();
    const index = sessions.findIndex(s => s.id === sessionId);
    if (index !== -1) {
      sessions[index] = {
        ...sessions[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      this.saveLocalSessions(sessions);
      return sessions[index];
    }
    return null;
  }


  private lastHeartbeatTime: number = 0;

  /**
   * Start a new user session on login:
   * - Checks if an active session is already established for this tab/user to avoid duplicates
   * - Creates a new session ID if needed
   * - Records login timestamp in UTC
   * - Marks session as 'Active'
   * - Stores session in Supabase & local cache
   * - Updates user's last login time
   */
  async startSession(user: SessionStartOptions): Promise<UserSession> {
    if (!user || !user.id) {
      throw new Error('User info is required to start a session');
    }

    // 0. Check if this browser tab is already actively tracking a session for this user
    if (typeof window !== 'undefined') {
      const existingActiveSessionId = this.getActiveSessionId();
      if (existingActiveSessionId) {
        const sessions = this.getLocalSessions();
        const current = sessions.find(s => s.id === existingActiveSessionId && s.userId === user.id && s.status === 'Active');
        if (current) {
          // Prevent repeated session creation on ordinary component renders
          return current;
        }
      }
    }

    const sessionId = this.generateUuid();
    const nowIso = new Date().toISOString();
    const finalCompanyId = user.companyId || '00000000-0000-0000-0000-000000000001';
    const deviceInfo = this.getDeviceMetadata();

    const newSession: UserSession = {
      id: sessionId,
      userId: user.id,
      companyId: finalCompanyId,
      userName: user.name || 'ERP User',
      userEmail: user.email || 'user@example.com',
      userRole: user.role || 'Staff' as any,
      loginAt: nowIso,
      logoutAt: null,
      lastHeartbeatAt: nowIso,
      durationSeconds: 0,
      status: 'Active',
      deviceInfo,
      sessionType: 'Web',
      createdAt: nowIso,
      updatedAt: nowIso
    };

    // 1. Save in sessionStorage so current tab is tracked
    this.inMemoryActiveSessionId = sessionId;
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, sessionId);
      } catch {}
    }

    // 2. Save in local cache
    const existingSessions = this.getLocalSessions();
    this.saveLocalSessions([newSession, ...existingSessions.filter(s => s.id !== sessionId)]);

    // 3. Persist to Supabase public.user_sessions if table is available
    if (!isTableMarkedMissing('user_sessions')) {
      try {
        const { error } = await supabase
          .from('user_sessions')
          .insert({
            id: sessionId,
            user_id: user.id,
            company_id: finalCompanyId,
            login_at: nowIso,
            last_heartbeat_at: nowIso,
            duration_seconds: 0,
            status: 'Active',
            device_info: deviceInfo,
            session_type: 'Web',
            created_at: nowIso,
            updated_at: nowIso
          });
        if (error && isTableNotFoundError(error)) {
          markTableMissing('user_sessions');
        }
      } catch (err: any) {
        if (isTableNotFoundError(err)) {
          markTableMissing('user_sessions');
        } else {
          console.warn('user_sessions DB insert warning (fallback to local tracking):', err);
        }
      }
    }

    return newSession;
  }

  /**
   * Heartbeat pulse: updates last_heartbeat_at and live duration
   */
  async recordHeartbeat(sessionId?: string): Promise<void> {
    const targetSessionId = sessionId || this.getActiveSessionId();
    if (!targetSessionId) return;

    const now = Date.now();
    // Throttle heartbeats to at most once per 10 seconds to avoid unnecessary DB/storage work
    if (now - this.lastHeartbeatTime < 10000) {
      return;
    }
    this.lastHeartbeatTime = now;
    const nowIso = new Date(now).toISOString();

    // 1. Update local cache
    const sessions = this.getLocalSessions();
    const index = sessions.findIndex(s => s.id === targetSessionId);
    if (index !== -1 && sessions[index].status === 'Active') {
      const loginTime = new Date(sessions[index].loginAt).getTime();
      const durationSeconds = Math.max(0, Math.floor((now - loginTime) / 1000));
      sessions[index].lastHeartbeatAt = nowIso;
      sessions[index].durationSeconds = durationSeconds;
      sessions[index].updatedAt = nowIso;
      this.saveLocalSessions(sessions);
    }

    // 2. Update Supabase if table is available
    if (!isTableMarkedMissing('user_sessions')) {
      try {
        const { error } = await supabase
          .from('user_sessions')
          .update({
            last_heartbeat_at: nowIso,
            updated_at: nowIso
          })
          .eq('id', targetSessionId)
          .eq('status', 'Active');
        if (error && isTableNotFoundError(error)) {
          markTableMissing('user_sessions');
        }
      } catch (err: any) {
        if (isTableNotFoundError(err)) {
          markTableMissing('user_sessions');
        }
      }
    }
  }

  /**
   * End user session on explicit logout:
   * - Records logout timestamp in UTC
   * - Calculates exact session duration in seconds
   * - Marks session as 'Completed'
   * - Cleans up active session ID from sessionStorage
   */
  async endSession(sessionId?: string): Promise<void> {
    const targetSessionId = sessionId || this.getActiveSessionId();
    const now = Date.now();
    const nowIso = new Date(now).toISOString();

    if (targetSessionId) {
      // 1. Update in local cache
      const sessions = this.getLocalSessions();
      const index = sessions.findIndex(s => s.id === targetSessionId);
      if (index !== -1) {
        const loginTime = new Date(sessions[index].loginAt).getTime();
        const durationSeconds = Math.max(0, Math.floor((now - loginTime) / 1000));
        sessions[index].logoutAt = nowIso;
        sessions[index].lastHeartbeatAt = nowIso;
        sessions[index].status = 'Completed';
        sessions[index].durationSeconds = durationSeconds;
        sessions[index].updatedAt = nowIso;
        this.saveLocalSessions(sessions);
      }

      // 2. Update Supabase with race timeout to never block user logout
      if (!isTableMarkedMissing('user_sessions')) {
        try {
          const dbPromise = (async () => {
            let calculatedDuration: number | undefined;
            if (index !== -1) {
              calculatedDuration = sessions[index].durationSeconds;
            }

            const { error } = await supabase
              .from('user_sessions')
              .update({
                logout_at: nowIso,
                status: 'Completed',
                ...(calculatedDuration !== undefined ? { duration_seconds: calculatedDuration } : {}),
                updated_at: nowIso
              })
              .eq('id', targetSessionId);
            if (error && isTableNotFoundError(error)) {
              markTableMissing('user_sessions');
            }
          })();

          const timeoutPromise = new Promise(resolve => setTimeout(resolve, 1000));
          await Promise.race([dbPromise, timeoutPromise]);
        } catch (err: any) {
          if (isTableNotFoundError(err)) {
            markTableMissing('user_sessions');
          } else {
            console.warn('Session end update warning:', err);
          }
        }
      }
    }

    // Clear active session in storage
    this.inMemoryActiveSessionId = null;
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
      } catch {}
    }
  }

  /**
   * Reaps and expires stale sessions where heartbeat timed out (> 120s):
   * Unexpected closures are marked as 'Expired' rather than inventing a false logout time.
   */
  async expireStaleSessions(companyId?: string, timeoutSeconds: number = HEARTBEAT_TIMEOUT_SECONDS): Promise<number> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const now = Date.now();
    const cutoffTime = now - timeoutSeconds * 1000;
    let expiredCount = 0;

    // 1. Process local cache
    const sessions = this.getLocalSessions();
    let updatedLocal = false;

    for (const session of sessions) {
      if (session.companyId === finalCompanyId && session.status === 'Active') {
        const lastHb = new Date(session.lastHeartbeatAt).getTime();
        if (now - lastHb > timeoutSeconds * 1000) {
          session.status = 'Expired';
          const loginTime = new Date(session.loginAt).getTime();
          // Calculated duration is up to last verified heartbeat, not an invented logout time
          session.durationSeconds = Math.max(0, Math.floor((lastHb - loginTime) / 1000));
          session.updatedAt = new Date().toISOString();
          updatedLocal = true;
          expiredCount++;
        }
      }
    }

    if (updatedLocal) {
      this.saveLocalSessions(sessions);
    }

    // 2. Process Supabase public.user_sessions via RPC or direct update if available
    if (!isTableMarkedMissing('user_sessions')) {
      try {
        const cutoffIso = new Date(cutoffTime).toISOString();
        const { error } = await supabase
          .from('user_sessions')
          .update({
            status: 'Expired',
            updated_at: new Date().toISOString()
          })
          .eq('company_id', finalCompanyId)
          .eq('status', 'Active')
          .lt('last_heartbeat_at', cutoffIso);
        if (error && isTableNotFoundError(error)) {
          markTableMissing('user_sessions');
        }
      } catch (err: any) {
        if (isTableNotFoundError(err)) {
          markTableMissing('user_sessions');
        }
      }
    }

    return expiredCount;
  }

  /**
   * Formats duration in seconds into a clean human-readable representation:
   * e.g., "2h 45m 12s", "14m 20s", "35s"
   */
  formatDuration(seconds: number): string {
    if (!seconds || seconds <= 0 || isNaN(seconds)) return '0s';
    const totalSec = Math.floor(seconds);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;

    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  }

  /**
   * Formats a UTC timestamp into the configured local timezone
   */
  formatDateTime(isoStr?: string | null): string {
    if (!isoStr) return '—';
    try {
      const date = new Date(isoStr);
      if (isNaN(date.getTime())) return '—';
      return date.toLocaleDateString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return '—';
    }
  }

  /**
   * Formats time only (for current login time) in local timezone
   */
  formatTimeOnly(isoStr?: string | null): string {
    if (!isoStr) return '—';
    try {
      const date = new Date(isoStr);
      if (isNaN(date.getTime())) return '—';
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return '—';
    }
  }

  /**
   * Fetches full monitoring data for Owner:
   * - Enforces Owner-only permission
   * - Calculates user-level statistics and aggregate extreme metrics
   */
  async getUserActivityMonitoringData(
    filters: ActivityFilterOptions = {}
  ): Promise<{
    userSummaries: UserActivitySummary[];
    overviewStats: ActivityOverviewStats;
    allSessions: UserSession[];
  }> {
    // 0. Strict RBAC Permission Check: Owner ONLY
    const callerRole = await getActiveUserRole();
    if (callerRole && !canAccessUserActivity(callerRole)) {
      throw new Error('Forbidden (403): User activity monitoring is restricted to the Owner.');
    }

    const companyId = filters.companyId || '00000000-0000-0000-0000-000000000001';

    // 1. Expire stale sessions first
    await this.expireStaleSessions(companyId);

    // 2. Fetch all users in company
    const users: SystemUser[] = await userService.getUsers(companyId);

    // 3. Fetch all sessions from Supabase if table is available and merge with local cache
    let dbSessions: UserSession[] = [];
    if (!isTableMarkedMissing('user_sessions')) {
      try {
        let query = supabase
          .from('user_sessions')
          .select('*')
          .eq('company_id', companyId)
          .order('login_at', { ascending: false });

        if (filters.startDate) {
          const startIso = new Date(filters.startDate).toISOString();
          query = query.gte('login_at', startIso);
        }
        if (filters.endDate) {
          const endIso = new Date(filters.endDate).toISOString();
          query = query.lte('login_at', endIso);
        }

        const { data, error } = await query;
        if (!error && data) {
          dbSessions = data.map((d: any) => ({
            id: d.id,
            userId: d.user_id,
            companyId: d.company_id,
            loginAt: d.login_at,
            logoutAt: d.logout_at,
            lastHeartbeatAt: d.last_heartbeat_at || d.login_at,
            durationSeconds: Number(d.duration_seconds) || 0,
            status: d.status as UserSessionStatus,
            deviceInfo: d.device_info,
            ipAddress: d.ip_address,
            sessionType: d.session_type,
            createdAt: d.created_at,
            updatedAt: d.updated_at
          }));
        } else if (error && isTableNotFoundError(error)) {
          markTableMissing('user_sessions');
        }
      } catch (e: any) {
        if (isTableNotFoundError(e)) {
          markTableMissing('user_sessions');
        } else {
          console.warn('Fetch user_sessions from DB warning:', e);
        }
      }
    }

    // Merge DB sessions with local cached sessions
    const localSessions = this.getLocalSessions().filter(s => s.companyId === companyId);
    const sessionMap = new Map<string, UserSession>();

    // Add DB sessions
    dbSessions.forEach(s => sessionMap.set(s.id, s));
    // Add or override with local sessions (which may have freshest active durations)
    localSessions.forEach(s => {
      if (!sessionMap.has(s.id) || s.updatedAt! >= (sessionMap.get(s.id)?.updatedAt || '')) {
        sessionMap.set(s.id, s);
      }
    });

    const combinedSessions = Array.from(sessionMap.values()).sort(
      (a, b) => new Date(b.loginAt).getTime() - new Date(a.loginAt).getTime()
    );

    // 4. Filter sessions by date range if provided
    let filteredSessions = combinedSessions;
    if (filters.startDate) {
      const startTime = new Date(filters.startDate).getTime();
      filteredSessions = filteredSessions.filter(s => new Date(s.loginAt).getTime() >= startTime);
    }
    if (filters.endDate) {
      const endTime = new Date(filters.endDate).getTime();
      filteredSessions = filteredSessions.filter(s => new Date(s.loginAt).getTime() <= endTime);
    }

    const now = Date.now();

    // 5. Build user-level summaries
    const userSummaries: UserActivitySummary[] = users.map(user => {
      const userSessions = filteredSessions.filter(s => s.userId === user.id);
      const allUserSessions = combinedSessions.filter(s => s.userId === user.id);

      // Check active session
      const activeSession = allUserSessions.find(s => {
        if (s.status !== 'Active') return false;
        const diff = now - new Date(s.lastHeartbeatAt).getTime();
        return diff <= ONLINE_THRESHOLD_MS;
      });

      // True live status
      const isOnline = !!activeSession || presenceService.isUserOnline(user.lastSeenAt, user.presenceStatus);
      const status = isOnline ? 'Active' : 'Inactive';

      // Timestamps
      const currentLoginAt = isOnline && activeSession ? activeSession.loginAt : (isOnline ? user.lastLoginAt : null);
      const lastLoginAt = user.lastLoginAt || (allUserSessions.length > 0 ? allUserSessions[0].loginAt : null);
      const lastLogoutAt = user.lastLogoutAt || (allUserSessions.find(s => s.logoutAt)?.logoutAt || null);
      const lastActivityAt = user.lastSeenAt || (allUserSessions.length > 0 ? allUserSessions[0].lastHeartbeatAt : null);

      // Current running session duration (live)
      let currentSessionDurationSeconds = 0;
      if (isOnline && activeSession) {
        currentSessionDurationSeconds = Math.max(0, Math.floor((now - new Date(activeSession.loginAt).getTime()) / 1000));
      }

      // Completed sessions in the selected date range
      const completedSessions = userSessions.filter(s => s.status === 'Completed' && s.durationSeconds > 0);

      // Total duration for selected range (includes completed sessions + running active session)
      let totalDurationSeconds = userSessions.reduce((acc, s) => {
        if (s.status === 'Active' && activeSession && s.id === activeSession.id) {
          return acc + currentSessionDurationSeconds;
        }
        return acc + (s.durationSeconds || 0);
      }, 0);

      // Durations for calculations
      const sessionDurations = userSessions.map(s => {
        if (s.status === 'Active' && activeSession && s.id === activeSession.id) {
          return currentSessionDurationSeconds;
        }
        return s.durationSeconds || 0;
      }).filter(d => d > 0);

      const longestSessionSeconds = sessionDurations.length > 0 ? Math.max(...sessionDurations) : 0;
      
      // Shortest session from completed sessions only (or all if completed none)
      const validForShortest = completedSessions.map(s => s.durationSeconds).filter(d => d > 0);
      const shortestSessionSeconds = validForShortest.length > 0 ? Math.min(...validForShortest) : (sessionDurations.length > 0 ? Math.min(...sessionDurations) : 0);

      const avgSessionDurationSeconds = userSessions.length > 0
        ? Math.round(totalDurationSeconds / userSessions.length)
        : 0;

      return {
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status,
        currentLoginAt,
        lastLogoutAt,
        lastLoginAt,
        currentSessionDurationSeconds,
        totalDurationSeconds,
        avgSessionDurationSeconds,
        longestSessionSeconds,
        shortestSessionSeconds,
        lastActivityAt,
        sessionCount: userSessions.length,
        activeSessionId: activeSession ? activeSession.id : null
      };
    });

    // 6. Calculate Overview Statistics for Owner
    const activeUsersCount = userSummaries.filter(u => u.status === 'Active').length;
    const inactiveUsersCount = userSummaries.length - activeUsersCount;

    // Total sessions today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todaySessions = combinedSessions.filter(s => new Date(s.loginAt).getTime() >= todayStart.getTime());
    const totalSessionsToday = todaySessions.length;

    // Overall average session duration
    const allValidDurations = filteredSessions.map(s => s.durationSeconds).filter(d => d > 0);
    const totalAllDuration = allValidDurations.reduce((a, b) => a + b, 0);
    const avgSessionDurationSeconds = allValidDurations.length > 0
      ? Math.round(totalAllDuration / allValidDurations.length)
      : 0;

    // Extreme individual session performers
    let longestIndividualSessionUser: ActivityOverviewStats['longestIndividualSessionUser'] = null;
    let shortestCompletedSessionUser: ActivityOverviewStats['shortestCompletedSessionUser'] = null;

    let maxSingleDuration = 0;
    let minCompletedDuration = Infinity;

    filteredSessions.forEach(session => {
      const user = users.find(u => u.id === session.userId);
      const duration = session.durationSeconds;
      if (duration > maxSingleDuration) {
        maxSingleDuration = duration;
        longestIndividualSessionUser = {
          userId: session.userId,
          name: user?.name || session.userName || 'ERP User',
          role: user?.role || session.userRole || ('Staff' as any),
          durationSeconds: duration,
          sessionDate: session.loginAt
        };
      }

      if (session.status === 'Completed' && duration > 0 && duration < minCompletedDuration) {
        minCompletedDuration = duration;
        shortestCompletedSessionUser = {
          userId: session.userId,
          name: user?.name || session.userName || 'ERP User',
          role: user?.role || session.userRole || ('Staff' as any),
          durationSeconds: duration,
          sessionDate: session.loginAt
        };
      }
    });

    // Extreme total duration performers
    let highestTotalDurationUser: ActivityOverviewStats['highestTotalDurationUser'] = null;
    let lowestTotalDurationUser: ActivityOverviewStats['lowestTotalDurationUser'] = null;

    const usersWithSessions = userSummaries.filter(u => u.sessionCount > 0);
    if (usersWithSessions.length > 0) {
      const sortedByTotal = [...usersWithSessions].sort((a, b) => b.totalDurationSeconds - a.totalDurationSeconds);
      const highest = sortedByTotal[0];
      if (highest && highest.totalDurationSeconds > 0) {
        highestTotalDurationUser = {
          userId: highest.userId,
          name: highest.name,
          role: highest.role,
          durationSeconds: highest.totalDurationSeconds
        };
      }

      // For lowest, pick from users with sessions > 0
      const lowest = sortedByTotal[sortedByTotal.length - 1];
      if (lowest) {
        lowestTotalDurationUser = {
          userId: lowest.userId,
          name: lowest.name,
          role: lowest.role,
          durationSeconds: lowest.totalDurationSeconds
        };
      }
    }

    const overviewStats: ActivityOverviewStats = {
      longestIndividualSessionUser,
      shortestCompletedSessionUser,
      highestTotalDurationUser,
      lowestTotalDurationUser,
      activeUsersCount,
      inactiveUsersCount,
      totalSessionsToday,
      avgSessionDurationSeconds
    };

    return {
      userSummaries,
      overviewStats,
      allSessions: filteredSessions
    };
  }

  /**
   * Fetches the detailed session history for a specific user
   */
  async getUserSessionHistory(
    userId: string,
    companyId?: string,
    dateRange?: { start?: Date; end?: Date }
  ): Promise<UserSession[]> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const monitoringData = await this.getUserActivityMonitoringData({
      companyId: finalCompanyId,
      startDate: dateRange?.start,
      endDate: dateRange?.end
    });

    return monitoringData.allSessions.filter(s => s.userId === userId);
  }
}

export const userActivityService = new UserActivityService();
