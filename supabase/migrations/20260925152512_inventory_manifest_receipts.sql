-- Parent receipt only; stock changes still use the existing authoritative RPCs.
begin;
create table inventory_private.manifest_receipts (
 actor uuid not null, operation_id text not null, workspace_id uuid not null,
 request jsonb not null, fingerprint text not null, result jsonb not null,
 created_at timestamptz not null default now(), primary key(actor,operation_id)
);
alter table inventory_private.manifest_receipts enable row level security;
revoke all on inventory_private.manifest_receipts from public,anon,authenticated,service_role;

create function public.apply_inventory_manifest(p_operation_id text,p_manifest jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); wid uuid; request jsonb; prior inventory_private.manifest_receipts%rowtype;
 child jsonb; args jsonb; result jsonb; results jsonb:='[]'; commands jsonb;
begin
 if v_actor is null then raise exception 'MANIFEST_AUTHORIZATION_FAILURE' using errcode='42501'; end if;
 wid:=public.current_inventory_workspace();
 if p_operation_id is null or length(p_operation_id) not between 1 and 1024 or btrim(p_operation_id)='' then raise exception 'MANIFEST_OPERATION_ID_REQUIRED' using errcode='22023'; end if;
 if p_manifest->>'workspaceId' is distinct from wid::text or p_manifest->>'userId' is distinct from v_actor::text then raise exception 'MANIFEST_AUTHORIZATION_FAILURE' using errcode='42501'; end if;
 if jsonb_typeof(p_manifest->'commands') is distinct from 'array' then
   raise exception 'INVALID_MANIFEST' using errcode='22023';
 end if;
 -- Commands are independent, unique inventory targets. Sort execution AND hash
 -- by immutable child ID. Only createdAt is transport metadata; every other
 -- submitted field, including unknown future flags, participates in the hash.
 select coalesce(jsonb_agg(value-'createdAt' order by value->>'operationId'),'[]'::jsonb) into commands from jsonb_array_elements(p_manifest->'commands');
 request:=inventory_private.canonical_command(p_manifest||jsonb_build_object('commands',commands));
 perform pg_advisory_xact_lock(hashtextextended('inventory-manifest:'||v_actor::text||':'||p_operation_id,0));
 select * into prior from inventory_private.manifest_receipts mr where mr.actor=v_actor and mr.operation_id=p_operation_id;
 if found then
   if prior.request is distinct from request or prior.workspace_id is distinct from wid then raise exception 'MANIFEST_IDEMPOTENCY_CONFLICT' using errcode='22023'; end if;
   if coalesce((prior.result->>'committed')::boolean,false) or not coalesce((prior.result->'error'->>'retryable')::boolean,false) then
     return prior.result; -- committed/review outcomes do not re-run children
   end if;
 end if;
 -- Claim before invoking children. The private transaction marker cannot be set
 -- by an authenticated caller and is cleared into a durable outcome below.
 insert into inventory_private.manifest_receipts values(v_actor,p_operation_id,wid,request,encode(sha256(convert_to(request::text,'UTF8')),'hex'),jsonb_build_object('_executingXid',pg_current_xact_id()::text),now())
 on conflict(actor,operation_id) do update set result=excluded.result;
 begin -- subtransaction: roll back ALL child effects, but retain the parent claim
 if p_manifest->>'version' is distinct from '1' or coalesce(p_manifest->>'purpose','') not in ('append_import','bulk_remove') or jsonb_array_length(commands)<1 then
   raise exception 'INVALID_MANIFEST' using errcode='22023';
 end if;
 if exists(select 1 from jsonb_object_keys(p_manifest) k where k not in ('version','purpose','userId','workspaceId','commands')) then
   raise exception 'INVALID_MANIFEST_SEMANTICS' using errcode='22023';
 end if;
 -- A pre-upgrade partially delivered client group has no server parent claim.
 -- Do not pretend its original membership can be reconstructed from children.
 if exists(select 1 from public.inventory_events e join jsonb_array_elements(commands) c on e.idempotency_key=c->>'operationId' where e.user_id=v_actor) then
   raise exception 'MANIFEST_LEGACY_OPERATION_REVIEW_REQUIRED' using errcode='55000';
 end if;
 if (select count(distinct value->>'operationId') from jsonb_array_elements(commands))<>jsonb_array_length(commands)
   or (select count(distinct value->>'inventoryItemId') from jsonb_array_elements(commands))<>jsonb_array_length(commands) then
   raise exception 'INVALID_MANIFEST_DUPLICATE_TARGET' using errcode='22023';
 end if;
 for child in select value from jsonb_array_elements(commands) loop
   args:=child->'args';
   if child->>'version' is distinct from '1' or child->>'userId' is distinct from v_actor::text or child->>'workspaceId' is distinct from wid::text
     or nullif(child->>'operationId','') is null or args->>'p_idempotency_key' is distinct from child->>'operationId' then
     raise exception 'INVALID_MANIFEST_CHILD' using errcode='22023';
   end if;
   if p_manifest->>'purpose'='append_import' and child->>'endpoint'='create_inventory_item_with_event' then
     if args->>'p_source' is distinct from 'csv_import' or args->>'p_related_entity_type' is distinct from 'inventory_append'
       or args->>'p_related_entity_id' is distinct from p_operation_id or args->'p_inventory'->>'id' is distinct from child->>'inventoryItemId'
       or args->'p_inventory'->>'user_id' is distinct from v_actor::text or args->'p_inventory'->>'workspace_id' is distinct from wid::text then
       raise exception 'INVALID_MANIFEST_CHILD' using errcode='22023'; end if;
     result:=to_jsonb(public.create_inventory_item_with_event(args->'p_inventory','csv_import',args->>'p_idempotency_key','inventory_append',p_operation_id));
   elsif p_manifest->>'purpose'='bulk_remove' and child->>'endpoint'='remove_inventory_lot_quantity' then
     if args->>'p_source' is distinct from 'collector_workspace' or args->>'p_inventory_item_id' is distinct from child->>'inventoryItemId' then raise exception 'INVALID_MANIFEST_CHILD' using errcode='22023'; end if;
     result:=public.remove_inventory_lot_quantity(args->>'p_inventory_item_id',(args->>'p_quantity')::integer,args->>'p_reason',args->>'p_idempotency_key','collector_workspace');
   else raise exception 'INVALID_MANIFEST_CHILD' using errcode='22023'; end if;
   results:=results||jsonb_build_array(jsonb_build_object('operationId',child->>'operationId','result',result));
 end loop;
 result:=jsonb_build_object('operationId',p_operation_id,'userId',v_actor,'workspaceId',wid,'committed',true,'results',results);
 exception when others then
   result:=jsonb_build_object('operationId',p_operation_id,'userId',v_actor,'workspaceId',wid,'committed',false,'results','[]'::jsonb,
     'failedOperationId',child->>'operationId','error',jsonb_build_object('code',sqlstate,'message',sqlerrm,
     'retryable',sqlstate in ('40001','40P01','55P03','08006','08001')));
 end;
 insert into inventory_private.manifest_receipts values(v_actor,p_operation_id,wid,request,encode(sha256(convert_to(request::text,'UTF8')),'hex'),result,now())
 on conflict(actor,operation_id) do update set result=excluded.result;
 return result;
 -- No per-item partial success: all child effects roll back together. Failed
 -- receipt membership is still immutable; only transient failures retry it.
end $$;
revoke all on function public.apply_inventory_manifest(text,jsonb) from public,anon;
grant execute on function public.apply_inventory_manifest(text,jsonb) to authenticated;

-- A stale/direct client cannot add new CSV children to a previously frozen
-- inventory_append parent by bypassing the manifest RPC.
create function inventory_private.require_manifest_child(parent_id text,child_id text,arguments jsonb) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from inventory_private.manifest_receipts r
   where r.actor=auth.uid() and r.operation_id=parent_id
   and r.result->>'_executingXid'=pg_current_xact_id()::text
   and exists(select 1 from jsonb_array_elements(r.request->'commands') c
     where c->>'operationId'=child_id and c->>'endpoint'='create_inventory_item_with_event'
     and c->'args'=inventory_private.canonical_command(arguments))) then
   raise exception 'MANIFEST_PARENT_REQUIRED: recover the original parent operation' using errcode='22023';
 end if;
end $$;
revoke all on function inventory_private.require_manifest_child(text,text,jsonb) from public,anon,authenticated,service_role;
do $$
declare definition text; anchor integer;
begin
 definition:=replace(pg_get_functiondef('public.create_inventory_item_with_event(jsonb,public.inventory_event_source,text,text,text)'::regprocedure),chr(13),'');
 anchor:=strpos(definition,E'begin\n');
 if anchor=0 or strpos(definition,'-- inventory-command-v1')=0 then raise exception 'MANIFEST_CHILD_BASELINE_DRIFT'; end if;
 definition:=overlay(definition placing $guard$begin
  if p_related_entity_type='inventory_append' then
    perform inventory_private.require_manifest_child(p_related_entity_id,p_idempotency_key,jsonb_build_object('p_inventory',p_inventory,'p_source',p_source,'p_idempotency_key',p_idempotency_key,'p_related_entity_type',p_related_entity_type,'p_related_entity_id',p_related_entity_id));
  end if;
$guard$ from anchor for length(E'begin\n'));
 execute definition;
end $$;
commit;
