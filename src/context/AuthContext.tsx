import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { authService, UserProfile } from '../services/authService';
import { presenceService } from '../services/presenceService';
import { inactivityService } from '../services/inactivityService';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  companyId: string;
  loading: boolean;
  inactivityWarningActive: boolean;
  inactivitySecondsRemaining: number;
  resetInactivityTimer: () => void;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string; role?: string }>;
  signUp: (email: string, password: string, fullName: string, companyName?: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  requestPasswordResetOtp: (email: string) => Promise<{ success: boolean; message?: string; error?: string; devOtp?: string; expiresInSeconds?: number }>;
  verifyPasswordResetOtp: (email: string, otp: string) => Promise<{ success: boolean; resetToken?: string; error?: string; remainingAttempts?: number }>;
  completePasswordReset: (params: { email: string; resetToken: string; newPassword: string }) => Promise<{ success: boolean; message?: string; error?: string }>;
  getActiveOtpState: (email?: string) => any;
  updateAccountSecurity: (params: {
    currentPassword: string;
    newEmail?: string;
    newPassword?: string;
  }) => Promise<{
    success: boolean;
    requiresEmailConfirmation?: boolean;
    updatedEmail?: string;
    message?: string;
    error?: string;
  }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [inactivityWarningActive, setInactivityWarningActive] = useState<boolean>(false);
  const [inactivitySecondsRemaining, setInactivitySecondsRemaining] = useState<number>(0);
  const profileLoadReqIdRef = useRef<number>(0);

  const defaultCompanyId = '00000000-0000-0000-0000-000000000001';
  const companyId = profile?.company_id || (user ? defaultCompanyId : '');

  const loadProfile = async (userId: string): Promise<UserProfile | null> => {
    const reqId = ++profileLoadReqIdRef.current;
    try {
      const userProfile = await authService.getCurrentUserProfile(userId);
      if (reqId === profileLoadReqIdRef.current) {
        setProfile(userProfile);
      }
      return userProfile;
    } catch (err) {
      console.error('Error loading profile:', err);
      return null;
    } finally {
      if (reqId === profileLoadReqIdRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    let isSubscribed = true;

    // Check existing session once on initial mount
    const checkInitialAuth = async () => {
      try {
        const initialSession = await authService.getSession();
        if (!isSubscribed) return;

        if (initialSession?.user) {
          setSession(initialSession);
          setUser(initialSession.user);
          const prof = await loadProfile(initialSession.user.id);
          if (isSubscribed && prof) {
            presenceService.startHeartbeat({
              id: initialSession.user.id,
              email: initialSession.user.email || '',
              name: prof.full_name || initialSession.user.user_metadata?.full_name,
              companyId: prof.company_id || defaultCompanyId
            });
          }
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.warn('Auth initialization note:', err);
        if (isSubscribed) setLoading(false);
      }
    };

    checkInitialAuth();

    // Listen to live auth changes (e.g. sign in, sign out, token refresh)
    const { data: { subscription } } = authService.onAuthStateChange(async (event, currentSession) => {
      if (!isSubscribed) return;

      if (event === 'SIGNED_OUT') {
        profileLoadReqIdRef.current++;
        presenceService.stopHeartbeat();
        setUser(null);
        setSession(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (currentSession?.user) {
        setSession(currentSession);
        setUser(currentSession.user);
        const prof = await loadProfile(currentSession.user.id);
        if (isSubscribed && prof) {
          presenceService.startHeartbeat({
            id: currentSession.user.id,
            email: currentSession.user.email || '',
            name: prof.full_name || currentSession.user.user_metadata?.full_name,
            companyId: prof.company_id || defaultCompanyId
          });
        }
      } else if (event !== 'INITIAL_SESSION') {
        profileLoadReqIdRef.current++;
        presenceService.stopHeartbeat();
        setUser(null);
        setSession(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      isSubscribed = false;
      presenceService.stopHeartbeat();
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    // Invalidate any old profile / session state immediately
    profileLoadReqIdRef.current++;
    setUser(null);
    setSession(null);
    setProfile(null);

    const { data, error } = await authService.signIn(email, password);
    if (error) {
      setLoading(false);
      return { success: false, error: error.message };
    }

    let userRole = data?.user?.user_metadata?.role;
    if (data?.user) {
      setUser(data.user);
      setSession(data.session);
      const prof = await loadProfile(data.user.id);
      if (prof?.role) userRole = prof.role;

      // Automatically update user's presence to Active, set timestamps, audit log & start heartbeat
      await presenceService.recordLogin({
        id: data.user.id,
        email: data.user.email || email,
        name: prof?.full_name || data.user.user_metadata?.full_name,
        companyId: prof?.company_id || defaultCompanyId
      });
    }
    setLoading(false);
    return { success: true, role: userRole };
  };

  const signUp = async (email: string, password: string, fullName: string, companyName?: string) => {
    setLoading(true);
    const { error } = await authService.signUp(email, password, fullName, companyName);
    setLoading(false);
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  };

  const resetInactivityTimer = () => {
    inactivityService.recordActivity();
    setInactivityWarningActive(false);
  };

  useEffect(() => {
    if (!user) {
      inactivityService.stopTracking();
      setInactivityWarningActive(false);
      return;
    }

    inactivityService.startTracking({
      onWarning: (remainingSeconds) => {
        setInactivityWarningActive(true);
        setInactivitySecondsRemaining(remainingSeconds);
      },
      onWarningDismiss: () => {
        setInactivityWarningActive(false);
      },
      onTimeout: async () => {
        setInactivityWarningActive(false);
        try {
          await signOut();
        } catch (e) {
          console.warn('Signout on inactivity error:', e);
        }
        if (typeof window !== 'undefined') {
          window.location.replace('/login?reason=inactivity');
        }
      }
    });

    return () => {
      inactivityService.stopTracking();
    };
  }, [user?.id]);

  const signOut = async () => {
    setLoading(true);
    inactivityService.stopTracking();
    setInactivityWarningActive(false);

    // 1. Invalidate any in-flight profile requests immediately
    profileLoadReqIdRef.current++;

    // 2. Explicit logout: Mark presence Inactive and record audit log before completing signout
    if (user) {
      try {
        await presenceService.recordLogout({
          id: user.id,
          email: user.email || '',
          name: profile?.full_name,
          companyId: profile?.company_id || companyId
        });
      } catch (err) {
        console.warn('Presence recordLogout error:', err);
      }
    }

    // 3. Clear auth service tokens & user-specific localStorage items
    await authService.signOut();

    // 4. Clear in-memory auth state
    setUser(null);
    setSession(null);
    setProfile(null);
    setLoading(false);
  };

  const resetPassword = async (email: string) => {
    const res = await authService.requestPasswordResetOtp(email);
    if (!res.success) {
      return { success: false, error: res.error };
    }
    return { success: true };
  };

  const requestPasswordResetOtp = async (email: string) => {
    return authService.requestPasswordResetOtp(email);
  };

  const verifyPasswordResetOtp = async (email: string, otp: string) => {
    return authService.verifyPasswordResetOtp(email, otp);
  };

  const completePasswordReset = async (params: { email: string; resetToken: string; newPassword: string }) => {
    return authService.completePasswordReset(params);
  };

  const getActiveOtpState = (email?: string) => {
    return authService.getActiveOtpState(email);
  };

  const updateAccountSecurity = async (params: {
    currentPassword: string;
    newEmail?: string;
    newPassword?: string;
  }) => {
    setLoading(true);
    const res = await authService.updateAccountSecurity(params);
    if (res.success && res.updatedEmail && !res.requiresEmailConfirmation) {
      setUser(prev => (prev ? { ...prev, email: res.updatedEmail! } : prev));
      setProfile(prev => (prev ? { ...prev, email: res.updatedEmail! } : prev));
    }
    const currentUid = user?.id || (await authService.getSession())?.user?.id;
    if (currentUid) {
      await loadProfile(currentUid);
    }
    setLoading(false);
    return res;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        companyId,
        loading,
        inactivityWarningActive,
        inactivitySecondsRemaining,
        resetInactivityTimer,
        signIn,
        signUp,
        signOut,
        resetPassword,
        requestPasswordResetOtp,
        verifyPasswordResetOtp,
        completePasswordReset,
        getActiveOtpState,
        updateAccountSecurity
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
