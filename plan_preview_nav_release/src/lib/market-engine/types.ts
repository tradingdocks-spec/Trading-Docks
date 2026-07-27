export type GameId =
  | "magic"
  | "pokemon"
  | "lorcana"
  | "one-piece";

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
};

export type MarketPayload = {
  updatedAt: string;
  refreshSeconds: number;
  games: Record<GameId, MarketCard[]>;
};
