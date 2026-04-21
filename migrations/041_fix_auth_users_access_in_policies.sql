-- 041: Fix RLS policies that SELECT from auth.users
-- TerraIA Platform — Client Portal
--
-- Migrations 020 and 034 wrote RLS policies that do
--   SELECT email FROM auth.users WHERE id = auth.uid()
-- but the `authenticated` Postgres role doesn't have SELECT on auth.users,
-- so those queries fail with "permission denied for table users" whenever
-- the policy fires.
--
-- Fix: read the email from the JWT directly via auth.jwt() — no table
-- access required.

-- ─── client_vault_documents ──────────────────────────────────────────────
DROP POLICY IF EXISTS vault_client_read ON client_vault_documents;

CREATE POLICY vault_client_read ON client_vault_documents FOR SELECT
  USING (
    client_user_id = auth.uid()
    OR case_id IN (
      SELECT c.id FROM cases c
      JOIN clients cl ON c.client_id = cl.id
      WHERE cl.email = (auth.jwt() ->> 'email')
         OR cl.email_secondary = (auth.jwt() ->> 'email')
    )
  );

-- ─── client_support_tickets ──────────────────────────────────────────────
DROP POLICY IF EXISTS support_tickets_owner_read ON client_support_tickets;

CREATE POLICY support_tickets_owner_read ON client_support_tickets FOR SELECT
  USING (
    user_id = auth.uid()
    OR client_id IN (
      SELECT cl.id FROM clients cl
      WHERE cl.email = (auth.jwt() ->> 'email')
         OR cl.email_secondary = (auth.jwt() ->> 'email')
    )
  );

NOTIFY pgrst, 'reload schema';
