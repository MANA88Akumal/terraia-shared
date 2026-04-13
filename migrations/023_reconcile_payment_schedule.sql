-- ============================================================================
-- Migration 023: Reconcile payment_schedule with actual cms_payments
-- ============================================================================
-- Problem: payment_schedule.paid_amount_mxn and status are stale.
-- Payments are recorded in cms_payments but the schedule items are never
-- updated. The FIFO reconciliation only runs in the frontend display
-- (reconcileSchedule function), not at the database level.
--
-- This migration:
-- 1. Computes the actual total paid per case from cms_payments
-- 2. Applies a FIFO waterfall to each case's schedule items
-- 3. Updates paid_amount_mxn and status on every payment_schedule row
-- ============================================================================

-- Step 1: Create a function that reconciles a single case
CREATE OR REPLACE FUNCTION reconcile_case_schedule(p_case_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  total_paid DECIMAL(14,2);
  remaining DECIMAL(14,2);
  sched RECORD;
  item_amount DECIMAL(14,2);
  paid_for_item DECIMAL(14,2);
  new_status TEXT;
BEGIN
  -- Sum all actual payments for this case
  SELECT COALESCE(SUM(amount_mxn), 0) INTO total_paid
  FROM cms_payments WHERE case_id = p_case_id;

  remaining := total_paid;

  -- Walk through schedule items in order (FIFO waterfall)
  FOR sched IN
    SELECT id, amount_mxn, status
    FROM payment_schedule
    WHERE case_id = p_case_id
    ORDER BY schedule_index ASC
  LOOP
    item_amount := COALESCE(sched.amount_mxn, 0);

    IF item_amount <= 0 THEN
      -- Zero-amount items are considered paid
      paid_for_item := 0;
      new_status := 'paid';
    ELSIF remaining >= item_amount THEN
      -- Fully paid
      paid_for_item := item_amount;
      remaining := remaining - item_amount;
      new_status := 'paid';
    ELSIF remaining > 0 THEN
      -- Partially paid
      paid_for_item := remaining;
      remaining := 0;
      new_status := 'partial';
    ELSE
      -- Not paid at all
      paid_for_item := 0;
      -- Check if overdue
      IF sched.status = 'overdue' THEN
        new_status := 'overdue';
      ELSE
        new_status := 'pending';
      END IF;
    END IF;

    -- Update the schedule item
    UPDATE payment_schedule
    SET paid_amount_mxn = paid_for_item,
        status = new_status,
        updated_at = now()
    WHERE id = sched.id;
  END LOOP;

  -- Mark items with due_date in the past as overdue if still pending
  UPDATE payment_schedule
  SET status = 'overdue', updated_at = now()
  WHERE case_id = p_case_id
    AND status = 'pending'
    AND due_date < CURRENT_DATE;
END;
$$;

-- Step 2: Run the reconciliation for ALL cases that have payments
DO $$
DECLARE
  c RECORD;
  count INT := 0;
BEGIN
  FOR c IN
    SELECT DISTINCT case_id FROM payment_schedule WHERE case_id IS NOT NULL
  LOOP
    PERFORM reconcile_case_schedule(c.case_id);
    count := count + 1;
  END LOOP;
  RAISE NOTICE 'Reconciled % cases', count;
END;
$$;

-- Step 3: Verify — show the before/after summary
-- (Run this SELECT separately to see results)
-- SELECT
--   status,
--   COUNT(*) as count,
--   SUM(amount_mxn) as total_amount,
--   SUM(paid_amount_mxn) as total_paid
-- FROM payment_schedule
-- GROUP BY status
-- ORDER BY status;

NOTIFY pgrst, 'reload schema';
