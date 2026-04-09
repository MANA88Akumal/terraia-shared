-- ============================================================
-- Migration 017: Fix get_current_tenant_id() for org/tenant ID mismatch
--
-- Problem: MANA 88 has org_id a0000000-...0001 but tenant_id 62f1ef3b-...
-- When switchOrg() sets current_org_id in JWT, RLS checks tenant_id
-- but the IDs don't match, so data appears to belong to wrong org.
--
-- Fix: Resolve org_id → tenant_id via user_roles lookup
-- ============================================================

CREATE OR REPLACE FUNCTION get_current_tenant_id() RETURNS UUID AS $$
  SELECT COALESCE(
    -- Primary: read current_org_id from JWT, then resolve to tenant_id via user_roles
    (
      SELECT ur.tenant_id
      FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.org_id = (auth.jwt() -> 'user_metadata' ->> 'current_org_id')::uuid
        AND ur.is_active = TRUE
      LIMIT 1
    ),
    -- Secondary: maybe org_id IS the tenant_id (new orgs created via seed_organization)
    (
      SELECT ur.tenant_id
      FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = (auth.jwt() -> 'user_metadata' ->> 'current_org_id')::uuid
        AND ur.is_active = TRUE
      LIMIT 1
    ),
    -- Fallback: first active role (for users who haven't switched yet)
    (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid() AND is_active = TRUE LIMIT 1)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

SELECT 'Migration 017 complete — get_current_tenant_id() now resolves org_id → tenant_id' AS status;
