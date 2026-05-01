-- Migration 057: Treasury — per-scenario tranche overrides
-- Lets each scenario model the same investment_tranches row with a different
-- expected date or amount without mutating the canonical cap-table data.
--
-- One row per (scenario_id, tranche_id). NULL override columns mean "fall back
-- to the canonical investment_tranches value." UI applies the override by
-- COALESCE(override.expected_date_override, tranche.investment_date).

create table if not exists public.treasury_tranche_overrides (
  id                      uuid primary key default gen_random_uuid(),
  scenario_id             uuid not null references public.treasury_scenarios(id) on delete cascade,
  tranche_id              integer not null references public.investment_tranches(id) on delete cascade,
  tenant_id               uuid not null,
  org_id                  uuid,
  expected_date_override  date,
  amount_usd_override     numeric(14,2),
  notes                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint treasury_tranche_overrides_scenario_tranche_uniq
    unique (scenario_id, tranche_id)
);

create index if not exists treasury_tranche_overrides_scenario_idx
  on public.treasury_tranche_overrides (scenario_id);

alter table public.treasury_tranche_overrides enable row level security;

drop policy if exists "treasury_tranche_overrides_tenant_rw" on public.treasury_tranche_overrides;
create policy "treasury_tranche_overrides_tenant_rw"
  on public.treasury_tranche_overrides for all
  using      (tenant_id = get_current_tenant_id())
  with check (tenant_id = get_current_tenant_id());

drop trigger if exists treasury_tranche_overrides_touch on public.treasury_tranche_overrides;
create trigger treasury_tranche_overrides_touch
  before update on public.treasury_tranche_overrides
  for each row execute function public.touch_treasury_updated_at();
