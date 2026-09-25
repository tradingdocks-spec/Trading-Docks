-- Forward authority: existing purchase ledger owns finance; intake owns workflow.
-- Prerequisites: purchase ledger, enum inventory ledger/writer, active workspace authority.
-- Historical collection_purchases, if present, is left intact and is never written here.
create table if not exists public.collection_intakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete set null,
  title text not null default 'Collection intake',
  seller_name text not null default '',
  seller_contact text not null default '',
  status text not null default 'draft' check (
    status in ('draft', 'evaluating', 'offer_ready', 'purchased', 'declined', 'archived')
  ),
  scenario_key text not null default 'standard' check (
    scenario_key in ('conservative', 'standard', 'aggressive', 'custom')
  ),
  scenario jsonb not null default '{}'::jsonb,
  valuation jsonb not null default '{}'::jsonb,
  actual_offer numeric(14,2) check (actual_offer is null or actual_offer >= 0),
  notes text not null default '',
  completed_purchase_id uuid,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, idempotency_key)
);

create table if not exists public.collection_intake_items (
  id uuid primary key default gen_random_uuid(),
  intake_id uuid not null references public.collection_intakes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete set null,
  card_name text not null default '',
  game_id text not null default 'magic',
  product_type text not null default 'card' check (product_type in ('card', 'sealed', 'bulk')),
  set_code text,
  collector_number text,
  scryfall_id text,
  tcgplayer_product_id bigint,
  tcgplayer_sku_id bigint,
  condition text,
  finish text,
  language text not null default 'English',
  quantity integer not null default 1 check (quantity > 0),
  unit_market_value numeric(14,4) check (unit_market_value is null or unit_market_value >= 0),
  review_state text not null default 'ready' check (
    review_state in (
      'ready',
      'unresolved_identity',
      'ambiguous_printing',
      'unknown_condition',
      'unknown_finish',
      'missing_price',
      'high_value_confirmation'
    )
  ),
  allocated_total_cost numeric(14,2) check (allocated_total_cost is null or allocated_total_cost >= 0),
  allocated_unit_cost numeric(14,4) check (allocated_unit_cost is null or allocated_unit_cost >= 0),
  inventory_item_id text,
  source text not null default 'manual',
  notes text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, inventory_item_id)
    references public.inventory_items(user_id, id)
    on delete set null (inventory_item_id)
);

alter table public.collection_intakes add column if not exists revision integer not null default 0;
alter table public.collection_intakes add column if not exists purchase_ledger_id uuid references public.purchase_ledger(id) on delete restrict;
alter table public.collection_intake_items alter column language drop default;
alter table public.collection_intake_items alter column language drop not null;
alter table public.purchase_ledger add column if not exists source_intake_id uuid references public.collection_intakes(id) on delete restrict;
alter table public.purchase_ledger add column if not exists finalization_key text;
create unique index if not exists purchase_one_per_intake on public.purchase_ledger(source_intake_id) where source_intake_id is not null;
create unique index if not exists purchase_finalization_key on public.purchase_ledger(user_id,finalization_key) where finalization_key is not null;
create unique index if not exists intake_one_purchase on public.collection_intakes(purchase_ledger_id) where purchase_ledger_id is not null;
create index if not exists intake_items_parent on public.collection_intake_items(intake_id);

alter table public.collection_intakes enable row level security;
alter table public.collection_intake_items enable row level security;
-- All operational writes now go through the bounded commands below, even on
-- environments that previously installed the draft proposal's broad policies.
revoke all on public.collection_intakes,public.collection_intake_items from anon;
revoke insert,update,delete on public.collection_intakes,public.collection_intake_items from authenticated;
grant select on public.collection_intakes,public.collection_intake_items to authenticated;
drop policy if exists intake_owner_read on public.collection_intakes;
create policy intake_owner_read on public.collection_intakes for select to authenticated
 using(user_id=auth.uid() and workspace_id=public.current_inventory_workspace());
drop policy if exists intake_owner_boundary on public.collection_intakes;
create policy intake_owner_boundary on public.collection_intakes as restrictive for select to authenticated
 using(user_id=auth.uid() and workspace_id=public.current_inventory_workspace());
drop policy if exists intake_item_owner_read on public.collection_intake_items;
create policy intake_item_owner_read on public.collection_intake_items for select to authenticated
 using(user_id=auth.uid() and workspace_id=public.current_inventory_workspace());
drop policy if exists intake_item_owner_boundary on public.collection_intake_items;
create policy intake_item_owner_boundary on public.collection_intake_items as restrictive for select to authenticated
 using(user_id=auth.uid() and workspace_id=public.current_inventory_workspace());

-- Keep legacy manual-ledger behavior; protect only purchases created by this
-- authority from direct edits/deletes and cross-workspace reads.
drop policy if exists intake_purchase_boundary on public.purchase_ledger;
create policy intake_purchase_boundary on public.purchase_ledger as restrictive for all to authenticated
 using(source_intake_id is null or (user_id=auth.uid() and workspace_id=public.current_inventory_workspace()))
 with check(source_intake_id is null);
drop policy if exists intake_purchase_no_delete on public.purchase_ledger;
create policy intake_purchase_no_delete on public.purchase_ledger as restrictive for delete to authenticated using(source_intake_id is null);
drop policy if exists intake_purchase_no_update on public.purchase_ledger;
create policy intake_purchase_no_update on public.purchase_ledger as restrictive for update to authenticated using(source_intake_id is null);
-- Subquery sees only authorized purchase rows; absent/inaccessible is denied.
do $policies$
declare tab text; cmd text;
begin
 foreach tab in array array['purchase_ledger_lines','purchase_inventory_links'] loop
  foreach cmd in array array['insert','update','delete'] loop
   execute format('drop policy if exists intake_finance_%s on public.%I',cmd,tab);
   execute format('create policy intake_finance_%s on public.%I as restrictive for %s to authenticated %s',cmd,tab,cmd,
    case when cmd='insert' then 'with check' else 'using' end ||
    ' (exists(select 1 from public.purchase_ledger p where p.id=purchase_id and p.source_intake_id is null))');
  end loop;
 end loop;
end $policies$;

create schema if not exists acquisition_private;
revoke all on schema acquisition_private from public,anon,authenticated,service_role;
create or replace function acquisition_private.workspace() returns uuid
language plpgsql security definer set search_path='' as $$
declare w uuid;
begin
 if auth.uid() is null then raise exception 'ACQUISITION_UNAUTHORIZED' using errcode='42501'; end if;
 w:=public.current_inventory_workspace();
 if not exists(select 1 from public.workspace_members m join auth.users u on u.id=m.user_id
   where m.workspace_id=w and m.user_id=auth.uid() and m.role in ('owner','admin','manager')
    and (u.banned_until is null or u.banned_until<now())) then
  raise exception 'ACQUISITION_UNAUTHORIZED' using errcode='42501';
 end if;
 return w;
end $$;

create or replace function public.save_collection_intake(p_intake jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare w uuid:=acquisition_private.workspace(); actor uuid:=auth.uid(); ident uuid:=(p_intake->>'id')::uuid;
 old public.collection_intakes%rowtype; item jsonb; ids uuid[]:='{}'; line_id uuid; next_revision integer;
begin
 if ident is null or jsonb_typeof(p_intake->'items') is distinct from 'array' or jsonb_array_length(p_intake->'items')>1000
  or coalesce(p_intake->>'status','') not in ('draft','evaluating','offer_ready','declined','archived') then
  raise exception 'INTAKE_INVALID_INPUT' using errcode='22023';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(ident::text,0));
 select * into old from public.collection_intakes where id=ident for update;
 if found then
  if old.user_id<>actor or old.workspace_id is distinct from w then raise exception 'INTAKE_FORBIDDEN' using errcode='42501'; end if;
  if old.status='purchased' or old.purchase_ledger_id is not null or old.completed_purchase_id is not null then raise exception 'INTAKE_FINALIZED'; end if;
  if old.revision is distinct from (p_intake->>'revision')::integer then raise exception 'INTAKE_REVISION_CONFLICT' using errcode='40001'; end if;
 else
  if coalesce((p_intake->>'revision')::integer,0)<>0 then raise exception 'INTAKE_REVISION_CONFLICT' using errcode='40001'; end if;
 end if;
 next_revision:=coalesce(old.revision,0)+1;
 insert into public.collection_intakes(id,user_id,workspace_id,title,seller_name,seller_contact,status,scenario_key,scenario,valuation,actual_offer,notes,revision)
 values(ident,actor,w,coalesce(p_intake->>'title','Collection intake'),coalesce(p_intake->>'sellerName',''),coalesce(p_intake->>'sellerContact',''),
 p_intake->>'status',coalesce(p_intake->>'scenarioKey','standard'),coalesce(p_intake->'scenario','{}'),coalesce(p_intake->'valuation','{}'),
 (p_intake->>'actualOffer')::numeric,coalesce(p_intake->>'notes',''),next_revision)
 on conflict(id) do update set title=excluded.title,seller_name=excluded.seller_name,seller_contact=excluded.seller_contact,status=excluded.status,
 scenario_key=excluded.scenario_key,scenario=excluded.scenario,valuation=excluded.valuation,actual_offer=excluded.actual_offer,notes=excluded.notes,revision=next_revision,updated_at=now();
 for item in select value from jsonb_array_elements(p_intake->'items') loop
  line_id:=(item->>'id')::uuid;
  if line_id is null or line_id=any(ids) then raise exception 'INTAKE_INVALID_LINE_ID'; end if;
  if exists(select 1 from public.collection_intake_items where id=line_id and intake_id<>ident) then raise exception 'INTAKE_INVALID_LINE_ID'; end if;
  ids:=array_append(ids,line_id);
  insert into public.collection_intake_items(id,intake_id,user_id,workspace_id,card_name,game_id,product_type,set_code,collector_number,scryfall_id,
   tcgplayer_product_id,tcgplayer_sku_id,condition,finish,language,quantity,unit_market_value,review_state,notes)
  values(line_id,ident,actor,w,coalesce(item->>'cardName',''),coalesce(item->>'gameId',''),coalesce(item->>'productType','card'),
   nullif(item->>'setCode',''),nullif(item->>'collectorNumber',''),nullif(item->>'scryfallId',''),(item->>'tcgplayerProductId')::bigint,
   (item->>'tcgplayerSkuId')::bigint,nullif(item->>'condition',''),nullif(item->>'finish',''),nullif(item->>'language',''),
   (item->>'quantity')::integer,(item->>'unitMarketValue')::numeric,coalesce(item->>'reviewState','unresolved_identity'),coalesce(item->>'notes',''))
  on conflict(id) do update set card_name=excluded.card_name,game_id=excluded.game_id,product_type=excluded.product_type,set_code=excluded.set_code,
   collector_number=excluded.collector_number,scryfall_id=excluded.scryfall_id,tcgplayer_product_id=excluded.tcgplayer_product_id,tcgplayer_sku_id=excluded.tcgplayer_sku_id,
   condition=excluded.condition,finish=excluded.finish,language=excluded.language,quantity=excluded.quantity,unit_market_value=excluded.unit_market_value,
   review_state=excluded.review_state,notes=excluded.notes,updated_at=now();
 end loop;
 delete from public.collection_intake_items where intake_id=ident and not(id=any(ids));
 return jsonb_build_object('intakeId',ident,'revision',next_revision,'itemCount',cardinality(ids),'valuation',p_intake->'valuation');
end $$;

create or replace function public.finalize_intake_purchase(p_intake_id uuid,p_actual_offer numeric,p_idempotency_key text,
 p_receive_now boolean default true,p_location_id text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare w uuid:=acquisition_private.workspace(); actor uuid:=auth.uid(); intake public.collection_intakes%rowtype;
 purchase public.purchase_ledger%rowtype; item public.collection_intake_items%rowtype; line public.purchase_ledger_lines%rowtype;
 stock public.inventory_items%rowtype; total_market numeric; allocated numeric:=0; amount numeric; unit_cost numeric;
 n integer; units integer; idx integer:=0; stage text:='validate'; results jsonb:='[]'; already boolean:=false;
begin
 if p_actual_offer is null or p_actual_offer::text in ('NaN','Infinity','-Infinity') or p_actual_offer<0
  or p_actual_offer>999999999999.99 or p_actual_offer<>round(p_actual_offer,2) or length(coalesce(p_idempotency_key,'')) not between 1 and 200
  or p_receive_now is null then raise exception 'ACQUISITION_INVALID_INPUT' using errcode='22023'; end if;
 select * into intake from public.collection_intakes where id=p_intake_id for update;
 if not found or intake.user_id<>actor or intake.workspace_id is distinct from w then raise exception 'INTAKE_FORBIDDEN' using errcode='42501'; end if;
 select * into purchase from public.purchase_ledger where source_intake_id=intake.id for update;
 if found then
  if purchase.total_cost<>p_actual_offer or purchase.finalization_key<>p_idempotency_key then raise exception 'ACQUISITION_REQUEST_CONFLICT' using errcode='22023'; end if;
  already:=true;
 else
  if intake.status not in ('evaluating','offer_ready') or intake.completed_purchase_id is not null then raise exception 'INTAKE_NOT_PURCHASABLE'; end if;
  perform 1 from public.collection_intake_items where intake_id=intake.id order by id for update;
  select count(*),sum(quantity),sum(unit_market_value*quantity) into n,units,total_market from public.collection_intake_items where intake_id=intake.id;
  if n=0 or n>1000 then raise exception 'INTAKE_EMPTY_OR_TOO_LARGE'; end if;
  if exists(select 1 from public.collection_intake_items i where i.intake_id=intake.id and
    (i.user_id<>actor or i.workspace_id is distinct from w or i.review_state not in ('ready','missing_price') or
     nullif(trim(i.card_name),'') is null or nullif(trim(i.game_id),'') is null or nullif(trim(i.condition),'') is null or
     nullif(trim(i.finish),'') is null or nullif(trim(i.language),'') is null or
     (nullif(i.scryfall_id,'') is null and i.tcgplayer_sku_id is null and (nullif(i.set_code,'') is null or nullif(i.collector_number,'') is null)) or
     i.unit_market_value::text in ('NaN','Infinity','-Infinity'))) then raise exception 'INTAKE_REVIEW_REQUIRED'; end if;
  -- Existing proportional-market allocation, never current market prices. Do
  -- not invent a zero cost for an unpriced line in a paid collection purchase.
  if p_actual_offer>0 and (total_market is null or total_market<=0 or exists(select 1 from public.collection_intake_items
    where intake_id=intake.id and coalesce(unit_market_value,0)<=0)) then raise exception 'ACQUISITION_ALLOCATION_REVIEW_REQUIRED'; end if;
  stage:='purchase';
  insert into public.purchase_ledger(user_id,workspace_id,source_type,seller_name,status,payment_method,subtotal,total_cost,item_count,unit_count,
   created_by,purchased_at,source_intake_id,finalization_key,details)
  values(actor,w,'collection_buying',intake.seller_name,'completed','unknown',p_actual_offer,p_actual_offer,n,units,actor,now(),intake.id,p_idempotency_key,
   jsonb_build_object('authority','intake_v1','costAllocationMethod','proportional_market_value','intakeRevision',intake.revision,
    'valuationAtAgreement',intake.valuation,'scenarioAtAgreement',intake.scenario)) returning * into purchase;
  for item in select * from public.collection_intake_items where intake_id=intake.id order by created_at,id loop
   idx:=idx+1;
   amount:=case when p_actual_offer=0 then 0 when idx=n then p_actual_offer-allocated else round(p_actual_offer*(item.unit_market_value*item.quantity/total_market),2) end;
   if amount<0 then raise exception 'ACQUISITION_ALLOCATION_REVIEW_REQUIRED'; end if;
   allocated:=allocated+amount; unit_cost:=round(amount/item.quantity,4);
   stage:='purchase_line';
   insert into public.purchase_ledger_lines(purchase_id,line_type,description,quantity,unit_count,unit_cost,total_cost,details)
   values(purchase.id,'collection_intake',item.card_name,item.quantity,item.quantity,unit_cost,amount,
    jsonb_build_object('intakeItemId',item.id,'gameId',item.game_id,'productType',item.product_type,'scryfallId',item.scryfall_id,
    'tcgplayerProductId',item.tcgplayer_product_id,'tcgplayerSkuId',item.tcgplayer_sku_id,'setCode',item.set_code,'collectorNumber',item.collector_number,
    'condition',item.condition,'finish',item.finish,'language',item.language,'unitMarketValueAtAgreement',item.unit_market_value,'reviewState',item.review_state));
  end loop;
  update public.collection_intakes set status='purchased',purchase_ledger_id=purchase.id,actual_offer=p_actual_offer,completed_at=now(),updated_at=now() where id=intake.id;
 end if;
 if purchase.status not in ('completed','received') then raise exception 'ACQUISITION_INVALID_STATE'; end if;
 if purchase.status='received' and p_receive_now and purchase.details->>'receiptLocationId' is distinct from p_location_id then raise exception 'ACQUISITION_RECEIPT_CONFLICT'; end if;
 if p_receive_now and purchase.status='completed' then
  stage:='location';
  if p_location_id is not null and not exists(select 1 from public.inventory_locations l where l.id=p_location_id and l.user_id=actor) then raise exception 'ACQUISITION_INVALID_LOCATION'; end if;
  for line in select * from public.purchase_ledger_lines where purchase_id=purchase.id order by id loop
   stage:='inventory';
   stock:=public.create_inventory_item_with_event(jsonb_build_object('id',line.id::text,'workspace_id',w,'card_name',line.description,'sku','purchase:'||line.id,
    'location_id',p_location_id,'quantity',line.quantity,'inventory_value',coalesce((line.details->>'unitMarketValueAtAgreement')::numeric,0),
    'game_id',line.details->>'gameId','product_type',line.details->>'productType','scryfall_id',line.details->>'scryfallId',
    'tcgplayer_product_id',line.details->>'tcgplayerProductId','tcgplayer_sku_id',line.details->>'tcgplayerSkuId',
    'set_code',line.details->>'setCode','collector_number',line.details->>'collectorNumber','variant',line.details->>'finish','language',line.details->>'language',
    'data',line.details||jsonb_build_object('costBasis',line.unit_cost,'totalCostBasis',line.total_cost,'purchaseLedgerId',purchase.id,'purchaseLineId',line.id)),
    'purchasing_intelligence'::public.inventory_event_source,'purchase-receipt:'||line.id,'purchase_ledger',purchase.id::text);
   stage:='inventory_link';
   insert into public.purchase_inventory_links(purchase_id,purchase_line_id,inventory_user_id,inventory_item_id,quantity,cost_basis)
    values(purchase.id,line.id,actor,stock.id,line.quantity,line.total_cost);
   update public.purchase_ledger_lines set inventory_item_id=stock.id where id=line.id;
   update public.collection_intake_items set inventory_item_id=stock.id,allocated_total_cost=line.total_cost,allocated_unit_cost=line.unit_cost
    where id=(line.details->>'intakeItemId')::uuid and intake_id=intake.id;
  end loop;
  stage:='received';
  update public.purchase_ledger set status='received',received_at=now(),details=details||jsonb_build_object('receiptLocationId',p_location_id)
    where id=purchase.id returning * into purchase;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('purchaseLineId',id,'inventoryItemId',inventory_item_id,'quantity',quantity,
   'status',case when inventory_item_id is null then 'AWAITING_RECEIPT' else 'SUCCESS' end) order by id),'[]') into results
   from public.purchase_ledger_lines where purchase_id=purchase.id;
 return jsonb_build_object('ok',true,'purchaseId',purchase.id,'status',purchase.status,'alreadyCompleted',already,'items',results);
exception when others then
 -- Transaction rollback retains no partial business effects. Diagnostic has no
 -- seller, card, monetary input, token or provider response.
 raise log 'acquisition_failure stage=% sqlstate=%',stage,sqlstate;
 raise;
end $$;

-- Preserve the established API name, with exactly one implementation.
create or replace function public.complete_collection_intake(p_intake_id uuid,p_actual_offer numeric,p_idempotency_key text default null)
returns jsonb language sql security invoker set search_path='' as $$
 select public.finalize_intake_purchase(p_intake_id,p_actual_offer,coalesce(p_idempotency_key,'collection-intake:'||p_intake_id),true,null)
$$;
revoke all on all functions in schema acquisition_private from public,anon,authenticated,service_role;
revoke all on function public.save_collection_intake(jsonb),public.finalize_intake_purchase(uuid,numeric,text,boolean,text),public.complete_collection_intake(uuid,numeric,text) from public,anon,service_role;
grant execute on function public.save_collection_intake(jsonb),public.finalize_intake_purchase(uuid,numeric,text,boolean,text),public.complete_collection_intake(uuid,numeric,text) to authenticated;
notify pgrst,'reload schema';
