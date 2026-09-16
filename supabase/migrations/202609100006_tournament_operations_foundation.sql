-- Additive tournament operations foundation.
-- This migration deliberately keeps the existing registration and tournament
-- tables as the source of truth and adds only operational state.

alter table public.tournaments add column if not exists lifecycle_status text not null default 'draft';
alter table public.tournaments add column if not exists pairing_system text not null default 'swiss';
alter table public.tournaments add column if not exists planned_rounds integer;
alter table public.tournaments add column if not exists recommended_rounds integer;
alter table public.tournaments add column if not exists round_duration_minutes integer not null default 50;
alter table public.tournaments add column if not exists top_cut_size integer;
alter table public.tournaments add column if not exists registration_locked_at timestamptz;
alter table public.tournaments add column if not exists started_at timestamptz;
alter table public.tournaments add column if not exists completed_at timestamptz;
alter table public.tournaments add column if not exists current_round_number integer not null default 0;

update public.tournaments
set lifecycle_status = case
  when status in ('draft', 'published', 'registration_closed', 'ready', 'in_progress', 'top_cut', 'completed', 'cancelled') then status
  else 'draft'
end
where lifecycle_status = 'draft';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tournaments_lifecycle_status_check' and conrelid = 'public.tournaments'::regclass) then
    alter table public.tournaments add constraint tournaments_lifecycle_status_check
      check (lifecycle_status in ('draft', 'published', 'registration_closed', 'ready', 'in_progress', 'top_cut', 'completed', 'cancelled'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tournaments_pairing_system_check' and conrelid = 'public.tournaments'::regclass) then
    alter table public.tournaments add constraint tournaments_pairing_system_check
      check (pairing_system in ('swiss'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tournaments_round_duration_check' and conrelid = 'public.tournaments'::regclass) then
    alter table public.tournaments add constraint tournaments_round_duration_check
      check (round_duration_minutes between 1 and 480);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tournaments_planned_rounds_check' and conrelid = 'public.tournaments'::regclass) then
    alter table public.tournaments add constraint tournaments_planned_rounds_check
      check (planned_rounds is null or planned_rounds between 1 and 20);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tournaments_recommended_rounds_check' and conrelid = 'public.tournaments'::regclass) then
    alter table public.tournaments add constraint tournaments_recommended_rounds_check
      check (recommended_rounds is null or recommended_rounds between 1 and 20);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tournaments_top_cut_size_check' and conrelid = 'public.tournaments'::regclass) then
    alter table public.tournaments add constraint tournaments_top_cut_size_check
      check (top_cut_size is null or top_cut_size in (4, 8, 16));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tournaments_current_round_check' and conrelid = 'public.tournaments'::regclass) then
    alter table public.tournaments add constraint tournaments_current_round_check
      check (current_round_number >= 0);
  end if;
end $$;

alter table public.tournament_players add column if not exists registration_id uuid references public.tournament_registrations(id) on delete set null;
alter table public.tournament_players add column if not exists seed_order integer;
alter table public.tournament_players add column if not exists player_status text not null default 'active';
alter table public.tournament_players add column if not exists checked_in boolean not null default true;
alter table public.tournament_players add column if not exists dropped_at timestamptz;
alter table public.tournament_players add column if not exists dropped_at_round integer;
alter table public.tournament_players add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tournament_players_status_check' and conrelid = 'public.tournament_players'::regclass) then
    alter table public.tournament_players add constraint tournament_players_status_check
      check (player_status in ('active', 'dropped', 'disqualified'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tournament_players_dropped_round_check' and conrelid = 'public.tournament_players'::regclass) then
    alter table public.tournament_players add constraint tournament_players_dropped_round_check
      check (dropped_at_round is null or dropped_at_round > 0);
  end if;
end $$;

create unique index if not exists tournament_players_registration_idx
  on public.tournament_players(tournament_id, registration_id)
  where registration_id is not null;
create unique index if not exists tournament_players_seed_idx
  on public.tournament_players(tournament_id, seed_order)
  where seed_order is not null;

alter table public.tournament_rounds add column if not exists stage text not null default 'swiss';
alter table public.tournament_rounds add column if not exists ends_at timestamptz;
alter table public.tournament_rounds add column if not exists pairing_version integer not null default 1;
alter table public.tournament_rounds add column if not exists created_by uuid references auth.users(id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tournament_rounds_stage_check' and conrelid = 'public.tournament_rounds'::regclass) then
    alter table public.tournament_rounds add constraint tournament_rounds_stage_check
      check (stage in ('swiss', 'top_cut'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tournament_rounds_status_check' and conrelid = 'public.tournament_rounds'::regclass) then
    alter table public.tournament_rounds add constraint tournament_rounds_status_check
      check (status in ('pending', 'active', 'completed', 'cancelled'));
  end if;
end $$;

alter table public.tournament_matches add column if not exists match_number integer;
alter table public.tournament_matches add column if not exists player_one_games_won integer not null default 0;
alter table public.tournament_matches add column if not exists player_two_games_won integer not null default 0;
alter table public.tournament_matches add column if not exists game_draws integer not null default 0;
alter table public.tournament_matches add column if not exists winner_player_id uuid references public.tournament_players(id) on delete set null;
alter table public.tournament_matches add column if not exists result_status text not null default 'pending';
alter table public.tournament_matches add column if not exists is_bye boolean not null default false;
alter table public.tournament_matches add column if not exists reported_at timestamptz;
alter table public.tournament_matches add column if not exists reported_by uuid references auth.users(id) on delete set null;
alter table public.tournament_matches add column if not exists version integer not null default 1;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tournament_matches_result_status_check' and conrelid = 'public.tournament_matches'::regclass) then
    alter table public.tournament_matches add constraint tournament_matches_result_status_check
      check (result_status in ('pending', 'reported', 'corrected', 'void'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tournament_matches_scores_check' and conrelid = 'public.tournament_matches'::regclass) then
    alter table public.tournament_matches add constraint tournament_matches_scores_check
      check (player_one_games_won >= 0 and player_two_games_won >= 0 and game_draws >= 0);
  end if;
end $$;

create index if not exists tournament_players_status_idx
  on public.tournament_players(tournament_id, player_status, seed_order);
create index if not exists tournament_rounds_status_idx
  on public.tournament_rounds(tournament_id, status, round_number);
create unique index if not exists tournament_matches_round_number_idx
  on public.tournament_matches(round_id, match_number)
  where match_number is not null;

create table if not exists public.tournament_event_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  dedupe_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists tournament_event_log_tournament_idx
  on public.tournament_event_log(tournament_id, created_at desc);
create unique index if not exists tournament_event_log_dedupe_idx
  on public.tournament_event_log(tournament_id, dedupe_key)
  where dedupe_key is not null;

alter table public.tournament_event_log enable row level security;
drop policy if exists "Members view tournament event log" on public.tournament_event_log;
create policy "Members view tournament event log"
  on public.tournament_event_log for select to authenticated
  using (public.is_workspace_member(workspace_id));
drop policy if exists "Managers manage tournament event log" on public.tournament_event_log;
create policy "Managers manage tournament event log"
  on public.tournament_event_log for all to authenticated
  using (public.can_manage_workspace(workspace_id))
  with check (public.can_manage_workspace(workspace_id));

revoke all on public.tournament_event_log from anon;
grant select, insert, update, delete on public.tournament_event_log to authenticated;

create or replace function public.recommend_tournament_rounds(player_count integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when player_count < 2 then 0
    when player_count < 4 then 1
    when player_count < 8 then 2
    when player_count < 16 then 3
    when player_count < 32 then 4
    when player_count < 64 then 5
    when player_count < 128 then 6
    else 7
  end;
$$;

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
  select * into tournament_row
  from public.tournaments
  where id = target_tournament_id
  for update;

  if not found then raise exception using message = 'Tournament not found.'; end if;
  if not public.can_manage_workspace(tournament_row.workspace_id) then raise exception using message = 'Not authorized to start this tournament.'; end if;

  select count(*) into eligible_count
  from public.tournament_registrations
  where tournament_id = target_tournament_id and status = 'checked_in';
  resolved_recommended := public.recommend_tournament_rounds(eligible_count::integer);

  if tournament_row.lifecycle_status = 'in_progress' then
    select id into first_round_id from public.tournament_rounds
    where tournament_id = target_tournament_id and round_number = 1;
    return query select target_tournament_id, tournament_row.lifecycle_status,
      coalesce(tournament_row.planned_rounds, tournament_row.recommended_rounds, resolved_recommended),
      coalesce(tournament_row.recommended_rounds, resolved_recommended), eligible_count,
      first_round_id, tournament_row.current_round_number, true;
    return;
  end if;

  if tournament_row.lifecycle_status not in ('draft', 'published', 'registration_closed', 'ready') then
    raise exception using message = 'This tournament cannot be started from its current state.';
  end if;
  if eligible_count < 2 then raise exception using message = 'At least two checked-in players are required to start.'; end if;

  if target_planned_rounds is not null and (target_planned_rounds < 1 or target_planned_rounds > 20) then
    raise exception using message = 'Planned rounds must be between 1 and 20.';
  end if;
  resolved_planned := coalesce(target_planned_rounds, tournament_row.planned_rounds, resolved_recommended);
  if resolved_planned < 1 then raise exception using message = 'A valid planned round count is required.'; end if;

  insert into public.tournament_players (
    tournament_id, workspace_id, registration_id, display_name, seed_order, player_status, checked_in
  )
  select r.tournament_id, r.workspace_id, r.id, r.player_name,
    row_number() over (order by r.registered_at, r.id)::integer, 'active', true
  from public.tournament_registrations r
  where r.tournament_id = target_tournament_id and r.status = 'checked_in'
    and not exists (
      select 1 from public.tournament_players p
      where p.tournament_id = r.tournament_id and p.registration_id = r.id
    )
  order by r.registered_at, r.id;

  insert into public.tournament_rounds (
    tournament_id, workspace_id, round_number, stage, status, created_by
  ) values (
    target_tournament_id, tournament_row.workspace_id, 1, 'swiss', 'pending', auth.uid()
  ) on conflict (tournament_id, round_number) do nothing;

  select id into first_round_id from public.tournament_rounds
  where tournament_id = target_tournament_id and round_number = 1;

  update public.tournaments
  set lifecycle_status = 'in_progress',
      recommended_rounds = resolved_recommended,
      planned_rounds = resolved_planned,
      registration_locked_at = coalesce(registration_locked_at, now()),
      started_at = coalesce(started_at, now()),
      current_round_number = 1,
      updated_at = now()
  where id = target_tournament_id;

  insert into public.tournament_event_log (workspace_id, tournament_id, actor_id, event_type, dedupe_key, metadata)
  values (tournament_row.workspace_id, target_tournament_id, auth.uid(), 'registration_locked', 'registration-locked', jsonb_build_object('eligible_player_count', eligible_count))
  on conflict (tournament_id, dedupe_key) do nothing;
  insert into public.tournament_event_log (workspace_id, tournament_id, actor_id, event_type, dedupe_key, metadata)
  values (tournament_row.workspace_id, target_tournament_id, auth.uid(), 'tournament_started', 'tournament-started', jsonb_build_object('planned_rounds', resolved_planned, 'recommended_rounds', resolved_recommended))
  on conflict (tournament_id, dedupe_key) do nothing;
  insert into public.tournament_event_log (workspace_id, tournament_id, actor_id, event_type, dedupe_key, metadata)
  values (tournament_row.workspace_id, target_tournament_id, auth.uid(), 'round_created', 'round-1-created', jsonb_build_object('round_number', 1, 'stage', 'swiss'))
  on conflict (tournament_id, dedupe_key) do nothing;

  return query select target_tournament_id, 'in_progress'::text, resolved_planned,
    resolved_recommended, eligible_count, first_round_id, 1, false;
end;
$$;

revoke all on function public.recommend_tournament_rounds(integer) from public;
grant execute on function public.recommend_tournament_rounds(integer) to authenticated;
revoke all on function public.start_tournament(uuid, integer) from public;
grant execute on function public.start_tournament(uuid, integer) to authenticated;

create or replace function public.add_staff_tournament_registration(
  target_tournament_id uuid,
  player_name text,
  player_email text default null,
  player_discord_username text default null
)
returns table (registration_id uuid, registration_status text, waitlist_position integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  tournament_row public.tournaments%rowtype;
  active_count bigint;
  next_status text;
  next_position integer;
begin
  if length(trim(player_name)) < 2 then raise exception using message = 'Player name is required.'; end if;
  select * into tournament_row from public.tournaments where id = target_tournament_id for update;
  if not found then raise exception using message = 'Tournament not found.'; end if;
  if not public.can_manage_workspace(tournament_row.workspace_id) then raise exception using message = 'Not authorized.'; end if;
  if tournament_row.registration_locked_at is not null then raise exception using message = 'Registration is locked because this tournament has started.'; end if;

  select count(*) into active_count from public.tournament_registrations
  where tournament_id = target_tournament_id and status in ('registered', 'checked_in');
  if tournament_row.max_players is null or active_count < tournament_row.max_players then
    next_status := 'registered'; next_position := null;
  elsif tournament_row.waitlist_enabled then
    next_status := 'waitlisted';
    select coalesce(max(waitlist_position), 0) + 1 into next_position
    from public.tournament_registrations where tournament_id = target_tournament_id and status = 'waitlisted';
  else
    raise exception using message = 'This tournament is full.';
  end if;

  insert into public.tournament_registrations (
    workspace_id, tournament_id, player_name, email, discord_username, status, source, waitlist_position
  ) values (
    tournament_row.workspace_id, target_tournament_id, trim(player_name), nullif(trim(player_email), ''),
    nullif(trim(player_discord_username), ''), next_status, 'other', next_position
  ) returning id into registration_id;
  registration_status := next_status;
  waitlist_position := next_position;
  return next;
end;
$$;

revoke all on function public.add_staff_tournament_registration(uuid, text, text, text) from public;
grant execute on function public.add_staff_tournament_registration(uuid, text, text, text) to authenticated;

create or replace function public.cancel_tournament_registration(target_registration_id uuid, target_tournament_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  registration_row public.tournament_registrations%rowtype;
  tournament_row public.tournaments%rowtype;
  promoted_id uuid;
begin
  select * into tournament_row from public.tournaments where id = target_tournament_id for update;
  if not found then raise exception using message = 'Tournament not found.'; end if;
  if not public.can_manage_workspace(tournament_row.workspace_id) then raise exception using message = 'Not authorized.'; end if;
  select * into registration_row from public.tournament_registrations
  where id = target_registration_id and tournament_id = target_tournament_id for update;
  if not found then raise exception using message = 'Registration not found.'; end if;

  if registration_row.status in ('registered', 'checked_in') then
    update public.tournament_registrations
    set status = 'cancelled', cancelled_at = now(), updated_at = now()
    where id = target_registration_id;
    select id into promoted_id from public.tournament_registrations
    where tournament_id = target_tournament_id and status = 'waitlisted'
    order by waitlist_position nulls last, registered_at, id
    limit 1 for update;
    if promoted_id is not null then
      update public.tournament_registrations
      set status = 'registered', waitlist_position = null, updated_at = now()
      where id = promoted_id;
    end if;
  elsif registration_row.status = 'waitlisted' then
    update public.tournament_registrations
    set status = 'cancelled', cancelled_at = now(), updated_at = now()
    where id = target_registration_id;
  end if;
  return promoted_id;
end;
$$;

create or replace function public.register_for_tournament(
  tournament_slug text,
  player_name text,
  player_email text default null,
  player_phone text default null,
  player_discord_username text default null,
  player_notes text default null,
  registration_source text default 'direct'
)
returns table (registration_id uuid, registration_status text, waitlist_position integer, registered_count bigint, max_players integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  tournament_row public.tournaments%rowtype;
  active_count bigint;
  next_status text;
  next_position integer;
begin
  if length(trim(player_name)) < 2 then raise exception using message = 'Player name is required.'; end if;
  select * into tournament_row from public.tournaments
  where slug = tournament_slug and status = 'published' and public_registration_enabled = true
  for update;
  if not found then raise exception using message = 'This tournament is not open for registration.'; end if;
  if tournament_row.registration_locked_at is not null or tournament_row.lifecycle_status in ('registration_closed', 'ready', 'in_progress', 'top_cut', 'completed', 'cancelled') then
    raise exception using message = 'Registration is closed because this tournament has started.';
  end if;
  if tournament_row.registration_deadline is not null and tournament_row.registration_deadline < now() then raise exception using message = 'Registration is closed.'; end if;

  select count(*) into active_count from public.tournament_registrations
  where tournament_id = tournament_row.id and status in ('registered', 'checked_in');
  if tournament_row.max_players is null or active_count < tournament_row.max_players then
    next_status := 'registered'; next_position := null;
  elsif tournament_row.waitlist_enabled then
    next_status := 'waitlisted';
    select coalesce(max(waitlist_position), 0) + 1 into next_position from public.tournament_registrations
    where tournament_id = tournament_row.id and status = 'waitlisted';
  else raise exception using message = 'This tournament is full.'; end if;

  insert into public.tournament_registrations (
    workspace_id, tournament_id, player_name, email, phone, discord_username, notes, status, source, waitlist_position
  ) values (
    tournament_row.workspace_id, tournament_row.id, trim(player_name), nullif(trim(player_email), ''),
    nullif(trim(player_phone), ''), nullif(trim(player_discord_username), ''), nullif(trim(player_notes), ''), next_status,
    case when registration_source in ('discord', 'direct', 'qr', 'other') then registration_source else 'direct' end, next_position
  ) returning id into registration_id;
  registration_status := next_status;
  waitlist_position := next_position;
  registered_count := active_count + case when next_status = 'registered' then 1 else 0 end;
  max_players := tournament_row.max_players;
  return next;
end;
$$;
