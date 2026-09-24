-- REVIEW/REHEARSAL ONLY. Deploy with legacy normalization and the matching app.
begin;
set local lock_timeout='5s';

-- This predicate narrows existing ownership/delegation policies; it never grants
-- an operation by itself. SECURITY DEFINER avoids recursive membership RLS.
create function public.can_current_user_access_workspace(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and target is not null and exists(
   select 1 from public.user_preferences p
   join public.workspace_members m on m.user_id=p.user_id and m.workspace_id=p.active_workspace_id
   join public.workspaces w on w.id=m.workspace_id
   join auth.users u on u.id=p.user_id
   where p.user_id=auth.uid() and p.active_workspace_id=target
   and (u.banned_until is null or u.banned_until<now())
   and (m.role<>'owner' or w.owner_id=p.user_id));
$$;
revoke all on function public.can_current_user_access_workspace(uuid) from public,anon;
grant execute on function public.can_current_user_access_workspace(uuid) to authenticated;

create function public.current_inventory_workspace() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare w uuid;
begin
 select active_workspace_id into w from public.user_preferences where user_id=auth.uid();
 if not public.can_current_user_access_workspace(w) then
   raise exception 'INVENTORY_WORKSPACE_FORBIDDEN' using errcode='42501';
 end if;
 return w;
end $$;
revoke all on function public.current_inventory_workspace() from public,anon;
grant execute on function public.current_inventory_workspace() to authenticated;

-- Refuse incomplete installation; never apply normalization alone as the release.
alter table public.inventory_items alter column workspace_id set not null;
alter table public.chaos_sort_batches alter column workspace_id set not null;

do $policies$
declare tab text;
begin
 foreach tab in array array['inventory_items','chaos_sort_batches','chaos_scan_albums',
   'inventory_label_identities','inventory_barcode_aliases','inventory_price_reviews',
   'label_templates','label_print_jobs','label_migration_audit'] loop
   execute format('create policy active_workspace_boundary on public.%I as restrictive for all to authenticated using (public.can_current_user_access_workspace(workspace_id)) with check (public.can_current_user_access_workspace(workspace_id))',tab);
 end loop;
end $policies$;
create policy active_workspace_boundary on public.chaos_sort_inventory_positions as restrictive
for all to authenticated using(exists(select 1 from public.inventory_items i
 where i.id=item_id and i.user_id=chaos_sort_inventory_positions.user_id
 and public.can_current_user_access_workspace(i.workspace_id)))
with check(exists(select 1 from public.inventory_items i join public.chaos_sort_batches b on b.id=batch_id
 where i.id=item_id and i.user_id=chaos_sort_inventory_positions.user_id
 and b.user_id=i.user_id and b.workspace_id=i.workspace_id
 and public.can_current_user_access_workspace(i.workspace_id)));
create policy active_workspace_boundary on public.inventory_events as restrictive
for select to authenticated using(public.can_current_user_access_workspace(coalesce(workspace_id,
 (select i.workspace_id from public.inventory_items i where i.user_id=inventory_events.user_id and i.id=inventory_item_id))));

-- Triggers also protect SECURITY DEFINER mutation paths, which bypass RLS.
create function inventory_private.enforce_active_workspace() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op<>'INSERT' and not public.can_current_user_access_workspace(old.workspace_id) then
   raise exception 'INVENTORY_WORKSPACE_FORBIDDEN' using errcode='42501';
 end if;
 if tg_op<>'DELETE' and not public.can_current_user_access_workspace(new.workspace_id) then
   raise exception 'INVENTORY_WORKSPACE_FORBIDDEN' using errcode='42501';
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function inventory_private.enforce_active_workspace() from public,anon,authenticated,service_role;
create trigger b_inventory_active_workspace before insert or update or delete on public.inventory_items
for each row execute function inventory_private.enforce_active_workspace();

create function inventory_private.require_active_item(item text) returns void
language plpgsql security definer set search_path='' as $$
declare w uuid;
begin
 select workspace_id into w from public.inventory_items where id=item and user_id=auth.uid();
 if not public.can_current_user_access_workspace(w) then
   raise exception 'INVENTORY_WORKSPACE_FORBIDDEN' using errcode='42501';
 end if;
end $$;
revoke all on function inventory_private.require_active_item(text) from public,anon,authenticated,service_role;

do $rpc_guards$
declare proc regprocedure; definition text; marker text; name text;
begin
 -- Check before idempotency/replay reads, not only before the final UPDATE.
 for proc in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('remove_inventory_lot_quantity','move_inventory_lot_quantity','apply_collector_inventory_mutation') loop
   definition:=replace(pg_get_functiondef(proc),chr(13),'');
   if position(E'begin\n' in definition)=0 or position('p_inventory_item_id' in definition)=0 then raise exception 'TENANCY_RPC_DRIFT: %',proc; end if;
   -- Only the outer function BEGIN is changed.
   definition:=overlay(definition placing E'begin\n  perform inventory_private.require_active_item(p_inventory_item_id);\n' from position(E'begin\n' in definition) for length(E'begin\n'));
   execute definition;
 end loop;
 foreach name in array array['pos_private.authorize(uuid,boolean,boolean)','pos_private.authorize_labels(uuid,boolean)'] loop
   proc:=name::regprocedure;
   definition:=replace(pg_get_functiondef(proc),chr(13),'');
   if position(E'begin\n' in definition)=0 then raise exception 'TENANCY_RPC_DRIFT: %',proc; end if;
   definition:=overlay(definition placing E'begin\n if not public.can_current_user_access_workspace(w) then raise exception ''POS_FORBIDDEN''; end if;\n' from position(E'begin\n' in definition) for length(E'begin\n'));
   execute definition;
 end loop;
 -- Omitted operation scope resolves to the validated active workspace, never
 -- an arbitrary unique owned workspace. Original owner/manager checks remain.
 proc:='inventory_private.resolve_workspace(uuid,uuid,text,text,boolean)'::regprocedure;
 definition:=replace(pg_get_functiondef(proc),chr(13),'');
 marker:='candidate uuid:=p_workspace;';
 if position(marker in definition)=0 then raise exception 'TENANCY_RESOLVER_DRIFT'; end if;
 definition:=replace(definition,marker,'candidate uuid:=coalesce(p_workspace,public.current_inventory_workspace());');
 definition:=overlay(definition placing E'begin\n if not public.can_current_user_access_workspace(candidate) then raise exception ''INVENTORY_WORKSPACE_FORBIDDEN'' using errcode=''42501''; end if;\n' from position(E'begin\n' in definition) for length(E'begin\n'));
 execute definition;
end $rpc_guards$;

-- Parent consistency is checked even when a trusted RPC bypasses RLS. No
-- existing row is rewritten. Shared owner-level locations remain shared.
create function inventory_private.check_workspace_parent() returns trigger
language plpgsql security definer set search_path='' as $$
declare rowdata jsonb:=to_jsonb(new); w uuid:=(rowdata->>'workspace_id')::uuid;
 v_owner_id uuid; v_item_id text;
begin
 if tg_table_name='chaos_scan_captures' then
   if not exists(select 1 from public.chaos_scan_albums a where a.id=new.album_id and a.user_id=new.user_id
     and public.can_current_user_access_workspace(a.workspace_id)) then raise exception 'SCAN_SCOPE_MISMATCH'; end if;
   return new;
 end if;
 if not public.can_current_user_access_workspace(w) then raise exception 'INVENTORY_WORKSPACE_FORBIDDEN' using errcode='42501'; end if;
 v_item_id:=rowdata->>'inventory_item_id'; v_owner_id:=nullif(rowdata->>'inventory_user_id','')::uuid;
 if v_item_id is not null and not exists(select 1 from public.inventory_items i where i.id=v_item_id and i.user_id=v_owner_id and i.workspace_id=w) then raise exception 'INVENTORY_WORKSPACE_PARENT_MISMATCH'; end if;
 if rowdata->>'inventory_position_id' is not null and not exists(select 1 from public.chaos_sort_inventory_positions p join public.inventory_items i on i.id=p.item_id and i.user_id=p.user_id where p.id=rowdata->>'inventory_position_id' and p.user_id=v_owner_id and i.workspace_id=w and (v_item_id is null or v_item_id=p.item_id)) then raise exception 'INVENTORY_WORKSPACE_PARENT_MISMATCH'; end if;
 if rowdata->>'inventory_identity_id' is not null and not exists(select 1 from public.inventory_label_identities i where i.id=(rowdata->>'inventory_identity_id')::uuid and i.workspace_id=w and i.inventory_user_id=v_owner_id and i.inventory_item_id=v_item_id) then raise exception 'INVENTORY_WORKSPACE_PARENT_MISMATCH'; end if;
 if rowdata->>'template_id' is not null and not exists(select 1 from public.label_templates t where t.id=(rowdata->>'template_id')::uuid and t.workspace_id=w) then raise exception 'INVENTORY_WORKSPACE_PARENT_MISMATCH'; end if;
 return new;
end $$;
revoke all on function inventory_private.check_workspace_parent() from public,anon,authenticated,service_role;
do $parents$
declare tab text;
begin
 foreach tab in array array['inventory_label_identities','inventory_price_reviews','label_print_jobs','chaos_scan_captures'] loop
   execute format('create trigger tenancy_parent_guard before insert or update on public.%I for each row execute function inventory_private.check_workspace_parent()',tab);
 end loop;
end $parents$;
commit;
