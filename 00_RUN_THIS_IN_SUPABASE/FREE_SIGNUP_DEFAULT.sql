-- Every new Trading Docks account starts on Free. Onboarding personalizes the
-- workspace but cannot grant a paid membership.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_workspace_id uuid;
  display_name text;
begin
  display_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    split_part(new.email, '@', 1),
    'Trading Docks Owner'
  );

  insert into public.profiles (id, full_name)
  values (new.id, display_name)
  on conflict (id) do nothing;

  insert into public.workspaces (name, owner_id)
  values ('Trading Docks', new.id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');

  insert into public.user_preferences (user_id, active_workspace_id, preferences)
  values (
    new.id,
    new_workspace_id,
    jsonb_build_object('account_type', 'free')
  )
  on conflict (user_id) do update
    set active_workspace_id = excluded.active_workspace_id,
        preferences = coalesce(public.user_preferences.preferences, '{}'::jsonb)
          || jsonb_build_object('account_type', 'free');

  return new;
end;
$$;
