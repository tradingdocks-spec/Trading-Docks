-- Chaos Sort batch intake and audit trail.
-- Forward-only, additive schema for authenticated inventory sorting workflows.

create extension if not exists pgcrypto;

create table if not exists public.chaos_sort_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete set null,
  batch_code text not null,
  title text not null default 'Scanner intake batch',
  status text not null default 'draft' check (status in ('draft', 'review', 'sorting', 'committed', 'failed')),
  source_count integer not null default 0 check (source_count >= 0),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  identified_count integer not null default 0 check (identified_count >= 0),
  confirmed_count integer not null default 0 check (confirmed_count >= 0),
  needs_review_count integer not null default 0 check (needs_review_count >= 0),
  unknown_count integer not null default 0 check (unknown_count >= 0),
  estimated_market_value numeric(14,2) not null default 0 check (estimated_market_value >= 0),
  acquisition_cost numeric(14,2) check (acquisition_cost is null or acquisition_cost >= 0),
  destination_location_id text,
  destination_label text not null default 'Unassigned',
  sort_plan jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.chaos_sort_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.chaos_sort_batches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_file_name text not null default '',
  source_file_hash text not null default '',
  source_image_url text,
  recognition_state text not null default 'review' check (recognition_state in ('high_confidence', 'review', 'unknown')),
  human_state text not null default 'pending' check (human_state in ('pending', 'confirmed', 'edited', 'unknown', 'removed')),
  card_name text not null default '',
  game_id text not null default 'magic',
  scryfall_id text,
  set_code text,
  collector_number text,
  rarity text,
  finish text,
  condition text,
  quantity integer not null default 1 check (quantity > 0),
  market_price numeric(14,4) check (market_price is null or market_price >= 0),
  existing_owned_quantity integer not null default 0 check (existing_owned_quantity >= 0),
  destination_location_id text,
  destination_label text not null default 'Unassigned',
  source_index integer not null default 0 check (source_index >= 0),
  evidence jsonb not null default '[]'::jsonb,
  notes text not null default '',
  duplicate_of_item_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chaos_sort_rules (
  id text not null,
  batch_id uuid not null references public.chaos_sort_batches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rule_key text not null,
  label text not null,
  target_pile text not null,
  priority integer not null default 0,
  pass integer not null default 1 check (pass in (1, 2)),
  enabled boolean not null default true,
  criteria jsonb not null default '{}'::jsonb,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id, batch_id)
);

create index if not exists chaos_sort_batches_user_time_idx
  on public.chaos_sort_batches(user_id, created_at desc);
create index if not exists chaos_sort_batches_user_status_idx
  on public.chaos_sort_batches(user_id, status, updated_at desc);
create index if not exists chaos_sort_items_batch_idx
  on public.chaos_sort_items(batch_id, source_index);
create index if not exists chaos_sort_items_user_state_idx
  on public.chaos_sort_items(user_id, recognition_state, human_state, updated_at desc);
create index if not exists chaos_sort_items_user_hash_idx
  on public.chaos_sort_items(user_id, source_file_hash);
create index if not exists chaos_sort_rules_batch_idx
  on public.chaos_sort_rules(batch_id, priority asc);

alter table public.chaos_sort_batches enable row level security;
alter table public.chaos_sort_items enable row level security;
alter table public.chaos_sort_rules enable row level security;

drop policy if exists "Users view their chaos sort batches" on public.chaos_sort_batches;
create policy "Users view their chaos sort batches"
  on public.chaos_sort_batches for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users create their chaos sort batches" on public.chaos_sort_batches;
create policy "Users create their chaos sort batches"
  on public.chaos_sort_batches for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users manage their chaos sort batches" on public.chaos_sort_batches;
create policy "Users manage their chaos sort batches"
  on public.chaos_sort_batches for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users view their chaos sort items" on public.chaos_sort_items;
create policy "Users view their chaos sort items"
  on public.chaos_sort_items for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users manage their chaos sort items" on public.chaos_sort_items;
create policy "Users manage their chaos sort items"
  on public.chaos_sort_items for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users view their chaos sort rules" on public.chaos_sort_rules;
create policy "Users view their chaos sort rules"
  on public.chaos_sort_rules for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users manage their chaos sort rules" on public.chaos_sort_rules;
create policy "Users manage their chaos sort rules"
  on public.chaos_sort_rules for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on public.chaos_sort_batches from anon;
revoke all on public.chaos_sort_items from anon;
revoke all on public.chaos_sort_rules from anon;
grant select, insert, update, delete on public.chaos_sort_batches to authenticated;
grant select, insert, update, delete on public.chaos_sort_items to authenticated;
grant select, insert, update, delete on public.chaos_sort_rules to authenticated;
