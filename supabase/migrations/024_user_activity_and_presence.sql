-- Migration 024: User Activity, Presence Tracking & Account Status Separation
-- Universal Billing: Automatic Online/Offline Presence & Account Status (Enabled/Disabled)

-- 1. Add presence and activity tracking columns to public.profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) DEFAULT 'Enabled',
  ADD COLUMN IF NOT EXISTS presence_status VARCHAR(20) DEFAULT 'Inactive',
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_logout_at TIMESTAMPTZ;

-- 2. Backfill existing profiles to valid defaults
UPDATE public.profiles
SET
  account_status = CASE
    WHEN status = 'Inactive' OR status = 'Disabled' THEN 'Disabled'
    ELSE 'Enabled'
  END,
  presence_status = 'Inactive',
  last_login_at = COALESCE(last_login_at, last_login),
  last_seen_at = COALESCE(last_seen_at, last_login)
WHERE account_status IS NULL OR presence_status IS NULL;

-- 3. Helpful indexes for real-time presence and security filters
CREATE INDEX IF NOT EXISTS idx_profiles_presence ON public.profiles(presence_status, last_seen_at);
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON public.profiles(account_status);
CREATE INDEX IF NOT EXISTS idx_profiles_company_presence ON public.profiles(company_id, presence_status);

-- 4. Secure Presence Heartbeat RPC
-- Updates authenticated user's presence without allowing modifying other users
CREATE OR REPLACE FUNCTION public.update_my_presence(
  p_presence_status TEXT,
  p_last_activity TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB AS $$
DECLARE
  v_uid UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  UPDATE public.profiles
  SET
    presence_status = p_presence_status,
    last_seen_at = p_last_activity,
    last_activity_at = p_last_activity,
    last_login_at = CASE WHEN p_presence_status = 'Active' THEN COALESCE(last_login_at, p_last_activity) ELSE last_login_at END,
    last_logout_at = CASE WHEN p_presence_status = 'Inactive' THEN p_last_activity ELSE last_logout_at END,
    updated_at = NOW()
  WHERE id = v_uid;

  RETURN jsonb_build_object('success', true, 'status', p_presence_status);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
