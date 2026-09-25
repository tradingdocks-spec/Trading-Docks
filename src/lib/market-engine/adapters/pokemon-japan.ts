import {
  money,
  normalizeCard,
  proxyImage,
} from "../helpers";
import type { MarketCard } from "../types";

const REVALIDATE_SECONDS = 300;

type ExternalJapaneseCard = {
  id?: string;
  name?: string;
  setName?: string;
  setCode?: string;
  collectorNumber?: string;
  image?: string;
  marketPrice?: number | string;
  inventoryOwned?: number;
};

const REFERENCE_CARDS = [
  {
    id: "jp-sv2a-201",
    name: "リザードンex",
    englishName: "Charizard ex",
    setName: "ポケモンカード151",
    setCode: "SV2a",
    collectorNumber: "201/165",
    image: "https://images.pokemontcg.io/sv3/125.png",
    marketPrice: 112.5,
    owned: 3,
  },
  {
    id: "jp-s8b-245",
    name: "ブラッキーVMAX",
    englishName: "Umbreon VMAX",
    setName: "VMAXクライマックス",
    setCode: "S8b",
    collectorNumber: "245/184",
    image: "https://images.pokemontcg.io/swsh7/215.png",
    marketPrice: 486,
    owned: 1,
  },
  {
    id: "jp-sv8-132",
    name: "ピカチュウex",
    englishName: "Pikachu ex",
    setName: "超電ブレイカー",
    setCode: "SV8",
    collectorNumber: "132/106",
    image: "https://images.pokemontcg.io/sv8/238.png",
    marketPrice: 83.25,
    owned: 4,
  },
  {
    id: "jp-s12a-230",
    name: "ゲンガー",
    englishName: "Gengar",
    setName: "VSTARユニバース",
    setCode: "S12a",
    collectorNumber: "230/172",
    image: "https://images.pokemontcg.io/swsh8/271.png",
    marketPrice: 74.8,
    owned: 2,
  },
] as const;

export async function loadPokemonJapan(): Promise<MarketCard[]> {
  const endpoint = process.env.POKEMON_JAPAN_MARKET_ENDPOINT;

  if (endpoint) {
    const response = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
        ...(process.env.POKEMON_JAPAN_MARKET_API_KEY
          ? {
              Authorization: `Bearer ${process.env.POKEMON_JAPAN_MARKET_API_KEY}`,
            }
          : {}),
      },
      next: { revalidate: REVALIDATE_SECONDS },
    });

    if (response.ok) {
      const payload = await response.json();
      const cards: ExternalJapaneseCard[] = Array.isArray(payload)
        ? payload
        : payload.cards ?? payload.data ?? [];

      const normalized = cards
        .slice(0, 8)
        .map((card, index) =>
          normalizeCard({
            id: card.id ?? `pokemon-japan-${index}`,
            game: "pokemon-japan",
            name: card.name ?? `Japanese Pokémon card ${index + 1}`,
            subtitle: "Japanese printing",
            setName: card.setName ?? "Pokémon Card Game Japan",
            setCode: card.setCode ?? "",
            collectorNumber: card.collectorNumber ?? "",
            image: proxyImage(card.image),
            marketPrice: money(card.marketPrice),
            inventoryOwned: card.inventoryOwned ?? 0,
            index,
            source: "Configured Japanese market feed",
            sourceUrl: endpoint,
            dataQuality: "live",
          }),
        )
        .filter((card) => card.marketPrice !== null && card.marketPrice > 0);

      if (normalized.length) return normalized;
    }
  }

  return REFERENCE_CARDS.map((card, index) =>
    normalizeCard({
      id: card.id,
      game: "pokemon-japan",
      name: card.name,
      subtitle: `${card.englishName} · Japanese reference`,
      setName: card.setName,
      setCode: card.setCode,
      collectorNumber: card.collectorNumber,
      image: proxyImage(card.image),
      marketPrice: card.marketPrice,
      inventoryOwned: card.owned,
      index,
      source: "Japanese market reference",
      dataQuality: "reference",
    }),
  );
}
