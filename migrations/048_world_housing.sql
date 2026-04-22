-- Migration 048: World Housing initiative
-- Tables for the MANA 88 x World Housing Foundation $5M housing partnership.
-- Owner-visible data only; writes go through CMS admin + Stripe webhook.

create table if not exists public.world_housing_campaign (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique,
  m88_commitment_usd numeric default 2500000,
  wh_commitment_usd numeric default 2500000,
  wh_received_usd numeric default 0,
  owner_pool_goal_usd numeric default 500000,
  owner_donations_total_usd numeric default 0,
  homes_built int default 0,
  homes_in_construction int default 0,
  homes_planned int default 150,
  jobs_created int default 0,
  families_housed int default 0,
  people_housed int default 0,
  updated_at timestamptz default now()
);

create table if not exists public.world_housing_homes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  home_number int not null,
  status text check (status in ('built','in_construction','planned')),
  family_id uuid,
  move_in_date date,
  lat numeric,
  lng numeric,
  unique (tenant_id, home_number)
);

create table if not exists public.world_housing_families (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  family_name text,
  parent_names text[],
  children_count int default 0,
  people_count int default 0,
  photo_url text,
  home_id uuid,
  moved_in_at date,
  created_at timestamptz default now()
);

create table if not exists public.world_housing_family_stories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  family_id uuid references public.world_housing_families(id) on delete set null,
  featured_month date not null,
  title text,
  quote text,
  attribution text,
  story_excerpt text,
  story_full_md text,
  photo_url text,
  published boolean default false,
  created_at timestamptz default now(),
  unique (tenant_id, featured_month)
);

create table if not exists public.world_housing_donations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  donor_user_id uuid,
  donor_name text,
  donor_email text,
  amount_usd numeric not null,
  matched boolean default true,
  stripe_payment_intent_id text,
  status text check (status in ('pending','succeeded','failed','refunded')) default 'pending',
  message text,
  anonymous boolean default false,
  created_at timestamptz default now()
);

create index if not exists world_housing_donations_tenant_idx
  on public.world_housing_donations (tenant_id, created_at desc);

-- Trigger: on successful donation, bump the campaign totals
create or replace function public.bump_world_housing_campaign()
returns trigger
language plpgsql
security definer
as $$
begin
  if (NEW.status = 'succeeded' and (TG_OP = 'INSERT' or OLD.status is distinct from 'succeeded')) then
    update public.world_housing_campaign
       set owner_donations_total_usd = coalesce(owner_donations_total_usd, 0) + NEW.amount_usd,
           updated_at = now()
     where tenant_id = NEW.tenant_id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_world_housing_donation_bump on public.world_housing_donations;
create trigger trg_world_housing_donation_bump
  after insert or update of status on public.world_housing_donations
  for each row execute function public.bump_world_housing_campaign();

-- RLS
alter table public.world_housing_campaign       enable row level security;
alter table public.world_housing_homes          enable row level security;
alter table public.world_housing_families       enable row level security;
alter table public.world_housing_family_stories enable row level security;
alter table public.world_housing_donations      enable row level security;

drop policy if exists "tenant_read" on public.world_housing_campaign;
drop policy if exists "tenant_read" on public.world_housing_homes;
drop policy if exists "tenant_read" on public.world_housing_families;
drop policy if exists "tenant_read_published" on public.world_housing_family_stories;
drop policy if exists "donor_read_own" on public.world_housing_donations;
drop policy if exists "donor_insert"   on public.world_housing_donations;

create policy "tenant_read"
  on public.world_housing_campaign for select
  using (tenant_id = get_current_tenant_id());

create policy "tenant_read"
  on public.world_housing_homes for select
  using (tenant_id = get_current_tenant_id());

create policy "tenant_read"
  on public.world_housing_families for select
  using (tenant_id = get_current_tenant_id());

create policy "tenant_read_published"
  on public.world_housing_family_stories for select
  using (tenant_id = get_current_tenant_id() and published = true);

-- Donors can read their own donations + any non-anonymous donations (to show
-- aggregate donor list). Server-side inserts happen via service role through
-- the Stripe webhook handler.
create policy "donor_read_own"
  on public.world_housing_donations for select
  using (
    tenant_id = get_current_tenant_id()
    and (donor_user_id = auth.uid() or anonymous = false)
  );

create policy "donor_insert"
  on public.world_housing_donations for insert
  with check (
    tenant_id = get_current_tenant_id()
    and (donor_user_id = auth.uid() or donor_user_id is null)
  );

grant select on public.world_housing_campaign       to authenticated;
grant select on public.world_housing_homes          to authenticated;
grant select on public.world_housing_families       to authenticated;
grant select on public.world_housing_family_stories to authenticated;
grant select, insert on public.world_housing_donations to authenticated;
