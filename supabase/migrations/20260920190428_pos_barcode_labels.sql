alter table public.pos_sale_allocations add column line_key text;
-- Widen precision without changing any stored dimensions.
alter table public.label_templates alter column width type numeric(12,6), alter column height type numeric(12,6);

-- Phase 2: extend the existing canonical identity, never rewrite printed codes.
alter table public.inventory_label_identities add column inventory_position_id text;
alter table public.inventory_label_identities add column inventory_location_id text;
alter table public.inventory_label_identities alter column inventory_item_id drop not null;
alter table public.inventory_label_identities add constraint label_identity_target check (
  (inventory_item_id is not null and inventory_location_id is null) or
  (inventory_item_id is null and inventory_location_id is not null and inventory_position_id is null and target_type='storage')
);
create unique index label_identity_location_unique on public.inventory_label_identities(workspace_id,inventory_user_id,inventory_location_id)
  where inventory_location_id is not null and status='active' and revoked_at is null;
drop index public.inventory_label_identities_active_item_uidx;
create unique index inventory_label_identities_active_item_uidx
  on public.inventory_label_identities(workspace_id,inventory_user_id,inventory_item_id)
  where revoked_at is null and status='active' and inventory_position_id is null;
create unique index inventory_label_identities_active_position_uidx
  on public.inventory_label_identities(workspace_id,inventory_user_id,inventory_position_id)
  where revoked_at is null and status='active' and inventory_position_id is not null;

create table public.inventory_barcode_aliases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  inventory_user_id uuid not null references auth.users(id),
  identity_id uuid not null,
  value text not null check(length(value) between 1 and 160 and value !~ '[[:cntrl:]]'),
  barcode_type text not null check(barcode_type in ('sku','upc_ean','external')),
  source text not null default 'manual' check(length(source) between 1 and 40),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid(),
  unique(workspace_id,value)
);
alter table public.inventory_barcode_aliases enable row level security;
revoke all on public.inventory_barcode_aliases from public,anon,authenticated;
-- Retain deleted identity history even when the legacy item FK cascades.
create table pos_private.label_tombstones (
  identity_id uuid primary key, workspace_id uuid not null, inventory_user_id uuid not null,
  sku text not null, qr_token text not null, barcode_value text, deleted_at timestamptz not null default now()
);
create index label_tombstones_lookup on pos_private.label_tombstones(workspace_id,sku);
create index label_tombstones_qr_lookup on pos_private.label_tombstones(workspace_id,qr_token);
alter table pos_private.label_tombstones enable row level security;
revoke all on pos_private.label_tombstones from public,anon,authenticated;

create function pos_private.guard_label_identity() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='DELETE' then
    insert into pos_private.label_tombstones(identity_id,workspace_id,inventory_user_id,sku,qr_token,barcode_value)
      values(old.id,old.workspace_id,old.inventory_user_id,old.sku,old.qr_token,old.barcode_value) on conflict do nothing;
    return old;
  end if;
  if tg_op='UPDATE' and (new.id,new.workspace_id,new.inventory_user_id,new.inventory_item_id,new.inventory_position_id,new.inventory_location_id,new.sku,new.qr_token,new.barcode_value)
    is distinct from (old.id,old.workspace_id,old.inventory_user_id,old.inventory_item_id,old.inventory_position_id,old.inventory_location_id,old.sku,old.qr_token,old.barcode_value)
    then raise exception 'LABEL_IMMUTABLE'; end if;
  if new.inventory_location_id is not null and not exists(select 1 from public.inventory_locations l where l.user_id=new.inventory_user_id and l.id=new.inventory_location_id) then raise exception 'LABEL_INVALID_TARGET'; end if;
  if tg_op='INSERT' and new.inventory_position_id is not null and not exists (
    select 1 from public.chaos_sort_inventory_positions p where p.user_id=new.inventory_user_id and p.id=new.inventory_position_id and p.item_id=new.inventory_item_id
  ) then raise exception 'LABEL_INVALID_TARGET'; end if;
  if exists(select 1 from pos_private.label_tombstones t where t.workspace_id=new.workspace_id and (t.sku=new.sku or t.qr_token=new.qr_token))
    then raise exception 'LABEL_IMMUTABLE'; end if;
  return new;
end $$;
create trigger guard_label_identity before insert or update or delete on public.inventory_label_identities
for each row execute function pos_private.guard_label_identity();

create function pos_private.label_identity(w uuid,item text,v_position_id text default null) returns public.inventory_label_identities
language plpgsql security definer set search_path='' as $$
declare result public.inventory_label_identities%rowtype; kind text;
begin
  perform pos_private.authorize(w,false,false);
  select i.item_kind into kind from public.inventory_items i where i.workspace_id=w and i.user_id=auth.uid() and i.id=item;
  if not found then raise exception 'POS_FORBIDDEN'; end if;
  perform pg_advisory_xact_lock(hashtextextended('label:'||w::text||auth.uid()::text||item||coalesce(v_position_id,''),0));
  select * into result from public.inventory_label_identities z where z.workspace_id=w and z.inventory_user_id=auth.uid()
    and z.inventory_item_id=item and z.inventory_position_id is not distinct from v_position_id and z.status='active' and z.revoked_at is null;
  if result.id is null then
    insert into public.inventory_label_identities(workspace_id,inventory_user_id,inventory_item_id,inventory_position_id,target_type,sku,qr_token,public_enabled)
      values(w,auth.uid(),item,v_position_id,case when kind='sealed' then 'sealed' else 'single' end,'','',false) returning * into result;
  end if;
  return result;
end $$;

create function pos_private.resolve_barcode(w uuid,site uuid,input text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare code text:=trim(input); z public.inventory_label_identities%rowtype; candidate record;
  item text; v_position_id text; ids text[]; payload jsonb; available bigint; n integer;
begin
  perform pos_private.authorize(w);
  if not exists(select 1 from public.pos_store_locations s where s.id=site and s.workspace_id=w and s.inventory_user_id=auth.uid()) then raise exception 'POS_FORBIDDEN'; end if;
  if length(code) not between 1 and 160 or code ~ '[[:cntrl:]]' then raise exception 'POS_INVALID'; end if;
  if code ~* '^TD-[A-Z0-9]{4}-[A-Z0-9]{4}$' then code:=upper(code); end if;
  select count(*) into n from public.inventory_label_identities a where a.workspace_id=w and a.inventory_user_id=auth.uid() and (a.sku=code or a.qr_token=code);
  if n>1 then raise exception 'POS_BARCODE_AMBIGUOUS'; end if;
  select * into z from public.inventory_label_identities a where a.workspace_id=w and a.inventory_user_id=auth.uid() and (a.sku=code or a.qr_token=code) limit 1;
  if z.id is null then
    select a.* into candidate from public.inventory_barcode_aliases a where a.workspace_id=w and a.inventory_user_id=auth.uid() and a.value=code;
    if found then
      if not candidate.active then raise exception 'POS_BARCODE_INACTIVE'; end if;
      select * into z from public.inventory_label_identities where id=candidate.identity_id and workspace_id=w and inventory_user_id=auth.uid();
      if z.id is null then raise exception 'POS_BARCODE_INACTIVE'; end if;
    end if;
  end if;
  if z.id is not null then
    if z.status<>'active' or z.revoked_at is not null then raise exception 'POS_BARCODE_INACTIVE'; end if;
    if z.inventory_location_id is not null and not exists(select 1 from public.inventory_locations l where l.user_id=z.inventory_user_id and l.id=z.inventory_location_id) then raise exception 'POS_BARCODE_INACTIVE'; end if;
    if z.target_type in ('storage','buylist_intake') then raise exception 'POS_BARCODE_WRONG_CLASS'; end if;
    item:=z.inventory_item_id; v_position_id:=z.inventory_position_id;
  else
    if exists(select 1 from pos_private.label_tombstones t where t.workspace_id=w and t.inventory_user_id=auth.uid() and (t.sku=code or t.qr_token=code or t.barcode_value=code)) then raise exception 'POS_BARCODE_INACTIVE'; end if;
    -- UPC/EAN precedes legacy provider/product codes; ambiguity never falls through.
    select array_agg(i.id) into ids from public.inventory_items i where i.workspace_id=w and i.user_id=auth.uid() and i.upc=code;
    if ids is null then
      select array_agg(distinct i.id) into ids from public.inventory_items i where i.workspace_id=w and i.user_id=auth.uid()
        and (i.sku=code or i.barcode_value=code or i.id=code or i.data->>'tcgplayer_product_id'=code or i.data->>'provider_sku_id'=code
          or exists(select 1 from public.inventory_label_identities a where a.workspace_id=w and a.inventory_user_id=i.user_id and a.inventory_item_id=i.id and a.barcode_value=code and a.status='active' and a.revoked_at is null));
    end if;
    if cardinality(ids)>1 then raise exception 'POS_BARCODE_AMBIGUOUS'; end if;
    item:=ids[1];
    if item is null then return '[]'; end if;
  end if;
  select jsonb_build_object('id',i.id,'name',coalesce(nullif(i.product_name,''),i.card_name),'sku',coalesce(z.sku,i.sku),'set_code',i.set_code,'collector_number',i.collector_number,
    'condition',coalesce(p.condition,i.data->>'condition'),'finish',coalesce(p.finish,i.data->>'finish'),'language',coalesce(p.language,i.data->>'language'),
    'location_id',i.location_id,'location',l.name,'taxable',coalesce(i.data->>'taxable','true')<>'false',
    'unit_price_minor',case when i.asking_price between 0 and 1000000 then (i.asking_price*100)::bigint end,
    'positionId',v_position_id,'barcodeIdentity',z.id,'targetType',case when v_position_id is null then 'inventory_item' else 'inventory_position' end,
    'batchId',p.batch_id,'image',i.data->>'imageUrl',
    'available',greatest(0,least(i.quantity-coalesce((select sum(a.quantity) from public.selling_inventory_allocations a where a.user_id=i.user_id and a.inventory_item_id=i.id and a.status in ('ALLOCATED','RESERVED')),0),
      case when v_position_id is null then i.quantity else p.quantity-coalesce((select sum(a.quantity) from public.selling_inventory_allocations a where a.user_id=i.user_id and a.inventory_item_id=i.id and (a.inventory_position_id is null or a.inventory_position_id=v_position_id) and a.status in ('ALLOCATED','RESERVED')),0) end)),
    'positions',coalesce((select jsonb_agg(jsonb_build_object('id',cp.id,'batchId',cp.batch_id,'quantity',cp.quantity,'locationId',cp.location_id)) from public.chaos_sort_inventory_positions cp where cp.user_id=i.user_id and cp.item_id=i.id and cp.quantity>0 and (v_position_id is null or cp.id=v_position_id)),'[]')) into payload
  from public.inventory_items i join public.inventory_locations l on l.user_id=i.user_id and l.id=i.location_id
  join public.pos_location_inventory_locations m on m.inventory_user_id=i.user_id and m.location_id=i.location_id and m.site_id=site
  left join public.chaos_sort_inventory_positions p on p.user_id=i.user_id and p.id=v_position_id and p.item_id=i.id and p.location_id=i.location_id
  where i.workspace_id=w and i.user_id=auth.uid() and i.id=item and (v_position_id is null or p.id is not null);
  if payload is null or (payload->>'available')::bigint<1 then raise exception 'POS_BARCODE_INACTIVE'; end if;
  return jsonb_build_array(payload);
end $$;

create function public.label_targets(p_workspace_id uuid,p_ids text[] default '{}',p_batch_id uuid default null,p_query text default '',p_issue boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r record; z public.inventory_label_identities%rowtype; result jsonb:='[]';
begin
  perform pos_private.authorize(p_workspace_id,false,false);
  if cardinality(p_ids)>500 or length(p_query)>160 then raise exception 'POS_INVALID'; end if;
  for r in
    select i.*,p.id as position_id,p.quantity as position_quantity,p.condition as position_condition,p.finish as position_finish,p.language as position_language,b.batch_code,l.name as location_name
    from public.inventory_items i
    left join public.chaos_sort_inventory_positions p on p.user_id=i.user_id and p.item_id=i.id and p.quantity>0 and coalesce(i.item_kind,'single')<>'sealed'
    left join public.chaos_sort_batches b on b.id=p.batch_id and b.user_id=p.user_id
    join public.inventory_locations l on l.user_id=i.user_id and l.id=i.location_id
    where i.workspace_id=p_workspace_id and i.user_id=auth.uid() and i.quantity>0
      and (cardinality(p_ids)=0 or i.id=any(p_ids) or p.id=any(p_ids) or ('item:'||i.id)=any(p_ids) or ('position:'||p.id)=any(p_ids))
      and (p_batch_id is null or p.batch_id=p_batch_id)
      and (p_query='' or i.card_name ilike '%'||p_query||'%' or i.sku=p_query or l.name ilike '%'||p_query||'%' or b.batch_code=p_query)
    order by i.updated_at desc,i.id,p.id limit 500
  loop
    if p_issue then z:=pos_private.label_identity(p_workspace_id,r.id,r.position_id);
    else select * into z from public.inventory_label_identities a where a.workspace_id=p_workspace_id and a.inventory_user_id=auth.uid() and a.inventory_item_id=r.id and a.inventory_position_id is not distinct from r.position_id and a.status='active' and a.revoked_at is null; end if;
    result:=result||jsonb_build_array(jsonb_build_object('key',case when r.position_id is null then 'item:'||r.id else 'position:'||r.position_id end,'itemId',r.id,'positionId',r.position_id,'name',coalesce(nullif(r.product_name,''),r.card_name),
      'game',coalesce(r.data->>'game_id',r.data->>'gameId',r.data->>'game'),'set',r.set_code,'number',r.collector_number,'condition',coalesce(r.position_condition,r.data->>'condition'),'finish',coalesce(r.position_finish,r.data->>'finish'),'language',coalesce(r.position_language,r.data->>'language'),
      'location',r.location_name,'batch',r.batch_code,'quantity',coalesce(r.position_quantity,r.quantity),'price',r.asking_price,'upc',case when r.item_kind='sealed' and r.upc ~ '^\d{8,13}$' and (select count(*) from public.inventory_items u where u.workspace_id=p_workspace_id and u.user_id=auth.uid() and u.upc=r.upc)=1 and not exists(select 1 from public.inventory_barcode_aliases a where a.workspace_id=p_workspace_id and a.value=r.upc and (not a.active or a.identity_id is distinct from z.id)) then r.upc else null end,'sku',z.sku,'identityId',z.id,'qrToken',z.qr_token));
  end loop;
  return result;
end $$;

create function public.assign_label_barcode(p_workspace_id uuid,p_identity_id uuid,p_value text,p_type text default 'external',p_active boolean default true) returns jsonb
language plpgsql security definer set search_path='' as $$
declare z public.inventory_label_identities%rowtype; existing public.inventory_barcode_aliases%rowtype; v text:=trim(p_value);
begin
  perform pos_private.authorize(p_workspace_id,true,false);
  if length(v) not between 1 and 160 or v ~ '[[:cntrl:]]' or v ~* '^TD-' or p_type not in ('sku','upc_ean','external') then raise exception 'POS_INVALID'; end if;
  if exists(select 1 from pos_private.label_tombstones t where t.workspace_id=p_workspace_id and (t.sku=v or t.qr_token=v)) then raise exception 'POS_BARCODE_INACTIVE'; end if;
  select * into z from public.inventory_label_identities where id=p_identity_id and workspace_id=p_workspace_id and inventory_user_id=auth.uid() and status='active' and revoked_at is null;
  if z.id is null then raise exception 'POS_FORBIDDEN'; end if;
  perform pg_advisory_xact_lock(hashtextextended('alias:'||p_workspace_id::text||v,0));
  select * into existing from public.inventory_barcode_aliases where workspace_id=p_workspace_id and value=v;
  if existing.id is not null and existing.identity_id<>z.id then raise exception 'POS_BARCODE_AMBIGUOUS'; end if;
  if exists(select 1 from public.inventory_label_identities a where a.workspace_id=p_workspace_id and a.id<>z.id and (a.sku=v or a.qr_token=v or a.barcode_value=v))
    or exists(select 1 from public.inventory_items i where i.workspace_id=p_workspace_id and (i.user_id<>z.inventory_user_id or i.id<>z.inventory_item_id) and (i.sku=v or i.upc=v or i.barcode_value=v)) then raise exception 'POS_BARCODE_AMBIGUOUS'; end if;
  insert into public.inventory_barcode_aliases(workspace_id,inventory_user_id,identity_id,value,barcode_type,active) values(p_workspace_id,auth.uid(),z.id,v,p_type,p_active)
    on conflict(workspace_id,value) do update set active=excluded.active;
  return jsonb_build_object('ok',true);
end $$;

revoke all on all functions in schema pos_private from public,anon,authenticated;
revoke all on function public.label_targets(uuid,text[],uuid,text,boolean) from public,anon;
revoke all on function public.assign_label_barcode(uuid,uuid,text,text,boolean) from public,anon;
grant execute on function public.label_targets(uuid,text[],uuid,text,boolean) to authenticated;
grant execute on function public.assign_label_barcode(uuid,uuid,text,text,boolean) to authenticated;

-- Preserve the Phase 1 finalizer, extending only exact resolution and position line keys.
create or replace function pos_private.command(w uuid, action text, body jsonb) returns jsonb
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
  if action='search' and coalesce(body->>'exact','false')='true' then
    return pos_private.resolve_barcode(w,site.id,body->>'query');
  end if;
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
  if (select count(distinct (value->>'itemId',coalesce(nullif(value->>'positionId',''),''))) from jsonb_array_elements(body->'lines'))<>jsonb_array_length(body->'lines') then raise exception 'POS_INVALID'; end if;
  -- Reuse collector serialization before item locks. No owner impersonation.
  perform pg_advisory_xact_lock(hashtextextended('collector-inventory:'||actor::text,0));
  perform 1 from public.inventory_items where user_id=actor and id in (select value->>'itemId' from jsonb_array_elements(body->'lines')) order by id for update;
  for line in select value from jsonb_array_elements(body->'lines') order by value->>'itemId',nullif(value->>'positionId','') nulls last loop
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
    lines:=lines||jsonb_build_array(jsonb_build_object('itemId',inv.id,'name',coalesce(nullif(inv.product_name,''),inv.card_name),'sku',inv.sku,'quantity',qty,'unitPriceMinor',price,'discountMinor',line_disc,'taxMinor',line_tax,'lineTotalMinor',line_sub-line_disc+line_tax,'gameId',coalesce(to_jsonb(inv)->>'game_id',inv.data->>'game_id'),'productType',coalesce(to_jsonb(inv)->>'product_type',inv.data->>'product_type'),'scryfallId',inv.scryfall_id,'tcgplayerProductId',coalesce(to_jsonb(inv)->>'tcgplayer_product_id',inv.data->>'tcgplayer_product_id'),'setCode',inv.set_code,'collectorNumber',inv.collector_number,'condition',coalesce((select p.condition from public.chaos_sort_inventory_positions p where p.user_id=actor and p.id=line->>'positionId' and p.item_id=inv.id),inv.data->>'condition'),'finish',coalesce((select p.finish from public.chaos_sort_inventory_positions p where p.user_id=actor and p.id=line->>'positionId' and p.item_id=inv.id),inv.data->>'finish'),'language',coalesce((select p.language from public.chaos_sort_inventory_positions p where p.user_id=actor and p.id=line->>'positionId' and p.item_id=inv.id),inv.data->>'language'),'locationId',inv.location_id,'costBasis',pos_private.cost_snapshot(inv.data),'priceSource','asking_price','positionId',line->>'positionId'));
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
      insert into public.pos_sale_allocations(workspace_id,sale_id,inventory_user_id,inventory_item_id,position_id,batch_id,location_id,quantity,line_key) values(w,v_sale_id,actor,inv.id,v_position.id,v_position.batch_id,v_position.location_id,take,coalesce(line->>'positionId',''));
      remaining:=remaining-take;
      exit when remaining=0;
    end loop;
    if remaining>0 then
      if nullif(line->>'positionId','') is not null or inv.quantity-pos_total-reserved<remaining then raise exception 'POS_STOCK_UNAVAILABLE'; end if;
      insert into public.pos_sale_allocations(workspace_id,sale_id,inventory_user_id,inventory_item_id,location_id,quantity,line_key) values(w,v_sale_id,actor,inv.id,inv.location_id,remaining,coalesce(line->>'positionId',''));
    end if;
    update public.inventory_items set quantity=quantity-qty,inventory_value=case when quantity=0 then 0 else round(inventory_value*(quantity-qty)/quantity,2) end,updated_at=now() where user_id=actor and id=inv.id;
    insert into public.pos_sale_items(workspace_id,sale_id,inventory_user_id,inventory_item_id,quantity,unit_price_minor,discount_minor,tax_minor,snapshot)
      values(w,v_sale_id,actor,inv.id,qty,(line->>'unitPriceMinor')::bigint,(line->>'discountMinor')::bigint,(line->>'taxMinor')::bigint,line);
    insert into public.inventory_events(user_id,inventory_item_id,event_type,source,related_entity_type,related_entity_id,quantity_before,quantity_change,quantity_after,previous_location_id,next_location_id,card_name,idempotency_key,metadata)
      values(actor,inv.id,'quantity_removed','system','pos_sale',v_sale_id::text,inv.quantity,-qty,inv.quantity-qty,inv.location_id,inv.location_id,inv.card_name,'pos:'||v_sale_id::text||':'||inv.id||case when nullif(line->>'positionId','') is null then '' else ':position:'||md5(line->>'positionId') end,
        jsonb_build_object('workspace_id',w,'actor_id',actor,'site_id',site.id,'register_id',sess.register_id,'receipt_number',code,'allocations',(select jsonb_agg(to_jsonb(a)) from public.pos_sale_allocations a where a.sale_id=v_sale_id and a.inventory_item_id=inv.id and a.line_key=coalesce(line->>'positionId',''))));
  end loop;
  insert into public.pos_tenders(workspace_id,sale_id,method,amount_minor,received_minor,change_minor) values(w,v_sale_id,'cash',sub-disc+tax,received,received-(sub-disc+tax));
  return jsonb_build_object('status','completed','saleId',v_sale_id,'receipt',receipt,'replayed',false);
end $$;


create or replace function pos_private.protect_event_origin() returns trigger language plpgsql set search_path='' as $$
begin
  if new.related_entity_type='pos_sale' and current_user in ('authenticated','anon') then raise exception 'POS_FORBIDDEN'; end if;
  if new.related_entity_type='pos_sale' and not exists (
    select 1 from public.pos_sales s join public.pos_sale_items l on l.sale_id=s.id
    where s.id::text=new.related_entity_id and s.actor_id=new.user_id
      and l.inventory_user_id=new.user_id and l.inventory_item_id=new.inventory_item_id
      and new.quantity_change=-l.quantity and new.quantity_after=new.quantity_before-l.quantity
      and new.idempotency_key='pos:'||s.id::text||':'||l.inventory_item_id||case when nullif(l.snapshot->>'positionId','') is null then '' else ':position:'||md5(l.snapshot->>'positionId') end
  ) then raise exception 'POS_FORBIDDEN'; end if;
  return new;
end $$;

notify pgrst,'reload schema';

alter table public.label_print_jobs drop constraint label_print_jobs_counts_check;
alter table public.label_print_jobs add constraint label_print_jobs_counts_check check(label_count between 0 and 10000 and page_count between 0 and 10000);

create function public.set_default_label_template(p_workspace_id uuid,p_template_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform pos_private.authorize(p_workspace_id,true,false);
  perform pg_advisory_xact_lock(hashtextextended('label-template:'||p_workspace_id::text,0));
  if not exists(select 1 from public.label_templates where id=p_template_id and workspace_id=p_workspace_id and archived_at is null) then raise exception 'POS_FORBIDDEN'; end if;
  update public.label_templates set template_data=jsonb_set(template_data,'{isDefault}','false'),updated_at=now() where workspace_id=p_workspace_id and archived_at is null and template_data->>'isDefault'='true';
  update public.label_templates set template_data=jsonb_set(template_data,'{isDefault}','true'),updated_at=now() where id=p_template_id and workspace_id=p_workspace_id;
end $$;
revoke all on function public.set_default_label_template(uuid,uuid) from public,anon;
grant execute on function public.set_default_label_template(uuid,uuid) to authenticated;

create function pos_private.retire_position_label() returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.inventory_label_identities set status='archived' where inventory_user_id=old.user_id and inventory_position_id=old.id;
  return old;
end $$;
create trigger retire_position_label after delete on public.chaos_sort_inventory_positions for each row execute function pos_private.retire_position_label();
revoke all on function pos_private.retire_position_label() from public,anon,authenticated;

create function public.label_actor_allowed(w uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
  perform pos_private.authorize(w,false,false); return true;
exception when others then return false;
end $$;
revoke all on function public.label_actor_allowed(uuid) from public,anon;
grant execute on function public.label_actor_allowed(uuid) to authenticated;
create policy "Active label actors only" on public.label_templates as restrictive for all to authenticated
  using(public.label_actor_allowed(workspace_id)) with check(public.label_actor_allowed(workspace_id));
create policy "Active identity actors only" on public.inventory_label_identities as restrictive for all to authenticated
  using(public.label_actor_allowed(workspace_id)) with check(public.label_actor_allowed(workspace_id));
create policy "Own identity inserts only" on public.inventory_label_identities as restrictive for insert to authenticated with check(inventory_user_id=(select auth.uid()));
create policy "Own identity updates only" on public.inventory_label_identities as restrictive for update to authenticated using(inventory_user_id=(select auth.uid())) with check(inventory_user_id=(select auth.uid()));
-- Printed identities are retired, never arbitrarily deleted by an API role.
revoke delete on public.inventory_label_identities from authenticated;

create function public.label_locations(p_workspace_id uuid,p_ids text[] default '{}',p_issue boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r record; z public.inventory_label_identities%rowtype; result jsonb:='[]';
begin
  perform pos_private.authorize(p_workspace_id,false,false);
  if cardinality(p_ids)>500 then raise exception 'POS_INVALID'; end if;
  for r in select * from public.inventory_locations where user_id=auth.uid() and (cardinality(p_ids)=0 or id=any(p_ids)) order by name,id limit 500 loop
    perform pg_advisory_xact_lock(hashtextextended('location-label:'||p_workspace_id::text||auth.uid()::text||r.id,0));
    select * into z from public.inventory_label_identities where workspace_id=p_workspace_id and inventory_user_id=auth.uid() and inventory_location_id=r.id and status='active' and revoked_at is null;
    if p_issue and z.id is null then
      insert into public.inventory_label_identities(workspace_id,inventory_user_id,inventory_location_id,target_type,sku,qr_token)
        values(p_workspace_id,auth.uid(),r.id,'storage','','') returning * into z;
    end if;
    result:=result||jsonb_build_array(jsonb_build_object('key','location:'||r.id,'itemId','','positionId',null,'name',r.name,'location',r.name,'quantity',1,'price',null,'sku',z.sku,'identityId',z.id,'qrToken',z.qr_token));
  end loop;
  return result;
end $$;
revoke all on function public.label_locations(uuid,text[],boolean) from public,anon;
grant execute on function public.label_locations(uuid,text[],boolean) to authenticated;

create unique index label_templates_one_default on public.label_templates(workspace_id) where archived_at is null and template_data->>'isDefault'='true';
