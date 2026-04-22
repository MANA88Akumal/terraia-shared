-- Migration 049: Community Services marketplace
-- Vetted local provider directory + bookings + reviews.

create table if not exists public.service_providers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  user_id uuid,
  full_name text not null,
  photo_url text,
  initials text,
  avatar_color text,
  category text check (category in (
    'housekeeping','childcare','landscaping','kitchen',
    'driving','pool','handyman','elder_care','other'
  )),
  services text[] default '{}',
  bio text,
  hourly_rate_mxn numeric,
  hourly_rate_usd numeric,
  home_town text,
  languages text[] default '{"es"}',
  verified boolean default false,
  verified_at timestamptz,
  background_check_passed boolean default false,
  average_rating numeric default 0,
  review_count int default 0,
  total_bookings int default 0,
  availability_status text check (availability_status in ('available','busy','offline')) default 'available',
  busy_until timestamptz,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.service_bookings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  provider_id uuid references public.service_providers(id) on delete cascade,
  owner_user_id uuid not null,
  lot_id uuid,
  start_at timestamptz not null,
  end_at timestamptz not null,
  duration_hours numeric generated always as (extract(epoch from (end_at - start_at)) / 3600.0) stored,
  hourly_rate_mxn numeric,
  total_mxn numeric,
  status text check (status in ('pending','confirmed','in_progress','completed','cancelled','no_show')) default 'pending',
  notes text,
  cancelled_reason text,
  created_at timestamptz default now()
);

create table if not exists public.service_reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.service_bookings(id) on delete cascade,
  provider_id uuid references public.service_providers(id) on delete cascade,
  reviewer_user_id uuid,
  rating int check (rating between 1 and 5),
  comment text,
  created_at timestamptz default now(),
  unique (booking_id)
);

create table if not exists public.service_messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.service_bookings(id) on delete cascade,
  sender_user_id uuid,
  sender_role text check (sender_role in ('owner','provider')),
  body text,
  created_at timestamptz default now()
);

create table if not exists public.service_impact_stats (
  tenant_id uuid primary key,
  total_providers int default 0,
  active_providers int default 0,
  local_pct numeric default 0,
  bookings_90d int default 0,
  bookings_90d_change_pct numeric default 0,
  avg_rating numeric default 0,
  total_reviews int default 0,
  avg_response_minutes int default 12,
  total_paid_to_locals_mxn numeric default 0,
  updated_at timestamptz default now()
);

create index if not exists service_providers_tenant_category_idx
  on public.service_providers (tenant_id, category, active);
create index if not exists service_bookings_owner_idx
  on public.service_bookings (owner_user_id, start_at desc);
create index if not exists service_bookings_provider_idx
  on public.service_bookings (provider_id, start_at desc);

-- RLS
alter table public.service_providers    enable row level security;
alter table public.service_bookings     enable row level security;
alter table public.service_reviews      enable row level security;
alter table public.service_messages     enable row level security;
alter table public.service_impact_stats enable row level security;

drop policy if exists "tenant_read_providers"  on public.service_providers;
drop policy if exists "owner_rw_own_bookings"  on public.service_bookings;
drop policy if exists "tenant_read_reviews"    on public.service_reviews;
drop policy if exists "booking_parties_read_messages" on public.service_messages;
drop policy if exists "tenant_read_stats"      on public.service_impact_stats;

create policy "tenant_read_providers"
  on public.service_providers for select
  using (tenant_id = get_current_tenant_id() and active = true);

create policy "owner_rw_own_bookings"
  on public.service_bookings for all
  using (tenant_id = get_current_tenant_id() and owner_user_id = auth.uid())
  with check (tenant_id = get_current_tenant_id() and owner_user_id = auth.uid());

create policy "tenant_read_reviews"
  on public.service_reviews for select
  using (provider_id in (select id from public.service_providers where tenant_id = get_current_tenant_id()));

create policy "booking_parties_read_messages"
  on public.service_messages for select
  using (
    booking_id in (
      select id from public.service_bookings
      where tenant_id = get_current_tenant_id()
        and (owner_user_id = auth.uid() or provider_id in (
          select id from public.service_providers where user_id = auth.uid()
        ))
    )
  );

create policy "tenant_read_stats"
  on public.service_impact_stats for select
  using (tenant_id = get_current_tenant_id());

grant select on public.service_providers to authenticated;
grant select, insert, update on public.service_bookings to authenticated;
grant select, insert on public.service_reviews to authenticated;
grant select, insert on public.service_messages to authenticated;
grant select on public.service_impact_stats to authenticated;
