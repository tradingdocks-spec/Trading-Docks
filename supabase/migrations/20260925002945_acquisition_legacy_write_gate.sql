-- Certification gate only: no historical rows or financial values are changed.
-- Legacy direct writers cannot safely finalize purchases. The reviewed intake
-- command remains the sole approved writer; read access remains RLS protected.
revoke insert, update, delete on public.purchase_ledger, public.purchase_ledger_lines,
 public.purchase_inventory_links from authenticated, anon;
do $$ begin
 if to_regclass('public.bulk_purchases') is not null then
  revoke insert, update, delete on public.bulk_purchases from authenticated, anon;
 end if;
end $$;

drop policy if exists acquisition_current_workspace on public.purchase_ledger;
create policy acquisition_current_workspace on public.purchase_ledger as restrictive for select to authenticated
 using(workspace_id=public.current_inventory_workspace());

-- Generic physical edits may not overwrite the acquisition cost/provenance
-- snapshot of an intake-linked lot. Pricing/condition/location remain separate.
create or replace function acquisition_private.preserve_receipt_cost() returns trigger
language plpgsql security definer set search_path='' as $$
declare k text;
begin
 if exists(select 1 from public.purchase_inventory_links l join public.purchase_ledger p on p.id=l.purchase_id
   where l.inventory_user_id=old.user_id and l.inventory_item_id=old.id and p.source_intake_id is not null) then
  foreach k in array array['costBasis','unitCost','totalCostBasis','purchaseLedgerId','purchaseLineId'] loop
   if new.data->k is distinct from old.data->k then
    raise exception 'ACQUISITION_COST_IMMUTABLE' using errcode='22023';
   end if;
  end loop;
 end if;
 return new;
end $$;
revoke all on function acquisition_private.preserve_receipt_cost() from public,anon,authenticated,service_role;
drop trigger if exists acquisition_preserve_receipt_cost on public.inventory_items;
create trigger acquisition_preserve_receipt_cost before update on public.inventory_items
 for each row execute function acquisition_private.preserve_receipt_cost();
notify pgrst,'reload schema';
