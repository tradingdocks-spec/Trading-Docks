export type CatalogConfidence = "exact" | "suggested" | "unmatched" | "unsupported";

export type CatalogEnrichment = {
  provider: "scryfall";
  status: CatalogConfidence;
  confidence: number;
  sourceTitle: string;
  normalizedTitle: string;
  catalogId?: string;
  name?: string;
  setCode?: string;
  setName?: string;
  collectorNumber?: string;
  imageUrl?: string;
  reason?: string;
  enrichedAt: string;
};

type ScryfallCard = {
  id: string;
  name: string;
  set: string;
  set_name: string;
  collector_number: string;
  image_uris?: { small?: string; normal?: string };
  card_faces?: Array<{ image_uris?: { small?: string; normal?: string } }>;
};

const UNSUPPORTED = /\b(lot|bulk|playset|collection|repack|proxy|custom|deck|booster|box|bundle|case|pack|display|precon|commander deck|starter kit|multiple cards|assorted)\b/i;
const CONDITION = /\b(nm|near mint|lp|lightly played|mp|moderately played|hp|heavily played|dmg|damaged|mint)\b/gi;
const NOISE = /\b(mtg|magic(?: the gathering)?|wizards of the coast|wotc|single card|ships? fast|free shipping|english|authentic|rare|mythic|uncommon|common)\b/gi;
const FINISH = /\b(non[- ]?foil|foil|etched|showcase|borderless|extended art|retro frame|serialized|surge|textured|galaxy|halo|gilded|promo)\b/gi;

export function normalizeMarketplaceTitle(title: string) {
  return title.normalize("NFKC").replace(/[™®©]/g, "").replace(/\s+/g, " ").trim();
}

export function titleMayRepresentSingleCard(title: string) {
  if (UNSUPPORTED.test(title)) return false;
  const quantity = title.match(/(?:^|\s)(?:x|qty\s*)?(\d{1,3})(?:x|\s|$)/i)?.[1];
  return !quantity || Number(quantity) <= 1;
}

function titleHints(title: string) {
  const collector = title.match(/(?:#|no\.?\s*|collector\s*(?:no\.?|number)?\s*)([a-z]?\d{1,5}[a-z]?)/i)?.[1];
  const setCode = title.match(/(?:\[|\()([a-z0-9]{3,5})(?:\]|\))/i)?.[1];
  return { collector, setCode };
}

function searchName(title: string) {
  const primaryClause = normalizeMarketplaceTitle(title).split(/\s+(?:\||—|–|-|\/\/)\s+/)[0];
  const cleaned = primaryClause
    .replace(CONDITION, " ").replace(FINISH, " ").replace(NOISE, " ")
    .replace(/(?:#|no\.?\s*|collector\s*(?:no\.?|number)?\s*)[a-z]?\d{1,5}[a-z]?/gi, " ")
    .replace(/(?:\[|\()[a-z0-9]{3,5}(?:\]|\))/gi, " ")
    .replace(/\b\d{4}\b/g, " ").replace(/[|,:;_+]+/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.slice(0, 120);
}

function image(card: ScryfallCard) {
  return card.image_uris?.small ?? card.image_uris?.normal
    ?? card.card_faces?.[0]?.image_uris?.small ?? card.card_faces?.[0]?.image_uris?.normal;
}

export async function enrichMagicListingTitle(title: string): Promise<CatalogEnrichment> {
  const sourceTitle = normalizeMarketplaceTitle(title);
  const base = { provider: "scryfall" as const, sourceTitle, normalizedTitle: searchName(sourceTitle), enrichedAt: new Date().toISOString() };
  if (!sourceTitle || !titleMayRepresentSingleCard(sourceTitle)) {
    return { ...base, status: "unsupported", confidence: 0, reason: "This appears to be a lot, sealed product, deck, or multi-card listing." };
  }
  if (base.normalizedTitle.length < 2) return { ...base, status: "unmatched", confidence: 0, reason: "The title did not contain a usable card name." };

  const hints = titleHints(sourceTitle);
  const params = new URLSearchParams({ fuzzy: base.normalizedTitle });
  if (hints.setCode) params.set("set", hints.setCode.toLowerCase());
  const response = await fetch(`https://api.scryfall.com/cards/named?${params}`, {
    headers: { Accept: "application/json", "User-Agent": "TradingDocks/1.0 catalog-enrichment" },
    signal: AbortSignal.timeout(8_000), cache: "no-store",
  });
  if (!response.ok) return { ...base, status: "unmatched", confidence: 0, reason: response.status === 404 ? "No reliable catalog result was found." : "The catalog lookup was temporarily unavailable." };
  const card = await response.json() as ScryfallCard;
  const cardImage = image(card);
  if (!cardImage) return { ...base, status: "unmatched", confidence: 0, reason: "The catalog result has no usable image." };

  const lowerTitle = sourceTitle.toLowerCase();
  const nameExact = lowerTitle.includes(card.name.toLowerCase());
  const setExact = Boolean(hints.setCode && card.set.toLowerCase() === hints.setCode.toLowerCase());
  const collectorExact = Boolean(hints.collector && card.collector_number.toLowerCase() === hints.collector.toLowerCase());
  const confidence = Math.min(99, 70 + (nameExact ? 12 : 0) + (setExact ? 9 : 0) + (collectorExact ? 9 : 0));
  const status: CatalogConfidence = nameExact && (setExact || collectorExact) ? "exact" : "suggested";
  return { ...base, status, confidence, catalogId: card.id, name: card.name, setCode: card.set, setName: card.set_name, collectorNumber: card.collector_number, imageUrl: cardImage, reason: status === "exact" ? "Card name and printing details agree." : "Card name found; confirm the exact printing." };
}
