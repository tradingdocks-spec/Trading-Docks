-- Multi-TCG inventory identity proposal.
-- Forward-only, additive, and intentionally not applied automatically.
-- Goal: preserve existing Magic inventory while allowing future Pokemon and
-- sealed product inventory to carry explicit game/provider/SKU identity.

alter table public.inventory_items
  add column if not exists game_id text,
  add column if not exists product_type text not null default 'card',
  add column if not exists provider_category_id text,
  add column if not exists provider_product_id text,
  add column if not exists provider_sku_id text,
  add column if not exists tcgplayer_product_id bigint,
  add column if not exists tcgplayer_sku_id bigint,
  add column if not exists variant text,
  add column if not exists language text;

alter table public.inventory_items
  drop constraint if exists inventory_items_product_type_check,
  add constraint inventory_items_product_type_check
    check (product_type in ('card', 'sealed'));

alter table public.inventory_items
  drop constraint if exists inventory_items_game_id_check,
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
