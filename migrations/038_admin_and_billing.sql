-- 038: Admin app + SaaS billing foundation
-- TerraIA Platform — Admin Portal (admin.terraia.io)
--
-- Tables:
--   admin_audit_log                immutable who-did-what log
--   platform_role_permissions      role × resource matrix (DB-backed /roles editor)
--   platform_plans                 plan catalog (Starter, Growth, Enterprise)
--   platform_subscriptions         one per tenant
--   platform_subscription_invoices Stripe invoice mirror
--   platform_feature_flags         per-tenant feature overrides (V2 use)
--
-- Plus seeds the three initial plans and grants the billing_admin role value.

-- ─── admin_audit_log ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID,
  actor_email TEXT,
  action TEXT NOT NULL,                                    -- e.g. 'user.role.added', 'subscription.plan.changed', 'user.impersonated'
  target_type TEXT,                                        -- 'user', 'org', 'subscription', 'plan', etc.
  target_id UUID,
  tenant_id UUID,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_actor ON admin_audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_target ON admin_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON admin_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit_log(created_at DESC);

COMMENT ON TABLE admin_audit_log IS
  'Append-only audit trail for admin-app actions. Never UPDATE or DELETE rows — all changes leave a new row.';

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_platform_admin ON admin_audit_log FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND is_active = true AND role = 'platform_admin'
  ));

CREATE POLICY audit_tenant_admin ON admin_audit_log FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM user_roles
    WHERE user_id = auth.uid() AND is_active = true
      AND role IN ('admin', 'tenant_admin')
  ));

CREATE POLICY audit_insert_auth ON admin_audit_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ─── platform_role_permissions ───────────────────────────────────────────
-- Source of truth for the role × resource matrix. Rows populated from the
-- XLSX matrix; /roles editor in admin portal writes here.
CREATE TABLE IF NOT EXISTS platform_role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL,                                      -- e.g. 'investor', 'owner', 'tenant_admin'
  resource_key TEXT NOT NULL,                              -- e.g. 'client-portal:payments', 'cms:cases:create'
  access TEXT NOT NULL CHECK (access IN ('full', 'read', 'none', 'na')),
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (role, resource_key)
);

CREATE INDEX IF NOT EXISTS idx_role_perms_role ON platform_role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_perms_resource ON platform_role_permissions(resource_key);

ALTER TABLE platform_role_permissions ENABLE ROW LEVEL SECURITY;

-- All authenticated users can READ the permission map (used by app-side
-- route guards to gate navigation). Only platform admins can modify.
CREATE POLICY role_perms_read ON platform_role_permissions FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY role_perms_write ON platform_role_permissions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND is_active = true AND role = 'platform_admin'
  ));

-- ─── platform_plans ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,                               -- 'starter', 'growth', 'enterprise'
  name TEXT NOT NULL,
  description TEXT,
  monthly_price_usd DECIMAL(10, 2) NOT NULL,
  annual_price_usd DECIMAL(10, 2) NOT NULL,                -- with 17% discount (2 months free)
  per_seat_monthly_usd DECIMAL(10, 2) NOT NULL DEFAULT 50,
  seats_included INTEGER NOT NULL DEFAULT 0,
  storage_gb INTEGER,                                      -- NULL = unlimited
  features JSONB NOT NULL DEFAULT '{}',                    -- { owner_portal: true, investor_portal: 'full', ... }
  stripe_product_id TEXT,
  stripe_monthly_price_id TEXT,
  stripe_annual_price_id TEXT,
  is_public BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE platform_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY plans_public_read ON platform_plans FOR SELECT USING (is_public = true);
CREATE POLICY plans_platform_write ON platform_plans FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND is_active = true AND role = 'platform_admin'
  ));

-- Seed the three initial plans (pricing per our agreement)
INSERT INTO platform_plans (code, name, description, monthly_price_usd, annual_price_usd, per_seat_monthly_usd, seats_included, storage_gb, features, sort_order)
VALUES
  (
    'starter',
    'Starter',
    'For solo developers or small teams running their first project on TerraIA.',
    999,
    999 * 10,  -- 17% off annual (2 months free)
    50,
    3,
    5,
    '{
      "owner_portal": true,
      "accounting": true,
      "cms": true,
      "construction_app": false,
      "investor_portal": "read_only",
      "broker_portal": false,
      "document_vault": true,
      "white_label_subdomain": false,
      "white_label_custom_domain": false,
      "sso_saml": false,
      "support_tier": "standard_48h"
    }'::jsonb,
    1
  ),
  (
    'growth',
    'Growth',
    'For established developers scaling multiple projects with full investor and broker operations.',
    1499,
    1499 * 10,
    50,
    10,
    50,
    '{
      "owner_portal": true,
      "accounting": true,
      "cms": true,
      "construction_app": true,
      "investor_portal": "full",
      "broker_portal": true,
      "document_vault": true,
      "white_label_subdomain": true,
      "white_label_custom_domain": false,
      "sso_saml": false,
      "support_tier": "priority_24h"
    }'::jsonb,
    2
  ),
  (
    'enterprise',
    'Enterprise',
    'Custom pricing and terms for large developers and multi-project portfolios.',
    0,
    0,
    50,
    0,
    NULL,
    '{
      "owner_portal": true,
      "accounting": true,
      "cms": true,
      "construction_app": true,
      "investor_portal": "full",
      "broker_portal": true,
      "document_vault": true,
      "white_label_subdomain": true,
      "white_label_custom_domain": true,
      "sso_saml": true,
      "support_tier": "dedicated_csm",
      "annual_only": true
    }'::jsonb,
    3
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  monthly_price_usd = EXCLUDED.monthly_price_usd,
  annual_price_usd = EXCLUDED.annual_price_usd,
  features = EXCLUDED.features,
  updated_at = now();

-- ─── platform_subscriptions ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES platform_plans(id),
  status TEXT NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'unpaid')),
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
  seats_allowed INTEGER,                                   -- seats limit (seats_included + overages); NULL = unlimited
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  billing_email TEXT,
  billing_name TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_subs_status ON platform_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subs_stripe_customer ON platform_subscriptions(stripe_customer_id);

ALTER TABLE platform_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY subs_platform_all ON platform_subscriptions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND is_active = true AND role = 'platform_admin'
  ));

CREATE POLICY subs_tenant_read ON platform_subscriptions FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM user_roles
    WHERE user_id = auth.uid() AND is_active = true
      AND role IN ('admin', 'tenant_admin', 'billing_admin')
  ));

CREATE POLICY subs_tenant_write ON platform_subscriptions FOR UPDATE
  USING (tenant_id IN (
    SELECT tenant_id FROM user_roles
    WHERE user_id = auth.uid() AND is_active = true
      AND role IN ('admin', 'tenant_admin', 'billing_admin')
  ));

-- ─── platform_subscription_invoices ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_subscription_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES platform_subscriptions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  stripe_invoice_id TEXT UNIQUE,
  invoice_number TEXT,
  amount_due_usd DECIMAL(10, 2),
  amount_paid_usd DECIMAL(10, 2),
  tax_usd DECIMAL(10, 2),
  status TEXT CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
  invoice_pdf_url TEXT,
  hosted_invoice_url TEXT,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_invoices_subscription ON platform_subscription_invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_invoices_tenant ON platform_subscription_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sub_invoices_status ON platform_subscription_invoices(status);

ALTER TABLE platform_subscription_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY sub_invoices_platform ON platform_subscription_invoices FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND is_active = true AND role = 'platform_admin'
  ));

CREATE POLICY sub_invoices_tenant_read ON platform_subscription_invoices FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM user_roles
    WHERE user_id = auth.uid() AND is_active = true
      AND role IN ('admin', 'tenant_admin', 'billing_admin', 'finance')
  ));

-- ─── platform_feature_flags (per-tenant overrides) ───────────────────────
CREATE TABLE IF NOT EXISTS platform_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  flag_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  reason TEXT,
  expires_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, flag_key)
);

ALTER TABLE platform_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY flags_platform ON platform_feature_flags FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND is_active = true AND role = 'platform_admin'
  ));

CREATE POLICY flags_tenant_read ON platform_feature_flags FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM user_roles
    WHERE user_id = auth.uid() AND is_active = true
  ));

NOTIFY pgrst, 'reload schema';
