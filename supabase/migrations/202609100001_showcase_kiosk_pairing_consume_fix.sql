-- Keep kiosk pairing functions independent of the caller's search_path.
-- pgcrypto is installed in the extensions schema on production Supabase.
create or replace function public.consume_showcase_pairing_code(input_code text, device_name text default 'Front Counter')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  code_row record;
  token text;
  device_id uuid;
  normalized_code text;
  code_digest text;
begin
  normalized_code := regexp_replace(coalesce(input_code, ''), '[^0-9]', '', 'g');
  if length(normalized_code) <> 6 then
    raise exception using errcode = 'P0002', message = 'Pairing code is invalid or expired.';
  end if;

  code_digest := encode(extensions.digest(convert_to(normalized_code, 'UTF8'), 'sha256'), 'hex');

  select * into code_row
  from public.showcase_kiosk_pairing_codes
  where code_hash = code_digest
    and consumed_at is null
    and expires_at > now()
  for update;

  if not found then
    if exists (select 1 from public.showcase_kiosk_pairing_codes where code_hash = code_digest and consumed_at is not null) then
      raise exception using errcode = 'P0004', message = 'Pairing code has already been used.';
    end if;
    if exists (select 1 from public.showcase_kiosk_pairing_codes where code_hash = code_digest and consumed_at is null and expires_at <= now()) then
      raise exception using errcode = 'P0003', message = 'Pairing code has expired.';
    end if;
    raise exception using errcode = 'P0002', message = 'Pairing code is invalid or expired.';
  end if;

  token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.showcase_kiosk_devices(workspace_id, display_name, token_hash)
  values (code_row.workspace_id, coalesce(nullif(trim(device_name), ''), 'Front Counter'), encode(extensions.digest(convert_to(token, 'UTF8'), 'sha256'), 'hex'))
  returning id into device_id;

  update public.showcase_kiosk_pairing_codes set consumed_at = now() where id = code_row.id;
  return jsonb_build_object('device_id', device_id, 'token', token);
end;
$$;

create or replace function public.get_kiosk_context(input_token text)
returns table (device_id uuid, workspace_id uuid, showcase_slug text)
language sql
security definer
stable
set search_path = public
as $$
  select d.id, d.workspace_id, p.slug
  from public.showcase_kiosk_devices d
  join public.showcase_profiles p on p.workspace_id = d.workspace_id
  where d.token_hash = encode(extensions.digest(convert_to(input_token, 'UTF8'), 'sha256'), 'hex')
    and d.enabled
    and d.revoked_at is null
    and p.enabled
    and p.kiosk_enabled;
$$;
