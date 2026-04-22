-- Migration 050: Smart Home devices + readings
-- MVP schema for per-lot eco dashboard + control panel. Actual hardware
-- integration (Home Assistant / vendor hub) lands in Phase 2.

create table if not exists public.smart_home_devices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  case_id uuid,
  lot_id uuid,
  device_type text check (device_type in (
    'solar_inverter','water_meter','thermostat','lights','security_system',
    'oven','blinds','vacation_mode','door_lock','camera','other'
  )),
  device_id_external text,
  label text,
  room text,
  active boolean default true,
  configured_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.smart_home_states (
  device_id uuid primary key references public.smart_home_devices(id) on delete cascade,
  state jsonb not null default '{}',
  reachable boolean default true,
  updated_at timestamptz default now()
);

create table if not exists public.smart_home_readings (
  id uuid primary key default gen_random_uuid(),
  device_id uuid references public.smart_home_devices(id) on delete cascade,
  reading_type text,
  value numeric,
  recorded_at timestamptz not null,
  created_at timestamptz default now()
);

create index if not exists smart_home_readings_device_time_idx
  on public.smart_home_readings (device_id, recorded_at desc);

create table if not exists public.smart_home_daily_stats (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  case_id uuid,
  lot_id uuid,
  stat_date date not null,
  solar_kwh_generated numeric default 0,
  home_kwh_consumed numeric default 0,
  net_export_kwh numeric default 0,
  water_liters_saved numeric default 0,
  water_pct_from_cistern numeric default 0,
  co2_tons_avoided_ytd numeric default 0,
  energy_savings_mxn_month numeric default 0,
  unique (lot_id, stat_date)
);

create table if not exists public.smart_home_scenes (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid,
  case_id uuid,
  name text,
  icon text,
  actions jsonb,
  created_at timestamptz default now()
);

-- RLS: owners see devices/states/readings for their case only
alter table public.smart_home_devices      enable row level security;
alter table public.smart_home_states       enable row level security;
alter table public.smart_home_readings     enable row level security;
alter table public.smart_home_daily_stats  enable row level security;
alter table public.smart_home_scenes       enable row level security;

drop policy if exists "owner_read_devices" on public.smart_home_devices;
drop policy if exists "owner_read_states"  on public.smart_home_states;
drop policy if exists "owner_read_readings" on public.smart_home_readings;
drop policy if exists "owner_read_stats"   on public.smart_home_daily_stats;
drop policy if exists "owner_rw_scenes"    on public.smart_home_scenes;

create policy "owner_read_devices"
  on public.smart_home_devices for select
  using (
    tenant_id = get_current_tenant_id()
    and case_id in (
      select c.id from public.cases c
      join public.clients cl on cl.id = c.client_id
      where cl.email = auth.email()
    )
  );

create policy "owner_read_states"
  on public.smart_home_states for select
  using (
    device_id in (
      select id from public.smart_home_devices
      where tenant_id = get_current_tenant_id()
        and case_id in (
          select c.id from public.cases c
          join public.clients cl on cl.id = c.client_id
          where cl.email = auth.email()
        )
    )
  );

create policy "owner_read_readings"
  on public.smart_home_readings for select
  using (
    device_id in (
      select id from public.smart_home_devices
      where tenant_id = get_current_tenant_id()
        and case_id in (
          select c.id from public.cases c
          join public.clients cl on cl.id = c.client_id
          where cl.email = auth.email()
        )
    )
  );

create policy "owner_read_stats"
  on public.smart_home_daily_stats for select
  using (
    tenant_id = get_current_tenant_id()
    and case_id in (
      select c.id from public.cases c
      join public.clients cl on cl.id = c.client_id
      where cl.email = auth.email()
    )
  );

create policy "owner_rw_scenes"
  on public.smart_home_scenes for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

grant select on public.smart_home_devices      to authenticated;
grant select on public.smart_home_states       to authenticated;
grant select on public.smart_home_readings     to authenticated;
grant select on public.smart_home_daily_stats  to authenticated;
grant select, insert, update, delete on public.smart_home_scenes to authenticated;
