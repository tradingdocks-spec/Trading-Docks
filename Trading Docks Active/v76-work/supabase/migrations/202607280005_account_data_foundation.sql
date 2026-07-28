-- Personal account documents replace browser storage for feature data that is
-- naturally stored as a complete document (decks, calendar state, drafts, etc.).
create table if not exists public.account_documents (
  user_id uuid not null references auth.users(id) on delete cascade,
  document_key text not null check (length(document_key) between 1 and 160),
  data jsonb not null default 'null'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, document_key)
);

create index if not exists account_documents_user_updated_idx
  on public.account_documents(user_id, updated_at desc);

alter table public.account_documents enable row level security;

drop policy if exists "Users manage their own account documents" on public.account_documents;
create policy "Users manage their own account documents"
  on public.account_documents for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on public.account_documents from anon;
grant select, insert, update, delete on public.account_documents to authenticated;

-- Store-level helpers. Managers may operate the business; only an owner or
-- administrator should grant roles through the existing membership controls.
create or replace function public.can_manage_workspace(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin', 'manager')
  );
$$;

-- Employees are deliberately isolated from ordinary workspace members because
-- this table can contain private contact, compensation, and permission data.
create table if not exists public.workspace_employees (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  linked_user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  job_title text,
  employment_status text not null default 'active',
  permissions jsonb not null default '{}'::jsonb,
  compensation jsonb not null default '{}'::jsonb,
  data jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workspace_employees_workspace_idx
  on public.workspace_employees(workspace_id, employment_status, full_name);

alter table public.workspace_employees enable row level security;
drop policy if exists "Managers manage workspace employees" on public.workspace_employees;
create policy "Managers manage workspace employees"
  on public.workspace_employees for all
  to authenticated
  using (public.can_manage_workspace(workspace_id))
  with check (public.can_manage_workspace(workspace_id));

-- Tournament entities use relational rows so stores can safely support many
-- events, players, rounds, and pairings without loading one giant document.
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  game text not null default '',
  format text not null default '',
  status text not null default 'draft',
  starts_at timestamptz,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tournament_players (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  display_name text not null,
  email text,
  external_id text,
  standing jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.tournament_rounds (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  round_number integer not null check (round_number > 0),
  status text not null default 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  unique (tournament_id, round_number)
);

create table if not exists public.tournament_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round_id uuid not null references public.tournament_rounds(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  table_number integer,
  player_one_id uuid references public.tournament_players(id) on delete set null,
  player_two_id uuid references public.tournament_players(id) on delete set null,
  result jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tournaments_workspace_idx
  on public.tournaments(workspace_id, starts_at desc);
create index if not exists tournament_players_tournament_idx
  on public.tournament_players(tournament_id);
create index if not exists tournament_rounds_tournament_idx
  on public.tournament_rounds(tournament_id, round_number);
create index if not exists tournament_matches_round_idx
  on public.tournament_matches(round_id, table_number);

alter table public.tournaments enable row level security;
alter table public.tournament_players enable row level security;
alter table public.tournament_rounds enable row level security;
alter table public.tournament_matches enable row level security;

drop policy if exists "Members view tournaments" on public.tournaments;
create policy "Members view tournaments" on public.tournaments for select
  to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists "Managers manage tournaments" on public.tournaments;
create policy "Managers manage tournaments" on public.tournaments for all
  to authenticated using (public.can_manage_workspace(workspace_id))
  with check (public.can_manage_workspace(workspace_id));

drop policy if exists "Members view tournament players" on public.tournament_players;
create policy "Members view tournament players" on public.tournament_players for select
  to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists "Managers manage tournament players" on public.tournament_players;
create policy "Managers manage tournament players" on public.tournament_players for all
  to authenticated using (public.can_manage_workspace(workspace_id))
  with check (public.can_manage_workspace(workspace_id));

drop policy if exists "Members view tournament rounds" on public.tournament_rounds;
create policy "Members view tournament rounds" on public.tournament_rounds for select
  to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists "Managers manage tournament rounds" on public.tournament_rounds;
create policy "Managers manage tournament rounds" on public.tournament_rounds for all
  to authenticated using (public.can_manage_workspace(workspace_id))
  with check (public.can_manage_workspace(workspace_id));

drop policy if exists "Members view tournament matches" on public.tournament_matches;
create policy "Members view tournament matches" on public.tournament_matches for select
  to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists "Managers manage tournament matches" on public.tournament_matches;
create policy "Managers manage tournament matches" on public.tournament_matches for all
  to authenticated using (public.can_manage_workspace(workspace_id))
  with check (public.can_manage_workspace(workspace_id));

revoke all on public.workspace_employees from anon;
revoke all on public.tournaments from anon;
revoke all on public.tournament_players from anon;
revoke all on public.tournament_rounds from anon;
revoke all on public.tournament_matches from anon;
grant select, insert, update, delete on public.workspace_employees to authenticated;
grant select, insert, update, delete on public.tournaments to authenticated;
grant select, insert, update, delete on public.tournament_players to authenticated;
grant select, insert, update, delete on public.tournament_rounds to authenticated;
grant select, insert, update, delete on public.tournament_matches to authenticated;

