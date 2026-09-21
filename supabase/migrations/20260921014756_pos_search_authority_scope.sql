-- Phase 7 hosted 10,000-row searches timed out because authority was checked per row.
-- Replace only broad-search planning; retain cash/payment/stock behavior and grants.
create or replace function pos_private.cash_command(w uuid, action text, body jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  payment public.pos_payment_attempts%rowtype;
  stock_owner uuid;
  actor uuid := auth.uid(); site public.pos_store_locations%rowtype;
  reg public.pos_registers%rowtype; sess public.pos_register_sessions%rowtype;
  inv public.inventory_items%rowtype; prior public.pos_sales%rowtype;
  v_sale_id uuid; key_id uuid; line jsonb; lines jsonb := '[]'; receipt jsonb;
  qty integer; price bigint; sub bigint:=0; disc bigint:=0; tax bigint:=0;
  line_sub bigint; line_disc bigint; line_tax bigint; rate integer; received bigint; expected bigint;
  v_position record; remaining integer; take integer; reserved bigint; pos_reserved bigint; pos_total bigint;
  loc text; code text; result jsonb; request_body jsonb; request_count integer;
begin
  perform pos_private.authorize(w,action in ('setup'),action not in ('availability','history','receipt','recover','cancel'));
  if body is null or jsonb_typeof(body)<>'object' or octet_length(body::text)>32768 then raise exception 'POS_INVALID'; end if;
  if action not in ('availability','receipt','recover') then
    insert into pos_private.request_limits(actor_id,bucket) values(actor,case when action='search' then 'search' else 'command' end)
    on conflict(actor_id,bucket) do update set
      requests=case when request_limits.started_at < now()-interval '1 minute' then 1 else request_limits.requests+1 end,
      started_at=case when request_limits.started_at < now()-interval '1 minute' then now() else request_limits.started_at end
    returning requests into request_count;
    if request_count>600 then raise exception 'POS_RATE_LIMIT'; end if;
  end if;
  if action='availability' then
    return jsonb_build_object('enabled',exists(select 1 from public.pos_workspace_settings where workspace_id=w and enabled));
  elsif action='bootstrap' then
    return jsonb_build_object(
      'operators',(select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'name',coalesce((select e.full_name from public.workspace_employees e where e.workspace_id=w and e.linked_user_id=m.user_id limit 1),(select coalesce(to_jsonb(p)->>'full_name',to_jsonb(p)->>'display_name') from public.profiles p where p.id=m.user_id),'Operator'))),'[]') from public.workspace_members m where m.workspace_id=w and (m.user_id=actor or exists(select 1 from public.workspace_members z where z.workspace_id=w and z.user_id=actor and z.role in ('owner','admin','manager')))),
      'sites',(select coalesce(jsonb_agg(s),'[]') from public.pos_store_locations s where s.workspace_id=w and exists(select 1 from public.pos_location_inventory_locations m where m.site_id=s.id and pos_private.can_transact(w,s.id,m.inventory_user_id,'sell'))),
      'registers',(select coalesce(jsonb_agg(r order by r.created_at,r.id),'[]') from public.pos_registers r join public.pos_store_locations s on s.id=r.site_id where r.workspace_id=w and (r.active or exists(select 1 from public.workspace_members where workspace_id=w and user_id=actor and role in ('owner','admin','manager'))) and exists(select 1 from public.pos_location_inventory_locations m where m.site_id=s.id and pos_private.can_transact(w,s.id,m.inventory_user_id,'sell'))),
      'sessions',(select coalesce(jsonb_agg(s),'[]') from public.pos_register_sessions s where s.workspace_id=w and s.closed_at is null and exists(select 1 from public.pos_location_inventory_locations m where m.site_id=s.site_id and pos_private.can_transact(w,s.site_id,m.inventory_user_id,'sell'))),
      'locations',(select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'name',l.name)),'[]') from public.inventory_locations l where l.user_id=actor and not exists(select 1 from public.pos_location_inventory_locations m where m.inventory_user_id=actor and m.location_id=l.id)),
      'operatorName',coalesce((select e.full_name from public.workspace_employees e where e.workspace_id=w and e.linked_user_id=actor limit 1),(select coalesce(to_jsonb(p)->>'full_name',to_jsonb(p)->>'display_name') from public.profiles p where p.id=actor),'Operator'),'canManage',exists(select 1 from public.workspace_members where workspace_id=w and user_id=actor and role in ('owner','admin','manager')));
  elsif action='setup' then
    if length(trim(body->>'name')) not between 1 and 100 or length(trim(body->>'registerName')) not between 1 and 100 or coalesce(body->>'taxBps','') !~ '^\d{1,4}$' then raise exception 'POS_INVALID'; end if;
    loc := body->>'locationId';
    if not exists(select 1 from public.inventory_locations where user_id=actor and id=loc) then raise exception 'POS_FORBIDDEN'; end if;
    if not exists(select 1 from pg_timezone_names where name=coalesce(body->>'timezone','America/Phoenix')) then raise exception 'POS_INVALID'; end if;
    insert into public.pos_store_locations(workspace_id,inventory_user_id,name,tax_bps,timezone) values(w,actor,trim(body->>'name'),(body->>'taxBps')::int,coalesce(body->>'timezone','America/Phoenix')) returning * into site;
    insert into public.pos_location_inventory_locations values(w,site.id,actor,loc);
    insert into public.pos_registers(workspace_id,site_id,name) values(w,site.id,trim(body->>'registerName')) returning * into reg;
    return jsonb_build_object('siteId',site.id,'registerId',reg.id);
  elsif action in ('open','close') then
    select r.* into reg from public.pos_registers r join public.pos_store_locations s on s.id=r.site_id
      where r.id=(body->>'registerId')::uuid and r.workspace_id=w and r.active and exists(select 1 from public.pos_location_inventory_locations m where m.site_id=s.id and pos_private.can_transact(w,s.id,m.inventory_user_id,'sell')) for update of r;
    if reg.id is null then raise exception 'POS_FORBIDDEN'; end if;
    select * into sess from public.pos_register_sessions where register_id=reg.id and closed_at is null for update;

    if action='close' then
      update public.pos_register_sessions set closed_at=now() where id=sess.id;
      return jsonb_build_object('closed',true);
    end if;
    if sess.id is null then
      insert into public.pos_register_sessions(workspace_id,site_id,register_id,actor_id) values(w,reg.site_id,reg.id,actor) returning * into sess;
    end if;
    return to_jsonb(sess);
  elsif action in ('history','receipt','recover','cancel') then
    if action='history' then
      select coalesce(jsonb_agg(x),'[]') into result from (
        select id,receipt_number,created_at,total_minor,subtotal_minor,discount_minor,tax_minor,register_id,actor_id from public.pos_sales
        where workspace_id=w and actor_id=actor and (nullif(body->>'before','') is null or (created_at,id)<((body->>'before')::timestamptz,coalesce(nullif(body->>'beforeId',''),'00000000-0000-0000-0000-000000000000')::uuid))
        order by created_at desc,id desc limit 50
      ) x;
      return result;
    end if;
    if action in ('recover','cancel') then
      key_id:=(body->>'key')::uuid;
      if key_id is null then raise exception 'POS_INVALID'; end if;
      perform pg_advisory_xact_lock(hashtextextended('pos:'||w::text||key_id::text,0));
    end if;
    select * into prior from public.pos_sales where workspace_id=w and actor_id=actor
      and ((action='receipt' and id=(body->>'saleId')::uuid) or (action in ('recover','cancel') and idempotency_key=key_id));
    if prior.id is null then
      if action='cancel' then
        insert into public.pos_checkout_cancellations(workspace_id,actor_id,idempotency_key) values(w,actor,key_id) on conflict do nothing;
      end if;
      return jsonb_build_object('status',case when exists(select 1 from public.pos_checkout_cancellations where workspace_id=w and actor_id=actor and idempotency_key=key_id) then 'canceled' else 'not_found' end);
    end if;
    return jsonb_build_object('status','completed','saleId',prior.id,'receipt',prior.receipt);
  end if;
  select * into site from public.pos_store_locations where id=(body->>'siteId')::uuid and workspace_id=w and exists(select 1 from public.pos_location_inventory_locations m where m.site_id=pos_store_locations.id and pos_private.can_transact(w,m.site_id,m.inventory_user_id,'sell'));
  if site.id is null then raise exception 'POS_FORBIDDEN'; end if;
  if action='search' and coalesce(body->>'exact','false')='true' then
    return pos_private.resolve_barcode(w,site.id,body->>'query');
  end if;
  if action='search' then
    code := trim(coalesce(body->>'query',''));
    if length(code) not between 1 and 160 then return '[]'; end if;
    -- Current owner boundaries retained. Missing price remains null.
    -- Authority depends on owner/site/actor, not on each inventory row.
    -- Materialization evaluates it once per mapped location in this statement;
    -- checkout still rechecks authority under the existing owner lock.
    with authorized_locations as materialized (
      select m.inventory_user_id,m.location_id from public.pos_location_inventory_locations m
      where m.workspace_id=w and m.site_id=site.id
        and pos_private.can_transact(w,site.id,m.inventory_user_id,'sell')
    )
    select coalesce(jsonb_agg(x),'[]') into result from (
      select i.id,i.user_id as "ownerId",coalesce(nullif(i.product_name,''),i.card_name) as name,i.sku,i.set_code,i.collector_number,i.location_id,l.name as location,
        i.data->>'condition' as condition,i.data->>'finish' as finish,i.data->>'language' as language,
        coalesce(i.data->>'taxable','true')<>'false' as taxable,
        case when i.asking_price between 0 and 1000000 then (i.asking_price*100)::bigint end as unit_price_minor,
        greatest(0,i.quantity-coalesce((select sum(a.quantity) from public.selling_inventory_allocations a where a.user_id=i.user_id and a.inventory_item_id=i.id and a.status in ('ALLOCATED','RESERVED')),0)) as available,
        coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'batchId',p.batch_id,'quantity',p.quantity,'locationId',p.location_id)) from public.chaos_sort_inventory_positions p where p.user_id=i.user_id and p.item_id=i.id and p.quantity>0),'[]') as positions
      from public.inventory_items i join public.inventory_locations l on l.user_id=i.user_id and l.id=i.location_id
      join authorized_locations m on m.inventory_user_id=i.user_id and m.location_id=i.location_id
      where i.workspace_id=w and i.quantity>0 and (
        i.sku=code or i.upc=code or i.barcode_value=code or i.id=code or i.data->>'tcgplayer_product_id'=code or i.data->>'provider_sku_id'=code or
        exists(select 1 from public.inventory_label_identities z where z.workspace_id=w and z.inventory_user_id=i.user_id and z.inventory_item_id=i.id and z.status='active' and z.revoked_at is null and (z.sku=code or z.barcode_value=code or z.qr_token=code)) or
        (coalesce(body->>'exact','false')<>'true' and (
          to_tsvector('simple',coalesce(i.card_name,'')||' '||coalesce(i.product_name,'')||' '||coalesce(i.set_code,'')||' '||coalesce(i.collector_number,'')) @@ plainto_tsquery('simple',code)
          or lower(l.name)=lower(code)
          or exists(select 1 from public.chaos_sort_inventory_positions cp join public.chaos_sort_batches cb on cb.id=cp.batch_id and cb.user_id=cp.user_id where cp.user_id=i.user_id and cp.item_id=i.id and cb.batch_code=code)
        ))
      ) order by i.card_name,i.id limit 30
    ) x;
    return result;
  elsif action<>'checkout' then raise exception 'POS_INVALID'; end if;

  select a.* into payment from pos_private.payment_context x join public.pos_payment_attempts a on a.id=x.payment_id where x.transaction_id=txid_current() and x.backend=pg_backend_pid() and x.actor_id=auth.uid() and x.refund_attempt_id is null and a.workspace_id=w and a.status='SUCCEEDED';
  key_id := (body->>'key')::uuid;
  if key_id is null then raise exception 'POS_INVALID'; end if;
  if payment.id is null and exists(select 1 from public.pos_payment_checkouts where workspace_id=w and id=key_id and state<>'VOIDED') then raise exception 'POS_PAYMENT_ACTIVE'; end if;
  request_body := body-'key';
  perform pg_advisory_xact_lock(hashtextextended('pos:'||w::text||key_id::text,0));
  select * into prior from public.pos_sales where workspace_id=w and idempotency_key=key_id;
  if prior.id is not null then
    if prior.request<>request_body or prior.actor_id<>actor then raise exception 'POS_IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('status','completed','saleId',prior.id,'receipt',prior.receipt,'replayed',true);
  end if;
  if exists(select 1 from public.pos_checkout_cancellations where workspace_id=w and actor_id=actor and idempotency_key=key_id) then raise exception 'POS_CHECKOUT_CANCELED'; end if;
  select * into sess from public.pos_register_sessions where id=(body->>'sessionId')::uuid and workspace_id=w and site_id=site.id and closed_at is null for update;
  if sess.id is null or sess.status<>'OPEN' or not exists(select 1 from public.pos_registers where id=sess.register_id and active) then raise exception 'POS_SESSION_CLOSED'; end if;
  if jsonb_typeof(body->'lines') is distinct from 'array' or jsonb_array_length(body->'lines') not between 1 and 100
    or coalesce(body->>'cashMinor','') !~ '^\d{1,12}$' or coalesce(body->>'expectedMinor','') !~ '^\d{1,12}$' then raise exception 'POS_INVALID'; end if;
  received := (body->>'cashMinor')::bigint; expected := (body->>'expectedMinor')::bigint;
  if (select count(distinct (coalesce((value->>'ownerId')::uuid,site.inventory_user_id),value->>'itemId',coalesce(nullif(value->>'positionId',''),''))) from jsonb_array_elements(body->'lines'))<>jsonb_array_length(body->'lines') then raise exception 'POS_INVALID'; end if;
  for stock_owner in select distinct coalesce((value->>'ownerId')::uuid,site.inventory_user_id) from jsonb_array_elements(body->'lines') order by 1 loop
    perform pos_private.lock_authority(w,site.id,stock_owner,'sell');
    perform 1 from public.inventory_items where user_id=stock_owner and id in (select value->>'itemId' from jsonb_array_elements(body->'lines')) order by id for update;
  end loop;
  result:=pos_private.calculate(w,site.id,body);
  if payment.id is not null and result<>(select snapshot from public.pos_payment_checkouts where id=payment.checkout_id) then raise exception 'POS_QUOTE_CHANGED'; end if;
  lines:=result->'lines'; sub:=(result->>'subtotalMinor')::bigint; disc:=(result->>'discountMinor')::bigint; tax:=(result->>'taxMinor')::bigint;
  if (disc>0 and not pos_private.permission(w,'discount')) or (exists(select 1 from jsonb_array_elements(lines) where (value->>'overrideDifferenceMinor')::bigint<>0) and not pos_private.permission(w,'override')) then
    if payment.id is null then perform pos_private.approved(w,site.id,'checkout',body); end if;
  end if;
  if expected<>sub-disc+tax then raise exception 'POS_QUOTE_CHANGED'; end if;
  if received<sub-disc+tax then raise exception 'POS_CASH_INSUFFICIENT'; end if;
  v_sale_id:=gen_random_uuid();
  code:='TD-'||upper(replace(v_sale_id::text,'-',''));
  select name into loc from public.pos_registers where id=sess.register_id;
  receipt:=jsonb_build_object('version',2,'settings',site.settings,'timezone',site.timezone,'employeeName',coalesce((select e.full_name from public.workspace_employees e where e.workspace_id=w and e.linked_user_id=actor limit 1),(select coalesce(to_jsonb(p)->>'full_name',to_jsonb(p)->>'display_name') from public.profiles p where p.id=actor),'Operator'),'number',code,'site',site.name,'register',loc,'actorId',actor,'createdAt',now(),'currency','USD','lines',(select jsonb_agg(value-array['costBasis','inventoryValueUnit']) from jsonb_array_elements(lines)),'subtotalMinor',sub,'discountMinor',disc,'taxMinor',tax,'totalMinor',sub-disc+tax,'cashMinor',received,'changeMinor',received-(sub-disc+tax),'discountReason',body->>'discountReason');
  if payment.id is not null then receipt:=receipt||jsonb_build_object('payment',jsonb_build_object('provider',payment.provider,'status',payment.status,'reference',payment.provider_payment_id,'metadata',payment.metadata),'cashMinor',0,'changeMinor',0); end if;
  insert into public.pos_sales(id,workspace_id,site_id,register_id,session_id,actor_id,idempotency_key,request,receipt_number,subtotal_minor,discount_minor,tax_minor,total_minor,receipt)
    values(v_sale_id,w,site.id,sess.register_id,sess.id,actor,key_id,request_body,code,sub,disc,tax,sub-disc+tax,receipt);
  for line in select value from jsonb_array_elements(lines) loop
    stock_owner:=(line->>'ownerId')::uuid;
    select * into inv from public.inventory_items where user_id=stock_owner and id=line->>'itemId';
    qty:=(line->>'quantity')::int; remaining:=qty;
    select coalesce(sum(quantity),0) into pos_total from public.chaos_sort_inventory_positions where user_id=stock_owner and item_id=inv.id;
    select coalesce(sum(quantity),0) into reserved from public.selling_inventory_allocations where user_id=stock_owner and inventory_item_id=inv.id and inventory_position_id is null and status in ('ALLOCATED','RESERVED');
    if pos_total>inv.quantity then raise exception 'POS_PROVENANCE_CONFLICT'; end if;
    for v_position in select * from public.chaos_sort_inventory_positions where user_id=stock_owner and item_id=inv.id and quantity>0 order by created_at,id for update loop
      if v_position.location_id is distinct from inv.location_id then raise exception 'POS_PROVENANCE_CONFLICT'; end if;
      if nullif(line->>'positionId','') is not null and v_position.id<>line->>'positionId' then continue; end if;
      select coalesce(sum(quantity),0) into pos_reserved from public.selling_inventory_allocations where user_id=stock_owner and inventory_item_id=inv.id and inventory_position_id=v_position.id and status in ('ALLOCATED','RESERVED');
      take:=least(remaining,greatest(0,v_position.quantity-pos_reserved-reserved));
      if take=0 then continue; end if;
      update public.chaos_sort_inventory_positions set quantity=quantity-take,status=case when quantity-take=0 then 'depleted' else status end,updated_at=now() where user_id=stock_owner and id=v_position.id;
      update public.chaos_sort_batches set current_quantity=current_quantity-take,updated_at=now() where user_id=stock_owner and id=v_position.batch_id and current_quantity>=take;
      if not found then raise exception 'POS_PROVENANCE_CONFLICT'; end if;
      insert into public.pos_sale_allocations(workspace_id,sale_id,inventory_user_id,inventory_item_id,position_id,batch_id,location_id,quantity,line_key) values(w,v_sale_id,stock_owner,inv.id,v_position.id,v_position.batch_id,v_position.location_id,take,coalesce(line->>'positionId',''));
      remaining:=remaining-take;
      exit when remaining=0;
    end loop;
    if remaining>0 then
      if nullif(line->>'positionId','') is not null or inv.quantity-pos_total-reserved<remaining then raise exception 'POS_STOCK_UNAVAILABLE'; end if;
      insert into public.pos_sale_allocations(workspace_id,sale_id,inventory_user_id,inventory_item_id,location_id,quantity,line_key) values(w,v_sale_id,stock_owner,inv.id,inv.location_id,remaining,coalesce(line->>'positionId',''));
    end if;
    insert into pos_private.stock_permits values(txid_current(),pg_backend_pid(),actor,stock_owner,inv.id,to_jsonb(inv),inv.quantity-qty);
    update public.inventory_items set quantity=quantity-qty,inventory_value=case when quantity=0 then 0 else round(inventory_value*(quantity-qty)/quantity,2) end,updated_at=now() where user_id=stock_owner and id=inv.id;
    delete from pos_private.stock_permits where transaction_id=txid_current() and backend=pg_backend_pid() and owner_id=stock_owner and item_id=inv.id;
    insert into public.pos_sale_items(workspace_id,sale_id,inventory_user_id,inventory_item_id,quantity,unit_price_minor,discount_minor,tax_minor,snapshot)
      values(w,v_sale_id,stock_owner,inv.id,qty,(line->>'unitPriceMinor')::bigint,(line->>'discountMinor')::bigint,(line->>'taxMinor')::bigint,line);
    insert into public.inventory_events(user_id,inventory_item_id,event_type,source,related_entity_type,related_entity_id,quantity_before,quantity_change,quantity_after,previous_location_id,next_location_id,card_name,idempotency_key,metadata)
      values(stock_owner,inv.id,'quantity_removed','system','pos_sale',v_sale_id::text,inv.quantity,-qty,inv.quantity-qty,inv.location_id,inv.location_id,inv.card_name,'pos:'||v_sale_id::text||':'||inv.id||case when stock_owner=actor then '' else ':owner:'||stock_owner::text end||case when nullif(line->>'positionId','') is null then '' else ':position:'||md5(line->>'positionId') end,
        jsonb_build_object('workspace_id',w,'actor_id',actor,'site_id',site.id,'register_id',sess.register_id,'receipt_number',code,'allocations',(select jsonb_agg(to_jsonb(a)) from public.pos_sale_allocations a where a.sale_id=v_sale_id and a.inventory_user_id=stock_owner and a.inventory_item_id=inv.id and a.line_key=coalesce(line->>'positionId',''))));
  end loop;
  insert into public.pos_tenders(workspace_id,sale_id,method,verification,amount_minor,received_minor,change_minor,payment_attempt_id,provider_reference,metadata) values(w,v_sale_id,coalesce(lower(payment.provider),'cash'),case payment.provider when 'MOCK' then 'simulated' when 'EXTERNAL' then 'externally_recorded' else 'recorded' end,sub-disc+tax,received,received-(sub-disc+tax),payment.id,payment.provider_payment_id,coalesce(payment.metadata,'{}'));
  return jsonb_build_object('status','completed','saleId',v_sale_id,'receipt',receipt,'replayed',false);
end $$;
revoke all on function pos_private.cash_command(uuid,text,jsonb) from public,anon,authenticated;
