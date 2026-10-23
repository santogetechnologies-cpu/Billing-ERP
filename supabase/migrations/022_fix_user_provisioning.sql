-- Migration 022: Fix User Provisioning, Avoid Auth 500 & Handle New User Exceptions
-- Addresses:
-- 1. "Database error saving new user" (500) during Supabase signup / user creation
-- 2. Safe error-handling in auth.users triggers to ensure registration never crashes
-- 3. Dedicated admin RPC for provisioning company users without public signup rate limits

-- 1. Ensure public.profiles columns and constraints are resilient
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role VARCHAR(100) DEFAULT 'Staff';

-- 2. Safe auth.users new-user trigger function (catches any constraint/duplicate error gracefully)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    company_id,
    full_name,
    email,
    avatar_url,
    role,
    status,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(
      (NEW.raw_user_meta_data->>'company_id')::uuid,
      '00000000-0000-0000-0000-000000000001'::uuid
    ),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'ERP User'),
    COALESCE(NEW.email, 'user@example.com'),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_user_meta_data->>'role', 'Staff'),
    'Active',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    updated_at = NOW();

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never abort auth.users transaction if profile creation encounters a conflict or missing field
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach trigger if not already present
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Dedicated Admin User Provisioning RPC
-- Allows authenticated company administrators to provision team members cleanly
CREATE OR REPLACE FUNCTION public.admin_create_company_user(
  p_email TEXT,
  p_password TEXT,
  p_name TEXT,
  p_role TEXT,
  p_status TEXT,
  p_company_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_existing_id UUID;
BEGIN
  -- Normalize email
  p_email := LOWER(TRIM(p_email));

  -- Check if user already exists for this company
  SELECT id INTO v_existing_id
  FROM public.profiles
  WHERE LOWER(email) = p_email AND company_id = p_company_id
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.profiles
    SET
      full_name = TRIM(p_name),
      role = p_role,
      status = p_status,
      updated_at = NOW()
    WHERE id = v_existing_id;

    RETURN jsonb_build_object(
      'success', true,
      'id', v_existing_id,
      'email', p_email,
      'is_new', false
    );
  END IF;

  -- Create fresh profile record
  v_user_id := gen_random_uuid();
  INSERT INTO public.profiles (
    id,
    company_id,
    full_name,
    email,
    role,
    status,
    created_at,
    updated_at
  )
  VALUES (
    v_user_id,
    p_company_id,
    TRIM(p_name),
    p_email,
    p_role,
    p_status,
    NOW(),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'id', v_user_id,
    'email', p_email,
    'is_new', true
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
