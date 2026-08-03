# Trading Docks v265 — Admin User Management

- Replaces the read-only account directory with a Customer 360 management drawer.
- Adds plan overrides for Free, Collector, Seller, and Store.
- Adds account suspension and restoration.
- Adds permanent user deletion with typed confirmation.
- Protects the permanent owner account and active admin session.
- Adds email-confirmation and suspension status to the directory.
- Logs plan, suspension, restoration, and deletion actions when the audit table is available.

Requires `SUPABASE_SERVICE_ROLE_KEY` in Vercel. Existing admin membership override migration must be applied.
