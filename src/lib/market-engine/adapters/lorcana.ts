import {
  money,
  normalizeCard,
  proxyImage,
} from "../helpers";
import type { MarketCard } from "../types";

const REVALIDATE_SECONDS = 300;

export async function loadLorcana(): Promise<MarketCard[]> {
  const searches = [
    "elsa rarity:enchanted",
    "mickey rarity:enchanted",
    "stitch rarity:enchanted",
    "maleficent rarity:enchanted",
  ];

  return Promise.all(
    searches.map(async (query, index) => {
      const params = new URLSearchParams({
        q: query,
        unique: "prints",
      });

      const response = await fetch(
        `https://api.lorcast.com/v0/cards/search?${params.toString()}`,
        {
          headers: {
            Accept: "application/json",
          },
          next: {
            revalidate: REVALIDATE_SECONDS,
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          `Lorcast returned ${response.status}.`,
        );
      }

      const payload = await response.json();
      const card =
        (payload.results ?? [])
          .sort(
            (a: any, b: any) =>
              Math.max(
                money(b.prices?.usd),
                money(b.prices?.usd_foil),
              ) -
              Math.max(
                money(a.prices?.usd),
                money(a.prices?.usd_foil),
              ),
          )[0] ?? null;

      if (!card) {
        throw new Error(
          `No Lorcana card found for ${query}.`,
        );
      }

      return normalizeCard({
        id: card.id,
        game: "lorcana",
        name: [card.name, card.version]
          .filter(Boolean)
          .join(" — "),
        subtitle: card.rarity ?? "Lorcana",
        setName:
          card.set?.name ??
          "Disney Lorcana",
        setCode: card.set?.code ?? "",
        collectorNumber:
          card.collector_number ?? "",
        image: proxyImage(
          card.image_uris?.digital?.small ??
            card.image_uris?.digital?.normal,
        ),
        marketPrice: Math.max(
          money(card.prices?.usd),
          money(card.prices?.usd_foil),
        ),
        inventoryOwned: [2, 5, 3, 1][index],
        index,
        source: "Lorcast",
        sourceUrl: "https://lorcast.com/docs/api/cards",
        dataQuality: "live",
      });
    }),
  );
}
