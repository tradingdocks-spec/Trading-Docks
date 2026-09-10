-- Additive tournament registration and Discord announcement support.
alter table public.tournaments add column if not exists slug text;
alter table public.tournaments add column if not exists ends_at timestamptz;
alter table public.tournaments add column if not exists entry_fee numeric(10,2);
alter table public.tournaments add column if not exists location text;
alter table public.tournaments add column if not exists description text;
alter table public.tournaments add column if not exists prize_support text;
alter table public.tournaments add column if not exists max_players integer;
alter table public.tournaments add column if not exists registration_deadline timestamptz;
alter table public.tournaments add column if not exists decklist_required boolean not null default false;
alter table public.tournaments add column if not exists public_registration_enabled boolean not null default false;
alter table public.tournaments add column if not exists waitlist_enabled boolean not null default false;

update public.tournaments
set slug = regexp_replace(lower(trim(name)), '[^a-z0-9]+', '-', 'g')
where slug is null;

create unique index if not exists tournaments_workspace_slug_idx
  on public.tournaments(workspace_id, slug);
create index if not exists tournaments_public_listing_idx
  on public.tournaments(slug, status, public_registration_enabled, starts_at);

alter table public.tournaments alter column slug set not null;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tournaments_max_players_check'
      and conrelid = 'public.tournaments'::regclass
  ) then
    alter table public.tournaments add constraint tournaments_max_players_check
      check (max_players is null or max_players > 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'tournaments_entry_fee_check'
      and conrelid = 'public.tournaments'::regclass
  ) then
    alter table public.tournaments add constraint tournaments_entry_fee_check
      check (entry_fee is null or entry_fee >= 0);
  end if;
end $$;

create table if not exists public.tournament_registrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  player_name text not null,
  email text,
  phone text,
  discord_username text,
  notes text,
  status text not null default 'registered'
    check (status in ('registered', 'waitlisted', 'checked_in', 'cancelled', 'no_show')),
  source text not null default 'direct'
    check (source in ('discord', 'direct', 'qr', 'other')),
  registered_at timestamptz not null default now(),
  checked_in_at timestamptz,
  cancelled_at timestamptz,
  waitlist_position integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists tournament_registrations_email_idx
  on public.tournament_registrations(tournament_id, lower(email))
  where email is not null and status <> 'cancelled';
create index if not exists tournament_registrations_tournament_status_idx
  on public.tournament_registrations(tournament_id, status, registered_at);
create index if not exists tournament_registrations_workspace_idx
  on public.tournament_registrations(workspace_id, created_at desc);

alter table public.tournament_registrations enable row level security;
create or replace function public.is_workspace_tournament_staff(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace_id and user_id = auth.uid()
      and role in ('owner', 'admin', 'manager', 'employee')
  );
$$;
drop policy if exists "Members view tournament registrations" on public.tournament_registrations;
create policy "Members view tournament registrations"
  on public.tournament_registrations for select to authenticated
  using (public.is_workspace_tournament_staff(workspace_id));
drop policy if exists "Managers manage tournament registrations" on public.tournament_registrations;
create policy "Managers manage tournament registrations"
  on public.tournament_registrations for all to authenticated
  using (public.can_manage_workspace(workspace_id))
  with check (public.can_manage_workspace(workspace_id));

drop policy if exists "Public view published tournaments" on public.tournaments;
create policy "Public view published tournaments"
  on public.tournaments for select to anon, authenticated
  using (status = 'published' and public_registration_enabled = true);

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
  if length(trim(player_name)) < 2 then
    raise exception using message = 'Player name is required.';
  end if;

  select * into tournament_row
  from public.tournaments
  where slug = tournament_slug
    and status = 'published'
    and public_registration_enabled = true
  for update;

  if not found then raise exception using message = 'This tournament is not open for registration.'; end if;
  if tournament_row.registration_deadline is not null and tournament_row.registration_deadline < now() then
    raise exception using message = 'Registration is closed.';
  end if;

  select count(*) into active_count
  from public.tournament_registrations
  where tournament_id = tournament_row.id and status in ('registered', 'checked_in');

  if tournament_row.max_players is null or active_count < tournament_row.max_players then
    next_status := 'registered';
    next_position := null;
  elsif tournament_row.waitlist_enabled then
    next_status := 'waitlisted';
    select coalesce(max(waitlist_position), 0) + 1 into next_position
    from public.tournament_registrations
    where tournament_id = tournament_row.id and status = 'waitlisted';
  else
    raise exception using message = 'This tournament is full.';
  end if;

  insert into public.tournament_registrations (
    workspace_id, tournament_id, player_name, email, phone, discord_username, notes, status, source, waitlist_position
  ) values (
    tournament_row.workspace_id, tournament_row.id, trim(player_name), nullif(trim(player_email), ''),
    nullif(trim(player_phone), ''), nullif(trim(player_discord_username), ''), nullif(trim(player_notes), ''),
    next_status, case when registration_source in ('discord', 'direct', 'qr', 'other') then registration_source else 'direct' end,
    next_position
  ) returning id into registration_id;

  registration_status := next_status;
  waitlist_position := next_position;
  registered_count := active_count + case when next_status = 'registered' then 1 else 0 end;
  max_players := tournament_row.max_players;
  return next;
end;
$$;

drop function if exists public.cancel_tournament_registration(uuid);
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
  select * into registration_row from public.tournament_registrations where id = target_registration_id for update;
  if not found then raise exception using message = 'Registration not found.'; end if;
  if registration_row.tournament_id <> target_tournament_id then raise exception using message = 'Registration does not belong to this tournament.'; end if;
  if not public.can_manage_workspace(registration_row.workspace_id) then raise exception using message = 'Not authorized.'; end if;
  select * into tournament_row from public.tournaments where id = registration_row.tournament_id for update;

  if registration_row.status in ('registered', 'checked_in') then
    update public.tournament_registrations
    set status = 'cancelled', cancelled_at = now(), updated_at = now()
    where id = target_registration_id;
    select id into promoted_id from public.tournament_registrations
    where tournament_id = registration_row.tournament_id and status = 'waitlisted'
    order by waitlist_position nulls last, registered_at
    limit 1 for update skip locked;
    if promoted_id is not null then
      update public.tournament_registrations
      set status = 'registered', waitlist_position = null, updated_at = now()
      where id = promoted_id;
    end if;
  elsif registration_row.status = 'waitlisted' then
    update public.tournament_registrations set status = 'cancelled', cancelled_at = now(), updated_at = now() where id = target_registration_id;
  end if;
  return promoted_id;
end;
$$;

drop function if exists public.update_tournament_registration_status(uuid, text);
create or replace function public.update_tournament_registration_status(target_registration_id uuid, target_tournament_id uuid, next_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  registration_workspace uuid;
  registration_tournament uuid;
begin
  if next_status not in ('registered', 'checked_in', 'no_show') then raise exception using message = 'Invalid registration status.'; end if;
  select workspace_id, tournament_id into registration_workspace, registration_tournament from public.tournament_registrations where id = target_registration_id;
  if registration_workspace is null or not public.is_workspace_tournament_staff(registration_workspace) then raise exception using message = 'Not authorized.'; end if;
  if registration_tournament <> target_tournament_id then raise exception using message = 'Registration does not belong to this tournament.'; end if;
  update public.tournament_registrations
  set status = next_status, checked_in_at = case when next_status = 'checked_in' then now() else null end, updated_at = now()
  where id = target_registration_id;
end;
$$;

revoke all on public.tournament_registrations from anon;
grant select, insert, update, delete on public.tournament_registrations to authenticated;
revoke all on function public.register_for_tournament(text, text, text, text, text, text, text) from public;
grant execute on function public.register_for_tournament(text, text, text, text, text, text, text) to anon, authenticated;
revoke all on function public.cancel_tournament_registration(uuid, uuid) from public;
grant execute on function public.cancel_tournament_registration(uuid, uuid) to authenticated;
revoke all on function public.update_tournament_registration_status(uuid, uuid, text) from public;
grant execute on function public.update_tournament_registration_status(uuid, uuid, text) to authenticated;
grant select on public.tournaments to anon;

alter table public.discord_message_log add column if not exists tournament_id uuid references public.tournaments(id) on delete set null;
create index if not exists discord_message_log_tournament_idx on public.discord_message_log(tournament_id, sent_at desc);
