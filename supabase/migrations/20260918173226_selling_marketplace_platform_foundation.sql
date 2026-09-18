-- Selling platform foundation. Additive only; do not apply remotely as part of
-- the initial architecture phase. Physical inventory remains authoritative.

create table if not exists public.selling_listing_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  source text not null default 'inventory',
  chaos_sort_session_id uuid references public.chaos_sort_sessions(id) on delete set null,
  inventory_batch_id uuid references public.chaos_sort_batches(id) on delete set null,
  status text not null default 'DRAFT' check (status in ('DRAFT','READY','PARTIALLY_ACTIVE','ACTIVE','NEEDS_ATTENTION','ENDED')),
  candidate_count integer not null default 0 check (candidate_count >= 0),
  market_value numeric(12,2),
  intended_value numeric(12,2),
  projected_net numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.selling_listing_candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_batch_id uuid not null references public.selling_listing_batches(id) on delete cascade,
  inventory_item_id text not null,
  inventory_position_id text,
  inventory_batch_id uuid references public.chaos_sort_batches(id) on delete set null,
  location_id text,
  quantity integer not null check (quantity > 0),
  cost_basis numeric(12,2),
  market_price numeric(12,2),
  listing_price numeric(12,2),
  condition text,
  finish text,
  language text,
  readiness_code text not null default 'NEEDS_MATCH_REVIEW',
  readiness_message text not null default 'Candidate requires review.',
  lifecycle_status text not null default 'DRAFT' check (lifecycle_status in ('DRAFT','READY','QUEUED','PUBLISHING','ACTIVE','PARTIALLY_ACTIVE','NEEDS_ATTENTION','FAILED','ENDED','SOLD_OUT')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, listing_batch_id, inventory_item_id, inventory_position_id)
);

create table if not exists public.selling_inventory_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  candidate_id uuid not null references public.selling_listing_candidates(id) on delete cascade,
  inventory_item_id text not null,
  inventory_position_id text,
  quantity integer not null check (quantity > 0),
  status text not null default 'ALLOCATED' check (status in ('ALLOCATED','RELEASED','RESERVED','FULFILLED')),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  released_at timestamptz,
  unique (user_id, idempotency_key)
);

create table if not exists public.selling_marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  candidate_id uuid not null references public.selling_listing_candidates(id) on delete cascade,
  marketplace_account_id uuid references public.marketplace_connections(id) on delete set null,
  marketplace_id text not null,
  external_listing_id text,
  external_offer_id text,
  sku text,
  title text,
  quantity integer not null default 0 check (quantity >= 0),
  price numeric(12,2),
  external_status text,
  lifecycle_status text not null default 'DRAFT' check (lifecycle_status in ('DRAFT','READY','QUEUED','PUBLISHING','ACTIVE','PARTIALLY_ACTIVE','NEEDS_ATTENTION','FAILED','ENDED','SOLD_OUT')),
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, marketplace_id, external_listing_id)
);

create table if not exists public.selling_sync_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  marketplace_id text not null,
  operation text not null,
  idempotency_key text not null,
  status text not null default 'QUEUED' check (status in ('QUEUED','PROCESSING','SUCCEEDED','FAILED','DEAD_LETTER')),
  retry_count integer not null default 0 check (retry_count >= 0),
  external_id text,
  error_code text,
  error_message text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, idempotency_key)
);

alter table public.selling_listing_batches enable row level security;
alter table public.selling_listing_candidates enable row level security;
alter table public.selling_inventory_allocations enable row level security;
alter table public.selling_marketplace_listings enable row level security;
alter table public.selling_sync_events enable row level security;

drop policy if exists "Users manage own selling listing batches" on public.selling_listing_batches;
drop policy if exists "Users manage own selling candidates" on public.selling_listing_candidates;
drop policy if exists "Users manage own selling allocations" on public.selling_inventory_allocations;
drop policy if exists "Users manage own selling marketplace listings" on public.selling_marketplace_listings;
drop policy if exists "Users manage own selling sync events" on public.selling_sync_events;
create policy "Users manage own selling listing batches" on public.selling_listing_batches for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage own selling candidates" on public.selling_listing_candidates for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage own selling allocations" on public.selling_inventory_allocations for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage own selling marketplace listings" on public.selling_marketplace_listings for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage own selling sync events" on public.selling_sync_events for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.selling_listing_batches, public.selling_listing_candidates, public.selling_inventory_allocations, public.selling_marketplace_listings, public.selling_sync_events from anon;
grant select, insert, update, delete on public.selling_listing_batches, public.selling_listing_candidates, public.selling_inventory_allocations, public.selling_marketplace_listings, public.selling_sync_events to authenticated;

create index if not exists selling_listing_batches_user_status_idx on public.selling_listing_batches(user_id, status, updated_at desc);
create index if not exists selling_candidates_user_readiness_idx on public.selling_listing_candidates(user_id, readiness_code, lifecycle_status);
create index if not exists selling_candidates_inventory_idx on public.selling_listing_candidates(user_id, inventory_item_id, inventory_position_id);
create index if not exists selling_marketplace_listings_user_market_idx on public.selling_marketplace_listings(user_id, marketplace_id, lifecycle_status);
create index if not exists selling_sync_events_retry_idx on public.selling_sync_events(user_id, status, created_at);

notify pgrst, 'reload schema';
