-- 042: Reseller / affiliate tracking
-- TerraIA Platform — SaaS billing
--
-- Lets external partners (brokers, agents, consultants) refer developers
-- to TerraIA and earn a commission on subscriptions. Each affiliate has a
-- human-friendly code that becomes a ?ref= URL param on landing / signup.

CREATE TABLE IF NOT EXISTS platform_affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,                     -- public-facing ?ref= code, e.g. 'MARTIN'
  name TEXT NOT NULL,                            -- partner display name
  email TEXT,
  stripe_customer_id TEXT,                       -- for payouts if we use Stripe Connect later
  commission_pct DECIMAL(5, 2) NOT NULL DEFAULT 20.00,
  commission_months INTEGER NOT NULL DEFAULT 12, -- how many monthly commissions per referral
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliates_code ON platform_affiliates(code);

ALTER TABLE platform_affiliates ENABLE ROW LEVEL SECURITY;

-- Public read on just the code/name so ?ref= landing pages can render
-- "referred by Martin" without exposing commission details.
CREATE POLICY affiliates_public_minimal ON platform_affiliates FOR SELECT
  USING (is_active = true);

CREATE POLICY affiliates_platform_write ON platform_affiliates FOR ALL
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- ─── Referred tenants — join table + commission ledger ──────────────────
CREATE TABLE IF NOT EXISTS platform_affiliate_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES platform_affiliates(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES platform_subscriptions(id) ON DELETE SET NULL,
  signup_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_paid_at TIMESTAMPTZ,                     -- filled by webhook on invoice.paid
  months_remaining INTEGER,                      -- snapshot at first payment
  total_commission_paid_usd DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_ref_affiliate ON platform_affiliate_referrals(affiliate_id);

ALTER TABLE platform_affiliate_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY affiliate_referrals_platform ON platform_affiliate_referrals FOR ALL
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- ─── Commission events ──────────────────────────────────────────────────
-- Append-only ledger of commission amounts earned per paid invoice.
CREATE TABLE IF NOT EXISTS platform_affiliate_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL REFERENCES platform_affiliate_referrals(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES platform_subscription_invoices(id) ON DELETE SET NULL,
  amount_usd DECIMAL(10, 2) NOT NULL,
  commission_pct DECIMAL(5, 2) NOT NULL,
  invoice_amount_usd DECIMAL(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'accrued' CHECK (status IN ('accrued', 'paid', 'void')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commissions_referral ON platform_affiliate_commissions(referral_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON platform_affiliate_commissions(status);

ALTER TABLE platform_affiliate_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY commissions_platform ON platform_affiliate_commissions FOR ALL
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

NOTIFY pgrst, 'reload schema';
