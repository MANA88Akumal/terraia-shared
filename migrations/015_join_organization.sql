-- ============================================================
-- Migration 015: Add join_default_organization RPC
-- Allows new users with no org membership to auto-join an org
-- by slug. Uses SECURITY DEFINER to bypass RLS on insert.
-- ============================================================

CREATE OR REPLACE FUNCTION public.join_default_organization(
  p_user_id uuid,
  p_org_slug_pattern text DEFAULT '%mana%88%',
  p_role text DEFAULT 'admin'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_org_id uuid;
  target_org_name text;
  existing_count int;
BEGIN
  -- Check if user already has org memberships
  SELECT count(*) INTO existing_count
  FROM organization_members
  WHERE user_id = p_user_id;

  IF existing_count > 0 THEN
    RETURN jsonb_build_object('status', 'already_member', 'count', existing_count);
  END IF;

  -- Find the target org
  SELECT id, name INTO target_org_id, target_org_name
  FROM organizations
  WHERE name ILIKE p_org_slug_pattern
  LIMIT 1;

  IF target_org_id IS NULL THEN
    RETURN jsonb_build_object('status', 'org_not_found');
  END IF;

  -- Add as org member
  INSERT INTO organization_members (org_id, user_id, role)
  VALUES (target_org_id, p_user_id, p_role)
  ON CONFLICT (org_id, user_id) DO UPDATE SET role = p_role;

  -- Add user_roles entry
  INSERT INTO user_roles (user_id, tenant_id, org_id, role, app_access, is_active)
  VALUES (
    p_user_id,
    target_org_id,
    target_org_id,
    p_role,
    '["accounting","cms","investors"]'::jsonb,
    true
  )
  ON CONFLICT (user_id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    org_id = EXCLUDED.org_id,
    role = EXCLUDED.role,
    app_access = EXCLUDED.app_access,
    is_active = EXCLUDED.is_active;

  -- Ensure profile exists
  INSERT INTO profiles (id, email, role, approved)
  SELECT p_user_id, u.email, p_role, true
  FROM auth.users u WHERE u.id = p_user_id
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    approved = true;

  RETURN jsonb_build_object(
    'status', 'joined',
    'org_id', target_org_id,
    'org_name', target_org_name,
    'role', p_role
  );
END;
$$;

SELECT 'Migration 015 complete — join_default_organization RPC created' AS status;
