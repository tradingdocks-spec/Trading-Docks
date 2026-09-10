-- Showcase V1: workspace-scoped public inventory and customer request foundation.
-- Inventory remains private; anonymous access is limited to the RPC below.

create table if not exists public.showcase_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  enabled boolean not null default false,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and length(slug) between 3 and 64),
  display_name text not null default 'Trading Docks Showcase',
  logo_url text,
  banner_url text,
  description text,
  accent text not null default 'cyan' check (accent in ('cyan','violet','amber','rose')),
  allow_requests boolean not null default true,
  show_quantities boolean not null default true,
  show_prices boolean not null default true,
  kiosk_enabled boolean not null default false,
  minimum_price numeric(14,2) check (minimum_price is null or minimum_price >= 0),
  excluded_games text[] not null default '{}',
  excluded_locations text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.showcase_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kiosk_device_id uuid,
  customer_name text not null check (length(trim(customer_name)) between 1 and 160),
  customer_phone text,
  customer_email text,
  customer_note text,
  status text not null default 'new' check (status in ('new','picking','ready','completed','cancelled','unavailable')),
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.showcase_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.showcase_requests(id) on delete cascade,
  public_inventory_ref text not null,
  canonical_inventory_ref text not null,
  requested_quantity integer not null check (requested_quantity > 0),
  unit_price_snapshot numeric(14,2) not null check (unit_price_snapshot >= 0),
  line_total numeric(14,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.showcase_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_type text not null check (event_type in ('showcase_view','search','search_no_results','card_view','add_to_request','request_submitted','request_completed','kiosk_session')),
  kiosk_device_id uuid,
  query_hash text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists showcase_profiles_enabled_slug_idx on public.showcase_profiles(enabled, slug);
create index if not exists showcase_requests_workspace_status_idx on public.showcase_requests(workspace_id, status, created_at desc);
create index if not exists showcase_request_items_request_idx on public.showcase_request_items(request_id);
create index if not exists showcase_events_workspace_time_idx on public.showcase_events(workspace_id, created_at desc);

alter table public.showcase_profiles enable row level security;
alter table public.showcase_requests enable row level security;
alter table public.showcase_request_items enable row level security;
alter table public.showcase_events enable row level security;

drop policy if exists "Showcase members manage profile" on public.showcase_profiles;
create policy "Showcase members manage profile" on public.showcase_profiles for all to authenticated
using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));
drop policy if exists "Public can view enabled showcase profiles" on public.showcase_profiles;
create policy "Public can view enabled showcase profiles" on public.showcase_profiles for select to anon, authenticated
using (enabled = true);
drop policy if exists "Showcase members view requests" on public.showcase_requests;
create policy "Showcase members view requests" on public.showcase_requests for select to authenticated
using (public.is_workspace_member(workspace_id));
drop policy if exists "Showcase members manage request items" on public.showcase_request_items;
create policy "Showcase members manage request items" on public.showcase_request_items for select to authenticated
using (exists (select 1 from public.showcase_requests r where r.id = request_id and public.is_workspace_member(r.workspace_id)));
drop policy if exists "Showcase members view events" on public.showcase_events;
create policy "Showcase members view events" on public.showcase_events for select to authenticated
using (public.is_workspace_member(workspace_id));

create or replace function public.get_public_showcase_inventory(
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
    i.id::text, coalesce(nullif(i.data->>'game',''),'Magic: The Gathering'),
    i.card_name, coalesce(i.data->>'setName', i.set_code), i.set_code,
    i.collector_number, i.data->>'rarity', i.data->>'condition', i.data->>'finish',
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

create or replace function public.submit_showcase_request(
  requested_slug text, customer_name text, customer_phone text default null,
  customer_email text default null, customer_note text default null,
  requested_items jsonb default '[]'::jsonb
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare p record; w record; line jsonb; item record; request_id uuid; subtotal numeric(14,2) := 0; qty integer; unit numeric(14,2);
begin
  select * into p from public.showcase_profiles where slug = requested_slug and enabled and allow_requests;
  if not found then raise exception using errcode = 'P0002', message = 'Showcase is not accepting requests.'; end if;
  if nullif(trim(customer_name), '') is null then raise exception using errcode = '22023', message = 'Customer name is required.'; end if;
  select * into w from public.workspaces where id = p.workspace_id;
  if jsonb_typeof(requested_items) <> 'array' or jsonb_array_length(requested_items) = 0 then raise exception using errcode = '22023', message = 'Add at least one card.'; end if;
  insert into public.showcase_requests(workspace_id, customer_name, customer_phone, customer_email, customer_note)
  values (p.workspace_id, trim(customer_name), nullif(trim(customer_phone),''), nullif(trim(customer_email),''), nullif(trim(customer_note),'')) returning id into request_id;
  for line in select * from jsonb_array_elements(requested_items) loop
    qty := greatest(0, (line->>'quantity')::integer);
    select * into item from public.inventory_items i where i.user_id = w.owner_id and i.id = line->>'public_id' for update;
    if not found or item.quantity < qty or qty < 1 or coalesce(item.data->>'private','false')::boolean or coalesce(item.data->>'excludedFromShowcase','false')::boolean then
      raise exception using errcode = 'P0001', message = 'One or more requested cards are no longer available.';
    end if;
    unit := greatest(0, coalesce(nullif(item.data->>'marketPrice','')::numeric, item.inventory_value, 0));
    insert into public.showcase_request_items(request_id, public_inventory_ref, canonical_inventory_ref, requested_quantity, unit_price_snapshot, line_total)
    values (request_id, item.id, item.id, qty, unit, unit * qty);
    subtotal := subtotal + unit * qty;
  end loop;
  update public.showcase_requests set subtotal = submit_showcase_request.subtotal where id = request_id;
  insert into public.showcase_events(workspace_id, event_type, metadata) values (p.workspace_id, 'request_submitted', jsonb_build_object('item_count', jsonb_array_length(requested_items)));
  return request_id;
exception when others then
  if request_id is not null then delete from public.showcase_requests where id = request_id; end if;
  raise;
end;
$$;
revoke all on function public.submit_showcase_request(text,text,text,text,text,jsonb) from public;
grant execute on function public.submit_showcase_request(text,text,text,text,text,jsonb) to anon, authenticated;

drop trigger if exists showcase_profiles_set_updated_at on public.showcase_profiles;
create trigger showcase_profiles_set_updated_at before update on public.showcase_profiles for each row execute procedure public.set_updated_at();
drop trigger if exists showcase_requests_set_updated_at on public.showcase_requests;
create trigger showcase_requests_set_updated_at before update on public.showcase_requests for each row execute procedure public.set_updated_at();
