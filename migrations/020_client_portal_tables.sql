-- 020: Client Portal Tables
-- TerraIA Platform — Client/Owner Portal

-- Client invitations (sent by admins to buyers)
CREATE TABLE IF NOT EXISTS client_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  case_id UUID,
  full_name TEXT,
  language TEXT DEFAULT 'es',
  sent_by UUID,
  sent_at TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '30 days'),
  tenant_id UUID,
  org_id UUID
);

-- Client referrals
CREATE TABLE IF NOT EXISTS client_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL,
  referral_code TEXT UNIQUE NOT NULL,
  referred_email TEXT,
  referred_name TEXT,
  referred_phone TEXT,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'opened', 'signed_up', 'visited', 'purchased', 'closed')),
  case_id UUID,
  reward_tier INTEGER,
  reward_description TEXT,
  reward_claimed BOOLEAN DEFAULT false,
  reward_claimed_at TIMESTAMPTZ,
  tenant_id UUID,
  org_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Client vault documents (developer-uploaded documents for clients)
CREATE TABLE IF NOT EXISTS client_vault_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL,
  client_user_id UUID,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'contract', 'escritura', 'chepina', 'fideicomiso',
    'tax_document', 'insurance', 'construction_report',
    'personal_upload', 'other'
  )),
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  description TEXT,
  uploaded_by TEXT,
  is_private BOOLEAN DEFAULT false,
  tenant_id UUID,
  org_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Client activity tracking
CREATE TABLE IF NOT EXISTS client_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  case_id UUID,
  activity_type TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invitations_email ON client_invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON client_invitations(token);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON client_referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON client_referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_vault_case ON client_vault_documents(case_id);
CREATE INDEX IF NOT EXISTS idx_activity_user ON client_activity(user_id);

-- RLS
ALTER TABLE client_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_vault_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_activity ENABLE ROW LEVEL SECURITY;

-- Invitations: public read by token (for signup page), authenticated insert
CREATE POLICY "invitations_public_by_token" ON client_invitations FOR SELECT USING (true);
CREATE POLICY "invitations_insert_auth" ON client_invitations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "invitations_update_auth" ON client_invitations FOR UPDATE USING (true);

-- Referrals: users see their own + public read by code
CREATE POLICY "referrals_own" ON client_referrals FOR SELECT USING (referrer_user_id = auth.uid() OR true);
CREATE POLICY "referrals_insert_own" ON client_referrals FOR INSERT WITH CHECK (referrer_user_id = auth.uid());
CREATE POLICY "referrals_update_own" ON client_referrals FOR UPDATE USING (referrer_user_id = auth.uid());

-- Vault: clients see their own case documents
CREATE POLICY "vault_client_read" ON client_vault_documents FOR SELECT
  USING (
    client_user_id = auth.uid() OR
    case_id IN (
      SELECT c.id FROM cases c
      JOIN clients cl ON c.client_id = cl.id
      WHERE cl.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );
CREATE POLICY "vault_insert_admin" ON client_vault_documents FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Activity: users see their own
CREATE POLICY "activity_own" ON client_activity FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "activity_insert_own" ON client_activity FOR INSERT WITH CHECK (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
