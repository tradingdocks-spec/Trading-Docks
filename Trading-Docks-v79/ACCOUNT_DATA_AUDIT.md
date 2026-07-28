# Trading Docks account data audit

## Supabase-backed now

- Authentication, profiles, workspaces, memberships, preferences, and dashboard layouts
- Billing subscriptions, trials, plan overrides, and administrative audit records
- Marketplace connections, encrypted credentials, and synchronization history
- Inventory locations, cards/items, quantities, movements, values, and listing metadata
- Deck Vault decks and unresolved import records
- Business calendar events
- Collection-buying drafts, printing preferences, appraisals, purchase queues, and customer lookup records
- Future store employees, including private permissions and compensation data
- Future tournaments, players, rounds, matches, standings, and results

## Isolation rules

- Personal records use `user_id = auth.uid()` through Supabase Row Level Security.
- Store records use `workspace_id`; reads require membership and changes require owner, admin, or manager access.
- Employee records are restricted to owners, administrators, and managers because they may contain sensitive data.
- Anonymous access is revoked from every account and business table.
- Deleting a user or workspace cascades the related owned records where appropriate.

## Browser storage allowed

Only non-business device preferences remain in browser storage:

- Sidebar collapsed/expanded state
- Recently used quick-create shortcuts
- One-time migration/cleanup markers

Legacy inventory, deck, calendar, and collection-buying browser data is read only
for a one-time migration to Supabase and then removed.

## Deployment order

1. Apply `supabase/migrations/202607280004_inventory_persistence.sql`.
2. Apply `supabase/migrations/202607280005_account_data_foundation.sql`.
3. Run `supabase/verification/verify_account_data_isolation.sql`.
4. Deploy the application.
5. Test with two accounts and confirm that inventory, Deck Vault, calendar, and collection-buying records do not cross accounts.

