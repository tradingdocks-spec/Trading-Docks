-- Catalog authority remains in the existing server providers. This private
-- receipt is an authorization for one immutable cloud review, not a catalog.
begin;
create table chaos_scan_private.commit_validation (
 batch_id uuid primary key references public.chaos_scan_albums(id),
 user_id uuid not null, workspace_id uuid not null, claim jsonb not null,
 fingerprint text not null, validated_items jsonb not null,
 validated_at timestamptz not null default now(), expires_at timestamptz not null,
 committed_request jsonb, committed_result jsonb
);
alter table chaos_scan_private.commit_validation enable row level security;
revoke all on chaos_scan_private.commit_validation from public,anon,authenticated,service_role;

create function chaos_scan_private.commit_claim(aid uuid) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object('album',jsonb_build_object('id',a.id,'user_id',a.user_id,'workspace_id',a.workspace_id,
 'destination_id',a.destination_id,'destination_label',a.destination_label,'intake_mode',a.intake_mode,
 'settings',a.settings,'settings_revision',a.settings_revision),
 'captures',coalesce((select jsonb_agg(jsonb_build_object('capture_id',c.capture_id,'revision',c.revision,
 'sha256',c.sha256,'status',c.status,'item',c.item) order by c.ordinal) from public.chaos_scan_captures c
 where c.album_id=a.id and c.status<>'REMOVED'),'[]'::jsonb)) from public.chaos_scan_albums a where a.id=aid
$$;

create function public.issue_chaos_commit_validation(p_batch_id uuid,p_claim jsonb,p_validated_items jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare a public.chaos_scan_albums%rowtype; claim jsonb; entry jsonb;
begin
 -- EXECUTE is service-role only; the browser cannot issue or edit receipts.
 select * into a from public.chaos_scan_albums where id=p_batch_id for update;
 claim:=chaos_scan_private.commit_claim(p_batch_id);
 if a.id is null or a.state<>'ACTIVE' or claim is distinct from p_claim then raise exception 'CHAOS_VALIDATION_REVISION_CONFLICT' using errcode='22023'; end if;
 if jsonb_typeof(p_validated_items) is distinct from 'array' or jsonb_array_length(p_validated_items) not between 1 and 100
   or jsonb_array_length(p_validated_items)<>jsonb_array_length(claim->'captures') then raise exception 'CHAOS_TRUSTED_REVIEW_REQUIRED'; end if;
 for entry in select value from jsonb_array_elements(p_validated_items) loop
   if not exists(select 1 from jsonb_array_elements(claim->'captures') c where c->>'capture_id'=entry->>'captureId' and c->>'status'='RECEIVED')
     or (entry->>'quantity')::numeric is distinct from 1::numeric
     or entry->'trustedValidation'->>'identity' is distinct from 'CATALOG_VERIFIED'
     or entry->'trustedValidation'->>'condition' is distinct from 'USER_OBSERVED'
     or nullif(entry->'trustedValidation'->>'canonicalCardId','') is null
     or nullif(entry->'trustedValidation'->>'printingId','') is null then raise exception 'CHAOS_TRUSTED_REVIEW_REQUIRED'; end if;
 end loop;
 if (select count(distinct value->>'captureId') from jsonb_array_elements(p_validated_items))<>jsonb_array_length(p_validated_items) then raise exception 'CHAOS_TRUSTED_REVIEW_REQUIRED'; end if;
 insert into chaos_scan_private.commit_validation(batch_id,user_id,workspace_id,claim,fingerprint,validated_items,expires_at)
 values(a.id,a.user_id,a.workspace_id,claim,encode(sha256(convert_to(claim::text,'UTF8')),'hex'),p_validated_items,now()+interval '1 hour')
 on conflict(batch_id) do update set claim=excluded.claim,fingerprint=excluded.fingerprint,validated_items=excluded.validated_items,
 validated_at=now(),expires_at=excluded.expires_at where commit_validation.committed_result is null;
end $$;
revoke all on function public.issue_chaos_commit_validation(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.issue_chaos_commit_validation(uuid,jsonb,jsonb) to service_role;

-- Keep the existing authoritative writer byte-for-byte, but make it private so
-- neither direct RPC callers nor reviewed=true can bypass the receipt guard.
alter function public.commit_chaos_sort_batch(jsonb) set schema chaos_scan_private;
alter function chaos_scan_private.commit_chaos_sort_batch(jsonb) rename to commit_validated_inventory;
revoke all on function chaos_scan_private.commit_validated_inventory(jsonb) from public,anon,authenticated,service_role;

create function public.commit_chaos_sort_batch(payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); wid uuid; aid uuid:=(payload->'batch'->>'id')::uuid;
 a public.chaos_scan_albums%rowtype; v chaos_scan_private.commit_validation%rowtype;
 expected jsonb; result jsonb; trusted jsonb;
begin
 if actor is null then raise exception 'CHAOS_AUTHORIZATION_FAILURE' using errcode='42501'; end if;
 wid:=public.current_inventory_workspace();
 if jsonb_typeof(payload->'items') is distinct from 'array' then raise exception 'CHAOS_TRUSTED_REVIEW_REQUIRED'; end if;
 payload:=payload||jsonb_build_object('items',(select jsonb_agg(value order by value->>'captureId') from jsonb_array_elements(payload->'items')));
 select * into a from public.chaos_scan_albums where id=aid for update;
 if a.id is null or a.user_id<>actor or a.workspace_id<>wid then raise exception 'CHAOS_AUTHORIZATION_FAILURE' using errcode='42501'; end if;
 select * into v from chaos_scan_private.commit_validation where batch_id=aid;
 if v.committed_result is not null then
   if v.committed_request is distinct from inventory_private.canonical_command(payload) then raise exception 'CHAOS_IDEMPOTENCY_CONFLICT' using errcode='22023'; end if;
   return v.committed_result;
 end if;
 if v.batch_id is null or v.user_id<>actor or v.workspace_id<>wid or v.expires_at<now()
   or v.claim is distinct from chaos_scan_private.commit_claim(aid) then raise exception 'CHAOS_TRUSTED_REVIEW_REQUIRED'; end if;
 select jsonb_build_object('batch',jsonb_build_object('id',aid,'batchCode',a.batch_code,'workspaceId',wid,
 'destinationLocationId',a.destination_id,'destinationLabel',a.destination_label,'intakeMode',a.intake_mode,'targetBatchSize',100,
 'title',a.settings->>'title','acquisitionCost',a.settings->'acquisitionCost'),
 'items',jsonb_agg(item||jsonb_build_object('sourceImageUrl',null,'destinationLocationId',a.destination_id,'destinationLabel',a.destination_label) order by item->>'captureId'),
 'rules',coalesce(a.settings->'rules','[]'::jsonb)) into expected from public.chaos_scan_captures where album_id=aid and status='RECEIVED';
 -- Compare all submitted business fields. Direct RPC edits cannot ride a receipt
 -- issued for a different set, printing, condition, quantity or destination.
 if inventory_private.canonical_command(payload) is distinct from inventory_private.canonical_command(expected) then raise exception 'CHAOS_TRUSTED_REVIEW_REQUIRED'; end if;
 if a.state<>'COMMITTING' then raise exception 'CHAOS_CLOUD_COMMIT_REQUIRED'; end if;
 select jsonb_agg(value||jsonb_build_object('sourceImageUrl',null,'destinationLocationId',a.destination_id,'destinationLabel',a.destination_label))
 into trusted from jsonb_array_elements(v.validated_items);
 result:=chaos_scan_private.commit_validated_inventory(payload||jsonb_build_object('items',trusted));
 update chaos_scan_private.commit_validation set committed_request=inventory_private.canonical_command(payload),committed_result=result where batch_id=aid;
 return result;
end $$;
revoke all on function public.commit_chaos_sort_batch(jsonb) from public,anon;
grant execute on function public.commit_chaos_sort_batch(jsonb) to authenticated;

-- A committed cloud operation returns its durable receipt, not current stock or
-- a fresh provider lookup. Historical commits without this receipt retain the
-- existing immutable initial-count response.
do $$
declare definition text; old text:=$s$if action='commit' and a.state='CLOSED' then return jsonb_build_object('ok',true,'replayed',true,'batchId',aid,'committedCount',(select initial_quantity from public.chaos_sort_batches where id=aid)); end if;$s$;
begin
 definition:=pg_get_functiondef('public.chaos_scan_command(text,jsonb)'::regprocedure);
 if strpos(definition,old)=0 then raise exception 'CHAOS_TRUSTED_COMMIT_BASELINE_DRIFT'; end if;
 definition:=replace(definition,old,$s$if action='commit' and a.state='CLOSED' then return coalesce((select committed_result from chaos_scan_private.commit_validation where batch_id=aid),jsonb_build_object('ok',true,'replayed',true,'batchId',aid,'committedCount',(select initial_quantity from public.chaos_sort_batches where id=aid))); end if;$s$);
 execute definition;
end $$;
revoke all on function chaos_scan_private.commit_claim(uuid) from public,anon,authenticated,service_role;
commit;
