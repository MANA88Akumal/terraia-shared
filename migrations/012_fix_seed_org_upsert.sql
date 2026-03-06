-- ============================================================
-- Migration 012: Fix seed_organization to use upsert on user_roles
-- The user_roles table has UNIQUE(user_id), so a plain INSERT fails
-- if the user already has a role. Use ON CONFLICT DO UPDATE instead.
-- ============================================================

CREATE OR REPLACE FUNCTION public.seed_organization(
  p_user_id uuid,
  p_name text,
  p_slug text,
  p_settings jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid := gen_random_uuid();
  result jsonb;
BEGIN
  -- 1. Create organization
  INSERT INTO organizations (id, name, slug, settings)
  VALUES (new_id, p_name, p_slug, p_settings);

  -- 2. Create matching tenant (same UUID for dual-identity)
  INSERT INTO tenants (id, name, slug)
  VALUES (new_id, p_name, p_slug);

  -- 3. Add user as org owner
  INSERT INTO organization_members (org_id, user_id, role)
  VALUES (new_id, p_user_id, 'owner')
  ON CONFLICT (org_id, user_id) DO UPDATE SET role = 'owner';

  -- 4. Add user_roles entry — upsert to handle unique constraint on user_id
  INSERT INTO user_roles (user_id, tenant_id, org_id, role, app_access, is_active)
  VALUES (
    p_user_id,
    new_id,
    new_id,
    'admin',
    '["accounting","cms","investors"]'::jsonb,
    true
  )
  ON CONFLICT (user_id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    org_id = EXCLUDED.org_id,
    role = EXCLUDED.role,
    app_access = EXCLUDED.app_access,
    is_active = EXCLUDED.is_active;

  result := jsonb_build_object('orgId', new_id);
  RETURN result;
END;
$$;

SELECT 'Migration 012 complete — seed_organization now uses upsert' AS status;
