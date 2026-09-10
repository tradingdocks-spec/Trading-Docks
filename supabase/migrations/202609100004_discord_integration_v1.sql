-- Trading Docks Discord Integration V1.
-- One centrally managed Discord application may be installed in many guilds.
-- Every row remains scoped to exactly one Trading Docks workspace.

create table if not exists public.discord_integrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  guild_id text not null,
  guild_name text not null,
  guild_icon_url text,
  installed_by_user_id uuid not null references auth.users(id) on delete restrict,
  connected_at timestamptz not null default now(),
  disconnected_at timestamptz,
  status text not null default 'connected'
    check (status in ('connected', 'disconnected', 'error')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, guild_id)
);

create unique index if not exists discord_integrations_one_active_guild_idx
  on public.discord_integrations(workspace_id, guild_id)
  where status = 'connected';

create index if not exists discord_integrations_workspace_status_idx
  on public.discord_integrations(workspace_id, status, updated_at desc);

create table if not exists public.discord_channel_bindings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  discord_integration_id uuid not null references public.discord_integrations(id) on delete cascade,
  channel_id text not null,
  channel_name text not null,
  purpose text check (purpose is null or purpose in ('general', 'deals', 'new_arrivals', 'tournaments', 'events', 'buylist', 'showcase', 'other')),
  enabled boolean not null default false,
  can_view boolean not null default false,
  can_send boolean not null default false,
  can_embed boolean not null default false,
  unavailable_reason text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (discord_integration_id, channel_id)
);

create index if not exists discord_channel_bindings_workspace_idx
  on public.discord_channel_bindings(workspace_id, enabled, channel_name);
create index if not exists discord_channel_bindings_integration_idx
  on public.discord_channel_bindings(discord_integration_id, channel_id);

create table if not exists public.discord_oauth_states (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  state_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists discord_oauth_states_expiry_idx
  on public.discord_oauth_states(expires_at, consumed_at);

create table if not exists public.discord_message_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  discord_integration_id uuid not null references public.discord_integrations(id) on delete set null,
  channel_id text not null,
  channel_name text,
  announcement_type text not null
    check (announcement_type in ('general', 'tournament', 'deal', 'new_arrival', 'restock', 'showcase', 'buylist', 'test')),
  title text not null,
  message_preview text not null default '',
  discord_message_id text,
  status text not null check (status in ('sent', 'failed')),
  sent_by uuid not null references auth.users(id) on delete restrict,
  sent_at timestamptz not null default now(),
  error_code text,
  error_summary text,
  created_at timestamptz not null default now()
);

create index if not exists discord_message_log_workspace_time_idx
  on public.discord_message_log(workspace_id, sent_at desc);

alter table public.discord_integrations enable row level security;
alter table public.discord_channel_bindings enable row level security;
alter table public.discord_oauth_states enable row level security;
alter table public.discord_message_log enable row level security;

create or replace function public.is_workspace_discord_sender(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
      and role in ('owner', 'admin', 'manager', 'employee')
  );
$$;

drop policy if exists "Discord members view integrations" on public.discord_integrations;
create policy "Discord members view integrations"
  on public.discord_integrations for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Discord admins manage integrations" on public.discord_integrations;
create policy "Discord admins manage integrations"
  on public.discord_integrations for all to authenticated
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

drop policy if exists "Discord members view channels" on public.discord_channel_bindings;
create policy "Discord members view channels"
  on public.discord_channel_bindings for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Discord admins manage channels" on public.discord_channel_bindings;
create policy "Discord admins manage channels"
  on public.discord_channel_bindings for all to authenticated
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

drop policy if exists "Discord admins manage oauth state" on public.discord_oauth_states;
create policy "Discord admins manage oauth state"
  on public.discord_oauth_states for all to authenticated
  using (public.is_workspace_admin(workspace_id) and user_id = auth.uid())
  with check (public.is_workspace_admin(workspace_id) and user_id = auth.uid());

drop policy if exists "Discord members view message log" on public.discord_message_log;
create policy "Discord members view message log"
  on public.discord_message_log for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Discord senders create message log" on public.discord_message_log;
create policy "Discord senders create message log"
  on public.discord_message_log for insert to authenticated
  with check (public.is_workspace_discord_sender(workspace_id) and sent_by = auth.uid());

drop trigger if exists discord_integrations_set_updated_at on public.discord_integrations;
create trigger discord_integrations_set_updated_at
before update on public.discord_integrations
for each row execute procedure public.set_updated_at();

drop trigger if exists discord_channel_bindings_set_updated_at on public.discord_channel_bindings;
create trigger discord_channel_bindings_set_updated_at
before update on public.discord_channel_bindings
for each row execute procedure public.set_updated_at();

revoke all on public.discord_integrations from anon;
revoke all on public.discord_channel_bindings from anon;
revoke all on public.discord_oauth_states from anon;
revoke all on public.discord_message_log from anon;
grant select, insert, update, delete on public.discord_integrations to authenticated;
grant select, insert, update, delete on public.discord_channel_bindings to authenticated;
grant select, insert, update, delete on public.discord_oauth_states to authenticated;
grant select, insert on public.discord_message_log to authenticated;
