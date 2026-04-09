-- ============================================================
-- Migration 016: Add missing columns to planning tables
-- The UI uses label, amount_mxn, is_service_provider, notes
-- but the schema only has description, amount, etc.
-- Strategy: add the UI columns as aliases so both work.
-- ============================================================

-- Add missing columns to accounting_planning_expenses
ALTER TABLE accounting_planning_expenses
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS amount_mxn NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS is_service_provider BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS org_id UUID,
  ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;

-- Backfill org_id from tenant_id if any existing rows
UPDATE accounting_planning_expenses SET org_id = tenant_id WHERE org_id IS NULL AND tenant_id IS NOT NULL;

-- Add missing columns to accounting_planning_tranches
ALTER TABLE accounting_planning_tranches
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS amount_mxn NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS org_id UUID;

-- Backfill org_id from tenant_id if any existing rows
UPDATE accounting_planning_tranches SET org_id = tenant_id WHERE org_id IS NULL AND tenant_id IS NOT NULL;

-- Create trigger to keep org_id and tenant_id in sync on insert
CREATE OR REPLACE FUNCTION sync_planning_org_tenant()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tenant_id IS NULL AND NEW.org_id IS NOT NULL THEN
    NEW.tenant_id := NEW.org_id;
  END IF;
  IF NEW.org_id IS NULL AND NEW.tenant_id IS NOT NULL THEN
    NEW.org_id := NEW.tenant_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_expenses_org_tenant ON accounting_planning_expenses;
CREATE TRIGGER sync_expenses_org_tenant
  BEFORE INSERT OR UPDATE ON accounting_planning_expenses
  FOR EACH ROW EXECUTE FUNCTION sync_planning_org_tenant();

DROP TRIGGER IF EXISTS sync_tranches_org_tenant ON accounting_planning_tranches;
CREATE TRIGGER sync_tranches_org_tenant
  BEFORE INSERT OR UPDATE ON accounting_planning_tranches
  FOR EACH ROW EXECUTE FUNCTION sync_planning_org_tenant();

-- Enable RLS on planning tables (was missing from migration 006)
ALTER TABLE accounting_planning_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON accounting_planning_expenses;
CREATE POLICY tenant_isolation ON accounting_planning_expenses
  FOR ALL USING (tenant_id = get_current_tenant_id());

ALTER TABLE accounting_planning_tranches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON accounting_planning_tranches;
CREATE POLICY tenant_isolation ON accounting_planning_tranches
  FOR ALL USING (tenant_id = get_current_tenant_id());

SELECT 'Migration 016 complete — planning tables updated with UI columns + RLS' AS status;
