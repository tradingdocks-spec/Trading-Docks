-- Public Showcase image identity: expose only render-safe catalog metadata.
-- This preserves tenant and private-inventory filtering while allowing clients
-- to resolve canonical provider artwork without an N+1 metadata lookup.
drop function if exists public.get_public_showcase_inventory(text, text, integer, integer);

create function public.get_public_showcase_inventory(
  requested_slug text,
  search_query text default null,
  page_size integer default 48,
  page_offset integer default 0
)
returns table (
  public_id text, game text, name text, set_name text, set_code text,
  collector_number text, rarity text, condition text, finish text,
  language text, image_url text, provider_image_url text, scryfall_id text,
  provider_product_id text, tcgplayer_product_id bigint,
  public_price numeric, sellable_quantity integer
)
language sql stable security definer set search_path = public
as $$
  select
    i.id::text,
    coalesce(nullif(i.data->>'game',''),'Magic: The Gathering'),
    i.card_name,
    coalesce(i.data->>'setName', i.set_code),
    i.set_code,
    i.collector_number,
    i.data->>'rarity',
    i.data->>'condition',
    i.data->>'finish',
    i.data->>'language',
    coalesce(nullif(i.data->>'imageUrl',''), nullif(i.data->>'image_url',''), nullif(i.data->>'photoUrl',''), nullif(i.data->>'photo_url','')),
    coalesce(nullif(i.data->>'imageUrl',''), nullif(i.data->>'image_url',''), nullif(i.data->>'photoUrl',''), nullif(i.data->>'photo_url','')),
    i.scryfall_id,
    coalesce(nullif(i.data->>'providerProductId',''), nullif(i.data->>'provider_product_id','')),
    case when coalesce(i.data->>'tcgplayerProductId', i.data->>'tcgplayer_product_id') ~ '^[0-9]+$'
      then coalesce(i.data->>'tcgplayerProductId', i.data->>'tcgplayer_product_id')::bigint
      else null end,
    greatest(0, coalesce(nullif(i.data->>'marketPrice','')::numeric, i.inventory_value, 0)),
    greatest(0, i.quantity)
  from public.showcase_profiles p
  join public.workspaces w on w.id = p.workspace_id
  join public.inventory_items i on i.user_id = w.owner_id
  where p.slug = requested_slug and p.enabled
    and i.quantity > 0
    and not (coalesce(i.data->>'private','false')::boolean)
    and not (coalesce(i.data->>'excludedFromShowcase','false')::boolean)
    and (p.minimum_price is null or greatest(0, coalesce(nullif(i.data->>'marketPrice','')::numeric, i.inventory_value, 0)) >= p.minimum_price)
    and (search_query is null or trim(search_query) = '' or
      i.card_name ilike '%' || trim(search_query) || '%' or
      coalesce(i.data->>'setName', i.set_code) ilike '%' || trim(search_query) || '%' or
      i.collector_number ilike '%' || trim(search_query) || '%')
  order by i.card_name asc, i.set_code asc, i.collector_number asc
  limit least(greatest(page_size, 1), 100) offset greatest(page_offset, 0);
$$;

revoke all on function public.get_public_showcase_inventory(text,text,integer,integer) from public;
grant execute on function public.get_public_showcase_inventory(text,text,integer,integer) to anon, authenticated;
