-- 034: Client support tickets
-- TerraIA Platform — Client Portal
--
-- Paper trail for every support request submitted via the /contact form.
-- The form still dispatches an email via api.terraia.io/api/send-email; this
-- table gives admins a searchable history and a place to track status.

CREATE TABLE IF NOT EXISTS client_support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  user_id UUID,                                          -- auth.users.id of submitter (nullable for pre-auth tickets)
  case_id UUID REFERENCES cases(id) ON DELETE SET NULL,  -- context of the property they were asking about
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  urgency TEXT DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high')),
  lot_label TEXT,                                        -- e.g. "42-C6" at time of submission
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  tenant_id UUID,
  org_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_client ON client_support_tickets(client_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON client_support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON client_support_tickets(status);

ALTER TABLE client_support_tickets ENABLE ROW LEVEL SECURITY;

-- Clients see their own tickets (matched by auth user id OR by the client record
-- whose email matches their auth email).
CREATE POLICY "support_tickets_owner_read" ON client_support_tickets FOR SELECT
  USING (
    user_id = auth.uid() OR
    client_id IN (
      SELECT cl.id FROM clients cl
      WHERE cl.email = (SELECT email FROM auth.users WHERE id = auth.uid())
         OR cl.email_secondary = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Any authenticated user can file a ticket for themselves.
CREATE POLICY "support_tickets_owner_insert" ON client_support_tickets FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

NOTIFY pgrst, 'reload schema';
