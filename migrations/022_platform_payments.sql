-- ============================================================================
-- Migration 022: TerraIA Platform Payments
-- ============================================================================
-- Adds Stripe Connect payment infrastructure for the TerraIA SaaS platform.
--
-- Architecture:
--   - Bridge tables link EXISTING entities (organizations, clients, users)
--     to their Stripe accounts — no data duplication.
--   - Invoices reference existing CMS tables (clients, cases, payment_schedule)
--     so the payment module and CMS stay in sync.
--   - Payment events provide an immutable audit log.
--
-- Entity mapping:
--   Developer  → organizations (existing)     + platform_developer_stripe (new)
--   Project    → tenants (existing)           — referenced via tenant_id
--   Client     → clients (existing)           + platform_client_stripe (new)
--   Broker     → profiles/user_roles (existing) + platform_broker_stripe (new)
--   Invoice    → platform_invoices (new)
--   Audit log  → platform_payment_events (new)
-- ============================================================================

-- ─── Developer ↔ Stripe Connect bridge ─────────────────────────────────────
-- Links an organization (developer company) to its Stripe Connect Express account.
-- One org = one Stripe account. Created during KYB onboarding.
CREATE TABLE IF NOT EXISTS platform_developer_stripe (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_account_id TEXT UNIQUE,
  kyb_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (kyb_status IN ('pending', 'in_review', 'approved', 'rejected')),
  charges_enabled BOOLEAN NOT NULL DEFAULT false,
  payouts_enabled BOOLEAN NOT NULL DEFAULT false,
  details_submitted BOOLEAN NOT NULL DEFAULT false,
  commission_default_pct DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  platform_fee_pct DECIMAL(5,2) NOT NULL DEFAULT 0.50,
  spei_clabe TEXT,
  bank_name TEXT,
  payout_currency TEXT NOT NULL DEFAULT 'MXN',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE platform_developer_stripe IS
  'Links an organization (real estate developer) to its Stripe Connect Express account for receiving payments and SPEI payouts.';

-- ─── Broker ↔ Stripe Connect bridge ────────────────────────────────────────
-- Links a broker user (profiles + user_roles where role=broker) to their
-- Stripe Connect Express account for receiving commission payouts.
-- A broker is independent — can sell for ANY developer.
CREATE TABLE IF NOT EXISTS platform_broker_stripe (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  stripe_account_id TEXT UNIQUE,
  kyb_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (kyb_status IN ('pending', 'in_review', 'approved', 'rejected')),
  charges_enabled BOOLEAN NOT NULL DEFAULT false,
  payouts_enabled BOOLEAN NOT NULL DEFAULT false,
  details_submitted BOOLEAN NOT NULL DEFAULT false,
  default_commission_pct DECIMAL(5,2),
  payout_currency TEXT NOT NULL DEFAULT 'MXN',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE platform_broker_stripe IS
  'Links a broker user to their Stripe Connect Express account for receiving commission payouts. Brokers are independent agents who can sell across any developer project.';

-- ─── Client ↔ Stripe Customer bridge ───────────────────────────────────────
-- Links a CMS client to a Stripe Customer object on a specific developer's
-- connected account. One client can have multiple Stripe customers if they
-- buy from multiple developers (each connected account has its own customers).
CREATE TABLE IF NOT EXISTS platform_client_stripe (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL,
  stripe_connected_account_id TEXT NOT NULL,
  currency_preference TEXT NOT NULL DEFAULT 'MXN',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, org_id)
);

COMMENT ON TABLE platform_client_stripe IS
  'Maps a CMS client to a Stripe Customer on a developer connected account. One client may have Stripe customers on multiple connected accounts if buying from different developers.';

-- ─── Invoices ──────────────────────────────────────────────────────────────
-- A payment request from a developer to a client. Can be linked to an
-- existing CMS case and/or payment_schedule item for reconciliation.
-- Contains the Stripe PaymentIntent ID and dynamic CLABE for SPEI collection.
CREATE TABLE IF NOT EXISTS platform_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who
  client_id UUID NOT NULL REFERENCES clients(id),
  org_id UUID NOT NULL REFERENCES organizations(id),
  tenant_id UUID,
  broker_user_id UUID,

  -- Optional CMS links (for reconciliation with the sales/case system)
  case_id UUID,
  schedule_id UUID,

  -- Money
  amount_mxn DECIMAL(14,2) NOT NULL,
  amount_foreign DECIMAL(14,2),
  currency TEXT NOT NULL DEFAULT 'MXN',
  fx_rate_used DECIMAL(12,6),

  -- Commission split
  commission_pct DECIMAL(5,2),
  commission_amount_mxn DECIMAL(14,2),
  platform_fee_pct DECIMAL(5,2),
  platform_fee_mxn DECIMAL(14,2),
  net_developer_amount_mxn DECIMAL(14,2),

  -- Description
  description TEXT,
  due_date DATE,
  invoice_number TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('draft', 'pending', 'processing', 'paid', 'failed', 'refunded', 'cancelled', 'expired')),

  -- Stripe
  stripe_payment_intent_id TEXT,
  stripe_customer_id TEXT,
  stripe_connected_account_id TEXT,
  dynamic_clabe TEXT,
  clabe_expires_at TIMESTAMPTZ,

  -- Airwallex (stubs for Sprint 2)
  airwallex_payment_id TEXT,
  airwallex_virtual_account TEXT,

  -- Commission transfer tracking
  broker_transfer_id TEXT,
  broker_transfer_status TEXT,

  -- Completion
  paid_at TIMESTAMPTZ,
  cfdi_uuid TEXT,

  -- Meta
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE platform_invoices IS
  'Payment invoice from a developer to a client. Contains the Stripe PaymentIntent, dynamic CLABE for SPEI, commission split calculations, and optional links to CMS cases/schedule items for reconciliation.';

-- ─── Payment Events (immutable audit log) ──────────────────────────────────
-- Every Stripe webhook, status change, payout, and commission transfer is
-- logged here. Never updated or deleted — append-only.
CREATE TABLE IF NOT EXISTS platform_payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES platform_invoices(id) ON DELETE SET NULL,
  org_id UUID REFERENCES organizations(id),
  event_type TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'stripe'
    CHECK (provider IN ('stripe', 'airwallex', 'manual', 'system')),
  provider_event_id TEXT,
  amount DECIMAL(14,2),
  currency TEXT,
  status TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE platform_payment_events IS
  'Immutable append-only audit log. Every webhook event, status change, payout, and commission transfer is recorded here for compliance and debugging.';

-- ─── Indexes ───────────────────────────────────────────────────────────────

-- Developer lookups
CREATE INDEX IF NOT EXISTS idx_dev_stripe_org ON platform_developer_stripe(org_id);
CREATE INDEX IF NOT EXISTS idx_dev_stripe_acct ON platform_developer_stripe(stripe_account_id);

-- Broker lookups
CREATE INDEX IF NOT EXISTS idx_broker_stripe_user ON platform_broker_stripe(user_id);
CREATE INDEX IF NOT EXISTS idx_broker_stripe_acct ON platform_broker_stripe(stripe_account_id);

-- Client → Stripe customer mapping
CREATE INDEX IF NOT EXISTS idx_client_stripe_client ON platform_client_stripe(client_id);
CREATE INDEX IF NOT EXISTS idx_client_stripe_org ON platform_client_stripe(org_id);
CREATE INDEX IF NOT EXISTS idx_client_stripe_cust ON platform_client_stripe(stripe_customer_id);

-- Invoice queries (most common access patterns)
CREATE INDEX IF NOT EXISTS idx_invoices_org ON platform_invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON platform_invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON platform_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON platform_invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_pi ON platform_invoices(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_invoices_clabe ON platform_invoices(dynamic_clabe);
CREATE INDEX IF NOT EXISTS idx_invoices_case ON platform_invoices(case_id);
CREATE INDEX IF NOT EXISTS idx_invoices_broker ON platform_invoices(broker_user_id);

-- Payment events (most common: look up by invoice, then by provider event ID)
CREATE INDEX IF NOT EXISTS idx_events_invoice ON platform_payment_events(invoice_id);
CREATE INDEX IF NOT EXISTS idx_events_org ON platform_payment_events(org_id);
CREATE INDEX IF NOT EXISTS idx_events_provider ON platform_payment_events(provider_event_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON platform_payment_events(event_type);

-- ─── RLS ───────────────────────────────────────────────────────────────────
-- Platform payment tables use the same tenant isolation as the rest of
-- the system. Authenticated users see data for their own organization only.

ALTER TABLE platform_developer_stripe ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_broker_stripe ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_client_stripe ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_payment_events ENABLE ROW LEVEL SECURITY;

-- Developers: org members see their own org's Stripe link
CREATE POLICY dev_stripe_select ON platform_developer_stripe FOR SELECT
  USING (org_id IN (
    SELECT ur.org_id FROM user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.is_active = true
  ));

CREATE POLICY dev_stripe_all ON platform_developer_stripe FOR ALL
  USING (org_id IN (
    SELECT ur.org_id FROM user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.is_active = true
      AND ur.role IN ('admin', 'platform_admin', 'tenant_admin')
  ));

-- Brokers: a broker sees their own record only
CREATE POLICY broker_stripe_own ON platform_broker_stripe FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY broker_stripe_admin ON platform_broker_stripe FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.is_active = true
      AND ur.role IN ('admin', 'platform_admin')
  ));

-- Client Stripe: org members see their org's client mappings
CREATE POLICY client_stripe_select ON platform_client_stripe FOR SELECT
  USING (org_id IN (
    SELECT ur.org_id FROM user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.is_active = true
  ));

CREATE POLICY client_stripe_admin ON platform_client_stripe FOR ALL
  USING (org_id IN (
    SELECT ur.org_id FROM user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.is_active = true
      AND ur.role IN ('admin', 'platform_admin', 'tenant_admin', 'finance')
  ));

-- Invoices: org members see their org's invoices
CREATE POLICY invoices_select ON platform_invoices FOR SELECT
  USING (org_id IN (
    SELECT ur.org_id FROM user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.is_active = true
  ));

CREATE POLICY invoices_admin ON platform_invoices FOR ALL
  USING (org_id IN (
    SELECT ur.org_id FROM user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.is_active = true
      AND ur.role IN ('admin', 'platform_admin', 'tenant_admin', 'finance')
  ));

-- Payment events: org members see their org's events
CREATE POLICY events_select ON platform_payment_events FOR SELECT
  USING (org_id IN (
    SELECT ur.org_id FROM user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.is_active = true
  ));

-- Events are insert-only from the service role (webhook handler)
-- No user-facing INSERT/UPDATE/DELETE policies needed — service role bypasses RLS.

-- ─── Notify PostgREST to reload schema cache ──────────────────────────────
NOTIFY pgrst, 'reload schema';
