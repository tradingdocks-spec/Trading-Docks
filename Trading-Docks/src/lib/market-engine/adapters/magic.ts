import {
  money,
  normalizeCard,
} from "../helpers";
import type { MarketCard } from "../types";

const REVALIDATE_SECONDS = 300;

export async function loadMagic(): Promise<MarketCard[]> {
  const seeds = [
    ["mps", "16", "Mana Crypt", 12],
    ["all", "28", "Force of Will", 7],
    ["ltr", "246", "The One Ring", 18],
    ["3ed", "290", "Underground Sea", 3],
  ] as const;

  return Promise.all(
    seeds.map(
      async (
        [set, collectorNumber, fallbackName, owned],
        index,
      ) => {
        const response = await fetch(
          `https://api.scryfall.com/cards/${set}/${collectorNumber}`,
          {
            headers: {
              Accept: "application/json",
              "User-Agent": "TradingDocks/1.0",
            },
            next: {
              revalidate: REVALIDATE_SECONDS,
            },
          },
        );

        if (!response.ok) {
          throw new Error(
            `Scryfall returned ${response.status}.`,
          );
        }

        const card = await response.json();

        return normalizeCard({
          id: card.id ?? `${set}-${collectorNumber}`,
          game: "magic",
          name: card.name ?? fallbackName,
          subtitle: card.reserved
            ? "Reserved List"
            : card.edhrec_rank
              ? `EDHREC #${card.edhrec_rank.toLocaleString()}`
              : card.rarity ?? "Magic",
          setName: card.set_name ?? set.toUpperCase(),
          setCode: card.set ?? set,
          collectorNumber:
            card.collector_number ?? collectorNumber,
          image:
            `/api/landing-card-image/${set}/${collectorNumber}` +
            "?version=small",
          marketPrice: money(card.prices?.usd),
          inventoryOwned: owned,
          index,
        });
      },
    ),
  );
}
