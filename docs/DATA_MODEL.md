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

## Data Model Risks

- Partially Implemented: Deck vault has multiple table families and migrations, suggesting an incomplete consolidation.
- Partially Implemented: Inbound email has multiple table naming patterns.
- Partially Implemented: Marketplace sync run table is created/altered in multiple migrations.
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

## Migration Proposal

- Planned: Replace `is_platform_owner()` with `is_admin(minimum_role)` policies in root Supabase migrations and replay into staging.
- Planned: Update `admin_directory` and `admin_set_membership_override` database functions to authorize through `user_roles`.
- Planned: Decide whether `admin_account_access` remains a support view or is replaced by `profiles`/`user_preferences` plus billing tables.
- Planned: Add regression SQL proving owner/admin/support/analyst access, normal-user denial, and protected owner-role mutation behavior.
- Planned: Do not apply these schema changes from this branch.
