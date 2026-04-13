-- ============================================================================
-- Migration 027: Create case_contract_versions table
-- ============================================================================
-- The CMS contract upload feature tracks version history of signed contracts.
-- Each upload creates a new version row; the previous version is marked
-- is_current=false. This supports version history and rollback.
-- ============================================================================

CREATE TABLE IF NOT EXISTS case_contract_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  filename TEXT NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT true,
  uploaded_by UUID,
  notes TEXT,
  org_id UUID,
  tenant_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_versions_case ON case_contract_versions(case_id);
CREATE INDEX IF NOT EXISTS idx_contract_versions_current ON case_contract_versions(case_id, is_current) WHERE is_current = true;

-- RLS
ALTER TABLE case_contract_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY contract_versions_select ON case_contract_versions FOR SELECT
  USING (true);

CREATE POLICY contract_versions_insert ON case_contract_versions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY contract_versions_update ON case_contract_versions FOR UPDATE
  USING (auth.uid() IS NOT NULL);

NOTIFY pgrst, 'reload schema';
