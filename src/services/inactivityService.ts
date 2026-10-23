/**
 * Inactivity Service
 * 
 * Tracks meaningful user interactions (mouse, keyboard, touch, scroll) and enforces
 * an automatic logout after exactly 30 minutes of consecutive inactivity.
 * 
 * - Inactivity timeout: exactly 30 minutes (1,800,000 ms)
 * - Warning dialog threshold: 2 minutes before timeout (120,000 ms)
 * - Tab-scoped timestamp stored in sessionStorage ('erp_last_activity_timestamp')
 * - Preserves inactivity tracking across page refreshes in the same tab
 * - Safely handles tab visibility changes (e.g. backgrounded or restored tabs)
 * - Background network heartbeats and token refreshes do NOT reset this timer
 */

export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // Exactly 30 minutes (1,800,000 ms)
export const INACTIVITY_WARNING_MS = 2 * 60 * 1000;  // 2 minutes warning (120,000 ms)
export const INACTIVITY_STORAGE_KEY = 'erp_last_activity_timestamp';

export type InactivityWarningCallback = (remainingSeconds: number) => void;
export type InactivityTimeoutCallback = () => void;

class InactivityManager {
  private lastActivity: number = Date.now();
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private isWarningActive: boolean = false;
  private onWarningCallback: InactivityWarningCallback | null = null;
  private onWarningDismissCallback: (() => void) | null = null;
  private onTimeoutCallback: InactivityTimeoutCallback | null = null;
  private isThrottled: boolean = false;
  private isTracking: boolean = false;
  private timeoutDuration: number = INACTIVITY_TIMEOUT_MS;
  private warningDuration: number = INACTIVITY_WARNING_MS;

  private boundHandleActivity: (() => void) | null = null;
  private boundHandleVisibilityChange: (() => void) | null = null;

  constructor() {
    this.restoreLastActivity();
  }

  /**
   * Restores last recorded activity timestamp from tab-scoped sessionStorage,
   * preserving inactivity status across page refreshes in the same tab.
   */
  private restoreLastActivity(): void {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const stored = window.sessionStorage.getItem(INACTIVITY_STORAGE_KEY);
        if (stored) {
          const parsed = Number(stored);
          if (!isNaN(parsed) && parsed > 0) {
            this.lastActivity = parsed;
            return;
          }
        }
      } catch {}
    }
    this.lastActivity = Date.now();
  }

  /**
   * Records meaningful user activity and synchronizes to sessionStorage.
   * Resets any active timeout warning modal.
   */
  public recordActivity(): void {
    this.lastActivity = Date.now();
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.setItem(INACTIVITY_STORAGE_KEY, String(this.lastActivity));
      } catch {}
    }

    if (this.isWarningActive) {
      this.isWarningActive = false;
      if (this.onWarningDismissCallback) {
        this.onWarningDismissCallback();
      }
    }
  }

  /**
   * Retrieves the most recent activity timestamp from memory or sessionStorage.
   */
  public getLastActivity(): number {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const stored = window.sessionStorage.getItem(INACTIVITY_STORAGE_KEY);
        if (stored) {
          const parsed = Number(stored);
          if (!isNaN(parsed) && parsed > 0) {
            this.lastActivity = parsed;
          }
        }
      } catch {}
    }
    return this.lastActivity;
  }

  /**
   * Starts tracking user interactions and starts the 1-second pulse timer.
   */
  public startTracking(options: {
    onWarning: InactivityWarningCallback;
    onWarningDismiss: () => void;
    onTimeout: InactivityTimeoutCallback;
    timeoutMs?: number;
    warningMs?: number;
  }): void {
    if (this.isTracking) {
      this.stopTracking();
    }

    this.timeoutDuration = options.timeoutMs ?? INACTIVITY_TIMEOUT_MS;
    this.warningDuration = options.warningMs ?? INACTIVITY_WARNING_MS;
    this.onWarningCallback = options.onWarning;
    this.onWarningDismissCallback = options.onWarningDismiss;
    this.onTimeoutCallback = options.onTimeout;
    this.isTracking = true;

    // Check if session has already expired before starting (e.g. refreshed after 35 mins of inactivity)
    const storedTime = this.getLastActivity();
    const initialElapsed = Date.now() - storedTime;
    if (initialElapsed >= this.timeoutDuration) {
      options.onTimeout();
      return;
    }

    // Throttled DOM event listener for meaningful user actions
    this.boundHandleActivity = () => {
      if (this.isThrottled) return;
      this.isThrottled = true;
      this.recordActivity();
      setTimeout(() => {
        this.isThrottled = false;
      }, 1000); // 1-second throttle
    };

    if (typeof window !== 'undefined') {
      // Meaningful user input events
      window.addEventListener('mousemove', this.boundHandleActivity, { passive: true });
      window.addEventListener('mousedown', this.boundHandleActivity, { passive: true });
      window.addEventListener('click', this.boundHandleActivity, { passive: true });
      window.addEventListener('keydown', this.boundHandleActivity, { passive: true });
      window.addEventListener('touchstart', this.boundHandleActivity, { passive: true });
      window.addEventListener('scroll', this.boundHandleActivity, { passive: true });
      window.addEventListener('wheel', this.boundHandleActivity, { passive: true });

      // Tab visibility change: immediately verify elapsed inactivity when returning to tab
      this.boundHandleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          const currentElapsed = Date.now() - this.getLastActivity();
          if (currentElapsed >= this.timeoutDuration) {
            if (this.onTimeoutCallback) {
              this.onTimeoutCallback();
            }
          }
        }
      };
      document.addEventListener('visibilitychange', this.boundHandleVisibilityChange);
    }

    // 1-second heartbeat pulse verifying inactivity duration
    this.checkInterval = setInterval(() => {
      const elapsed = Date.now() - this.getLastActivity();

      if (elapsed >= this.timeoutDuration) {
        this.isWarningActive = false;
        if (this.checkInterval) {
          clearInterval(this.checkInterval);
          this.checkInterval = null;
        }
        if (this.onTimeoutCallback) {
          this.onTimeoutCallback();
        }
      } else if (elapsed >= this.timeoutDuration - this.warningDuration) {
        this.isWarningActive = true;
        const remainingSeconds = Math.max(0, Math.ceil((this.timeoutDuration - elapsed) / 1000));
        if (this.onWarningCallback) {
          this.onWarningCallback(remainingSeconds);
        }
      } else if (this.isWarningActive) {
        this.isWarningActive = false;
        if (this.onWarningDismissCallback) {
          this.onWarningDismissCallback();
        }
      }
    }, 1000);
  }

  /**
   * Halts tracking and cleanly tears down DOM listeners, timers, and storage entries.
   */
  public stopTracking(): void {
    this.isTracking = false;
    this.isWarningActive = false;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    if (typeof window !== 'undefined') {
      if (this.boundHandleActivity) {
        window.removeEventListener('mousemove', this.boundHandleActivity);
        window.removeEventListener('mousedown', this.boundHandleActivity);
        window.removeEventListener('click', this.boundHandleActivity);
        window.removeEventListener('keydown', this.boundHandleActivity);
        window.removeEventListener('touchstart', this.boundHandleActivity);
        window.removeEventListener('scroll', this.boundHandleActivity);
        window.removeEventListener('wheel', this.boundHandleActivity);
        this.boundHandleActivity = null;
      }
      if (this.boundHandleVisibilityChange) {
        document.removeEventListener('visibilitychange', this.boundHandleVisibilityChange);
        this.boundHandleVisibilityChange = null;
      }
      try {
        window.sessionStorage.removeItem(INACTIVITY_STORAGE_KEY);
      } catch {}
    }

    this.onWarningCallback = null;
    this.onWarningDismissCallback = null;
    this.onTimeoutCallback = null;
  }
}

export const inactivityService = new InactivityManager();
