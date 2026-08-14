# Business Command Center Intelligence

Status: Partially Implemented

Business Command Center 2.0 is the Seller, Store, Owner, and Admin operating surface for Trading Docks HQ. It uses the existing access authority and existing order, marketplace, inventory, repricing, and store-operation tables. It does not call an external AI provider during render and does not fabricate metrics when canonical data is unavailable.

## Source of Truth

- Access: `resolvePlatformAccessForUser`, `canViewBusinessCommandCenter`, and the shared platform capability model.
- Orders: canonical marketplace orders loaded through `loadCanonicalOrders`.
- Channels: `marketplace_connections`, `marketplace_sync_runs`, and normalized order channel ids.
- Inventory capital: `inventory_items.inventory_value`, `inventory_items.updated_at`, and matched `marketplace_listing_mappings`.
- Pricing opportunities: `inventory_price_reviews.status = needs_review`.
- Store counts: `crm_customers`, `workspace_employees`, `vendors`, and `supplies` when workspace access supports them.

Owner/Admin access expands feature visibility but never widens tenant data boundaries. Metrics remain scoped to the authenticated user and canonical workspace where the underlying table requires workspace scope.

## Metrics

### Executive Brief

Status: Implemented

Definition: deterministic text derived from revenue, prior revenue, order count, prior order count, AOV, prior AOV, and connected channels.

Formula:

- Revenue change = `(current revenue - prior revenue) / prior revenue`.
- If revenue declines while orders increase and AOV declines, the explanation states that lower AOV drove the revenue decline.
- If comparable data is unavailable, the brief reports facts only.

Limitations: The brief does not infer causes outside the available metrics.

### Today's Docks Brief

Status: Implemented

Definition: a concise structured summary of orders, revenue, revenue movement, fulfillment, attribution, leading channel, and top signal.

Formula: concatenates deterministic sentences from the current summary object.

Limitations: No external AI call or opaque scoring is used.

### Profit Confidence

Status: Implemented

Definition: confidence that profit/COGS reporting is backed by matched sold inventory units.

Formula:

- Coverage = `matched sold units / total sold units`.
- High: `>= 80%`.
- Medium: `>= 40% and < 80%`.
- Low: `< 40%`.

Required coverage: marketplace order lines must have `match_status = matched` and an `inventory_item_id`.

Limitations: Profit can be unavailable even when revenue exists if order/item cost basis is incomplete.

### Inventory Attribution

Status: Implemented

Definition: how much imported order data is matched to owned inventory.

Formula:

- Line coverage = `matched order lines / total order lines`.
- Complete order count = orders where every line is matched to inventory.

Required coverage: `marketplace_order_items.match_status` and `inventory_item_id`.

Limitations: Orders with no imported lines count as incomplete attribution.

### Capital At Risk

Status: Implemented

Definition: inventory value tied up in stale inventory.

Formula:

- Stale threshold: `90 days`.
- Capital at risk = sum of `inventory_value` for rows with `updated_at` older than the threshold.

Required coverage: `inventory_items.inventory_value` and `inventory_items.updated_at`.

Limitations: Rows without inventory value do not contribute to stale-value dollars but do affect coverage.

### Inventory Capital

Status: Implemented

Definition: sampled inventory value split across total, listed, unlisted, and stale value.

Formula:

- Total value = sum of `inventory_items.inventory_value`.
- Listed value = inventory value for rows with matched `marketplace_listing_mappings.inventory_item_id`.
- Unlisted value = `total value - listed value`.
- Value coverage = rows with positive inventory value divided by sampled rows.

Limitations: The current loader samples up to 1,000 inventory rows to keep dashboard rendering bounded. Full inventory-capital analytics should move to a dedicated aggregate or materialized view if the store scale requires it.

### Sell-Through

Status: Planned

Definition: units sold during a period divided by eligible available inventory.

Reason deferred: the current dashboard lacks a canonical eligible inventory denominator by channel and product state. It should not be displayed until that denominator is authoritative.

### Average Days To Sale

Status: Planned

Definition: median days between acquisition/listing timestamp and sale timestamp.

Reason deferred: acquisition/listing provenance is not yet consistently linked to sold order lines.

### Pricing Position

Status: Partially Implemented

Definition: pricing opportunity signals currently use `inventory_price_reviews` as the supported canonical review queue.

Reason limited: exact-SKU marketplace listing price versus market-price comparison requires complete listing/enrichment coverage. The dashboard does not compare unmatched products.

## Signals

Status: Implemented

`TradingDocksSignal` fields:

- `id`
- `type`
- `priority`
- `title`
- `description`
- `metric`
- `impact`
- `actionLabel`
- `actionHref`
- `evidence`

Priorities are threshold-based:

- Critical: sync failures.
- High: large fulfillment queues, low attribution coverage, high stale capital, larger pricing queues.
- Medium: operational work below high thresholds.
- Info: fast movers derived from repeated sold quantities.

Signals are not AI scores. Evidence strings identify the table/status condition behind each signal.

## Next Best Action Ranking

Status: Implemented

Definition: ranked deterministic actions generated from supported signals and setup state.

Formula:

- Base score = signal priority rank multiplied by 100.
- Numeric metric magnitude is added where parseable.
- Setup tasks use lower fixed scores so urgent operational work appears first.

Categories:

- Operational
- Data quality
- Pricing
- Setup

Limitations: The ranking is deterministic and transparent. It does not perform predictive modeling.

## Channel Performance 2.0

Status: Implemented

Definition: compact channel matrix with sales, orders, AOV, revenue contribution, prior-period movement, status, and last sync availability in the summary model.

Formula:

- Contribution = channel revenue divided by total connected-channel revenue.
- Revenue/order/AOV movement compares the current range to the prior equivalent range.

Limitations: Channel efficiency after fees is deferred until canonical channel fee data is available.

## What Changed

Status: Implemented

Definition: current range minus prior equivalent range for revenue, orders, AOV, unmatched lines, and profit estimate.

Limitations: Deltas show `Pending` when comparable prior values are unavailable.

## Opportunity Feed

Status: Implemented

Definition: compact feed derived from supported signals and fast-moving sold items.

Examples:

- Fulfillment opportunity from open orders.
- Pricing opportunity from repricing reviews.
- Data-quality opportunity from unmatched order lines.
- Stale-capital opportunity from inventory capital at risk.

Limitations: Buy opportunities and live market-spread opportunities require canonical buy targets and exact-SKU pricing coverage.
