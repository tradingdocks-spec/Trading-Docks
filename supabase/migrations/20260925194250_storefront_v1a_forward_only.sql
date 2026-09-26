-- Storefront V1A: explicit public listings, workspace settings, merchant tags,
-- and a read-only public catalog. No request, reservation, order, payment, or
-- inventory mutation objects are created here.

create table if not exists public.storefront_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  enabled boolean not null default false,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and length(slug) between 3 and 64),
  display_name text not null default 'Trading Docks',
  description text,
  logo_url text,
  show_prices boolean not null default true,
  show_quantities boolean not null default true,
  minimum_price numeric(14,2) check (minimum_price is null or minimum_price >= 0),
  excluded_games text[] not null default '{}',
  excluded_locations text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists storefront_profiles_public_slug_idx on public.storefront_profiles(enabled, slug);
alter table public.storefront_profiles enable row level security;
revoke all on public.storefront_profiles from public, anon;
grant select on public.storefront_profiles to authenticated;
grant insert, update, delete on public.storefront_profiles to authenticated;
drop policy if exists "Workspace members read storefront profiles" on public.storefront_profiles;
create policy "Workspace members read storefront profiles" on public.storefront_profiles
  for select to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists "Workspace admins manage storefront profiles" on public.storefront_profiles;
create policy "Workspace admins manage storefront profiles" on public.storefront_profiles
  for all to authenticated using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));
drop trigger if exists storefront_profiles_set_updated_at on public.storefront_profiles;
create trigger storefront_profiles_set_updated_at before update on public.storefront_profiles
  for each row execute procedure public.set_updated_at();

-- Listing is an explicit owner/admin action. A listing exposes the inventory
-- row's active positions as distinct catalog identities, or one aggregate item
-- only when no active positions exist.
create table if not exists public.storefront_listings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null,
  inventory_item_id text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, inventory_item_id),
  foreign key (user_id, inventory_item_id)
    references public.inventory_items(user_id, id) on delete cascade
);
create index if not exists storefront_listings_enabled_workspace_idx
  on public.storefront_listings(workspace_id, enabled, inventory_item_id);
alter table public.storefront_listings enable row level security;
revoke all on public.storefront_listings from public, anon;
grant select, insert, update, delete on public.storefront_listings to authenticated;
drop policy if exists "Workspace admins manage storefront listings" on public.storefront_listings;
create policy "Workspace admins manage storefront listings" on public.storefront_listings
  for all to authenticated
  using (
    public.is_workspace_admin(workspace_id)
    and exists (select 1 from public.workspaces w where w.id = storefront_listings.workspace_id and w.owner_id = storefront_listings.user_id)
  )
  with check (
    public.is_workspace_admin(workspace_id)
    and exists (
      select 1 from public.workspaces w
      join public.inventory_items i on i.user_id = w.owner_id
      where w.id = storefront_listings.workspace_id and i.id = storefront_listings.inventory_item_id
        and i.user_id = storefront_listings.user_id and i.workspace_id = storefront_listings.workspace_id
    )
  );

create table if not exists public.storefront_tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 48),
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, id)
);
create unique index if not exists storefront_tags_workspace_name_uidx
  on public.storefront_tags(workspace_id, lower(trim(name)));
alter table public.storefront_tags enable row level security;
revoke all on public.storefront_tags from public, anon;
grant select, insert, update, delete on public.storefront_tags to authenticated;
drop policy if exists "Workspace admins manage storefront tags" on public.storefront_tags;
create policy "Workspace admins manage storefront tags" on public.storefront_tags
  for all to authenticated using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

create table if not exists public.storefront_inventory_tags (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null,
  inventory_item_id text not null,
  tag_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, inventory_item_id, tag_id),
  foreign key (user_id, inventory_item_id)
    references public.inventory_items(user_id, id) on delete cascade,
  foreign key (workspace_id, tag_id)
    references public.storefront_tags(workspace_id, id) on delete cascade
);
create index if not exists storefront_inventory_tags_item_idx
  on public.storefront_inventory_tags(workspace_id, inventory_item_id);
alter table public.storefront_inventory_tags enable row level security;
revoke all on public.storefront_inventory_tags from public, anon;
grant select, insert, update, delete on public.storefront_inventory_tags to authenticated;
drop policy if exists "Workspace admins manage storefront inventory tags" on public.storefront_inventory_tags;
create policy "Workspace admins manage storefront inventory tags" on public.storefront_inventory_tags
  for all to authenticated
  using (
    public.is_workspace_admin(workspace_id)
    and exists (
      select 1 from public.workspaces w
      join public.inventory_items i on i.user_id = w.owner_id
      where w.id = storefront_inventory_tags.workspace_id
        and w.owner_id = storefront_inventory_tags.user_id
        and i.id = storefront_inventory_tags.inventory_item_id
        and i.workspace_id = storefront_inventory_tags.workspace_id
    )
  )
  with check (
    public.is_workspace_admin(workspace_id)
    and exists (
      select 1 from public.workspaces w
      join public.inventory_items i on i.user_id = w.owner_id
      where w.id = storefront_inventory_tags.workspace_id
        and w.owner_id = storefront_inventory_tags.user_id
        and i.id = storefront_inventory_tags.inventory_item_id
        and i.workspace_id = storefront_inventory_tags.workspace_id
    )
    and exists (select 1 from public.storefront_tags t
      where t.id = storefront_inventory_tags.tag_id and t.workspace_id = storefront_inventory_tags.workspace_id)
  );

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
    select l.workspace_id, l.user_id, l.inventory_item_id
    from public.storefront_listings l
    join profile p on p.workspace_id = l.workspace_id and p.owner_id = l.user_id
    where l.enabled
  ),
  positioned_raw as (
    select
      'position:' || md5(p.workspace_id::text || ':' || pos.id) as public_id, i.id as inventory_item_id,
      p.slug as store_slug,
      coalesce(case coalesce(nullif(i.game_id,''), i.data->>'game_id')
        when 'magic' then 'Magic: The Gathering' when 'pokemon' then 'Pokémon'
        when 'yu-gi-oh' then 'Yu-Gi-Oh!' when 'flesh-and-blood' then 'Flesh and Blood'
        when 'digimon' then 'Digimon' end,
        nullif(i.data->>'game',''), nullif(i.data->>'gameName',''), 'Other') as game,
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
      case when p.show_prices then i.asking_price else null end as asking_price,
      i.asking_price as listing_price, p.show_prices as prices_visible,
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
      and i.asking_price is not null and i.asking_price >= 0
      and lower(coalesce(i.data->>'private','false')) <> 'true'
      and lower(coalesce(i.data->>'excludedFromShowcase','false')) <> 'true'
  ),
  positioned as (select * from positioned_raw where available_quantity > 0),
  aggregate_items as (
    select 'item:' || md5(p.workspace_id::text || ':' || i.id) as public_id, i.id as inventory_item_id, p.slug as store_slug,
      coalesce(nullif(i.data->>'game',''),nullif(i.data->>'gameName',''),i.game_id,'Other') as game,
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
      case when p.show_prices then i.asking_price else null end as asking_price,
      i.asking_price as listing_price, p.show_prices as prices_visible,
      case when p.show_quantities then i.quantity::integer else least(1,i.quantity)::integer end as available_quantity,
      i.created_at as added_at,
      coalesce((select array_agg(t.name order by t.sort_order,t.name)
        from public.storefront_inventory_tags it join public.storefront_tags t
          on t.id = it.tag_id and t.workspace_id = it.workspace_id
        where it.workspace_id = p.workspace_id and it.inventory_item_id = i.id),'{}'::text[]) as custom_tags,
      p.minimum_price,p.excluded_games,p.excluded_locations
    from profile p join listed_items l on l.workspace_id = p.workspace_id
    join public.inventory_items i on i.user_id = l.user_id and i.id = l.inventory_item_id and i.workspace_id = l.workspace_id
    where i.quantity > 0 and i.asking_price is not null and i.asking_price >= 0
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
    where (r.minimum_price is null or r.listing_price >= r.minimum_price)
      and not exists (select 1 from unnest(r.excluded_games) x(value)
        where lower(x.value) in (lower(coalesce(r.game,'')),lower(coalesce(i.game_id,i.data->>'game_id',''))))
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
      and (not s.prices_visible or coalesce(selected_filters->>'minPrice','') !~ '^\d+(\.\d{1,2})?$' or s.asking_price >= (selected_filters->>'minPrice')::numeric)
      and (not s.prices_visible or coalesce(selected_filters->>'maxPrice','') !~ '^\d+(\.\d{1,2})?$' or s.asking_price <= (selected_filters->>'maxPrice')::numeric)
      and (requested_public_ids is null or s.public_id = any(requested_public_ids))
  ),
  ordered as (
    select f.* from filtered f order by
      case when sort_by='price_asc' then f.asking_price end asc nulls last,
      case when sort_by='price_desc' then f.asking_price end desc nulls last,
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
    'items',coalesce((select jsonb_agg(jsonb_build_object('public_id',page.public_id,'store_slug',page.store_slug,'game',page.game,'name',page.name,'set_name',page.set_name,'set_code',page.set_code,'collector_number',page.collector_number,'rarity',page.rarity,'type_line',page.type_line,'card_type',page.card_type,'subtypes',page.subtypes,'colors',page.colors,'keywords',page.keywords,'condition',page.condition,'finish',page.finish,'language',page.language,'image_url',page.image_url,'scryfall_id',page.scryfall_id,'asking_price',page.asking_price,'available_quantity',page.available_quantity,'added_at',page.added_at,'custom_tags',page.custom_tags)) from page),'[]'::jsonb),
    'total',(select count(*) from filtered),'facets',(select value from facets));
$$;
revoke all on function public.search_public_storefront_catalog(text,text,jsonb,text,integer,integer,text[]) from public;
grant execute on function public.search_public_storefront_catalog(text,text,jsonb,text,integer,integer,text[]) to anon, authenticated;
comment on function public.search_public_storefront_catalog(text,text,jsonb,text,integer,integer,text[])
  is 'Read-only public Storefront V1A catalog. Requires an enabled storefront profile, explicit item listing, and explicit asking price.';
