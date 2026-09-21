-- Corrective forward migration; original proposal remains unchanged.
alter table public.inventory_items
  add column if not exists game_id text,
  add column if not exists product_type text,
  add column if not exists provider_category_id text,
  add column if not exists provider_product_id text,
  add column if not exists provider_sku_id text,
  add column if not exists tcgplayer_product_id bigint,
  add column if not exists tcgplayer_sku_id bigint,
  add column if not exists variant text,
  add column if not exists language text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'inventory_items_product_type_check'
      and conrelid = 'public.inventory_items'::regclass
  ) then
    alter table public.inventory_items
      add constraint inventory_items_product_type_check
      check (product_type in ('card', 'sealed'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'inventory_items_game_id_check'
      and conrelid = 'public.inventory_items'::regclass
  ) then
    alter table public.inventory_items
      add constraint inventory_items_game_id_check
      check (
        game_id is null or
        game_id in (
          'magic',
          'pokemon',
          'yu-gi-oh',
          'flesh-and-blood',
          'digimon'
        )
      );
  end if;
end $$;

alter table public.inventory_items
  alter column product_type set default 'card';

create index if not exists inventory_items_user_game_type_idx
  on public.inventory_items(user_id, game_id, product_type);

create index if not exists inventory_items_user_game_tcgproduct_idx
  on public.inventory_items(user_id, game_id, tcgplayer_product_id)
  where tcgplayer_product_id is not null;

create index if not exists inventory_items_user_game_tcgsku_idx
  on public.inventory_items(user_id, game_id, tcgplayer_sku_id)
  where tcgplayer_sku_id is not null;

create index if not exists inventory_items_user_game_provider_product_idx
  on public.inventory_items(user_id, game_id, provider_product_id)
  where provider_product_id is not null;

create index if not exists inventory_items_user_game_provider_sku_idx
  on public.inventory_items(user_id, game_id, provider_sku_id)
  where provider_sku_id is not null;

create index if not exists inventory_items_user_game_variant_idx
  on public.inventory_items(user_id, game_id, (data ->> 'condition'), variant, language)
  where game_id is not null;

comment on column public.inventory_items.game_id is
  'Trading Docks game identifier. Existing Magic rows may be adapted as magic; future games must set this explicitly.';
comment on column public.inventory_items.product_type is
  'Catalog product type for game inventory: card or sealed.';
comment on column public.inventory_items.provider_category_id is
  'Provider category id, such as TCGTracking category 1 for Magic or 3 for Pokemon.';
comment on column public.inventory_items.provider_product_id is
  'External provider product id. Does not replace inventory_items.id.';
comment on column public.inventory_items.provider_sku_id is
  'External provider SKU id. Exact condition/variant/language must remain explicit.';
comment on column public.inventory_items.tcgplayer_product_id is
  'TCGplayer parent product id when known.';
comment on column public.inventory_items.tcgplayer_sku_id is
  'TCGplayer SKU id when exact variant identity is known.';
comment on column public.inventory_items.variant is
  'Generic per-game variant/finish label. Do not assume Magic foil semantics for every game.';
comment on column public.inventory_items.language is
  'Generic product/SKU language label.';

-- The table lock and temporary function refinement live in one atomic DO statement.
-- No application-visible helper, flag, identity impersonation or grant is created.
do $migration$
declare
  original_definition text;
  branch text;
begin
  if session_user <> 'postgres' or current_user <> 'postgres'
     or current_setting('role') <> 'none' then
    raise exception 'TRUSTED_DATABASE_MIGRATION_REQUIRED';
  end if;
  lock table public.inventory_items in access exclusive mode;
  original_definition := pg_get_functiondef('public.enforce_collector_inventory_mutation()'::regprocedure);
  if exists (select 1 from public.inventory_items where game_id is null
      and (scryfall_id is not null or set_code is not null or collector_number is not null)
      and (coalesce(data->>'game_id',data->>'gameId',data->>'game','magic') <> 'magic'
           or coalesce(provider_category_id,'1') <> '1')) then
    raise exception 'INVENTORY_IDENTITY_BACKFILL_CONFLICT';
  end if;
  create temporary table inventory_identity_backfill_rows on commit drop as
  select user_id,id,to_jsonb(i) old_row,
    to_jsonb(i) || jsonb_build_object(
      'game_id',case when game_id is null and (scryfall_id is not null or set_code is not null or collector_number is not null) then 'magic' else game_id end,
      'provider_category_id',case when game_id is null and (scryfall_id is not null or set_code is not null or collector_number is not null) then coalesce(provider_category_id,'1') else provider_category_id end,
      'product_type',coalesce(product_type,case
        when item_kind in ('sealed','sealed_product') or (product_name is not null and card_name is null) or data->>'productType' in ('sealed','sealed_product') then 'sealed'
        when game_id is null and (scryfall_id is not null or set_code is not null or collector_number is not null) then 'card' end)) new_row
  from public.inventory_items i;
  revoke all on pg_temp.inventory_identity_backfill_rows from public,anon,authenticated,service_role;
  create unique index on pg_temp.inventory_identity_backfill_rows(user_id,id);
  branch := format($branch$
  if tg_op = 'UPDATE' and session_user = 'postgres' and current_setting('role') = 'none'
     and pg_backend_pid() = %s and txid_current() = %s then
    if exists (select 1 from pg_temp.inventory_identity_backfill_rows b
      where b.user_id=old.user_id and b.id=old.id
        and b.old_row=to_jsonb(old) and b.new_row=to_jsonb(new)) then
      return new;
    end if;
  end if;
  $branch$,pg_backend_pid(),txid_current());
  if original_definition !~* '\mbegin\M' then raise exception 'UNRECOGNIZED_COLLECTOR_GUARD'; end if;
  execute regexp_replace(original_definition,'\mbegin\M','begin' || branch,'i');
  update public.inventory_items i set game_id=b.new_row->>'game_id',
    product_type=b.new_row->>'product_type',provider_category_id=b.new_row->>'provider_category_id'
  from pg_temp.inventory_identity_backfill_rows b
  where i.user_id=b.user_id and i.id=b.id and b.old_row is distinct from b.new_row;
  execute original_definition;
  if exists (select 1 from pg_temp.inventory_identity_backfill_rows b
    full join public.inventory_items i on i.user_id=b.user_id and i.id=b.id
    where to_jsonb(i) is distinct from b.new_row) then
    raise exception 'INVENTORY_IDENTITY_BACKFILL_POSTCONDITION';
  end if;
  drop table pg_temp.inventory_identity_backfill_rows;
end;
$migration$;

