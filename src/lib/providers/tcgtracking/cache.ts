import {
  TCGTRACKING_PRICING_CACHE_HOURS,
  TCGTRACKING_STATIC_CACHE_DAYS,
} from "./pricing.ts";

export type TcgTrackingCacheTableProposal = {
  table: string;
  purpose: string;
  ttl: string;
  authoritative: false;
  keys: string[];
};

export const TCGTRACKING_CACHE_TABLE_PROPOSAL: TcgTrackingCacheTableProposal[] = [
  {
    table: "tcgtracking_product_mappings",
    purpose: "Static cross-provider identity enrichment mapped to existing TCGplayer product identity.",
    ttl: `${TCGTRACKING_STATIC_CACHE_DAYS}+ days`,
    authoritative: false,
    keys: ["category_id", "tcgplayer_product_id", "scryfall_id"],
  },
  {
    table: "tcgtracking_price_snapshots",
    purpose: "Daily pricing and listing-depth snapshots by exact SKU.",
    ttl: `${TCGTRACKING_PRICING_CACHE_HOURS} hours`,
    authoritative: false,
    keys: ["provider_sku_id", "tcgplayer_sku_id", "captured_at"],
  },
  {
    table: "tcgtracking_sync_runs",
    purpose: "Bounded admin sync run state, checkpoints, errors, and freshness.",
    ttl: "Operational history; prune after retention decision",
    authoritative: false,
    keys: ["id", "category_id", "sync_kind", "status"],
  },
];

export function tcgTrackingCachePolicy() {
  return {
    staticDataTtlDays: TCGTRACKING_STATIC_CACHE_DAYS,
    pricingTtlHours: TCGTRACKING_PRICING_CACHE_HOURS,
    readBehavior:
      "Use cached/local Trading Docks data during provider outages; never require live provider uptime for normal card renders.",
    writeBehavior:
      "Provider sync may enrich catalog identity and pricing caches, but must not create user inventory rows.",
  };
}
