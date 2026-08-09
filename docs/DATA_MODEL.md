# Data Model

## Supabase Foundation

- Implemented: `profiles`, `workspaces`, `workspace_members`, and `user_preferences` are created by the auth foundation migration.
- Implemented: Workspace helper functions such as membership/admin checks support workspace access patterns.
- Implemented: Most user-owned tables use `user_id` and RLS policies comparing to `auth.uid()`.
- Implemented: Store/team tables use workspace membership or management helpers in later migrations.
- Partially Implemented: Migration history contains overlapping definitions and repair migrations that must be replay-tested.

## Major Table Groups

| Group | Status | Representative Tables |
| --- | --- | --- |
| Auth/workspace | Implemented | `profiles`, `workspaces`, `workspace_members`, `user_preferences` |
| Billing/trials | Partially Implemented | `billing_subscriptions`, `account_trials`, `trial_usage_events`, `admin_membership_overrides` |
| Platform roles | Partially Implemented | `user_roles`, `admin_audit_log`, `admin_account_access` |
| Inventory | Partially Implemented | `inventory_locations`, `inventory_items`, `inventory_movements` |
| Deck vault | Partially Implemented | `decks`, `deck_cards`, `deck_snapshots`, `deck_vault_decks`, `deck_vault_cards`, `deck_vault_tokens` |
| TCG market data | Partially Implemented | `tcg_categories`, `tcg_groups`, `tcg_products`, `tcg_current_prices`, `tcg_price_history` |
| Marketplace | Requires Production Configuration | `marketplace_connections`, `marketplace_credentials`, `marketplace_sync_runs`, `marketplace_orders`, `marketplace_order_items` |
| Buying/buylist | Partially Implemented | `bulk_purchases`, `bulk_purchase_sales`, `buylist_offers`, `buylist_feed_connections` |
| Store operations | Partially Implemented | `workspace_employees`, `tournaments`, `tournament_players`, `tournament_rounds`, CRM tables |
| Feedback | Partially Implemented | `feedback_items`, `feedback_attachments`, admin feedback functions |
| Inbound email | Requires Production Configuration | `inbound_email_addresses`, `inbound_emails`, legacy mailbox/message tables |
| Collector portfolio | Partially Implemented | `collector_profiles`, `portfolio_binders`, `portfolio_featured_cards`, `portfolio_shares`, `trade_requests`, `collector_wishlist` |
| Public share security | Partially Implemented | `binder_shares`, `portfolio_shares`, `public_share_security_events` |

## Scanner Intelligence Contracts

- Implemented: Scanner frame, normalized image, region, OCR observation, symbol observation, artwork observation, collector-info observation, finish observation, recognition candidate, signal score, confidence, printing resolution, confirmation, destination, session, export row, and benchmark contracts are defined in `mobile/services/scanner-intelligence.ts`.
- Implemented: Multi-TCG contracts are defined in `mobile/services/multi-tcg-scanner.ts`, including `SupportedTcg`, game detection observations, game adapters, universal card/printing identity, mixed sessions, universal exports, and unsupported-card observations.
- Implemented: `ScanDestination` separates Collection, user-created Binder, Trade Binder, named Scan Session, and future Deal Desk handoff.
- Implemented: `ScanExportRow` preserves market price, price source, and price timestamp as nullable fields; missing prices remain unavailable rather than `$0`.
- Partially Implemented: `inventory_items` is Magic-compatible today because active scanner writes use Scryfall, set code, and collector-number fields. Universal identity should be introduced through a migration proposal only.
- Partially Implemented: General user-created binder assignment is a typed destination only. Active scanner writes currently support Collection, Storage assignment, Trade Binder status, and Wishlist action.
- Planned: Preserve existing Magic records by adapting `scryfall_id`, `set_code`, and `collector_number` into the universal contract rather than destructively converting rows.
- Planned: If user-created binders become a production scanner destination, add a reviewed migration proposal for first-class binder ownership and assignment instead of overloading Trade Binder state.
- Planned: Persisted scan sessions and saved scanner exports need reviewed schema design before production use.

## Collector Workspace Contracts

- Implemented: Application-level Collector Workspace models are defined in `mobile/services/collector-workspace.ts` and re-exported for web from `src/lib/collector-workspace.ts`.
- Implemented: `CollectionCard` separates card identity (`cardName`, `game`), exact printing (`CardPrinting`), ownership (`quantityOwned`, `condition`), market/pricing data (`MarketPrice`), storage (`StorageLocation`), trade state (`TradeBinderStatus`), and wishlist state (`WishlistStatus`).
- Implemented: `CardPrinting` captures `scryfallId`, `setCode`, `setName`, `collectorNumber`, `language`, `finish`, `treatment`, and `imageUrl` when present in saved inventory data.
- Implemented: `CollectionFilter`, `CollectionSort`, and `CollectionSummary` provide a shared contract for mobile and web search, sorting, visible limits, missing-price handling, trade counts, wishlist counts, and Free-plan card limits.
- Partially Implemented: Existing Supabase inventory tables store canonical query columns plus a flexible `data` JSON payload. The UI reads both but does not apply schema changes in this sprint.
- Implemented: Default zero inventory values are treated as missing price data in the Collector Workspace contract so the UI does not present database defaults as live market prices.
- Implemented: `binder_card_trade_status` stores per-inventory-item trade status and is now updated by Collector organization actions. RLS scopes writes to `auth.uid() = user_id`.
- Implemented: `collector_wishlist` stores card-name/set/condition/finish targets and is now toggled by Collector organization actions. The action preserves the selected owned card's exact printing fields where available.
- Implemented: `inventory_items.quantity` remains non-negative by schema check and action validation. Quantity zero means zero owned copies on the existing row; it does not delete or archive the record.
- Implemented: `inventory_items.location_id` can be assigned to an existing owned `inventory_locations` id or cleared to `null`.
- Partially Implemented: Condition and finish are still stored inside `inventory_items.data`; a future schema review may propose first-class columns if reporting/filtering requires stronger database constraints.
- Planned: Add a reviewed migration proposal for normalized collection-card, printing, deck-usage, and price-history relationships if JSON payloads become insufficient.

## Data Model Risks

- Partially Implemented: Deck vault has multiple table families and migrations, suggesting an incomplete consolidation.
- Partially Implemented: Inbound email has multiple table naming patterns.
- Partially Implemented: Marketplace sync run table is created/altered in multiple migrations.
- Partially Implemented: Collector Workspace currently relies on inventory JSON payload fields for image URL, finish, treatment, binder page, binder slot, and unit market value. Missing fields are displayed as unavailable rather than inferred.
- Planned: Add pagination cursors or server-side collection query endpoints before very large collections depend on the browser.
- Requires Production Configuration: `supabase/verification/verify_account_data_isolation.sql` should be run against staging before launch.
- Planned: Generate a canonical schema snapshot after migration replay passes.

## Canonical Identity Fields

- Implemented: `auth.users.id` is the authentication identity and foreign-key anchor.
- Implemented: `user_roles.role` is the canonical platform role source for `owner`, `admin`, `support`, and `analyst`; no row means normal user.
- Partially Implemented: `profiles` stores display profile data but not platform authority.
- Partially Implemented: `user_preferences.preferences.account_type` and mobile local account type represent account/workspace mode, not billing or admin authority.
- Implemented: `billing_subscriptions.plan_id/status/current_period_end` represent billing-derived membership.
- Implemented: `admin_membership_overrides.plan_id` can override membership entitlements without changing Stripe billing.
- Partially Implemented: `admin_account_access` exists in the mobile admin migration with `account_type` and `subscription_status`, but active web membership resolution still uses `billing_subscriptions` plus `admin_membership_overrides`.

## Canonical Membership Fields

- Implemented: Active application code uses `free`, `collector`, `seller`, and `store` as canonical membership tiers.
- Implemented: Active application code normalizes legacy `business` membership values to `store` for compatibility.
- Requires Production Configuration: Root Supabase migrations still define `billing_subscriptions.plan_id`, `admin_membership_overrides.plan_id`, and related functions with `business` check constraints.
- Requires Production Configuration: `account_trials.plan_id` references `account_plans`, and older seed data includes `business`; staging replay must confirm the final product-plan rows before trial grants use Store.

## Migration Proposal

- Planned: Replace `is_platform_owner()` with `is_admin(minimum_role)` policies in root Supabase migrations and replay into staging.
- Planned: Update `admin_directory` and `admin_set_membership_override` database functions to authorize through `user_roles`.
- Planned: Replace `business` plan ids with `store` in `billing_subscriptions`, `admin_membership_overrides`, `account_trials`, `account_plans`, `feature_access.minimum_plan`, and admin helper functions.
- Planned: Update check constraints so active code can persist Store overrides, Stripe webhooks, and trial grants without database rejection.
- Planned: Decide whether `admin_account_access` remains a support view or is replaced by `profiles`/`user_preferences` plus billing tables.
- Planned: Add regression SQL proving owner/admin/support/analyst access, normal-user denial, and protected owner-role mutation behavior.
- Implemented: `supabase/migrations/202608050001_collector_mutation_security_proposal.sql` is a forward-only proposal for database-enforced Collector mutation ownership and Free-plan total-quantity limits. It has not been applied to production.
- Implemented: The proposed Free limit interpretation is 500 total owned card quantity across `inventory_items.quantity`, not 500 unique inventory rows.
- Implemented: The proposal preserves zero-quantity behavior as a non-destructive zero-owned inventory row.
- Implemented: The proposal uses per-user transaction advisory locks in the inventory trigger to prevent simultaneous inserts, updates, or offline replay from racing past the Free limit.
- Implemented: The proposal treats paid Collector, Seller, and legacy `business`/canonical Store billing or explicit membership overrides as unlimited for card quantity; platform role alone does not grant paid inventory limits.
- Partially Implemented: The active schema is user-owned inventory through `inventory_items.user_id`; no active inventory workspace owner field exists. Store/workspace inventory sharing remains future schema work.
- Partially Implemented: Static index review found the `(user_id, id)` primary key can support per-user enforcement lookups, but staging should run `explain analyze` against `sum(quantity) where user_id = ? and id <> ?` before production approval. A covering quantity index may be proposed only if staging data shows the need.
- Planned: Run `supabase/verification/verify_collector_mutation_security.sql` in disposable local/staging Supabase after migration replay.
- Planned: The verification script now includes Free 499/500/over-limit cases, zero quantity, paid tiers, admin-with-Free, explicit override, missing profile/preferences, cross-user mutation, duplicate offline replay, and service-role behavior notes.
- Planned: Do not apply these Collector mutation security schema changes from this branch.
- Planned: Do not apply these schema changes from this branch.

## Collector Query Scalability

- Implemented: Active mobile and web collection queries scope `inventory_items`, `inventory_locations`, `binder_card_trade_status`, and `collector_wishlist` by authenticated `user_id`.
- Implemented: Current inventory indexes include `(user_id, card_name)`, `(user_id, location_id)`, `(user_id, set_code, collector_number)`, `(user_id, scryfall_id)`, `(user_id, updated_at desc)`, and primary key `(user_id, id)`.
- Partially Implemented: Current indexes support the default recent sort, storage filter, set sort, and ownership lookup. Name search with `ilike`, JSON condition/finish filters, price/quantity sorts, and batched Trade Binder/Wishlist filters should be measured with `explain analyze` in staging.
- Planned: Proposed index review candidates only, not applied here: `(user_id, quantity desc, id)`, `(user_id, inventory_value desc, id)`, expression indexes for `data->>'condition'` and `data->>'finish'`, and related-table indexes for `binder_card_trade_status(user_id, status, inventory_item_id)` and `collector_wishlist(user_id, card_name)`.

## Storage Locations

- Implemented: `inventory_locations` stores user-owned locations with primary key `(user_id, id)`, `name`, `location_type`, flexible `data`, timestamps, and RLS requiring `auth.uid() = user_id`.
- Implemented: `inventory_items.location_id` stores the current assignment and can be set to an owned location id or cleared to `null`.
- Implemented: Application-level models define `StorageLocation`, `StorageLocationPath`, `StorageLocationType`, `LocationAssignment`, and `LocationSummary`.
- Implemented: Canonical hierarchy labels are Area, Shelf, Container, Section, and Slot. Legacy/custom types such as binder, box, sealed, bulk, and custom remain supported for existing records.
- Partially Implemented: Parent/child hierarchy, favorite, recent, and archive state are encoded in `inventory_locations.data` fields: `parentId`, `favorite`, `recentUsedAt`, and `archivedAt`.
- Partially Implemented: The current schema does not enforce parent existence, prevent hierarchy cycles, or index archived/favorite/recent metadata. Application code validates these states, but database enforcement requires a reviewed migration.
- Implemented: Archiving a location with assigned cards is blocked by default in active UI/helpers. Explicit archive-with-assignments behavior exists as a contract path but is not the normal UI action.
- Planned: Migration proposal only: add nullable `parent_location_id`, `archived_at`, `favorite`, `recent_used_at`, constraints preventing self-parenting, indexes for `(user_id, parent_location_id)`, `(user_id, archived_at)`, and `(user_id, favorite, recent_used_at desc)`, plus SQL/RPC validation for cycle prevention.

## Trade Binder And Wishlist

- Implemented: `binder_card_trade_status` stores per-owned-card trade status, optional `trade_value`, `notes`, and `updated_at`, with unique `(user_id, inventory_item_id)` and owner RLS.
- Implemented: `collector_wishlist` stores wanted card targets with `card_name`, optional `set_code`, optional `target_condition`, optional `target_finish`, optional `target_value`, `priority`, `notes`, and timestamps, with owner RLS.
- Implemented: Application-level models define `TradeBinderItem`, `TradeStatus`, `WishlistItem`, `WishlistPriority`, `WishlistMatch`, `TradeSummary`, and `WishlistSummary`.
- Implemented: Trade Binder statuses use existing canonical values: `available`, `reserved`, `pending`, `not_for_trade`, `looking_for_upgrade`, and `for_sale`.
- Implemented: Wishlist priorities use existing database values: `low`, `medium`, `high`, and `grail`.
- Implemented: Matching rules are strict when fields are specified and flexible only for omitted wishlist fields.
- Partially Implemented: `collector_wishlist` does not store collector number, language, or Scryfall id, so exact-printing matching is limited to card name plus set code, condition, and finish.
- Planned: Add a reviewed migration proposal before requiring wishlist collector-number/Scryfall exactness, durable match snapshots, or trade-calculator audit trails.

## Scanner Data Contract

- Implemented: Scanner candidates map to exact-printing fields already used by Collection: Scryfall id, card name, set code, set name, collector number, finish, language, and image URL when available.
- Implemented: Confirmed scans insert `inventory_items` records with `quantity`, `location_id`, and exact-printing metadata in `data`.
- Implemented: Continuous scanner session lines are local user-scoped records containing scan identity, game, exact-printing fields, condition, finish, quantity, price fields, offer fields, destination, confidence, review status, and sync state.
- Implemented: Offer sessions keep market value, cash offer, trade value, and estimated margin separate; missing prices remain `null`.
- Partially Implemented: Scanner candidate records can carry nullable Scryfall USD price metadata for normal, foil, and etched finishes. The active scanner applies that metadata asynchronously to matching session lines with stale-row and manual-price guards; it does not persist a normalized price-history table.
- Implemented: Optional Trade Binder and Wishlist selections reuse `binder_card_trade_status` and `collector_wishlist` mutation paths.
- Partially Implemented: The scanner persists interrupted draft state locally by user id. Drafts do not store image URIs or retained photos.
- Partially Implemented: Scanner-created item ids are app-generated text ids to match the current `inventory_items.id` schema.
- Planned: Add database-side scanner/import idempotency if rapid scan and offline replay need stronger duplicate prevention than the current queue de-dupe key.
- Planned: Add durable server-side purchase/trade session tables only after product-owner review; no schema migration is applied in the continuous scanner sprint.

## Inventory Labels And QR Identity

- Implemented: `inventory_items.sku` exists in `supabase/migrations/202607280004_inventory_persistence.sql` and is written by `src/lib/inventory-persistence.ts` when legacy inventory records include a SKU.
- Implemented: Application contracts define `InventorySku`, `QrToken`, `LabelTemplate`, `PricingRule`, and `PosCartItemContract`.
- Partially Implemented: Existing inventory remains user-owned through `inventory_items.user_id`; the requested Label Studio architecture requires workspace-scoped inventory identity before shared Store workflows are production-authoritative.
- Planned: Required migration proposal only: add `inventory_identity`, `label_templates`, `label_print_jobs`, and `inventory_price_reviews` with workspace RLS, unique `(workspace_id, sku)`, unique QR token, token revocation, and template/print-job audit metadata.
- Planned: Public QR routes must resolve through server-side sanitized views and never expose cost basis, internal ids, private customer data, or workspace-private notes.
- Planned: Sealed labels need durable sealed product identity before sealed inventory QR labels can be considered complete.
