-- 035: Announcements and newsletters
-- TerraIA Platform — Client Portal
--
-- Backing tables for the client-portal Updates page. Both are tenant-scoped so
-- a second community never sees MANA 88 content (or vice versa). The portal
-- filters by tenant_id on every query; RLS keeps reads permissive so anon (not
-- yet authenticated) owners can still see their updates while admins manage
-- the content via Supabase or a future CMS page.

-- ─── Announcements ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_tenant ON announcements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_announcements_published ON announcements(tenant_id, published_at DESC);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "announcements_public_read" ON announcements FOR SELECT USING (true);
CREATE POLICY "announcements_auth_insert" ON announcements FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "announcements_auth_update" ON announcements FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "announcements_auth_delete" ON announcements FOR DELETE USING (auth.uid() IS NOT NULL);

-- ─── Newsletters ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS newsletters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  title TEXT NOT NULL,
  issue_date DATE NOT NULL,
  file_url TEXT,
  preview_image_url TEXT,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_newsletters_tenant ON newsletters(tenant_id);
CREATE INDEX IF NOT EXISTS idx_newsletters_issue ON newsletters(tenant_id, issue_date DESC);

ALTER TABLE newsletters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "newsletters_public_read" ON newsletters FOR SELECT USING (true);
CREATE POLICY "newsletters_auth_insert" ON newsletters FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "newsletters_auth_update" ON newsletters FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "newsletters_auth_delete" ON newsletters FOR DELETE USING (auth.uid() IS NOT NULL);

-- ─── Seed: MANA 88 sample rows ────────────────────────────────────────────
-- MANA 88 tenant_id per CLAUDE.md
INSERT INTO announcements (tenant_id, title, body, is_pinned)
VALUES
  ('62f1ef3b-f133-4d91-bd87-55edac7fcd67',
   'Evento de propietarios — Mayo 2026',
   'Te invitamos al primer evento anual de propietarios MANA 88 en Akumal. Cupo limitado.',
   true),
  ('62f1ef3b-f133-4d91-bd87-55edac7fcd67',
   'Nueva amenidad: Beach Club',
   'El Beach Club privado abrirá sus puertas en el primer trimestre del próximo año.',
   false)
ON CONFLICT DO NOTHING;

INSERT INTO newsletters (tenant_id, title, issue_date, file_url, summary)
VALUES
  ('62f1ef3b-f133-4d91-bd87-55edac7fcd67',
   'MANA 88 Newsletter — Marzo 2026',
   '2026-03-31',
   NULL,
   'Avances de obra, eventos de comunidad y nuevas amenidades.'),
  ('62f1ef3b-f133-4d91-bd87-55edac7fcd67',
   'MANA 88 Newsletter — Febrero 2026',
   '2026-02-28',
   NULL,
   'Hitos alcanzados en el trimestre y próximas entregas.')
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
