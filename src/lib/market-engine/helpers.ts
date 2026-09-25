import { intelligenceValue, missingIntelligence } from "../intelligence-provenance.ts";
import type {
  GameId,
  MarketCard,
} from "./types";

export function normalizeCard(input: {
  id: string;
  game: GameId;
  name: string;
  subtitle: string;
  setName: string;
  setCode: string;
  collectorNumber: string;
  image: string;
  marketPrice: number;
  inventoryOwned: number;
  index: number;
  change24h?: number;
  change7d?: number;
  source?: string;
  sourceUrl?: string;
  dataQuality?: "live" | "reference" | "fallback";
}): MarketCard {
  // This public market feed has no authenticated inventory context or observations
  // for demand/history. Seed counts, waves and reference prices are not evidence.
  const marketPrice = intelligenceValue<number>({
    value: input.marketPrice > 0 ? round(input.marketPrice) : null,
    status: input.dataQuality === "live" ? "OBSERVED" : "INSUFFICIENT_DATA",
    confidence: null, observedAt: null, sources: input.source ? [input.source] : [],
    inputs: [input.id], explanation: "Provider-reported quote; provider observation time unavailable. Not a realized sale.",
  });
  const unavailable = missingIntelligence("No observed data is available for this metric.");
  return {
    id: input.id, game: input.game, name: input.name, subtitle: input.subtitle,
    setName: input.setName, setCode: input.setCode, collectorNumber: input.collectorNumber,
    image: input.image, marketPrice: marketPrice.value,
    lowPrice: null, change24h: null, change7d: null, inventoryOwned: null,
    potentialRevenue: null, demand: null, volumeScore: null, opportunityScore: null,
    sparkline: [], source: input.source ?? "Unavailable", sourceUrl: input.sourceUrl,
    dataQuality: input.dataQuality ?? "fallback", signal: null,
    provenance: { marketPrice, lowPrice: unavailable, change24h: unavailable, change7d: unavailable,
      inventoryOwned: missingIntelligence("This public feed does not query owner inventory."),
      potentialRevenue: unavailable, demand: unavailable, volumeScore: unavailable,
      opportunityScore: unavailable, sparkline: unavailable, signal: unavailable },
  };
}
export function proxyImage(
  url: string | null | undefined,
) {
  return url
    ? `/api/tcg-image?url=${encodeURIComponent(url)}`
    : "";
}

export function money(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return 0;

  const parsed = Number(value.replace(/[^0-9.-]+/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function firstMoney(...values: unknown[]) {
  for (const value of values) {
    const parsed = money(value);
    if (parsed > 0) return parsed;
  }
  return 0;
}

export function round(value: number) {
  return Number((Number.isFinite(value) ? value : 0).toFixed(2));
}
