-- Label Studio + Inventory QR production data model proposal.
--
-- REVIEW ONLY. Do not apply to production until product-owner and staging
-- validation approve the workspace inventory backfill report and public QR
-- behavior.
--
-- Migration goals:
-- - keep public.inventory_items as the canonical inventory table;
-- - add workspace-scoped inventory identity, SKU, QR token, labels, print jobs,
--   and repricing state around the existing table;
-- - preserve current user-owned mobile/web inventory reads and writes;
-- - provide a sanitized public QR resolver without granting anon table access.

-- Hosted Supabase normally exposes pgcrypto through the extensions schema.
-- If pgcrypto already exists in another schema, this does not relocate it; the
-- helper functions below discover the actual function schema. If pgcrypto is
-- missing, it is installed into extensions.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- Existing inventory remains canonical. These columns make the current table
-- capable of representing singles, sealed inventory, card-show inventory,
-- showcase/storage labels, and future POS lookup without creating a duplicate
-- inventory table.
alter table public.inventory_items
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null,
  add column if not exists item_kind text not null default 'single',
  add column if not exists product_name text,
  add column if not exists asking_price numeric(14,2),
  add column if not exists market_price numeric(14,2),
  add column if not exists label_price numeric(14,2),
  add column if not exists barcode_value text,
  add column if not exists upc text,
  add column if not exists public_label_enabled boolean not null default false,
  add column if not exists qr_public_enabled boolean not null default false;

alter table public.inventory_items
  drop constraint if exists inventory_items_item_kind_check,
  add constraint inventory_items_item_kind_check
    check (item_kind in (
      'single',
      'sealed',
      'card_show',
      'showcase',
      'storage',
      'buylist_intake',
      'custom'
    )) not valid,
  drop constraint if exists inventory_items_asking_price_check,
  add constraint inventory_items_asking_price_check
    check (asking_price is null or asking_price >= 0) not valid,
  drop constraint if exists inventory_items_market_price_check,
  add constraint inventory_items_market_price_check
    check (market_price is null or market_price >= 0) not valid,
  drop constraint if exists inventory_items_label_price_check,
  add constraint inventory_items_label_price_check
    check (label_price is null or label_price >= 0) not valid;

create index if not exists inventory_items_workspace_kind_idx
  on public.inventory_items(workspace_id, item_kind, updated_at desc)
  where workspace_id is not null;
create index if not exists inventory_items_workspace_sku_idx
  on public.inventory_items(workspace_id, sku)
  where workspace_id is not null and sku <> '';
create index if not exists inventory_items_workspace_upc_idx
  on public.inventory_items(workspace_id, upc)
  where workspace_id is not null and upc is not null;
create index if not exists inventory_items_workspace_barcode_idx
  on public.inventory_items(workspace_id, barcode_value)
  where workspace_id is not null and barcode_value is not null;

create table if not exists public.label_migration_audit (
  id uuid primary key default gen_random_uuid(),
  issue_type text not null,
  user_id uuid references auth.users(id) on delete set null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  inventory_item_id text,
  legacy_sku text,
  details jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint label_migration_audit_issue_type_check
    check (issue_type in (
      'workspace_unmapped',
      'workspace_ambiguous',
      'legacy_sku_conflict',
      'legacy_sku_invalid',
      'legacy_sku_preserved'
    ))
);

create index if not exists label_migration_audit_issue_idx
  on public.label_migration_audit(issue_type, created_at desc);
create index if not exists label_migration_audit_user_item_idx
  on public.label_migration_audit(user_id, inventory_item_id, issue_type);
create unique index if not exists label_migration_audit_unique_issue_idx
  on public.label_migration_audit(
    issue_type,
    coalesce(user_id::text, ''),
    coalesce(workspace_id::text, ''),
    coalesce(inventory_item_id, ''),
    coalesce(legacy_sku, '')
  );

create or replace function public.workspace_role_rank(role_name text)
returns integer
language sql
immutable
as $$
  select case role_name
    when 'viewer' then 0
    when 'member' then 1
    when 'manager' then 2
    when 'admin' then 3
    when 'owner' then 4
    else -1
  end;
$$;

create or replace function public.label_pgcrypto_schema()
returns text
language sql
stable
set search_path = pg_catalog
as $$
  select n.nspname
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where p.proname = 'gen_random_bytes'
    and pg_catalog.pg_get_function_identity_arguments(p.oid) = 'integer'
    and n.nspname in ('extensions', 'public', 'pg_catalog')
  order by case n.nspname
    when 'extensions' then 1
    when 'public' then 2
    when 'pg_catalog' then 3
    else 4
  end
  limit 1;
$$;

create or replace function public.label_crypto_random_bytes(byte_count integer)
returns bytea
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  crypto_schema text;
  bytes bytea;
begin
  if byte_count is null or byte_count <= 0 or byte_count > 1024 then
    raise exception 'TD_LABEL_INVALID_RANDOM_BYTE_COUNT'
      using errcode = 'P0001',
        hint = 'Random byte count must be between 1 and 1024.';
  end if;

  crypto_schema := public.label_pgcrypto_schema();
  if crypto_schema is null then
    raise exception 'TD_LABEL_PGCRYPTO_UNAVAILABLE'
      using errcode = 'P0001',
        hint = 'Install pgcrypto in the extensions or public schema before applying Label Studio QR migration.';
  end if;

  execute format('select %I.gen_random_bytes($1)', crypto_schema)
    using byte_count
    into bytes;

  return bytes;
end;
$$;

create or replace function public.has_workspace_role(
  target_workspace_id uuid,
  minimum_role text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and public.workspace_role_rank(wm.role) >= public.workspace_role_rank(minimum_role)
  );
$$;

create or replace function public.label_unambiguous_workspace_for_user(target_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with active_preference as (
    select up.active_workspace_id as workspace_id
    from public.user_preferences up
    join public.workspace_members wm
      on wm.workspace_id = up.active_workspace_id
     and wm.user_id = up.user_id
    where up.user_id = target_user_id
      and up.active_workspace_id is not null
  ),
  memberships as (
    select distinct wm.workspace_id
    from public.workspace_members wm
    where wm.user_id = target_user_id
  )
  select case
    when exists (select 1 from active_preference) then (select workspace_id from active_preference limit 1)
    when (select count(*) from memberships) = 1 then (select workspace_id from memberships limit 1)
    else null::uuid
  end;
$$;

create or replace function public.generate_trading_docks_sku()
returns text
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := public.label_crypto_random_bytes(8);
  result text := '';
  index integer;
begin
  for index in 1..8 loop
    result := result || substr(alphabet, 1 + (get_byte(bytes, index - 1) % length(alphabet)), 1);
  end loop;
  return 'TD-' || substr(result, 1, 4) || '-' || substr(result, 5, 4);
end;
$$;

create or replace function public.generate_inventory_qr_token()
returns text
language sql
volatile
set search_path = public, pg_temp
as $$
  select replace(replace(replace(pg_catalog.encode(public.label_crypto_random_bytes(24), 'base64'), '/', '_'), '+', '-'), '=', '');
$$;

create table if not exists public.inventory_label_identities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  inventory_user_id uuid not null references auth.users(id) on delete cascade,
  inventory_item_id text not null,
  target_type text not null default 'single',
  sku text not null,
  qr_token text not null,
  barcode_value text,
  status text not null default 'active',
  public_enabled boolean not null default false,
  revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb,
  constraint inventory_label_identities_item_fk
    foreign key (inventory_user_id, inventory_item_id)
    references public.inventory_items(user_id, id)
    on delete cascade,
  constraint inventory_label_identities_target_type_check
    check (target_type in (
      'single',
      'sealed',
      'card_show',
      'showcase',
      'storage',
      'buylist_intake',
      'custom'
    )),
  constraint inventory_label_identities_status_check
    check (status in ('active', 'revoked', 'archived')),
  constraint inventory_label_identities_sku_format_check
    check (sku ~ '^TD-[A-Z0-9]{4}-[A-Z0-9]{4}$'),
  constraint inventory_label_identities_qr_token_length_check
    check (length(qr_token) between 24 and 96)
);

create unique index if not exists inventory_label_identities_workspace_sku_uidx
  on public.inventory_label_identities(workspace_id, sku);
create unique index if not exists inventory_label_identities_qr_token_uidx
  on public.inventory_label_identities(qr_token);
create unique index if not exists inventory_label_identities_active_item_uidx
  on public.inventory_label_identities(workspace_id, inventory_user_id, inventory_item_id)
  where revoked_at is null and status = 'active';
create index if not exists inventory_label_identities_workspace_target_idx
  on public.inventory_label_identities(workspace_id, target_type, updated_at desc);
create index if not exists inventory_label_identities_barcode_idx
  on public.inventory_label_identities(workspace_id, barcode_value)
  where barcode_value is not null;

create or replace function public.fill_inventory_label_identity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  attempt integer := 0;
  token_attempt integer := 0;
  inventory_workspace_id uuid;
begin
  select ii.workspace_id
  into inventory_workspace_id
  from public.inventory_items ii
  where ii.user_id = new.inventory_user_id
    and ii.id = new.inventory_item_id;

  if new.workspace_id is null then
    new.workspace_id := inventory_workspace_id;
  elsif inventory_workspace_id is not null and new.workspace_id <> inventory_workspace_id then
    raise exception 'TD_LABEL_WORKSPACE_MISMATCH'
      using errcode = 'P0001',
        hint = 'Inventory label identity workspace must match the inventory item workspace.';
  end if;

  if new.workspace_id is null then
    new.workspace_id := public.label_unambiguous_workspace_for_user(new.inventory_user_id);
  end if;

  if new.workspace_id is null then
    raise exception 'TD_LABEL_WORKSPACE_REQUIRED'
      using errcode = 'P0001',
        hint = 'Inventory label identity requires a workspace.';
  end if;

  if new.sku is null or trim(new.sku) = '' then
    loop
      new.sku := public.generate_trading_docks_sku();
      exit when not exists (
        select 1
        from public.inventory_label_identities ili
        where ili.workspace_id = new.workspace_id
          and ili.sku = new.sku
      );
      attempt := attempt + 1;
      if attempt > 20 then
        raise exception 'TD_LABEL_SKU_GENERATION_FAILED'
          using errcode = 'P0001',
            hint = 'Could not generate a unique Trading Docks SKU.';
      end if;
    end loop;
  end if;

  if new.qr_token is null or trim(new.qr_token) = '' then
    loop
      new.qr_token := public.generate_inventory_qr_token();
      exit when not exists (
        select 1
        from public.inventory_label_identities ili
        where ili.qr_token = new.qr_token
      );
      token_attempt := token_attempt + 1;
      if token_attempt > 20 then
        raise exception 'TD_LABEL_QR_TOKEN_GENERATION_FAILED'
          using errcode = 'P0001',
            hint = 'Could not generate a unique Trading Docks QR token.';
      end if;
    end loop;
  end if;

  new.barcode_value := coalesce(nullif(trim(new.barcode_value), ''), new.sku);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists fill_inventory_label_identity_before_write
  on public.inventory_label_identities;
create trigger fill_inventory_label_identity_before_write
before insert or update on public.inventory_label_identities
for each row execute procedure public.fill_inventory_label_identity();

create table if not exists public.label_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  category text not null,
  width numeric(8,3) not null,
  height numeric(8,3) not null,
  unit text not null default 'in',
  orientation text not null default 'landscape',
  qr_enabled boolean not null default true,
  barcode_enabled boolean not null default false,
  logo_enabled boolean not null default false,
  price_field text not null default 'asking_price',
  pricing_rule jsonb not null default '{"mode":"none"}'::jsonb,
  template_data jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint label_templates_category_check
    check (category in (
      'card_show',
      'single',
      'showcase',
      'sealed',
      'storage',
      'buylist_intake',
      'custom'
    )),
  constraint label_templates_unit_check check (unit in ('in', 'mm')),
  constraint label_templates_orientation_check check (orientation in ('portrait', 'landscape')),
  constraint label_templates_price_field_check check (price_field in ('asking_price', 'market_price', 'none')),
  constraint label_templates_dimensions_check check (width > 0 and height > 0),
  constraint label_templates_reasonable_dimensions_check
    check (
      (unit = 'in' and width between 0.25 and 12 and height between 0.25 and 12)
      or (unit = 'mm' and width between 6.35 and 304.8 and height between 6.35 and 304.8)
    ),
  constraint label_templates_pricing_rule_size_check
    check (octet_length(pricing_rule::text) <= 8192),
  constraint label_templates_template_data_size_check
    check (octet_length(template_data::text) <= 65536)
);

create index if not exists label_templates_workspace_category_idx
  on public.label_templates(workspace_id, category, updated_at desc)
  where archived_at is null;
create unique index if not exists label_templates_workspace_name_uidx
  on public.label_templates(workspace_id, lower(name))
  where archived_at is null;

create table if not exists public.label_print_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  template_id uuid references public.label_templates(id) on delete set null,
  status text not null default 'preview',
  label_count integer not null default 0,
  page_count integer not null default 0,
  printer_target text not null default 'browser',
  selection_data jsonb not null default '{}'::jsonb,
  render_summary jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  printed_at timestamptz,
  retain_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint label_print_jobs_status_check
    check (status in ('preview', 'printed', 'failed', 'canceled')),
  constraint label_print_jobs_counts_check
    check (label_count >= 0 and page_count >= 0 and label_count <= 10000 and page_count <= 1000),
  constraint label_print_jobs_payload_size_check
    check (
      octet_length(selection_data::text) <= 131072
      and octet_length(render_summary::text) <= 65536
    )
);

create index if not exists label_print_jobs_workspace_created_idx
  on public.label_print_jobs(workspace_id, created_at desc);
create index if not exists label_print_jobs_template_idx
  on public.label_print_jobs(template_id, created_at desc);

create table if not exists public.inventory_price_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  inventory_identity_id uuid references public.inventory_label_identities(id) on delete cascade,
  inventory_user_id uuid not null references auth.users(id) on delete cascade,
  inventory_item_id text not null,
  current_asking_price numeric(14,2),
  proposed_asking_price numeric(14,2),
  market_price numeric(14,2),
  variance_percent numeric(8,4),
  status text not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb,
  constraint inventory_price_reviews_item_fk
    foreign key (inventory_user_id, inventory_item_id)
    references public.inventory_items(user_id, id)
    on delete cascade,
  constraint inventory_price_reviews_status_check
    check (status in ('pending', 'approved', 'dismissed', 'applied')),
  constraint inventory_price_reviews_money_check
    check (
      (current_asking_price is null or current_asking_price >= 0)
      and (proposed_asking_price is null or proposed_asking_price >= 0)
      and (market_price is null or market_price >= 0)
    )
);

create index if not exists inventory_price_reviews_workspace_status_idx
  on public.inventory_price_reviews(workspace_id, status, created_at desc);
create index if not exists inventory_price_reviews_item_idx
  on public.inventory_price_reviews(workspace_id, inventory_user_id, inventory_item_id, status);

-- Backfill only unambiguous existing personal inventory:
-- 1. active_workspace_id when the user is still a member;
-- 2. otherwise exactly one workspace membership.
-- Ambiguous or unmapped rows remain user-owned with workspace_id null and are
-- recorded for review instead of being silently assigned to the wrong workspace.
with candidate_mapping as (
  select
    ii.user_id,
    ii.id as inventory_item_id,
    public.label_unambiguous_workspace_for_user(ii.user_id) as resolved_workspace_id,
    (
      select count(distinct wm.workspace_id)
      from public.workspace_members wm
      where wm.user_id = ii.user_id
    ) as membership_count
  from public.inventory_items ii
  where ii.workspace_id is null
),
audit_rows as (
  insert into public.label_migration_audit (
    issue_type,
    user_id,
    inventory_item_id,
    details
  )
  select
    case
      when cm.resolved_workspace_id is null and cm.membership_count > 1 then 'workspace_ambiguous'
      else 'workspace_unmapped'
    end,
    cm.user_id,
    cm.inventory_item_id,
    jsonb_build_object('workspaceMembershipCount', cm.membership_count)
  from candidate_mapping cm
  where cm.resolved_workspace_id is null
  on conflict do nothing
  returning 1
)
update public.inventory_items ii
set workspace_id = cm.resolved_workspace_id
from candidate_mapping cm
where ii.user_id = cm.user_id
  and ii.id = cm.inventory_item_id
  and ii.workspace_id is null
  and cm.resolved_workspace_id is not null;

with sku_candidates as (
  select
    ii.workspace_id,
    ii.user_id,
    ii.id as inventory_item_id,
    upper(trim(ii.sku)) as normalized_sku,
    count(*) over (partition by ii.workspace_id, upper(trim(ii.sku))) as sku_count
  from public.inventory_items ii
  where ii.workspace_id is not null
    and trim(coalesce(ii.sku, '')) <> ''
)
insert into public.label_migration_audit (
  issue_type,
  user_id,
  workspace_id,
  inventory_item_id,
  legacy_sku,
  details
)
select
  case
    when normalized_sku !~ '^TD-[A-Z0-9]{4}-[A-Z0-9]{4}$' then 'legacy_sku_invalid'
    when sku_count > 1 then 'legacy_sku_conflict'
    else 'legacy_sku_preserved'
  end,
  user_id,
  workspace_id,
  inventory_item_id,
  normalized_sku,
  jsonb_build_object('workspaceSkuCount', sku_count)
from sku_candidates
where normalized_sku !~ '^TD-[A-Z0-9]{4}-[A-Z0-9]{4}$'
   or sku_count > 1
   or normalized_sku ~ '^TD-[A-Z0-9]{4}-[A-Z0-9]{4}$'
on conflict do nothing;

-- Preserve existing non-empty item SKUs as identity SKUs. Rows without SKUs get
-- generated SKUs through the trigger. This is intentionally one active identity
-- per inventory item and can be rerun safely.
insert into public.inventory_label_identities (
  workspace_id,
  inventory_user_id,
  inventory_item_id,
  target_type,
  sku,
  public_enabled,
  data
)
select
  candidate.workspace_id,
  candidate.user_id,
  candidate.id,
  candidate.item_kind,
  case
    when candidate.normalized_sku ~ '^TD-[A-Z0-9]{4}-[A-Z0-9]{4}$'
      and candidate.sku_count = 1
      then candidate.normalized_sku
    else null
  end,
  false,
  jsonb_build_object('backfilled', true)
from (
  select
    ii.workspace_id,
    ii.user_id,
    ii.id,
    ii.item_kind,
    upper(trim(ii.sku)) as normalized_sku,
    count(*) over (partition by ii.workspace_id, upper(trim(ii.sku))) as sku_count
  from public.inventory_items ii
  where ii.workspace_id is not null
) candidate
on conflict do nothing;

-- Keep the existing item SKU column populated for mobile/web compatibility.
update public.inventory_items ii
set sku = ili.sku,
    barcode_value = coalesce(ii.barcode_value, ili.barcode_value)
from public.inventory_label_identities ili
where ili.inventory_user_id = ii.user_id
  and ili.inventory_item_id = ii.id
  and ili.status = 'active'
  and ili.revoked_at is null
  and ii.sku = '';

create or replace function public.resolve_public_inventory_qr(input_token text)
returns table (
  token text,
  sku text,
  target_type text,
  item_name text,
  card_name text,
  product_name text,
  set_code text,
  collector_number text,
  condition text,
  finish text,
  asking_price numeric,
  market_price numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    ili.qr_token as token,
    ili.sku,
    ili.target_type,
    coalesce(nullif(ii.product_name, ''), nullif(ii.card_name, ''), nullif(ii.data ->> 'name', ''), 'Trading Docks item') as item_name,
    nullif(ii.card_name, '') as card_name,
    nullif(ii.product_name, '') as product_name,
    ii.set_code,
    ii.collector_number,
    coalesce(nullif(ii.data ->> 'condition', ''), null) as condition,
    coalesce(nullif(ii.data ->> 'finish', ''), nullif(ii.data ->> 'treatment', ''), null) as finish,
    ii.asking_price,
    ii.market_price
  from public.inventory_label_identities ili
  join public.inventory_items ii
    on ii.user_id = ili.inventory_user_id
   and ii.id = ili.inventory_item_id
  where ili.qr_token = input_token
    and ili.status = 'active'
    and ili.revoked_at is null
    and ili.public_enabled = true
    and ii.public_label_enabled = true
    and ii.qr_public_enabled = true
  limit 1;
$$;

alter table public.inventory_label_identities enable row level security;
alter table public.label_templates enable row level security;
alter table public.label_print_jobs enable row level security;
alter table public.inventory_price_reviews enable row level security;
alter table public.label_migration_audit enable row level security;

drop policy if exists "Admins view label migration audit"
  on public.label_migration_audit;
create policy "Admins view label migration audit"
  on public.label_migration_audit for select
  to authenticated
  using (workspace_id is null or public.has_workspace_role(workspace_id, 'admin'));

drop policy if exists "Workspace members view inventory label identities"
  on public.inventory_label_identities;
create policy "Workspace members view inventory label identities"
  on public.inventory_label_identities for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Managers manage inventory label identities"
  on public.inventory_label_identities;
create policy "Managers manage inventory label identities"
  on public.inventory_label_identities for all
  to authenticated
  using (public.has_workspace_role(workspace_id, 'manager'))
  with check (public.has_workspace_role(workspace_id, 'manager'));

drop policy if exists "Workspace members view label templates"
  on public.label_templates;
create policy "Workspace members view label templates"
  on public.label_templates for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Managers manage label templates"
  on public.label_templates;
create policy "Managers manage label templates"
  on public.label_templates for all
  to authenticated
  using (public.has_workspace_role(workspace_id, 'manager'))
  with check (public.has_workspace_role(workspace_id, 'manager'));

drop policy if exists "Workspace members create label print jobs"
  on public.label_print_jobs;
create policy "Workspace members create label print jobs"
  on public.label_print_jobs for insert
  to authenticated
  with check (public.has_workspace_role(workspace_id, 'member'));

drop policy if exists "Workspace members view label print jobs"
  on public.label_print_jobs;
create policy "Workspace members view label print jobs"
  on public.label_print_jobs for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Managers update label print jobs"
  on public.label_print_jobs;
create policy "Managers update label print jobs"
  on public.label_print_jobs for update
  to authenticated
  using (public.has_workspace_role(workspace_id, 'manager'))
  with check (public.has_workspace_role(workspace_id, 'manager'));

drop policy if exists "Workspace members view inventory price reviews"
  on public.inventory_price_reviews;
create policy "Workspace members view inventory price reviews"
  on public.inventory_price_reviews for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Managers manage inventory price reviews"
  on public.inventory_price_reviews;
create policy "Managers manage inventory price reviews"
  on public.inventory_price_reviews for all
  to authenticated
  using (public.has_workspace_role(workspace_id, 'manager'))
  with check (public.has_workspace_role(workspace_id, 'manager'));

-- Add workspace-aware inventory read policy without removing current user-owned
-- policies. Current mobile/web code that writes auth.uid() = user_id remains
-- compatible. This proposal deliberately does not add workspace-member update or
-- delete policy on inventory_items; pricing, POS, and reprice mutations should
-- go through reviewed server/RPC paths in a later checkpoint.
drop policy if exists "Workspace members view inventory items"
  on public.inventory_items;
create policy "Workspace members view inventory items"
  on public.inventory_items for select
  to authenticated
  using (workspace_id is not null and public.is_workspace_member(workspace_id));

revoke all on public.inventory_label_identities from anon;
revoke all on public.label_templates from anon;
revoke all on public.label_print_jobs from anon;
revoke all on public.inventory_price_reviews from anon;
revoke all on public.label_migration_audit from anon;
grant select, insert, update, delete on public.inventory_label_identities to authenticated;
grant select, insert, update, delete on public.label_templates to authenticated;
grant select, insert, update on public.label_print_jobs to authenticated;
grant select, insert, update, delete on public.inventory_price_reviews to authenticated;
grant select on public.label_migration_audit to authenticated;

revoke all on function public.resolve_public_inventory_qr(text) from public;
grant execute on function public.resolve_public_inventory_qr(text) to anon, authenticated;

comment on table public.inventory_label_identities is
  'Workspace-scoped permanent Trading Docks SKU and public-safe QR token identity for existing inventory_items rows.';
comment on table public.label_templates is
  'Workspace-owned structured label templates for browser printing and future printer adapters.';
comment on table public.label_print_jobs is
  'Auditable browser-print label render jobs; no printer SDK integration in this migration.';
comment on table public.inventory_price_reviews is
  'Review state for label repricing proposals; does not automatically overwrite inventory prices.';

notify pgrst, 'reload schema';

-- Production application plan:
-- A. Backup/checkpoint:
--    - take a verified database backup/snapshot;
--    - record row counts for inventory_items, workspace_members,
--      label_migration_audit, and existing non-empty SKUs;
--    - confirm no long-running inventory writes/import jobs are active.
-- B. Preflight queries:
--    - count users with inventory but zero workspace memberships;
--    - count users with inventory and multiple workspace memberships but no
--      valid active_workspace_id;
--    - count non-empty legacy SKUs by workspace and collision status;
--    - estimate inventory_items row count and index build time.
-- C. Migration:
--    - apply this proposal first in staging, then production only after
--      verification passes;
--    - monitor locks on inventory_items during ALTER TABLE and index creation;
--    - do not validate NOT VALID inventory check constraints in the same
--      deployment window.
-- D. Verification:
--    - run supabase/verification/verify_label_studio_inventory_qr.sql;
--    - inspect label_migration_audit for workspace_unmapped,
--      workspace_ambiguous, legacy_sku_conflict, and legacy_sku_invalid rows;
--    - confirm public QR resolver returns no rows for disabled/revoked tokens.
-- E. Smoke tests:
--    - existing mobile/web collection load and card detail;
--    - Headquarters inventory list;
--    - Label Studio template preview;
--    - public QR resolver with a manually enabled test item;
--    - cross-workspace authenticated user denial.
-- F. Rollback criteria:
--    - unexpected inventory lock/downtime;
--    - any cross-workspace access in verification;
--    - public QR returning private fields;
--    - generated SKU collision not handled by trigger retry;
--    - current mobile/web inventory reads fail.
--
-- Rollback plan for staging if verification fails:
-- 1. drop function if exists public.resolve_public_inventory_qr(text);
-- 2. drop function if exists public.fill_inventory_label_identity();
-- 3. drop function if exists public.generate_inventory_qr_token();
-- 4. drop function if exists public.generate_trading_docks_sku();
-- 5. drop function if exists public.label_crypto_random_bytes(integer);
-- 6. drop function if exists public.label_pgcrypto_schema();
-- 7. drop function if exists public.label_unambiguous_workspace_for_user(uuid);
-- 8. drop function if exists public.has_workspace_role(uuid, text);
-- 9. drop function if exists public.workspace_role_rank(text);
-- 10. drop table if exists public.inventory_price_reviews;
-- 11. drop table if exists public.label_print_jobs;
-- 12. drop table if exists public.label_templates;
-- 13. drop table if exists public.inventory_label_identities;
-- 14. drop table if exists public.label_migration_audit;
-- 15. drop new workspace inventory policies on public.inventory_items;
-- 16. drop new indexes on public.inventory_items;
-- 17. alter table public.inventory_items drop the columns added above only after
--    confirming no deployed application version reads them.
