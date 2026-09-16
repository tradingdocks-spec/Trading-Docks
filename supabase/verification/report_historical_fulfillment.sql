-- READ ONLY. No repairs, backfills, marker changes, or stock adjustments.
-- Review preflight column compatibility first. Output contains record IDs only.
-- Absence of historical evidence does NOT prove that stock was never deducted.
begin transaction isolation level repeatable read read only;
set local statement_timeout = '60s';

with events as (
  select user_id,id,data->>'order_id' as order_id,data->>'orderLineId' as line_id,
    data->>'inventoryItemId' as inventory_id,
    case when data->>'quantity' ~ '^-?[0-9]+(\.[0-9]+)?$' then (data->>'quantity')::numeric end as delta
  from public.inventory_movements where data->>'action'='order_fulfilled'
), evidence as (
  select o.user_id,o.id as order_id,l.id as line_id,o.normalized_status,o.fulfillment_stage,
    l.inventory_item_id,l.quantity as ordered_quantity,l.inventory_deducted_at,
    i.quantity as current_inventory_quantity,i.id is not null as inventory_exists,
    case when i.data->>'quantity' ~ '^[0-9]+$' then (i.data->>'quantity')::numeric end as json_quantity,
    (select count(*) from events e where e.user_id=o.user_id and e.line_id=l.id::text) as line_event_count,
    (select sum(e.delta) from events e where e.user_id=o.user_id and e.line_id=l.id::text) as line_event_delta,
    (select count(*) from events e where e.user_id=o.user_id and e.order_id=o.id::text and e.line_id is null) as unallocated_legacy_events,
    exists(select 1 from events e where e.user_id=o.user_id and e.id='fulfillment:' || l.id::text
      and e.order_id=o.id::text and e.line_id=l.id::text and e.inventory_id=l.inventory_item_id and e.delta=-l.quantity) as exact_line_evidence
  from public.marketplace_orders o join public.marketplace_order_items l
    on l.marketplace_order_id=o.id and l.user_id=o.user_id
  left join public.inventory_items i on i.user_id=o.user_id and i.id=l.inventory_item_id
), flagged as (
  select *,array_remove(array[
    case when (normalized_status in ('shipped','delivered') or fulfillment_stage in ('shipped','completed'))
      and inventory_deducted_at is null then 'shipped_without_marker__deduction_unknown' end,
    case when inventory_deducted_at is not null and not exact_line_evidence then 'marker_without_exact_ledger__requires_reconciliation' end,
    case when line_event_count>1 then 'multiple_line_events__possible_duplicate_deduction' end,
    case when line_event_count>0 and line_event_delta is distinct from -ordered_quantity then 'line_event_quantity_mismatch' end,
    case when line_event_count>0 and inventory_deducted_at is null then 'ledger_without_deduction_marker' end,
    case when unallocated_legacy_events>0 then 'legacy_events_cannot_be_assigned_to_line' end,
    case when inventory_item_id is null then 'no_inventory_link' end,
    case when inventory_item_id is not null and not inventory_exists then 'linked_inventory_missing' end,
    case when json_quantity is not null and json_quantity<>current_inventory_quantity then 'inventory_column_json_mismatch' end,
    case when inventory_deducted_at is not null and normalized_status not in ('shipped','delivered','refunded')
      and fulfillment_stage not in ('shipped','completed') then 'deduction_on_unfulfilled_order' end
  ],null) as findings from evidence
)
select *, 'REVIEW_REQUIRED_NOT_AUTOMATIC_REPAIR' as disposition
from flagged where cardinality(findings)>0 order by user_id,order_id,line_id;

-- Aggregate evidence may identify a suspicious excess, but legacy events have
-- insufficient line provenance to prove a double deduction for a particular row.
with quantities as (
  select user_id,marketplace_order_id,sum(quantity) as ordered_units
  from public.marketplace_order_items group by user_id,marketplace_order_id
), movements as (
  select user_id,data->>'order_id' as order_id,count(*) as event_count,
    sum(case when data->>'quantity' ~ '^-[0-9]+(\.[0-9]+)?$' then -(data->>'quantity')::numeric else 0 end) as recorded_deducted_units
  from public.inventory_movements where data->>'action'='order_fulfilled' group by user_id,data->>'order_id'
)
select o.user_id,o.id as order_id,o.normalized_status,o.fulfillment_stage,
  coalesce(q.ordered_units,0) as ordered_units,coalesce(m.event_count,0) as event_count,
  coalesce(m.recorded_deducted_units,0) as recorded_deducted_units,
  case when q.marketplace_order_id is null then 'order_has_no_lines'
    when m.recorded_deducted_units>q.ordered_units then 'recorded_deductions_exceed_order__investigate'
    else 'shipped_order_has_no_ledger__deduction_unknown' end as finding
from public.marketplace_orders o left join quantities q on q.user_id=o.user_id and q.marketplace_order_id=o.id
left join movements m on m.user_id=o.user_id and m.order_id=o.id::text
where q.marketplace_order_id is null or m.recorded_deducted_units>q.ordered_units
  or ((o.normalized_status in ('shipped','delivered') or o.fulfillment_stage in ('shipped','completed')) and m.order_id is null)
order by o.user_id,o.id;

-- Provenance orphan check: do not print arbitrary event payloads or credentials.
select m.user_id,m.id as movement_id,m.data->>'order_id' as recorded_order_id,
  m.data->>'orderLineId' as recorded_line_id,'missing_order_or_line' as finding
from public.inventory_movements m
left join public.marketplace_orders o on o.user_id=m.user_id and o.id::text=m.data->>'order_id'
left join public.marketplace_order_items l on l.user_id=m.user_id and l.id::text=m.data->>'orderLineId'
where m.data->>'action'='order_fulfilled'
  and (o.id is null or (m.data->>'orderLineId' is not null and l.id is null))
order by m.user_id,m.id;

commit;
