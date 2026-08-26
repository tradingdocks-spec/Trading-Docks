-- Inventory financial/event ledger proposal.
-- Forward-only additive migration. Do not backfill historical activity as if it
-- were observed; use baseline_snapshot only for explicit operator-approved
-- snapshots after deployment.

create table if not exists public.inventory_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete set null,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  event_type text not null check (
    event_type in (
      'inventory_created',
      'quantity_added',
      'quantity_removed',
      'sold',
      'returned',
      'adjusted',
      'moved_location',
      'condition_changed',
      'finish_changed',
      'price_updated',
      'cost_basis_updated',
      'imported',
      'transferred',
      'deleted_archived',
      'baseline_snapshot'
    )
  ),
  quantity_before integer check (quantity_before is null or quantity_before >= 0),
  quantity_change integer,
  quantity_after integer check (quantity_after is null or quantity_after >= 0),
  unit_cost numeric(14,4) check (unit_cost is null or unit_cost >= 0),
  total_cost numeric(14,2) check (total_cost is null or total_cost >= 0),
  unit_value numeric(14,4) check (unit_value is null or unit_value >= 0),
  total_value numeric(14,2) check (total_value is null or total_value >= 0),
  currency text not null default 'USD',
  source text not null default 'application',
  source_id text,
  idempotency_key text,
  card_name text,
  game_id text,
  scryfall_id text,
  set_code text,
  collector_number text,
  condition text,
  finish text,
  location_id uuid references public.inventory_locations(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists inventory_events_user_time_idx
  on public.inventory_events(user_id, occurred_at desc);

create index if not exists inventory_events_user_item_time_idx
  on public.inventory_events(user_id, inventory_item_id, occurred_at desc)
  where inventory_item_id is not null;

create index if not exists inventory_events_workspace_time_idx
  on public.inventory_events(workspace_id, occurred_at desc)
  where workspace_id is not null;

create index if not exists inventory_events_user_type_time_idx
  on public.inventory_events(user_id, event_type, occurred_at desc);

create unique index if not exists inventory_events_user_idempotency_idx
  on public.inventory_events(user_id, idempotency_key)
  where idempotency_key is not null;

alter table public.inventory_events enable row level security;

drop policy if exists "Users view their inventory events" on public.inventory_events;
create policy "Users view their inventory events"
  on public.inventory_events for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users create their inventory events" on public.inventory_events;
create policy "Users create their inventory events"
  on public.inventory_events for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users update their inventory events" on public.inventory_events;
create policy "Users update their inventory events"
  on public.inventory_events for update to authenticated
  using (false)
  with check (false);

drop policy if exists "Users delete their inventory events" on public.inventory_events;
create policy "Users delete their inventory events"
  on public.inventory_events for delete to authenticated
  using (false);

revoke all on public.inventory_events from anon;
grant select, insert on public.inventory_events to authenticated;

comment on table public.inventory_events is
  'Append-only user-scoped inventory movement and financial event ledger. Historical backfills must be labelled baseline_snapshot and are not inferred as observed activity.';

notify pgrst, 'reload schema';
