-- Corrective migration for the production start_tournament ambiguity.
-- This is additive and intentionally does not rerun or rewrite 202609100006.

create or replace function public.start_tournament(
  target_tournament_id uuid,
  target_planned_rounds integer default null
)
returns table (
  tournament_id uuid,
  lifecycle_status text,
  planned_rounds integer,
  recommended_rounds integer,
  eligible_player_count bigint,
  round_id uuid,
  round_number integer,
  already_started boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  tournament_row public.tournaments%rowtype;
  eligible_count bigint;
  resolved_recommended integer;
  resolved_planned integer;
  first_round_id uuid;
begin
  select t.* into tournament_row
  from public.tournaments as t
  where t.id = target_tournament_id
  for update;

  if not found then
    raise exception using message = 'Tournament not found.';
  end if;

  if not public.can_manage_workspace(tournament_row.workspace_id) then
    raise exception using message = 'Not authorized to start this tournament.';
  end if;

  select count(*) into eligible_count
  from public.tournament_registrations as tr
  where tr.tournament_id = target_tournament_id
    and tr.status = 'checked_in';

  resolved_recommended := public.recommend_tournament_rounds(eligible_count::integer);

  if tournament_row.lifecycle_status = 'in_progress' then
    select trn.id into first_round_id
    from public.tournament_rounds as trn
    where trn.tournament_id = target_tournament_id
      and trn.round_number = 1;

    return query select target_tournament_id, tournament_row.lifecycle_status,
      coalesce(tournament_row.planned_rounds, tournament_row.recommended_rounds, resolved_recommended),
      coalesce(tournament_row.recommended_rounds, resolved_recommended), eligible_count,
      first_round_id, tournament_row.current_round_number, true;
    return;
  end if;

  if tournament_row.lifecycle_status not in ('draft', 'published', 'registration_closed', 'ready') then
    raise exception using message = 'This tournament cannot be started from its current state.';
  end if;

  if eligible_count < 2 then
    raise exception using message = 'At least two checked-in players are required to start.';
  end if;

  if target_planned_rounds is not null and (target_planned_rounds < 1 or target_planned_rounds > 20) then
    raise exception using message = 'Planned rounds must be between 1 and 20.';
  end if;

  resolved_planned := coalesce(target_planned_rounds, tournament_row.planned_rounds, resolved_recommended);
  if resolved_planned < 1 then
    raise exception using message = 'A valid planned round count is required.';
  end if;

  insert into public.tournament_players (
    tournament_id, workspace_id, registration_id, display_name, seed_order, player_status, checked_in
  )
  select r.tournament_id, r.workspace_id, r.id, r.player_name,
    row_number() over (order by r.registered_at, r.id)::integer, 'active', true
  from public.tournament_registrations as r
  where r.tournament_id = target_tournament_id
    and r.status = 'checked_in'
    and not exists (
      select 1
      from public.tournament_players as p
      where p.tournament_id = r.tournament_id
        and p.registration_id = r.id
    )
  order by r.registered_at, r.id;

  insert into public.tournament_rounds (
    tournament_id, workspace_id, round_number, stage, status, created_by
  ) values (
    target_tournament_id, tournament_row.workspace_id, 1, 'swiss', 'pending', auth.uid()
  ) on conflict (tournament_id, round_number) do nothing;

  select trn.id into first_round_id
  from public.tournament_rounds as trn
  where trn.tournament_id = target_tournament_id
    and trn.round_number = 1;

  update public.tournaments as t
  set lifecycle_status = 'in_progress',
      recommended_rounds = resolved_recommended,
      planned_rounds = resolved_planned,
      registration_locked_at = coalesce(t.registration_locked_at, now()),
      started_at = coalesce(t.started_at, now()),
      current_round_number = 1,
      updated_at = now()
  where t.id = target_tournament_id;

  insert into public.tournament_event_log (workspace_id, tournament_id, actor_id, event_type, dedupe_key, metadata)
  values (tournament_row.workspace_id, target_tournament_id, auth.uid(), 'registration_locked', 'registration-locked',
    jsonb_build_object('eligible_player_count', eligible_count))
  on conflict (tournament_id, dedupe_key) do nothing;

  insert into public.tournament_event_log (workspace_id, tournament_id, actor_id, event_type, dedupe_key, metadata)
  values (tournament_row.workspace_id, target_tournament_id, auth.uid(), 'tournament_started', 'tournament-started',
    jsonb_build_object('planned_rounds', resolved_planned, 'recommended_rounds', resolved_recommended))
  on conflict (tournament_id, dedupe_key) do nothing;

  insert into public.tournament_event_log (workspace_id, tournament_id, actor_id, event_type, dedupe_key, metadata)
  values (tournament_row.workspace_id, target_tournament_id, auth.uid(), 'round_created', 'round-1-created',
    jsonb_build_object('round_number', 1, 'stage', 'swiss'))
  on conflict (tournament_id, dedupe_key) do nothing;

  return query select target_tournament_id, 'in_progress'::text, resolved_planned,
    resolved_recommended, eligible_count, first_round_id, 1, false;
end;
$$;

revoke all on function public.start_tournament(uuid, integer) from public;
grant execute on function public.start_tournament(uuid, integer) to authenticated;
