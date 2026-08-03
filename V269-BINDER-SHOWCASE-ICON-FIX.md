# Trading Docks v269 — Binder Showcase icon compatibility fix

Fixed:

`Export Instagram doesn't exist in target module "lucide-react"`

The installed Lucide version does not export an `Instagram` icon.

Changes:

- Removed `Instagram` from the Lucide import
- Replaced its JSX usage with the supported `MessageCircle` icon
- Preserved Instagram/Discord export wording and functionality
- Preserved public binder links, trade captions, social image export, and the
  `/share/binder/[token]` page

Run the existing migration if it has not already been applied:

`supabase/migrations/202608030009_binder_shares.sql`
