-- Preserve each environment's existing Chaos algorithm. Only qualify the local
-- PL/pgSQL variable; do not install the obsolete historical function body.
do $repair$
declare definition text;
begin
 definition:=pg_get_functiondef('public.commit_chaos_sort_batch(jsonb)'::regprocedure);
 if definition not like '%<<compat_chaos>>%' then
   if definition not like '%location_id text :=%' then
     raise exception 'COMPATIBILITY_PREFLIGHT: unrecognized Chaos location variable';
   end if;
   definition:=replace(definition,E'\ndeclare',E'\n<<compat_chaos>>\ndeclare');
   definition:=replace(definition,'id = location_id','id = compat_chaos.location_id');
   definition:=replace(definition,'coalesce(location_id,', 'coalesce(compat_chaos.location_id,');
   execute definition;
 end if;
end $repair$;

-- On databases already containing POS, align only the entitlement predicate.
-- All workspace, permission, owner/delegation, site, register/session and stock
-- predicates remain unchanged. A labels-only production database stays POS-free.
do $authority$
declare signature text; definition text;
begin
 foreach signature in array array['pos_private.authorize(uuid,boolean,boolean)','pos_private.can_transact(uuid,uuid,uuid,text)'] loop
   if to_regprocedure(signature) is null then continue; end if;
   definition:=pg_get_functiondef(to_regprocedure(signature));
   definition:=replace(definition,
     'coalesce(public.collector_effective_membership_tier(auth.uid()),'''') not in (''seller'',''store'')',
     'not pos_private.inventory_entitled(auth.uid())');
   definition:=replace(definition,
     'public.collector_effective_membership_tier(d.inventory_user_id) in (''seller'',''store'')',
     'pos_private.inventory_entitled(d.inventory_user_id)');
   definition:=replace(definition,
     'public.collector_effective_membership_tier(stock_owner) in (''seller'',''store'')',
     'pos_private.inventory_entitled(stock_owner)');
   execute definition;
 end loop;
end $authority$;
