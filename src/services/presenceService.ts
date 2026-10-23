import { supabase } from '../lib/supabase';
import { auditService } from './auditService';
import { PresenceStatus, AccountStatus } from '../types';
import { filterSupportedProfilePayload } from '../utils/schemaDetector';
import { userActivityService } from './userActivityService';

export const ONLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes cutoff for online presence
export const HEARTBEAT_INTERVAL_MS = 60 * 1000; // 60 seconds heartbeat pulse
export const PRESENCE_CACHE_KEY = 'erp_presence_state_cache';

export interface PresenceUserInfo {
  id: string;
  email?: string;
  name?: string;
  companyId?: string;
}

class PresenceManager {
  private heartbeatTimer: any = null;
  private currentActiveUser: PresenceUserInfo | null = null;
  private presenceChannel: any = null;
  private lastActivityReported: number = 0;
  private userActivityListener: (() => void) | null = null;
  private beforeUnloadListener: (() => void) | null = null;

  /**
   * Determine whether a user is genuinely online based on recent heartbeat and explicit presence
   */
  isUserOnline(lastSeenAt?: string | null, presenceStatus?: PresenceStatus | string | null): boolean {
    if (!lastSeenAt) return false;
    if (presenceStatus === 'Inactive') return false;

    try {
      const lastSeenTime = new Date(lastSeenAt).getTime();
      if (isNaN(lastSeenTime)) return false;
      const diff = Date.now() - lastSeenTime;
      // Must have had activity within the threshold (2 minutes)
      return diff >= 0 && diff <= ONLINE_THRESHOLD_MS;
    } catch {
      return false;
    }
  }

  /**
   * Formats a last-seen or last-login timestamp into a user-friendly string
   */
  formatActivityTime(dateStr?: string | null): string {
    if (!dateStr) return 'Never';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Never';

      const diffMs = Date.now() - date.getTime();
      if (diffMs < 0) return 'Just now';

      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 45) return 'Just now';
      if (diffSec < 90) return '1 min ago';

      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin} mins ago`;

      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;

      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Never';
    }
  }

  /**
   * Record a successful login event:
   * - Sets presence to 'Active'
   * - Saves last_login_at, last_seen_at, and last_activity_at (UTC)
   * - Records event in audit_logs
   * - Starts the client heartbeat and interaction listeners
   */
  async recordLogin(user: PresenceUserInfo): Promise<void> {
    if (!user || !user.id) return;
    this.currentActiveUser = user;
    const nowIso = new Date().toISOString();
    const finalCompanyId = user.companyId || '00000000-0000-0000-0000-000000000001';

    // 1. Update public.profiles in Supabase with safe schema filtering
    try {
      const safePayload = await filterSupportedProfilePayload({
        presence_status: 'Active',
        last_login_at: nowIso,
        last_seen_at: nowIso,
        last_activity_at: nowIso,
        last_login: nowIso,
        status: 'Active',
        updated_at: nowIso
      });

      if (Object.keys(safePayload).length > 0) {
        await supabase
          .from('profiles')
          .update(safePayload)
          .eq('id', user.id);
      }
    } catch (dbErr) {
      console.warn('Presence recordLogin DB sync warning:', dbErr);
    }

    // 2. Cache presence locally for fast synchronous UI rendering
    this.saveLocalPresenceCache(user.id, {
      presenceStatus: 'Active',
      lastSeenAt: nowIso,
      lastLoginAt: nowIso
    });

    // 3. Record Login event in the Audit Log
    try {
      await auditService.logAction(
        'User Login',
        'Authentication',
        user.email || 'ERP Staff',
        'Presence: Inactive',
        'Presence: Active',
        finalCompanyId
      );
    } catch (auditErr) {
      console.warn('Audit log write error on login:', auditErr);
    }

    // 4. Initialize and broadcast presence through Realtime channel
    this.joinRealtimePresence(user);

    // 5. Track individual user session in userActivityService
    try {
      await userActivityService.startSession({
        id: user.id,
        email: user.email,
        name: user.name,
        companyId: finalCompanyId
      });
    } catch (sessionErr) {
      console.warn('Session tracking start warning:', sessionErr);
    }

    // 6. Start ongoing heartbeat timer
    this.startHeartbeat(user);
  }


  /**
   * Record explicit user logout:
   * - Sets presence to 'Inactive'
   * - Saves last_logout_at
   * - Records event in audit_logs
   * - Ensures logout completes safely within a 1.5s timeout even if offline
   */
  async recordLogout(user?: PresenceUserInfo | null): Promise<void> {
    const targetUser = user || this.currentActiveUser;
    this.stopHeartbeat();

    if (!targetUser || !targetUser.id) return;
    const nowIso = new Date().toISOString();
    const finalCompanyId = targetUser.companyId || '00000000-0000-0000-0000-000000000001';

    // Cache locally
    this.saveLocalPresenceCache(targetUser.id, {
      presenceStatus: 'Inactive',
      lastLogoutAt: nowIso
    });

    // Untrack from Realtime channel
    if (this.presenceChannel) {
      try {
        await this.presenceChannel.untrack();
      } catch {}
    }

    // Update database with 1500ms timeout race to ensure user is never blocked
    const dbUpdatePromise = (async () => {
      try {
        const safePayload = await filterSupportedProfilePayload({
          presence_status: 'Inactive',
          last_logout_at: nowIso,
          updated_at: nowIso
        });

        if (Object.keys(safePayload).length > 0) {
          await supabase
            .from('profiles')
            .update(safePayload)
            .eq('id', targetUser.id);
        }
      } catch (err) {
        console.warn('Presence recordLogout update warning:', err);
      }

      // Record Logout in Audit Log
      try {
        await auditService.logAction(
          'User Logout',
          'Authentication',
          targetUser.email || 'ERP Staff',
          'Presence: Active',
          'Presence: Inactive',
          finalCompanyId
        );
      } catch {}

      // End session in userActivityService
      try {
        await userActivityService.endSession();
      } catch {}
    })();

    const timeoutPromise = new Promise(resolve => setTimeout(resolve, 1500));
    await Promise.race([dbUpdatePromise, timeoutPromise]);
    this.currentActiveUser = null;
  }

  /**
   * Periodic Heartbeat: Updates last_seen_at and last_activity_at
   */
  async sendHeartbeat(user?: PresenceUserInfo): Promise<void> {
    const target = user || this.currentActiveUser;
    if (!target || !target.id) return;

    const nowIso = new Date().toISOString();
    this.lastActivityReported = Date.now();

    // Update local cache
    this.saveLocalPresenceCache(target.id, {
      presenceStatus: 'Active',
      lastSeenAt: nowIso
    });

    // Update session duration & heartbeat in userActivityService
    userActivityService.recordHeartbeat().catch(() => {});

    // Update Supabase profiles only if presence/activity columns are supported
    try {
      const safePayload = await filterSupportedProfilePayload({
        presence_status: 'Active',
        last_seen_at: nowIso,
        last_activity_at: nowIso
      });

      if (Object.keys(safePayload).length > 0) {
        await supabase
          .from('profiles')
          .update(safePayload)
          .eq('id', target.id);
      }
    } catch {}

    // Broadcast through Realtime
    if (this.presenceChannel) {
      try {
        await this.presenceChannel.track({
          user_id: target.id,
          email: target.email,
          online_at: nowIso
        });
      } catch {}
    }
  }

  /**
   * Start recurring heartbeat timer and user interaction listeners
   */
  startHeartbeat(user: PresenceUserInfo): void {
    if (!user || !user.id) return;
    this.currentActiveUser = user;
    this.stopHeartbeat();

    // 1. Initial heartbeat pulse
    this.sendHeartbeat(user);

    // 2. Scheduled 60-second recurring heartbeat
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat(user);
    }, HEARTBEAT_INTERVAL_MS);

    // 3. User interaction listener throttled to 30s
    if (typeof window !== 'undefined') {
      const onUserInteraction = () => {
        const now = Date.now();
        if (now - this.lastActivityReported > 30 * 1000) {
          this.sendHeartbeat(user);
        }
      };

      this.userActivityListener = onUserInteraction;
      window.addEventListener('click', onUserInteraction, { passive: true });
      window.addEventListener('keydown', onUserInteraction, { passive: true });

      // 4. Beforeunload best-effort beacon/cleanup
      this.beforeUnloadListener = () => {
        this.saveLocalPresenceCache(user.id, {
          presenceStatus: 'Inactive',
          lastLogoutAt: new Date().toISOString()
        });
        userActivityService.recordHeartbeat().catch(() => {});
      };
      window.addEventListener('beforeunload', this.beforeUnloadListener);
    }
  }


  /**
   * Stop heartbeat timer and detach listeners
   */
  stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (typeof window !== 'undefined') {
      if (this.userActivityListener) {
        window.removeEventListener('click', this.userActivityListener);
        window.removeEventListener('keydown', this.userActivityListener);
        this.userActivityListener = null;
      }
      if (this.beforeUnloadListener) {
        window.removeEventListener('beforeunload', this.beforeUnloadListener);
        this.beforeUnloadListener = null;
      }
    }
  }

  /**
   * Connect to Supabase Realtime Presence Channel for multi-tab and multi-device presence
   */
  private joinRealtimePresence(user: PresenceUserInfo): void {
    if (!user || !user.id) return;
    const companyId = user.companyId || '00000000-0000-0000-0000-000000000001';
    const channelName = `presence-company-${companyId}`;

    try {
      if (this.presenceChannel) {
        supabase.removeChannel(this.presenceChannel);
      }

      this.presenceChannel = supabase.channel(channelName, {
        config: { presence: { key: user.id } }
      });

      this.presenceChannel
        .subscribe(async (status: string) => {
          if (status === 'SUBSCRIBED') {
            await this.presenceChannel.track({
              user_id: user.id,
              email: user.email,
              name: user.name,
              online_at: new Date().toISOString()
            });
          }
        });
    } catch (e) {
      console.warn('Realtime presence connection error:', e);
    }
  }

  /**
   * Subscribe to company presence changes in real-time
   */
  subscribeToPresenceUpdates(companyId: string, onUpdate: () => void): () => void {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';
    const channelName = `presence-company-${finalCompanyId}`;

    try {
      const channel = supabase.channel(`listener-${channelName}`);
      channel
        .on('presence', { event: 'sync' }, () => {
          onUpdate();
        })
        .on('presence', { event: 'join' }, () => {
          onUpdate();
        })
        .on('presence', { event: 'leave' }, () => {
          onUpdate();
        })
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'profiles', filter: `company_id=eq.${finalCompanyId}` },
          () => {
            onUpdate();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch {
      return () => {};
    }
  }

  /**
   * Local presence cache for instantaneous UI consistency
   */
  private saveLocalPresenceCache(userId: string, data: Partial<{ presenceStatus: PresenceStatus; lastSeenAt: string; lastLoginAt: string; lastLogoutAt: string }>): void {
    if (typeof window === 'undefined') return;
    try {
      const existing = JSON.parse(localStorage.getItem(PRESENCE_CACHE_KEY) || '{}');
      existing[userId] = {
        ...(existing[userId] || {}),
        ...data,
        cachedAt: Date.now()
      };
      localStorage.setItem(PRESENCE_CACHE_KEY, JSON.stringify(existing));
    } catch {}
  }

  getLocalPresenceCache(userId: string): any {
    if (typeof window === 'undefined') return null;
    try {
      const existing = JSON.parse(localStorage.getItem(PRESENCE_CACHE_KEY) || '{}');
      return existing[userId] || null;
    } catch {
      return null;
    }
  }
}

export const presenceService = new PresenceManager();
