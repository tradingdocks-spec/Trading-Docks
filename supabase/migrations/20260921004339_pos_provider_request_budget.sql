-- Phase 7: a committed request budget before any outbound provider work.
-- Returning false (rather than raising) preserves the exhausted counter.
-- Actors cannot choose arbitrary buckets or a different actor's identity.
create function public.pos_provider_request_budget(p_workspace_id uuid, p_bucket text)
returns boolean language plpgsql security definer set search_path='' as $$
declare request_count integer; maximum integer;
begin
  perform pos_private.authorize(p_workspace_id,false,false);
  maximum := case p_bucket when 'oauth' then 12 when 'device' then 60 when 'payment' then 120 else null end;
  if maximum is null then raise exception 'POS_INVALID'; end if;
  insert into pos_private.request_limits(actor_id,bucket)
    values(auth.uid(),'provider:'||p_bucket)
  on conflict(actor_id,bucket) do update set
    requests=case when request_limits.started_at < now()-interval '1 minute' then 1 else least(request_limits.requests+1,1000000) end,
    started_at=case when request_limits.started_at < now()-interval '1 minute' then now() else request_limits.started_at end
  returning requests into request_count;
  return request_count<=maximum;
end $$;
revoke all on function public.pos_provider_request_budget(uuid,text) from public,anon;
grant execute on function public.pos_provider_request_budget(uuid,text) to authenticated;
