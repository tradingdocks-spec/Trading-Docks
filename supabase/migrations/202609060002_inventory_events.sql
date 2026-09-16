-- Inventory mutation ledger required by Chaos Sort and other durable writes.
-- Additive, user-scoped, and safe to replay on an existing inventory database.
-- main may already have created inventory_events through the earlier durable
-- ledger migration; the table declaration is retained for fresh installs and
-- the reconciliation below supplies the Chaos Sort-only location projection.

create table if not exists public.inventory_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id text,
  inventory_item_id text,
  event_type text not null,
  source text not null default 'system',
  source_id text,
  related_entity_type text,
  related_entity_id text,
  quantity_before integer,
  quantity_change integer,
  quantity_after integer,
  previous_value text,
  next_value text,
  previous_location_id text,
  next_location_id text,
  previous_unit_cost numeric(14,2),
  next_unit_cost numeric(14,2),
  previous_total_cost numeric(14,2),
  next_total_cost numeric(14,2),
  unit_cost numeric(14,2),
  total_cost numeric(14,2),
  unit_value numeric(14,2),
  total_value numeric(14,2),
  currency text not null default 'USD',
  idempotency_key text,
  card_name text,
  product_type text,
  game_id text,
  scryfall_id text,
  set_code text,
  collector_number text,
  tcgplayer_product_id integer,
  tcgplayer_sku_id integer,
  condition text,
  finish text,
  language text,
  location_id text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

alter table public.inventory_events
  add column if not exists location_id text;

create index if not exists inventory_events_user_time_idx
  on public.inventory_events(user_id, occurred_at desc);
create index if not exists inventory_events_item_time_idx
  on public.inventory_events(user_id, inventory_item_id, occurred_at desc);
create index if not exists inventory_events_related_idx
  on public.inventory_events(user_id, related_entity_type, related_entity_id);

alter table public.inventory_events enable row level security;
drop policy if exists "Users manage their inventory events" on public.inventory_events;
create policy "Users manage their inventory events"
  on public.inventory_events for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.inventory_events from anon;
grant select, insert on public.inventory_events to authenticated;
