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
}): MarketCard {
  const change24h = deterministicChange(
    input.id,
    input.index,
    1,
  );
  const change7d = deterministicChange(
    input.id,
    input.index,
    7,
  );

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
    lowPrice: round(
      input.marketPrice *
        (0.89 + (input.index % 3) * 0.02),
    ),
    change24h,
    change7d,
    inventoryOwned: input.inventoryOwned,
    potentialRevenue: round(
      input.marketPrice * input.inventoryOwned,
    ),
    demand:
      Math.abs(change7d) >= 7
        ? "High"
        : Math.abs(change7d) >= 3
          ? "Medium"
          : "Low",
  };
}

export function deterministicChange(
  id: string,
  index: number,
  period: number,
) {
  const code = [...id].reduce(
    (sum, character) => sum + character.charCodeAt(0),
    0,
  );

  const limit = period === 1 ? 4.5 : 12;

  return Number(
    (
      Math.sin(
        (code + index * 19 + period * 13) * 0.09,
      ) * limit
    ).toFixed(2),
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

  const parsed = Number(
    value.replace(/[^0-9.-]+/g, ""),
  );

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
  return Number(
    (Number.isFinite(value) ? value : 0).toFixed(2),
  );
}
