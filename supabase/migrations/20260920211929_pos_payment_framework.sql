-- Forward-only payment orchestration; no live processor or credentials.
create table pos_private.payment_test_config(singleton boolean primary key default true check(singleton), enabled boolean not null default false);
insert into pos_private.payment_test_config values(true,false);
create table public.pos_payment_checkouts(
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, site_id uuid not null, register_id uuid not null, session_id uuid not null,
 actor_id uuid not null references auth.users(id), intent jsonb not null, snapshot jsonb not null,
 amount_minor bigint not null check(amount_minor between 1 and 100000000000), currency text not null default 'USD' check(currency='USD'),
 state text not null default 'PAYABLE' check(state in ('PAYABLE','PAYING','FINALIZING','COMPLETED','RECOVERY_REQUIRED','VOIDED')),
 sale_id uuid, failure_code text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(workspace_id,site_id,register_id,session_id) references public.pos_register_sessions(workspace_id,site_id,register_id,id),
 foreign key(workspace_id,sale_id) references public.pos_sales(workspace_id,id), unique(workspace_id,id), unique(sale_id)
);
create table public.pos_payment_attempts(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null, checkout_id uuid not null, actor_id uuid not null references auth.users(id),
 provider text not null check(provider in ('MOCK','EXTERNAL')), provider_account_id text, provider_payment_id text,
 amount_minor bigint not null check(amount_minor>0), currency text not null check(currency='USD'),
 status text not null default 'CREATED' check(status in ('CREATED','PENDING','AWAITING_CUSTOMER','PROCESSING','AUTHORIZED','SUCCEEDED','DECLINED','FAILED','CANCELED','TIMED_OUT','UNKNOWN','REFUND_PENDING','PARTIALLY_REFUNDED','REFUNDED')),
 idempotency_key uuid not null, request jsonb not null, metadata jsonb not null default '{}', failure_code text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),completed_at timestamptz,reconciled_at timestamptz,
 foreign key(workspace_id,checkout_id) references public.pos_payment_checkouts(workspace_id,id),unique(workspace_id,id),unique(workspace_id,actor_id,idempotency_key),
 unique(workspace_id,provider,provider_payment_id)
);
create unique index pos_payment_one_active on public.pos_payment_attempts(checkout_id) where status not in ('DECLINED','FAILED','CANCELED');
create index pos_payment_history on public.pos_payment_attempts(workspace_id,created_at desc,id);
create index pos_payment_session on public.pos_payment_checkouts(session_id,state);
create table public.pos_payment_refund_attempts(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,payment_id uuid not null,actor_id uuid not null references auth.users(id),
 idempotency_key uuid not null,intent jsonb not null,amount_minor bigint not null check(amount_minor>0),
 status text not null default 'CREATED' check(status in ('CREATED','PENDING','UNKNOWN','SUCCEEDED','FAILED')),
 provider_refund_id text, refund_id uuid references public.pos_refunds(id), recovery_required boolean not null default false,
 failure_code text, created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(workspace_id,payment_id) references public.pos_payment_attempts(workspace_id,id),unique(workspace_id,actor_id,idempotency_key),unique(refund_id)
);
create index pos_payment_refunds_payment on public.pos_payment_refund_attempts(payment_id,status);
create table public.pos_payment_events(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,payment_id uuid not null,provider text not null,external_event_id text not null,
 status text not null check(status in ('RECEIVED','PROCESSED','RETRY')),observed_status text,received_at timestamptz not null default now(),processed_at timestamptz,
 foreign key(workspace_id,payment_id) references public.pos_payment_attempts(workspace_id,id),unique(workspace_id,provider,external_event_id)
);
create table public.pos_payment_audit(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,payment_id uuid not null,actor_id uuid not null references auth.users(id),
 action text not null,previous_status text,next_status text,created_at timestamptz not null default now(),
 foreign key(workspace_id,payment_id) references public.pos_payment_attempts(workspace_id,id)
);
create index pos_payment_audit_payment on public.pos_payment_audit(payment_id,created_at);
-- A separate deterministic simulated provider ledger. No client writes or observations accepted.
create table pos_private.mock_payments(payment_id uuid primary key references public.pos_payment_attempts(id),outcome text not null,status text not null,polls integer not null default 0,external_id text not null unique);
create table pos_private.mock_refunds(refund_id uuid primary key references public.pos_payment_refund_attempts(id),outcome text not null,status text not null,external_id text not null unique);
create table pos_private.payment_context(transaction_id bigint not null,backend integer not null,actor_id uuid not null,payment_id uuid not null,refund_attempt_id uuid,primary key(transaction_id,backend));
alter table public.pos_tenders drop constraint pos_tenders_method_check;
alter table public.pos_tenders add constraint pos_tenders_method_check check(method in ('cash','mock','external'));
alter table public.pos_tenders drop constraint pos_tenders_verification_check;
alter table public.pos_tenders add constraint pos_tenders_verification_check check(verification in ('recorded','simulated','externally_recorded'));
alter table public.pos_tenders add column payment_attempt_id uuid references public.pos_payment_attempts(id),add column provider_reference text,add column metadata jsonb not null default '{}';
create unique index pos_tender_attempt on public.pos_tenders(payment_attempt_id) where payment_attempt_id is not null;
-- No uniqueness on sale_id: multiple tenders remain supported by the schema.
do $$ declare t text; begin
 foreach t in array array['pos_payment_checkouts','pos_payment_attempts','pos_payment_refund_attempts','pos_payment_events','pos_payment_audit'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 end loop;
 foreach t in array array['payment_test_config','mock_payments','mock_refunds','payment_context'] loop
 execute format('alter table pos_private.%I enable row level security',t);
 execute format('revoke all on pos_private.%I from public,anon,authenticated',t);
 end loop;
end $$;
create trigger pos_payment_audit_immutable before update or delete on public.pos_payment_audit for each row execute function pos_private.immutable();

create function pos_private.payment_transition() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'POS_IMMUTABLE'; end if;
 if tg_table_name='pos_payment_checkouts' then
  if (to_jsonb(new)-array['state','sale_id','failure_code','updated_at'])<>(to_jsonb(old)-array['state','sale_id','failure_code','updated_at']) then raise exception 'POS_IMMUTABLE'; end if;
  if old.state<>new.state and not ((old.state='PAYABLE' and new.state='PAYING') or (old.state='PAYING' and new.state in ('PAYABLE','FINALIZING')) or (old.state in ('FINALIZING','RECOVERY_REQUIRED') and new.state in ('COMPLETED','RECOVERY_REQUIRED','VOIDED'))) then raise exception 'POS_PAYMENT_TRANSITION'; end if;
  if old.state in ('COMPLETED','VOIDED') and new is distinct from old then raise exception 'POS_PAYMENT_TRANSITION'; end if;
 elsif tg_table_name='pos_payment_attempts' then
  if (to_jsonb(new)-array['status','provider_payment_id','metadata','failure_code','updated_at','completed_at','reconciled_at'])<>(to_jsonb(old)-array['status','provider_payment_id','metadata','failure_code','updated_at','completed_at','reconciled_at']) then raise exception 'POS_IMMUTABLE'; end if;
  if old.status<>new.status and not (
   (old.status in ('CREATED','PENDING','AWAITING_CUSTOMER','PROCESSING','AUTHORIZED','TIMED_OUT','UNKNOWN') and new.status in ('PENDING','AWAITING_CUSTOMER','PROCESSING','AUTHORIZED','SUCCEEDED','DECLINED','FAILED','CANCELED','TIMED_OUT','UNKNOWN')) or
   (old.status in ('SUCCEEDED','PARTIALLY_REFUNDED','REFUND_PENDING') and new.status in ('REFUND_PENDING','PARTIALLY_REFUNDED','REFUNDED','SUCCEEDED'))
  ) then raise exception 'POS_PAYMENT_TRANSITION'; end if;
 elsif tg_table_name='pos_payment_refund_attempts' then
  if (to_jsonb(new)-array['status','provider_refund_id','refund_id','recovery_required','failure_code','updated_at'])<>(to_jsonb(old)-array['status','provider_refund_id','refund_id','recovery_required','failure_code','updated_at']) then raise exception 'POS_IMMUTABLE'; end if;
  if old.status in ('SUCCEEDED','FAILED') and old.status<>new.status then raise exception 'POS_PAYMENT_TRANSITION'; end if;
 end if;
 return new;
end $$;
create trigger pos_payment_checkout_guard before update or delete on public.pos_payment_checkouts for each row execute function pos_private.payment_transition();
create trigger pos_payment_attempt_guard before update or delete on public.pos_payment_attempts for each row execute function pos_private.payment_transition();
create trigger pos_payment_refund_guard before update or delete on public.pos_payment_refund_attempts for each row execute function pos_private.payment_transition();
create function pos_private.payment_authorize(w uuid,checkout uuid,manage boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare c public.pos_payment_checkouts%rowtype; begin
 perform pos_private.authorize(w,manage,false);
 select * into c from public.pos_payment_checkouts where workspace_id=w and id=checkout;
 if c.id is null or (c.actor_id<>auth.uid() and not (pos_private.site_access(w,c.site_id) and exists(select 1 from public.workspace_members where workspace_id=w and user_id=auth.uid() and role in ('owner','admin','manager')))) then raise exception 'POS_FORBIDDEN'; end if;
 -- Historical actor/manager access survives grant revocation; stock mutations still reauthorize.
end $$;
create function pos_private.payment_view(payment uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',p.id,'checkoutId',c.id,'provider',p.provider,'status',p.status,'amountMinor',p.amount_minor,'currency',p.currency,'providerReference',p.provider_payment_id,'metadata',p.metadata,'createdAt',p.created_at,'completedAt',p.completed_at,'reconciledAt',p.reconciled_at,'saleState',c.state,'saleId',c.sale_id,'failureCode',coalesce(c.failure_code,p.failure_code),'receipt',s.receipt,
 'refunds',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'status',r.status,'amountMinor',r.amount_minor,'refundId',r.refund_id,'recoveryRequired',r.recovery_required,'failureCode',r.failure_code) order by r.created_at),'[]') from public.pos_payment_refund_attempts r where r.payment_id=p.id))
 from public.pos_payment_attempts p join public.pos_payment_checkouts c on c.id=p.checkout_id left join public.pos_sales s on s.id=c.sale_id where p.id=payment
$$;
create function pos_private.payment_audit(payment uuid,action text,previous text,next text) returns void language sql security definer set search_path='' as $$
 insert into public.pos_payment_audit(workspace_id,payment_id,actor_id,action,previous_status,next_status) select workspace_id,id,auth.uid(),action,previous,next from public.pos_payment_attempts where id=payment
$$;
create function pos_private.payment_close_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status<>old.status and new.status in ('CLOSING','CLOSED') and (exists(select 1 from public.pos_payment_checkouts c where c.session_id=old.id and c.state in ('PAYING','FINALIZING','RECOVERY_REQUIRED')) or exists(select 1 from public.pos_payment_refund_attempts r where r.intent->>'sessionId'=old.id::text and (r.status in ('CREATED','PENDING','UNKNOWN') or r.recovery_required))) then raise exception 'POS_PAYMENT_ACTIVE'; end if;
 return new;
end $$;
create trigger pos_payment_session_guard before update on public.pos_register_sessions for each row execute function pos_private.payment_close_guard();


create function pos_private.payment_validate_stock(w uuid,site uuid,quote jsonb) returns void language plpgsql security definer set search_path='' as $$
declare grouped record; inv public.inventory_items%rowtype; line jsonb; reserved bigint; available bigint;
begin
 for grouped in select (value->>'ownerId')::uuid as owner_id,value->>'itemId' as item_id,sum((value->>'quantity')::integer) as quantity from jsonb_array_elements(quote->'lines') group by 1,2 order by 1,2 loop
  perform pos_private.lock_authority(w,site,grouped.owner_id,'sell');
  select * into inv from public.inventory_items where user_id=grouped.owner_id and id=grouped.item_id and workspace_id=w for update;
  select coalesce(sum(quantity),0) into reserved from public.selling_inventory_allocations where user_id=grouped.owner_id and inventory_item_id=grouped.item_id and status in ('ALLOCATED','RESERVED');
  if inv.id is null or inv.quantity-reserved<grouped.quantity then raise exception 'POS_STOCK_UNAVAILABLE'; end if;
 end loop;
 if (select count(distinct (value->>'ownerId',value->>'itemId',coalesce(value->>'positionId',''))) from jsonb_array_elements(quote->'lines'))<>jsonb_array_length(quote->'lines') then raise exception 'POS_INVALID'; end if;
 for line in select value from jsonb_array_elements(quote->'lines') where nullif(value->>'positionId','') is not null loop
  select p.quantity-coalesce((select sum(a.quantity) from public.selling_inventory_allocations a where a.user_id=p.user_id and a.inventory_item_id=p.item_id and (a.inventory_position_id is null or a.inventory_position_id=p.id) and a.status in ('ALLOCATED','RESERVED')),0) into available
  from public.chaos_sort_inventory_positions p where p.user_id=(line->>'ownerId')::uuid and p.item_id=line->>'itemId' and p.id=line->>'positionId' and p.location_id=line->>'locationId' and p.status<>'retired' for update;
  if available is null or available<(line->>'quantity')::integer then raise exception 'POS_STOCK_UNAVAILABLE'; end if;
 end loop;
end $$;

create function pos_private.payment_command(w uuid,action text,body jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare p public.pos_payment_attempts%rowtype;c public.pos_payment_checkouts%rowtype;sess public.pos_register_sessions%rowtype;
 quote jsonb; intent jsonb; result jsonb; original_status text; observed text; outcome text; key_id uuid; event_key text; n integer;
begin
 if body is null or jsonb_typeof(body)<>'object' or octet_length(body::text)>32768 then raise exception 'POS_INVALID'; end if;
 perform pos_private.authorize(w,false,false);
 if action='capabilities' then return jsonb_build_object('mockEnabled',coalesce((select enabled from pos_private.payment_test_config),false)); end if;
 if action='list' then
 return (select coalesce(jsonb_agg(pos_private.payment_view(x.id)),'[]') from (select a.id from public.pos_payment_attempts a join public.pos_payment_checkouts ch on ch.id=a.checkout_id where a.workspace_id=w and (a.actor_id=auth.uid() or (pos_private.site_access(w,ch.site_id) and exists(select 1 from public.workspace_members where workspace_id=w and user_id=auth.uid() and role in ('owner','admin','manager')))) and (nullif(body->>'saleId','') is null or ch.sale_id=(body->>'saleId')::uuid) and (nullif(body->>'provider','') is null or a.provider=body->>'provider') and (nullif(body->>'status','') is null or a.status=body->>'status') order by a.created_at desc,a.id desc limit 100) x);
 end if;
 if action='create' then
  perform pos_private.authorize(w);
  key_id:=(body->>'key')::uuid;
  if key_id is null or body->>'provider' not in ('MOCK','EXTERNAL') then raise exception 'POS_INVALID'; end if;
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
  insert into public.pos_payment_attempts(workspace_id,checkout_id,actor_id,provider,amount_minor,currency,idempotency_key,request)
   values(w,c.id,auth.uid(),body->>'provider',c.amount_minor,c.currency,key_id,body-'key') returning * into p;
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

  if p.provider='MOCK' then
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
  if p.provider='MOCK' then
   if not (select enabled from pos_private.payment_test_config) then raise exception 'POS_MOCK_DISABLED'; end if;
   select status into observed from pos_private.mock_payments where payment_id=p.id;
   if observed is null then raise exception 'POS_PAYMENT_UNCERTAIN'; end if;
  else observed:=p.status; end if;
  event_key:=coalesce(nullif(body->>'eventId',''),'poll:'||p.id::text||':'||observed);
  if length(event_key)>160 then raise exception 'POS_INVALID'; end if;
  insert into public.pos_payment_events(workspace_id,payment_id,provider,external_event_id,status,observed_status) values(w,p.id,p.provider,event_key,'RECEIVED',observed) on conflict do nothing;
  if exists(select 1 from public.pos_payment_events where workspace_id=w and provider=p.provider and external_event_id=event_key and payment_id<>p.id) then raise exception 'POS_IDEMPOTENCY_CONFLICT'; end if;
  if p.status in ('CREATED','PENDING','AWAITING_CUSTOMER','PROCESSING','AUTHORIZED','UNKNOWN','TIMED_OUT') then
   update public.pos_payment_attempts set status=observed,metadata=case when observed='SUCCEEDED' then jsonb_build_object('brand','Mock','last4','4242','verification','Simulated') else metadata end,completed_at=case when observed in ('SUCCEEDED','DECLINED','FAILED','CANCELED') then now() end,reconciled_at=now(),updated_at=now() where id=p.id;
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
create function public.pos_payment_command(p_workspace_id uuid,p_action text,p_body jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$ select pos_private.payment_command(p_workspace_id,p_action,p_body) $$;
revoke all on function public.pos_payment_command(uuid,text,jsonb) from public,anon;
grant execute on function public.pos_payment_command(uuid,text,jsonb) to authenticated;
-- Public wrapper uses the same narrow definer boundary as the established POS RPC.
alter function public.pos_payment_command(uuid,text,jsonb) security definer;

create or replace function pos_private.cash_command(w uuid, action text, body jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  payment public.pos_payment_attempts%rowtype;
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

  select a.* into payment from pos_private.payment_context x join public.pos_payment_attempts a on a.id=x.payment_id where x.transaction_id=txid_current() and x.backend=pg_backend_pid() and x.actor_id=auth.uid() and x.refund_attempt_id is null and a.workspace_id=w and a.status='SUCCEEDED';
  key_id := (body->>'key')::uuid;
  if key_id is null then raise exception 'POS_INVALID'; end if;
  if payment.id is null and exists(select 1 from public.pos_payment_checkouts where workspace_id=w and id=key_id and state<>'VOIDED') then raise exception 'POS_PAYMENT_ACTIVE'; end if;
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
  if payment.id is not null and result<>(select snapshot from public.pos_payment_checkouts where id=payment.checkout_id) then raise exception 'POS_QUOTE_CHANGED'; end if;
  lines:=result->'lines'; sub:=(result->>'subtotalMinor')::bigint; disc:=(result->>'discountMinor')::bigint; tax:=(result->>'taxMinor')::bigint;
  if (disc>0 and not pos_private.permission(w,'discount')) or (exists(select 1 from jsonb_array_elements(lines) where (value->>'overrideDifferenceMinor')::bigint<>0) and not pos_private.permission(w,'override')) then
    if payment.id is null then perform pos_private.approved(w,site.id,'checkout',body); end if;
  end if;
  if expected<>sub-disc+tax then raise exception 'POS_QUOTE_CHANGED'; end if;
  if received<sub-disc+tax then raise exception 'POS_CASH_INSUFFICIENT'; end if;
  v_sale_id:=gen_random_uuid();
  code:='TD-'||upper(replace(v_sale_id::text,'-',''));
  select name into loc from public.pos_registers where id=sess.register_id;
  receipt:=jsonb_build_object('version',2,'settings',site.settings,'timezone',site.timezone,'employeeName',coalesce((select e.full_name from public.workspace_employees e where e.workspace_id=w and e.linked_user_id=actor limit 1),(select coalesce(to_jsonb(p)->>'full_name',to_jsonb(p)->>'display_name') from public.profiles p where p.id=actor),'Operator'),'number',code,'site',site.name,'register',loc,'actorId',actor,'createdAt',now(),'currency','USD','lines',(select jsonb_agg(value-array['costBasis','inventoryValueUnit']) from jsonb_array_elements(lines)),'subtotalMinor',sub,'discountMinor',disc,'taxMinor',tax,'totalMinor',sub-disc+tax,'cashMinor',received,'changeMinor',received-(sub-disc+tax),'discountReason',body->>'discountReason');
  if payment.id is not null then receipt:=receipt||jsonb_build_object('payment',jsonb_build_object('provider',payment.provider,'status',payment.status,'reference',payment.provider_payment_id,'metadata',payment.metadata),'cashMinor',0,'changeMinor',0); end if;
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
  insert into public.pos_tenders(workspace_id,sale_id,method,verification,amount_minor,received_minor,change_minor,payment_attempt_id,provider_reference,metadata) values(w,v_sale_id,coalesce(lower(payment.provider),'cash'),case payment.provider when 'MOCK' then 'simulated' when 'EXTERNAL' then 'externally_recorded' else 'recorded' end,sub-disc+tax,received,received-(sub-disc+tax),payment.id,payment.provider_payment_id,coalesce(payment.metadata,'{}'));
  return jsonb_build_object('status','completed','saleId',v_sale_id,'receipt',receipt,'replayed',false);
end $$;



create or replace function pos_private.record_sale_cash() returns trigger language plpgsql security definer set search_path='' as $$
declare sale public.pos_sales%rowtype;
begin
 if new.method<>'cash' then return new; end if;
 select * into sale from public.pos_sales where id=new.sale_id;
 insert into public.pos_cash_events(workspace_id,site_id,register_id,session_id,actor_id,kind,amount_minor,reference_id) values(sale.workspace_id,sale.site_id,sale.register_id,sale.session_id,sale.actor_id,'CASH_SALE',new.amount_minor,new.id);
 return new;
end $$;
revoke all on all functions in schema pos_private from public,anon,authenticated;

create function pos_private.payment_refund_quote(w uuid,body jsonb) returns jsonb
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
 return jsonb_build_object('totalMinor',net_sum+tax_sum);
end $$;

create or replace function pos_private.refund(w uuid,body jsonb) returns jsonb
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
 if exists(select 1 from public.pos_tenders where sale_id=sale.id and method<>'cash') and not exists(select 1 from pos_private.payment_context x join public.pos_payment_refund_attempts r on r.id=x.refund_attempt_id where x.transaction_id=txid_current() and x.backend=pg_backend_pid() and x.actor_id=auth.uid() and r.workspace_id=w and r.status='SUCCEEDED' and r.intent->>'saleId'=sale.id::text) then raise exception 'POS_PROVIDER_REFUND_REQUIRED'; end if;
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
 if not exists(select 1 from public.pos_tenders where sale_id=sale.id and method<>'cash') then
 insert into public.pos_cash_events(workspace_id,site_id,register_id,session_id,actor_id,kind,amount_minor,reference_id,reason)
  values(w,sess.site_id,sess.register_id,sess.id,auth.uid(),'CASH_REFUND',-(net_sum+tax_sum),refund_id,body->>'reason');
 end if;
 return jsonb_build_object('id',refund_id,'totalMinor',net_sum+tax_sum,'saleId',sale.id);
end $$;

create function pos_private.payment_refund_command(w uuid,action text,body jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
  if p.provider='MOCK' then
   if not (select enabled from pos_private.payment_test_config) then raise exception 'POS_MOCK_DISABLED'; end if;
   outcome:=coalesce(r.intent->>'mockOutcome','REFUND_SUCCESS');
   insert into pos_private.mock_refunds values(r.id,outcome,case outcome when 'REFUND_FAIL' then 'FAILED' when 'REFUND_UNKNOWN_THEN_SUCCESS' then 'UNKNOWN' else 'SUCCEEDED' end,'mock_refund_'||r.id::text) on conflict do nothing;
   if action='reconcile' then update pos_private.mock_refunds set status='SUCCEEDED' where refund_id=r.id and status='UNKNOWN'; end if;
   select status into observed from pos_private.mock_refunds where refund_id=r.id;
  else observed:='SUCCEEDED'; end if;
  if r.status not in ('SUCCEEDED','FAILED') then
   update public.pos_payment_refund_attempts set status=observed,provider_refund_id=case when p.provider='MOCK' then 'mock_refund_'||r.id::text else 'external_refund_'||r.id::text end,recovery_required=observed='SUCCEEDED',updated_at=now() where id=r.id returning * into r;
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
create function public.pos_payment_refund_command(p_workspace_id uuid,p_action text,p_body jsonb default '{}') returns jsonb language sql security definer set search_path='' as $$ select pos_private.payment_refund_command(p_workspace_id,p_action,p_body) $$;
revoke all on function public.pos_payment_refund_command(uuid,text,jsonb) from public,anon;
grant execute on function public.pos_payment_refund_command(uuid,text,jsonb) to authenticated;
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

create index pos_payment_events_payment on public.pos_payment_events(payment_id);
create index pos_payment_pending_refund_session on public.pos_payment_refund_attempts((intent->>'sessionId')) where status in ('CREATED','PENDING','UNKNOWN') or recovery_required;
