-- Phase 6: additive Sandbox device routing; no credentials in hardware records.
alter table pos_private.square_connections add column authorized_scopes text[] not null default '{}';
create table public.pos_payment_devices(
 id uuid primary key, workspace_id uuid not null, site_id uuid not null, connection_id uuid not null,
 provider text not null default 'SQUARE' check(provider='SQUARE'), environment text not null default 'SANDBOX' check(environment='SANDBOX'),
 provider_location_id text not null, provider_device_id text, provider_device_code_id text,
 display_name text not null check(length(display_name) between 1 and 128),
 pairing_status text not null default 'PAIRING' check(pairing_status in ('PAIRING','PAIRED','EXPIRED','UNPAIRED','ERROR')),
 status text not null default 'PAIRING' check(status in ('PAIRING','PAIRED','AVAILABLE','OFFLINE','BUSY','DISABLED','ERROR','UNPAIRED')),
 pair_by timestamptz, paired_at timestamptz,last_seen_at timestamptz,assigned_register_id uuid,
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),disabled_at timestamptz,
 foreign key(workspace_id,site_id) references public.pos_store_locations(workspace_id,id),
 foreign key(workspace_id,connection_id) references pos_private.square_connections(workspace_id,id),
 foreign key(workspace_id,site_id,assigned_register_id) references public.pos_registers(workspace_id,site_id,id),
 unique(connection_id,provider_device_id),unique(connection_id,provider_device_code_id),unique(workspace_id,id)
);
create unique index pos_terminal_register on public.pos_payment_devices(assigned_register_id) where disabled_at is null and assigned_register_id is not null;
create index pos_terminal_workspace on public.pos_payment_devices(workspace_id,site_id);
alter table public.pos_payment_devices enable row level security;
revoke all on public.pos_payment_devices from public,anon,authenticated;
-- Read only through explicitly projected, authorized RPCs.
create table pos_private.square_device_codes(device_id uuid primary key references public.pos_payment_devices(id),code text not null);
create table pos_private.square_terminal_attempts(
 payment_id uuid primary key references public.pos_payment_attempts(id),device_id uuid not null references public.pos_payment_devices(id),
 provider_device_id text not null,location_id text not null,checkout_id text unique,checkout_status text,updated_at timestamptz not null default now()
);
create index square_terminal_device on pos_private.square_terminal_attempts(device_id);
create table pos_private.square_terminal_refunds(refund_id uuid primary key references public.pos_payment_refund_attempts(id),checkout_id text not null unique);
create table pos_private.square_hardware_audit(
 id bigint generated always as identity primary key,workspace_id uuid not null,device_id uuid not null references public.pos_payment_devices(id),
 actor_id uuid,action text not null,created_at timestamptz not null default now()
);
create trigger square_hardware_audit_immutable before update or delete on pos_private.square_hardware_audit for each row execute function pos_private.immutable();
do $$ declare t text; begin
 foreach t in array array['square_device_codes','square_terminal_attempts','square_hardware_audit','square_terminal_refunds'] loop
 execute format('alter table pos_private.%I enable row level security',t);
 execute format('revoke all on pos_private.%I from public,anon,authenticated',t);
 end loop;
end $$;

create function pos_private.terminal_busy(d uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from pos_private.square_terminal_attempts t join public.pos_payment_attempts p on p.id=t.payment_id where t.device_id=d and p.status not in ('SUCCEEDED','DECLINED','FAILED','CANCELED','PARTIALLY_REFUNDED','REFUNDED'));
$$;
create function pos_private.terminal_scoped(scopes text[]) returns boolean language sql immutable set search_path='' as $$
 select scopes @> array['DEVICE_CREDENTIAL_MANAGEMENT','MERCHANT_PROFILE_READ','PAYMENTS_READ','PAYMENTS_WRITE'];
$$;
create function pos_private.terminal_devices(w uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'siteId',d.site_id,'registerId',d.assigned_register_id,'name',d.display_name,
 'pairingStatus',case when d.pairing_status='PAIRING' and d.pair_by<now() then 'EXPIRED' else d.pairing_status end,
 'status',case when d.disabled_at is not null then 'DISABLED' when pos_private.terminal_busy(d.id) then 'BUSY' else d.status end,
 'pairBy',d.pair_by,'pairedAt',d.paired_at,'lastSeenAt',d.last_seen_at,
 'eligible',d.disabled_at is null and d.pairing_status='PAIRED' and d.status in ('PAIRED','AVAILABLE','BUSY') and d.assigned_register_id is not null and c.status='CONNECTED' and pos_private.terminal_scoped(c.authorized_scopes) and exists(select 1 from pos_private.square_mappings m join pos_private.square_locations l on l.connection_id=m.connection_id and l.id=m.location_id where m.connection_id=d.connection_id and m.site_id=d.site_id and m.location_id=d.provider_location_id and l.status='ACTIVE')) order by d.created_at),'[]')
 from public.pos_payment_devices d join pos_private.square_connections c on c.id=d.connection_id where d.workspace_id=w and pos_private.site_access(w,d.site_id);
$$;
create function public.pos_terminal_devices(p_workspace_id uuid,p_action text,p_body jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.pos_payment_devices%rowtype;
begin
 perform pos_private.authorize(p_workspace_id,false,false);
 if p_action<>'get' then
  perform pos_private.square_admin(p_workspace_id,auth.uid());
  select * into d from public.pos_payment_devices where id=(p_body->>'id')::uuid and workspace_id=p_workspace_id for update;
  if d.id is null then raise exception 'POS_FORBIDDEN';end if;
  if p_action='rename' then
   update public.pos_payment_devices set display_name=trim(p_body->>'name'),updated_at=now() where id=d.id;
  elsif p_action='assign' then
   if pos_private.terminal_busy(d.id) then raise exception 'DEVICE_BUSY';end if;
   if nullif(p_body->>'registerId','') is not null and (d.disabled_at is not null or d.pairing_status<>'PAIRED' or not exists(select 1 from public.pos_registers where id=(p_body->>'registerId')::uuid and workspace_id=p_workspace_id and site_id=d.site_id and active)) then raise exception 'POS_FORBIDDEN';end if;
   update public.pos_payment_devices set assigned_register_id=nullif(p_body->>'registerId','')::uuid,updated_at=now() where id=d.id;
  elsif p_action='disable' then
   update public.pos_payment_devices set disabled_at=coalesce(disabled_at,now()),status='DISABLED',assigned_register_id=null,updated_at=now() where id=d.id;
  else raise exception 'POS_INVALID';end if;
  insert into pos_private.square_hardware_audit(workspace_id,device_id,actor_id,action) values(p_workspace_id,d.id,auth.uid(),case when p_action='assign' and nullif(p_body->>'registerId','') is null then 'unassign' else p_action end);
 end if;
 return jsonb_build_object('devices',pos_private.terminal_devices(p_workspace_id),
 'canManage',exists(select 1 from public.workspace_members where workspace_id=p_workspace_id and user_id=auth.uid() and role in ('owner','admin')),
 'sites',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name)),'[]') from public.pos_store_locations where workspace_id=p_workspace_id and pos_private.site_access(p_workspace_id,id)),
 'registers',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'siteId',site_id,'name',name)),'[]') from public.pos_registers where workspace_id=p_workspace_id and active and pos_private.site_access(p_workspace_id,site_id)));
end $$;
revoke all on function public.pos_terminal_devices(uuid,text,jsonb) from public,anon;
grant execute on function public.pos_terminal_devices(uuid,text,jsonb) to authenticated;

-- Runs within canonical create's session/checkout transaction. No client device ID.
create function pos_private.terminal_attempt_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare c public.pos_payment_checkouts%rowtype;d public.pos_payment_devices%rowtype;
begin
 if new.provider<>'SQUARE' or new.request->>'method' is distinct from 'square_terminal' then return new;end if;
 select * into c from public.pos_payment_checkouts where id=new.checkout_id;
 select * into d from public.pos_payment_devices where workspace_id=new.workspace_id and site_id=c.site_id and assigned_register_id=c.register_id and disabled_at is null for update;
 if d.id is null or d.pairing_status<>'PAIRED' or d.status not in ('PAIRED','AVAILABLE','BUSY') or d.provider_device_id is null or d.connection_id::text<>new.provider_account_id or d.provider_location_id is distinct from new.metadata->>'locationId' then raise exception 'POS_TERMINAL_UNAVAILABLE';end if;
 if not exists(select 1 from pos_private.square_connections where id=d.connection_id and pos_private.terminal_scoped(authorized_scopes)) then raise exception 'POS_TERMINAL_SCOPE';end if;
 if pos_private.terminal_busy(d.id) then raise exception 'POS_TERMINAL_BUSY';end if;
 new.metadata:=new.metadata||jsonb_build_object('method','TERMINAL','terminalName',d.display_name,'deviceId',d.id);
 return new;
end $$;
create trigger pos_terminal_attempt_guard before insert on public.pos_payment_attempts for each row execute function pos_private.terminal_attempt_guard();
create function pos_private.terminal_attempt_context() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.provider='SQUARE' and new.request->>'method'='square_terminal' then
  insert into pos_private.square_terminal_attempts(payment_id,device_id,provider_device_id,location_id)
   select new.id,id,provider_device_id,provider_location_id from public.pos_payment_devices where id=(new.metadata->>'deviceId')::uuid;
 end if;return new;
end $$;
create trigger pos_terminal_attempt_context after insert on public.pos_payment_attempts for each row execute function pos_private.terminal_attempt_context();

create function pos_private.terminal_service(action text,body jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare w uuid:=(body->>'workspaceId')::uuid;actor uuid:=(body->>'actorId')::uuid;d public.pos_payment_devices%rowtype;
 c pos_private.square_connections%rowtype;t pos_private.square_terminal_attempts%rowtype;p public.pos_payment_attempts%rowtype;
 loc text;result jsonb;old_status text;
begin
 if action in ('terminal_pair','terminal_check') then
  perform pos_private.square_admin(w,actor);
  if action='terminal_pair' then
   perform pg_advisory_xact_lock(hashtextextended('terminal-pair:'||(body->>'id'),0));
   select * into d from public.pos_payment_devices where id=(body->>'id')::uuid;
   if d.id is not null then
    if d.workspace_id<>w or d.site_id<>(body->>'siteId')::uuid or d.created_by<>actor or d.display_name<>trim(body->>'name') then raise exception 'POS_FORBIDDEN';end if;
   else
    select a.* into c from pos_private.square_connections a where a.workspace_id=w and a.status='CONNECTED';
    select m.location_id into loc from pos_private.square_mappings m join pos_private.square_locations l on l.connection_id=m.connection_id and l.id=m.location_id where m.connection_id=c.id and m.site_id=(body->>'siteId')::uuid and l.status='ACTIVE';
    if loc is null then raise exception 'POS_TERMINAL_UNAVAILABLE';end if;
    if not pos_private.terminal_scoped(c.authorized_scopes) then raise exception 'SQUARE_TERMINAL_SCOPE';end if;
    insert into public.pos_payment_devices(id,workspace_id,site_id,connection_id,provider_location_id,display_name,created_by) values((body->>'id')::uuid,w,(body->>'siteId')::uuid,c.id,loc,trim(body->>'name'),actor) returning * into d;
    insert into pos_private.square_hardware_audit(workspace_id,device_id,actor_id,action) values(w,d.id,actor,'pairing_created');
   end if;
  else select * into d from public.pos_payment_devices where id=(body->>'id')::uuid and workspace_id=w;end if;
  if d.id is null then raise exception 'POS_FORBIDDEN';end if;
  result:=public.pos_square_service('credential',jsonb_build_object('workspaceId',w,'connectionId',d.connection_id));
  if not pos_private.terminal_scoped(array(select jsonb_array_elements_text(result->'connection'->'authorized_scopes'))) then raise exception 'SQUARE_TERMINAL_SCOPE';end if;
  return result||jsonb_build_object('device',to_jsonb(d));
 elsif action='terminal_code' then
  select * into d from public.pos_payment_devices where id=(body->>'id')::uuid and workspace_id=w for update;
  if d.id is null or d.provider_location_id is distinct from body->>'locationId' or (d.provider_device_code_id is not null and d.provider_device_code_id is distinct from body->>'codeId') then raise exception 'POS_INVALID';end if;
  old_status:=d.pairing_status;
  if body->>'status'='PAIRED' and nullif(body->>'deviceId','') is null then raise exception 'POS_INVALID';end if;
  if d.provider_device_id is not null and d.provider_device_id is distinct from body->>'deviceId' then raise exception 'POS_INVALID';end if;
  update public.pos_payment_devices set provider_device_code_id=body->>'codeId',provider_device_id=coalesce(provider_device_id,body->>'deviceId'),pair_by=(body->>'pairBy')::timestamptz,
   pairing_status=case when pairing_status='PAIRED' then 'PAIRED' when body->>'status'='PAIRED' then 'PAIRED' when body->>'status'='EXPIRED' or (body->>'pairBy')::timestamptz<now() then 'EXPIRED' else 'PAIRING' end,
   status=case when disabled_at is not null then 'DISABLED' when body->>'status'='PAIRED' and pairing_status<>'PAIRED' then 'PAIRED' else status end,
   paired_at=case when body->>'status'='PAIRED' then coalesce(paired_at,(body->>'pairedAt')::timestamptz,now()) else paired_at end,updated_at=now() where id=d.id;
  if body->>'code' is not null then insert into pos_private.square_device_codes values(d.id,body->>'code') on conflict(device_id) do update set code=excluded.code;end if;
  if old_status<>'PAIRED' and body->>'status'='PAIRED' then insert into pos_private.square_hardware_audit(workspace_id,device_id,action) values(w,d.id,'paired');end if;
  return '{}';
 elsif action='terminal_health' then
  update public.pos_payment_devices set status=case when disabled_at is not null then 'DISABLED' else body->>'status' end,last_seen_at=case when body->>'status'='AVAILABLE' then now() else last_seen_at end,updated_at=now() where id=(body->>'id')::uuid and workspace_id=w and provider_device_id=body->>'deviceId';return '{}';
 elsif action='terminal_code_view' then
  perform pos_private.square_admin(w,actor);
  return coalesce((select jsonb_build_object('id',dv.id,'code',v.code,'pairBy',dv.pair_by) from public.pos_payment_devices dv join pos_private.square_device_codes v on v.device_id=dv.id where dv.id=(body->>'id')::uuid and dv.workspace_id=w and dv.pairing_status='PAIRING' and dv.pair_by>now() and dv.disabled_at is null),'{}');
 elsif action='terminal_context' then
  select * into p from public.pos_payment_attempts where id=(body->>'id')::uuid and workspace_id=w and provider='SQUARE';
  select * into t from pos_private.square_terminal_attempts where payment_id=p.id;
  if t.payment_id is null then raise exception 'POS_FORBIDDEN';end if;
  return jsonb_build_object('terminal',to_jsonb(t));
 elsif action='terminal_observe' then
  select * into p from public.pos_payment_attempts where id=(body->>'id')::uuid and workspace_id=w and provider='SQUARE';
  select * into t from pos_private.square_terminal_attempts where payment_id=p.id for update;
  if t.payment_id is null or t.provider_device_id is distinct from body->>'deviceId' or t.location_id is distinct from body->>'locationId' or (t.checkout_id is not null and t.checkout_id is distinct from body->>'checkoutId') then raise exception 'POS_INVALID';end if;
  if t.checkout_id is null or (t.checkout_status is distinct from 'CANCELED' and body->>'status'='CANCELED') then
   insert into pos_private.square_hardware_audit(workspace_id,device_id,actor_id,action) values(w,t.device_id,p.actor_id,case when body->>'status'='CANCELED' then 'checkout_canceled' else 'checkout_sent' end);
  end if;
  update pos_private.square_terminal_attempts set checkout_id=body->>'checkoutId',checkout_status=body->>'status',updated_at=now() where payment_id=p.id and coalesce(checkout_status,'') not in ('COMPLETED','CANCELED');return '{}';
 elsif action in ('terminal_refund_get','terminal_refund_save') then
  if not exists(select 1 from public.pos_payment_refund_attempts where id=(body->>'id')::uuid and workspace_id=w and payment_id=(body->>'paymentId')::uuid) then raise exception 'POS_FORBIDDEN';end if;
  if action='terminal_refund_save' then
   insert into pos_private.square_terminal_refunds values((body->>'id')::uuid,body->>'checkoutId') on conflict(refund_id) do nothing;
   if not exists(select 1 from pos_private.square_terminal_refunds where refund_id=(body->>'id')::uuid and checkout_id=body->>'checkoutId') then raise exception 'POS_INVALID';end if;
  end if;
  return coalesce((select to_jsonb(r) from pos_private.square_terminal_refunds r where refund_id=(body->>'id')::uuid),'{}');
 elsif action='terminal_event' then
  if body->>'type'='device.code.paired' then
   select d1.* into d from public.pos_payment_devices d1 join pos_private.square_connections c1 on c1.id=d1.connection_id where c1.merchant_id=body->>'merchantId' and d1.provider_device_code_id=body->>'resourceId';
   if d.id is null then raise exception 'UNKNOWN_STATUS';end if;
   return jsonb_build_object('device',to_jsonb(d));
  end if;
  select a.* into p from public.pos_payment_attempts a join pos_private.square_connections c1 on c1.id=a.provider_account_id::uuid join pos_private.square_terminal_attempts t1 on t1.payment_id=a.id where c1.merchant_id=body->>'merchantId' and (t1.checkout_id=body->>'resourceId' or a.id::text=body->>'referenceId');
  if p.id is null then raise exception 'UNKNOWN_STATUS';end if;
  return jsonb_build_object('payment',to_jsonb(p));
 end if;raise exception 'POS_INVALID';
end $$;
revoke all on all functions in schema pos_private from public,anon,authenticated;

-- Forward replacement: retain Phase 5 service actions, add scoped Terminal dispatch.
create or replace function public.pos_square_service(p_action text,p_body jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare w uuid:=(p_body->>'workspaceId')::uuid;actor uuid:=(p_body->>'actorId')::uuid;
 c pos_private.square_connections%rowtype;cred pos_private.square_credentials%rowtype;flow pos_private.square_oauth%rowtype;
 p public.pos_payment_attempts%rowtype;r public.pos_payment_refund_attempts%rowtype;loc jsonb;result jsonb;event pos_private.square_events%rowtype;
begin
 if octet_length(p_body::text)>131072 then raise exception 'POS_INVALID'; end if;
 if p_action like 'terminal_%' then return pos_private.terminal_service(p_action,p_body);end if;
 if p_action in ('oauth_start','oauth_consume','connect','manage_credentials','health','disconnect') then perform pos_private.square_admin(w,actor); end if;
 if p_action='oauth_start' then
  insert into pos_private.square_oauth values(p_body->>'hash',w,actor,now()+interval '10 minutes',null,'SANDBOX','/dashboard/pos/payments'); return '{}';
 elsif p_action='oauth_consume' then
  update pos_private.square_oauth set consumed_at=now() where state_hash=p_body->>'hash' and workspace_id=w and actor_id=actor and consumed_at is null and expires_at>now() returning * into flow;
  if flow.state_hash is null then raise exception 'OAUTH_STATE_INVALID'; end if;return jsonb_build_object('returnPath',flow.return_path);
 elsif p_action='connect' then
  perform pg_advisory_xact_lock(hashtextextended('square-connect:'||w::text,0));
  select * into c from pos_private.square_connections where workspace_id=w and status in ('CONNECTED','ATTENTION') for update;
  if c.id is not null and c.merchant_id<>p_body->>'merchantId' and coalesce((p_body->>'replaceConfirmed')::boolean,false)=false then raise exception 'SQUARE_REPLACEMENT_REQUIRED'; end if;
  -- Keep identity stable for same-merchant reauthorization; different merchants get a new record.
  if c.id is null then select * into c from pos_private.square_connections where workspace_id=w and merchant_id=p_body->>'merchantId' and status in ('REVOKED','DISCONNECTED') order by connected_at desc limit 1 for update; end if;
  if c.id is not null and c.merchant_id<>p_body->>'merchantId' then
   update pos_private.square_connections set status='REPLACED' where id=c.id;delete from pos_private.square_credentials where connection_id=c.id;c.id:=null;
  end if;
  if c.id is null then
   insert into pos_private.square_connections(workspace_id,merchant_id,display_name,country,account_status,status,connected_by,last_validated_at) values(w,p_body->>'merchantId',p_body->>'displayName',p_body->>'country',p_body->>'accountStatus','CONNECTED',actor,now()) returning * into c;
  else update pos_private.square_connections set status='CONNECTED',last_validated_at=now(),display_name=p_body->>'displayName',account_status=p_body->>'accountStatus' where id=c.id;end if;
  insert into pos_private.square_credentials(connection_id,encrypted,expires_at) values(c.id,p_body->'encrypted',(p_body->>'expiresAt')::timestamptz) on conflict(connection_id) do update set encrypted=excluded.encrypted,expires_at=excluded.expires_at,version=square_credentials.version+1,refresh_lease=null,refresh_until=null;
  update pos_private.square_locations set status='INACTIVE' where connection_id=c.id;
  for loc in select value from jsonb_array_elements(p_body->'locations') loop
   insert into pos_private.square_locations values(c.id,loc->>'id',loc->>'name',loc->>'status',loc->>'address') on conflict(connection_id,id) do update set name=excluded.name,status=excluded.status,address=excluded.address;
  end loop;
  update pos_private.square_connections set authorized_scopes=array(select jsonb_array_elements_text(coalesce(p_body->'scopes','[]'))) where id=c.id;
  return jsonb_build_object('id',c.id);
 elsif p_action='manage_credentials' then
  select * into c from pos_private.square_connections where workspace_id=w and id=(p_body->>'connectionId')::uuid;
 elsif p_action='payment_context' then
  select * into p from public.pos_payment_attempts where id=(p_body->>'id')::uuid and workspace_id=w and provider='SQUARE';
  if p.id is null then raise exception 'POS_FORBIDDEN'; end if;
  -- Server has separately called the authenticated get/dispatch command before this read.
  if actor is null or not (p.actor_id=actor or exists(select 1 from public.workspace_members where workspace_id=w and user_id=actor and role in ('owner','admin','manager'))) then raise exception 'POS_FORBIDDEN'; end if;
  select * into c from pos_private.square_connections where id=p.provider_account_id::uuid and workspace_id=w;
  result:=jsonb_build_object('payment',to_jsonb(p));
  if p_body->>'refundId' is not null then
   select * into r from public.pos_payment_refund_attempts where id=(p_body->>'refundId')::uuid and payment_id=p.id and workspace_id=w;
   if r.id is null or r.actor_id<>actor then raise exception 'POS_FORBIDDEN'; end if;
   result:=result||jsonb_build_object('refund',to_jsonb(r));
  end if;
 elsif p_action='credential' then
  select * into c from pos_private.square_connections where id=(p_body->>'connectionId')::uuid and workspace_id=w;
 elsif p_action='refresh_claim' then
  update pos_private.square_credentials set refresh_lease=(p_body->>'lease')::uuid,refresh_until=now()+interval '45 seconds'
  where connection_id=(p_body->>'connectionId')::uuid and (refresh_until is null or refresh_until<now()) and expires_at<now()+interval '23 days'
  and exists(select 1 from pos_private.square_connections c where c.id=connection_id and c.workspace_id=w and c.status='CONNECTED') returning * into cred;
  return case when cred.connection_id is null then '{}'::jsonb else to_jsonb(cred) end;
 elsif p_action='refresh_save' then
  update pos_private.square_credentials set encrypted=p_body->'encrypted',expires_at=(p_body->>'expiresAt')::timestamptz,version=version+1,refresh_lease=null,refresh_until=null
   where connection_id=(p_body->>'connectionId')::uuid and refresh_lease=(p_body->>'lease')::uuid and exists(select 1 from pos_private.square_connections c where c.id=connection_id and c.workspace_id=w and c.status='CONNECTED');return '{}';
 elsif p_action in ('health','disconnect','attention') then
  update pos_private.square_connections set status=case p_action when 'disconnect' then 'DISCONNECTED' when 'attention' then 'ATTENTION' else 'CONNECTED' end,last_validated_at=case when p_action='health' then now() else last_validated_at end where id=(p_body->>'connectionId')::uuid and workspace_id=w and status in ('CONNECTED','ATTENTION') returning * into c;
  if p_action='disconnect' then delete from pos_private.square_credentials where connection_id=c.id;end if;
  if p_action='health' and c.id is not null then
   update pos_private.square_connections set authorized_scopes=array(select jsonb_array_elements_text(coalesce(p_body->'scopes','[]'))) where id=c.id;
   update pos_private.square_locations set status='INACTIVE' where connection_id=c.id;
   for loc in select value from jsonb_array_elements(p_body->'locations') loop
    insert into pos_private.square_locations values(c.id,loc->>'id',loc->>'name',loc->>'status',loc->>'address') on conflict(connection_id,id) do update set name=excluded.name,status=excluded.status,address=excluded.address;
   end loop;
  end if;return '{}';
 elsif p_action='observe' then
  select * into p from public.pos_payment_attempts where id=(p_body->>'id')::uuid and workspace_id=w and provider='SQUARE';
  if p.id is null or p.amount_minor is distinct from (p_body->>'amountMinor')::bigint or p.currency is distinct from p_body->>'currency' or p.metadata->>'locationId' is distinct from p_body->>'locationId' or (p.provider_payment_id is not null and p.provider_payment_id is distinct from p_body->>'providerId') then raise exception 'POS_INVALID'; end if;
  if p_body->>'status' not in ('PENDING','AWAITING_CUSTOMER','PROCESSING','AUTHORIZED','SUCCEEDED','DECLINED','FAILED','CANCELED','UNKNOWN') then raise exception 'POS_INVALID'; end if;
  insert into pos_private.square_observations values(p.id,p_body->>'providerId',p_body->>'status',p_body->'metadata',now()) on conflict(payment_id) do update set provider_id=coalesce(square_observations.provider_id,excluded.provider_id),status=excluded.status,metadata=excluded.metadata,updated_at=now()
   where square_observations.status not in ('SUCCEEDED','DECLINED','FAILED','CANCELED') and not (square_observations.status='PROCESSING' and excluded.status in ('PENDING','AWAITING_CUSTOMER'));return '{}';
 elsif p_action='observe_refund' then
  select * into r from public.pos_payment_refund_attempts where id=(p_body->>'id')::uuid and workspace_id=w;
  select * into p from public.pos_payment_attempts where id=r.payment_id and provider='SQUARE';
  if p.id is null or r.amount_minor is distinct from (p_body->>'amountMinor')::bigint or p.currency is distinct from p_body->>'currency' or p.provider_payment_id is distinct from p_body->>'paymentId' or p_body->>'status' not in ('PENDING','UNKNOWN','SUCCEEDED','FAILED') then raise exception 'POS_INVALID'; end if;
  insert into pos_private.square_refund_observations values(r.id,p_body->>'providerId',p_body->>'status',now()) on conflict(refund_id) do update set provider_id=coalesce(square_refund_observations.provider_id,excluded.provider_id),status=excluded.status,updated_at=now() where square_refund_observations.status not in ('SUCCEEDED','FAILED');return '{}';
 elsif p_action='event' then
  insert into pos_private.square_events(event_id,merchant_id,event_type,resource_id) values(p_body->>'eventId',p_body->>'merchantId',p_body->>'type',p_body->>'resourceId') on conflict do nothing;
  select * into event from pos_private.square_events where event_id=p_body->>'eventId' for update;
  if event.merchant_id<>p_body->>'merchantId' or event.event_type<>p_body->>'type' then raise exception 'POS_INVALID';end if;
  if event.status='PROCESSED' then return jsonb_build_object('processed',true);end if;
  if event.event_type='oauth.authorization.revoked' then
   update pos_private.square_connections set status='REVOKED' where merchant_id=event.merchant_id and status in ('CONNECTED','ATTENTION');
   delete from pos_private.square_credentials where connection_id in(select id from pos_private.square_connections where merchant_id=event.merchant_id and status='REVOKED');
   update pos_private.square_events set status='PROCESSED',processed_at=now() where event_id=event.event_id;return jsonb_build_object('processed',true);
  end if;
  select a.* into p from public.pos_payment_attempts a join pos_private.square_connections c on c.id=a.provider_account_id::uuid where a.provider='SQUARE' and c.merchant_id=event.merchant_id and (a.provider_payment_id=event.resource_id or a.id::text=p_body->>'referenceId') limit 1;
  return jsonb_build_object('processed',false,'payment',case when p.id is not null then to_jsonb(p) end);
 elsif p_action='event_done' then
  update pos_private.square_events set status=case when coalesce((p_body->>'retry')::boolean,false) then 'RETRY' else 'PROCESSED' end,processed_at=case when coalesce((p_body->>'retry')::boolean,false) then null else now() end where event_id=p_body->>'eventId';return '{}';
 else raise exception 'POS_INVALID';end if;
 if c.id is null or (c.status<>'CONNECTED' and not (p_action='manage_credentials' and c.status='ATTENTION')) then raise exception 'UNAUTHORIZED_PROVIDER_ACCOUNT';end if;
 select * into cred from pos_private.square_credentials where connection_id=c.id;
 if cred.connection_id is null then raise exception 'UNAUTHORIZED_PROVIDER_ACCOUNT';end if;
 return coalesce(result,'{}')||jsonb_build_object('connection',to_jsonb(c),'credential',to_jsonb(cred));
end $$;

create or replace function pos_private.payment_command(w uuid,action text,body jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare p public.pos_payment_attempts%rowtype;c public.pos_payment_checkouts%rowtype;sess public.pos_register_sessions%rowtype;
 quote jsonb; intent jsonb; result jsonb; original_status text; observed text; outcome text; key_id uuid; event_key text; n integer; sq_id uuid;sq_location text;
begin
 if body is null or jsonb_typeof(body)<>'object' or octet_length(body::text)>32768 then raise exception 'POS_INVALID'; end if;
 perform pos_private.authorize(w,false,false);
 if action='capabilities' then return jsonb_build_object('mockEnabled',coalesce((select enabled from pos_private.payment_test_config),false),'terminals',pos_private.terminal_devices(w),'squareSites',(select coalesce(jsonb_agg(m.site_id),'[]') from pos_private.square_mappings m join pos_private.square_connections sqc on sqc.id=m.connection_id join pos_private.square_locations l on l.connection_id=m.connection_id and l.id=m.location_id where sqc.workspace_id=w and sqc.status='CONNECTED' and l.status='ACTIVE' and pos_private.site_access(w,m.site_id)));  end if;
 if action='list' then
 return (select coalesce(jsonb_agg(pos_private.payment_view(x.id)),'[]') from (select a.id from public.pos_payment_attempts a join public.pos_payment_checkouts ch on ch.id=a.checkout_id where a.workspace_id=w and (a.actor_id=auth.uid() or (pos_private.site_access(w,ch.site_id) and exists(select 1 from public.workspace_members where workspace_id=w and user_id=auth.uid() and role in ('owner','admin','manager')))) and (nullif(body->>'saleId','') is null or ch.sale_id=(body->>'saleId')::uuid) and (nullif(body->>'provider','') is null or a.provider=body->>'provider') and (nullif(body->>'status','') is null or a.status=body->>'status') order by a.created_at desc,a.id desc limit 100) x);
 end if;
 if action='create' then
  perform pos_private.authorize(w);
  key_id:=(body->>'key')::uuid;
  if key_id is null or body->>'provider' not in ('MOCK','EXTERNAL','SQUARE') then raise exception 'POS_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended('payment:'||w::text||auth.uid()::text||key_id::text,0));
  select * into p from public.pos_payment_attempts where workspace_id=w and actor_id=auth.uid() and idempotency_key=key_id;
  if p.id is not null then
   if p.request<>body-'key' then raise exception 'POS_IDEMPOTENCY_CONFLICT'; end if;
   return pos_private.payment_view(p.id);
  end if;
  if body->>'provider'='MOCK' and not (select enabled from pos_private.payment_test_config) then raise exception 'POS_MOCK_DISABLED'; end if;
  if body->>'provider'='MOCK' and coalesce(body->>'outcome','') not in ('APPROVE','DECLINE','CANCEL','TIMEOUT','DELAYED_SUCCESS','UNKNOWN_THEN_SUCCESS','UNKNOWN_THEN_DECLINE') then raise exception 'POS_INVALID'; end if;
  if body->>'provider'='EXTERNAL' and (length(trim(coalesce(body->>'reference',''))) not between 1 and 100 or coalesce(body->>'method','') not in ('external_terminal','check','other')) then raise exception 'POS_INVALID'; end if;
  intent:=body->'intent';
  select * into sess from public.pos_register_sessions where id=(intent->>'sessionId')::uuid and workspace_id=w and site_id=(intent->>'siteId')::uuid for update;
  if sess.id is null or sess.status<>'OPEN' then raise exception 'POS_SESSION_CLOSED'; end if;
  select * into c from public.pos_payment_checkouts where id=coalesce((body->>'checkoutId')::uuid,(intent->>'key')::uuid) and workspace_id=w for update;
  if c.id is not null then
   if c.actor_id<>auth.uid() or c.intent<>intent then raise exception 'POS_IDEMPOTENCY_CONFLICT'; end if;
   if c.state<>'PAYABLE' then raise exception 'POS_PAYMENT_ACTIVE'; end if;
  end if;
  quote:=pos_private.calculate(w,sess.site_id,intent);
  perform pos_private.payment_validate_stock(w,sess.site_id,quote);
  quote:=pos_private.calculate(w,sess.site_id,intent);
  if (quote->>'totalMinor')::bigint<1 or (intent->>'expectedMinor')::bigint is distinct from (quote->>'totalMinor')::bigint then raise exception 'POS_QUOTE_CHANGED'; end if;
  if ((quote->>'discountMinor')::bigint>0 and not pos_private.permission(w,'discount')) or (exists(select 1 from jsonb_array_elements(quote->'lines') where (value->>'overrideDifferenceMinor')::bigint<>0) and not pos_private.permission(w,'override')) then
   perform pos_private.approved(w,sess.site_id,'checkout',intent);
  end if;
  if c.id is null then
   insert into public.pos_payment_checkouts(id,workspace_id,site_id,register_id,session_id,actor_id,intent,snapshot,amount_minor)
    values((intent->>'key')::uuid,w,sess.site_id,sess.register_id,sess.id,auth.uid(),intent,quote,(quote->>'totalMinor')::bigint) returning * into c;
  elsif c.snapshot<>quote then raise exception 'POS_QUOTE_CHANGED'; end if;
  if body->>'provider'='SQUARE' then
   if (body-array['key','provider','intent','checkoutId','outcome','reference','method'])<>'{}'::jsonb
    or (intent-array['key','siteId','sessionId','expectedMinor','cashMinor','discountReason','cartDiscountMinor','cartDiscountBps','approvalId','lines'])<>'{}'::jsonb
    or exists(select 1 from jsonb_array_elements(intent->'lines') x where (x-array['itemId','ownerId','quantity','discountMinor','discountBps','overrideMinor','positionId','locationId'])<>'{}'::jsonb)
    then raise exception 'POS_INVALID';end if;
   select a.id,m.location_id into sq_id,sq_location from pos_private.square_connections a join pos_private.square_mappings m on m.connection_id=a.id join pos_private.square_locations l on l.connection_id=m.connection_id and l.id=m.location_id
    where a.workspace_id=w and a.status='CONNECTED' and a.environment='SANDBOX' and m.site_id=sess.site_id and l.status='ACTIVE';
   if sq_id is null then raise exception 'POS_SQUARE_UNAVAILABLE';end if;
   if body ? 'locationId' or body ? 'sourceId' then raise exception 'POS_INVALID';end if;
  end if;
  insert into public.pos_payment_attempts(workspace_id,checkout_id,actor_id,provider,amount_minor,currency,idempotency_key,request,provider_account_id,metadata)
   values(w,c.id,auth.uid(),body->>'provider',c.amount_minor,c.currency,key_id,body-'key',case when body->>'provider'='SQUARE' then sq_id::text end,case when body->>'provider'='SQUARE' then jsonb_build_object('environment','SANDBOX','locationId',sq_location,'verification','Square Sandbox') else '{}'::jsonb end) returning * into p;
  update public.pos_payment_checkouts set state='PAYING',updated_at=now() where id=c.id;
  perform pos_private.payment_audit(p.id,'attempt_created',null,'CREATED');
  return pos_private.payment_view(p.id);
 end if;
 select * into p from public.pos_payment_attempts where id=(body->>'id')::uuid and workspace_id=w;
 if p.id is null then raise exception 'POS_FORBIDDEN'; end if;
 perform pos_private.payment_authorize(w,p.checkout_id);
 if action='get' then return pos_private.payment_view(p.id); end if;
 -- Consistent order with register closing and canonical sale/refund commands.
 select ch.* into c from public.pos_payment_checkouts ch where ch.id=p.checkout_id;
 perform 1 from public.pos_register_sessions where id=c.session_id for update;
 select * into c from public.pos_payment_checkouts where id=p.checkout_id for update;
 select * into p from public.pos_payment_attempts where id=p.id for update;
 original_status:=p.status;
 if action in ('dispatch','provider_get','provider_cancel') then
  if action='dispatch' and p.status='CREATED' then
   perform pos_private.authorize(w);
   if c.actor_id<>auth.uid() then raise exception 'POS_FORBIDDEN'; end if;
   quote:=pos_private.calculate(w,c.site_id,c.intent);
   perform pos_private.payment_validate_stock(w,c.site_id,quote);
   quote:=pos_private.calculate(w,c.site_id,c.intent);
   if quote<>c.snapshot then raise exception 'POS_QUOTE_CHANGED'; end if;
  end if;

  if p.provider='SQUARE' then
   if action='dispatch' and p.status='CREATED' then update public.pos_payment_attempts set status='PENDING',updated_at=now() where id=p.id;end if;
   return pos_private.payment_view(p.id);
  elsif p.provider='MOCK' then
   if not (select enabled from pos_private.payment_test_config) then raise exception 'POS_MOCK_DISABLED'; end if;
   outcome:=p.request->>'outcome';
   if action='dispatch' then
    insert into pos_private.mock_payments values(p.id,outcome,case outcome when 'APPROVE' then 'SUCCEEDED' when 'DECLINE' then 'DECLINED' when 'CANCEL' then 'CANCELED' when 'TIMEOUT' then 'TIMED_OUT' when 'DELAYED_SUCCESS' then 'PROCESSING' else 'UNKNOWN' end,0,'mock_'||p.id::text) on conflict do nothing;
    if p.status='CREATED' then update public.pos_payment_attempts set status='PENDING',provider_payment_id='mock_'||p.id::text,updated_at=now() where id=p.id; perform pos_private.payment_audit(p.id,'provider_initiated',p.status,'PENDING'); end if;
   elsif action='provider_get' then
    update pos_private.mock_payments set polls=polls+1,status=case when polls>=1 and outcome in ('DELAYED_SUCCESS','UNKNOWN_THEN_SUCCESS') then 'SUCCEEDED' when polls>=1 and outcome='UNKNOWN_THEN_DECLINE' then 'DECLINED' else status end where payment_id=p.id and status in ('PROCESSING','UNKNOWN');
   else
    insert into pos_private.mock_payments values(p.id,outcome,'CANCELED',0,'mock_'||p.id::text) on conflict do nothing;
    update pos_private.mock_payments set status='CANCELED' where payment_id=p.id and status in ('PROCESSING','UNKNOWN','TIMED_OUT');
   end if;
  else
   if action='dispatch' and p.status='CREATED' then
    update public.pos_payment_attempts set status='SUCCEEDED',provider_payment_id=p.request->>'reference',metadata=jsonb_build_object('verification','Externally recorded','method',p.request->>'method'),completed_at=now(),updated_at=now() where id=p.id;
    update public.pos_payment_checkouts set state='FINALIZING' where id=c.id;
    perform pos_private.payment_audit(p.id,'externally_recorded',p.status,'SUCCEEDED');
   end if;
  end if;
  return pos_private.payment_view(p.id);
 elsif action='observe' then
  if p.provider='SQUARE' then
   select status into observed from pos_private.square_observations where payment_id=p.id;
   if observed is null then return pos_private.payment_view(p.id);end if;
  elsif p.provider='MOCK' then
   if not (select enabled from pos_private.payment_test_config) then raise exception 'POS_MOCK_DISABLED'; end if;
   select status into observed from pos_private.mock_payments where payment_id=p.id;
   if observed is null then raise exception 'POS_PAYMENT_UNCERTAIN'; end if;
  else observed:=p.status; end if;
  event_key:=coalesce(nullif(body->>'eventId',''),'poll:'||p.id::text||':'||observed);
  if length(event_key)>160 then raise exception 'POS_INVALID'; end if;
  insert into public.pos_payment_events(workspace_id,payment_id,provider,external_event_id,status,observed_status) values(w,p.id,p.provider,event_key,'RECEIVED',observed) on conflict do nothing;
  if exists(select 1 from public.pos_payment_events where workspace_id=w and provider=p.provider and external_event_id=event_key and payment_id<>p.id) then raise exception 'POS_IDEMPOTENCY_CONFLICT'; end if;
  if p.status in ('CREATED','PENDING','AWAITING_CUSTOMER','PROCESSING','AUTHORIZED','UNKNOWN','TIMED_OUT') then
   update public.pos_payment_attempts set status=observed,provider_payment_id=case when p.provider='SQUARE' then (select provider_id from pos_private.square_observations where payment_id=p.id) else provider_payment_id end,metadata=case when p.provider='SQUARE' then metadata||(select metadata from pos_private.square_observations where payment_id=p.id) when observed='SUCCEEDED' then jsonb_build_object('brand','Mock','last4','4242','verification','Simulated') else metadata end,completed_at=case when observed in ('SUCCEEDED','DECLINED','FAILED','CANCELED') then now() end,reconciled_at=now(),updated_at=now() where id=p.id;
   update public.pos_payment_checkouts set state=case when observed='SUCCEEDED' then 'FINALIZING' when observed in ('DECLINED','FAILED','CANCELED') then 'PAYABLE' else 'PAYING' end,updated_at=now() where id=c.id;
   perform pos_private.payment_audit(p.id,'reconciled',p.status,observed);
  end if;
  update public.pos_payment_events set status='PROCESSED',processed_at=now() where workspace_id=w and provider=p.provider and external_event_id=event_key;
  return pos_private.payment_view(p.id);
 elsif action='finalize' then
  if c.state='COMPLETED' then return pos_private.payment_view(p.id); end if;
  if p.status<>'SUCCEEDED' then raise exception 'POS_PAYMENT_UNCERTAIN'; end if;
  if c.actor_id<>auth.uid() then return pos_private.payment_view(p.id)||jsonb_build_object('failureCode','POS_ORIGINAL_ACTOR_REQUIRED'); end if;
  begin
   quote:=pos_private.calculate(w,c.site_id,c.intent);
   if quote<>c.snapshot then raise exception 'POS_QUOTE_CHANGED'; end if;
   insert into pos_private.payment_context values(txid_current(),pg_backend_pid(),auth.uid(),p.id,null);
   result:=pos_private.cash_command(w,'checkout',c.intent||jsonb_build_object('key',c.id,'cashMinor',c.amount_minor));
   delete from pos_private.payment_context where transaction_id=txid_current() and backend=pg_backend_pid();
   update public.pos_payment_checkouts set state='COMPLETED',sale_id=(result->>'saleId')::uuid,failure_code=null,updated_at=now() where id=c.id;
   perform pos_private.payment_audit(p.id,'sale_finalized',p.status,p.status);
  exception when others then
   update public.pos_payment_checkouts set state='RECOVERY_REQUIRED',failure_code=case when sqlerrm like 'POS_%' then split_part(sqlerrm,E'\n',1) else 'POS_FINALIZATION_FAILED' end,updated_at=now() where id=c.id;
   perform pos_private.payment_audit(p.id,'finalization_recovery_required',p.status,p.status);
  end;
  return pos_private.payment_view(p.id);
 end if;
 raise exception 'POS_INVALID';
end $$;

revoke all on all functions in schema pos_private from public,anon,authenticated;
