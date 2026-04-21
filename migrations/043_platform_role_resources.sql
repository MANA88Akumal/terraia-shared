-- 043: Resource registry for the permissions matrix
-- TerraIA Platform — Admin Portal
--
-- platform_role_permissions stores (role × resource_key → access). This
-- migration adds the companion `platform_role_resources` table so the admin
-- UI can render human labels, group by app, and show the underlying route
-- without re-parsing the XLSX on every page load.

CREATE TABLE IF NOT EXISTS platform_role_resources (
  resource_key TEXT PRIMARY KEY,                   -- e.g. 'owner-portal:/payments'
  app TEXT NOT NULL,                               -- e.g. 'owner-portal'
  area TEXT,                                       -- e.g. 'Finance'
  label TEXT NOT NULL,                             -- human page name
  route TEXT,                                      -- route / target
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_role_resources_app ON platform_role_resources(app);

ALTER TABLE platform_role_resources ENABLE ROW LEVEL SECURITY;

-- All authenticated users can READ the resource registry so app-side guards
-- can resolve a resource_key → label without admin rights. Only platform
-- admins can modify.
CREATE POLICY role_resources_read ON platform_role_resources FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY role_resources_write ON platform_role_resources FOR ALL
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

NOTIFY pgrst, 'reload schema';
