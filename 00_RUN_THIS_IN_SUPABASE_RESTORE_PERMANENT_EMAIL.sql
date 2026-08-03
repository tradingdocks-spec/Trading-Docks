-- RESTORE THE ORIGINAL TRADING DOCKS INBOUND ADDRESS
-- Run once in Supabase SQL Editor after deploying this release.
--
-- Restores:
-- td_8554ad65d15ed645eeb4@inbound.tradingdocks.com
--
-- If your Supabase login email differs, change target_email below.

do $$
declare
  target_email text := 'tradingdocks@gmail.com';
  restored_token text := 'td_8554ad65d15ed645eeb4';
  target_user_id uuid;
  target_workspace_id uuid;
  conflicting_workspace_id uuid;
begin
  select id
    into target_user_id
  from auth.users
  where lower(email) = lower(target_email)
  order by created_at asc
  limit 1;

  if target_user_id is null then
    raise exception 'No Supabase user found for %', target_email;
  end if;

  select active_workspace_id
    into target_workspace_id
  from public.user_preferences
  where user_id = target_user_id
  limit 1;

  if target_workspace_id is null then
    select workspace_id
      into target_workspace_id
    from public.workspace_members
    where user_id = target_user_id
    order by created_at asc
    limit 1;
  end if;

  if target_workspace_id is null then
    raise exception 'No workspace found for %', target_email;
  end if;

  select workspace_id
    into conflicting_workspace_id
  from public.inbound_email_mailboxes
  where address_token = restored_token
    and workspace_id <> target_workspace_id
  limit 1;

  if conflicting_workspace_id is not null then
    raise exception 'The requested token is already assigned to another workspace.';
  end if;

  insert into public.inbound_email_mailboxes (
    workspace_id,
    created_by,
    address_token,
    status,
    email_provider,
    marketplace_id,
    rotation_count,
    created_at,
    updated_at
  )
  values (
    target_workspace_id,
    target_user_id,
    restored_token,
    'pending',
    'gmail',
    'tcgplayer',
    0,
    now(),
    now()
  )
  on conflict (workspace_id)
  do update set
    address_token = excluded.address_token,
    created_by = excluded.created_by,
    updated_at = now();

  raise notice 'Restored permanent address: %@inbound.tradingdocks.com', restored_token;
end $$;

notify pgrst, 'reload schema';
