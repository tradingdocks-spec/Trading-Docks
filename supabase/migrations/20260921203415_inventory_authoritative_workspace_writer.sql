-- Authoritative creation-time scope. No existing row is rewritten.
-- Apply after compatibility/schema repair and BEFORE the one-time assignment.
create schema if not exists inventory_private;
revoke all on schema inventory_private from public,anon,authenticated;

create function inventory_private.workspace_required(p_owner uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.workspaces w where w.owner_id=p_owner)
   or public.collector_effective_membership_tier(p_owner) in ('seller','store')
   or exists(select 1 from public.user_roles r where r.user_id=p_owner and r.role::text in ('owner','admin'))
$$;

create function inventory_private.resolve_workspace(p_owner uuid,p_workspace uuid,p_batch text,p_location text,p_required boolean default false)
returns uuid language plpgsql security definer set search_path='' as $$
declare candidate uuid:=p_workspace; batch_workspace uuid; n integer; memberships integer;
begin
 if p_owner is null or auth.uid() is distinct from p_owner then raise exception 'TD_COLLECTOR_UNAUTHORIZED'; end if;
 if not exists(select 1 from auth.users u where u.id=p_owner and (u.banned_until is null or u.banned_until<now())) then
   raise exception 'INVENTORY_WORKSPACE_FORBIDDEN';
 end if;
 if nullif(p_location,'') is not null and not exists(select 1 from public.inventory_locations l where l.user_id=p_owner and l.id=p_location) then
   raise exception 'INVENTORY_WORKSPACE_INVALID_LOCATION';
 end if;
 if p_batch is not null then
   select b.workspace_id into batch_workspace from public.chaos_sort_batches b where b.id::text=p_batch and b.user_id=p_owner;
   if not found then raise exception 'INVENTORY_WORKSPACE_INVALID_BATCH'; end if;
   if candidate is not null and batch_workspace is not null and candidate<>batch_workspace then raise exception 'INVENTORY_WORKSPACE_CONTEXT_CONFLICT'; end if;
   candidate:=coalesce(candidate,batch_workspace);
 end if;
 if candidate is null then
   select count(*) into memberships from public.workspace_members m where m.user_id=p_owner;
   select count(*),(array_agg(w.id))[1] into n,candidate from public.workspaces w
     join public.workspace_members m on m.workspace_id=w.id and m.user_id=p_owner and m.role='owner'
     where w.owner_id=p_owner;
   if n<>1 or memberships<>1 then
     if p_required or coalesce(inventory_private.workspace_required(p_owner),false) then
       raise exception 'INVENTORY_WORKSPACE_REQUIRED: choose a unique owned workspace for this operation';
     end if;
     return null; -- Personal/non-workspace collector inventory remains supported.
   end if;
 end if;
 -- Explicit shared-store context is not inventory ownership. Preserve the
 -- existing partner-owner model: a workspace manager may place THEIR OWN
 -- inventory in that workspace. The collector trigger still authorizes the
 -- inventory write; POS delegation alone never satisfies this relationship.
 if not exists(select 1 from public.workspaces w join public.workspace_members m
   on m.workspace_id=w.id and m.user_id=p_owner
   where w.id=candidate and ((w.owner_id=p_owner and m.role='owner') or m.role='manager')) then
   raise exception 'INVENTORY_WORKSPACE_FORBIDDEN';
 end if;
 return candidate;
end $$;

create function inventory_private.scope_inventory_write() returns trigger
language plpgsql security definer set search_path='' as $$
declare existing_workspace uuid; batch_id text;
begin
 if tg_op='INSERT' then
   -- INSERT triggers also run for upsert. Preserve the existing authoritative
   -- association when older clients omit it; never reselect another workspace.
   select i.workspace_id into existing_workspace from public.inventory_items i where i.user_id=new.user_id and i.id=new.id;
   if existing_workspace is not null and new.workspace_id is not null and existing_workspace<>new.workspace_id then
     raise exception 'INVENTORY_WORKSPACE_CONTEXT_CONFLICT';
   end if;
   batch_id:=case when new.data->>'source'='chaos_sort' then new.data->>'batch_id' end;
   new.workspace_id:=inventory_private.resolve_workspace(new.user_id,coalesce(new.workspace_id,existing_workspace),batch_id,new.location_id);
 elsif new.workspace_id is distinct from old.workspace_id then
   -- Allow only the separately reviewed trusted assignment to validate through
   -- the existing collector guard. No actor impersonation or new bypass exists.
   if new.workspace_id is null then raise exception 'INVENTORY_WORKSPACE_REQUIRED'; end if;
   if auth.uid()=new.user_id then
     perform inventory_private.resolve_workspace(new.user_id,new.workspace_id,null,new.location_id,true);
   elsif session_user<>'postgres' or current_setting('role')<>'none' then
     raise exception 'TD_COLLECTOR_UNAUTHORIZED';
   end if;
 elsif new.quantity>old.quantity and new.workspace_id is null and coalesce(inventory_private.workspace_required(new.user_id),false) then
   -- A restoration must not resurrect unscoped sellable inventory. No silent
   -- post-hoc assignment: preexisting legacy scope requires the reviewed repair.
   raise exception 'INVENTORY_WORKSPACE_REQUIRED: repair legacy scope before restoring stock';
 end if;
 return new;
end $$;
create trigger a_inventory_workspace_at_write before insert or update on public.inventory_items
for each row execute function inventory_private.scope_inventory_write();

create function inventory_private.scope_chaos_batch() returns trigger
language plpgsql security definer set search_path='' as $$
declare existing_workspace uuid;
begin
 select b.workspace_id into existing_workspace from public.chaos_sort_batches b where b.id=new.id and b.user_id=new.user_id;
 if new.workspace_id is not null and existing_workspace is not null and new.workspace_id<>existing_workspace then raise exception 'INVENTORY_WORKSPACE_CONTEXT_CONFLICT'; end if;
 new.workspace_id:=inventory_private.resolve_workspace(new.user_id,coalesce(new.workspace_id,existing_workspace),null,new.destination_location_id);
 return new;
end $$;
create trigger a_chaos_workspace_at_write before insert on public.chaos_sort_batches
for each row execute function inventory_private.scope_chaos_batch();
revoke all on all functions in schema inventory_private from public,anon,authenticated,service_role;

-- Retain current algorithms/public parameters. Expose explicit operation scope
-- to the canonical BEFORE INSERT resolver instead of ignoring it in RPC input.
do $rpc_context$
declare definition text;
begin
 definition:=replace(pg_get_functiondef('public.commit_chaos_sort_batch(jsonb)'::regprocedure),chr(13),'');
 if position('insert into public.chaos_sort_batches (id, user_id, session_id,' in definition)=0 then
   raise exception 'WORKSPACE_WRITER_PREFLIGHT: unrecognized Chaos batch insert';
 end if;
 definition:=replace(definition,'insert into public.chaos_sort_batches (id, user_id, session_id,','insert into public.chaos_sort_batches (id, user_id, workspace_id, session_id,');
 definition:=replace(definition,'values (batch_id, actor, session_id,','values (batch_id, actor, nullif(batch_payload->>''workspaceId'','''')::uuid, session_id,');
 -- Matching inventory must belong to this operation's validated scope, even
 -- when two workspaces use the same owner-level storage location.
 definition:=replace(definition,'where candidate.user_id = actor',
   'where candidate.user_id = actor and candidate.workspace_id is not distinct from (select b.workspace_id from public.chaos_sort_batches b where b.id=compat_chaos.batch_id and b.user_id=actor)');
 definition:=replace(definition,'insert into public.inventory_events (user_id, inventory_item_id,','insert into public.inventory_events (user_id, workspace_id, inventory_item_id,');
 definition:=replace(definition,'values (actor, inventory_id,','values (actor, (select b.workspace_id from public.chaos_sort_batches b where b.id=compat_chaos.batch_id and b.user_id=actor), inventory_id,');
 execute definition;
 -- Some minimal test schemas omit the collection RPCs. Production has both.
 if to_regprocedure('public.create_inventory_item_with_event(jsonb,public.inventory_event_source,text,text,text)') is not null then
   definition:=replace(pg_get_functiondef('public.create_inventory_item_with_event(jsonb,public.inventory_event_source,text,text,text)'::regprocedure),chr(13),'');
   if position(E'id,\n    user_id,\n    card_name,' in definition)=0 then raise exception 'WORKSPACE_WRITER_PREFLIGHT: unrecognized manual insert'; end if;
   definition:=replace(definition,E'id,\n    user_id,\n    card_name,',E'id,\n    user_id,\n    workspace_id,\n    card_name,');
   definition:=replace(definition,E'v_item_id,\n    v_user_id,',E'v_item_id,\n    v_user_id,\n    nullif(p_inventory->>''workspace_id'','''')::uuid,');
   definition:=replace(definition,'public.inventory_event_workspace_for_user(v_user_id)','v_item.workspace_id');
   execute definition;
 end if;
 if to_regprocedure('public.move_inventory_lot_quantity(text,integer,text,text,public.inventory_event_source)') is not null then
   definition:=replace(pg_get_functiondef('public.move_inventory_lot_quantity(text,integer,text,text,public.inventory_event_source)'::regprocedure),chr(13),'');
   if position('id, user_id, card_name, sku, location_id,' in definition)=0 then raise exception 'WORKSPACE_WRITER_PREFLIGHT: unrecognized lot insert'; end if;
   definition:=replace(definition,'id, user_id, card_name, sku, location_id,','id, user_id, workspace_id, card_name, sku, location_id,');
   definition:=replace(definition,'v_destination_id, v_user_id, v_source.card_name,','v_destination_id, v_user_id, v_source.workspace_id, v_source.card_name,');
   definition:=replace(definition,'nullif(v_source.data ->> ''workspaceId'', '''')::uuid','v_source.workspace_id');
   definition:=replace(definition,'nullif(v_destination.data ->> ''workspaceId'', '''')::uuid','v_destination.workspace_id');
   execute definition;
 end if;
end $rpc_context$;
