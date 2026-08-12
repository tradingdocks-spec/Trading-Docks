-- Multi-TCG inventory identity proposal.
-- Forward-only, additive, and intentionally not applied automatically.
-- Goal: preserve existing Magic inventory while allowing future Pokemon and
-- sealed product inventory to carry explicit game/provider/SKU identity.

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

-- Preserve sealed/manual historical rows before defaulting new writes to card.
update public.inventory_items
set product_type = 'sealed'
where product_type is null
  and (
    item_kind in ('sealed', 'sealed_product') or
    (product_name is not null and card_name is null) or
    data ->> 'productType' in ('sealed', 'sealed_product')
  );

-- Existing active inventory is Magic-first. Backfill only rows with Magic-shaped
-- identifiers so unknown/manual rows are not silently misclassified.
update public.inventory_items
set
  game_id = 'magic',
  provider_category_id = coalesce(provider_category_id, '1'),
  product_type = coalesce(product_type, 'card')
where game_id is null
  and (
    scryfall_id is not null or
    set_code is not null or
    collector_number is not null
  );

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
