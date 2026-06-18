-- Migration 053: Compensation plans
-- Stores employee/executive comp pool members and milestone bonuses for the Investor Portal
-- "Compensation" tab. Pool config knobs (fee %s, comp pool share %, project duration) live in
-- project_settings as key/value rows.

create table if not exists public.comp_plan_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid,
  name text not null,
  role text not null check (role in ('partner','executive','employee')) default 'employee',
  base_salary_mxn numeric(14,2) not null default 0,
  pool_share_pct numeric(7,4) not null default 0,           -- 0..100, sums to 100 across active members
  bonus_eligible boolean not null default true,
  notes text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists comp_plan_members_tenant_idx
  on public.comp_plan_members (tenant_id, active, sort_order);

create table if not exists public.comp_plan_milestones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid,
  milestone text not null,
  total_bonus_pool_mxn numeric(14,2) not null default 0,
  achieved boolean not null default false,
  achieved_date date,
  notes text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists comp_plan_milestones_tenant_idx
  on public.comp_plan_milestones (tenant_id, sort_order);

alter table public.comp_plan_members    enable row level security;
alter table public.comp_plan_milestones enable row level security;

drop policy if exists "comp_members_tenant_rw"    on public.comp_plan_members;
drop policy if exists "comp_milestones_tenant_rw" on public.comp_plan_milestones;

create policy "comp_members_tenant_rw"
  on public.comp_plan_members for all
  using (tenant_id = get_current_tenant_id())
  with check (tenant_id = get_current_tenant_id());

create policy "comp_milestones_tenant_rw"
  on public.comp_plan_milestones for all
  using (tenant_id = get_current_tenant_id())
  with check (tenant_id = get_current_tenant_id());

create or replace function public.touch_comp_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists comp_members_touch    on public.comp_plan_members;
drop trigger if exists comp_milestones_touch on public.comp_plan_milestones;

create trigger comp_members_touch
  before update on public.comp_plan_members
  for each row execute function public.touch_comp_updated_at();

create trigger comp_milestones_touch
  before update on public.comp_plan_milestones
  for each row execute function public.touch_comp_updated_at();
