-- READ ONLY. Run the baseline section immediately before a separately approved
-- migration window, then run all sections afterward. Not a migration runner.
-- Do not compare live mutable data against an old baseline without accounting
-- for intervening legitimate writes. Capture under the approved change window.
begin read only;
set local timezone = 'UTC';

-- Baseline and after: compare counts, quantity, owner/workspace and nonidentity
-- fingerprints. The September 21 snapshot was 1515 rows / 1788 units.
select count(*) as rows, sum(quantity) as units,
  count(*) filter (where game_id is null) as missing_game_id,
  md5(string_agg(jsonb_build_array(user_id,id,workspace_id)::text,
    E'\n' order by user_id,id)) as ownership_md5,
  md5(string_agg((to_jsonb(i)-array['game_id','product_type','provider_category_id'])::text,
    E'\n' order by user_id,id)) as nonidentity_md5
from public.inventory_items i;

-- Exact forward-migration classification: before 1489 candidates / 0 conflicts;
-- after 0 candidates / 0 conflicts. Already-complete rows before: 26.
select count(*) filter (where game_id is null and
    (scryfall_id is not null or set_code is not null or collector_number is not null)) as candidates,
  count(*) filter (where game_id is null and
    (scryfall_id is not null or set_code is not null or collector_number is not null) and
    (coalesce(data->>'game_id',data->>'gameId',data->>'game','magic') <> 'magic'
     or coalesce(provider_category_id,'1') <> '1')) as conflicts,
  count(*) filter (where game_id is null and scryfall_id is null
    and set_code is null and collector_number is null) as no_evidence,
  count(*) filter (where game_id='magic' and product_type='card'
    and provider_category_id='1') as complete_magic_rows
from public.inventory_items;

-- After migration only. Expected zero enabled rows. A missing settings row is
-- disabled, not an invitation to create an opt-in row.
select count(*) as enabled_workspaces from public.pos_workspace_settings where enabled;
select column_default from information_schema.columns
where table_schema='public' and table_name='pos_workspace_settings' and column_name='enabled';

-- Expected no rows: all newly introduced tables have RLS.
select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind='r' and (n.nspname='pos_private' or n.nspname='public' and
  (c.relname like 'pos_%' or c.relname='inventory_barcode_aliases')) and not c.relrowsecurity;

-- Expected no rows: direct browser/anonymous financial writes or private calls.
select r.role,n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
cross join (values ('anon'),('authenticated')) r(role)
where c.relkind='r' and (n.nspname='pos_private' or n.nspname='public' and c.relname like 'pos_%')
and (has_table_privilege(r.role,c.oid,'INSERT') or has_table_privilege(r.role,c.oid,'UPDATE')
  or has_table_privilege(r.role,c.oid,'DELETE'));
select r.role,p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
cross join (values ('anon'),('authenticated')) r(role)
where (n.nspname='pos_private' or n.nspname='public' and p.proname like 'pos_square_service%')
and has_function_privilege(r.role,p.oid,'EXECUTE');

-- No persistent migration branch/temp reference; restored collector trigger is
-- the reviewed staff-delegation version, not necessarily the pre-POS text.
select pg_get_functiondef('public.enforce_collector_inventory_mutation()'::regprocedure);
select n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','pos_private')
and p.prosrc like '%pg_temp.inventory_identity_backfill_rows%';
select t.tgname,t.tgenabled,pg_get_triggerdef(t.oid,true)
from pg_trigger t where t.tgrelid='public.inventory_items'::regclass and not t.tgisinternal;

-- Capture and compare with the reviewed metadata inventory. New constraints
-- must be validated; four old inventory NOT VALID checks remain unchanged.
select c.relname,k.conname,k.convalidated,pg_get_constraintdef(k.oid,true)
from pg_constraint k join pg_class c on c.oid=k.conrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','pos_private') and
 (c.relname like 'pos_%' or c.relname in ('inventory_items','inventory_label_identities','label_print_jobs'))
order by 1,2;
select c.relname,i.indisvalid,pg_get_indexdef(i.indexrelid)
from pg_index i join pg_class c on c.oid=i.indrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','pos_private') and
 (c.relname like 'pos_%' or c.relname in ('inventory_items','inventory_label_identities'))
order by 1,3;
select * from pg_policies where schemaname='public' and tablename in
 ('inventory_items','inventory_locations','inventory_label_identities','label_templates','label_print_jobs');
select column_name,data_type,column_default from information_schema.columns
where table_schema='public' and table_name='inventory_items'
and column_name in ('game_id','product_type','provider_category_id','provider_product_id',
 'provider_sku_id','tcgplayer_product_id','tcgplayer_sku_id','variant','language');
select count(*) as canonical_labels from public.inventory_label_identities;
select to_regprocedure('public.label_targets(uuid,text[],uuid,text,boolean)') as label_targets;
select inventory_position_id,inventory_location_id from public.inventory_label_identities limit 0;
select version,name from supabase_migrations.schema_migrations order by version;
commit;
