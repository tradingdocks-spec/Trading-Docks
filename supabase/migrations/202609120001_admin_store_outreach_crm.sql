-- Admin Store Outreach CRM foundation.
-- Apply only after staging replay and review. This migration is additive and is
-- intentionally not applied by the application or deployment process.

create table if not exists public.marketing_searches (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  postal_code text not null,
  radius_miles integer not null check (radius_miles in (5, 10, 25, 50, 100)),
  provider text not null default 'google_places',
  provider_status text not null default 'completed',
  result_count integer not null default 0 check (result_count >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.marketing_prospects (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'google_places',
  provider_place_id text,
  business_name text not null,
  address text not null default '',
  city text not null default '',
  state text not null default '',
  postal_code text not null default '',
  latitude double precision,
  longitude double precision,
  distance_miles numeric(8,2),
  phone text,
  website_url text,
  listing_url text,
  category text,
  provider_data jsonb not null default '{}'::jsonb,
  public_email text,
  public_email_normalized text,
  public_email_source_url text,
  public_email_discovered_at timestamptz,
  contact_page_url text,
  contact_name text,
  contact_email_verified boolean not null default false,
  source text not null default 'store_finder',
  discovery_method text not null default 'google_places_text_search',
  status text not null default 'new' check (status in ('new','researched','ready_to_contact','emailed','opened','clicked','replied','interested','demo_scheduled','trial_started','customer','not_interested','do_not_contact')),
  tags text[] not null default '{}',
  notes text not null default '',
  assigned_admin_id uuid references auth.users(id) on delete set null,
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  suppressed boolean not null default false,
  suppression_reason text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_place_id)
);

create table if not exists public.marketing_activities (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.marketing_prospects(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  activity_type text not null,
  body text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.marketing_suppressions (
  id uuid primary key default gen_random_uuid(),
  normalized_email text not null unique,
  reason text not null,
  source text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists marketing_prospects_status_idx on public.marketing_prospects(status, updated_at desc);
create index if not exists marketing_prospects_location_idx on public.marketing_prospects(state, city, postal_code);
create index if not exists marketing_prospects_follow_up_idx on public.marketing_prospects(next_follow_up_at) where next_follow_up_at is not null;
create index if not exists marketing_prospects_provider_place_idx on public.marketing_prospects(provider, provider_place_id);
create index if not exists marketing_activities_prospect_idx on public.marketing_activities(prospect_id, created_at desc);

create or replace function public.marketing_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists marketing_prospects_updated_at on public.marketing_prospects;
create trigger marketing_prospects_updated_at before update on public.marketing_prospects
for each row execute function public.marketing_touch_updated_at();

alter table public.marketing_searches enable row level security;
alter table public.marketing_prospects enable row level security;
alter table public.marketing_activities enable row level security;
alter table public.marketing_suppressions enable row level security;

drop policy if exists "marketing admins read searches" on public.marketing_searches;
create policy "marketing admins read searches" on public.marketing_searches for select to authenticated using (public.is_admin('admin'));
drop policy if exists "marketing admins manage searches" on public.marketing_searches;
create policy "marketing admins manage searches" on public.marketing_searches for all to authenticated using (public.is_admin('admin')) with check (public.is_admin('admin'));
drop policy if exists "marketing admins manage prospects" on public.marketing_prospects;
create policy "marketing admins manage prospects" on public.marketing_prospects for all to authenticated using (public.is_admin('admin')) with check (public.is_admin('admin'));
drop policy if exists "marketing admins manage activities" on public.marketing_activities;
create policy "marketing admins manage activities" on public.marketing_activities for all to authenticated using (public.is_admin('admin')) with check (public.is_admin('admin'));
drop policy if exists "marketing admins manage suppressions" on public.marketing_suppressions;
create policy "marketing admins manage suppressions" on public.marketing_suppressions for all to authenticated using (public.is_admin('admin')) with check (public.is_admin('admin'));

revoke all on public.marketing_searches, public.marketing_prospects, public.marketing_activities, public.marketing_suppressions from anon;
grant select, insert, update, delete on public.marketing_searches, public.marketing_prospects, public.marketing_activities, public.marketing_suppressions to authenticated;
