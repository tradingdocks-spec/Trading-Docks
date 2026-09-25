import {
  money,
  normalizeCard,
  proxyImage,
} from "../helpers";
import type { MarketCard } from "../types";

const REVALIDATE_SECONDS = 300;

type PokemonSeed = {
  name: string;
  preferredIds: string[];
  owned: number;
  fallbackPrice: number;
};

const SEEDS: PokemonSeed[] = [
  {
    name: "Charizard ex",
    preferredIds: ["sv3-125"],
    owned: 8,
    fallbackPrice: 54.75,
  },
  {
    name: "Umbreon VMAX",
    preferredIds: ["swsh7-215"],
    owned: 2,
    fallbackPrice: 1280,
  },
  {
    name: "Pikachu ex",
    preferredIds: [
      "sv8-238",
      "sv4pt5-063",
      "sv4-063",
    ],
    owned: 14,
    fallbackPrice: 34.2,
  },
  {
    name: "Gengar VMAX",
    preferredIds: ["swsh8-271"],
    owned: 4,
    fallbackPrice: 415,
  },
];

export async function loadPokemon(): Promise<MarketCard[]> {
  return Promise.all(
    SEEDS.map(async (seed, index) => {
      const card = await findPokemonCard(seed);
      const selectedId =
        card?.id ?? seed.preferredIds[0];
      const [setCode, collectorNumber] =
        selectedId.split("-", 2);

      const officialImage =
        card?.images?.small ??
        card?.images?.large ??
        `https://images.pokemontcg.io/${setCode}/${collectorNumber}.png`;

      const prices = card?.tcgplayer?.prices ?? {};
      const priceObject =
        prices.holofoil ??
        prices.normal ??
        prices.reverseHolofoil ??
        prices["1stEditionHolofoil"] ??
        Object.values(prices)[0] ??
        {};

      const market =
        money(
          (priceObject as any).market ??
            (priceObject as any).mid,
        );

      return normalizeCard({
        id: selectedId,
        game: "pokemon",
        name: card?.name ?? seed.name,
        subtitle:
          card?.rarity ??
          card?.supertype ??
          "Pokémon",
        setName:
          card?.set?.name ??
          "Pokémon TCG",
        setCode:
          card?.set?.id ??
          setCode,
        collectorNumber:
          card?.number ??
          collectorNumber,
        image: proxyImage(officialImage),
        marketPrice: market,
        inventoryOwned: seed.owned,
        index,
        source: "Pokémon TCG API",
        sourceUrl: "https://docs.pokemontcg.io/",
        dataQuality: "live",
      });
    }),
  );
}

async function findPokemonCard(seed: PokemonSeed) {
  for (const id of seed.preferredIds) {
    const card = await getById(id);
    if (card?.images?.small || card?.images?.large) {
      return card;
    }
  }

  return searchByName(seed.name);
}

async function getById(id: string) {
  const response = await fetch(
    `https://api.pokemontcg.io/v2/cards/${id}`,
    {
      headers: pokemonHeaders(),
      next: {
        revalidate: REVALIDATE_SECONDS,
      },
    },
  );

  if (!response.ok) return null;

  const payload = await response.json();
  return payload.data ?? null;
}

async function searchByName(name: string) {
  const params = new URLSearchParams({
    q: `name:"${name}"`,
    pageSize: "100",
    orderBy: "-set.releaseDate",
  });

  const response = await fetch(
    `https://api.pokemontcg.io/v2/cards?${params.toString()}`,
    {
      headers: pokemonHeaders(),
      next: {
        revalidate: REVALIDATE_SECONDS,
      },
    },
  );

  if (!response.ok) return null;

  const payload = await response.json();
  const cards = payload.data ?? [];

  return [...cards]
    .filter(
      (card) =>
        card.images?.small ||
        card.images?.large,
    )
    .sort(
      (a, b) =>
        highestMarketPrice(b) -
        highestMarketPrice(a),
    )[0] ?? null;
}

function highestMarketPrice(card: any) {
  const prices = card.tcgplayer?.prices ?? {};

  return Math.max(
    0,
    ...Object.values(prices).map((price: any) =>
      money(price?.market ?? price?.mid),
    ),
  );
}

function pokemonHeaders() {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (process.env.POKEMON_TCG_API_KEY) {
    headers["X-Api-Key"] =
      process.env.POKEMON_TCG_API_KEY;
  }

  return headers;
}
