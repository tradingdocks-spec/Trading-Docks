-- Tournament Operations PR 2: deterministic Swiss pairings and match results.
-- Match history remains authoritative; no standings snapshot is introduced here.

alter table public.tournament_matches add column if not exists player_one_match_points integer;
alter table public.tournament_matches add column if not exists player_two_match_points integer;
alter table public.tournament_matches add column if not exists expected_version integer not null default 1;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tournament_matches_match_points_check' and conrelid = 'public.tournament_matches'::regclass) then
    alter table public.tournament_matches add constraint tournament_matches_match_points_check
      check ((player_one_match_points is null or player_one_match_points >= 0) and (player_two_match_points is null or player_two_match_points >= 0));
  end if;
end $$;

create index if not exists tournament_matches_players_idx
  on public.tournament_matches(tournament_id, player_one_id, player_two_id);

create or replace function public.generate_tournament_round(target_tournament_id uuid, target_round_number integer default null)
returns table (round_id uuid, round_number integer, match_count integer, bye_player_id uuid, already_exists boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  tournament_row public.tournaments%rowtype;
  next_round integer;
  round_row public.tournament_rounds%rowtype;
  player_row record;
  opponent_row record;
  pending_player uuid;
  pending_seed integer;
  pending_points integer;
  match_no integer := 0;
  bye_id uuid;
  player_count integer := 0;
  opponent_found boolean;
begin
  select * into tournament_row from public.tournaments where id = target_tournament_id for update;
  if not found then raise exception using message = 'Tournament not found.'; end if;
  if not public.can_manage_workspace(tournament_row.workspace_id) then raise exception using message = 'Not authorized to generate pairings.'; end if;
  if tournament_row.lifecycle_status <> 'in_progress' then raise exception using message = 'Tournament is not in progress.'; end if;

  next_round := coalesce(target_round_number, tournament_row.current_round_number + 1);
  if next_round < 1 or next_round > coalesce(tournament_row.planned_rounds, 20) then raise exception using message = 'Round is outside the planned tournament range.'; end if;
  select * into round_row from public.tournament_rounds where tournament_id = target_tournament_id and round_number = next_round for update;
  if found then
    return query select round_row.id, round_row.round_number,
      (select count(*)::integer from public.tournament_matches where round_id = round_row.id),
      (select player_one_id from public.tournament_matches where round_id = round_row.id and is_bye limit 1), true;
    return;
  end if;

  insert into public.tournament_rounds (tournament_id, workspace_id, round_number, stage, status, started_at, ends_at, created_by)
  values (target_tournament_id, tournament_row.workspace_id, next_round, 'swiss', 'active', now(), now() + make_interval(mins => tournament_row.round_duration_minutes), auth.uid())
  returning * into round_row;

  create temp table pg_temp.tournament_pairing_candidates (id uuid primary key, seed_order integer, match_points integer, bye_count integer) on commit drop;
  insert into pg_temp.tournament_pairing_candidates (id, seed_order, match_points, bye_count)
    select p.id, p.seed_order,
      coalesce((select sum(case when m.player_one_id = p.id then coalesce(m.player_one_match_points, 0) else coalesce(m.player_two_match_points, 0) end)
        from public.tournament_matches m where m.tournament_id = target_tournament_id and m.result_status in ('reported', 'corrected')
          and (m.player_one_id = p.id or m.player_two_id = p.id)), 0)::integer as match_points,
      (select count(*) from public.tournament_matches m where m.tournament_id = target_tournament_id and m.is_bye and m.player_one_id = p.id)::integer as bye_count
    from public.tournament_players p
    where p.tournament_id = target_tournament_id and p.player_status = 'active'
    ;
  select count(*) into player_count from pg_temp.tournament_pairing_candidates;
  if player_count % 2 = 1 then
    select c.id into bye_id from pg_temp.tournament_pairing_candidates c order by c.bye_count, c.match_points, c.seed_order desc, c.id desc limit 1;
    delete from pg_temp.tournament_pairing_candidates where id = bye_id;
    match_no := 1;
    insert into public.tournament_matches (tournament_id, round_id, workspace_id, match_number, player_one_id, is_bye, player_one_match_points, player_two_match_points, result_status, reported_at, reported_by)
    values (target_tournament_id, round_row.id, tournament_row.workspace_id, match_no, bye_id, true, 3, 0, 'reported', now(), auth.uid());
  end if;

  while exists (select 1 from pg_temp.tournament_pairing_candidates) loop
    select c.* into player_row from pg_temp.tournament_pairing_candidates c order by case when next_round = 1 then c.seed_order else 0 end, c.match_points desc, c.bye_count, c.seed_order, c.id limit 1;
    delete from pg_temp.tournament_pairing_candidates where id = player_row.id;
    select c.* into opponent_row from pg_temp.tournament_pairing_candidates c
    where not exists (select 1 from public.tournament_matches m where m.tournament_id = target_tournament_id and m.result_status <> 'void' and ((m.player_one_id = player_row.id and m.player_two_id = c.id) or (m.player_one_id = c.id and m.player_two_id = player_row.id)))
    order by case when next_round = 1 then c.seed_order else 0 end, c.match_points desc, c.bye_count, c.seed_order, c.id limit 1;
    opponent_found := found;
    if not opponent_found then
      select c.* into opponent_row from pg_temp.tournament_pairing_candidates c order by case when next_round = 1 then c.seed_order else 0 end, c.match_points desc, c.bye_count, c.seed_order, c.id limit 1;
    end if;
    delete from pg_temp.tournament_pairing_candidates where id = opponent_row.id;
    match_no := match_no + 1;
    insert into public.tournament_matches (tournament_id, round_id, workspace_id, match_number, player_one_id, player_two_id, is_bye, result_status)
    values (target_tournament_id, round_row.id, tournament_row.workspace_id, match_no, player_row.id, opponent_row.id, false, 'pending');
  end loop;

  update public.tournaments set current_round_number = next_round, updated_at = now() where id = target_tournament_id;
  insert into public.tournament_event_log (workspace_id, tournament_id, actor_id, event_type, dedupe_key, metadata)
  values (tournament_row.workspace_id, target_tournament_id, auth.uid(), 'round_pairings_generated', 'round-' || next_round || '-pairings', jsonb_build_object('round_number', next_round, 'match_count', match_no, 'bye_player_id', bye_id))
  on conflict (tournament_id, dedupe_key) do nothing;
  return query select round_row.id, next_round, match_no + case when bye_id is null then 0 else 1 end, bye_id, false;
end;
$$;

create or replace function public.report_tournament_match(
  target_match_id uuid,
  target_player_one_games integer,
  target_player_two_games integer,
  target_game_draws integer,
  target_version integer
)
returns table (match_id uuid, result_status text, version integer, player_one_match_points integer, player_two_match_points integer)
language plpgsql security definer set search_path = ''
as $$
declare
  match_row public.tournament_matches%rowtype;
  tournament_workspace uuid;
  p1 integer;
  p2 integer;
begin
  select m, t.workspace_id into match_row, tournament_workspace
  from public.tournament_matches m join public.tournaments t on t.id = m.tournament_id
  where m.id = target_match_id for update;
  if not found then raise exception using message = 'Match not found.'; end if;
  if not public.can_manage_workspace(tournament_workspace) then raise exception using message = 'Not authorized to report match results.'; end if;
  if match_row.version <> target_version then raise exception using message = 'Match changed; refresh before submitting.'; end if;
  if match_row.result_status = 'void' then raise exception using message = 'Void matches cannot receive results.'; end if;
  if target_player_one_games < 0 or target_player_two_games < 0 or target_game_draws < 0 then raise exception using message = 'Game scores cannot be negative.'; end if;
  if match_row.is_bye then p1 := 3; p2 := 0;
  elsif target_player_one_games = target_player_two_games then p1 := 1; p2 := 1;
  elsif target_player_one_games > target_player_two_games then p1 := 3; p2 := 0;
  else p1 := 0; p2 := 3; end if;
  update public.tournament_matches set player_one_games_won = target_player_one_games, player_two_games_won = target_player_two_games,
    game_draws = target_game_draws, player_one_match_points = p1, player_two_match_points = p2,
    winner_player_id = case when p1 = 3 then player_one_id when p2 = 3 then player_two_id else null end,
    result_status = 'reported', reported_at = now(), reported_by = auth.uid(), version = version + 1, updated_at = now()
  where id = target_match_id;
  return query select target_match_id, 'reported'::text, match_row.version + 1, p1, p2;
end;
$$;

create or replace function public.complete_tournament_round(target_round_id uuid)
returns table (round_id uuid, round_status text, next_round_number integer)
language plpgsql security definer set search_path = ''
as $$
declare
  round_row public.tournament_rounds%rowtype;
  workspace_id uuid;
  next_round integer;
begin
  select r, t.workspace_id into round_row, workspace_id from public.tournament_rounds r join public.tournaments t on t.id = r.tournament_id where r.id = target_round_id for update;
  if not found then raise exception using message = 'Round not found.'; end if;
  if not public.can_manage_workspace(workspace_id) then raise exception using message = 'Not authorized to complete this round.'; end if;
  if exists (select 1 from public.tournament_matches where round_id = target_round_id and result_status not in ('reported', 'corrected')) then raise exception using message = 'Every match must have a result before the round can complete.'; end if;
  update public.tournament_rounds set status = 'completed', completed_at = coalesce(completed_at, now()) where id = target_round_id;
  next_round := round_row.round_number + 1;
  return query select target_round_id, 'completed'::text, next_round;
end;
$$;

revoke all on function public.generate_tournament_round(uuid, integer) from public;
grant execute on function public.generate_tournament_round(uuid, integer) to authenticated;
revoke all on function public.report_tournament_match(uuid, integer, integer, integer, integer) from public;
grant execute on function public.report_tournament_match(uuid, integer, integer, integer, integer) to authenticated;
revoke all on function public.complete_tournament_round(uuid) from public;
grant execute on function public.complete_tournament_round(uuid) to authenticated;
