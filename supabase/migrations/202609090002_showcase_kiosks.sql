create table if not exists public.showcase_kiosk_devices (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  display_name text not null default 'Front Counter', location_id text, token_hash text unique not null,
  enabled boolean not null default true, paired_at timestamptz not null default now(), last_seen_at timestamptz,
  revoked_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.showcase_kiosk_pairing_codes (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  code_hash text unique not null, expires_at timestamptz not null, consumed_at timestamptz, created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create index if not exists showcase_kiosk_workspace_idx on public.showcase_kiosk_devices(workspace_id, enabled);
create index if not exists showcase_pairing_expiry_idx on public.showcase_kiosk_pairing_codes(code_hash, expires_at);
alter table public.showcase_kiosk_devices enable row level security; alter table public.showcase_kiosk_pairing_codes enable row level security;
create policy "Showcase admins manage kiosks" on public.showcase_kiosk_devices for all to authenticated using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));
create policy "Showcase admins manage pairing codes" on public.showcase_kiosk_pairing_codes for all to authenticated using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));
create or replace function public.consume_showcase_pairing_code(input_code text, device_name text default 'Front Counter') returns jsonb language plpgsql security definer set search_path = public as $$
declare code_row record; token text; device_id uuid; begin
  select * into code_row from public.showcase_kiosk_pairing_codes where code_hash = encode(digest(regexp_replace(input_code, '[^0-9]', '', 'g'), 'sha256'), 'hex') and consumed_at is null and expires_at > now() for update;
  if not found then raise exception using errcode = 'P0002', message = 'Pairing code is invalid or expired.'; end if;
  token := encode(gen_random_bytes(32), 'hex');
  insert into public.showcase_kiosk_devices(workspace_id, display_name, token_hash) values (code_row.workspace_id, coalesce(nullif(trim(device_name),''),'Front Counter'), encode(digest(token, 'sha256'), 'hex')) returning id into device_id;
  update public.showcase_kiosk_pairing_codes set consumed_at = now() where id = code_row.id;
  return jsonb_build_object('device_id', device_id, 'token', token);
end; $$;
revoke all on function public.consume_showcase_pairing_code(text,text) from public; grant execute on function public.consume_showcase_pairing_code(text,text) to anon, authenticated;
