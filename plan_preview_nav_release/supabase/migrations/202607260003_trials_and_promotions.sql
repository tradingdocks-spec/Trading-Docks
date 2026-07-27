-- Email-based free trials and usage tracking for the Trading Docks Admin Control Center.
-- Apply after 202607260002_admin_control_center.sql.

create table if not exists public.account_trials (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  user_id uuid references auth.users(id) on delete set null,
  plan_id text not null references public.account_plans(id) on delete restrict,
  status text not null default 'active'
    check (status in ('scheduled', 'active', 'expired', 'converted', 'revoked')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  activated_at timestamptz,
  last_active_at timestamptz,
  usage_events bigint not null default 0,
  converted_at timestamptz,
  notes text not null default '',
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_trials_dates_valid check (ends_at > starts_at)
);

create unique index if not exists account_trials_one_open_email
on public.account_trials (lower(email))
where status in ('scheduled', 'active');

create index if not exists account_trials_status_ends_idx
on public.account_trials (status, ends_at);

create table if not exists public.trial_usage_events (
  id bigint generated always as identity primary key,
  trial_id uuid not null references public.account_trials(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  feature_id text,
  event_name text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.account_trials enable row level security;
alter table public.trial_usage_events enable row level security;

create policy "Owner manages trials"
on public.account_trials for all to authenticated
using (public.is_platform_owner()) with check (public.is_platform_owner());

create policy "Users read own active trial"
on public.account_trials for select to authenticated
using (
  user_id = auth.uid()
  or lower(email) = lower(coalesce((select email from auth.users where id = auth.uid()), ''))
);

create policy "Owner reads trial usage"
on public.trial_usage_events for select to authenticated
using (public.is_platform_owner());

create or replace function public.attach_trial_to_current_user()
returns public.account_trials
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.account_trials;
  current_email text;
begin
  select lower(email) into current_email from auth.users where id = auth.uid();
  if current_email is null then
    raise exception 'Authentication required';
  end if;

  update public.account_trials
  set user_id = auth.uid(),
      activated_at = coalesce(activated_at, now()),
      status = case when starts_at > now() then 'scheduled' else 'active' end,
      updated_at = now()
  where lower(email) = current_email
    and status in ('scheduled', 'active')
    and ends_at > now()
    and (user_id is null or user_id = auth.uid())
  returning * into result;

  return result;
end;
$$;

grant execute on function public.attach_trial_to_current_user() to authenticated;

create or replace function public.record_trial_usage(
  requested_feature text,
  requested_event text,
  requested_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_trial_id uuid;
begin
  select id into active_trial_id
  from public.account_trials
  where user_id = auth.uid()
    and status = 'active'
    and starts_at <= now()
    and ends_at > now()
  order by ends_at desc
  limit 1;

  if active_trial_id is null then return; end if;

  insert into public.trial_usage_events (trial_id, user_id, feature_id, event_name, metadata)
  values (active_trial_id, auth.uid(), requested_feature, requested_event, coalesce(requested_metadata, '{}'::jsonb));

  update public.account_trials
  set usage_events = usage_events + 1, last_active_at = now(), updated_at = now()
  where id = active_trial_id;
end;
$$;

grant execute on function public.record_trial_usage(text, text, jsonb) to authenticated;

create or replace function public.refresh_trial_statuses()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare updated_count integer;
begin
  if not public.is_platform_owner() then raise exception 'Owner access required'; end if;
  update public.account_trials
  set status = 'expired', updated_at = now()
  where status in ('scheduled', 'active') and ends_at <= now();
  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

grant execute on function public.refresh_trial_statuses() to authenticated;
