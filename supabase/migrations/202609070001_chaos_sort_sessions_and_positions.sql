-- Chaos Sort flagship foundation: intake sessions, configurable batch targets,
-- and location-aware physical positions. Additive and safe to replay.

create table if not exists public.chaos_sort_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_code text not null,
  source text not null default 'Other',
  reference text,
  game text not null default 'mixed',
  default_condition text,
  default_location_id text,
  target_batch_size integer not null default 100 check (target_batch_size between 20 and 500),
  status text not null default 'active' check (status in ('draft', 'active', 'completed', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, session_code)
);

alter table public.chaos_sort_batches
  add column if not exists session_id uuid references public.chaos_sort_sessions(id) on delete set null;
alter table public.chaos_sort_batches
  add column if not exists target_quantity integer not null default 100;
alter table public.chaos_sort_batches
  add column if not exists closed_at timestamptz;

create table if not exists public.chaos_sort_inventory_positions (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  batch_id uuid not null references public.chaos_sort_batches(id) on delete restrict,
  item_id text,
  card_name text not null default '',
  scryfall_id text,
  set_code text,
  collector_number text,
  finish text,
  condition text,
  quantity integer not null default 0 check (quantity >= 0),
  location_id text,
  position integer,
  status text not null default 'active' check (status in ('active', 'depleted', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, batch_id, item_id)
);

create index if not exists chaos_sort_sessions_user_status_idx
  on public.chaos_sort_sessions(user_id, status, started_at desc);
create index if not exists chaos_sort_batches_session_idx
  on public.chaos_sort_batches(user_id, session_id, created_at asc);
create index if not exists chaos_sort_positions_lookup_idx
  on public.chaos_sort_inventory_positions(user_id, card_name, set_code, collector_number, location_id);
create index if not exists chaos_sort_positions_batch_idx
  on public.chaos_sort_inventory_positions(user_id, batch_id, position);

alter table public.chaos_sort_sessions enable row level security;
alter table public.chaos_sort_inventory_positions enable row level security;

drop policy if exists "Users manage their chaos sort sessions" on public.chaos_sort_sessions;
create policy "Users manage their chaos sort sessions"
  on public.chaos_sort_sessions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users manage their chaos sort positions" on public.chaos_sort_inventory_positions;
create policy "Users manage their chaos sort positions"
  on public.chaos_sort_inventory_positions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.chaos_sort_sessions, public.chaos_sort_inventory_positions from anon;
grant select, insert, update, delete on public.chaos_sort_sessions, public.chaos_sort_inventory_positions to authenticated;
