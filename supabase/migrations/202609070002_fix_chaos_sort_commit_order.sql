-- Repairs the Chaos Sort commit ordering for databases that already ran
-- 202609070001_chaos_sort_sessions_and_positions.sql.
-- The batch parent must exist before physical positions can be inserted.

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
  position_id text;
  inventory_id text;
  existing_inventory public.inventory_items%rowtype;
  item_quantity_value numeric;
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

  select * into existing_batch from public.chaos_sort_batches
    where user_id = actor and id = batch_id for update;
  if existing_batch.id is not null and existing_batch.status_v2 = 'CLOSED' then
    return jsonb_build_object('ok', true, 'replayed', true, 'batchId', batch_id,
      'committedCount', existing_batch.current_quantity, 'initialQuantity', existing_batch.initial_quantity,
      'newPositions', 0, 'increasedIdentities', 0);
  end if;

  if session_id is null then
    insert into public.chaos_sort_sessions (user_id, session_code, source, target_batch_size)
    values (actor, 'CS-SESSION-' || upper(left(replace(batch_id::text, '-', ''), 8)), coalesce(batch_payload->>'source', 'Other'), coalesce((batch_payload->>'targetBatchSize')::integer, 100))
    returning id into session_id;
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
  values (batch_id, actor, session_id, coalesce(batch_payload->>'batchCode', batch_id::text), coalesce(batch_payload->>'title', 'Chaos Sort batch'), 'sorting', 'ACTIVE', 0, 0, location_id, coalesce(batch_payload->>'destinationLabel', location_id), 0, 0, now())
  on conflict (id) do update set session_id = excluded.session_id, destination_location_id = excluded.destination_location_id,
    destination_label = excluded.destination_label, updated_at = now();

  for item in select value from jsonb_array_elements(payload->'items')
  loop
    if coalesce(item->>'humanState', '') not in ('confirmed', 'edited')
      or coalesce(item->>'recognitionState', '') = 'unknown' then
      raise exception 'Every committed card must be resolved';
    end if;
    item_id := nullif(item->>'id', '');
    if item_id is null then raise exception 'Card item id is required'; end if;
    if coalesce(length(trim(item->>'cardName')), 0) = 0
      or (nullif(item->>'scryfallId', '') is null and (nullif(item->>'setCode', '') is null or nullif(item->>'collectorNumber', '') is null)) then
      raise exception 'A resolved card needs a name and canonical printing identity';
    end if;
    item_quantity_value := case when jsonb_typeof(item->'quantity') = 'number' then (item->>'quantity')::numeric else null end;
    if item_quantity_value is null
      or item_quantity_value <> trunc(item_quantity_value)
      or item_quantity_value < 1
      or item_quantity_value > 1000 then
      raise exception 'Card quantity must be a whole number between 1 and 1000';
    end if;
    item_quantity := item_quantity_value::integer;
    inventory_id := 'chaos-' || replace(batch_id::text, '-', '') || '-' || left(replace(item_id, '-', ''), 16);
    position_id := 'chaos-position-' || replace(batch_id::text, '-', '') || '-' || left(replace(item_id, '-', ''), 16);
    select * into existing_inventory from public.inventory_items as candidate
      where candidate.user_id = actor
        and lower(candidate.card_name) = lower(coalesce(item->>'cardName', ''))
        and coalesce(candidate.scryfall_id, '') = coalesce(item->>'scryfallId', '')
        and coalesce(candidate.set_code, '') = coalesce(item->>'setCode', '')
        and coalesce(candidate.collector_number, '') = coalesce(item->>'collectorNumber', '')
        and coalesce(candidate.data->>'game_id', '') = coalesce(item->>'gameId', '')
        and coalesce(candidate.data->>'finish', '') = coalesce(item->>'finish', '')
        and coalesce(candidate.data->>'condition', '') = coalesce(item->>'condition', '')
        and coalesce(candidate.data->>'language', '') = coalesce(item->>'language', '')
        and coalesce(candidate.location_id, '') = coalesce(location_id, '')
      order by id
      limit 1
      for update;
    if existing_inventory.id is not null then
      inventory_id := existing_inventory.id;
    end if;

    insert into public.inventory_items (id, user_id, card_name, sku, location_id, scryfall_id, set_code, collector_number, quantity, inventory_value, data)
    values (
      inventory_id, actor, coalesce(item->>'cardName', ''), 'CHAOS-' || coalesce(batch_payload->>'batchCode', batch_id::text), location_id,
      nullif(item->>'scryfallId', ''), nullif(item->>'setCode', ''), nullif(item->>'collectorNumber', ''), item_quantity,
      greatest(0, coalesce((item->>'marketPrice')::numeric, 0) * item_quantity),
      jsonb_build_object('source', 'chaos_sort', 'batch_id', batch_id, 'batch_code', batch_payload->>'batchCode', 'game_id', item->>'gameId', 'condition', item->>'condition', 'finish', item->>'finish', 'language', item->>'language')
    ) on conflict (user_id, id) do update set quantity = public.inventory_items.quantity + excluded.quantity,
      inventory_value = public.inventory_items.inventory_value + excluded.inventory_value,
      updated_at = now(), location_id = excluded.location_id,
      data = public.inventory_items.data || excluded.data;

    insert into public.chaos_sort_inventory_positions (id, user_id, batch_id, item_id, card_name, scryfall_id, set_code, collector_number, finish, condition, language, quantity, location_id)
    values (position_id, actor, batch_id, inventory_id, coalesce(item->>'cardName', ''), nullif(item->>'scryfallId', ''), nullif(item->>'setCode', ''), nullif(item->>'collectorNumber', ''), nullif(item->>'finish', ''), nullif(item->>'condition', ''), nullif(item->>'language', ''), item_quantity, location_id)
    on conflict (user_id, id) do update set quantity = excluded.quantity, updated_at = now(), location_id = excluded.location_id;

    insert into public.inventory_events (user_id, inventory_item_id, event_type, source, related_entity_type, related_entity_id, quantity_before, quantity_change, quantity_after, next_location_id, card_name, game_id, scryfall_id, set_code, collector_number, condition, finish, language, idempotency_key, metadata)
    values (actor, inventory_id, case when existing_inventory.id is null then 'inventory_created' else 'quantity_added' end, 'scanner', 'chaos_sort_batch', batch_id::text, coalesce(existing_inventory.quantity, 0), item_quantity, coalesce(existing_inventory.quantity, 0) + item_quantity, location_id, item->>'cardName', nullif(item->>'gameId', ''), nullif(item->>'scryfallId', ''), nullif(item->>'setCode', ''), nullif(item->>'collectorNumber', ''), nullif(item->>'condition', ''), nullif(item->>'finish', ''), nullif(item->>'language', ''), 'chaos-sort-commit:' || batch_id::text || ':' || item_id, jsonb_build_object('session_id', session_id, 'batch_id', batch_id));

    committed := committed + item_quantity;
    if existing_inventory.id is not null then increased_identities := increased_identities + 1; else new_positions := new_positions + 1; end if;
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

do $$
begin
  perform pg_notify('pgrst', 'reload schema');
exception when others then
  null;
end;
$$;
