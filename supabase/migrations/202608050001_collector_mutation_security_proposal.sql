-- PROPOSAL ONLY: do not apply to production without staging replay and review.
-- Enforces Collector Workspace ownership and Free-plan total-card quantity limits
-- for direct authenticated inventory writes, web writes, and mobile offline replay.

create or replace function public.collector_effective_membership_tier(target_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  with override as (
    select case when plan_id = 'business' then 'store' else plan_id end as plan_id
    from public.admin_membership_overrides
    where user_id = target_user_id
  ),
  subscription as (
    select
      case when plan_id = 'business' then 'store' else plan_id end as plan_id,
      status,
      current_period_end
    from public.billing_subscriptions
    where user_id = target_user_id
  ),
  identity_ready as (
    select exists (
      select 1
      from public.profiles
      where id = target_user_id
    ) and exists (
      select 1
      from public.user_preferences
      where user_id = target_user_id
    ) as ready
  )
  select coalesce(
    (select plan_id from override where plan_id in ('free', 'collector', 'seller', 'store')),
    (
      select plan_id
      from subscription
      where plan_id in ('free', 'collector', 'seller', 'store')
        and (
          status in ('active', 'trialing')
          or (
            status = 'past_due'
            and current_period_end is not null
            and current_period_end > now()
          )
        )
    ),
    case when (select ready from identity_ready) then 'free' else null end
  )
  where (select ready from identity_ready);
$$;

create or replace function public.collector_inventory_error_payload(
  error_code text,
  message text,
  target_user_id uuid default null
)
returns jsonb
language sql
immutable
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'code', error_code,
    'message', message,
    'userId', target_user_id
  ));
$$;

create or replace function public.raise_collector_inventory_error(
  error_code text,
  message text,
  target_user_id uuid default null
)
returns void
language plpgsql
as $$
begin
  raise exception '%', error_code
    using
      errcode = 'P0001',
      detail = public.collector_inventory_error_payload(error_code, message, target_user_id)::text,
      hint = message;
end;
$$;

create or replace function public.enforce_collector_inventory_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  acting_user_id uuid;
  target_user_id uuid;
  effective_tier text;
  existing_quantity_total bigint;
  previous_quantity_total bigint;
  next_quantity_total bigint;
begin
  acting_user_id := auth.uid();

  if tg_op = 'DELETE' then
    target_user_id := old.user_id;
  else
    target_user_id := new.user_id;
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

  -- Serialize inventory quantity checks for this user so simultaneous direct
  -- writes and offline replay cannot race past the Free-plan total quantity cap.
  perform pg_advisory_xact_lock(hashtextextended('collector-inventory:' || target_user_id::text, 0));

  effective_tier := public.collector_effective_membership_tier(target_user_id);

  if effective_tier is null then
    perform public.raise_collector_inventory_error(
      'TD_COLLECTOR_MISSING_MEMBERSHIP',
      'Membership could not be resolved for this collection mutation.',
      target_user_id
    );
  end if;

  if effective_tier = 'free' then
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

    if next_quantity_total > 500
      and (tg_op = 'INSERT' or next_quantity_total > previous_quantity_total) then
      perform public.raise_collector_inventory_error(
        'TD_COLLECTOR_FREE_LIMIT_EXCEEDED',
        'Free plan collections are limited to 500 total owned cards.',
        target_user_id
      );
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists enforce_collector_inventory_mutation_insert on public.inventory_items;
create trigger enforce_collector_inventory_mutation_insert
before insert on public.inventory_items
for each row execute function public.enforce_collector_inventory_mutation();

drop trigger if exists enforce_collector_inventory_mutation_update on public.inventory_items;
create trigger enforce_collector_inventory_mutation_update
before update on public.inventory_items
for each row execute function public.enforce_collector_inventory_mutation();

drop trigger if exists enforce_collector_inventory_mutation_delete on public.inventory_items;
create trigger enforce_collector_inventory_mutation_delete
before delete on public.inventory_items
for each row execute function public.enforce_collector_inventory_mutation();

create or replace function public.collector_mutate_inventory_item(operation jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  acting_user_id uuid := auth.uid();
  operation_type text := operation ->> 'type';
  inventory_item_id text := operation ->> 'inventoryItemId';
  next_quantity_numeric numeric;
  next_quantity integer;
  next_condition text;
  next_finish text;
  next_storage_location_id text;
  item_data jsonb;
begin
  if acting_user_id is null then
    perform public.raise_collector_inventory_error(
      'TD_COLLECTOR_UNAUTHORIZED',
      'Authentication is required to mutate collection records.',
      null
    );
  end if;

  if inventory_item_id is null or length(trim(inventory_item_id)) = 0 then
    perform public.raise_collector_inventory_error(
      'TD_COLLECTOR_INVALID_MUTATION',
      'Choose a valid collection record.',
      acting_user_id
    );
  end if;

  select data
  into item_data
  from public.inventory_items
  where user_id = acting_user_id
    and id = inventory_item_id
  for update;

  if not found then
    perform public.raise_collector_inventory_error(
      'TD_COLLECTOR_UNAUTHORIZED',
      'Collection record was not found for this user.',
      acting_user_id
    );
  end if;

  if operation_type = 'quantity' then
    if jsonb_typeof(operation -> 'quantity') <> 'number' then
      perform public.raise_collector_inventory_error(
        'TD_COLLECTOR_INVALID_QUANTITY',
        'Quantity must be a whole number at or above zero.',
        acting_user_id
      );
    end if;
    next_quantity_numeric := (operation ->> 'quantity')::numeric;
    if next_quantity_numeric < 0 or trunc(next_quantity_numeric) <> next_quantity_numeric then
      perform public.raise_collector_inventory_error(
        'TD_COLLECTOR_INVALID_QUANTITY',
        'Quantity must be a whole number at or above zero.',
        acting_user_id
      );
    end if;
    next_quantity := next_quantity_numeric::integer;
    update public.inventory_items
    set quantity = next_quantity
    where user_id = acting_user_id
      and id = inventory_item_id;
  elsif operation_type = 'condition' then
    next_condition := operation ->> 'condition';
    if next_condition not in ('near_mint', 'lightly_played', 'moderately_played', 'heavily_played', 'damaged', 'unknown') then
      perform public.raise_collector_inventory_error('TD_COLLECTOR_INVALID_CONDITION', 'Choose a supported condition.', acting_user_id);
    end if;
    update public.inventory_items
    set data = coalesce(item_data, '{}'::jsonb) || jsonb_build_object('condition', next_condition)
    where user_id = acting_user_id
      and id = inventory_item_id;
  elsif operation_type = 'finish' then
    next_finish := operation ->> 'finish';
    if next_finish not in ('normal', 'foil', 'etched', 'showcase', 'extended_art', 'borderless', 'serialized', 'unknown') then
      perform public.raise_collector_inventory_error('TD_COLLECTOR_INVALID_FINISH', 'Choose a supported finish.', acting_user_id);
    end if;
    update public.inventory_items
    set data = coalesce(item_data, '{}'::jsonb) || jsonb_build_object('finish', next_finish)
    where user_id = acting_user_id
      and id = inventory_item_id;
  elsif operation_type = 'storage' then
    next_storage_location_id := operation ->> 'storageLocationId';
    if next_storage_location_id is not null and not exists (
      select 1
      from public.inventory_locations
      where user_id = acting_user_id
        and id = next_storage_location_id
    ) then
      perform public.raise_collector_inventory_error('TD_COLLECTOR_UNAUTHORIZED', 'Choose one of your storage locations.', acting_user_id);
    end if;
    update public.inventory_items
    set
      location_id = next_storage_location_id,
      data = coalesce(item_data, '{}'::jsonb) || jsonb_build_object('locationId', next_storage_location_id)
    where user_id = acting_user_id
      and id = inventory_item_id;
  else
    perform public.raise_collector_inventory_error(
      'TD_COLLECTOR_INVALID_MUTATION',
      'Choose a supported collection mutation.',
      acting_user_id
    );
  end if;

  return jsonb_build_object('ok', true, 'inventoryItemId', inventory_item_id);
end;
$$;

revoke all on function public.collector_effective_membership_tier(uuid) from public;
grant execute on function public.collector_effective_membership_tier(uuid) to authenticated;

revoke all on function public.collector_mutate_inventory_item(jsonb) from public;
grant execute on function public.collector_mutate_inventory_item(jsonb) to authenticated;

comment on function public.enforce_collector_inventory_mutation() is
  'Proposal: transactionally enforces owned inventory mutations and Free-plan 500 total-card quantity cap.';
comment on function public.collector_mutate_inventory_item(jsonb) is
  'Proposal: authoritative inventory mutation RPC for mobile/web/offline replay. Direct table writes remain guarded by trigger.';
