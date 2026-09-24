-- LOCAL REHEARSAL ONLY until separately approved. No POS/payment enablement.
create table public.chaos_scan_albums (
 id uuid primary key, user_id uuid not null references auth.users(id),
 workspace_id uuid not null references public.workspaces(id),
 batch_code text not null, destination_id text not null, destination_label text not null,
 workstation_id text not null, device_id text not null, backend text not null,
 state text not null default 'ACTIVE' check(state in ('ACTIVE','COMMITTING','CLOSED')),
 created_at timestamptz not null default now(), committed_at timestamptz,
 label_confirmed_at timestamptz, expires_at timestamptz, scans_purged_at timestamptz,
 unique(user_id,batch_code)
);
create index chaos_scan_albums_workspace on public.chaos_scan_albums(workspace_id,user_id);
create index chaos_scan_albums_retention on public.chaos_scan_albums(expires_at) where state='CLOSED';
create table public.chaos_scan_captures (
 capture_id uuid primary key, album_id uuid not null references public.chaos_scan_albums(id),
 user_id uuid not null references auth.users(id), ordinal integer not null check(ordinal between 1 and 100),
 object_path text not null unique, sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 status text not null default 'RESERVED' check(status in ('RESERVED','RECEIVED','REMOVED','EXPIRED')),
 item jsonb, captured_at timestamptz not null default now(), unique(album_id,ordinal)
);
create index chaos_scan_captures_owner on public.chaos_scan_captures(user_id,album_id);
alter table public.chaos_scan_albums enable row level security;
alter table public.chaos_scan_captures enable row level security;
revoke all on public.chaos_scan_albums,public.chaos_scan_captures from anon,authenticated;
grant select on public.chaos_scan_albums,public.chaos_scan_captures to authenticated;
create policy chaos_scan_album_owner on public.chaos_scan_albums for select to authenticated using(user_id=(select auth.uid()) and workspace_id=(select active_workspace_id from public.user_preferences where user_id=(select auth.uid())) and exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid())));
create policy chaos_scan_capture_owner on public.chaos_scan_captures for select to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.chaos_scan_albums a where a.id=album_id));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('chaos-scans','chaos-scans',false,8388608,array['image/jpeg']);
create policy chaos_scan_object_read on storage.objects for select to authenticated
using(bucket_id='chaos-scans' and exists(select 1 from public.chaos_scan_captures c join public.chaos_scan_albums a on a.id=c.album_id where c.object_path=name and c.user_id=(select auth.uid()) and c.status<>'EXPIRED' and (a.expires_at is null or a.expires_at>now())));
create policy chaos_scan_object_insert on storage.objects for insert to authenticated
with check(bucket_id='chaos-scans' and exists(select 1 from public.chaos_scan_captures c join public.chaos_scan_albums a on a.id=c.album_id where c.object_path=name and c.user_id=(select auth.uid()) and c.status='RESERVED' and a.state='ACTIVE'));
-- No client UPDATE/DELETE: captured objects cannot be overwritten or moved.

create schema if not exists chaos_scan_private;
revoke all on schema chaos_scan_private from public,anon,authenticated;
create or replace function public.chaos_scan_command(action text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); aid uuid:=(payload->>'batchId')::uuid; wid uuid;
 a public.chaos_scan_albums%rowtype; c public.chaos_scan_captures%rowtype;
 cid uuid; n integer; result jsonb; entry jsonb; active_count integer;
begin
 if actor is null then raise exception 'SCAN_UNAUTHORIZED' using errcode='42501'; end if;
 select active_workspace_id into wid from public.user_preferences where user_id=actor;
 if wid is null or not exists(select 1 from public.workspaces where id=wid and owner_id=actor)
 or not exists(select 1 from public.workspace_members where workspace_id=wid and user_id=actor and role='owner') then raise exception 'SCAN_UNAUTHORIZED' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('chaos-scan:'||wid::text,0));
 select * into a from public.chaos_scan_albums where id=aid for update;
 if a.id is not null and (a.user_id<>actor or a.workspace_id<>wid) then raise exception 'SCAN_UNAUTHORIZED' using errcode='42501'; end if;
 if action='start' then
   if a.id is not null then
     if a.state<>'ACTIVE' or a.device_id<>payload->>'deviceId' or a.workstation_id<>payload->>'workstationId' or a.destination_id<>payload->>'destinationId' then raise exception 'SCAN_SESSION_CONFLICT'; end if;
     return to_jsonb(a);
   end if;
   if exists(select 1 from public.chaos_sort_batches where id=aid) then raise exception 'SCAN_BATCH_CLOSED_OR_EXISTS'; end if;
   if exists(select 1 from public.chaos_scan_albums where user_id=actor and workspace_id=wid and (state<>'CLOSED' or label_confirmed_at is null)) then raise exception 'PRINT_AND_FILE_PREVIOUS_BATCH'; end if;
   if not exists(select 1 from public.inventory_locations where id=payload->>'destinationId' and user_id=actor) then raise exception 'SCAN_LOCATION_INVALID'; end if;
   if coalesce(length(payload->>'deviceId'),0) not between 1 and 128 or coalesce(length(payload->>'workstationId'),0) not between 1 and 128 or coalesce(length(payload->>'backend'),0) not between 1 and 50 then raise exception 'SCAN_DEVICE_INVALID'; end if;
   select coalesce(max(substring(batch_code from '^CS-([0-9]+)$')::integer),0)+1 into n from (select batch_code from public.chaos_sort_batches where user_id=actor union all select batch_code from public.chaos_scan_albums where user_id=actor) codes;
   insert into public.chaos_scan_albums(id,user_id,workspace_id,batch_code,destination_id,destination_label,workstation_id,device_id,backend)
   values(aid,actor,wid,'CS-'||lpad(n::text,6,'0'),payload->>'destinationId',(select name from public.inventory_locations where id=payload->>'destinationId' and user_id=actor),payload->>'workstationId',payload->>'deviceId',payload->>'backend') returning * into a;
   return to_jsonb(a);
 end if;
 if a.id is null then raise exception 'SCAN_SESSION_NOT_FOUND'; end if;
 if action='label' then
   if a.state<>'CLOSED' then raise exception 'SCAN_BATCH_NOT_COMMITTED'; end if;
   update public.chaos_scan_albums set label_confirmed_at=coalesce(label_confirmed_at,now()) where id=aid;
   return jsonb_build_object('ok',true);
 end if;
 if action='commit' and a.state='CLOSED' then return jsonb_build_object('ok',true,'replayed',true,'batchId',aid,'committedCount',(select initial_quantity from public.chaos_sort_batches where id=aid)); end if;
 if a.state<>'ACTIVE' then raise exception 'SCAN_BATCH_CLOSED'; end if;
 if action='reserve' then
   cid:=(payload->>'captureId')::uuid;
   select * into c from public.chaos_scan_captures where capture_id=cid;
   if c.capture_id is not null then
     if c.album_id<>aid or c.user_id<>actor or c.sha256<>payload->>'sha256' then raise exception 'SCAN_CAPTURE_CONFLICT'; end if;
     return to_jsonb(c);
   end if;
   select coalesce(max(ordinal),0)+1 into n from public.chaos_scan_captures where album_id=aid;
   if n>100 then raise exception 'SCAN_BATCH_FULL'; end if;
   insert into public.chaos_scan_captures(capture_id,album_id,user_id,ordinal,object_path,sha256)
   values(cid,aid,actor,n,wid::text||'/'||aid::text||'/'||cid::text||'.jpg',payload->>'sha256') returning * into c;
   return to_jsonb(c);
 elsif action='received' then
   cid:=(payload->>'captureId')::uuid;
   select * into c from public.chaos_scan_captures where capture_id=cid and album_id=aid and user_id=actor;
   if c.capture_id is null or not exists(select 1 from storage.objects where bucket_id='chaos-scans' and name=c.object_path) then raise exception 'SCAN_UPLOAD_MISSING'; end if;
   update public.chaos_scan_captures set status='RECEIVED' where capture_id=cid and status='RESERVED';
   return to_jsonb(c)||jsonb_build_object('status','RECEIVED');
 elsif action='review' then
   cid:=(payload->>'captureId')::uuid;
   entry:=payload->'item';
   if entry is null or entry->>'id' is distinct from cid::text or entry->>'captureId' is distinct from cid::text or entry->>'batchId' is distinct from aid::text or (entry->>'quantity')::numeric is distinct from 1::numeric then raise exception 'SCAN_ITEM_INVALID'; end if;
   update public.chaos_scan_captures set item=entry,status=case when entry->>'humanState'='removed' then 'REMOVED' else 'RECEIVED' end where capture_id=cid and album_id=aid and status in ('RECEIVED','REMOVED');
   if not found then raise exception 'SCAN_CAPTURE_NOT_RECEIVED'; end if;
   return jsonb_build_object('ok',true);
 elsif action='commit' then
   select count(*) into active_count from public.chaos_scan_captures where album_id=aid and status<>'REMOVED';
   if active_count<1 or exists(select 1 from public.chaos_scan_captures where album_id=aid and status<>'REMOVED' and (status<>'RECEIVED' or item is null or coalesce(item->>'humanState','')<>'confirmed' or coalesce(item->>'processingState','')<>'ready' or coalesce(item->>'recognitionState','unknown')='unknown' or coalesce(item->>'cardName','')='' or coalesce(item->>'setCode','')='' or coalesce(item->>'collectorNumber','')='')) then raise exception 'SCAN_REVIEW_REQUIRED'; end if;
   update public.chaos_scan_albums set state='COMMITTING' where id=aid;
   select public.commit_chaos_sort_batch(jsonb_build_object('batch',jsonb_build_object('id',aid,'batchCode',a.batch_code,'workspaceId',wid,'destinationLocationId',a.destination_id,'destinationLabel',a.destination_label,'intakeMode','live','targetBatchSize',100),'items',jsonb_agg(item||jsonb_build_object('sourceImageUrl',null,'destinationLocationId',a.destination_id,'destinationLabel',a.destination_label)),'rules','[]'::jsonb)) into result from public.chaos_scan_captures where album_id=aid and status='RECEIVED';
   update public.chaos_scan_albums set state='CLOSED',committed_at=now(),expires_at=now()+interval '30 days' where id=aid;
   return result;
 end if;
 raise exception 'SCAN_COMMAND_INVALID';
end $$;
revoke all on function public.chaos_scan_command(text,jsonb) from public,anon;
grant execute on function public.chaos_scan_command(text,jsonb) to authenticated;

-- Protect album-backed batches even if a caller attempts the legacy commit RPC.
create function chaos_scan_private.guard_batch() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.chaos_scan_albums%rowtype;
begin
 if tg_op='DELETE' then
   if exists(select 1 from public.chaos_scan_albums where id=old.id) then raise exception 'SCAN_BATCH_IMMUTABLE'; end if;
   return old;
 end if;
 select * into a from public.chaos_scan_albums where id=new.id;
 if a.id is null then return new; end if;
 if a.state='ACTIVE' then raise exception 'SCAN_USE_AUTHORITATIVE_COMMIT'; end if;
 if a.user_id<>new.user_id or a.workspace_id is distinct from new.workspace_id then raise exception 'SCAN_SCOPE_MISMATCH'; end if;
 if new.source_count>100 or new.initial_quantity>100 then raise exception 'SCAN_BATCH_FULL'; end if;
 if a.state='CLOSED' and (to_jsonb(new)-'current_quantity'-'updated_at') is distinct from (to_jsonb(old)-'current_quantity'-'updated_at') then raise exception 'SCAN_BATCH_IMMUTABLE'; end if;
 return new;
end $$;
revoke all on function chaos_scan_private.guard_batch() from public,anon,authenticated;
create trigger chaos_scan_batch_guard before insert or update or delete on public.chaos_sort_batches for each row execute function chaos_scan_private.guard_batch();

create function chaos_scan_private.guard_item() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op in ('UPDATE','DELETE') and exists(select 1 from public.chaos_scan_albums where id=old.batch_id and state='CLOSED') then raise exception 'SCAN_BATCH_IMMUTABLE'; end if;
 if exists(select 1 from public.chaos_scan_albums where id=case when tg_op='DELETE' then old.batch_id else new.batch_id end and state='CLOSED') then raise exception 'SCAN_BATCH_IMMUTABLE'; end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function chaos_scan_private.guard_item() from public,anon,authenticated;
create trigger chaos_scan_item_guard before insert or update or delete on public.chaos_sort_items for each row execute function chaos_scan_private.guard_item();
