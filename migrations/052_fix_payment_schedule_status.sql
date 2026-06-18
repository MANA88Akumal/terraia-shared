-- Migration 052: Audit and fix payment_schedule items whose status is wrong
-- ---------------------------------------------------------------------------
-- Root cause: payments recorded without schedule_id (or via bulk import) left
-- payment_schedule.status as 'partial'/'pending' even when direct payments
-- fully cover the scheduled amount. The Collections page reads status directly,
-- so incorrect statuses drive erroneous overdue emails to clients.
--
-- Strategy: for each schedule item, sum the cms_payments rows explicitly linked
-- to it via schedule_id (excluding refunds). If that total covers >= 99% of the
-- scheduled amount, mark the item paid and sync paid_amount_mxn / paid_date.
-- The 99% threshold absorbs floating-point rounding from currency conversion.
--
-- STEP 1 — Audit (run this SELECT first and review the output):

SELECT
  c.case_id,
  cl.full_name                                                            AS client_name,
  ps.label,
  ps.amount_mxn                                                           AS scheduled,
  ps.paid_amount_mxn                                                      AS stored_paid,
  COALESCE(SUM(cp.amount_mxn) FILTER (WHERE cp.payment_type != 'refund'), 0)
                                                                          AS direct_linked_total,
  ps.status                                                               AS stored_status,
  ps.due_date
FROM payment_schedule ps
JOIN cases c ON c.id = ps.case_id
LEFT JOIN clients cl ON cl.id = c.client_id
LEFT JOIN cms_payments cp ON cp.schedule_id = ps.id
WHERE ps.status IN ('partial', 'pending', 'overdue')
  AND ps.amount_mxn > 0
GROUP BY
  ps.id, c.case_id, cl.full_name, ps.label,
  ps.amount_mxn, ps.paid_amount_mxn, ps.status, ps.due_date
HAVING
  COALESCE(SUM(cp.amount_mxn) FILTER (WHERE cp.payment_type != 'refund'), 0)
    >= ps.amount_mxn * 0.99
ORDER BY c.case_id, ps.schedule_index;

-- STEP 2 — Fix (run after reviewing the audit output above):

UPDATE payment_schedule ps
SET
  status          = 'paid',
  paid_amount_mxn = sub.total_paid,
  paid_date       = COALESCE(ps.paid_date, sub.last_payment_date),
  updated_at      = now()
FROM (
  SELECT
    cp.schedule_id,
    SUM(cp.amount_mxn)  FILTER (WHERE cp.payment_type != 'refund') AS total_paid,
    MAX(cp.payment_date) FILTER (WHERE cp.payment_type != 'refund') AS last_payment_date
  FROM cms_payments cp
  WHERE cp.schedule_id IS NOT NULL
  GROUP BY cp.schedule_id
) sub
WHERE ps.id            = sub.schedule_id
  AND ps.status       IN ('partial', 'pending', 'overdue')
  AND ps.amount_mxn   > 0
  AND sub.total_paid  >= ps.amount_mxn * 0.99;

-- STEP 3 — Verify (count rows fixed, and confirm AK-0059 is now paid):

SELECT
  c.case_id,
  ps.label,
  ps.amount_mxn,
  ps.paid_amount_mxn,
  ps.status,
  ps.paid_date
FROM payment_schedule ps
JOIN cases c ON c.id = ps.case_id
WHERE c.case_id LIKE '%0059%'
ORDER BY ps.schedule_index;
