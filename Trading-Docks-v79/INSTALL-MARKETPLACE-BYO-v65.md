# Trading Docks Marketplace BYO Credentials v65

1. Apply these Supabase migrations in order:
   - `202607280002_marketplace_connector_foundation.sql`
   - `202607280003_marketplace_byo_credentials.sql`
2. Add a server-only deployment environment variable:
   - `MARKETPLACE_CREDENTIAL_ENCRYPTION_KEY`
   - Generate a strong value with `openssl rand -base64 32`.
   - Do not prefix it with `NEXT_PUBLIC_`.
3. Deploy the included source files.
4. Open Seller/Store → Marketplaces, choose a marketplace, open its official
   developer setup page, and enter the user's own app credentials.

The API route validates Seller/Store access and encrypts credential JSON with
AES-256-GCM before saving it. The browser receives masked confirmation only.

This release stores credentials and connector setup state. Provider-specific
OAuth token exchange, live connection tests, webhook verification, and
inventory/order synchronization remain separate connector-adapter work. The UI
does not claim a live sync until those adapters are enabled.
