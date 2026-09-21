-- READ ONLY. No migration authorization implied. Compare before/after outputs.
begin read only;
select count(*) rows, sum(quantity) units,
 count(*) filter(where workspace_id is null) unassigned,
 count(*) filter(where game_id is null) missing_game
from public.inventory_items;
select user_id,workspace_id,count(*) rows,sum(quantity) units
from public.inventory_items group by user_id,workspace_id order by user_id,workspace_id;
select table_name,column_name,data_type,is_nullable,column_default
from information_schema.columns where table_schema='public' and
 ((table_name='inventory_label_identities' and column_name in ('inventory_position_id','inventory_location_id'))
 or (table_name='chaos_sort_inventory_positions' and column_name='language'));
select count(*) identities from public.inventory_label_identities;
select count(*) positions from public.chaos_sort_inventory_positions;
select md5(pg_get_functiondef('public.enforce_collector_inventory_mutation()'::regprocedure)) collector_guard_hash;
select pg_get_functiondef('public.commit_chaos_sort_batch(jsonb)'::regprocedure) chaos_definition;
select relname,relrowsecurity from pg_class where oid in (
 'public.inventory_items'::regclass,'public.inventory_label_identities'::regclass,
 'public.label_templates'::regclass,'public.chaos_sort_inventory_positions'::regclass);
select policyname,tablename,permissive,roles,qual,with_check from pg_policies
where schemaname='public' and tablename in('inventory_items','inventory_label_identities','label_templates')
order by tablename,policyname;
select c.conname,pg_get_constraintdef(c.oid,true) from pg_constraint c
where c.conrelid='public.inventory_label_identities'::regclass order by c.conname;
select indexrelid::regclass,indisvalid,pg_get_indexdef(indexrelid) from pg_index
where indrelid='public.inventory_label_identities'::regclass;
select p.oid::regprocedure,p.prosecdef,p.proconfig,p.proacl
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where (n.nspname='pos_private' and p.proname in ('inventory_entitled','authorize_labels'))
or (n.nspname='public' and p.proname in ('label_access','label_targets','label_locations'));
select to_regclass('public.pos_workspace_settings') pos_settings,
 to_regclass('public.pos_register_sessions') pos_sessions;
-- Both must remain NULL for the labels-only production repair. If POS already
-- exists, use its separately reviewed enabled=false verification instead.
commit;
