-- STAGING-ONLY PREREQUISITE REPAIR
--
-- Live staging comparison identified these four absent prerequisite families:
-- admin_account_access, inventory_event_type, inventory_event_source, and
-- inventory_events. This is intentionally forward-only and does not replay
-- historical migrations or alter the production project.
-- Apply before 20260917163455_staging_function_surface_repair.sql and before
-- the three PR #93 production security migrations are considered for staging.
--
-- The follow-up staging_function_surface_repair migration owns the missing
-- RPCs, including inventory_events_block_mutation. That helper and its trigger
-- are deliberately not duplicated here.

do $$
begin
  if to_regclass('auth.users') is null then
    raise exception 'staging prerequisite missing: auth.users';
  end if;
  if to_regclass('public.workspaces') is null then
    raise exception 'staging prerequisite missing: public.workspaces';
  end if;
  if to_regclass('public.inventory_items') is null then
    raise exception 'staging prerequisite missing: public.inventory_items';
  end if;
  if to_regclass('public.inventory_locations') is null then
    raise exception 'staging prerequisite missing: public.inventory_locations';
  end if;
  if to_regclass('public.workspace_members') is null then
    raise exception 'staging prerequisite missing: public.workspace_members';
  end if;
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'admin_role') then
    raise exception 'staging prerequisite missing: public.admin_role';
  end if;
  if to_regclass('public.user_roles') is null then
    raise exception 'staging prerequisite missing: public.user_roles';
  end if;
end $$;

create extension if not exists pgcrypto;

alter table public.inventory_items
  add column if not exists provider_category_id text,
  add column if not exists provider_product_id text,
  add column if not exists provider_sku_id text,
  add column if not exists variant text,
  add column if not exists language text;

create or replace function public.inventory_event_workspace_for_user(p_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case
    when count(*) = 1 then (array_agg(wm.workspace_id))[1]
    else null
  end
  from public.workspace_members wm
  where wm.user_id = p_user_id
    and wm.role in ('owner', 'admin', 'manager', 'member');
$$;

do $$
declare
  expected text[] := array[
    'inventory_created', 'quantity_added', 'quantity_removed',
    'quantity_adjusted', 'location_changed', 'condition_changed',
    'finish_changed', 'cost_basis_changed', 'inventory_archived',
    'inventory_restored', 'imported'
  ];
  actual text[];
begin
  select array_agg(e.enumlabel order by e.enumsortorder)
    into actual
  from pg_type t
  join pg_enum e on e.enumtypid = t.oid
  where t.typnamespace = 'public'::regnamespace
    and t.typname = 'inventory_event_type';

  if actual is null then
    create type public.inventory_event_type as enum (
      'inventory_created', 'quantity_added', 'quantity_removed',
      'quantity_adjusted', 'location_changed', 'condition_changed',
      'finish_changed', 'cost_basis_changed', 'inventory_archived',
      'inventory_restored', 'imported'
    );
  elsif actual <> expected then
    raise exception 'existing public.inventory_event_type does not match canonical values';
  end if;
end $$;

do $$
declare
  expected text[] := array[
    'collector_workspace', 'manual', 'mobile', 'scanner', 'scanner_replay',
    'purchasing_intelligence', 'csv_import', 'tcgplayer_import',
    'ebay_import', 'shopify_import', 'system'
  ];
  actual text[];
begin
  select array_agg(e.enumlabel order by e.enumsortorder)
    into actual
  from pg_type t
  join pg_enum e on e.enumtypid = t.oid
  where t.typnamespace = 'public'::regnamespace
    and t.typname = 'inventory_event_source';

  if actual is null then
    create type public.inventory_event_source as enum (
      'collector_workspace', 'manual', 'mobile', 'scanner', 'scanner_replay',
      'purchasing_intelligence', 'csv_import', 'tcgplayer_import',
      'ebay_import', 'shopify_import', 'system'
    );
  elsif actual <> expected then
    raise exception 'existing public.inventory_event_source does not match canonical values';
  end if;
end $$;

create table if not exists public.admin_account_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_type text not null default 'free'
    check (account_type in ('free', 'collector', 'seller', 'store')),
  subscription_status text not null default 'free'
    check (subscription_status in ('free', 'trialing', 'active', 'past_due', 'canceled', 'suspended')),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

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

alter table public.admin_account_access enable row level security;
alter table public.inventory_events enable row level security;

create policy "admins can read account access"
  on public.admin_account_access for select to authenticated
  using (public.is_admin('support'));
create policy "admins can manage account access"
  on public.admin_account_access for all to authenticated
  using (public.is_admin('admin'))
  with check (public.is_admin('admin'));
create policy "Users can view their inventory events"
  on public.inventory_events for select to authenticated
  using (auth.uid() = user_id);
create policy "Users cannot update inventory events"
  on public.inventory_events for update to authenticated
  using (false) with check (false);
create policy "Users cannot delete inventory events"
  on public.inventory_events for delete to authenticated
  using (false);

revoke all on public.inventory_events from anon;
revoke all on public.inventory_events from authenticated;
grant select on public.inventory_events to authenticated;
