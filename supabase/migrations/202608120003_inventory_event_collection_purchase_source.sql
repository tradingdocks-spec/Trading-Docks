-- Additive event source for collection-intake finalization.
-- Kept separate from the intake schema so the enum value is committed before
-- later functions use it.

alter type public.inventory_event_source add value if not exists 'collection_purchase';

do $$
begin
  perform pg_notify('pgrst', 'reload schema');
exception
  when undefined_function then
    null;
end $$;
