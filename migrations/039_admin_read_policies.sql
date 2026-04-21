-- 039: Platform/tenant admin read policies for identity tables
-- TerraIA Platform — Admin Portal
--
-- The admin portal's /users and /orgs lists query profiles, user_roles, and
-- tenants. Existing RLS scopes those to the caller's own rows, which means
-- even a platform_admin sees only themselves. This migration adds:
--   - profiles.profiles_platform_admin_all   (SELECT all for platform_admin)
--   - profiles.profiles_tenant_admin_read    (SELECT profiles in the tenants
--                                             where the caller is admin/tenant_admin)
--   - user_roles.user_roles_platform_admin_read (same, for cross-user role lookup)
--   - user_roles.user_roles_tenant_admin_read   (same, tenant-scoped)
-- The existing "own row" policies are left in place — users keep reading
-- their own data the same way.

-- ─── profiles ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_platform_admin_all') THEN
    CREATE POLICY profiles_platform_admin_all ON profiles FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid() AND is_active = true AND role = 'platform_admin'
      ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_tenant_admin_read') THEN
    CREATE POLICY profiles_tenant_admin_read ON profiles FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM user_roles ur_caller
        JOIN user_roles ur_target ON ur_target.tenant_id = ur_caller.tenant_id
        WHERE ur_caller.user_id = auth.uid()
          AND ur_caller.is_active = true
          AND ur_caller.role IN ('admin', 'tenant_admin')
          AND ur_target.user_id = profiles.id
          AND ur_target.is_active = true
      ));
  END IF;

  -- Make sure users can always SELECT their own row (safety net in case
  -- the existing policy was named differently or never created)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_self_read') THEN
    CREATE POLICY profiles_self_read ON profiles FOR SELECT USING (id = auth.uid());
  END IF;
END $$;

-- ─── user_roles ──────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_roles' AND policyname = 'user_roles_platform_admin_read') THEN
    CREATE POLICY user_roles_platform_admin_read ON user_roles FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM user_roles self_ur
        WHERE self_ur.user_id = auth.uid() AND self_ur.is_active = true AND self_ur.role = 'platform_admin'
      ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_roles' AND policyname = 'user_roles_tenant_admin_read') THEN
    CREATE POLICY user_roles_tenant_admin_read ON user_roles FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM user_roles ur_caller
        WHERE ur_caller.user_id = auth.uid()
          AND ur_caller.is_active = true
          AND ur_caller.role IN ('admin', 'tenant_admin')
          AND ur_caller.tenant_id = user_roles.tenant_id
      ));
  END IF;

  -- Platform admins can UPDATE/DELETE any row; tenant admins can modify
  -- rows within their tenants.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_roles' AND policyname = 'user_roles_platform_admin_write') THEN
    CREATE POLICY user_roles_platform_admin_write ON user_roles FOR ALL
      USING (EXISTS (
        SELECT 1 FROM user_roles self_ur
        WHERE self_ur.user_id = auth.uid() AND self_ur.is_active = true AND self_ur.role = 'platform_admin'
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM user_roles self_ur
        WHERE self_ur.user_id = auth.uid() AND self_ur.is_active = true AND self_ur.role = 'platform_admin'
      ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_roles' AND policyname = 'user_roles_tenant_admin_write') THEN
    CREATE POLICY user_roles_tenant_admin_write ON user_roles FOR ALL
      USING (EXISTS (
        SELECT 1 FROM user_roles ur_caller
        WHERE ur_caller.user_id = auth.uid()
          AND ur_caller.is_active = true
          AND ur_caller.role IN ('admin', 'tenant_admin')
          AND ur_caller.tenant_id = user_roles.tenant_id
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM user_roles ur_caller
        WHERE ur_caller.user_id = auth.uid()
          AND ur_caller.is_active = true
          AND ur_caller.role IN ('admin', 'tenant_admin')
          AND ur_caller.tenant_id = user_roles.tenant_id
      ));
  END IF;
END $$;

-- ─── profiles write (for admin approve/disable toggles) ─────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_platform_admin_write') THEN
    CREATE POLICY profiles_platform_admin_write ON profiles FOR UPDATE
      USING (EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid() AND is_active = true AND role = 'platform_admin'
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid() AND is_active = true AND role = 'platform_admin'
      ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_self_write') THEN
    CREATE POLICY profiles_self_write ON profiles FOR UPDATE USING (id = auth.uid());
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
