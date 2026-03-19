-- Migration 013: Sync tenant_id from org_id automatically
--
-- Problem: Migration 006 created RLS policies that check tenant_id, but app code
-- only sets org_id on inserts. This causes silent insert failures.
--
-- Fix: Create a trigger that auto-copies org_id → tenant_id on INSERT/UPDATE
-- for all tables that have both columns.

-- ═══════════════════════════════════════════════════════════
-- 1. Trigger function: auto-set tenant_id = org_id
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION sync_tenant_from_org()
RETURNS TRIGGER AS $$
BEGIN
  -- If tenant_id is NULL but org_id is set, copy it
  IF NEW.tenant_id IS NULL AND NEW.org_id IS NOT NULL THEN
    NEW.tenant_id := NEW.org_id;
  END IF;
  -- If org_id is NULL but tenant_id is set, copy the other way
  IF NEW.org_id IS NULL AND NEW.tenant_id IS NOT NULL THEN
    NEW.org_id := NEW.tenant_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════
-- 2. Apply trigger to all tables with both org_id and tenant_id
-- ═══════════════════════════════════════════════════════════

DO $$
DECLARE
  tbl TEXT;
  tables_to_fix TEXT[] := ARRAY[
    'cases',
    'clients',
    'lots',
    'offers',
    'offer_notes',
    'cms_notifications',
    'cms_payments',
    'payment_schedule',
    'brokers',
    'broker_leads',
    'broker_commissions',
    'broker_commission_milestones',
    'construction_phases',
    'construction_photos',
    'construction_draws',
    'vault_files',
    'vault_access_log',
    'vault_shared_links',
    'vault_checklists',
    'saved_scenarios',
    'scenario_config',
    'scenario_projections',
    'scenario_financing_mix',
    'accounting_bank_transactions',
    'accounting_bank_accounts',
    'accounting_vendors',
    'accounting_chart_of_accounts',
    'accounting_facturas',
    'accounting_cash_log',
    'accounting_categories',
    'project_findings',
    'analysis_runs'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables_to_fix LOOP
    -- Only create trigger if table exists and has both columns
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = tbl AND column_name = 'org_id'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = tbl AND column_name = 'tenant_id'
    ) THEN
      -- Drop existing trigger if any
      EXECUTE format('DROP TRIGGER IF EXISTS trg_sync_tenant_org ON %I', tbl);
      -- Create trigger
      EXECUTE format(
        'CREATE TRIGGER trg_sync_tenant_org BEFORE INSERT OR UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION sync_tenant_from_org()',
        tbl
      );
      RAISE NOTICE 'Trigger created on %', tbl;
    ELSE
      RAISE NOTICE 'Skipping % (missing org_id or tenant_id)', tbl;
    END IF;
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════
-- 3. Backfill: Set tenant_id = org_id where tenant_id is NULL
-- ═══════════════════════════════════════════════════════════

DO $$
DECLARE
  tbl TEXT;
  tables_to_fix TEXT[] := ARRAY[
    'cases', 'clients', 'lots', 'offers', 'offer_notes',
    'cms_notifications', 'cms_payments', 'payment_schedule',
    'brokers', 'broker_leads', 'broker_commissions',
    'construction_phases', 'construction_photos', 'construction_draws',
    'vault_files', 'vault_shared_links', 'vault_checklists',
    'saved_scenarios', 'scenario_config', 'scenario_projections',
    'accounting_bank_transactions', 'accounting_vendors',
    'accounting_chart_of_accounts', 'project_findings', 'analysis_runs'
  ];
  cnt INT;
BEGIN
  FOREACH tbl IN ARRAY tables_to_fix LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = tbl AND column_name = 'org_id'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = tbl AND column_name = 'tenant_id'
    ) THEN
      EXECUTE format(
        'UPDATE %I SET tenant_id = org_id WHERE tenant_id IS NULL AND org_id IS NOT NULL',
        tbl
      );
      GET DIAGNOSTICS cnt = ROW_COUNT;
      IF cnt > 0 THEN
        RAISE NOTICE 'Backfilled % rows in %', cnt, tbl;
      END IF;
    END IF;
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════
-- 4. Also update RLS: Add org_id-based policy as alternative
--    (so queries using .eq('org_id', ...) work without tenant_id)
-- ═══════════════════════════════════════════════════════════

-- For brokers table: ensure user can see their own broker record
DROP POLICY IF EXISTS brokers_self_select ON brokers;
CREATE POLICY brokers_self_select ON brokers FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS brokers_org_select ON brokers;
CREATE POLICY brokers_org_select ON brokers FOR SELECT TO authenticated
  USING (
    org_id IN (
      SELECT om.org_id FROM organization_members om WHERE om.user_id = auth.uid()
      UNION
      SELECT ur.tenant_id FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.is_active = TRUE
    )
  );

-- For broker_leads: brokers can manage their own leads
DROP POLICY IF EXISTS broker_leads_own ON broker_leads;
CREATE POLICY broker_leads_own ON broker_leads FOR ALL TO authenticated
  USING (
    broker_id IN (SELECT id FROM brokers WHERE user_id = auth.uid())
    OR org_id IN (
      SELECT om.org_id FROM organization_members om WHERE om.user_id = auth.uid()
      UNION
      SELECT ur.tenant_id FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.is_active = TRUE
    )
  );
