-- Read only. Save results privately with the separately verified recovery point.
begin transaction read only;
select current_database(),current_setting('server_version'),now() as observed_at;
select oid::regprocedure::text as function,md5(replace(prosrc,chr(13),'')) as body_md5,prosecdef,proconfig,proacl
from pg_proc where oid in ('public.chaos_scan_command(text,jsonb)'::regprocedure,
 'chaos_scan_private.enforce_capture_capacity()'::regprocedure,'public.commit_chaos_sort_batch(jsonb)'::regprocedure);
select table_name,column_name,data_type,is_nullable from information_schema.columns
where table_schema='public' and table_name in ('chaos_scan_albums','chaos_scan_captures') order by table_name,ordinal_position;
select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies
where tablename in ('chaos_scan_albums','chaos_scan_captures','capture_capacity')
or (schemaname='storage' and policyname like 'chaos_scan%');
select pg_get_triggerdef(oid) from pg_trigger where tgrelid='public.chaos_scan_captures'::regclass and not tgisinternal;
select conname,pg_get_constraintdef(oid) from pg_constraint where conrelid in
 ('public.chaos_scan_captures'::regclass,'chaos_scan_private.capture_capacity'::regclass);
-- Fingerprint authoritative rows independently: no inventory/positions join.
select 'inventory_items' as relation,count(*) as rows,sum(quantity) as authoritative_units,
 md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by user_id,id),'')) as fingerprint from public.inventory_items t;
select 'positions' as relation,count(*) as rows,sum(quantity) as positioned_units,
 md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by user_id,id),'')) as fingerprint from public.chaos_sort_inventory_positions t;
select 'events' as relation,count(*) as rows,
 md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) as fingerprint from public.inventory_events t;
select 'allocations' as relation,count(*) as rows,
 md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) as fingerprint from public.selling_inventory_allocations t;
-- EXISTS counts each authoritative parent once, even with multiple positions.
select count(*) as positioned_parents,sum(i.quantity) as authoritative_parent_units
from public.inventory_items i where exists(select 1 from public.chaos_sort_inventory_positions p where p.user_id=i.user_id and p.item_id=i.id);
select count(*) as parents_with_multiple_positions from (
 select user_id,item_id from public.chaos_sort_inventory_positions group by user_id,item_id having count(*)>1
) p;
select count(*) as capture_rows,count(*) filter(where status='REMOVED') as tombstones from public.chaos_scan_captures;
select count(*) as occupied_slots from chaos_scan_private.capture_capacity;
commit;
