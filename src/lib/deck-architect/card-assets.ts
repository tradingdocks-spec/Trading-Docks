import type { CollectionGraphCard, DeckRequirement } from "./types.ts";

type ImageIdentity = Pick<
  CollectionGraphCard | DeckRequirement,
  "name" | "imageUri" | "setCode" | "collectorNumber" | "tcgplayerId"
>;

export function resolveDeckCardImageUri(card: ImageIdentity): string {
  if (card.imageUri) return card.imageUri;
  const params = new URLSearchParams({ name: card.name });
  if (card.setCode) params.set("set", card.setCode);
  if (card.collectorNumber) params.set("collectorNumber", card.collectorNumber);
  if (card.tcgplayerId) params.set("tcgplayerProductId", String(card.tcgplayerId));
  return `/api/deck-vault/card-image?${params.toString()}`;
}
