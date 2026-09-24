-- Forward-only: lifetime ordinal is audit identity, capacity is 100 kept captures.
begin;
set local lock_timeout='5s';
lock table public.chaos_scan_albums, public.chaos_scan_captures in access exclusive mode;

alter table public.chaos_scan_captures drop constraint chaos_scan_captures_ordinal_check;
alter table public.chaos_scan_captures add constraint chaos_scan_captures_ordinal_check check(ordinal>0);

-- A bounded unique slot is a database constraint, not a count-then-insert race.
-- Private capacity metadata is disposable; the capture itself is never deleted.
create table chaos_scan_private.capture_capacity (
 capture_id uuid primary key references public.chaos_scan_captures(capture_id),
 album_id uuid not null references public.chaos_scan_albums(id),
 slot integer not null check(slot between 1 and 100),
 unique(album_id,slot)
);
alter table chaos_scan_private.capture_capacity enable row level security;
revoke all on chaos_scan_private.capture_capacity from public,anon,authenticated,service_role;
insert into chaos_scan_private.capture_capacity(capture_id,album_id,slot)
 select capture_id,album_id,row_number() over(partition by album_id order by ordinal)::integer
 from public.chaos_scan_captures where status<>'REMOVED';

create function chaos_scan_private.enforce_capture_capacity() returns trigger
language plpgsql security definer set search_path='' as $$
declare aid uuid; album_state text; free_slot integer;
begin
 if tg_op='DELETE' then raise exception 'SCAN_CAPTURE_HISTORY_IMMUTABLE'; end if;
 aid:=new.album_id;
 select state into album_state from public.chaos_scan_albums where id=aid for update;
 if album_state is distinct from 'ACTIVE' then raise exception 'SCAN_BATCH_CLOSED'; end if;
 if tg_op='UPDATE' then
   if (new.capture_id,new.album_id,new.user_id,new.ordinal,new.object_path,new.sha256,new.source_kind,new.captured_at)
      is distinct from (old.capture_id,old.album_id,old.user_id,old.ordinal,old.object_path,old.sha256,old.source_kind,old.captured_at)
      then raise exception 'SCAN_CAPTURE_IDENTITY_IMMUTABLE'; end if;
   if old.status='REMOVED' and new is distinct from old then raise exception 'SCAN_CAPTURE_REMOVED_IMMUTABLE'; end if;
 end if;
 if new.status='REMOVED' then
   delete from chaos_scan_private.capture_capacity where capture_id=new.capture_id;
 elsif tg_op='INSERT' then
   select s into free_slot from generate_series(1,100) s
    where not exists(select 1 from chaos_scan_private.capture_capacity c where c.album_id=aid and c.slot=s)
    order by s limit 1;
   if free_slot is null then raise exception 'SCAN_BATCH_FULL'; end if;
   insert into chaos_scan_private.capture_capacity values(new.capture_id,aid,free_slot);
 end if;
 return new;
end $$;
revoke all on function chaos_scan_private.enforce_capture_capacity() from public,anon,authenticated,service_role;
create trigger scan_capture_capacity after insert or update or delete on public.chaos_scan_captures
 for each row execute function chaos_scan_private.enforce_capture_capacity();

do $migration$
declare definition text; anchor text;
begin
 definition:=replace(pg_get_functiondef('public.chaos_scan_command(text,jsonb)'::regprocedure),chr(13),'');
 anchor:='if n>100 then raise exception ''SCAN_BATCH_FULL''; end if;';
 if strpos(definition,anchor)=0 or strpos(definition,'SCAN_INTAKE_MODE_INVALID')=0 then raise exception 'SCAN_CAPACITY_BASELINE_DRIFT'; end if;
 definition:=replace(definition,anchor,'if (select count(*) from public.chaos_scan_captures where album_id=aid and status<>''REMOVED'')>=100 then raise exception ''SCAN_BATCH_FULL''; end if;');
 anchor:='if c.capture_id is null or c.status not in (''RECEIVED'',''REMOVED'') then raise exception ''SCAN_CAPTURE_NOT_RECEIVED''; end if;';
 if strpos(definition,anchor)=0 then raise exception 'SCAN_CAPTURE_REVIEW_BASELINE_DRIFT'; end if;
 -- A failed upload reservation may be explicitly removed after intake stops.
 -- It must never be editable/confirmable as if its image were received.
 definition:=replace(definition,anchor,'if c.capture_id is null or (c.status not in (''RECEIVED'',''REMOVED'') and coalesce(entry->>''humanState'','''')<>''removed'') then raise exception ''SCAN_CAPTURE_NOT_RECEIVED''; end if;');
 anchor:='if c.item=entry then return jsonb_build_object(''revision'',c.revision); end if;';
 if strpos(definition,anchor)=0 then raise exception 'SCAN_REVIEW_BASELINE_DRIFT'; end if;
 definition:=replace(definition,anchor,$new$if c.status='REMOVED' then
     if entry->>'humanState'='removed' then return jsonb_build_object('revision',c.revision); end if;
     raise exception 'SCAN_CAPTURE_REMOVED_IMMUTABLE';
   end if;
   if c.item=entry then return jsonb_build_object('revision',c.revision); end if;$new$);
 definition:=replace(definition,'''physicalCount'',jsonb_array_length(result)',
   '''physicalCount'',(select count(*) from public.chaos_scan_captures where album_id=aid and status<>''REMOVED'')');
 definition:=replace(definition,'physical_card_count=(select count(*) from public.chaos_scan_captures where album_id=aid)',
   'physical_card_count=(select count(*) from public.chaos_scan_captures where album_id=aid and status<>''REMOVED'')');
 execute definition;
 -- Preserve current history authorization and original/current inventory totals.
 definition:=replace(pg_get_functiondef('public.chaos_batch_history(timestamptz,uuid,integer)'::regprocedure),chr(13),'');
 anchor:='where c.album_id=b.id) as physical_count';
 if strpos(definition,anchor)=0 then raise exception 'SCAN_HISTORY_BASELINE_DRIFT'; end if;
 execute replace(definition,anchor,'where c.album_id=b.id and c.status<>''REMOVED'') as physical_count');
end $migration$;
commit;
