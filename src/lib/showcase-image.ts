import { tcgTrackingProductImageUrl } from "./card-image-authority.ts";

export type ShowcaseImageCard = {
  game?: string | null;
  image_url?: string | null;
  provider_image_url?: string | null;
  scryfall_id?: string | null;
  set_code?: string | null;
  collector_number?: string | null;
  provider_product_id?: string | null;
  tcgplayer_product_id?: number | string | null;
};

const TRUSTED_IMAGE_HOSTS = new Set(["api.scryfall.com", "cards.scryfall.io", "cdn.tcgtracking.com", "tcgplayer-cdn.tcgplayer.com", "product-images.tcgplayer.com"]);

function safeImageUrl(value: string | null | undefined) {
  const raw = value?.trim();
  if (!raw) return null;
  if (raw.startsWith("/")) return raw;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && TRUSTED_IMAGE_HOSTS.has(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function showcaseImageCandidates(card: ShowcaseImageCard) {
  const candidates: string[] = [];
  const add = (value: string | null | undefined) => {
    const safe = safeImageUrl(value);
    if (safe && !candidates.includes(safe)) candidates.push(safe);
  };
  add(card.image_url);
  add(card.provider_image_url);
  const game = String(card.game ?? "").toLowerCase();
  if (game.includes("magic") || card.scryfall_id || (card.set_code && card.collector_number)) {
    if (card.scryfall_id) {
      add(`https://api.scryfall.com/cards/${encodeURIComponent(card.scryfall_id)}?format=image&version=normal`);
      add(`https://api.scryfall.com/cards/${encodeURIComponent(card.scryfall_id)}?format=image&version=small`);
    }
    if (card.set_code && card.collector_number) {
      const set = encodeURIComponent(card.set_code.toLowerCase());
      const number = encodeURIComponent(card.collector_number);
      add(`https://api.scryfall.com/cards/${set}/${number}?format=image&version=normal`);
      add(`https://api.scryfall.com/cards/${set}/${number}?format=image&version=small`);
    }
  }
  add(tcgTrackingProductImageUrl(card.tcgplayer_product_id ?? card.provider_product_id));
  return candidates;
}
