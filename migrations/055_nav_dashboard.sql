-- Migration 055: NAV Dashboard
-- Per-tenant monthly snapshot table for the values investors and the GP need to enter
-- by hand (land appraisal, current list price, seller balance, advisory accruals,
-- AR pipeline, free-text notes). Asset/liability live values that exist elsewhere in
-- the schema (lots, costs, tranches, monthly_revenue) are joined in at read time and
-- not duplicated here.
--
-- Scenario knobs (loan rate, advisory %, lockbox %, optimistic/conservative velocity)
-- live in project_settings as key/value, same pattern as comp_plan_*.

create table if not exists public.nav_monthly_snapshots (
  id                          uuid primary key default gen_random_uuid(),
  tenant_id                   uuid not null,
  org_id                      uuid,
  month                       text not null,                  -- YYYY-MM
  land_value_usd              numeric(14,2) default 0,
  lot_list_price_usd          numeric(12,2) default 0,
  seller_balance_usd          numeric(14,2) default 0,
  advisory_obligations_usd    numeric(14,2) default 0,
  other_liabilities_usd       numeric(14,2) default 0,
  ar_pipeline_usd             numeric(14,2) default 0,
  notes                       text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (tenant_id, month)
);

create index if not exists nav_snapshots_tenant_month_idx
  on public.nav_monthly_snapshots (tenant_id, month);

alter table public.nav_monthly_snapshots enable row level security;

drop policy if exists "nav_snapshots_tenant_rw" on public.nav_monthly_snapshots;
create policy "nav_snapshots_tenant_rw"
  on public.nav_monthly_snapshots for all
  using (tenant_id = get_current_tenant_id())
  with check (tenant_id = get_current_tenant_id());

drop trigger if exists nav_snapshots_touch on public.nav_monthly_snapshots;
create trigger nav_snapshots_touch
  before update on public.nav_monthly_snapshots
  for each row execute function public.touch_comp_updated_at();
