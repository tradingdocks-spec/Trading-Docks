-- Hosted workspace_members uses member for linked staff. Their explicit POS
-- permissions must take precedence over the ordinary member sell default.
create or replace function pos_private.permission(w uuid, operation text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.workspace_members m
   where m.workspace_id=w and m.user_id=auth.uid()
   and (m.role in ('owner','admin','manager')
     or (m.role='member' and operation='sell' and not exists(
       select 1 from public.workspace_employees e where e.workspace_id=w and e.linked_user_id=m.user_id))
     or (m.role in ('member','employee') and exists(
       select 1 from public.workspace_employees e
       where e.workspace_id=w and e.linked_user_id=m.user_id
         and e.employment_status='active'
         and coalesce(e.permissions->>('pos.'||operation),'false')='true'))))
$$;
revoke all on function pos_private.permission(uuid,text) from public,anon,authenticated;
