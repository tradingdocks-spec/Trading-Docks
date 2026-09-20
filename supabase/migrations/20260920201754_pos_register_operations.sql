-- Phase 3 operational records. Forward-only; no ownership transfer.
-- A timezone default is only a migration fallback for existing sites. Setup and
-- settings expose an explicit IANA timezone before operational reporting.
alter table public.pos_store_locations add column timezone text not null default 'America/Phoenix',
 add column settings jsonb not null default '{"noteThresholdMinor":0,"approvalThresholdMinor":2000,"blindClose":false,"receiptWidth":"80","address":"","footer":"Thank you for shopping with us.","returnPolicy":"","showEmployee":true,"showSku":true,"showLocation":true}'::jsonb;
alter table public.pos_registers add column active boolean not null default true,
 add column description text not null default '', add column cash_drawer boolean not null default true,
 add column hardware_preferences jsonb not null default '{}', add column created_at timestamptz not null default now(), add column updated_at timestamptz not null default now();
alter table public.pos_register_sessions add column status text not null default 'OPEN' check(status in ('OPEN','CLOSING','CLOSED')),
 add column opening_minor bigint not null default 0 check(opening_minor between 0 and 100000000000),
 add column closed_by uuid references auth.users(id), add column expected_minor bigint,
 add column counted_minor bigint check(counted_minor between 0 and 100000000000), add column variance_minor bigint,
 add column close_notes text not null default '', add column closing_started_at timestamptz;
update public.pos_register_sessions set status='CLOSED' where closed_at is not null;
alter table public.pos_register_sessions add constraint pos_session_state check((status='CLOSED')=(closed_at is not null));
create function pos_private.session_transition() returns trigger language plpgsql set search_path='' as $$
begin
 if old.status='CLOSED' or (to_jsonb(old)-array['status','closed_at','closed_by','expected_minor','counted_minor','variance_minor','close_notes','closing_started_at'])<>(to_jsonb(new)-array['status','closed_at','closed_by','expected_minor','counted_minor','variance_minor','close_notes','closing_started_at']) then raise exception 'POS_IMMUTABLE'; end if;
 if new.status='CLOSED' and (new.closed_by is null or new.counted_minor is null or new.expected_minor is null or new.variance_minor is distinct from new.counted_minor-new.expected_minor) then raise exception 'POS_INVALID'; end if;
 return new;
end $$;
create trigger pos_session_transition before update on public.pos_register_sessions for each row execute function pos_private.session_transition();

create table public.pos_cash_events (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, site_id uuid not null, register_id uuid not null, session_id uuid not null,
 actor_id uuid not null references auth.users(id), kind text not null check(kind in ('OPENING_FLOAT','CASH_SALE','CASH_REFUND','PAID_IN','PAID_OUT','CASH_DROP','CASH_ADJUSTMENT','REGISTER_CLOSE')),
 amount_minor bigint not null check(amount_minor between -100000000000 and 100000000000),
 reason_type text not null default '', reason text not null default '', reference_id uuid,
 created_at timestamptz not null default now(),
 foreign key(workspace_id,site_id,register_id,session_id) references public.pos_register_sessions(workspace_id,site_id,register_id,id),
 check((kind in ('OPENING_FLOAT','CASH_SALE','PAID_IN') and amount_minor>=0) or (kind in ('CASH_REFUND','PAID_OUT','CASH_DROP') and amount_minor<=0) or kind='CASH_ADJUSTMENT' or (kind='REGISTER_CLOSE' and amount_minor=0))
);
create unique index pos_cash_reference on public.pos_cash_events(kind,reference_id) where reference_id is not null;
create index pos_cash_session on public.pos_cash_events(session_id,created_at,id);
create table public.pos_operation_receipts (
 workspace_id uuid not null references public.workspaces(id), actor_id uuid not null references auth.users(id), key uuid not null,
 action text not null, intent jsonb not null, result jsonb not null, created_at timestamptz not null default now(), primary key(workspace_id,actor_id,key)
);
create table public.pos_approval_requests (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, site_id uuid not null, requested_by uuid not null references auth.users(id),
 action text not null check(action in ('checkout','refund','close','cash_event')), intent jsonb not null, summary jsonb not null default '{}', reason text not null check(length(reason) between 1 and 500),
 created_at timestamptz not null default now(), foreign key(workspace_id,site_id) references public.pos_store_locations(workspace_id,id)
);
create table public.pos_approval_decisions (
 request_id uuid primary key references public.pos_approval_requests(id), approved_by uuid not null references auth.users(id), approved_at timestamptz not null default now()
);
create table pos_private.approval_uses (request_id uuid primary key references public.pos_approval_requests(id), operation_key uuid not null);
create table public.pos_refunds (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, sale_id uuid not null,
 site_id uuid not null, register_id uuid not null, session_id uuid not null, actor_id uuid not null references auth.users(id),
 subtotal_minor bigint not null check(subtotal_minor>=0), tax_minor bigint not null check(tax_minor>=0), total_minor bigint not null check(total_minor=subtotal_minor+tax_minor),
 reason text not null check(length(reason) between 1 and 500), created_at timestamptz not null default now(),
 foreign key(workspace_id,sale_id) references public.pos_sales(workspace_id,id),
 foreign key(workspace_id,site_id,register_id,session_id) references public.pos_register_sessions(workspace_id,site_id,register_id,id)
);
create table public.pos_refund_items (
 id uuid primary key default gen_random_uuid(), refund_id uuid not null references public.pos_refunds(id), sale_item_id uuid not null references public.pos_sale_items(id),
 quantity integer not null check(quantity between 1 and 1000), return_inventory boolean not null,
 subtotal_minor bigint not null check(subtotal_minor>=0), tax_minor bigint not null check(tax_minor>=0), allocations jsonb not null default '[]'
);
create index pos_refund_sale on public.pos_refunds(sale_id,created_at);
create index pos_refund_item_sale on public.pos_refund_items(sale_item_id);
create index pos_report_sales on public.pos_sales(workspace_id,site_id,created_at,register_id,actor_id);
create index pos_receipt_prefix on public.pos_sales(workspace_id,lower(receipt_number) text_pattern_ops);
create index pos_item_sku_prefix on public.pos_sale_items(workspace_id,lower(snapshot->>'sku') text_pattern_ops);
create index pos_item_name_search on public.pos_sale_items using gin(to_tsvector('simple',coalesce(snapshot->>'name','')));
create index pos_report_refunds on public.pos_refunds(workspace_id,site_id,created_at);
create index pos_session_history on public.pos_register_sessions(workspace_id,site_id,opened_at desc);

do $$ declare t text; begin
 foreach t in array array['pos_cash_events','pos_operation_receipts','pos_approval_requests','pos_approval_decisions','pos_refunds','pos_refund_items'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('create trigger %I before update or delete on public.%I for each row execute function pos_private.immutable()',t||'_immutable',t);
 end loop;
end $$;

create function pos_private.refund(w uuid,body jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare sale public.pos_sales%rowtype; sess public.pos_register_sessions%rowtype; original public.pos_sale_items%rowtype;
 inv public.inventory_items%rowtype; alloc public.pos_sale_allocations%rowtype; position public.chaos_sort_inventory_positions%rowtype;
 line jsonb; prepared jsonb:='[]'; allocation_rows jsonb; q integer; previous_q integer; skip_q integer; take_q integer; remaining integer;
 net bigint; tax bigint; net_sum bigint:=0; tax_sum bigint:=0; refund_id uuid:=gen_random_uuid(); refund_item uuid;
 stock_owner uuid; restore boolean; unit_value numeric;
begin
 perform pos_private.authorize(w);
 if not pos_private.permission(w,'refund') then raise exception 'POS_FORBIDDEN'; end if;
 select * into sess from public.pos_register_sessions where id=(body->>'sessionId')::uuid and workspace_id=w for update;
 if sess.id is null or sess.status<>'OPEN' or not pos_private.site_access(w,sess.site_id) then raise exception 'POS_SESSION_CLOSED'; end if;
 select * into sale from public.pos_sales where id=(body->>'saleId')::uuid and workspace_id=w for update;
 if sale.id is null or not pos_private.site_access(w,sale.site_id) then raise exception 'POS_FORBIDDEN'; end if;
 if length(trim(coalesce(body->>'reason',''))) not between 1 and 500 or jsonb_typeof(body->'lines') is distinct from 'array' or jsonb_array_length(body->'lines') not between 1 and 100
  or (select count(distinct value->>'saleItemId') from jsonb_array_elements(body->'lines'))<>jsonb_array_length(body->'lines') then raise exception 'POS_INVALID'; end if;
 for stock_owner in select distinct inventory_user_id from public.pos_sale_items where sale_id=sale.id and id in (select (value->>'saleItemId')::uuid from jsonb_array_elements(body->'lines')) order by inventory_user_id loop
  perform pos_private.lock_authority(w,sale.site_id,stock_owner,'return');
 end loop;
 for line in select value from jsonb_array_elements(body->'lines') order by value->>'saleItemId' loop
  select * into original from public.pos_sale_items where id=(line->>'saleItemId')::uuid and sale_id=sale.id;
  if original.id is null or coalesce(line->>'quantity','') !~ '^\d{1,4}$' or jsonb_typeof(line->'returnInventory') is distinct from 'boolean' then raise exception 'POS_INVALID'; end if;
  q:=(line->>'quantity')::int; restore:=(line->>'returnInventory')::boolean;
  select coalesce(sum(quantity),0) into previous_q from public.pos_refund_items where sale_item_id=original.id;
  if q<1 or previous_q+q>original.quantity then raise exception 'POS_REFUND_EXCEEDED'; end if;
  net:=((original.unit_price_minor*original.quantity-original.discount_minor)*(previous_q+q)/original.quantity)-((original.unit_price_minor*original.quantity-original.discount_minor)*previous_q/original.quantity);
  tax:=(original.tax_minor*(previous_q+q)/original.quantity)-(original.tax_minor*previous_q/original.quantity);
  prepared:=prepared||jsonb_build_array(jsonb_build_object('id',original.id,'quantity',q,'returnInventory',restore,'net',net,'tax',tax,'previous',previous_q));
  net_sum:=net_sum+net; tax_sum:=tax_sum+tax;
 end loop;
 if coalesce(body->>'expectedMinor','') !~ '^\d{1,12}$' or (body->>'expectedMinor')::bigint<>net_sum+tax_sum then raise exception 'POS_QUOTE_CHANGED'; end if;
 insert into public.pos_refunds(id,workspace_id,sale_id,site_id,register_id,session_id,actor_id,subtotal_minor,tax_minor,total_minor,reason)
 values(refund_id,w,sale.id,sess.site_id,sess.register_id,sess.id,auth.uid(),net_sum,tax_sum,net_sum+tax_sum,body->>'reason');
 for line in select value from jsonb_array_elements(prepared) loop
  select * into original from public.pos_sale_items where id=(line->>'id')::uuid;
  q:=(line->>'quantity')::int; restore:=(line->>'returnInventory')::boolean; remaining:=q; skip_q:=(line->>'previous')::int; allocation_rows:='[]';
  if restore then
   select * into inv from public.inventory_items where user_id=original.inventory_user_id and id=original.inventory_item_id and workspace_id=w for update;
   if inv.id is null or not (original.snapshot ? 'inventoryValueUnit') or inv.location_id is distinct from original.snapshot->>'locationId'
     or not exists(select 1 from public.pos_location_inventory_locations where workspace_id=w and site_id=sale.site_id and inventory_user_id=inv.user_id and location_id=inv.location_id)
     or inv.set_code is distinct from original.snapshot->>'setCode' or inv.collector_number is distinct from original.snapshot->>'collectorNumber'
     then raise exception 'POS_PROVENANCE_CONFLICT'; end if;
  end if;
  for alloc in select * from public.pos_sale_allocations where sale_id=sale.id and inventory_user_id=original.inventory_user_id and inventory_item_id=original.inventory_item_id
   and line_key=coalesce(original.snapshot->>'positionId','') order by id loop
   take_q:=least(remaining,greatest(0,alloc.quantity-skip_q)); skip_q:=greatest(0,skip_q-alloc.quantity);
   if take_q=0 then continue; end if;
   allocation_rows:=allocation_rows||jsonb_build_array(jsonb_build_object('allocationId',alloc.id,'positionId',alloc.position_id,'batchId',alloc.batch_id,'locationId',alloc.location_id,'quantity',take_q));
   if restore and alloc.position_id is not null then
    select * into position from public.chaos_sort_inventory_positions where user_id=inv.user_id and id=alloc.position_id and item_id=inv.id for update;
    if position.id is null or position.status='retired' or position.location_id is distinct from alloc.location_id or position.batch_id is distinct from alloc.batch_id
      or position.condition is distinct from original.snapshot->>'condition' or position.finish is distinct from original.snapshot->>'finish' or position.language is distinct from original.snapshot->>'language' then raise exception 'POS_PROVENANCE_CONFLICT'; end if;
    update public.chaos_sort_inventory_positions set quantity=quantity+take_q,status='active',updated_at=now() where user_id=inv.user_id and id=position.id;
    update public.chaos_sort_batches set current_quantity=current_quantity+take_q,updated_at=now() where user_id=inv.user_id and id=alloc.batch_id;
    if not found then raise exception 'POS_PROVENANCE_CONFLICT'; end if;
   elsif restore then
    if inv.data->>'condition' is distinct from original.snapshot->>'condition' or inv.data->>'finish' is distinct from original.snapshot->>'finish' or inv.data->>'language' is distinct from original.snapshot->>'language' then raise exception 'POS_PROVENANCE_CONFLICT'; end if;
   end if;
   remaining:=remaining-take_q; exit when remaining=0;
  end loop;
  if remaining<>0 then raise exception 'POS_PROVENANCE_CONFLICT'; end if;
  insert into public.pos_refund_items(refund_id,sale_item_id,quantity,return_inventory,subtotal_minor,tax_minor,allocations)
   values(refund_id,original.id,q,restore,(line->>'net')::bigint,(line->>'tax')::bigint,allocation_rows) returning id into refund_item;
  if restore then
   insert into pos_private.stock_permits values(txid_current(),pg_backend_pid(),auth.uid(),inv.user_id,inv.id,to_jsonb(inv),inv.quantity+q);
   unit_value:=coalesce((original.snapshot->>'inventoryValueUnit')::numeric,0);
   update public.inventory_items set quantity=quantity+q,inventory_value=inventory_value+round(unit_value*((line->>'previous')::int+q),2)-round(unit_value*(line->>'previous')::int,2),updated_at=now() where user_id=inv.user_id and id=inv.id;
   delete from pos_private.stock_permits where transaction_id=txid_current() and backend=pg_backend_pid() and owner_id=inv.user_id and item_id=inv.id;
   insert into public.inventory_events(user_id,inventory_item_id,event_type,source,related_entity_type,related_entity_id,quantity_before,quantity_change,quantity_after,previous_location_id,next_location_id,card_name,idempotency_key,metadata)
    values(inv.user_id,inv.id,'quantity_added','system','pos_refund',refund_id::text,inv.quantity,q,inv.quantity+q,inv.location_id,inv.location_id,inv.card_name,'pos-refund:'||refund_item::text,jsonb_build_object('actor_id',auth.uid(),'workspace_id',w,'sale_id',sale.id,'site_id',sess.site_id,'session_id',sess.id,'allocations',allocation_rows));
  end if;
 end loop;
 insert into public.pos_cash_events(workspace_id,site_id,register_id,session_id,actor_id,kind,amount_minor,reference_id,reason)
  values(w,sess.site_id,sess.register_id,sess.id,auth.uid(),'CASH_REFUND',-(net_sum+tax_sum),refund_id,body->>'reason');
 return jsonb_build_object('id',refund_id,'totalMinor',net_sum+tax_sum,'saleId',sale.id);
end $$;
alter table pos_private.approval_uses enable row level security;
revoke all on pos_private.approval_uses from public,anon,authenticated;

create function pos_private.delegation_history() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' or old.revoked_at is not null or new.revoked_at is null or new.revoked_by is distinct from old.inventory_user_id
  or (to_jsonb(old)-array['revoked_at','revoked_by'])<>(to_jsonb(new)-array['revoked_at','revoked_by']) then raise exception 'POS_IMMUTABLE'; end if;
 return new;
end $$;
create trigger pos_delegation_history before update or delete on public.pos_inventory_delegations for each row execute function pos_private.delegation_history();

create function pos_private.expected_cash(session uuid) returns bigint language sql stable security definer set search_path='' as $$
 select coalesce(sum(amount_minor),0)::bigint from public.pos_cash_events where session_id=session
$$;
create function pos_private.site_access(w uuid,site uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.pos_location_inventory_locations m where m.workspace_id=w and m.site_id=site and pos_private.can_transact(w,site,m.inventory_user_id,'sell'))
$$;
create function pos_private.approved(w uuid,site uuid,action text,body jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare approver uuid; req uuid:=(body->>'approvalId')::uuid; approved_summary jsonb; current_summary jsonb;
begin
 if req is null then raise exception 'POS_APPROVAL_REQUIRED'; end if;
 select d.approved_by into approver from public.pos_approval_requests r join public.pos_approval_decisions d on d.request_id=r.id
  join public.workspace_members m on m.workspace_id=r.workspace_id and m.user_id=d.approved_by
  join auth.users u on u.id=d.approved_by
  where r.id=req and r.workspace_id=w and r.site_id=site and r.action=approved.action and r.requested_by=auth.uid()
   and r.intent=body-array['key','approvalId'] and m.role in ('owner','admin','manager') and d.approved_by<>auth.uid()
   and (u.banned_until is null or u.banned_until<now())
   and not exists(select 1 from public.workspace_employees e where e.workspace_id=w and e.linked_user_id=d.approved_by and (e.employment_status<>'active' or coalesce(to_jsonb(e)->>'account_status','active')='suspended'));
 if approver is null then raise exception 'POS_APPROVAL_REQUIRED'; end if;
 select summary into approved_summary from public.pos_approval_requests where id=req;
 if action='checkout' then
  current_summary:=pos_private.calculate(w,site,body);
  current_summary:=current_summary||jsonb_build_object('lines',(select jsonb_agg(value-array['costBasis','inventoryValueUnit']) from jsonb_array_elements(current_summary->'lines')));
  if current_summary<>approved_summary then raise exception 'POS_APPROVAL_REQUIRED'; end if;
 elsif action in ('close','cash_event') and (approved_summary->>'expectedMinor')::bigint is distinct from pos_private.expected_cash((body->>'sessionId')::uuid) then raise exception 'POS_APPROVAL_REQUIRED';
 end if;
 insert into pos_private.approval_uses values(req,(body->>'key')::uuid);
 return approver;
end $$;

create function pos_private.record_sale_cash() returns trigger language plpgsql security definer set search_path='' as $$
declare sale public.pos_sales%rowtype;
begin
 select * into sale from public.pos_sales where id=new.sale_id;
 insert into public.pos_cash_events(workspace_id,site_id,register_id,session_id,actor_id,kind,amount_minor,reference_id)
 values(sale.workspace_id,sale.site_id,sale.register_id,sale.session_id,sale.actor_id,'CASH_SALE',new.amount_minor,new.id);
 return new;
end $$;
create trigger pos_sale_cash after insert on public.pos_tenders for each row execute function pos_private.record_sale_cash();
-- Preserve drawer evidence for accepted legacy sales; historic opening float is
-- unknown and remains zero, rather than inventing a cash count.
insert into public.pos_cash_events(workspace_id,site_id,register_id,session_id,actor_id,kind,amount_minor,reference_id,created_at)
 select s.workspace_id,s.site_id,s.register_id,s.session_id,s.actor_id,'CASH_SALE',t.amount_minor,t.id,s.created_at from public.pos_tenders t join public.pos_sales s on s.id=t.sale_id;

create function pos_private.operations(w uuid,action text,body jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); site public.pos_store_locations%rowtype; reg public.pos_registers%rowtype; sess public.pos_register_sessions%rowtype;
 amount bigint; expected bigint; counted bigint; variance bigint; result jsonb; request_id uuid; manager boolean; v_settings jsonb; record_id uuid;
begin
 perform pos_private.authorize(w);
 manager:=exists(select 1 from public.workspace_members where workspace_id=w and user_id=actor and role in ('owner','admin','manager'));
 if action in ('open','close','begin_close','resume','cash_event') then
  select * into reg from public.pos_registers where id=(body->>'registerId')::uuid and workspace_id=w for update;
  if reg.id is null or not reg.active or not pos_private.site_access(w,reg.site_id) then raise exception 'POS_FORBIDDEN'; end if;
  select * into site from public.pos_store_locations where id=reg.site_id;
  select * into sess from public.pos_register_sessions where register_id=reg.id and closed_at is null for update;
  if action='open' then
   if sess.id is not null then raise exception 'POS_REGISTER_BUSY'; end if;
   if coalesce(body->>'openingMinor','') !~ '^\d{1,12}$' then raise exception 'POS_INVALID'; end if;
   insert into public.pos_register_sessions(workspace_id,site_id,register_id,actor_id,opening_minor) values(w,reg.site_id,reg.id,actor,(body->>'openingMinor')::bigint) returning * into sess;
   insert into public.pos_cash_events(workspace_id,site_id,register_id,session_id,actor_id,kind,amount_minor,reference_id) values(w,reg.site_id,reg.id,sess.id,actor,'OPENING_FLOAT',sess.opening_minor,sess.id);
   return to_jsonb(sess);
  end if;
  if sess.id is null or sess.id is distinct from (body->>'sessionId')::uuid then raise exception 'POS_SESSION_CLOSED'; end if;
  if action='begin_close' then
   update public.pos_register_sessions set status='CLOSING',closing_started_at=now() where id=sess.id returning * into sess;
   return to_jsonb(sess)||jsonb_build_object('expectedMinor',case when manager or not coalesce((site.settings->>'blindClose')::boolean,false) then pos_private.expected_cash(sess.id) end);
  elsif action='resume' then
   if not manager or sess.status<>'CLOSING' then raise exception 'POS_FORBIDDEN'; end if;
   update public.pos_register_sessions set status='OPEN',closing_started_at=null where id=sess.id returning * into sess;
   return to_jsonb(sess);
  elsif action='close' then
   if coalesce(body->>'countedMinor','') !~ '^\d{1,12}$' then raise exception 'POS_INVALID'; end if;
   expected:=pos_private.expected_cash(sess.id); counted:=(body->>'countedMinor')::bigint; variance:=counted-expected;
   if abs(variance)>coalesce((site.settings->>'noteThresholdMinor')::bigint,0) and length(trim(coalesce(body->>'reason',''))) not between 1 and 500 then raise exception 'POS_REASON_REQUIRED'; end if;
   if not manager and abs(variance)>coalesce((site.settings->>'approvalThresholdMinor')::bigint,2000) then perform pos_private.approved(w,site.id,action,body); end if;
   update public.pos_register_sessions set status='CLOSED',closed_at=now(),closed_by=actor,expected_minor=expected,counted_minor=counted,variance_minor=variance,close_notes=coalesce(body->>'reason','') where id=sess.id returning * into sess;
   insert into public.pos_cash_events(workspace_id,site_id,register_id,session_id,actor_id,kind,amount_minor,reference_id,reason) values(w,site.id,reg.id,sess.id,actor,'REGISTER_CLOSE',0,sess.id,sess.close_notes);
   return to_jsonb(sess);
  else
   if sess.status<>'OPEN' then raise exception 'POS_SESSION_CLOSED'; end if;
   if not pos_private.permission(w,'cash') then raise exception 'POS_FORBIDDEN'; end if;
   if body->>'kind' not in ('PAID_IN','PAID_OUT','CASH_DROP','CASH_ADJUSTMENT') or coalesce(body->>'amountMinor','') !~ '^-?\d{1,12}$'
    or length(trim(coalesce(body->>'reason',''))) not between 1 and 500 or body->>'reasonType' not in ('CHANGE_FLOAT','PETTY_CASH','COURIER','SAFE','CORRECTION','OTHER') then raise exception 'POS_INVALID'; end if;
   amount:=(body->>'amountMinor')::bigint;
   if amount=0 or (body->>'kind'<>'CASH_ADJUSTMENT' and amount<0) then raise exception 'POS_INVALID'; end if;
   if body->>'kind'='CASH_ADJUSTMENT' and not manager then perform pos_private.approved(w,site.id,action,body); end if;
   if body->>'kind' in ('PAID_OUT','CASH_DROP') then amount:=-amount; end if;
   insert into public.pos_cash_events(workspace_id,site_id,register_id,session_id,actor_id,kind,amount_minor,reason_type,reason) values(w,site.id,reg.id,sess.id,actor,body->>'kind',amount,body->>'reasonType',body->>'reason') returning id into record_id;
   return jsonb_build_object('id',record_id,'expectedMinor',pos_private.expected_cash(sess.id));
  end if;
 end if;
 select * into site from public.pos_store_locations where id=(body->>'siteId')::uuid and workspace_id=w;
 if site.id is null or not pos_private.site_access(w,site.id) then raise exception 'POS_FORBIDDEN'; end if;
 if action='configure_register' then
  if not manager then raise exception 'POS_FORBIDDEN'; end if;
  if length(trim(coalesce(body->>'name',''))) not between 1 and 100 then raise exception 'POS_INVALID'; end if;
  if nullif(body->>'id','') is null then
   insert into public.pos_registers(workspace_id,site_id,name,description) values(w,site.id,body->>'name',left(coalesce(body->>'description',''),500)) returning * into reg;
  else
   select * into reg from public.pos_registers where id=(body->>'id')::uuid and workspace_id=w and site_id=site.id for update;
   if reg.id is null then raise exception 'POS_FORBIDDEN'; end if;
   if coalesce((body->>'active')::boolean,true)=false and exists(select 1 from public.pos_register_sessions where register_id=reg.id and closed_at is null) then raise exception 'POS_REGISTER_BUSY'; end if;
   update public.pos_registers set name=body->>'name',active=coalesce((body->>'active')::boolean,true),description=left(coalesce(body->>'description',''),500),updated_at=now() where id=reg.id returning * into reg;
  end if;
  return to_jsonb(reg);
 elsif action='settings' then
  if not exists(select 1 from public.workspace_members where workspace_id=w and user_id=actor and role in ('owner','admin')) then raise exception 'POS_FORBIDDEN'; end if;
  v_settings:=body->'settings';
  if jsonb_typeof(v_settings)<>'object' or coalesce(v_settings->>'noteThresholdMinor','') !~ '^\d{1,10}$' or coalesce(v_settings->>'approvalThresholdMinor','') !~ '^\d{1,10}$'
   or v_settings->>'receiptWidth' not in ('58','80','Letter') or not exists(select 1 from pg_timezone_names where name=body->>'timezone') then raise exception 'POS_INVALID'; end if;
  update public.pos_store_locations set timezone=body->>'timezone',settings=v_settings where id=site.id;
  return jsonb_build_object('ok',true);
 elsif action='request_approval' then
  if body->>'operation' not in ('checkout','refund','close','cash_event') or jsonb_typeof(body->'intent')<>'object' then raise exception 'POS_INVALID'; end if;
  result:='{}';
  if body->>'operation'='checkout' then
   result:=pos_private.calculate(w,site.id,body->'intent');
   result:=result||jsonb_build_object('lines',(select jsonb_agg(value-array['costBasis','inventoryValueUnit']) from jsonb_array_elements(result->'lines')));
  elsif body->>'operation' in ('close','cash_event') then
   select * into sess from public.pos_register_sessions where id=(body->'intent'->>'sessionId')::uuid and workspace_id=w and site_id=site.id;
   if sess.id is null then raise exception 'POS_FORBIDDEN'; end if;
   result:=jsonb_build_object('expectedMinor',pos_private.expected_cash(sess.id),'registerName',(select name from public.pos_registers where id=sess.register_id));
  end if;
  insert into public.pos_approval_requests(workspace_id,site_id,requested_by,action,intent,summary,reason) values(w,site.id,actor,body->>'operation',(body->'intent')-array['key','approvalId'],result,body->>'reason') returning id into request_id;
  return jsonb_build_object('id',request_id);
 elsif action='approve' then
  if not manager then raise exception 'POS_FORBIDDEN'; end if;
  perform 1 from public.pos_approval_requests where id=(body->>'id')::uuid and workspace_id=w and site_id=site.id and requested_by<>actor for update;
  if not found then raise exception 'POS_FORBIDDEN'; end if;
  insert into public.pos_approval_decisions values((body->>'id')::uuid,actor,now());
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'POS_INVALID';
end $$;
create function pos_private.read_operations(w uuid,action text,body jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; site public.pos_store_locations%rowtype; sale public.pos_sales%rowtype; manager boolean; first_day date; last_day date; start_at timestamptz; end_at timestamptz;
begin
 perform pos_private.authorize(w,false,false);
 manager:=exists(select 1 from public.workspace_members where workspace_id=w and user_id=auth.uid() and role in ('owner','admin','manager'));
 if action='receipt' then
  select * into sale from public.pos_sales where workspace_id=w and id=(body->>'saleId')::uuid
   and (actor_id=auth.uid() or (manager and pos_private.site_access(w,site_id)));
  if sale.id is null then return jsonb_build_object('status','not_found'); end if;
  return jsonb_build_object('status','completed','saleId',sale.id,'receipt',sale.receipt,
   'approval',(select jsonb_build_object('name',coalesce((select full_name from public.workspace_employees where workspace_id=w and linked_user_id=d.approved_by limit 1),'Manager'),'at',d.approved_at,'reason',r.reason) from public.pos_approval_requests r join public.pos_approval_decisions d on d.request_id=r.id where r.id=(sale.request->>'approvalId')::uuid),
   'inventoryEvents',(select coalesce(jsonb_agg(jsonb_build_object('at',e.created_at,'kind',e.event_type,'quantity',e.quantity_change,'name',e.card_name)),'[]') from public.inventory_events e where (e.related_entity_type='pos_sale' and e.related_entity_id=sale.id::text) or (e.related_entity_type='pos_refund' and e.related_entity_id in (select id::text from public.pos_refunds where sale_id=sale.id))),
   'items',(select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'name',l.snapshot->>'name','quantity',l.quantity,'netMinor',l.unit_price_minor*l.quantity-l.discount_minor,'taxMinor',l.tax_minor,'refundedQuantity',coalesce((select sum(quantity) from public.pos_refund_items where sale_item_id=l.id),0))),'[]') from public.pos_sale_items l where l.sale_id=sale.id),
   'refunds',(select coalesce(jsonb_agg(r order by r.created_at),'[]') from public.pos_refunds r where r.sale_id=sale.id),
   'activity',(select coalesce(jsonb_agg(jsonb_build_object('at',e.created_at,'kind',e.kind,'actorId',e.actor_id,'amountMinor',e.amount_minor) order by e.created_at),'[]') from public.pos_cash_events e where e.reference_id in (select id from public.pos_tenders where sale_id=sale.id union all select id from public.pos_refunds where sale_id=sale.id)));
 end if;
 if action='history' then
  select coalesce(jsonb_agg(x),'[]') into result from (
   select s.id,s.receipt_number,s.created_at,s.total_minor,s.subtotal_minor,s.discount_minor,s.tax_minor,s.register_id,s.actor_id,l.name as site_name,l.timezone,
    coalesce((select sum(r.total_minor) from public.pos_refunds r where r.sale_id=s.id),0) as refunded_minor
   from public.pos_sales s join public.pos_store_locations l on l.id=s.site_id
   where s.workspace_id=w and (s.actor_id=auth.uid() or (manager and pos_private.site_access(w,s.site_id)))
    and (nullif(body->>'siteId','') is null or s.site_id=(body->>'siteId')::uuid)
    and (nullif(body->>'registerId','') is null or s.register_id=(body->>'registerId')::uuid)
    and (nullif(body->>'actorId','') is null or s.actor_id=(body->>'actorId')::uuid)
    and (nullif(body->>'payment','') is null or body->>'payment'='cash')
    and (nullif(body->>'from','') is null or s.created_at>=((body->>'from')::date::timestamp at time zone l.timezone))
    and (nullif(body->>'to','') is null or s.created_at<(((body->>'to')::date+1)::timestamp at time zone l.timezone))
    and (coalesce(body->>'period','all')='all' or (s.created_at at time zone l.timezone)::date between
      (now() at time zone l.timezone)::date-case body->>'period' when 'yesterday' then 1 when '7' then 6 when '30' then 29 else 0 end
      and (now() at time zone l.timezone)::date-case body->>'period' when 'yesterday' then 1 else 0 end)
    and (nullif(body->>'status','') is null or (body->>'status'='refunded' and exists(select 1 from public.pos_refunds where sale_id=s.id)) or (body->>'status'='completed' and not exists(select 1 from public.pos_refunds where sale_id=s.id)))
    and (nullif(body->>'query','') is null or lower(s.receipt_number) like lower(body->>'query')||'%' or exists(select 1 from public.pos_sale_items i where i.sale_id=s.id and (to_tsvector('simple',coalesce(i.snapshot->>'name','')) @@ websearch_to_tsquery('simple',body->>'query') or lower(i.snapshot->>'sku') like lower(body->>'query')||'%')))
    and (nullif(body->>'before','') is null or (s.created_at,s.id)<((body->>'before')::timestamptz,coalesce(nullif(body->>'beforeId',''),'00000000-0000-0000-0000-000000000000')::uuid))
   order by s.created_at desc,s.id desc limit 50
  ) x;
  return result;
 end if;
 if action='sessions' then
  select coalesce(jsonb_agg(x),'[]') into result from (
   select s.id,s.site_id,s.register_id,r.name as register_name,l.name as site_name,l.timezone,s.status,s.opened_at,s.closed_at,s.actor_id,s.closed_by,s.close_notes,
    coalesce((select e.full_name from public.workspace_employees e where e.workspace_id=w and e.linked_user_id=s.actor_id limit 1),'Operator') as opened_by_name,
    coalesce((select e.full_name from public.workspace_employees e where e.workspace_id=w and e.linked_user_id=s.closed_by limit 1),'Operator') as closed_by_name,
    coalesce((select e.full_name from public.pos_cash_events c join public.workspace_employees e on e.workspace_id=w and e.linked_user_id=c.actor_id where c.session_id=s.id order by c.created_at desc limit 1),'Operator') as latest_operator,
    case when manager or not coalesce((l.settings->>'blindClose')::boolean,false) then s.opening_minor end as opening_minor,
    case when manager or not coalesce((l.settings->>'blindClose')::boolean,false) then pos_private.expected_cash(s.id) end as expected_minor,
    s.counted_minor,s.variance_minor
   from public.pos_register_sessions s join public.pos_registers r on r.id=s.register_id join public.pos_store_locations l on l.id=s.site_id
   where s.workspace_id=w and pos_private.site_access(w,s.site_id) and (manager or s.actor_id=auth.uid() or s.status<>'CLOSED')
    and (nullif(body->>'siteId','') is null or s.site_id=(body->>'siteId')::uuid)
    and (coalesce(body->>'varianceOnly','false')<>'true' or s.variance_minor<>0)
   order by s.opened_at desc limit 200
  ) x;
  return result;
 end if;
 select * into site from public.pos_store_locations where id=(body->>'siteId')::uuid and workspace_id=w;
 if site.id is null or not pos_private.site_access(w,site.id) or not manager then raise exception 'POS_FORBIDDEN'; end if;
 if action='approvals' then
  return (select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('requestedByName',coalesce((select full_name from public.workspace_employees where workspace_id=w and linked_user_id=r.requested_by limit 1),'Operator'),'approvedBy',d.approved_by,'approvedAt',d.approved_at) order by r.created_at desc),'[]')
   from public.pos_approval_requests r left join public.pos_approval_decisions d on d.request_id=r.id where r.workspace_id=w and r.site_id=site.id);
 elsif action='session_detail' then
  if not exists(select 1 from public.pos_register_sessions where id=(body->>'sessionId')::uuid and site_id=site.id) then raise exception 'POS_FORBIDDEN'; end if;
  return jsonb_build_object('events',(select coalesce(jsonb_agg(e order by e.created_at),'[]') from public.pos_cash_events e where e.session_id=(body->>'sessionId')::uuid),
   'approvals',(select coalesce(jsonb_agg(jsonb_build_object('action',r.action,'reason',r.reason,'approvedAt',d.approved_at,'name',coalesce((select full_name from public.workspace_employees where workspace_id=w and linked_user_id=d.approved_by limit 1),'Manager'))),'[]') from public.pos_approval_requests r join public.pos_approval_decisions d on d.request_id=r.id where r.workspace_id=w and r.intent->>'sessionId'=body->>'sessionId'),
   'sales',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'number',s.receipt_number,'at',s.created_at,'actorId',s.actor_id,'totalMinor',s.total_minor)),'[]') from public.pos_sales s where s.session_id=(body->>'sessionId')::uuid),
   'refunds',(select coalesce(jsonb_agg(r),'[]') from public.pos_refunds r where r.session_id=(body->>'sessionId')::uuid));
 elsif action='daily' then
  first_day:=coalesce(nullif(body->>'date','')::date,(now() at time zone site.timezone)::date); last_day:=first_day+1;
  start_at:=first_day::timestamp at time zone site.timezone; end_at:=last_day::timestamp at time zone site.timezone;
  return jsonb_build_object('date',first_day,'timezone',site.timezone,
   'sales',(select jsonb_build_object('grossMinor',coalesce(sum(subtotal_minor),0),'discountMinor',coalesce(sum(discount_minor),0),'netMinor',coalesce(sum(subtotal_minor-discount_minor),0),'taxMinor',coalesce(sum(tax_minor),0),'totalMinor',coalesce(sum(total_minor),0),'count',count(*),'averageMinor',coalesce(round(avg(total_minor)),0)) from public.pos_sales where workspace_id=w and site_id=site.id and created_at>=start_at and created_at<end_at),
   'refunds',(select jsonb_build_object('netMinor',coalesce(sum(subtotal_minor),0),'taxMinor',coalesce(sum(tax_minor),0),'totalMinor',coalesce(sum(total_minor),0),'count',count(*)) from public.pos_refunds where workspace_id=w and site_id=site.id and created_at>=start_at and created_at<end_at),
   'byRegister',(select coalesce(jsonb_agg(x),'[]') from (select r.name,count(*) as count,sum(s.total_minor) as total_minor from public.pos_sales s join public.pos_registers r on r.id=s.register_id where s.workspace_id=w and s.site_id=site.id and s.created_at>=start_at and s.created_at<end_at group by r.id,r.name) x),
   'byEmployee',(select coalesce(jsonb_agg(x),'[]') from (
    select operators.actor_id,coalesce(max(s.receipt->>'employeeName'),(select full_name from public.workspace_employees where workspace_id=w and linked_user_id=operators.actor_id limit 1),'Operator') as name,
     count(s.id) as count,coalesce(sum(s.subtotal_minor),0) as gross_minor,coalesce(sum(s.total_minor),0) as total_minor,coalesce(sum(s.discount_minor),0) as discount_minor,coalesce(round(avg(s.total_minor)),0) as average_minor,count(distinct s.session_id) as session_count,
     (select count(*) from public.pos_refunds r where r.workspace_id=w and r.site_id=site.id and r.actor_id=operators.actor_id and r.created_at>=start_at and r.created_at<end_at) as refund_count,
     (select coalesce(sum(total_minor),0) from public.pos_refunds r where r.workspace_id=w and r.site_id=site.id and r.actor_id=operators.actor_id and r.created_at>=start_at and r.created_at<end_at) as refund_minor,
     (select count(*) from public.pos_sale_items i join public.pos_sales z on z.id=i.sale_id where z.workspace_id=w and z.site_id=site.id and z.actor_id=operators.actor_id and z.created_at>=start_at and z.created_at<end_at and coalesce((i.snapshot->>'overrideDifferenceMinor')::bigint,0)<>0) as override_count,
     (select coalesce(sum(variance_minor),0) from public.pos_register_sessions z where z.workspace_id=w and z.site_id=site.id and z.closed_by=operators.actor_id and z.closed_at>=start_at and z.closed_at<end_at) as variance_minor
    from (select actor_id from public.pos_sales where workspace_id=w and site_id=site.id and created_at>=start_at and created_at<end_at
      union select actor_id from public.pos_refunds where workspace_id=w and site_id=site.id and created_at>=start_at and created_at<end_at
      union select closed_by from public.pos_register_sessions where workspace_id=w and site_id=site.id and closed_at>=start_at and closed_at<end_at) operators
    left join public.pos_sales s on s.actor_id=operators.actor_id and s.workspace_id=w and s.site_id=site.id and s.created_at>=start_at and s.created_at<end_at group by operators.actor_id
   ) x),
   'byHour',(select coalesce(jsonb_agg(x),'[]') from (select extract(hour from created_at at time zone site.timezone)::int as hour,count(*) as count,sum(total_minor) as total_minor from public.pos_sales where workspace_id=w and site_id=site.id and created_at>=start_at and created_at<end_at group by 1 order by 1) x),
   'cash',(select coalesce(jsonb_agg(x),'[]') from (select kind,sum(amount_minor) as amount_minor,count(*) as count from public.pos_cash_events where workspace_id=w and site_id=site.id and created_at>=start_at and created_at<end_at group by kind) x),
   'sessions',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'registerId',s.register_id,'status',s.status,'expectedMinor',pos_private.expected_cash(s.id),'varianceMinor',s.variance_minor)),'[]') from public.pos_register_sessions s where s.workspace_id=w and s.site_id=site.id and s.opened_at<end_at and (s.closed_at is null or s.closed_at>=start_at)));
 end if;
 raise exception 'POS_INVALID';
end $$;

create or replace function pos_private.command(w uuid,action text,body jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare prior public.pos_operation_receipts%rowtype; result jsonb; key_id uuid; site uuid; manager boolean;
begin
 if body is null or jsonb_typeof(body)<>'object' or octet_length(body::text)>32768 then raise exception 'POS_INVALID'; end if;
 if action in ('history','receipt','sessions','session_detail','daily','approvals') then return pos_private.read_operations(w,action,body); end if;
 if action in ('availability','bootstrap','search','recover','cancel','setup') then return pos_private.cash_command(w,action,body); end if;
 if action='access' then return pos_private.access_command(w,action,body); end if;
 if action='quote' then
  result:=pos_private.calculate(w,(body->>'siteId')::uuid,body);
  return result||jsonb_build_object('lines',(select jsonb_agg(value-array['costBasis','inventoryValueUnit']) from jsonb_array_elements(result->'lines')));
 end if;
 perform pos_private.authorize(w);
 key_id:=(body->>'key')::uuid; if key_id is null then raise exception 'POS_INVALID'; end if;
 perform pg_advisory_xact_lock(hashtextextended('pos-operation:'||w::text||auth.uid()::text||key_id::text,0));
 select * into prior from public.pos_operation_receipts where workspace_id=w and actor_id=auth.uid() and key=key_id;
 if prior.key is not null then
  if prior.action<>action or prior.intent<>body-'key' then raise exception 'POS_IDEMPOTENCY_CONFLICT'; end if;
  return prior.result;
 end if;
 if action in ('grant','revoke','staff_permissions','join_site') then result:=pos_private.access_command(w,action,body);
 elsif action='checkout' then result:=pos_private.cash_command(w,action,body);
 elsif action='refund' then result:=pos_private.refund(w,body);
 else result:=pos_private.operations(w,action,body); end if;
 insert into public.pos_operation_receipts(workspace_id,actor_id,key,action,intent,result) values(w,auth.uid(),key_id,action,body-'key',result);
 return result;
end $$;
revoke all on all functions in schema pos_private from public,anon,authenticated;
create trigger pos_refund_events_immutable before update or delete on public.inventory_events for each row when (old.related_entity_type='pos_refund') execute function pos_private.immutable();
create function pos_private.protect_refund_event() returns trigger language plpgsql set search_path='' as $$
begin
 if new.related_entity_type='pos_refund' then
  if current_user in ('authenticated','anon') or not exists(select 1 from public.pos_refunds r join public.pos_refund_items i on i.refund_id=r.id join public.pos_sale_items l on l.id=i.sale_item_id
   where r.id::text=new.related_entity_id and l.inventory_user_id=new.user_id and l.inventory_item_id=new.inventory_item_id and i.return_inventory
    and r.actor_id=(new.metadata->>'actor_id')::uuid and new.quantity_change=i.quantity and new.quantity_after=new.quantity_before+i.quantity and new.idempotency_key='pos-refund:'||i.id::text) then raise exception 'POS_FORBIDDEN'; end if;
 end if;
 return new;
end $$;
create trigger pos_refund_event_origin before insert on public.inventory_events for each row execute function pos_private.protect_refund_event();
revoke all on function pos_private.protect_refund_event() from public,anon,authenticated;
notify pgrst,'reload schema';

create function pos_private.calculate(w uuid,site_id uuid,body jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare site public.pos_store_locations%rowtype; inv public.inventory_items%rowtype; stock_owner uuid; line jsonb; lines jsonb:='[]'; updated jsonb:='[]';
 qty int; rate int; price bigint; original_price bigint; reserved bigint; line_sub bigint; line_disc bigint; line_tax bigint;
 sub bigint:=0; disc bigint:=0; tax bigint:=0; cart_discount bigint; taxable bigint; cumulative bigint:=0; allocated bigint:=0; share bigint;
begin
 perform pos_private.authorize(w);
 select * into site from public.pos_store_locations where id=site_id and workspace_id=w;
 if site.id is null or not pos_private.site_access(w,site.id) then raise exception 'POS_FORBIDDEN'; end if;
 if jsonb_typeof(body->'lines') is distinct from 'array' or jsonb_array_length(body->'lines') not between 1 and 100 then raise exception 'POS_INVALID'; end if;
  for line in select value from jsonb_array_elements(body->'lines') order by coalesce((value->>'ownerId')::uuid,site.inventory_user_id),(value->>'itemId') collate "C",nullif(value->>'positionId','') collate "C" nulls last loop
    stock_owner:=coalesce((line->>'ownerId')::uuid,site.inventory_user_id);
    if not pos_private.can_transact(w,site.id,stock_owner,'sell') then raise exception 'POS_FORBIDDEN'; end if;
    if coalesce(line->>'quantity','') !~ '^\d{1,4}$' or coalesce(line->>'discountBps','0') !~ '^\d{1,5}$' then raise exception 'POS_INVALID'; end if;
    qty := (line->>'quantity')::integer; rate := coalesce((line->>'discountBps')::integer,0);
    if qty not between 1 and 1000 or rate not between 0 and 10000 then raise exception 'POS_INVALID'; end if;
    if rate>0 then

      if length(trim(coalesce(body->>'discountReason',''))) not between 1 and 200 then raise exception 'POS_DISCOUNT_REASON'; end if;
    end if;
    select i.* into inv from public.inventory_items i join public.pos_location_inventory_locations m on m.inventory_user_id=i.user_id and m.location_id=i.location_id and m.site_id=site.id
      where i.user_id=stock_owner and i.workspace_id=w and i.id=line->>'itemId';
    if inv.id is null then raise exception 'POS_STOCK_UNAVAILABLE'; end if;
    select coalesce(sum(quantity),0) into reserved from public.selling_inventory_allocations where user_id=stock_owner and inventory_item_id=inv.id and status in ('ALLOCATED','RESERVED');
    if inv.quantity-reserved<qty then raise exception 'POS_STOCK_UNAVAILABLE'; end if;
    if inv.asking_price is null or inv.asking_price not between 0 and 1000000 then raise exception 'POS_PRICE_REQUIRED'; end if;
    price := (inv.asking_price*100)::bigint;
    original_price:=price;
    if line ? 'overrideMinor' and line->>'overrideMinor' is not null then
      if coalesce(line->>'overrideMinor','') !~ '^\d{1,9}$' or (line->>'overrideMinor')::bigint>100000000 then raise exception 'POS_INVALID'; end if;
      price:=(line->>'overrideMinor')::bigint;
    end if;
    if coalesce(line->>'discountMinor','0') !~ '^\d{1,12}$' then raise exception 'POS_INVALID'; end if;
    if rate>0 and coalesce((line->>'discountMinor')::bigint,0)>0 then raise exception 'POS_INVALID'; end if;
    line_sub := price*qty; line_disc := (line_sub*rate+5000)/10000+coalesce((line->>'discountMinor')::bigint,0);
    if line_disc>line_sub then raise exception 'POS_INVALID'; end if;
    if (line_disc>0 or price<>original_price) and length(trim(coalesce(body->>'discountReason',''))) not between 1 and 200 then raise exception 'POS_DISCOUNT_REASON'; end if;
    line_tax := case when inv.data->>'taxable'='false' then 0 else ((line_sub-line_disc)*site.tax_bps+5000)/10000 end;
    sub:=sub+line_sub; disc:=disc+line_disc; tax:=tax+line_tax;
    lines:=lines||jsonb_build_array(jsonb_build_object('itemId',inv.id,'ownerId',stock_owner,'name',coalesce(nullif(inv.product_name,''),inv.card_name),'sku',inv.sku,'quantity',qty,'unitPriceMinor',price,'originalUnitPriceMinor',original_price,'overrideDifferenceMinor',price-original_price,'lineDiscountMinor',line_disc,'discountBps',rate,'inventoryValueUnit',case when inv.quantity>0 then inv.inventory_value/inv.quantity else 0 end,'discountMinor',line_disc,'taxMinor',line_tax,'lineTotalMinor',line_sub-line_disc+line_tax,'gameId',coalesce(to_jsonb(inv)->>'game_id',inv.data->>'game_id'),'productType',coalesce(to_jsonb(inv)->>'product_type',inv.data->>'product_type'),'scryfallId',inv.scryfall_id,'tcgplayerProductId',coalesce(to_jsonb(inv)->>'tcgplayer_product_id',inv.data->>'tcgplayer_product_id'),'setCode',inv.set_code,'collectorNumber',inv.collector_number,'condition',coalesce((select p.condition from public.chaos_sort_inventory_positions p where p.user_id=stock_owner and p.id=line->>'positionId' and p.item_id=inv.id),inv.data->>'condition'),'finish',coalesce((select p.finish from public.chaos_sort_inventory_positions p where p.user_id=stock_owner and p.id=line->>'positionId' and p.item_id=inv.id),inv.data->>'finish'),'language',coalesce((select p.language from public.chaos_sort_inventory_positions p where p.user_id=stock_owner and p.id=line->>'positionId' and p.item_id=inv.id),inv.data->>'language'),'locationId',inv.location_id,'costBasis',pos_private.cost_snapshot(inv.data),'priceSource','asking_price','positionId',line->>'positionId'));
  end loop;

 if coalesce(body->>'cartDiscountMinor','0') !~ '^\d{1,12}$' or coalesce(body->>'cartDiscountBps','0') !~ '^\d{1,5}$'
   or coalesce((body->>'cartDiscountBps')::int,0)>10000 then raise exception 'POS_INVALID'; end if;
 if coalesce((body->>'cartDiscountMinor')::bigint,0)>0 and coalesce((body->>'cartDiscountBps')::int,0)>0 then raise exception 'POS_INVALID'; end if;
 taxable:=sub-disc;
 cart_discount:=coalesce((body->>'cartDiscountMinor')::bigint,0)+(taxable*coalesce((body->>'cartDiscountBps')::int,0)+5000)/10000;
 if cart_discount>taxable then raise exception 'POS_INVALID'; end if;
 if cart_discount>0 and length(trim(coalesce(body->>'discountReason',''))) not between 1 and 200 then raise exception 'POS_DISCOUNT_REASON'; end if;
 tax:=0;
 for line in select value from jsonb_array_elements(lines) loop
  line_sub:=(line->>'unitPriceMinor')::bigint*(line->>'quantity')::int-(line->>'discountMinor')::bigint;
  cumulative:=cumulative+line_sub;
  share:=case when taxable=0 then 0 else floor(cart_discount::numeric*cumulative/taxable)::bigint-allocated end;
  allocated:=allocated+share;
  select * into inv from public.inventory_items where user_id=(line->>'ownerId')::uuid and id=line->>'itemId';
  line_tax:=case when inv.data->>'taxable'='false' then 0 else ((line_sub-share)*site.tax_bps+5000)/10000 end;
  tax:=tax+line_tax;
  updated:=updated||jsonb_build_array(line||jsonb_build_object('cartDiscountMinor',share,'discountMinor',(line->>'discountMinor')::bigint+share,'taxMinor',line_tax,'lineTotalMinor',line_sub-share+line_tax));
 end loop;
 return jsonb_build_object('lines',updated,'subtotalMinor',sub,'discountMinor',disc+cart_discount,'taxMinor',tax,'totalMinor',sub-disc-cart_discount+tax);
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
      'operators',(select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'name',coalesce((select e.full_name from public.workspace_employees e where e.workspace_id=w and e.linked_user_id=m.user_id limit 1),(select coalesce(to_jsonb(p)->>'full_name',to_jsonb(p)->>'display_name') from public.profiles p where p.id=m.user_id),'Operator'))),'[]') from public.workspace_members m where m.workspace_id=w and (m.user_id=actor or exists(select 1 from public.workspace_members z where z.workspace_id=w and z.user_id=actor and z.role in ('owner','admin','manager')))),
      'sites',(select coalesce(jsonb_agg(s),'[]') from public.pos_store_locations s where s.workspace_id=w and exists(select 1 from public.pos_location_inventory_locations m where m.site_id=s.id and pos_private.can_transact(w,s.id,m.inventory_user_id,'sell'))),
      'registers',(select coalesce(jsonb_agg(r order by r.created_at,r.id),'[]') from public.pos_registers r join public.pos_store_locations s on s.id=r.site_id where r.workspace_id=w and (r.active or exists(select 1 from public.workspace_members where workspace_id=w and user_id=actor and role in ('owner','admin','manager'))) and exists(select 1 from public.pos_location_inventory_locations m where m.site_id=s.id and pos_private.can_transact(w,s.id,m.inventory_user_id,'sell'))),
      'sessions',(select coalesce(jsonb_agg(s),'[]') from public.pos_register_sessions s where s.workspace_id=w and s.closed_at is null and exists(select 1 from public.pos_location_inventory_locations m where m.site_id=s.site_id and pos_private.can_transact(w,s.site_id,m.inventory_user_id,'sell'))),
      'locations',(select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'name',l.name)),'[]') from public.inventory_locations l where l.user_id=actor and not exists(select 1 from public.pos_location_inventory_locations m where m.inventory_user_id=actor and m.location_id=l.id)),
      'operatorName',coalesce((select e.full_name from public.workspace_employees e where e.workspace_id=w and e.linked_user_id=actor limit 1),(select coalesce(to_jsonb(p)->>'full_name',to_jsonb(p)->>'display_name') from public.profiles p where p.id=actor),'Operator'),'canManage',exists(select 1 from public.workspace_members where workspace_id=w and user_id=actor and role in ('owner','admin','manager')));
  elsif action='setup' then
    if length(trim(body->>'name')) not between 1 and 100 or length(trim(body->>'registerName')) not between 1 and 100 or coalesce(body->>'taxBps','') !~ '^\d{1,4}$' then raise exception 'POS_INVALID'; end if;
    loc := body->>'locationId';
    if not exists(select 1 from public.inventory_locations where user_id=actor and id=loc) then raise exception 'POS_FORBIDDEN'; end if;
    if not exists(select 1 from pg_timezone_names where name=coalesce(body->>'timezone','America/Phoenix')) then raise exception 'POS_INVALID'; end if;
    insert into public.pos_store_locations(workspace_id,inventory_user_id,name,tax_bps,timezone) values(w,actor,trim(body->>'name'),(body->>'taxBps')::int,coalesce(body->>'timezone','America/Phoenix')) returning * into site;
    insert into public.pos_location_inventory_locations values(w,site.id,actor,loc);
    insert into public.pos_registers(workspace_id,site_id,name) values(w,site.id,trim(body->>'registerName')) returning * into reg;
    return jsonb_build_object('siteId',site.id,'registerId',reg.id);
  elsif action in ('open','close') then
    select r.* into reg from public.pos_registers r join public.pos_store_locations s on s.id=r.site_id
      where r.id=(body->>'registerId')::uuid and r.workspace_id=w and r.active and exists(select 1 from public.pos_location_inventory_locations m where m.site_id=s.id and pos_private.can_transact(w,s.id,m.inventory_user_id,'sell')) for update of r;
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
  if sess.id is null or sess.status<>'OPEN' or not exists(select 1 from public.pos_registers where id=sess.register_id and active) then raise exception 'POS_SESSION_CLOSED'; end if;
  if jsonb_typeof(body->'lines') is distinct from 'array' or jsonb_array_length(body->'lines') not between 1 and 100
    or coalesce(body->>'cashMinor','') !~ '^\d{1,12}$' or coalesce(body->>'expectedMinor','') !~ '^\d{1,12}$' then raise exception 'POS_INVALID'; end if;
  received := (body->>'cashMinor')::bigint; expected := (body->>'expectedMinor')::bigint;
  if (select count(distinct (coalesce((value->>'ownerId')::uuid,site.inventory_user_id),value->>'itemId',coalesce(nullif(value->>'positionId',''),''))) from jsonb_array_elements(body->'lines'))<>jsonb_array_length(body->'lines') then raise exception 'POS_INVALID'; end if;
  for stock_owner in select distinct coalesce((value->>'ownerId')::uuid,site.inventory_user_id) from jsonb_array_elements(body->'lines') order by 1 loop
    perform pos_private.lock_authority(w,site.id,stock_owner,'sell');
    perform 1 from public.inventory_items where user_id=stock_owner and id in (select value->>'itemId' from jsonb_array_elements(body->'lines')) order by id for update;
  end loop;
  result:=pos_private.calculate(w,site.id,body);
  lines:=result->'lines'; sub:=(result->>'subtotalMinor')::bigint; disc:=(result->>'discountMinor')::bigint; tax:=(result->>'taxMinor')::bigint;
  if (disc>0 and not pos_private.permission(w,'discount')) or (exists(select 1 from jsonb_array_elements(lines) where (value->>'overrideDifferenceMinor')::bigint<>0) and not pos_private.permission(w,'override')) then
    perform pos_private.approved(w,site.id,'checkout',body);
  end if;
  if expected<>sub-disc+tax then raise exception 'POS_QUOTE_CHANGED'; end if;
  if received<sub-disc+tax then raise exception 'POS_CASH_INSUFFICIENT'; end if;
  v_sale_id:=gen_random_uuid();
  code:='TD-'||upper(replace(v_sale_id::text,'-',''));
  select name into loc from public.pos_registers where id=sess.register_id;
  receipt:=jsonb_build_object('version',2,'settings',site.settings,'timezone',site.timezone,'employeeName',coalesce((select e.full_name from public.workspace_employees e where e.workspace_id=w and e.linked_user_id=actor limit 1),(select coalesce(to_jsonb(p)->>'full_name',to_jsonb(p)->>'display_name') from public.profiles p where p.id=actor),'Operator'),'number',code,'site',site.name,'register',loc,'actorId',actor,'createdAt',now(),'currency','USD','lines',(select jsonb_agg(value-array['costBasis','inventoryValueUnit']) from jsonb_array_elements(lines)),'subtotalMinor',sub,'discountMinor',disc,'taxMinor',tax,'totalMinor',sub-disc+tax,'cashMinor',received,'changeMinor',received-(sub-disc+tax),'discountReason',body->>'discountReason');
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



revoke all on all functions in schema pos_private from public,anon,authenticated;
