-- Phase 5: Sandbox only. Credentials and provider observations are service-only.
create table pos_private.square_connections(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id),
 merchant_id text not null,display_name text not null,country text,account_status text,
 environment text not null default 'SANDBOX' check(environment='SANDBOX'),
 status text not null check(status in ('CONNECTED','ATTENTION','REVOKED','DISCONNECTED','REPLACED')),
 connected_by uuid not null references auth.users(id),connected_at timestamptz not null default now(),last_validated_at timestamptz,
 unique(workspace_id,id)
);
create unique index square_one_connection on pos_private.square_connections(workspace_id) where status in ('CONNECTED','ATTENTION');
create index square_merchant on pos_private.square_connections(merchant_id);
create table pos_private.square_credentials(
 connection_id uuid primary key references pos_private.square_connections(id), encrypted jsonb not null,
 expires_at timestamptz not null,version integer not null default 1,refresh_lease uuid,refresh_until timestamptz
);
create table pos_private.square_oauth(
 state_hash text primary key, workspace_id uuid not null references public.workspaces(id),actor_id uuid not null references auth.users(id),
 expires_at timestamptz not null,consumed_at timestamptz,environment text not null check(environment='SANDBOX'),
 return_path text not null check(return_path='/dashboard/pos/payments')
);
create table pos_private.square_locations(
 connection_id uuid not null references pos_private.square_connections(id),id text not null,name text not null,status text not null,address text,
 primary key(connection_id,id)
);
create table pos_private.square_mappings(
 workspace_id uuid not null,site_id uuid not null,connection_id uuid not null,location_id text not null,
 primary key(connection_id,site_id),foreign key(workspace_id,site_id) references public.pos_store_locations(workspace_id,id),
 foreign key(workspace_id,connection_id) references pos_private.square_connections(workspace_id,id),
 foreign key(connection_id,location_id) references pos_private.square_locations(connection_id,id)
);
create table pos_private.square_observations(
 payment_id uuid primary key references public.pos_payment_attempts(id),provider_id text,status text not null,
 metadata jsonb not null default '{}',updated_at timestamptz not null default now()
);
create table pos_private.square_refund_observations(
 refund_id uuid primary key references public.pos_payment_refund_attempts(id),provider_id text,status text not null,updated_at timestamptz not null default now()
);
create table pos_private.square_events(
 event_id text primary key,merchant_id text not null,event_type text not null,resource_id text,
 status text not null default 'PENDING' check(status in ('PENDING','PROCESSED','RETRY')),
 received_at timestamptz not null default now(),processed_at timestamptz
);
alter table public.pos_payment_attempts drop constraint pos_payment_attempts_provider_check;
alter table public.pos_payment_attempts add constraint pos_payment_attempts_provider_check check(provider in ('MOCK','EXTERNAL','SQUARE'));
alter table public.pos_tenders drop constraint pos_tenders_method_check;
alter table public.pos_tenders add constraint pos_tenders_method_check check(method in ('cash','mock','external','square'));
do $$ declare t text; begin
 foreach t in array array['square_connections','square_credentials','square_oauth','square_locations','square_mappings','square_observations','square_refund_observations','square_events'] loop
 execute format('alter table pos_private.%I enable row level security',t);
 execute format('revoke all on pos_private.%I from public,anon,authenticated',t);
 end loop;
end $$;

create function pos_private.square_admin(w uuid,actor uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if actor is null or not exists(select 1 from public.workspace_members where workspace_id=w and user_id=actor and role in ('owner','admin')) then raise exception 'POS_FORBIDDEN'; end if;
end $$;
create function pos_private.square_settings(w uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('connections',(select coalesce(jsonb_agg(to_jsonb(c) order by c.connected_at desc),'[]') from pos_private.square_connections c where workspace_id=w),
 'locations',(select coalesce(jsonb_agg(to_jsonb(l)),'[]') from pos_private.square_locations l join pos_private.square_connections c on c.id=l.connection_id where c.workspace_id=w and c.status in ('CONNECTED','ATTENTION')),
 'mappings',(select coalesce(jsonb_agg(to_jsonb(m)),'[]') from pos_private.square_mappings m join pos_private.square_connections c on c.id=m.connection_id where c.workspace_id=w and c.status in ('CONNECTED','ATTENTION')),
 'sites',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name)),'[]') from public.pos_store_locations where workspace_id=w));
$$;
create function public.pos_square_settings(p_workspace_id uuid,p_action text,p_body jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare c pos_private.square_connections%rowtype;
begin
 perform pos_private.square_admin(p_workspace_id,auth.uid());
 if p_action='map' then
  select * into c from pos_private.square_connections where id=(p_body->>'connectionId')::uuid and workspace_id=p_workspace_id and status='CONNECTED' for update;
  if c.id is null or not exists(select 1 from public.pos_store_locations where workspace_id=p_workspace_id and id=(p_body->>'siteId')::uuid) then raise exception 'POS_FORBIDDEN'; end if;
  if nullif(p_body->>'locationId','') is null then delete from pos_private.square_mappings where connection_id=c.id and site_id=(p_body->>'siteId')::uuid;
  else
   if not exists(select 1 from pos_private.square_locations where connection_id=c.id and id=p_body->>'locationId' and status='ACTIVE') then raise exception 'CONFIGURATION_ERROR'; end if;
   insert into pos_private.square_mappings values(p_workspace_id,(p_body->>'siteId')::uuid,c.id,p_body->>'locationId') on conflict(connection_id,site_id) do update set location_id=excluded.location_id;
  end if;
 elsif p_action<>'get' then raise exception 'POS_INVALID'; end if;
 return pos_private.square_settings(p_workspace_id);
end $$;
revoke all on function public.pos_square_settings(uuid,text,jsonb) from public,anon;
grant execute on function public.pos_square_settings(uuid,text,jsonb) to authenticated;

-- Not a browser API: only the server service credential can execute this function.
-- It cannot finalize a sale or refund, mutate inventory, or impersonate an actor.
create function public.pos_square_service(p_action text,p_body jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare w uuid:=(p_body->>'workspaceId')::uuid;actor uuid:=(p_body->>'actorId')::uuid;
 c pos_private.square_connections%rowtype;cred pos_private.square_credentials%rowtype;flow pos_private.square_oauth%rowtype;
 p public.pos_payment_attempts%rowtype;r public.pos_payment_refund_attempts%rowtype;loc jsonb;result jsonb;event pos_private.square_events%rowtype;
begin
 if octet_length(p_body::text)>131072 then raise exception 'POS_INVALID'; end if;
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
   update pos_private.square_locations set status='INACTIVE' where connection_id=c.id;
   for loc in select value from jsonb_array_elements(p_body->'locations') loop
    insert into pos_private.square_locations values(c.id,loc->>'id',loc->>'name',loc->>'status',loc->>'address') on conflict(connection_id,id) do update set name=excluded.name,status=excluded.status,address=excluded.address;
   end loop;
  end if;return '{}';
 elsif p_action='observe' then
  select * into p from public.pos_payment_attempts where id=(p_body->>'id')::uuid and workspace_id=w and provider='SQUARE';
  if p.id is null or p.amount_minor is distinct from (p_body->>'amountMinor')::bigint or p.currency is distinct from p_body->>'currency' or p.metadata->>'locationId' is distinct from p_body->>'locationId' or (p.provider_payment_id is not null and p.provider_payment_id is distinct from p_body->>'providerId') then raise exception 'POS_INVALID'; end if;
  if p_body->>'status' not in ('PENDING','AUTHORIZED','SUCCEEDED','DECLINED','FAILED','CANCELED','UNKNOWN') then raise exception 'POS_INVALID'; end if;
  insert into pos_private.square_observations values(p.id,p_body->>'providerId',p_body->>'status',p_body->'metadata',now()) on conflict(payment_id) do update set provider_id=coalesce(square_observations.provider_id,excluded.provider_id),status=excluded.status,metadata=excluded.metadata,updated_at=now()
   where square_observations.status not in ('SUCCEEDED','DECLINED','FAILED','CANCELED');return '{}';
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
revoke all on function public.pos_square_service(text,jsonb) from public,anon,authenticated;
grant execute on function public.pos_square_service(text,jsonb) to service_role;
revoke all on all functions in schema pos_private from public,anon,authenticated;

-- Forward replacements extend the canonical engine; existing finalizers are unchanged.
create or replace function pos_private.payment_command(w uuid,action text,body jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare p public.pos_payment_attempts%rowtype;c public.pos_payment_checkouts%rowtype;sess public.pos_register_sessions%rowtype;
 quote jsonb; intent jsonb; result jsonb; original_status text; observed text; outcome text; key_id uuid; event_key text; n integer; sq_id uuid;sq_location text;
begin
 if body is null or jsonb_typeof(body)<>'object' or octet_length(body::text)>32768 then raise exception 'POS_INVALID'; end if;
 perform pos_private.authorize(w,false,false);
 if action='capabilities' then return jsonb_build_object('mockEnabled',coalesce((select enabled from pos_private.payment_test_config),false),'squareSites',(select coalesce(jsonb_agg(m.site_id),'[]') from pos_private.square_mappings m join pos_private.square_connections sqc on sqc.id=m.connection_id join pos_private.square_locations l on l.connection_id=m.connection_id and l.id=m.location_id where sqc.workspace_id=w and sqc.status='CONNECTED' and l.status='ACTIVE' and pos_private.site_access(w,m.site_id)));  end if;
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
create or replace function pos_private.payment_refund_command(w uuid,action text,body jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare p public.pos_payment_attempts%rowtype;c public.pos_payment_checkouts%rowtype;r public.pos_payment_refund_attempts%rowtype;amount bigint;quote jsonb;result jsonb;outcome text;observed text;total bigint;intent jsonb;
begin
 perform pos_private.authorize(w,false,false);
 if not pos_private.permission(w,'refund') then raise exception 'POS_FORBIDDEN'; end if;
 if jsonb_typeof(body)<>'object' or octet_length(body::text)>32768 then raise exception 'POS_INVALID'; end if;
 if action='create' then
  if body->>'key' is null then raise exception 'POS_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended('payment-refund:'||w::text||auth.uid()::text||(body->>'key'),0));
  select * into r from public.pos_payment_refund_attempts where workspace_id=w and actor_id=auth.uid() and idempotency_key=(body->>'key')::uuid;
  if r.id is not null then
   if r.intent<>body->'intent' or r.payment_id<>(body->>'paymentId')::uuid then raise exception 'POS_IDEMPOTENCY_CONFLICT'; end if;
   return to_jsonb(r);
  end if;
  select * into p from public.pos_payment_attempts where id=(body->>'paymentId')::uuid and workspace_id=w;
 else
  select * into r from public.pos_payment_refund_attempts where id=(body->>'id')::uuid and workspace_id=w;
  select * into p from public.pos_payment_attempts where id=r.payment_id and workspace_id=w;
 end if;
 if p.id is null then raise exception 'POS_FORBIDDEN'; end if;
 perform pos_private.payment_authorize(w,p.checkout_id);
 select * into c from public.pos_payment_checkouts where id=p.checkout_id;
 -- Processing session first, then checkout/payment, then original sale/stock.
 intent:=case when action='create' then body->'intent' else r.intent end;
 if c.sale_id is not null then perform 1 from public.pos_register_sessions where workspace_id=w and id=(intent->>'sessionId')::uuid for update; end if;
 perform 1 from public.pos_register_sessions where id=c.session_id for update;
 select * into c from public.pos_payment_checkouts where id=c.id for update;
 select * into p from public.pos_payment_attempts where id=p.id for update;
 if action='create' then
  if p.status not in ('SUCCEEDED','PARTIALLY_REFUNDED') then raise exception 'POS_PAYMENT_UNCERTAIN'; end if;
  if exists(select 1 from public.pos_payment_refund_attempts where payment_id=p.id and (status in ('CREATED','PENDING','UNKNOWN') or recovery_required)) then raise exception 'POS_PAYMENT_ACTIVE'; end if;
  if c.sale_id is null then
   perform pos_private.payment_authorize(w,c.id,true);
   if c.state not in ('RECOVERY_REQUIRED','FINALIZING') or length(trim(coalesce(intent->>'reason',''))) not between 1 and 500 then raise exception 'POS_INVALID'; end if;
   amount:=p.amount_minor;
  else
   if intent->>'saleId' is distinct from c.sale_id::text then raise exception 'POS_FORBIDDEN'; end if;
   quote:=pos_private.payment_refund_quote(w,intent);amount:=(quote->>'totalMinor')::bigint;
  end if;
  select coalesce(sum(amount_minor),0) into total from public.pos_payment_refund_attempts where payment_id=p.id and status<>'FAILED';
  if amount<1 or amount+total>p.amount_minor then raise exception 'POS_REFUND_EXCEEDED'; end if;
  if coalesce(intent->>'mockOutcome','REFUND_SUCCESS') not in ('REFUND_SUCCESS','REFUND_FAIL','REFUND_UNKNOWN_THEN_SUCCESS') then raise exception 'POS_INVALID'; end if;
  insert into public.pos_payment_refund_attempts(workspace_id,payment_id,actor_id,idempotency_key,intent,amount_minor) values(w,p.id,auth.uid(),(body->>'key')::uuid,intent,amount) returning * into r;
  perform pos_private.payment_audit(p.id,'refund_requested',p.status,p.status);
  return to_jsonb(r);
 end if;
 select * into r from public.pos_payment_refund_attempts where id=r.id for update;
 if action='get' then return to_jsonb(r); end if;
 if action in ('dispatch','reconcile') then
  if p.provider='SQUARE' then
   select status into observed from pos_private.square_refund_observations where refund_id=r.id;
   if observed is null then return to_jsonb(r);end if;
  elsif p.provider='MOCK' then
   if not (select enabled from pos_private.payment_test_config) then raise exception 'POS_MOCK_DISABLED'; end if;
   outcome:=coalesce(r.intent->>'mockOutcome','REFUND_SUCCESS');
   insert into pos_private.mock_refunds values(r.id,outcome,case outcome when 'REFUND_FAIL' then 'FAILED' when 'REFUND_UNKNOWN_THEN_SUCCESS' then 'UNKNOWN' else 'SUCCEEDED' end,'mock_refund_'||r.id::text) on conflict do nothing;
   if action='reconcile' then update pos_private.mock_refunds set status='SUCCEEDED' where refund_id=r.id and status='UNKNOWN'; end if;
   select status into observed from pos_private.mock_refunds where refund_id=r.id;
  else observed:='SUCCEEDED'; end if;
  if r.status not in ('SUCCEEDED','FAILED') then
   update public.pos_payment_refund_attempts set status=observed,provider_refund_id=case when p.provider='SQUARE' then (select provider_id from pos_private.square_refund_observations where refund_id=r.id) when p.provider='MOCK' then 'mock_refund_'||r.id::text else 'external_refund_'||r.id::text end,recovery_required=observed='SUCCEEDED',updated_at=now() where id=r.id returning * into r;
   perform pos_private.payment_audit(p.id,'refund_provider_'||lower(observed),p.status,p.status);
  end if;
  return to_jsonb(r);
 elsif action='finalize' then
  if r.status<>'SUCCEEDED' then return to_jsonb(r); end if;
  if r.refund_id is not null or not r.recovery_required then return to_jsonb(r); end if;
  if r.actor_id<>auth.uid() then raise exception 'POS_FORBIDDEN'; end if;
  begin
   if c.sale_id is null then
    update public.pos_payment_checkouts set state='VOIDED',failure_code=null,updated_at=now() where id=c.id;
   else
    insert into pos_private.payment_context values(txid_current(),pg_backend_pid(),auth.uid(),p.id,r.id);
    result:=pos_private.refund(w,r.intent);
    delete from pos_private.payment_context where transaction_id=txid_current() and backend=pg_backend_pid();
    update public.pos_payment_refund_attempts set refund_id=(result->>'id')::uuid where id=r.id;
   end if;
   update public.pos_payment_refund_attempts set recovery_required=false,failure_code=null,updated_at=now() where id=r.id;
   select coalesce(sum(amount_minor),0) into total from public.pos_payment_refund_attempts where payment_id=p.id and status='SUCCEEDED';
   update public.pos_payment_attempts set status=case when total=p.amount_minor then 'REFUNDED' else 'PARTIALLY_REFUNDED' end,updated_at=now() where id=p.id;
   perform pos_private.payment_audit(p.id,'refund_completed',p.status,case when total=p.amount_minor then 'REFUNDED' else 'PARTIALLY_REFUNDED' end);
  exception when others then
   update public.pos_payment_refund_attempts set recovery_required=true,failure_code=case when sqlerrm like 'POS_%' then split_part(sqlerrm,E'\n',1) else 'POS_FINALIZATION_FAILED' end,updated_at=now() where id=r.id;
  end;
  select * into r from public.pos_payment_refund_attempts where id=r.id;
  return to_jsonb(r);
 end if;
 raise exception 'POS_INVALID';
end $$;
revoke all on all functions in schema pos_private from public,anon,authenticated;

create or replace function pos_private.read_operations(w uuid,action text,body jsonb) returns jsonb
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
   select s.id,s.receipt_number,s.created_at,s.total_minor,s.subtotal_minor,s.discount_minor,s.tax_minor,s.register_id,s.actor_id,l.name as site_name,l.timezone,(select string_agg(distinct t.method,', ' order by t.method) from public.pos_tenders t where t.sale_id=s.id) as payment_methods,
    coalesce((select sum(r.total_minor) from public.pos_refunds r where r.sale_id=s.id),0) as refunded_minor
   from public.pos_sales s join public.pos_store_locations l on l.id=s.site_id
   where s.workspace_id=w and (s.actor_id=auth.uid() or (manager and pos_private.site_access(w,s.site_id)))
    and (nullif(body->>'siteId','') is null or s.site_id=(body->>'siteId')::uuid)
    and (nullif(body->>'registerId','') is null or s.register_id=(body->>'registerId')::uuid)
    and (nullif(body->>'actorId','') is null or s.actor_id=(body->>'actorId')::uuid)
    and (nullif(body->>'payment','') is null or exists(select 1 from public.pos_tenders t where t.sale_id=s.id and t.method=body->>'payment'))
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
   select s.id,s.site_id,s.register_id,r.name as register_name,l.name as site_name,l.timezone,(select string_agg(distinct t.method,', ' order by t.method) from public.pos_tenders t where t.sale_id=s.id) as payment_methods,s.status,s.opened_at,s.closed_at,s.actor_id,s.closed_by,s.close_notes,
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
   'squareSalesMinor',(select coalesce(sum(t.amount_minor),0) from public.pos_tenders t join public.pos_sales s on s.id=t.sale_id where s.workspace_id=w and s.site_id=site.id and t.method='square' and s.created_at>=start_at and s.created_at<end_at),
   'squareRefundsMinor',(select coalesce(sum(r.total_minor),0) from public.pos_refunds r where r.workspace_id=w and r.site_id=site.id and r.created_at>=start_at and r.created_at<end_at and exists(select 1 from public.pos_tenders t where t.sale_id=r.sale_id and t.method='square')),
   'cashNetMinor',(select coalesce(sum(amount_minor),0) from public.pos_cash_events where workspace_id=w and site_id=site.id and kind in ('CASH_SALE','CASH_REFUND') and created_at>=start_at and created_at<end_at),
   'noncashMinor',(select coalesce(sum(t.amount_minor),0) from public.pos_tenders t join public.pos_sales s on s.id=t.sale_id where s.workspace_id=w and s.site_id=site.id and t.method<>'cash' and s.created_at>=start_at and s.created_at<end_at)-(select coalesce(sum(r.total_minor),0) from public.pos_refunds r where r.workspace_id=w and r.site_id=site.id and r.created_at>=start_at and r.created_at<end_at and exists(select 1 from public.pos_tenders t where t.sale_id=r.sale_id and t.method<>'cash')),
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
revoke all on all functions in schema pos_private from public,anon,authenticated;
