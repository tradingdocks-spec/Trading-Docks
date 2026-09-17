-- Production advisor follow-up: pin search_path for helper and trigger
-- functions. This changes function resolution only; it does not change
-- authorization or data semantics. Apply after staging verification.

alter function public.workspace_role_rank(text) set search_path = pg_catalog;
alter function public.set_tcgplayer_magic_catalog_updated_at() set search_path = pg_catalog;
alter function public.set_tcgtracking_updated_at() set search_path = pg_catalog;
alter function public.inventory_event_text_value(jsonb) set search_path = pg_catalog;
alter function public.collector_inventory_error_payload(text, text, uuid) set search_path = pg_catalog;
alter function public.raise_collector_inventory_error(text, text, uuid) set search_path = pg_catalog;
