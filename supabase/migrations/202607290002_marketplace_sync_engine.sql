-- Marketplace synchronization engine. Apply after the connector foundation migrations.

alter table public.marketplace_connections
  add column if not exists sync_mode text not null default 'read_only'
  check (sync_mode in ('read_only', 'preview', 'automatic')),
  add column if not exists health text not null default 'not_connected'
  check (health in ('not_connected', 'healthy', 'attention', 'expired')),
  add column if not exists next_sync_at timestamptz;

create table if not exists public.marketplace_oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  marketplace_id text not null,
  access_token text,
  refresh_token text not null,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, marketplace_id)
);

create table if not exists public.marketplace_listing_mappings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  marketplace_id text not null,
  inventory_item_id uuid,
  trading_docks_sku text not null,
  external_listing_id text not null,
  external_offer_id text,
  external_sku text,
  match_status text not null default 'unmatched'
    check (match_status in ('unmatched', 'matched', 'conflict', 'ignored')),
  last_seen_quantity integer,
  last_seen_price numeric(12,2),
  raw_snapshot jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz not null default now(),
  unique (user_id, marketplace_id, external_listing_id)
);

create table if not exists public.marketplace_sync_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sync_run_id uuid not null references public.marketplace_sync_runs(id) on delete cascade,
  marketplace_id text not null,
  change_type text not null,
  external_id text,
  trading_docks_sku text,
  before_value jsonb,
  after_value jsonb,
  status text not null default 'preview'
    check (status in ('preview', 'approved', 'applied', 'skipped', 'failed')),
  created_at timestamptz not null default now()
);

alter table public.marketplace_oauth_tokens enable row level security;
alter table public.marketplace_listing_mappings enable row level security;
alter table public.marketplace_sync_changes enable row level security;

-- OAuth tokens are server-only. Users can see connector status, never token bytes.
revoke all on public.marketplace_oauth_tokens from authenticated;

create policy "Users manage own listing mappings" on public.marketplace_listing_mappings
for all to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users manage own sync changes" on public.marketplace_sync_changes
for all to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create index if not exists marketplace_listing_mapping_lookup
on public.marketplace_listing_mappings (user_id, marketplace_id, match_status);
create index if not exists marketplace_sync_change_review
on public.marketplace_sync_changes (user_id, marketplace_id, status, created_at desc);

notify pgrst, 'reload schema';
