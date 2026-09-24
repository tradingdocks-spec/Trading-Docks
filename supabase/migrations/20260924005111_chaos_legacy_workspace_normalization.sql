-- REVIEW CANDIDATE ONLY: production application requires separate owner approval.
-- One transaction; no persistent exception, trigger disabling, or actor impersonation.
begin;
set local lock_timeout='5s';
lock table public.chaos_sort_batches in access exclusive mode;
lock table public.chaos_sort_inventory_positions,public.inventory_items,
 public.inventory_locations,public.workspaces,public.workspace_members,
 public.chaos_sort_sessions,public.inventory_events in share mode;
do $normalize$
declare original_guard text; temporary_guard text; before_rows jsonb; changed integer; expected integer;
begin
 if session_user<>'postgres' or current_setting('role')<>'none' or auth.uid() is not null then
   raise exception 'NORMALIZATION_REQUIRES_TRUSTED_MIGRATION_SESSION';
 end if;
 create temporary table chaos_workspace_evidence on commit drop as
 select b.id, (array_agg(distinct i.workspace_id))[1] as workspace_id
 from public.chaos_sort_batches b
 join public.chaos_sort_inventory_positions p on p.batch_id=b.id
 left join public.inventory_items i on i.id=p.item_id and i.user_id=p.user_id
 left join public.workspaces w on w.id=i.workspace_id
 where b.workspace_id is null and b.status='committed' and b.status_v2='CLOSED'
 group by b.id,b.user_id,b.destination_location_id
 having count(distinct i.workspace_id)=1
 and bool_and(i.workspace_id is not null and i.user_id=b.user_id and p.user_id=b.user_id and w.owner_id=b.user_id)
 and exists(select 1 from public.inventory_locations l where l.id=b.destination_location_id and l.user_id=b.user_id)
 and exists(select 1 from public.workspace_members m where m.workspace_id=(array_agg(distinct i.workspace_id))[1] and m.user_id=b.user_id and m.role='owner')
 and (b.session_id is null or exists(select 1 from public.chaos_sort_sessions s where s.id=b.session_id and s.user_id=b.user_id))
 and not exists(select 1 from public.inventory_events e
   join public.chaos_sort_inventory_positions ep on ep.item_id=e.inventory_item_id and ep.user_id=e.user_id
   where ep.batch_id=b.id and e.workspace_id is not null and e.workspace_id<>(array_agg(distinct i.workspace_id))[1])
 and not exists(select 1 from public.chaos_scan_albums a where a.id=b.id);
 select count(*) into expected from public.chaos_sort_batches where workspace_id is null;
 if (select count(*) from pg_temp.chaos_workspace_evidence)<>expected then
   raise exception 'NORMALIZATION_AMBIGUOUS_OR_UNRESOLVED';
 end if;
 select jsonb_agg(to_jsonb(b)-'workspace_id' order by b.id) into before_rows from public.chaos_sort_batches b;
 original_guard:=pg_get_functiondef('chaos_scan_private.guard_batch()'::regprocedure);
 if position('if a.id is null then' in original_guard)=0 then raise exception 'NORMALIZATION_GUARD_DRIFT'; end if;
 temporary_guard:=replace(original_guard,'if a.id is null then',$exception$
 if a.id is null then
   if tg_op='UPDATE' and session_user='postgres' and current_setting('role')='none' and auth.uid() is null
     and old.workspace_id is null and new.workspace_id is not null
     and (to_jsonb(new)-'workspace_id')=(to_jsonb(old)-'workspace_id')
     and exists(select 1 from pg_temp.chaos_workspace_evidence e where e.id=old.id and e.workspace_id=new.workspace_id)
   then return new; end if;
 $exception$);
 execute temporary_guard;
 update public.chaos_sort_batches b set workspace_id=e.workspace_id
 from pg_temp.chaos_workspace_evidence e where b.id=e.id and b.workspace_id is null;
 get diagnostics changed=row_count;
 execute original_guard;
 if changed<>expected or before_rows is distinct from
   (select jsonb_agg(to_jsonb(b)-'workspace_id' order by b.id) from public.chaos_sort_batches b)
   or original_guard<>pg_get_functiondef('chaos_scan_private.guard_batch()'::regprocedure) then
   raise exception 'NORMALIZATION_PRESERVATION_FAILED';
 end if;
end $normalize$;
commit;
