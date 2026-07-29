# Trading Docks Marketplace Foundation v108

## Install

1. Deploy this version to the existing Trading Docks Vercel project.
2. Run `supabase/migrations/202607290002_marketplace_sync_engine.sql` in the Supabase SQL Editor.
3. Confirm these Vercel environment variables already exist:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `MARKETPLACE_CREDENTIAL_ENCRYPTION_KEY` (at least 32 characters)
4. Redeploy after changing environment variables.

## First eBay connection

1. Open **Dashboard → Marketplaces → eBay → Start setup**.
2. In the eBay Developers Program, create a Production keyset and OAuth RuName.
3. Add this accepted authorization callback URL:
   `https://www.tradingdocks.com/api/marketplaces/ebay/callback`
4. Enter the eBay environment, Client ID, Client Secret, and RuName in Trading Docks.
5. Save the encrypted credentials.
6. Reopen eBay setup and choose **Authorize eBay read-only access**.

Trading Docks initially requests read-only inventory and fulfillment scopes. It does not change prices, quantities, listings, or fulfillment in this release.

## Safety model

- Trading Docks remains the intended source of truth.
- New connectors start in `read_only`.
- Imported listings are mapped to Trading Docks SKUs.
- Proposed changes are stored in a review queue.
- Automatic marketplace writes require a later, explicit activation workflow.
- OAuth tokens are server-only and are not readable through the authenticated browser API.

## Next implementation milestone

The next milestone is the eBay read-only importer: retrieve inventory items, offers, and orders; normalize them; match them to Trading Docks inventory; and display unmatched/conflicting records for review.
