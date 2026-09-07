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
alter table public.chaos_sort_batches
  add column if not exists initial_quantity integer not null default 0;
alter table public.chaos_sort_batches
  add column if not exists current_quantity integer not null default 0;
alter table public.chaos_sort_batches
  add column if not exists status_v2 text not null default 'ACTIVE';

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

-- Atomic close boundary. The client sends reviewed items once; the database owns
-- validation, inventory writes, events, positions, and the final batch state.
create or replace function public.commit_chaos_sort_batch(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  batch_payload jsonb := payload->'batch';
  session_id uuid := nullif(batch_payload->>'sessionId', '')::uuid;
  batch_id uuid := nullif(batch_payload->>'id', '')::uuid;
  location_id text := nullif(batch_payload->>'destinationLocationId', '');
  item jsonb;
  item_id text;
  inventory_id text;
  existing_identity boolean;
  item_quantity integer;
  committed integer := 0;
  new_positions integer := 0;
  increased_identities integer := 0;
  existing_batch public.chaos_sort_batches%rowtype;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if batch_id is null then raise exception 'Batch id is required'; end if;
  if location_id is null then raise exception 'A destination location is required'; end if;
  if jsonb_typeof(payload->'items') <> 'array' or jsonb_array_length(payload->'items') = 0 then
    raise exception 'At least one reviewed card is required';
  end if;

  if session_id is null then
    insert into public.chaos_sort_sessions (user_id, session_code, source, target_batch_size)
    values (actor, 'CS-SESSION-' || upper(left(replace(batch_id::text, '-', ''), 8)), coalesce(batch_payload->>'source', 'Other'), coalesce((batch_payload->>'targetBatchSize')::integer, 100))
    returning id into session_id;
  end if;

  select * into existing_batch from public.chaos_sort_batches
    where user_id = actor and id = batch_id for update;
  if existing_batch.id is not null and existing_batch.status_v2 = 'CLOSED' then
    return jsonb_build_object('ok', true, 'replayed', true, 'batchId', batch_id,
      'committedCount', existing_batch.current_quantity, 'initialQuantity', existing_batch.initial_quantity,
      'newPositions', 0, 'increasedIdentities', 0);
  end if;

  if not exists (select 1 from public.chaos_sort_sessions where id = session_id and user_id = actor and status = 'active') then
    raise exception 'Chaos Sort session is not active';
  end if;
  if not exists (select 1 from public.inventory_locations where user_id = actor and id = location_id) then
    raise exception 'Destination location is invalid';
  end if;

  -- Establish the parent row before inserting physical positions. The
  -- positions table has a foreign key to chaos_sort_batches(id), so the
  -- parent must exist before the item loop starts.
  insert into public.chaos_sort_batches (id, user_id, session_id, batch_code, title, status, status_v2, source_count, confirmed_count, destination_location_id, destination_label, initial_quantity, current_quantity, updated_at)
  values (batch_id, actor, session_id, coalesce(batch_payload->>'batchCode', batch_id::text), coalesce(batch_payload->>'title', 'Chaos Sort batch'), 'committing', 'OPEN', 0, 0, location_id, coalesce(batch_payload->>'destinationLabel', location_id), 0, 0, now())
  on conflict (id) do update set session_id = excluded.session_id, destination_location_id = excluded.destination_location_id,
    destination_label = excluded.destination_label, updated_at = now();

  for item in select value from jsonb_array_elements(payload->'items')
  loop
    if coalesce(item->>'humanState', '') not in ('confirmed', 'edited')
      or coalesce(item->>'recognitionState', '') = 'unknown' then
      raise exception 'Every committed card must be resolved';
    end if;
    item_quantity := greatest(1, coalesce((item->>'quantity')::integer, 1));
    item_id := nullif(item->>'id', '');
    if item_id is null then raise exception 'Card item id is required'; end if;
    inventory_id := 'chaos-' || replace(batch_id::text, '-', '') || '-' || left(replace(item_id, '-', ''), 16);
    existing_identity := exists (
      select 1 from public.inventory_items
      where user_id = actor
        and lower(card_name) = lower(coalesce(item->>'cardName', ''))
        and coalesce(set_code, '') = coalesce(item->>'setCode', '')
        and coalesce(collector_number, '') = coalesce(item->>'collectorNumber', '')
    );

    insert into public.inventory_items (id, user_id, card_name, sku, location_id, scryfall_id, set_code, collector_number, quantity, inventory_value, data)
    values (
      inventory_id, actor, coalesce(item->>'cardName', ''), 'CHAOS-' || coalesce(batch_payload->>'batchCode', batch_id::text), location_id,
      nullif(item->>'scryfallId', ''), nullif(item->>'setCode', ''), nullif(item->>'collectorNumber', ''), item_quantity,
      greatest(0, coalesce((item->>'marketPrice')::numeric, 0) * item_quantity),
      jsonb_build_object('source', 'chaos_sort', 'batch_id', batch_id, 'batch_code', batch_payload->>'batchCode', 'condition', item->>'condition', 'finish', item->>'finish')
    ) on conflict (user_id, id) do update set quantity = excluded.quantity, updated_at = now(), location_id = excluded.location_id;

    insert into public.chaos_sort_inventory_positions (id, user_id, batch_id, item_id, card_name, scryfall_id, set_code, collector_number, finish, condition, quantity, location_id)
    values (inventory_id, actor, batch_id, inventory_id, coalesce(item->>'cardName', ''), nullif(item->>'scryfallId', ''), nullif(item->>'setCode', ''), nullif(item->>'collectorNumber', ''), nullif(item->>'finish', ''), nullif(item->>'condition', ''), item_quantity, location_id)
    on conflict (user_id, id) do update set quantity = excluded.quantity, updated_at = now(), location_id = excluded.location_id;

    insert into public.inventory_events (user_id, inventory_item_id, event_type, source, related_entity_type, related_entity_id, quantity_before, quantity_change, quantity_after, next_location_id, card_name, scryfall_id, set_code, collector_number, condition, finish, idempotency_key, metadata)
    values (actor, inventory_id, 'inventory_created', 'scanner', 'chaos_sort_batch', batch_id::text, 0, item_quantity, item_quantity, location_id, item->>'cardName', nullif(item->>'scryfallId', ''), nullif(item->>'setCode', ''), nullif(item->>'collectorNumber', ''), nullif(item->>'condition', ''), nullif(item->>'finish', ''), 'chaos-sort-commit:' || batch_id::text || ':' || item_id, jsonb_build_object('session_id', session_id, 'batch_id', batch_id));

    committed := committed + item_quantity;
    if existing_identity then increased_identities := increased_identities + 1; else new_positions := new_positions + 1; end if;
  end loop;

  update public.chaos_sort_batches set status = 'committed', status_v2 = 'CLOSED', source_count = committed,
    initial_quantity = committed, current_quantity = committed, confirmed_count = committed,
    updated_at = now(), completed_at = now(), closed_at = now()
    where id = batch_id and user_id = actor;

  return jsonb_build_object('ok', true, 'replayed', false, 'batchId', batch_id, 'sessionId', session_id,
    'committedCount', committed, 'initialQuantity', committed, 'newPositions', new_positions, 'increasedIdentities', increased_identities,
    'unresolvedCount', 0, 'locationId', location_id);
exception when unique_violation then
  -- A replay races the original commit; the outer transaction rolls back and
  -- the caller can safely retry with the same batch id.
  raise exception 'Chaos Sort commit already exists or conflicted; retry the same batch';
end;
$$;

revoke all on function public.commit_chaos_sort_batch(jsonb) from public, anon;
grant execute on function public.commit_chaos_sort_batch(jsonb) to authenticated;

create or replace function public.pick_chaos_sort_position(target_position_id text, pick_quantity integer default 1)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  position public.chaos_sort_inventory_positions%rowtype;
  before_quantity integer;
  after_quantity integer;
  batch_remaining integer;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if pick_quantity is null or pick_quantity < 1 then raise exception 'Pick quantity must be positive'; end if;
  select * into position from public.chaos_sort_inventory_positions
    where user_id = actor and id = target_position_id for update;
  if position.id is null then raise exception 'Inventory position not found'; end if;
  if position.quantity < pick_quantity then raise exception 'Insufficient quantity in this physical position'; end if;
  before_quantity := position.quantity;
  after_quantity := before_quantity - pick_quantity;
  update public.chaos_sort_inventory_positions set quantity = after_quantity, status = case when after_quantity = 0 then 'depleted' else 'active' end, updated_at = now()
    where user_id = actor and id = target_position_id;
  update public.inventory_items set quantity = after_quantity, updated_at = now() where user_id = actor and id = position.item_id;
  insert into public.inventory_events (user_id, inventory_item_id, event_type, source, related_entity_type, related_entity_id, quantity_before, quantity_change, quantity_after, previous_location_id, next_location_id, card_name, scryfall_id, set_code, collector_number, condition, finish, idempotency_key, metadata)
    values (actor, position.item_id, 'quantity_removed', 'scanner', 'chaos_sort_batch', position.batch_id::text, before_quantity, -pick_quantity, after_quantity, position.location_id, position.location_id, position.card_name, position.scryfall_id, position.set_code, position.collector_number, position.condition, position.finish, 'chaos-sort-pick:' || target_position_id || ':' || before_quantity, jsonb_build_object('batch_id', position.batch_id, 'position_id', target_position_id));
  select coalesce(sum(quantity), 0) into batch_remaining from public.chaos_sort_inventory_positions where user_id = actor and batch_id = position.batch_id;
  update public.chaos_sort_batches set current_quantity = batch_remaining, status_v2 = case when batch_remaining = 0 then 'DEPLETED' else 'CLOSED' end, updated_at = now() where user_id = actor and id = position.batch_id;
  return jsonb_build_object('ok', true, 'positionId', target_position_id, 'pickedQuantity', pick_quantity, 'remainingPositionQuantity', after_quantity, 'batchRemaining', batch_remaining, 'batchId', position.batch_id);
end;
$$;

revoke all on function public.pick_chaos_sort_position(text, integer) from public, anon;
grant execute on function public.pick_chaos_sort_position(text, integer) to authenticated;

create or replace function public.retire_chaos_sort_batch(target_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  remaining integer;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select current_quantity into remaining from public.chaos_sort_batches where id = target_batch_id and user_id = actor for update;
  if remaining is null then raise exception 'Batch not found'; end if;
  if remaining > 0 then raise exception 'A batch can only be retired after its inventory is depleted'; end if;
  update public.chaos_sort_batches set status_v2 = 'RETIRED', status = 'committed', updated_at = now() where id = target_batch_id and user_id = actor;
  update public.chaos_sort_inventory_positions set status = 'retired', updated_at = now() where batch_id = target_batch_id and user_id = actor;
  return jsonb_build_object('ok', true, 'batchId', target_batch_id, 'status', 'RETIRED');
end;
$$;

revoke all on function public.retire_chaos_sort_batch(uuid) from public, anon;
grant execute on function public.retire_chaos_sort_batch(uuid) to authenticated;
