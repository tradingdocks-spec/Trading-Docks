# Trading Docks v181 — TCGplayer Order Inbox

## Included

- Converts supported forwarded TCGplayer new-order emails into Orders Center records.
- Captures order number, buyer, order date, totals, and recognizable line items.
- Stores each order under the workspace owner's account and retains the source email for audit and retry.
- Uses duplicate-safe upserts for both orders and line items.
- Shows a visible review warning in Orders when forwarded emails cannot be parsed completely.
- Leaves imported cards unmatched and makes no automatic inventory deductions.
- Preserves the v180 persistent green Connected state.

## Deployment

Deploy this package after v180. No additional Supabase migration is required because it uses the inbound-email and universal-orders tables already installed by v178–v180.

After deployment, trigger or forward a new TCGplayer order email. Open **Orders** to review the imported order and expand it to see the parsed cards.
