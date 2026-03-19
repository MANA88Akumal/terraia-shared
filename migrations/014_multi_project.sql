-- ============================================================
-- Migration 014: Multi-Project Support
--
-- Fixes 4 blockers preventing users from having multiple projects:
-- 1. seed_organization() overwrites existing org via ON CONFLICT (user_id)
-- 2. get_current_tenant_id() uses LIMIT 1 with no selection mechanism
-- 3. user_roles has UNIQUE(user_id) preventing multiple role rows
-- 4. switchOrg() only updates React state, not Supabase JWT
--
-- Solution: Store active org in JWT user_metadata.current_org_id,
-- read it in get_current_tenant_id(), fix constraints + RPC.
-- ============================================================

-- =============================================
-- PART 1: Drop UNIQUE(user_id) on user_roles
-- Keep UNIQUE(user_id, tenant_id) — allows one role per org per user
-- =============================================

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  -- Find and drop any UNIQUE constraint on user_id alone (not composite)
  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'user_roles'
      AND c.contype = 'u'
      AND array_length(c.conkey, 1) = 1  -- single-column constraint
      AND c.conkey[1] = (
        SELECT a.attnum FROM pg_attribute a
        WHERE a.attrelid = t.oid AND a.attname = 'user_id'
      )
  LOOP
    EXECUTE format('ALTER TABLE user_roles DROP CONSTRAINT %I', constraint_name);
    RAISE NOTICE 'Dropped UNIQUE constraint % on user_roles(user_id)', constraint_name;
  END LOOP;
END $$;

-- Also drop UNIQUE(user_id) on organization_members if it exists
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'organization_members'
      AND c.contype = 'u'
      AND array_length(c.conkey, 1) = 1
      AND c.conkey[1] = (
        SELECT a.attnum FROM pg_attribute a
        WHERE a.attrelid = t.oid AND a.attname = 'user_id'
      )
  LOOP
    EXECUTE format('ALTER TABLE organization_members DROP CONSTRAINT %I', constraint_name);
    RAISE NOTICE 'Dropped UNIQUE constraint % on organization_members(user_id)', constraint_name;
  END LOOP;
END $$;

-- Ensure composite UNIQUE(user_id, tenant_id) exists on user_roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'user_roles'::regclass AND contype = 'u'
      AND conname = 'user_roles_user_id_tenant_id_key'
  ) THEN
    ALTER TABLE user_roles ADD CONSTRAINT user_roles_user_id_tenant_id_key UNIQUE(user_id, tenant_id);
    RAISE NOTICE 'Added UNIQUE(user_id, tenant_id) on user_roles';
  END IF;
END $$;

-- =============================================
-- PART 2: Rewrite get_current_tenant_id()
-- Primary: read current_org_id from JWT metadata
-- Fallback: existing LIMIT 1 behavior
-- =============================================

CREATE OR REPLACE FUNCTION get_current_tenant_id() RETURNS UUID AS $$
  SELECT COALESCE(
    -- Primary: read from JWT user_metadata (set by client via auth.updateUser)
    (auth.jwt() -> 'user_metadata' ->> 'current_org_id')::uuid,
    -- Fallback: first active role (for users who haven't switched yet)
    (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid() AND is_active = TRUE LIMIT 1)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- =============================================
-- PART 3: Fix seed_organization() RPC
-- Use ON CONFLICT (user_id, tenant_id) DO NOTHING instead of
-- ON CONFLICT (user_id) DO UPDATE which overwrote existing orgs
-- Also set current_org_id in user metadata after creating org
-- =============================================

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

  -- 3. Add user as org owner (DO NOTHING if already a member)
  INSERT INTO organization_members (org_id, user_id, role)
  VALUES (new_id, p_user_id, 'owner')
  ON CONFLICT (org_id, user_id) DO NOTHING;

  -- 4. Add user_roles entry — DO NOTHING if already exists for this user+tenant
  INSERT INTO user_roles (user_id, tenant_id, org_id, role, app_access, is_active)
  VALUES (
    p_user_id,
    new_id,
    new_id,
    'admin',
    '["accounting","cms","investors"]'::jsonb,
    true
  )
  ON CONFLICT (user_id, tenant_id) DO NOTHING;

  -- 5. Set current_org_id in user metadata so RLS picks up the new org
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('current_org_id', new_id)
  WHERE id = p_user_id;

  result := jsonb_build_object('orgId', new_id);
  RETURN result;
END;
$$;

-- =============================================
-- PART 4: Validation helper — set_current_org RPC
-- Verifies the user has access before accepting an org switch.
-- The actual metadata update happens client-side via auth.updateUser,
-- but this RPC can be used as a server-side validation.
-- =============================================

CREATE OR REPLACE FUNCTION public.set_current_org(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify user has access to this org
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND tenant_id = p_org_id
      AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  -- Update user metadata with the selected org
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('current_org_id', p_org_id)
  WHERE id = auth.uid();
END;
$$;

-- =============================================
-- VERIFY
-- =============================================
SELECT 'Migration 014 complete — multi-project support enabled' AS status;
