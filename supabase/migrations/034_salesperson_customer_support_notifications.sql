-- Migration 034: Sales Person–Only Customer Support Notifications & Case Management
-- Enforces that Customer Complaints, Product Damage, Support Requests, Return Requests,
-- Follow-ups, and Customer Updates are delivered strictly to the responsible Sales Person.
-- Completely blocks Cashier, Warehouse Manager, and Purchase Manager from receiving these alerts.
-- Prevents automatic blanket broadcasts to Owner and Admin (restricted to escalation / direct addressing).

-- 1. Extend public.customers with assigned_salesperson_id for targeted ownership
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS assigned_salesperson_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customers_assigned_sp ON public.customers(assigned_salesperson_id);

-- 2. Extend public.notifications with customer support metadata & stable deduplication
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'Normal',
  ADD COLUMN IF NOT EXISTS category VARCHAR(50),
  ADD COLUMN IF NOT EXISTS case_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS case_status VARCHAR(50) DEFAULT 'Open',
  ADD COLUMN IF NOT EXISTS followup_due TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dedup_key VARCHAR(255),
  ADD COLUMN IF NOT EXISTS is_escalated BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_notifications_category ON public.notifications(category);
CREATE INDEX IF NOT EXISTS idx_notifications_customer ON public.notifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_notifications_dedup_key ON public.notifications(dedup_key);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON public.notifications(priority);

-- 3. Create customer_support_cases table for auditable case tracking
CREATE TABLE IF NOT EXISTS public.customer_support_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  case_number VARCHAR(50) NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL, -- 'customer_complaint', 'customer_product_damage', 'customer_support_request', 'customer_return_request', 'customer_followup', 'customer_update'
  priority VARCHAR(20) NOT NULL DEFAULT 'Normal', -- 'High', 'Medium', 'Low'
  status VARCHAR(50) NOT NULL DEFAULT 'Open', -- 'Open', 'In Progress', 'Pending Customer Information', 'Resolved', 'Closed'
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.sales_invoices(id) ON DELETE SET NULL,
  assigned_salesperson_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  followup_due TIMESTAMPTZ,
  resolution_notes TEXT,
  notes JSONB DEFAULT '[]'::jsonb,
  is_escalated BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_cases_company ON public.customer_support_cases(company_id);
CREATE INDEX IF NOT EXISTS idx_support_cases_customer ON public.customer_support_cases(customer_id);
CREATE INDEX IF NOT EXISTS idx_support_cases_sp ON public.customer_support_cases(assigned_salesperson_id);
CREATE INDEX IF NOT EXISTS idx_support_cases_status ON public.customer_support_cases(status);
CREATE INDEX IF NOT EXISTS idx_support_cases_category ON public.customer_support_cases(category);

-- 4. Enable RLS on customer_support_cases
ALTER TABLE public.customer_support_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_cases_select_policy" ON public.customer_support_cases;
CREATE POLICY "support_cases_select_policy" ON public.customer_support_cases
  FOR SELECT TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND (
      -- Sales Person: view their assigned cases or unassigned queue
      (
        public.get_user_role() = 'Salesperson'
        AND (assigned_salesperson_id IS NULL OR assigned_salesperson_id = auth.uid())
      )
      -- Owner / Admin: authorized oversight
      OR public.get_user_role() IN ('Owner', 'Admin')
      -- Cashier, Warehouse Manager, and Purchase Manager are completely denied
    )
  );

DROP POLICY IF EXISTS "support_cases_insert_policy" ON public.customer_support_cases;
CREATE POLICY "support_cases_insert_policy" ON public.customer_support_cases
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.get_user_role() IN ('Salesperson', 'Owner', 'Admin')
  );

DROP POLICY IF EXISTS "support_cases_update_policy" ON public.customer_support_cases;
CREATE POLICY "support_cases_update_policy" ON public.customer_support_cases
  FOR UPDATE TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND (
      (public.get_user_role() = 'Salesperson' AND (assigned_salesperson_id IS NULL OR assigned_salesperson_id = auth.uid()))
      OR public.get_user_role() IN ('Owner', 'Admin')
    )
  );

-- 5. Update Notifications SELECT RLS policy for strict customer support isolation
DROP POLICY IF EXISTS "notifications_select_recipient" ON public.notifications;

CREATE POLICY "notifications_select_recipient" ON public.notifications
  FOR SELECT TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND (
      -- A. Customer Support Notifications (Complaints, Damages, Support, Returns, Follow-ups, Updates)
      -- Delivered EXCLUSIVELY to assigned Sales Person (or designated Sales Persons for unassigned cases)
      -- Strictly BLOCKS Cashier, Warehouse Manager, and Purchase Manager.
      -- Owner and Admin receive only if explicitly escalated or directly assigned.
      (
        (
          type IN ('customer_complaint', 'customer_product_damage', 'customer_support_request', 'customer_return_request', 'customer_followup', 'customer_update')
          OR category IN ('customer_complaint', 'customer_product_damage', 'customer_support_request', 'customer_return_request', 'customer_followup', 'customer_update')
        )
        AND (
          -- Assigned Salesperson
          (
            public.get_user_role() = 'Salesperson'
            AND (user_id = auth.uid() OR (user_id IS NULL AND NOT is_escalated))
          )
          -- Explicitly escalated / directly addressed Owner or Admin
          OR (
            public.get_user_role() IN ('Owner', 'Admin')
            AND (is_escalated = TRUE OR user_id = auth.uid())
          )
        )
      )
      -- B. Stock Alerts: Delivered exclusively to the assigned Warehouse Manager
      OR (
        type IN ('low_stock', 'limited_stock', 'out_of_stock', 'stock_damage')
        AND user_id = auth.uid()
        AND (
          warehouse_id IS NULL
          OR EXISTS (
            SELECT 1 FROM public.warehouses w
            WHERE w.id = notifications.warehouse_id
              AND (
                w.manager_id = auth.uid()
                OR EXISTS (
                  SELECT 1 FROM public.warehouse_managers wm
                  WHERE wm.warehouse_id = w.id AND wm.user_id = auth.uid()
                )
              )
          )
        )
      )
      -- C. General / Operational Non-Stock, Non-Customer-Support Alerts
      OR (
        type NOT IN ('low_stock', 'limited_stock', 'out_of_stock', 'stock_damage',
                     'customer_complaint', 'customer_product_damage', 'customer_support_request',
                     'customer_return_request', 'customer_followup', 'customer_update')
        AND (category IS NULL OR category NOT IN ('customer_complaint', 'customer_product_damage', 'customer_support_request', 'customer_return_request', 'customer_followup', 'customer_update'))
        AND (
          user_id = auth.uid()
          OR public.get_user_role() IN ('Owner', 'Admin')
          OR (user_id IS NULL AND public.get_user_role() NOT IN ('Salesperson', 'Cashier', 'Warehouse Manager'))
        )
      )
    )
  );
