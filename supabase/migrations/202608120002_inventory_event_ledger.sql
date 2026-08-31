-- Trading Docks production inventory event ledger.
-- Forward-only, additive infrastructure for trusted inventory history.
-- Existing inventory is not backfilled: this ledger records changes after deployment.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'inventory_event_type') then
    create type public.inventory_event_type as enum (
      'inventory_created',
      'quantity_added',
      'quantity_removed',
      'quantity_adjusted',
      'location_changed',
      'condition_changed',
      'finish_changed',
      'cost_basis_changed',
      'inventory_archived',
      'inventory_restored',
      'imported'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'inventory_event_source') then
    create type public.inventory_event_source as enum (
      'collector_workspace',
      'manual',
      'mobile',
      'scanner',
      'scanner_replay',
      'purchasing_intelligence',
      'csv_import',
      'tcgplayer_import',
      'ebay_import',
      'shopify_import',
      'system'
    );
  end if;
end $$;

create table if not exists public.inventory_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete set null,
  inventory_item_id text,
  event_type public.inventory_event_type not null,
  source public.inventory_event_source not null default 'system',
  source_id text,
  related_entity_type text,
  related_entity_id text,
  quantity_before integer check (quantity_before is null or quantity_before >= 0),
  quantity_change integer,
  quantity_after integer check (quantity_after is null or quantity_after >= 0),
  previous_value text,
  next_value text,
  previous_location_id text,
  next_location_id text,
  previous_unit_cost numeric(14,4) check (previous_unit_cost is null or previous_unit_cost >= 0),
  next_unit_cost numeric(14,4) check (next_unit_cost is null or next_unit_cost >= 0),
  previous_total_cost numeric(14,2) check (previous_total_cost is null or previous_total_cost >= 0),
  next_total_cost numeric(14,2) check (next_total_cost is null or next_total_cost >= 0),
  unit_value numeric(14,4) check (unit_value is null or unit_value >= 0),
  total_value numeric(14,2) check (total_value is null or total_value >= 0),
  currency text not null default 'USD',
  card_name text,
  game_id text,
  product_type text,
  scryfall_id text,
  set_code text,
  collector_number text,
  tcgplayer_product_id bigint,
  tcgplayer_sku_id bigint,
  condition text,
  finish text,
  language text,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint inventory_events_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint inventory_events_related_entity_check check (
    (related_entity_type is null and related_entity_id is null)
    or (related_entity_type is not null and related_entity_id is not null)
  ),
  constraint inventory_events_inventory_item_fk
    foreign key (user_id, inventory_item_id)
    references public.inventory_items(user_id, id)
    on delete set null (inventory_item_id),
  constraint inventory_events_previous_location_fk
    foreign key (user_id, previous_location_id)
    references public.inventory_locations(user_id, id)
    on delete set null (previous_location_id),
  constraint inventory_events_next_location_fk
    foreign key (user_id, next_location_id)
    references public.inventory_locations(user_id, id)
    on delete set null (next_location_id)
);

create index if not exists inventory_events_user_time_idx
  on public.inventory_events(user_id, occurred_at desc, id desc);

create index if not exists inventory_events_user_item_time_idx
  on public.inventory_events(user_id, inventory_item_id, occurred_at desc, id desc)
  where inventory_item_id is not null;

create index if not exists inventory_events_workspace_time_idx
  on public.inventory_events(workspace_id, occurred_at desc, id desc)
  where workspace_id is not null;

create index if not exists inventory_events_user_type_time_idx
  on public.inventory_events(user_id, event_type, occurred_at desc);

create index if not exists inventory_events_user_source_time_idx
  on public.inventory_events(user_id, source, occurred_at desc);

create unique index if not exists inventory_events_user_idempotency_key_idx
  on public.inventory_events(user_id, idempotency_key)
  where idempotency_key is not null;

alter table public.inventory_events enable row level security;

drop policy if exists "Users can view their inventory events" on public.inventory_events;
create policy "Users can view their inventory events"
  on public.inventory_events for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users cannot update inventory events" on public.inventory_events;
create policy "Users cannot update inventory events"
  on public.inventory_events for update
  to authenticated
  using (false)
  with check (false);

drop policy if exists "Users cannot delete inventory events" on public.inventory_events;
create policy "Users cannot delete inventory events"
  on public.inventory_events for delete
  to authenticated
  using (false);

revoke all on public.inventory_events from anon;
revoke all on public.inventory_events from authenticated;
grant select on public.inventory_events to authenticated;

create or replace function public.inventory_events_block_mutation()
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

drop trigger if exists inventory_events_append_only on public.inventory_events;
create trigger inventory_events_append_only
before update or delete on public.inventory_events
for each row execute function public.inventory_events_block_mutation();

create or replace function public.inventory_event_workspace_for_user(p_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case when count(*) = 1 then min(wm.workspace_id) else null end
  from public.workspace_members wm
  where wm.user_id = p_user_id
    and wm.role in ('owner', 'admin', 'manager', 'member');
$$;

create or replace function public.inventory_event_text_value(p_value jsonb)
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

create or replace function public.apply_collector_inventory_mutation(
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

create or replace function public.create_inventory_item_with_event(
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

revoke execute on function public.inventory_events_block_mutation() from public;
revoke execute on function public.inventory_event_workspace_for_user(uuid) from public;
revoke execute on function public.inventory_event_text_value(jsonb) from public;
revoke execute on function public.apply_collector_inventory_mutation(
  text,
  text,
  integer,
  text,
  text,
  text,
  text,
  public.inventory_event_source
) from public;
revoke execute on function public.create_inventory_item_with_event(
  jsonb,
  public.inventory_event_source,
  text,
  text,
  text
) from public;

grant execute on function public.apply_collector_inventory_mutation(
  text,
  text,
  integer,
  text,
  text,
  text,
  text,
  public.inventory_event_source
) to authenticated;

grant execute on function public.create_inventory_item_with_event(
  jsonb,
  public.inventory_event_source,
  text,
  text,
  text
) to authenticated;

comment on table public.inventory_events is
  'Append-only production ledger for user-owned inventory changes. No historical baseline is created by this migration.';
comment on column public.inventory_events.related_entity_type is
  'Future-safe linkage for orders, order lines, imports, collection purchases, scanner jobs, or other authoritative entities.';
comment on column public.inventory_events.idempotency_key is
  'Optional retry/import idempotency key. Unique per user when present.';

do $$
begin
  perform pg_notify('pgrst', 'reload schema');
exception
  when undefined_function then
    null;
end $$;
