-- PROPOSAL: apply only after explicit approval and staging verification.
-- Both RPCs are server-only. The API must resolve capabilities before passing
-- the authenticated actor. No browser-supplied user ID is trusted.
begin;

do $$ begin
  if to_regprocedure('public.collector_inventory_acting_user()') is null
    or not exists (select 1 from pg_trigger where tgrelid = 'public.inventory_items'::regclass
      and tgname = 'enforce_collector_inventory_mutation_insert' and tgenabled <> 'D') then
    raise exception 'Apply and verify the existing collector inventory security migrations first.';
  end if;
end $$;

create table if not exists public.inventory_import_commits (
  user_id uuid not null references auth.users(id) on delete cascade,
  import_key text not null,
  payload jsonb not null,
  result jsonb not null,
  committed_at timestamptz not null default now(),
  primary key (user_id, import_key)
);
alter table public.inventory_import_commits enable row level security;
revoke all on public.inventory_import_commits from public, anon, authenticated;
grant select, insert on public.inventory_import_commits to service_role;

create or replace function public.commit_order_fulfillment(
  actor_id uuid, order_ids uuid[], requested_action text, details jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  ord public.marketplace_orders%rowtype;
  line public.marketplace_order_items%rowtype;
  item public.inventory_items%rowtype;
  stage text;
  next_status text;
  shipping boolean;
  matches integer;
  matched integer := 0;
  shortages integer := 0;
  picked integer;
  stamp timestamptz := now();
  movement_id text;
  result_orders jsonb := '[]'::jsonb;
begin
  if actor_id is null or coalesce(cardinality(order_ids), 0) not between 1 and 250
    or array_position(order_ids, null) is not null then
    raise exception 'Choose between 1 and 250 orders.' using errcode = '22023';
  end if;
  if requested_action not in ('match','start_pulling','mark_picked','pack','ship','complete',
    'status:new','status:processing','status:shipped','status:delivered','status:cancelled','status:refunded') then
    raise exception 'Choose a supported fulfillment action.' using errcode = '22023';
  end if;
  -- Same lock namespace as the inventory guard; serialize before taking rows.
  perform pg_advisory_xact_lock(hashtextextended('collector-inventory:' || actor_id::text, 0));
  perform set_config('app.collector_authorized_user_id', actor_id::text, true);
  perform 1 from public.marketplace_orders where user_id = actor_id and id = any(order_ids) order by id for update;
  if (select count(*) from public.marketplace_orders where user_id = actor_id and id = any(order_ids))
      <> (select count(distinct id) from unnest(order_ids) as ids(id)) then
    raise exception 'Order not found.' using errcode = 'P0002';
  end if;
  shipping := requested_action in ('ship','complete','status:shipped','status:delivered');
  for ord in select * from public.marketplace_orders where user_id = actor_id and id = any(order_ids) order by id loop
    perform 1 from public.marketplace_order_items where user_id = actor_id and marketplace_order_id = ord.id order by id for update;
    if shipping then
      if ord.normalized_status in ('cancelled','refunded') then
        raise exception 'Cancelled or refunded orders cannot be fulfilled.' using errcode = 'P0001';
      end if;
      if not exists (select 1 from public.marketplace_order_items where user_id = actor_id and marketplace_order_id = ord.id) then
        raise exception 'An order must have inventory lines before fulfillment.' using errcode = 'P0001';
      end if;
      for line in select * from public.marketplace_order_items where user_id = actor_id and marketplace_order_id = ord.id order by id loop
        movement_id := 'fulfillment:' || line.id::text;
        if line.inventory_deducted_at is not null then
          -- Older partial/ambiguous writes require reconciliation, never guessing.
          if not exists (select 1 from public.inventory_movements m where m.user_id = actor_id and m.id = movement_id
            and m.data->>'inventoryItemId' = line.inventory_item_id
            and (m.data->>'quantity')::integer = -line.quantity) then
            raise exception 'Existing deduction requires inventory reconciliation before retry.' using errcode = 'P0001';
          end if;
          continue;
        end if;
        if ord.fulfillment_stage in ('shipped','completed') or ord.normalized_status in ('shipped','delivered') then
          raise exception 'Previously shipped order requires inventory reconciliation.' using errcode = 'P0001';
        end if;
        select * into item from public.inventory_items where user_id = actor_id and id = line.inventory_item_id for update;
        if not found or item.quantity < line.quantity then
          raise exception 'Match each order line to sufficient owned inventory before shipping.' using errcode = 'P0001';
        end if;
        update public.inventory_items set quantity = quantity - line.quantity,
          inventory_value = case when quantity > 0 then round(inventory_value * (quantity - line.quantity) / quantity,2) else 0 end,
          data = data || jsonb_build_object('quantity', quantity - line.quantity,
            'value', case when quantity > 0 then round(inventory_value * (quantity - line.quantity) / quantity,2) else 0 end),
          updated_at = stamp where user_id = actor_id and id = item.id;
        insert into public.inventory_movements(id,user_id,item_name,occurred_at,data) values
          (movement_id,actor_id,item.card_name,stamp,jsonb_build_object('id',movement_id,'itemName',item.card_name,
            'action','order_fulfilled','order_id',ord.id,'orderLineId',line.id,'inventoryItemId',item.id,
            'quantity',-line.quantity,'timestamp',stamp));
        update public.marketplace_order_items set inventory_deducted_at = stamp, updated_at = stamp
          where user_id = actor_id and id = line.id;
      end loop;
      stage := case when requested_action in ('complete','status:delivered') or ord.fulfillment_stage = 'completed' or ord.normalized_status = 'delivered' then 'completed' else 'shipped' end;
      next_status := case when stage = 'completed' then 'delivered' else 'shipped' end;
      update public.marketplace_orders set fulfillment_stage = stage, normalized_status = next_status,
        shipped_at = coalesce(shipped_at,stamp),
        delivered_at = case when stage = 'completed' then coalesce(delivered_at,stamp) else delivered_at end,
        tracking_number = coalesce(nullif(trim(details->>'trackingNumber'),''),tracking_number),
        shipping_carrier = coalesce(nullif(trim(details->>'carrier'),''),shipping_carrier), updated_at = stamp
        where user_id = actor_id and id = ord.id;
      update public.inventory_locations l set data = l.data || jsonb_build_object(
        'itemCount',(select coalesce(sum(quantity),0) from public.inventory_items where user_id = actor_id and location_id = l.id),
        'estimatedValue',(select coalesce(sum(inventory_value),0) from public.inventory_items where user_id = actor_id and location_id = l.id)), updated_at = stamp
        where l.user_id = actor_id and l.id in (
          select i.location_id from public.inventory_items i join public.marketplace_order_items li
            on li.user_id = i.user_id and li.inventory_item_id = i.id
          where li.user_id = actor_id and li.marketplace_order_id = ord.id);
    else
      if requested_action <> 'status:refunded' and (ord.fulfillment_stage in ('shipped','completed') or exists (
        select 1 from public.marketplace_order_items where user_id = actor_id and marketplace_order_id = ord.id and inventory_deducted_at is not null
      )) then
        raise exception 'Fulfilled inventory requires reconciliation before changing this order.' using errcode = 'P0001';
      end if;
      if requested_action = 'match' then
        for line in select * from public.marketplace_order_items where user_id = actor_id and marketplace_order_id = ord.id order by id loop
          select count(*) into matches from public.inventory_items i where i.user_id = actor_id and i.quantity >= line.quantity
            and ((nullif(trim(line.external_sku),'') is not null and lower(i.sku) = lower(trim(line.external_sku)))
              or (nullif(trim(line.external_sku),'') is null and lower(i.card_name) = lower(trim(line.title))));
          item := null;
          if matches = 1 then
            select * into item from public.inventory_items i where i.user_id = actor_id and i.quantity >= line.quantity
              and ((nullif(trim(line.external_sku),'') is not null and lower(i.sku) = lower(trim(line.external_sku)))
                or (nullif(trim(line.external_sku),'') is null and lower(i.card_name) = lower(trim(line.title))));
          end if;
          update public.marketplace_order_items set inventory_item_id = item.id,
            match_status = case when item.id is not null then 'matched' else 'unmatched' end,
            inventory_reserved_quantity = case when item.id is not null then line.quantity else 0 end, updated_at = stamp
            where user_id = actor_id and id = line.id;
          if item.id is null then shortages := shortages + 1; else matched := matched + 1; end if;
        end loop;
        stage := case when shortages > 0 or matched = 0 then 'needs_review' else 'ready_to_pull' end;
      elsif requested_action = 'mark_picked' then
        select * into line from public.marketplace_order_items where user_id = actor_id and marketplace_order_id = ord.id and id = (details->>'itemId')::uuid;
        if not found then raise exception 'Order item not found.' using errcode = 'P0002'; end if;
        -- Set, do not toggle: repeated requests have the same outcome.
        picked := line.quantity;
        update public.marketplace_order_items set picked_quantity = picked, updated_at = stamp where user_id = actor_id and id = line.id;
        stage := ord.fulfillment_stage;
      else
        stage := case requested_action when 'start_pulling' then 'pulling' when 'pack' then 'packed' else ord.fulfillment_stage end;
      end if;
      next_status := case when requested_action like 'status:%' then substring(requested_action from 8) else ord.normalized_status end;
      update public.marketplace_orders set fulfillment_stage = stage, normalized_status = next_status,
        pull_started_at = case when requested_action = 'start_pulling' then coalesce(pull_started_at,stamp) else pull_started_at end,
        packed_at = case when requested_action = 'pack' then coalesce(packed_at,stamp) else packed_at end, updated_at = stamp
        where user_id = actor_id and id = ord.id;
    end if;
    result_orders := result_orders || jsonb_build_array(jsonb_build_object('id',ord.id,'normalized_status',next_status,'fulfillment_stage',stage));
  end loop;
  return jsonb_build_object('ok',true,'updated',jsonb_array_length(result_orders),'orders',result_orders,'stage',stage,'matched',matched,'shortages',shortages,'picked',picked);
end;
$$;

create or replace function public.commit_csv_inventory_import(actor_id uuid, import_key text, payload jsonb)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare
  receipt public.inventory_import_commits%rowtype;
  location public.inventory_locations%rowtype;
  row_data jsonb;
  item_data jsonb;
  item_id text;
  movement_id text;
  row_index integer := 0;
  units bigint := 0;
  quantity_value integer;
  unit_value numeric;
  location_name text := trim(payload->>'locationName');
  batch_id text := 'csv:' || import_key;
  stamp timestamptz := now();
  result jsonb;
begin
  if actor_id is null or import_key is null or import_key !~ '^[a-f0-9]{64}$'
    or coalesce(length(location_name),0) not between 1 and 160
    or jsonb_typeof(payload->'items') is distinct from 'array' then
    raise exception 'Invalid inventory import.' using errcode = '22023';
  end if;
  if jsonb_array_length(payload->'items') not between 1 and 5000 then
    raise exception 'Import between 1 and 5000 rows at a time.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('collector-inventory:' || actor_id::text,0));
  perform set_config('app.collector_authorized_user_id',actor_id::text,true);
  select * into receipt from public.inventory_import_commits c where c.user_id = actor_id and c.import_key = commit_csv_inventory_import.import_key;
  if found then
    if (receipt.payload - 'locationName') <> (payload - 'locationName')
      or lower(receipt.payload->>'locationName') <> lower(location_name) then
      raise exception 'Import identity conflicts with its original contents.' using errcode = '22023';
    end if;
    return receipt.result || jsonb_build_object('duplicate',true);
  end if;
  if (select count(*) from public.inventory_locations where user_id = actor_id and lower(trim(name)) = lower(location_name)) > 1 then
    raise exception 'Multiple locations have this name. Choose an unambiguous location.' using errcode = 'P0001';
  end if;
  select * into location from public.inventory_locations where user_id = actor_id and lower(trim(name)) = lower(location_name) for update;
  if not found then
    insert into public.inventory_locations(id,user_id,name,location_type,data)
      values ('csv-location:' || md5(lower(location_name)),actor_id,location_name,'custom',
        jsonb_build_object('id','csv-location:' || md5(lower(location_name)),'name',location_name,'type','custom','itemCount',0,'estimatedValue',0))
      returning * into location;
  end if;
  for row_data in select value from jsonb_array_elements(payload->'items') loop
    if jsonb_typeof(row_data->'quantity') is distinct from 'number'
      or (row_data->>'quantity')::numeric <> trunc((row_data->>'quantity')::numeric)
      or coalesce(length(trim(row_data->>'name')),0) = 0 then
      raise exception 'Each imported card needs a name and whole quantity.' using errcode = '22023';
    end if;
    quantity_value := (row_data->>'quantity')::integer;
    unit_value := (row_data->>'unitMarketValue')::numeric;
    if quantity_value <= 0 or unit_value is null or unit_value < 0 then raise exception 'Invalid import quantity or value.' using errcode = '22023'; end if;
    row_index := row_index + 1;
    item_id := batch_id || ':' || row_index::text;
    movement_id := item_id || ':received';
    item_data := row_data || jsonb_build_object('id',item_id,'locationId',location.id,'importBatchId',batch_id,
      'value',unit_value * quantity_value,'updatedAt',stamp);
    insert into public.inventory_items(id,user_id,card_name,sku,location_id,scryfall_id,set_code,collector_number,quantity,inventory_value,data)
      values (item_id,actor_id,row_data->>'name',coalesce(nullif(row_data->>'sku',''),item_id),location.id,
        nullif(row_data->>'scryfallId',''),row_data->>'set',row_data->>'collectorNumber',quantity_value,unit_value * quantity_value,item_data);
    insert into public.inventory_movements(id,user_id,item_name,occurred_at,data) values
      (movement_id,actor_id,row_data->>'name',stamp,jsonb_build_object('id',movement_id,'itemName',row_data->>'name',
        'inventoryItemId',item_id,'to',location.name,'quantity',quantity_value,'action','filed','timestamp',stamp,'importBatchId',batch_id));
    units := units + quantity_value;
  end loop;
  update public.inventory_locations l set data = l.data || jsonb_build_object(
    'itemCount',(select coalesce(sum(quantity),0) from public.inventory_items where user_id = actor_id and location_id = location.id),
    'estimatedValue',(select coalesce(sum(inventory_value),0) from public.inventory_items where user_id = actor_id and location_id = location.id)),
    updated_at = stamp where l.user_id = actor_id and l.id = location.id;
  result := jsonb_build_object('ok',true,'duplicate',false,'batchId',batch_id,'locationId',location.id,'locationName',location.name,'rows',row_index,'units',units);
  insert into public.inventory_import_commits(user_id,import_key,payload,result) values (actor_id,import_key,payload,result);
  return result;
end;
$$;

revoke all on function public.commit_order_fulfillment(uuid,uuid[],text,jsonb) from public, anon, authenticated;
revoke all on function public.commit_csv_inventory_import(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.commit_order_fulfillment(uuid,uuid[],text,jsonb) to service_role;
grant execute on function public.commit_csv_inventory_import(uuid,text,jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
