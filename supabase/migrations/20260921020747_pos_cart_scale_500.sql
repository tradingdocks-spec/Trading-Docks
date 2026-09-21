-- Phase 7B: 500 distinct lines, bounded 256 KiB request envelopes.
-- Profiled quote, immutable payment snapshot, stock locking, atomic retry and receipt.
-- Existing function bodies/permissions are retained except their size/line bounds.
CREATE OR REPLACE FUNCTION pos_private.calculate(w uuid, site_id uuid, body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare site public.pos_store_locations%rowtype; inv public.inventory_items%rowtype; stock_owner uuid; line jsonb; lines jsonb:='[]'; updated jsonb:='[]';
 qty int; rate int; price bigint; original_price bigint; reserved bigint; line_sub bigint; line_disc bigint; line_tax bigint;
 sub bigint:=0; disc bigint:=0; tax bigint:=0; cart_discount bigint; taxable bigint; cumulative bigint:=0; allocated bigint:=0; share bigint;
begin
 perform pos_private.authorize(w);
 select * into site from public.pos_store_locations where id=site_id and workspace_id=w;
 if site.id is null or not pos_private.site_access(w,site.id) then raise exception 'POS_FORBIDDEN'; end if;
 if jsonb_typeof(body->'lines') is distinct from 'array' or jsonb_array_length(body->'lines') not between 1 and 500 then raise exception 'POS_INVALID'; end if;
  for line in select value from jsonb_array_elements(body->'lines') order by coalesce((value->>'ownerId')::uuid,site.inventory_user_id),(value->>'itemId') collate "C",nullif(value->>'positionId','') collate "C" nulls last loop
    stock_owner:=coalesce((line->>'ownerId')::uuid,site.inventory_user_id);
    if not pos_private.can_transact(w,site.id,stock_owner,'sell') then raise exception 'POS_FORBIDDEN'; end if;
    if coalesce(line->>'quantity','') !~ '^\d{1,4}$' or coalesce(line->>'discountBps','0') !~ '^\d{1,5}$' then raise exception 'POS_INVALID'; end if;
    qty := (line->>'quantity')::integer; rate := coalesce((line->>'discountBps')::integer,0);
    if qty not between 1 and 1000 or rate not between 0 and 10000 then raise exception 'POS_INVALID'; end if;
    if rate>0 then

      if length(trim(coalesce(body->>'discountReason',''))) not between 1 and 200 then raise exception 'POS_DISCOUNT_REASON'; end if;
    end if;
    select i.* into inv from public.inventory_items i join public.pos_location_inventory_locations m on m.inventory_user_id=i.user_id and m.location_id=i.location_id and m.site_id=site.id
      where i.user_id=stock_owner and i.workspace_id=w and i.id=line->>'itemId';
    if inv.id is null then raise exception 'POS_STOCK_UNAVAILABLE'; end if;
    select coalesce(sum(quantity),0) into reserved from public.selling_inventory_allocations where user_id=stock_owner and inventory_item_id=inv.id and status in ('ALLOCATED','RESERVED');
    if inv.quantity-reserved<qty then raise exception 'POS_STOCK_UNAVAILABLE'; end if;
    if inv.asking_price is null or inv.asking_price not between 0 and 1000000 then raise exception 'POS_PRICE_REQUIRED'; end if;
    price := (inv.asking_price*100)::bigint;
    original_price:=price;
    if line ? 'overrideMinor' and line->>'overrideMinor' is not null then
      if coalesce(line->>'overrideMinor','') !~ '^\d{1,9}$' or (line->>'overrideMinor')::bigint>100000000 then raise exception 'POS_INVALID'; end if;
      price:=(line->>'overrideMinor')::bigint;
    end if;
    if coalesce(line->>'discountMinor','0') !~ '^\d{1,12}$' then raise exception 'POS_INVALID'; end if;
    if rate>0 and coalesce((line->>'discountMinor')::bigint,0)>0 then raise exception 'POS_INVALID'; end if;
    line_sub := price*qty; line_disc := (line_sub*rate+5000)/10000+coalesce((line->>'discountMinor')::bigint,0);
    if line_disc>line_sub then raise exception 'POS_INVALID'; end if;
    if (line_disc>0 or price<>original_price) and length(trim(coalesce(body->>'discountReason',''))) not between 1 and 200 then raise exception 'POS_DISCOUNT_REASON'; end if;
    line_tax := case when inv.data->>'taxable'='false' then 0 else ((line_sub-line_disc)*site.tax_bps+5000)/10000 end;
    sub:=sub+line_sub; disc:=disc+line_disc; tax:=tax+line_tax;
    lines:=lines||jsonb_build_array(jsonb_build_object('itemId',inv.id,'ownerId',stock_owner,'name',coalesce(nullif(inv.product_name,''),inv.card_name),'sku',inv.sku,'quantity',qty,'unitPriceMinor',price,'originalUnitPriceMinor',original_price,'overrideDifferenceMinor',price-original_price,'lineDiscountMinor',line_disc,'discountBps',rate,'inventoryValueUnit',case when inv.quantity>0 then inv.inventory_value/inv.quantity else 0 end,'discountMinor',line_disc,'taxMinor',line_tax,'lineTotalMinor',line_sub-line_disc+line_tax,'gameId',coalesce(to_jsonb(inv)->>'game_id',inv.data->>'game_id'),'productType',coalesce(to_jsonb(inv)->>'product_type',inv.data->>'product_type'),'scryfallId',inv.scryfall_id,'tcgplayerProductId',coalesce(to_jsonb(inv)->>'tcgplayer_product_id',inv.data->>'tcgplayer_product_id'),'setCode',inv.set_code,'collectorNumber',inv.collector_number,'condition',coalesce((select p.condition from public.chaos_sort_inventory_positions p where p.user_id=stock_owner and p.id=line->>'positionId' and p.item_id=inv.id),inv.data->>'condition'),'finish',coalesce((select p.finish from public.chaos_sort_inventory_positions p where p.user_id=stock_owner and p.id=line->>'positionId' and p.item_id=inv.id),inv.data->>'finish'),'language',coalesce((select p.language from public.chaos_sort_inventory_positions p where p.user_id=stock_owner and p.id=line->>'positionId' and p.item_id=inv.id),inv.data->>'language'),'locationId',inv.location_id,'costBasis',pos_private.cost_snapshot(inv.data),'priceSource','asking_price','positionId',line->>'positionId'));
  end loop;

 if coalesce(body->>'cartDiscountMinor','0') !~ '^\d{1,12}$' or coalesce(body->>'cartDiscountBps','0') !~ '^\d{1,5}$'
   or coalesce((body->>'cartDiscountBps')::int,0)>10000 then raise exception 'POS_INVALID'; end if;
 if coalesce((body->>'cartDiscountMinor')::bigint,0)>0 and coalesce((body->>'cartDiscountBps')::int,0)>0 then raise exception 'POS_INVALID'; end if;
 taxable:=sub-disc;
 cart_discount:=coalesce((body->>'cartDiscountMinor')::bigint,0)+(taxable*coalesce((body->>'cartDiscountBps')::int,0)+5000)/10000;
 if cart_discount>taxable then raise exception 'POS_INVALID'; end if;
 if cart_discount>0 and length(trim(coalesce(body->>'discountReason',''))) not between 1 and 200 then raise exception 'POS_DISCOUNT_REASON'; end if;
 tax:=0;
 for line in select value from jsonb_array_elements(lines) loop
  line_sub:=(line->>'unitPriceMinor')::bigint*(line->>'quantity')::int-(line->>'discountMinor')::bigint;
  cumulative:=cumulative+line_sub;
  share:=case when taxable=0 then 0 else floor(cart_discount::numeric*cumulative/taxable)::bigint-allocated end;
  allocated:=allocated+share;
  select * into inv from public.inventory_items where user_id=(line->>'ownerId')::uuid and id=line->>'itemId';
  line_tax:=case when inv.data->>'taxable'='false' then 0 else ((line_sub-share)*site.tax_bps+5000)/10000 end;
  tax:=tax+line_tax;
  updated:=updated||jsonb_build_array(line||jsonb_build_object('cartDiscountMinor',share,'discountMinor',(line->>'discountMinor')::bigint+share,'taxMinor',line_tax,'lineTotalMinor',line_sub-share+line_tax));
 end loop;
 return jsonb_build_object('lines',updated,'subtotalMinor',sub,'discountMinor',disc+cart_discount,'taxMinor',tax,'totalMinor',sub-disc-cart_discount+tax);
end $function$
;
CREATE OR REPLACE FUNCTION pos_private.cash_command(w uuid, action text, body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if body is null or jsonb_typeof(body)<>'object' or octet_length(body::text)>262144 then raise exception 'POS_INVALID'; end if;
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
  if jsonb_typeof(body->'lines') is distinct from 'array' or jsonb_array_length(body->'lines') not between 1 and 500
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
end $function$
;
CREATE OR REPLACE FUNCTION pos_private.command(w uuid, action text, body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare prior public.pos_operation_receipts%rowtype; result jsonb; key_id uuid; site uuid; manager boolean;
begin
 if body is null or jsonb_typeof(body)<>'object' or octet_length(body::text)>262144 then raise exception 'POS_INVALID'; end if;
 if action in ('history','receipt','sessions','session_detail','daily','approvals') then return pos_private.read_operations(w,action,body); end if;
 if action in ('availability','bootstrap','search','recover','cancel','setup') then return pos_private.cash_command(w,action,body); end if;
 if action='access' then return pos_private.access_command(w,action,body); end if;
 if action='quote' then
  result:=pos_private.calculate(w,(body->>'siteId')::uuid,body);
  return result||jsonb_build_object('lines',(select jsonb_agg(value-array['costBasis','inventoryValueUnit']) from jsonb_array_elements(result->'lines')));
 end if;
 perform pos_private.authorize(w);
 key_id:=(body->>'key')::uuid; if key_id is null then raise exception 'POS_INVALID'; end if;
 perform pg_advisory_xact_lock(hashtextextended('pos-operation:'||w::text||auth.uid()::text||key_id::text,0));
 select * into prior from public.pos_operation_receipts where workspace_id=w and actor_id=auth.uid() and key=key_id;
 if prior.key is not null then
  if prior.action<>action or prior.intent<>body-'key' then raise exception 'POS_IDEMPOTENCY_CONFLICT'; end if;
  return prior.result;
 end if;
 if action in ('grant','revoke','staff_permissions','join_site') then result:=pos_private.access_command(w,action,body);
 elsif action='checkout' then result:=pos_private.cash_command(w,action,body);
 elsif action='refund' then result:=pos_private.refund(w,body);
 else result:=pos_private.operations(w,action,body); end if;
 insert into public.pos_operation_receipts(workspace_id,actor_id,key,action,intent,result) values(w,auth.uid(),key_id,action,body-'key',result);
 return result;
end $function$
;
CREATE OR REPLACE FUNCTION pos_private.payment_command(w uuid, action text, body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
declare p public.pos_payment_attempts%rowtype;c public.pos_payment_checkouts%rowtype;sess public.pos_register_sessions%rowtype;
 quote jsonb; intent jsonb; result jsonb; original_status text; observed text; outcome text; key_id uuid; event_key text; n integer; sq_id uuid;sq_location text;
begin
 if body is null or jsonb_typeof(body)<>'object' or octet_length(body::text)>262144 then raise exception 'POS_INVALID'; end if;
 perform pos_private.authorize(w,false,false);
 if action='capabilities' then return jsonb_build_object('mockEnabled',coalesce((select enabled from pos_private.payment_test_config),false),'terminals',pos_private.terminal_devices(w),'squareSites',(select coalesce(jsonb_agg(m.site_id),'[]') from pos_private.square_mappings m join pos_private.square_connections sqc on sqc.id=m.connection_id join pos_private.square_locations l on l.connection_id=m.connection_id and l.id=m.location_id where sqc.workspace_id=w and sqc.status='CONNECTED' and l.status='ACTIVE' and pos_private.site_access(w,m.site_id)));  end if;
 if action='list' then
 return (select coalesce(jsonb_agg(pos_private.payment_view(x.id)),'[]') from (select a.id from public.pos_payment_attempts a join public.pos_payment_checkouts ch on ch.id=a.checkout_id where a.workspace_id=w and (a.actor_id=auth.uid() or (pos_private.site_access(w,ch.site_id) and exists(select 1 from public.workspace_members where workspace_id=w and user_id=auth.uid() and role in ('owner','admin','manager')))) and (nullif(body->>'saleId','') is null or ch.sale_id=(body->>'saleId')::uuid) and (nullif(body->>'provider','') is null or a.provider=body->>'provider') and (nullif(body->>'status','') is null or a.status=body->>'status') order by a.created_at desc,a.id desc limit 100) x);
 end if;
 if action='create' then
  perform pos_private.authorize(w);
  key_id:=(body->>'key')::uuid;
  if key_id is null or body->>'provider' not in ('MOCK','EXTERNAL','SQUARE') then raise exception 'POS_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended('payment:'||w::text||auth.uid()::text||key_id::text,0));
  select * into p from public.pos_payment_attempts where workspace_id=w and actor_id=auth.uid() and idempotency_key=key_id;
  if p.id is not null then
   if p.request<>body-'key' then raise exception 'POS_IDEMPOTENCY_CONFLICT'; end if;
   return pos_private.payment_view(p.id);
  end if;
  if body->>'provider'='MOCK' and not (select enabled from pos_private.payment_test_config) then raise exception 'POS_MOCK_DISABLED'; end if;
  if body->>'provider'='MOCK' and coalesce(body->>'outcome','') not in ('APPROVE','DECLINE','CANCEL','TIMEOUT','DELAYED_SUCCESS','UNKNOWN_THEN_SUCCESS','UNKNOWN_THEN_DECLINE') then raise exception 'POS_INVALID'; end if;
  if body->>'provider'='EXTERNAL' and (length(trim(coalesce(body->>'reference',''))) not between 1 and 100 or coalesce(body->>'method','') not in ('external_terminal','check','other')) then raise exception 'POS_INVALID'; end if;
  intent:=body->'intent';
  select * into sess from public.pos_register_sessions where id=(intent->>'sessionId')::uuid and workspace_id=w and site_id=(intent->>'siteId')::uuid for update;
  if sess.id is null or sess.status<>'OPEN' then raise exception 'POS_SESSION_CLOSED'; end if;
  select * into c from public.pos_payment_checkouts where id=coalesce((body->>'checkoutId')::uuid,(intent->>'key')::uuid) and workspace_id=w for update;
  if c.id is not null then
   if c.actor_id<>auth.uid() or c.intent<>intent then raise exception 'POS_IDEMPOTENCY_CONFLICT'; end if;
   if c.state<>'PAYABLE' then raise exception 'POS_PAYMENT_ACTIVE'; end if;
  end if;
  quote:=pos_private.calculate(w,sess.site_id,intent);
  perform pos_private.payment_validate_stock(w,sess.site_id,quote);
  quote:=pos_private.calculate(w,sess.site_id,intent);
  if (quote->>'totalMinor')::bigint<1 or (intent->>'expectedMinor')::bigint is distinct from (quote->>'totalMinor')::bigint then raise exception 'POS_QUOTE_CHANGED'; end if;
  if ((quote->>'discountMinor')::bigint>0 and not pos_private.permission(w,'discount')) or (exists(select 1 from jsonb_array_elements(quote->'lines') where (value->>'overrideDifferenceMinor')::bigint<>0) and not pos_private.permission(w,'override')) then
   perform pos_private.approved(w,sess.site_id,'checkout',intent);
  end if;
  if c.id is null then
   insert into public.pos_payment_checkouts(id,workspace_id,site_id,register_id,session_id,actor_id,intent,snapshot,amount_minor)
    values((intent->>'key')::uuid,w,sess.site_id,sess.register_id,sess.id,auth.uid(),intent,quote,(quote->>'totalMinor')::bigint) returning * into c;
  elsif c.snapshot<>quote then raise exception 'POS_QUOTE_CHANGED'; end if;
  if body->>'provider'='SQUARE' then
   if (body-array['key','provider','intent','checkoutId','outcome','reference','method'])<>'{}'::jsonb
    or (intent-array['key','siteId','sessionId','expectedMinor','cashMinor','discountReason','cartDiscountMinor','cartDiscountBps','approvalId','lines'])<>'{}'::jsonb
    or exists(select 1 from jsonb_array_elements(intent->'lines') x where (x-array['itemId','ownerId','quantity','discountMinor','discountBps','overrideMinor','positionId','locationId'])<>'{}'::jsonb)
    then raise exception 'POS_INVALID';end if;
   select a.id,m.location_id into sq_id,sq_location from pos_private.square_connections a join pos_private.square_mappings m on m.connection_id=a.id join pos_private.square_locations l on l.connection_id=m.connection_id and l.id=m.location_id
    where a.workspace_id=w and a.status='CONNECTED' and a.environment='SANDBOX' and m.site_id=sess.site_id and l.status='ACTIVE';
   if sq_id is null then raise exception 'POS_SQUARE_UNAVAILABLE';end if;
   if body ? 'locationId' or body ? 'sourceId' then raise exception 'POS_INVALID';end if;
  end if;
  insert into public.pos_payment_attempts(workspace_id,checkout_id,actor_id,provider,amount_minor,currency,idempotency_key,request,provider_account_id,metadata)
   values(w,c.id,auth.uid(),body->>'provider',c.amount_minor,c.currency,key_id,body-'key',case when body->>'provider'='SQUARE' then sq_id::text end,case when body->>'provider'='SQUARE' then jsonb_build_object('environment','SANDBOX','locationId',sq_location,'verification','Square Sandbox') else '{}'::jsonb end) returning * into p;
  update public.pos_payment_checkouts set state='PAYING',updated_at=now() where id=c.id;
  perform pos_private.payment_audit(p.id,'attempt_created',null,'CREATED');
  return pos_private.payment_view(p.id);
 end if;
 select * into p from public.pos_payment_attempts where id=(body->>'id')::uuid and workspace_id=w;
 if p.id is null then raise exception 'POS_FORBIDDEN'; end if;
 perform pos_private.payment_authorize(w,p.checkout_id);
 if action='get' then return pos_private.payment_view(p.id); end if;
 -- Consistent order with register closing and canonical sale/refund commands.
 select ch.* into c from public.pos_payment_checkouts ch where ch.id=p.checkout_id;
 perform 1 from public.pos_register_sessions where id=c.session_id for update;
 select * into c from public.pos_payment_checkouts where id=p.checkout_id for update;
 select * into p from public.pos_payment_attempts where id=p.id for update;
 original_status:=p.status;
 if action in ('dispatch','provider_get','provider_cancel') then
  if action='dispatch' and p.status='CREATED' then
   perform pos_private.authorize(w);
   if c.actor_id<>auth.uid() then raise exception 'POS_FORBIDDEN'; end if;
   quote:=pos_private.calculate(w,c.site_id,c.intent);
   perform pos_private.payment_validate_stock(w,c.site_id,quote);
   quote:=pos_private.calculate(w,c.site_id,c.intent);
   if quote<>c.snapshot then raise exception 'POS_QUOTE_CHANGED'; end if;
  end if;

  if p.provider='SQUARE' then
   if action='dispatch' and p.status='CREATED' then update public.pos_payment_attempts set status='PENDING',updated_at=now() where id=p.id;end if;
   return pos_private.payment_view(p.id);
  elsif p.provider='MOCK' then
   if not (select enabled from pos_private.payment_test_config) then raise exception 'POS_MOCK_DISABLED'; end if;
   outcome:=p.request->>'outcome';
   if action='dispatch' then
    insert into pos_private.mock_payments values(p.id,outcome,case outcome when 'APPROVE' then 'SUCCEEDED' when 'DECLINE' then 'DECLINED' when 'CANCEL' then 'CANCELED' when 'TIMEOUT' then 'TIMED_OUT' when 'DELAYED_SUCCESS' then 'PROCESSING' else 'UNKNOWN' end,0,'mock_'||p.id::text) on conflict do nothing;
    if p.status='CREATED' then update public.pos_payment_attempts set status='PENDING',provider_payment_id='mock_'||p.id::text,updated_at=now() where id=p.id; perform pos_private.payment_audit(p.id,'provider_initiated',p.status,'PENDING'); end if;
   elsif action='provider_get' then
    update pos_private.mock_payments set polls=polls+1,status=case when polls>=1 and outcome in ('DELAYED_SUCCESS','UNKNOWN_THEN_SUCCESS') then 'SUCCEEDED' when polls>=1 and outcome='UNKNOWN_THEN_DECLINE' then 'DECLINED' else status end where payment_id=p.id and status in ('PROCESSING','UNKNOWN');
   else
    insert into pos_private.mock_payments values(p.id,outcome,'CANCELED',0,'mock_'||p.id::text) on conflict do nothing;
    update pos_private.mock_payments set status='CANCELED' where payment_id=p.id and status in ('PROCESSING','UNKNOWN','TIMED_OUT');
   end if;
  else
   if action='dispatch' and p.status='CREATED' then
    update public.pos_payment_attempts set status='SUCCEEDED',provider_payment_id=p.request->>'reference',metadata=jsonb_build_object('verification','Externally recorded','method',p.request->>'method'),completed_at=now(),updated_at=now() where id=p.id;
    update public.pos_payment_checkouts set state='FINALIZING' where id=c.id;
    perform pos_private.payment_audit(p.id,'externally_recorded',p.status,'SUCCEEDED');
   end if;
  end if;
  return pos_private.payment_view(p.id);
 elsif action='observe' then
  if p.provider='SQUARE' then
   select status into observed from pos_private.square_observations where payment_id=p.id;
   if observed is null then return pos_private.payment_view(p.id);end if;
  elsif p.provider='MOCK' then
   if not (select enabled from pos_private.payment_test_config) then raise exception 'POS_MOCK_DISABLED'; end if;
   select status into observed from pos_private.mock_payments where payment_id=p.id;
   if observed is null then raise exception 'POS_PAYMENT_UNCERTAIN'; end if;
  else observed:=p.status; end if;
  event_key:=coalesce(nullif(body->>'eventId',''),'poll:'||p.id::text||':'||observed);
  if length(event_key)>160 then raise exception 'POS_INVALID'; end if;
  insert into public.pos_payment_events(workspace_id,payment_id,provider,external_event_id,status,observed_status) values(w,p.id,p.provider,event_key,'RECEIVED',observed) on conflict do nothing;
  if exists(select 1 from public.pos_payment_events where workspace_id=w and provider=p.provider and external_event_id=event_key and payment_id<>p.id) then raise exception 'POS_IDEMPOTENCY_CONFLICT'; end if;
  if p.status in ('CREATED','PENDING','AWAITING_CUSTOMER','PROCESSING','AUTHORIZED','UNKNOWN','TIMED_OUT') then
   update public.pos_payment_attempts set status=observed,provider_payment_id=case when p.provider='SQUARE' then (select provider_id from pos_private.square_observations where payment_id=p.id) else provider_payment_id end,metadata=case when p.provider='SQUARE' then metadata||(select metadata from pos_private.square_observations where payment_id=p.id) when observed='SUCCEEDED' then jsonb_build_object('brand','Mock','last4','4242','verification','Simulated') else metadata end,completed_at=case when observed in ('SUCCEEDED','DECLINED','FAILED','CANCELED') then now() end,reconciled_at=now(),updated_at=now() where id=p.id;
   update public.pos_payment_checkouts set state=case when observed='SUCCEEDED' then 'FINALIZING' when observed in ('DECLINED','FAILED','CANCELED') then 'PAYABLE' else 'PAYING' end,updated_at=now() where id=c.id;
   perform pos_private.payment_audit(p.id,'reconciled',p.status,observed);
  end if;
  update public.pos_payment_events set status='PROCESSED',processed_at=now() where workspace_id=w and provider=p.provider and external_event_id=event_key;
  return pos_private.payment_view(p.id);
 elsif action='finalize' then
  if c.state='COMPLETED' then return pos_private.payment_view(p.id); end if;
  if p.status<>'SUCCEEDED' then raise exception 'POS_PAYMENT_UNCERTAIN'; end if;
  if c.actor_id<>auth.uid() then return pos_private.payment_view(p.id)||jsonb_build_object('failureCode','POS_ORIGINAL_ACTOR_REQUIRED'); end if;
  begin
   quote:=pos_private.calculate(w,c.site_id,c.intent);
   if quote<>c.snapshot then raise exception 'POS_QUOTE_CHANGED'; end if;
   insert into pos_private.payment_context values(txid_current(),pg_backend_pid(),auth.uid(),p.id,null);
   result:=pos_private.cash_command(w,'checkout',c.intent||jsonb_build_object('key',c.id,'cashMinor',c.amount_minor));
   delete from pos_private.payment_context where transaction_id=txid_current() and backend=pg_backend_pid();
   update public.pos_payment_checkouts set state='COMPLETED',sale_id=(result->>'saleId')::uuid,failure_code=null,updated_at=now() where id=c.id;
   perform pos_private.payment_audit(p.id,'sale_finalized',p.status,p.status);
  exception when others then
   update public.pos_payment_checkouts set state='RECOVERY_REQUIRED',failure_code=case when sqlerrm like 'POS_%' then split_part(sqlerrm,E'\n',1) else 'POS_FINALIZATION_FAILED' end,updated_at=now() where id=c.id;
   perform pos_private.payment_audit(p.id,'finalization_recovery_required',p.status,p.status);
  end;
  return pos_private.payment_view(p.id);
 end if;
 raise exception 'POS_INVALID';
end $function$
;
CREATE OR REPLACE FUNCTION pos_private.payment_refund_command(w uuid, action text, body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
declare p public.pos_payment_attempts%rowtype;c public.pos_payment_checkouts%rowtype;r public.pos_payment_refund_attempts%rowtype;amount bigint;quote jsonb;result jsonb;outcome text;observed text;total bigint;intent jsonb;
begin
 perform pos_private.authorize(w,false,false);
 if not pos_private.permission(w,'refund') then raise exception 'POS_FORBIDDEN'; end if;
 if jsonb_typeof(body)<>'object' or octet_length(body::text)>262144 then raise exception 'POS_INVALID'; end if;
 if action='create' then
  if body->>'key' is null then raise exception 'POS_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended('payment-refund:'||w::text||auth.uid()::text||(body->>'key'),0));
  select * into r from public.pos_payment_refund_attempts where workspace_id=w and actor_id=auth.uid() and idempotency_key=(body->>'key')::uuid;
  if r.id is not null then
   if r.intent<>body->'intent' or r.payment_id<>(body->>'paymentId')::uuid then raise exception 'POS_IDEMPOTENCY_CONFLICT'; end if;
   return to_jsonb(r);
  end if;
  select * into p from public.pos_payment_attempts where id=(body->>'paymentId')::uuid and workspace_id=w;
 else
  select * into r from public.pos_payment_refund_attempts where id=(body->>'id')::uuid and workspace_id=w;
  select * into p from public.pos_payment_attempts where id=r.payment_id and workspace_id=w;
 end if;
 if p.id is null then raise exception 'POS_FORBIDDEN'; end if;
 perform pos_private.payment_authorize(w,p.checkout_id);
 select * into c from public.pos_payment_checkouts where id=p.checkout_id;
 -- Processing session first, then checkout/payment, then original sale/stock.
 intent:=case when action='create' then body->'intent' else r.intent end;
 if c.sale_id is not null then perform 1 from public.pos_register_sessions where workspace_id=w and id=(intent->>'sessionId')::uuid for update; end if;
 perform 1 from public.pos_register_sessions where id=c.session_id for update;
 select * into c from public.pos_payment_checkouts where id=c.id for update;
 select * into p from public.pos_payment_attempts where id=p.id for update;
 if action='create' then
  if p.status not in ('SUCCEEDED','PARTIALLY_REFUNDED') then raise exception 'POS_PAYMENT_UNCERTAIN'; end if;
  if exists(select 1 from public.pos_payment_refund_attempts where payment_id=p.id and (status in ('CREATED','PENDING','UNKNOWN') or recovery_required)) then raise exception 'POS_PAYMENT_ACTIVE'; end if;
  if c.sale_id is null then
   perform pos_private.payment_authorize(w,c.id,true);
   if c.state not in ('RECOVERY_REQUIRED','FINALIZING') or length(trim(coalesce(intent->>'reason',''))) not between 1 and 500 then raise exception 'POS_INVALID'; end if;
   amount:=p.amount_minor;
  else
   if intent->>'saleId' is distinct from c.sale_id::text then raise exception 'POS_FORBIDDEN'; end if;
   quote:=pos_private.payment_refund_quote(w,intent);amount:=(quote->>'totalMinor')::bigint;
  end if;
  select coalesce(sum(amount_minor),0) into total from public.pos_payment_refund_attempts where payment_id=p.id and status<>'FAILED';
  if amount<1 or amount+total>p.amount_minor then raise exception 'POS_REFUND_EXCEEDED'; end if;
  if coalesce(intent->>'mockOutcome','REFUND_SUCCESS') not in ('REFUND_SUCCESS','REFUND_FAIL','REFUND_UNKNOWN_THEN_SUCCESS') then raise exception 'POS_INVALID'; end if;
  insert into public.pos_payment_refund_attempts(workspace_id,payment_id,actor_id,idempotency_key,intent,amount_minor) values(w,p.id,auth.uid(),(body->>'key')::uuid,intent,amount) returning * into r;
  perform pos_private.payment_audit(p.id,'refund_requested',p.status,p.status);
  return to_jsonb(r);
 end if;
 select * into r from public.pos_payment_refund_attempts where id=r.id for update;
 if action='get' then return to_jsonb(r); end if;
 if action in ('dispatch','reconcile') then
  if p.provider='SQUARE' then
   select status into observed from pos_private.square_refund_observations where refund_id=r.id;
   if observed is null then return to_jsonb(r);end if;
  elsif p.provider='MOCK' then
   if not (select enabled from pos_private.payment_test_config) then raise exception 'POS_MOCK_DISABLED'; end if;
   outcome:=coalesce(r.intent->>'mockOutcome','REFUND_SUCCESS');
   insert into pos_private.mock_refunds values(r.id,outcome,case outcome when 'REFUND_FAIL' then 'FAILED' when 'REFUND_UNKNOWN_THEN_SUCCESS' then 'UNKNOWN' else 'SUCCEEDED' end,'mock_refund_'||r.id::text) on conflict do nothing;
   if action='reconcile' then update pos_private.mock_refunds set status='SUCCEEDED' where refund_id=r.id and status='UNKNOWN'; end if;
   select status into observed from pos_private.mock_refunds where refund_id=r.id;
  else observed:='SUCCEEDED'; end if;
  if r.status not in ('SUCCEEDED','FAILED') then
   update public.pos_payment_refund_attempts set status=observed,provider_refund_id=case when p.provider='SQUARE' then (select provider_id from pos_private.square_refund_observations where refund_id=r.id) when p.provider='MOCK' then 'mock_refund_'||r.id::text else 'external_refund_'||r.id::text end,recovery_required=observed='SUCCEEDED',updated_at=now() where id=r.id returning * into r;
   perform pos_private.payment_audit(p.id,'refund_provider_'||lower(observed),p.status,p.status);
  end if;
  return to_jsonb(r);
 elsif action='finalize' then
  if r.status<>'SUCCEEDED' then return to_jsonb(r); end if;
  if r.refund_id is not null or not r.recovery_required then return to_jsonb(r); end if;
  if r.actor_id<>auth.uid() then raise exception 'POS_FORBIDDEN'; end if;
  begin
   if c.sale_id is null then
    update public.pos_payment_checkouts set state='VOIDED',failure_code=null,updated_at=now() where id=c.id;
   else
    insert into pos_private.payment_context values(txid_current(),pg_backend_pid(),auth.uid(),p.id,r.id);
    result:=pos_private.refund(w,r.intent);
    delete from pos_private.payment_context where transaction_id=txid_current() and backend=pg_backend_pid();
    update public.pos_payment_refund_attempts set refund_id=(result->>'id')::uuid where id=r.id;
   end if;
   update public.pos_payment_refund_attempts set recovery_required=false,failure_code=null,updated_at=now() where id=r.id;
   select coalesce(sum(amount_minor),0) into total from public.pos_payment_refund_attempts where payment_id=p.id and status='SUCCEEDED';
   update public.pos_payment_attempts set status=case when total=p.amount_minor then 'REFUNDED' else 'PARTIALLY_REFUNDED' end,updated_at=now() where id=p.id;
   perform pos_private.payment_audit(p.id,'refund_completed',p.status,case when total=p.amount_minor then 'REFUNDED' else 'PARTIALLY_REFUNDED' end);
  exception when others then
   update public.pos_payment_refund_attempts set recovery_required=true,failure_code=case when sqlerrm like 'POS_%' then split_part(sqlerrm,E'\n',1) else 'POS_FINALIZATION_FAILED' end,updated_at=now() where id=r.id;
  end;
  select * into r from public.pos_payment_refund_attempts where id=r.id;
  return to_jsonb(r);
 end if;
 raise exception 'POS_INVALID';
end $function$
;
CREATE OR REPLACE FUNCTION pos_private.payment_refund_quote(w uuid, body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare sale public.pos_sales%rowtype; sess public.pos_register_sessions%rowtype; original public.pos_sale_items%rowtype;
 inv public.inventory_items%rowtype; alloc public.pos_sale_allocations%rowtype; position public.chaos_sort_inventory_positions%rowtype;
 line jsonb; prepared jsonb:='[]'; allocation_rows jsonb; q integer; previous_q integer; skip_q integer; take_q integer; remaining integer;
 net bigint; tax bigint; net_sum bigint:=0; tax_sum bigint:=0; refund_id uuid:=gen_random_uuid(); refund_item uuid;
 stock_owner uuid; restore boolean; unit_value numeric;
begin
 perform pos_private.authorize(w);
 if not pos_private.permission(w,'refund') then raise exception 'POS_FORBIDDEN'; end if;
 select * into sess from public.pos_register_sessions where id=(body->>'sessionId')::uuid and workspace_id=w for update;
 if sess.id is null or sess.status<>'OPEN' or not pos_private.site_access(w,sess.site_id) then raise exception 'POS_SESSION_CLOSED'; end if;
 select * into sale from public.pos_sales where id=(body->>'saleId')::uuid and workspace_id=w for update;
 if sale.id is null or not pos_private.site_access(w,sale.site_id) then raise exception 'POS_FORBIDDEN'; end if;
 if length(trim(coalesce(body->>'reason',''))) not between 1 and 500 or jsonb_typeof(body->'lines') is distinct from 'array' or jsonb_array_length(body->'lines') not between 1 and 500
  or (select count(distinct value->>'saleItemId') from jsonb_array_elements(body->'lines'))<>jsonb_array_length(body->'lines') then raise exception 'POS_INVALID'; end if;
 for stock_owner in select distinct inventory_user_id from public.pos_sale_items where sale_id=sale.id and id in (select (value->>'saleItemId')::uuid from jsonb_array_elements(body->'lines')) order by inventory_user_id loop
  perform pos_private.lock_authority(w,sale.site_id,stock_owner,'return');
 end loop;
 for line in select value from jsonb_array_elements(body->'lines') order by value->>'saleItemId' loop
  select * into original from public.pos_sale_items where id=(line->>'saleItemId')::uuid and sale_id=sale.id;
  if original.id is null or coalesce(line->>'quantity','') !~ '^\d{1,4}$' or jsonb_typeof(line->'returnInventory') is distinct from 'boolean' then raise exception 'POS_INVALID'; end if;
  q:=(line->>'quantity')::int; restore:=(line->>'returnInventory')::boolean;
  select coalesce(sum(quantity),0) into previous_q from public.pos_refund_items where sale_item_id=original.id;
  if q<1 or previous_q+q>original.quantity then raise exception 'POS_REFUND_EXCEEDED'; end if;
  net:=((original.unit_price_minor*original.quantity-original.discount_minor)*(previous_q+q)/original.quantity)-((original.unit_price_minor*original.quantity-original.discount_minor)*previous_q/original.quantity);
  tax:=(original.tax_minor*(previous_q+q)/original.quantity)-(original.tax_minor*previous_q/original.quantity);
  prepared:=prepared||jsonb_build_array(jsonb_build_object('id',original.id,'quantity',q,'returnInventory',restore,'net',net,'tax',tax,'previous',previous_q));
  net_sum:=net_sum+net; tax_sum:=tax_sum+tax;
 end loop;
 if coalesce(body->>'expectedMinor','') !~ '^\d{1,12}$' or (body->>'expectedMinor')::bigint<>net_sum+tax_sum then raise exception 'POS_QUOTE_CHANGED'; end if;
 return jsonb_build_object('totalMinor',net_sum+tax_sum);
end $function$
;
CREATE OR REPLACE FUNCTION pos_private.refund(w uuid, body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare sale public.pos_sales%rowtype; sess public.pos_register_sessions%rowtype; original public.pos_sale_items%rowtype;
 inv public.inventory_items%rowtype; alloc public.pos_sale_allocations%rowtype; position public.chaos_sort_inventory_positions%rowtype;
 line jsonb; prepared jsonb:='[]'; allocation_rows jsonb; q integer; previous_q integer; skip_q integer; take_q integer; remaining integer;
 net bigint; tax bigint; net_sum bigint:=0; tax_sum bigint:=0; refund_id uuid:=gen_random_uuid(); refund_item uuid;
 stock_owner uuid; restore boolean; unit_value numeric;
begin
 perform pos_private.authorize(w);
 if not pos_private.permission(w,'refund') then raise exception 'POS_FORBIDDEN'; end if;
 select * into sess from public.pos_register_sessions where id=(body->>'sessionId')::uuid and workspace_id=w for update;
 if sess.id is null or sess.status<>'OPEN' or not pos_private.site_access(w,sess.site_id) then raise exception 'POS_SESSION_CLOSED'; end if;
 select * into sale from public.pos_sales where id=(body->>'saleId')::uuid and workspace_id=w for update;
 if exists(select 1 from public.pos_tenders where sale_id=sale.id and method<>'cash') and not exists(select 1 from pos_private.payment_context x join public.pos_payment_refund_attempts r on r.id=x.refund_attempt_id where x.transaction_id=txid_current() and x.backend=pg_backend_pid() and x.actor_id=auth.uid() and r.workspace_id=w and r.status='SUCCEEDED' and r.intent->>'saleId'=sale.id::text) then raise exception 'POS_PROVIDER_REFUND_REQUIRED'; end if;
 if sale.id is null or not pos_private.site_access(w,sale.site_id) then raise exception 'POS_FORBIDDEN'; end if;
 if length(trim(coalesce(body->>'reason',''))) not between 1 and 500 or jsonb_typeof(body->'lines') is distinct from 'array' or jsonb_array_length(body->'lines') not between 1 and 500
  or (select count(distinct value->>'saleItemId') from jsonb_array_elements(body->'lines'))<>jsonb_array_length(body->'lines') then raise exception 'POS_INVALID'; end if;
 for stock_owner in select distinct inventory_user_id from public.pos_sale_items where sale_id=sale.id and id in (select (value->>'saleItemId')::uuid from jsonb_array_elements(body->'lines')) order by inventory_user_id loop
  perform pos_private.lock_authority(w,sale.site_id,stock_owner,'return');
 end loop;
 for line in select value from jsonb_array_elements(body->'lines') order by value->>'saleItemId' loop
  select * into original from public.pos_sale_items where id=(line->>'saleItemId')::uuid and sale_id=sale.id;
  if original.id is null or coalesce(line->>'quantity','') !~ '^\d{1,4}$' or jsonb_typeof(line->'returnInventory') is distinct from 'boolean' then raise exception 'POS_INVALID'; end if;
  q:=(line->>'quantity')::int; restore:=(line->>'returnInventory')::boolean;
  select coalesce(sum(quantity),0) into previous_q from public.pos_refund_items where sale_item_id=original.id;
  if q<1 or previous_q+q>original.quantity then raise exception 'POS_REFUND_EXCEEDED'; end if;
  net:=((original.unit_price_minor*original.quantity-original.discount_minor)*(previous_q+q)/original.quantity)-((original.unit_price_minor*original.quantity-original.discount_minor)*previous_q/original.quantity);
  tax:=(original.tax_minor*(previous_q+q)/original.quantity)-(original.tax_minor*previous_q/original.quantity);
  prepared:=prepared||jsonb_build_array(jsonb_build_object('id',original.id,'quantity',q,'returnInventory',restore,'net',net,'tax',tax,'previous',previous_q));
  net_sum:=net_sum+net; tax_sum:=tax_sum+tax;
 end loop;
 if coalesce(body->>'expectedMinor','') !~ '^\d{1,12}$' or (body->>'expectedMinor')::bigint<>net_sum+tax_sum then raise exception 'POS_QUOTE_CHANGED'; end if;
 insert into public.pos_refunds(id,workspace_id,sale_id,site_id,register_id,session_id,actor_id,subtotal_minor,tax_minor,total_minor,reason)
 values(refund_id,w,sale.id,sess.site_id,sess.register_id,sess.id,auth.uid(),net_sum,tax_sum,net_sum+tax_sum,body->>'reason');
 for line in select value from jsonb_array_elements(prepared) loop
  select * into original from public.pos_sale_items where id=(line->>'id')::uuid;
  q:=(line->>'quantity')::int; restore:=(line->>'returnInventory')::boolean; remaining:=q; skip_q:=(line->>'previous')::int; allocation_rows:='[]';
  if restore then
   select * into inv from public.inventory_items where user_id=original.inventory_user_id and id=original.inventory_item_id and workspace_id=w for update;
   if inv.id is null or not (original.snapshot ? 'inventoryValueUnit') or inv.location_id is distinct from original.snapshot->>'locationId'
     or not exists(select 1 from public.pos_location_inventory_locations where workspace_id=w and site_id=sale.site_id and inventory_user_id=inv.user_id and location_id=inv.location_id)
     or inv.set_code is distinct from original.snapshot->>'setCode' or inv.collector_number is distinct from original.snapshot->>'collectorNumber'
     then raise exception 'POS_PROVENANCE_CONFLICT'; end if;
  end if;
  for alloc in select * from public.pos_sale_allocations where sale_id=sale.id and inventory_user_id=original.inventory_user_id and inventory_item_id=original.inventory_item_id
   and line_key=coalesce(original.snapshot->>'positionId','') order by id loop
   take_q:=least(remaining,greatest(0,alloc.quantity-skip_q)); skip_q:=greatest(0,skip_q-alloc.quantity);
   if take_q=0 then continue; end if;
   allocation_rows:=allocation_rows||jsonb_build_array(jsonb_build_object('allocationId',alloc.id,'positionId',alloc.position_id,'batchId',alloc.batch_id,'locationId',alloc.location_id,'quantity',take_q));
   if restore and alloc.position_id is not null then
    select * into position from public.chaos_sort_inventory_positions where user_id=inv.user_id and id=alloc.position_id and item_id=inv.id for update;
    if position.id is null or position.status='retired' or position.location_id is distinct from alloc.location_id or position.batch_id is distinct from alloc.batch_id
      or position.condition is distinct from original.snapshot->>'condition' or position.finish is distinct from original.snapshot->>'finish' or position.language is distinct from original.snapshot->>'language' then raise exception 'POS_PROVENANCE_CONFLICT'; end if;
    update public.chaos_sort_inventory_positions set quantity=quantity+take_q,status='active',updated_at=now() where user_id=inv.user_id and id=position.id;
    update public.chaos_sort_batches set current_quantity=current_quantity+take_q,updated_at=now() where user_id=inv.user_id and id=alloc.batch_id;
    if not found then raise exception 'POS_PROVENANCE_CONFLICT'; end if;
   elsif restore then
    if inv.data->>'condition' is distinct from original.snapshot->>'condition' or inv.data->>'finish' is distinct from original.snapshot->>'finish' or inv.data->>'language' is distinct from original.snapshot->>'language' then raise exception 'POS_PROVENANCE_CONFLICT'; end if;
   end if;
   remaining:=remaining-take_q; exit when remaining=0;
  end loop;
  if remaining<>0 then raise exception 'POS_PROVENANCE_CONFLICT'; end if;
  insert into public.pos_refund_items(refund_id,sale_item_id,quantity,return_inventory,subtotal_minor,tax_minor,allocations)
   values(refund_id,original.id,q,restore,(line->>'net')::bigint,(line->>'tax')::bigint,allocation_rows) returning id into refund_item;
  if restore then
   insert into pos_private.stock_permits values(txid_current(),pg_backend_pid(),auth.uid(),inv.user_id,inv.id,to_jsonb(inv),inv.quantity+q);
   unit_value:=coalesce((original.snapshot->>'inventoryValueUnit')::numeric,0);
   update public.inventory_items set quantity=quantity+q,inventory_value=inventory_value+round(unit_value*((line->>'previous')::int+q),2)-round(unit_value*(line->>'previous')::int,2),updated_at=now() where user_id=inv.user_id and id=inv.id;
   delete from pos_private.stock_permits where transaction_id=txid_current() and backend=pg_backend_pid() and owner_id=inv.user_id and item_id=inv.id;
   insert into public.inventory_events(user_id,inventory_item_id,event_type,source,related_entity_type,related_entity_id,quantity_before,quantity_change,quantity_after,previous_location_id,next_location_id,card_name,idempotency_key,metadata)
    values(inv.user_id,inv.id,'quantity_added','system','pos_refund',refund_id::text,inv.quantity,q,inv.quantity+q,inv.location_id,inv.location_id,inv.card_name,'pos-refund:'||refund_item::text,jsonb_build_object('actor_id',auth.uid(),'workspace_id',w,'sale_id',sale.id,'site_id',sess.site_id,'session_id',sess.id,'allocations',allocation_rows));
  end if;
 end loop;
 if not exists(select 1 from public.pos_tenders where sale_id=sale.id and method<>'cash') then
 insert into public.pos_cash_events(workspace_id,site_id,register_id,session_id,actor_id,kind,amount_minor,reference_id,reason)
  values(w,sess.site_id,sess.register_id,sess.id,auth.uid(),'CASH_REFUND',-(net_sum+tax_sum),refund_id,body->>'reason');
 end if;
 return jsonb_build_object('id',refund_id,'totalMinor',net_sum+tax_sum,'saleId',sale.id);
end $function$
;
