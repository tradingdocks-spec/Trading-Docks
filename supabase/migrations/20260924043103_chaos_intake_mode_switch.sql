-- Change only intake metadata on an existing open album. Preserve the command's
-- owner/active-workspace authorization, owner lock, album lock and CLOSED guard.
do $migration$
declare definition text; anchor text;
begin
  definition := pg_get_functiondef('public.chaos_scan_command(text,jsonb)'::regprocedure);
  anchor := $old$ elsif action='settings' then$old$;
  if strpos(definition, anchor)=0 or strpos(definition, 'SCAN_INTAKE_MODE_INVALID')>0 then
    raise exception 'SCAN_MODE_COMMAND_BASELINE_DRIFT';
  end if;
  definition := replace(definition, anchor, $new$ elsif action='mode' then
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
 elsif action='settings' then$new$);
  -- A stale browser cannot start a scanner while another browser selected CSV/upload.
  anchor := $old$ if action='start' then$old$;
  if strpos(definition,anchor)=0 then raise exception 'SCAN_START_BASELINE_DRIFT'; end if;
  definition := replace(definition,anchor,$new$ if action='start' then
   if a.intake_mode<>'live' then raise exception 'SCAN_MODE_CONFLICT: select Live Scan first'; end if;$new$);
  execute definition;
end $migration$;
