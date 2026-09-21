-- Forward-only deterministic legacy workspace assignment. No production approval
-- is implied by this file. Execute as a whole transaction under the migration role.
-- Strong explicit context precedes sole-owned-workspace inference; conflicts abort.
do $assignment$
declare original_guard text; branch text;
begin
 if session_user<>'postgres' or current_user<>'postgres' or current_setting('role')<>'none' then
   raise exception 'TRUSTED_DATABASE_MIGRATION_REQUIRED';
 end if;
 -- Freeze both the affected rows and their inference evidence until verification.
 lock table public.inventory_items in access exclusive mode;
 lock table public.workspaces,public.workspace_members,public.inventory_locations,
   public.chaos_sort_batches,public.chaos_sort_sessions,public.chaos_sort_inventory_positions,
   public.inventory_events,public.selling_inventory_allocations,
   public.selling_listing_candidates,public.inventory_label_identities,public.user_roles,
   public.marketplace_listing_mappings,public.marketplace_order_items,auth.users in share mode;
 create temporary table workspace_assignment_review on commit drop as
 -- BEGIN CLASSIFICATION
 with affected as (
   select * from public.inventory_items where workspace_id is null
 ), eligible as (
   select w.id,w.owner_id from public.workspaces w
   join public.workspace_members m on m.workspace_id=w.id and m.user_id=w.owner_id and m.role='owner'
   join auth.users u on u.id=w.owner_id where u.banned_until is null or u.banned_until<now()
 ), contexts as (
   select i.user_id,i.id,e.workspace_id::uuid workspace_id,'inventory_event'::text rule,1 priority
   from affected i join public.inventory_events e on e.user_id=i.user_id and e.inventory_item_id=i.id where e.workspace_id is not null
   union all
   select i.user_id,i.id,b.workspace_id,'chaos_batch',2 from affected i
   join public.chaos_sort_batches b on b.user_id=i.user_id and (b.id::text=i.data->>'batch_id'
     or exists(select 1 from public.chaos_sort_inventory_positions p where p.user_id=i.user_id and p.item_id=i.id and p.batch_id=b.id))
   where b.workspace_id is not null
   union all
   select i.user_id,i.id,a.workspace_id,'marketplace_allocation',3 from affected i
   join public.selling_inventory_allocations a on a.user_id=i.user_id and a.inventory_item_id=i.id where a.workspace_id is not null
   union all
   select i.user_id,i.id,c.workspace_id,'marketplace_candidate',4 from affected i
   join public.selling_listing_candidates c on c.user_id=i.user_id and c.inventory_item_id=i.id where c.workspace_id is not null
   union all
   select i.user_id,i.id,z.workspace_id,'canonical_identity',5 from affected i
   join public.inventory_label_identities z on z.inventory_user_id=i.user_id and z.inventory_item_id=i.id
 ), evidence as (
   select i.user_id,i.id,i.quantity,i.location_id,i.data->>'source' source,i.data->>'batch_id' batch_id,
    to_jsonb(i) old_row,
    (select count(*) from public.workspace_members m where m.user_id=i.user_id) membership_count,
    (select count(*) from public.workspaces w where w.owner_id=i.user_id) owned_workspace_count,
    (select count(*) from eligible w where w.owner_id=i.user_id) eligible_count,
    (select w.id from eligible w where w.owner_id=i.user_id order by w.id limit 1) sole_workspace,
    (select count(distinct c.workspace_id) from contexts c where c.user_id=i.user_id and c.id=i.id) context_count,
    (select c.workspace_id from contexts c where c.user_id=i.user_id and c.id=i.id order by c.priority,c.workspace_id limit 1) context_workspace,
    (select c.rule from contexts c where c.user_id=i.user_id and c.id=i.id order by c.priority,c.workspace_id limit 1) context_rule,
    exists(select 1 from contexts c where c.user_id=i.user_id and c.id=i.id and not exists(
      select 1 from eligible w where w.id=c.workspace_id and w.owner_id=i.user_id)) invalid_context,
    (i.location_id is not null and not exists(select 1 from public.inventory_locations l where l.user_id=i.user_id and l.id=i.location_id))
    or (i.quantity>0 and i.location_id is null)
    or (i.data->>'batch_id' is not null and not exists(select 1 from public.chaos_sort_batches b where b.user_id=i.user_id and b.id::text=i.data->>'batch_id'))
    or exists(select 1 from public.chaos_sort_inventory_positions p left join public.chaos_sort_batches b on b.id=p.batch_id
      left join public.chaos_sort_sessions s on s.id=b.session_id where p.user_id=i.user_id and p.item_id=i.id
      and (b.id is null or b.user_id<>i.user_id or (b.session_id is not null and (s.id is null or s.user_id<>i.user_id)))) invalid_relationship
   from affected i
 ), classified as (
   select *,case
     when context_count>1 then 'AMBIGUOUS'
     when invalid_context or invalid_relationship or eligible_count=0 then 'UNRESOLVED'
     when context_count=1 then 'DETERMINISTIC'
     when membership_count=1 and owned_workspace_count=1 and eligible_count=1 then 'DETERMINISTIC'
     when membership_count>1 or owned_workspace_count>1 then 'AMBIGUOUS'
     else 'UNRESOLVED' end classification
   from evidence
 ) select *,case when classification='DETERMINISTIC' then coalesce(context_workspace,sole_workspace) end target_workspace,
   case when classification='DETERMINISTIC' then coalesce(context_rule,'sole_eligible_owner_workspace') end inference_rule
 from classified
 -- END CLASSIFICATION
 ;
 revoke all on pg_temp.workspace_assignment_review from public,anon,authenticated,service_role;
 create unique index on pg_temp.workspace_assignment_review(user_id,id);
 -- This approval candidate is limited to the reviewed legacy cohort. Any drift
 -- requires a fresh review; a fully assigned environment is a harmless no-op.
 if not exists(select 1 from pg_temp.workspace_assignment_review) then
   drop table pg_temp.workspace_assignment_review; return;
 end if;
 if (select count(*) from pg_temp.workspace_assignment_review)<>1489
   or (select count(*) from pg_temp.workspace_assignment_review where quantity>0)<>1460
   or (select count(distinct user_id) from pg_temp.workspace_assignment_review)<>1
   or exists(select 1 from pg_temp.workspace_assignment_review r where not exists(
     select 1 from public.user_roles u where u.user_id=r.user_id and u.role::text='owner')) then
   raise exception 'WORKSPACE_ASSIGNMENT_COHORT_CHANGED';
 end if;
 if exists(select 1 from pg_temp.workspace_assignment_review where classification<>'DETERMINISTIC') then
   raise exception 'WORKSPACE_ASSIGNMENT_REVIEW_REQUIRED';
 end if;
 if exists(select 1 from pg_temp.workspace_assignment_review r where
   exists(select 1 from public.selling_inventory_allocations a where a.user_id=r.user_id and a.inventory_item_id=r.id)
   or exists(select 1 from public.selling_listing_candidates c where c.user_id=r.user_id and c.inventory_item_id=r.id)
   or exists(select 1 from public.marketplace_listing_mappings m where m.user_id=r.user_id and m.inventory_item_id=r.id)
   or exists(select 1 from public.marketplace_order_items o where o.user_id=r.user_id and o.inventory_item_id=r.id)) then
   raise exception 'WORKSPACE_ASSIGNMENT_MARKETPLACE_REVIEW_REQUIRED';
 end if;
 -- Exact row permit, transaction/backend bound, installed and removed inside
 -- this locked atomic statement. Never impersonates a user or disables triggers.
 original_guard:=pg_get_functiondef('public.enforce_collector_inventory_mutation()'::regprocedure);
 branch:=format($permit$
 if tg_op='UPDATE' and session_user='postgres' and current_setting('role')='none'
   and pg_backend_pid()=%s and txid_current()=%s then
   if exists(select 1 from pg_temp.workspace_assignment_review r where r.user_id=old.user_id and r.id=old.id
     and r.classification='DETERMINISTIC' and r.old_row=to_jsonb(old)
     and to_jsonb(new)=r.old_row||jsonb_build_object('workspace_id',r.target_workspace)) then return new; end if;
 end if;
 $permit$,pg_backend_pid(),txid_current());
 if original_guard !~* '\mbegin\M' then raise exception 'UNRECOGNIZED_COLLECTOR_GUARD'; end if;
 execute regexp_replace(original_guard,'\mbegin\M','begin'||branch,'i');
 update public.inventory_items i set workspace_id=r.target_workspace
 from pg_temp.workspace_assignment_review r where i.user_id=r.user_id and i.id=r.id and i.workspace_id is null;
 execute original_guard;
 if exists(select 1 from pg_temp.workspace_assignment_review r left join public.inventory_items i on i.user_id=r.user_id and i.id=r.id
   where to_jsonb(i) is distinct from r.old_row||jsonb_build_object('workspace_id',r.target_workspace)) then
   raise exception 'WORKSPACE_ASSIGNMENT_POSTCONDITION';
 end if;
 drop table pg_temp.workspace_assignment_review;
end $assignment$;
