import {
  normalizeCard,
  proxyImage,
} from "./helpers";
import type {
  GameId,
  MarketCard,
} from "./types";

export function fallbackCards(
  game: GameId,
): MarketCard[] {
  const data = {
    magic: [
      ["Mana Crypt", "Kaladesh Inventions", 477.42, 12, ""],
      ["Force of Will", "Alliances", 72.51, 7, ""],
      ["The One Ring", "The Lord of the Rings", 89.74, 18, ""],
      ["Underground Sea", "Revised Edition", 799, 3, ""],
    ],
    pokemon: [
      [
        "Charizard ex",
        "Obsidian Flames",
        54.75,
        8,
        proxyImage(
          "https://images.pokemontcg.io/sv3/125.png",
        ),
      ],
      [
        "Umbreon VMAX",
        "Evolving Skies",
        1280,
        2,
        proxyImage(
          "https://images.pokemontcg.io/swsh7/215.png",
        ),
      ],
      [
        "Pikachu ex",
        "Surging Sparks",
        34.2,
        14,
        proxyImage(
          "https://images.pokemontcg.io/sv8/238.png",
        ),
      ],
      [
        "Gengar VMAX",
        "Fusion Strike",
        415,
        4,
        proxyImage(
          "https://images.pokemontcg.io/swsh8/271.png",
        ),
      ],
    ],
    "pokemon-japan": [
      ["リザードンex", "ポケモンカード151", 112.5, 3, ""],
      ["ブラッキーVMAX", "VMAXクライマックス", 486, 1, ""],
      ["ピカチュウex", "超電ブレイカー", 83.25, 4, ""],
      ["ゲンガー", "VSTARユニバース", 74.8, 2, ""],
    ],
    lorcana: [
      ["Elsa — Spirit of Winter", "The First Chapter", 1267.58, 2, ""],
      ["Mickey Mouse — Brave Little Tailor", "The First Chapter", 410, 5, ""],
      ["Stitch — Carefree Surfer", "The First Chapter", 286, 3, ""],
      ["Maleficent — Monstrous Dragon", "The First Chapter", 219, 1, ""],
    ],
    "one-piece": [
      ["Monkey.D.Luffy", "One Piece Card Game", 980, 6, ""],
      ["Nami", "One Piece Card Game", 185, 16, ""],
      ["Roronoa Zoro", "One Piece Card Game", 325, 2, ""],
      ["Trafalgar Law", "One Piece Card Game", 142, 9, ""],
    ],
  } satisfies Record<
    GameId,
    Array<[string, string, number, number, string]>
  >;

  return data[game].map(
    (
      [
        name,
        setName,
        marketPrice,
        inventoryOwned,
        image,
      ],
      index,
    ) =>
      normalizeCard({
        id: `${game}-${index}`,
        game,
        name,
        subtitle: "Market mover",
        setName,
        setCode: "",
        collectorNumber: "",
        image,
        marketPrice,
        inventoryOwned,
        index,
        source: "Built-in market reference",
        dataQuality: "fallback",
      }),
  );
}
