import type { TcgTrackingPriceSnapshot } from "./types.ts";

export type TradingDocksMarketSnapshot = {
  tcgMarket: number | null;
  tcgLow: number | null;
  tcgHigh: number | null;
  activeListings: number | null;
  manapoolLow: number | null;
  updatedAt: string;
  freshness: "fresh" | "stale" | "missing";
  spreadPercent: number | null;
  crossMarketSpread: number | null;
  liquidity: "high" | "medium" | "low" | "unknown";
};

export const TCGTRACKING_STATIC_CACHE_DAYS = 7;
export const TCGTRACKING_PRICING_CACHE_HOURS = 24;

export function marketSnapshotFromTcgTracking(
  snapshot: TcgTrackingPriceSnapshot | null,
  now = new Date(),
): TradingDocksMarketSnapshot {
  if (!snapshot) {
    return {
      tcgMarket: null,
      tcgLow: null,
      tcgHigh: null,
      activeListings: null,
      manapoolLow: null,
      updatedAt: "",
      freshness: "missing",
      spreadPercent: null,
      crossMarketSpread: null,
      liquidity: "unknown",
    };
  }

  const updatedAt = new Date(snapshot.updatedAt);
  const ageHours = Number.isFinite(updatedAt.getTime())
    ? (now.getTime() - updatedAt.getTime()) / 3_600_000
    : Infinity;

  return {
    tcgMarket: snapshot.tcgMarket,
    tcgLow: snapshot.tcgLow,
    tcgHigh: snapshot.tcgHigh,
    activeListings: snapshot.activeListings,
    manapoolLow: snapshot.manapoolLow,
    updatedAt: snapshot.updatedAt,
    freshness:
      ageHours <= TCGTRACKING_PRICING_CACHE_HOURS ? "fresh" : "stale",
    spreadPercent: spreadPercent(snapshot.tcgMarket, snapshot.tcgLow),
    crossMarketSpread: crossMarketSpread(snapshot.tcgLow, snapshot.manapoolLow),
    liquidity: liquidityLabel(snapshot.activeListings),
  };
}

export function spreadPercent(
  market: number | null,
  low: number | null,
) {
  if (!market || market <= 0 || low == null) return null;
  return Math.round(((market - low) / market) * 10_000) / 100;
}

export function crossMarketSpread(
  tcgLow: number | null,
  manapoolLow: number | null,
) {
  if (tcgLow == null || manapoolLow == null) return null;
  return Math.round((tcgLow - manapoolLow) * 100) / 100;
}

export function liquidityLabel(
  activeListings: number | null | undefined,
): TradingDocksMarketSnapshot["liquidity"] {
  if (activeListings == null) return "unknown";
  if (activeListings >= 50) return "high";
  if (activeListings >= 12) return "medium";
  return "low";
}
