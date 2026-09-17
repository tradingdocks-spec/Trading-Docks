-- Production advisor follow-up: make public RPC execution explicit.
-- Trigger/internal helpers are not client APIs. User mutation RPCs and admin
-- RPCs remain callable by authenticated clients because their bodies enforce
-- ownership/capability checks. Apply only after staging verification.

-- Admin RPCs: authenticated is intentional; anon and PUBLIC are not.
revoke all on function public.admin_directory() from public, anon;
grant execute on function public.admin_directory() to authenticated;
revoke all on function public.admin_feedback_queue() from public, anon;
grant execute on function public.admin_feedback_queue() to authenticated;
revoke all on function public.admin_list_users(text, integer) from public, anon;
grant execute on function public.admin_list_users(text, integer) to authenticated;
revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;
revoke all on function public.admin_set_membership_override(uuid, text) from public, anon;
grant execute on function public.admin_set_membership_override(uuid, text) to authenticated;
revoke all on function public.admin_update_user_access(uuid, text, text) from public, anon;
grant execute on function public.admin_update_user_access(uuid, text, text) to authenticated;
revoke all on function public.current_admin_role() from public, anon;
grant execute on function public.current_admin_role() to authenticated;
revoke all on function public.is_admin(public.admin_role) from public, anon;
grant execute on function public.is_admin(public.admin_role) to authenticated;
revoke all on function public.is_platform_owner() from public, anon;
grant execute on function public.is_platform_owner() to authenticated;

-- Collector mutation RPCs: authenticated is intentional; each function
-- derives auth.uid() and checks ownership/capability in its body.
revoke all on function public.apply_collector_inventory_mutation(text, text, integer, text, text, text, text, public.inventory_event_source) from public, anon;
grant execute on function public.apply_collector_inventory_mutation(text, text, integer, text, text, text, text, public.inventory_event_source) to authenticated;
revoke all on function public.create_inventory_item_with_event(jsonb, public.inventory_event_source, text, text, text) from public, anon;
grant execute on function public.create_inventory_item_with_event(jsonb, public.inventory_event_source, text, text, text) to authenticated;
revoke all on function public.move_inventory_lot_quantity(text, integer, text, text, public.inventory_event_source) from public, anon;
grant execute on function public.move_inventory_lot_quantity(text, integer, text, text, public.inventory_event_source) to authenticated;
revoke all on function public.remove_inventory_lot_quantity(text, integer, text, text, public.inventory_event_source) from public, anon;
grant execute on function public.remove_inventory_lot_quantity(text, integer, text, text, public.inventory_event_source) to authenticated;

-- Trigger-only/internal helpers: no direct Data API execution.
revoke all on function public.collector_effective_membership_tier(uuid) from public, anon, authenticated;
revoke all on function public.enforce_collector_inventory_mutation() from public, anon, authenticated;
revoke all on function public.inventory_events_block_mutation() from public, anon, authenticated;
revoke all on function public.protect_platform_owner() from public, anon, authenticated;
revoke all on function public.inventory_event_text_value(jsonb) from public, anon, authenticated;
revoke all on function public.collector_inventory_error_payload(text, text, uuid) from public, anon, authenticated;
revoke all on function public.raise_collector_inventory_error(text, text, uuid) from public, anon, authenticated;
