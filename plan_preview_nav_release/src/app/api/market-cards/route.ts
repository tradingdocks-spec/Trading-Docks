import { NextResponse } from "next/server";

type MarketCardDefinition = {
  key: string;
  name: string;
  setCode: string;
  displaySet: string;
  price: number;
  change: number;
  history: number[];
};

type ScryfallCard = {
  id: string;
  name: string;
  set: string;
  set_name: string;
  collector_number: string;
  image_uris?: {
    small?: string;
    normal?: string;
    large?: string;
    art_crop?: string;
  };
  card_faces?: Array<{
    image_uris?: {
      small?: string;
      normal?: string;
      large?: string;
      art_crop?: string;
    };
  }>;
};

const CARDS: MarketCardDefinition[] = [
  {
    key: "mana-crypt",
    name: "Mana Crypt",
    setCode: "mps",
    displaySet: "Kaladesh Inventions",
    price: 477.42,
    change: 8.42,
    history: [32, 35, 33, 40, 37, 46, 43, 52, 49, 61],
  },
  {
    key: "force-of-will",
    name: "Force of Will",
    setCode: "all",
    displaySet: "Alliances",
    price: 72.51,
    change: 6.91,
    history: [25, 31, 28, 39, 34, 42, 40, 51, 47, 59],
  },
  {
    key: "the-one-ring",
    name: "The One Ring",
    setCode: "ltr",
    displaySet: "The Lord of the Rings",
    price: 89.74,
    change: 5.78,
    history: [18, 20, 25, 22, 34, 29, 41, 37, 48, 55],
  },
  {
    key: "underground-sea",
    name: "Underground Sea",
    setCode: "3ed",
    displaySet: "Revised Edition",
    price: 799,
    change: -2.1,
    history: [60, 56, 58, 50, 53, 45, 48, 40, 43, 35],
  },
];

export const revalidate = 21600;

export async function GET() {
  const cards = await Promise.all(
    CARDS.map(async (definition) => {
      const card = await fetchScryfallCard(
        definition.name,
        definition.setCode,
      );

      return {
        ...definition,
        scryfallId: card?.id ?? null,
        setCode: card?.set ?? definition.setCode,
        setName: card?.set_name ?? definition.displaySet,
        collectorNumber: card?.collector_number ?? null,
        image: card?.id
          ? `/api/scryfall-image/${encodeURIComponent(card.id)}?size=normal`
          : null,
      };
    }),
  );

  return NextResponse.json(
    { cards },
    {
      headers: {
        "Cache-Control":
          "public, s-maxage=21600, stale-while-revalidate=86400",
      },
    },
  );
}

async function fetchScryfallCard(
  name: string,
  setCode: string,
): Promise<ScryfallCard | null> {
  const exactParams = new URLSearchParams({
    exact: name,
    set: setCode,
  });

  const exactResponse = await fetch(
    `https://api.scryfall.com/cards/named?${exactParams.toString()}`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "TradingDocks/1.0",
      },
      next: { revalidate },
    },
  );

  if (exactResponse.ok) {
    return exactResponse.json();
  }

  const fallbackParams = new URLSearchParams({ exact: name });
  const fallbackResponse = await fetch(
    `https://api.scryfall.com/cards/named?${fallbackParams.toString()}`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "TradingDocks/1.0",
      },
      next: { revalidate },
    },
  );

  if (!fallbackResponse.ok) return null;
  return fallbackResponse.json();
}
