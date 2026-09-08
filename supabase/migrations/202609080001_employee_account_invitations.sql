-- Phase 1 employee accounts: store-scoped access and invitation state.
alter table public.workspace_members
  drop constraint if exists workspace_members_role_check;

alter table public.workspace_members
  add constraint workspace_members_role_check
  check (role in ('owner', 'admin', 'manager', 'member', 'viewer', 'employee'));

alter table public.workspace_employees
  add column if not exists account_status text not null default 'uninvited'
    check (account_status in ('uninvited', 'invited', 'active', 'suspended')),
  add column if not exists invitation_sent_at timestamptz,
  add column if not exists invitation_error text not null default '';

create unique index if not exists workspace_employees_workspace_email_idx
  on public.workspace_employees (workspace_id, lower(email))
  where email is not null;

drop policy if exists "Employees can view their own record" on public.workspace_employees;
create policy "Employees can view their own record"
  on public.workspace_employees for select
  to authenticated
  using (linked_user_id = auth.uid());
