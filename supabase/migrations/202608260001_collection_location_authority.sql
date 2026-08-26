-- Collection Location Authority
-- Forward-only proposal. Do not apply without production review.
-- Adds authoritative lot-level movement/removal helpers used by Collection Storage.

create or replace function public.move_inventory_lot_quantity(
  p_inventory_item_id text,
  p_quantity integer,
  p_to_location_id text default null,
  p_idempotency_key text default null,
  p_source public.inventory_event_source default 'collector_workspace'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_source public.inventory_items%rowtype;
  v_destination public.inventory_items%rowtype;
  v_destination_id text := gen_random_uuid()::text;
  v_source_before integer;
  v_source_after integer;
  v_source_value numeric;
  v_destination_value numeric;
  v_existing_event public.inventory_events%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'TD_COLLECTOR_INVALID_QUANTITY' using errcode = '22023';
  end if;

  if p_idempotency_key is not null then
    select *
      into v_existing_event
      from public.inventory_events e
     where e.user_id = v_user_id
       and e.idempotency_key = p_idempotency_key
     limit 1;
    if found then
      return jsonb_build_object('ok', true, 'idempotent', true);
    end if;
  end if;

  select *
    into v_source
    from public.inventory_items i
   where i.user_id = v_user_id
     and i.id = p_inventory_item_id
   for update;

  if not found then
    raise exception 'Collection record not found.' using errcode = 'P0002';
  end if;

  v_source_before := greatest(coalesce(v_source.quantity, 0), 0);
  if p_quantity > v_source_before then
    raise exception 'TD_COLLECTOR_INVALID_QUANTITY' using errcode = '22023';
  end if;

  if p_to_location_id is not null and not exists (
    select 1
      from public.inventory_locations l
     where l.user_id = v_user_id
       and l.id = p_to_location_id
       and coalesce(l.data ->> 'archivedAt', '') = ''
  ) then
    raise exception 'Choose one of your active storage locations.' using errcode = 'P0002';
  end if;

  if p_quantity = v_source_before then
    update public.inventory_items
       set location_id = p_to_location_id,
           data = jsonb_set(
             jsonb_set(coalesce(data, '{}'::jsonb), '{locationId}', coalesce(to_jsonb(p_to_location_id), 'null'::jsonb), true),
             '{updatedAt}',
             to_jsonb(now()::text),
             true
           ),
           updated_at = now()
     where user_id = v_user_id
       and id = p_inventory_item_id
     returning * into v_source;

    insert into public.inventory_events (
      user_id, workspace_id, inventory_item_id, event_type, source, source_id, idempotency_key,
      quantity_before, quantity_change, quantity_after,
      previous_location_id, next_location_id,
      card_name, game_id, product_type, scryfall_id, set_code, collector_number,
      tcgplayer_product_id, tcgplayer_sku_id, condition, finish, language,
      metadata
    ) values (
      v_user_id, nullif(v_source.data ->> 'workspaceId', '')::uuid, v_source.id, 'location_changed', p_source, p_idempotency_key, p_idempotency_key,
      v_source_before, 0, v_source_before,
      v_source.location_id, p_to_location_id,
      v_source.card_name, coalesce(v_source.game_id, v_source.data ->> 'gameId'), coalesce(v_source.product_type, v_source.data ->> 'productType'),
      v_source.scryfall_id, v_source.set_code, v_source.collector_number,
      v_source.tcgplayer_product_id, v_source.tcgplayer_sku_id,
      coalesce(v_source.data ->> 'condition', v_source.data ->> 'rawCondition'),
      coalesce(v_source.variant, v_source.data ->> 'finish', v_source.data ->> 'variant'),
      coalesce(v_source.language, v_source.data ->> 'language'),
      jsonb_build_object('operation', 'move_lot', 'movedQuantity', p_quantity)
    )
    on conflict (user_id, idempotency_key) where idempotency_key is not null do nothing;

    return jsonb_build_object('ok', true, 'sourceItemId', v_source.id, 'destinationItemId', v_source.id);
  end if;

  v_source_after := v_source_before - p_quantity;
  v_source_value := case
    when v_source.inventory_value is null then null
    else round((v_source.inventory_value * v_source_after / greatest(v_source_before, 1))::numeric, 6)
  end;
  v_destination_value := case
    when v_source.inventory_value is null then null
    else round((v_source.inventory_value * p_quantity / greatest(v_source_before, 1))::numeric, 6)
  end;

  update public.inventory_items
     set quantity = v_source_after,
         inventory_value = coalesce(v_source_value, inventory_value),
         data = jsonb_set(coalesce(data, '{}'::jsonb), '{updatedAt}', to_jsonb(now()::text), true),
         updated_at = now()
   where user_id = v_user_id
     and id = v_source.id;

  insert into public.inventory_items (
    id, user_id, card_name, sku, location_id, scryfall_id, set_code, collector_number,
    quantity, inventory_value, data, game_id, product_type, provider_category_id,
    provider_product_id, provider_sku_id, tcgplayer_product_id, tcgplayer_sku_id,
    variant, language, updated_at
  ) values (
    v_destination_id, v_user_id, v_source.card_name, v_destination_id, p_to_location_id,
    v_source.scryfall_id, v_source.set_code, v_source.collector_number,
    p_quantity, coalesce(v_destination_value, 0),
    jsonb_set(
      jsonb_set(coalesce(v_source.data, '{}'::jsonb), '{locationId}', coalesce(to_jsonb(p_to_location_id), 'null'::jsonb), true),
      '{updatedAt}',
      to_jsonb(now()::text),
      true
    ),
    v_source.game_id, v_source.product_type, v_source.provider_category_id,
    v_source.provider_product_id, v_source.provider_sku_id, v_source.tcgplayer_product_id,
    v_source.tcgplayer_sku_id, v_source.variant, v_source.language, now()
  )
  returning * into v_destination;

  insert into public.inventory_events (
    user_id, workspace_id, inventory_item_id, event_type, source, source_id, idempotency_key,
    quantity_before, quantity_change, quantity_after,
    previous_location_id, next_location_id,
    card_name, game_id, product_type, scryfall_id, set_code, collector_number,
    tcgplayer_product_id, tcgplayer_sku_id, condition, finish, language,
    unit_value, total_value, metadata
  ) values (
    v_user_id, nullif(v_source.data ->> 'workspaceId', '')::uuid, v_source.id, 'quantity_removed', p_source, p_idempotency_key, p_idempotency_key,
    v_source_before, -p_quantity, v_source_after,
    v_source.location_id, v_source.location_id,
    v_source.card_name, coalesce(v_source.game_id, v_source.data ->> 'gameId'), coalesce(v_source.product_type, v_source.data ->> 'productType'),
    v_source.scryfall_id, v_source.set_code, v_source.collector_number,
    v_source.tcgplayer_product_id, v_source.tcgplayer_sku_id,
    coalesce(v_source.data ->> 'condition', v_source.data ->> 'rawCondition'),
    coalesce(v_source.variant, v_source.data ->> 'finish', v_source.data ->> 'variant'),
    coalesce(v_source.language, v_source.data ->> 'language'),
    null, v_destination_value,
    jsonb_build_object('operation', 'move_lot_split_source', 'destinationItemId', v_destination.id)
  )
  on conflict (user_id, idempotency_key) where idempotency_key is not null do nothing;

  insert into public.inventory_events (
    user_id, workspace_id, inventory_item_id, event_type, source, source_id, idempotency_key,
    quantity_before, quantity_change, quantity_after,
    previous_location_id, next_location_id,
    card_name, game_id, product_type, scryfall_id, set_code, collector_number,
    tcgplayer_product_id, tcgplayer_sku_id, condition, finish, language,
    unit_value, total_value, metadata
  ) values (
    v_user_id, nullif(v_source.data ->> 'workspaceId', '')::uuid, v_destination.id, 'inventory_created', p_source, p_idempotency_key || ':destination', p_idempotency_key || ':destination',
    0, p_quantity, p_quantity,
    v_source.location_id, p_to_location_id,
    v_destination.card_name, coalesce(v_destination.game_id, v_destination.data ->> 'gameId'), coalesce(v_destination.product_type, v_destination.data ->> 'productType'),
    v_destination.scryfall_id, v_destination.set_code, v_destination.collector_number,
    v_destination.tcgplayer_product_id, v_destination.tcgplayer_sku_id,
    coalesce(v_destination.data ->> 'condition', v_destination.data ->> 'rawCondition'),
    coalesce(v_destination.variant, v_destination.data ->> 'finish', v_destination.data ->> 'variant'),
    coalesce(v_destination.language, v_destination.data ->> 'language'),
    null, v_destination_value,
    jsonb_build_object('operation', 'move_lot_split_destination', 'sourceItemId', v_source.id)
  )
  on conflict (user_id, idempotency_key) where idempotency_key is not null do nothing;

  return jsonb_build_object('ok', true, 'sourceItemId', v_source.id, 'destinationItemId', v_destination.id);
end;
$$;

create or replace function public.remove_inventory_lot_quantity(
  p_inventory_item_id text,
  p_quantity integer,
  p_reason text default 'Removed from collection',
  p_idempotency_key text default null,
  p_source public.inventory_event_source default 'collector_workspace'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_source public.inventory_items%rowtype;
  v_before integer;
  v_after integer;
  v_next_value numeric;
  v_existing_event public.inventory_events%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'TD_COLLECTOR_INVALID_QUANTITY' using errcode = '22023';
  end if;

  if p_idempotency_key is not null then
    select *
      into v_existing_event
      from public.inventory_events e
     where e.user_id = v_user_id
       and e.idempotency_key = p_idempotency_key
     limit 1;
    if found then
      return jsonb_build_object('ok', true, 'idempotent', true);
    end if;
  end if;

  select *
    into v_source
    from public.inventory_items i
   where i.user_id = v_user_id
     and i.id = p_inventory_item_id
   for update;

  if not found then
    raise exception 'Collection record not found.' using errcode = 'P0002';
  end if;

  v_before := greatest(coalesce(v_source.quantity, 0), 0);
  if p_quantity > v_before then
    raise exception 'TD_COLLECTOR_INVALID_QUANTITY' using errcode = '22023';
  end if;

  v_after := v_before - p_quantity;
  v_next_value := case
    when v_source.inventory_value is null then null
    else round((v_source.inventory_value * v_after / greatest(v_before, 1))::numeric, 6)
  end;

  update public.inventory_items
     set quantity = v_after,
         inventory_value = coalesce(v_next_value, inventory_value),
         data = jsonb_set(
           jsonb_set(coalesce(data, '{}'::jsonb), '{removedAt}', case when v_after = 0 then to_jsonb(now()::text) else coalesce(data -> 'removedAt', 'null'::jsonb) end, true),
           '{updatedAt}',
           to_jsonb(now()::text),
           true
         ),
         updated_at = now()
   where user_id = v_user_id
     and id = v_source.id
   returning * into v_source;

  insert into public.inventory_events (
    user_id, workspace_id, inventory_item_id, event_type, source, source_id, idempotency_key,
    quantity_before, quantity_change, quantity_after,
    previous_location_id, next_location_id,
    card_name, game_id, product_type, scryfall_id, set_code, collector_number,
    tcgplayer_product_id, tcgplayer_sku_id, condition, finish, language,
    total_value, metadata
  ) values (
    v_user_id, nullif(v_source.data ->> 'workspaceId', '')::uuid, v_source.id, 'quantity_removed', p_source, p_idempotency_key, p_idempotency_key,
    v_before, -p_quantity, v_after,
    v_source.location_id, v_source.location_id,
    v_source.card_name, coalesce(v_source.game_id, v_source.data ->> 'gameId'), coalesce(v_source.product_type, v_source.data ->> 'productType'),
    v_source.scryfall_id, v_source.set_code, v_source.collector_number,
    v_source.tcgplayer_product_id, v_source.tcgplayer_sku_id,
    coalesce(v_source.data ->> 'condition', v_source.data ->> 'rawCondition'),
    coalesce(v_source.variant, v_source.data ->> 'finish', v_source.data ->> 'variant'),
    coalesce(v_source.language, v_source.data ->> 'language'),
    v_next_value,
    jsonb_build_object('operation', 'remove_from_collection', 'removedQuantity', p_quantity, 'reason', coalesce(p_reason, 'Removed from collection'))
  )
  on conflict (user_id, idempotency_key) where idempotency_key is not null do nothing;

  return jsonb_build_object('ok', true, 'sourceItemId', v_source.id, 'quantityAfter', v_after);
end;
$$;
