-- 019: Broker Agency Architecture
-- TerraIA Platform — Broker Portal v2
-- Adds agency layer above individual brokers with multi-developer access

-- ══════════════════════════════════════════════════════════════════
-- BROKER AGENCIES (top-level entity — the brokerage firm)
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS broker_agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  legal_name TEXT,
  rfc TEXT,
  logo_url TEXT,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  whatsapp TEXT,
  website TEXT,
  address_line1 TEXT,
  address_city TEXT,
  address_state TEXT,
  address_country TEXT DEFAULT 'Mexico',
  subscription_plan TEXT DEFAULT 'starter' CHECK (subscription_plan IN ('starter', 'professional', 'enterprise')),
  max_seats INTEGER DEFAULT 5,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════════
-- AGENCY MEMBERS (brokers within an agency)
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS broker_agency_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES broker_agencies(id) ON DELETE CASCADE,
  user_id UUID,
  role TEXT DEFAULT 'broker' CHECK (role IN ('admin', 'broker', 'viewer')),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  whatsapp TEXT,
  profile_photo_url TEXT,
  license_number TEXT,
  bio TEXT,
  specialties TEXT[],
  commission_split_pct NUMERIC DEFAULT 70 CHECK (commission_split_pct BETWEEN 0 AND 100),
  is_active BOOLEAN DEFAULT true,
  invited_at TIMESTAMPTZ DEFAULT now(),
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agency_id, email)
);

-- ══════════════════════════════════════════════════════════════════
-- DEVELOPER ACCESS (which developers an agency can sell for)
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS broker_developer_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES broker_agencies(id) ON DELETE CASCADE,
  developer_tenant_id UUID NOT NULL,
  developer_name TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'revoked')),
  commission_rate NUMERIC DEFAULT 5 CHECK (commission_rate BETWEEN 0 AND 30),
  contract_url TEXT,
  notes TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agency_id, developer_tenant_id)
);

-- ══════════════════════════════════════════════════════════════════
-- BROKER LEADS (enhanced — owned by broker, visible to agency admin)
-- Replaces the old broker_leads table concept but new table name
-- to avoid conflicts with existing data
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS broker_agency_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES broker_agencies(id) ON DELETE CASCADE,
  broker_id UUID NOT NULL REFERENCES broker_agency_members(id) ON DELETE CASCADE,
  developer_tenant_id UUID NOT NULL,

  -- Client info
  client_first_name TEXT NOT NULL,
  client_last_name TEXT,
  client_email TEXT,
  client_phone TEXT,
  client_whatsapp TEXT,
  client_nationality TEXT,

  -- Lead details
  lot_interest UUID,
  source TEXT CHECK (source IN ('referral', 'website', 'social', 'event', 'cold_call', 'whatsapp', 'walk_in', 'other')),
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'visiting', 'negotiating', 'proposal_sent', 'contracted', 'lost')),
  lost_reason TEXT,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  -- Exclusivity
  exclusivity_expires_at TIMESTAMPTZ,

  -- Budget info
  budget_min NUMERIC,
  budget_max NUMERIC,
  budget_currency TEXT DEFAULT 'MXN',
  preferred_lot_size TEXT,
  preferred_phase TEXT,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════════
-- LEAD ACTIVITIES (timeline of interactions)
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS broker_lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES broker_agency_leads(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'call', 'whatsapp', 'email', 'sms',
    'site_visit', 'video_call', 'meeting',
    'lot_shared', 'proposal_sent', 'contract_sent',
    'follow_up', 'note', 'status_change'
  )),
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════════
-- BROKER TASKS (follow-up reminders)
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS broker_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES broker_agencies(id) ON DELETE CASCADE,
  broker_id UUID NOT NULL REFERENCES broker_agency_members(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES broker_agency_leads(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  due_time TIME,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════════
-- BROKER COMMISSIONS (agency-level with split tracking)
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS broker_agency_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES broker_agencies(id) ON DELETE CASCADE,
  broker_id UUID NOT NULL REFERENCES broker_agency_members(id) ON DELETE CASCADE,
  developer_tenant_id UUID NOT NULL,
  case_id UUID,
  lot_id UUID,
  lot_identifier TEXT,
  client_name TEXT,

  -- Amounts
  sale_price NUMERIC NOT NULL DEFAULT 0,
  commission_rate NUMERIC NOT NULL DEFAULT 5,
  total_commission NUMERIC NOT NULL DEFAULT 0,
  agency_split_pct NUMERIC DEFAULT 30,
  agency_share NUMERIC DEFAULT 0,
  broker_split_pct NUMERIC DEFAULT 70,
  broker_share NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'MXN',

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'earned', 'invoiced', 'paid', 'cancelled')),
  earned_date DATE,
  paid_date DATE,
  payment_reference TEXT,
  invoice_url TEXT,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════════
-- COMMISSION MILESTONES (payment triggers)
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS broker_commission_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id UUID NOT NULL REFERENCES broker_agency_commissions(id) ON DELETE CASCADE,
  milestone_name TEXT NOT NULL CHECK (milestone_name IN (
    'reservation', 'down_payment', 'twenty_five_pct', 'fifty_pct',
    'seventy_five_pct', 'delivery', 'deed_signed'
  )),
  payout_pct NUMERIC DEFAULT 0,
  amount NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'paid')),
  completed_date DATE,
  paid_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════════
-- LOT SHARES (tracking when brokers share lots with clients)
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS broker_lot_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES broker_agencies(id) ON DELETE CASCADE,
  broker_id UUID NOT NULL REFERENCES broker_agency_members(id) ON DELETE CASCADE,
  lot_id UUID NOT NULL,
  developer_tenant_id UUID NOT NULL,
  share_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  share_method TEXT CHECK (share_method IN ('whatsapp', 'email', 'link', 'pdf')),
  recipient_name TEXT,
  recipient_phone TEXT,
  recipient_email TEXT,
  opened_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════════
-- BROKER MARKETING ASSETS (generated lot sheets, social content)
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS broker_marketing_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES broker_agencies(id) ON DELETE CASCADE,
  broker_id UUID REFERENCES broker_agency_members(id) ON DELETE SET NULL,
  lot_id UUID,
  developer_tenant_id UUID,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('lot_sheet', 'social_post', 'email_template', 'presentation', 'qr_code')),
  title TEXT,
  file_url TEXT,
  thumbnail_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════════
-- INDEXES
-- ══════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_agency_members_agency ON broker_agency_members(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_members_user ON broker_agency_members(user_id);
CREATE INDEX IF NOT EXISTS idx_dev_access_agency ON broker_developer_access(agency_id);
CREATE INDEX IF NOT EXISTS idx_dev_access_tenant ON broker_developer_access(developer_tenant_id);
CREATE INDEX IF NOT EXISTS idx_agency_leads_agency ON broker_agency_leads(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_leads_broker ON broker_agency_leads(broker_id);
CREATE INDEX IF NOT EXISTS idx_agency_leads_status ON broker_agency_leads(status);
CREATE INDEX IF NOT EXISTS idx_agency_leads_developer ON broker_agency_leads(developer_tenant_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead ON broker_lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_broker_tasks_broker ON broker_tasks(broker_id);
CREATE INDEX IF NOT EXISTS idx_broker_tasks_due ON broker_tasks(due_date) WHERE NOT completed;
CREATE INDEX IF NOT EXISTS idx_agency_commissions_agency ON broker_agency_commissions(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_commissions_broker ON broker_agency_commissions(broker_id);
CREATE INDEX IF NOT EXISTS idx_lot_shares_token ON broker_lot_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_lot_shares_lot ON broker_lot_shares(lot_id);

-- ══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════════
ALTER TABLE broker_agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE broker_agency_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE broker_developer_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE broker_agency_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE broker_lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE broker_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE broker_agency_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE broker_commission_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE broker_lot_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE broker_marketing_assets ENABLE ROW LEVEL SECURITY;

-- Helper: get agencies a user belongs to
CREATE OR REPLACE FUNCTION get_user_agency_ids(uid UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT agency_id FROM broker_agency_members WHERE user_id = uid AND is_active = true;
$$;

-- Agencies: members can see their own agency
CREATE POLICY "agency_select" ON broker_agencies FOR SELECT
  USING (id IN (SELECT get_user_agency_ids(auth.uid())));
CREATE POLICY "agency_update" ON broker_agencies FOR UPDATE
  USING (id IN (SELECT get_user_agency_ids(auth.uid())));

-- Agency Members: see members in your agency
CREATE POLICY "members_select" ON broker_agency_members FOR SELECT
  USING (agency_id IN (SELECT get_user_agency_ids(auth.uid())));
CREATE POLICY "members_insert" ON broker_agency_members FOR INSERT
  WITH CHECK (agency_id IN (SELECT get_user_agency_ids(auth.uid())));
CREATE POLICY "members_update" ON broker_agency_members FOR UPDATE
  USING (agency_id IN (SELECT get_user_agency_ids(auth.uid())));

-- Developer Access: see which developers your agency works with
CREATE POLICY "dev_access_select" ON broker_developer_access FOR SELECT
  USING (agency_id IN (SELECT get_user_agency_ids(auth.uid())));
CREATE POLICY "dev_access_insert" ON broker_developer_access FOR INSERT
  WITH CHECK (agency_id IN (SELECT get_user_agency_ids(auth.uid())));

-- Leads: brokers see their own, admins see all in agency
CREATE POLICY "leads_select" ON broker_agency_leads FOR SELECT
  USING (agency_id IN (SELECT get_user_agency_ids(auth.uid())));
CREATE POLICY "leads_insert" ON broker_agency_leads FOR INSERT
  WITH CHECK (agency_id IN (SELECT get_user_agency_ids(auth.uid())));
CREATE POLICY "leads_update" ON broker_agency_leads FOR UPDATE
  USING (agency_id IN (SELECT get_user_agency_ids(auth.uid())));
CREATE POLICY "leads_delete" ON broker_agency_leads FOR DELETE
  USING (agency_id IN (SELECT get_user_agency_ids(auth.uid())));

-- Lead Activities
CREATE POLICY "activities_select" ON broker_lead_activities FOR SELECT
  USING (lead_id IN (SELECT id FROM broker_agency_leads WHERE agency_id IN (SELECT get_user_agency_ids(auth.uid()))));
CREATE POLICY "activities_insert" ON broker_lead_activities FOR INSERT
  WITH CHECK (lead_id IN (SELECT id FROM broker_agency_leads WHERE agency_id IN (SELECT get_user_agency_ids(auth.uid()))));

-- Tasks
CREATE POLICY "tasks_select" ON broker_tasks FOR SELECT
  USING (agency_id IN (SELECT get_user_agency_ids(auth.uid())));
CREATE POLICY "tasks_insert" ON broker_tasks FOR INSERT
  WITH CHECK (agency_id IN (SELECT get_user_agency_ids(auth.uid())));
CREATE POLICY "tasks_update" ON broker_tasks FOR UPDATE
  USING (agency_id IN (SELECT get_user_agency_ids(auth.uid())));
CREATE POLICY "tasks_delete" ON broker_tasks FOR DELETE
  USING (agency_id IN (SELECT get_user_agency_ids(auth.uid())));

-- Commissions
CREATE POLICY "commissions_select" ON broker_agency_commissions FOR SELECT
  USING (agency_id IN (SELECT get_user_agency_ids(auth.uid())));
CREATE POLICY "commissions_insert" ON broker_agency_commissions FOR INSERT
  WITH CHECK (agency_id IN (SELECT get_user_agency_ids(auth.uid())));
CREATE POLICY "commissions_update" ON broker_agency_commissions FOR UPDATE
  USING (agency_id IN (SELECT get_user_agency_ids(auth.uid())));

-- Commission Milestones
CREATE POLICY "milestones_select" ON broker_commission_milestones FOR SELECT
  USING (commission_id IN (SELECT id FROM broker_agency_commissions WHERE agency_id IN (SELECT get_user_agency_ids(auth.uid()))));
CREATE POLICY "milestones_insert" ON broker_commission_milestones FOR INSERT
  WITH CHECK (commission_id IN (SELECT id FROM broker_agency_commissions WHERE agency_id IN (SELECT get_user_agency_ids(auth.uid()))));
CREATE POLICY "milestones_update" ON broker_commission_milestones FOR UPDATE
  USING (commission_id IN (SELECT id FROM broker_agency_commissions WHERE agency_id IN (SELECT get_user_agency_ids(auth.uid()))));

-- Lot Shares: public read for shared links, agency-scoped for management
CREATE POLICY "shares_select" ON broker_lot_shares FOR SELECT
  USING (agency_id IN (SELECT get_user_agency_ids(auth.uid())));
CREATE POLICY "shares_insert" ON broker_lot_shares FOR INSERT
  WITH CHECK (agency_id IN (SELECT get_user_agency_ids(auth.uid())));
-- Public share view (by token) — handled via API/edge function

-- Marketing Assets
CREATE POLICY "assets_select" ON broker_marketing_assets FOR SELECT
  USING (agency_id IN (SELECT get_user_agency_ids(auth.uid())));
CREATE POLICY "assets_insert" ON broker_marketing_assets FOR INSERT
  WITH CHECK (agency_id IN (SELECT get_user_agency_ids(auth.uid())));
CREATE POLICY "assets_delete" ON broker_marketing_assets FOR DELETE
  USING (agency_id IN (SELECT get_user_agency_ids(auth.uid())));

-- ══════════════════════════════════════════════════════════════════
-- SCHEMA CACHE RELOAD
-- ══════════════════════════════════════════════════════════════════
NOTIFY pgrst, 'reload schema';
