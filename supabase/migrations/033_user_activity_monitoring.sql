-- Migration 033: User Activity Monitoring & Login Time Tracking System
-- Dedicated table, indexes, RLS policies, and RPCs for tracking user sessions,
-- login/logout durations, heartbeats, and unexpected session terminations.

-- 1. Create public.user_sessions table
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  session_token VARCHAR(255),
  login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  logout_at TIMESTAMPTZ,
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_seconds INTEGER DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'Active', -- 'Active', 'Completed', 'Expired'
  device_info TEXT,
  ip_address TEXT,
  session_type VARCHAR(30) DEFAULT 'Web',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Performance indexes for lightning-fast queries and Owner-only analytics
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_company_id ON public.user_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_status ON public.user_sessions(status);
CREATE INDEX IF NOT EXISTS idx_user_sessions_login_at ON public.user_sessions(login_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_logout_at ON public.user_sessions(logout_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_heartbeat ON public.user_sessions(last_heartbeat_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_login ON public.user_sessions(user_id, login_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_company_login ON public.user_sessions(company_id, login_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- 4. Secure RLS Policies:
-- Owner ONLY can read all company sessions
CREATE POLICY "Owner read company user_sessions"
  ON public.user_sessions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.company_id = public.user_sessions.company_id
        AND p.role = 'Owner'
    )
  );

-- Users can insert their own session on login
CREATE POLICY "Users insert own user_sessions"
  ON public.user_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
  );

-- Users can update their own session (heartbeat, duration, logout)
CREATE POLICY "Users update own user_sessions"
  ON public.user_sessions
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
  );

-- Only Owner can delete sessions (e.g. system maintenance)
CREATE POLICY "Owner delete user_sessions"
  ON public.user_sessions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.company_id = public.user_sessions.company_id
        AND p.role = 'Owner'
    )
  );

-- 5. Helper RPC to start a new user session
CREATE OR REPLACE FUNCTION public.start_user_session(
  p_company_id UUID,
  p_device_info TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_session_token VARCHAR DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_uid UUID;
  v_session_id UUID;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Create new session record
  INSERT INTO public.user_sessions (
    user_id,
    company_id,
    session_token,
    login_at,
    last_heartbeat_at,
    duration_seconds,
    status,
    device_info,
    ip_address
  ) VALUES (
    v_uid,
    p_company_id,
    p_session_token,
    v_now,
    v_now,
    0,
    'Active',
    p_device_info,
    p_ip_address
  )
  RETURNING id INTO v_session_id;

  -- Update profiles table timestamps
  UPDATE public.profiles
  SET
    presence_status = 'Active',
    last_login_at = v_now,
    last_seen_at = v_now,
    last_activity_at = v_now,
    updated_at = v_now
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'login_at', v_now
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Helper RPC to record session heartbeat and detect stale status
CREATE OR REPLACE FUNCTION public.record_session_heartbeat(
  p_session_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_uid UUID;
  v_now TIMESTAMPTZ := NOW();
  v_login_at TIMESTAMPTZ;
  v_duration INT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Update user session
  UPDATE public.user_sessions
  SET
    last_heartbeat_at = v_now,
    duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (v_now - login_at))::INT),
    updated_at = v_now
  WHERE id = p_session_id AND user_id = v_uid AND status = 'Active'
  RETURNING login_at INTO v_login_at;

  -- Also refresh profiles presence
  UPDATE public.profiles
  SET
    presence_status = 'Active',
    last_seen_at = v_now,
    last_activity_at = v_now,
    updated_at = v_now
  WHERE id = v_uid;

  RETURN jsonb_build_object('success', true, 'heartbeat_at', v_now);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Helper RPC to close a session on explicit logout
CREATE OR REPLACE FUNCTION public.close_user_session(
  p_session_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_uid UUID;
  v_now TIMESTAMPTZ := NOW();
  v_duration INT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Close session
  UPDATE public.user_sessions
  SET
    logout_at = v_now,
    status = 'Completed',
    duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (v_now - login_at))::INT),
    updated_at = v_now
  WHERE id = p_session_id AND user_id = v_uid;

  -- Update profiles presence
  UPDATE public.profiles
  SET
    presence_status = 'Inactive',
    last_logout_at = v_now,
    updated_at = v_now
  WHERE id = v_uid;

  RETURN jsonb_build_object('success', true, 'logout_at', v_now);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Background reaper function: automatically marks inactive sessions where heartbeat timed out (> 120s)
CREATE OR REPLACE FUNCTION public.expire_stale_sessions(
  p_company_id UUID,
  p_timeout_seconds INT DEFAULT 120
)
RETURNS JSONB AS $$
DECLARE
  v_count INT;
  v_cutoff TIMESTAMPTZ;
BEGIN
  v_cutoff := NOW() - (p_timeout_seconds || ' seconds')::INTERVAL;

  UPDATE public.user_sessions
  SET
    status = 'Expired',
    duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (last_heartbeat_at - login_at))::INT),
    updated_at = NOW()
  WHERE company_id = p_company_id
    AND status = 'Active'
    AND last_heartbeat_at < v_cutoff;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'expired_sessions_count', v_count);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
