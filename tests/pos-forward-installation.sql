-- Disposable Supabase recovery clone ONLY. No production credentials or URLs.
-- All fixture rows and operations roll back. Installation is tested separately.
\set ON_ERROR_STOP on
begin;
do $$ begin
 if current_database()<>'pos_install_rehearsal' then raise exception 'DISPOSABLE_DATABASE_REQUIRED'; end if;
 if exists(select 1 from public.pos_workspace_settings where enabled) then raise exception 'INSTALLATION_AUTO_ENABLED_WORKSPACE'; end if;
end $$;

do $pilot$
declare
 owner_id uuid; staff_id uuid; w uuid:=gen_random_uuid();
 batch_id uuid:=gen_random_uuid(); setup jsonb; sess jsonb; sale jsonb; detail jsonb; refunded jsonb; closed jsonb;
 payload jsonb; response jsonb; grant_row jsonb; second_site jsonb; staff_session jsonb;
 original_rows bigint; original_units bigint; original_events bigint;
begin
 select user_id into owner_id from public.inventory_items group by user_id order by count(*) desc limit 1;
 select id into staff_id from auth.users where id<>owner_id order by id limit 1;
 select count(*),sum(quantity) into original_rows,original_units from public.inventory_items;
 select count(*) into original_events from public.inventory_events;
 insert into public.workspaces(id,name,owner_id) values(w,'Disposable forward-install pilot',owner_id);
 insert into public.workspace_members(workspace_id,user_id,role) values(w,owner_id,'owner'),(w,staff_id,'manager');
 insert into public.workspace_employees(workspace_id,linked_user_id,full_name,created_by,permissions)
 values(w,staff_id,'Disposable employee',owner_id,'{"pos.sell":true,"pos.refund":true}');
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 execute 'set local role authenticated';
 begin
  perform public.pos_command(w,'bootstrap','{}');
  raise exception 'DISABLED_WORKSPACE_WAS_ACCESSIBLE';
 exception when others then if sqlerrm<>'POS_DISABLED' then raise; end if; end;
 execute 'reset role';
 insert into public.pos_workspace_settings(workspace_id,enabled) values(w,true);
 if (select count(*) from public.pos_workspace_settings where enabled)<>1 then raise exception 'ROLLOUT_SCOPE'; end if;
 execute 'set local role authenticated';
 insert into public.inventory_locations(id,user_id,name) values('forward-test-storage',owner_id,'Disposable test storage');
 insert into public.inventory_items(id,user_id,workspace_id,location_id,card_name,quantity,asking_price,data)
 values('forward-test-stock',owner_id,w,'forward-test-storage','Disposable exact-position stock',3,1,'{"condition":"NM","finish":"normal","language":"en"}');
 insert into public.chaos_sort_batches(id,user_id,workspace_id,batch_code,destination_location_id,initial_quantity,current_quantity)
 values(batch_id,owner_id,w,'FORWARD-TEST','forward-test-storage',3,3);
 insert into public.chaos_sort_inventory_positions(id,user_id,item_id,batch_id,card_name,quantity,location_id,condition,finish,language,status)
 values('forward-test-position',owner_id,'forward-test-stock',batch_id,'Disposable exact-position stock',3,'forward-test-storage','NM','normal','en','active');
 -- Explicit synthetic test tax/price, never a production configuration claim.
 setup:=public.pos_command(w,'setup',jsonb_build_object('name','Disposable site','registerName','Front Register','locationId','forward-test-storage','taxBps',850));
 response:=public.pos_payment_command(w,'capabilities','{}');
 if coalesce((response->>'mockEnabled')::boolean,false) or jsonb_array_length(coalesce(response->'squareSites','[]'))<>0
 or jsonb_array_length(coalesce(response->'terminals','[]'))<>0 then raise exception 'NONCASH_PROVIDER_AUTO_ENABLED'; end if;
 perform public.pos_square_settings(w,'get','{}');
 perform public.pos_terminal_devices(w,'get','{}');
 perform public.pos_provider_request_budget(w,'payment');
 response:=public.pos_command(w,'search',jsonb_build_object('siteId',setup->>'siteId','query','Disposable exact-position','exact',false));
 if jsonb_array_length(response)<>1 then raise exception 'INVENTORY_SEARCH_FAILED'; end if;
 perform public.label_access(w,false);
 response:=public.label_targets(w,array['forward-test-stock'],null,'',true);
 if jsonb_array_length(response)<>1 then raise exception 'LABEL_INTEGRATION_FAILED'; end if;
 response:=public.pos_command(w,'search',jsonb_build_object('siteId',setup->>'siteId','query',response->0->>'sku','exact',true));
 if jsonb_array_length(response)<>1 then raise exception 'BARCODE_RESOLUTION_FAILED'; end if;
 sess:=public.pos_command(w,'open',jsonb_build_object('key',gen_random_uuid(),'registerId',setup->>'registerId','openingMinor',20000));
 payload:=jsonb_build_object('key',gen_random_uuid(),'siteId',setup->>'siteId','sessionId',sess->>'id','expectedMinor',109,'cashMinor',200,
   'lines',jsonb_build_array(jsonb_build_object('itemId','forward-test-stock','positionId','forward-test-position','ownerId',owner_id,'quantity',1)));
 sale:=public.pos_command(w,'checkout',payload);
 if sale is distinct from public.pos_command(w,'checkout',payload) then raise exception 'CHECKOUT_REPLAY_FAILED'; end if;
 if (sale->'receipt'->>'changeMinor')::int<>91 then raise exception 'CHANGE_FAILED'; end if;
 detail:=public.pos_command(w,'receipt',jsonb_build_object('saleId',sale->>'saleId'));
 execute 'reset role';
 if (select quantity from public.inventory_items where id='forward-test-stock' and user_id=owner_id)<>2
 or (select quantity from public.chaos_sort_inventory_positions where id='forward-test-position' and user_id=owner_id)<>2 then raise exception 'EXACT_DECREMENT_FAILED'; end if;
 if (select count(*) from public.pos_sales where workspace_id=w)<>1 or (select count(*) from public.pos_tenders where workspace_id=w)<>1
 or (select count(*) from public.inventory_events where related_entity_id=sale->>'saleId')<>1 then raise exception 'SALE_DUPLICATION'; end if;
 if pos_private.expected_cash((sess->>'id')::uuid)<>20109 then raise exception 'DRAWER_AFTER_SALE'; end if;
 execute 'set local role authenticated';
 payload:=jsonb_build_object('key',gen_random_uuid(),'saleId',sale->>'saleId','sessionId',sess->>'id','expectedMinor',109,'reason','Disposable return',
  'lines',jsonb_build_array(jsonb_build_object('saleItemId',detail->'items'->0->>'id','quantity',1,'returnInventory',true)));
 refunded:=public.pos_command(w,'refund',payload);
 if refunded is distinct from public.pos_command(w,'refund',payload) then raise exception 'REFUND_REPLAY_FAILED'; end if;
 execute 'reset role';
 if (select quantity from public.inventory_items where id='forward-test-stock' and user_id=owner_id)<>3
 or (select quantity from public.chaos_sort_inventory_positions where id='forward-test-position' and user_id=owner_id)<>3 then raise exception 'EXACT_RESTORATION_FAILED'; end if;
 if (select count(*) from public.pos_refunds where workspace_id=w)<>1 or pos_private.expected_cash((sess->>'id')::uuid)<>20000 then raise exception 'REFUND_DRAWER_FAILED'; end if;
 execute 'set local role authenticated';
 perform public.pos_command(w,'begin_close',jsonb_build_object('key',gen_random_uuid(),'registerId',setup->>'registerId','sessionId',sess->>'id'));
 closed:=public.pos_command(w,'close',jsonb_build_object('key',gen_random_uuid(),'registerId',setup->>'registerId','sessionId',sess->>'id','countedMinor',20000));
 if closed->>'status'<>'CLOSED' or (closed->>'variance_minor')::int<>0 then raise exception 'CLOSE_RECONCILIATION_FAILED'; end if;
 response:=public.pos_command(w,'daily',jsonb_build_object('siteId',setup->>'siteId'));
 if (response->'sales'->>'count')::int<>1 or (response->'refunds'->>'count')::int<>1 or (response->>'cashNetMinor')::int<>0 then raise exception 'REPORT_RECONCILIATION_FAILED'; end if;
 raise notice 'PILOT: setup/open/search/barcode/sale/replay/exact decrement/receipt/refund/replay/restock/close/report passed';
 raise notice 'CLOSE: %',closed;
 raise notice 'REPORT: %',response;

 -- A manager without inventory delegation cannot operate the owner's site.
 perform set_config('request.jwt.claim.sub',staff_id::text,true);
 begin
  perform public.pos_command(w,'open',jsonb_build_object('key',gen_random_uuid(),'registerId',setup->>'registerId','openingMinor',0));
  raise exception 'NONDELEGATED_MANAGER_ALLOWED';
 exception when others then if sqlerrm<>'POS_FORBIDDEN' then raise; end if; end;
 execute 'reset role';
 -- Isolate collector enforcement from RLS: unrelated general mutation stays denied.
 begin
  update public.inventory_items set quantity=quantity-1 where id='forward-test-stock' and user_id=owner_id;
  raise exception 'UNAUTHORIZED_COLLECTOR_ALLOWED';
 exception when others then if sqlerrm not like '%TD_COLLECTOR_UNAUTHORIZED%' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 execute 'set local role authenticated';
 insert into public.inventory_locations(id,user_id,name) values('forward-other-storage',owner_id,'Separate test storage');
 second_site:=public.pos_command(w,'setup',jsonb_build_object('name','Separate test site','registerName','Other Register','locationId','forward-other-storage','taxBps',0));
 grant_row:=public.pos_command(w,'grant',jsonb_build_object('key',gen_random_uuid(),'siteId',setup->>'siteId','employeeId',staff_id,'capabilities',jsonb_build_array('sell','return')));
 perform set_config('request.jwt.claim.sub',staff_id::text,true);
 begin
  perform public.pos_command(w,'open',jsonb_build_object('key',gen_random_uuid(),'registerId',second_site->>'registerId','openingMinor',0));
  raise exception 'DELEGATION_CROSSED_SITE';
 exception when others then if sqlerrm<>'POS_FORBIDDEN' then raise; end if; end;
 staff_session:=public.pos_command(w,'open',jsonb_build_object('key',gen_random_uuid(),'registerId',setup->>'registerId','openingMinor',0));
 sale:=public.pos_command(w,'checkout',jsonb_build_object('key',gen_random_uuid(),'siteId',setup->>'siteId','sessionId',staff_session->>'id','expectedMinor',109,'cashMinor',109,
  'lines',jsonb_build_array(jsonb_build_object('itemId','forward-test-stock','positionId','forward-test-position','ownerId',owner_id,'quantity',1))));
 execute 'reset role';
 if not exists(select 1 from public.pos_sales s join public.pos_sale_items l on l.sale_id=s.id where s.id=(sale->>'saleId')::uuid and s.actor_id=staff_id and l.inventory_user_id=owner_id) then raise exception 'DELEGATED_ATTRIBUTION_FAILED'; end if;
 if exists(select 1 from pos_private.stock_permits) then raise exception 'STOCK_PERMIT_PERSISTED'; end if;
 -- General writes still cannot use the prior POS permit.
 begin
  update public.inventory_items set card_name='Forbidden change' where id='forward-test-stock' and user_id=owner_id;
  raise exception 'DELEGATION_BECAME_GENERAL_WRITE';
 exception when others then if sqlerrm not like '%TD_COLLECTOR_UNAUTHORIZED%' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 execute 'set local role authenticated';
 perform public.pos_command(w,'revoke',jsonb_build_object('key',gen_random_uuid(),'id',grant_row->>'id'));
 perform set_config('request.jwt.claim.sub',staff_id::text,true);
 begin
  perform public.pos_command(w,'search',jsonb_build_object('siteId',setup->>'siteId','query','Disposable'));
  raise exception 'REVOKED_SITE_ACCESS_ALLOWED';
 exception when others then if sqlerrm<>'POS_FORBIDDEN' then raise; end if; end;
 begin
  perform public.pos_command(gen_random_uuid(),'bootstrap','{}');
  raise exception 'CROSS_TENANT_ALLOWED';
 exception when others then if sqlerrm<>'POS_FORBIDDEN' then raise; end if; end;
 begin
  perform pos_private.permitted_stock_update('{}','{}');
  raise exception 'BROWSER_PRIVATE_HELPER_ALLOWED';
 exception when insufficient_privilege then null; end;
 begin
  perform 1 from pos_private.square_credentials;
  raise exception 'BROWSER_SQUARE_CREDENTIALS_ALLOWED';
 exception when insufficient_privilege then null; end;
 begin
  perform public.pos_square_service('credentials','{}');
  raise exception 'BROWSER_SERVER_RPC_ALLOWED';
 exception when insufficient_privilege then null; end;
 execute 'reset role';
 execute 'set local role anon';
 begin
  perform public.pos_command(w,'bootstrap','{}');
  raise exception 'ANONYMOUS_ALLOWED';
 exception when insufficient_privilege then null; end;
 execute 'reset role';
 update public.pos_workspace_settings set enabled=false where workspace_id=w;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 execute 'set local role authenticated';
 begin
  perform public.pos_command(w,'bootstrap','{}');
  raise exception 'DISABLE_FAILED';
 exception when others then if sqlerrm<>'POS_DISABLED' then raise; end if; end;
 execute 'reset role';
 if exists(select 1 from public.pos_workspace_settings where enabled) then raise exception 'WORKSPACE_LEFT_ENABLED'; end if;
 if exists(select 1 from pos_private.square_credentials) or exists(select 1 from pos_private.square_connections) or exists(select 1 from public.pos_payment_devices) then raise exception 'PROVIDER_CONFIGURED'; end if;
 raise notice 'SECURITY: owner/manager denial/delegated sale/revocation/cross-tenant/anonymous/private helper/disable passed';
end $pilot$;
set constraints all immediate;
rollback;
select count(*) as enabled_workspaces_after_rollback from public.pos_workspace_settings where enabled;
