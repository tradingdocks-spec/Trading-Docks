# Cloud tenant table and policy inventory

Read-only production catalog snapshot, 2026-09-24 UTC. Aggregate metadata only.

`—` means no direct workspace column: scope must derive from a parent or remains owner/account/global scoped. Zero nulls does not prove active-workspace isolation. Permissive policies combine with OR. Grants and SECURITY DEFINER authorization must also be considered.

| Table | Rows | Workspace column | Owner column | Workspace FK | Missing | Orphan | RLS | Auth SELECT/INSERT/UPDATE |
|---|---:|---|---|---|---:|---:|---|---|
| chaos_scan_private.batch_counters | 1 | — | owner_id | — | — | — | off | no/no/no |
| pos_private.approval_uses | 0 | — | parent/global | — | — | — | on | no/no/no |
| pos_private.label_tombstones | 0 | workspace_id NOT NULL | inventory_user_id | — | 0 | 0 | on | no/no/no |
| pos_private.mock_payments | 0 | — | parent/global | — | — | — | on | no/no/no |
| pos_private.mock_refunds | 0 | — | parent/global | — | — | — | on | no/no/no |
| pos_private.payment_context | 0 | — | parent/global | — | — | — | on | no/no/no |
| pos_private.payment_test_config | 0 | — | parent/global | — | — | — | on | no/no/no |
| pos_private.request_limits | 4 | — | parent/global | — | — | — | on | no/no/no |
| pos_private.square_connections | 0 | workspace_id NOT NULL | parent/global | yes | 0 | 0 | on | no/no/no |
| pos_private.square_credentials | 0 | — | parent/global | — | — | — | on | no/no/no |
| pos_private.square_device_codes | 0 | — | parent/global | — | — | — | on | no/no/no |
| pos_private.square_events | 0 | — | parent/global | — | — | — | on | no/no/no |
| pos_private.square_hardware_audit | 0 | workspace_id NOT NULL | parent/global | — | 0 | 0 | on | no/no/no |
| pos_private.square_locations | 0 | — | parent/global | — | — | — | on | no/no/no |
| pos_private.square_mappings | 0 | workspace_id NOT NULL | parent/global | — | 0 | 0 | on | no/no/no |
| pos_private.square_oauth | 0 | workspace_id NOT NULL | parent/global | yes | 0 | 0 | on | no/no/no |
| pos_private.square_observations | 0 | — | parent/global | — | — | — | on | no/no/no |
| pos_private.square_refund_observations | 0 | — | parent/global | — | — | — | on | no/no/no |
| pos_private.square_terminal_attempts | 0 | — | parent/global | — | — | — | on | no/no/no |
| pos_private.square_terminal_refunds | 0 | — | parent/global | — | — | — | on | no/no/no |
| pos_private.stock_permits | 0 | — | owner_id | — | — | — | on | no/no/no |
| public.account_documents | 9 | — | user_id | — | — | — | on | yes/yes/yes |
| public.binder_card_trade_status | 0 | — | user_id | — | — | — | on | yes/yes/yes |
| public.card_scan_sessions | 0 | workspace_id NOT NULL | parent/global | yes | 0 | 0 | on | yes/yes/yes |
| public.chaos_scan_albums | 1 | workspace_id NOT NULL | user_id | yes | 0 | 0 | on | yes/no/no |
| public.chaos_scan_captures | 0 | — | user_id | — | — | — | on | yes/no/no |
| public.chaos_sort_batches | 23 | workspace_id nullable | user_id | yes | 22 | 0 | on | yes/no/no |
| public.chaos_sort_inventory_positions | 1488 | — | user_id | — | — | — | on | yes/yes/yes |
| public.chaos_sort_items | 0 | — | user_id | — | — | — | on | yes/yes/yes |
| public.chaos_sort_rules | 0 | — | user_id | — | — | — | on | yes/yes/yes |
| public.chaos_sort_sessions | 22 | — | user_id | — | — | — | on | yes/yes/yes |
| public.collector_wishlist | 0 | — | user_id | — | — | — | on | yes/yes/yes |
| public.deck_vault_inventory_links | 0 | — | parent/global | — | — | — | on | yes/yes/yes |
| public.inventory_barcode_aliases | 0 | workspace_id NOT NULL | inventory_user_id | yes | 0 | 0 | on | no/no/no |
| public.inventory_events | 1563 | workspace_id nullable | user_id | yes | 1534 | 0 | on | yes/no/no |
| public.inventory_items | 1515 | workspace_id nullable | user_id | yes | 0 | 0 | on | yes/yes/yes |
| public.inventory_label_identities | 26 | workspace_id NOT NULL | inventory_user_id | yes | 0 | 0 | on | yes/yes/yes |
| public.inventory_locations | 5 | — | user_id | — | — | — | on | yes/yes/yes |
| public.inventory_movements | 0 | — | user_id | — | — | — | on | yes/yes/yes |
| public.inventory_price_reviews | 0 | workspace_id NOT NULL | inventory_user_id | yes | 0 | 0 | on | yes/yes/yes |
| public.label_migration_audit | 25 | workspace_id nullable | user_id | yes | 0 | 0 | on | yes/yes/yes |
| public.label_print_jobs | 2 | workspace_id NOT NULL | parent/global | yes | 0 | 0 | on | yes/yes/yes |
| public.label_templates | 0 | workspace_id NOT NULL | parent/global | yes | 0 | 0 | on | yes/yes/yes |
| public.marketplace_connections | 3 | — | user_id | — | — | — | on | yes/yes/yes |
| public.marketplace_credentials | 2 | — | user_id | — | — | — | on | yes/yes/yes |
| public.marketplace_listing_mappings | 382 | — | user_id | — | — | — | on | yes/yes/yes |
| public.marketplace_oauth_tokens | 1 | — | user_id | — | — | — | on | no/no/no |
| public.marketplace_order_items | 121 | — | user_id | — | — | — | on | yes/yes/yes |
| public.marketplace_orders | 257 | — | user_id | — | — | — | on | yes/yes/yes |
| public.marketplace_sync_changes | 0 | — | user_id | — | — | — | on | yes/yes/yes |
| public.marketplace_sync_runs | 5 | — | user_id | — | — | — | on | yes/yes/yes |
| public.order_fulfillment_actions | 0 | workspace_id nullable | user_id | yes | 0 | 0 | on | yes/yes/yes |
| public.order_shipment_events | 0 | workspace_id nullable | user_id | yes | 0 | 0 | on | yes/yes/yes |
| public.order_shipments | 0 | workspace_id nullable | user_id | yes | 0 | 0 | on | yes/yes/yes |
| public.portfolio_binders | 0 | — | user_id | — | — | — | on | yes/yes/yes |
| public.portfolio_featured_cards | 0 | — | user_id | — | — | — | on | yes/yes/yes |
| public.portfolio_story_events | 0 | — | user_id | — | — | — | on | yes/yes/yes |
| public.pos_access_events | 0 | workspace_id NOT NULL | parent/global | yes | 0 | 0 | on | no/no/no |
| public.pos_approval_decisions | 0 | — | parent/global | — | — | — | on | no/no/no |
| public.pos_approval_requests | 0 | workspace_id NOT NULL | parent/global | — | 0 | 0 | on | no/no/no |
| public.pos_cash_events | 14 | workspace_id NOT NULL | parent/global | — | 0 | 0 | on | no/no/no |
| public.pos_checkout_cancellations | 0 | workspace_id NOT NULL | parent/global | yes | 0 | 0 | on | no/no/no |
| public.pos_inventory_delegations | 0 | workspace_id NOT NULL | inventory_user_id, employee_id | — | 0 | 0 | on | no/no/no |
| public.pos_location_inventory_locations | 1 | workspace_id NOT NULL | inventory_user_id | — | 0 | 0 | on | no/no/no |
| public.pos_operation_receipts | 17 | workspace_id NOT NULL | parent/global | yes | 0 | 0 | on | no/no/no |
| public.pos_payment_attempts | 0 | workspace_id NOT NULL | parent/global | — | 0 | 0 | on | no/no/no |
| public.pos_payment_audit | 0 | workspace_id NOT NULL | parent/global | — | 0 | 0 | on | no/no/no |
| public.pos_payment_checkouts | 0 | workspace_id NOT NULL | parent/global | — | 0 | 0 | on | no/no/no |
| public.pos_payment_devices | 0 | workspace_id NOT NULL | parent/global | — | 0 | 0 | on | no/no/no |
| public.pos_payment_events | 0 | workspace_id NOT NULL | parent/global | — | 0 | 0 | on | no/no/no |
| public.pos_payment_refund_attempts | 0 | workspace_id NOT NULL | parent/global | — | 0 | 0 | on | no/no/no |
| public.pos_refund_items | 2 | — | parent/global | — | — | — | on | no/no/no |
| public.pos_refunds | 2 | workspace_id NOT NULL | parent/global | — | 0 | 0 | on | no/no/no |
| public.pos_register_sessions | 3 | workspace_id NOT NULL | parent/global | — | 0 | 0 | on | no/no/no |
| public.pos_registers | 1 | workspace_id NOT NULL | parent/global | — | 0 | 0 | on | no/no/no |
| public.pos_sale_allocations | 7 | workspace_id NOT NULL | inventory_user_id | — | 0 | 0 | on | no/no/no |
| public.pos_sale_items | 7 | workspace_id NOT NULL | inventory_user_id | — | 0 | 0 | on | no/no/no |
| public.pos_sales | 6 | workspace_id NOT NULL | parent/global | — | 0 | 0 | on | no/no/no |
| public.pos_store_locations | 1 | workspace_id NOT NULL | inventory_user_id | yes | 0 | 0 | on | no/no/no |
| public.pos_tenders | 6 | workspace_id NOT NULL | parent/global | — | 0 | 0 | on | no/no/no |
| public.pos_workspace_settings | 1 | workspace_id NOT NULL | parent/global | yes | 0 | 0 | on | no/no/no |
| public.purchase_inventory_links | 0 | — | inventory_user_id | — | — | — | on | yes/yes/yes |
| public.purchase_ledger | 0 | workspace_id nullable | user_id | yes | 0 | 0 | on | yes/yes/yes |
| public.purchase_ledger_lines | 0 | — | parent/global | — | — | — | on | yes/yes/yes |
| public.selling_inventory_allocations | 0 | workspace_id nullable | user_id | yes | 0 | 0 | on | yes/yes/yes |
| public.selling_listing_batches | 0 | workspace_id nullable | user_id | yes | 0 | 0 | on | yes/yes/yes |
| public.selling_listing_candidates | 0 | workspace_id nullable | user_id | yes | 0 | 0 | on | yes/yes/yes |
| public.selling_marketplace_listings | 0 | workspace_id nullable | user_id | yes | 0 | 0 | on | yes/yes/yes |
| public.selling_marketplace_operations | 0 | workspace_id nullable | user_id | yes | 0 | 0 | on | yes/yes/yes |
| public.selling_marketplace_settings | 0 | workspace_id nullable | user_id | yes | 0 | 0 | on | yes/yes/yes |
| public.selling_sync_events | 0 | workspace_id nullable | user_id | yes | 0 | 0 | on | yes/yes/yes |
| public.showcase_events | 75 | workspace_id NOT NULL | parent/global | yes | 0 | 0 | on | yes/yes/yes |
| public.showcase_inventory_reservations | 0 | workspace_id NOT NULL | parent/global | yes | 0 | 0 | on | yes/yes/yes |
| public.showcase_kiosk_devices | 7 | workspace_id NOT NULL | parent/global | yes | 0 | 0 | on | yes/yes/yes |
| public.showcase_kiosk_pairing_codes | 5 | workspace_id NOT NULL | parent/global | yes | 0 | 0 | on | yes/yes/yes |
| public.showcase_profiles | 1 | workspace_id NOT NULL | parent/global | yes | 0 | 0 | on | yes/yes/yes |
| public.showcase_request_items | 0 | — | parent/global | — | — | — | on | yes/yes/yes |
| public.showcase_requests | 0 | workspace_id NOT NULL | parent/global | yes | 0 | 0 | on | yes/yes/yes |
| public.tcgplayer_magic_catalog | 799149 | — | parent/global | — | — | — | on | no/no/no |
| public.tcgplayer_magic_catalog_imports | 10 | — | parent/global | — | — | — | on | no/no/no |
| public.tcgtracking_price_snapshots | 50 | — | parent/global | — | — | — | on | no/no/no |
| public.tcgtracking_product_mappings | 120 | — | parent/global | — | — | — | on | no/no/no |
| public.tcgtracking_sync_runs | 2 | — | parent/global | — | — | — | on | no/no/no |
| public.user_preferences | 5 | — | user_id | yes | — | — | on | yes/yes/yes |
| public.workspace_documents | 14 | workspace_id NOT NULL | user_id | yes | 0 | 0 | on | yes/yes/yes |
| public.workspace_employees | 0 | workspace_id NOT NULL | linked_user_id | yes | 0 | 0 | on | yes/yes/yes |
| public.workspace_members | 5 | workspace_id NOT NULL | user_id | yes | 0 | 0 | on | yes/yes/yes |
| public.workspace_shipping_profiles | 0 | workspace_id nullable | user_id | yes | 0 | 0 | on | yes/yes/yes |
| public.workspaces | 5 | — | owner_id | — | — | — | on | yes/yes/yes |
| storage.buckets | 4 | — | owner_id | — | — | — | on | yes/yes/yes |
| storage.objects | 31 | — | owner_id | — | — | — | on | yes/yes/yes |

## Exact authorization rules

### chaos_scan_private.batch_counters

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### pos_private.approval_uses

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### pos_private.label_tombstones

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### pos_private.mock_payments

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### pos_private.mock_refunds

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### pos_private.payment_context

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### pos_private.payment_test_config

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### pos_private.request_limits

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### pos_private.square_connections

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### pos_private.square_credentials

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### pos_private.square_device_codes

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### pos_private.square_events

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### pos_private.square_hardware_audit

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### pos_private.square_locations

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### pos_private.square_mappings

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### pos_private.square_oauth

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### pos_private.square_observations

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### pos_private.square_refund_observations

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### pos_private.square_terminal_attempts

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### pos_private.square_terminal_refunds

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### pos_private.stock_permits

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### public.account_documents

- **Users manage their own account documents** — PERMISSIVE; ALL; roles: authenticated.

```sql
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id)
```

### public.binder_card_trade_status

- **binder_trade_status_owner_all** — PERMISSIVE; ALL; roles: public.

```sql
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id)
```

### public.card_scan_sessions

- **workspace members can create card scans** — PERMISSIVE; INSERT; roles: public.

```sql
USING (not specified)
WITH CHECK (EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = card_scan_sessions.workspace_id) AND (wm.user_id = auth.uid()))))
```

- **workspace members can view card scans** — PERMISSIVE; SELECT; roles: public.

```sql
USING (EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = card_scan_sessions.workspace_id) AND (wm.user_id = auth.uid()))))
WITH CHECK (not specified)
```

### public.chaos_scan_albums

- **chaos_scan_album_owner** — PERMISSIVE; SELECT; roles: authenticated.

```sql
USING ((user_id = ( SELECT auth.uid() AS uid)) AND (workspace_id = ( SELECT user_preferences.active_workspace_id
   FROM user_preferences
  WHERE (user_preferences.user_id = ( SELECT auth.uid() AS uid)))) AND (EXISTS ( SELECT 1
   FROM workspaces w
  WHERE ((w.id = chaos_scan_albums.workspace_id) AND (w.owner_id = ( SELECT auth.uid() AS uid))))))
WITH CHECK (not specified)
```

### public.chaos_scan_captures

- **chaos_scan_capture_owner** — PERMISSIVE; SELECT; roles: authenticated.

```sql
USING ((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM chaos_scan_albums a
  WHERE (a.id = chaos_scan_captures.album_id))))
WITH CHECK (not specified)
```

### public.chaos_sort_batches

- **Users create their chaos sort batches** — PERMISSIVE; INSERT; roles: authenticated.

```sql
USING (not specified)
WITH CHECK (user_id = auth.uid())
```

- **Users manage their chaos sort batches** — PERMISSIVE; UPDATE; roles: authenticated.

```sql
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid())
```

- **Users view their chaos sort batches** — PERMISSIVE; SELECT; roles: authenticated.

```sql
USING (user_id = auth.uid())
WITH CHECK (not specified)
```

### public.chaos_sort_inventory_positions

- **Users manage their chaos sort positions** — PERMISSIVE; ALL; roles: authenticated.

```sql
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid())
```

### public.chaos_sort_items

- **Users manage their chaos sort items** — PERMISSIVE; ALL; roles: authenticated.

```sql
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid())
```

- **Users view their chaos sort items** — PERMISSIVE; SELECT; roles: authenticated.

```sql
USING (user_id = auth.uid())
WITH CHECK (not specified)
```

### public.chaos_sort_rules

- **Users manage their chaos sort rules** — PERMISSIVE; ALL; roles: authenticated.

```sql
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid())
```

- **Users view their chaos sort rules** — PERMISSIVE; SELECT; roles: authenticated.

```sql
USING (user_id = auth.uid())
WITH CHECK (not specified)
```

### public.chaos_sort_sessions

- **Users manage their chaos sort sessions** — PERMISSIVE; ALL; roles: authenticated.

```sql
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid())
```

### public.collector_wishlist

- **collector_wishlist_owner_all** — PERMISSIVE; ALL; roles: public.

```sql
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id)
```

### public.deck_vault_inventory_links

- **Users manage inventory links in own decks** — PERMISSIVE; ALL; roles: public.

```sql
USING (EXISTS ( SELECT 1
   FROM deck_vault_decks d
  WHERE ((d.id = deck_vault_inventory_links.deck_id) AND (d.user_id = auth.uid()))))
WITH CHECK (EXISTS ( SELECT 1
   FROM deck_vault_decks d
  WHERE ((d.id = deck_vault_inventory_links.deck_id) AND (d.user_id = auth.uid()))))
```

### public.inventory_barcode_aliases

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### public.inventory_events

- **Users can view their inventory events** — PERMISSIVE; SELECT; roles: authenticated.

```sql
USING (auth.uid() = user_id)
WITH CHECK (not specified)
```

- **Users cannot delete inventory events** — PERMISSIVE; DELETE; roles: authenticated.

```sql
USING false
WITH CHECK (not specified)
```

- **Users cannot update inventory events** — PERMISSIVE; UPDATE; roles: authenticated.

```sql
USING false
WITH CHECK false
```

### public.inventory_items

- **Users manage their inventory items** — PERMISSIVE; ALL; roles: authenticated.

```sql
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id)
```

- **Workspace members view inventory items** — PERMISSIVE; SELECT; roles: authenticated.

```sql
USING ((workspace_id IS NOT NULL) AND is_workspace_member(workspace_id))
WITH CHECK (not specified)
```

### public.inventory_label_identities

- **Active identity actors only** — RESTRICTIVE; ALL; roles: authenticated.

```sql
USING label_actor_allowed(workspace_id)
WITH CHECK label_actor_allowed(workspace_id)
```

- **Managers manage inventory label identities** — PERMISSIVE; ALL; roles: authenticated.

```sql
USING has_workspace_role(workspace_id, 'manager'::text)
WITH CHECK has_workspace_role(workspace_id, 'manager'::text)
```

- **Own identity inserts only** — RESTRICTIVE; INSERT; roles: authenticated.

```sql
USING (not specified)
WITH CHECK (inventory_user_id = ( SELECT auth.uid() AS uid))
```

- **Own identity updates only** — RESTRICTIVE; UPDATE; roles: authenticated.

```sql
USING (inventory_user_id = ( SELECT auth.uid() AS uid))
WITH CHECK (inventory_user_id = ( SELECT auth.uid() AS uid))
```

- **Workspace members view inventory label identities** — PERMISSIVE; SELECT; roles: authenticated.

```sql
USING is_workspace_member(workspace_id)
WITH CHECK (not specified)
```

### public.inventory_locations

- **Users manage their inventory locations** — PERMISSIVE; ALL; roles: authenticated.

```sql
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id)
```

### public.inventory_movements

- **Users manage their inventory movements** — PERMISSIVE; ALL; roles: authenticated.

```sql
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id)
```

### public.inventory_price_reviews

- **Managers manage inventory price reviews** — PERMISSIVE; ALL; roles: authenticated.

```sql
USING has_workspace_role(workspace_id, 'manager'::text)
WITH CHECK has_workspace_role(workspace_id, 'manager'::text)
```

- **Workspace members view inventory price reviews** — PERMISSIVE; SELECT; roles: authenticated.

```sql
USING is_workspace_member(workspace_id)
WITH CHECK (not specified)
```

### public.label_migration_audit

- **Admins view label migration audit** — PERMISSIVE; SELECT; roles: authenticated.

```sql
USING ((workspace_id IS NULL) OR has_workspace_role(workspace_id, 'admin'::text))
WITH CHECK (not specified)
```

### public.label_print_jobs

- **Managers update label print jobs** — PERMISSIVE; UPDATE; roles: authenticated.

```sql
USING has_workspace_role(workspace_id, 'manager'::text)
WITH CHECK has_workspace_role(workspace_id, 'manager'::text)
```

- **Workspace members create label print jobs** — PERMISSIVE; INSERT; roles: authenticated.

```sql
USING (not specified)
WITH CHECK has_workspace_role(workspace_id, 'member'::text)
```

- **Workspace members view label print jobs** — PERMISSIVE; SELECT; roles: authenticated.

```sql
USING is_workspace_member(workspace_id)
WITH CHECK (not specified)
```

### public.label_templates

- **Active label actors only** — RESTRICTIVE; ALL; roles: authenticated.

```sql
USING label_actor_allowed(workspace_id)
WITH CHECK label_actor_allowed(workspace_id)
```

- **Managers manage label templates** — PERMISSIVE; ALL; roles: authenticated.

```sql
USING has_workspace_role(workspace_id, 'manager'::text)
WITH CHECK has_workspace_role(workspace_id, 'manager'::text)
```

- **Workspace members view label templates** — PERMISSIVE; SELECT; roles: authenticated.

```sql
USING is_workspace_member(workspace_id)
WITH CHECK (not specified)
```

### public.marketplace_connections

- **Users manage own marketplace connections** — PERMISSIVE; ALL; roles: authenticated.

```sql
USING (( SELECT auth.uid() AS uid) = user_id)
WITH CHECK (( SELECT auth.uid() AS uid) = user_id)
```

### public.marketplace_credentials

- **Users manage own encrypted marketplace credentials** — PERMISSIVE; ALL; roles: authenticated.

```sql
USING (( SELECT auth.uid() AS uid) = user_id)
WITH CHECK (( SELECT auth.uid() AS uid) = user_id)
```

### public.marketplace_listing_mappings

- **Users manage own listing mappings** — PERMISSIVE; ALL; roles: authenticated.

```sql
USING (( SELECT auth.uid() AS uid) = user_id)
WITH CHECK (( SELECT auth.uid() AS uid) = user_id)
```

### public.marketplace_oauth_tokens

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### public.marketplace_order_items

- **Users manage own marketplace order items** — PERMISSIVE; ALL; roles: authenticated.

```sql
USING (( SELECT auth.uid() AS uid) = user_id)
WITH CHECK (( SELECT auth.uid() AS uid) = user_id)
```

### public.marketplace_orders

- **Users manage own marketplace orders** — PERMISSIVE; ALL; roles: authenticated.

```sql
USING (( SELECT auth.uid() AS uid) = user_id)
WITH CHECK (( SELECT auth.uid() AS uid) = user_id)
```

### public.marketplace_sync_changes

- **Users manage own sync changes** — PERMISSIVE; ALL; roles: authenticated.

```sql
USING (( SELECT auth.uid() AS uid) = user_id)
WITH CHECK (( SELECT auth.uid() AS uid) = user_id)
```

### public.marketplace_sync_runs

- **Users manage own marketplace sync runs** — PERMISSIVE; ALL; roles: authenticated.

```sql
USING (( SELECT auth.uid() AS uid) = user_id)
WITH CHECK (( SELECT auth.uid() AS uid) = user_id)
```

### public.order_fulfillment_actions

- **Users manage own fulfillment actions** — PERMISSIVE; ALL; roles: authenticated.

```sql
USING (( SELECT auth.uid() AS uid) = user_id)
WITH CHECK (( SELECT auth.uid() AS uid) = user_id)
```

### public.order_shipment_events

- **Users read own shipment events** — PERMISSIVE; SELECT; roles: authenticated.

```sql
USING (( SELECT auth.uid() AS uid) = user_id)
WITH CHECK (not specified)
```

### public.order_shipments

- **Users manage own order shipments** — PERMISSIVE; ALL; roles: authenticated.

```sql
USING (( SELECT auth.uid() AS uid) = user_id)
WITH CHECK ((( SELECT auth.uid() AS uid) = user_id) AND (EXISTS ( SELECT 1
   FROM marketplace_orders mo
  WHERE ((mo.id = order_shipments.marketplace_order_id) AND (mo.user_id = ( SELECT auth.uid() AS uid))))))
```

- **Users read own order shipments** — PERMISSIVE; SELECT; roles: authenticated.

```sql
USING (( SELECT auth.uid() AS uid) = user_id)
WITH CHECK (not specified)
```

### public.portfolio_binders

- **portfolio_binders_owner_all** — PERMISSIVE; ALL; roles: public.

```sql
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id)
```

### public.portfolio_featured_cards

- **portfolio_featured_cards_owner_all** — PERMISSIVE; ALL; roles: public.

```sql
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id)
```

### public.portfolio_story_events

- **portfolio_story_owner_all** — PERMISSIVE; ALL; roles: public.

```sql
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id)
```

### public.pos_access_events

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### public.pos_approval_decisions

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### public.pos_approval_requests

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### public.pos_cash_events

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### public.pos_checkout_cancellations

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### public.pos_inventory_delegations

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### public.pos_location_inventory_locations

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### public.pos_operation_receipts

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### public.pos_payment_attempts

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### public.pos_payment_audit

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### public.pos_payment_checkouts

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### public.pos_payment_devices

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### public.pos_payment_events

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### public.pos_payment_refund_attempts

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### public.pos_refund_items

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### public.pos_refunds

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### public.pos_register_sessions

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### public.pos_registers

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### public.pos_sale_allocations

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### public.pos_sale_items

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### public.pos_sales

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### public.pos_store_locations

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### public.pos_tenders

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### public.pos_workspace_settings

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### public.purchase_inventory_links

- **Managers can write purchase inventory links** — PERMISSIVE; ALL; roles: authenticated.

```sql
USING ((inventory_user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM (purchase_ledger p
     JOIN workspace_members wm ON ((wm.workspace_id = p.workspace_id)))
  WHERE ((p.id = purchase_inventory_links.purchase_id) AND (wm.user_id = auth.uid()) AND (wm.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))))))
WITH CHECK ((EXISTS ( SELECT 1
   FROM (purchase_ledger p
     JOIN inventory_items ii ON (((ii.user_id = purchase_inventory_links.inventory_user_id) AND (ii.id = purchase_inventory_links.inventory_item_id))))
  WHERE ((p.id = purchase_inventory_links.purchase_id) AND ((ii.workspace_id = p.workspace_id) OR ((ii.workspace_id IS NULL) AND (p.user_id = ii.user_id) AND (p.user_id = auth.uid())))))) AND (EXISTS ( SELECT 1
   FROM inventory_items ii
  WHERE ((ii.user_id = purchase_inventory_links.inventory_user_id) AND (ii.id = purchase_inventory_links.inventory_item_id)))) AND ((inventory_user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM (purchase_ledger p
     JOIN workspace_members wm ON ((wm.workspace_id = p.workspace_id)))
  WHERE ((p.id = purchase_inventory_links.purchase_id) AND (wm.user_id = auth.uid()) AND (wm.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])))))))
```

- **Members can view purchase inventory links** — PERMISSIVE; SELECT; roles: authenticated.

```sql
USING ((inventory_user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM (purchase_ledger p
     JOIN workspace_members wm ON ((wm.workspace_id = p.workspace_id)))
  WHERE ((p.id = purchase_inventory_links.purchase_id) AND (wm.user_id = auth.uid())))))
WITH CHECK (not specified)
```

### public.purchase_ledger

- **Workspace managers can write purchase ledger** — PERMISSIVE; ALL; roles: authenticated.

```sql
USING ((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = purchase_ledger.workspace_id) AND (wm.user_id = auth.uid()) AND (wm.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))))))
WITH CHECK ((created_by = auth.uid()) AND ((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = purchase_ledger.workspace_id) AND (wm.user_id = auth.uid()) AND (wm.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])))))))
```

- **Workspace members can view purchase ledger** — PERMISSIVE; SELECT; roles: authenticated.

```sql
USING ((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = purchase_ledger.workspace_id) AND (wm.user_id = auth.uid())))))
WITH CHECK (not specified)
```

### public.purchase_ledger_lines

- **Managers can write purchase lines** — PERMISSIVE; ALL; roles: authenticated.

```sql
USING (EXISTS ( SELECT 1
   FROM purchase_ledger p
  WHERE ((p.id = purchase_ledger_lines.purchase_id) AND ((p.user_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM workspace_members wm
          WHERE ((wm.workspace_id = p.workspace_id) AND (wm.user_id = auth.uid()) AND (wm.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])))))))))
WITH CHECK (EXISTS ( SELECT 1
   FROM purchase_ledger p
  WHERE ((p.id = purchase_ledger_lines.purchase_id) AND ((p.user_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM workspace_members wm
          WHERE ((wm.workspace_id = p.workspace_id) AND (wm.user_id = auth.uid()) AND (wm.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])))))))))
```

- **Members can view purchase lines** — PERMISSIVE; SELECT; roles: authenticated.

```sql
USING (EXISTS ( SELECT 1
   FROM purchase_ledger p
  WHERE ((p.id = purchase_ledger_lines.purchase_id) AND ((p.user_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM workspace_members wm
          WHERE ((wm.workspace_id = p.workspace_id) AND (wm.user_id = auth.uid()))))))))
WITH CHECK (not specified)
```

### public.selling_inventory_allocations

- **Users manage own selling allocations** — PERMISSIVE; ALL; roles: authenticated.

```sql
USING ((( SELECT auth.uid() AS uid) = user_id) AND ((workspace_id IS NULL) OR is_workspace_member(workspace_id)))
WITH CHECK ((( SELECT auth.uid() AS uid) = user_id) AND ((workspace_id IS NULL) OR is_workspace_member(workspace_id)))
```

### public.selling_listing_batches

- **Users manage own selling listing batches** — PERMISSIVE; ALL; roles: authenticated.

```sql
USING ((( SELECT auth.uid() AS uid) = user_id) AND ((workspace_id IS NULL) OR is_workspace_member(workspace_id)))
WITH CHECK ((( SELECT auth.uid() AS uid) = user_id) AND ((workspace_id IS NULL) OR is_workspace_member(workspace_id)))
```

### public.selling_listing_candidates

- **Users manage own selling candidates** — PERMISSIVE; ALL; roles: authenticated.

```sql
USING ((( SELECT auth.uid() AS uid) = user_id) AND ((workspace_id IS NULL) OR is_workspace_member(workspace_id)))
WITH CHECK ((( SELECT auth.uid() AS uid) = user_id) AND ((workspace_id IS NULL) OR is_workspace_member(workspace_id)))
```

### public.selling_marketplace_listings

- **Users manage own selling marketplace listings** — PERMISSIVE; ALL; roles: authenticated.

```sql
USING ((( SELECT auth.uid() AS uid) = user_id) AND ((workspace_id IS NULL) OR is_workspace_member(workspace_id)))
WITH CHECK ((( SELECT auth.uid() AS uid) = user_id) AND ((workspace_id IS NULL) OR is_workspace_member(workspace_id)))
```

### public.selling_marketplace_operations

- **Users view own selling marketplace operations** — PERMISSIVE; SELECT; roles: authenticated.

```sql
USING ((( SELECT auth.uid() AS uid) = user_id) AND ((workspace_id IS NULL) OR is_workspace_member(workspace_id)))
WITH CHECK (not specified)
```

### public.selling_marketplace_settings

- **Users manage own selling marketplace settings** — PERMISSIVE; ALL; roles: authenticated.

```sql
USING ((( SELECT auth.uid() AS uid) = user_id) AND ((workspace_id IS NULL) OR is_workspace_member(workspace_id)))
WITH CHECK ((( SELECT auth.uid() AS uid) = user_id) AND ((workspace_id IS NULL) OR is_workspace_member(workspace_id)))
```

### public.selling_sync_events

- **Users manage own selling sync events** — PERMISSIVE; ALL; roles: authenticated.

```sql
USING ((( SELECT auth.uid() AS uid) = user_id) AND ((workspace_id IS NULL) OR is_workspace_member(workspace_id)))
WITH CHECK ((( SELECT auth.uid() AS uid) = user_id) AND ((workspace_id IS NULL) OR is_workspace_member(workspace_id)))
```

### public.showcase_events

- **Showcase members view events** — PERMISSIVE; SELECT; roles: authenticated.

```sql
USING is_workspace_member(workspace_id)
WITH CHECK (not specified)
```

### public.showcase_inventory_reservations

- **Showcase members view reservations** — PERMISSIVE; SELECT; roles: authenticated.

```sql
USING is_workspace_member(workspace_id)
WITH CHECK (not specified)
```

### public.showcase_kiosk_devices

- **Showcase admins manage kiosks** — PERMISSIVE; ALL; roles: authenticated.

```sql
USING is_workspace_admin(workspace_id)
WITH CHECK is_workspace_admin(workspace_id)
```

### public.showcase_kiosk_pairing_codes

- **Showcase admins manage pairing codes** — PERMISSIVE; ALL; roles: authenticated.

```sql
USING is_workspace_admin(workspace_id)
WITH CHECK is_workspace_admin(workspace_id)
```

### public.showcase_profiles

- **Public can view enabled showcase profiles** — PERMISSIVE; SELECT; roles: anon, authenticated.

```sql
USING (enabled = true)
WITH CHECK (not specified)
```

- **Showcase members manage profile** — PERMISSIVE; ALL; roles: authenticated.

```sql
USING is_workspace_admin(workspace_id)
WITH CHECK is_workspace_admin(workspace_id)
```

### public.showcase_request_items

- **Showcase members manage request items** — PERMISSIVE; SELECT; roles: authenticated.

```sql
USING (EXISTS ( SELECT 1
   FROM showcase_requests r
  WHERE ((r.id = showcase_request_items.request_id) AND is_workspace_member(r.workspace_id))))
WITH CHECK (not specified)
```

### public.showcase_requests

- **Showcase members view requests** — PERMISSIVE; SELECT; roles: authenticated.

```sql
USING is_workspace_member(workspace_id)
WITH CHECK (not specified)
```

### public.tcgplayer_magic_catalog

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### public.tcgplayer_magic_catalog_imports

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### public.tcgtracking_price_snapshots

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### public.tcgtracking_product_mappings

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### public.tcgtracking_sync_runs

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### public.user_preferences

- **Users manage their preferences** — PERMISSIVE; ALL; roles: authenticated.

```sql
USING (( SELECT auth.uid() AS uid) = user_id)
WITH CHECK (( SELECT auth.uid() AS uid) = user_id)
```

### public.workspace_documents

- **Managers delete workspace documents** — PERMISSIVE; DELETE; roles: authenticated.

```sql
USING (can_manage_workspace(workspace_id) OR (user_id = auth.uid()))
WITH CHECK (not specified)
```

- **Members create workspace documents** — PERMISSIVE; INSERT; roles: authenticated.

```sql
USING (not specified)
WITH CHECK (is_workspace_member(workspace_id) AND (user_id = auth.uid()))
```

- **Members read workspace documents** — PERMISSIVE; SELECT; roles: authenticated.

```sql
USING is_workspace_member(workspace_id)
WITH CHECK (not specified)
```

- **Members update workspace documents** — PERMISSIVE; UPDATE; roles: authenticated.

```sql
USING is_workspace_member(workspace_id)
WITH CHECK is_workspace_member(workspace_id)
```

### public.workspace_employees

- **Managers manage workspace employees** — PERMISSIVE; ALL; roles: authenticated.

```sql
USING can_manage_workspace(workspace_id)
WITH CHECK can_manage_workspace(workspace_id)
```

### public.workspace_members

- **Admins can add workspace members** — PERMISSIVE; INSERT; roles: authenticated.

```sql
USING (not specified)
WITH CHECK is_workspace_admin(workspace_id)
```

- **Admins can remove workspace members** — PERMISSIVE; DELETE; roles: authenticated.

```sql
USING is_workspace_admin(workspace_id)
WITH CHECK (not specified)
```

- **Admins can update workspace members** — PERMISSIVE; UPDATE; roles: authenticated.

```sql
USING is_workspace_admin(workspace_id)
WITH CHECK is_workspace_admin(workspace_id)
```

- **Members can view workspace membership** — PERMISSIVE; SELECT; roles: authenticated.

```sql
USING is_workspace_member(workspace_id)
WITH CHECK (not specified)
```

### public.workspace_shipping_profiles

- **Users manage own shipping profiles** — PERMISSIVE; ALL; roles: authenticated.

```sql
USING (( SELECT auth.uid() AS uid) = user_id)
WITH CHECK (( SELECT auth.uid() AS uid) = user_id)
```

### public.workspaces

- **Members can view workspaces** — PERMISSIVE; SELECT; roles: authenticated.

```sql
USING is_workspace_member(id)
WITH CHECK (not specified)
```

- **Owners can update workspaces** — PERMISSIVE; UPDATE; roles: authenticated.

```sql
USING (( SELECT auth.uid() AS uid) = owner_id)
WITH CHECK (( SELECT auth.uid() AS uid) = owner_id)
```

### storage.buckets

No row policy. RLS-enabled tables deny ordinary roles unless a trusted RPC operates on their behalf; private tables additionally depend on schema/table grants.

### storage.objects

- **Users read own feedback files** — PERMISSIVE; SELECT; roles: authenticated.

```sql
USING ((bucket_id = 'feedback-attachments'::text) AND (((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) OR is_platform_owner()))
WITH CHECK (not specified)
```

- **Users upload own feedback files** — PERMISSIVE; INSERT; roles: authenticated.

```sql
USING (not specified)
WITH CHECK ((bucket_id = 'feedback-attachments'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text))
```

- **chaos_scan_object_insert** — PERMISSIVE; INSERT; roles: authenticated.

```sql
USING (not specified)
WITH CHECK ((bucket_id = 'chaos-scans'::text) AND (EXISTS ( SELECT 1
   FROM (chaos_scan_captures c
     JOIN chaos_scan_albums a ON ((a.id = c.album_id)))
  WHERE ((c.object_path = objects.name) AND (c.user_id = ( SELECT auth.uid() AS uid)) AND (c.status = 'RESERVED'::text) AND (a.state = 'ACTIVE'::text)))))
```

- **chaos_scan_object_read** — PERMISSIVE; SELECT; roles: authenticated.

```sql
USING ((bucket_id = 'chaos-scans'::text) AND (EXISTS ( SELECT 1
   FROM (chaos_scan_captures c
     JOIN chaos_scan_albums a ON ((a.id = c.album_id)))
  WHERE ((c.object_path = objects.name) AND (c.user_id = ( SELECT auth.uid() AS uid)) AND (c.status <> 'EXPIRED'::text) AND ((a.expires_at IS NULL) OR (a.expires_at > now()))))))
WITH CHECK (not specified)
```

- **marketing_assets_admin_delete** — PERMISSIVE; DELETE; roles: authenticated.

```sql
USING ((bucket_id = 'marketing-assets'::text) AND is_admin('admin'::admin_role))
WITH CHECK (not specified)
```

- **marketing_assets_admin_read** — PERMISSIVE; SELECT; roles: authenticated.

```sql
USING ((bucket_id = 'marketing-assets'::text) AND is_admin('admin'::admin_role))
WITH CHECK (not specified)
```

- **marketing_assets_admin_update** — PERMISSIVE; UPDATE; roles: authenticated.

```sql
USING ((bucket_id = 'marketing-assets'::text) AND is_admin('admin'::admin_role))
WITH CHECK ((bucket_id = 'marketing-assets'::text) AND is_admin('admin'::admin_role))
```

- **marketing_assets_admin_upload** — PERMISSIVE; INSERT; roles: authenticated.

```sql
USING (not specified)
WITH CHECK ((bucket_id = 'marketing-assets'::text) AND is_admin('admin'::admin_role))
```
