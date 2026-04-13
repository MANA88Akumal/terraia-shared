-- ============================================================================
-- Migration 024: Auto-reconcile payment_schedule on cms_payments changes
-- ============================================================================
-- Whenever a row is inserted, updated, or deleted in cms_payments,
-- automatically re-run the FIFO waterfall for that case so
-- payment_schedule.paid_amount_mxn and status are always accurate.
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_reconcile_on_payment_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- On INSERT or UPDATE, reconcile the new case_id
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM reconcile_case_schedule(NEW.case_id);
    -- If case_id changed on UPDATE, also reconcile the old case
    IF TG_OP = 'UPDATE' AND OLD.case_id IS DISTINCT FROM NEW.case_id THEN
      PERFORM reconcile_case_schedule(OLD.case_id);
    END IF;
    RETURN NEW;
  END IF;

  -- On DELETE, reconcile the case that lost a payment
  IF TG_OP = 'DELETE' THEN
    PERFORM reconcile_case_schedule(OLD.case_id);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- Drop if exists (safe re-run)
DROP TRIGGER IF EXISTS trg_auto_reconcile_payments ON cms_payments;

-- Fire AFTER any change to cms_payments
CREATE TRIGGER trg_auto_reconcile_payments
  AFTER INSERT OR UPDATE OR DELETE ON cms_payments
  FOR EACH ROW
  EXECUTE FUNCTION auto_reconcile_on_payment_change();

COMMENT ON TRIGGER trg_auto_reconcile_payments ON cms_payments IS
  'Automatically re-runs the FIFO payment waterfall on payment_schedule whenever a payment is recorded, updated, or deleted. Keeps paid_amount_mxn and status in sync without manual intervention.';

NOTIFY pgrst, 'reload schema';
