-- Extend the existing event-backed command receipt to lot removal/movement.
-- No replacement writer, historical row rewrite, or new authorization policy.
begin;
set local lock_timeout='5s';
do $repair$
declare proc regprocedure; definition text; original text; kind text; preamble text;
  old_result text; new_result text; metadata_expr text; marker text;
begin
 foreach kind in array array['remove','move'] loop
  proc:=case when kind='remove' then 'public.remove_inventory_lot_quantity(text,integer,text,text,public.inventory_event_source)'::regprocedure
    else 'public.move_inventory_lot_quantity(text,integer,text,text,public.inventory_event_source)'::regprocedure end;
  definition:=replace(pg_get_functiondef(proc),chr(13),''); original:=definition;
  if position('-- lot-command-v1' in definition)>0 then continue; end if;
  if position('inventory_private.require_active_item' in definition)=0
    or position(E'declare\n' in definition)=0 or position(E'begin\n' in definition)=0 then
    raise exception 'LOT_COMMAND_PREFLIGHT: scoped authority required: %',proc;
  end if;
  definition:=replace(definition,E'declare\n',E'declare\n  -- lot-command-v1\n  v_command_request jsonb;\n  v_command_result jsonb;\n');
  preamble:=$p$begin
  perform inventory_private.require_active_item(p_inventory_item_id);
  v_command_request:=inventory_private.canonical_command(jsonb_build_object('kind',$p$||quote_literal(kind)||$p$,
    'actor',auth.uid(),'workspace',public.current_inventory_workspace(),'item',p_inventory_item_id,
    'quantity',p_quantity,'source',p_source,$p$||case when kind='remove' then $p$'reason',p_reason$p$ else $p$'location',p_to_location_id$p$ end||$p$));
  v_command_result:=inventory_private.replay_inventory_command(p_idempotency_key,v_command_request);
  if v_command_result is not null then return v_command_result; end if;
$p$;
  definition:=overlay(definition placing preamble from position(E'begin\n' in definition) for length(E'begin\n'));
  for old_result in select unnest(case when kind='remove' then array[
    $s$jsonb_build_object('ok', true, 'sourceItemId', v_source.id, 'quantityAfter', v_after)$s$]
    else array[$s$jsonb_build_object('ok', true, 'sourceItemId', v_source.id, 'destinationItemId', v_source.id)$s$,
    $s$jsonb_build_object('ok', true, 'sourceItemId', v_source.id, 'destinationItemId', v_destination.id)$s$] end)
  loop
    new_result:=old_result||$s$ || jsonb_build_object('id',v_source.id,'user_id',auth.uid(),'workspace_id',public.current_inventory_workspace(),'operationId',p_idempotency_key)$s$;
    if position('return '||old_result||';' in definition)=0 then raise exception 'LOT_COMMAND_PREFLIGHT: return drift'; end if;
    definition:=replace(definition,'return '||old_result||';','return '||new_result||';');
    metadata_expr:=$s$ || jsonb_build_object('inventoryMutationV1',jsonb_build_object('request',v_command_request,
      'fingerprint',encode(sha256(convert_to(v_command_request::text,'UTF8')),'hex'),'result',$s$||new_result||'))';
    marker:=case when kind='remove' then $s$'alignmentEventIds',v_evidence)$s$
      when position('v_destination.id' in old_result)>0 then $s$jsonb_build_object('operation', 'move_lot_split_source', 'destinationItemId', v_destination.id)$s$
      else $s$jsonb_build_object('operation', 'move_lot', 'movedQuantity', p_quantity)$s$ end;
    if position(marker in definition)=0 then raise exception 'LOT_COMMAND_PREFLIGHT: event drift'; end if;
    definition:=replace(definition,marker,marker||metadata_expr);
  end loop;
  -- An event collision must roll back the business effect, never silently omit history.
  definition:=replace(definition,E'\n  on conflict (user_id, idempotency_key) where idempotency_key is not null do nothing','');
  definition:=replace(definition,E'\n    on conflict (user_id, idempotency_key) where idempotency_key is not null do nothing','');
  if definition=original then raise exception 'LOT_COMMAND_PREFLIGHT: no transformation'; end if;
  execute definition;
 end loop;
end $repair$;
-- Preserve explicit asking price for APPEND through the existing create RPC.
do $append$
declare definition text;
begin
 definition:=pg_get_functiondef('public.create_inventory_item_with_event(jsonb,public.inventory_event_source,text,text,text)'::regprocedure);
 if position('    asking_price,' in definition)=0 then
   if position(E'    inventory_value,\n    data,' in definition)=0 then raise exception 'APPEND_PREFLIGHT: create definition drift'; end if;
   definition:=replace(definition,E'    inventory_value,\n    data,',E'    inventory_value,\n    asking_price,\n    data,');
   if position(E'    v_data || jsonb_build_object' in definition)>0 then
     definition:=replace(definition,E'    v_data || jsonb_build_object',E'    nullif(p_inventory->>''asking_price'','''')::numeric,\n    v_data || jsonb_build_object');
   else
     definition:=replace(definition,E'    v_data,\n',E'    nullif(p_inventory->>''asking_price'','''')::numeric,\n    v_data,\n');
   end if;
   execute definition;
 end if;
end $append$;
notify pgrst,'reload schema';
commit;
