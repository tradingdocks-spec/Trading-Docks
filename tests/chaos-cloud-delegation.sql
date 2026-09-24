begin;
do $test$
declare owner_id uuid:='11111111-1111-4111-8111-111111111188'; staff uuid:='11111111-1111-4111-8111-111111111189'; w uuid; site uuid; batch uuid;
begin
 if current_database() not like 'chaos_cloud_%' then raise exception 'DISPOSABLE_TARGET_REQUIRED'; end if;
 select workspace_id,id into w,batch from chaos_scan_albums where user_id=owner_id and batch_code='CS-000001';
 select id into site from pos_store_locations where workspace_id=w limit 1;
 if site is null then raise exception 'ISOLATED_SITE_MISSING'; end if;
 insert into workspace_employees(workspace_id,linked_user_id,full_name,created_by,permissions) values(w,staff,'Cloud fixture staff',owner_id,'{"pos.sell":true,"pos.refund":true}');
 update pos_workspace_settings set enabled=true where workspace_id=w;
 update user_preferences set active_workspace_id=w where user_id=staff;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 execute 'set local role authenticated';
 perform pos_command(w,'grant',jsonb_build_object('key',gen_random_uuid(),'siteId',site,'employeeId',staff,'capabilities',jsonb_build_array('sell','return')));
 perform set_config('request.jwt.claim.sub',staff::text,true);
 begin
  perform chaos_scan_command('snapshot',jsonb_build_object('batchId',batch));
  raise exception 'DELEGATED_COLLECTOR_ACCESS_ALLOWED';
 exception when insufficient_privilege then null;
 end;
 if jsonb_array_length(chaos_batch_history())<>0 then raise exception 'DELEGATION_LEAKED_OWNER_HISTORY'; end if;
 begin perform 1 from chaos_scan_private.batch_counters; raise exception 'COUNTER_BROWSER_ACCESS'; exception when insufficient_privilege then null; end;
 execute 'reset role';
end $test$;
rollback;
