-- Owner-only collection removal synchronizes the exact tracked position.
-- Definition-only migration: no existing inventory/batch/event rows rewritten.
-- Historical migration files, stock guards, RLS, and collector authorization unchanged.
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
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_source public.inventory_items%rowtype;
  v_position public.chaos_sort_inventory_positions%rowtype;
  v_position_count integer;
  v_event public.inventory_events%rowtype;
  v_ledger_quantity integer := 0;
  v_ledger_count integer := 0;
  v_alignment integer := 0;
  v_evidence jsonb := '[]'::jsonb;
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

  -- Same owner lock used by collector mutations and POS stock operations.
  perform pg_advisory_xact_lock(hashtextextended('collector-inventory:' || v_user_id::text, 0));
  if p_idempotency_key is not null then
    select *
      into v_existing_event
      from public.inventory_events e
     where e.user_id = v_user_id
       and e.idempotency_key = p_idempotency_key
     limit 1;
    if found then
      if v_existing_event.inventory_item_id is distinct from p_inventory_item_id
         or v_existing_event.event_type::text <> 'quantity_removed'
         or v_existing_event.quantity_change is distinct from -p_quantity then
        raise exception 'TD_COLLECTOR_IDEMPOTENCY_CONFLICT';
      end if;
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

  -- No POS feature gate: collection disposition remains an owner operation.
  -- No staff delegation broadens this RPC's exact auth.uid()/user_id predicate.
  perform 1 from public.chaos_sort_inventory_positions
    where user_id=v_user_id and item_id=v_source.id order by id for update;
  select count(*) into v_position_count from public.chaos_sort_inventory_positions
    where user_id=v_user_id and item_id=v_source.id;
  -- This API supplies an item, not a position. Never guess among multiple lots.
  if v_position_count > 1 then raise exception 'TD_COLLECTOR_POSITION_SELECTION_REQUIRED'; end if;
  if exists(select 1 from public.selling_inventory_allocations
    where user_id=v_user_id and inventory_item_id=v_source.id
      and status in ('ALLOCATED','RESERVED') and quantity>0) then
    raise exception 'POS_STOCK_UNAVAILABLE';
  end if;
  if v_position_count=1 then
    select * into strict v_position from public.chaos_sort_inventory_positions
      where user_id=v_user_id and item_id=v_source.id;
    if v_position.location_id is distinct from v_source.location_id
       or v_position.status <> 'active'
       or not exists(select 1 from public.chaos_sort_batches b
         where b.id=v_position.batch_id and b.user_id=v_user_id
           and (b.workspace_id is null or b.workspace_id=v_source.workspace_id)) then
      raise exception 'TD_COLLECTOR_POSITION_REVIEW_REQUIRED';
    end if;
    if v_position.quantity <> v_before then
      -- Only repair the specific old item-only removal defect when the entire
      -- immutable ledger proves it. No generic stock normalization/backfill.
      if v_position.quantity < v_before then raise exception 'TD_COLLECTOR_POSITION_REVIEW_REQUIRED'; end if;
      for v_event in select * from public.inventory_events
        where user_id=v_user_id and inventory_item_id=v_source.id
        order by created_at,id
      loop
        if v_event.quantity_before is distinct from v_ledger_quantity
           or v_event.quantity_after is distinct from v_event.quantity_before+v_event.quantity_change then
          raise exception 'TD_COLLECTOR_POSITION_REVIEW_REQUIRED';
        end if;
        if v_ledger_count=0 then
          if v_event.event_type::text <> 'inventory_created'
             or v_event.quantity_after is distinct from v_position.quantity
             or v_event.related_entity_type is distinct from 'chaos_sort_batch'
             or v_event.related_entity_id is distinct from v_position.batch_id::text then
            raise exception 'TD_COLLECTOR_POSITION_REVIEW_REQUIRED';
          end if;
        elsif v_event.event_type::text <> 'quantity_removed'
           or v_event.source::text <> 'collector_workspace'
           or v_event.quantity_change >= 0
           or v_event.created_at <= v_position.updated_at then
          raise exception 'TD_COLLECTOR_POSITION_REVIEW_REQUIRED';
        end if;
        if v_event.quantity_after < 0 then raise exception 'TD_COLLECTOR_POSITION_REVIEW_REQUIRED'; end if;
        v_ledger_quantity:=v_event.quantity_after;
        v_ledger_count:=v_ledger_count+1;
        v_evidence:=v_evidence || jsonb_build_array(v_event.id);
      end loop;
      if v_ledger_count<2 or v_ledger_quantity<>v_before then
        raise exception 'TD_COLLECTOR_POSITION_REVIEW_REQUIRED';
      end if;
      v_alignment:=v_position.quantity-v_before;
    end if;
  end if;
  v_after := v_before - p_quantity;
  if v_position_count=1 then
    update public.chaos_sort_inventory_positions
      set quantity=v_after,status=case when v_after=0 then 'depleted' else 'active' end,updated_at=now()
      where user_id=v_user_id and id=v_position.id and item_id=v_source.id;
  end if;
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
    v_user_id, v_source.workspace_id, v_source.id, 'quantity_removed', p_source, p_idempotency_key, p_idempotency_key,
    v_before, -p_quantity, v_after,
    v_source.location_id, v_source.location_id,
    v_source.card_name, coalesce(v_source.game_id, v_source.data ->> 'gameId'), coalesce(v_source.product_type, v_source.data ->> 'productType'),
    v_source.scryfall_id, v_source.set_code, v_source.collector_number,
    v_source.tcgplayer_product_id, v_source.tcgplayer_sku_id,
    coalesce(v_source.data ->> 'condition', v_source.data ->> 'rawCondition'),
    coalesce(v_source.variant, v_source.data ->> 'finish', v_source.data ->> 'variant'),
    coalesce(v_source.language, v_source.data ->> 'language'),
    v_next_value,
    jsonb_build_object('operation', 'remove_from_collection', 'removedQuantity', p_quantity, 'reason', coalesce(p_reason, 'Removed from collection'),
      'actorId',v_user_id,'positionId',v_position.id,'batchId',v_position.batch_id,
      'positionQuantityBefore',v_position.quantity,'positionQuantityAfter',case when v_position_count=1 then v_after end,
      'historicalRemovalAlignment',v_alignment,'alignmentEventIds',v_evidence)
  );

  return jsonb_build_object('ok', true, 'sourceItemId', v_source.id, 'quantityAfter', v_after);
end;
$$;


revoke all on function public.remove_inventory_lot_quantity(text,integer,text,text,public.inventory_event_source) from public,anon;
grant execute on function public.remove_inventory_lot_quantity(text,integer,text,text,public.inventory_event_source) to authenticated;
notify pgrst, 'reload schema';
