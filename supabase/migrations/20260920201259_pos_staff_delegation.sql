-- Explicit operational delegation; canonical ownership is unchanged.
create table public.pos_inventory_delegations (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null,
  site_id uuid not null, inventory_user_id uuid not null references auth.users(id),
  employee_id uuid not null references auth.users(id), capabilities text[] not null,
  granted_by uuid not null references auth.users(id), granted_at timestamptz not null default now(),
  revoked_by uuid references auth.users(id), revoked_at timestamptz,
  valid_until timestamptz, reason text not null default '',
  foreign key(workspace_id,site_id) references public.pos_store_locations(workspace_id,id),
  check(granted_by=inventory_user_id and employee_id<>inventory_user_id),
  check(cardinality(capabilities)>0 and capabilities <@ array['sell','return']::text[]),
  check((revoked_at is null)=(revoked_by is null)), check(length(reason)<=500)
);
create unique index pos_delegation_active on public.pos_inventory_delegations(workspace_id,site_id,inventory_user_id,employee_id) where revoked_at is null;
create index pos_delegation_employee on public.pos_inventory_delegations(employee_id,workspace_id,site_id) where revoked_at is null;
alter table public.pos_inventory_delegations enable row level security;
revoke all on public.pos_inventory_delegations from public,anon,authenticated;

create table public.pos_access_events (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
  actor_id uuid not null references auth.users(id), action text not null, snapshot jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.pos_access_events enable row level security;
revoke all on public.pos_access_events from public,anon,authenticated;
create trigger pos_access_events_immutable before update or delete on public.pos_access_events for each row execute function pos_private.immutable();

-- Only the trusted finalizer can mint a one-row, transaction-bound permit.
-- No JWT substitution or caller-set GUC is accepted as delegation authority.
create table pos_private.stock_permits (
  transaction_id bigint not null, backend integer not null, actor_id uuid not null,
  owner_id uuid not null, item_id text not null, before_row jsonb not null,
  after_quantity integer not null check(after_quantity>=0),
  primary key(transaction_id,backend,owner_id,item_id)
);
alter table pos_private.stock_permits enable row level security;
revoke all on pos_private.stock_permits from public,anon,authenticated;

create function pos_private.permission(w uuid, operation text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.workspace_members m where m.workspace_id=w and m.user_id=auth.uid()
   and (m.role in ('owner','admin','manager') or (m.role='member' and operation='sell')
     or (m.role in ('member','employee') and exists(select 1 from public.workspace_employees e
       where e.workspace_id=w and e.linked_user_id=m.user_id and e.employment_status='active'
         and coalesce(e.permissions->>('pos.'||operation),'false')='true'))))
$$;

create or replace function pos_private.authorize(w uuid, management boolean default false, require_enabled boolean default true)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.workspace_members m join auth.users u on u.id=m.user_id
   where m.workspace_id=w and m.user_id=auth.uid() and m.role in ('owner','admin','manager','member','employee')
   and (not management or m.role in ('owner','admin','manager')) and (u.banned_until is null or u.banned_until<now()))
   or exists(select 1 from public.workspace_employees e where e.workspace_id=w and e.linked_user_id=auth.uid()
     and (e.employment_status<>'active' or coalesce(to_jsonb(e)->>'account_status','active')='suspended'))
 then raise exception 'POS_FORBIDDEN'; end if;
 if coalesce(public.collector_effective_membership_tier(auth.uid()),'') not in ('seller','store')
   and not exists(select 1 from public.pos_inventory_delegations d where d.workspace_id=w and d.employee_id=auth.uid()
     and d.revoked_at is null and (d.valid_until is null or d.valid_until>now())
     and public.collector_effective_membership_tier(d.inventory_user_id) in ('seller','store'))
 then raise exception 'POS_FORBIDDEN'; end if;
 if not pos_private.permission(w,'sell') then raise exception 'POS_FORBIDDEN'; end if;
 if require_enabled and not exists(select 1 from public.pos_workspace_settings where workspace_id=w and enabled) then raise exception 'POS_DISABLED'; end if;
end $$;

create function pos_private.can_transact(w uuid, site uuid, stock_owner uuid, operation text) returns boolean
language sql stable security definer set search_path='' as $$
 select pos_private.permission(w,case when operation='return' then 'refund' else 'sell' end)
 and public.collector_effective_membership_tier(stock_owner) in ('seller','store')
 and exists(select 1 from public.pos_store_locations s where s.id=site and s.workspace_id=w)
 and exists(select 1 from public.pos_location_inventory_locations m where m.workspace_id=w and m.site_id=site and m.inventory_user_id=stock_owner)
 and (stock_owner=auth.uid() or exists(select 1 from public.pos_inventory_delegations d
   join public.workspace_employees e on e.workspace_id=d.workspace_id and e.linked_user_id=d.employee_id
   where d.workspace_id=w and d.site_id=site and d.inventory_user_id=stock_owner and d.employee_id=auth.uid()
     and d.revoked_at is null and (d.valid_until is null or d.valid_until>statement_timestamp())
     and operation=any(d.capabilities) and e.employment_status='active'
     and coalesce(to_jsonb(e)->>'account_status','active')<>'suspended'
     and public.collector_effective_membership_tier(stock_owner) in ('seller','store')))
$$;

create function pos_private.lock_authority(w uuid, site uuid, stock_owner uuid, operation text) returns void
language plpgsql security definer set search_path='' as $$
begin
 -- Same lock is used by grant, revoke and scope replacement. Stock-owner locks
 -- are acquired in UUID order by checkout before any parent/position lock.
 perform pg_advisory_xact_lock(hashtextextended('collector-inventory:'||stock_owner::text,0));
 if not pos_private.can_transact(w,site,stock_owner,operation) then raise exception 'POS_FORBIDDEN'; end if;
end $$;

create function pos_private.permitted_stock_update(previous jsonb, next_row jsonb) returns boolean
language sql volatile security definer set search_path='' as $$
 select exists(select 1 from pos_private.stock_permits p where p.transaction_id=txid_current() and p.backend=pg_backend_pid()
  and p.actor_id=auth.uid() and p.owner_id=(previous->>'user_id')::uuid and p.item_id=previous->>'id'
  and p.before_row=previous and p.after_quantity=(next_row->>'quantity')::int
  and (previous-array['quantity','inventory_value','updated_at'])=(next_row-array['quantity','inventory_value','updated_at']))
$$;

create function pos_private.access_command(w uuid, action text, body jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target public.pos_inventory_delegations%rowtype; site uuid:=(body->>'siteId')::uuid; who uuid:=(body->>'employeeId')::uuid; caps text[];
begin
 perform pos_private.authorize(w);
 if action='access' then
   return jsonb_build_object('joinableSites',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name)),'[]') from public.pos_store_locations s where s.workspace_id=w and exists(select 1 from public.workspace_members where workspace_id=w and user_id=auth.uid() and role in ('owner','admin','manager'))),
    'grants',(select coalesce(jsonb_agg(d),'[]') from public.pos_inventory_delegations d where d.workspace_id=w and d.inventory_user_id=auth.uid()),
    'employees',(select coalesce(jsonb_agg(jsonb_build_object('id',e.linked_user_id,'name',e.full_name,'permissions',e.permissions)),'[]') from public.workspace_employees e
       where e.workspace_id=w and e.employment_status='active' and exists(select 1 from public.pos_location_inventory_locations s where s.workspace_id=w and s.inventory_user_id=auth.uid())));
 end if;
 if action='staff_permissions' then
   if not exists(select 1 from public.workspace_members where workspace_id=w and user_id=auth.uid() and role in ('owner','admin')) then raise exception 'POS_FORBIDDEN'; end if;
   if jsonb_typeof(body->'permissions')<>'object' or exists(select 1 from jsonb_each(body->'permissions') x where x.key not in ('pos.sell','pos.refund','pos.cash','pos.discount','pos.override') or jsonb_typeof(x.value)<>'boolean') then raise exception 'POS_INVALID'; end if;
   update public.workspace_employees set permissions=permissions||(body->'permissions') where workspace_id=w and linked_user_id=who;
   if not found then raise exception 'POS_FORBIDDEN'; end if;
 elsif action='join_site' then
   if not exists(select 1 from public.workspace_members where workspace_id=w and user_id=auth.uid() and role in ('owner','admin','manager'))
    or not exists(select 1 from public.pos_store_locations where id=site and workspace_id=w)
    or not exists(select 1 from public.inventory_locations where user_id=auth.uid() and id=body->>'locationId') then raise exception 'POS_FORBIDDEN'; end if;
   insert into public.pos_location_inventory_locations values(w,site,auth.uid(),body->>'locationId');
 else
   perform pg_advisory_xact_lock(hashtextextended('collector-inventory:'||auth.uid()::text,0));
   if action='revoke' then
     select * into target from public.pos_inventory_delegations where id=(body->>'id')::uuid and workspace_id=w and inventory_user_id=auth.uid() for update;
     if target.id is null then raise exception 'POS_FORBIDDEN'; end if;
     if target.revoked_at is not null then return to_jsonb(target); end if;
     update public.pos_inventory_delegations set revoked_at=now(),revoked_by=auth.uid() where id=target.id returning * into target;
   elsif action='grant' then
     if not exists(select 1 from public.pos_location_inventory_locations where workspace_id=w and site_id=site and inventory_user_id=auth.uid())
      or not exists(select 1 from public.workspace_members m join public.workspace_employees e on e.workspace_id=m.workspace_id and e.linked_user_id=m.user_id
        where m.workspace_id=w and m.user_id=who and m.role in ('employee','member','manager','admin','owner') and e.employment_status='active') then raise exception 'POS_FORBIDDEN'; end if;
     select array_agg(value) into caps from jsonb_array_elements_text(body->'capabilities');
     if caps is null then raise exception 'POS_INVALID'; end if;
     select * into target from public.pos_inventory_delegations where workspace_id=w and site_id=site and inventory_user_id=auth.uid() and employee_id=who and revoked_at is null;
     if target.id is not null then
       if target.capabilities=caps and target.valid_until is not distinct from (body->>'validUntil')::timestamptz then return to_jsonb(target); end if;
       update public.pos_inventory_delegations set revoked_at=now(),revoked_by=auth.uid() where id=target.id;
       insert into public.pos_access_events(workspace_id,actor_id,action,snapshot) values(w,auth.uid(),'scope_replaced',to_jsonb(target));
     end if;
     insert into public.pos_inventory_delegations(workspace_id,site_id,inventory_user_id,employee_id,capabilities,granted_by,valid_until,reason)
       values(w,site,auth.uid(),who,caps,auth.uid(),(body->>'validUntil')::timestamptz,coalesce(body->>'reason','')) returning * into target;
   else raise exception 'POS_INVALID'; end if;
 end if;
 insert into public.pos_access_events(workspace_id,actor_id,action,snapshot) values(w,auth.uid(),action,case when target.id is null then body else to_jsonb(target) end);
 return coalesce(to_jsonb(target),jsonb_build_object('ok',true));
end $$;

create or replace function public.enforce_collector_inventory_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  acting_user_id uuid;
  target_user_id uuid;
  effective_tier text;
  existing_quantity_total bigint;
  previous_quantity_total bigint;
  next_quantity_total bigint;
  has_full_platform_access boolean := false;
begin
  acting_user_id := public.collector_inventory_acting_user();
  if tg_op = 'DELETE' then target_user_id := old.user_id; else target_user_id := new.user_id; end if;
  if tg_op='UPDATE' and acting_user_id is not null and acting_user_id<>target_user_id and pos_private.permitted_stock_update(to_jsonb(old),to_jsonb(new)) then
    new.updated_at:=now(); return new;
  end if;
  if acting_user_id is null or target_user_id is null or acting_user_id <> target_user_id then
    perform public.raise_collector_inventory_error('TD_COLLECTOR_UNAUTHORIZED', 'You can only mutate your own collection records.', target_user_id);
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if new.quantity is null or new.quantity < 0 then
    perform public.raise_collector_inventory_error('TD_COLLECTOR_INVALID_QUANTITY', 'Quantity must be a whole number at or above zero.', target_user_id);
  end if;
  perform pg_advisory_xact_lock(hashtextextended('collector-inventory:' || target_user_id::text, 0));
  effective_tier := public.collector_effective_membership_tier(target_user_id);
  if effective_tier is null then
    perform public.raise_collector_inventory_error('TD_COLLECTOR_MISSING_MEMBERSHIP', 'Membership could not be resolved for this collection mutation.', target_user_id);
  end if;
  has_full_platform_access := coalesce(public.current_admin_role() in ('owner'::public.admin_role, 'admin'::public.admin_role), false);
  if effective_tier = 'free' and not has_full_platform_access then
    select coalesce(sum(quantity), 0) into existing_quantity_total from public.inventory_items where user_id = target_user_id and id <> new.id;
    next_quantity_total := existing_quantity_total + new.quantity;
    if tg_op = 'UPDATE' then previous_quantity_total := existing_quantity_total + old.quantity; else previous_quantity_total := existing_quantity_total; end if;
    if next_quantity_total > 500 and (tg_op = 'INSERT' or next_quantity_total > previous_quantity_total) then
      perform public.raise_collector_inventory_error('TD_COLLECTOR_FREE_LIMIT_EXCEEDED', 'Collection limit reached: Free accounts can hold up to 500 total owned cards. Reduce quantity or upgrade to add more.', target_user_id);
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create function pos_private.resolve_owner_barcode(w uuid,site uuid,input text,stock_owner uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare code text:=trim(input); z public.inventory_label_identities%rowtype; candidate record;
  item text; v_position_id text; ids text[]; payload jsonb; available bigint; n integer;
begin
  perform pos_private.authorize(w);
  if not pos_private.can_transact(w,site,stock_owner,'sell') then raise exception 'POS_FORBIDDEN'; end if;
  if length(code) not between 1 and 160 or code ~ '[[:cntrl:]]' then raise exception 'POS_INVALID'; end if;
  if code ~* '^TD-[A-Z0-9]{4}-[A-Z0-9]{4}$' then code:=upper(code); end if;
  select count(*) into n from public.inventory_label_identities a where a.workspace_id=w and a.inventory_user_id=stock_owner and (a.sku=code or a.qr_token=code);
  if n>1 then raise exception 'POS_BARCODE_AMBIGUOUS'; end if;
  select * into z from public.inventory_label_identities a where a.workspace_id=w and a.inventory_user_id=stock_owner and (a.sku=code or a.qr_token=code) limit 1;
  if z.id is null then
    select a.* into candidate from public.inventory_barcode_aliases a where a.workspace_id=w and a.inventory_user_id=stock_owner and a.value=code;
    if found then
      if not candidate.active then raise exception 'POS_BARCODE_INACTIVE'; end if;
      select * into z from public.inventory_label_identities where id=candidate.identity_id and workspace_id=w and inventory_user_id=stock_owner;
      if z.id is null then raise exception 'POS_BARCODE_INACTIVE'; end if;
    end if;
  end if;
  if z.id is not null then
    if z.status<>'active' or z.revoked_at is not null then raise exception 'POS_BARCODE_INACTIVE'; end if;
    if z.inventory_location_id is not null and not exists(select 1 from public.inventory_locations l where l.user_id=z.inventory_user_id and l.id=z.inventory_location_id) then raise exception 'POS_BARCODE_INACTIVE'; end if;
    if z.target_type in ('storage','buylist_intake') then raise exception 'POS_BARCODE_WRONG_CLASS'; end if;
    item:=z.inventory_item_id; v_position_id:=z.inventory_position_id;
  else
    if exists(select 1 from pos_private.label_tombstones t where t.workspace_id=w and t.inventory_user_id=stock_owner and (t.sku=code or t.qr_token=code or t.barcode_value=code)) then raise exception 'POS_BARCODE_INACTIVE'; end if;
    -- UPC/EAN precedes legacy provider/product codes; ambiguity never falls through.
    select array_agg(i.id) into ids from public.inventory_items i where i.workspace_id=w and i.user_id=stock_owner and i.upc=code;
    if ids is null then
      select array_agg(distinct i.id) into ids from public.inventory_items i where i.workspace_id=w and i.user_id=stock_owner
        and (i.sku=code or i.barcode_value=code or i.id=code or i.data->>'tcgplayer_product_id'=code or i.data->>'provider_sku_id'=code
          or exists(select 1 from public.inventory_label_identities a where a.workspace_id=w and a.inventory_user_id=i.user_id and a.inventory_item_id=i.id and a.barcode_value=code and a.status='active' and a.revoked_at is null));
    end if;
    if cardinality(ids)>1 then raise exception 'POS_BARCODE_AMBIGUOUS'; end if;
    item:=ids[1];
    if item is null then return '[]'; end if;
  end if;
  select jsonb_build_object('id',i.id,'ownerId',i.user_id,'name',coalesce(nullif(i.product_name,''),i.card_name),'sku',coalesce(z.sku,i.sku),'set_code',i.set_code,'collector_number',i.collector_number,
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
  where i.workspace_id=w and i.user_id=stock_owner and i.id=item and (v_position_id is null or p.id is not null);
  if payload is null or (payload->>'available')::bigint<1 then raise exception 'POS_BARCODE_INACTIVE'; end if;
  return jsonb_build_array(payload);
end $$;


create or replace function pos_private.resolve_barcode(w uuid,site uuid,input text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare stock_owner uuid; result jsonb:='[]'; candidate jsonb;
begin
 perform pos_private.authorize(w);
 for stock_owner in select distinct m.inventory_user_id from public.pos_location_inventory_locations m
   where m.workspace_id=w and m.site_id=site and pos_private.can_transact(w,site,m.inventory_user_id,'sell') order by m.inventory_user_id loop
   candidate:=pos_private.resolve_owner_barcode(w,site,input,stock_owner);
   result:=result||candidate;
 end loop;
 if jsonb_array_length(result)>1 then raise exception 'POS_BARCODE_AMBIGUOUS'; end if;
 return result;
end $$;
create or replace function pos_private.cash_command(w uuid, action text, body jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  stock_owner uuid;
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
      'sites',(select coalesce(jsonb_agg(s),'[]') from public.pos_store_locations s where s.workspace_id=w and exists(select 1 from public.pos_location_inventory_locations m where m.site_id=s.id and pos_private.can_transact(w,s.id,m.inventory_user_id,'sell'))),
      'registers',(select coalesce(jsonb_agg(r),'[]') from public.pos_registers r join public.pos_store_locations s on s.id=r.site_id where r.workspace_id=w and exists(select 1 from public.pos_location_inventory_locations m where m.site_id=s.id and pos_private.can_transact(w,s.id,m.inventory_user_id,'sell'))),
      'sessions',(select coalesce(jsonb_agg(s),'[]') from public.pos_register_sessions s where s.workspace_id=w and s.closed_at is null and exists(select 1 from public.pos_location_inventory_locations m where m.site_id=s.site_id and pos_private.can_transact(w,s.site_id,m.inventory_user_id,'sell'))),
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
      where r.id=(body->>'registerId')::uuid and r.workspace_id=w and exists(select 1 from public.pos_location_inventory_locations m where m.site_id=s.id and pos_private.can_transact(w,s.id,m.inventory_user_id,'sell')) for update of r;
    if reg.id is null then raise exception 'POS_FORBIDDEN'; end if;
    select * into sess from public.pos_register_sessions where register_id=reg.id and closed_at is null for update;

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
  select * into site from public.pos_store_locations where id=(body->>'siteId')::uuid and workspace_id=w and exists(select 1 from public.pos_location_inventory_locations m where m.site_id=pos_store_locations.id and pos_private.can_transact(w,m.site_id,m.inventory_user_id,'sell'));
  if site.id is null then raise exception 'POS_FORBIDDEN'; end if;
  if action='search' and coalesce(body->>'exact','false')='true' then
    return pos_private.resolve_barcode(w,site.id,body->>'query');
  end if;
  if action='search' then
    code := trim(coalesce(body->>'query',''));
    if length(code) not between 1 and 160 then return '[]'; end if;
    -- Current owner boundaries retained. Missing price remains null.
    select coalesce(jsonb_agg(x),'[]') into result from (
      select i.id,i.user_id as "ownerId",coalesce(nullif(i.product_name,''),i.card_name) as name,i.sku,i.set_code,i.collector_number,i.location_id,l.name as location,
        i.data->>'condition' as condition,i.data->>'finish' as finish,i.data->>'language' as language,
        coalesce(i.data->>'taxable','true')<>'false' as taxable,
        case when i.asking_price between 0 and 1000000 then (i.asking_price*100)::bigint end as unit_price_minor,
        greatest(0,i.quantity-coalesce((select sum(a.quantity) from public.selling_inventory_allocations a where a.user_id=i.user_id and a.inventory_item_id=i.id and a.status in ('ALLOCATED','RESERVED')),0)) as available,
        coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'batchId',p.batch_id,'quantity',p.quantity,'locationId',p.location_id)) from public.chaos_sort_inventory_positions p where p.user_id=i.user_id and p.item_id=i.id and p.quantity>0),'[]') as positions
      from public.inventory_items i join public.inventory_locations l on l.user_id=i.user_id and l.id=i.location_id
      join public.pos_location_inventory_locations m on m.inventory_user_id=i.user_id and m.location_id=i.location_id and m.site_id=site.id
      where pos_private.can_transact(w,site.id,i.user_id,'sell') and i.workspace_id=w and i.quantity>0 and (
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
  select * into sess from public.pos_register_sessions where id=(body->>'sessionId')::uuid and workspace_id=w and site_id=site.id and closed_at is null for update;
  if sess.id is null then raise exception 'POS_SESSION_CLOSED'; end if;
  if jsonb_typeof(body->'lines') is distinct from 'array' or jsonb_array_length(body->'lines') not between 1 and 100
    or coalesce(body->>'cashMinor','') !~ '^\d{1,12}$' or coalesce(body->>'expectedMinor','') !~ '^\d{1,12}$' then raise exception 'POS_INVALID'; end if;
  received := (body->>'cashMinor')::bigint; expected := (body->>'expectedMinor')::bigint;
  if (select count(distinct (coalesce(value->>'ownerId',site.inventory_user_id::text),value->>'itemId',coalesce(nullif(value->>'positionId',''),''))) from jsonb_array_elements(body->'lines'))<>jsonb_array_length(body->'lines') then raise exception 'POS_INVALID'; end if;
  for stock_owner in select distinct coalesce((value->>'ownerId')::uuid,site.inventory_user_id) from jsonb_array_elements(body->'lines') order by 1 loop
    perform pos_private.lock_authority(w,site.id,stock_owner,'sell');
    perform 1 from public.inventory_items where user_id=stock_owner and id in (select value->>'itemId' from jsonb_array_elements(body->'lines')) order by id for update;
  end loop;
  for line in select value from jsonb_array_elements(body->'lines') order by coalesce(value->>'ownerId',site.inventory_user_id::text),value->>'itemId',nullif(value->>'positionId','') nulls last loop
    stock_owner:=coalesce((line->>'ownerId')::uuid,site.inventory_user_id);
    if coalesce(line->>'quantity','') !~ '^\d{1,4}$' or coalesce(line->>'discountBps','0') !~ '^\d{1,5}$' then raise exception 'POS_INVALID'; end if;
    qty := (line->>'quantity')::integer; rate := coalesce((line->>'discountBps')::integer,0);
    if qty not between 1 and 1000 or rate not between 0 and 10000 then raise exception 'POS_INVALID'; end if;
    if rate>0 then
      perform pos_private.authorize(w,true);
      if length(trim(coalesce(body->>'discountReason',''))) not between 1 and 200 then raise exception 'POS_DISCOUNT_REASON'; end if;
    end if;
    select i.* into inv from public.inventory_items i join public.pos_location_inventory_locations m on m.inventory_user_id=i.user_id and m.location_id=i.location_id and m.site_id=site.id
      where i.user_id=stock_owner and i.workspace_id=w and i.id=line->>'itemId';
    if inv.id is null then raise exception 'POS_STOCK_UNAVAILABLE'; end if;
    select coalesce(sum(quantity),0) into reserved from public.selling_inventory_allocations where user_id=stock_owner and inventory_item_id=inv.id and status in ('ALLOCATED','RESERVED');
    if inv.quantity-reserved<qty then raise exception 'POS_STOCK_UNAVAILABLE'; end if;
    if inv.asking_price is null or inv.asking_price not between 0 and 1000000 then raise exception 'POS_PRICE_REQUIRED'; end if;
    price := (inv.asking_price*100)::bigint;
    line_sub := price*qty; line_disc := (line_sub*rate+5000)/10000;
    line_tax := case when inv.data->>'taxable'='false' then 0 else ((line_sub-line_disc)*site.tax_bps+5000)/10000 end;
    sub:=sub+line_sub; disc:=disc+line_disc; tax:=tax+line_tax;
    lines:=lines||jsonb_build_array(jsonb_build_object('itemId',inv.id,'ownerId',stock_owner,'name',coalesce(nullif(inv.product_name,''),inv.card_name),'sku',inv.sku,'quantity',qty,'unitPriceMinor',price,'discountMinor',line_disc,'taxMinor',line_tax,'lineTotalMinor',line_sub-line_disc+line_tax,'gameId',coalesce(to_jsonb(inv)->>'game_id',inv.data->>'game_id'),'productType',coalesce(to_jsonb(inv)->>'product_type',inv.data->>'product_type'),'scryfallId',inv.scryfall_id,'tcgplayerProductId',coalesce(to_jsonb(inv)->>'tcgplayer_product_id',inv.data->>'tcgplayer_product_id'),'setCode',inv.set_code,'collectorNumber',inv.collector_number,'condition',coalesce((select p.condition from public.chaos_sort_inventory_positions p where p.user_id=stock_owner and p.id=line->>'positionId' and p.item_id=inv.id),inv.data->>'condition'),'finish',coalesce((select p.finish from public.chaos_sort_inventory_positions p where p.user_id=stock_owner and p.id=line->>'positionId' and p.item_id=inv.id),inv.data->>'finish'),'language',coalesce((select p.language from public.chaos_sort_inventory_positions p where p.user_id=stock_owner and p.id=line->>'positionId' and p.item_id=inv.id),inv.data->>'language'),'locationId',inv.location_id,'costBasis',pos_private.cost_snapshot(inv.data),'priceSource','asking_price','positionId',line->>'positionId'));
  end loop;
  if expected<>sub-disc+tax then raise exception 'POS_QUOTE_CHANGED'; end if;
  if received<sub-disc+tax then raise exception 'POS_CASH_INSUFFICIENT'; end if;
  v_sale_id:=gen_random_uuid();
  code:='TD-'||upper(replace(v_sale_id::text,'-',''));
  select name into loc from public.pos_registers where id=sess.register_id;
  receipt:=jsonb_build_object('version',1,'number',code,'site',site.name,'register',loc,'actorId',actor,'createdAt',now(),'currency','USD','lines',(select jsonb_agg(value-'costBasis') from jsonb_array_elements(lines)),'subtotalMinor',sub,'discountMinor',disc,'taxMinor',tax,'totalMinor',sub-disc+tax,'cashMinor',received,'changeMinor',received-(sub-disc+tax),'discountReason',body->>'discountReason');
  insert into public.pos_sales(id,workspace_id,site_id,register_id,session_id,actor_id,idempotency_key,request,receipt_number,subtotal_minor,discount_minor,tax_minor,total_minor,receipt)
    values(v_sale_id,w,site.id,sess.register_id,sess.id,actor,key_id,request_body,code,sub,disc,tax,sub-disc+tax,receipt);
  for line in select value from jsonb_array_elements(lines) loop
    stock_owner:=(line->>'ownerId')::uuid;
    select * into inv from public.inventory_items where user_id=stock_owner and id=line->>'itemId';
    qty:=(line->>'quantity')::int; remaining:=qty;
    select coalesce(sum(quantity),0) into pos_total from public.chaos_sort_inventory_positions where user_id=stock_owner and item_id=inv.id;
    select coalesce(sum(quantity),0) into reserved from public.selling_inventory_allocations where user_id=stock_owner and inventory_item_id=inv.id and inventory_position_id is null and status in ('ALLOCATED','RESERVED');
    if pos_total>inv.quantity then raise exception 'POS_PROVENANCE_CONFLICT'; end if;
    for v_position in select * from public.chaos_sort_inventory_positions where user_id=stock_owner and item_id=inv.id and quantity>0 order by created_at,id for update loop
      if v_position.location_id is distinct from inv.location_id then raise exception 'POS_PROVENANCE_CONFLICT'; end if;
      if nullif(line->>'positionId','') is not null and v_position.id<>line->>'positionId' then continue; end if;
      select coalesce(sum(quantity),0) into pos_reserved from public.selling_inventory_allocations where user_id=stock_owner and inventory_item_id=inv.id and inventory_position_id=v_position.id and status in ('ALLOCATED','RESERVED');
      take:=least(remaining,greatest(0,v_position.quantity-pos_reserved-reserved));
      if take=0 then continue; end if;
      update public.chaos_sort_inventory_positions set quantity=quantity-take,status=case when quantity-take=0 then 'depleted' else status end,updated_at=now() where user_id=stock_owner and id=v_position.id;
      update public.chaos_sort_batches set current_quantity=current_quantity-take,updated_at=now() where user_id=stock_owner and id=v_position.batch_id and current_quantity>=take;
      if not found then raise exception 'POS_PROVENANCE_CONFLICT'; end if;
      insert into public.pos_sale_allocations(workspace_id,sale_id,inventory_user_id,inventory_item_id,position_id,batch_id,location_id,quantity,line_key) values(w,v_sale_id,stock_owner,inv.id,v_position.id,v_position.batch_id,v_position.location_id,take,coalesce(line->>'positionId',''));
      remaining:=remaining-take;
      exit when remaining=0;
    end loop;
    if remaining>0 then
      if nullif(line->>'positionId','') is not null or inv.quantity-pos_total-reserved<remaining then raise exception 'POS_STOCK_UNAVAILABLE'; end if;
      insert into public.pos_sale_allocations(workspace_id,sale_id,inventory_user_id,inventory_item_id,location_id,quantity,line_key) values(w,v_sale_id,stock_owner,inv.id,inv.location_id,remaining,coalesce(line->>'positionId',''));
    end if;
    insert into pos_private.stock_permits values(txid_current(),pg_backend_pid(),actor,stock_owner,inv.id,to_jsonb(inv),inv.quantity-qty);
    update public.inventory_items set quantity=quantity-qty,inventory_value=case when quantity=0 then 0 else round(inventory_value*(quantity-qty)/quantity,2) end,updated_at=now() where user_id=stock_owner and id=inv.id;
    delete from pos_private.stock_permits where transaction_id=txid_current() and backend=pg_backend_pid() and owner_id=stock_owner and item_id=inv.id;
    insert into public.pos_sale_items(workspace_id,sale_id,inventory_user_id,inventory_item_id,quantity,unit_price_minor,discount_minor,tax_minor,snapshot)
      values(w,v_sale_id,stock_owner,inv.id,qty,(line->>'unitPriceMinor')::bigint,(line->>'discountMinor')::bigint,(line->>'taxMinor')::bigint,line);
    insert into public.inventory_events(user_id,inventory_item_id,event_type,source,related_entity_type,related_entity_id,quantity_before,quantity_change,quantity_after,previous_location_id,next_location_id,card_name,idempotency_key,metadata)
      values(stock_owner,inv.id,'quantity_removed','system','pos_sale',v_sale_id::text,inv.quantity,-qty,inv.quantity-qty,inv.location_id,inv.location_id,inv.card_name,'pos:'||v_sale_id::text||':'||inv.id||case when stock_owner=actor then '' else ':owner:'||stock_owner::text end||case when nullif(line->>'positionId','') is null then '' else ':position:'||md5(line->>'positionId') end,
        jsonb_build_object('workspace_id',w,'actor_id',actor,'site_id',site.id,'register_id',sess.register_id,'receipt_number',code,'allocations',(select jsonb_agg(to_jsonb(a)) from public.pos_sale_allocations a where a.sale_id=v_sale_id and a.inventory_user_id=stock_owner and a.inventory_item_id=inv.id and a.line_key=coalesce(line->>'positionId',''))));
  end loop;
  insert into public.pos_tenders(workspace_id,sale_id,method,amount_minor,received_minor,change_minor) values(w,v_sale_id,'cash',sub-disc+tax,received,received-(sub-disc+tax));
  return jsonb_build_object('status','completed','saleId',v_sale_id,'receipt',receipt,'replayed',false);
end $$;


create or replace function pos_private.protect_event_origin() returns trigger language plpgsql set search_path='' as $$
begin
  if new.related_entity_type='pos_sale' and current_user in ('authenticated','anon') then raise exception 'POS_FORBIDDEN'; end if;
  if new.related_entity_type='pos_sale' and not exists (
    select 1 from public.pos_sales s join public.pos_sale_items l on l.sale_id=s.id
    where s.id::text=new.related_entity_id and s.actor_id=(new.metadata->>'actor_id')::uuid
      and l.inventory_user_id=new.user_id and l.inventory_item_id=new.inventory_item_id
      and new.quantity_change=-l.quantity and new.quantity_after=new.quantity_before-l.quantity
      and new.idempotency_key='pos:'||s.id::text||':'||l.inventory_item_id||case when l.inventory_user_id=s.actor_id then '' else ':owner:'||l.inventory_user_id::text end||case when nullif(l.snapshot->>'positionId','') is null then '' else ':position:'||md5(l.snapshot->>'positionId') end
  ) then raise exception 'POS_FORBIDDEN'; end if;
  return new;
end $$;


create or replace function pos_private.command(w uuid,action text,body jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if body is null or jsonb_typeof(body)<>'object' or octet_length(body::text)>32768 then raise exception 'POS_INVALID'; end if;
 if action in ('access','grant','revoke','staff_permissions','join_site') then return pos_private.access_command(w,action,body); end if;
 return pos_private.cash_command(w,action,body);
end $$;
revoke all on all functions in schema pos_private from public,anon,authenticated;
notify pgrst,'reload schema';
