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
