-- Card Photo Price Scanner foundation.
create table if not exists public.card_scan_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  source_type text not null default 'manual_upload' check (source_type in ('manual_upload','phone_camera','webcam','document_scanner','bulk_scanner')),
  status text not null default 'identified',
  original_filename text,
  recognized_name text,
  recognized_set_code text,
  recognized_collector_number text,
  recognition_confidence numeric(5,4),
  selected_scryfall_id uuid,
  selected_condition text,
  selected_finish text,
  suggested_offer numeric(12,2),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists card_scan_sessions_workspace_created_idx on public.card_scan_sessions (workspace_id, created_at desc);
alter table public.card_scan_sessions enable row level security;
drop policy if exists "workspace members can view card scans" on public.card_scan_sessions;
create policy "workspace members can view card scans" on public.card_scan_sessions for select using (exists (select 1 from public.workspace_members wm where wm.workspace_id = card_scan_sessions.workspace_id and wm.user_id = auth.uid()));
drop policy if exists "workspace members can create card scans" on public.card_scan_sessions;
create policy "workspace members can create card scans" on public.card_scan_sessions for insert with check (exists (select 1 from public.workspace_members wm where wm.workspace_id = card_scan_sessions.workspace_id and wm.user_id = auth.uid()));
notify pgrst, 'reload schema';
