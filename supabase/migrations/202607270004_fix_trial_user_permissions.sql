-- Fix trial access for projects where migration 003 was already applied.
-- The authenticated role cannot read auth.users directly. The signed-in
-- user's verified email is already available in the Supabase JWT.

drop policy if exists "Users read own active trial"
on public.account_trials;

create policy "Users read own active trial"
on public.account_trials for select to authenticated
using (
  user_id = auth.uid()
  or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

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
  current_email := lower(auth.jwt() ->> 'email');
  if current_email is null or current_email = '' then
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

revoke all on function public.attach_trial_to_current_user() from public;
grant execute on function public.attach_trial_to_current_user() to authenticated;
