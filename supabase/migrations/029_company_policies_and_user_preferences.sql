-- Migration 029: Role-Based Settings, Company Policy Governance & User Preferences
-- 1. Company Policies Table (Owner-managed policies, staff read-only published policies)
-- 2. Company Policy Audit History Table
-- 3. User Preferences Table (Personal Accent Color and UI preferences isolated per user)
-- 4. Row-Level Security (RLS) enforcement on policies and preferences
-- 5. Default seeded business compliance policies

-- 1. Create Company Policies Table
CREATE TABLE IF NOT EXISTS public.company_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  code VARCHAR(50),
  category VARCHAR(100) NOT NULL DEFAULT 'General',
  content TEXT NOT NULL,
  version VARCHAR(20) NOT NULL DEFAULT '1.0',
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Published', 'Archived')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by_role VARCHAR(50) DEFAULT 'Owner',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  UNIQUE(company_id, code)
);

-- 2. Create Company Policy Audit History Table
CREATE TABLE IF NOT EXISTS public.company_policy_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES public.company_policies(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL, -- 'created', 'updated', 'published', 'unpublished', 'archived', 'deleted'
  performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  performed_by_name VARCHAR(255),
  performed_by_role VARCHAR(50),
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create User Preferences Table
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  accent_color VARCHAR(30) DEFAULT 'blue',
  language VARCHAR(10) DEFAULT 'en',
  date_format VARCHAR(20) DEFAULT 'DD/MM/YYYY',
  number_format VARCHAR(20) DEFAULT 'en-IN',
  default_route VARCHAR(100),
  notifications JSONB DEFAULT '{"stockAlerts": true, "salesNotifications": true, "billingAlerts": true, "policyUpdates": true, "soundEnabled": true}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_company_policies_company ON public.company_policies(company_id);
CREATE INDEX IF NOT EXISTS idx_company_policies_status ON public.company_policies(status);
CREATE INDEX IF NOT EXISTS idx_company_policy_history_policy ON public.company_policy_history(policy_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_company ON public.user_preferences(company_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.company_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_policy_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- 4A. Policies RLS Policies
-- Owner has full access to ALL policies in their company
DROP POLICY IF EXISTS "company_policies_owner_full" ON public.company_policies;
CREATE POLICY "company_policies_owner_full"
ON public.company_policies
FOR ALL
TO authenticated
USING (
  company_id IN (
    SELECT p.company_id FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = auth.uid() AND r.name = 'Owner'
  )
)
WITH CHECK (
  company_id IN (
    SELECT p.company_id FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = auth.uid() AND r.name = 'Owner'
  )
);

-- Staff (non-Owner) can ONLY SELECT published policies from their assigned company
DROP POLICY IF EXISTS "company_policies_staff_read_published" ON public.company_policies;
CREATE POLICY "company_policies_staff_read_published"
ON public.company_policies
FOR SELECT
TO authenticated
USING (
  status = 'Published'
  AND company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- 4B. User Preferences RLS Policies
DROP POLICY IF EXISTS "user_preferences_owner_access" ON public.user_preferences;
CREATE POLICY "user_preferences_owner_access"
ON public.user_preferences
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 5. Seed Initial Default Company Policies for Default Tenant
DO $$
DECLARE
  v_company_id UUID := '00000000-0000-0000-0000-000000000001';
  v_owner_profile_id UUID;
  v_pol_id UUID;
BEGIN
  -- Look up company Owner profile if present
  SELECT p.id INTO v_owner_profile_id
  FROM public.profiles p
  JOIN public.roles r ON p.role_id = r.id
  WHERE p.company_id = v_company_id AND r.name = 'Owner'
  LIMIT 1;

  -- 1. Code of Conduct Policy
  INSERT INTO public.company_policies (
    company_id, title, code, category, content, version, effective_date, status, created_by, created_by_role, published_at
  )
  VALUES (
    v_company_id,
    'Universal Billing Code of Business Conduct & Ethics',
    'POL-001',
    'General',
    'All staff members must observe the highest standards of financial honesty, transparency, and data confidentiality. Falsification of invoice records, unauthorized stock removals, and off-the-books transactions are strictly prohibited and subject to immediate termination.',
    '1.0',
    CURRENT_DATE,
    'Published',
    v_owner_profile_id,
    'Owner',
    NOW()
  )
  ON CONFLICT (company_id, code) DO NOTHING;

  -- 2. Warehouse Stock Handling & Loss Prevention Policy
  INSERT INTO public.company_policies (
    company_id, title, code, category, content, version, effective_date, status, created_by, created_by_role, published_at
  )
  VALUES (
    v_company_id,
    'Warehouse Inventory Integrity & Loss Prevention',
    'POL-002',
    'Warehouse & Inventory',
    'Physical inventory audits must be reconciled against system stock transactions weekly. Products with active sales history cannot be permanently deleted and must be safely deactivated or archived. Damaged goods must be recorded via authorized Stock Adjustments within 24 hours.',
    '1.0',
    CURRENT_DATE,
    'Published',
    v_owner_profile_id,
    'Owner',
    NOW()
  )
  ON CONFLICT (company_id, code) DO NOTHING;

  -- 3. Commercial Credit & Invoice Payment Terms
  INSERT INTO public.company_policies (
    company_id, title, code, category, content, version, effective_date, status, created_by, created_by_role, published_at
  )
  VALUES (
    v_company_id,
    'Commercial Customer Credit & Collection Standards',
    'POL-003',
    'Sales & Credit',
    'Customer credit limits must be strictly validated before dispatching goods. Invoices overdue beyond 30 days shall incur 18% p.a. standard interest. No additional credit deliveries are permitted for accounts on hold.',
    '1.0',
    CURRENT_DATE,
    'Published',
    v_owner_profile_id,
    'Owner',
    NOW()
  )
  ON CONFLICT (company_id, code) DO NOTHING;
END $$;
