# Trading Docks v276 — Public Sharing Security Sweep

This release establishes the permission boundary requested for public collection
and trade-binder links.

Anonymous visitors can:

- View only the exact active shared snapshot
- Browse the cards and approved public fields
- Navigate the shared page
- Create a free account or sign in

Anonymous visitors cannot:

- Access the dashboard
- Query private inventory or locations
- View other private binders
- Edit, add, move, or delete cards
- View account IDs, email, cost basis, private notes, or credentials
- Submit a trade request or Interested List without an account

Run the included security migration before deployment:

`supabase/migrations/202608030050_public_share_security.sql`

See `SECURITY-SWEEP-V276.md` for the full sweep and launch checklist.
