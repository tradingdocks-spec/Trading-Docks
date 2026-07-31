# Buylist Intelligence v163

## Setup

1. Run `supabase/migrations/202607310001_buylist_intelligence.sql` in Supabase.
2. Open **Sell Optimizer** and import an authorized store CSV.
3. Required columns: `store_name`, `card_name`, `cash_price`.
4. Recommended exact-match columns: `scryfall_id`, `set_code`, `collector_number`, `finish`, `language`, `condition`, `quantity_wanted`, `credit_price`, `source_url`, `verified_at`.

Trading Docks deliberately shows no fabricated offers. Store feeds should come from authorized APIs, partner exports, or CSV files the user is permitted to use.
