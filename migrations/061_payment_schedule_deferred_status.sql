-- Migration 061: allow 'deferred' as a payment_schedule.status value.
--
-- Companion to the CMS "Defer to Final Payment" action (see useDeferToFinal):
-- the source row's outstanding balance is moved onto the entrega row, and the
-- source row is marked 'deferred' so it stops appearing in the aging report.
-- The pre-existing CHECK constraint only allowed
--   'pending','partial','overdue','paid','waived','cancelled'
-- so without this update the UPDATE fails with 23514.
--
-- Safe to re-run: drops+recreates the constraint by name; no data touched.

alter table public.payment_schedule
  drop constraint if exists payment_schedule_status_check;

alter table public.payment_schedule
  add constraint payment_schedule_status_check
  check (status in (
    'pending',
    'partial',
    'overdue',
    'paid',
    'waived',
    'cancelled',
    'deferred'
  ));
