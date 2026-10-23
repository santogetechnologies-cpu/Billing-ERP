-- Migration 023: Strict Role-Based Access Control (RBAC) & Privilege Separation
-- Defines system roles, module permissions, role-permission matrix, and database security policies.

-- 1. Ensure System Roles Table
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_system BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Ensure Permissions / Modules Table
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Ensure Granular Role Permissions Table
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  can_view BOOLEAN DEFAULT TRUE,
  can_create BOOLEAN DEFAULT FALSE,
  can_edit BOOLEAN DEFAULT FALSE,
  can_delete BOOLEAN DEFAULT FALSE,
  can_approve BOOLEAN DEFAULT FALSE,
  can_export BOOLEAN DEFAULT FALSE,
  UNIQUE(role_id, permission_id)
);

-- Indexes for lightning fast authorization lookups
CREATE INDEX IF NOT EXISTS idx_roles_name ON public.roles(name);
CREATE INDEX IF NOT EXISTS idx_permissions_module ON public.permissions(module);
CREATE INDEX IF NOT EXISTS idx_role_permissions_lookup ON public.role_permissions(role_id, permission_id);

-- 4. Helper Function: Get Active Caller Role from profiles
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- 5. Helper Function: Verify Granular Permission
CREATE OR REPLACE FUNCTION public.user_has_permission(p_module text, p_action text)
RETURNS BOOLEAN AS $$
DECLARE
  v_role text;
  v_allowed boolean;
BEGIN
  -- Retrieve user role
  v_role := public.get_user_role();
  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Owner and Admin have unconditional full system control
  IF v_role IN ('Owner', 'Admin') THEN
    RETURN TRUE;
  END IF;

  -- Query granular role_permissions
  SELECT
    CASE p_action
      WHEN 'view' THEN rp.can_view
      WHEN 'create' THEN rp.can_create
      WHEN 'edit' THEN rp.can_edit
      WHEN 'delete' THEN rp.can_delete
      WHEN 'approve' THEN rp.can_approve
      WHEN 'export' THEN rp.can_export
      ELSE FALSE
    END INTO v_allowed
  FROM public.role_permissions rp
  JOIN public.roles r ON r.id = rp.role_id
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE r.name = v_role AND p.module = p_module;

  RETURN COALESCE(v_allowed, FALSE);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 6. Role Protection Policy on Profiles: Only Admin and Owner can change user roles
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER AS $$
DECLARE
  caller_role text;
BEGIN
  caller_role := public.get_user_role();
  
  -- If role is being changed and caller is neither Admin nor Owner, abort
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF caller_role NOT IN ('Owner', 'Admin') THEN
      RAISE EXCEPTION 'Privilege Escalation Blocked: Only Administrators can modify role assignments.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_role_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_escalation();
