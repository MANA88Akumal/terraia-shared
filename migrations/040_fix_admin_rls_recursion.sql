-- 040: Fix RLS recursion introduced in migration 039
-- TerraIA Platform — Admin Portal
--
-- Migration 039 added policies on profiles and user_roles that reference
-- user_roles from inside a user_roles policy. PostgreSQL can't unwind this
-- and every SELECT returns 500.
--
-- Fix: replace the policies with versions that use SECURITY DEFINER helper
-- functions. The functions run with owner privileges and therefore bypass
-- RLS, eliminating the recursion.

-- ─── Helper functions (SECURITY DEFINER — bypass RLS) ────────────────────
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND is_active = true
      AND role = 'platform_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.caller_admin_tenant_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT DISTINCT tenant_id FROM user_roles
  WHERE user_id = auth.uid()
    AND is_active = true
    AND role IN ('admin', 'tenant_admin');
$$;

CREATE OR REPLACE FUNCTION public.user_is_in_tenants(_user_id UUID, _tenant_ids UUID[])
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM user_roles
    WHERE user_id = _user_id
      AND is_active = true
      AND tenant_id = ANY(_tenant_ids)
  );
$$;

-- Supabase auth role needs execute permission on these
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.caller_admin_tenant_ids() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_in_tenants(UUID, UUID[]) TO anon, authenticated;

-- ─── Drop the recursive policies from 039 ────────────────────────────────
DROP POLICY IF EXISTS profiles_platform_admin_all ON profiles;
DROP POLICY IF EXISTS profiles_platform_admin_write ON profiles;
DROP POLICY IF EXISTS profiles_tenant_admin_read ON profiles;
DROP POLICY IF EXISTS profiles_self_read ON profiles;
DROP POLICY IF EXISTS profiles_self_write ON profiles;
DROP POLICY IF EXISTS user_roles_platform_admin_read ON user_roles;
DROP POLICY IF EXISTS user_roles_platform_admin_write ON user_roles;
DROP POLICY IF EXISTS user_roles_tenant_admin_read ON user_roles;
DROP POLICY IF EXISTS user_roles_tenant_admin_write ON user_roles;

-- ─── Recreate using SECURITY DEFINER helpers ─────────────────────────────
-- profiles
CREATE POLICY profiles_self_read ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY profiles_self_write ON profiles FOR UPDATE USING (id = auth.uid());

CREATE POLICY profiles_platform_admin_all ON profiles FOR SELECT
  USING (public.is_platform_admin());

CREATE POLICY profiles_platform_admin_write ON profiles FOR UPDATE
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY profiles_tenant_admin_read ON profiles FOR SELECT
  USING (public.user_is_in_tenants(profiles.id, ARRAY(SELECT public.caller_admin_tenant_ids())));

-- user_roles
-- (The existing user_roles_select policy from 006 is "user_id = auth.uid()".
--  We leave that alone; it's non-recursive and correct.)

CREATE POLICY user_roles_platform_admin_read ON user_roles FOR SELECT
  USING (public.is_platform_admin());

CREATE POLICY user_roles_platform_admin_write ON user_roles FOR ALL
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY user_roles_tenant_admin_read ON user_roles FOR SELECT
  USING (tenant_id IN (SELECT public.caller_admin_tenant_ids()));

CREATE POLICY user_roles_tenant_admin_write ON user_roles FOR ALL
  USING (tenant_id IN (SELECT public.caller_admin_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.caller_admin_tenant_ids()));

NOTIFY pgrst, 'reload schema';
