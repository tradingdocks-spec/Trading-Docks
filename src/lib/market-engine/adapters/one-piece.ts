import {
  firstMoney,
  normalizeCard,
  proxyImage,
} from "../helpers";
import type { MarketCard } from "../types";

const REVALIDATE_SECONDS = 300;

export async function loadOnePiece(): Promise<MarketCard[]> {
  const ids = [
    "OP05-119",
    "OP01-016",
    "OP06-118",
    "OP05-067",
  ];

  return Promise.all(
    ids.map(async (id, index) => {
      const response = await fetch(
        `https://optcgapi.com/api/sets/card/${id}/`,
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
          `OPTCG API returned ${response.status}.`,
        );
      }

      const raw = await response.json();
      const card = Array.isArray(raw)
        ? raw[0]
        : raw;

      if (!card) {
        throw new Error(
          `No One Piece card found for ${id}.`,
        );
      }

      return normalizeCard({
        id,
        game: "one-piece",
        name:
          card.card_name ??
          card.name ??
          id,
        subtitle:
          card.card_rarity ??
          card.rarity ??
          "One Piece",
        setName:
          card.card_set_name ??
          card.set_name ??
          card.set ??
          "One Piece Card Game",
        setCode:
          card.card_set_id ??
          card.set_id ??
          id.split("-")[0],
        collectorNumber:
          card.card_id ??
          card.card_number ??
          id,
        image: proxyImage(
          card.card_image ??
            card.image ??
            card.image_url ??
            card.card_image_url,
        ),
        marketPrice: firstMoney(
          card.market_price,
          card.cardmarket_price,
          card.tcgplayer_price,
          card.price,
        ),
        inventoryOwned:
          [6, 16, 2, 9][index],
        index,
      });
    }),
  );
}
