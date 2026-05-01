-- Migration 056: Treasury (capital deployment planning)
-- Internal-finance tool for modeling how incoming investor tranches are deployed
-- against project costs. Lives in investor-portal /financials → Treasury tab.
--
-- Three tables + one back-reference column on accounting_payment_requests:
--   treasury_scenarios       — named what-if containers (Base case, If raise closes Aug, …)
--   treasury_inflows_extra   — non-tranche inflows (loans, sales, partner injections);
--                              tranche inflows are read live from investment_tranches
--   treasury_allocations     — scenario-scoped commitments of an inflow's funds against
--                              costs, optionally linked to a vendor + AP request
--
-- RLS by tenant_id. Edit/view gating happens in the UI, not the DB.

create table if not exists public.treasury_scenarios (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null,
  org_id      uuid,
  name        text not null,
  description text,
  base_date   date not null default current_date,
  status      text not null check (status in ('draft','active','archived')) default 'draft',
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists treasury_scenarios_tenant_idx
  on public.treasury_scenarios (tenant_id, status, base_date);

create table if not exists public.treasury_inflows_extra (
  id                    uuid primary key default gen_random_uuid(),
  scenario_id           uuid not null references public.treasury_scenarios(id) on delete cascade,
  tenant_id             uuid not null,
  org_id                uuid,
  source_type           text not null check (source_type in ('loan','sale','partner','grant','other')) default 'other',
  label                 text not null,
  expected_date         date not null,
  expected_amount_usd   numeric(14,2) not null default 0,
  expected_amount_mxn   numeric(14,2) not null default 0,
  fx_assumed            numeric(8,4),
  status                text not null check (status in ('forecast','received')) default 'forecast',
  actual_amount_usd     numeric(14,2),
  actual_received_date  date,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists treasury_inflows_extra_scenario_idx
  on public.treasury_inflows_extra (scenario_id, expected_date);

create table if not exists public.treasury_allocations (
  id                  uuid primary key default gen_random_uuid(),
  scenario_id         uuid not null references public.treasury_scenarios(id) on delete cascade,
  tenant_id           uuid not null,
  org_id              uuid,
  -- exactly one of (tranche_id, inflow_extra_id) is set
  tranche_id          integer references public.investment_tranches(id),
  inflow_extra_id     uuid references public.treasury_inflows_extra(id) on delete set null,
  category            text not null check (category in (
    'land','permits','soft_costs','hard_costs','loan_paydown',
    'vendor','salary','runway','other'
  )) default 'other',
  proforma_line_id    uuid,
  vendor_id           uuid,
  amount_usd          numeric(14,2) not null default 0,
  amount_mxn          numeric(14,2) not null default 0,
  fx_assumed          numeric(8,4),
  planned_pay_date    date,
  lock_status         text not null check (lock_status in ('planned','locked','executed')) default 'planned',
  payment_request_id  uuid references public.accounting_payment_requests(id) on delete set null,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint treasury_allocation_inflow_xor
    check ((tranche_id is not null) <> (inflow_extra_id is not null))
);

create index if not exists treasury_allocations_scenario_idx
  on public.treasury_allocations (scenario_id, planned_pay_date);
create index if not exists treasury_allocations_tranche_idx
  on public.treasury_allocations (tranche_id) where tranche_id is not null;
create index if not exists treasury_allocations_inflow_extra_idx
  on public.treasury_allocations (inflow_extra_id) where inflow_extra_id is not null;

alter table public.accounting_payment_requests
  add column if not exists treasury_allocation_id uuid
    references public.treasury_allocations(id) on delete set null;

create index if not exists accounting_payment_requests_treasury_alloc_idx
  on public.accounting_payment_requests (treasury_allocation_id)
  where treasury_allocation_id is not null;

alter table public.treasury_scenarios     enable row level security;
alter table public.treasury_inflows_extra enable row level security;
alter table public.treasury_allocations   enable row level security;

drop policy if exists "treasury_scenarios_tenant_rw"     on public.treasury_scenarios;
drop policy if exists "treasury_inflows_extra_tenant_rw" on public.treasury_inflows_extra;
drop policy if exists "treasury_allocations_tenant_rw"   on public.treasury_allocations;

create policy "treasury_scenarios_tenant_rw"
  on public.treasury_scenarios for all
  using      (tenant_id = get_current_tenant_id())
  with check (tenant_id = get_current_tenant_id());

create policy "treasury_inflows_extra_tenant_rw"
  on public.treasury_inflows_extra for all
  using      (tenant_id = get_current_tenant_id())
  with check (tenant_id = get_current_tenant_id());

create policy "treasury_allocations_tenant_rw"
  on public.treasury_allocations for all
  using      (tenant_id = get_current_tenant_id())
  with check (tenant_id = get_current_tenant_id());

create or replace function public.touch_treasury_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists treasury_scenarios_touch     on public.treasury_scenarios;
drop trigger if exists treasury_inflows_extra_touch on public.treasury_inflows_extra;
drop trigger if exists treasury_allocations_touch   on public.treasury_allocations;

create trigger treasury_scenarios_touch
  before update on public.treasury_scenarios
  for each row execute function public.touch_treasury_updated_at();

create trigger treasury_inflows_extra_touch
  before update on public.treasury_inflows_extra
  for each row execute function public.touch_treasury_updated_at();

create trigger treasury_allocations_touch
  before update on public.treasury_allocations
  for each row execute function public.touch_treasury_updated_at();
