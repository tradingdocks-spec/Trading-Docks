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

## Collector Workspace Contracts

- Implemented: Application-level Collector Workspace models are defined in `mobile/services/collector-workspace.ts` and re-exported for web from `src/lib/collector-workspace.ts`.
- Implemented: `CollectionCard` separates card identity (`cardName`, `game`), exact printing (`CardPrinting`), ownership (`quantityOwned`, `condition`), market/pricing data (`MarketPrice`), storage (`StorageLocation`), trade state (`TradeBinderStatus`), and wishlist state (`WishlistStatus`).
- Implemented: `CardPrinting` captures `scryfallId`, `setCode`, `setName`, `collectorNumber`, `language`, `finish`, `treatment`, and `imageUrl` when present in saved inventory data.
- Implemented: `CollectionFilter`, `CollectionSort`, and `CollectionSummary` provide a shared contract for mobile and web search, sorting, visible limits, missing-price handling, trade counts, wishlist counts, and Free-plan card limits.
- Partially Implemented: Existing Supabase inventory tables store canonical query columns plus a flexible `data` JSON payload. The UI reads both but does not apply schema changes in this sprint.
- Implemented: Default zero inventory values are treated as missing price data in the Collector Workspace contract so the UI does not present database defaults as live market prices.
- Partially Implemented: `binder_card_trade_status` stores per-inventory-item trade status. The new browser reads it but does not mutate it.
- Partially Implemented: `collector_wishlist` stores card-name/set/condition/finish targets. The new browser matches it to owned cards but does not mutate it.
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
- Planned: Do not apply these schema changes from this branch.
