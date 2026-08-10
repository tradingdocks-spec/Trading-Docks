-- Trading Docks v193: durable, workspace-owned data for every plan tier.

create table if not exists public.workspace_documents (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  document_key text not null check (length(document_key) between 1 and 160),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null default 'null'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, document_key)
);

create index if not exists workspace_documents_updated_idx
  on public.workspace_documents(workspace_id, updated_at desc);

alter table public.workspace_documents enable row level security;

drop policy if exists "Members read workspace documents" on public.workspace_documents;
create policy "Members read workspace documents"
on public.workspace_documents for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Members create workspace documents" on public.workspace_documents;
create policy "Members create workspace documents"
on public.workspace_documents for insert to authenticated
with check (public.is_workspace_member(workspace_id) and user_id = auth.uid());

drop policy if exists "Members update workspace documents" on public.workspace_documents;
create policy "Members update workspace documents"
on public.workspace_documents for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "Managers delete workspace documents" on public.workspace_documents;
create policy "Managers delete workspace documents"
on public.workspace_documents for delete to authenticated
using (public.can_manage_workspace(workspace_id) or user_id = auth.uid());

revoke all on public.workspace_documents from anon;
grant select, insert, update, delete on public.workspace_documents to authenticated;

drop trigger if exists workspace_documents_set_updated_at on public.workspace_documents;
create trigger workspace_documents_set_updated_at
before update on public.workspace_documents
for each row execute procedure public.set_updated_at();

insert into public.workspace_documents (workspace_id, document_key, user_id, data, created_at, updated_at)
select up.active_workspace_id, ad.document_key, ad.user_id, ad.data, ad.created_at, ad.updated_at
from public.account_documents ad
join public.user_preferences up on up.user_id = ad.user_id
where up.active_workspace_id is not null
on conflict (workspace_id, document_key) do nothing;
