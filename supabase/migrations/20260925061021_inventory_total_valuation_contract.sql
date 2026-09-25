-- Forward-only total-row valuation. Existing numeric values and ledger history are not rewritten.
begin;
set local lock_timeout='5s';
alter table public.inventory_items alter column inventory_value drop not null;
alter table public.inventory_items alter column inventory_value drop default;
comment on column public.inventory_items.inventory_value is
'Total row/lot market value, not unit price, asking price or acquisition cost. NULL means unavailable. data.inventoryValueSemantics=total_row_v1 identifies forward-contract values; unmarked legacy amounts are ambiguous and excluded from trusted totals.';

do $repair$
declare definition text; original text; proc regprocedure;
begin
 proc:='public.finalize_intake_purchase(uuid,numeric,text,boolean,text)'::regprocedure;
 definition:=pg_get_functiondef(proc); original:=definition;
 definition:=replace(definition,'''inventory_value'',coalesce((line.details->>''unitMarketValueAtAgreement'')::numeric,0)',
   '''inventory_value'',round((line.details->>''unitMarketValueAtAgreement'')::numeric * line.quantity,2)');
 if definition=original then raise exception 'VALUATION_PREFLIGHT: receipt definition drift'; end if;
 execute definition;
 proc:='public.create_inventory_item_with_event(jsonb,public.inventory_event_source,text,text,text)'::regprocedure;
 definition:=pg_get_functiondef(proc); original:=definition;
 definition:=replace(definition,'coalesce(nullif(p_inventory ->> ''inventory_value'', '''')::numeric, 0)','nullif(p_inventory ->> ''inventory_value'', '''')::numeric');
 -- Metadata is added to the persisted row, never to the fingerprinted input command.
 definition:=replace(definition,E'    v_data,\n',E'    v_data || jsonb_build_object(''inventoryValueSemantics'',''total_row_v1''),\n');
 definition:=replace(definition,E'    v_item.inventory_value,\n    v_item.inventory_value * greatest(v_item.quantity, 0),',
   E'    v_item.inventory_value / nullif(v_item.quantity,0),\n    v_item.inventory_value,');
 if definition=original then raise exception 'VALUATION_PREFLIGHT: create definition drift'; end if;
 execute definition;
 proc:='public.apply_collector_inventory_mutation(text,text,integer,text,text,text,text,public.inventory_event_source)'::regprocedure;
 definition:=pg_get_functiondef(proc); original:=definition;
 definition:=replace(definition,'set quantity = v_quantity_after,',
 $q$set quantity = v_quantity_after,
        inventory_value = case when data->>'inventoryValueSemantics' = 'total_row_v1'
          then round(inventory_value / nullif(quantity,0) * v_quantity_after,2)
          else inventory_value end,$q$);
 definition:=replace(definition,E'    v_item.inventory_value,\n    case when v_item.inventory_value is null then null else v_item.inventory_value * greatest(v_quantity_after, 0) end,',
 E'    case when v_item.data->>''inventoryValueSemantics''=''total_row_v1'' then v_item.inventory_value / nullif(v_quantity_after,0) end,\n    case when v_item.data->>''inventoryValueSemantics''=''total_row_v1'' then v_item.inventory_value end,');
 if definition=original then raise exception 'VALUATION_PREFLIGHT: mutation definition drift'; end if;
 execute definition;
-- Split keeps unknown unknown in the destination; historical raw values are not backfilled.
 proc:=to_regprocedure('public.move_inventory_lot_quantity(text,integer,text,text,public.inventory_event_source)');
 if proc is not null then
  definition:=pg_get_functiondef(proc);
  definition:=replace(definition,'p_quantity, coalesce(v_destination_value, 0),','p_quantity, v_destination_value,');
  execute definition;
 end if;
 -- Existing Chaos writer already multiplies by quantity; only remove the invented zero.
 for proc in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace
   and proname like '%commit_chaos_sort_batch%' loop
  definition:=pg_get_functiondef(proc);
  definition:=replace(definition,'greatest(0, coalesce((item->>''marketPrice'')::numeric, 0) * item_quantity)',
    '((item->>''marketPrice'')::numeric * item_quantity)');
  definition:=replace(definition,'jsonb_build_object(''source'', ''chaos_sort'',',
    'jsonb_build_object(''inventoryValueSemantics'', ''total_row_v1'', ''source'', ''chaos_sort'',');
  definition:=replace(definition,'inventory_value = public.inventory_items.inventory_value + excluded.inventory_value',
    'inventory_value = case when public.inventory_items.data->>''inventoryValueSemantics''=''total_row_v1'' then public.inventory_items.inventory_value + excluded.inventory_value else null end');
  execute definition;
 end loop;
end $repair$;
commit;
