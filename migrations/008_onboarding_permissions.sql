-- ============================================================
-- Fix onboarding data import permissions
-- 1. Change COA unique constraint to per-org (multi-tenant safe)
-- 2. Grant INSERT/SELECT/UPDATE/DELETE to authenticated role
-- 3. Enable RLS on COA and vendors tables
-- ============================================================

-- 1a. Drop FK constraints that depend on the old UNIQUE(code)
ALTER TABLE accounting_bank_transactions
  DROP CONSTRAINT IF EXISTS accounting_bank_transactions_account_code_fkey;
ALTER TABLE accounting_cash_log
  DROP CONSTRAINT IF EXISTS accounting_cash_log_account_code_fkey;

-- 1b. Drop old UNIQUE(code), add UNIQUE(code, org_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'accounting_chart_of_accounts'::regclass
      AND contype = 'u'
      AND conname = 'accounting_chart_of_accounts_code_key'
  ) THEN
    ALTER TABLE accounting_chart_of_accounts DROP CONSTRAINT accounting_chart_of_accounts_code_key;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'accounting_chart_of_accounts'::regclass
      AND contype = 'u'
      AND conname = 'accounting_chart_of_accounts_code_org_key'
  ) THEN
    ALTER TABLE accounting_chart_of_accounts
      ADD CONSTRAINT accounting_chart_of_accounts_code_org_key UNIQUE(code, org_id);
  END IF;
END $$;

-- 1c. Re-add FK constraints as composite (account_code + org_id → code + org_id)
ALTER TABLE accounting_bank_transactions
  ADD CONSTRAINT accounting_bank_transactions_account_code_fkey
  FOREIGN KEY (account_code, org_id) REFERENCES accounting_chart_of_accounts(code, org_id);

ALTER TABLE accounting_cash_log
  ADD CONSTRAINT accounting_cash_log_account_code_fkey
  FOREIGN KEY (account_code, org_id) REFERENCES accounting_chart_of_accounts(code, org_id);

-- 2. Grant permissions to authenticated role on all onboarding-related tables
DO $$
DECLARE
  tbl TEXT;
  tables_to_grant TEXT[] := ARRAY[
    'lots',
    'clients',
    'cases',
    'brokers',
    'accounting_vendors',
    'accounting_chart_of_accounts',
    'accounting_bank_transactions',
    'accounting_bank_accounts',
    'organizations',
    'organization_members',
    'tenants',
    'user_roles'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables_to_grant LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO authenticated', tbl);
      RAISE NOTICE 'Granted permissions on %', tbl;
    ELSE
      RAISE NOTICE 'Table % does not exist, skipping GRANT', tbl;
    END IF;
  END LOOP;
END $$;

-- 3. Enable RLS on tables that don't have it yet but should
DO $$
DECLARE
  tbl TEXT;
  tables_needing_rls TEXT[] := ARRAY[
    'accounting_chart_of_accounts',
    'accounting_vendors'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables_needing_rls LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'tenant_id'
    ) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tbl);
      EXECUTE format(
        'CREATE POLICY tenant_isolation ON %I FOR ALL USING (tenant_id = get_current_tenant_id())',
        tbl
      );
      RAISE NOTICE 'RLS enabled on %', tbl;
    END IF;
  END LOOP;
END $$;

SELECT 'Migration 008 complete' AS status;
