-- 018: Construction Management Tables
-- MANA 88 / TerraIA Platform

-- Phases
CREATE TABLE IF NOT EXISTS construction_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  progress_pct INTEGER DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','completed','on_hold')),
  sort_order INTEGER DEFAULT 0,
  tenant_id UUID NOT NULL,
  org_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Milestones
CREATE TABLE IF NOT EXISTS construction_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID NOT NULL REFERENCES construction_phases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  target_date DATE,
  completed_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','overdue')),
  tenant_id UUID NOT NULL,
  org_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tasks (for Gantt chart)
CREATE TABLE IF NOT EXISTS construction_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id UUID REFERENCES construction_milestones(id) ON DELETE SET NULL,
  phase_id UUID NOT NULL REFERENCES construction_phases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  progress_pct INTEGER DEFAULT 0,
  assigned_to TEXT,
  tenant_id UUID NOT NULL,
  org_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Photos
CREATE TABLE IF NOT EXISTS construction_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  caption TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  taken_date DATE DEFAULT CURRENT_DATE,
  milestone_id UUID REFERENCES construction_milestones(id) ON DELETE SET NULL,
  phase_id UUID REFERENCES construction_phases(id) ON DELETE SET NULL,
  uploaded_by TEXT,
  tenant_id UUID NOT NULL,
  org_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Field Reports
CREATE TABLE IF NOT EXISTS construction_field_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  report_type TEXT DEFAULT 'daily' CHECK (report_type IN ('daily','weekly')),
  weather TEXT,
  temperature_high NUMERIC,
  temperature_low NUMERIC,
  crew_count INTEGER,
  work_summary TEXT NOT NULL,
  materials_used TEXT,
  issues TEXT,
  delays TEXT,
  safety_notes TEXT,
  phase_id UUID REFERENCES construction_phases(id),
  created_by TEXT,
  tenant_id UUID NOT NULL,
  org_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Report-Photo junction
CREATE TABLE IF NOT EXISTS construction_report_photos (
  report_id UUID NOT NULL REFERENCES construction_field_reports(id) ON DELETE CASCADE,
  photo_id UUID NOT NULL REFERENCES construction_photos(id) ON DELETE CASCADE,
  PRIMARY KEY (report_id, photo_id)
);

-- Documents
CREATE TABLE IF NOT EXISTS construction_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  file_url TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  description TEXT,
  uploaded_by TEXT,
  tenant_id UUID NOT NULL,
  org_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE construction_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE construction_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE construction_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE construction_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE construction_field_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE construction_report_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE construction_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies (using get_user_org_ids for non-recursive lookup)
CREATE POLICY "tenant_select" ON construction_phases FOR SELECT USING (org_id IN (SELECT get_user_org_ids(auth.uid())));
CREATE POLICY "tenant_insert" ON construction_phases FOR INSERT WITH CHECK (org_id IN (SELECT get_user_org_ids(auth.uid())));
CREATE POLICY "tenant_update" ON construction_phases FOR UPDATE USING (org_id IN (SELECT get_user_org_ids(auth.uid())));
CREATE POLICY "tenant_delete" ON construction_phases FOR DELETE USING (org_id IN (SELECT get_user_org_ids(auth.uid())));

CREATE POLICY "tenant_select" ON construction_milestones FOR SELECT USING (org_id IN (SELECT get_user_org_ids(auth.uid())));
CREATE POLICY "tenant_insert" ON construction_milestones FOR INSERT WITH CHECK (org_id IN (SELECT get_user_org_ids(auth.uid())));
CREATE POLICY "tenant_update" ON construction_milestones FOR UPDATE USING (org_id IN (SELECT get_user_org_ids(auth.uid())));
CREATE POLICY "tenant_delete" ON construction_milestones FOR DELETE USING (org_id IN (SELECT get_user_org_ids(auth.uid())));

CREATE POLICY "tenant_select" ON construction_tasks FOR SELECT USING (org_id IN (SELECT get_user_org_ids(auth.uid())));
CREATE POLICY "tenant_insert" ON construction_tasks FOR INSERT WITH CHECK (org_id IN (SELECT get_user_org_ids(auth.uid())));
CREATE POLICY "tenant_update" ON construction_tasks FOR UPDATE USING (org_id IN (SELECT get_user_org_ids(auth.uid())));
CREATE POLICY "tenant_delete" ON construction_tasks FOR DELETE USING (org_id IN (SELECT get_user_org_ids(auth.uid())));

CREATE POLICY "tenant_select" ON construction_photos FOR SELECT USING (org_id IN (SELECT get_user_org_ids(auth.uid())));
CREATE POLICY "tenant_insert" ON construction_photos FOR INSERT WITH CHECK (org_id IN (SELECT get_user_org_ids(auth.uid())));
CREATE POLICY "tenant_update" ON construction_photos FOR UPDATE USING (org_id IN (SELECT get_user_org_ids(auth.uid())));

CREATE POLICY "tenant_select" ON construction_field_reports FOR SELECT USING (org_id IN (SELECT get_user_org_ids(auth.uid())));
CREATE POLICY "tenant_insert" ON construction_field_reports FOR INSERT WITH CHECK (org_id IN (SELECT get_user_org_ids(auth.uid())));
CREATE POLICY "tenant_update" ON construction_field_reports FOR UPDATE USING (org_id IN (SELECT get_user_org_ids(auth.uid())));

CREATE POLICY "tenant_select" ON construction_report_photos FOR SELECT USING (true);
CREATE POLICY "tenant_insert" ON construction_report_photos FOR INSERT WITH CHECK (true);

CREATE POLICY "tenant_select" ON construction_documents FOR SELECT USING (org_id IN (SELECT get_user_org_ids(auth.uid())));
CREATE POLICY "tenant_insert" ON construction_documents FOR INSERT WITH CHECK (org_id IN (SELECT get_user_org_ids(auth.uid())));
CREATE POLICY "tenant_update" ON construction_documents FOR UPDATE USING (org_id IN (SELECT get_user_org_ids(auth.uid())));

-- Storage buckets (run in Supabase dashboard if these fail)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('construction-photos', 'construction-photos', true) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('construction-documents', 'construction-documents', false) ON CONFLICT DO NOTHING;
