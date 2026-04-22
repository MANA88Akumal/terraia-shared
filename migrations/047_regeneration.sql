-- Migration 047: Regeneration metrics + activity feed
-- Adds two tables for the Client Portal Regeneration screen and a
-- regen_goals JSON column on organizations so annual targets are
-- configurable per tenant.
--
-- Safe to re-run: uses IF NOT EXISTS and IF EXISTS guards.

-- ---------------------------------------------------------------------------
-- organizations.regen_goals (annual goals, configurable per tenant)
-- ---------------------------------------------------------------------------
alter table public.organizations
  add column if not exists regen_goals jsonb default '{
    "co2_tons": 1600,
    "biofuel_kwh": 300000,
    "trees": 7500,
    "jobs": 350,
    "water_liters": 1200000
  }'::jsonb;

-- ---------------------------------------------------------------------------
-- regen_metrics: one row per tenant per month
-- ---------------------------------------------------------------------------
create table if not exists public.regen_metrics (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  period_start date not null,
  period_end date not null,
  co2_avoided_tons numeric default 0,
  biofuel_kwh numeric default 0,
  trees_in_place int default 0,
  trees_relocated int default 0,
  jobs_total int default 0,
  jobs_payroll_mxn numeric default 0,
  water_saved_liters numeric default 0,
  third_party_verified boolean default false,
  verified_by text,
  verified_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (tenant_id, period_start)
);

create index if not exists regen_metrics_tenant_period_idx
  on public.regen_metrics (tenant_id, period_start desc);

-- ---------------------------------------------------------------------------
-- regen_activity: site-team log entries for the Live Activity feed
-- ---------------------------------------------------------------------------
create table if not exists public.regen_activity (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  activity_type text check (activity_type in (
    'tree_transplant','tree_plant','biofuel_batch','hiring','audit','milestone','other'
  )),
  title text not null,
  subtitle text,
  impact_line text,
  photo_url text,
  metric_value numeric,
  metric_unit text,
  occurred_at timestamptz not null,
  verified_by text,
  created_at timestamptz default now()
);

create index if not exists regen_activity_tenant_occurred_idx
  on public.regen_activity (tenant_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.regen_metrics  enable row level security;
alter table public.regen_activity enable row level security;

drop policy if exists "tenant_read_regen_metrics"  on public.regen_metrics;
drop policy if exists "tenant_read_regen_activity" on public.regen_activity;

create policy "tenant_read_regen_metrics"
  on public.regen_metrics for select
  using (tenant_id = get_current_tenant_id());

create policy "tenant_read_regen_activity"
  on public.regen_activity for select
  using (tenant_id = get_current_tenant_id());

-- Admins write via a future CMS admin surface (not exposed to client-portal).

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant select on public.regen_metrics  to authenticated;
grant select on public.regen_activity to authenticated;
