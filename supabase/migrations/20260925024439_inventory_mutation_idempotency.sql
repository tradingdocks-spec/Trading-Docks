-- Phase 1K: repair the existing RPCs; no parallel writer or event ledger.
begin;
set local lock_timeout='5s';
create schema if not exists inventory_private;
revoke all on schema inventory_private from public,anon,authenticated;

-- JSONB already canonicalizes object keys. Normalize numeric scale recursively,
-- but preserve array order, explicit nulls, strings, and all business fields.
create or replace function inventory_private.canonical_command(value jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare result jsonb;
begin
 case jsonb_typeof(value)
 when 'object' then
   select coalesce(jsonb_object_agg(key,inventory_private.canonical_command(v)),'{}') into result from jsonb_each(value) as e(key,v);
 when 'array' then
   select coalesce(jsonb_agg(inventory_private.canonical_command(v) order by n),'[]') into result from jsonb_array_elements(value) with ordinality as e(v,n);
 when 'number' then result:=to_jsonb(trim_scale((value#>>'{}')::numeric));
 else result:=value;
 end case;
 return result;
end $$;

-- Existing unique(user_id,idempotency_key) is the trust/claim namespace.
-- An owner cannot reuse a key in another workspace; a different owner has an
-- independent namespace. Workspace is also part of the immutable request.
-- Use a transaction-scoped key lock because an append-only event does not exist
-- before the stock effect. The unique event index remains the final constraint.
create or replace function inventory_private.replay_inventory_command(key text,request jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=auth.uid(); w uuid; prior public.inventory_events%rowtype; receipt jsonb;
begin
 if actor is null then raise exception 'INVENTORY_AUTHORIZATION_FAILURE' using errcode='42501'; end if;
 w:=public.current_inventory_workspace();
 if request->>'actor' is distinct from actor::text or request->>'workspace' is distinct from w::text then
   raise exception 'INVENTORY_AUTHORIZATION_FAILURE' using errcode='42501';
 end if;
 if key is null or length(key) not between 1 and 2048 or btrim(key)='' then
   raise exception 'INVENTORY_OPERATION_ID_REQUIRED' using errcode='22023';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('inventory-command:'||actor::text||':'||key,0));
 select * into prior from public.inventory_events e where e.user_id=actor and e.idempotency_key=key;
 if not found then return null; end if;
 -- No prior identifiers/data are included in conflict errors.
 if prior.workspace_id is distinct from w then raise exception 'INVENTORY_IDEMPOTENCY_CONFLICT' using errcode='22023'; end if;
 receipt:=prior.metadata->'inventoryMutationV1';
 if receipt is null then raise exception 'INVENTORY_LEGACY_OPERATION_REVIEW_REQUIRED' using errcode='55000'; end if;
 if receipt->'request' is distinct from request or receipt->>'fingerprint' is distinct from encode(sha256(convert_to(request::text,'UTF8')),'hex') then
   raise exception 'INVENTORY_IDEMPOTENCY_CONFLICT' using errcode='22023';
 end if;
 if jsonb_typeof(receipt->'result') is distinct from 'object' then raise exception 'INVENTORY_OPERATION_REVIEW_REQUIRED' using errcode='55000'; end if;
 raise log 'inventory_command outcome=REPLAYED_COMMIT operation_hash=% workspace=% kind=% event=% inventory=%',encode(sha256(convert_to(key,'UTF8')),'hex'),w,request->>'kind',prior.id,receipt->'result'->>'id';
 return receipt->'result';
end $$;

-- Forward-only in-place transformation: retain all existing business rules,
-- collector/workspace guards, triggers, RPC names, arguments, grants and result
-- type. Refuse function drift rather than replace newer authorization logic.
do $repair$
declare proc regprocedure; definition text; kind text; preamble text; metadata_value text;
begin
 if to_regprocedure('public.current_inventory_workspace()') is null then raise exception 'INVENTORY_COMMAND_PREFLIGHT: active workspace authority required'; end if;
 foreach kind in array array['create','mutate'] loop
  proc:=case when kind='create' then 'public.create_inventory_item_with_event(jsonb,public.inventory_event_source,text,text,text)'::regprocedure
    else 'public.apply_collector_inventory_mutation(text,text,integer,text,text,text,text,public.inventory_event_source)'::regprocedure end;
  definition:=replace(pg_get_functiondef(proc),chr(13),'');
  if position('-- inventory-command-v1' in definition)>0 then continue; end if;
  if position(E'declare\n' in definition)=0 or position(E'begin\n' in definition)=0
    or position('insert into public.inventory_events (' in definition)=0
    or position(replace($old$    '{}'::jsonb
  )
  on conflict (user_id, idempotency_key) where idempotency_key is not null do nothing;$old$,chr(13),'') in definition)=0
    or position('return v_item;' in definition)=0 then
    raise exception 'INVENTORY_COMMAND_PREFLIGHT: unrecognized RPC %',proc;
  end if;
  definition:=replace(definition,E'declare\n',E'declare\n  -- inventory-command-v1\n  v_command_request jsonb;\n  v_command_result jsonb;\n  v_command_workspace uuid;\n  v_command_event_id uuid;\n  v_command_constraint text;\n');
  preamble:=$p$begin
  if auth.uid() is null then raise exception 'INVENTORY_AUTHORIZATION_FAILURE' using errcode='42501'; end if;
  v_command_workspace:=public.current_inventory_workspace();
$p$;
  if kind='create' then
   preamble:=preamble||$p$
  if jsonb_typeof(p_inventory) is distinct from 'object'
    or (p_inventory->>'user_id' is not null and p_inventory->>'user_id'<>auth.uid()::text)
    or (p_inventory->>'workspace_id' is not null and (p_inventory->>'workspace_id')::uuid<>v_command_workspace) then
    raise exception 'INVENTORY_AUTHORIZATION_FAILURE' using errcode='42501';
  end if;
  p_inventory:=p_inventory||jsonb_build_object('user_id',auth.uid(),'workspace_id',v_command_workspace);
  v_command_request:=inventory_private.canonical_command(jsonb_build_object('kind','create','actor',auth.uid(),'workspace',v_command_workspace,
    'inventory',p_inventory,'source',p_source,'relatedType',p_related_entity_type,'relatedId',p_related_entity_id));
$p$;
  else
   preamble:=preamble||$p$
  -- Preserve target authorization before prior-result access. This is a read,
  -- never an attempt to restore the current row to its earlier state.
  perform inventory_private.require_active_item(p_inventory_item_id);
  v_command_request:=inventory_private.canonical_command(jsonb_build_object('kind','mutate','actor',auth.uid(),'workspace',v_command_workspace,
    'item',p_inventory_item_id,'mutation',p_mutation_type,'quantity',p_quantity,'condition',p_condition,'finish',p_finish,'location',p_location_id,'source',p_source));
$p$;
  end if;
  preamble:=preamble||$p$
  v_command_result:=inventory_private.replay_inventory_command(p_idempotency_key,v_command_request);
  if v_command_result is not null then
    return jsonb_populate_record(null::public.inventory_items,v_command_result);
  end if;
$p$;
  definition:=overlay(definition placing preamble from position(E'begin\n' in definition) for length(E'begin\n'));
  metadata_value:=$m$    jsonb_build_object('inventoryMutationV1',jsonb_build_object('request',v_command_request,
      'fingerprint',encode(sha256(convert_to(v_command_request::text,'UTF8')),'hex'),'result',to_jsonb(v_item)))
  ) returning id into v_command_event_id;$m$;
  definition:=replace(definition,replace($old$    '{}'::jsonb
  )
  on conflict (user_id, idempotency_key) where idempotency_key is not null do nothing;$old$,chr(13),''),metadata_value);
  -- Ensure the saved event scope is canonical even on older collector bodies.
  definition:=replace(definition,'public.inventory_event_workspace_for_user(v_user_id)','v_command_workspace');
  definition:=replace(definition,E'return v_item;\nend;',$r$raise log 'inventory_command outcome=NEW_COMMIT operation_hash=% workspace=% kind=% event=% inventory=%',encode(sha256(convert_to(p_idempotency_key,'UTF8')),'hex'),v_command_workspace,v_command_request->>'kind',v_command_event_id,v_item.id;
  return v_item;
exception when others then
  if sqlstate='23505' then
    get stacked diagnostics v_command_constraint=constraint_name;
    if v_command_constraint='inventory_events_user_idempotency_key_idx' or current_setting('transaction_isolation') in ('repeatable read','serializable') then
      raise log 'inventory_command outcome=TRANSACTION_FAILURE retry=transaction';
      raise exception 'INVENTORY_RETRY_TRANSACTION' using errcode='40001';
    end if;
  end if;
  raise log 'inventory_command outcome=% operation_hash=% workspace=% kind=% sqlstate=%',
    case when sqlstate in ('42501','28000') or sqlerrm like '%FORBIDDEN%' or sqlerrm like '%UNAUTHORIZED%' then 'AUTHORIZATION_FAILURE'
      when sqlerrm='INVENTORY_IDEMPOTENCY_CONFLICT' then 'IDEMPOTENCY_CONFLICT'
      when sqlstate='55000' then 'REVIEW_REQUIRED'
      when sqlstate in ('22023','22P02','P0002','23514') then 'BUSINESS_VALIDATION_FAILURE'
      else 'TRANSACTION_FAILURE' end,
    encode(sha256(convert_to(coalesce(p_idempotency_key,''),'UTF8')),'hex'),v_command_workspace,v_command_request->>'kind',sqlstate;
  raise;
end;$r$);
  execute definition;
 end loop;
end $repair$;
revoke all on function inventory_private.canonical_command(jsonb) from public,anon,authenticated,service_role;
revoke all on function inventory_private.replay_inventory_command(text,jsonb) from public,anon,authenticated,service_role;
commit;
