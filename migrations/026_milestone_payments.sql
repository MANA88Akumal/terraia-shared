-- ============================================================================
-- Migration 026: Support milestone-based payment schedules
-- ============================================================================
-- Adds due_date_type and milestone_description to payment_schedule.
--
-- due_date_type:
--   'fixed'     — normal calendar date (default, current behavior)
--   'milestone' — triggered by an event (deed, permit, etc.)
--   'tbd'       — date to be determined later
--
-- Milestone items are NOT shown as overdue even if due_date is in the past.
-- They appear in a separate "Milestone Payments" section on Collections.
-- When the milestone event occurs, the admin sets due_date_type back to
-- 'fixed' and sets the actual due_date.
-- ============================================================================

-- Add columns
ALTER TABLE payment_schedule
  ADD COLUMN IF NOT EXISTS due_date_type TEXT NOT NULL DEFAULT 'fixed'
    CHECK (due_date_type IN ('fixed', 'milestone', 'tbd')),
  ADD COLUMN IF NOT EXISTS milestone_description TEXT;

COMMENT ON COLUMN payment_schedule.due_date_type IS
  'fixed = normal due date, milestone = triggered by event, tbd = date not yet known';
COMMENT ON COLUMN payment_schedule.milestone_description IS
  'Human-readable description of the milestone event (e.g., "5 business days after master lot deed")';

-- ────────────────────────────────────────────────────────────────────────
-- Fix case MANA88-AK-0074 (Jared West) — milestone-based schedule
-- ────────────────────────────────────────────────────────────────────────

-- Mark the two hito payments as milestone-based
UPDATE payment_schedule
SET due_date_type = 'milestone',
    milestone_description = '5 días hábiles después de la obtención de la escritura pública del lote principal',
    due_date = '2026-07-15',
    status = CASE WHEN paid_amount_mxn >= amount_mxn THEN 'paid' WHEN paid_amount_mxn > 0 THEN 'partial' ELSE 'pending' END,
    updated_at = now()
WHERE case_id = (SELECT id FROM cases WHERE case_id = 'MANA88-AK-0074')
  AND (label ILIKE '%Título%' OR label ILIKE '%titulo%' OR label ILIKE '%Lote Maestro%');

UPDATE payment_schedule
SET due_date_type = 'milestone',
    milestone_description = '5 días hábiles después de la obtención del permiso ambiental MIA/EIA',
    due_date = '2026-11-15',
    status = CASE WHEN paid_amount_mxn >= amount_mxn THEN 'paid' WHEN paid_amount_mxn > 0 THEN 'partial' ELSE 'pending' END,
    updated_at = now()
WHERE case_id = (SELECT id FROM cases WHERE case_id = 'MANA88-AK-0074')
  AND (label ILIKE '%MIA%' OR label ILIKE '%EIA%');

-- Mark mensualidades as TBD (dates to be determined after enganche)
UPDATE payment_schedule
SET due_date_type = 'tbd',
    milestone_description = 'Comienzan después del enganche — fechas por determinar',
    due_date = ('2026-01-01'::date + ((schedule_index - 4) * interval '1 month'))::date,
    status = CASE WHEN paid_amount_mxn >= amount_mxn THEN 'paid' WHEN paid_amount_mxn > 0 THEN 'partial' ELSE 'pending' END,
    updated_at = now()
WHERE case_id = (SELECT id FROM cases WHERE case_id = 'MANA88-AK-0074')
  AND label LIKE 'Mensualidad %'
  AND paid_amount_mxn < amount_mxn;

-- Mark the entrega final as milestone
UPDATE payment_schedule
SET due_date_type = 'milestone',
    milestone_description = 'A la entrega del título de propiedad',
    due_date = '2028-07-01',
    status = CASE WHEN paid_amount_mxn >= amount_mxn THEN 'paid' WHEN paid_amount_mxn > 0 THEN 'partial' ELSE 'pending' END,
    updated_at = now()
WHERE case_id = (SELECT id FROM cases WHERE case_id = 'MANA88-AK-0074')
  AND (label ILIKE '%Entrega Final%' OR payment_type = 'entrega');

-- Re-run FIFO reconciliation for this case
SELECT reconcile_case_schedule(
  (SELECT id FROM cases WHERE case_id = 'MANA88-AK-0074')
);

NOTIFY pgrst, 'reload schema';
