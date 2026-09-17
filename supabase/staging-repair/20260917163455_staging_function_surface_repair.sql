-- Staging-only forward repair for PR #93 validation.
-- This package assumes the live staging comparison has already identified the
-- listed functions as absent. It does not replay historical migrations.
-- Apply this migration only to Trading Docks staging (ukrcbmujzdyclrkghbvo).
-- Apply after 20260917180121_staging_prerequisite_repair.sql and before the
-- three PR #93 production security migrations are considered for staging.
-- Existing staging objects intentionally skipped because the live comparison
-- found them present: admin_feedback_queue, admin_set_membership_override,
-- current_admin_role, is_admin, is_platform_owner,
-- collector_effective_membership_tier, enforce_collector_inventory_mutation,
-- protect_platform_owner, collector_inventory_error_payload,
-- raise_collector_inventory_error, set_tcgplayer_magic_catalog_updated_at,
-- and workspace_role_rank.

-- Fail safely instead of creating or replacing tables, types, indexes, policies,
-- or triggers when staging is materially behind the required inventory surface.
do $$
begin
  if to_regclass('public.inventory_items') is null
     or to_regclass('public.inventory_locations') is null
     or to_regclass('public.inventory_events') is null
     or to_regclass('public.user_roles') is null
     or to_regclass('public.admin_account_access') is null
     or to_regclass('public.admin_audit_log') is null
     or to_regclass('public.admin_membership_overrides') is null
     or to_regclass('public.account_card_usage') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.user_preferences') is null
     or to_regclass('public.billing_subscriptions') is null
     or to_regclass('public.workspace_members') is null
     or not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'admin_role')
     or not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'inventory_event_type')
     or not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'inventory_event_source')
     or to_regprocedure('public.inventory_event_workspace_for_user(uuid)') is null
     or exists (
       select 1
       from unnest(array['provider_category_id', 'provider_product_id', 'provider_sku_id', 'variant', 'language']) as required(column_name)
       where not exists (
         select 1
         from information_schema.columns c
         where c.table_schema = 'public'
           and c.table_name = 'inventory_items'
           and c.column_name = required.column_name
           and c.data_type = 'text'
           and c.is_nullable = 'YES'
       )
     ) then
    raise exception 'Staging prerequisites are incomplete; repair schema prerequisites before applying this function-surface repair.';
  end if;
end;
$$;

create function public.admin_list_users(search_text text default '', result_limit integer default 100)
returns table (
  user_id uuid,
  email text,
  display_name text,
  account_type text,
  subscription_status text,
  role text,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin('support') then
    raise exception 'Admin access required';
  end if;

  return query
    select
      u.id,
      u.email::text,
      coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name')::text,
      coalesce(a.account_type, 'free')::text,
      coalesce(a.subscription_status, 'free')::text,
      r.role::text,
      u.created_at,
      u.last_sign_in_at
    from auth.users u
    left join public.admin_account_access a on a.user_id = u.id
    left join public.user_roles r on r.user_id = u.id
    where coalesce(search_text, '') = ''
       or coalesce(u.email, '') ilike '%' || search_text || '%'
       or coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', '') ilike '%' || search_text || '%'
    order by u.created_at desc
    limit least(greatest(result_limit, 1), 500);
end $$;

create function public.admin_overview()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin('analyst') then
    raise exception 'Admin access required';
  end if;

  return jsonb_build_object(
    'total_users', (select count(*) from auth.users),
    'active_subscriptions', (select count(*) from public.admin_account_access where subscription_status in ('active', 'trialing')),
    'new_users_30d', (select count(*) from auth.users where created_at >= now() - interval '30 days'),
    'admin_users', (select count(*) from public.user_roles)
  );
end $$;

create function public.admin_update_user_access(
  target_user_id uuid,
  next_account_type text,
  next_subscription_status text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor_email_value text;
begin
  if not public.is_admin('admin') then
    raise exception 'Administrator access required';
  end if;
  if next_account_type not in ('free', 'collector', 'seller', 'store') then
    raise exception 'Invalid account type';
  end if;
  if next_subscription_status not in ('free', 'trialing', 'active', 'past_due', 'canceled', 'suspended') then
    raise exception 'Invalid subscription status';
  end if;

  insert into public.admin_account_access(user_id, account_type, subscription_status, updated_at, updated_by)
  values(target_user_id, next_account_type, next_subscription_status, now(), auth.uid())
  on conflict(user_id) do update
  set account_type = excluded.account_type,
      subscription_status = excluded.subscription_status,
      updated_at = now(),
      updated_by = auth.uid();

  select u.email into actor_email_value from auth.users u where u.id = auth.uid();

  insert into public.admin_audit_log(actor_id, actor_email, action, target_type, target_id, metadata)
  values(
    auth.uid(),
    actor_email_value,
    'update_user_access',
    'user',
    target_user_id::text,
    jsonb_build_object('account_type', next_account_type, 'subscription_status', next_subscription_status)
  );
end $$;

create function public.apply_collector_inventory_mutation(
  p_inventory_item_id text,
  p_mutation_type text,
  p_quantity integer default null,
  p_condition text default null,
  p_finish text default null,
  p_location_id text default null,
  p_idempotency_key text default null,
  p_source public.inventory_event_source default 'collector_workspace'
)
returns public.inventory_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_item public.inventory_items%rowtype;
  v_next_data jsonb;
  v_event_type public.inventory_event_type;
  v_quantity_before integer;
  v_quantity_after integer;
  v_previous_value text;
  v_next_value text;
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  select *
  into v_item
  from public.inventory_items i
  where i.user_id = v_user_id
    and i.id = p_inventory_item_id
  for update;

  if not found then
    raise exception 'Collection record not found.' using errcode = 'P0002';
  end if;

  v_quantity_before := coalesce(v_item.quantity, 0);
  v_quantity_after := v_quantity_before;
  v_next_data := coalesce(v_item.data, '{}'::jsonb);

  if p_mutation_type = 'quantity' then
    if p_quantity is null or p_quantity < 0 then
      raise exception 'Quantity must be zero or greater.' using errcode = '22023';
    end if;
    v_quantity_after := p_quantity;
    v_event_type := case
      when v_quantity_after > v_quantity_before then 'quantity_added'::public.inventory_event_type
      when v_quantity_after < v_quantity_before then 'quantity_removed'::public.inventory_event_type
      else 'quantity_adjusted'::public.inventory_event_type
    end;
    update public.inventory_items
    set quantity = v_quantity_after,
        updated_at = now()
    where user_id = v_user_id
      and id = p_inventory_item_id
    returning * into v_item;
  elsif p_mutation_type = 'condition' then
    v_previous_value := public.inventory_event_text_value(v_next_data -> 'condition');
    v_next_value := nullif(trim(coalesce(p_condition, '')), '');
    if v_next_value is null then
      raise exception 'Condition is required.' using errcode = '22023';
    end if;
    v_event_type := 'condition_changed'::public.inventory_event_type;
    v_next_data := jsonb_set(v_next_data, '{condition}', to_jsonb(v_next_value), true);
    update public.inventory_items
    set data = v_next_data,
        updated_at = now()
    where user_id = v_user_id
      and id = p_inventory_item_id
    returning * into v_item;
  elsif p_mutation_type = 'finish' then
    v_previous_value := public.inventory_event_text_value(v_next_data -> 'finish');
    v_next_value := nullif(trim(coalesce(p_finish, '')), '');
    if v_next_value is null then
      raise exception 'Finish is required.' using errcode = '22023';
    end if;
    v_event_type := 'finish_changed'::public.inventory_event_type;
    v_next_data := jsonb_set(v_next_data, '{finish}', to_jsonb(v_next_value), true);
    update public.inventory_items
    set data = v_next_data,
        updated_at = now()
    where user_id = v_user_id
      and id = p_inventory_item_id
    returning * into v_item;
  elsif p_mutation_type = 'storage' then
    if p_location_id is not null and not exists (
      select 1
      from public.inventory_locations l
      where l.user_id = v_user_id
        and l.id = p_location_id
    ) then
      raise exception 'Choose one of your storage locations.' using errcode = 'P0002';
    end if;
    v_event_type := 'location_changed'::public.inventory_event_type;
    v_previous_value := v_item.location_id;
    v_next_value := p_location_id;
    v_next_data := jsonb_set(v_next_data, '{locationId}', coalesce(to_jsonb(p_location_id), 'null'::jsonb), true);
    update public.inventory_items
    set location_id = p_location_id,
        data = v_next_data,
        updated_at = now()
    where user_id = v_user_id
      and id = p_inventory_item_id
    returning * into v_item;
  else
    raise exception 'Unsupported inventory mutation.' using errcode = '22023';
  end if;

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
    previous_value,
    next_value,
    previous_location_id,
    next_location_id,
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
    public.inventory_event_workspace_for_user(v_user_id),
    v_item.id,
    v_event_type,
    p_source,
    p_idempotency_key,
    null,
    null,
    v_quantity_before,
    v_quantity_after - v_quantity_before,
    v_quantity_after,
    v_previous_value,
    v_next_value,
    case when p_mutation_type = 'storage' then v_previous_value else null end,
    case when p_mutation_type = 'storage' then v_next_value else null end,
    v_item.inventory_value,
    case when v_item.inventory_value is null then null else v_item.inventory_value * greatest(v_quantity_after, 0) end,
    v_item.card_name,
    coalesce(v_item.game_id, v_item.data ->> 'gameId'),
    coalesce(v_item.product_type, v_item.data ->> 'productType'),
    v_item.scryfall_id,
    v_item.set_code,
    v_item.collector_number,
    coalesce(v_item.tcgplayer_product_id, nullif(v_item.data ->> 'tcgplayerProductId', '')::bigint),
    coalesce(v_item.tcgplayer_sku_id, nullif(v_item.data ->> 'tcgplayerSkuId', '')::bigint),
    coalesce(v_item.data ->> 'condition', v_item.data ->> 'rawCondition'),
    coalesce(v_item.data ->> 'finish', v_item.data ->> 'variant'),
    coalesce(v_item.language, v_item.data ->> 'language'),
    p_idempotency_key,
    '{}'::jsonb
  )
  on conflict (user_id, idempotency_key) where idempotency_key is not null do nothing;

  return v_item;
end;
$$;

create function public.create_inventory_item_with_event(
  p_inventory jsonb,
  p_source public.inventory_event_source default 'manual',
  p_idempotency_key text default null,
  p_related_entity_type text default null,
  p_related_entity_id text default null
)
returns public.inventory_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_item public.inventory_items%rowtype;
  v_item_id text := coalesce(nullif(p_inventory ->> 'id', ''), gen_random_uuid()::text);
  v_quantity integer := greatest(0, coalesce(nullif(p_inventory ->> 'quantity', '')::integer, 0));
  v_location_id text := nullif(p_inventory ->> 'location_id', '');
  v_data jsonb := coalesce(p_inventory -> 'data', '{}'::jsonb);
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  if v_location_id is not null and not exists (
    select 1
    from public.inventory_locations l
    where l.user_id = v_user_id
      and l.id = v_location_id
  ) then
    raise exception 'Choose one of your storage locations.' using errcode = 'P0002';
  end if;

  insert into public.inventory_items (
    id,
    user_id,
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
    coalesce(nullif(p_inventory ->> 'card_name', ''), 'Unknown card'),
    coalesce(nullif(p_inventory ->> 'sku', ''), v_item_id),
    v_location_id,
    nullif(p_inventory ->> 'scryfall_id', ''),
    nullif(p_inventory ->> 'set_code', ''),
    nullif(p_inventory ->> 'collector_number', ''),
    v_quantity,
    coalesce(nullif(p_inventory ->> 'inventory_value', '')::numeric, 0),
    v_data,
    nullif(p_inventory ->> 'game_id', ''),
    nullif(p_inventory ->> 'product_type', ''),
    nullif(p_inventory ->> 'provider_category_id', ''),
    nullif(p_inventory ->> 'provider_product_id', ''),
    nullif(p_inventory ->> 'provider_sku_id', ''),
    nullif(p_inventory ->> 'tcgplayer_product_id', '')::bigint,
    nullif(p_inventory ->> 'tcgplayer_sku_id', '')::bigint,
    nullif(p_inventory ->> 'variant', ''),
    nullif(p_inventory ->> 'language', ''),
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
    public.inventory_event_workspace_for_user(v_user_id),
    v_item.id,
    case when p_source in ('csv_import', 'tcgplayer_import', 'ebay_import', 'shopify_import', 'scanner_replay') then 'imported'::public.inventory_event_type else 'inventory_created'::public.inventory_event_type end,
    p_source,
    p_idempotency_key,
    p_related_entity_type,
    p_related_entity_id,
    null,
    v_item.quantity,
    v_item.quantity,
    'created',
    v_item.location_id,
    nullif(v_data ->> 'costBasis', '')::numeric,
    nullif(v_data ->> 'totalCostBasis', '')::numeric,
    v_item.inventory_value,
    v_item.inventory_value * greatest(v_item.quantity, 0),
    v_item.card_name,
    coalesce(v_item.game_id, v_item.data ->> 'gameId'),
    coalesce(v_item.product_type, v_item.data ->> 'productType'),
    v_item.scryfall_id,
    v_item.set_code,
    v_item.collector_number,
    coalesce(v_item.tcgplayer_product_id, nullif(v_item.data ->> 'tcgplayerProductId', '')::bigint),
    coalesce(v_item.tcgplayer_sku_id, nullif(v_item.data ->> 'tcgplayerSkuId', '')::bigint),
    coalesce(v_item.data ->> 'condition', v_item.data ->> 'rawCondition'),
    coalesce(v_item.data ->> 'finish', v_item.data ->> 'variant'),
    coalesce(v_item.language, v_item.data ->> 'language'),
    p_idempotency_key,
    '{}'::jsonb
  )
  on conflict (user_id, idempotency_key) where idempotency_key is not null do nothing;

  return v_item;
end;
$$;

create function public.move_inventory_lot_quantity(
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

create function public.remove_inventory_lot_quantity(
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

create function public.inventory_events_block_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('app.inventory_events_maintenance', true), '') = 'on' then
    return coalesce(new, old);
  end if;
  raise exception 'inventory_events is append-only';
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.inventory_events'::regclass
      and tgname = 'inventory_events_append_only'
      and not tgisinternal
  ) then
    create trigger inventory_events_append_only
      before delete or update on public.inventory_events
      for each row execute function public.inventory_events_block_mutation();
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.inventory_events'::regclass
      and tgname = 'inventory_events_append_only'
      and not tgisinternal
  ) then
    raise exception 'Staging append-only trigger was not created';
  end if;
end;
$$;

create function public.inventory_event_text_value(p_value jsonb)
returns text
language sql
immutable
as $$
  select case
    when p_value is null then null
    when jsonb_typeof(p_value) = 'string' then trim(both '"' from p_value::text)
    else p_value::text
  end;
$$;

create function public.collector_inventory_acting_user()
returns uuid
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.uid(), nullif(current_setting('app.collector_authorized_user_id', true), '')::uuid);
$$;

create function public.admin_directory()
returns table (
  id uuid,
  email text,
  full_name text,
  membership_level text,
  membership_override text,
  card_units bigint,
  unique_inventory_rows integer,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  usage_updated_at timestamptz
)
language sql
security definer
set search_path = pg_catalog
as $$
  select
    u.id,
    u.email::text,
    p.full_name,
    case
      -- Platform ownership is trusted authority, not a billing subscription.
      -- Store is the existing full-access commercial equivalent used by the UI.
      when exists (
        select 1
        from public.user_roles ur
        where ur.user_id = u.id
          and ur.role = 'owner'
      ) then 'store'
      when amo.plan_id is not null then amo.plan_id
      when bs.status in ('active', 'trialing') then bs.plan_id
      when bs.status = 'past_due'
        and bs.current_period_end is not null
        and bs.current_period_end > now() then bs.plan_id
      else 'free'
    end as membership_level,
    amo.plan_id as membership_override,
    coalesce(acu.card_units, 0)::bigint,
    coalesce(acu.unique_inventory_rows, 0)::integer,
    u.created_at,
    u.last_sign_in_at,
    acu.updated_at
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.billing_subscriptions bs on bs.user_id = u.id
  left join public.admin_membership_overrides amo on amo.user_id = u.id
  left join public.account_card_usage acu on acu.user_id = u.id
  where public.is_platform_owner()
  order by u.created_at desc;
$$;

create function public.set_tcgtracking_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.admin_directory() from public, anon;
grant execute on function public.admin_directory() to authenticated;
revoke all on function public.admin_list_users(text, integer) from public, anon;
grant execute on function public.admin_list_users(text, integer) to authenticated;
revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;
revoke all on function public.admin_update_user_access(uuid, text, text) from public, anon;
grant execute on function public.admin_update_user_access(uuid, text, text) to authenticated;
revoke all on function public.apply_collector_inventory_mutation(text, text, integer, text, text, text, text, public.inventory_event_source) from public, anon;
grant execute on function public.apply_collector_inventory_mutation(text, text, integer, text, text, text, text, public.inventory_event_source) to authenticated;
revoke all on function public.create_inventory_item_with_event(jsonb, public.inventory_event_source, text, text, text) from public, anon;
grant execute on function public.create_inventory_item_with_event(jsonb, public.inventory_event_source, text, text, text) to authenticated;
revoke all on function public.move_inventory_lot_quantity(text, integer, text, text, public.inventory_event_source) from public, anon;
grant execute on function public.move_inventory_lot_quantity(text, integer, text, text, public.inventory_event_source) to authenticated;
revoke all on function public.remove_inventory_lot_quantity(text, integer, text, text, public.inventory_event_source) from public, anon;
grant execute on function public.remove_inventory_lot_quantity(text, integer, text, text, public.inventory_event_source) to authenticated;
revoke all on function public.inventory_events_block_mutation() from public, anon, authenticated;
revoke all on function public.inventory_event_text_value(jsonb) from public, anon, authenticated;
revoke all on function public.collector_inventory_acting_user() from public, anon, authenticated;
revoke all on function public.set_tcgtracking_updated_at() from public, anon, authenticated;

notify pgrst, 'reload schema';
