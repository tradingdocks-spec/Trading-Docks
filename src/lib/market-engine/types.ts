import type { IntelligenceValue } from "../intelligence-provenance.ts";

export type GameId =
  | "magic"
  | "pokemon"
  | "pokemon-japan"
  | "lorcana"
  | "one-piece";

export type MarketSignal = "gainer" | "loser" | "volume" | "opportunity";

export type MarketCard = {
  id: string;
  game: GameId;
  name: string;
  subtitle: string;
  setName: string;
  setCode: string;
  collectorNumber: string;
  image: string;
  marketPrice: number | null;
  lowPrice: number | null;
  change24h: number | null;
  change7d: number | null;
  inventoryOwned: number | null;
  potentialRevenue: number | null;
  demand: "High" | "Medium" | "Low" | null;
  volumeScore: number | null;
  opportunityScore: number | null;
  sparkline: number[];
  source: string;
  sourceUrl?: string;
  dataQuality: "live" | "reference" | "fallback";
  signal: MarketSignal | null;
  provenance: Record<"marketPrice" | "lowPrice" | "change24h" | "change7d" | "inventoryOwned" | "potentialRevenue" | "demand" | "volumeScore" | "opportunityScore" | "sparkline" | "signal", IntelligenceValue<unknown>>;
};

export type MarketGameStatus = {
  game: GameId;
  label: string;
  source: string;
  dataQuality: "live" | "reference" | "fallback";
  cardCount: number;
};

export type MarketPayload = {
  updatedAt: string;
  refreshSeconds: number;
  games: Record<GameId, MarketCard[]>;
  status: Record<GameId, MarketGameStatus>;
};
