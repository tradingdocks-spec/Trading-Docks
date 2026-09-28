-- Forward-only scan image extension. Requires separately authorized production application.
-- No inventory, ledger, positions, allocations, POS, storefront, or existing capture DML.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
lock table public.chaos_scan_albums, public.chaos_scan_captures in access exclusive mode;

-- Fail closed on command/capacity drift rather than replacing newer behavior.
do $preflight$
begin
 if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid='public.chaos_scan_command(text,jsonb)'::regprocedure)
    is distinct from '2481543b755c301f25830ca85f71e843'
 or (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid='chaos_scan_private.enforce_capture_capacity()'::regprocedure)
    is distinct from 'db53528a1dfac89bd94d7e53a411251f'
 then raise exception 'SCAN_IMAGES_BASELINE_DRIFT'; end if;
 if not exists(select 1 from pg_trigger where tgrelid='public.chaos_scan_captures'::regclass
   and tgname='scan_capture_capacity' and tgenabled='O'
   and tgfoid='chaos_scan_private.enforce_capture_capacity()'::regprocedure)
 or not (select relrowsecurity from pg_class where oid='public.chaos_scan_captures'::regclass)
 or not (select relrowsecurity from pg_class where oid='public.chaos_scan_albums'::regclass)
 or not exists(select 1 from pg_policy where polrelid='public.chaos_scan_albums'::regclass and polname='active_workspace_boundary' and not polpermissive)
 then raise exception 'SCAN_IMAGES_SECURITY_BASELINE_DRIFT'; end if;
end $preflight$;

alter table public.chaos_scan_captures
 add column back_object_path text unique,
 add column back_sha256 text check(back_sha256 ~ '^[a-f0-9]{64}$'),
 add constraint chaos_scan_back_pair check((back_object_path is null)=(back_sha256 is null)),
 add constraint chaos_scan_back_source check(back_object_path is null or
   (source_kind='image' and object_path is not null and back_object_path=left(object_path,length(object_path)-4)||'-back.jpg'));

-- Pair identity is chosen on INSERT only. Existing capacity/history trigger is untouched.
create function chaos_scan_private.guard_capture_images() returns trigger
language plpgsql set search_path='' as $images$
begin
 if (new.back_object_path,new.back_sha256) is distinct from (old.back_object_path,old.back_sha256)
 then raise exception 'SCAN_CAPTURE_IMAGES_IMMUTABLE'; end if;
 return new;
end $images$;
revoke all on function chaos_scan_private.guard_capture_images() from public,anon,authenticated,service_role;
create trigger scan_capture_images before update on public.chaos_scan_captures
 for each row execute function chaos_scan_private.guard_capture_images();

-- Existing owner and restrictive active-workspace RLS remains in force.
-- No new client grants and no UPDATE/DELETE Storage policy.
alter policy chaos_scan_object_read on storage.objects using(
 bucket_id='chaos-scans' and exists(select 1 from public.chaos_scan_captures c join public.chaos_scan_albums a on a.id=c.album_id
 where name in(c.object_path,c.back_object_path) and c.user_id=(select auth.uid()) and c.status not in('EXPIRED','REMOVED') and (a.expires_at is null or a.expires_at>now())));
alter policy chaos_scan_object_insert on storage.objects with check(
 bucket_id='chaos-scans' and exists(select 1 from public.chaos_scan_captures c join public.chaos_scan_albums a on a.id=c.album_id
 where name in(c.object_path,c.back_object_path) and c.user_id=(select auth.uid()) and c.status='RESERVED' and a.state='ACTIVE'));

-- Reviewed installed command plus pair reservation/receipt checks only.
-- CREATE OR REPLACE preserves the existing owner and EXECUTE ACL.
CREATE OR REPLACE FUNCTION public.chaos_scan_command(action text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
   return jsonb_build_object('album',to_jsonb(a),'captures',result,'physicalCount',(select count(*) from public.chaos_scan_captures where album_id=aid and status<>'REMOVED'),
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
   if a.intake_mode<>'live' then raise exception 'SCAN_MODE_CONFLICT: select Live Scan first'; end if;
   if coalesce(length(payload->>'workstationId'),0) not between 1 and 128 or coalesce(length(payload->>'deviceId'),0) not between 1 and 128 then raise exception 'SCAN_DEVICE_INVALID'; end if;
   update public.chaos_scan_albums set workstation_id=payload->>'workstationId',device_id=payload->>'deviceId',backend=payload->>'backend' where id=aid returning * into a;
   return to_jsonb(a); -- devices are local; allocation remains transactionally serialized.
 elsif action='mode' then
   mode:=payload->>'intakeMode';
   if mode is null or mode not in ('live','upload','csv') then raise exception 'SCAN_INTAKE_MODE_INVALID'; end if;
   -- A response-loss retry may confirm an already applied transition.
   if a.intake_mode=mode then return jsonb_build_object('intake_mode',a.intake_mode); end if;
   if payload->>'expectedMode' is distinct from a.intake_mode then raise exception 'SCAN_MODE_CONFLICT: reload cloud draft'; end if;
   -- Reservations and unfinished recognition/review persistence can belong to
   -- another browser. Never change intake underneath those accepted captures.
   if exists(select 1 from public.chaos_scan_captures where album_id=aid and
      (status='RESERVED' or (status='RECEIVED' and
       (item is null or coalesce(item->>'processingState','processing') not in ('ready','failed'))))) then
     raise exception 'SCAN_INTAKE_BUSY: finish pending intake before changing mode';
   end if;
   update public.chaos_scan_albums set intake_mode=mode where id=aid;
   return jsonb_build_object('intake_mode',mode);
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
     if c.album_id<>aid or c.user_id<>actor or c.sha256<>payload->>'sha256' or c.back_sha256 is distinct from payload->>'backSha256' then raise exception 'SCAN_CAPTURE_CONFLICT'; end if;
     return to_jsonb(c); -- idempotent retry; never allocate a duplicate slot.
   end if;
   select coalesce(max(ordinal),0)+1 into n from public.chaos_scan_captures where album_id=aid;
   if (select count(*) from public.chaos_scan_captures where album_id=aid and status<>'REMOVED')>=100 then raise exception 'SCAN_BATCH_FULL'; end if;
   if action='csv' and a.intake_mode<>'csv' then raise exception 'SCAN_MODE_CONFLICT'; end if;
   if payload->>'backSha256' is not null and (action<>'reserve' or payload->>'backSha256' !~ '^[a-f0-9]{64}$') then raise exception 'SCAN_BACK_INVALID'; end if;
   insert into public.chaos_scan_captures(capture_id,album_id,user_id,ordinal,object_path,sha256,source_kind,status,back_object_path,back_sha256)
   values(cid,aid,actor,n,case when action='reserve' then wid::text||'/'||aid::text||'/'||cid::text||'.jpg' end,payload->>'sha256',case when action='csv' then 'csv' else 'image' end,case when action='csv' then 'RECEIVED' else 'RESERVED' end,case when payload->>'backSha256' is not null then wid::text||'/'||aid::text||'/'||cid::text||'-back.jpg' end,payload->>'backSha256') returning * into c;
   if action='csv' and payload ? 'item' then
     entry:=payload->'item';
     if entry->>'id' is distinct from cid::text or entry->>'captureId' is distinct from cid::text or entry->>'batchId' is distinct from aid::text or (entry->>'quantity')::numeric is distinct from 1::numeric then raise exception 'SCAN_ITEM_INVALID'; end if;
     update public.chaos_scan_captures set item=entry,revision=1 where capture_id=cid returning * into c;
   end if;
   return to_jsonb(c);
 elsif action='received' then
   select * into c from public.chaos_scan_captures where capture_id=(payload->>'captureId')::uuid and album_id=aid;
   if c.status='REMOVED' then return to_jsonb(c); end if;
   if c.back_object_path is not null and not exists(select 1 from storage.objects where bucket_id='chaos-scans' and name=c.back_object_path) then raise exception 'SCAN_BACK_UPLOAD_MISSING'; end if;
   if c.capture_id is null or not exists(select 1 from storage.objects where bucket_id='chaos-scans' and name=c.object_path) then raise exception 'SCAN_UPLOAD_MISSING'; end if;
   update public.chaos_scan_captures set status='RECEIVED' where capture_id=c.capture_id and status='RESERVED';
   return to_jsonb(c)||jsonb_build_object('status','RECEIVED');
 elsif action='review' then
   cid:=(payload->>'captureId')::uuid; entry:=payload->'item';
   select * into c from public.chaos_scan_captures where capture_id=cid and album_id=aid;
   if c.capture_id is null or (c.status not in ('RECEIVED','REMOVED') and coalesce(entry->>'humanState','')<>'removed') then raise exception 'SCAN_CAPTURE_NOT_RECEIVED'; end if;
   if entry is null or entry->>'id' is distinct from cid::text or entry->>'captureId' is distinct from cid::text or entry->>'batchId' is distinct from aid::text or (entry->>'quantity')::numeric is distinct from 1::numeric then raise exception 'SCAN_ITEM_INVALID'; end if;
   if c.status='REMOVED' then
     if entry->>'humanState'='removed' then return jsonb_build_object('revision',c.revision); end if;
     raise exception 'SCAN_CAPTURE_REMOVED_IMMUTABLE';
   end if;
   if c.item=entry then return jsonb_build_object('revision',c.revision); end if;
   if coalesce((payload->>'revision')::integer,0)<>c.revision then raise exception 'SCAN_REVIEW_CONFLICT: reload cloud review before editing'; end if;
   update public.chaos_scan_captures set item=entry,revision=revision+1,status=case when entry->>'humanState'='removed' then 'REMOVED' else 'RECEIVED' end where capture_id=cid returning * into c;
   return jsonb_build_object('revision',c.revision);
 elsif action='commit' then
   if not exists(select 1 from public.chaos_scan_captures where album_id=aid and status='RECEIVED') or exists(select 1 from public.chaos_scan_captures where album_id=aid and status<>'REMOVED' and (status<>'RECEIVED' or item is null or coalesce(item->>'humanState','') not in ('confirmed','edited') or coalesce(item->>'processingState','')<>'ready' or coalesce(item->>'recognitionState','unknown')='unknown' or coalesce(item->>'cardName','')='' or coalesce(item->>'setCode','')='' or coalesce(item->>'collectorNumber','')='')) then raise exception 'SCAN_REVIEW_REQUIRED'; end if;
   update public.chaos_scan_albums set state='COMMITTING' where id=aid;
   select public.commit_chaos_sort_batch(jsonb_build_object('batch',jsonb_build_object('id',aid,'batchCode',a.batch_code,'workspaceId',wid,'destinationLocationId',a.destination_id,'destinationLabel',a.destination_label,'intakeMode',a.intake_mode,'targetBatchSize',100,'title',a.settings->>'title','acquisitionCost',a.settings->'acquisitionCost'),'items',jsonb_agg(item||jsonb_build_object('sourceImageUrl',null,'destinationLocationId',a.destination_id,'destinationLabel',a.destination_label)),'rules',coalesce(a.settings->'rules','[]'::jsonb))) into result from public.chaos_scan_captures where album_id=aid and status='RECEIVED';
   update public.chaos_sort_batches set title=coalesce(a.settings->>'title',title),acquisition_cost=(a.settings->>'acquisitionCost')::numeric,sort_plan=coalesce(a.settings->'rules','[]'::jsonb),physical_card_count=(select count(*) from public.chaos_scan_captures where album_id=aid and status<>'REMOVED') where id=aid;
   update public.chaos_scan_albums set state='CLOSED',committed_at=now(),expires_at=now()+interval '30 days' where id=aid;
   return result;
 end if;
 raise exception 'SCAN_COMMAND_INVALID';
end $function$;

notify pgrst, 'reload schema';
commit;
