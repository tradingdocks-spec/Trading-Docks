-- Customer request prices are explicit owner asking prices, never market valuation.
-- No historical requests or prices are rewritten. POS and Square are untouched.
begin;
set local lock_timeout = '5s';
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
    i.id::text, coalesce(nullif(i.data->>'game',''),'Magic: The Gathering'), i.card_name,
    coalesce(i.data->>'setName', i.set_code), i.set_code, i.collector_number,
    i.data->>'rarity', i.data->>'condition', i.data->>'finish', i.data->>'language',
    coalesce(nullif(i.data->>'imageUrl',''), nullif(i.data->>'image_url',''), nullif(i.data->>'photoUrl',''), nullif(i.data->>'photo_url','')),
    coalesce(nullif(i.data->>'imageUrl',''), nullif(i.data->>'image_url',''), nullif(i.data->>'photoUrl',''), nullif(i.data->>'photo_url','')),
    i.scryfall_id,
    coalesce(nullif(i.data->>'providerProductId',''), nullif(i.data->>'provider_product_id','')),
    case when coalesce(i.data->>'tcgplayerProductId', i.data->>'tcgplayer_product_id') ~ '^[0-9]+$'
      then coalesce(i.data->>'tcgplayerProductId', i.data->>'tcgplayer_product_id')::bigint else null end,
    i.asking_price, greatest(0, i.quantity)
  from public.showcase_profiles p
  join public.workspaces w on w.id = p.workspace_id
  join public.inventory_items i on i.user_id = w.owner_id
  where p.slug = requested_slug and p.enabled and i.quantity > 0 and i.workspace_id = p.workspace_id
    and not (coalesce(i.data->>'private','false')::boolean)
    and not (coalesce(i.data->>'excludedFromShowcase','false')::boolean)
    and (p.minimum_price is null or i.asking_price >= p.minimum_price)
    and (search_query is null or trim(search_query) = '' or i.card_name ilike '%' || trim(search_query) || '%' or coalesce(i.data->>'setName', i.set_code) ilike '%' || trim(search_query) || '%' or i.collector_number ilike '%' || trim(search_query) || '%')
  order by i.card_name asc, i.set_code asc, i.collector_number asc
  limit least(greatest(page_size, 1), 100) offset greatest(page_offset, 0);
$$;

revoke all on function public.get_public_showcase_inventory(text, text, integer, integer) from public;
grant execute on function public.get_public_showcase_inventory(text, text, integer, integer) to anon, authenticated;

create or replace function public.submit_showcase_request(
  requested_slug text, customer_name text, customer_phone text default null,
  customer_email text default null, customer_note text default null,
  requested_items jsonb default '[]'::jsonb
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare p record; w record; line jsonb; item record; request_id uuid; request_subtotal numeric(14,2) := 0; qty integer; unit numeric(14,2);
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
    select * into item from public.inventory_items i where i.user_id = w.owner_id and i.workspace_id = p.workspace_id and i.id = line->>'public_id' for update;
    if not found or item.quantity < qty or qty < 1 or coalesce(item.data->>'private','false')::boolean or coalesce(item.data->>'excludedFromShowcase','false')::boolean then
      raise exception using errcode = 'P0001', message = 'One or more requested cards are no longer available.';
    end if;
    if item.asking_price is null or item.asking_price < 0 or item.asking_price::text in ('NaN','Infinity','-Infinity') then
      raise exception using errcode = 'P0001', message = 'SHOWCASE_PRICE_REQUIRED: owner asking price is not set.';
    end if;
    unit := item.asking_price;
    if line ? 'unitPrice' and (line->>'unitPrice')::numeric is distinct from unit then
      raise exception using errcode = 'P0001', message = 'SHOWCASE_PRICE_CHANGED: reload the item before requesting it.';
    end if;
    insert into public.showcase_request_items(request_id, public_inventory_ref, canonical_inventory_ref, requested_quantity, unit_price_snapshot, line_total)
    values (request_id, item.id, item.id, qty, unit, unit * qty);
    request_subtotal := request_subtotal + unit * qty;
  end loop;
  update public.showcase_requests set subtotal = request_subtotal where id = request_id;
  insert into public.showcase_events(workspace_id, event_type, metadata) values (p.workspace_id, 'request_submitted', jsonb_build_object('item_count', jsonb_array_length(requested_items)));
  return request_id;
exception when others then
  if request_id is not null then delete from public.showcase_requests where id = request_id; end if;
  raise;
end;
$$;
revoke all on function public.submit_showcase_request(text,text,text,text,text,jsonb) from public;
grant execute on function public.submit_showcase_request(text,text,text,text,text,jsonb) to anon, authenticated;


commit;
