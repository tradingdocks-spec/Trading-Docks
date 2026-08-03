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
  marketPrice: number;
  lowPrice: number;
  change24h: number;
  change7d: number;
  inventoryOwned: number;
  potentialRevenue: number;
  demand: "High" | "Medium" | "Low";
  volumeScore: number;
  opportunityScore: number;
  sparkline: number[];
  source: string;
  sourceUrl?: string;
  dataQuality: "live" | "reference" | "fallback";
  signal: MarketSignal;
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
