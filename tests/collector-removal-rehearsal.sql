begin;
do $$ begin
 if current_database()<>'collector_removal_rehearsal' then raise exception 'DISPOSABLE_DATABASE_REQUIRED'; end if;
end $$;
do $test$
declare
 owner_id uuid; other_id uuid; w uuid; batch uuid:=gen_random_uuid();
 i public.inventory_items%rowtype; before_batch jsonb; before_events bigint; result jsonb;
 listing_batch uuid:=gen_random_uuid(); candidate uuid:=gen_random_uuid();
begin
 select x.* into strict i from public.inventory_items x where x.card_name='Weather Maker' and x.quantity=1
 and exists(select 1 from public.chaos_sort_inventory_positions p where p.user_id=x.user_id and p.item_id=x.id and p.quantity=2);
 owner_id:=i.user_id; w:=i.workspace_id;
 select id into strict other_id from auth.users where id<>owner_id order by id limit 1;
 select to_jsonb(b) into before_batch from public.chaos_sort_batches b join public.chaos_sort_inventory_positions p on p.batch_id=b.id where p.user_id=owner_id and p.item_id=i.id;
 select count(*) into before_events from public.inventory_events;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 execute 'set local role authenticated';
 result:=public.remove_inventory_lot_quantity(i.id,1,'Local test','local-affected-removal');
 set constraints all immediate;
 execute 'reset role';
 if (select quantity from public.inventory_items where user_id=owner_id and id=i.id)<>0
 or not exists(select 1 from public.chaos_sort_inventory_positions where user_id=owner_id and item_id=i.id and quantity=0 and status='depleted') then raise exception 'AFFECTED_ZERO_FAILED'; end if;
 if (select count(*) from public.inventory_events)<>before_events+1 then raise exception 'EVENT_COUNT'; end if;
 if not exists(select 1 from public.inventory_events where idempotency_key='local-affected-removal'
 and workspace_id=w and user_id=owner_id and quantity_before=1 and quantity_change=-1 and quantity_after=0
 and metadata->>'historicalRemovalAlignment'='1' and jsonb_array_length(metadata->'alignmentEventIds')=2) then raise exception 'ALIGNMENT_EVIDENCE'; end if;
 if before_batch is distinct from (select to_jsonb(b) from public.chaos_sort_batches b join public.chaos_sort_inventory_positions p on p.batch_id=b.id where p.user_id=owner_id and p.item_id=i.id) then raise exception 'BATCH_CHANGED'; end if;
 if (select to_jsonb(x)-array['quantity','inventory_value','data','updated_at'] from public.inventory_items x where user_id=owner_id and id=i.id)
 is distinct from to_jsonb(i)-array['quantity','inventory_value','data','updated_at'] then raise exception 'IDENTITY_CHANGED'; end if;
 raise notice 'PASS exact restored mismatch: 1->0, position 2->0 with prior removal evidence, one new event, identity and batch unchanged';

 execute 'set local role authenticated';
 perform public.remove_inventory_lot_quantity(i.id,1,'Local test','local-affected-removal');
 begin
  perform public.remove_inventory_lot_quantity(i.id,2,'Local test','local-affected-removal');
  raise exception 'KEY_REUSE_ALLOWED';
 exception when others then if sqlerrm<>'TD_COLLECTOR_IDEMPOTENCY_CONFLICT' then raise; end if; end;
 insert into public.inventory_items(id,user_id,workspace_id,location_id,card_name,quantity,inventory_value,data)
 values('removal-manual-test',owner_id,w,i.location_id,'Synthetic manual',3,3,'{}'),
 ('removal-chaos-test',owner_id,w,i.location_id,'Synthetic Chaos',3,3,'{}');
 insert into public.chaos_sort_batches(id,user_id,workspace_id,batch_code,destination_location_id,initial_quantity,current_quantity)
 values(batch,owner_id,w,'REMOVE-TEST',i.location_id,3,3);
 insert into public.chaos_sort_inventory_positions(id,user_id,item_id,batch_id,card_name,quantity,location_id,status)
 values('removal-chaos-position',owner_id,'removal-chaos-test',batch,'Synthetic Chaos',3,i.location_id,'active');
 perform public.remove_inventory_lot_quantity('removal-manual-test',2,'Local test','local-manual-partial');
 perform public.remove_inventory_lot_quantity('removal-manual-test',1,'Local test','local-manual-zero');
 perform public.remove_inventory_lot_quantity('removal-chaos-test',2,'Local test','local-chaos-partial');
 execute 'reset role';
 if (select quantity from public.inventory_items where user_id=owner_id and id='removal-manual-test')<>0
 or (select quantity from public.chaos_sort_inventory_positions where user_id=owner_id and id='removal-chaos-position')<>1 then raise exception 'PARTIAL_FAILED'; end if;
 execute 'set local role authenticated';
 perform public.remove_inventory_lot_quantity('removal-chaos-test',1,'Local test','local-chaos-zero');
 set constraints all immediate;
 execute 'reset role';
 if (select quantity from public.inventory_items where user_id=owner_id and id='removal-chaos-test')<>0
 or not exists(select 1 from public.chaos_sort_inventory_positions where user_id=owner_id and id='removal-chaos-position' and quantity=0 and status='depleted') then raise exception 'CHAOS_ZERO_FAILED'; end if;
 if (select count(*) from public.inventory_events where idempotency_key in ('local-manual-partial','local-manual-zero','local-chaos-partial','local-chaos-zero') and event_type::text='quantity_removed' and workspace_id=w and quantity_change<0 and quantity_after=quantity_before+quantity_change)<>4 then raise exception 'LEDGER_FAILED'; end if;
 raise notice 'PASS manual and Chaos 3->1->0, negative removal events, canonical workspace, depletion and idempotent retry';

 -- Every invalid fixture is enclosed in a subtransaction and rolled back.
 begin
  set constraints all deferred;
  insert into public.inventory_items(id,user_id,workspace_id,location_id,card_name,quantity,data)
  values('removal-review',owner_id,w,i.location_id,'Synthetic unexplained drift',1,'{}');
  insert into public.chaos_sort_inventory_positions(id,user_id,item_id,batch_id,card_name,quantity,location_id,status)
  values('removal-review-position',owner_id,'removal-review',batch,'Synthetic unexplained drift',2,i.location_id,'active');
  perform public.remove_inventory_lot_quantity('removal-review',1,'Review','local-review');
  raise exception 'UNEXPLAINED_DRIFT_ALLOWED';
 exception when others then if sqlerrm<>'TD_COLLECTOR_POSITION_REVIEW_REQUIRED' then raise; end if; end;
 begin
  insert into public.inventory_items(id,user_id,workspace_id,location_id,card_name,quantity,data)
  values('removal-multiple',owner_id,w,i.location_id,'Synthetic multiple positions',2,'{}');
  insert into public.chaos_sort_inventory_positions(id,user_id,item_id,batch_id,card_name,quantity,location_id,status)
  values('removal-multi-a',owner_id,'removal-multiple',batch,'Synthetic multiple positions',1,i.location_id,'active'),
  ('removal-multi-b',owner_id,'removal-multiple',batch,'Synthetic multiple positions',1,i.location_id,'active');
  perform public.remove_inventory_lot_quantity('removal-multiple',1,'Review','local-multiple');
  raise exception 'AMBIGUOUS_POSITION_ALLOWED';
 exception when others then if sqlerrm<>'TD_COLLECTOR_POSITION_SELECTION_REQUIRED' then raise; end if; end;
 begin
  insert into public.inventory_items(id,user_id,workspace_id,location_id,card_name,quantity,data)
  values('removal-reserved',owner_id,w,i.location_id,'Synthetic reserved',2,'{}');
  insert into public.selling_listing_batches(id,user_id,name) values(listing_batch,owner_id,'Synthetic reservation');
  insert into public.selling_listing_candidates(id,user_id,listing_batch_id,inventory_item_id,quantity)
  values(candidate,owner_id,listing_batch,'removal-reserved',1);
  insert into public.selling_inventory_allocations(user_id,candidate_id,inventory_item_id,quantity,idempotency_key,status)
  values(owner_id,candidate,'removal-reserved',1,'local-reservation','RESERVED');
  perform public.remove_inventory_lot_quantity('removal-reserved',1,'Reserved','local-reserved');
  raise exception 'RESERVED_REMOVAL_ALLOWED';
 exception when others then if sqlerrm<>'POS_STOCK_UNAVAILABLE' then raise; end if; end;
 raise notice 'PASS unexplained drift, multiple positions, and marketplace reservations fail closed';

 perform set_config('request.jwt.claim.sub',other_id::text,true);
 execute 'set local role authenticated';
 begin
  perform public.remove_inventory_lot_quantity('removal-chaos-test',1,'Forbidden','local-denied');
  raise exception 'NONOWNER_ALLOWED';
 exception when no_data_found then null; end;
 execute 'reset role';
 begin
  update public.inventory_items set card_name='Unauthorized' where user_id=owner_id and id='removal-chaos-test';
  raise exception 'COLLECTOR_BYPASS';
 exception when others then if sqlerrm not like '%TD_COLLECTOR_UNAUTHORIZED%' then raise; end if; end;
 perform set_config('request.jwt.claim.sub','',true);
 execute 'set local role anon';
 begin
  perform public.remove_inventory_lot_quantity('removal-chaos-test',1);
  raise exception 'ANONYMOUS_ALLOWED';
 exception when insufficient_privilege then null; end;
 execute 'reset role';
 if (select count(*) from public.inventory_events where idempotency_key='local-affected-removal')<>1 then raise exception 'DUPLICATE'; end if;
 raise notice 'PASS cross-tenant/nonowner denied, original collector trigger still denies, anonymous execute denied';
end $test$;
rollback;
