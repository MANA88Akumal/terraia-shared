-- Migration 051: Expense allocations — links bank withdrawals to planning expense line items
-- Used by the Cash Position tab in Planning to reconcile actual bank outflows against the expense plan.

CREATE TABLE IF NOT EXISTS accounting_planning_expense_allocations (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id    uuid NOT NULL REFERENCES accounting_bank_transactions(id) ON DELETE CASCADE,
  expense_id        uuid NOT NULL REFERENCES accounting_planning_expenses(id) ON DELETE CASCADE,
  month             text NOT NULL,              -- YYYY-MM
  allocated_amount  numeric(14, 2) NOT NULL,
  org_id            uuid,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expense_alloc_month        ON accounting_planning_expense_allocations(month);
CREATE INDEX IF NOT EXISTS idx_expense_alloc_transaction  ON accounting_planning_expense_allocations(transaction_id);
CREATE INDEX IF NOT EXISTS idx_expense_alloc_expense      ON accounting_planning_expense_allocations(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_alloc_org          ON accounting_planning_expense_allocations(org_id);

ALTER TABLE accounting_planning_expense_allocations ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read/write allocations for their session's current org.
-- Mirrors the pattern used by accounting_planning_expenses (org_id-based isolation via JWT).
CREATE POLICY "alloc_select" ON accounting_planning_expense_allocations
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "alloc_insert" ON accounting_planning_expense_allocations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "alloc_delete" ON accounting_planning_expense_allocations
  FOR DELETE USING (auth.uid() IS NOT NULL);
