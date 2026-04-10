-- 021: Bank Statements Table
-- Stores per-month bank statement data (saldo inicial/final, deposits, withdrawals)
-- for reconciliation and accurate trailing balance in reports

CREATE TABLE IF NOT EXISTS accounting_bank_statement_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id UUID REFERENCES accounting_bank_accounts(id) ON DELETE CASCADE,
  bank TEXT NOT NULL,
  account_number TEXT NOT NULL,
  currency TEXT DEFAULT 'MXN',

  -- Statement period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_month TEXT NOT NULL,

  -- Balances (per bank statement)
  opening_balance NUMERIC NOT NULL DEFAULT 0,
  total_deposits NUMERIC NOT NULL DEFAULT 0,
  total_withdrawals NUMERIC NOT NULL DEFAULT 0,
  total_fees NUMERIC DEFAULT 0,
  total_taxes NUMERIC DEFAULT 0,
  interest_earned NUMERIC DEFAULT 0,
  closing_balance NUMERIC NOT NULL DEFAULT 0,

  -- Source document
  statement_pdf_url TEXT,
  uploaded_by TEXT,

  -- Reconciliation status
  is_reconciled BOOLEAN DEFAULT false,
  reconciled_at TIMESTAMPTZ,
  reconciled_by TEXT,
  notes TEXT,

  tenant_id UUID NOT NULL,
  org_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(bank_account_id, period_month)
);

CREATE INDEX IF NOT EXISTS idx_bank_statements_account_month
  ON accounting_bank_statement_balances(bank_account_id, period_month);

ALTER TABLE accounting_bank_statement_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON accounting_bank_statement_balances FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids(auth.uid())));
CREATE POLICY "tenant_insert" ON accounting_bank_statement_balances FOR INSERT
  WITH CHECK (org_id IN (SELECT get_user_org_ids(auth.uid())));
CREATE POLICY "tenant_update" ON accounting_bank_statement_balances FOR UPDATE
  USING (org_id IN (SELECT get_user_org_ids(auth.uid())));
CREATE POLICY "tenant_delete" ON accounting_bank_statement_balances FOR DELETE
  USING (org_id IN (SELECT get_user_org_ids(auth.uid())));

-- Seed Scotiabank 25601153483 statements from Jan-Mar 2026 PDFs
DO $$
DECLARE
  v_account_id UUID;
  v_tenant_id UUID := '62f1ef3b-f133-4d91-bd87-55edac7fcd67';
  v_org_id UUID := 'a0000000-0000-0000-0000-000000000001';
BEGIN
  SELECT id INTO v_account_id
  FROM accounting_bank_accounts
  WHERE account_number = '25601153483' AND bank = 'Scotiabank'
  LIMIT 1;

  IF v_account_id IS NOT NULL THEN
    -- January 2026
    INSERT INTO accounting_bank_statement_balances (
      bank_account_id, bank, account_number, currency,
      period_start, period_end, period_month,
      opening_balance, total_deposits, total_withdrawals, total_fees, total_taxes, closing_balance,
      tenant_id, org_id
    ) VALUES (
      v_account_id, 'Scotiabank', '25601153483', 'MXN',
      '2026-01-02', '2026-01-30', '2026-01',
      344816.49, 1341712.28, 1587275.27, 695.00, 111.20, 98447.30,
      v_tenant_id, v_org_id
    ) ON CONFLICT (bank_account_id, period_month) DO UPDATE SET
      opening_balance = EXCLUDED.opening_balance,
      total_deposits = EXCLUDED.total_deposits,
      total_withdrawals = EXCLUDED.total_withdrawals,
      total_fees = EXCLUDED.total_fees,
      total_taxes = EXCLUDED.total_taxes,
      closing_balance = EXCLUDED.closing_balance;

    -- February 2026
    INSERT INTO accounting_bank_statement_balances (
      bank_account_id, bank, account_number, currency,
      period_start, period_end, period_month,
      opening_balance, total_deposits, total_withdrawals, total_fees, total_taxes, closing_balance,
      tenant_id, org_id
    ) VALUES (
      v_account_id, 'Scotiabank', '25601153483', 'MXN',
      '2026-02-03', '2026-02-27', '2026-02',
      98447.30, 1673976.95, 1530107.50, 680.00, 108.80, 241527.95,
      v_tenant_id, v_org_id
    ) ON CONFLICT (bank_account_id, period_month) DO UPDATE SET
      opening_balance = EXCLUDED.opening_balance,
      total_deposits = EXCLUDED.total_deposits,
      total_withdrawals = EXCLUDED.total_withdrawals,
      total_fees = EXCLUDED.total_fees,
      total_taxes = EXCLUDED.total_taxes,
      closing_balance = EXCLUDED.closing_balance;

    -- March 2026
    INSERT INTO accounting_bank_statement_balances (
      bank_account_id, bank, account_number, currency,
      period_start, period_end, period_month,
      opening_balance, total_deposits, total_withdrawals, total_fees, total_taxes, closing_balance,
      tenant_id, org_id
    ) VALUES (
      v_account_id, 'Scotiabank', '25601153483', 'MXN',
      '2026-03-02', '2026-03-31', '2026-03',
      241527.95, 508890.67, 659588.18, 685.00, 109.60, 90035.84,
      v_tenant_id, v_org_id
    ) ON CONFLICT (bank_account_id, period_month) DO UPDATE SET
      opening_balance = EXCLUDED.opening_balance,
      total_deposits = EXCLUDED.total_deposits,
      total_withdrawals = EXCLUDED.total_withdrawals,
      total_fees = EXCLUDED.total_fees,
      total_taxes = EXCLUDED.total_taxes,
      closing_balance = EXCLUDED.closing_balance;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
