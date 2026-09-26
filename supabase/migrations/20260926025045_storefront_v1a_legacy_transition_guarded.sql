-- Approved storefront price snapshot contract; never applied to production.
-- Forward successor to unchanged 20260925194250. No inventory/event writes.
begin;
set local lock_timeout = '5s';
alter table public.storefront_listings
  add column if not exists storefront_listing_price numeric(14,2)
    check (storefront_listing_price >= 0 and storefront_listing_price <> 'NaN'::numeric),
  add column if not exists price_source text,
  add column if not exists price_captured_at timestamptz,
  add column if not exists game_id text,
  add column if not exists price_status text generated always as
    (case when storefront_listing_price > 0 then 'READY' else 'PRICE_REQUIRED' end) stored;
alter table public.storefront_listings alter column enabled set default false;
do $constraint$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.storefront_listings'::regclass
                and conname='storefront_listing_public_price_required') then
    alter table public.storefront_listings add constraint storefront_listing_public_price_required
      check (not enabled or (storefront_listing_price is not null and storefront_listing_price > 0));
  end if;
end $constraint$;
comment on column public.storefront_listings.storefront_listing_price is
  'Explicit storefront sale price. No implicit synchronization from asking, market, inventory valuation or cost.';
create or replace function public.resolve_storefront_game(hints text[])
returns text language sql immutable set search_path = '' as $game$
  with aliases(alias,id) as (values
('magic','magic'),
('mtg','magic'),
('magic: the gathering','magic'),
('magic-the-gathering','magic'),
('pokemon','pokemon'),
('pokémon','pokemon'),
('ptcg','pokemon'),
('pkm','pokemon'),
('yu-gi-oh','yu-gi-oh'),
('yu-gi-oh!','yu-gi-oh'),
('yugioh','yu-gi-oh'),
('ygo','yu-gi-oh'),
('flesh-and-blood','flesh-and-blood'),
('flesh and blood','flesh-and-blood'),
('fab','flesh-and-blood'),
('digimon','digimon'),
('pokemon-japan','pokemon-japan'),
('pokemon japan','pokemon-japan'),
('pokémon japan','pokemon-japan'),
('lorcana','lorcana'),
('disney-lorcana','lorcana'),
('disney lorcana','lorcana'),
('one-piece','one-piece'),
('one-piece-card-game','one-piece'),
('one piece','one-piece'),
('one piece card game','one-piece')
  ), inputs as (
    select lower(regexp_replace(btrim(normalize(h, NFKC)), '\s+', ' ', 'g')) value
    from unnest(hints) h where nullif(btrim(h),'') is not null
  ), matched as (select i.value,a.id from inputs i left join aliases a on a.alias=i.value)
  select case when count(*)>0 and count(id)=count(*) and count(distinct id)=1 then min(id) end from matched;
$game$;
create or replace function public.storefront_game_label(game_id text)
returns text language sql immutable set search_path = '' as $label$
  select case game_id
when 'magic' then 'Magic: The Gathering'
when 'pokemon' then 'Pokémon'
when 'yu-gi-oh' then 'Yu-Gi-Oh!'
when 'flesh-and-blood' then 'Flesh and Blood'
when 'digimon' then 'Digimon'
when 'pokemon-japan' then 'Pokémon Japan'
when 'lorcana' then 'Disney Lorcana'
when 'one-piece' then 'One Piece'
  end;
$label$;
revoke all on function public.resolve_storefront_game(text[]) from public;
revoke all on function public.storefront_game_label(text) from public;
grant execute on function public.resolve_storefront_game(text[]), public.storefront_game_label(text) to anon, authenticated;

create or replace function public.search_public_storefront_catalog(
  requested_slug text,
  search_query text default null,
  selected_filters jsonb default '{}'::jsonb,
  sort_by text default 'relevance',
  page_size integer default 24,
  page_offset integer default 0,
  requested_public_ids text[] default null
)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  with profile as (
    select p.*, w.owner_id
    from public.storefront_profiles p
    join public.workspaces w on w.id = p.workspace_id
    where p.slug = requested_slug and p.enabled
  ),
  listed_items as (
    select l.workspace_id, l.user_id, l.inventory_item_id, l.storefront_listing_price, l.game_id
    from public.storefront_listings l
    join profile p on p.workspace_id = l.workspace_id and p.owner_id = l.user_id
    where l.enabled and l.storefront_listing_price > 0
  ),
  positioned_raw as (
    select
      'position:' || md5(p.workspace_id::text || ':' || pos.id) as public_id, i.id as inventory_item_id,
      p.slug as store_slug,
      public.storefront_game_label(public.resolve_storefront_game(array[l.game_id,i.game_id,i.data->>'game_id',i.data->>'game',i.data->>'gameName'])) as game,
      i.card_name as name, coalesce(i.data->>'setName',i.set_code) as set_name,
      i.set_code, pos.location_id, i.collector_number, i.data->>'rarity' as rarity,
      coalesce(i.data->>'typeLine',i.data->>'type_line',i.data->>'cardType',i.data->>'type') as type_line,
      coalesce(i.data->>'cardCategory',i.data->>'card_category',case
        when coalesce(i.data->>'typeLine',i.data->>'type_line','') ilike '%creature%' then 'Creature'
        when coalesce(i.data->>'typeLine',i.data->>'type_line','') ilike '%instant%' then 'Instant'
        when coalesce(i.data->>'typeLine',i.data->>'type_line','') ilike '%sorcery%' then 'Sorcery'
        when coalesce(i.data->>'typeLine',i.data->>'type_line','') ilike '%artifact%' then 'Artifact'
        when coalesce(i.data->>'typeLine',i.data->>'type_line','') ilike '%enchantment%' then 'Enchantment'
        when coalesce(i.data->>'typeLine',i.data->>'type_line','') ilike '%planeswalker%' then 'Planeswalker'
        when coalesce(i.data->>'typeLine',i.data->>'type_line','') ilike '%land%' then 'Land' end) as card_type,
      case when jsonb_typeof(i.data->'subtypes') = 'array' then array(select jsonb_array_elements_text(i.data->'subtypes')) else '{}'::text[] end as subtypes,
      case when jsonb_typeof(i.data->'colors') = 'array' then array(select jsonb_array_elements_text(i.data->'colors'))
        when jsonb_typeof(i.data->'colorIdentity') = 'array' then array(select jsonb_array_elements_text(i.data->'colorIdentity'))
        when jsonb_typeof(i.data->'color_identity') = 'array' then array(select jsonb_array_elements_text(i.data->'color_identity')) else '{}'::text[] end as colors,
      case when jsonb_typeof(i.data->'keywords') = 'array' then array(select jsonb_array_elements_text(i.data->'keywords')) else '{}'::text[] end as keywords,
      pos.condition, pos.finish, pos.language,
      coalesce(nullif(i.data->>'imageUrl',''),nullif(i.data->>'image_url',''),nullif(i.data->>'photoUrl',''),nullif(i.data->>'photo_url','')) as image_url,
      i.scryfall_id,
      case when p.show_prices then l.storefront_listing_price else null end as storefront_listing_price,
      l.storefront_listing_price as listing_price, p.show_prices as prices_visible,
      case when p.show_quantities then least(pos.quantity,greatest(i.quantity - coalesce(sum(pos.quantity) over (
        partition by i.user_id,i.id order by pos.created_at,pos.id
        rows between unbounded preceding and 1 preceding),0),0))::integer
        else least(1,least(pos.quantity,greatest(i.quantity - coalesce(sum(pos.quantity) over (
        partition by i.user_id,i.id order by pos.created_at,pos.id
        rows between unbounded preceding and 1 preceding),0),0)))::integer end as available_quantity,
      i.created_at as added_at,
      coalesce((select array_agg(t.name order by t.sort_order,t.name)
        from public.storefront_inventory_tags it join public.storefront_tags t
          on t.id = it.tag_id and t.workspace_id = it.workspace_id
        where it.workspace_id = p.workspace_id and it.inventory_item_id = i.id),'{}'::text[]) as custom_tags,
      p.minimum_price, p.excluded_games, p.excluded_locations
    from profile p
    join listed_items l on l.workspace_id = p.workspace_id
    join public.inventory_items i on i.user_id = l.user_id and i.id = l.inventory_item_id
      and i.workspace_id = l.workspace_id
    join public.chaos_sort_inventory_positions pos on pos.user_id = i.user_id and pos.item_id = i.id
    where pos.status = 'active' and pos.quantity > 0 and i.quantity > 0
      and l.storefront_listing_price is not null and l.storefront_listing_price > 0
      and lower(coalesce(i.data->>'private','false')) <> 'true'
      and lower(coalesce(i.data->>'excludedFromShowcase','false')) <> 'true'
  ),
  positioned as (select * from positioned_raw where available_quantity > 0),
  aggregate_items as (
    select 'item:' || md5(p.workspace_id::text || ':' || i.id) as public_id, i.id as inventory_item_id, p.slug as store_slug,
      public.storefront_game_label(public.resolve_storefront_game(array[l.game_id,i.game_id,i.data->>'game_id',i.data->>'game',i.data->>'gameName'])) as game,
      i.card_name as name, coalesce(i.data->>'setName',i.set_code) as set_name,
      i.set_code, i.location_id, i.collector_number, i.data->>'rarity' as rarity,
      coalesce(i.data->>'typeLine',i.data->>'type_line',i.data->>'cardType',i.data->>'type') as type_line,
      coalesce(i.data->>'cardCategory',i.data->>'card_category',case
        when coalesce(i.data->>'typeLine',i.data->>'type_line','') ilike '%creature%' then 'Creature'
        when coalesce(i.data->>'typeLine',i.data->>'type_line','') ilike '%instant%' then 'Instant'
        when coalesce(i.data->>'typeLine',i.data->>'type_line','') ilike '%sorcery%' then 'Sorcery'
        when coalesce(i.data->>'typeLine',i.data->>'type_line','') ilike '%artifact%' then 'Artifact'
        when coalesce(i.data->>'typeLine',i.data->>'type_line','') ilike '%enchantment%' then 'Enchantment'
        when coalesce(i.data->>'typeLine',i.data->>'type_line','') ilike '%planeswalker%' then 'Planeswalker'
        when coalesce(i.data->>'typeLine',i.data->>'type_line','') ilike '%land%' then 'Land' end) as card_type,
      case when jsonb_typeof(i.data->'subtypes') = 'array' then array(select jsonb_array_elements_text(i.data->'subtypes')) else '{}'::text[] end as subtypes,
      case when jsonb_typeof(i.data->'colors') = 'array' then array(select jsonb_array_elements_text(i.data->'colors'))
        when jsonb_typeof(i.data->'colorIdentity') = 'array' then array(select jsonb_array_elements_text(i.data->'colorIdentity'))
        when jsonb_typeof(i.data->'color_identity') = 'array' then array(select jsonb_array_elements_text(i.data->'color_identity')) else '{}'::text[] end as colors,
      case when jsonb_typeof(i.data->'keywords') = 'array' then array(select jsonb_array_elements_text(i.data->'keywords')) else '{}'::text[] end as keywords,
      i.data->>'condition' as condition, coalesce(i.data->>'finish',i.data->>'treatment') as finish,
      coalesce(i.data->>'language',i.language) as language,
      coalesce(nullif(i.data->>'imageUrl',''),nullif(i.data->>'image_url',''),nullif(i.data->>'photoUrl',''),nullif(i.data->>'photo_url','')) as image_url,
      i.scryfall_id,
      case when p.show_prices then l.storefront_listing_price else null end as storefront_listing_price,
      l.storefront_listing_price as listing_price, p.show_prices as prices_visible,
      case when p.show_quantities then i.quantity::integer else least(1,i.quantity)::integer end as available_quantity,
      i.created_at as added_at,
      coalesce((select array_agg(t.name order by t.sort_order,t.name)
        from public.storefront_inventory_tags it join public.storefront_tags t
          on t.id = it.tag_id and t.workspace_id = it.workspace_id
        where it.workspace_id = p.workspace_id and it.inventory_item_id = i.id),'{}'::text[]) as custom_tags,
      p.minimum_price,p.excluded_games,p.excluded_locations
    from profile p join listed_items l on l.workspace_id = p.workspace_id
    join public.inventory_items i on i.user_id = l.user_id and i.id = l.inventory_item_id and i.workspace_id = l.workspace_id
    where i.quantity > 0 and l.storefront_listing_price is not null and l.storefront_listing_price > 0
      and lower(coalesce(i.data->>'private','false')) <> 'true'
      and lower(coalesce(i.data->>'excludedFromShowcase','false')) <> 'true'
      and not exists (select 1 from public.chaos_sort_inventory_positions pos
        where pos.user_id = i.user_id and pos.item_id = i.id and pos.status = 'active' and pos.quantity > 0)
  ),
  raw_inventory as (select * from positioned union all select * from aggregate_items),
  eligible as (
    select r.* from raw_inventory r
    join profile p on p.slug = r.store_slug
    left join public.inventory_items i on i.user_id = p.owner_id and i.id = r.inventory_item_id
    left join public.inventory_locations loc on loc.user_id = i.user_id and loc.id = r.location_id
    where r.game is not null and (r.minimum_price is null or r.listing_price >= r.minimum_price)
      and not exists (select 1 from unnest(r.excluded_games) x(value)
        where public.resolve_storefront_game(array[x.value]) = public.resolve_storefront_game(array[r.game]))
      and coalesce(r.location_id,'') <> all(r.excluded_locations)
      and coalesce(loc.name,'') <> all(r.excluded_locations)
  ),
  searched as (
    select e.*, case when lower(e.name)=lower(trim(coalesce(search_query,''))) then 1000
      when lower(e.name) like lower(trim(coalesce(search_query,''))) || '%' then 900
      when to_tsvector('english',coalesce(e.name,'')) @@ websearch_to_tsquery('english',trim(coalesce(search_query,''))) then 800
      when lower(e.name) like '%'||lower(trim(coalesce(search_query,'')))||'%' then 750
      when lower(coalesce(e.set_code,''))=lower(trim(coalesce(search_query,''))) or lower(coalesce(e.collector_number,''))=lower(trim(coalesce(search_query,''))) then 700
      when coalesce(e.custom_tags,'{}'::text[]) @> array[trim(coalesce(search_query,''))] then 600 else 100 end as relevance
    from eligible e
    where coalesce(trim(search_query),'') = '' or e.name ilike '%'||trim(search_query)||'%'
      or coalesce(e.set_name,'') ilike '%'||trim(search_query)||'%' or coalesce(e.set_code,'') ilike '%'||trim(search_query)||'%'
      or coalesce(e.collector_number,'') ilike '%'||trim(search_query)||'%' or coalesce(e.type_line,'') ilike '%'||trim(search_query)||'%'
      or coalesce(e.rarity,'') ilike '%'||trim(search_query)||'%' or coalesce(e.finish,'') ilike '%'||trim(search_query)||'%'
      or coalesce(e.condition,'') ilike '%'||trim(search_query)||'%' or coalesce(e.language,'') ilike '%'||trim(search_query)||'%'
      or array_to_string(e.subtypes,' ') ilike '%'||trim(search_query)||'%' or array_to_string(e.colors,' ') ilike '%'||trim(search_query)||'%'
      or array_to_string(e.keywords,' ') ilike '%'||trim(search_query)||'%'
      or array_to_string(e.custom_tags,' ') ilike '%'||trim(search_query)||'%'
      or to_tsvector('english',concat_ws(' ',e.name,e.set_name,e.set_code,e.collector_number,e.type_line,e.rarity,e.finish,e.condition,e.language,array_to_string(e.colors,' '),array_to_string(e.custom_tags,' '))) @@ websearch_to_tsquery('english',trim(search_query))
  ),
  filtered as (
    select s.* from searched s
    where (jsonb_typeof(selected_filters->'game') is distinct from 'array' or exists(select 1 from jsonb_array_elements_text(selected_filters->'game') f(value) where lower(f.value)=lower(s.game)))
      and (jsonb_typeof(selected_filters->'set') is distinct from 'array' or exists(select 1 from jsonb_array_elements_text(selected_filters->'set') f(value) where lower(f.value)=lower(coalesce(s.set_name,s.set_code,''))))
      and (jsonb_typeof(selected_filters->'cardType') is distinct from 'array' or exists(select 1 from jsonb_array_elements_text(selected_filters->'cardType') f(value) where lower(f.value)=lower(coalesce(s.card_type,''))))
      and (jsonb_typeof(selected_filters->'color') is distinct from 'array' or exists(select 1 from jsonb_array_elements_text(selected_filters->'color') f(value) where exists(select 1 from unnest(s.colors) c(value) where lower(c.value)=lower(f.value))))
      and (jsonb_typeof(selected_filters->'rarity') is distinct from 'array' or exists(select 1 from jsonb_array_elements_text(selected_filters->'rarity') f(value) where lower(f.value)=lower(coalesce(s.rarity,''))))
      and (jsonb_typeof(selected_filters->'finish') is distinct from 'array' or exists(select 1 from jsonb_array_elements_text(selected_filters->'finish') f(value) where lower(f.value)=lower(coalesce(s.finish,''))))
      and (jsonb_typeof(selected_filters->'condition') is distinct from 'array' or exists(select 1 from jsonb_array_elements_text(selected_filters->'condition') f(value) where lower(f.value)=lower(coalesce(s.condition,''))))
      and (jsonb_typeof(selected_filters->'language') is distinct from 'array' or exists(select 1 from jsonb_array_elements_text(selected_filters->'language') f(value) where lower(f.value)=lower(coalesce(s.language,''))))
      and (jsonb_typeof(selected_filters->'tag') is distinct from 'array' or exists(select 1 from jsonb_array_elements_text(selected_filters->'tag') f(value) where exists(select 1 from unnest(s.custom_tags) t(value) where lower(t.value)=lower(f.value))))
      and (coalesce(selected_filters->>'inStock','true') <> 'true' or s.available_quantity > 0)
      and (not s.prices_visible or coalesce(selected_filters->>'minPrice','') !~ '^\d+(\.\d{1,2})?$' or s.storefront_listing_price >= (selected_filters->>'minPrice')::numeric)
      and (not s.prices_visible or coalesce(selected_filters->>'maxPrice','') !~ '^\d+(\.\d{1,2})?$' or s.storefront_listing_price <= (selected_filters->>'maxPrice')::numeric)
      and (requested_public_ids is null or s.public_id = any(requested_public_ids))
  ),
  ordered as (
    select f.* from filtered f order by
      case when sort_by='price_asc' then f.storefront_listing_price end asc nulls last,
      case when sort_by='price_desc' then f.storefront_listing_price end desc nulls last,
      case when sort_by='newest' then f.added_at end desc nulls last,
      case when sort_by='name' then lower(f.name) end asc nulls last,
      case when coalesce(sort_by,'relevance') not in ('price_asc','price_desc','newest','name') then f.relevance end desc,
      lower(f.name),lower(coalesce(f.set_name,'')),f.collector_number,f.public_id
  ),
  page as (select * from ordered limit least(greatest(coalesce(page_size,24),1),48) offset greatest(coalesce(page_offset,0),0)),
  facet_source as (select * from searched where requested_public_ids is null),
  facet_rows as (
    select 'game'::text facet,game value,count(*)::bigint n from facet_source group by game
    union all select 'set',coalesce(set_name,set_code),count(*)::bigint from facet_source group by coalesce(set_name,set_code)
    union all select 'cardType',card_type,count(*)::bigint from facet_source where card_type is not null group by card_type
    union all select 'color',c.value,count(*)::bigint from facet_source cross join lateral unnest(colors)c(value) group by c.value
    union all select 'rarity',rarity,count(*)::bigint from facet_source where rarity is not null group by rarity
    union all select 'finish',finish,count(*)::bigint from facet_source where finish is not null group by finish
    union all select 'condition',condition,count(*)::bigint from facet_source where condition is not null group by condition
    union all select 'language',language,count(*)::bigint from facet_source where language is not null group by language
    union all select 'tag',t.value,count(*)::bigint from facet_source cross join lateral unnest(custom_tags)t(value) group by t.value
  ),
  ranked_facets as (select facet,value,n,row_number() over(partition by facet order by n desc,value) facet_rank from facet_rows),
  facets as (select coalesce(jsonb_object_agg(facet,options),'{}'::jsonb) value from (
    select facet,jsonb_agg(jsonb_build_object('value',value,'count',n) order by n desc,value) options
    from ranked_facets where facet_rank <= case when facet='set' then 40 else 80 end group by facet) x)
  select jsonb_build_object(
    'profile',(select jsonb_build_object('slug',p.slug,'display_name',p.display_name,'description',p.description,'logo_url',p.logo_url,'show_prices',p.show_prices,'show_quantities',p.show_quantities) from profile p),
    'items',coalesce((select jsonb_agg(jsonb_build_object('public_id',page.public_id,'store_slug',page.store_slug,'game',page.game,'name',page.name,'set_name',page.set_name,'set_code',page.set_code,'collector_number',page.collector_number,'rarity',page.rarity,'type_line',page.type_line,'card_type',page.card_type,'subtypes',page.subtypes,'colors',page.colors,'keywords',page.keywords,'condition',page.condition,'finish',page.finish,'language',page.language,'image_url',page.image_url,'scryfall_id',page.scryfall_id,'storefront_listing_price',page.storefront_listing_price,'available_quantity',page.available_quantity,'added_at',page.added_at,'custom_tags',page.custom_tags)) from page),'[]'::jsonb),
    'total',(select count(*) from filtered),'facets',(select value from facets));
$$;
revoke all on function public.search_public_storefront_catalog(text,text,jsonb,text,integer,integer,text[]) from public;
grant execute on function public.search_public_storefront_catalog(text,text,jsonb,text,integer,integer,text[]) to anon, authenticated;
comment on function public.search_public_storefront_catalog(text,text,jsonb,text,integer,integer,text[])
  is 'Read-only public Storefront V1A catalog. Requires an enabled storefront profile, explicit item listing, and explicit positive storefront listing price; unknown or conflicting games are unavailable.';

do $transition$
declare
  legacy record;
  catalog jsonb;
  page_offset integer;
  row_count integer;
  price_hash text;
  identity_hash text;
begin
  perform set_config('lock_timeout', '5s', true);
  if to_regclass('public.storefront_profiles') is null
     or to_regclass('public.storefront_listings') is null
     or to_regprocedure('public.search_public_storefront_catalog(text,text,jsonb,text,integer,integer,text[])') is null then
    raise exception 'V1A_TRANSITION_PREREQUISITE: apply the reviewed additive V1A schema first';
  end if;

  -- Short maintenance transaction; readers continue, concurrent source writes wait.
  lock table public.showcase_profiles, public.workspaces, public.inventory_items,
    public.chaos_sort_inventory_positions, public.inventory_locations,
    public.showcase_inventory_reservations in share mode;
  lock table public.storefront_profiles, public.storefront_listings,
    public.storefront_tags, public.storefront_inventory_tags in share row exclusive mode;

  if (select md5(pg_get_functiondef('public.get_public_showcase_inventory(text,text,integer,integer)'::regprocedure)))
       is distinct from '44e719d60f4f74602a2b813d4ea1824d' then
    raise exception 'V1A_TRANSITION_DRIFT: legacy catalog definition changed; re-audit predicates';
  end if;

  select p.*,w.owner_id into strict legacy
  from public.showcase_profiles p join public.workspaces w on w.id=p.workspace_id
  where p.slug='trading-docks' and p.enabled;
  if legacy.id <> 'd6bffb23-850f-4fe3-926d-fb1344bdc4ca'::uuid
     or legacy.workspace_id <> '4e775109-9f6f-4264-88c8-2c3c5b944a9b'::uuid
     or legacy.owner_id <> '3ea45327-7984-4108-ada8-511748e73fd8'::uuid then
    raise exception 'V1A_TRANSITION_IDENTITY: store/profile/workspace/owner differs from the reviewed mapping';
  end if;
  if legacy.show_prices is distinct from true or legacy.show_quantities is distinct from true
     or legacy.minimum_price is not null
     or legacy.banner_url is not null or legacy.accent is distinct from 'cyan'
     or cardinality(legacy.excluded_games)>0 or cardinality(legacy.excluded_locations)>0 then
    raise exception 'V1A_TRANSITION_UNSUPPORTED: branding or exclusion settings need an explicit parity review';
  end if;
  if exists(select 1 from public.showcase_inventory_reservations
            where workspace_id=legacy.workspace_id and status='active') then
    raise exception 'V1A_TRANSITION_UNSUPPORTED: active legacy reservations require a separate transition decision';
  end if;

  -- Exact observed legacy eligibility. In particular, no implicit asking-price fallback.
  create temporary table storefront_transition_source on commit drop as
  select i.*,greatest(0,coalesce(nullif(i.data->>'marketPrice','')::numeric,i.inventory_value,0)) legacy_price,
    coalesce(nullif(i.data->>'game',''),'Magic: The Gathering') legacy_game,
    coalesce(nullif(i.data->>'imageUrl',''),nullif(i.data->>'image_url',''),
             nullif(i.data->>'photoUrl',''),nullif(i.data->>'photo_url','')) legacy_image,
    coalesce(i.data->>'setName',i.set_code) legacy_set_name,
    md5(legacy.workspace_id::text||':storefront-v1a:legacy:'||i.id)::uuid listing_id
  from public.inventory_items i
  where i.user_id=legacy.owner_id and i.quantity>0
    and not coalesce(i.data->>'private','false')::boolean
    and not coalesce(i.data->>'excludedFromShowcase','false')::boolean
    and (legacy.minimum_price is null or greatest(0,coalesce(nullif(i.data->>'marketPrice','')::numeric,i.inventory_value,0))>=legacy.minimum_price);

  select count(*),md5(string_agg(id,E'\n' order by id)) into row_count,identity_hash
  from storefront_transition_source;
  if row_count<>1454 or identity_hash is distinct from 'f48ebf4c9d144d49c3b6ab99c41ba470' then
    raise exception 'V1A_TRANSITION_DRIFT: public membership changed (count %, hash %); regenerate reviewed manifest',row_count,identity_hash;
  end if;
  if exists(select 1 from storefront_transition_source where workspace_id is distinct from legacy.workspace_id) then
    raise exception 'V1A_TRANSITION_AMBIGUOUS: legacy owner-wide inventory crosses workspace ownership';
  end if;

  -- This audited cohort has exactly one active position per inventory reference.
  -- Refuse to guess how a newly split/repositioned variant should be migrated.
  if exists(select 1 from storefront_transition_source s where
    (select count(*) from public.chaos_sort_inventory_positions p
      where p.user_id=s.user_id and p.item_id=s.id and p.status='active' and p.quantity>0)<>1) then
    raise exception 'V1A_TRANSITION_AMBIGUOUS: position cardinality changed';
  end if;

  select md5(string_agg(id||':'||inventory_value::text,E'\n' order by id)) into price_hash from storefront_transition_source;
  if price_hash is distinct from '1ece8ffe38b4b92fa1829069200ab546'
    or exists(select 1 from storefront_transition_source where legacy_price is distinct from inventory_value
      or inventory_value is null or inventory_value<0 or legacy_game<>'Magic: The Gathering'
      or nullif(scryfall_id,'') is null
      or public.resolve_storefront_game(array['magic',game_id,data->>'game_id',data->>'game',data->>'gameName']) is distinct from 'magic') then
    raise exception 'V1A_TRANSITION_DRIFT: reviewed prices or taxonomy changed; re-audit before snapshot';
  end if;
  if (select count(*) from storefront_transition_source where legacy_price=0)<>2
     or exists(select 1 from storefront_transition_source where legacy_price=0 and id not in
       ('chaos-c60a727e2c9640d4be78e8819f46c042-d3205ae6908c4537',
        'chaos-3995102bbeb4450dbd3171836055c969-529c7240d437478d')) then
    raise exception 'V1A_TRANSITION_DRIFT: zero-price exception identities changed';
  end if;

  -- An existing destination must be exactly this mapping; never silently overwrite it.
  if exists(select 1 from public.storefront_profiles t
    where (t.id=legacy.id or t.workspace_id=legacy.workspace_id or t.slug=legacy.slug)
    and row(t.id,t.workspace_id,t.enabled,t.slug,t.display_name,t.description,t.logo_url,
            t.show_prices,t.show_quantities,t.minimum_price,t.excluded_games,t.excluded_locations,t.created_at,t.updated_at)
        is distinct from
        row(legacy.id,legacy.workspace_id,legacy.enabled,legacy.slug,legacy.display_name,legacy.description,legacy.logo_url,
            legacy.show_prices,legacy.show_quantities,legacy.minimum_price,legacy.excluded_games,legacy.excluded_locations,legacy.created_at,legacy.updated_at)) then
    raise exception 'V1A_TRANSITION_CONFLICT: destination profile differs';
  end if;
  if exists(select 1 from public.storefront_listings t
    left join storefront_transition_source s on s.listing_id=t.id
    where (t.workspace_id=legacy.workspace_id or t.id in(select listing_id from storefront_transition_source))
    and (s.id is null or row(t.workspace_id,t.user_id,t.inventory_item_id,t.enabled,t.created_at,t.updated_at,t.storefront_listing_price,t.price_source,t.game_id)
      is distinct from row(legacy.workspace_id,s.user_id,s.id,s.legacy_price>0,s.created_at,s.updated_at,s.legacy_price,'legacy_inventory_value'::text,'magic'::text))) then
    raise exception 'V1A_TRANSITION_CONFLICT: destination listing differs or an extra listing exists';
  end if;

  insert into public.storefront_profiles
    (id,workspace_id,enabled,slug,display_name,description,logo_url,show_prices,show_quantities,
     minimum_price,excluded_games,excluded_locations,created_at,updated_at)
  values(legacy.id,legacy.workspace_id,legacy.enabled,legacy.slug,legacy.display_name,legacy.description,
    legacy.logo_url,legacy.show_prices,legacy.show_quantities,legacy.minimum_price,
    legacy.excluded_games,legacy.excluded_locations,legacy.created_at,legacy.updated_at)
  on conflict do nothing;
  insert into public.storefront_listings
    (id,workspace_id,user_id,inventory_item_id,enabled,created_at,updated_at,storefront_listing_price,price_source,price_captured_at,game_id)
  select listing_id,legacy.workspace_id,user_id,id,legacy_price>0,created_at,updated_at,legacy_price,'legacy_inventory_value',transaction_timestamp(),'magic'
  from storefront_transition_source
  on conflict do nothing;

  if (select count(*) from public.storefront_listings where workspace_id=legacy.workspace_id)<>row_count then
    raise exception 'V1A_TRANSITION_CONFLICT: one-to-one destination coverage failed';
  end if;

  -- Test the actual reviewed read contract, not just the insert counts.
  create temporary table storefront_transition_actual (item jsonb) on commit drop;
  for page_offset in 0..((row_count-1)/48) loop
    catalog:=public.search_public_storefront_catalog(legacy.slug,null,'{}'::jsonb,'name',48,page_offset*48,null);
    if (catalog->>'total')::integer<>1452 or catalog->'profile'->>'slug' is distinct from legacy.slug then
      raise exception 'V1A_TRANSITION_PARITY: V1A visible count or slug differs';
    end if;
    insert into storefront_transition_actual select value from jsonb_array_elements(catalog->'items');
  end loop;
  if (select count(distinct item->>'public_id') from storefront_transition_actual)<>1452
     or exists(
      select 1 from storefront_transition_source s
      join public.chaos_sort_inventory_positions p on p.user_id=s.user_id and p.item_id=s.id and p.status='active' and p.quantity>0
      left join storefront_transition_actual a on a.item->>'public_id'='position:'||md5(legacy.workspace_id::text||':'||p.id)
      where s.legacy_price>0 and (a.item is null
        or a.item->>'name' is distinct from s.card_name
        or a.item->>'game' is distinct from s.legacy_game
        or a.item->>'set_name' is distinct from s.legacy_set_name
        or a.item->>'set_code' is distinct from s.set_code
        or a.item->>'collector_number' is distinct from s.collector_number
        or a.item->>'rarity' is distinct from s.data->>'rarity'
        or a.item->>'condition' is distinct from s.data->>'condition'
        or a.item->>'finish' is distinct from s.data->>'finish'
        or a.item->>'language' is distinct from s.data->>'language'
        or a.item->>'image_url' is distinct from s.legacy_image
        or a.item->>'scryfall_id' is distinct from s.scryfall_id
        or (a.item->>'storefront_listing_price')::numeric is distinct from (case when legacy.show_prices then s.legacy_price else null end)
        or (a.item->>'available_quantity')::integer is distinct from (case when legacy.show_quantities then s.quantity else least(1,s.quantity) end)
     )) then
    raise exception 'V1A_TRANSITION_PARITY: identity/title/metadata/media/price/availability differs';
  end if;
  -- No legacy object, inventory row, reservation, event, POS or Square state is changed.
end;
$transition$;

commit;
