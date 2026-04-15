-- ============================================================================
-- Migration 028: Investor Relations Portal
-- ============================================================================
-- Adds tables for individual investor tracking, distribution management,
-- document sharing, and extended brand configuration for white-labeling.
--
-- This enables each developer (organization) to have their own branded
-- investor portal where individual investors log in and see:
-- - Their investment amount and pro-rata share
-- - Estimated vs actual distribution schedule
-- - Project performance (sales, expenses, construction)
-- - Shared documents (agreements, monthly reports)
--
-- The brand config extension allows each org to fully customize the
-- investor portal appearance (colors, logo, fonts) so investors see
-- the developer's brand, not TerraIA's.
-- ============================================================================

-- ─── Extended Brand Configuration ──────────────────────────────────────
-- Add columns to tenants for full white-label support
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS brand_logo_dark TEXT,           -- logo for dark backgrounds
  ADD COLUMN IF NOT EXISTS brand_favicon_url TEXT,         -- custom favicon
  ADD COLUMN IF NOT EXISTS brand_font_heading TEXT,        -- heading font family
  ADD COLUMN IF NOT EXISTS brand_font_body TEXT,           -- body font family
  ADD COLUMN IF NOT EXISTS brand_font_url TEXT,            -- Google Fonts or custom font CSS URL
  ADD COLUMN IF NOT EXISTS brand_hero_image_url TEXT,      -- hero/banner image for investor portal
  ADD COLUMN IF NOT EXISTS brand_email_header_url TEXT,    -- header image for branded emails
  ADD COLUMN IF NOT EXISTS brand_guidelines_url TEXT,      -- uploaded brand guidelines PDF
  ADD COLUMN IF NOT EXISTS brand_palette JSONB DEFAULT '{}', -- AI-extracted or manual color palette
  ADD COLUMN IF NOT EXISTS investor_portal_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS investor_portal_welcome_text TEXT; -- custom welcome message

COMMENT ON COLUMN tenants.brand_palette IS
  'Extended color palette: { "surface": "#fff", "surface_alt": "#faf8f5", "text": "#2c2c2c", "text_muted": "#9a9a9a", "accent": "#ce9e62", "accent_hover": "#b8894f", "danger": "#c1432e", "success": "#2d8a4e" }';

-- ─── Investor Profiles ─────────────────────────────────────────────────
-- Each row represents one investor's participation in one developer's project.
-- Linked to auth.users for login, and to organizations for the investment.
CREATE TABLE IF NOT EXISTS platform_investor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,                                            -- NULL until they register
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tenant_id UUID,

  -- Identity
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  company_name TEXT,                                       -- investing entity name (if LLC/fund)
  phone TEXT,

  -- Investment details
  investment_amount_usd DECIMAL(14,2) NOT NULL,
  investment_amount_mxn DECIMAL(14,2),                     -- at FX rate at time of investment
  investment_date DATE,
  investment_class TEXT NOT NULL DEFAULT 'B-1',             -- B-1, B-2, etc.
  tranche_id INTEGER REFERENCES investment_tranches(id),   -- which tranche they're part of

  -- Distribution config
  distribution_start_month TEXT,                           -- YYYY-MM when their distributions begin
  pro_rata_pct DECIMAL(8,5),                               -- auto-calculated: amount / total LP

  -- Agreements
  signed_agreement_url TEXT,
  signed_agreement_filename TEXT,
  agreement_signed_date DATE,

  -- Referral / placement tracking
  referral_source TEXT,                                    -- who introduced this investor
  referral_contact_name TEXT,                              -- specific person
  referral_contact_email TEXT,
  referral_fee_pct DECIMAL(5,2) DEFAULT 0,                 -- 3% or 6% typically
  referral_fee_amount_usd DECIMAL(14,2),                   -- calculated: investment * fee_pct
  referral_fee_paid BOOLEAN DEFAULT false,
  referral_fee_paid_date DATE,

  -- Status
  status TEXT NOT NULL DEFAULT 'invited'
    CHECK (status IN ('draft', 'invited', 'registered', 'active', 'exited', 'suspended')),
  invited_at TIMESTAMPTZ,
  registered_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,

  -- Access
  can_view_financials BOOLEAN DEFAULT true,
  can_view_construction BOOLEAN DEFAULT true,
  can_view_documents BOOLEAN DEFAULT true,
  can_download_reports BOOLEAN DEFAULT true,

  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE platform_investor_profiles IS
  'Individual investor accounts for the white-labeled investor portal. Each investor sees their pro-rata share of distributions, project performance, and shared documents.';

-- ─── Investor Distributions ────────────────────────────────────────────
-- Per-investor, per-month distribution tracking (estimated + actual).
-- Estimated amounts are auto-calculated from the lockbox waterfall × pro_rata_pct.
-- Actual amounts are entered when distributions are paid.
CREATE TABLE IF NOT EXISTS platform_investor_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_profile_id UUID NOT NULL REFERENCES platform_investor_profiles(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id),

  month TEXT NOT NULL,                                     -- YYYY-MM
  estimated_amount_usd DECIMAL(14,2),                      -- pro-rata share of projected lockbox
  actual_amount_usd DECIMAL(14,2),                         -- what was actually paid
  payment_date DATE,
  payment_reference TEXT,                                  -- wire ref, check #, etc.
  payment_method TEXT,                                     -- wire, check, ACH

  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'pending', 'paid', 'skipped', 'adjusted')),

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(investor_profile_id, month)
);

COMMENT ON TABLE platform_investor_distributions IS
  'Monthly distribution tracking per investor. Estimated from lockbox waterfall × pro-rata share. Actual entered when payment is made.';

-- ─── Investor Documents ────────────────────────────────────────────────
-- Documents shared with investors (agreements, monthly reports, tax docs).
-- investor_profile_id = NULL means shared with ALL investors in the org.
CREATE TABLE IF NOT EXISTS platform_investor_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_profile_id UUID REFERENCES platform_investor_profiles(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  document_type TEXT NOT NULL
    CHECK (document_type IN (
      'agreement', 'monthly_report', 'quarterly_report', 'annual_report',
      'tax_document', 'construction_update', 'financial_statement',
      'legal_notice', 'other'
    )),
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  filename TEXT,
  file_size_bytes INTEGER,

  -- Scoping
  visible_to_investors BOOLEAN DEFAULT true,               -- admin can hide drafts
  report_month TEXT,                                       -- YYYY-MM for periodic reports
  report_year INTEGER,                                     -- for annual reports/tax docs

  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE platform_investor_documents IS
  'Documents shared with investors. Per-investor (agreement) or org-wide (monthly reports). Admin controls visibility.';

-- ─── Investor Activity Log ─────────────────────────────────────────────
-- Track investor engagement for admin visibility.
CREATE TABLE IF NOT EXISTS platform_investor_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_profile_id UUID NOT NULL REFERENCES platform_investor_profiles(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id),

  activity_type TEXT NOT NULL,                              -- login, view_dashboard, view_document, download_report
  detail TEXT,                                             -- e.g., document title, page visited
  ip_address TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Indexes ───────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_investor_profiles_org ON platform_investor_profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_investor_profiles_user ON platform_investor_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_investor_profiles_email ON platform_investor_profiles(email);
CREATE INDEX IF NOT EXISTS idx_investor_profiles_status ON platform_investor_profiles(status);

CREATE INDEX IF NOT EXISTS idx_investor_distributions_profile ON platform_investor_distributions(investor_profile_id);
CREATE INDEX IF NOT EXISTS idx_investor_distributions_month ON platform_investor_distributions(month);
CREATE INDEX IF NOT EXISTS idx_investor_distributions_org ON platform_investor_distributions(org_id);

CREATE INDEX IF NOT EXISTS idx_investor_documents_org ON platform_investor_documents(org_id);
CREATE INDEX IF NOT EXISTS idx_investor_documents_profile ON platform_investor_documents(investor_profile_id);
CREATE INDEX IF NOT EXISTS idx_investor_documents_type ON platform_investor_documents(document_type);

CREATE INDEX IF NOT EXISTS idx_investor_activity_profile ON platform_investor_activity(investor_profile_id);

-- ─── RLS ───────────────────────────────────────────────────────────────

ALTER TABLE platform_investor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_investor_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_investor_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_investor_activity ENABLE ROW LEVEL SECURITY;

-- Admins see all investors in their org
CREATE POLICY investor_profiles_admin ON platform_investor_profiles FOR ALL
  USING (org_id IN (
    SELECT ur.org_id FROM user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.is_active = true
      AND ur.role IN ('admin', 'platform_admin', 'tenant_admin', 'finance')
  ));

-- Investors see only their own profile
CREATE POLICY investor_profiles_own ON platform_investor_profiles FOR SELECT
  USING (user_id = auth.uid());

-- Admins see all distributions
CREATE POLICY investor_distributions_admin ON platform_investor_distributions FOR ALL
  USING (org_id IN (
    SELECT ur.org_id FROM user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.is_active = true
      AND ur.role IN ('admin', 'platform_admin', 'tenant_admin', 'finance')
  ));

-- Investors see their own distributions
CREATE POLICY investor_distributions_own ON platform_investor_distributions FOR SELECT
  USING (investor_profile_id IN (
    SELECT id FROM platform_investor_profiles WHERE user_id = auth.uid()
  ));

-- Admins manage all documents
CREATE POLICY investor_documents_admin ON platform_investor_documents FOR ALL
  USING (org_id IN (
    SELECT ur.org_id FROM user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.is_active = true
      AND ur.role IN ('admin', 'platform_admin', 'tenant_admin', 'finance')
  ));

-- Investors see documents shared with them or all investors
CREATE POLICY investor_documents_own ON platform_investor_documents FOR SELECT
  USING (
    visible_to_investors = true
    AND (
      investor_profile_id IS NULL  -- shared with all investors in org
      OR investor_profile_id IN (
        SELECT id FROM platform_investor_profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Activity: admins see all, investors see their own
CREATE POLICY investor_activity_admin ON platform_investor_activity FOR ALL
  USING (org_id IN (
    SELECT ur.org_id FROM user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.is_active = true
      AND ur.role IN ('admin', 'platform_admin', 'tenant_admin')
  ));

CREATE POLICY investor_activity_own ON platform_investor_activity FOR SELECT
  USING (investor_profile_id IN (
    SELECT id FROM platform_investor_profiles WHERE user_id = auth.uid()
  ));

-- Insert activity from any authenticated user (for logging their own actions)
CREATE POLICY investor_activity_insert ON platform_investor_activity FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ─── Seed MANA 88 brand config ─────────────────────────────────────────

UPDATE tenants
SET
  brand_palette = '{
    "surface": "#ffffff",
    "surface_alt": "#faf8f5",
    "text": "#2c2c2c",
    "text_muted": "#9a9a9a",
    "accent": "#ce9e62",
    "accent_hover": "#b8894f",
    "danger": "#c1432e",
    "success": "#2d8a4e",
    "border": "#e5e7eb"
  }'::jsonb,
  investor_portal_enabled = true,
  investor_portal_welcome_text = 'Welcome to your MANA 88 investor dashboard. Here you can track your investment performance, view distribution schedules, access project reports, and monitor construction progress.'
WHERE id = '62f1ef3b-f133-4d91-bd87-55edac7fcd67';

NOTIFY pgrst, 'reload schema';
