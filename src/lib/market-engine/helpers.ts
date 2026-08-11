import type {
  GameId,
  MarketCard,
  MarketSignal,
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
  const change24h = input.change24h ?? deterministicChange(input.id, input.index, 1);
  const change7d = input.change7d ?? deterministicChange(input.id, input.index, 7);
  const volumeScore = deterministicScore(input.id, input.index, 58, 99);
  const opportunityScore = deterministicScore(
    `${input.id}-opportunity`,
    input.index,
    42,
    96,
  );
  const signal = deriveSignal(change7d, volumeScore, opportunityScore);

  return {
    id: input.id,
    game: input.game,
    name: input.name,
    subtitle: input.subtitle,
    setName: input.setName,
    setCode: input.setCode,
    collectorNumber: input.collectorNumber,
    image: input.image,
    marketPrice: round(input.marketPrice),
    lowPrice: round(input.marketPrice * (0.89 + (input.index % 3) * 0.02)),
    change24h,
    change7d,
    inventoryOwned: input.inventoryOwned,
    potentialRevenue: round(input.marketPrice * input.inventoryOwned),
    demand:
      volumeScore >= 84
        ? "High"
        : volumeScore >= 68
          ? "Medium"
          : "Low",
    volumeScore,
    opportunityScore,
    sparkline: deterministicSparkline(
      input.id,
      input.index,
      input.marketPrice,
      change7d,
    ),
    source: input.source ?? "Market reference",
    sourceUrl: input.sourceUrl,
    dataQuality: input.dataQuality ?? "live",
    signal,
  };
}

export function deterministicChange(
  id: string,
  index: number,
  period: number,
) {
  const code = hashCode(id);
  const limit = period === 1 ? 4.5 : 12;

  return Number(
    (
      Math.sin((code + index * 19 + period * 13) * 0.09) *
      limit
    ).toFixed(2),
  );
}

export function deterministicScore(
  id: string,
  index: number,
  minimum: number,
  maximum: number,
) {
  const code = hashCode(id) + index * 31;
  const normalized = (Math.sin(code * 0.071) + 1) / 2;
  return Math.round(minimum + normalized * (maximum - minimum));
}

export function deterministicSparkline(
  id: string,
  index: number,
  price: number,
  change7d: number,
) {
  const code = hashCode(id) + index * 23;
  const base = Math.max(price, 1);
  return Array.from({ length: 12 }, (_, point) => {
    const progress = point / 11;
    const trend = (change7d / 100) * progress;
    const wave = Math.sin((code + point * 17) * 0.13) * 0.028;
    return round(base * (1 + trend + wave));
  });
}

function deriveSignal(
  change7d: number,
  volumeScore: number,
  opportunityScore: number,
): MarketSignal {
  if (opportunityScore >= 84) return "opportunity";
  if (volumeScore >= 88) return "volume";
  return change7d >= 0 ? "gainer" : "loser";
}

function hashCode(id: string) {
  return [...id].reduce(
    (sum, character) => sum + character.charCodeAt(0),
    0,
  );
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
