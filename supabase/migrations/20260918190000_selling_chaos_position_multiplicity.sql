-- Corrective staging-safe migration for Selling provenance.
-- A single inventory item may occupy multiple physical positions in one
-- Chaos Sort batch. The position id remains the physical identity.

alter table public.chaos_sort_inventory_positions
  drop constraint if exists chaos_sort_inventory_positions_user_id_batch_id_item_id_key;

create index if not exists chaos_sort_positions_user_batch_item_idx
  on public.chaos_sort_inventory_positions(user_id, batch_id, item_id, position);
