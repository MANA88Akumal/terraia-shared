-- Fix seed_organization RPC: add org_id to user_roles insert
-- The user_roles table has a NOT NULL constraint on org_id, but the old
-- function only set tenant_id. Since org_id = tenant_id for new orgs, both
-- need to be set.

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
  VALUES (new_id, p_user_id, 'owner');

  -- 4. Add user_roles entry (with BOTH org_id and tenant_id)
  INSERT INTO user_roles (user_id, tenant_id, org_id, role, app_access, is_active)
  VALUES (
    p_user_id,
    new_id,
    new_id,
    'admin',
    '["accounting","cms","investors"]'::jsonb,
    true
  );

  result := jsonb_build_object('orgId', new_id);
  RETURN result;
END;
$$;
