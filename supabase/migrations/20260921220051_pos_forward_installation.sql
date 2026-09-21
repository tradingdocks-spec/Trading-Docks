-- Forward installation from the repaired production baseline. No historical replay.
-- Apply as one transaction only after owner approval; installs no enabled workspace or credentials.
set local lock_timeout='5s';
set local statement_timeout='60s';
set local check_function_bodies=off;
do $preflight$ begin
 if to_regclass('public.pos_workspace_settings') is not null then raise exception 'POS_INSTALLATION_ALREADY_PRESENT'; end if;
 if to_regprocedure('inventory_private.scope_inventory_write()') is null or to_regprocedure('public.label_access(uuid,boolean)') is null then raise exception 'POS_INSTALLATION_REPAIR_PREREQUISITE_MISSING'; end if;
 if replace(pg_get_functiondef('commit_chaos_sort_batch(jsonb)'::regprocedure),chr(13),'')<>'CREATE OR REPLACE FUNCTION public.commit_chaos_sort_batch(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''public''
AS $function$
<<compat_chaos>>
declare
  actor uuid := auth.uid();
  batch_payload jsonb := payload->''batch'';
  session_id uuid := nullif(batch_payload->>''sessionId'', '''')::uuid;
  batch_id uuid := nullif(batch_payload->>''id'', '''')::uuid;
  location_id text := nullif(batch_payload->>''destinationLocationId'', '''');
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
  if actor is null then raise exception ''Authentication required''; end if;
  if batch_id is null then raise exception ''Batch id is required''; end if;
  if location_id is null then raise exception ''A destination location is required''; end if;
  if jsonb_typeof(payload->''items'') <> ''array'' or jsonb_array_length(payload->''items'') = 0 then
    raise exception ''At least one reviewed card is required'';
  end if;

  if session_id is null then
    insert into public.chaos_sort_sessions (user_id, session_code, source, target_batch_size)
    values (actor, ''CS-SESSION-'' || upper(left(replace(batch_id::text, ''-'', ''''), 8)), coalesce(batch_payload->>''source'', ''Other''), coalesce((batch_payload->>''targetBatchSize'')::integer, 100))
    returning id into session_id;
  end if;

  select * into existing_batch from public.chaos_sort_batches
    where user_id = actor and id = batch_id for update;
  if existing_batch.id is not null and existing_batch.status_v2 = ''CLOSED'' then
    return jsonb_build_object(''ok'', true, ''replayed'', true, ''batchId'', batch_id,
      ''committedCount'', existing_batch.current_quantity, ''initialQuantity'', existing_batch.initial_quantity,
      ''newPositions'', 0, ''increasedIdentities'', 0);
  end if;

  if not exists (select 1 from public.chaos_sort_sessions where id = session_id and user_id = actor and status = ''active'') then
    raise exception ''Chaos Sort session is not active'';
  end if;
  if not exists (select 1 from public.inventory_locations where user_id = actor and id = compat_chaos.location_id) then
    raise exception ''Destination location is invalid'';
  end if;

  -- Establish the parent row before inserting physical positions. The
  -- positions table has a foreign key to chaos_sort_batches(id), so the
  -- parent must exist before the item loop starts.
  insert into public.chaos_sort_batches (id, user_id, workspace_id, session_id, batch_code, title, status, status_v2, source_count, confirmed_count, destination_location_id, destination_label, initial_quantity, current_quantity, updated_at)
  values (batch_id, actor, nullif(batch_payload->>''workspaceId'','''')::uuid, session_id, coalesce(batch_payload->>''batchCode'', batch_id::text), coalesce(batch_payload->>''title'', ''Chaos Sort batch''), ''sorting'', ''ACTIVE'', 0, 0, location_id, coalesce(batch_payload->>''destinationLabel'', location_id), 0, 0, now())
  on conflict (id) do update set session_id = excluded.session_id, destination_location_id = excluded.destination_location_id,
    destination_label = excluded.destination_label, updated_at = now();

  for item in select value from jsonb_array_elements(payload->''items'')
  loop
    if coalesce(item->>''humanState'', '''') not in (''confirmed'', ''edited'')
      or coalesce(item->>''recognitionState'', '''') = ''unknown'' then
      raise exception ''Every committed card must be resolved'';
    end if;
    item_quantity := greatest(1, coalesce((item->>''quantity'')::integer, 1));
    item_id := nullif(item->>''id'', '''');
    if item_id is null then raise exception ''Card item id is required''; end if;
    inventory_id := ''chaos-'' || replace(batch_id::text, ''-'', '''') || ''-'' || left(replace(item_id, ''-'', ''''), 16);
    existing_identity := exists (
      select 1 from public.inventory_items
      where user_id = actor
        and lower(card_name) = lower(coalesce(item->>''cardName'', ''''))
        and coalesce(set_code, '''') = coalesce(item->>''setCode'', '''')
        and coalesce(collector_number, '''') = coalesce(item->>''collectorNumber'', '''')
    );

    insert into public.inventory_items (id, user_id, card_name, sku, location_id, scryfall_id, set_code, collector_number, quantity, inventory_value, data)
    values (
      inventory_id, actor, coalesce(item->>''cardName'', ''''), ''CHAOS-'' || coalesce(batch_payload->>''batchCode'', batch_id::text), location_id,
      nullif(item->>''scryfallId'', ''''), nullif(item->>''setCode'', ''''), nullif(item->>''collectorNumber'', ''''), item_quantity,
      greatest(0, coalesce((item->>''marketPrice'')::numeric, 0) * item_quantity),
      jsonb_build_object(''source'', ''chaos_sort'', ''batch_id'', batch_id, ''batch_code'', batch_payload->>''batchCode'', ''condition'', item->>''condition'', ''finish'', item->>''finish'')
    ) on conflict (user_id, id) do update set quantity = excluded.quantity, updated_at = now(), location_id = excluded.location_id;

    insert into public.chaos_sort_inventory_positions (id, user_id, batch_id, item_id, card_name, scryfall_id, set_code, collector_number, finish, condition, quantity, location_id)
    values (inventory_id, actor, batch_id, inventory_id, coalesce(item->>''cardName'', ''''), nullif(item->>''scryfallId'', ''''), nullif(item->>''setCode'', ''''), nullif(item->>''collectorNumber'', ''''), nullif(item->>''finish'', ''''), nullif(item->>''condition'', ''''), item_quantity, location_id)
    on conflict (user_id, id) do update set quantity = excluded.quantity, updated_at = now(), location_id = excluded.location_id;

    insert into public.inventory_events (user_id, workspace_id, inventory_item_id, event_type, source, related_entity_type, related_entity_id, quantity_before, quantity_change, quantity_after, next_location_id, card_name, scryfall_id, set_code, collector_number, condition, finish, idempotency_key, metadata)
    values (actor, (select b.workspace_id from public.chaos_sort_batches b where b.id=compat_chaos.batch_id and b.user_id=actor), inventory_id, ''inventory_created'', ''scanner'', ''chaos_sort_batch'', batch_id::text, 0, item_quantity, item_quantity, location_id, item->>''cardName'', nullif(item->>''scryfallId'', ''''), nullif(item->>''setCode'', ''''), nullif(item->>''collectorNumber'', ''''), nullif(item->>''condition'', ''''), nullif(item->>''finish'', ''''), ''chaos-sort-commit:'' || batch_id::text || '':'' || item_id, jsonb_build_object(''session_id'', session_id, ''batch_id'', batch_id));

    committed := committed + item_quantity;
    if existing_identity then increased_identities := increased_identities + 1; else new_positions := new_positions + 1; end if;
  end loop;

  update public.chaos_sort_batches set status = ''committed'', status_v2 = ''CLOSED'', source_count = committed,
    initial_quantity = committed, current_quantity = committed, confirmed_count = committed,
    updated_at = now(), completed_at = now(), closed_at = now()
    where id = batch_id and user_id = actor;

  return jsonb_build_object(''ok'', true, ''replayed'', false, ''batchId'', batch_id, ''sessionId'', session_id,
    ''committedCount'', committed, ''initialQuantity'', committed, ''newPositions'', new_positions, ''increasedIdentities'', increased_identities,
    ''unresolvedCount'', 0, ''locationId'', location_id);
exception when unique_violation then
  -- A replay races the original commit; the outer transaction rolls back and
  -- the caller can safely retry with the same batch id.
  raise exception ''Chaos Sort commit already exists or conflicted; retry the same batch'';
end;
$function$
' then raise exception 'POS_INSTALLATION_FUNCTION_DRIFT: commit_chaos_sort_batch(jsonb)'; end if;
 if replace(pg_get_functiondef('move_inventory_lot_quantity(text,integer,text,text,inventory_event_source)'::regprocedure),chr(13),'')<>'CREATE OR REPLACE FUNCTION public.move_inventory_lot_quantity(p_inventory_item_id text, p_quantity integer, p_to_location_id text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text, p_source inventory_event_source DEFAULT ''collector_workspace''::inventory_event_source)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''public''
AS $function$
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
    raise exception ''Authentication required.'' using errcode = ''28000'';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception ''TD_COLLECTOR_INVALID_QUANTITY'' using errcode = ''22023'';
  end if;

  if p_idempotency_key is not null then
    select *
      into v_existing_event
      from public.inventory_events e
     where e.user_id = v_user_id
       and e.idempotency_key = p_idempotency_key
     limit 1;
    if found then
      return jsonb_build_object(''ok'', true, ''idempotent'', true);
    end if;
  end if;

  select *
    into v_source
    from public.inventory_items i
   where i.user_id = v_user_id
     and i.id = p_inventory_item_id
   for update;

  if not found then
    raise exception ''Collection record not found.'' using errcode = ''P0002'';
  end if;

  v_source_before := greatest(coalesce(v_source.quantity, 0), 0);
  if p_quantity > v_source_before then
    raise exception ''TD_COLLECTOR_INVALID_QUANTITY'' using errcode = ''22023'';
  end if;

  if p_to_location_id is not null and not exists (
    select 1
      from public.inventory_locations l
     where l.user_id = v_user_id
       and l.id = p_to_location_id
       and coalesce(l.data ->> ''archivedAt'', '''') = ''''
  ) then
    raise exception ''Choose one of your active storage locations.'' using errcode = ''P0002'';
  end if;

  if p_quantity = v_source_before then
    update public.inventory_items
       set location_id = p_to_location_id,
           data = jsonb_set(
             jsonb_set(coalesce(data, ''{}''::jsonb), ''{locationId}'', coalesce(to_jsonb(p_to_location_id), ''null''::jsonb), true),
             ''{updatedAt}'',
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
      v_user_id, v_source.workspace_id, v_source.id, ''location_changed'', p_source, p_idempotency_key, p_idempotency_key,
      v_source_before, 0, v_source_before,
      v_source.location_id, p_to_location_id,
      v_source.card_name, coalesce(v_source.game_id, v_source.data ->> ''gameId''), coalesce(v_source.product_type, v_source.data ->> ''productType''),
      v_source.scryfall_id, v_source.set_code, v_source.collector_number,
      v_source.tcgplayer_product_id, v_source.tcgplayer_sku_id,
      coalesce(v_source.data ->> ''condition'', v_source.data ->> ''rawCondition''),
      coalesce(v_source.variant, v_source.data ->> ''finish'', v_source.data ->> ''variant''),
      coalesce(v_source.language, v_source.data ->> ''language''),
      jsonb_build_object(''operation'', ''move_lot'', ''movedQuantity'', p_quantity)
    )
    on conflict (user_id, idempotency_key) where idempotency_key is not null do nothing;

    return jsonb_build_object(''ok'', true, ''sourceItemId'', v_source.id, ''destinationItemId'', v_source.id);
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
         data = jsonb_set(coalesce(data, ''{}''::jsonb), ''{updatedAt}'', to_jsonb(now()::text), true),
         updated_at = now()
   where user_id = v_user_id
     and id = v_source.id;

  insert into public.inventory_items (
    id, user_id, workspace_id, card_name, sku, location_id, scryfall_id, set_code, collector_number,
    quantity, inventory_value, data, game_id, product_type, provider_category_id,
    provider_product_id, provider_sku_id, tcgplayer_product_id, tcgplayer_sku_id,
    variant, language, updated_at
  ) values (
    v_destination_id, v_user_id, v_source.workspace_id, v_source.card_name, v_destination_id, p_to_location_id,
    v_source.scryfall_id, v_source.set_code, v_source.collector_number,
    p_quantity, coalesce(v_destination_value, 0),
    jsonb_set(
      jsonb_set(coalesce(v_source.data, ''{}''::jsonb), ''{locationId}'', coalesce(to_jsonb(p_to_location_id), ''null''::jsonb), true),
      ''{updatedAt}'',
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
    v_user_id, v_source.workspace_id, v_source.id, ''quantity_removed'', p_source, p_idempotency_key, p_idempotency_key,
    v_source_before, -p_quantity, v_source_after,
    v_source.location_id, v_source.location_id,
    v_source.card_name, coalesce(v_source.game_id, v_source.data ->> ''gameId''), coalesce(v_source.product_type, v_source.data ->> ''productType''),
    v_source.scryfall_id, v_source.set_code, v_source.collector_number,
    v_source.tcgplayer_product_id, v_source.tcgplayer_sku_id,
    coalesce(v_source.data ->> ''condition'', v_source.data ->> ''rawCondition''),
    coalesce(v_source.variant, v_source.data ->> ''finish'', v_source.data ->> ''variant''),
    coalesce(v_source.language, v_source.data ->> ''language''),
    null, v_destination_value,
    jsonb_build_object(''operation'', ''move_lot_split_source'', ''destinationItemId'', v_destination.id)
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
    v_user_id, v_source.workspace_id, v_destination.id, ''inventory_created'', p_source, p_idempotency_key || '':destination'', p_idempotency_key || '':destination'',
    0, p_quantity, p_quantity,
    v_source.location_id, p_to_location_id,
    v_destination.card_name, coalesce(v_destination.game_id, v_destination.data ->> ''gameId''), coalesce(v_destination.product_type, v_destination.data ->> ''productType''),
    v_destination.scryfall_id, v_destination.set_code, v_destination.collector_number,
    v_destination.tcgplayer_product_id, v_destination.tcgplayer_sku_id,
    coalesce(v_destination.data ->> ''condition'', v_destination.data ->> ''rawCondition''),
    coalesce(v_destination.variant, v_destination.data ->> ''finish'', v_destination.data ->> ''variant''),
    coalesce(v_destination.language, v_destination.data ->> ''language''),
    null, v_destination_value,
    jsonb_build_object(''operation'', ''move_lot_split_destination'', ''sourceItemId'', v_source.id)
  )
  on conflict (user_id, idempotency_key) where idempotency_key is not null do nothing;

  return jsonb_build_object(''ok'', true, ''sourceItemId'', v_source.id, ''destinationItemId'', v_destination.id);
end;
$function$
' then raise exception 'POS_INSTALLATION_FUNCTION_DRIFT: move_inventory_lot_quantity(text,integer,text,text,inventory_event_source)'; end if;
 if replace(pg_get_functiondef('enforce_collector_inventory_mutation()'::regprocedure),chr(13),'')<>'CREATE OR REPLACE FUNCTION public.enforce_collector_inventory_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''public''
AS $function$
declare
  acting_user_id uuid;
  target_user_id uuid;
  effective_tier text;
  existing_quantity_total bigint;
  previous_quantity_total bigint;
  next_quantity_total bigint;
  has_full_platform_access boolean := false;
begin
  acting_user_id := public.collector_inventory_acting_user();

  if tg_op = ''DELETE'' then
    target_user_id := old.user_id;
  else
    target_user_id := new.user_id;
  end if;

  if acting_user_id is null or target_user_id is null or acting_user_id <> target_user_id then
    perform public.raise_collector_inventory_error(
      ''TD_COLLECTOR_UNAUTHORIZED'',
      ''You can only mutate your own collection records.'',
      target_user_id
    );
  end if;

  if tg_op = ''DELETE'' then
    return old;
  end if;

  if new.quantity is null or new.quantity < 0 then
    perform public.raise_collector_inventory_error(
      ''TD_COLLECTOR_INVALID_QUANTITY'',
      ''Quantity must be a whole number at or above zero.'',
      target_user_id
    );
  end if;

  perform pg_advisory_xact_lock(hashtextextended(''collector-inventory:'' || target_user_id::text, 0));

  effective_tier := public.collector_effective_membership_tier(target_user_id);
  if effective_tier is null then
    perform public.raise_collector_inventory_error(
      ''TD_COLLECTOR_MISSING_MEMBERSHIP'',
      ''Membership could not be resolved for this collection mutation.'',
      target_user_id
    );
  end if;

  has_full_platform_access := coalesce(public.current_admin_role() in (''owner''::public.admin_role, ''admin''::public.admin_role), false);
  if effective_tier = ''free'' and not has_full_platform_access then
    select coalesce(sum(quantity), 0)
      into existing_quantity_total
      from public.inventory_items
     where user_id = target_user_id
       and id <> new.id;

    next_quantity_total := existing_quantity_total + new.quantity;
    if tg_op = ''UPDATE'' then
      previous_quantity_total := existing_quantity_total + old.quantity;
    else
      previous_quantity_total := existing_quantity_total;
    end if;

    -- Only growth is gated. Metadata edits, unchanged quantities, decreases,
    -- and removals must remain possible for an already over-limit collection.
    if next_quantity_total > 500
       and (tg_op = ''INSERT'' or next_quantity_total > previous_quantity_total) then
      perform public.raise_collector_inventory_error(
        ''TD_COLLECTOR_FREE_LIMIT_EXCEEDED'',
        ''Collection limit reached: Free accounts can hold up to 500 total owned cards. Reduce quantity or upgrade to add more.'',
        target_user_id
      );
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$function$
' then raise exception 'POS_INSTALLATION_FUNCTION_DRIFT: enforce_collector_inventory_mutation()'; end if;
 if replace(pg_get_functiondef('pos_private.inventory_entitled(uuid)'::regprocedure),chr(13),'')<>'CREATE OR REPLACE FUNCTION pos_private.inventory_entitled(stock_owner uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''''
AS $function$
 select exists(select 1 from auth.users u where u.id=stock_owner and (u.banned_until is null or u.banned_until<now()))
 and (public.collector_effective_membership_tier(stock_owner) in (''seller'',''store'')
   or exists(select 1 from public.user_roles r where r.user_id=stock_owner and r.role::text in (''owner'',''admin'')))
$function$
' then raise exception 'POS_INSTALLATION_FUNCTION_DRIFT: pos_private.inventory_entitled(uuid)'; end if;
 if replace(pg_get_functiondef('pos_private.authorize_labels(uuid,boolean)'::regprocedure),chr(13),'')<>'CREATE OR REPLACE FUNCTION pos_private.authorize_labels(w uuid, management boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''''
AS $function$
begin
 if auth.uid() is null or not pos_private.inventory_entitled(auth.uid())
 or not exists(select 1 from public.workspace_members m where m.workspace_id=w and m.user_id=auth.uid()
   and m.role in (''owner'',''admin'',''manager'',''member'') and (not management or m.role in (''owner'',''admin'',''manager'')))
 or exists(select 1 from public.workspace_employees e where e.workspace_id=w and e.linked_user_id=auth.uid()
   and (e.employment_status<>''active'' or coalesce(to_jsonb(e)->>''account_status'',''active'')=''suspended''))
 or exists(select 1 from public.workspace_members m join public.workspace_employees e
   on e.workspace_id=m.workspace_id and e.linked_user_id=m.user_id
   where m.workspace_id=w and m.user_id=auth.uid() and m.role in (''member'',''employee'')
   and coalesce(e.permissions->>''pos.sell'',''false'')<>''true'')
 then raise exception ''POS_FORBIDDEN''; end if;
end $function$
' then raise exception 'POS_INSTALLATION_FUNCTION_DRIFT: pos_private.authorize_labels(uuid,boolean)'; end if;
 if replace(pg_get_functiondef('pos_private.guard_label_identity()'::regprocedure),chr(13),'')<>'CREATE OR REPLACE FUNCTION pos_private.guard_label_identity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''''
AS $function$
begin
  if tg_op=''DELETE'' then
    insert into pos_private.label_tombstones(identity_id,workspace_id,inventory_user_id,sku,qr_token,barcode_value)
      values(old.id,old.workspace_id,old.inventory_user_id,old.sku,old.qr_token,old.barcode_value) on conflict do nothing;
    return old;
  end if;
  if tg_op=''UPDATE'' and (new.id,new.workspace_id,new.inventory_user_id,new.inventory_item_id,new.inventory_position_id,new.inventory_location_id,new.sku,new.qr_token,new.barcode_value)
    is distinct from (old.id,old.workspace_id,old.inventory_user_id,old.inventory_item_id,old.inventory_position_id,old.inventory_location_id,old.sku,old.qr_token,old.barcode_value)
    then raise exception ''LABEL_IMMUTABLE''; end if;
  if new.inventory_location_id is not null and not exists(select 1 from public.inventory_locations l where l.user_id=new.inventory_user_id and l.id=new.inventory_location_id) then raise exception ''LABEL_INVALID_TARGET''; end if;
  if tg_op=''INSERT'' and new.inventory_position_id is not null and not exists (
    select 1 from public.chaos_sort_inventory_positions p where p.user_id=new.inventory_user_id and p.id=new.inventory_position_id and p.item_id=new.inventory_item_id
  ) then raise exception ''LABEL_INVALID_TARGET''; end if;
  if exists(select 1 from pos_private.label_tombstones t where t.workspace_id=new.workspace_id and (t.sku=new.sku or t.qr_token=new.qr_token))
    then raise exception ''LABEL_IMMUTABLE''; end if;
  return new;
end $function$
' then raise exception 'POS_INSTALLATION_FUNCTION_DRIFT: pos_private.guard_label_identity()'; end if;
 if replace(pg_get_functiondef('pos_private.label_identity(uuid,text,text)'::regprocedure),chr(13),'')<>'CREATE OR REPLACE FUNCTION pos_private.label_identity(w uuid, item text, v_position_id text DEFAULT NULL::text)
 RETURNS inventory_label_identities
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''''
AS $function$
declare result public.inventory_label_identities%rowtype; kind text;
begin
  perform pos_private.authorize_labels(w,false);
  select i.item_kind into kind from public.inventory_items i where i.workspace_id=w and i.user_id=auth.uid() and i.id=item;
  if not found then raise exception ''POS_FORBIDDEN''; end if;
  perform pg_advisory_xact_lock(hashtextextended(''label:''||w::text||auth.uid()::text||item||coalesce(v_position_id,''''),0));
  select * into result from public.inventory_label_identities z where z.workspace_id=w and z.inventory_user_id=auth.uid()
    and z.inventory_item_id=item and z.inventory_position_id is not distinct from v_position_id and z.status=''active'' and z.revoked_at is null;
  if result.id is null then
    insert into public.inventory_label_identities(workspace_id,inventory_user_id,inventory_item_id,inventory_position_id,target_type,sku,qr_token,public_enabled)
      values(w,auth.uid(),item,v_position_id,case when kind=''sealed'' then ''sealed'' else ''single'' end,'''','''',false) returning * into result;
  end if;
  return result;
end $function$
' then raise exception 'POS_INSTALLATION_FUNCTION_DRIFT: pos_private.label_identity(uuid,text,text)'; end if;
 if replace(pg_get_functiondef('pos_private.retire_position_label()'::regprocedure),chr(13),'')<>'CREATE OR REPLACE FUNCTION pos_private.retire_position_label()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''''
AS $function$
begin
  update public.inventory_label_identities set status=''archived'' where inventory_user_id=old.user_id and inventory_position_id=old.id;
  return old;
end $function$
' then raise exception 'POS_INSTALLATION_FUNCTION_DRIFT: pos_private.retire_position_label()'; end if;
 if replace(pg_get_functiondef('inventory_private.workspace_required(uuid)'::regprocedure),chr(13),'')<>'CREATE OR REPLACE FUNCTION inventory_private.workspace_required(p_owner uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''''
AS $function$
 select exists(select 1 from public.workspaces w where w.owner_id=p_owner)
   or public.collector_effective_membership_tier(p_owner) in (''seller'',''store'')
   or exists(select 1 from public.user_roles r where r.user_id=p_owner and r.role::text in (''owner'',''admin''))
$function$
' then raise exception 'POS_INSTALLATION_FUNCTION_DRIFT: inventory_private.workspace_required(uuid)'; end if;
 if replace(pg_get_functiondef('inventory_private.resolve_workspace(uuid,uuid,text,text,boolean)'::regprocedure),chr(13),'')<>'CREATE OR REPLACE FUNCTION inventory_private.resolve_workspace(p_owner uuid, p_workspace uuid, p_batch text, p_location text, p_required boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''''
AS $function$
declare candidate uuid:=p_workspace; batch_workspace uuid; n integer; memberships integer;
begin
 if p_owner is null or auth.uid() is distinct from p_owner then raise exception ''TD_COLLECTOR_UNAUTHORIZED''; end if;
 if not exists(select 1 from auth.users u where u.id=p_owner and (u.banned_until is null or u.banned_until<now())) then
   raise exception ''INVENTORY_WORKSPACE_FORBIDDEN'';
 end if;
 if nullif(p_location,'''') is not null and not exists(select 1 from public.inventory_locations l where l.user_id=p_owner and l.id=p_location) then
   raise exception ''INVENTORY_WORKSPACE_INVALID_LOCATION'';
 end if;
 if p_batch is not null then
   select b.workspace_id into batch_workspace from public.chaos_sort_batches b where b.id::text=p_batch and b.user_id=p_owner;
   if not found then raise exception ''INVENTORY_WORKSPACE_INVALID_BATCH''; end if;
   if candidate is not null and batch_workspace is not null and candidate<>batch_workspace then raise exception ''INVENTORY_WORKSPACE_CONTEXT_CONFLICT''; end if;
   candidate:=coalesce(candidate,batch_workspace);
 end if;
 if candidate is null then
   select count(*) into memberships from public.workspace_members m where m.user_id=p_owner;
   select count(*),(array_agg(w.id))[1] into n,candidate from public.workspaces w
     join public.workspace_members m on m.workspace_id=w.id and m.user_id=p_owner and m.role=''owner''
     where w.owner_id=p_owner;
   if n<>1 or memberships<>1 then
     if p_required or coalesce(inventory_private.workspace_required(p_owner),false) then
       raise exception ''INVENTORY_WORKSPACE_REQUIRED: choose a unique owned workspace for this operation'';
     end if;
     return null; -- Personal/non-workspace collector inventory remains supported.
   end if;
 end if;
 -- Explicit shared-store context is not inventory ownership. Preserve the
 -- existing partner-owner model: a workspace manager may place THEIR OWN
 -- inventory in that workspace. The collector trigger still authorizes the
 -- inventory write; POS delegation alone never satisfies this relationship.
 if not exists(select 1 from public.workspaces w join public.workspace_members m
   on m.workspace_id=w.id and m.user_id=p_owner
   where w.id=candidate and ((w.owner_id=p_owner and m.role=''owner'') or m.role=''manager'')) then
   raise exception ''INVENTORY_WORKSPACE_FORBIDDEN'';
 end if;
 return candidate;
end $function$
' then raise exception 'POS_INSTALLATION_FUNCTION_DRIFT: inventory_private.resolve_workspace(uuid,uuid,text,text,boolean)'; end if;
 if replace(pg_get_functiondef('inventory_private.scope_inventory_write()'::regprocedure),chr(13),'')<>'CREATE OR REPLACE FUNCTION inventory_private.scope_inventory_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''''
AS $function$
declare existing_workspace uuid; batch_id text;
begin
 if tg_op=''INSERT'' then
   -- INSERT triggers also run for upsert. Preserve the existing authoritative
   -- association when older clients omit it; never reselect another workspace.
   select i.workspace_id into existing_workspace from public.inventory_items i where i.user_id=new.user_id and i.id=new.id;
   if existing_workspace is not null and new.workspace_id is not null and existing_workspace<>new.workspace_id then
     raise exception ''INVENTORY_WORKSPACE_CONTEXT_CONFLICT'';
   end if;
   batch_id:=case when new.data->>''source''=''chaos_sort'' then new.data->>''batch_id'' end;
   new.workspace_id:=inventory_private.resolve_workspace(new.user_id,coalesce(new.workspace_id,existing_workspace),batch_id,new.location_id);
 elsif new.workspace_id is distinct from old.workspace_id then
   -- Allow only the separately reviewed trusted assignment to validate through
   -- the existing collector guard. No actor impersonation or new bypass exists.
   if new.workspace_id is null then raise exception ''INVENTORY_WORKSPACE_REQUIRED''; end if;
   if auth.uid()=new.user_id then
     perform inventory_private.resolve_workspace(new.user_id,new.workspace_id,null,new.location_id,true);
   elsif session_user<>''postgres'' or current_setting(''role'')<>''none'' then
     raise exception ''TD_COLLECTOR_UNAUTHORIZED'';
   end if;
 elsif new.quantity>old.quantity and new.workspace_id is null and coalesce(inventory_private.workspace_required(new.user_id),false) then
   -- A restoration must not resurrect unscoped sellable inventory. No silent
   -- post-hoc assignment: preexisting legacy scope requires the reviewed repair.
   raise exception ''INVENTORY_WORKSPACE_REQUIRED: repair legacy scope before restoring stock'';
 end if;
 return new;
end $function$
' then raise exception 'POS_INSTALLATION_FUNCTION_DRIFT: inventory_private.scope_inventory_write()'; end if;
 if replace(pg_get_functiondef('inventory_private.scope_chaos_batch()'::regprocedure),chr(13),'')<>'CREATE OR REPLACE FUNCTION inventory_private.scope_chaos_batch()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''''
AS $function$
declare existing_workspace uuid;
begin
 select b.workspace_id into existing_workspace from public.chaos_sort_batches b where b.id=new.id and b.user_id=new.user_id;
 if new.workspace_id is not null and existing_workspace is not null and new.workspace_id<>existing_workspace then raise exception ''INVENTORY_WORKSPACE_CONTEXT_CONFLICT''; end if;
 new.workspace_id:=inventory_private.resolve_workspace(new.user_id,coalesce(new.workspace_id,existing_workspace),null,new.destination_location_id);
 return new;
end $function$
' then raise exception 'POS_INSTALLATION_FUNCTION_DRIFT: inventory_private.scope_chaos_batch()'; end if;
 if replace(pg_get_functiondef('create_inventory_item_with_event(jsonb,inventory_event_source,text,text,text)'::regprocedure),chr(13),'')<>'CREATE OR REPLACE FUNCTION public.create_inventory_item_with_event(p_inventory jsonb, p_source inventory_event_source DEFAULT ''manual''::inventory_event_source, p_idempotency_key text DEFAULT NULL::text, p_related_entity_type text DEFAULT NULL::text, p_related_entity_id text DEFAULT NULL::text)
 RETURNS inventory_items
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''public''
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_item public.inventory_items%rowtype;
  v_item_id text := coalesce(nullif(p_inventory ->> ''id'', ''''), gen_random_uuid()::text);
  v_quantity integer := greatest(0, coalesce(nullif(p_inventory ->> ''quantity'', '''')::integer, 0));
  v_location_id text := nullif(p_inventory ->> ''location_id'', '''');
  v_data jsonb := coalesce(p_inventory -> ''data'', ''{}''::jsonb);
begin
  if v_user_id is null then
    raise exception ''Authentication required.'' using errcode = ''28000'';
  end if;

  if v_location_id is not null and not exists (
    select 1
    from public.inventory_locations l
    where l.user_id = v_user_id
      and l.id = v_location_id
  ) then
    raise exception ''Choose one of your storage locations.'' using errcode = ''P0002'';
  end if;

  insert into public.inventory_items (
    id,
    user_id,
    workspace_id,
    card_name,
    sku,
    location_id,
    scryfall_id,
    set_code,
    collector_number,
    quantity,
    inventory_value,
    data,
    game_id,
    product_type,
    provider_category_id,
    provider_product_id,
    provider_sku_id,
    tcgplayer_product_id,
    tcgplayer_sku_id,
    variant,
    language,
    updated_at
  ) values (
    v_item_id,
    v_user_id,
    nullif(p_inventory->>''workspace_id'','''')::uuid,
    coalesce(nullif(p_inventory ->> ''card_name'', ''''), ''Unknown card''),
    coalesce(nullif(p_inventory ->> ''sku'', ''''), v_item_id),
    v_location_id,
    nullif(p_inventory ->> ''scryfall_id'', ''''),
    nullif(p_inventory ->> ''set_code'', ''''),
    nullif(p_inventory ->> ''collector_number'', ''''),
    v_quantity,
    coalesce(nullif(p_inventory ->> ''inventory_value'', '''')::numeric, 0),
    v_data,
    nullif(p_inventory ->> ''game_id'', ''''),
    nullif(p_inventory ->> ''product_type'', ''''),
    nullif(p_inventory ->> ''provider_category_id'', ''''),
    nullif(p_inventory ->> ''provider_product_id'', ''''),
    nullif(p_inventory ->> ''provider_sku_id'', ''''),
    nullif(p_inventory ->> ''tcgplayer_product_id'', '''')::bigint,
    nullif(p_inventory ->> ''tcgplayer_sku_id'', '''')::bigint,
    nullif(p_inventory ->> ''variant'', ''''),
    nullif(p_inventory ->> ''language'', ''''),
    now()
  )
  returning * into v_item;

  insert into public.inventory_events (
    user_id,
    workspace_id,
    inventory_item_id,
    event_type,
    source,
    source_id,
    related_entity_type,
    related_entity_id,
    quantity_before,
    quantity_change,
    quantity_after,
    next_value,
    next_location_id,
    next_unit_cost,
    next_total_cost,
    unit_value,
    total_value,
    card_name,
    game_id,
    product_type,
    scryfall_id,
    set_code,
    collector_number,
    tcgplayer_product_id,
    tcgplayer_sku_id,
    condition,
    finish,
    language,
    idempotency_key,
    metadata
  ) values (
    v_user_id,
    v_item.workspace_id,
    v_item.id,
    case when p_source in (''csv_import'', ''tcgplayer_import'', ''ebay_import'', ''shopify_import'', ''scanner_replay'') then ''imported''::public.inventory_event_type else ''inventory_created''::public.inventory_event_type end,
    p_source,
    p_idempotency_key,
    p_related_entity_type,
    p_related_entity_id,
    null,
    v_item.quantity,
    v_item.quantity,
    ''created'',
    v_item.location_id,
    nullif(v_data ->> ''costBasis'', '''')::numeric,
    nullif(v_data ->> ''totalCostBasis'', '''')::numeric,
    v_item.inventory_value,
    v_item.inventory_value * greatest(v_item.quantity, 0),
    v_item.card_name,
    coalesce(v_item.game_id, v_item.data ->> ''gameId''),
    coalesce(v_item.product_type, v_item.data ->> ''productType''),
    v_item.scryfall_id,
    v_item.set_code,
    v_item.collector_number,
    coalesce(v_item.tcgplayer_product_id, nullif(v_item.data ->> ''tcgplayerProductId'', '''')::bigint),
    coalesce(v_item.tcgplayer_sku_id, nullif(v_item.data ->> ''tcgplayerSkuId'', '''')::bigint),
    coalesce(v_item.data ->> ''condition'', v_item.data ->> ''rawCondition''),
    coalesce(v_item.data ->> ''finish'', v_item.data ->> ''variant''),
    coalesce(v_item.language, v_item.data ->> ''language''),
    p_idempotency_key,
    ''{}''::jsonb
  )
  on conflict (user_id, idempotency_key) where idempotency_key is not null do nothing;

  return v_item;
end;
$function$
' then raise exception 'POS_INSTALLATION_FUNCTION_DRIFT: create_inventory_item_with_event(jsonb,inventory_event_source,text,text,text)'; end if;
end $preflight$;
revoke all on schema pos_private from public,anon,authenticated;

create table "pos_private"."request_limits" (
  "actor_id" uuid not null,
  "bucket" text not null,
  "started_at" timestamp with time zone default now() not null,
  "requests" integer default 1 not null
);
alter table "pos_private"."request_limits" enable row level security;
revoke all on table "pos_private"."request_limits" from public,anon,authenticated,service_role;

create table "public"."pos_access_events" (
  "id" uuid default gen_random_uuid() not null,
  "workspace_id" uuid not null,
  "actor_id" uuid not null,
  "action" text not null,
  "snapshot" jsonb not null,
  "created_at" timestamp with time zone default now() not null
);
alter table "public"."pos_access_events" enable row level security;
revoke all on table "public"."pos_access_events" from public,anon,authenticated,service_role;
grant INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN on table "public"."pos_access_events" to "service_role";

create table "pos_private"."stock_permits" (
  "transaction_id" bigint not null,
  "backend" integer not null,
  "actor_id" uuid not null,
  "owner_id" uuid not null,
  "item_id" text not null,
  "before_row" jsonb not null,
  "after_quantity" integer not null
);
alter table "pos_private"."stock_permits" enable row level security;
revoke all on table "pos_private"."stock_permits" from public,anon,authenticated,service_role;

create table "public"."pos_workspace_settings" (
  "workspace_id" uuid not null,
  "enabled" boolean default false not null
);
alter table "public"."pos_workspace_settings" enable row level security;
revoke all on table "public"."pos_workspace_settings" from public,anon,authenticated,service_role;
grant INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN on table "public"."pos_workspace_settings" to "service_role";

create table "public"."pos_location_inventory_locations" (
  "workspace_id" uuid not null,
  "site_id" uuid not null,
  "inventory_user_id" uuid not null,
  "location_id" text not null
);
alter table "public"."pos_location_inventory_locations" enable row level security;
revoke all on table "public"."pos_location_inventory_locations" from public,anon,authenticated,service_role;
grant INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN on table "public"."pos_location_inventory_locations" to "service_role";

create table "public"."pos_tenders" (
  "id" uuid default gen_random_uuid() not null,
  "workspace_id" uuid not null,
  "sale_id" uuid not null,
  "method" text not null,
  "verification" text default 'recorded'::text not null,
  "amount_minor" bigint not null,
  "received_minor" bigint not null,
  "change_minor" bigint not null,
  "payment_attempt_id" uuid,
  "provider_reference" text,
  "metadata" jsonb default '{}'::jsonb not null
);
alter table "public"."pos_tenders" enable row level security;
revoke all on table "public"."pos_tenders" from public,anon,authenticated,service_role;
grant INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN on table "public"."pos_tenders" to "service_role";

create table "public"."pos_checkout_cancellations" (
  "workspace_id" uuid not null,
  "actor_id" uuid not null,
  "idempotency_key" uuid not null,
  "created_at" timestamp with time zone default now() not null
);
alter table "public"."pos_checkout_cancellations" enable row level security;
revoke all on table "public"."pos_checkout_cancellations" from public,anon,authenticated,service_role;
grant INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN on table "public"."pos_checkout_cancellations" to "service_role";

create table "public"."pos_sales" (
  "id" uuid default gen_random_uuid() not null,
  "workspace_id" uuid not null,
  "site_id" uuid not null,
  "register_id" uuid not null,
  "session_id" uuid not null,
  "actor_id" uuid not null,
  "idempotency_key" uuid not null,
  "request" jsonb not null,
  "receipt_number" text default ('TD-'::text || upper(replace((gen_random_uuid())::text, '-'::text, ''::text))) not null,
  "currency" text default 'USD'::text not null,
  "subtotal_minor" bigint not null,
  "discount_minor" bigint not null,
  "tax_minor" bigint not null,
  "total_minor" bigint not null,
  "receipt" jsonb not null,
  "created_at" timestamp with time zone default now() not null
);
alter table "public"."pos_sales" enable row level security;
revoke all on table "public"."pos_sales" from public,anon,authenticated,service_role;
grant INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN on table "public"."pos_sales" to "service_role";

create table "public"."pos_sale_items" (
  "id" uuid default gen_random_uuid() not null,
  "workspace_id" uuid not null,
  "sale_id" uuid not null,
  "inventory_user_id" uuid not null,
  "inventory_item_id" text not null,
  "quantity" integer not null,
  "unit_price_minor" bigint not null,
  "discount_minor" bigint not null,
  "tax_minor" bigint not null,
  "snapshot" jsonb not null
);
alter table "public"."pos_sale_items" enable row level security;
revoke all on table "public"."pos_sale_items" from public,anon,authenticated,service_role;
grant INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN on table "public"."pos_sale_items" to "service_role";

create table "public"."pos_sale_allocations" (
  "id" uuid default gen_random_uuid() not null,
  "workspace_id" uuid not null,
  "sale_id" uuid not null,
  "inventory_user_id" uuid not null,
  "inventory_item_id" text not null,
  "position_id" text,
  "batch_id" uuid,
  "location_id" text not null,
  "quantity" integer not null,
  "line_key" text
);
alter table "public"."pos_sale_allocations" enable row level security;
revoke all on table "public"."pos_sale_allocations" from public,anon,authenticated,service_role;
grant INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN on table "public"."pos_sale_allocations" to "service_role";

create table "public"."pos_store_locations" (
  "id" uuid default gen_random_uuid() not null,
  "workspace_id" uuid not null,
  "inventory_user_id" uuid not null,
  "name" text not null,
  "tax_bps" integer not null,
  "currency" text default 'USD'::text not null,
  "created_at" timestamp with time zone default now() not null,
  "timezone" text default 'America/Phoenix'::text not null,
  "settings" jsonb default '{"footer": "Thank you for shopping with us.", "address": "", "showSku": true, "blindClose": false, "receiptWidth": "80", "returnPolicy": "", "showEmployee": true, "showLocation": true, "noteThresholdMinor": 0, "approvalThresholdMinor": 2000}'::jsonb not null
);
alter table "public"."pos_store_locations" enable row level security;
revoke all on table "public"."pos_store_locations" from public,anon,authenticated,service_role;
grant INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN on table "public"."pos_store_locations" to "service_role";

create table "public"."pos_inventory_delegations" (
  "id" uuid default gen_random_uuid() not null,
  "workspace_id" uuid not null,
  "site_id" uuid not null,
  "inventory_user_id" uuid not null,
  "employee_id" uuid not null,
  "capabilities" text[] not null,
  "granted_by" uuid not null,
  "granted_at" timestamp with time zone default now() not null,
  "revoked_by" uuid,
  "revoked_at" timestamp with time zone,
  "valid_until" timestamp with time zone,
  "reason" text default ''::text not null
);
alter table "public"."pos_inventory_delegations" enable row level security;
revoke all on table "public"."pos_inventory_delegations" from public,anon,authenticated,service_role;
grant INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN on table "public"."pos_inventory_delegations" to "service_role";

create table "public"."pos_registers" (
  "id" uuid default gen_random_uuid() not null,
  "workspace_id" uuid not null,
  "site_id" uuid not null,
  "name" text not null,
  "active" boolean default true not null,
  "description" text default ''::text not null,
  "cash_drawer" boolean default true not null,
  "hardware_preferences" jsonb default '{}'::jsonb not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
alter table "public"."pos_registers" enable row level security;
revoke all on table "public"."pos_registers" from public,anon,authenticated,service_role;
grant INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN on table "public"."pos_registers" to "service_role";

create table "public"."pos_register_sessions" (
  "id" uuid default gen_random_uuid() not null,
  "workspace_id" uuid not null,
  "site_id" uuid not null,
  "register_id" uuid not null,
  "actor_id" uuid not null,
  "opened_at" timestamp with time zone default now() not null,
  "closed_at" timestamp with time zone,
  "status" text default 'OPEN'::text not null,
  "opening_minor" bigint default 0 not null,
  "closed_by" uuid,
  "expected_minor" bigint,
  "counted_minor" bigint,
  "variance_minor" bigint,
  "close_notes" text default ''::text not null,
  "closing_started_at" timestamp with time zone
);
alter table "public"."pos_register_sessions" enable row level security;
revoke all on table "public"."pos_register_sessions" from public,anon,authenticated,service_role;
grant INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN on table "public"."pos_register_sessions" to "service_role";

create table "public"."pos_cash_events" (
  "id" uuid default gen_random_uuid() not null,
  "workspace_id" uuid not null,
  "site_id" uuid not null,
  "register_id" uuid not null,
  "session_id" uuid not null,
  "actor_id" uuid not null,
  "kind" text not null,
  "amount_minor" bigint not null,
  "reason_type" text default ''::text not null,
  "reason" text default ''::text not null,
  "reference_id" uuid,
  "created_at" timestamp with time zone default now() not null
);
alter table "public"."pos_cash_events" enable row level security;
revoke all on table "public"."pos_cash_events" from public,anon,authenticated,service_role;
grant INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN on table "public"."pos_cash_events" to "service_role";

create table "public"."pos_operation_receipts" (
  "workspace_id" uuid not null,
  "actor_id" uuid not null,
  "key" uuid not null,
  "action" text not null,
  "intent" jsonb not null,
  "result" jsonb not null,
  "created_at" timestamp with time zone default now() not null
);
alter table "public"."pos_operation_receipts" enable row level security;
revoke all on table "public"."pos_operation_receipts" from public,anon,authenticated,service_role;
grant INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN on table "public"."pos_operation_receipts" to "service_role";

create table "public"."pos_approval_requests" (
  "id" uuid default gen_random_uuid() not null,
  "workspace_id" uuid not null,
  "site_id" uuid not null,
  "requested_by" uuid not null,
  "action" text not null,
  "intent" jsonb not null,
  "summary" jsonb default '{}'::jsonb not null,
  "reason" text not null,
  "created_at" timestamp with time zone default now() not null
);
alter table "public"."pos_approval_requests" enable row level security;
revoke all on table "public"."pos_approval_requests" from public,anon,authenticated,service_role;
grant INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN on table "public"."pos_approval_requests" to "service_role";

create table "public"."pos_approval_decisions" (
  "request_id" uuid not null,
  "approved_by" uuid not null,
  "approved_at" timestamp with time zone default now() not null
);
alter table "public"."pos_approval_decisions" enable row level security;
revoke all on table "public"."pos_approval_decisions" from public,anon,authenticated,service_role;
grant INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN on table "public"."pos_approval_decisions" to "service_role";

create table "public"."pos_refunds" (
  "id" uuid default gen_random_uuid() not null,
  "workspace_id" uuid not null,
  "sale_id" uuid not null,
  "site_id" uuid not null,
  "register_id" uuid not null,
  "session_id" uuid not null,
  "actor_id" uuid not null,
  "subtotal_minor" bigint not null,
  "tax_minor" bigint not null,
  "total_minor" bigint not null,
  "reason" text not null,
  "created_at" timestamp with time zone default now() not null
);
alter table "public"."pos_refunds" enable row level security;
revoke all on table "public"."pos_refunds" from public,anon,authenticated,service_role;
grant INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN on table "public"."pos_refunds" to "service_role";

create table "public"."pos_refund_items" (
  "id" uuid default gen_random_uuid() not null,
  "refund_id" uuid not null,
  "sale_item_id" uuid not null,
  "quantity" integer not null,
  "return_inventory" boolean not null,
  "subtotal_minor" bigint not null,
  "tax_minor" bigint not null,
  "allocations" jsonb default '[]'::jsonb not null
);
alter table "public"."pos_refund_items" enable row level security;
revoke all on table "public"."pos_refund_items" from public,anon,authenticated,service_role;
grant INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN on table "public"."pos_refund_items" to "service_role";

create table "pos_private"."approval_uses" (
  "request_id" uuid not null,
  "operation_key" uuid not null
);
alter table "pos_private"."approval_uses" enable row level security;
revoke all on table "pos_private"."approval_uses" from public,anon,authenticated,service_role;

create table "public"."pos_payment_checkouts" (
  "id" uuid default gen_random_uuid() not null,
  "workspace_id" uuid not null,
  "site_id" uuid not null,
  "register_id" uuid not null,
  "session_id" uuid not null,
  "actor_id" uuid not null,
  "intent" jsonb not null,
  "snapshot" jsonb not null,
  "amount_minor" bigint not null,
  "currency" text default 'USD'::text not null,
  "state" text default 'PAYABLE'::text not null,
  "sale_id" uuid,
  "failure_code" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
alter table "public"."pos_payment_checkouts" enable row level security;
revoke all on table "public"."pos_payment_checkouts" from public,anon,authenticated,service_role;
grant INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN on table "public"."pos_payment_checkouts" to "service_role";

create table "public"."pos_payment_refund_attempts" (
  "id" uuid default gen_random_uuid() not null,
  "workspace_id" uuid not null,
  "payment_id" uuid not null,
  "actor_id" uuid not null,
  "idempotency_key" uuid not null,
  "intent" jsonb not null,
  "amount_minor" bigint not null,
  "status" text default 'CREATED'::text not null,
  "provider_refund_id" text,
  "refund_id" uuid,
  "recovery_required" boolean default false not null,
  "failure_code" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
alter table "public"."pos_payment_refund_attempts" enable row level security;
revoke all on table "public"."pos_payment_refund_attempts" from public,anon,authenticated,service_role;
grant INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN on table "public"."pos_payment_refund_attempts" to "service_role";

create table "public"."pos_payment_events" (
  "id" uuid default gen_random_uuid() not null,
  "workspace_id" uuid not null,
  "payment_id" uuid not null,
  "provider" text not null,
  "external_event_id" text not null,
  "status" text not null,
  "observed_status" text,
  "received_at" timestamp with time zone default now() not null,
  "processed_at" timestamp with time zone
);
alter table "public"."pos_payment_events" enable row level security;
revoke all on table "public"."pos_payment_events" from public,anon,authenticated,service_role;
grant INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN on table "public"."pos_payment_events" to "service_role";

create table "public"."pos_payment_audit" (
  "id" uuid default gen_random_uuid() not null,
  "workspace_id" uuid not null,
  "payment_id" uuid not null,
  "actor_id" uuid not null,
  "action" text not null,
  "previous_status" text,
  "next_status" text,
  "created_at" timestamp with time zone default now() not null
);
alter table "public"."pos_payment_audit" enable row level security;
revoke all on table "public"."pos_payment_audit" from public,anon,authenticated,service_role;
grant INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN on table "public"."pos_payment_audit" to "service_role";

create table "pos_private"."payment_test_config" (
  "singleton" boolean default true not null,
  "enabled" boolean default false not null
);
alter table "pos_private"."payment_test_config" enable row level security;
revoke all on table "pos_private"."payment_test_config" from public,anon,authenticated,service_role;

create table "pos_private"."mock_payments" (
  "payment_id" uuid not null,
  "outcome" text not null,
  "status" text not null,
  "polls" integer default 0 not null,
  "external_id" text not null
);
alter table "pos_private"."mock_payments" enable row level security;
revoke all on table "pos_private"."mock_payments" from public,anon,authenticated,service_role;

create table "pos_private"."mock_refunds" (
  "refund_id" uuid not null,
  "outcome" text not null,
  "status" text not null,
  "external_id" text not null
);
alter table "pos_private"."mock_refunds" enable row level security;
revoke all on table "pos_private"."mock_refunds" from public,anon,authenticated,service_role;

create table "pos_private"."payment_context" (
  "transaction_id" bigint not null,
  "backend" integer not null,
  "actor_id" uuid not null,
  "payment_id" uuid not null,
  "refund_attempt_id" uuid
);
alter table "pos_private"."payment_context" enable row level security;
revoke all on table "pos_private"."payment_context" from public,anon,authenticated,service_role;

create table "pos_private"."square_connections" (
  "id" uuid default gen_random_uuid() not null,
  "workspace_id" uuid not null,
  "merchant_id" text not null,
  "display_name" text not null,
  "country" text,
  "account_status" text,
  "environment" text default 'SANDBOX'::text not null,
  "status" text not null,
  "connected_by" uuid not null,
  "connected_at" timestamp with time zone default now() not null,
  "last_validated_at" timestamp with time zone,
  "authorized_scopes" text[] default '{}'::text[] not null
);
alter table "pos_private"."square_connections" enable row level security;
revoke all on table "pos_private"."square_connections" from public,anon,authenticated,service_role;

create table "public"."pos_payment_attempts" (
  "id" uuid default gen_random_uuid() not null,
  "workspace_id" uuid not null,
  "checkout_id" uuid not null,
  "actor_id" uuid not null,
  "provider" text not null,
  "provider_account_id" text,
  "provider_payment_id" text,
  "amount_minor" bigint not null,
  "currency" text not null,
  "status" text default 'CREATED'::text not null,
  "idempotency_key" uuid not null,
  "request" jsonb not null,
  "metadata" jsonb default '{}'::jsonb not null,
  "failure_code" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "completed_at" timestamp with time zone,
  "reconciled_at" timestamp with time zone
);
alter table "public"."pos_payment_attempts" enable row level security;
revoke all on table "public"."pos_payment_attempts" from public,anon,authenticated,service_role;
grant INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN on table "public"."pos_payment_attempts" to "service_role";

create table "pos_private"."square_credentials" (
  "connection_id" uuid not null,
  "encrypted" jsonb not null,
  "expires_at" timestamp with time zone not null,
  "version" integer default 1 not null,
  "refresh_lease" uuid,
  "refresh_until" timestamp with time zone
);
alter table "pos_private"."square_credentials" enable row level security;
revoke all on table "pos_private"."square_credentials" from public,anon,authenticated,service_role;

create table "pos_private"."square_oauth" (
  "state_hash" text not null,
  "workspace_id" uuid not null,
  "actor_id" uuid not null,
  "expires_at" timestamp with time zone not null,
  "consumed_at" timestamp with time zone,
  "environment" text not null,
  "return_path" text not null
);
alter table "pos_private"."square_oauth" enable row level security;
revoke all on table "pos_private"."square_oauth" from public,anon,authenticated,service_role;

create table "pos_private"."square_locations" (
  "connection_id" uuid not null,
  "id" text not null,
  "name" text not null,
  "status" text not null,
  "address" text
);
alter table "pos_private"."square_locations" enable row level security;
revoke all on table "pos_private"."square_locations" from public,anon,authenticated,service_role;

create table "pos_private"."square_mappings" (
  "workspace_id" uuid not null,
  "site_id" uuid not null,
  "connection_id" uuid not null,
  "location_id" text not null
);
alter table "pos_private"."square_mappings" enable row level security;
revoke all on table "pos_private"."square_mappings" from public,anon,authenticated,service_role;

create table "pos_private"."square_observations" (
  "payment_id" uuid not null,
  "provider_id" text,
  "status" text not null,
  "metadata" jsonb default '{}'::jsonb not null,
  "updated_at" timestamp with time zone default now() not null
);
alter table "pos_private"."square_observations" enable row level security;
revoke all on table "pos_private"."square_observations" from public,anon,authenticated,service_role;

create table "pos_private"."square_refund_observations" (
  "refund_id" uuid not null,
  "provider_id" text,
  "status" text not null,
  "updated_at" timestamp with time zone default now() not null
);
alter table "pos_private"."square_refund_observations" enable row level security;
revoke all on table "pos_private"."square_refund_observations" from public,anon,authenticated,service_role;

create table "pos_private"."square_events" (
  "event_id" text not null,
  "merchant_id" text not null,
  "event_type" text not null,
  "resource_id" text,
  "status" text default 'PENDING'::text not null,
  "received_at" timestamp with time zone default now() not null,
  "processed_at" timestamp with time zone
);
alter table "pos_private"."square_events" enable row level security;
revoke all on table "pos_private"."square_events" from public,anon,authenticated,service_role;

create table "public"."pos_payment_devices" (
  "id" uuid not null,
  "workspace_id" uuid not null,
  "site_id" uuid not null,
  "connection_id" uuid not null,
  "provider" text default 'SQUARE'::text not null,
  "environment" text default 'SANDBOX'::text not null,
  "provider_location_id" text not null,
  "provider_device_id" text,
  "provider_device_code_id" text,
  "display_name" text not null,
  "pairing_status" text default 'PAIRING'::text not null,
  "status" text default 'PAIRING'::text not null,
  "pair_by" timestamp with time zone,
  "paired_at" timestamp with time zone,
  "last_seen_at" timestamp with time zone,
  "assigned_register_id" uuid,
  "created_by" uuid not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "disabled_at" timestamp with time zone
);
alter table "public"."pos_payment_devices" enable row level security;
revoke all on table "public"."pos_payment_devices" from public,anon,authenticated,service_role;
grant INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN on table "public"."pos_payment_devices" to "service_role";

create table "pos_private"."square_device_codes" (
  "device_id" uuid not null,
  "code" text not null
);
alter table "pos_private"."square_device_codes" enable row level security;
revoke all on table "pos_private"."square_device_codes" from public,anon,authenticated,service_role;

create table "pos_private"."square_terminal_attempts" (
  "payment_id" uuid not null,
  "device_id" uuid not null,
  "provider_device_id" text not null,
  "location_id" text not null,
  "checkout_id" text,
  "checkout_status" text,
  "updated_at" timestamp with time zone default now() not null
);
alter table "pos_private"."square_terminal_attempts" enable row level security;
revoke all on table "pos_private"."square_terminal_attempts" from public,anon,authenticated,service_role;

create table "pos_private"."square_hardware_audit" (
  "id" bigint generated always as identity not null,
  "workspace_id" uuid not null,
  "device_id" uuid not null,
  "actor_id" uuid,
  "action" text not null,
  "created_at" timestamp with time zone default now() not null
);
alter table "pos_private"."square_hardware_audit" enable row level security;
revoke all on table "pos_private"."square_hardware_audit" from public,anon,authenticated,service_role;

create table "pos_private"."square_terminal_refunds" (
  "refund_id" uuid not null,
  "checkout_id" text not null
);
alter table "pos_private"."square_terminal_refunds" enable row level security;
revoke all on table "pos_private"."square_terminal_refunds" from public,anon,authenticated,service_role;
alter table "public"."pos_sales" add constraint "pos_sales_workspace_id_idempotency_key_key" UNIQUE (workspace_id, idempotency_key);
alter table "public"."pos_sales" add constraint "pos_sales_receipt_number_key" UNIQUE (receipt_number);
alter table "public"."pos_store_locations" add constraint "pos_store_locations_pkey" PRIMARY KEY (id);
alter table "public"."pos_store_locations" add constraint "pos_store_locations_workspace_id_id_key" UNIQUE (workspace_id, id);
alter table "public"."pos_tenders" add constraint "pos_tenders_pkey" PRIMARY KEY (id);
alter table "public"."pos_inventory_delegations" add constraint "pos_inventory_delegations_pkey" PRIMARY KEY (id);
alter table "public"."pos_location_inventory_locations" add constraint "pos_location_inventory_locations_pkey" PRIMARY KEY (inventory_user_id, location_id);
alter table "pos_private"."request_limits" add constraint "request_limits_pkey" PRIMARY KEY (actor_id, bucket);
alter table "public"."pos_workspace_settings" add constraint "pos_workspace_settings_pkey" PRIMARY KEY (workspace_id);
alter table "public"."pos_store_locations" add constraint "pos_store_locations_name_check" CHECK (length(name) >= 1 AND length(name) <= 100);
alter table "public"."pos_store_locations" add constraint "pos_store_locations_tax_bps_check" CHECK (tax_bps >= 0 AND tax_bps <= 2500);
alter table "public"."pos_store_locations" add constraint "pos_store_locations_currency_check" CHECK (currency = 'USD'::text);
alter table "public"."pos_registers" add constraint "pos_registers_name_check" CHECK (length(name) >= 1 AND length(name) <= 100);
alter table "public"."pos_registers" add constraint "pos_registers_pkey" PRIMARY KEY (id);
alter table "public"."pos_registers" add constraint "pos_registers_workspace_id_site_id_id_key" UNIQUE (workspace_id, site_id, id);
alter table "public"."pos_register_sessions" add constraint "pos_register_sessions_pkey" PRIMARY KEY (id);
alter table "public"."pos_register_sessions" add constraint "pos_register_sessions_workspace_id_site_id_register_id_id_key" UNIQUE (workspace_id, site_id, register_id, id);
alter table "public"."pos_checkout_cancellations" add constraint "pos_checkout_cancellations_pkey" PRIMARY KEY (workspace_id, actor_id, idempotency_key);
alter table "public"."pos_sales" add constraint "pos_sales_currency_check" CHECK (currency = 'USD'::text);
alter table "public"."pos_sales" add constraint "pos_sales_subtotal_minor_check" CHECK (subtotal_minor >= 0 AND subtotal_minor <= '100000000000'::bigint);
alter table "public"."pos_sales" add constraint "pos_sales_check" CHECK (discount_minor >= 0 AND discount_minor <= subtotal_minor);
alter table "public"."pos_sales" add constraint "pos_sales_tax_minor_check" CHECK (tax_minor >= 0);
alter table "public"."pos_sales" add constraint "pos_sales_check1" CHECK (total_minor = (subtotal_minor - discount_minor + tax_minor));
alter table "public"."pos_sales" add constraint "pos_sales_pkey" PRIMARY KEY (id);
alter table "public"."pos_sales" add constraint "pos_sales_workspace_id_id_key" UNIQUE (workspace_id, id);
alter table "public"."pos_sale_items" add constraint "pos_sale_items_quantity_check" CHECK (quantity >= 1 AND quantity <= 1000);
alter table "public"."pos_sale_items" add constraint "pos_sale_items_unit_price_minor_check" CHECK (unit_price_minor >= 0 AND unit_price_minor <= 100000000);
alter table "public"."pos_sale_items" add constraint "pos_sale_items_discount_minor_check" CHECK (discount_minor >= 0);
alter table "public"."pos_sale_items" add constraint "pos_sale_items_tax_minor_check" CHECK (tax_minor >= 0);
alter table "public"."pos_sale_items" add constraint "pos_sale_items_pkey" PRIMARY KEY (id);
alter table "public"."pos_sale_allocations" add constraint "pos_sale_allocations_quantity_check" CHECK (quantity > 0);
alter table "public"."pos_sale_allocations" add constraint "pos_sale_allocations_pkey" PRIMARY KEY (id);
alter table "public"."pos_tenders" add constraint "pos_tenders_amount_minor_check" CHECK (amount_minor >= 0);
alter table "public"."pos_tenders" add constraint "pos_tenders_check" CHECK (received_minor >= amount_minor);
alter table "public"."pos_tenders" add constraint "pos_tenders_check1" CHECK (change_minor = (received_minor - amount_minor));
alter table "public"."pos_inventory_delegations" add constraint "pos_inventory_delegations_check" CHECK (granted_by = inventory_user_id AND employee_id <> inventory_user_id);
alter table "public"."pos_inventory_delegations" add constraint "pos_inventory_delegations_capabilities_check" CHECK (cardinality(capabilities) > 0 AND capabilities <@ ARRAY['sell'::text, 'return'::text]);
alter table "public"."pos_inventory_delegations" add constraint "pos_inventory_delegations_check1" CHECK ((revoked_at IS NULL) = (revoked_by IS NULL));
alter table "public"."pos_inventory_delegations" add constraint "pos_inventory_delegations_reason_check" CHECK (length(reason) <= 500);
alter table "public"."pos_access_events" add constraint "pos_access_events_pkey" PRIMARY KEY (id);
alter table "pos_private"."stock_permits" add constraint "stock_permits_after_quantity_check" CHECK (after_quantity >= 0);
alter table "pos_private"."stock_permits" add constraint "stock_permits_pkey" PRIMARY KEY (transaction_id, backend, owner_id, item_id);
alter table "public"."pos_register_sessions" add constraint "pos_register_sessions_status_check" CHECK (status = ANY (ARRAY['OPEN'::text, 'CLOSING'::text, 'CLOSED'::text]));
alter table "public"."pos_register_sessions" add constraint "pos_register_sessions_opening_minor_check" CHECK (opening_minor >= 0 AND opening_minor <= '100000000000'::bigint);
alter table "public"."pos_register_sessions" add constraint "pos_register_sessions_counted_minor_check" CHECK (counted_minor >= 0 AND counted_minor <= '100000000000'::bigint);
alter table "public"."pos_register_sessions" add constraint "pos_session_state" CHECK ((status = 'CLOSED'::text) = (closed_at IS NOT NULL));
alter table "public"."pos_approval_decisions" add constraint "pos_approval_decisions_pkey" PRIMARY KEY (request_id);
alter table "pos_private"."approval_uses" add constraint "approval_uses_pkey" PRIMARY KEY (request_id);
alter table "public"."pos_cash_events" add constraint "pos_cash_events_kind_check" CHECK (kind = ANY (ARRAY['OPENING_FLOAT'::text, 'CASH_SALE'::text, 'CASH_REFUND'::text, 'PAID_IN'::text, 'PAID_OUT'::text, 'CASH_DROP'::text, 'CASH_ADJUSTMENT'::text, 'REGISTER_CLOSE'::text]));
alter table "public"."pos_cash_events" add constraint "pos_cash_events_amount_minor_check" CHECK (amount_minor >= '-100000000000'::bigint AND amount_minor <= '100000000000'::bigint);
alter table "public"."pos_cash_events" add constraint "pos_cash_events_check" CHECK ((kind = ANY (ARRAY['OPENING_FLOAT'::text, 'CASH_SALE'::text, 'PAID_IN'::text])) AND amount_minor >= 0 OR (kind = ANY (ARRAY['CASH_REFUND'::text, 'PAID_OUT'::text, 'CASH_DROP'::text])) AND amount_minor <= 0 OR kind = 'CASH_ADJUSTMENT'::text OR kind = 'REGISTER_CLOSE'::text AND amount_minor = 0);
alter table "public"."pos_cash_events" add constraint "pos_cash_events_pkey" PRIMARY KEY (id);
alter table "public"."pos_operation_receipts" add constraint "pos_operation_receipts_pkey" PRIMARY KEY (workspace_id, actor_id, key);
alter table "public"."pos_approval_requests" add constraint "pos_approval_requests_action_check" CHECK (action = ANY (ARRAY['checkout'::text, 'refund'::text, 'close'::text, 'cash_event'::text]));
alter table "public"."pos_approval_requests" add constraint "pos_approval_requests_reason_check" CHECK (length(reason) >= 1 AND length(reason) <= 500);
alter table "public"."pos_approval_requests" add constraint "pos_approval_requests_pkey" PRIMARY KEY (id);
alter table "public"."pos_refunds" add constraint "pos_refunds_subtotal_minor_check" CHECK (subtotal_minor >= 0);
alter table "public"."pos_refunds" add constraint "pos_refunds_tax_minor_check" CHECK (tax_minor >= 0);
alter table "public"."pos_refunds" add constraint "pos_refunds_check" CHECK (total_minor = (subtotal_minor + tax_minor));
alter table "public"."pos_refunds" add constraint "pos_refunds_reason_check" CHECK (length(reason) >= 1 AND length(reason) <= 500);
alter table "public"."pos_refunds" add constraint "pos_refunds_pkey" PRIMARY KEY (id);
alter table "public"."pos_refund_items" add constraint "pos_refund_items_quantity_check" CHECK (quantity >= 1 AND quantity <= 1000);
alter table "public"."pos_refund_items" add constraint "pos_refund_items_subtotal_minor_check" CHECK (subtotal_minor >= 0);
alter table "public"."pos_refund_items" add constraint "pos_refund_items_tax_minor_check" CHECK (tax_minor >= 0);
alter table "public"."pos_refund_items" add constraint "pos_refund_items_pkey" PRIMARY KEY (id);
alter table "pos_private"."payment_test_config" add constraint "payment_test_config_singleton_check" CHECK (singleton);
alter table "pos_private"."payment_test_config" add constraint "payment_test_config_pkey" PRIMARY KEY (singleton);
alter table "public"."pos_payment_checkouts" add constraint "pos_payment_checkouts_amount_minor_check" CHECK (amount_minor >= 1 AND amount_minor <= '100000000000'::bigint);
alter table "public"."pos_payment_checkouts" add constraint "pos_payment_checkouts_currency_check" CHECK (currency = 'USD'::text);
alter table "public"."pos_payment_checkouts" add constraint "pos_payment_checkouts_state_check" CHECK (state = ANY (ARRAY['PAYABLE'::text, 'PAYING'::text, 'FINALIZING'::text, 'COMPLETED'::text, 'RECOVERY_REQUIRED'::text, 'VOIDED'::text]));
alter table "public"."pos_payment_checkouts" add constraint "pos_payment_checkouts_pkey" PRIMARY KEY (id);
alter table "public"."pos_payment_checkouts" add constraint "pos_payment_checkouts_workspace_id_id_key" UNIQUE (workspace_id, id);
alter table "public"."pos_payment_checkouts" add constraint "pos_payment_checkouts_sale_id_key" UNIQUE (sale_id);
alter table "public"."pos_payment_attempts" add constraint "pos_payment_attempts_amount_minor_check" CHECK (amount_minor > 0);
alter table "public"."pos_payment_attempts" add constraint "pos_payment_attempts_currency_check" CHECK (currency = 'USD'::text);
alter table "public"."pos_payment_attempts" add constraint "pos_payment_attempts_status_check" CHECK (status = ANY (ARRAY['CREATED'::text, 'PENDING'::text, 'AWAITING_CUSTOMER'::text, 'PROCESSING'::text, 'AUTHORIZED'::text, 'SUCCEEDED'::text, 'DECLINED'::text, 'FAILED'::text, 'CANCELED'::text, 'TIMED_OUT'::text, 'UNKNOWN'::text, 'REFUND_PENDING'::text, 'PARTIALLY_REFUNDED'::text, 'REFUNDED'::text]));
alter table "public"."pos_payment_attempts" add constraint "pos_payment_attempts_pkey" PRIMARY KEY (id);
alter table "public"."pos_payment_attempts" add constraint "pos_payment_attempts_workspace_id_id_key" UNIQUE (workspace_id, id);
alter table "public"."pos_payment_attempts" add constraint "pos_payment_attempts_workspace_id_actor_id_idempotency_key_key" UNIQUE (workspace_id, actor_id, idempotency_key);
alter table "public"."pos_payment_attempts" add constraint "pos_payment_attempts_workspace_id_provider_provider_payment_key" UNIQUE (workspace_id, provider, provider_payment_id);
alter table "public"."pos_payment_refund_attempts" add constraint "pos_payment_refund_attempts_amount_minor_check" CHECK (amount_minor > 0);
alter table "public"."pos_payment_refund_attempts" add constraint "pos_payment_refund_attempts_status_check" CHECK (status = ANY (ARRAY['CREATED'::text, 'PENDING'::text, 'UNKNOWN'::text, 'SUCCEEDED'::text, 'FAILED'::text]));
alter table "public"."pos_payment_refund_attempts" add constraint "pos_payment_refund_attempts_pkey" PRIMARY KEY (id);
alter table "public"."pos_payment_refund_attempts" add constraint "pos_payment_refund_attempts_workspace_id_actor_id_idempoten_key" UNIQUE (workspace_id, actor_id, idempotency_key);
alter table "public"."pos_payment_refund_attempts" add constraint "pos_payment_refund_attempts_refund_id_key" UNIQUE (refund_id);
alter table "public"."pos_payment_events" add constraint "pos_payment_events_status_check" CHECK (status = ANY (ARRAY['RECEIVED'::text, 'PROCESSED'::text, 'RETRY'::text]));
alter table "public"."pos_payment_events" add constraint "pos_payment_events_pkey" PRIMARY KEY (id);
alter table "public"."pos_payment_events" add constraint "pos_payment_events_workspace_id_provider_external_event_id_key" UNIQUE (workspace_id, provider, external_event_id);
alter table "public"."pos_payment_audit" add constraint "pos_payment_audit_pkey" PRIMARY KEY (id);
alter table "pos_private"."mock_payments" add constraint "mock_payments_pkey" PRIMARY KEY (payment_id);
alter table "pos_private"."mock_payments" add constraint "mock_payments_external_id_key" UNIQUE (external_id);
alter table "pos_private"."mock_refunds" add constraint "mock_refunds_pkey" PRIMARY KEY (refund_id);
alter table "pos_private"."mock_refunds" add constraint "mock_refunds_external_id_key" UNIQUE (external_id);
alter table "pos_private"."payment_context" add constraint "payment_context_pkey" PRIMARY KEY (transaction_id, backend);
alter table "public"."pos_tenders" add constraint "pos_tenders_verification_check" CHECK (verification = ANY (ARRAY['recorded'::text, 'simulated'::text, 'externally_recorded'::text]));
alter table "pos_private"."square_connections" add constraint "square_connections_environment_check" CHECK (environment = 'SANDBOX'::text);
alter table "pos_private"."square_connections" add constraint "square_connections_status_check" CHECK (status = ANY (ARRAY['CONNECTED'::text, 'ATTENTION'::text, 'REVOKED'::text, 'DISCONNECTED'::text, 'REPLACED'::text]));
alter table "pos_private"."square_connections" add constraint "square_connections_pkey" PRIMARY KEY (id);
alter table "pos_private"."square_connections" add constraint "square_connections_workspace_id_id_key" UNIQUE (workspace_id, id);
alter table "pos_private"."square_credentials" add constraint "square_credentials_pkey" PRIMARY KEY (connection_id);
alter table "pos_private"."square_oauth" add constraint "square_oauth_environment_check" CHECK (environment = 'SANDBOX'::text);
alter table "pos_private"."square_oauth" add constraint "square_oauth_return_path_check" CHECK (return_path = '/dashboard/pos/payments'::text);
alter table "pos_private"."square_oauth" add constraint "square_oauth_pkey" PRIMARY KEY (state_hash);
alter table "pos_private"."square_locations" add constraint "square_locations_pkey" PRIMARY KEY (connection_id, id);
alter table "pos_private"."square_mappings" add constraint "square_mappings_pkey" PRIMARY KEY (connection_id, site_id);
alter table "pos_private"."square_observations" add constraint "square_observations_pkey" PRIMARY KEY (payment_id);
alter table "pos_private"."square_refund_observations" add constraint "square_refund_observations_pkey" PRIMARY KEY (refund_id);
alter table "pos_private"."square_events" add constraint "square_events_status_check" CHECK (status = ANY (ARRAY['PENDING'::text, 'PROCESSED'::text, 'RETRY'::text]));
alter table "pos_private"."square_events" add constraint "square_events_pkey" PRIMARY KEY (event_id);
alter table "public"."pos_payment_attempts" add constraint "pos_payment_attempts_provider_check" CHECK (provider = ANY (ARRAY['MOCK'::text, 'EXTERNAL'::text, 'SQUARE'::text]));
alter table "public"."pos_tenders" add constraint "pos_tenders_method_check" CHECK (method = ANY (ARRAY['cash'::text, 'mock'::text, 'external'::text, 'square'::text]));
alter table "public"."pos_payment_devices" add constraint "pos_payment_devices_provider_check" CHECK (provider = 'SQUARE'::text);
alter table "public"."pos_payment_devices" add constraint "pos_payment_devices_environment_check" CHECK (environment = 'SANDBOX'::text);
alter table "public"."pos_payment_devices" add constraint "pos_payment_devices_display_name_check" CHECK (length(display_name) >= 1 AND length(display_name) <= 128);
alter table "public"."pos_payment_devices" add constraint "pos_payment_devices_pairing_status_check" CHECK (pairing_status = ANY (ARRAY['PAIRING'::text, 'PAIRED'::text, 'EXPIRED'::text, 'UNPAIRED'::text, 'ERROR'::text]));
alter table "public"."pos_payment_devices" add constraint "pos_payment_devices_status_check" CHECK (status = ANY (ARRAY['PAIRING'::text, 'PAIRED'::text, 'AVAILABLE'::text, 'OFFLINE'::text, 'BUSY'::text, 'DISABLED'::text, 'ERROR'::text, 'UNPAIRED'::text]));
alter table "public"."pos_payment_devices" add constraint "pos_payment_devices_pkey" PRIMARY KEY (id);
alter table "public"."pos_payment_devices" add constraint "pos_payment_devices_connection_id_provider_device_id_key" UNIQUE (connection_id, provider_device_id);
alter table "public"."pos_payment_devices" add constraint "pos_payment_devices_connection_id_provider_device_code_id_key" UNIQUE (connection_id, provider_device_code_id);
alter table "public"."pos_payment_devices" add constraint "pos_payment_devices_workspace_id_id_key" UNIQUE (workspace_id, id);
alter table "pos_private"."square_device_codes" add constraint "square_device_codes_pkey" PRIMARY KEY (device_id);
alter table "pos_private"."square_terminal_attempts" add constraint "square_terminal_attempts_pkey" PRIMARY KEY (payment_id);
alter table "pos_private"."square_terminal_attempts" add constraint "square_terminal_attempts_checkout_id_key" UNIQUE (checkout_id);
alter table "pos_private"."square_terminal_refunds" add constraint "square_terminal_refunds_pkey" PRIMARY KEY (refund_id);
alter table "pos_private"."square_terminal_refunds" add constraint "square_terminal_refunds_checkout_id_key" UNIQUE (checkout_id);
alter table "pos_private"."square_hardware_audit" add constraint "square_hardware_audit_pkey" PRIMARY KEY (id);
alter table "public"."pos_store_locations" add constraint "pos_store_locations_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id);
alter table "public"."pos_store_locations" add constraint "pos_store_locations_inventory_user_id_fkey" FOREIGN KEY (inventory_user_id) REFERENCES auth.users(id);
alter table "public"."pos_location_inventory_locations" add constraint "pos_location_inventory_locations_workspace_id_site_id_fkey" FOREIGN KEY (workspace_id, site_id) REFERENCES pos_store_locations(workspace_id, id);
alter table "public"."pos_location_inventory_locations" add constraint "pos_location_inventory_locati_inventory_user_id_location_i_fkey" FOREIGN KEY (inventory_user_id, location_id) REFERENCES inventory_locations(user_id, id);
alter table "public"."pos_sales" add constraint "pos_sales_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES auth.users(id);
alter table "public"."pos_workspace_settings" add constraint "pos_workspace_settings_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id);
alter table "public"."pos_registers" add constraint "pos_registers_workspace_id_site_id_fkey" FOREIGN KEY (workspace_id, site_id) REFERENCES pos_store_locations(workspace_id, id);
alter table "public"."pos_register_sessions" add constraint "pos_register_sessions_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES auth.users(id);
alter table "public"."pos_register_sessions" add constraint "pos_register_sessions_workspace_id_site_id_register_id_fkey" FOREIGN KEY (workspace_id, site_id, register_id) REFERENCES pos_registers(workspace_id, site_id, id);
alter table "public"."pos_checkout_cancellations" add constraint "pos_checkout_cancellations_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id);
alter table "public"."pos_checkout_cancellations" add constraint "pos_checkout_cancellations_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES auth.users(id);
alter table "public"."pos_sales" add constraint "pos_sales_workspace_id_site_id_register_id_session_id_fkey" FOREIGN KEY (workspace_id, site_id, register_id, session_id) REFERENCES pos_register_sessions(workspace_id, site_id, register_id, id);
alter table "public"."pos_sale_items" add constraint "pos_sale_items_workspace_id_sale_id_fkey" FOREIGN KEY (workspace_id, sale_id) REFERENCES pos_sales(workspace_id, id);
alter table "public"."pos_sale_allocations" add constraint "pos_sale_allocations_workspace_id_sale_id_fkey" FOREIGN KEY (workspace_id, sale_id) REFERENCES pos_sales(workspace_id, id);
alter table "public"."pos_tenders" add constraint "pos_tenders_workspace_id_sale_id_fkey" FOREIGN KEY (workspace_id, sale_id) REFERENCES pos_sales(workspace_id, id);
alter table "public"."pos_inventory_delegations" add constraint "pos_inventory_delegations_inventory_user_id_fkey" FOREIGN KEY (inventory_user_id) REFERENCES auth.users(id);
alter table "public"."pos_inventory_delegations" add constraint "pos_inventory_delegations_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES auth.users(id);
alter table "public"."pos_inventory_delegations" add constraint "pos_inventory_delegations_granted_by_fkey" FOREIGN KEY (granted_by) REFERENCES auth.users(id);
alter table "public"."pos_inventory_delegations" add constraint "pos_inventory_delegations_revoked_by_fkey" FOREIGN KEY (revoked_by) REFERENCES auth.users(id);
alter table "public"."pos_inventory_delegations" add constraint "pos_inventory_delegations_workspace_id_site_id_fkey" FOREIGN KEY (workspace_id, site_id) REFERENCES pos_store_locations(workspace_id, id);
alter table "public"."pos_access_events" add constraint "pos_access_events_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id);
alter table "public"."pos_access_events" add constraint "pos_access_events_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES auth.users(id);
alter table "public"."pos_register_sessions" add constraint "pos_register_sessions_closed_by_fkey" FOREIGN KEY (closed_by) REFERENCES auth.users(id);
alter table "public"."pos_approval_requests" add constraint "pos_approval_requests_requested_by_fkey" FOREIGN KEY (requested_by) REFERENCES auth.users(id);
alter table "public"."pos_approval_requests" add constraint "pos_approval_requests_workspace_id_site_id_fkey" FOREIGN KEY (workspace_id, site_id) REFERENCES pos_store_locations(workspace_id, id);
alter table "public"."pos_approval_decisions" add constraint "pos_approval_decisions_request_id_fkey" FOREIGN KEY (request_id) REFERENCES pos_approval_requests(id);
alter table "public"."pos_approval_decisions" add constraint "pos_approval_decisions_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES auth.users(id);
alter table "pos_private"."approval_uses" add constraint "approval_uses_request_id_fkey" FOREIGN KEY (request_id) REFERENCES pos_approval_requests(id);
alter table "public"."pos_cash_events" add constraint "pos_cash_events_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES auth.users(id);
alter table "public"."pos_cash_events" add constraint "pos_cash_events_workspace_id_site_id_register_id_session_i_fkey" FOREIGN KEY (workspace_id, site_id, register_id, session_id) REFERENCES pos_register_sessions(workspace_id, site_id, register_id, id);
alter table "public"."pos_operation_receipts" add constraint "pos_operation_receipts_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id);
alter table "public"."pos_operation_receipts" add constraint "pos_operation_receipts_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES auth.users(id);
alter table "public"."pos_refunds" add constraint "pos_refunds_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES auth.users(id);
alter table "public"."pos_refunds" add constraint "pos_refunds_workspace_id_sale_id_fkey" FOREIGN KEY (workspace_id, sale_id) REFERENCES pos_sales(workspace_id, id);
alter table "public"."pos_refunds" add constraint "pos_refunds_workspace_id_site_id_register_id_session_id_fkey" FOREIGN KEY (workspace_id, site_id, register_id, session_id) REFERENCES pos_register_sessions(workspace_id, site_id, register_id, id);
alter table "public"."pos_refund_items" add constraint "pos_refund_items_refund_id_fkey" FOREIGN KEY (refund_id) REFERENCES pos_refunds(id);
alter table "public"."pos_refund_items" add constraint "pos_refund_items_sale_item_id_fkey" FOREIGN KEY (sale_item_id) REFERENCES pos_sale_items(id);
alter table "public"."pos_payment_attempts" add constraint "pos_payment_attempts_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES auth.users(id);
alter table "public"."pos_payment_attempts" add constraint "pos_payment_attempts_workspace_id_checkout_id_fkey" FOREIGN KEY (workspace_id, checkout_id) REFERENCES pos_payment_checkouts(workspace_id, id);
alter table "public"."pos_payment_checkouts" add constraint "pos_payment_checkouts_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES auth.users(id);
alter table "public"."pos_payment_checkouts" add constraint "pos_payment_checkouts_workspace_id_site_id_register_id_ses_fkey" FOREIGN KEY (workspace_id, site_id, register_id, session_id) REFERENCES pos_register_sessions(workspace_id, site_id, register_id, id);
alter table "public"."pos_payment_checkouts" add constraint "pos_payment_checkouts_workspace_id_sale_id_fkey" FOREIGN KEY (workspace_id, sale_id) REFERENCES pos_sales(workspace_id, id);
alter table "public"."pos_payment_refund_attempts" add constraint "pos_payment_refund_attempts_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES auth.users(id);
alter table "public"."pos_payment_refund_attempts" add constraint "pos_payment_refund_attempts_refund_id_fkey" FOREIGN KEY (refund_id) REFERENCES pos_refunds(id);
alter table "public"."pos_payment_refund_attempts" add constraint "pos_payment_refund_attempts_workspace_id_payment_id_fkey" FOREIGN KEY (workspace_id, payment_id) REFERENCES pos_payment_attempts(workspace_id, id);
alter table "public"."pos_payment_events" add constraint "pos_payment_events_workspace_id_payment_id_fkey" FOREIGN KEY (workspace_id, payment_id) REFERENCES pos_payment_attempts(workspace_id, id);
alter table "public"."pos_payment_audit" add constraint "pos_payment_audit_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES auth.users(id);
alter table "public"."pos_payment_audit" add constraint "pos_payment_audit_workspace_id_payment_id_fkey" FOREIGN KEY (workspace_id, payment_id) REFERENCES pos_payment_attempts(workspace_id, id);
alter table "pos_private"."mock_payments" add constraint "mock_payments_payment_id_fkey" FOREIGN KEY (payment_id) REFERENCES pos_payment_attempts(id);
alter table "pos_private"."mock_refunds" add constraint "mock_refunds_refund_id_fkey" FOREIGN KEY (refund_id) REFERENCES pos_payment_refund_attempts(id);
alter table "public"."pos_tenders" add constraint "pos_tenders_payment_attempt_id_fkey" FOREIGN KEY (payment_attempt_id) REFERENCES pos_payment_attempts(id);
alter table "pos_private"."square_connections" add constraint "square_connections_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id);
alter table "pos_private"."square_connections" add constraint "square_connections_connected_by_fkey" FOREIGN KEY (connected_by) REFERENCES auth.users(id);
alter table "pos_private"."square_credentials" add constraint "square_credentials_connection_id_fkey" FOREIGN KEY (connection_id) REFERENCES pos_private.square_connections(id);
alter table "pos_private"."square_oauth" add constraint "square_oauth_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id);
alter table "pos_private"."square_oauth" add constraint "square_oauth_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES auth.users(id);
alter table "pos_private"."square_locations" add constraint "square_locations_connection_id_fkey" FOREIGN KEY (connection_id) REFERENCES pos_private.square_connections(id);
alter table "pos_private"."square_mappings" add constraint "square_mappings_workspace_id_site_id_fkey" FOREIGN KEY (workspace_id, site_id) REFERENCES pos_store_locations(workspace_id, id);
alter table "pos_private"."square_mappings" add constraint "square_mappings_workspace_id_connection_id_fkey" FOREIGN KEY (workspace_id, connection_id) REFERENCES pos_private.square_connections(workspace_id, id);
alter table "pos_private"."square_mappings" add constraint "square_mappings_connection_id_location_id_fkey" FOREIGN KEY (connection_id, location_id) REFERENCES pos_private.square_locations(connection_id, id);
alter table "pos_private"."square_observations" add constraint "square_observations_payment_id_fkey" FOREIGN KEY (payment_id) REFERENCES pos_payment_attempts(id);
alter table "pos_private"."square_refund_observations" add constraint "square_refund_observations_refund_id_fkey" FOREIGN KEY (refund_id) REFERENCES pos_payment_refund_attempts(id);
alter table "public"."pos_payment_devices" add constraint "pos_payment_devices_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table "public"."pos_payment_devices" add constraint "pos_payment_devices_workspace_id_site_id_fkey" FOREIGN KEY (workspace_id, site_id) REFERENCES pos_store_locations(workspace_id, id);
alter table "public"."pos_payment_devices" add constraint "pos_payment_devices_workspace_id_connection_id_fkey" FOREIGN KEY (workspace_id, connection_id) REFERENCES pos_private.square_connections(workspace_id, id);
alter table "public"."pos_payment_devices" add constraint "pos_payment_devices_workspace_id_site_id_assigned_register_fkey" FOREIGN KEY (workspace_id, site_id, assigned_register_id) REFERENCES pos_registers(workspace_id, site_id, id);
alter table "pos_private"."square_device_codes" add constraint "square_device_codes_device_id_fkey" FOREIGN KEY (device_id) REFERENCES pos_payment_devices(id);
alter table "pos_private"."square_terminal_attempts" add constraint "square_terminal_attempts_payment_id_fkey" FOREIGN KEY (payment_id) REFERENCES pos_payment_attempts(id);
alter table "pos_private"."square_terminal_attempts" add constraint "square_terminal_attempts_device_id_fkey" FOREIGN KEY (device_id) REFERENCES pos_payment_devices(id);
alter table "pos_private"."square_terminal_refunds" add constraint "square_terminal_refunds_refund_id_fkey" FOREIGN KEY (refund_id) REFERENCES pos_payment_refund_attempts(id);
alter table "pos_private"."square_hardware_audit" add constraint "square_hardware_audit_device_id_fkey" FOREIGN KEY (device_id) REFERENCES pos_payment_devices(id);
CREATE INDEX pos_inventory_search ON public.inventory_items USING gin (to_tsvector('simple'::regconfig, ((((((COALESCE(card_name, ''::text) || ' '::text) || COALESCE(product_name, ''::text)) || ' '::text) || COALESCE(set_code, ''::text)) || ' '::text) || COALESCE(collector_number, ''::text))));
CREATE INDEX pos_stock_positions ON public.chaos_sort_inventory_positions USING btree (user_id, item_id);
CREATE INDEX pos_stock_reservations ON public.selling_inventory_allocations USING btree (user_id, inventory_item_id, status);
CREATE INDEX pos_tenders_sale ON public.pos_tenders USING btree (sale_id);
CREATE UNIQUE INDEX pos_tender_attempt ON public.pos_tenders USING btree (payment_attempt_id) WHERE (payment_attempt_id IS NOT NULL);
CREATE INDEX pos_sales_history ON public.pos_sales USING btree (workspace_id, actor_id, created_at DESC, id);
CREATE INDEX pos_report_sales ON public.pos_sales USING btree (workspace_id, site_id, created_at, register_id, actor_id);
CREATE INDEX pos_receipt_prefix ON public.pos_sales USING btree (workspace_id, lower(receipt_number) text_pattern_ops);
CREATE INDEX pos_sale_items_sale ON public.pos_sale_items USING btree (sale_id);
CREATE INDEX pos_item_sku_prefix ON public.pos_sale_items USING btree (workspace_id, lower((snapshot ->> 'sku'::text)) text_pattern_ops);
CREATE INDEX pos_item_name_search ON public.pos_sale_items USING gin (to_tsvector('simple'::regconfig, COALESCE((snapshot ->> 'name'::text), ''::text)));
CREATE INDEX pos_sale_allocations_sale_item ON public.pos_sale_allocations USING btree (sale_id, inventory_item_id);
CREATE UNIQUE INDEX pos_delegation_active ON public.pos_inventory_delegations USING btree (workspace_id, site_id, inventory_user_id, employee_id) WHERE (revoked_at IS NULL);
CREATE INDEX pos_delegation_employee ON public.pos_inventory_delegations USING btree (employee_id, workspace_id, site_id) WHERE (revoked_at IS NULL);
CREATE UNIQUE INDEX pos_one_open_session ON public.pos_register_sessions USING btree (register_id) WHERE (closed_at IS NULL);
CREATE INDEX pos_session_history ON public.pos_register_sessions USING btree (workspace_id, site_id, opened_at DESC);
CREATE UNIQUE INDEX pos_cash_reference ON public.pos_cash_events USING btree (kind, reference_id) WHERE (reference_id IS NOT NULL);
CREATE INDEX pos_cash_session ON public.pos_cash_events USING btree (session_id, created_at, id);
CREATE INDEX pos_refund_sale ON public.pos_refunds USING btree (sale_id, created_at);
CREATE INDEX pos_report_refunds ON public.pos_refunds USING btree (workspace_id, site_id, created_at);
CREATE INDEX pos_refund_item_sale ON public.pos_refund_items USING btree (sale_item_id);
CREATE INDEX pos_payment_session ON public.pos_payment_checkouts USING btree (session_id, state);
CREATE INDEX pos_payment_refunds_payment ON public.pos_payment_refund_attempts USING btree (payment_id, status);
CREATE INDEX pos_payment_pending_refund_session ON public.pos_payment_refund_attempts USING btree (((intent ->> 'sessionId'::text))) WHERE ((status = ANY (ARRAY['CREATED'::text, 'PENDING'::text, 'UNKNOWN'::text])) OR recovery_required);
CREATE INDEX pos_payment_events_payment ON public.pos_payment_events USING btree (payment_id);
CREATE INDEX pos_payment_audit_payment ON public.pos_payment_audit USING btree (payment_id, created_at);
CREATE UNIQUE INDEX square_one_connection ON pos_private.square_connections USING btree (workspace_id) WHERE (status = ANY (ARRAY['CONNECTED'::text, 'ATTENTION'::text]));
CREATE INDEX square_merchant ON pos_private.square_connections USING btree (merchant_id);
CREATE UNIQUE INDEX pos_payment_one_active ON public.pos_payment_attempts USING btree (checkout_id) WHERE (status <> ALL (ARRAY['DECLINED'::text, 'FAILED'::text, 'CANCELED'::text]));
CREATE INDEX pos_payment_history ON public.pos_payment_attempts USING btree (workspace_id, created_at DESC, id);
CREATE UNIQUE INDEX pos_terminal_register ON public.pos_payment_devices USING btree (assigned_register_id) WHERE ((disabled_at IS NULL) AND (assigned_register_id IS NOT NULL));
CREATE INDEX pos_terminal_workspace ON public.pos_payment_devices USING btree (workspace_id, site_id);
CREATE INDEX square_terminal_device ON pos_private.square_terminal_attempts USING btree (device_id);

CREATE OR REPLACE FUNCTION pos_private.resolve_owner_barcode(w uuid, site uuid, input text, stock_owner uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare code text:=trim(input); z public.inventory_label_identities%rowtype; candidate record;
  item text; v_position_id text; ids text[]; payload jsonb; available bigint; n integer;
begin
  perform pos_private.authorize(w);
  if not pos_private.can_transact(w,site,stock_owner,'sell') then raise exception 'POS_FORBIDDEN'; end if;
  if length(code) not between 1 and 160 or code ~ '[[:cntrl:]]' then raise exception 'POS_INVALID'; end if;
  if code ~* '^TD-[A-Z0-9]{4}-[A-Z0-9]{4}$' then code:=upper(code); end if;
  select count(*) into n from public.inventory_label_identities a where a.workspace_id=w and a.inventory_user_id=stock_owner and (a.sku=code or a.qr_token=code);
  if n>1 then raise exception 'POS_BARCODE_AMBIGUOUS'; end if;
  select * into z from public.inventory_label_identities a where a.workspace_id=w and a.inventory_user_id=stock_owner and (a.sku=code or a.qr_token=code) limit 1;
  if z.id is null then
    select a.* into candidate from public.inventory_barcode_aliases a where a.workspace_id=w and a.inventory_user_id=stock_owner and a.value=code;
    if found then
      if not candidate.active then raise exception 'POS_BARCODE_INACTIVE'; end if;
      select * into z from public.inventory_label_identities where id=candidate.identity_id and workspace_id=w and inventory_user_id=stock_owner;
      if z.id is null then raise exception 'POS_BARCODE_INACTIVE'; end if;
    end if;
  end if;
  if z.id is not null then
    if z.status<>'active' or z.revoked_at is not null then raise exception 'POS_BARCODE_INACTIVE'; end if;
    if z.inventory_location_id is not null and not exists(select 1 from public.inventory_locations l where l.user_id=z.inventory_user_id and l.id=z.inventory_location_id) then raise exception 'POS_BARCODE_INACTIVE'; end if;
    if z.target_type in ('storage','buylist_intake') then raise exception 'POS_BARCODE_WRONG_CLASS'; end if;
    item:=z.inventory_item_id; v_position_id:=z.inventory_position_id;
  else
    if exists(select 1 from pos_private.label_tombstones t where t.workspace_id=w and t.inventory_user_id=stock_owner and (t.sku=code or t.qr_token=code or t.barcode_value=code)) then raise exception 'POS_BARCODE_INACTIVE'; end if;
    -- UPC/EAN precedes legacy provider/product codes; ambiguity never falls through.
    select array_agg(i.id) into ids from public.inventory_items i where i.workspace_id=w and i.user_id=stock_owner and i.upc=code;
    if ids is null then
      select array_agg(distinct i.id) into ids from public.inventory_items i where i.workspace_id=w and i.user_id=stock_owner
        and (i.sku=code or i.barcode_value=code or i.id=code or i.data->>'tcgplayer_product_id'=code or i.data->>'provider_sku_id'=code
          or exists(select 1 from public.inventory_label_identities a where a.workspace_id=w and a.inventory_user_id=i.user_id and a.inventory_item_id=i.id and a.barcode_value=code and a.status='active' and a.revoked_at is null));
    end if;
    if cardinality(ids)>1 then raise exception 'POS_BARCODE_AMBIGUOUS'; end if;
    item:=ids[1];
    if item is null then return '[]'; end if;
  end if;
  select jsonb_build_object('id',i.id,'ownerId',i.user_id,'name',coalesce(nullif(i.product_name,''),i.card_name),'sku',coalesce(z.sku,i.sku),'set_code',i.set_code,'collector_number',i.collector_number,
    'condition',coalesce(p.condition,i.data->>'condition'),'finish',coalesce(p.finish,i.data->>'finish'),'language',coalesce(p.language,i.data->>'language'),
    'location_id',i.location_id,'location',l.name,'taxable',coalesce(i.data->>'taxable','true')<>'false',
    'unit_price_minor',case when i.asking_price between 0 and 1000000 then (i.asking_price*100)::bigint end,
    'positionId',v_position_id,'barcodeIdentity',z.id,'targetType',case when v_position_id is null then 'inventory_item' else 'inventory_position' end,
    'batchId',p.batch_id,'image',i.data->>'imageUrl',
    'available',greatest(0,least(i.quantity-coalesce((select sum(a.quantity) from public.selling_inventory_allocations a where a.user_id=i.user_id and a.inventory_item_id=i.id and a.status in ('ALLOCATED','RESERVED')),0),
      case when v_position_id is null then i.quantity else p.quantity-coalesce((select sum(a.quantity) from public.selling_inventory_allocations a where a.user_id=i.user_id and a.inventory_item_id=i.id and (a.inventory_position_id is null or a.inventory_position_id=v_position_id) and a.status in ('ALLOCATED','RESERVED')),0) end)),
    'positions',coalesce((select jsonb_agg(jsonb_build_object('id',cp.id,'batchId',cp.batch_id,'quantity',cp.quantity,'locationId',cp.location_id)) from public.chaos_sort_inventory_positions cp where cp.user_id=i.user_id and cp.item_id=i.id and cp.quantity>0 and (v_position_id is null or cp.id=v_position_id)),'[]')) into payload
  from public.inventory_items i join public.inventory_locations l on l.user_id=i.user_id and l.id=i.location_id
  join public.pos_location_inventory_locations m on m.inventory_user_id=i.user_id and m.location_id=i.location_id and m.site_id=site
  left join public.chaos_sort_inventory_positions p on p.user_id=i.user_id and p.id=v_position_id and p.item_id=i.id and p.location_id=i.location_id
  where i.workspace_id=w and i.user_id=stock_owner and i.id=item and (v_position_id is null or p.id is not null);
  if payload is null or (payload->>'available')::bigint<1 then raise exception 'POS_BARCODE_INACTIVE'; end if;
  return jsonb_build_array(payload);
end $function$
;
revoke all on function pos_private.resolve_owner_barcode(uuid,uuid,text,uuid) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.pos_payment_refund_command(p_workspace_id uuid, p_action text, p_body jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ select pos_private.payment_refund_command(p_workspace_id,p_action,p_body) $function$
;
revoke all on function pos_payment_refund_command(uuid,text,jsonb) from public,anon,authenticated,service_role;
grant EXECUTE on function pos_payment_refund_command(uuid,text,jsonb) to "authenticated";
grant EXECUTE on function pos_payment_refund_command(uuid,text,jsonb) to "service_role";

CREATE OR REPLACE FUNCTION pos_private.resolve_barcode(w uuid, site uuid, input text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare stock_owner uuid; result jsonb:='[]'; candidate jsonb;
begin
 perform pos_private.authorize(w);
 for stock_owner in select distinct m.inventory_user_id from public.pos_location_inventory_locations m
   where m.workspace_id=w and m.site_id=site and pos_private.can_transact(w,site,m.inventory_user_id,'sell') order by m.inventory_user_id loop
   candidate:=pos_private.resolve_owner_barcode(w,site,input,stock_owner);
   result:=result||candidate;
 end loop;
 if jsonb_array_length(result)>1 then raise exception 'POS_BARCODE_AMBIGUOUS'; end if;
 return result;
end $function$
;
revoke all on function pos_private.resolve_barcode(uuid,uuid,text) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION pos_private.refund(w uuid, body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare sale public.pos_sales%rowtype; sess public.pos_register_sessions%rowtype; original public.pos_sale_items%rowtype;
 inv public.inventory_items%rowtype; alloc public.pos_sale_allocations%rowtype; position public.chaos_sort_inventory_positions%rowtype;
 line jsonb; prepared jsonb:='[]'; allocation_rows jsonb; q integer; previous_q integer; skip_q integer; take_q integer; remaining integer;
 net bigint; tax bigint; net_sum bigint:=0; tax_sum bigint:=0; refund_id uuid:=gen_random_uuid(); refund_item uuid;
 stock_owner uuid; restore boolean; unit_value numeric;
begin
 perform pos_private.authorize(w);
 if not pos_private.permission(w,'refund') then raise exception 'POS_FORBIDDEN'; end if;
 select * into sess from public.pos_register_sessions where id=(body->>'sessionId')::uuid and workspace_id=w for update;
 if sess.id is null or sess.status<>'OPEN' or not pos_private.site_access(w,sess.site_id) then raise exception 'POS_SESSION_CLOSED'; end if;
 select * into sale from public.pos_sales where id=(body->>'saleId')::uuid and workspace_id=w for update;
 if exists(select 1 from public.pos_tenders where sale_id=sale.id and method<>'cash') and not exists(select 1 from pos_private.payment_context x join public.pos_payment_refund_attempts r on r.id=x.refund_attempt_id where x.transaction_id=txid_current() and x.backend=pg_backend_pid() and x.actor_id=auth.uid() and r.workspace_id=w and r.status='SUCCEEDED' and r.intent->>'saleId'=sale.id::text) then raise exception 'POS_PROVIDER_REFUND_REQUIRED'; end if;
 if sale.id is null or not pos_private.site_access(w,sale.site_id) then raise exception 'POS_FORBIDDEN'; end if;
 if length(trim(coalesce(body->>'reason',''))) not between 1 and 500 or jsonb_typeof(body->'lines') is distinct from 'array' or jsonb_array_length(body->'lines') not between 1 and 500
  or (select count(distinct value->>'saleItemId') from jsonb_array_elements(body->'lines'))<>jsonb_array_length(body->'lines') then raise exception 'POS_INVALID'; end if;
 for stock_owner in select distinct inventory_user_id from public.pos_sale_items where sale_id=sale.id and id in (select (value->>'saleItemId')::uuid from jsonb_array_elements(body->'lines')) order by inventory_user_id loop
  perform pos_private.lock_authority(w,sale.site_id,stock_owner,'return');
 end loop;
 for line in select value from jsonb_array_elements(body->'lines') order by value->>'saleItemId' loop
  select * into original from public.pos_sale_items where id=(line->>'saleItemId')::uuid and sale_id=sale.id;
  if original.id is null or coalesce(line->>'quantity','') !~ '^\d{1,4}$' or jsonb_typeof(line->'returnInventory') is distinct from 'boolean' then raise exception 'POS_INVALID'; end if;
  q:=(line->>'quantity')::int; restore:=(line->>'returnInventory')::boolean;
  select coalesce(sum(quantity),0) into previous_q from public.pos_refund_items where sale_item_id=original.id;
  if q<1 or previous_q+q>original.quantity then raise exception 'POS_REFUND_EXCEEDED'; end if;
  net:=((original.unit_price_minor*original.quantity-original.discount_minor)*(previous_q+q)/original.quantity)-((original.unit_price_minor*original.quantity-original.discount_minor)*previous_q/original.quantity);
  tax:=(original.tax_minor*(previous_q+q)/original.quantity)-(original.tax_minor*previous_q/original.quantity);
  prepared:=prepared||jsonb_build_array(jsonb_build_object('id',original.id,'quantity',q,'returnInventory',restore,'net',net,'tax',tax,'previous',previous_q));
  net_sum:=net_sum+net; tax_sum:=tax_sum+tax;
 end loop;
 if coalesce(body->>'expectedMinor','') !~ '^\d{1,12}$' or (body->>'expectedMinor')::bigint<>net_sum+tax_sum then raise exception 'POS_QUOTE_CHANGED'; end if;
 insert into public.pos_refunds(id,workspace_id,sale_id,site_id,register_id,session_id,actor_id,subtotal_minor,tax_minor,total_minor,reason)
 values(refund_id,w,sale.id,sess.site_id,sess.register_id,sess.id,auth.uid(),net_sum,tax_sum,net_sum+tax_sum,body->>'reason');
 for line in select value from jsonb_array_elements(prepared) loop
  select * into original from public.pos_sale_items where id=(line->>'id')::uuid;
  q:=(line->>'quantity')::int; restore:=(line->>'returnInventory')::boolean; remaining:=q; skip_q:=(line->>'previous')::int; allocation_rows:='[]';
  if restore then
   select * into inv from public.inventory_items where user_id=original.inventory_user_id and id=original.inventory_item_id and workspace_id=w for update;
   if inv.id is null or not (original.snapshot ? 'inventoryValueUnit') or inv.location_id is distinct from original.snapshot->>'locationId'
     or not exists(select 1 from public.pos_location_inventory_locations where workspace_id=w and site_id=sale.site_id and inventory_user_id=inv.user_id and location_id=inv.location_id)
     or inv.set_code is distinct from original.snapshot->>'setCode' or inv.collector_number is distinct from original.snapshot->>'collectorNumber'
     then raise exception 'POS_PROVENANCE_CONFLICT'; end if;
  end if;
  for alloc in select * from public.pos_sale_allocations where sale_id=sale.id and inventory_user_id=original.inventory_user_id and inventory_item_id=original.inventory_item_id
   and line_key=coalesce(original.snapshot->>'positionId','') order by id loop
   take_q:=least(remaining,greatest(0,alloc.quantity-skip_q)); skip_q:=greatest(0,skip_q-alloc.quantity);
   if take_q=0 then continue; end if;
   allocation_rows:=allocation_rows||jsonb_build_array(jsonb_build_object('allocationId',alloc.id,'positionId',alloc.position_id,'batchId',alloc.batch_id,'locationId',alloc.location_id,'quantity',take_q));
   if restore and alloc.position_id is not null then
    select * into position from public.chaos_sort_inventory_positions where user_id=inv.user_id and id=alloc.position_id and item_id=inv.id for update;
    if position.id is null or position.status='retired' or position.location_id is distinct from alloc.location_id or position.batch_id is distinct from alloc.batch_id
      or position.condition is distinct from original.snapshot->>'condition' or position.finish is distinct from original.snapshot->>'finish' or position.language is distinct from original.snapshot->>'language' then raise exception 'POS_PROVENANCE_CONFLICT'; end if;
    update public.chaos_sort_inventory_positions set quantity=quantity+take_q,status='active',updated_at=now() where user_id=inv.user_id and id=position.id;
    update public.chaos_sort_batches set current_quantity=current_quantity+take_q,updated_at=now() where user_id=inv.user_id and id=alloc.batch_id;
    if not found then raise exception 'POS_PROVENANCE_CONFLICT'; end if;
   elsif restore then
    if inv.data->>'condition' is distinct from original.snapshot->>'condition' or inv.data->>'finish' is distinct from original.snapshot->>'finish' or inv.data->>'language' is distinct from original.snapshot->>'language' then raise exception 'POS_PROVENANCE_CONFLICT'; end if;
   end if;
   remaining:=remaining-take_q; exit when remaining=0;
  end loop;
  if remaining<>0 then raise exception 'POS_PROVENANCE_CONFLICT'; end if;
  insert into public.pos_refund_items(refund_id,sale_item_id,quantity,return_inventory,subtotal_minor,tax_minor,allocations)
   values(refund_id,original.id,q,restore,(line->>'net')::bigint,(line->>'tax')::bigint,allocation_rows) returning id into refund_item;
  if restore then
   insert into pos_private.stock_permits values(txid_current(),pg_backend_pid(),auth.uid(),inv.user_id,inv.id,to_jsonb(inv),inv.quantity+q);
   unit_value:=coalesce((original.snapshot->>'inventoryValueUnit')::numeric,0);
   update public.inventory_items set quantity=quantity+q,inventory_value=inventory_value+round(unit_value*((line->>'previous')::int+q),2)-round(unit_value*(line->>'previous')::int,2),updated_at=now() where user_id=inv.user_id and id=inv.id;
   delete from pos_private.stock_permits where transaction_id=txid_current() and backend=pg_backend_pid() and owner_id=inv.user_id and item_id=inv.id;
   insert into public.inventory_events(user_id,inventory_item_id,event_type,source,related_entity_type,related_entity_id,quantity_before,quantity_change,quantity_after,previous_location_id,next_location_id,card_name,idempotency_key,metadata)
    values(inv.user_id,inv.id,'quantity_added','system','pos_refund',refund_id::text,inv.quantity,q,inv.quantity+q,inv.location_id,inv.location_id,inv.card_name,'pos-refund:'||refund_item::text,jsonb_build_object('actor_id',auth.uid(),'workspace_id',w,'sale_id',sale.id,'site_id',sess.site_id,'session_id',sess.id,'allocations',allocation_rows));
  end if;
 end loop;
 if not exists(select 1 from public.pos_tenders where sale_id=sale.id and method<>'cash') then
 insert into public.pos_cash_events(workspace_id,site_id,register_id,session_id,actor_id,kind,amount_minor,reference_id,reason)
  values(w,sess.site_id,sess.register_id,sess.id,auth.uid(),'CASH_REFUND',-(net_sum+tax_sum),refund_id,body->>'reason');
 end if;
 return jsonb_build_object('id',refund_id,'totalMinor',net_sum+tax_sum,'saleId',sale.id);
end $function$
;
revoke all on function pos_private.refund(uuid,jsonb) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION pos_private.session_transition()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if old.status='CLOSED' or (to_jsonb(old)-array['status','closed_at','closed_by','expected_minor','counted_minor','variance_minor','close_notes','closing_started_at'])<>(to_jsonb(new)-array['status','closed_at','closed_by','expected_minor','counted_minor','variance_minor','close_notes','closing_started_at']) then raise exception 'POS_IMMUTABLE'; end if;
 if new.status='CLOSED' and (new.closed_by is null or new.counted_minor is null or new.expected_minor is null or new.variance_minor is distinct from new.counted_minor-new.expected_minor) then raise exception 'POS_INVALID'; end if;
 return new;
end $function$
;
revoke all on function pos_private.session_transition() from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.pos_command(p_workspace_id uuid, p_action text, p_body jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ select pos_private.command(p_workspace_id,p_action,p_body); $function$
;
revoke all on function pos_command(uuid,text,jsonb) from public,anon,authenticated,service_role;
grant EXECUTE on function pos_command(uuid,text,jsonb) to "authenticated";
grant EXECUTE on function pos_command(uuid,text,jsonb) to "service_role";

CREATE OR REPLACE FUNCTION pos_private.permission(w uuid, operation text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(select 1 from public.workspace_members m
   where m.workspace_id=w and m.user_id=auth.uid()
   and (m.role in ('owner','admin','manager')
     or (m.role='member' and operation='sell' and not exists(
       select 1 from public.workspace_employees e where e.workspace_id=w and e.linked_user_id=m.user_id))
     or (m.role in ('member','employee') and exists(
       select 1 from public.workspace_employees e
       where e.workspace_id=w and e.linked_user_id=m.user_id
         and e.employment_status='active'
         and coalesce(e.permissions->>('pos.'||operation),'false')='true'))))
$function$
;
revoke all on function pos_private.permission(uuid,text) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION pos_private.authorize(w uuid, management boolean DEFAULT false, require_enabled boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if auth.uid() is null or not exists(select 1 from public.workspace_members m join auth.users u on u.id=m.user_id
   where m.workspace_id=w and m.user_id=auth.uid() and m.role in ('owner','admin','manager','member','employee')
   and (not management or m.role in ('owner','admin','manager')) and (u.banned_until is null or u.banned_until<now()))
   or exists(select 1 from public.workspace_employees e where e.workspace_id=w and e.linked_user_id=auth.uid()
     and (e.employment_status<>'active' or coalesce(to_jsonb(e)->>'account_status','active')='suspended'))
 then raise exception 'POS_FORBIDDEN'; end if;
 if not pos_private.inventory_entitled(auth.uid())
   and not exists(select 1 from public.pos_inventory_delegations d where d.workspace_id=w and d.employee_id=auth.uid()
     and d.revoked_at is null and (d.valid_until is null or d.valid_until>now())
     and pos_private.inventory_entitled(d.inventory_user_id))
 then raise exception 'POS_FORBIDDEN'; end if;
 if not pos_private.permission(w,'sell') then raise exception 'POS_FORBIDDEN'; end if;
 if require_enabled and not exists(select 1 from public.pos_workspace_settings where workspace_id=w and enabled) then raise exception 'POS_DISABLED'; end if;
end $function$
;
revoke all on function pos_private.authorize(uuid,boolean,boolean) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.pos_payment_command(p_workspace_id uuid, p_action text, p_body jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ select pos_private.payment_command(p_workspace_id,p_action,p_body) $function$
;
revoke all on function pos_payment_command(uuid,text,jsonb) from public,anon,authenticated,service_role;
grant EXECUTE on function pos_payment_command(uuid,text,jsonb) to "authenticated";
grant EXECUTE on function pos_payment_command(uuid,text,jsonb) to "service_role";

CREATE OR REPLACE FUNCTION public.pos_square_service(p_action text, p_body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
declare w uuid:=(p_body->>'workspaceId')::uuid;actor uuid:=(p_body->>'actorId')::uuid;
 c pos_private.square_connections%rowtype;cred pos_private.square_credentials%rowtype;flow pos_private.square_oauth%rowtype;
 p public.pos_payment_attempts%rowtype;r public.pos_payment_refund_attempts%rowtype;loc jsonb;result jsonb;event pos_private.square_events%rowtype;
begin
 if octet_length(p_body::text)>131072 then raise exception 'POS_INVALID'; end if;
 if p_action like 'terminal_%' then return pos_private.terminal_service(p_action,p_body);end if;
 if p_action in ('oauth_start','oauth_consume','connect','manage_credentials','health','disconnect') then perform pos_private.square_admin(w,actor); end if;
 if p_action='oauth_start' then
  insert into pos_private.square_oauth values(p_body->>'hash',w,actor,now()+interval '10 minutes',null,'SANDBOX','/dashboard/pos/payments'); return '{}';
 elsif p_action='oauth_consume' then
  update pos_private.square_oauth set consumed_at=now() where state_hash=p_body->>'hash' and workspace_id=w and actor_id=actor and consumed_at is null and expires_at>now() returning * into flow;
  if flow.state_hash is null then raise exception 'OAUTH_STATE_INVALID'; end if;return jsonb_build_object('returnPath',flow.return_path);
 elsif p_action='connect' then
  perform pg_advisory_xact_lock(hashtextextended('square-connect:'||w::text,0));
  select * into c from pos_private.square_connections where workspace_id=w and status in ('CONNECTED','ATTENTION') for update;
  if c.id is not null and c.merchant_id<>p_body->>'merchantId' and coalesce((p_body->>'replaceConfirmed')::boolean,false)=false then raise exception 'SQUARE_REPLACEMENT_REQUIRED'; end if;
  -- Keep identity stable for same-merchant reauthorization; different merchants get a new record.
  if c.id is null then select * into c from pos_private.square_connections where workspace_id=w and merchant_id=p_body->>'merchantId' and status in ('REVOKED','DISCONNECTED') order by connected_at desc limit 1 for update; end if;
  if c.id is not null and c.merchant_id<>p_body->>'merchantId' then
   update pos_private.square_connections set status='REPLACED' where id=c.id;delete from pos_private.square_credentials where connection_id=c.id;c.id:=null;
  end if;
  if c.id is null then
   insert into pos_private.square_connections(workspace_id,merchant_id,display_name,country,account_status,status,connected_by,last_validated_at) values(w,p_body->>'merchantId',p_body->>'displayName',p_body->>'country',p_body->>'accountStatus','CONNECTED',actor,now()) returning * into c;
  else update pos_private.square_connections set status='CONNECTED',last_validated_at=now(),display_name=p_body->>'displayName',account_status=p_body->>'accountStatus' where id=c.id;end if;
  insert into pos_private.square_credentials(connection_id,encrypted,expires_at) values(c.id,p_body->'encrypted',(p_body->>'expiresAt')::timestamptz) on conflict(connection_id) do update set encrypted=excluded.encrypted,expires_at=excluded.expires_at,version=square_credentials.version+1,refresh_lease=null,refresh_until=null;
  update pos_private.square_locations set status='INACTIVE' where connection_id=c.id;
  for loc in select value from jsonb_array_elements(p_body->'locations') loop
   insert into pos_private.square_locations values(c.id,loc->>'id',loc->>'name',loc->>'status',loc->>'address') on conflict(connection_id,id) do update set name=excluded.name,status=excluded.status,address=excluded.address;
  end loop;
  update pos_private.square_connections set authorized_scopes=array(select jsonb_array_elements_text(coalesce(p_body->'scopes','[]'))) where id=c.id;
  return jsonb_build_object('id',c.id);
 elsif p_action='manage_credentials' then
  select * into c from pos_private.square_connections where workspace_id=w and id=(p_body->>'connectionId')::uuid;
 elsif p_action='payment_context' then
  select * into p from public.pos_payment_attempts where id=(p_body->>'id')::uuid and workspace_id=w and provider='SQUARE';
  if p.id is null then raise exception 'POS_FORBIDDEN'; end if;
  -- Server has separately called the authenticated get/dispatch command before this read.
  if actor is null or not (p.actor_id=actor or exists(select 1 from public.workspace_members where workspace_id=w and user_id=actor and role in ('owner','admin','manager'))) then raise exception 'POS_FORBIDDEN'; end if;
  select * into c from pos_private.square_connections where id=p.provider_account_id::uuid and workspace_id=w;
  result:=jsonb_build_object('payment',to_jsonb(p));
  if p_body->>'refundId' is not null then
   select * into r from public.pos_payment_refund_attempts where id=(p_body->>'refundId')::uuid and payment_id=p.id and workspace_id=w;
   if r.id is null or r.actor_id<>actor then raise exception 'POS_FORBIDDEN'; end if;
   result:=result||jsonb_build_object('refund',to_jsonb(r));
  end if;
 elsif p_action='credential' then
  select * into c from pos_private.square_connections where id=(p_body->>'connectionId')::uuid and workspace_id=w;
 elsif p_action='refresh_claim' then
  update pos_private.square_credentials set refresh_lease=(p_body->>'lease')::uuid,refresh_until=now()+interval '45 seconds'
  where connection_id=(p_body->>'connectionId')::uuid and (refresh_until is null or refresh_until<now()) and expires_at<now()+interval '23 days'
  and exists(select 1 from pos_private.square_connections c where c.id=connection_id and c.workspace_id=w and c.status='CONNECTED') returning * into cred;
  return case when cred.connection_id is null then '{}'::jsonb else to_jsonb(cred) end;
 elsif p_action='refresh_save' then
  update pos_private.square_credentials set encrypted=p_body->'encrypted',expires_at=(p_body->>'expiresAt')::timestamptz,version=version+1,refresh_lease=null,refresh_until=null
   where connection_id=(p_body->>'connectionId')::uuid and refresh_lease=(p_body->>'lease')::uuid and exists(select 1 from pos_private.square_connections c where c.id=connection_id and c.workspace_id=w and c.status='CONNECTED');return '{}';
 elsif p_action in ('health','disconnect','attention') then
  update pos_private.square_connections set status=case p_action when 'disconnect' then 'DISCONNECTED' when 'attention' then 'ATTENTION' else 'CONNECTED' end,last_validated_at=case when p_action='health' then now() else last_validated_at end where id=(p_body->>'connectionId')::uuid and workspace_id=w and status in ('CONNECTED','ATTENTION') returning * into c;
  if p_action='disconnect' then delete from pos_private.square_credentials where connection_id=c.id;end if;
  if p_action='health' and c.id is not null then
   update pos_private.square_connections set authorized_scopes=array(select jsonb_array_elements_text(coalesce(p_body->'scopes','[]'))) where id=c.id;
   update pos_private.square_locations set status='INACTIVE' where connection_id=c.id;
   for loc in select value from jsonb_array_elements(p_body->'locations') loop
    insert into pos_private.square_locations values(c.id,loc->>'id',loc->>'name',loc->>'status',loc->>'address') on conflict(connection_id,id) do update set name=excluded.name,status=excluded.status,address=excluded.address;
   end loop;
  end if;return '{}';
 elsif p_action='observe' then
  select * into p from public.pos_payment_attempts where id=(p_body->>'id')::uuid and workspace_id=w and provider='SQUARE';
  if p.id is null or p.amount_minor is distinct from (p_body->>'amountMinor')::bigint or p.currency is distinct from p_body->>'currency' or p.metadata->>'locationId' is distinct from p_body->>'locationId' or (p.provider_payment_id is not null and p.provider_payment_id is distinct from p_body->>'providerId') then raise exception 'POS_INVALID'; end if;
  if p_body->>'status' not in ('PENDING','AWAITING_CUSTOMER','PROCESSING','AUTHORIZED','SUCCEEDED','DECLINED','FAILED','CANCELED','UNKNOWN') then raise exception 'POS_INVALID'; end if;
  insert into pos_private.square_observations values(p.id,p_body->>'providerId',p_body->>'status',p_body->'metadata',now()) on conflict(payment_id) do update set provider_id=coalesce(square_observations.provider_id,excluded.provider_id),status=excluded.status,metadata=excluded.metadata,updated_at=now()
   where square_observations.status not in ('SUCCEEDED','DECLINED','FAILED','CANCELED') and not (square_observations.status='PROCESSING' and excluded.status in ('PENDING','AWAITING_CUSTOMER'));return '{}';
 elsif p_action='observe_refund' then
  select * into r from public.pos_payment_refund_attempts where id=(p_body->>'id')::uuid and workspace_id=w;
  select * into p from public.pos_payment_attempts where id=r.payment_id and provider='SQUARE';
  if p.id is null or r.amount_minor is distinct from (p_body->>'amountMinor')::bigint or p.currency is distinct from p_body->>'currency' or p.provider_payment_id is distinct from p_body->>'paymentId' or p_body->>'status' not in ('PENDING','UNKNOWN','SUCCEEDED','FAILED') then raise exception 'POS_INVALID'; end if;
  insert into pos_private.square_refund_observations values(r.id,p_body->>'providerId',p_body->>'status',now()) on conflict(refund_id) do update set provider_id=coalesce(square_refund_observations.provider_id,excluded.provider_id),status=excluded.status,updated_at=now() where square_refund_observations.status not in ('SUCCEEDED','FAILED');return '{}';
 elsif p_action='event' then
  insert into pos_private.square_events(event_id,merchant_id,event_type,resource_id) values(p_body->>'eventId',p_body->>'merchantId',p_body->>'type',p_body->>'resourceId') on conflict do nothing;
  select * into event from pos_private.square_events where event_id=p_body->>'eventId' for update;
  if event.merchant_id<>p_body->>'merchantId' or event.event_type<>p_body->>'type' then raise exception 'POS_INVALID';end if;
  if event.status='PROCESSED' then return jsonb_build_object('processed',true);end if;
  if event.event_type='oauth.authorization.revoked' then
   update pos_private.square_connections set status='REVOKED' where merchant_id=event.merchant_id and status in ('CONNECTED','ATTENTION');
   delete from pos_private.square_credentials where connection_id in(select id from pos_private.square_connections where merchant_id=event.merchant_id and status='REVOKED');
   update pos_private.square_events set status='PROCESSED',processed_at=now() where event_id=event.event_id;return jsonb_build_object('processed',true);
  end if;
  select a.* into p from public.pos_payment_attempts a join pos_private.square_connections c on c.id=a.provider_account_id::uuid where a.provider='SQUARE' and c.merchant_id=event.merchant_id and (a.provider_payment_id=event.resource_id or a.id::text=p_body->>'referenceId') limit 1;
  return jsonb_build_object('processed',false,'payment',case when p.id is not null then to_jsonb(p) end);
 elsif p_action='event_done' then
  update pos_private.square_events set status=case when coalesce((p_body->>'retry')::boolean,false) then 'RETRY' else 'PROCESSED' end,processed_at=case when coalesce((p_body->>'retry')::boolean,false) then null else now() end where event_id=p_body->>'eventId';return '{}';
 else raise exception 'POS_INVALID';end if;
 if c.id is null or (c.status<>'CONNECTED' and not (p_action='manage_credentials' and c.status='ATTENTION')) then raise exception 'UNAUTHORIZED_PROVIDER_ACCOUNT';end if;
 select * into cred from pos_private.square_credentials where connection_id=c.id;
 if cred.connection_id is null then raise exception 'UNAUTHORIZED_PROVIDER_ACCOUNT';end if;
 return coalesce(result,'{}')||jsonb_build_object('connection',to_jsonb(c),'credential',to_jsonb(cred));
end $function$
;
revoke all on function pos_square_service(text,jsonb) from public,anon,authenticated,service_role;
grant EXECUTE on function pos_square_service(text,jsonb) to "service_role";

CREATE OR REPLACE FUNCTION public.pos_square_settings(p_workspace_id uuid, p_action text, p_body jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c pos_private.square_connections%rowtype;
begin
 perform pos_private.square_admin(p_workspace_id,auth.uid());
 if p_action='map' then
  select * into c from pos_private.square_connections where id=(p_body->>'connectionId')::uuid and workspace_id=p_workspace_id and status='CONNECTED' for update;
  if c.id is null or not exists(select 1 from public.pos_store_locations where workspace_id=p_workspace_id and id=(p_body->>'siteId')::uuid) then raise exception 'POS_FORBIDDEN'; end if;
  if nullif(p_body->>'locationId','') is null then delete from pos_private.square_mappings where connection_id=c.id and site_id=(p_body->>'siteId')::uuid;
  else
   if not exists(select 1 from pos_private.square_locations where connection_id=c.id and id=p_body->>'locationId' and status='ACTIVE') then raise exception 'CONFIGURATION_ERROR'; end if;
   insert into pos_private.square_mappings values(p_workspace_id,(p_body->>'siteId')::uuid,c.id,p_body->>'locationId') on conflict(connection_id,site_id) do update set location_id=excluded.location_id;
  end if;
 elsif p_action<>'get' then raise exception 'POS_INVALID'; end if;
 return pos_private.square_settings(p_workspace_id);
end $function$
;
revoke all on function pos_square_settings(uuid,text,jsonb) from public,anon,authenticated,service_role;
grant EXECUTE on function pos_square_settings(uuid,text,jsonb) to "authenticated";
grant EXECUTE on function pos_square_settings(uuid,text,jsonb) to "service_role";

CREATE OR REPLACE FUNCTION pos_private.calculate(w uuid, site_id uuid, body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare site public.pos_store_locations%rowtype; inv public.inventory_items%rowtype; stock_owner uuid; line jsonb; lines jsonb:='[]'; updated jsonb:='[]';
 qty int; rate int; price bigint; original_price bigint; reserved bigint; line_sub bigint; line_disc bigint; line_tax bigint;
 sub bigint:=0; disc bigint:=0; tax bigint:=0; cart_discount bigint; taxable bigint; cumulative bigint:=0; allocated bigint:=0; share bigint;
begin
 perform pos_private.authorize(w);
 select * into site from public.pos_store_locations where id=site_id and workspace_id=w;
 if site.id is null or not pos_private.site_access(w,site.id) then raise exception 'POS_FORBIDDEN'; end if;
 if jsonb_typeof(body->'lines') is distinct from 'array' or jsonb_array_length(body->'lines') not between 1 and 500 then raise exception 'POS_INVALID'; end if;
  for line in select value from jsonb_array_elements(body->'lines') order by coalesce((value->>'ownerId')::uuid,site.inventory_user_id),(value->>'itemId') collate "C",nullif(value->>'positionId','') collate "C" nulls last loop
    stock_owner:=coalesce((line->>'ownerId')::uuid,site.inventory_user_id);
    if not pos_private.can_transact(w,site.id,stock_owner,'sell') then raise exception 'POS_FORBIDDEN'; end if;
    if coalesce(line->>'quantity','') !~ '^\d{1,4}$' or coalesce(line->>'discountBps','0') !~ '^\d{1,5}$' then raise exception 'POS_INVALID'; end if;
    qty := (line->>'quantity')::integer; rate := coalesce((line->>'discountBps')::integer,0);
    if qty not between 1 and 1000 or rate not between 0 and 10000 then raise exception 'POS_INVALID'; end if;
    if rate>0 then

      if length(trim(coalesce(body->>'discountReason',''))) not between 1 and 200 then raise exception 'POS_DISCOUNT_REASON'; end if;
    end if;
    select i.* into inv from public.inventory_items i join public.pos_location_inventory_locations m on m.inventory_user_id=i.user_id and m.location_id=i.location_id and m.site_id=site.id
      where i.user_id=stock_owner and i.workspace_id=w and i.id=line->>'itemId';
    if inv.id is null then raise exception 'POS_STOCK_UNAVAILABLE'; end if;
    select coalesce(sum(quantity),0) into reserved from public.selling_inventory_allocations where user_id=stock_owner and inventory_item_id=inv.id and status in ('ALLOCATED','RESERVED');
    if inv.quantity-reserved<qty then raise exception 'POS_STOCK_UNAVAILABLE'; end if;
    if inv.asking_price is null or inv.asking_price not between 0 and 1000000 then raise exception 'POS_PRICE_REQUIRED'; end if;
    price := (inv.asking_price*100)::bigint;
    original_price:=price;
    if line ? 'overrideMinor' and line->>'overrideMinor' is not null then
      if coalesce(line->>'overrideMinor','') !~ '^\d{1,9}$' or (line->>'overrideMinor')::bigint>100000000 then raise exception 'POS_INVALID'; end if;
      price:=(line->>'overrideMinor')::bigint;
    end if;
    if coalesce(line->>'discountMinor','0') !~ '^\d{1,12}$' then raise exception 'POS_INVALID'; end if;
    if rate>0 and coalesce((line->>'discountMinor')::bigint,0)>0 then raise exception 'POS_INVALID'; end if;
    line_sub := price*qty; line_disc := (line_sub*rate+5000)/10000+coalesce((line->>'discountMinor')::bigint,0);
    if line_disc>line_sub then raise exception 'POS_INVALID'; end if;
    if (line_disc>0 or price<>original_price) and length(trim(coalesce(body->>'discountReason',''))) not between 1 and 200 then raise exception 'POS_DISCOUNT_REASON'; end if;
    line_tax := case when inv.data->>'taxable'='false' then 0 else ((line_sub-line_disc)*site.tax_bps+5000)/10000 end;
    sub:=sub+line_sub; disc:=disc+line_disc; tax:=tax+line_tax;
    lines:=lines||jsonb_build_array(jsonb_build_object('itemId',inv.id,'ownerId',stock_owner,'name',coalesce(nullif(inv.product_name,''),inv.card_name),'sku',inv.sku,'quantity',qty,'unitPriceMinor',price,'originalUnitPriceMinor',original_price,'overrideDifferenceMinor',price-original_price,'lineDiscountMinor',line_disc,'discountBps',rate,'inventoryValueUnit',case when inv.quantity>0 then inv.inventory_value/inv.quantity else 0 end,'discountMinor',line_disc,'taxMinor',line_tax,'lineTotalMinor',line_sub-line_disc+line_tax,'gameId',coalesce(to_jsonb(inv)->>'game_id',inv.data->>'game_id'),'productType',coalesce(to_jsonb(inv)->>'product_type',inv.data->>'product_type'),'scryfallId',inv.scryfall_id,'tcgplayerProductId',coalesce(to_jsonb(inv)->>'tcgplayer_product_id',inv.data->>'tcgplayer_product_id'),'setCode',inv.set_code,'collectorNumber',inv.collector_number,'condition',coalesce((select p.condition from public.chaos_sort_inventory_positions p where p.user_id=stock_owner and p.id=line->>'positionId' and p.item_id=inv.id),inv.data->>'condition'),'finish',coalesce((select p.finish from public.chaos_sort_inventory_positions p where p.user_id=stock_owner and p.id=line->>'positionId' and p.item_id=inv.id),inv.data->>'finish'),'language',coalesce((select p.language from public.chaos_sort_inventory_positions p where p.user_id=stock_owner and p.id=line->>'positionId' and p.item_id=inv.id),inv.data->>'language'),'locationId',inv.location_id,'costBasis',pos_private.cost_snapshot(inv.data),'priceSource','asking_price','positionId',line->>'positionId'));
  end loop;

 if coalesce(body->>'cartDiscountMinor','0') !~ '^\d{1,12}$' or coalesce(body->>'cartDiscountBps','0') !~ '^\d{1,5}$'
   or coalesce((body->>'cartDiscountBps')::int,0)>10000 then raise exception 'POS_INVALID'; end if;
 if coalesce((body->>'cartDiscountMinor')::bigint,0)>0 and coalesce((body->>'cartDiscountBps')::int,0)>0 then raise exception 'POS_INVALID'; end if;
 taxable:=sub-disc;
 cart_discount:=coalesce((body->>'cartDiscountMinor')::bigint,0)+(taxable*coalesce((body->>'cartDiscountBps')::int,0)+5000)/10000;
 if cart_discount>taxable then raise exception 'POS_INVALID'; end if;
 if cart_discount>0 and length(trim(coalesce(body->>'discountReason',''))) not between 1 and 200 then raise exception 'POS_DISCOUNT_REASON'; end if;
 tax:=0;
 for line in select value from jsonb_array_elements(lines) loop
  line_sub:=(line->>'unitPriceMinor')::bigint*(line->>'quantity')::int-(line->>'discountMinor')::bigint;
  cumulative:=cumulative+line_sub;
  share:=case when taxable=0 then 0 else floor(cart_discount::numeric*cumulative/taxable)::bigint-allocated end;
  allocated:=allocated+share;
  select * into inv from public.inventory_items where user_id=(line->>'ownerId')::uuid and id=line->>'itemId';
  line_tax:=case when inv.data->>'taxable'='false' then 0 else ((line_sub-share)*site.tax_bps+5000)/10000 end;
  tax:=tax+line_tax;
  updated:=updated||jsonb_build_array(line||jsonb_build_object('cartDiscountMinor',share,'discountMinor',(line->>'discountMinor')::bigint+share,'taxMinor',line_tax,'lineTotalMinor',line_sub-share+line_tax));
 end loop;
 return jsonb_build_object('lines',updated,'subtotalMinor',sub,'discountMinor',disc+cart_discount,'taxMinor',tax,'totalMinor',sub-disc-cart_discount+tax);
end $function$
;
revoke all on function pos_private.calculate(uuid,uuid,jsonb) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION pos_private.record_sale_cash()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare sale public.pos_sales%rowtype;
begin
 if new.method<>'cash' then return new; end if;
 select * into sale from public.pos_sales where id=new.sale_id;
 insert into public.pos_cash_events(workspace_id,site_id,register_id,session_id,actor_id,kind,amount_minor,reference_id) values(sale.workspace_id,sale.site_id,sale.register_id,sale.session_id,sale.actor_id,'CASH_SALE',new.amount_minor,new.id);
 return new;
end $function$
;
revoke all on function pos_private.record_sale_cash() from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.pos_terminal_devices(p_workspace_id uuid, p_action text, p_body jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare d public.pos_payment_devices%rowtype;
begin
 perform pos_private.authorize(p_workspace_id,false,false);
 if p_action<>'get' then
  perform pos_private.square_admin(p_workspace_id,auth.uid());
  select * into d from public.pos_payment_devices where id=(p_body->>'id')::uuid and workspace_id=p_workspace_id for update;
  if d.id is null then raise exception 'POS_FORBIDDEN';end if;
  if p_action='rename' then
   update public.pos_payment_devices set display_name=trim(p_body->>'name'),updated_at=now() where id=d.id;
  elsif p_action='assign' then
   if pos_private.terminal_busy(d.id) then raise exception 'DEVICE_BUSY';end if;
   if nullif(p_body->>'registerId','') is not null and (d.disabled_at is not null or d.pairing_status<>'PAIRED' or not exists(select 1 from public.pos_registers where id=(p_body->>'registerId')::uuid and workspace_id=p_workspace_id and site_id=d.site_id and active)) then raise exception 'POS_FORBIDDEN';end if;
   update public.pos_payment_devices set assigned_register_id=nullif(p_body->>'registerId','')::uuid,updated_at=now() where id=d.id;
  elsif p_action='disable' then
   update public.pos_payment_devices set disabled_at=coalesce(disabled_at,now()),status='DISABLED',assigned_register_id=null,updated_at=now() where id=d.id;
  else raise exception 'POS_INVALID';end if;
  insert into pos_private.square_hardware_audit(workspace_id,device_id,actor_id,action) values(p_workspace_id,d.id,auth.uid(),case when p_action='assign' and nullif(p_body->>'registerId','') is null then 'unassign' else p_action end);
 end if;
 return jsonb_build_object('devices',pos_private.terminal_devices(p_workspace_id),
 'canManage',exists(select 1 from public.workspace_members where workspace_id=p_workspace_id and user_id=auth.uid() and role in ('owner','admin')),
 'sites',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name)),'[]') from public.pos_store_locations where workspace_id=p_workspace_id and pos_private.site_access(p_workspace_id,id)),
 'registers',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'siteId',site_id,'name',name)),'[]') from public.pos_registers where workspace_id=p_workspace_id and active and pos_private.site_access(p_workspace_id,site_id)));
end $function$
;
revoke all on function pos_terminal_devices(uuid,text,jsonb) from public,anon,authenticated,service_role;
grant EXECUTE on function pos_terminal_devices(uuid,text,jsonb) to "authenticated";
grant EXECUTE on function pos_terminal_devices(uuid,text,jsonb) to "service_role";

CREATE OR REPLACE FUNCTION pos_private.square_admin(w uuid, actor uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if actor is null or not exists(select 1 from public.workspace_members where workspace_id=w and user_id=actor and role in ('owner','admin')) then raise exception 'POS_FORBIDDEN'; end if;
end $function$
;
revoke all on function pos_private.square_admin(uuid,uuid) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION pos_private.terminal_busy(d uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(select 1 from pos_private.square_terminal_attempts t join public.pos_payment_attempts p on p.id=t.payment_id where t.device_id=d and p.status not in ('SUCCEEDED','DECLINED','FAILED','CANCELED','PARTIALLY_REFUNDED','REFUNDED'));
$function$
;
revoke all on function pos_private.terminal_busy(uuid) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION pos_private.terminal_scoped(scopes text[])
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
 select scopes @> array['DEVICE_CREDENTIAL_MANAGEMENT','MERCHANT_PROFILE_READ','PAYMENTS_READ','PAYMENTS_WRITE'];
$function$
;
revoke all on function pos_private.terminal_scoped(text[]) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION pos_private.terminal_devices(w uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'siteId',d.site_id,'registerId',d.assigned_register_id,'name',d.display_name,
 'pairingStatus',case when d.pairing_status='PAIRING' and d.pair_by<now() then 'EXPIRED' else d.pairing_status end,
 'status',case when d.disabled_at is not null then 'DISABLED' when pos_private.terminal_busy(d.id) then 'BUSY' else d.status end,
 'pairBy',d.pair_by,'pairedAt',d.paired_at,'lastSeenAt',d.last_seen_at,
 'eligible',d.disabled_at is null and d.pairing_status='PAIRED' and d.status in ('PAIRED','AVAILABLE','BUSY') and d.assigned_register_id is not null and c.status='CONNECTED' and pos_private.terminal_scoped(c.authorized_scopes) and exists(select 1 from pos_private.square_mappings m join pos_private.square_locations l on l.connection_id=m.connection_id and l.id=m.location_id where m.connection_id=d.connection_id and m.site_id=d.site_id and m.location_id=d.provider_location_id and l.status='ACTIVE')) order by d.created_at),'[]')
 from public.pos_payment_devices d join pos_private.square_connections c on c.id=d.connection_id where d.workspace_id=w and pos_private.site_access(w,d.site_id);
$function$
;
revoke all on function pos_private.terminal_devices(uuid) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION pos_private.cost_snapshot(data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare k text; result jsonb:='{}'; v text;
begin
  foreach k in array array['unitCost','costBasis','purchasePrice','totalCost','totalCostBasis','cost_basis','unit_cost'] loop
    v:=data->>k;
    if v ~ '^\d{1,10}(\.\d{1,4})?$' then
      result:=result||jsonb_build_object(k||'Minor',round(v::numeric*100)::bigint);
    end if;
  end loop;
  return jsonb_build_object('values',result,'sourceId',coalesce(data->>'purchase_id',data->>'source_id'),'method','legacy_snapshot');
end $function$
;
revoke all on function pos_private.cost_snapshot(jsonb) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION pos_private.immutable()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin raise exception 'POS_IMMUTABLE'; end $function$
;
revoke all on function pos_private.immutable() from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION pos_private.payment_transition()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if tg_op='DELETE' then raise exception 'POS_IMMUTABLE'; end if;
 if tg_table_name='pos_payment_checkouts' then
  if (to_jsonb(new)-array['state','sale_id','failure_code','updated_at'])<>(to_jsonb(old)-array['state','sale_id','failure_code','updated_at']) then raise exception 'POS_IMMUTABLE'; end if;
  if old.state<>new.state and not ((old.state='PAYABLE' and new.state='PAYING') or (old.state='PAYING' and new.state in ('PAYABLE','FINALIZING')) or (old.state in ('FINALIZING','RECOVERY_REQUIRED') and new.state in ('COMPLETED','RECOVERY_REQUIRED','VOIDED'))) then raise exception 'POS_PAYMENT_TRANSITION'; end if;
  if old.state in ('COMPLETED','VOIDED') and new is distinct from old then raise exception 'POS_PAYMENT_TRANSITION'; end if;
 elsif tg_table_name='pos_payment_attempts' then
  if (to_jsonb(new)-array['status','provider_payment_id','metadata','failure_code','updated_at','completed_at','reconciled_at'])<>(to_jsonb(old)-array['status','provider_payment_id','metadata','failure_code','updated_at','completed_at','reconciled_at']) then raise exception 'POS_IMMUTABLE'; end if;
  if old.status<>new.status and not (
   (old.status in ('CREATED','PENDING','AWAITING_CUSTOMER','PROCESSING','AUTHORIZED','TIMED_OUT','UNKNOWN') and new.status in ('PENDING','AWAITING_CUSTOMER','PROCESSING','AUTHORIZED','SUCCEEDED','DECLINED','FAILED','CANCELED','TIMED_OUT','UNKNOWN')) or
   (old.status in ('SUCCEEDED','PARTIALLY_REFUNDED','REFUND_PENDING') and new.status in ('REFUND_PENDING','PARTIALLY_REFUNDED','REFUNDED','SUCCEEDED'))
  ) then raise exception 'POS_PAYMENT_TRANSITION'; end if;
 elsif tg_table_name='pos_payment_refund_attempts' then
  if (to_jsonb(new)-array['status','provider_refund_id','refund_id','recovery_required','failure_code','updated_at'])<>(to_jsonb(old)-array['status','provider_refund_id','refund_id','recovery_required','failure_code','updated_at']) then raise exception 'POS_IMMUTABLE'; end if;
  if old.status in ('SUCCEEDED','FAILED') and old.status<>new.status then raise exception 'POS_PAYMENT_TRANSITION'; end if;
 end if;
 return new;
end $function$
;
revoke all on function pos_private.payment_transition() from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION pos_private.payment_authorize(w uuid, checkout uuid, manage boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.pos_payment_checkouts%rowtype; begin
 perform pos_private.authorize(w,manage,false);
 select * into c from public.pos_payment_checkouts where workspace_id=w and id=checkout;
 if c.id is null or (c.actor_id<>auth.uid() and not (pos_private.site_access(w,c.site_id) and exists(select 1 from public.workspace_members where workspace_id=w and user_id=auth.uid() and role in ('owner','admin','manager')))) then raise exception 'POS_FORBIDDEN'; end if;
 -- Historical actor/manager access survives grant revocation; stock mutations still reauthorize.
end $function$
;
revoke all on function pos_private.payment_authorize(uuid,uuid,boolean) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION pos_private.payment_view(payment uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select jsonb_build_object('id',p.id,'checkoutId',c.id,'provider',p.provider,'status',p.status,'amountMinor',p.amount_minor,'currency',p.currency,'providerReference',p.provider_payment_id,'metadata',p.metadata,'createdAt',p.created_at,'completedAt',p.completed_at,'reconciledAt',p.reconciled_at,'saleState',c.state,'saleId',c.sale_id,'failureCode',coalesce(c.failure_code,p.failure_code),'receipt',s.receipt,
 'refunds',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'status',r.status,'amountMinor',r.amount_minor,'refundId',r.refund_id,'recoveryRequired',r.recovery_required,'failureCode',r.failure_code) order by r.created_at),'[]') from public.pos_payment_refund_attempts r where r.payment_id=p.id))
 from public.pos_payment_attempts p join public.pos_payment_checkouts c on c.id=p.checkout_id left join public.pos_sales s on s.id=c.sale_id where p.id=payment
$function$
;
revoke all on function pos_private.payment_view(uuid) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION pos_private.expected_cash(session uuid)
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select coalesce(sum(amount_minor),0)::bigint from public.pos_cash_events where session_id=session
$function$
;
revoke all on function pos_private.expected_cash(uuid) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION pos_private.permitted_stock_update(previous jsonb, next_row jsonb)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(select 1 from pos_private.stock_permits p where p.transaction_id=txid_current() and p.backend=pg_backend_pid()
  and p.actor_id=auth.uid() and p.owner_id=(previous->>'user_id')::uuid and p.item_id=previous->>'id'
  and p.before_row=previous and p.after_quantity=(next_row->>'quantity')::int
  and (previous-array['quantity','inventory_value','updated_at'])=(next_row-array['quantity','inventory_value','updated_at']))
$function$
;
revoke all on function pos_private.permitted_stock_update(jsonb,jsonb) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION pos_private.payment_audit(payment uuid, action text, previous text, next text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 insert into public.pos_payment_audit(workspace_id,payment_id,actor_id,action,previous_status,next_status) select workspace_id,id,auth.uid(),action,previous,next from public.pos_payment_attempts where id=payment
$function$
;
revoke all on function pos_private.payment_audit(uuid,text,text,text) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION pos_private.lock_authority(w uuid, site uuid, stock_owner uuid, operation text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 -- Same lock is used by grant, revoke and scope replacement. Stock-owner locks
 -- are acquired in UUID order by checkout before any parent/position lock.
 perform pg_advisory_xact_lock(hashtextextended('collector-inventory:'||stock_owner::text,0));
 if not pos_private.can_transact(w,site,stock_owner,operation) then raise exception 'POS_FORBIDDEN'; end if;
end $function$
;
revoke all on function pos_private.lock_authority(uuid,uuid,uuid,text) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION pos_private.read_operations(w uuid, action text, body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb; site public.pos_store_locations%rowtype; sale public.pos_sales%rowtype; manager boolean; first_day date; last_day date; start_at timestamptz; end_at timestamptz;
begin
 perform pos_private.authorize(w,false,false);
 manager:=exists(select 1 from public.workspace_members where workspace_id=w and user_id=auth.uid() and role in ('owner','admin','manager'));
 if action='receipt' then
  select * into sale from public.pos_sales where workspace_id=w and id=(body->>'saleId')::uuid
   and (actor_id=auth.uid() or (manager and pos_private.site_access(w,site_id)));
  if sale.id is null then return jsonb_build_object('status','not_found'); end if;
  return jsonb_build_object('status','completed','saleId',sale.id,'receipt',sale.receipt,
   'approval',(select jsonb_build_object('name',coalesce((select full_name from public.workspace_employees where workspace_id=w and linked_user_id=d.approved_by limit 1),'Manager'),'at',d.approved_at,'reason',r.reason) from public.pos_approval_requests r join public.pos_approval_decisions d on d.request_id=r.id where r.id=(sale.request->>'approvalId')::uuid),
   'inventoryEvents',(select coalesce(jsonb_agg(jsonb_build_object('at',e.created_at,'kind',e.event_type,'quantity',e.quantity_change,'name',e.card_name)),'[]') from public.inventory_events e where (e.related_entity_type='pos_sale' and e.related_entity_id=sale.id::text) or (e.related_entity_type='pos_refund' and e.related_entity_id in (select id::text from public.pos_refunds where sale_id=sale.id))),
   'items',(select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'name',l.snapshot->>'name','quantity',l.quantity,'netMinor',l.unit_price_minor*l.quantity-l.discount_minor,'taxMinor',l.tax_minor,'refundedQuantity',coalesce((select sum(quantity) from public.pos_refund_items where sale_item_id=l.id),0))),'[]') from public.pos_sale_items l where l.sale_id=sale.id),
   'refunds',(select coalesce(jsonb_agg(r order by r.created_at),'[]') from public.pos_refunds r where r.sale_id=sale.id),
   'activity',(select coalesce(jsonb_agg(jsonb_build_object('at',e.created_at,'kind',e.kind,'actorId',e.actor_id,'amountMinor',e.amount_minor) order by e.created_at),'[]') from public.pos_cash_events e where e.reference_id in (select id from public.pos_tenders where sale_id=sale.id union all select id from public.pos_refunds where sale_id=sale.id)));
 end if;
 if action='history' then
  select coalesce(jsonb_agg(x),'[]') into result from (
   select s.id,s.receipt_number,s.created_at,s.total_minor,s.subtotal_minor,s.discount_minor,s.tax_minor,s.register_id,s.actor_id,l.name as site_name,l.timezone,(select string_agg(distinct t.method,', ' order by t.method) from public.pos_tenders t where t.sale_id=s.id) as payment_methods,
    coalesce((select sum(r.total_minor) from public.pos_refunds r where r.sale_id=s.id),0) as refunded_minor
   from public.pos_sales s join public.pos_store_locations l on l.id=s.site_id
   where s.workspace_id=w and (s.actor_id=auth.uid() or (manager and pos_private.site_access(w,s.site_id)))
    and (nullif(body->>'siteId','') is null or s.site_id=(body->>'siteId')::uuid)
    and (nullif(body->>'registerId','') is null or s.register_id=(body->>'registerId')::uuid)
    and (nullif(body->>'actorId','') is null or s.actor_id=(body->>'actorId')::uuid)
    and (nullif(body->>'payment','') is null or exists(select 1 from public.pos_tenders t where t.sale_id=s.id and t.method=body->>'payment'))
    and (nullif(body->>'from','') is null or s.created_at>=((body->>'from')::date::timestamp at time zone l.timezone))
    and (nullif(body->>'to','') is null or s.created_at<(((body->>'to')::date+1)::timestamp at time zone l.timezone))
    and (coalesce(body->>'period','all')='all' or (s.created_at at time zone l.timezone)::date between
      (now() at time zone l.timezone)::date-case body->>'period' when 'yesterday' then 1 when '7' then 6 when '30' then 29 else 0 end
      and (now() at time zone l.timezone)::date-case body->>'period' when 'yesterday' then 1 else 0 end)
    and (nullif(body->>'status','') is null or (body->>'status'='refunded' and exists(select 1 from public.pos_refunds where sale_id=s.id)) or (body->>'status'='completed' and not exists(select 1 from public.pos_refunds where sale_id=s.id)))
    and (nullif(body->>'query','') is null or lower(s.receipt_number) like lower(body->>'query')||'%' or exists(select 1 from public.pos_sale_items i where i.sale_id=s.id and (to_tsvector('simple',coalesce(i.snapshot->>'name','')) @@ websearch_to_tsquery('simple',body->>'query') or lower(i.snapshot->>'sku') like lower(body->>'query')||'%')))
    and (nullif(body->>'before','') is null or (s.created_at,s.id)<((body->>'before')::timestamptz,coalesce(nullif(body->>'beforeId',''),'00000000-0000-0000-0000-000000000000')::uuid))
   order by s.created_at desc,s.id desc limit 50
  ) x;
  return result;
 end if;
 if action='sessions' then
  select coalesce(jsonb_agg(x),'[]') into result from (
   select s.id,s.site_id,s.register_id,r.name as register_name,l.name as site_name,l.timezone,(select string_agg(distinct t.method,', ' order by t.method) from public.pos_tenders t where t.sale_id=s.id) as payment_methods,s.status,s.opened_at,s.closed_at,s.actor_id,s.closed_by,s.close_notes,
    coalesce((select e.full_name from public.workspace_employees e where e.workspace_id=w and e.linked_user_id=s.actor_id limit 1),'Operator') as opened_by_name,
    coalesce((select e.full_name from public.workspace_employees e where e.workspace_id=w and e.linked_user_id=s.closed_by limit 1),'Operator') as closed_by_name,
    coalesce((select e.full_name from public.pos_cash_events c join public.workspace_employees e on e.workspace_id=w and e.linked_user_id=c.actor_id where c.session_id=s.id order by c.created_at desc limit 1),'Operator') as latest_operator,
    case when manager or not coalesce((l.settings->>'blindClose')::boolean,false) then s.opening_minor end as opening_minor,
    case when manager or not coalesce((l.settings->>'blindClose')::boolean,false) then pos_private.expected_cash(s.id) end as expected_minor,
    s.counted_minor,s.variance_minor
   from public.pos_register_sessions s join public.pos_registers r on r.id=s.register_id join public.pos_store_locations l on l.id=s.site_id
   where s.workspace_id=w and pos_private.site_access(w,s.site_id) and (manager or s.actor_id=auth.uid() or s.status<>'CLOSED')
    and (nullif(body->>'siteId','') is null or s.site_id=(body->>'siteId')::uuid)
    and (coalesce(body->>'varianceOnly','false')<>'true' or s.variance_minor<>0)
   order by s.opened_at desc limit 200
  ) x;
  return result;
 end if;
 select * into site from public.pos_store_locations where id=(body->>'siteId')::uuid and workspace_id=w;
 if site.id is null or not pos_private.site_access(w,site.id) or not manager then raise exception 'POS_FORBIDDEN'; end if;
 if action='approvals' then
  return (select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('requestedByName',coalesce((select full_name from public.workspace_employees where workspace_id=w and linked_user_id=r.requested_by limit 1),'Operator'),'approvedBy',d.approved_by,'approvedAt',d.approved_at) order by r.created_at desc),'[]')
   from public.pos_approval_requests r left join public.pos_approval_decisions d on d.request_id=r.id where r.workspace_id=w and r.site_id=site.id);
 elsif action='session_detail' then
  if not exists(select 1 from public.pos_register_sessions where id=(body->>'sessionId')::uuid and site_id=site.id) then raise exception 'POS_FORBIDDEN'; end if;
  return jsonb_build_object('events',(select coalesce(jsonb_agg(e order by e.created_at),'[]') from public.pos_cash_events e where e.session_id=(body->>'sessionId')::uuid),
   'approvals',(select coalesce(jsonb_agg(jsonb_build_object('action',r.action,'reason',r.reason,'approvedAt',d.approved_at,'name',coalesce((select full_name from public.workspace_employees where workspace_id=w and linked_user_id=d.approved_by limit 1),'Manager'))),'[]') from public.pos_approval_requests r join public.pos_approval_decisions d on d.request_id=r.id where r.workspace_id=w and r.intent->>'sessionId'=body->>'sessionId'),
   'sales',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'number',s.receipt_number,'at',s.created_at,'actorId',s.actor_id,'totalMinor',s.total_minor)),'[]') from public.pos_sales s where s.session_id=(body->>'sessionId')::uuid),
   'refunds',(select coalesce(jsonb_agg(r),'[]') from public.pos_refunds r where r.session_id=(body->>'sessionId')::uuid));
 elsif action='daily' then
  first_day:=coalesce(nullif(body->>'date','')::date,(now() at time zone site.timezone)::date); last_day:=first_day+1;
  start_at:=first_day::timestamp at time zone site.timezone; end_at:=last_day::timestamp at time zone site.timezone;
  return jsonb_build_object('date',first_day,'timezone',site.timezone,
   'squareSalesMinor',(select coalesce(sum(t.amount_minor),0) from public.pos_tenders t join public.pos_sales s on s.id=t.sale_id where s.workspace_id=w and s.site_id=site.id and t.method='square' and s.created_at>=start_at and s.created_at<end_at),
   'squareRefundsMinor',(select coalesce(sum(r.total_minor),0) from public.pos_refunds r where r.workspace_id=w and r.site_id=site.id and r.created_at>=start_at and r.created_at<end_at and exists(select 1 from public.pos_tenders t where t.sale_id=r.sale_id and t.method='square')),
   'cashNetMinor',(select coalesce(sum(amount_minor),0) from public.pos_cash_events where workspace_id=w and site_id=site.id and kind in ('CASH_SALE','CASH_REFUND') and created_at>=start_at and created_at<end_at),
   'noncashMinor',(select coalesce(sum(t.amount_minor),0) from public.pos_tenders t join public.pos_sales s on s.id=t.sale_id where s.workspace_id=w and s.site_id=site.id and t.method<>'cash' and s.created_at>=start_at and s.created_at<end_at)-(select coalesce(sum(r.total_minor),0) from public.pos_refunds r where r.workspace_id=w and r.site_id=site.id and r.created_at>=start_at and r.created_at<end_at and exists(select 1 from public.pos_tenders t where t.sale_id=r.sale_id and t.method<>'cash')),
   'sales',(select jsonb_build_object('grossMinor',coalesce(sum(subtotal_minor),0),'discountMinor',coalesce(sum(discount_minor),0),'netMinor',coalesce(sum(subtotal_minor-discount_minor),0),'taxMinor',coalesce(sum(tax_minor),0),'totalMinor',coalesce(sum(total_minor),0),'count',count(*),'averageMinor',coalesce(round(avg(total_minor)),0)) from public.pos_sales where workspace_id=w and site_id=site.id and created_at>=start_at and created_at<end_at),
   'refunds',(select jsonb_build_object('netMinor',coalesce(sum(subtotal_minor),0),'taxMinor',coalesce(sum(tax_minor),0),'totalMinor',coalesce(sum(total_minor),0),'count',count(*)) from public.pos_refunds where workspace_id=w and site_id=site.id and created_at>=start_at and created_at<end_at),
   'byRegister',(select coalesce(jsonb_agg(x),'[]') from (select r.name,count(*) as count,sum(s.total_minor) as total_minor from public.pos_sales s join public.pos_registers r on r.id=s.register_id where s.workspace_id=w and s.site_id=site.id and s.created_at>=start_at and s.created_at<end_at group by r.id,r.name) x),
   'byEmployee',(select coalesce(jsonb_agg(x),'[]') from (
    select operators.actor_id,coalesce(max(s.receipt->>'employeeName'),(select full_name from public.workspace_employees where workspace_id=w and linked_user_id=operators.actor_id limit 1),'Operator') as name,
     count(s.id) as count,coalesce(sum(s.subtotal_minor),0) as gross_minor,coalesce(sum(s.total_minor),0) as total_minor,coalesce(sum(s.discount_minor),0) as discount_minor,coalesce(round(avg(s.total_minor)),0) as average_minor,count(distinct s.session_id) as session_count,
     (select count(*) from public.pos_refunds r where r.workspace_id=w and r.site_id=site.id and r.actor_id=operators.actor_id and r.created_at>=start_at and r.created_at<end_at) as refund_count,
     (select coalesce(sum(total_minor),0) from public.pos_refunds r where r.workspace_id=w and r.site_id=site.id and r.actor_id=operators.actor_id and r.created_at>=start_at and r.created_at<end_at) as refund_minor,
     (select count(*) from public.pos_sale_items i join public.pos_sales z on z.id=i.sale_id where z.workspace_id=w and z.site_id=site.id and z.actor_id=operators.actor_id and z.created_at>=start_at and z.created_at<end_at and coalesce((i.snapshot->>'overrideDifferenceMinor')::bigint,0)<>0) as override_count,
     (select coalesce(sum(variance_minor),0) from public.pos_register_sessions z where z.workspace_id=w and z.site_id=site.id and z.closed_by=operators.actor_id and z.closed_at>=start_at and z.closed_at<end_at) as variance_minor
    from (select actor_id from public.pos_sales where workspace_id=w and site_id=site.id and created_at>=start_at and created_at<end_at
      union select actor_id from public.pos_refunds where workspace_id=w and site_id=site.id and created_at>=start_at and created_at<end_at
      union select closed_by from public.pos_register_sessions where workspace_id=w and site_id=site.id and closed_at>=start_at and closed_at<end_at) operators
    left join public.pos_sales s on s.actor_id=operators.actor_id and s.workspace_id=w and s.site_id=site.id and s.created_at>=start_at and s.created_at<end_at group by operators.actor_id
   ) x),
   'byHour',(select coalesce(jsonb_agg(x),'[]') from (select extract(hour from created_at at time zone site.timezone)::int as hour,count(*) as count,sum(total_minor) as total_minor from public.pos_sales where workspace_id=w and site_id=site.id and created_at>=start_at and created_at<end_at group by 1 order by 1) x),
   'cash',(select coalesce(jsonb_agg(x),'[]') from (select kind,sum(amount_minor) as amount_minor,count(*) as count from public.pos_cash_events where workspace_id=w and site_id=site.id and created_at>=start_at and created_at<end_at group by kind) x),
   'sessions',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'registerId',s.register_id,'status',s.status,'expectedMinor',pos_private.expected_cash(s.id),'varianceMinor',s.variance_minor)),'[]') from public.pos_register_sessions s where s.workspace_id=w and s.site_id=site.id and s.opened_at<end_at and (s.closed_at is null or s.closed_at>=start_at)));
 end if;
 raise exception 'POS_INVALID';
end $function$
;
revoke all on function pos_private.read_operations(uuid,text,jsonb) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION pos_private.square_settings(w uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select jsonb_build_object('connections',(select coalesce(jsonb_agg(to_jsonb(c) order by c.connected_at desc),'[]') from pos_private.square_connections c where workspace_id=w),
 'locations',(select coalesce(jsonb_agg(to_jsonb(l)),'[]') from pos_private.square_locations l join pos_private.square_connections c on c.id=l.connection_id where c.workspace_id=w and c.status in ('CONNECTED','ATTENTION')),
 'mappings',(select coalesce(jsonb_agg(to_jsonb(m)),'[]') from pos_private.square_mappings m join pos_private.square_connections c on c.id=m.connection_id where c.workspace_id=w and c.status in ('CONNECTED','ATTENTION')),
 'sites',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name)),'[]') from public.pos_store_locations where workspace_id=w));
$function$
;
revoke all on function pos_private.square_settings(uuid) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION pos_private.protect_event_origin()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.related_entity_type='pos_sale' and current_user in ('authenticated','anon') then raise exception 'POS_FORBIDDEN'; end if;
  if new.related_entity_type='pos_sale' and not exists (
    select 1 from public.pos_sales s join public.pos_sale_items l on l.sale_id=s.id
    where s.id::text=new.related_entity_id and s.actor_id=(new.metadata->>'actor_id')::uuid
      and l.inventory_user_id=new.user_id and l.inventory_item_id=new.inventory_item_id
      and new.quantity_change=-l.quantity and new.quantity_after=new.quantity_before-l.quantity
      and new.idempotency_key='pos:'||s.id::text||':'||l.inventory_item_id||case when l.inventory_user_id=s.actor_id then '' else ':owner:'||l.inventory_user_id::text end||case when nullif(l.snapshot->>'positionId','') is null then '' else ':position:'||md5(l.snapshot->>'positionId') end
  ) then raise exception 'POS_FORBIDDEN'; end if;
  return new;
end $function$
;
revoke all on function pos_private.protect_event_origin() from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION pos_private.protect_refund_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if new.related_entity_type='pos_refund' then
  if current_user in ('authenticated','anon') or not exists(select 1 from public.pos_refunds r join public.pos_refund_items i on i.refund_id=r.id join public.pos_sale_items l on l.id=i.sale_item_id
   where r.id::text=new.related_entity_id and l.inventory_user_id=new.user_id and l.inventory_item_id=new.inventory_item_id and i.return_inventory
    and r.actor_id=(new.metadata->>'actor_id')::uuid and new.quantity_change=i.quantity and new.quantity_after=new.quantity_before+i.quantity and new.idempotency_key='pos-refund:'||i.id::text) then raise exception 'POS_FORBIDDEN'; end if;
 end if;
 return new;
end $function$
;
revoke all on function pos_private.protect_refund_event() from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION pos_private.site_access(w uuid, site uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(select 1 from public.pos_location_inventory_locations m where m.workspace_id=w and m.site_id=site and pos_private.can_transact(w,site,m.inventory_user_id,'sell'))
$function$
;
revoke all on function pos_private.site_access(uuid,uuid) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION pos_private.access_command(w uuid, action text, body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare target public.pos_inventory_delegations%rowtype; site uuid:=(body->>'siteId')::uuid; who uuid:=(body->>'employeeId')::uuid; caps text[];
begin
 perform pos_private.authorize(w);
 if action='access' then
   return jsonb_build_object('joinableSites',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name)),'[]') from public.pos_store_locations s where s.workspace_id=w and exists(select 1 from public.workspace_members where workspace_id=w and user_id=auth.uid() and role in ('owner','admin','manager'))),
    'grants',(select coalesce(jsonb_agg(d),'[]') from public.pos_inventory_delegations d where d.workspace_id=w and d.inventory_user_id=auth.uid()),
    'employees',(select coalesce(jsonb_agg(jsonb_build_object('id',e.linked_user_id,'name',e.full_name,'permissions',e.permissions)),'[]') from public.workspace_employees e
       where e.workspace_id=w and e.employment_status='active' and exists(select 1 from public.pos_location_inventory_locations s where s.workspace_id=w and s.inventory_user_id=auth.uid())));
 end if;
 if action='staff_permissions' then
   if not exists(select 1 from public.workspace_members where workspace_id=w and user_id=auth.uid() and role in ('owner','admin')) then raise exception 'POS_FORBIDDEN'; end if;
   if jsonb_typeof(body->'permissions')<>'object' or exists(select 1 from jsonb_each(body->'permissions') x where x.key not in ('pos.sell','pos.refund','pos.cash','pos.discount','pos.override') or jsonb_typeof(x.value)<>'boolean') then raise exception 'POS_INVALID'; end if;
   update public.workspace_employees set permissions=permissions||(body->'permissions') where workspace_id=w and linked_user_id=who;
   if not found then raise exception 'POS_FORBIDDEN'; end if;
 elsif action='join_site' then
   if not exists(select 1 from public.workspace_members where workspace_id=w and user_id=auth.uid() and role in ('owner','admin','manager'))
    or not exists(select 1 from public.pos_store_locations where id=site and workspace_id=w)
    or not exists(select 1 from public.inventory_locations where user_id=auth.uid() and id=body->>'locationId') then raise exception 'POS_FORBIDDEN'; end if;
   insert into public.pos_location_inventory_locations values(w,site,auth.uid(),body->>'locationId');
 else
   perform pg_advisory_xact_lock(hashtextextended('collector-inventory:'||auth.uid()::text,0));
   if action='revoke' then
     select * into target from public.pos_inventory_delegations where id=(body->>'id')::uuid and workspace_id=w and inventory_user_id=auth.uid() for update;
     if target.id is null then raise exception 'POS_FORBIDDEN'; end if;
     if target.revoked_at is not null then return to_jsonb(target); end if;
     update public.pos_inventory_delegations set revoked_at=now(),revoked_by=auth.uid() where id=target.id returning * into target;
   elsif action='grant' then
     if not exists(select 1 from public.pos_location_inventory_locations where workspace_id=w and site_id=site and inventory_user_id=auth.uid())
      or not exists(select 1 from public.workspace_members m join public.workspace_employees e on e.workspace_id=m.workspace_id and e.linked_user_id=m.user_id
        where m.workspace_id=w and m.user_id=who and m.role in ('employee','member','manager','admin','owner') and e.employment_status='active') then raise exception 'POS_FORBIDDEN'; end if;
     select array_agg(value) into caps from jsonb_array_elements_text(body->'capabilities');
     if caps is null then raise exception 'POS_INVALID'; end if;
     select * into target from public.pos_inventory_delegations where workspace_id=w and site_id=site and inventory_user_id=auth.uid() and employee_id=who and revoked_at is null;
     if target.id is not null then
       if target.capabilities=caps and target.valid_until is not distinct from (body->>'validUntil')::timestamptz then return to_jsonb(target); end if;
       update public.pos_inventory_delegations set revoked_at=now(),revoked_by=auth.uid() where id=target.id;
       insert into public.pos_access_events(workspace_id,actor_id,action,snapshot) values(w,auth.uid(),'scope_replaced',to_jsonb(target));
     end if;
     insert into public.pos_inventory_delegations(workspace_id,site_id,inventory_user_id,employee_id,capabilities,granted_by,valid_until,reason)
       values(w,site,auth.uid(),who,caps,auth.uid(),(body->>'validUntil')::timestamptz,coalesce(body->>'reason','')) returning * into target;
   else raise exception 'POS_INVALID'; end if;
 end if;
 insert into public.pos_access_events(workspace_id,actor_id,action,snapshot) values(w,auth.uid(),action,case when target.id is null then body else to_jsonb(target) end);
 return coalesce(to_jsonb(target),jsonb_build_object('ok',true));
end $function$
;
revoke all on function pos_private.access_command(uuid,text,jsonb) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION pos_private.approved(w uuid, site uuid, action text, body jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare approver uuid; req uuid:=(body->>'approvalId')::uuid; approved_summary jsonb; current_summary jsonb;
begin
 if req is null then raise exception 'POS_APPROVAL_REQUIRED'; end if;
 select d.approved_by into approver from public.pos_approval_requests r join public.pos_approval_decisions d on d.request_id=r.id
  join public.workspace_members m on m.workspace_id=r.workspace_id and m.user_id=d.approved_by
  join auth.users u on u.id=d.approved_by
  where r.id=req and r.workspace_id=w and r.site_id=site and r.action=approved.action and r.requested_by=auth.uid()
   and r.intent=body-array['key','approvalId'] and m.role in ('owner','admin','manager') and d.approved_by<>auth.uid()
   and (u.banned_until is null or u.banned_until<now())
   and not exists(select 1 from public.workspace_employees e where e.workspace_id=w and e.linked_user_id=d.approved_by and (e.employment_status<>'active' or coalesce(to_jsonb(e)->>'account_status','active')='suspended'));
 if approver is null then raise exception 'POS_APPROVAL_REQUIRED'; end if;
 select summary into approved_summary from public.pos_approval_requests where id=req;
 if action='checkout' then
  current_summary:=pos_private.calculate(w,site,body);
  current_summary:=current_summary||jsonb_build_object('lines',(select jsonb_agg(value-array['costBasis','inventoryValueUnit']) from jsonb_array_elements(current_summary->'lines')));
  if current_summary<>approved_summary then raise exception 'POS_APPROVAL_REQUIRED'; end if;
 elsif action in ('close','cash_event') and (approved_summary->>'expectedMinor')::bigint is distinct from pos_private.expected_cash((body->>'sessionId')::uuid) then raise exception 'POS_APPROVAL_REQUIRED';
 end if;
 insert into pos_private.approval_uses values(req,(body->>'key')::uuid);
 return approver;
end $function$
;
revoke all on function pos_private.approved(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION pos_private.operations(w uuid, action text, body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=auth.uid(); site public.pos_store_locations%rowtype; reg public.pos_registers%rowtype; sess public.pos_register_sessions%rowtype;
 amount bigint; expected bigint; counted bigint; variance bigint; result jsonb; request_id uuid; manager boolean; v_settings jsonb; record_id uuid;
begin
 perform pos_private.authorize(w);
 manager:=exists(select 1 from public.workspace_members where workspace_id=w and user_id=actor and role in ('owner','admin','manager'));
 if action in ('open','close','begin_close','resume','cash_event') then
  select * into reg from public.pos_registers where id=(body->>'registerId')::uuid and workspace_id=w for update;
  if reg.id is null or not reg.active or not pos_private.site_access(w,reg.site_id) then raise exception 'POS_FORBIDDEN'; end if;
  select * into site from public.pos_store_locations where id=reg.site_id;
  select * into sess from public.pos_register_sessions where register_id=reg.id and closed_at is null for update;
  if action='open' then
   if sess.id is not null then raise exception 'POS_REGISTER_BUSY'; end if;
   if coalesce(body->>'openingMinor','') !~ '^\d{1,12}$' then raise exception 'POS_INVALID'; end if;
   insert into public.pos_register_sessions(workspace_id,site_id,register_id,actor_id,opening_minor) values(w,reg.site_id,reg.id,actor,(body->>'openingMinor')::bigint) returning * into sess;
   insert into public.pos_cash_events(workspace_id,site_id,register_id,session_id,actor_id,kind,amount_minor,reference_id) values(w,reg.site_id,reg.id,sess.id,actor,'OPENING_FLOAT',sess.opening_minor,sess.id);
   return to_jsonb(sess);
  end if;
  if sess.id is null or sess.id is distinct from (body->>'sessionId')::uuid then raise exception 'POS_SESSION_CLOSED'; end if;
  if action='begin_close' then
   update public.pos_register_sessions set status='CLOSING',closing_started_at=now() where id=sess.id returning * into sess;
   return to_jsonb(sess)||jsonb_build_object('expectedMinor',case when manager or not coalesce((site.settings->>'blindClose')::boolean,false) then pos_private.expected_cash(sess.id) end);
  elsif action='resume' then
   if not manager or sess.status<>'CLOSING' then raise exception 'POS_FORBIDDEN'; end if;
   update public.pos_register_sessions set status='OPEN',closing_started_at=null where id=sess.id returning * into sess;
   return to_jsonb(sess);
  elsif action='close' then
   if coalesce(body->>'countedMinor','') !~ '^\d{1,12}$' then raise exception 'POS_INVALID'; end if;
   expected:=pos_private.expected_cash(sess.id); counted:=(body->>'countedMinor')::bigint; variance:=counted-expected;
   if abs(variance)>coalesce((site.settings->>'noteThresholdMinor')::bigint,0) and length(trim(coalesce(body->>'reason',''))) not between 1 and 500 then raise exception 'POS_REASON_REQUIRED'; end if;
   if not manager and abs(variance)>coalesce((site.settings->>'approvalThresholdMinor')::bigint,2000) then perform pos_private.approved(w,site.id,action,body); end if;
   update public.pos_register_sessions set status='CLOSED',closed_at=now(),closed_by=actor,expected_minor=expected,counted_minor=counted,variance_minor=variance,close_notes=coalesce(body->>'reason','') where id=sess.id returning * into sess;
   insert into public.pos_cash_events(workspace_id,site_id,register_id,session_id,actor_id,kind,amount_minor,reference_id,reason) values(w,site.id,reg.id,sess.id,actor,'REGISTER_CLOSE',0,sess.id,sess.close_notes);
   return to_jsonb(sess);
  else
   if sess.status<>'OPEN' then raise exception 'POS_SESSION_CLOSED'; end if;
   if not pos_private.permission(w,'cash') then raise exception 'POS_FORBIDDEN'; end if;
   if body->>'kind' not in ('PAID_IN','PAID_OUT','CASH_DROP','CASH_ADJUSTMENT') or coalesce(body->>'amountMinor','') !~ '^-?\d{1,12}$'
    or length(trim(coalesce(body->>'reason',''))) not between 1 and 500 or body->>'reasonType' not in ('CHANGE_FLOAT','PETTY_CASH','COURIER','SAFE','CORRECTION','OTHER') then raise exception 'POS_INVALID'; end if;
   amount:=(body->>'amountMinor')::bigint;
   if amount=0 or (body->>'kind'<>'CASH_ADJUSTMENT' and amount<0) then raise exception 'POS_INVALID'; end if;
   if body->>'kind'='CASH_ADJUSTMENT' and not manager then perform pos_private.approved(w,site.id,action,body); end if;
   if body->>'kind' in ('PAID_OUT','CASH_DROP') then amount:=-amount; end if;
   insert into public.pos_cash_events(workspace_id,site_id,register_id,session_id,actor_id,kind,amount_minor,reason_type,reason) values(w,site.id,reg.id,sess.id,actor,body->>'kind',amount,body->>'reasonType',body->>'reason') returning id into record_id;
   return jsonb_build_object('id',record_id,'expectedMinor',pos_private.expected_cash(sess.id));
  end if;
 end if;
 select * into site from public.pos_store_locations where id=(body->>'siteId')::uuid and workspace_id=w;
 if site.id is null or not pos_private.site_access(w,site.id) then raise exception 'POS_FORBIDDEN'; end if;
 if action='configure_register' then
  if not manager then raise exception 'POS_FORBIDDEN'; end if;
  if length(trim(coalesce(body->>'name',''))) not between 1 and 100 then raise exception 'POS_INVALID'; end if;
  if nullif(body->>'id','') is null then
   insert into public.pos_registers(workspace_id,site_id,name,description) values(w,site.id,body->>'name',left(coalesce(body->>'description',''),500)) returning * into reg;
  else
   select * into reg from public.pos_registers where id=(body->>'id')::uuid and workspace_id=w and site_id=site.id for update;
   if reg.id is null then raise exception 'POS_FORBIDDEN'; end if;
   if coalesce((body->>'active')::boolean,true)=false and exists(select 1 from public.pos_register_sessions where register_id=reg.id and closed_at is null) then raise exception 'POS_REGISTER_BUSY'; end if;
   update public.pos_registers set name=body->>'name',active=coalesce((body->>'active')::boolean,true),description=left(coalesce(body->>'description',''),500),updated_at=now() where id=reg.id returning * into reg;
  end if;
  return to_jsonb(reg);
 elsif action='settings' then
  if not exists(select 1 from public.workspace_members where workspace_id=w and user_id=actor and role in ('owner','admin')) then raise exception 'POS_FORBIDDEN'; end if;
  v_settings:=body->'settings';
  if jsonb_typeof(v_settings)<>'object' or coalesce(v_settings->>'noteThresholdMinor','') !~ '^\d{1,10}$' or coalesce(v_settings->>'approvalThresholdMinor','') !~ '^\d{1,10}$'
   or v_settings->>'receiptWidth' not in ('58','80','Letter') or not exists(select 1 from pg_timezone_names where name=body->>'timezone') then raise exception 'POS_INVALID'; end if;
  update public.pos_store_locations set timezone=body->>'timezone',settings=v_settings where id=site.id;
  return jsonb_build_object('ok',true);
 elsif action='request_approval' then
  if body->>'operation' not in ('checkout','refund','close','cash_event') or jsonb_typeof(body->'intent')<>'object' then raise exception 'POS_INVALID'; end if;
  result:='{}';
  if body->>'operation'='checkout' then
   result:=pos_private.calculate(w,site.id,body->'intent');
   result:=result||jsonb_build_object('lines',(select jsonb_agg(value-array['costBasis','inventoryValueUnit']) from jsonb_array_elements(result->'lines')));
  elsif body->>'operation' in ('close','cash_event') then
   select * into sess from public.pos_register_sessions where id=(body->'intent'->>'sessionId')::uuid and workspace_id=w and site_id=site.id;
   if sess.id is null then raise exception 'POS_FORBIDDEN'; end if;
   result:=jsonb_build_object('expectedMinor',pos_private.expected_cash(sess.id),'registerName',(select name from public.pos_registers where id=sess.register_id));
  end if;
  insert into public.pos_approval_requests(workspace_id,site_id,requested_by,action,intent,summary,reason) values(w,site.id,actor,body->>'operation',(body->'intent')-array['key','approvalId'],result,body->>'reason') returning id into request_id;
  return jsonb_build_object('id',request_id);
 elsif action='approve' then
  if not manager then raise exception 'POS_FORBIDDEN'; end if;
  perform 1 from public.pos_approval_requests where id=(body->>'id')::uuid and workspace_id=w and site_id=site.id and requested_by<>actor for update;
  if not found then raise exception 'POS_FORBIDDEN'; end if;
  insert into public.pos_approval_decisions values((body->>'id')::uuid,actor,now());
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'POS_INVALID';
end $function$
;
revoke all on function pos_private.operations(uuid,text,jsonb) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION pos_private.delegation_history()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if tg_op='DELETE' or old.revoked_at is not null or new.revoked_at is null or new.revoked_by is distinct from old.inventory_user_id
  or (to_jsonb(old)-array['revoked_at','revoked_by'])<>(to_jsonb(new)-array['revoked_at','revoked_by']) then raise exception 'POS_IMMUTABLE'; end if;
 return new;
end $function$
;
revoke all on function pos_private.delegation_history() from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION pos_private.can_transact(w uuid, site uuid, stock_owner uuid, operation text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select pos_private.permission(w,case when operation='return' then 'refund' else 'sell' end)
 and pos_private.inventory_entitled(stock_owner)
 and exists(select 1 from public.pos_store_locations s where s.id=site and s.workspace_id=w)
 and exists(select 1 from public.pos_location_inventory_locations m where m.workspace_id=w and m.site_id=site and m.inventory_user_id=stock_owner)
 and (stock_owner=auth.uid() or exists(select 1 from public.pos_inventory_delegations d
   join public.workspace_employees e on e.workspace_id=d.workspace_id and e.linked_user_id=d.employee_id
   where d.workspace_id=w and d.site_id=site and d.inventory_user_id=stock_owner and d.employee_id=auth.uid()
     and d.revoked_at is null and (d.valid_until is null or d.valid_until>statement_timestamp())
     and operation=any(d.capabilities) and e.employment_status='active'
     and coalesce(to_jsonb(e)->>'account_status','active')<>'suspended'
     and pos_private.inventory_entitled(stock_owner)))
$function$
;
revoke all on function pos_private.can_transact(uuid,uuid,uuid,text) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION pos_private.payment_close_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if new.status<>old.status and new.status in ('CLOSING','CLOSED') and (exists(select 1 from public.pos_payment_checkouts c where c.session_id=old.id and c.state in ('PAYING','FINALIZING','RECOVERY_REQUIRED')) or exists(select 1 from public.pos_payment_refund_attempts r where r.intent->>'sessionId'=old.id::text and (r.status in ('CREATED','PENDING','UNKNOWN') or r.recovery_required))) then raise exception 'POS_PAYMENT_ACTIVE'; end if;
 return new;
end $function$
;
revoke all on function pos_private.payment_close_guard() from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION pos_private.payment_validate_stock(w uuid, site uuid, quote jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare grouped record; inv public.inventory_items%rowtype; line jsonb; reserved bigint; available bigint;
begin
 for grouped in select (value->>'ownerId')::uuid as owner_id,value->>'itemId' as item_id,sum((value->>'quantity')::integer) as quantity from jsonb_array_elements(quote->'lines') group by 1,2 order by 1,2 loop
  perform pos_private.lock_authority(w,site,grouped.owner_id,'sell');
  select * into inv from public.inventory_items where user_id=grouped.owner_id and id=grouped.item_id and workspace_id=w for update;
  select coalesce(sum(quantity),0) into reserved from public.selling_inventory_allocations where user_id=grouped.owner_id and inventory_item_id=grouped.item_id and status in ('ALLOCATED','RESERVED');
  if inv.id is null or inv.quantity-reserved<grouped.quantity then raise exception 'POS_STOCK_UNAVAILABLE'; end if;
 end loop;
 if (select count(distinct (value->>'ownerId',value->>'itemId',coalesce(value->>'positionId',''))) from jsonb_array_elements(quote->'lines'))<>jsonb_array_length(quote->'lines') then raise exception 'POS_INVALID'; end if;
 for line in select value from jsonb_array_elements(quote->'lines') where nullif(value->>'positionId','') is not null loop
  select p.quantity-coalesce((select sum(a.quantity) from public.selling_inventory_allocations a where a.user_id=p.user_id and a.inventory_item_id=p.item_id and (a.inventory_position_id is null or a.inventory_position_id=p.id) and a.status in ('ALLOCATED','RESERVED')),0) into available
  from public.chaos_sort_inventory_positions p where p.user_id=(line->>'ownerId')::uuid and p.item_id=line->>'itemId' and p.id=line->>'positionId' and p.location_id=line->>'locationId' and p.status<>'retired' for update;
  if available is null or available<(line->>'quantity')::integer then raise exception 'POS_STOCK_UNAVAILABLE'; end if;
 end loop;
end $function$
;
revoke all on function pos_private.payment_validate_stock(uuid,uuid,jsonb) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION pos_private.check_stock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_owner uuid; v_item text; stock integer; positions bigint; reserved bigint;
begin
  if tg_table_name='inventory_items' then
    v_owner := coalesce(new.user_id,old.user_id); v_item := coalesce(new.id,old.id);
    if tg_op='UPDATE' and (new.user_id,new.id) is distinct from (old.user_id,old.id) then raise exception 'POS_STOCK_IDENTITY_IMMUTABLE'; end if;
  elsif tg_table_name='chaos_sort_inventory_positions' then
    v_owner := coalesce(new.user_id,old.user_id); v_item := coalesce(new.item_id,old.item_id);
    if tg_op='UPDATE' and (new.user_id,new.item_id) is distinct from (old.user_id,old.item_id) then raise exception 'POS_STOCK_IDENTITY_IMMUTABLE'; end if;
  else
    v_owner := coalesce(new.user_id,old.user_id); v_item := coalesce(new.inventory_item_id,old.inventory_item_id);
    if tg_op='UPDATE' and (new.user_id,new.inventory_item_id,new.inventory_position_id) is distinct from (old.user_id,old.inventory_item_id,old.inventory_position_id) then raise exception 'POS_STOCK_IDENTITY_IMMUTABLE'; end if;
  end if;
  select quantity into stock from public.inventory_items where user_id=v_owner and id=v_item for update;
  select coalesce(sum(quantity),0) into positions from public.chaos_sort_inventory_positions where user_id=v_owner and item_id=v_item;
  select coalesce(sum(quantity),0) into reserved from public.selling_inventory_allocations where user_id=v_owner and inventory_item_id=v_item and status in ('ALLOCATED','RESERVED');
  if positions > coalesce(stock,0) or reserved > coalesce(stock,0) then raise exception 'POS_STOCK_UNAVAILABLE'; end if;
  if exists (
    select 1 from public.selling_inventory_allocations a
    left join public.chaos_sort_inventory_positions p on p.user_id=a.user_id and p.id=a.inventory_position_id and p.item_id=a.inventory_item_id
    where a.user_id=v_owner and a.inventory_item_id=v_item and a.inventory_position_id is not null and a.status in ('ALLOCATED','RESERVED')
    group by a.inventory_position_id,p.quantity having sum(a.quantity)>coalesce(p.quantity,0)
  ) then raise exception 'POS_STOCK_UNAVAILABLE'; end if;
  return null;
end $function$
;
revoke all on function pos_private.check_stock() from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION pos_private.payment_refund_command(w uuid, action text, body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
declare p public.pos_payment_attempts%rowtype;c public.pos_payment_checkouts%rowtype;r public.pos_payment_refund_attempts%rowtype;amount bigint;quote jsonb;result jsonb;outcome text;observed text;total bigint;intent jsonb;
begin
 perform pos_private.authorize(w,false,false);
 if not pos_private.permission(w,'refund') then raise exception 'POS_FORBIDDEN'; end if;
 if jsonb_typeof(body)<>'object' or octet_length(body::text)>262144 then raise exception 'POS_INVALID'; end if;
 if action='create' then
  if body->>'key' is null then raise exception 'POS_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended('payment-refund:'||w::text||auth.uid()::text||(body->>'key'),0));
  select * into r from public.pos_payment_refund_attempts where workspace_id=w and actor_id=auth.uid() and idempotency_key=(body->>'key')::uuid;
  if r.id is not null then
   if r.intent<>body->'intent' or r.payment_id<>(body->>'paymentId')::uuid then raise exception 'POS_IDEMPOTENCY_CONFLICT'; end if;
   return to_jsonb(r);
  end if;
  select * into p from public.pos_payment_attempts where id=(body->>'paymentId')::uuid and workspace_id=w;
 else
  select * into r from public.pos_payment_refund_attempts where id=(body->>'id')::uuid and workspace_id=w;
  select * into p from public.pos_payment_attempts where id=r.payment_id and workspace_id=w;
 end if;
 if p.id is null then raise exception 'POS_FORBIDDEN'; end if;
 perform pos_private.payment_authorize(w,p.checkout_id);
 select * into c from public.pos_payment_checkouts where id=p.checkout_id;
 -- Processing session first, then checkout/payment, then original sale/stock.
 intent:=case when action='create' then body->'intent' else r.intent end;
 if c.sale_id is not null then perform 1 from public.pos_register_sessions where workspace_id=w and id=(intent->>'sessionId')::uuid for update; end if;
 perform 1 from public.pos_register_sessions where id=c.session_id for update;
 select * into c from public.pos_payment_checkouts where id=c.id for update;
 select * into p from public.pos_payment_attempts where id=p.id for update;
 if action='create' then
  if p.status not in ('SUCCEEDED','PARTIALLY_REFUNDED') then raise exception 'POS_PAYMENT_UNCERTAIN'; end if;
  if exists(select 1 from public.pos_payment_refund_attempts where payment_id=p.id and (status in ('CREATED','PENDING','UNKNOWN') or recovery_required)) then raise exception 'POS_PAYMENT_ACTIVE'; end if;
  if c.sale_id is null then
   perform pos_private.payment_authorize(w,c.id,true);
   if c.state not in ('RECOVERY_REQUIRED','FINALIZING') or length(trim(coalesce(intent->>'reason',''))) not between 1 and 500 then raise exception 'POS_INVALID'; end if;
   amount:=p.amount_minor;
  else
   if intent->>'saleId' is distinct from c.sale_id::text then raise exception 'POS_FORBIDDEN'; end if;
   quote:=pos_private.payment_refund_quote(w,intent);amount:=(quote->>'totalMinor')::bigint;
  end if;
  select coalesce(sum(amount_minor),0) into total from public.pos_payment_refund_attempts where payment_id=p.id and status<>'FAILED';
  if amount<1 or amount+total>p.amount_minor then raise exception 'POS_REFUND_EXCEEDED'; end if;
  if coalesce(intent->>'mockOutcome','REFUND_SUCCESS') not in ('REFUND_SUCCESS','REFUND_FAIL','REFUND_UNKNOWN_THEN_SUCCESS') then raise exception 'POS_INVALID'; end if;
  insert into public.pos_payment_refund_attempts(workspace_id,payment_id,actor_id,idempotency_key,intent,amount_minor) values(w,p.id,auth.uid(),(body->>'key')::uuid,intent,amount) returning * into r;
  perform pos_private.payment_audit(p.id,'refund_requested',p.status,p.status);
  return to_jsonb(r);
 end if;
 select * into r from public.pos_payment_refund_attempts where id=r.id for update;
 if action='get' then return to_jsonb(r); end if;
 if action in ('dispatch','reconcile') then
  if p.provider='SQUARE' then
   select status into observed from pos_private.square_refund_observations where refund_id=r.id;
   if observed is null then return to_jsonb(r);end if;
  elsif p.provider='MOCK' then
   if not (select enabled from pos_private.payment_test_config) then raise exception 'POS_MOCK_DISABLED'; end if;
   outcome:=coalesce(r.intent->>'mockOutcome','REFUND_SUCCESS');
   insert into pos_private.mock_refunds values(r.id,outcome,case outcome when 'REFUND_FAIL' then 'FAILED' when 'REFUND_UNKNOWN_THEN_SUCCESS' then 'UNKNOWN' else 'SUCCEEDED' end,'mock_refund_'||r.id::text) on conflict do nothing;
   if action='reconcile' then update pos_private.mock_refunds set status='SUCCEEDED' where refund_id=r.id and status='UNKNOWN'; end if;
   select status into observed from pos_private.mock_refunds where refund_id=r.id;
  else observed:='SUCCEEDED'; end if;
  if r.status not in ('SUCCEEDED','FAILED') then
   update public.pos_payment_refund_attempts set status=observed,provider_refund_id=case when p.provider='SQUARE' then (select provider_id from pos_private.square_refund_observations where refund_id=r.id) when p.provider='MOCK' then 'mock_refund_'||r.id::text else 'external_refund_'||r.id::text end,recovery_required=observed='SUCCEEDED',updated_at=now() where id=r.id returning * into r;
   perform pos_private.payment_audit(p.id,'refund_provider_'||lower(observed),p.status,p.status);
  end if;
  return to_jsonb(r);
 elsif action='finalize' then
  if r.status<>'SUCCEEDED' then return to_jsonb(r); end if;
  if r.refund_id is not null or not r.recovery_required then return to_jsonb(r); end if;
  if r.actor_id<>auth.uid() then raise exception 'POS_FORBIDDEN'; end if;
  begin
   if c.sale_id is null then
    update public.pos_payment_checkouts set state='VOIDED',failure_code=null,updated_at=now() where id=c.id;
   else
    insert into pos_private.payment_context values(txid_current(),pg_backend_pid(),auth.uid(),p.id,r.id);
    result:=pos_private.refund(w,r.intent);
    delete from pos_private.payment_context where transaction_id=txid_current() and backend=pg_backend_pid();
    update public.pos_payment_refund_attempts set refund_id=(result->>'id')::uuid where id=r.id;
   end if;
   update public.pos_payment_refund_attempts set recovery_required=false,failure_code=null,updated_at=now() where id=r.id;
   select coalesce(sum(amount_minor),0) into total from public.pos_payment_refund_attempts where payment_id=p.id and status='SUCCEEDED';
   update public.pos_payment_attempts set status=case when total=p.amount_minor then 'REFUNDED' else 'PARTIALLY_REFUNDED' end,updated_at=now() where id=p.id;
   perform pos_private.payment_audit(p.id,'refund_completed',p.status,case when total=p.amount_minor then 'REFUNDED' else 'PARTIALLY_REFUNDED' end);
  exception when others then
   update public.pos_payment_refund_attempts set recovery_required=true,failure_code=case when sqlerrm like 'POS_%' then split_part(sqlerrm,E'\n',1) else 'POS_FINALIZATION_FAILED' end,updated_at=now() where id=r.id;
  end;
  select * into r from public.pos_payment_refund_attempts where id=r.id;
  return to_jsonb(r);
 end if;
 raise exception 'POS_INVALID';
end $function$
;
revoke all on function pos_private.payment_refund_command(uuid,text,jsonb) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION pos_private.terminal_attempt_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.pos_payment_checkouts%rowtype;d public.pos_payment_devices%rowtype;
begin
 if new.provider<>'SQUARE' or new.request->>'method' is distinct from 'square_terminal' then return new;end if;
 select * into c from public.pos_payment_checkouts where id=new.checkout_id;
 select * into d from public.pos_payment_devices where workspace_id=new.workspace_id and site_id=c.site_id and assigned_register_id=c.register_id and disabled_at is null for update;
 if d.id is null or d.pairing_status<>'PAIRED' or d.status not in ('PAIRED','AVAILABLE','BUSY') or d.provider_device_id is null or d.connection_id::text<>new.provider_account_id or d.provider_location_id is distinct from new.metadata->>'locationId' then raise exception 'POS_TERMINAL_UNAVAILABLE';end if;
 if not exists(select 1 from pos_private.square_connections where id=d.connection_id and pos_private.terminal_scoped(authorized_scopes)) then raise exception 'POS_TERMINAL_SCOPE';end if;
 if pos_private.terminal_busy(d.id) then raise exception 'POS_TERMINAL_BUSY';end if;
 new.metadata:=new.metadata||jsonb_build_object('method','TERMINAL','terminalName',d.display_name,'deviceId',d.id);
 return new;
end $function$
;
revoke all on function pos_private.terminal_attempt_guard() from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION pos_private.terminal_attempt_context()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if new.provider='SQUARE' and new.request->>'method'='square_terminal' then
  insert into pos_private.square_terminal_attempts(payment_id,device_id,provider_device_id,location_id)
   select new.id,id,provider_device_id,provider_location_id from public.pos_payment_devices where id=(new.metadata->>'deviceId')::uuid;
 end if;return new;
end $function$
;
revoke all on function pos_private.terminal_attempt_context() from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION pos_private.terminal_service(action text, body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
declare w uuid:=(body->>'workspaceId')::uuid;actor uuid:=(body->>'actorId')::uuid;d public.pos_payment_devices%rowtype;
 c pos_private.square_connections%rowtype;t pos_private.square_terminal_attempts%rowtype;p public.pos_payment_attempts%rowtype;
 loc text;result jsonb;old_status text;
begin
 if action in ('terminal_pair','terminal_check') then
  perform pos_private.square_admin(w,actor);
  if action='terminal_pair' then
   perform pg_advisory_xact_lock(hashtextextended('terminal-pair:'||(body->>'id'),0));
   select * into d from public.pos_payment_devices where id=(body->>'id')::uuid;
   if d.id is not null then
    if d.workspace_id<>w or d.site_id<>(body->>'siteId')::uuid or d.created_by<>actor or d.display_name<>trim(body->>'name') then raise exception 'POS_FORBIDDEN';end if;
   else
    select a.* into c from pos_private.square_connections a where a.workspace_id=w and a.status='CONNECTED';
    select m.location_id into loc from pos_private.square_mappings m join pos_private.square_locations l on l.connection_id=m.connection_id and l.id=m.location_id where m.connection_id=c.id and m.site_id=(body->>'siteId')::uuid and l.status='ACTIVE';
    if loc is null then raise exception 'POS_TERMINAL_UNAVAILABLE';end if;
    if not pos_private.terminal_scoped(c.authorized_scopes) then raise exception 'SQUARE_TERMINAL_SCOPE';end if;
    insert into public.pos_payment_devices(id,workspace_id,site_id,connection_id,provider_location_id,display_name,created_by) values((body->>'id')::uuid,w,(body->>'siteId')::uuid,c.id,loc,trim(body->>'name'),actor) returning * into d;
    insert into pos_private.square_hardware_audit(workspace_id,device_id,actor_id,action) values(w,d.id,actor,'pairing_created');
   end if;
  else select * into d from public.pos_payment_devices where id=(body->>'id')::uuid and workspace_id=w;end if;
  if d.id is null then raise exception 'POS_FORBIDDEN';end if;
  result:=public.pos_square_service('credential',jsonb_build_object('workspaceId',w,'connectionId',d.connection_id));
  if not pos_private.terminal_scoped(array(select jsonb_array_elements_text(result->'connection'->'authorized_scopes'))) then raise exception 'SQUARE_TERMINAL_SCOPE';end if;
  return result||jsonb_build_object('device',to_jsonb(d));
 elsif action='terminal_code' then
  select * into d from public.pos_payment_devices where id=(body->>'id')::uuid and workspace_id=w for update;
  if d.id is null or d.provider_location_id is distinct from body->>'locationId' or (d.provider_device_code_id is not null and d.provider_device_code_id is distinct from body->>'codeId') then raise exception 'POS_INVALID';end if;
  old_status:=d.pairing_status;
  if body->>'status'='PAIRED' and nullif(body->>'deviceId','') is null then raise exception 'POS_INVALID';end if;
  if d.provider_device_id is not null and d.provider_device_id is distinct from body->>'deviceId' then raise exception 'POS_INVALID';end if;
  update public.pos_payment_devices set provider_device_code_id=body->>'codeId',provider_device_id=coalesce(provider_device_id,body->>'deviceId'),pair_by=(body->>'pairBy')::timestamptz,
   pairing_status=case when pairing_status='PAIRED' then 'PAIRED' when body->>'status'='PAIRED' then 'PAIRED' when body->>'status'='EXPIRED' or (body->>'pairBy')::timestamptz<now() then 'EXPIRED' else 'PAIRING' end,
   status=case when disabled_at is not null then 'DISABLED' when body->>'status'='PAIRED' and pairing_status<>'PAIRED' then 'PAIRED' else status end,
   paired_at=case when body->>'status'='PAIRED' then coalesce(paired_at,(body->>'pairedAt')::timestamptz,now()) else paired_at end,updated_at=now() where id=d.id;
  if body->>'code' is not null then insert into pos_private.square_device_codes values(d.id,body->>'code') on conflict(device_id) do update set code=excluded.code;end if;
  if old_status<>'PAIRED' and body->>'status'='PAIRED' then insert into pos_private.square_hardware_audit(workspace_id,device_id,action) values(w,d.id,'paired');end if;
  return '{}';
 elsif action='terminal_health' then
  update public.pos_payment_devices set status=case when disabled_at is not null then 'DISABLED' else body->>'status' end,last_seen_at=case when body->>'status'='AVAILABLE' then now() else last_seen_at end,updated_at=now() where id=(body->>'id')::uuid and workspace_id=w and provider_device_id=body->>'deviceId';return '{}';
 elsif action='terminal_code_view' then
  perform pos_private.square_admin(w,actor);
  return coalesce((select jsonb_build_object('id',dv.id,'code',v.code,'pairBy',dv.pair_by) from public.pos_payment_devices dv join pos_private.square_device_codes v on v.device_id=dv.id where dv.id=(body->>'id')::uuid and dv.workspace_id=w and dv.pairing_status='PAIRING' and dv.pair_by>now() and dv.disabled_at is null),'{}');
 elsif action='terminal_context' then
  select * into p from public.pos_payment_attempts where id=(body->>'id')::uuid and workspace_id=w and provider='SQUARE';
  select * into t from pos_private.square_terminal_attempts where payment_id=p.id;
  if t.payment_id is null then raise exception 'POS_FORBIDDEN';end if;
  return jsonb_build_object('terminal',to_jsonb(t));
 elsif action='terminal_observe' then
  select * into p from public.pos_payment_attempts where id=(body->>'id')::uuid and workspace_id=w and provider='SQUARE';
  select * into t from pos_private.square_terminal_attempts where payment_id=p.id for update;
  if t.payment_id is null or t.provider_device_id is distinct from body->>'deviceId' or t.location_id is distinct from body->>'locationId' or (t.checkout_id is not null and t.checkout_id is distinct from body->>'checkoutId') then raise exception 'POS_INVALID';end if;
  if t.checkout_id is null or (t.checkout_status is distinct from 'CANCELED' and body->>'status'='CANCELED') then
   insert into pos_private.square_hardware_audit(workspace_id,device_id,actor_id,action) values(w,t.device_id,p.actor_id,case when body->>'status'='CANCELED' then 'checkout_canceled' else 'checkout_sent' end);
  end if;
  update pos_private.square_terminal_attempts set checkout_id=body->>'checkoutId',checkout_status=body->>'status',updated_at=now() where payment_id=p.id and coalesce(checkout_status,'') not in ('COMPLETED','CANCELED');return '{}';
 elsif action in ('terminal_refund_get','terminal_refund_save') then
  if not exists(select 1 from public.pos_payment_refund_attempts where id=(body->>'id')::uuid and workspace_id=w and payment_id=(body->>'paymentId')::uuid) then raise exception 'POS_FORBIDDEN';end if;
  if action='terminal_refund_save' then
   insert into pos_private.square_terminal_refunds values((body->>'id')::uuid,body->>'checkoutId') on conflict(refund_id) do nothing;
   if not exists(select 1 from pos_private.square_terminal_refunds where refund_id=(body->>'id')::uuid and checkout_id=body->>'checkoutId') then raise exception 'POS_INVALID';end if;
  end if;
  return coalesce((select to_jsonb(r) from pos_private.square_terminal_refunds r where refund_id=(body->>'id')::uuid),'{}');
 elsif action='terminal_event' then
  if body->>'type'='device.code.paired' then
   select d1.* into d from public.pos_payment_devices d1 join pos_private.square_connections c1 on c1.id=d1.connection_id where c1.merchant_id=body->>'merchantId' and d1.provider_device_code_id=body->>'resourceId';
   if d.id is null then raise exception 'UNKNOWN_STATUS';end if;
   return jsonb_build_object('device',to_jsonb(d));
  end if;
  select a.* into p from public.pos_payment_attempts a join pos_private.square_connections c1 on c1.id=a.provider_account_id::uuid join pos_private.square_terminal_attempts t1 on t1.payment_id=a.id where c1.merchant_id=body->>'merchantId' and (t1.checkout_id=body->>'resourceId' or a.id::text=body->>'referenceId');
  if p.id is null then raise exception 'UNKNOWN_STATUS';end if;
  return jsonb_build_object('payment',to_jsonb(p));
 end if;raise exception 'POS_INVALID';
end $function$
;
revoke all on function pos_private.terminal_service(text,jsonb) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION pos_private.payment_command(w uuid, action text, body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
declare p public.pos_payment_attempts%rowtype;c public.pos_payment_checkouts%rowtype;sess public.pos_register_sessions%rowtype;
 quote jsonb; intent jsonb; result jsonb; original_status text; observed text; outcome text; key_id uuid; event_key text; n integer; sq_id uuid;sq_location text;
begin
 if body is null or jsonb_typeof(body)<>'object' or octet_length(body::text)>262144 then raise exception 'POS_INVALID'; end if;
 perform pos_private.authorize(w,false,false);
 if action='capabilities' then return jsonb_build_object('mockEnabled',coalesce((select enabled from pos_private.payment_test_config),false),'terminals',pos_private.terminal_devices(w),'squareSites',(select coalesce(jsonb_agg(m.site_id),'[]') from pos_private.square_mappings m join pos_private.square_connections sqc on sqc.id=m.connection_id join pos_private.square_locations l on l.connection_id=m.connection_id and l.id=m.location_id where sqc.workspace_id=w and sqc.status='CONNECTED' and l.status='ACTIVE' and pos_private.site_access(w,m.site_id)));  end if;
 if action='list' then
 return (select coalesce(jsonb_agg(pos_private.payment_view(x.id)),'[]') from (select a.id from public.pos_payment_attempts a join public.pos_payment_checkouts ch on ch.id=a.checkout_id where a.workspace_id=w and (a.actor_id=auth.uid() or (pos_private.site_access(w,ch.site_id) and exists(select 1 from public.workspace_members where workspace_id=w and user_id=auth.uid() and role in ('owner','admin','manager')))) and (nullif(body->>'saleId','') is null or ch.sale_id=(body->>'saleId')::uuid) and (nullif(body->>'provider','') is null or a.provider=body->>'provider') and (nullif(body->>'status','') is null or a.status=body->>'status') order by a.created_at desc,a.id desc limit 100) x);
 end if;
 if action='create' then
  perform pos_private.authorize(w);
  key_id:=(body->>'key')::uuid;
  if key_id is null or body->>'provider' not in ('MOCK','EXTERNAL','SQUARE') then raise exception 'POS_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended('payment:'||w::text||auth.uid()::text||key_id::text,0));
  select * into p from public.pos_payment_attempts where workspace_id=w and actor_id=auth.uid() and idempotency_key=key_id;
  if p.id is not null then
   if p.request<>body-'key' then raise exception 'POS_IDEMPOTENCY_CONFLICT'; end if;
   return pos_private.payment_view(p.id);
  end if;
  if body->>'provider'='MOCK' and not (select enabled from pos_private.payment_test_config) then raise exception 'POS_MOCK_DISABLED'; end if;
  if body->>'provider'='MOCK' and coalesce(body->>'outcome','') not in ('APPROVE','DECLINE','CANCEL','TIMEOUT','DELAYED_SUCCESS','UNKNOWN_THEN_SUCCESS','UNKNOWN_THEN_DECLINE') then raise exception 'POS_INVALID'; end if;
  if body->>'provider'='EXTERNAL' and (length(trim(coalesce(body->>'reference',''))) not between 1 and 100 or coalesce(body->>'method','') not in ('external_terminal','check','other')) then raise exception 'POS_INVALID'; end if;
  intent:=body->'intent';
  select * into sess from public.pos_register_sessions where id=(intent->>'sessionId')::uuid and workspace_id=w and site_id=(intent->>'siteId')::uuid for update;
  if sess.id is null or sess.status<>'OPEN' then raise exception 'POS_SESSION_CLOSED'; end if;
  select * into c from public.pos_payment_checkouts where id=coalesce((body->>'checkoutId')::uuid,(intent->>'key')::uuid) and workspace_id=w for update;
  if c.id is not null then
   if c.actor_id<>auth.uid() or c.intent<>intent then raise exception 'POS_IDEMPOTENCY_CONFLICT'; end if;
   if c.state<>'PAYABLE' then raise exception 'POS_PAYMENT_ACTIVE'; end if;
  end if;
  quote:=pos_private.calculate(w,sess.site_id,intent);
  perform pos_private.payment_validate_stock(w,sess.site_id,quote);
  quote:=pos_private.calculate(w,sess.site_id,intent);
  if (quote->>'totalMinor')::bigint<1 or (intent->>'expectedMinor')::bigint is distinct from (quote->>'totalMinor')::bigint then raise exception 'POS_QUOTE_CHANGED'; end if;
  if ((quote->>'discountMinor')::bigint>0 and not pos_private.permission(w,'discount')) or (exists(select 1 from jsonb_array_elements(quote->'lines') where (value->>'overrideDifferenceMinor')::bigint<>0) and not pos_private.permission(w,'override')) then
   perform pos_private.approved(w,sess.site_id,'checkout',intent);
  end if;
  if c.id is null then
   insert into public.pos_payment_checkouts(id,workspace_id,site_id,register_id,session_id,actor_id,intent,snapshot,amount_minor)
    values((intent->>'key')::uuid,w,sess.site_id,sess.register_id,sess.id,auth.uid(),intent,quote,(quote->>'totalMinor')::bigint) returning * into c;
  elsif c.snapshot<>quote then raise exception 'POS_QUOTE_CHANGED'; end if;
  if body->>'provider'='SQUARE' then
   if (body-array['key','provider','intent','checkoutId','outcome','reference','method'])<>'{}'::jsonb
    or (intent-array['key','siteId','sessionId','expectedMinor','cashMinor','discountReason','cartDiscountMinor','cartDiscountBps','approvalId','lines'])<>'{}'::jsonb
    or exists(select 1 from jsonb_array_elements(intent->'lines') x where (x-array['itemId','ownerId','quantity','discountMinor','discountBps','overrideMinor','positionId','locationId'])<>'{}'::jsonb)
    then raise exception 'POS_INVALID';end if;
   select a.id,m.location_id into sq_id,sq_location from pos_private.square_connections a join pos_private.square_mappings m on m.connection_id=a.id join pos_private.square_locations l on l.connection_id=m.connection_id and l.id=m.location_id
    where a.workspace_id=w and a.status='CONNECTED' and a.environment='SANDBOX' and m.site_id=sess.site_id and l.status='ACTIVE';
   if sq_id is null then raise exception 'POS_SQUARE_UNAVAILABLE';end if;
   if body ? 'locationId' or body ? 'sourceId' then raise exception 'POS_INVALID';end if;
  end if;
  insert into public.pos_payment_attempts(workspace_id,checkout_id,actor_id,provider,amount_minor,currency,idempotency_key,request,provider_account_id,metadata)
   values(w,c.id,auth.uid(),body->>'provider',c.amount_minor,c.currency,key_id,body-'key',case when body->>'provider'='SQUARE' then sq_id::text end,case when body->>'provider'='SQUARE' then jsonb_build_object('environment','SANDBOX','locationId',sq_location,'verification','Square Sandbox') else '{}'::jsonb end) returning * into p;
  update public.pos_payment_checkouts set state='PAYING',updated_at=now() where id=c.id;
  perform pos_private.payment_audit(p.id,'attempt_created',null,'CREATED');
  return pos_private.payment_view(p.id);
 end if;
 select * into p from public.pos_payment_attempts where id=(body->>'id')::uuid and workspace_id=w;
 if p.id is null then raise exception 'POS_FORBIDDEN'; end if;
 perform pos_private.payment_authorize(w,p.checkout_id);
 if action='get' then return pos_private.payment_view(p.id); end if;
 -- Consistent order with register closing and canonical sale/refund commands.
 select ch.* into c from public.pos_payment_checkouts ch where ch.id=p.checkout_id;
 perform 1 from public.pos_register_sessions where id=c.session_id for update;
 select * into c from public.pos_payment_checkouts where id=p.checkout_id for update;
 select * into p from public.pos_payment_attempts where id=p.id for update;
 original_status:=p.status;
 if action in ('dispatch','provider_get','provider_cancel') then
  if action='dispatch' and p.status='CREATED' then
   perform pos_private.authorize(w);
   if c.actor_id<>auth.uid() then raise exception 'POS_FORBIDDEN'; end if;
   quote:=pos_private.calculate(w,c.site_id,c.intent);
   perform pos_private.payment_validate_stock(w,c.site_id,quote);
   quote:=pos_private.calculate(w,c.site_id,c.intent);
   if quote<>c.snapshot then raise exception 'POS_QUOTE_CHANGED'; end if;
  end if;

  if p.provider='SQUARE' then
   if action='dispatch' and p.status='CREATED' then update public.pos_payment_attempts set status='PENDING',updated_at=now() where id=p.id;end if;
   return pos_private.payment_view(p.id);
  elsif p.provider='MOCK' then
   if not (select enabled from pos_private.payment_test_config) then raise exception 'POS_MOCK_DISABLED'; end if;
   outcome:=p.request->>'outcome';
   if action='dispatch' then
    insert into pos_private.mock_payments values(p.id,outcome,case outcome when 'APPROVE' then 'SUCCEEDED' when 'DECLINE' then 'DECLINED' when 'CANCEL' then 'CANCELED' when 'TIMEOUT' then 'TIMED_OUT' when 'DELAYED_SUCCESS' then 'PROCESSING' else 'UNKNOWN' end,0,'mock_'||p.id::text) on conflict do nothing;
    if p.status='CREATED' then update public.pos_payment_attempts set status='PENDING',provider_payment_id='mock_'||p.id::text,updated_at=now() where id=p.id; perform pos_private.payment_audit(p.id,'provider_initiated',p.status,'PENDING'); end if;
   elsif action='provider_get' then
    update pos_private.mock_payments set polls=polls+1,status=case when polls>=1 and outcome in ('DELAYED_SUCCESS','UNKNOWN_THEN_SUCCESS') then 'SUCCEEDED' when polls>=1 and outcome='UNKNOWN_THEN_DECLINE' then 'DECLINED' else status end where payment_id=p.id and status in ('PROCESSING','UNKNOWN');
   else
    insert into pos_private.mock_payments values(p.id,outcome,'CANCELED',0,'mock_'||p.id::text) on conflict do nothing;
    update pos_private.mock_payments set status='CANCELED' where payment_id=p.id and status in ('PROCESSING','UNKNOWN','TIMED_OUT');
   end if;
  else
   if action='dispatch' and p.status='CREATED' then
    update public.pos_payment_attempts set status='SUCCEEDED',provider_payment_id=p.request->>'reference',metadata=jsonb_build_object('verification','Externally recorded','method',p.request->>'method'),completed_at=now(),updated_at=now() where id=p.id;
    update public.pos_payment_checkouts set state='FINALIZING' where id=c.id;
    perform pos_private.payment_audit(p.id,'externally_recorded',p.status,'SUCCEEDED');
   end if;
  end if;
  return pos_private.payment_view(p.id);
 elsif action='observe' then
  if p.provider='SQUARE' then
   select status into observed from pos_private.square_observations where payment_id=p.id;
   if observed is null then return pos_private.payment_view(p.id);end if;
  elsif p.provider='MOCK' then
   if not (select enabled from pos_private.payment_test_config) then raise exception 'POS_MOCK_DISABLED'; end if;
   select status into observed from pos_private.mock_payments where payment_id=p.id;
   if observed is null then raise exception 'POS_PAYMENT_UNCERTAIN'; end if;
  else observed:=p.status; end if;
  event_key:=coalesce(nullif(body->>'eventId',''),'poll:'||p.id::text||':'||observed);
  if length(event_key)>160 then raise exception 'POS_INVALID'; end if;
  insert into public.pos_payment_events(workspace_id,payment_id,provider,external_event_id,status,observed_status) values(w,p.id,p.provider,event_key,'RECEIVED',observed) on conflict do nothing;
  if exists(select 1 from public.pos_payment_events where workspace_id=w and provider=p.provider and external_event_id=event_key and payment_id<>p.id) then raise exception 'POS_IDEMPOTENCY_CONFLICT'; end if;
  if p.status in ('CREATED','PENDING','AWAITING_CUSTOMER','PROCESSING','AUTHORIZED','UNKNOWN','TIMED_OUT') then
   update public.pos_payment_attempts set status=observed,provider_payment_id=case when p.provider='SQUARE' then (select provider_id from pos_private.square_observations where payment_id=p.id) else provider_payment_id end,metadata=case when p.provider='SQUARE' then metadata||(select metadata from pos_private.square_observations where payment_id=p.id) when observed='SUCCEEDED' then jsonb_build_object('brand','Mock','last4','4242','verification','Simulated') else metadata end,completed_at=case when observed in ('SUCCEEDED','DECLINED','FAILED','CANCELED') then now() end,reconciled_at=now(),updated_at=now() where id=p.id;
   update public.pos_payment_checkouts set state=case when observed='SUCCEEDED' then 'FINALIZING' when observed in ('DECLINED','FAILED','CANCELED') then 'PAYABLE' else 'PAYING' end,updated_at=now() where id=c.id;
   perform pos_private.payment_audit(p.id,'reconciled',p.status,observed);
  end if;
  update public.pos_payment_events set status='PROCESSED',processed_at=now() where workspace_id=w and provider=p.provider and external_event_id=event_key;
  return pos_private.payment_view(p.id);
 elsif action='finalize' then
  if c.state='COMPLETED' then return pos_private.payment_view(p.id); end if;
  if p.status<>'SUCCEEDED' then raise exception 'POS_PAYMENT_UNCERTAIN'; end if;
  if c.actor_id<>auth.uid() then return pos_private.payment_view(p.id)||jsonb_build_object('failureCode','POS_ORIGINAL_ACTOR_REQUIRED'); end if;
  begin
   quote:=pos_private.calculate(w,c.site_id,c.intent);
   if quote<>c.snapshot then raise exception 'POS_QUOTE_CHANGED'; end if;
   insert into pos_private.payment_context values(txid_current(),pg_backend_pid(),auth.uid(),p.id,null);
   result:=pos_private.cash_command(w,'checkout',c.intent||jsonb_build_object('key',c.id,'cashMinor',c.amount_minor));
   delete from pos_private.payment_context where transaction_id=txid_current() and backend=pg_backend_pid();
   update public.pos_payment_checkouts set state='COMPLETED',sale_id=(result->>'saleId')::uuid,failure_code=null,updated_at=now() where id=c.id;
   perform pos_private.payment_audit(p.id,'sale_finalized',p.status,p.status);
  exception when others then
   update public.pos_payment_checkouts set state='RECOVERY_REQUIRED',failure_code=case when sqlerrm like 'POS_%' then split_part(sqlerrm,E'\n',1) else 'POS_FINALIZATION_FAILED' end,updated_at=now() where id=c.id;
   perform pos_private.payment_audit(p.id,'finalization_recovery_required',p.status,p.status);
  end;
  return pos_private.payment_view(p.id);
 end if;
 raise exception 'POS_INVALID';
end $function$
;
revoke all on function pos_private.payment_command(uuid,text,jsonb) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.pos_provider_request_budget(p_workspace_id uuid, p_bucket text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare request_count integer; maximum integer;
begin
  perform pos_private.authorize(p_workspace_id,false,false);
  maximum := case p_bucket when 'oauth' then 12 when 'device' then 60 when 'payment' then 120 else null end;
  if maximum is null then raise exception 'POS_INVALID'; end if;
  insert into pos_private.request_limits(actor_id,bucket)
    values(auth.uid(),'provider:'||p_bucket)
  on conflict(actor_id,bucket) do update set
    requests=case when request_limits.started_at < now()-interval '1 minute' then 1 else least(request_limits.requests+1,1000000) end,
    started_at=case when request_limits.started_at < now()-interval '1 minute' then now() else request_limits.started_at end
  returning requests into request_count;
  return request_count<=maximum;
end $function$
;
revoke all on function pos_provider_request_budget(uuid,text) from public,anon,authenticated,service_role;
grant EXECUTE on function pos_provider_request_budget(uuid,text) to "authenticated";
grant EXECUTE on function pos_provider_request_budget(uuid,text) to "service_role";

CREATE OR REPLACE FUNCTION pos_private.cash_command(w uuid, action text, body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  payment public.pos_payment_attempts%rowtype;
  stock_owner uuid;
  actor uuid := auth.uid(); site public.pos_store_locations%rowtype;
  reg public.pos_registers%rowtype; sess public.pos_register_sessions%rowtype;
  inv public.inventory_items%rowtype; prior public.pos_sales%rowtype;
  v_sale_id uuid; key_id uuid; line jsonb; lines jsonb := '[]'; receipt jsonb;
  qty integer; price bigint; sub bigint:=0; disc bigint:=0; tax bigint:=0;
  line_sub bigint; line_disc bigint; line_tax bigint; rate integer; received bigint; expected bigint;
  v_position record; remaining integer; take integer; reserved bigint; pos_reserved bigint; pos_total bigint;
  loc text; code text; result jsonb; request_body jsonb; request_count integer;
begin
  perform pos_private.authorize(w,action in ('setup'),action not in ('availability','history','receipt','recover','cancel'));
  if body is null or jsonb_typeof(body)<>'object' or octet_length(body::text)>262144 then raise exception 'POS_INVALID'; end if;
  if action not in ('availability','receipt','recover') then
    insert into pos_private.request_limits(actor_id,bucket) values(actor,case when action='search' then 'search' else 'command' end)
    on conflict(actor_id,bucket) do update set
      requests=case when request_limits.started_at < now()-interval '1 minute' then 1 else request_limits.requests+1 end,
      started_at=case when request_limits.started_at < now()-interval '1 minute' then now() else request_limits.started_at end
    returning requests into request_count;
    if request_count>600 then raise exception 'POS_RATE_LIMIT'; end if;
  end if;
  if action='availability' then
    return jsonb_build_object('enabled',exists(select 1 from public.pos_workspace_settings where workspace_id=w and enabled));
  elsif action='bootstrap' then
    return jsonb_build_object(
      'operators',(select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'name',coalesce((select e.full_name from public.workspace_employees e where e.workspace_id=w and e.linked_user_id=m.user_id limit 1),(select coalesce(to_jsonb(p)->>'full_name',to_jsonb(p)->>'display_name') from public.profiles p where p.id=m.user_id),'Operator'))),'[]') from public.workspace_members m where m.workspace_id=w and (m.user_id=actor or exists(select 1 from public.workspace_members z where z.workspace_id=w and z.user_id=actor and z.role in ('owner','admin','manager')))),
      'sites',(select coalesce(jsonb_agg(s),'[]') from public.pos_store_locations s where s.workspace_id=w and exists(select 1 from public.pos_location_inventory_locations m where m.site_id=s.id and pos_private.can_transact(w,s.id,m.inventory_user_id,'sell'))),
      'registers',(select coalesce(jsonb_agg(r order by r.created_at,r.id),'[]') from public.pos_registers r join public.pos_store_locations s on s.id=r.site_id where r.workspace_id=w and (r.active or exists(select 1 from public.workspace_members where workspace_id=w and user_id=actor and role in ('owner','admin','manager'))) and exists(select 1 from public.pos_location_inventory_locations m where m.site_id=s.id and pos_private.can_transact(w,s.id,m.inventory_user_id,'sell'))),
      'sessions',(select coalesce(jsonb_agg(s),'[]') from public.pos_register_sessions s where s.workspace_id=w and s.closed_at is null and exists(select 1 from public.pos_location_inventory_locations m where m.site_id=s.site_id and pos_private.can_transact(w,s.site_id,m.inventory_user_id,'sell'))),
      'locations',(select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'name',l.name)),'[]') from public.inventory_locations l where l.user_id=actor and not exists(select 1 from public.pos_location_inventory_locations m where m.inventory_user_id=actor and m.location_id=l.id)),
      'operatorName',coalesce((select e.full_name from public.workspace_employees e where e.workspace_id=w and e.linked_user_id=actor limit 1),(select coalesce(to_jsonb(p)->>'full_name',to_jsonb(p)->>'display_name') from public.profiles p where p.id=actor),'Operator'),'canManage',exists(select 1 from public.workspace_members where workspace_id=w and user_id=actor and role in ('owner','admin','manager')));
  elsif action='setup' then
    if length(trim(body->>'name')) not between 1 and 100 or length(trim(body->>'registerName')) not between 1 and 100 or coalesce(body->>'taxBps','') !~ '^\d{1,4}$' then raise exception 'POS_INVALID'; end if;
    loc := body->>'locationId';
    if not exists(select 1 from public.inventory_locations where user_id=actor and id=loc) then raise exception 'POS_FORBIDDEN'; end if;
    if not exists(select 1 from pg_timezone_names where name=coalesce(body->>'timezone','America/Phoenix')) then raise exception 'POS_INVALID'; end if;
    insert into public.pos_store_locations(workspace_id,inventory_user_id,name,tax_bps,timezone) values(w,actor,trim(body->>'name'),(body->>'taxBps')::int,coalesce(body->>'timezone','America/Phoenix')) returning * into site;
    insert into public.pos_location_inventory_locations values(w,site.id,actor,loc);
    insert into public.pos_registers(workspace_id,site_id,name) values(w,site.id,trim(body->>'registerName')) returning * into reg;
    return jsonb_build_object('siteId',site.id,'registerId',reg.id);
  elsif action in ('open','close') then
    select r.* into reg from public.pos_registers r join public.pos_store_locations s on s.id=r.site_id
      where r.id=(body->>'registerId')::uuid and r.workspace_id=w and r.active and exists(select 1 from public.pos_location_inventory_locations m where m.site_id=s.id and pos_private.can_transact(w,s.id,m.inventory_user_id,'sell')) for update of r;
    if reg.id is null then raise exception 'POS_FORBIDDEN'; end if;
    select * into sess from public.pos_register_sessions where register_id=reg.id and closed_at is null for update;

    if action='close' then
      update public.pos_register_sessions set closed_at=now() where id=sess.id;
      return jsonb_build_object('closed',true);
    end if;
    if sess.id is null then
      insert into public.pos_register_sessions(workspace_id,site_id,register_id,actor_id) values(w,reg.site_id,reg.id,actor) returning * into sess;
    end if;
    return to_jsonb(sess);
  elsif action in ('history','receipt','recover','cancel') then
    if action='history' then
      select coalesce(jsonb_agg(x),'[]') into result from (
        select id,receipt_number,created_at,total_minor,subtotal_minor,discount_minor,tax_minor,register_id,actor_id from public.pos_sales
        where workspace_id=w and actor_id=actor and (nullif(body->>'before','') is null or (created_at,id)<((body->>'before')::timestamptz,coalesce(nullif(body->>'beforeId',''),'00000000-0000-0000-0000-000000000000')::uuid))
        order by created_at desc,id desc limit 50
      ) x;
      return result;
    end if;
    if action in ('recover','cancel') then
      key_id:=(body->>'key')::uuid;
      if key_id is null then raise exception 'POS_INVALID'; end if;
      perform pg_advisory_xact_lock(hashtextextended('pos:'||w::text||key_id::text,0));
    end if;
    select * into prior from public.pos_sales where workspace_id=w and actor_id=actor
      and ((action='receipt' and id=(body->>'saleId')::uuid) or (action in ('recover','cancel') and idempotency_key=key_id));
    if prior.id is null then
      if action='cancel' then
        insert into public.pos_checkout_cancellations(workspace_id,actor_id,idempotency_key) values(w,actor,key_id) on conflict do nothing;
      end if;
      return jsonb_build_object('status',case when exists(select 1 from public.pos_checkout_cancellations where workspace_id=w and actor_id=actor and idempotency_key=key_id) then 'canceled' else 'not_found' end);
    end if;
    return jsonb_build_object('status','completed','saleId',prior.id,'receipt',prior.receipt);
  end if;
  select * into site from public.pos_store_locations where id=(body->>'siteId')::uuid and workspace_id=w and exists(select 1 from public.pos_location_inventory_locations m where m.site_id=pos_store_locations.id and pos_private.can_transact(w,m.site_id,m.inventory_user_id,'sell'));
  if site.id is null then raise exception 'POS_FORBIDDEN'; end if;
  if action='search' and coalesce(body->>'exact','false')='true' then
    return pos_private.resolve_barcode(w,site.id,body->>'query');
  end if;
  if action='search' then
    code := trim(coalesce(body->>'query',''));
    if length(code) not between 1 and 160 then return '[]'; end if;
    -- Current owner boundaries retained. Missing price remains null.
    -- Authority depends on owner/site/actor, not on each inventory row.
    -- Materialization evaluates it once per mapped location in this statement;
    -- checkout still rechecks authority under the existing owner lock.
    with authorized_locations as materialized (
      select m.inventory_user_id,m.location_id from public.pos_location_inventory_locations m
      where m.workspace_id=w and m.site_id=site.id
        and pos_private.can_transact(w,site.id,m.inventory_user_id,'sell')
    )
    select coalesce(jsonb_agg(x),'[]') into result from (
      select i.id,i.user_id as "ownerId",coalesce(nullif(i.product_name,''),i.card_name) as name,i.sku,i.set_code,i.collector_number,i.location_id,l.name as location,
        i.data->>'condition' as condition,i.data->>'finish' as finish,i.data->>'language' as language,
        coalesce(i.data->>'taxable','true')<>'false' as taxable,
        case when i.asking_price between 0 and 1000000 then (i.asking_price*100)::bigint end as unit_price_minor,
        greatest(0,i.quantity-coalesce((select sum(a.quantity) from public.selling_inventory_allocations a where a.user_id=i.user_id and a.inventory_item_id=i.id and a.status in ('ALLOCATED','RESERVED')),0)) as available,
        coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'batchId',p.batch_id,'quantity',p.quantity,'locationId',p.location_id)) from public.chaos_sort_inventory_positions p where p.user_id=i.user_id and p.item_id=i.id and p.quantity>0),'[]') as positions
      from public.inventory_items i join public.inventory_locations l on l.user_id=i.user_id and l.id=i.location_id
      join authorized_locations m on m.inventory_user_id=i.user_id and m.location_id=i.location_id
      where i.workspace_id=w and i.quantity>0 and (
        i.sku=code or i.upc=code or i.barcode_value=code or i.id=code or i.data->>'tcgplayer_product_id'=code or i.data->>'provider_sku_id'=code or
        exists(select 1 from public.inventory_label_identities z where z.workspace_id=w and z.inventory_user_id=i.user_id and z.inventory_item_id=i.id and z.status='active' and z.revoked_at is null and (z.sku=code or z.barcode_value=code or z.qr_token=code)) or
        (coalesce(body->>'exact','false')<>'true' and (
          to_tsvector('simple',coalesce(i.card_name,'')||' '||coalesce(i.product_name,'')||' '||coalesce(i.set_code,'')||' '||coalesce(i.collector_number,'')) @@ plainto_tsquery('simple',code)
          or lower(l.name)=lower(code)
          or exists(select 1 from public.chaos_sort_inventory_positions cp join public.chaos_sort_batches cb on cb.id=cp.batch_id and cb.user_id=cp.user_id where cp.user_id=i.user_id and cp.item_id=i.id and cb.batch_code=code)
        ))
      ) order by i.card_name,i.id limit 30
    ) x;
    return result;
  elsif action<>'checkout' then raise exception 'POS_INVALID'; end if;

  select a.* into payment from pos_private.payment_context x join public.pos_payment_attempts a on a.id=x.payment_id where x.transaction_id=txid_current() and x.backend=pg_backend_pid() and x.actor_id=auth.uid() and x.refund_attempt_id is null and a.workspace_id=w and a.status='SUCCEEDED';
  key_id := (body->>'key')::uuid;
  if key_id is null then raise exception 'POS_INVALID'; end if;
  if payment.id is null and exists(select 1 from public.pos_payment_checkouts where workspace_id=w and id=key_id and state<>'VOIDED') then raise exception 'POS_PAYMENT_ACTIVE'; end if;
  request_body := body-'key';
  perform pg_advisory_xact_lock(hashtextextended('pos:'||w::text||key_id::text,0));
  select * into prior from public.pos_sales where workspace_id=w and idempotency_key=key_id;
  if prior.id is not null then
    if prior.request<>request_body or prior.actor_id<>actor then raise exception 'POS_IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('status','completed','saleId',prior.id,'receipt',prior.receipt,'replayed',true);
  end if;
  if exists(select 1 from public.pos_checkout_cancellations where workspace_id=w and actor_id=actor and idempotency_key=key_id) then raise exception 'POS_CHECKOUT_CANCELED'; end if;
  select * into sess from public.pos_register_sessions where id=(body->>'sessionId')::uuid and workspace_id=w and site_id=site.id and closed_at is null for update;
  if sess.id is null or sess.status<>'OPEN' or not exists(select 1 from public.pos_registers where id=sess.register_id and active) then raise exception 'POS_SESSION_CLOSED'; end if;
  if jsonb_typeof(body->'lines') is distinct from 'array' or jsonb_array_length(body->'lines') not between 1 and 500
    or coalesce(body->>'cashMinor','') !~ '^\d{1,12}$' or coalesce(body->>'expectedMinor','') !~ '^\d{1,12}$' then raise exception 'POS_INVALID'; end if;
  received := (body->>'cashMinor')::bigint; expected := (body->>'expectedMinor')::bigint;
  if (select count(distinct (coalesce((value->>'ownerId')::uuid,site.inventory_user_id),value->>'itemId',coalesce(nullif(value->>'positionId',''),''))) from jsonb_array_elements(body->'lines'))<>jsonb_array_length(body->'lines') then raise exception 'POS_INVALID'; end if;
  for stock_owner in select distinct coalesce((value->>'ownerId')::uuid,site.inventory_user_id) from jsonb_array_elements(body->'lines') order by 1 loop
    perform pos_private.lock_authority(w,site.id,stock_owner,'sell');
    perform 1 from public.inventory_items where user_id=stock_owner and id in (select value->>'itemId' from jsonb_array_elements(body->'lines')) order by id for update;
  end loop;
  result:=pos_private.calculate(w,site.id,body);
  if payment.id is not null and result<>(select snapshot from public.pos_payment_checkouts where id=payment.checkout_id) then raise exception 'POS_QUOTE_CHANGED'; end if;
  lines:=result->'lines'; sub:=(result->>'subtotalMinor')::bigint; disc:=(result->>'discountMinor')::bigint; tax:=(result->>'taxMinor')::bigint;
  if (disc>0 and not pos_private.permission(w,'discount')) or (exists(select 1 from jsonb_array_elements(lines) where (value->>'overrideDifferenceMinor')::bigint<>0) and not pos_private.permission(w,'override')) then
    if payment.id is null then perform pos_private.approved(w,site.id,'checkout',body); end if;
  end if;
  if expected<>sub-disc+tax then raise exception 'POS_QUOTE_CHANGED'; end if;
  if received<sub-disc+tax then raise exception 'POS_CASH_INSUFFICIENT'; end if;
  v_sale_id:=gen_random_uuid();
  code:='TD-'||upper(replace(v_sale_id::text,'-',''));
  select name into loc from public.pos_registers where id=sess.register_id;
  receipt:=jsonb_build_object('version',2,'settings',site.settings,'timezone',site.timezone,'employeeName',coalesce((select e.full_name from public.workspace_employees e where e.workspace_id=w and e.linked_user_id=actor limit 1),(select coalesce(to_jsonb(p)->>'full_name',to_jsonb(p)->>'display_name') from public.profiles p where p.id=actor),'Operator'),'number',code,'site',site.name,'register',loc,'actorId',actor,'createdAt',now(),'currency','USD','lines',(select jsonb_agg(value-array['costBasis','inventoryValueUnit']) from jsonb_array_elements(lines)),'subtotalMinor',sub,'discountMinor',disc,'taxMinor',tax,'totalMinor',sub-disc+tax,'cashMinor',received,'changeMinor',received-(sub-disc+tax),'discountReason',body->>'discountReason');
  if payment.id is not null then receipt:=receipt||jsonb_build_object('payment',jsonb_build_object('provider',payment.provider,'status',payment.status,'reference',payment.provider_payment_id,'metadata',payment.metadata),'cashMinor',0,'changeMinor',0); end if;
  insert into public.pos_sales(id,workspace_id,site_id,register_id,session_id,actor_id,idempotency_key,request,receipt_number,subtotal_minor,discount_minor,tax_minor,total_minor,receipt)
    values(v_sale_id,w,site.id,sess.register_id,sess.id,actor,key_id,request_body,code,sub,disc,tax,sub-disc+tax,receipt);
  for line in select value from jsonb_array_elements(lines) loop
    stock_owner:=(line->>'ownerId')::uuid;
    select * into inv from public.inventory_items where user_id=stock_owner and id=line->>'itemId';
    qty:=(line->>'quantity')::int; remaining:=qty;
    select coalesce(sum(quantity),0) into pos_total from public.chaos_sort_inventory_positions where user_id=stock_owner and item_id=inv.id;
    select coalesce(sum(quantity),0) into reserved from public.selling_inventory_allocations where user_id=stock_owner and inventory_item_id=inv.id and inventory_position_id is null and status in ('ALLOCATED','RESERVED');
    if pos_total>inv.quantity then raise exception 'POS_PROVENANCE_CONFLICT'; end if;
    for v_position in select * from public.chaos_sort_inventory_positions where user_id=stock_owner and item_id=inv.id and quantity>0 order by created_at,id for update loop
      if v_position.location_id is distinct from inv.location_id then raise exception 'POS_PROVENANCE_CONFLICT'; end if;
      if nullif(line->>'positionId','') is not null and v_position.id<>line->>'positionId' then continue; end if;
      select coalesce(sum(quantity),0) into pos_reserved from public.selling_inventory_allocations where user_id=stock_owner and inventory_item_id=inv.id and inventory_position_id=v_position.id and status in ('ALLOCATED','RESERVED');
      take:=least(remaining,greatest(0,v_position.quantity-pos_reserved-reserved));
      if take=0 then continue; end if;
      update public.chaos_sort_inventory_positions set quantity=quantity-take,status=case when quantity-take=0 then 'depleted' else status end,updated_at=now() where user_id=stock_owner and id=v_position.id;
      update public.chaos_sort_batches set current_quantity=current_quantity-take,updated_at=now() where user_id=stock_owner and id=v_position.batch_id and current_quantity>=take;
      if not found then raise exception 'POS_PROVENANCE_CONFLICT'; end if;
      insert into public.pos_sale_allocations(workspace_id,sale_id,inventory_user_id,inventory_item_id,position_id,batch_id,location_id,quantity,line_key) values(w,v_sale_id,stock_owner,inv.id,v_position.id,v_position.batch_id,v_position.location_id,take,coalesce(line->>'positionId',''));
      remaining:=remaining-take;
      exit when remaining=0;
    end loop;
    if remaining>0 then
      if nullif(line->>'positionId','') is not null or inv.quantity-pos_total-reserved<remaining then raise exception 'POS_STOCK_UNAVAILABLE'; end if;
      insert into public.pos_sale_allocations(workspace_id,sale_id,inventory_user_id,inventory_item_id,location_id,quantity,line_key) values(w,v_sale_id,stock_owner,inv.id,inv.location_id,remaining,coalesce(line->>'positionId',''));
    end if;
    insert into pos_private.stock_permits values(txid_current(),pg_backend_pid(),actor,stock_owner,inv.id,to_jsonb(inv),inv.quantity-qty);
    update public.inventory_items set quantity=quantity-qty,inventory_value=case when quantity=0 then 0 else round(inventory_value*(quantity-qty)/quantity,2) end,updated_at=now() where user_id=stock_owner and id=inv.id;
    delete from pos_private.stock_permits where transaction_id=txid_current() and backend=pg_backend_pid() and owner_id=stock_owner and item_id=inv.id;
    insert into public.pos_sale_items(workspace_id,sale_id,inventory_user_id,inventory_item_id,quantity,unit_price_minor,discount_minor,tax_minor,snapshot)
      values(w,v_sale_id,stock_owner,inv.id,qty,(line->>'unitPriceMinor')::bigint,(line->>'discountMinor')::bigint,(line->>'taxMinor')::bigint,line);
    insert into public.inventory_events(user_id,inventory_item_id,event_type,source,related_entity_type,related_entity_id,quantity_before,quantity_change,quantity_after,previous_location_id,next_location_id,card_name,idempotency_key,metadata)
      values(stock_owner,inv.id,'quantity_removed','system','pos_sale',v_sale_id::text,inv.quantity,-qty,inv.quantity-qty,inv.location_id,inv.location_id,inv.card_name,'pos:'||v_sale_id::text||':'||inv.id||case when stock_owner=actor then '' else ':owner:'||stock_owner::text end||case when nullif(line->>'positionId','') is null then '' else ':position:'||md5(line->>'positionId') end,
        jsonb_build_object('workspace_id',w,'actor_id',actor,'site_id',site.id,'register_id',sess.register_id,'receipt_number',code,'allocations',(select jsonb_agg(to_jsonb(a)) from public.pos_sale_allocations a where a.sale_id=v_sale_id and a.inventory_user_id=stock_owner and a.inventory_item_id=inv.id and a.line_key=coalesce(line->>'positionId',''))));
  end loop;
  insert into public.pos_tenders(workspace_id,sale_id,method,verification,amount_minor,received_minor,change_minor,payment_attempt_id,provider_reference,metadata) values(w,v_sale_id,coalesce(lower(payment.provider),'cash'),case payment.provider when 'MOCK' then 'simulated' when 'EXTERNAL' then 'externally_recorded' else 'recorded' end,sub-disc+tax,received,received-(sub-disc+tax),payment.id,payment.provider_payment_id,coalesce(payment.metadata,'{}'));
  return jsonb_build_object('status','completed','saleId',v_sale_id,'receipt',receipt,'replayed',false);
end $function$
;
revoke all on function pos_private.cash_command(uuid,text,jsonb) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION pos_private.command(w uuid, action text, body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare prior public.pos_operation_receipts%rowtype; result jsonb; key_id uuid; site uuid; manager boolean;
begin
 if body is null or jsonb_typeof(body)<>'object' or octet_length(body::text)>262144 then raise exception 'POS_INVALID'; end if;
 if action in ('history','receipt','sessions','session_detail','daily','approvals') then return pos_private.read_operations(w,action,body); end if;
 if action in ('availability','bootstrap','search','recover','cancel','setup') then return pos_private.cash_command(w,action,body); end if;
 if action='access' then return pos_private.access_command(w,action,body); end if;
 if action='quote' then
  result:=pos_private.calculate(w,(body->>'siteId')::uuid,body);
  return result||jsonb_build_object('lines',(select jsonb_agg(value-array['costBasis','inventoryValueUnit']) from jsonb_array_elements(result->'lines')));
 end if;
 perform pos_private.authorize(w);
 key_id:=(body->>'key')::uuid; if key_id is null then raise exception 'POS_INVALID'; end if;
 perform pg_advisory_xact_lock(hashtextextended('pos-operation:'||w::text||auth.uid()::text||key_id::text,0));
 select * into prior from public.pos_operation_receipts where workspace_id=w and actor_id=auth.uid() and key=key_id;
 if prior.key is not null then
  if prior.action<>action or prior.intent<>body-'key' then raise exception 'POS_IDEMPOTENCY_CONFLICT'; end if;
  return prior.result;
 end if;
 if action in ('grant','revoke','staff_permissions','join_site') then result:=pos_private.access_command(w,action,body);
 elsif action='checkout' then result:=pos_private.cash_command(w,action,body);
 elsif action='refund' then result:=pos_private.refund(w,body);
 else result:=pos_private.operations(w,action,body); end if;
 insert into public.pos_operation_receipts(workspace_id,actor_id,key,action,intent,result) values(w,auth.uid(),key_id,action,body-'key',result);
 return result;
end $function$
;
revoke all on function pos_private.command(uuid,text,jsonb) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION pos_private.payment_refund_quote(w uuid, body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare sale public.pos_sales%rowtype; sess public.pos_register_sessions%rowtype; original public.pos_sale_items%rowtype;
 inv public.inventory_items%rowtype; alloc public.pos_sale_allocations%rowtype; position public.chaos_sort_inventory_positions%rowtype;
 line jsonb; prepared jsonb:='[]'; allocation_rows jsonb; q integer; previous_q integer; skip_q integer; take_q integer; remaining integer;
 net bigint; tax bigint; net_sum bigint:=0; tax_sum bigint:=0; refund_id uuid:=gen_random_uuid(); refund_item uuid;
 stock_owner uuid; restore boolean; unit_value numeric;
begin
 perform pos_private.authorize(w);
 if not pos_private.permission(w,'refund') then raise exception 'POS_FORBIDDEN'; end if;
 select * into sess from public.pos_register_sessions where id=(body->>'sessionId')::uuid and workspace_id=w for update;
 if sess.id is null or sess.status<>'OPEN' or not pos_private.site_access(w,sess.site_id) then raise exception 'POS_SESSION_CLOSED'; end if;
 select * into sale from public.pos_sales where id=(body->>'saleId')::uuid and workspace_id=w for update;
 if sale.id is null or not pos_private.site_access(w,sale.site_id) then raise exception 'POS_FORBIDDEN'; end if;
 if length(trim(coalesce(body->>'reason',''))) not between 1 and 500 or jsonb_typeof(body->'lines') is distinct from 'array' or jsonb_array_length(body->'lines') not between 1 and 500
  or (select count(distinct value->>'saleItemId') from jsonb_array_elements(body->'lines'))<>jsonb_array_length(body->'lines') then raise exception 'POS_INVALID'; end if;
 for stock_owner in select distinct inventory_user_id from public.pos_sale_items where sale_id=sale.id and id in (select (value->>'saleItemId')::uuid from jsonb_array_elements(body->'lines')) order by inventory_user_id loop
  perform pos_private.lock_authority(w,sale.site_id,stock_owner,'return');
 end loop;
 for line in select value from jsonb_array_elements(body->'lines') order by value->>'saleItemId' loop
  select * into original from public.pos_sale_items where id=(line->>'saleItemId')::uuid and sale_id=sale.id;
  if original.id is null or coalesce(line->>'quantity','') !~ '^\d{1,4}$' or jsonb_typeof(line->'returnInventory') is distinct from 'boolean' then raise exception 'POS_INVALID'; end if;
  q:=(line->>'quantity')::int; restore:=(line->>'returnInventory')::boolean;
  select coalesce(sum(quantity),0) into previous_q from public.pos_refund_items where sale_item_id=original.id;
  if q<1 or previous_q+q>original.quantity then raise exception 'POS_REFUND_EXCEEDED'; end if;
  net:=((original.unit_price_minor*original.quantity-original.discount_minor)*(previous_q+q)/original.quantity)-((original.unit_price_minor*original.quantity-original.discount_minor)*previous_q/original.quantity);
  tax:=(original.tax_minor*(previous_q+q)/original.quantity)-(original.tax_minor*previous_q/original.quantity);
  prepared:=prepared||jsonb_build_array(jsonb_build_object('id',original.id,'quantity',q,'returnInventory',restore,'net',net,'tax',tax,'previous',previous_q));
  net_sum:=net_sum+net; tax_sum:=tax_sum+tax;
 end loop;
 if coalesce(body->>'expectedMinor','') !~ '^\d{1,12}$' or (body->>'expectedMinor')::bigint<>net_sum+tax_sum then raise exception 'POS_QUOTE_CHANGED'; end if;
 return jsonb_build_object('totalMinor',net_sum+tax_sum);
end $function$
;
revoke all on function pos_private.payment_refund_quote(uuid,jsonb) from public,anon,authenticated,service_role;

-- Narrow, backend/transaction/actor/exact-row-bound stock permit used by delegated POS only.
CREATE OR REPLACE FUNCTION public.enforce_collector_inventory_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  acting_user_id uuid;
  target_user_id uuid;
  effective_tier text;
  existing_quantity_total bigint;
  previous_quantity_total bigint;
  next_quantity_total bigint;
  has_full_platform_access boolean := false;
begin
  acting_user_id := public.collector_inventory_acting_user();

  if tg_op = 'DELETE' then
    target_user_id := old.user_id;
  else
    target_user_id := new.user_id;
  end if;

  if tg_op='UPDATE' and acting_user_id is not null and acting_user_id<>target_user_id and pos_private.permitted_stock_update(to_jsonb(old),to_jsonb(new)) then
    new.updated_at:=now(); return new;
  end if;
  if acting_user_id is null or target_user_id is null or acting_user_id <> target_user_id then
    perform public.raise_collector_inventory_error(
      'TD_COLLECTOR_UNAUTHORIZED',
      'You can only mutate your own collection records.',
      target_user_id
    );
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if new.quantity is null or new.quantity < 0 then
    perform public.raise_collector_inventory_error(
      'TD_COLLECTOR_INVALID_QUANTITY',
      'Quantity must be a whole number at or above zero.',
      target_user_id
    );
  end if;

  perform pg_advisory_xact_lock(hashtextextended('collector-inventory:' || target_user_id::text, 0));

  effective_tier := public.collector_effective_membership_tier(target_user_id);
  if effective_tier is null then
    perform public.raise_collector_inventory_error(
      'TD_COLLECTOR_MISSING_MEMBERSHIP',
      'Membership could not be resolved for this collection mutation.',
      target_user_id
    );
  end if;

  has_full_platform_access := coalesce(public.current_admin_role() in ('owner'::public.admin_role, 'admin'::public.admin_role), false);
  if effective_tier = 'free' and not has_full_platform_access then
    select coalesce(sum(quantity), 0)
      into existing_quantity_total
      from public.inventory_items
     where user_id = target_user_id
       and id <> new.id;

    next_quantity_total := existing_quantity_total + new.quantity;
    if tg_op = 'UPDATE' then
      previous_quantity_total := existing_quantity_total + old.quantity;
    else
      previous_quantity_total := existing_quantity_total;
    end if;

    -- Only growth is gated. Metadata edits, unchanged quantities, decreases,
    -- and removals must remain possible for an already over-limit collection.
    if next_quantity_total > 500
       and (tg_op = 'INSERT' or next_quantity_total > previous_quantity_total) then
      perform public.raise_collector_inventory_error(
        'TD_COLLECTOR_FREE_LIMIT_EXCEEDED',
        'Collection limit reached: Free accounts can hold up to 500 total owned cards. Reduce quantity or upgrade to add more.',
        target_user_id
      );
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$function$
;
CREATE CONSTRAINT TRIGGER pos_stock_item AFTER INSERT OR DELETE OR UPDATE ON public.inventory_items DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pos_private.check_stock();
CREATE CONSTRAINT TRIGGER pos_stock_position AFTER INSERT OR DELETE OR UPDATE ON public.chaos_sort_inventory_positions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pos_private.check_stock();
CREATE CONSTRAINT TRIGGER pos_stock_allocation AFTER INSERT OR DELETE OR UPDATE ON public.selling_inventory_allocations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pos_private.check_stock();
CREATE TRIGGER pos_sales_immutable BEFORE DELETE OR UPDATE ON public.pos_sales FOR EACH ROW EXECUTE FUNCTION pos_private.immutable();
CREATE TRIGGER pos_lines_immutable BEFORE DELETE OR UPDATE ON public.pos_sale_items FOR EACH ROW EXECUTE FUNCTION pos_private.immutable();
CREATE TRIGGER pos_allocations_immutable BEFORE DELETE OR UPDATE ON public.pos_sale_allocations FOR EACH ROW EXECUTE FUNCTION pos_private.immutable();
CREATE TRIGGER pos_tenders_immutable BEFORE DELETE OR UPDATE ON public.pos_tenders FOR EACH ROW EXECUTE FUNCTION pos_private.immutable();
CREATE TRIGGER pos_cancellations_immutable BEFORE DELETE OR UPDATE ON public.pos_checkout_cancellations FOR EACH ROW EXECUTE FUNCTION pos_private.immutable();
CREATE TRIGGER pos_events_immutable BEFORE DELETE OR UPDATE ON public.inventory_events FOR EACH ROW WHEN ((old.related_entity_type = 'pos_sale'::text)) EXECUTE FUNCTION pos_private.immutable();
CREATE TRIGGER pos_event_origin BEFORE INSERT ON public.inventory_events FOR EACH ROW EXECUTE FUNCTION pos_private.protect_event_origin();
CREATE TRIGGER pos_access_events_immutable BEFORE DELETE OR UPDATE ON public.pos_access_events FOR EACH ROW EXECUTE FUNCTION pos_private.immutable();
CREATE TRIGGER pos_session_transition BEFORE UPDATE ON public.pos_register_sessions FOR EACH ROW EXECUTE FUNCTION pos_private.session_transition();
CREATE TRIGGER pos_cash_events_immutable BEFORE DELETE OR UPDATE ON public.pos_cash_events FOR EACH ROW EXECUTE FUNCTION pos_private.immutable();
CREATE TRIGGER pos_operation_receipts_immutable BEFORE DELETE OR UPDATE ON public.pos_operation_receipts FOR EACH ROW EXECUTE FUNCTION pos_private.immutable();
CREATE TRIGGER pos_approval_requests_immutable BEFORE DELETE OR UPDATE ON public.pos_approval_requests FOR EACH ROW EXECUTE FUNCTION pos_private.immutable();
CREATE TRIGGER pos_approval_decisions_immutable BEFORE DELETE OR UPDATE ON public.pos_approval_decisions FOR EACH ROW EXECUTE FUNCTION pos_private.immutable();
CREATE TRIGGER pos_refunds_immutable BEFORE DELETE OR UPDATE ON public.pos_refunds FOR EACH ROW EXECUTE FUNCTION pos_private.immutable();
CREATE TRIGGER pos_refund_items_immutable BEFORE DELETE OR UPDATE ON public.pos_refund_items FOR EACH ROW EXECUTE FUNCTION pos_private.immutable();
CREATE TRIGGER pos_delegation_history BEFORE DELETE OR UPDATE ON public.pos_inventory_delegations FOR EACH ROW EXECUTE FUNCTION pos_private.delegation_history();
CREATE TRIGGER pos_sale_cash AFTER INSERT ON public.pos_tenders FOR EACH ROW EXECUTE FUNCTION pos_private.record_sale_cash();
CREATE TRIGGER pos_refund_events_immutable BEFORE DELETE OR UPDATE ON public.inventory_events FOR EACH ROW WHEN ((old.related_entity_type = 'pos_refund'::text)) EXECUTE FUNCTION pos_private.immutable();
CREATE TRIGGER pos_refund_event_origin BEFORE INSERT ON public.inventory_events FOR EACH ROW EXECUTE FUNCTION pos_private.protect_refund_event();
CREATE TRIGGER pos_payment_audit_immutable BEFORE DELETE OR UPDATE ON public.pos_payment_audit FOR EACH ROW EXECUTE FUNCTION pos_private.immutable();
CREATE TRIGGER pos_payment_checkout_guard BEFORE DELETE OR UPDATE ON public.pos_payment_checkouts FOR EACH ROW EXECUTE FUNCTION pos_private.payment_transition();
CREATE TRIGGER pos_payment_attempt_guard BEFORE DELETE OR UPDATE ON public.pos_payment_attempts FOR EACH ROW EXECUTE FUNCTION pos_private.payment_transition();
CREATE TRIGGER pos_payment_refund_guard BEFORE DELETE OR UPDATE ON public.pos_payment_refund_attempts FOR EACH ROW EXECUTE FUNCTION pos_private.payment_transition();
CREATE TRIGGER pos_payment_session_guard BEFORE UPDATE ON public.pos_register_sessions FOR EACH ROW EXECUTE FUNCTION pos_private.payment_close_guard();
CREATE TRIGGER square_hardware_audit_immutable BEFORE DELETE OR UPDATE ON pos_private.square_hardware_audit FOR EACH ROW EXECUTE FUNCTION pos_private.immutable();
CREATE TRIGGER pos_terminal_attempt_guard BEFORE INSERT ON public.pos_payment_attempts FOR EACH ROW EXECUTE FUNCTION pos_private.terminal_attempt_guard();
CREATE TRIGGER pos_terminal_attempt_context AFTER INSERT ON public.pos_payment_attempts FOR EACH ROW EXECUTE FUNCTION pos_private.terminal_attempt_context();
set local check_function_bodies=on;
do $postflight$ begin
 if exists(select 1 from public.pos_workspace_settings where enabled) then raise exception 'POS_AUTO_ENABLE_FORBIDDEN'; end if;
 if exists(select 1 from pos_private.square_credentials) or exists(select 1 from pos_private.square_connections) or exists(select 1 from public.pos_payment_devices) then raise exception 'POS_PROVIDER_CONFIGURATION_FORBIDDEN'; end if;
end $postflight$;
