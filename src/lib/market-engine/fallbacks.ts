import {
  normalizeCard,
  proxyImage,
} from "./helpers";
import type {
  GameId,
  MarketCard,
} from "./types";

type FallbackMarketSeed = {
  name: string;
  setName: string;
  marketPrice: number;
  inventoryOwned: number;
  image: string;
  change24h: number;
  change7d: number;
  subtitle?: string;
};

export function fallbackCards(
  game: GameId,
): MarketCard[] {
  const data: Record<GameId, FallbackMarketSeed[]> = {
    magic: [
      {
        name: "Cavern of Souls",
        setName: "Lost Caverns of Ixalan",
        marketPrice: 47.8,
        inventoryOwned: 6,
        image: "",
        change24h: 0.38,
        change7d: 1.34,
        subtitle: "Commander demand steady",
      },
      {
        name: "Rhystic Study",
        setName: "Wilds of Eldraine: Enchanting Tales",
        marketPrice: 31.25,
        inventoryOwned: 4,
        image: "",
        change24h: -0.22,
        change7d: -0.82,
        subtitle: "Reprint pressure visible",
      },
      {
        name: "The One Ring",
        setName: "Tales of Middle-earth",
        marketPrice: 82.4,
        inventoryOwned: 2,
        image: "",
        change24h: 0.08,
        change7d: 0.46,
        subtitle: "High-volume staple",
      },
      {
        name: "Sheoldred, the Apocalypse",
        setName: "Dominaria United",
        marketPrice: 63.1,
        inventoryOwned: 3,
        image: "",
        change24h: -0.41,
        change7d: -1.18,
        subtitle: "Competitive demand cooling",
      },
    ],
    pokemon: [
      {
        name: "Charizard ex",
        setName: "Obsidian Flames",
        marketPrice: 38.65,
        inventoryOwned: 5,
        image: proxyImage("https://images.pokemontcg.io/sv3/125.png"),
        change24h: 0.18,
        change7d: 1.02,
      },
      {
        name: "Pikachu ex",
        setName: "Surging Sparks",
        marketPrice: 34.2,
        inventoryOwned: 8,
        image: proxyImage("https://images.pokemontcg.io/sv8/238.png"),
        change24h: -0.31,
        change7d: -1.64,
      },
      {
        name: "Gengar VMAX",
        setName: "Fusion Strike",
        marketPrice: 415,
        inventoryOwned: 1,
        image: proxyImage("https://images.pokemontcg.io/swsh8/271.png"),
        change24h: 0.04,
        change7d: 0.72,
      },
      {
        name: "Mew ex",
        setName: "Pokemon 151",
        marketPrice: 23.4,
        inventoryOwned: 11,
        image: "",
        change24h: -0.12,
        change7d: 0.2,
      },
    ],
    "pokemon-japan": [
      { name: "Charizard ex", setName: "Pokemon Card 151 JP", marketPrice: 112.5, inventoryOwned: 2, image: "", change24h: 0.26, change7d: 1.48 },
      { name: "Umbreon VMAX", setName: "VMAX Climax", marketPrice: 486, inventoryOwned: 1, image: "", change24h: -0.18, change7d: -0.64 },
      { name: "Pikachu ex", setName: "Super Electric Breaker", marketPrice: 83.25, inventoryOwned: 3, image: "", change24h: 0.05, change7d: 0.31 },
      { name: "Gengar", setName: "VSTAR Universe", marketPrice: 74.8, inventoryOwned: 2, image: "", change24h: -0.34, change7d: -1.12 },
    ],
    lorcana: [
      { name: "Mickey Mouse - Brave Little Tailor", setName: "The First Chapter", marketPrice: 410, inventoryOwned: 2, image: "", change24h: 0.14, change7d: 0.88 },
      { name: "Stitch - Carefree Surfer", setName: "The First Chapter", marketPrice: 286, inventoryOwned: 1, image: "", change24h: -0.24, change7d: -1.35 },
      { name: "Maleficent - Monstrous Dragon", setName: "The First Chapter", marketPrice: 219, inventoryOwned: 3, image: "", change24h: 0.02, change7d: 0.18 },
      { name: "Elsa - Spirit of Winter", setName: "The First Chapter", marketPrice: 1267.58, inventoryOwned: 1, image: "", change24h: -0.09, change7d: 0.54 },
    ],
    "one-piece": [
      { name: "Nami", setName: "Romance Dawn", marketPrice: 185, inventoryOwned: 5, image: "", change24h: 0.44, change7d: 2.1 },
      { name: "Trafalgar Law", setName: "Pillars of Strength", marketPrice: 142, inventoryOwned: 4, image: "", change24h: -0.2, change7d: -0.92 },
      { name: "Roronoa Zoro", setName: "One Piece Card Game", marketPrice: 325, inventoryOwned: 1, image: "", change24h: 0.08, change7d: 0.66 },
      { name: "Monkey.D.Luffy", setName: "One Piece Card Game", marketPrice: 980, inventoryOwned: 1, image: "", change24h: -0.16, change7d: -0.28 },
    ],
  } satisfies Record<GameId, FallbackMarketSeed[]>;

  return data[game].map((seed, index) =>
    normalizeCard({
      id: `${game}-${index}`,
      game,
      name: seed.name,
      subtitle: seed.subtitle ?? "Snapshot preview",
      setName: seed.setName,
      setCode: "",
      collectorNumber: "",
      image: seed.image,
      marketPrice: seed.marketPrice,
      inventoryOwned: seed.inventoryOwned,
      index,
      change24h: seed.change24h,
      change7d: seed.change7d,
      source: "Sample market snapshot",
      dataQuality: "fallback",
    }),
  );
}
