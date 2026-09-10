-- Showcase operations: request source, quantity-level picking, and reservations.
alter table public.showcase_requests add column if not exists source text not null default 'public_web' check (source in ('public_web','kiosk','qr'));
alter table public.showcase_requests add column if not exists kiosk_device_id uuid references public.showcase_kiosk_devices(id) on delete set null;
alter table public.showcase_request_items add column if not exists picked_quantity integer not null default 0 check (picked_quantity >= 0);
alter table public.showcase_request_items add column if not exists picked_at timestamptz;
alter table public.showcase_request_items add column if not exists picked_by uuid references auth.users(id) on delete set null;

create table if not exists public.showcase_inventory_reservations (
  id uuid primary key default gen_random_uuid(), request_id uuid not null references public.showcase_requests(id) on delete cascade,
  request_item_id uuid not null references public.showcase_request_items(id) on delete cascade,
  inventory_item_id text not null, workspace_id uuid not null references public.workspaces(id) on delete cascade,
  quantity integer not null check (quantity > 0), status text not null default 'active' check (status in ('active','released','consumed')),
  created_at timestamptz not null default now(), released_at timestamptz
);
create unique index if not exists showcase_reservation_active_item_idx on public.showcase_inventory_reservations(request_item_id) where status = 'active';
create index if not exists showcase_reservation_inventory_idx on public.showcase_inventory_reservations(workspace_id, inventory_item_id, status);
alter table public.showcase_inventory_reservations enable row level security;
create policy "Showcase members view reservations" on public.showcase_inventory_reservations for select to authenticated using (public.is_workspace_member(workspace_id));

create or replace function public.reserve_showcase_request_item() returns trigger language plpgsql security definer set search_path = public as $$
declare r record; p record; available integer;
begin
  select sr.workspace_id into r from public.showcase_requests sr where sr.id = new.request_id;
  select ii.* into p from public.inventory_items ii join public.workspaces w on w.owner_id = ii.user_id where w.id = r.workspace_id and ii.id = new.canonical_inventory_ref for update;
  if not found then raise exception using errcode = 'P0001', message = 'Requested inventory is no longer available.'; end if;
  select p.quantity - coalesce(sum(quantity) filter (where status = 'active'), 0) into available from public.showcase_inventory_reservations where inventory_item_id = p.id and status = 'active';
  if available < new.requested_quantity or coalesce(p.data->>'private','false')::boolean or coalesce(p.data->>'excludedFromShowcase','false')::boolean then raise exception using errcode = 'P0001', message = 'Requested inventory is no longer available.'; end if;
  insert into public.showcase_inventory_reservations(request_id, request_item_id, inventory_item_id, workspace_id, quantity) values (new.request_id, new.id, p.id, r.workspace_id, new.requested_quantity);
  return new;
end; $$;
drop trigger if exists showcase_request_item_reservation on public.showcase_request_items;
create trigger showcase_request_item_reservation after insert on public.showcase_request_items for each row execute procedure public.reserve_showcase_request_item();

create or replace function public.get_kiosk_context(input_token text)
returns table (device_id uuid, workspace_id uuid, showcase_slug text)
language sql security definer stable set search_path = public
as $$ select d.id, d.workspace_id, p.slug from public.showcase_kiosk_devices d join public.showcase_profiles p on p.workspace_id = d.workspace_id where d.token_hash = encode(extensions.digest(convert_to(input_token, 'UTF8'), 'sha256'), 'hex') and d.enabled and d.revoked_at is null and p.enabled and p.kiosk_enabled; $$;
revoke all on function public.get_kiosk_context(text) from public; grant execute on function public.get_kiosk_context(text) to anon, authenticated;

create or replace function public.update_showcase_request_status(requested_id uuid, next_status text, actor_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare r record; line record; reserved integer; begin
  select * into r from public.showcase_requests where id = requested_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Request not found.'; end if;
  if r.status = 'new' and next_status = 'picking' then null;
  elsif r.status = 'picking' and next_status = 'ready' then
    if exists (select 1 from public.showcase_request_items where request_id = r.id and picked_quantity < requested_quantity) then raise exception using errcode = '22023', message = 'Every requested quantity must be picked before marking ready.'; end if;
  elsif r.status = 'ready' and next_status = 'completed' then
    for line in select ri.*, ir.inventory_item_id, ir.quantity from public.showcase_request_items ri join public.showcase_inventory_reservations ir on ir.request_item_id = ri.id and ir.status = 'active' where ri.request_id = r.id loop
      update public.inventory_items set quantity = greatest(0, quantity - line.quantity), data = data || jsonb_build_object('quantity', greatest(0, quantity - line.quantity)), updated_at = now() where id = line.inventory_item_id;
      update public.showcase_inventory_reservations set status = 'consumed' where request_item_id = line.id and status = 'active';
    end loop;
  elsif next_status = 'cancelled' or next_status = 'unavailable' then
    update public.showcase_inventory_reservations set status = 'released', released_at = now() where request_id = r.id and status = 'active';
  else raise exception using errcode = '22023', message = 'That request transition is not allowed.'; end if;
  update public.showcase_requests set status = next_status, completed_at = case when next_status = 'completed' then now() else completed_at end, updated_at = now() where id = r.id;
  if next_status = 'completed' then insert into public.showcase_events(workspace_id, event_type, metadata) values (r.workspace_id, 'request_completed', jsonb_build_object('request_id', r.id)); end if;
  return jsonb_build_object('id', r.id, 'status', next_status);
end; $$;
revoke all on function public.update_showcase_request_status(uuid,text,uuid) from public; grant execute on function public.update_showcase_request_status(uuid,text,uuid) to authenticated;

create or replace function public.record_showcase_event(requested_slug text, requested_event text, event_metadata jsonb default '{}'::jsonb) returns boolean language plpgsql security definer set search_path = public as $$
declare target_workspace uuid; begin
  if requested_event not in ('showcase_view','search','search_no_results','card_view','add_to_request','request_submitted','request_completed','kiosk_session') then return false; end if;
  select workspace_id into target_workspace from public.showcase_profiles where slug = requested_slug and enabled;
  if target_workspace is null then return false; end if;
  insert into public.showcase_events(workspace_id,event_type,metadata) values (target_workspace,requested_event,jsonb_build_object('source',coalesce(event_metadata->>'source','public_web')) || jsonb_strip_nulls(event_metadata - 'source')); return true;
end; $$;
revoke all on function public.record_showcase_event(text,text,jsonb) from public; grant execute on function public.record_showcase_event(text,text,jsonb) to anon, authenticated;
