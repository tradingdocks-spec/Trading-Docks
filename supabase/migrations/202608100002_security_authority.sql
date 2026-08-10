-- Production authority hardening for inventory limits and credential rotation metadata.
-- Forward-only. Do not apply to production before staging replay succeeds.

alter table if exists public.marketplace_credentials
  add column if not exists encryption_algorithm text not null default 'aes-256-gcm',
  add column if not exists encryption_key_version text not null default 'v1';

alter table if exists public.platform_marketplace_integrations
  add column if not exists encryption_algorithm text not null default 'aes-256-gcm',
  add column if not exists encryption_key_version text not null default 'v1';

do $$
begin
  alter table public.marketplace_credentials
    add constraint marketplace_credentials_encryption_algorithm_chk
    check (encryption_algorithm = 'aes-256-gcm');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.platform_marketplace_integrations
    add constraint platform_marketplace_integrations_encryption_algorithm_chk
    check (encryption_algorithm = 'aes-256-gcm');
exception
  when duplicate_object then null;
end $$;

create index if not exists inventory_items_user_quantity_idx
  on public.inventory_items(user_id, quantity);

create or replace function public.collector_inventory_acting_user()
returns uuid
language sql
stable
set search_path = ''
as $$
  select coalesce(
    auth.uid(),
    nullif(current_setting('app.collector_authorized_user_id', true), '')::uuid
  );
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
  acting_user_id := public.collector_inventory_acting_user();

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

create or replace function public.collector_mutate_inventory_item(operation jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  acting_user_id uuid := public.collector_inventory_acting_user();
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

create or replace function public.collector_service_mutate_inventory_item(
  target_user_id uuid,
  operation jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_authorized_user_id text;
  result jsonb;
begin
  if target_user_id is null then
    perform public.raise_collector_inventory_error(
      'TD_COLLECTOR_UNAUTHORIZED',
      'A target user is required for service collection mutations.',
      null
    );
  end if;

  previous_authorized_user_id := current_setting('app.collector_authorized_user_id', true);
  perform set_config('app.collector_authorized_user_id', target_user_id::text, true);
  result := public.collector_mutate_inventory_item(operation);
  perform set_config('app.collector_authorized_user_id', coalesce(previous_authorized_user_id, ''), true);
  return result;
exception
  when others then
    perform set_config('app.collector_authorized_user_id', coalesce(previous_authorized_user_id, ''), true);
    raise;
end;
$$;

revoke all on function public.collector_inventory_acting_user() from public;
grant execute on function public.collector_inventory_acting_user() to authenticated;
grant execute on function public.collector_inventory_acting_user() to service_role;

revoke all on function public.collector_service_mutate_inventory_item(uuid, jsonb) from public;
revoke all on function public.collector_service_mutate_inventory_item(uuid, jsonb) from authenticated;
grant execute on function public.collector_service_mutate_inventory_item(uuid, jsonb) to service_role;

comment on function public.enforce_collector_inventory_mutation() is
  'Authoritatively enforces owned inventory mutations and the Free-plan 500 total-card quantity cap with a per-user transaction lock.';

comment on function public.collector_mutate_inventory_item(jsonb) is
  'Authoritative authenticated inventory mutation RPC for mobile, web, and offline replay. Direct table writes remain guarded by trigger.';

comment on function public.collector_service_mutate_inventory_item(uuid, jsonb) is
  'Service-role-only inventory mutation RPC for trusted imports that must still pass ownership, membership, and quantity enforcement.';

notify pgrst, 'reload schema';
