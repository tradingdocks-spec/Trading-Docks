-- Automatic buylist feed connections and transparent source metadata.
create table if not exists public.buylist_feed_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  display_name text not null,
  enabled boolean not null default true,
  refresh_interval_hours integer not null default 24 check (refresh_interval_hours between 1 and 168),
  last_sync_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  last_offer_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.buylist_feed_connections enable row level security;
drop policy if exists "Users manage their buylist connections" on public.buylist_feed_connections;
create policy "Users manage their buylist connections" on public.buylist_feed_connections
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke all on public.buylist_feed_connections from anon;
grant select, insert, update, delete on public.buylist_feed_connections to authenticated;

alter table public.buylist_offers add column if not exists provider text not null default 'manual';
alter table public.buylist_offers add column if not exists source_kind text not null default 'authorized';
alter table public.buylist_offers add column if not exists indicative boolean not null default false;
alter table public.buylist_offers add column if not exists expires_at timestamptz;

drop index if exists public.buylist_offers_exact_offer_idx;
create unique index buylist_offers_exact_offer_idx
  on public.buylist_offers(user_id, provider, store_name, card_name, set_code, collector_number, finish, language, condition);

create index if not exists buylist_connections_due_idx
  on public.buylist_feed_connections(enabled, last_success_at);
create index if not exists buylist_offers_provider_idx
  on public.buylist_offers(user_id, provider, verified_at);

comment on table public.buylist_feed_connections is
  'User-controlled automatic buylist sources and their latest synchronization health.';
comment on column public.buylist_offers.indicative is
  'True when the upstream source publishes a price but cannot confirm live wanted quantity or condition acceptance.';
