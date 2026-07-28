-- User feedback, bug reports, feature requests, and private attachments.
-- Apply after 202607270007_admin_user_directory_usage.sql.

create table if not exists public.feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  submission_type text not null check (submission_type in ('feedback', 'bug', 'feature')),
  title text not null check (char_length(title) between 3 and 140),
  description text not null check (char_length(description) between 10 and 10000),
  page_url text,
  severity text check (severity is null or severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'new' check (status in ('new', 'reviewing', 'planned', 'in_progress', 'resolved', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  admin_notes text,
  admin_response text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.feedback_attachments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.feedback_submissions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint not null default 0 check (size_bytes between 0 and 10485760),
  created_at timestamptz not null default now()
);

create index if not exists feedback_submissions_user_created_idx
  on public.feedback_submissions(user_id, created_at desc);
create index if not exists feedback_submissions_admin_queue_idx
  on public.feedback_submissions(status, priority, created_at desc);
create index if not exists feedback_attachments_submission_idx
  on public.feedback_attachments(submission_id);

alter table public.feedback_submissions enable row level security;
alter table public.feedback_attachments enable row level security;

create policy "Users create own feedback"
on public.feedback_submissions for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users read own feedback"
on public.feedback_submissions for select to authenticated
using ((select auth.uid()) = user_id or public.is_platform_owner());

create policy "Owner updates feedback"
on public.feedback_submissions for update to authenticated
using (public.is_platform_owner())
with check (public.is_platform_owner());

create policy "Users add own feedback attachments"
on public.feedback_attachments for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.feedback_submissions f
    where f.id = submission_id and f.user_id = (select auth.uid())
  )
);

create policy "Users read own feedback attachments"
on public.feedback_attachments for select to authenticated
using ((select auth.uid()) = user_id or public.is_platform_owner());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'feedback-attachments',
  'feedback-attachments',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/plain']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users upload own feedback files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'feedback-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users read own feedback files"
on storage.objects for select to authenticated
using (
  bucket_id = 'feedback-attachments'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.is_platform_owner()
  )
);

create or replace function public.admin_feedback_queue()
returns table (
  id uuid,
  user_id uuid,
  email text,
  full_name text,
  submission_type text,
  title text,
  description text,
  page_url text,
  severity text,
  status text,
  priority text,
  admin_notes text,
  admin_response text,
  created_at timestamptz,
  updated_at timestamptz,
  attachment_count bigint
)
language sql
security definer
set search_path = ''
as $$
  select
    f.id, f.user_id, u.email::text, p.full_name, f.submission_type,
    f.title, f.description, f.page_url, f.severity, f.status, f.priority,
    f.admin_notes, f.admin_response, f.created_at, f.updated_at,
    count(a.id)::bigint
  from public.feedback_submissions f
  join auth.users u on u.id = f.user_id
  left join public.profiles p on p.id = f.user_id
  left join public.feedback_attachments a on a.submission_id = f.id
  where public.is_platform_owner()
  group by f.id, u.email, p.full_name
  order by
    case f.priority when 'urgent' then 1 when 'high' then 2 when 'normal' then 3 else 4 end,
    f.created_at desc;
$$;

revoke all on function public.admin_feedback_queue() from public;
grant execute on function public.admin_feedback_queue() to authenticated;

