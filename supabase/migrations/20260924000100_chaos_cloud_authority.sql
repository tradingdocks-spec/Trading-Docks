-- Forward-only. Rehearse after scan albums V2; no historical quantity repair.
create table chaos_scan_private.batch_counters (
 owner_id uuid primary key references auth.users(id), last_number bigint not null check(last_number>=0)
);
revoke all on chaos_scan_private.batch_counters from public,anon,authenticated;
insert into chaos_scan_private.batch_counters
 select user_id,max(substring(batch_code from '^CS-([0-9]+)$')::bigint)
 from (select user_id,batch_code from public.chaos_sort_batches union all select user_id,batch_code from public.chaos_scan_albums) b
 where batch_code ~ '^CS-[0-9]+$' group by user_id;
-- Fail on existing collisions rather than renumber history.
create unique index chaos_batch_owner_code on public.chaos_sort_batches(user_id,batch_code);
create index chaos_batch_history_page on public.chaos_sort_batches(user_id,created_at desc,id desc);
alter table public.chaos_scan_albums add column creation_key uuid unique,
 add column settings jsonb not null default '{}'::jsonb check(jsonb_typeof(settings)='object'),
 add column settings_revision integer not null default 0,
 add column intake_mode text not null default 'live' check(intake_mode in ('live','upload','csv'));
alter table public.chaos_scan_captures add column revision integer not null default 0,
 add column source_kind text not null default 'image' check(source_kind in ('image','csv'));
alter table public.chaos_scan_captures alter column object_path drop not null;
alter table public.chaos_sort_batches add column physical_card_count integer check(physical_card_count between 0 and 100);

-- Batch metadata may change only inside the trusted commit, never by a browser UPDATE.
create or replace function chaos_scan_private.guard_batch() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.chaos_scan_albums%rowtype;
begin
 select * into a from public.chaos_scan_albums where id=case when tg_op='DELETE' then old.id else new.id end;
 if a.id is null then
   if tg_op='INSERT' then raise exception 'SCAN_CREATE_CLOUD_DRAFT_FIRST'; end if;
   if tg_op='UPDATE' and old.status_v2='CLOSED' and (to_jsonb(new)-'current_quantity'-'updated_at') is distinct from (to_jsonb(old)-'current_quantity'-'updated_at') then raise exception 'SCAN_BATCH_IMMUTABLE'; end if;
   if tg_op='DELETE' then
     if old.status_v2='CLOSED' then raise exception 'SCAN_BATCH_IMMUTABLE'; end if;
     return old;
   end if;
   return new;
 end if;
 if tg_op='DELETE' then raise exception 'SCAN_BATCH_IMMUTABLE'; end if;
 if a.user_id<>new.user_id or a.workspace_id is distinct from new.workspace_id or a.batch_code<>new.batch_code then raise exception 'SCAN_SCOPE_MISMATCH'; end if;
 if a.state='ACTIVE' and not (tg_op='INSERT' and new.status='draft' and new.initial_quantity=0 and new.source_count=0) then raise exception 'SCAN_USE_AUTHORITATIVE_COMMIT'; end if;
 if new.source_count>100 or new.initial_quantity>100 then raise exception 'SCAN_BATCH_FULL'; end if;
 if a.state='CLOSED' and (to_jsonb(new)-'current_quantity'-'updated_at') is distinct from (to_jsonb(old)-'current_quantity'-'updated_at') then raise exception 'SCAN_BATCH_IMMUTABLE'; end if;
 return new;
end $$;

create or replace function public.chaos_scan_command(action text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); wid uuid; aid uuid:=nullif(payload->>'batchId','')::uuid;
 a public.chaos_scan_albums%rowtype; c public.chaos_scan_captures%rowtype;
 cid uuid; n bigint; result jsonb; entry jsonb; mode text; key uuid;
begin
 if actor is null then raise exception 'SCAN_UNAUTHORIZED' using errcode='42501'; end if;
 select active_workspace_id into wid from public.user_preferences where user_id=actor;
 if wid is null or not exists(select 1 from public.workspaces w join public.workspace_members m on m.workspace_id=w.id and m.user_id=actor and m.role='owner' where w.id=wid and w.owner_id=actor) then raise exception 'SCAN_UNAUTHORIZED' using errcode='42501'; end if;
 -- Owner numbering spans that owner's workspaces; no cross-workspace counter race.
 perform pg_advisory_xact_lock(hashtextextended('chaos-owner:'||actor::text,0));
 if action='current' then
   select * into a from public.chaos_scan_albums where user_id=actor and workspace_id=wid and (state<>'CLOSED' or label_confirmed_at is null) order by created_at desc limit 1;
   aid:=a.id;
 elsif action='create' then
   key:=(payload->>'requestId')::uuid;
   if key is null then raise exception 'SCAN_REQUEST_ID_REQUIRED'; end if;
   select * into a from public.chaos_scan_albums where creation_key=key;
   if a.id is not null then
     if a.user_id<>actor or a.workspace_id<>wid then raise exception 'SCAN_UNAUTHORIZED'; end if;
     return to_jsonb(a);
   end if;
   if exists(select 1 from public.chaos_scan_albums where user_id=actor and workspace_id=wid and (state<>'CLOSED' or label_confirmed_at is null)) then raise exception 'RESUME_OR_PRINT_PREVIOUS_BATCH'; end if;
   if not exists(select 1 from public.inventory_locations where user_id=actor and id=payload->>'destinationId') then raise exception 'SCAN_LOCATION_INVALID'; end if;
   mode:=coalesce(payload->>'intakeMode','upload');
   insert into chaos_scan_private.batch_counters values(actor,1) on conflict(owner_id) do update set last_number=chaos_scan_private.batch_counters.last_number+1 returning last_number into n;
   aid:=gen_random_uuid();
   insert into public.chaos_scan_albums(id,user_id,workspace_id,batch_code,destination_id,destination_label,workstation_id,device_id,backend,creation_key,intake_mode)
   values(aid,actor,wid,'CS-'||lpad(n::text,greatest(6,length(n::text)), '0'),payload->>'destinationId',(select name from public.inventory_locations where id=payload->>'destinationId' and user_id=actor),'unassigned','unassigned','unassigned',key,mode) returning * into a;
   insert into public.chaos_sort_batches(id,user_id,workspace_id,batch_code,title,status,status_v2,destination_location_id,destination_label,target_quantity,initial_quantity,current_quantity,source_count)
   values(aid,actor,wid,a.batch_code,'Chaos Sort batch','draft','ACTIVE',a.destination_id,a.destination_label,100,0,0,0);
   return to_jsonb(a);
 else
   select * into a from public.chaos_scan_albums where id=aid for update;
 end if;
 if a.id is not null and (a.user_id<>actor or a.workspace_id<>wid) then raise exception 'SCAN_UNAUTHORIZED' using errcode='42501'; end if;
 if action in ('current','snapshot') then
   if a.id is null then return jsonb_build_object('album',null,'captures','[]'::jsonb); end if;
   select coalesce(jsonb_agg(to_jsonb(s) order by s.ordinal),'[]'::jsonb) into result from public.chaos_scan_captures s where album_id=aid;
   return jsonb_build_object('album',to_jsonb(a),'captures',result,'physicalCount',jsonb_array_length(result),
     'lifecycle',case when a.state='CLOSED' then 'CLOSED' when not exists(select 1 from public.chaos_scan_captures where album_id=aid) then 'DRAFT'
       when exists(select 1 from public.chaos_scan_captures where album_id=aid and (status='RESERVED' or item is null or coalesce(item->>'humanState','') not in ('confirmed','edited','removed'))) then 'REVIEW' else 'READY_TO_COMMIT' end);
 end if;
 if a.id is null then raise exception 'SCAN_SESSION_NOT_FOUND'; end if;
 if action='label' then
   if a.state<>'CLOSED' then raise exception 'SCAN_BATCH_NOT_COMMITTED'; end if;
   update public.chaos_scan_albums set label_confirmed_at=coalesce(label_confirmed_at,now()) where id=aid;
   return jsonb_build_object('ok',true);
 end if;
 if action='commit' and a.state='CLOSED' then return jsonb_build_object('ok',true,'replayed',true,'batchId',aid,'committedCount',(select initial_quantity from public.chaos_sort_batches where id=aid)); end if;
 if a.state<>'ACTIVE' then raise exception 'SCAN_BATCH_CLOSED'; end if;
 if action='start' then
   if coalesce(length(payload->>'workstationId'),0) not between 1 and 128 or coalesce(length(payload->>'deviceId'),0) not between 1 and 128 then raise exception 'SCAN_DEVICE_INVALID'; end if;
   update public.chaos_scan_albums set workstation_id=payload->>'workstationId',device_id=payload->>'deviceId',backend=payload->>'backend' where id=aid returning * into a;
   return to_jsonb(a); -- devices are local; allocation remains transactionally serialized.
 elsif action='settings' then
   entry:=payload->'settings';
   if jsonb_typeof(entry) is distinct from 'object' or length(entry::text)>100000
      or (entry ? 'acquisitionCost' and entry->>'acquisitionCost' is not null and (entry->>'acquisitionCost')::numeric<0)
      or (entry ? 'rules' and jsonb_typeof(entry->'rules')<>'array') then raise exception 'SCAN_SETTINGS_INVALID'; end if;
   if a.settings=entry then return jsonb_build_object('revision',a.settings_revision); end if;
   if coalesce((payload->>'revision')::integer,0)<>a.settings_revision then raise exception 'SCAN_SETTINGS_CONFLICT: reload cloud draft'; end if;
   update public.chaos_scan_albums set settings=entry,settings_revision=settings_revision+1 where id=aid returning * into a;
   return jsonb_build_object('revision',a.settings_revision);
 elsif action in ('reserve','csv') then
   cid:=(payload->>'captureId')::uuid;
   select * into c from public.chaos_scan_captures where capture_id=cid;
   if c.capture_id is not null then
     if c.album_id<>aid or c.user_id<>actor or c.sha256<>payload->>'sha256' then raise exception 'SCAN_CAPTURE_CONFLICT'; end if;
     return to_jsonb(c); -- idempotent retry; never allocate a duplicate slot.
   end if;
   select coalesce(max(ordinal),0)+1 into n from public.chaos_scan_captures where album_id=aid;
   if n>100 then raise exception 'SCAN_BATCH_FULL'; end if;
   if action='csv' and a.intake_mode<>'csv' then raise exception 'SCAN_MODE_CONFLICT'; end if;
   insert into public.chaos_scan_captures(capture_id,album_id,user_id,ordinal,object_path,sha256,source_kind,status)
   values(cid,aid,actor,n,case when action='reserve' then wid::text||'/'||aid::text||'/'||cid::text||'.jpg' end,payload->>'sha256',case when action='csv' then 'csv' else 'image' end,case when action='csv' then 'RECEIVED' else 'RESERVED' end) returning * into c;
   if action='csv' and payload ? 'item' then
     entry:=payload->'item';
     if entry->>'id' is distinct from cid::text or entry->>'captureId' is distinct from cid::text or entry->>'batchId' is distinct from aid::text or (entry->>'quantity')::numeric is distinct from 1::numeric then raise exception 'SCAN_ITEM_INVALID'; end if;
     update public.chaos_scan_captures set item=entry,revision=1 where capture_id=cid returning * into c;
   end if;
   return to_jsonb(c);
 elsif action='received' then
   select * into c from public.chaos_scan_captures where capture_id=(payload->>'captureId')::uuid and album_id=aid;
   if c.capture_id is null or not exists(select 1 from storage.objects where bucket_id='chaos-scans' and name=c.object_path) then raise exception 'SCAN_UPLOAD_MISSING'; end if;
   update public.chaos_scan_captures set status='RECEIVED' where capture_id=c.capture_id and status='RESERVED';
   return to_jsonb(c)||jsonb_build_object('status','RECEIVED');
 elsif action='review' then
   cid:=(payload->>'captureId')::uuid; entry:=payload->'item';
   select * into c from public.chaos_scan_captures where capture_id=cid and album_id=aid;
   if c.capture_id is null or c.status not in ('RECEIVED','REMOVED') then raise exception 'SCAN_CAPTURE_NOT_RECEIVED'; end if;
   if entry is null or entry->>'id' is distinct from cid::text or entry->>'captureId' is distinct from cid::text or entry->>'batchId' is distinct from aid::text or (entry->>'quantity')::numeric is distinct from 1::numeric then raise exception 'SCAN_ITEM_INVALID'; end if;
   if c.item=entry then return jsonb_build_object('revision',c.revision); end if;
   if coalesce((payload->>'revision')::integer,0)<>c.revision then raise exception 'SCAN_REVIEW_CONFLICT: reload cloud review before editing'; end if;
   update public.chaos_scan_captures set item=entry,revision=revision+1,status=case when entry->>'humanState'='removed' then 'REMOVED' else 'RECEIVED' end where capture_id=cid returning * into c;
   return jsonb_build_object('revision',c.revision);
 elsif action='commit' then
   if not exists(select 1 from public.chaos_scan_captures where album_id=aid and status='RECEIVED') or exists(select 1 from public.chaos_scan_captures where album_id=aid and status<>'REMOVED' and (status<>'RECEIVED' or item is null or coalesce(item->>'humanState','') not in ('confirmed','edited') or coalesce(item->>'processingState','')<>'ready' or coalesce(item->>'recognitionState','unknown')='unknown' or coalesce(item->>'cardName','')='' or coalesce(item->>'setCode','')='' or coalesce(item->>'collectorNumber','')='')) then raise exception 'SCAN_REVIEW_REQUIRED'; end if;
   update public.chaos_scan_albums set state='COMMITTING' where id=aid;
   select public.commit_chaos_sort_batch(jsonb_build_object('batch',jsonb_build_object('id',aid,'batchCode',a.batch_code,'workspaceId',wid,'destinationLocationId',a.destination_id,'destinationLabel',a.destination_label,'intakeMode',a.intake_mode,'targetBatchSize',100,'title',a.settings->>'title','acquisitionCost',a.settings->'acquisitionCost'),'items',jsonb_agg(item||jsonb_build_object('sourceImageUrl',null,'destinationLocationId',a.destination_id,'destinationLabel',a.destination_label)),'rules',coalesce(a.settings->'rules','[]'::jsonb))) into result from public.chaos_scan_captures where album_id=aid and status='RECEIVED';
   update public.chaos_sort_batches set title=coalesce(a.settings->>'title',title),acquisition_cost=(a.settings->>'acquisitionCost')::numeric,sort_plan=coalesce(a.settings->'rules','[]'::jsonb),physical_card_count=(select count(*) from public.chaos_scan_captures where album_id=aid) where id=aid;
   update public.chaos_scan_albums set state='CLOSED',committed_at=now(),expires_at=now()+interval '30 days' where id=aid;
   return result;
 end if;
 raise exception 'SCAN_COMMAND_INVALID';
end $$;


-- Preserve reviewed language/game metadata through the existing authoritative writer.
-- Abort on an unexpected writer definition instead of replacing unrelated authority code.
do $metadata$
declare definition text; old_fragment text; new_fragment text;
begin
 definition:=pg_get_functiondef('public.commit_chaos_sort_batch(jsonb)'::regprocedure);
 old_fragment:=$old$jsonb_build_object('source', 'chaos_sort', 'batch_id', batch_id, 'batch_code', batch_payload->>'batchCode', 'condition', item->>'condition', 'finish', item->>'finish')$old$;
 new_fragment:=$new$jsonb_build_object('source', 'chaos_sort', 'batch_id', batch_id, 'batch_code', batch_payload->>'batchCode', 'condition', item->>'condition', 'finish', item->>'finish', 'language', nullif(item->>'language',''), 'game_id', nullif(item->>'gameId',''))$new$;
 if strpos(definition,old_fragment)=0 then raise exception 'CHAOS_WRITER_METADATA_BASELINE_DRIFT'; end if;
 definition:=replace(definition,old_fragment,new_fragment);
 old_fragment:='collector_number, finish, condition, quantity, location_id)';
 if strpos(definition,old_fragment)=0 then raise exception 'CHAOS_POSITION_METADATA_BASELINE_DRIFT'; end if;
 definition:=replace(definition,old_fragment,'collector_number, finish, condition, language, quantity, location_id)');
 old_fragment:=$old$nullif(item->>'condition', ''), item_quantity, location_id)$old$;
 if strpos(definition,old_fragment)=0 then raise exception 'CHAOS_POSITION_VALUE_BASELINE_DRIFT'; end if;
 definition:=replace(definition,old_fragment,$new$nullif(item->>'condition', ''), nullif(item->>'language', ''), item_quantity, location_id)$new$);
 old_fragment:='condition, finish, idempotency_key, metadata)';
 if strpos(definition,old_fragment)=0 then raise exception 'CHAOS_EVENT_METADATA_BASELINE_DRIFT'; end if;
 definition:=replace(definition,old_fragment,'condition, finish, language, game_id, idempotency_key, metadata)');
 old_fragment:=$old$nullif(item->>'finish', ''), 'chaos-sort-commit:'$old$;
 if strpos(definition,old_fragment)=0 then raise exception 'CHAOS_EVENT_VALUE_BASELINE_DRIFT'; end if;
 definition:=replace(definition,old_fragment,$new$nullif(item->>'finish', ''), nullif(item->>'language',''), nullif(item->>'gameId',''), 'chaos-sort-commit:'$new$);
 execute definition;
end $metadata$;

-- Read-only reconciliation: no historical normalization in this migration.
create function public.chaos_batch_history(p_before timestamptz default null,p_id uuid default null,p_limit integer default 25) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id desc),'[]'::jsonb) from (
 select b.id,b.batch_code,b.status,b.status_v2,b.destination_label,b.created_at,b.completed_at,b.user_id as created_by,b.workspace_id,b.initial_quantity,
 b.current_quantity as stored_current_quantity,coalesce(q.units,0) as current_quantity,coalesce(q.positions,0) as position_quantity,
 coalesce(q.ledger,0) as ledger_quantity,coalesce(q.consistent,b.initial_quantity=0) as reconciled,
 (select count(*) from public.chaos_scan_captures c where c.album_id=b.id) as physical_count
 from (select * from public.chaos_sort_batches where user_id=auth.uid() and
 (workspace_id=(select active_workspace_id from public.user_preferences where user_id=auth.uid()) or workspace_id is null)
 and (p_before is null or (created_at,id)<(p_before,p_id)) order by created_at desc,id desc limit least(greatest(p_limit,1),50)) b
 left join lateral(select sum(i.quantity) units,sum(p.quantity) positions,sum(e.units) ledger,bool_and(i.quantity=p.quantity and i.quantity is not distinct from e.units) consistent
 from public.chaos_sort_inventory_positions p join public.inventory_items i on i.user_id=p.user_id and i.id=p.item_id
 left join lateral(select sum(quantity_change) units from public.inventory_events where user_id=p.user_id and inventory_item_id=p.item_id)e on true where p.batch_id=b.id)q on true
 )r
$$;
revoke all on function public.chaos_batch_history(timestamptz,uuid,integer) from public,anon;
grant execute on function public.chaos_batch_history(timestamptz,uuid,integer) to authenticated;

revoke insert,update,delete on public.chaos_sort_batches from authenticated;
-- Deferred until authoritative inventory/position/event commands have finished.
-- This also runs after POS's legacy arithmetic, so quantities cannot be decremented twice.
create function chaos_scan_private.refresh_remaining() returns trigger language plpgsql security definer set search_path='' as $$
declare batch uuid; owner uuid; item text;
begin
 owner:=case when tg_op='DELETE' then old.user_id else new.user_id end;
 item:=case when tg_op='DELETE' then old.id else new.id end;
 for batch in select distinct batch_id from public.chaos_sort_inventory_positions where user_id=owner and item_id=item order by batch_id loop
   perform 1 from public.chaos_sort_batches where id=batch and user_id=owner for update;
   update public.chaos_sort_batches b set current_quantity=(select coalesce(sum(i.quantity),0) from public.chaos_sort_inventory_positions p join public.inventory_items i on i.user_id=p.user_id and i.id=p.item_id where p.batch_id=batch),updated_at=now()
   where b.id=batch and b.user_id=owner and b.status_v2='CLOSED';
 end loop;
 return null;
end $$;
revoke all on function chaos_scan_private.refresh_remaining() from public,anon,authenticated;
create constraint trigger chaos_remaining_after_inventory after insert or update or delete on public.inventory_items
deferrable initially deferred for each row execute function chaos_scan_private.refresh_remaining();
