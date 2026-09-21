-- Phase 1, additive. Apply only to reviewed disposable/staging databases first.
-- Requires canonical inventory, Label Studio, Chaos Sort and Selling migrations.
-- No new inventory ownership grants. Cashier may mutate only their own stock.
create schema if not exists pos_private;
revoke all on schema pos_private from public, anon, authenticated;
create table pos_private.request_limits (
  actor_id uuid not null,
  bucket text not null,
  started_at timestamptz not null default now(),
  requests integer not null default 1,
  primary key(actor_id,bucket)
);
alter table pos_private.request_limits enable row level security;
revoke all on pos_private.request_limits from public,anon,authenticated;

create table public.pos_workspace_settings (
  workspace_id uuid primary key references public.workspaces(id),
  enabled boolean not null default false
);
create table public.pos_store_locations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  inventory_user_id uuid not null references auth.users(id),
  name text not null check (length(name) between 1 and 100),
  tax_bps integer not null check (tax_bps between 0 and 2500),
  currency text not null default 'USD' check (currency = 'USD'),
  created_at timestamptz not null default now(),
  unique(workspace_id,id)
);
create table public.pos_location_inventory_locations (
  workspace_id uuid not null,
  site_id uuid not null,
  inventory_user_id uuid not null,
  location_id text not null,
  primary key(inventory_user_id,location_id),
  foreign key(workspace_id,site_id) references public.pos_store_locations(workspace_id,id),
  foreign key(inventory_user_id,location_id) references public.inventory_locations(user_id,id)
);
create table public.pos_registers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  site_id uuid not null,
  name text not null check (length(name) between 1 and 100),
  foreign key(workspace_id,site_id) references public.pos_store_locations(workspace_id,id),
  unique(workspace_id,site_id,id)
);
create table public.pos_register_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  site_id uuid not null,
  register_id uuid not null,
  actor_id uuid not null references auth.users(id),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  foreign key(workspace_id,site_id,register_id) references public.pos_registers(workspace_id,site_id,id),
  unique(workspace_id,site_id,register_id,id)
);
create unique index pos_one_open_session on public.pos_register_sessions(register_id) where closed_at is null;
create table public.pos_checkout_cancellations (
  workspace_id uuid not null references public.workspaces(id),
  actor_id uuid not null references auth.users(id),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  primary key(workspace_id,actor_id,idempotency_key)
);
create table public.pos_sales (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  site_id uuid not null,
  register_id uuid not null,
  session_id uuid not null,
  actor_id uuid not null references auth.users(id),
  idempotency_key uuid not null,
  request jsonb not null,
  receipt_number text not null default ('TD-' || upper(replace(gen_random_uuid()::text,'-',''))),
  currency text not null default 'USD' check(currency='USD'),
  subtotal_minor bigint not null check(subtotal_minor between 0 and 100000000000),
  discount_minor bigint not null check(discount_minor >= 0 and discount_minor <= subtotal_minor),
  tax_minor bigint not null check(tax_minor >= 0),
  total_minor bigint not null check(total_minor = subtotal_minor-discount_minor+tax_minor),
  receipt jsonb not null,
  created_at timestamptz not null default now(),
  foreign key(workspace_id,site_id,register_id,session_id) references public.pos_register_sessions(workspace_id,site_id,register_id,id),
  unique(workspace_id,id), unique(workspace_id,idempotency_key), unique(receipt_number)
);
create index pos_sales_history on public.pos_sales(workspace_id,actor_id,created_at desc,id);
create table public.pos_sale_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  sale_id uuid not null,
  inventory_user_id uuid not null,
  inventory_item_id text not null,
  quantity integer not null check(quantity between 1 and 1000),
  unit_price_minor bigint not null check(unit_price_minor between 0 and 100000000),
  discount_minor bigint not null check(discount_minor >= 0),
  tax_minor bigint not null check(tax_minor >= 0),
  snapshot jsonb not null,
  foreign key(workspace_id,sale_id) references public.pos_sales(workspace_id,id)
);
create table public.pos_sale_allocations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  sale_id uuid not null,
  inventory_user_id uuid not null,
  inventory_item_id text not null,
  position_id text,
  batch_id uuid,
  location_id text not null,
  quantity integer not null check(quantity > 0),
  foreign key(workspace_id,sale_id) references public.pos_sales(workspace_id,id)
);
create table public.pos_tenders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  sale_id uuid not null,
  method text not null check(method='cash'),
  verification text not null default 'recorded' check(verification='recorded'),
  amount_minor bigint not null check(amount_minor >= 0),
  received_minor bigint not null check(received_minor >= amount_minor),
  change_minor bigint not null check(change_minor = received_minor-amount_minor),
  foreign key(workspace_id,sale_id) references public.pos_sales(workspace_id,id)
);
create index pos_sale_items_sale on public.pos_sale_items(sale_id);
create index pos_sale_allocations_sale_item on public.pos_sale_allocations(sale_id,inventory_item_id);
create index pos_tenders_sale on public.pos_tenders(sale_id);
create index pos_stock_reservations on public.selling_inventory_allocations(user_id,inventory_item_id,status);
create index pos_stock_positions on public.chaos_sort_inventory_positions(user_id,item_id);

create function pos_private.authorize(w uuid, management boolean default false, require_enabled boolean default true)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.workspace_members m join auth.users u on u.id=m.user_id
    where m.workspace_id=w and m.user_id=auth.uid()
      and m.role in ('owner','admin','manager','member')
      and (not management or m.role in ('owner','admin','manager'))
      and (u.banned_until is null or u.banned_until < now())
  ) or coalesce(public.collector_effective_membership_tier(auth.uid()),'') not in ('seller','store') then
    raise exception 'POS_FORBIDDEN';
  end if;
  if exists(select 1 from public.workspace_employees where workspace_id=w and linked_user_id=auth.uid() and employment_status <> 'active') then
    raise exception 'POS_FORBIDDEN';
  end if;
  if require_enabled and not exists(select 1 from public.pos_workspace_settings where workspace_id=w and enabled) then
    raise exception 'POS_DISABLED';
  end if;
end $$;

-- Reads retain owner boundaries, even when the user is another workspace's admin.
do $$ declare t text; begin
  foreach t in array array['pos_workspace_settings','pos_store_locations','pos_location_inventory_locations','pos_registers','pos_register_sessions','pos_checkout_cancellations','pos_sales','pos_sale_items','pos_sale_allocations','pos_tenders'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
  end loop;
end $$;

-- Shared stock invariant: runs for ALL writers, including direct Data API writes.
-- Lock parent before examining reservations. Deferred checks allow atomic multi-row
-- commits (Chaos Sort/checkout) to update positions and parent in either order.
create function pos_private.check_stock() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_owner uuid; v_item text; stock integer; positions bigint; reserved bigint;
begin
  if tg_table_name='inventory_items' then
    v_owner := coalesce(new.user_id,old.user_id); v_item := coalesce(new.id,old.id);
    if tg_op='UPDATE' and (new.user_id,new.id) is distinct from (old.user_id,old.id) then raise exception 'POS_STOCK_IDENTITY_IMMUTABLE'; end if;
  elsif tg_table_name='chaos_sort_inventory_positions' then
    v_owner := coalesce(new.user_id,old.user_id); v_item := coalesce(new.item_id,old.item_id);
    if tg_op='UPDATE' and (new.user_id,new.item_id) is distinct from (old.user_id,old.item_id) then raise exception 'POS_STOCK_IDENTITY_IMMUTABLE'; end if;
  else
    v_owner := coalesce(new.user_id,old.user_id); v_item := coalesce(new.inventory_item_id,old.inventory_item_id);
    if tg_op='UPDATE' and (new.user_id,new.inventory_item_id,new.inventory_position_id) is distinct from (old.user_id,old.inventory_item_id,old.inventory_position_id) then raise exception 'POS_STOCK_IDENTITY_IMMUTABLE'; end if;
  end if;
  select quantity into stock from public.inventory_items where user_id=v_owner and id=v_item for update;
  select coalesce(sum(quantity),0) into positions from public.chaos_sort_inventory_positions where user_id=v_owner and item_id=v_item;
  select coalesce(sum(quantity),0) into reserved from public.selling_inventory_allocations where user_id=v_owner and inventory_item_id=v_item and status in ('ALLOCATED','RESERVED');
  if positions > coalesce(stock,0) or reserved > coalesce(stock,0) then raise exception 'POS_STOCK_UNAVAILABLE'; end if;
  if exists (
    select 1 from public.selling_inventory_allocations a
    left join public.chaos_sort_inventory_positions p on p.user_id=a.user_id and p.id=a.inventory_position_id and p.item_id=a.inventory_item_id
    where a.user_id=v_owner and a.inventory_item_id=v_item and a.inventory_position_id is not null and a.status in ('ALLOCATED','RESERVED')
    group by a.inventory_position_id,p.quantity having sum(a.quantity)>coalesce(p.quantity,0)
  ) then raise exception 'POS_STOCK_UNAVAILABLE'; end if;
  return null;
end $$;
create constraint trigger pos_stock_item after insert or update or delete on public.inventory_items deferrable initially deferred for each row execute function pos_private.check_stock();
create constraint trigger pos_stock_position after insert or update or delete on public.chaos_sort_inventory_positions deferrable initially deferred for each row execute function pos_private.check_stock();
create constraint trigger pos_stock_allocation after insert or update or delete on public.selling_inventory_allocations deferrable initially deferred for each row execute function pos_private.check_stock();

-- Immutable POS snapshots and POS-related canonical events. No maintenance GUC bypass.
create function pos_private.immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'POS_IMMUTABLE'; end $$;
create trigger pos_sales_immutable before update or delete on public.pos_sales for each row execute function pos_private.immutable();
create trigger pos_lines_immutable before update or delete on public.pos_sale_items for each row execute function pos_private.immutable();
create trigger pos_allocations_immutable before update or delete on public.pos_sale_allocations for each row execute function pos_private.immutable();
create trigger pos_tenders_immutable before update or delete on public.pos_tenders for each row execute function pos_private.immutable();
create trigger pos_cancellations_immutable before update or delete on public.pos_checkout_cancellations for each row execute function pos_private.immutable();
create trigger pos_events_immutable before update or delete on public.inventory_events for each row when (old.related_entity_type='pos_sale') execute function pos_private.immutable();

-- Use existing enum-compatible quantity_removed/system values in BOTH historical
-- ledger shapes. related_entity_type identifies POS, not a new parallel ledger.
-- Client inserts cannot impersonate POS events. Finalizer's definer is postgres.
create function pos_private.protect_event_origin() returns trigger language plpgsql set search_path='' as $$
begin
  if new.related_entity_type='pos_sale' and current_user in ('authenticated','anon') then raise exception 'POS_FORBIDDEN'; end if;
  if new.related_entity_type='pos_sale' and not exists (
    select 1 from public.pos_sales s join public.pos_sale_items l on l.sale_id=s.id
    where s.id::text=new.related_entity_id and s.actor_id=new.user_id
      and l.inventory_user_id=new.user_id and l.inventory_item_id=new.inventory_item_id
      and new.quantity_change=-l.quantity and new.quantity_after=new.quantity_before-l.quantity
      and new.idempotency_key='pos:'||s.id::text||':'||l.inventory_item_id
  ) then raise exception 'POS_FORBIDDEN'; end if;
  return new;
end $$;
create trigger pos_event_origin before insert on public.inventory_events for each row execute function pos_private.protect_event_origin();

create index pos_inventory_search on public.inventory_items using gin(to_tsvector('simple',coalesce(card_name,'') || ' ' || coalesce(product_name,'') || ' ' || coalesce(set_code,'') || ' ' || coalesce(collector_number,'')));

-- Preserve known acquisition/cost fields without guessing whether a legacy
-- total is a unit cost. POS snapshots use cents; existing acquisition data stays
-- canonical. Profit recognition is a later reporting adapter.
create function pos_private.cost_snapshot(data jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare k text; result jsonb:='{}'; v text;
begin
  foreach k in array array['unitCost','costBasis','purchasePrice','totalCost','totalCostBasis','cost_basis','unit_cost'] loop
    v:=data->>k;
    if v ~ '^\d{1,10}(\.\d{1,4})?$' then
      result:=result||jsonb_build_object(k||'Minor',round(v::numeric*100)::bigint);
    end if;
  end loop;
  return jsonb_build_object('values',result,'sourceId',coalesce(data->>'purchase_id',data->>'source_id'),'method','legacy_snapshot');
end $$;

create function pos_private.command(w uuid, action text, body jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  actor uuid := auth.uid(); site public.pos_store_locations%rowtype;
  reg public.pos_registers%rowtype; sess public.pos_register_sessions%rowtype;
  inv public.inventory_items%rowtype; prior public.pos_sales%rowtype;
  v_sale_id uuid; key_id uuid; line jsonb; lines jsonb := '[]'; receipt jsonb;
  qty integer; price bigint; sub bigint:=0; disc bigint:=0; tax bigint:=0;
  line_sub bigint; line_disc bigint; line_tax bigint; rate integer; received bigint; expected bigint;
  v_position record; remaining integer; take integer; reserved bigint; pos_reserved bigint; pos_total bigint;
  loc text; code text; result jsonb; request_body jsonb; request_count integer;
begin
  perform pos_private.authorize(w,action in ('setup'),action not in ('availability','history','receipt','recover','cancel'));
  if body is null or jsonb_typeof(body)<>'object' or octet_length(body::text)>32768 then raise exception 'POS_INVALID'; end if;
  if action not in ('availability','receipt','recover') then
    insert into pos_private.request_limits(actor_id,bucket) values(actor,case when action='search' then 'search' else 'command' end)
    on conflict(actor_id,bucket) do update set
      requests=case when request_limits.started_at < now()-interval '1 minute' then 1 else request_limits.requests+1 end,
      started_at=case when request_limits.started_at < now()-interval '1 minute' then now() else request_limits.started_at end
    returning requests into request_count;
    if request_count>600 then raise exception 'POS_RATE_LIMIT'; end if;
  end if;
  if action='availability' then
    return jsonb_build_object('enabled',exists(select 1 from public.pos_workspace_settings where workspace_id=w and enabled));
  elsif action='bootstrap' then
    return jsonb_build_object(
      'sites',(select coalesce(jsonb_agg(s),'[]') from public.pos_store_locations s where s.workspace_id=w and s.inventory_user_id=actor),
      'registers',(select coalesce(jsonb_agg(r),'[]') from public.pos_registers r join public.pos_store_locations s on s.id=r.site_id where r.workspace_id=w and s.inventory_user_id=actor),
      'sessions',(select coalesce(jsonb_agg(s),'[]') from public.pos_register_sessions s where s.workspace_id=w and s.actor_id=actor and s.closed_at is null),
      'locations',(select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'name',l.name)),'[]') from public.inventory_locations l where l.user_id=actor and not exists(select 1 from public.pos_location_inventory_locations m where m.inventory_user_id=actor and m.location_id=l.id)),
      'canManage',exists(select 1 from public.workspace_members where workspace_id=w and user_id=actor and role in ('owner','admin','manager')));
  elsif action='setup' then
    if length(trim(body->>'name')) not between 1 and 100 or length(trim(body->>'registerName')) not between 1 and 100 or coalesce(body->>'taxBps','') !~ '^\d{1,4}$' then raise exception 'POS_INVALID'; end if;
    loc := body->>'locationId';
    if not exists(select 1 from public.inventory_locations where user_id=actor and id=loc) then raise exception 'POS_FORBIDDEN'; end if;
    insert into public.pos_store_locations(workspace_id,inventory_user_id,name,tax_bps) values(w,actor,trim(body->>'name'),(body->>'taxBps')::int) returning * into site;
    insert into public.pos_location_inventory_locations values(w,site.id,actor,loc);
    insert into public.pos_registers(workspace_id,site_id,name) values(w,site.id,trim(body->>'registerName')) returning * into reg;
    return jsonb_build_object('siteId',site.id,'registerId',reg.id);
  elsif action in ('open','close') then
    select r.* into reg from public.pos_registers r join public.pos_store_locations s on s.id=r.site_id
      where r.id=(body->>'registerId')::uuid and r.workspace_id=w and s.inventory_user_id=actor for update of r;
    if reg.id is null then raise exception 'POS_FORBIDDEN'; end if;
    select * into sess from public.pos_register_sessions where register_id=reg.id and closed_at is null for update;
    if sess.id is not null and sess.actor_id<>actor then raise exception 'POS_REGISTER_BUSY'; end if;
    if action='close' then
      update public.pos_register_sessions set closed_at=now() where id=sess.id;
      return jsonb_build_object('closed',true);
    end if;
    if sess.id is null then
      insert into public.pos_register_sessions(workspace_id,site_id,register_id,actor_id) values(w,reg.site_id,reg.id,actor) returning * into sess;
    end if;
    return to_jsonb(sess);
  elsif action in ('history','receipt','recover','cancel') then
    if action='history' then
      select coalesce(jsonb_agg(x),'[]') into result from (
        select id,receipt_number,created_at,total_minor,subtotal_minor,discount_minor,tax_minor,register_id,actor_id from public.pos_sales
        where workspace_id=w and actor_id=actor and (nullif(body->>'before','') is null or (created_at,id)<((body->>'before')::timestamptz,coalesce(nullif(body->>'beforeId',''),'00000000-0000-0000-0000-000000000000')::uuid))
        order by created_at desc,id desc limit 50
      ) x;
      return result;
    end if;
    if action in ('recover','cancel') then
      key_id:=(body->>'key')::uuid;
      if key_id is null then raise exception 'POS_INVALID'; end if;
      perform pg_advisory_xact_lock(hashtextextended('pos:'||w::text||key_id::text,0));
    end if;
    select * into prior from public.pos_sales where workspace_id=w and actor_id=actor
      and ((action='receipt' and id=(body->>'saleId')::uuid) or (action in ('recover','cancel') and idempotency_key=key_id));
    if prior.id is null then
      if action='cancel' then
        insert into public.pos_checkout_cancellations(workspace_id,actor_id,idempotency_key) values(w,actor,key_id) on conflict do nothing;
      end if;
      return jsonb_build_object('status',case when exists(select 1 from public.pos_checkout_cancellations where workspace_id=w and actor_id=actor and idempotency_key=key_id) then 'canceled' else 'not_found' end);
    end if;
    return jsonb_build_object('status','completed','saleId',prior.id,'receipt',prior.receipt);
  end if;
  select * into site from public.pos_store_locations where id=(body->>'siteId')::uuid and workspace_id=w and inventory_user_id=actor;
  if site.id is null then raise exception 'POS_FORBIDDEN'; end if;
  if action='search' then
    code := trim(coalesce(body->>'query',''));
    if length(code) not between 1 and 160 then return '[]'; end if;
    -- Current owner boundaries retained. Missing price remains null.
    select coalesce(jsonb_agg(x),'[]') into result from (
      select i.id,coalesce(nullif(i.product_name,''),i.card_name) as name,i.sku,i.set_code,i.collector_number,i.location_id,l.name as location,
        i.data->>'condition' as condition,i.data->>'finish' as finish,i.data->>'language' as language,
        coalesce(i.data->>'taxable','true')<>'false' as taxable,
        case when i.asking_price between 0 and 1000000 then (i.asking_price*100)::bigint end as unit_price_minor,
        greatest(0,i.quantity-coalesce((select sum(a.quantity) from public.selling_inventory_allocations a where a.user_id=i.user_id and a.inventory_item_id=i.id and a.status in ('ALLOCATED','RESERVED')),0)) as available,
        coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'batchId',p.batch_id,'quantity',p.quantity,'locationId',p.location_id)) from public.chaos_sort_inventory_positions p where p.user_id=i.user_id and p.item_id=i.id and p.quantity>0),'[]') as positions
      from public.inventory_items i join public.inventory_locations l on l.user_id=i.user_id and l.id=i.location_id
      join public.pos_location_inventory_locations m on m.inventory_user_id=i.user_id and m.location_id=i.location_id and m.site_id=site.id
      where i.user_id=actor and i.workspace_id=w and i.quantity>0 and (
        i.sku=code or i.upc=code or i.barcode_value=code or i.id=code or i.data->>'tcgplayer_product_id'=code or i.data->>'provider_sku_id'=code or
        exists(select 1 from public.inventory_label_identities z where z.workspace_id=w and z.inventory_user_id=i.user_id and z.inventory_item_id=i.id and z.status='active' and z.revoked_at is null and (z.sku=code or z.barcode_value=code or z.qr_token=code)) or
        (coalesce(body->>'exact','false')<>'true' and (
          to_tsvector('simple',coalesce(i.card_name,'')||' '||coalesce(i.product_name,'')||' '||coalesce(i.set_code,'')||' '||coalesce(i.collector_number,'')) @@ plainto_tsquery('simple',code)
          or lower(l.name)=lower(code)
          or exists(select 1 from public.chaos_sort_inventory_positions cp join public.chaos_sort_batches cb on cb.id=cp.batch_id and cb.user_id=cp.user_id where cp.user_id=i.user_id and cp.item_id=i.id and cb.batch_code=code)
        ))
      ) order by i.card_name,i.id limit 30
    ) x;
    return result;
  elsif action<>'checkout' then raise exception 'POS_INVALID'; end if;

  key_id := (body->>'key')::uuid;
  if key_id is null then raise exception 'POS_INVALID'; end if;
  request_body := body-'key';
  perform pg_advisory_xact_lock(hashtextextended('pos:'||w::text||key_id::text,0));
  select * into prior from public.pos_sales where workspace_id=w and idempotency_key=key_id;
  if prior.id is not null then
    if prior.request<>request_body or prior.actor_id<>actor then raise exception 'POS_IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('status','completed','saleId',prior.id,'receipt',prior.receipt,'replayed',true);
  end if;
  if exists(select 1 from public.pos_checkout_cancellations where workspace_id=w and actor_id=actor and idempotency_key=key_id) then raise exception 'POS_CHECKOUT_CANCELED'; end if;
  select * into sess from public.pos_register_sessions where id=(body->>'sessionId')::uuid and workspace_id=w and site_id=site.id and actor_id=actor and closed_at is null for update;
  if sess.id is null then raise exception 'POS_SESSION_CLOSED'; end if;
  if jsonb_typeof(body->'lines') is distinct from 'array' or jsonb_array_length(body->'lines') not between 1 and 100
    or coalesce(body->>'cashMinor','') !~ '^\d{1,12}$' or coalesce(body->>'expectedMinor','') !~ '^\d{1,12}$' then raise exception 'POS_INVALID'; end if;
  received := (body->>'cashMinor')::bigint; expected := (body->>'expectedMinor')::bigint;
  if (select count(distinct value->>'itemId') from jsonb_array_elements(body->'lines'))<>jsonb_array_length(body->'lines') then raise exception 'POS_INVALID'; end if;
  -- Reuse collector serialization before item locks. No owner impersonation.
  perform pg_advisory_xact_lock(hashtextextended('collector-inventory:'||actor::text,0));
  perform 1 from public.inventory_items where user_id=actor and id in (select value->>'itemId' from jsonb_array_elements(body->'lines')) order by id for update;
  for line in select value from jsonb_array_elements(body->'lines') order by value->>'itemId' loop
    if coalesce(line->>'quantity','') !~ '^\d{1,4}$' or coalesce(line->>'discountBps','0') !~ '^\d{1,5}$' then raise exception 'POS_INVALID'; end if;
    qty := (line->>'quantity')::integer; rate := coalesce((line->>'discountBps')::integer,0);
    if qty not between 1 and 1000 or rate not between 0 and 10000 then raise exception 'POS_INVALID'; end if;
    if rate>0 then
      perform pos_private.authorize(w,true);
      if length(trim(coalesce(body->>'discountReason',''))) not between 1 and 200 then raise exception 'POS_DISCOUNT_REASON'; end if;
    end if;
    select i.* into inv from public.inventory_items i join public.pos_location_inventory_locations m on m.inventory_user_id=i.user_id and m.location_id=i.location_id and m.site_id=site.id
      where i.user_id=actor and i.workspace_id=w and i.id=line->>'itemId';
    if inv.id is null then raise exception 'POS_STOCK_UNAVAILABLE'; end if;
    select coalesce(sum(quantity),0) into reserved from public.selling_inventory_allocations where user_id=actor and inventory_item_id=inv.id and status in ('ALLOCATED','RESERVED');
    if inv.quantity-reserved<qty then raise exception 'POS_STOCK_UNAVAILABLE'; end if;
    if inv.asking_price is null or inv.asking_price not between 0 and 1000000 then raise exception 'POS_PRICE_REQUIRED'; end if;
    price := (inv.asking_price*100)::bigint;
    line_sub := price*qty; line_disc := (line_sub*rate+5000)/10000;
    line_tax := case when inv.data->>'taxable'='false' then 0 else ((line_sub-line_disc)*site.tax_bps+5000)/10000 end;
    sub:=sub+line_sub; disc:=disc+line_disc; tax:=tax+line_tax;
    lines:=lines||jsonb_build_array(jsonb_build_object('itemId',inv.id,'name',coalesce(nullif(inv.product_name,''),inv.card_name),'sku',inv.sku,'quantity',qty,'unitPriceMinor',price,'discountMinor',line_disc,'taxMinor',line_tax,'lineTotalMinor',line_sub-line_disc+line_tax,'gameId',coalesce(to_jsonb(inv)->>'game_id',inv.data->>'game_id'),'productType',coalesce(to_jsonb(inv)->>'product_type',inv.data->>'product_type'),'scryfallId',inv.scryfall_id,'tcgplayerProductId',coalesce(to_jsonb(inv)->>'tcgplayer_product_id',inv.data->>'tcgplayer_product_id'),'setCode',inv.set_code,'collectorNumber',inv.collector_number,'condition',inv.data->>'condition','finish',inv.data->>'finish','language',inv.data->>'language','locationId',inv.location_id,'costBasis',pos_private.cost_snapshot(inv.data),'priceSource','asking_price','positionId',line->>'positionId'));
  end loop;
  if expected<>sub-disc+tax then raise exception 'POS_QUOTE_CHANGED'; end if;
  if received<sub-disc+tax then raise exception 'POS_CASH_INSUFFICIENT'; end if;
  v_sale_id:=gen_random_uuid();
  code:='TD-'||upper(replace(v_sale_id::text,'-',''));
  select name into loc from public.pos_registers where id=sess.register_id;
  receipt:=jsonb_build_object('version',1,'number',code,'site',site.name,'register',loc,'actorId',actor,'createdAt',now(),'currency','USD','lines',lines,'subtotalMinor',sub,'discountMinor',disc,'taxMinor',tax,'totalMinor',sub-disc+tax,'cashMinor',received,'changeMinor',received-(sub-disc+tax),'discountReason',body->>'discountReason');
  insert into public.pos_sales(id,workspace_id,site_id,register_id,session_id,actor_id,idempotency_key,request,receipt_number,subtotal_minor,discount_minor,tax_minor,total_minor,receipt)
    values(v_sale_id,w,site.id,sess.register_id,sess.id,actor,key_id,request_body,code,sub,disc,tax,sub-disc+tax,receipt);
  for line in select value from jsonb_array_elements(lines) loop
    select * into inv from public.inventory_items where user_id=actor and id=line->>'itemId';
    qty:=(line->>'quantity')::int; remaining:=qty;
    select coalesce(sum(quantity),0) into pos_total from public.chaos_sort_inventory_positions where user_id=actor and item_id=inv.id;
    select coalesce(sum(quantity),0) into reserved from public.selling_inventory_allocations where user_id=actor and inventory_item_id=inv.id and inventory_position_id is null and status in ('ALLOCATED','RESERVED');
    if pos_total>inv.quantity then raise exception 'POS_PROVENANCE_CONFLICT'; end if;
    for v_position in select * from public.chaos_sort_inventory_positions where user_id=actor and item_id=inv.id and quantity>0 order by created_at,id for update loop
      if v_position.location_id is distinct from inv.location_id then raise exception 'POS_PROVENANCE_CONFLICT'; end if;
      if nullif(line->>'positionId','') is not null and v_position.id<>line->>'positionId' then continue; end if;
      select coalesce(sum(quantity),0) into pos_reserved from public.selling_inventory_allocations where user_id=actor and inventory_item_id=inv.id and inventory_position_id=v_position.id and status in ('ALLOCATED','RESERVED');
      take:=least(remaining,greatest(0,v_position.quantity-pos_reserved-reserved));
      if take=0 then continue; end if;
      update public.chaos_sort_inventory_positions set quantity=quantity-take,status=case when quantity-take=0 then 'depleted' else status end,updated_at=now() where user_id=actor and id=v_position.id;
      update public.chaos_sort_batches set current_quantity=current_quantity-take,updated_at=now() where user_id=actor and id=v_position.batch_id and current_quantity>=take;
      if not found then raise exception 'POS_PROVENANCE_CONFLICT'; end if;
      insert into public.pos_sale_allocations(workspace_id,sale_id,inventory_user_id,inventory_item_id,position_id,batch_id,location_id,quantity) values(w,v_sale_id,actor,inv.id,v_position.id,v_position.batch_id,v_position.location_id,take);
      remaining:=remaining-take;
      exit when remaining=0;
    end loop;
    if remaining>0 then
      if nullif(line->>'positionId','') is not null or inv.quantity-pos_total-reserved<remaining then raise exception 'POS_STOCK_UNAVAILABLE'; end if;
      insert into public.pos_sale_allocations(workspace_id,sale_id,inventory_user_id,inventory_item_id,location_id,quantity) values(w,v_sale_id,actor,inv.id,inv.location_id,remaining);
    end if;
    update public.inventory_items set quantity=quantity-qty,inventory_value=case when quantity=0 then 0 else round(inventory_value*(quantity-qty)/quantity,2) end,updated_at=now() where user_id=actor and id=inv.id;
    insert into public.pos_sale_items(workspace_id,sale_id,inventory_user_id,inventory_item_id,quantity,unit_price_minor,discount_minor,tax_minor,snapshot)
      values(w,v_sale_id,actor,inv.id,qty,(line->>'unitPriceMinor')::bigint,(line->>'discountMinor')::bigint,(line->>'taxMinor')::bigint,line);
    insert into public.inventory_events(user_id,inventory_item_id,event_type,source,related_entity_type,related_entity_id,quantity_before,quantity_change,quantity_after,previous_location_id,next_location_id,card_name,idempotency_key,metadata)
      values(actor,inv.id,'quantity_removed','system','pos_sale',v_sale_id::text,inv.quantity,-qty,inv.quantity-qty,inv.location_id,inv.location_id,inv.card_name,'pos:'||v_sale_id::text||':'||inv.id,
        jsonb_build_object('workspace_id',w,'actor_id',actor,'site_id',site.id,'register_id',sess.register_id,'receipt_number',code,'allocations',(select jsonb_agg(to_jsonb(a)) from public.pos_sale_allocations a where a.sale_id=v_sale_id and a.inventory_item_id=inv.id)));
  end loop;
  insert into public.pos_tenders(workspace_id,sale_id,method,amount_minor,received_minor,change_minor) values(w,v_sale_id,'cash',sub-disc+tax,received,received-(sub-disc+tax));
  return jsonb_build_object('status','completed','saleId',v_sale_id,'receipt',receipt,'replayed',false);
end $$;

-- Only this narrow, authenticated wrapper is exposed. Internal functions and
-- table writes are inaccessible to API roles. No service-role client is needed.
create function public.pos_command(p_workspace_id uuid,p_action text,p_body jsonb default '{}') returns jsonb
language sql security definer set search_path='' as $$ select pos_private.command(p_workspace_id,p_action,p_body); $$;
revoke all on all functions in schema pos_private from public,anon,authenticated;
revoke all on function public.pos_command(uuid,text,jsonb) from public,anon;
grant execute on function public.pos_command(uuid,text,jsonb) to authenticated;
notify pgrst,'reload schema';
create or replace function public.reserve_selling_inventory(
  p_workspace_id uuid,
  p_candidate_id uuid,
  p_quantity integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  candidate public.selling_listing_candidates%rowtype;
  existing_allocation public.selling_inventory_allocations%rowtype;
  allocation_row record;
  physical_quantity integer := 0;
  reserved_quantity integer := 0;
  available_quantity integer := 0;
  linked_item_id text;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if p_workspace_id is null or not public.is_workspace_member(p_workspace_id) then raise exception 'Workspace access denied'; end if;
  if p_quantity is null or p_quantity < 1 then raise exception 'Allocation quantity must be positive'; end if;
  if nullif(trim(p_idempotency_key), '') is null then raise exception 'Allocation idempotency key is required'; end if;

  -- Shared inventory serialization: parent before candidate/position locks.
  perform pg_advisory_xact_lock(hashtextextended('collector-inventory:' || actor::text, 0));
  perform 1 from public.inventory_items i
    join public.selling_listing_candidates c on c.user_id=i.user_id and c.inventory_item_id=i.id
    where c.id=p_candidate_id and c.user_id=actor and c.workspace_id=p_workspace_id
    for update of i;
  select * into existing_allocation
    from public.selling_inventory_allocations
    where user_id = actor and workspace_id = p_workspace_id and idempotency_key = p_idempotency_key
    for update;
  if existing_allocation.id is not null then
    select coalesce(sum(quantity), 0) into reserved_quantity
      from public.selling_inventory_allocations
      where user_id = actor and workspace_id = p_workspace_id
        and inventory_item_id = existing_allocation.inventory_item_id
        and coalesce(inventory_position_id, '') = coalesce(existing_allocation.inventory_position_id, '')
        and status in ('ALLOCATED', 'RESERVED');
    return jsonb_build_object('ok', true, 'replayed', true, 'allocationId', existing_allocation.id,
      'allocatedQuantity', existing_allocation.quantity, 'reservedQuantity', reserved_quantity);
  end if;

  select * into candidate
    from public.selling_listing_candidates
    where id = p_candidate_id and user_id = actor and workspace_id = p_workspace_id
    for update;
  if candidate.id is null then raise exception 'Selling candidate not found'; end if;
  if candidate.quantity < p_quantity then raise exception 'Allocation exceeds candidate quantity'; end if;

  if candidate.inventory_position_id is not null then
    select quantity, item_id into physical_quantity, linked_item_id
      from public.chaos_sort_inventory_positions
      where user_id = actor and id = candidate.inventory_position_id
      for update;
    if physical_quantity is null then raise exception 'Inventory position not found'; end if;
    if linked_item_id is distinct from candidate.inventory_item_id then raise exception 'Inventory position identity mismatch'; end if;
  else
    select quantity into physical_quantity
      from public.inventory_items
      where user_id = actor and id = candidate.inventory_item_id
      for update;
    if physical_quantity is null then raise exception 'Inventory item not found'; end if;
  end if;

  -- Position-specific allocations also respect item-level allocations. This
  -- is intentionally conservative for legacy item-level inventory and cannot
  -- oversell when a user later adds physical positions.
  for allocation_row in
    select quantity
    from public.selling_inventory_allocations
    where user_id = actor and workspace_id = p_workspace_id
      and inventory_item_id = candidate.inventory_item_id
      and status in ('ALLOCATED', 'RESERVED')
      and (candidate.inventory_position_id is null
        or inventory_position_id = candidate.inventory_position_id
        or inventory_position_id is null)
    for update
  loop
    reserved_quantity := reserved_quantity + allocation_row.quantity;
  end loop;

  available_quantity := greatest(0, physical_quantity - reserved_quantity);
  if p_quantity > available_quantity then
    raise exception 'Insufficient available physical quantity (requested %, available %)', p_quantity, available_quantity;
  end if;

  insert into public.selling_inventory_allocations (
    user_id, workspace_id, candidate_id, inventory_item_id, inventory_position_id, quantity, status, idempotency_key
  ) values (
    actor, p_workspace_id, candidate.id, candidate.inventory_item_id, candidate.inventory_position_id, p_quantity, 'ALLOCATED', p_idempotency_key
  ) returning * into existing_allocation;

  update public.selling_listing_candidates
    set allocated_quantity = allocated_quantity + p_quantity, updated_at = now()
    where id = candidate.id and user_id = actor and workspace_id = p_workspace_id;

  return jsonb_build_object('ok', true, 'replayed', false, 'allocationId', existing_allocation.id,
    'physicalQuantity', physical_quantity, 'reservedQuantity', reserved_quantity + p_quantity,
    'availableQuantity', greatest(0, physical_quantity - reserved_quantity - p_quantity));
end;
$$;
