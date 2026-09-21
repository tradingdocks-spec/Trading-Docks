-- Forward-only Label Studio compatibility; no historical migration replay.
-- Valid both before POS installation and after the accepted POS migrations.
-- Whole file must execute atomically. No data backfill, POS opt-in or provider setup.
create schema if not exists pos_private;
revoke all on schema pos_private from public,anon,authenticated;
alter table public.chaos_sort_inventory_positions add column if not exists language text;
-- Widen precision without changing any stored dimensions.
alter table public.label_templates alter column width type numeric(12,6), alter column height type numeric(12,6);

-- Phase 2: extend the existing canonical identity, never rewrite printed codes.
alter table public.inventory_label_identities add column if not exists inventory_position_id text;
alter table public.inventory_label_identities add column if not exists inventory_location_id text;
alter table public.inventory_label_identities alter column inventory_item_id drop not null;
do $constraint$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.inventory_label_identities'::regclass and conname='label_identity_target') then
 alter table public.inventory_label_identities add constraint label_identity_target check (
  (inventory_item_id is not null and inventory_location_id is null) or
  (inventory_item_id is null and inventory_location_id is not null and inventory_position_id is null and target_type='storage')
);
 end if;
end $constraint$;
create unique index if not exists label_identity_location_unique on public.inventory_label_identities(workspace_id,inventory_user_id,inventory_location_id)
  where inventory_location_id is not null and status='active' and revoked_at is null;
drop index if exists public.inventory_label_identities_active_item_uidx;
create unique index if not exists inventory_label_identities_active_item_uidx
  on public.inventory_label_identities(workspace_id,inventory_user_id,inventory_item_id)
  where revoked_at is null and status='active' and inventory_position_id is null;
create unique index if not exists inventory_label_identities_active_position_uidx
  on public.inventory_label_identities(workspace_id,inventory_user_id,inventory_position_id)
  where revoked_at is null and status='active' and inventory_position_id is not null;

create table if not exists public.inventory_barcode_aliases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  inventory_user_id uuid not null references auth.users(id),
  identity_id uuid not null,
  value text not null check(length(value) between 1 and 160 and value !~ '[[:cntrl:]]'),
  barcode_type text not null check(barcode_type in ('sku','upc_ean','external')),
  source text not null default 'manual' check(length(source) between 1 and 40),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid(),
  unique(workspace_id,value)
);
alter table public.inventory_barcode_aliases enable row level security;
revoke all on public.inventory_barcode_aliases from public,anon,authenticated;
-- Retain deleted identity history even when the legacy item FK cascades.
create table if not exists pos_private.label_tombstones (
  identity_id uuid primary key, workspace_id uuid not null, inventory_user_id uuid not null,
  sku text not null, qr_token text not null, barcode_value text, deleted_at timestamptz not null default now()
);
create index if not exists label_tombstones_lookup on pos_private.label_tombstones(workspace_id,sku);
create index if not exists label_tombstones_qr_lookup on pos_private.label_tombstones(workspace_id,qr_token);
alter table pos_private.label_tombstones enable row level security;
revoke all on pos_private.label_tombstones from public,anon,authenticated;



-- Trusted entitlement only. This never confers inventory ownership or delegation.
create or replace function pos_private.inventory_entitled(stock_owner uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u where u.id=stock_owner and (u.banned_until is null or u.banned_until<now()))
 and (public.collector_effective_membership_tier(stock_owner) in ('seller','store')
   or exists(select 1 from public.user_roles r where r.user_id=stock_owner and r.role::text in ('owner','admin')))
$$;
revoke all on function pos_private.inventory_entitled(uuid) from public,anon,authenticated;

-- Label operations remain scoped to auth.uid() in every target/identity RPC.
-- POS sell delegation is not general label or inventory mutation authority.
create or replace function pos_private.authorize_labels(w uuid, management boolean default false) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not pos_private.inventory_entitled(auth.uid())
 or not exists(select 1 from public.workspace_members m where m.workspace_id=w and m.user_id=auth.uid()
   and m.role in ('owner','admin','manager','member') and (not management or m.role in ('owner','admin','manager')))
 or exists(select 1 from public.workspace_employees e where e.workspace_id=w and e.linked_user_id=auth.uid()
   and (e.employment_status<>'active' or coalesce(to_jsonb(e)->>'account_status','active')='suspended'))
 or exists(select 1 from public.workspace_members m join public.workspace_employees e
   on e.workspace_id=m.workspace_id and e.linked_user_id=m.user_id
   where m.workspace_id=w and m.user_id=auth.uid() and m.role in ('member','employee')
   and coalesce(e.permissions->>'pos.sell','false')<>'true')
 then raise exception 'POS_FORBIDDEN'; end if;
end $$;
revoke all on function pos_private.authorize_labels(uuid,boolean) from public,anon,authenticated;

create or replace function pos_private.guard_label_identity() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='DELETE' then
    insert into pos_private.label_tombstones(identity_id,workspace_id,inventory_user_id,sku,qr_token,barcode_value)
      values(old.id,old.workspace_id,old.inventory_user_id,old.sku,old.qr_token,old.barcode_value) on conflict do nothing;
    return old;
  end if;
  if tg_op='UPDATE' and (new.id,new.workspace_id,new.inventory_user_id,new.inventory_item_id,new.inventory_position_id,new.inventory_location_id,new.sku,new.qr_token,new.barcode_value)
    is distinct from (old.id,old.workspace_id,old.inventory_user_id,old.inventory_item_id,old.inventory_position_id,old.inventory_location_id,old.sku,old.qr_token,old.barcode_value)
    then raise exception 'LABEL_IMMUTABLE'; end if;
  if new.inventory_location_id is not null and not exists(select 1 from public.inventory_locations l where l.user_id=new.inventory_user_id and l.id=new.inventory_location_id) then raise exception 'LABEL_INVALID_TARGET'; end if;
  if tg_op='INSERT' and new.inventory_position_id is not null and not exists (
    select 1 from public.chaos_sort_inventory_positions p where p.user_id=new.inventory_user_id and p.id=new.inventory_position_id and p.item_id=new.inventory_item_id
  ) then raise exception 'LABEL_INVALID_TARGET'; end if;
  if exists(select 1 from pos_private.label_tombstones t where t.workspace_id=new.workspace_id and (t.sku=new.sku or t.qr_token=new.qr_token))
    then raise exception 'LABEL_IMMUTABLE'; end if;
  return new;
end $$;
drop trigger if exists guard_label_identity on public.inventory_label_identities;
create trigger guard_label_identity before insert or update or delete on public.inventory_label_identities
for each row execute function pos_private.guard_label_identity();

create or replace function pos_private.label_identity(w uuid,item text,v_position_id text default null) returns public.inventory_label_identities
language plpgsql security definer set search_path='' as $$
declare result public.inventory_label_identities%rowtype; kind text;
begin
  perform pos_private.authorize_labels(w,false);
  select i.item_kind into kind from public.inventory_items i where i.workspace_id=w and i.user_id=auth.uid() and i.id=item;
  if not found then raise exception 'POS_FORBIDDEN'; end if;
  perform pg_advisory_xact_lock(hashtextextended('label:'||w::text||auth.uid()::text||item||coalesce(v_position_id,''),0));
  select * into result from public.inventory_label_identities z where z.workspace_id=w and z.inventory_user_id=auth.uid()
    and z.inventory_item_id=item and z.inventory_position_id is not distinct from v_position_id and z.status='active' and z.revoked_at is null;
  if result.id is null then
    insert into public.inventory_label_identities(workspace_id,inventory_user_id,inventory_item_id,inventory_position_id,target_type,sku,qr_token,public_enabled)
      values(w,auth.uid(),item,v_position_id,case when kind='sealed' then 'sealed' else 'single' end,'','',false) returning * into result;
  end if;
  return result;
end $$;

create or replace function public.label_targets(p_workspace_id uuid,p_ids text[] default '{}',p_batch_id uuid default null,p_query text default '',p_issue boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r record; z public.inventory_label_identities%rowtype; result jsonb:='[]';
begin
  perform pos_private.authorize_labels(p_workspace_id,false);
  if cardinality(p_ids)>500 or length(p_query)>160 then raise exception 'POS_INVALID'; end if;
  for r in
    select i.*,p.id as position_id,p.quantity as position_quantity,p.condition as position_condition,p.finish as position_finish,p.language as position_language,b.batch_code,l.name as location_name
    from public.inventory_items i
    left join public.chaos_sort_inventory_positions p on p.user_id=i.user_id and p.item_id=i.id and p.quantity>0 and coalesce(i.item_kind,'single')<>'sealed'
    left join public.chaos_sort_batches b on b.id=p.batch_id and b.user_id=p.user_id
    join public.inventory_locations l on l.user_id=i.user_id and l.id=i.location_id
    where i.workspace_id=p_workspace_id and i.user_id=auth.uid() and i.quantity>0
      and (cardinality(p_ids)=0 or i.id=any(p_ids) or p.id=any(p_ids) or ('item:'||i.id)=any(p_ids) or ('position:'||p.id)=any(p_ids))
      and (p_batch_id is null or p.batch_id=p_batch_id)
      and (p_query='' or i.card_name ilike '%'||p_query||'%' or i.sku=p_query or l.name ilike '%'||p_query||'%' or b.batch_code=p_query)
    order by i.updated_at desc,i.id,p.id limit 500
  loop
    if p_issue then z:=pos_private.label_identity(p_workspace_id,r.id,r.position_id);
    else select * into z from public.inventory_label_identities a where a.workspace_id=p_workspace_id and a.inventory_user_id=auth.uid() and a.inventory_item_id=r.id and a.inventory_position_id is not distinct from r.position_id and a.status='active' and a.revoked_at is null; end if;
    result:=result||jsonb_build_array(jsonb_build_object('key',case when r.position_id is null then 'item:'||r.id else 'position:'||r.position_id end,'itemId',r.id,'positionId',r.position_id,'name',coalesce(nullif(r.product_name,''),r.card_name),
      'game',coalesce(r.data->>'game_id',r.data->>'gameId',r.data->>'game'),'set',r.set_code,'number',r.collector_number,'condition',coalesce(r.position_condition,r.data->>'condition'),'finish',coalesce(r.position_finish,r.data->>'finish'),'language',coalesce(r.position_language,r.data->>'language'),
      'location',r.location_name,'batch',r.batch_code,'quantity',coalesce(r.position_quantity,r.quantity),'price',r.asking_price,'upc',case when r.item_kind='sealed' and r.upc ~ '^\d{8,13}$' and (select count(*) from public.inventory_items u where u.workspace_id=p_workspace_id and u.user_id=auth.uid() and u.upc=r.upc)=1 and not exists(select 1 from public.inventory_barcode_aliases a where a.workspace_id=p_workspace_id and a.value=r.upc and (not a.active or a.identity_id is distinct from z.id)) then r.upc else null end,'sku',z.sku,'identityId',z.id,'qrToken',z.qr_token));
  end loop;
  return result;
end $$;

create or replace function public.assign_label_barcode(p_workspace_id uuid,p_identity_id uuid,p_value text,p_type text default 'external',p_active boolean default true) returns jsonb
language plpgsql security definer set search_path='' as $$
declare z public.inventory_label_identities%rowtype; existing public.inventory_barcode_aliases%rowtype; v text:=trim(p_value);
begin
  perform pos_private.authorize_labels(p_workspace_id,true);
  if length(v) not between 1 and 160 or v ~ '[[:cntrl:]]' or v ~* '^TD-' or p_type not in ('sku','upc_ean','external') then raise exception 'POS_INVALID'; end if;
  if exists(select 1 from pos_private.label_tombstones t where t.workspace_id=p_workspace_id and (t.sku=v or t.qr_token=v)) then raise exception 'POS_BARCODE_INACTIVE'; end if;
  select * into z from public.inventory_label_identities where id=p_identity_id and workspace_id=p_workspace_id and inventory_user_id=auth.uid() and status='active' and revoked_at is null;
  if z.id is null then raise exception 'POS_FORBIDDEN'; end if;
  perform pg_advisory_xact_lock(hashtextextended('alias:'||p_workspace_id::text||v,0));
  select * into existing from public.inventory_barcode_aliases where workspace_id=p_workspace_id and value=v;
  if existing.id is not null and existing.identity_id<>z.id then raise exception 'POS_BARCODE_AMBIGUOUS'; end if;
  if exists(select 1 from public.inventory_label_identities a where a.workspace_id=p_workspace_id and a.id<>z.id and (a.sku=v or a.qr_token=v or a.barcode_value=v))
    or exists(select 1 from public.inventory_items i where i.workspace_id=p_workspace_id and (i.user_id<>z.inventory_user_id or i.id<>z.inventory_item_id) and (i.sku=v or i.upc=v or i.barcode_value=v)) then raise exception 'POS_BARCODE_AMBIGUOUS'; end if;
  insert into public.inventory_barcode_aliases(workspace_id,inventory_user_id,identity_id,value,barcode_type,active) values(p_workspace_id,auth.uid(),z.id,v,p_type,p_active)
    on conflict(workspace_id,value) do update set active=excluded.active;
  return jsonb_build_object('ok',true);
end $$;

revoke all on all functions in schema pos_private from public,anon,authenticated;
revoke all on function public.label_targets(uuid,text[],uuid,text,boolean) from public,anon;
revoke all on function public.assign_label_barcode(uuid,uuid,text,text,boolean) from public,anon;
grant execute on function public.label_targets(uuid,text[],uuid,text,boolean) to authenticated;
grant execute on function public.assign_label_barcode(uuid,uuid,text,text,boolean) to authenticated;

alter table public.label_print_jobs drop constraint label_print_jobs_counts_check;
alter table public.label_print_jobs add constraint label_print_jobs_counts_check check(label_count between 0 and 10000 and page_count between 0 and 10000);

create or replace function public.set_default_label_template(p_workspace_id uuid,p_template_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform pos_private.authorize_labels(p_workspace_id,true);
  perform pg_advisory_xact_lock(hashtextextended('label-template:'||p_workspace_id::text,0));
  if not exists(select 1 from public.label_templates where id=p_template_id and workspace_id=p_workspace_id and archived_at is null) then raise exception 'POS_FORBIDDEN'; end if;
  update public.label_templates set template_data=jsonb_set(template_data,'{isDefault}','false'),updated_at=now() where workspace_id=p_workspace_id and archived_at is null and template_data->>'isDefault'='true';
  update public.label_templates set template_data=jsonb_set(template_data,'{isDefault}','true'),updated_at=now() where id=p_template_id and workspace_id=p_workspace_id;
end $$;
revoke all on function public.set_default_label_template(uuid,uuid) from public,anon;
grant execute on function public.set_default_label_template(uuid,uuid) to authenticated;

create or replace function pos_private.retire_position_label() returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.inventory_label_identities set status='archived' where inventory_user_id=old.user_id and inventory_position_id=old.id;
  return old;
end $$;
drop trigger if exists retire_position_label on public.chaos_sort_inventory_positions;
create trigger retire_position_label after delete on public.chaos_sort_inventory_positions for each row execute function pos_private.retire_position_label();
revoke all on function pos_private.retire_position_label() from public,anon,authenticated;

create or replace function public.label_actor_allowed(w uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
  perform pos_private.authorize_labels(w,false); return true;
exception when others then return false;
end $$;
revoke all on function public.label_actor_allowed(uuid) from public,anon;
grant execute on function public.label_actor_allowed(uuid) to authenticated;
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='label_templates' and policyname='Active label actors only') then
 create policy "Active label actors only" on public.label_templates as restrictive for all to authenticated
  using(public.label_actor_allowed(workspace_id)) with check(public.label_actor_allowed(workspace_id));
 end if;
end $policy$;
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='inventory_label_identities' and policyname='Active identity actors only') then
 create policy "Active identity actors only" on public.inventory_label_identities as restrictive for all to authenticated
  using(public.label_actor_allowed(workspace_id)) with check(public.label_actor_allowed(workspace_id));
 end if;
end $policy$;
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='inventory_label_identities' and policyname='Own identity inserts only') then
 create policy "Own identity inserts only" on public.inventory_label_identities as restrictive for insert to authenticated with check(inventory_user_id=(select auth.uid()));
 end if;
end $policy$;
do $policy$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='inventory_label_identities' and policyname='Own identity updates only') then
 create policy "Own identity updates only" on public.inventory_label_identities as restrictive for update to authenticated using(inventory_user_id=(select auth.uid())) with check(inventory_user_id=(select auth.uid()));
 end if;
end $policy$;
-- Printed identities are retired, never arbitrarily deleted by an API role.
revoke delete on public.inventory_label_identities from authenticated;

create or replace function public.label_locations(p_workspace_id uuid,p_ids text[] default '{}',p_issue boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r record; z public.inventory_label_identities%rowtype; result jsonb:='[]';
begin
  perform pos_private.authorize_labels(p_workspace_id,false);
  if cardinality(p_ids)>500 then raise exception 'POS_INVALID'; end if;
  for r in select * from public.inventory_locations where user_id=auth.uid() and (cardinality(p_ids)=0 or id=any(p_ids)) order by name,id limit 500 loop
    perform pg_advisory_xact_lock(hashtextextended('location-label:'||p_workspace_id::text||auth.uid()::text||r.id,0));
    select * into z from public.inventory_label_identities where workspace_id=p_workspace_id and inventory_user_id=auth.uid() and inventory_location_id=r.id and status='active' and revoked_at is null;
    if p_issue and z.id is null then
      insert into public.inventory_label_identities(workspace_id,inventory_user_id,inventory_location_id,target_type,sku,qr_token)
        values(p_workspace_id,auth.uid(),r.id,'storage','','') returning * into z;
    end if;
    result:=result||jsonb_build_array(jsonb_build_object('key','location:'||r.id,'itemId','','positionId',null,'name',r.name,'location',r.name,'quantity',1,'price',null,'sku',z.sku,'identityId',z.id,'qrToken',z.qr_token));
  end loop;
  return result;
end $$;
revoke all on function public.label_locations(uuid,text[],boolean) from public,anon;
grant execute on function public.label_locations(uuid,text[],boolean) to authenticated;

create unique index if not exists label_templates_one_default on public.label_templates(workspace_id) where archived_at is null and template_data->>'isDefault'='true';

-- Application prechecks and RLS defer to the same label authorization decision.
create or replace function public.label_access(p_workspace_id uuid,p_management boolean default false) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 perform pos_private.authorize_labels(p_workspace_id,p_management);
 return true;
end $$;
revoke all on function public.label_access(uuid,boolean) from public,anon;
grant execute on function public.label_access(uuid,boolean) to authenticated;
