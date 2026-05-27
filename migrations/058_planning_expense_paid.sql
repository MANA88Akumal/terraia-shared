-- Migration 058: paid_date tracking on accounting_planning_expenses
--
-- One-time planning expenses (frequency='one_time') can now be marked as paid
-- with the actual paid date. Projections (Planning charts, Forecast, Treasury,
-- Dashboard) skip a one-time expense once paid_date is set so it doesn't
-- continue to show up as an upcoming outflow.
--
-- NULL = unpaid (default). Setting a date marks it paid as of that date.
-- For recurring expenses (monthly/weekly/etc.) this column is unused — they
-- still use end_date to bound their projection window.

alter table public.accounting_planning_expenses
  add column if not exists paid_date date;

-- Index supports filtering "WHERE paid_date IS NULL" in projection queries.
create index if not exists accounting_planning_expenses_unpaid_idx
  on public.accounting_planning_expenses (active, frequency)
  where paid_date is null;

comment on column public.accounting_planning_expenses.paid_date is
  'Date the expense was actually paid. Only meaningful for one_time expenses. Once set, projection consumers (Planning, Forecast, Treasury, Dashboard) exclude this row from future outflow projections.';
