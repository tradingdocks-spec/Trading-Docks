import type { CanonicalPrinting, CardCatalogProvider, CardRecognitionSignals } from "./types.ts";

const BASE_URL = "https://api.scryfall.com";
const TIMEOUT_MS = 3500;

type ScryfallCard = {
  id?: string; oracle_id?: string | null; name?: string; set?: string; set_name?: string;
  collector_number?: string; lang?: string; finishes?: string[]; rarity?: string;
  image_uris?: { normal?: string; large?: string };
  card_faces?: Array<{ image_uris?: { normal?: string; large?: string } }>;
  prices?: { usd?: string | null; usd_foil?: string | null; usd_etched?: string | null };
  legalities?: Record<string, string>; tcgplayer_id?: number; cardmarket_id?: number;
};

export class ScryfallCatalogProvider implements CardCatalogProvider {
  readonly id = "scryfall";

  async search(signals: CardRecognitionSignals, options: { limit?: number; signal?: AbortSignal } = {}) {
    if (signals.game && signals.game !== "magic" && signals.game !== "unknown") return [];
    const query = buildQuery(signals);
    if (!query) return [];
    const payload = await this.fetchJson(`/cards/search?${new URLSearchParams({
      q: query,
      unique: "prints",
      order: "released",
      dir: "desc",
      include_extras: "true",
    })}`, options.signal) as { data?: ScryfallCard[] };
    return (payload.data ?? []).map(normalizeScryfallPrinting).filter((card): card is CanonicalPrinting => Boolean(card)).slice(0, options.limit ?? 25);
  }

  async printing(id: string, options: { signal?: AbortSignal } = {}) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    try {
      return normalizeScryfallPrinting(await this.fetchJson(`/cards/${encodeURIComponent(id)}`, options.signal) as ScryfallCard);
    } catch { return null; }
  }

  private async fetchJson(path: string, outerSignal?: AbortSignal) {
    const controller = new AbortController();
    const relay = () => controller.abort();
    outerSignal?.addEventListener("abort", relay, { once: true });
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(`${BASE_URL}${path}`, {
        headers: { Accept: "application/json", "User-Agent": "TradingDocks/1.0 card-intelligence" },
        next: { revalidate: 300 },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Scryfall request failed (${response.status}).`);
      return response.json();
    } finally {
      clearTimeout(timeout);
      outerSignal?.removeEventListener("abort", relay);
    }
  }
}

export function normalizeScryfallPrinting(card: ScryfallCard): CanonicalPrinting | null {
  if (!card.id || !card.name) return null;
  const face = card.card_faces?.find((entry) => entry.image_uris);
  const prices = [
    price(card.prices?.usd, "nonfoil"),
    price(card.prices?.usd_foil, "foil"),
    price(card.prices?.usd_etched, "etched"),
  ].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  return {
    canonicalCardId: card.oracle_id ?? `scryfall-name:${normalize(card.name)}`,
    printingId: card.id,
    game: "magic",
    name: card.name,
    setName: card.set_name ?? null,
    setCode: card.set ?? null,
    collectorNumber: card.collector_number ?? null,
    language: card.lang ?? null,
    finishes: card.finishes ?? [],
    rarity: card.rarity ?? null,
    imageUrl: card.image_uris?.normal ?? card.image_uris?.large ?? face?.image_uris?.normal ?? face?.image_uris?.large ?? null,
    providerIds: Object.fromEntries(Object.entries({ scryfall: card.id, tcgplayer: card.tcgplayer_id, cardmarket: card.cardmarket_id }).filter((entry): entry is [string, string | number] => entry[1] !== undefined)),
    provenance: ["scryfall", ...(card.tcgplayer_id ? ["tcgplayer"] : []), ...(card.cardmarket_id ? ["cardmarket"] : [])],
    identityAuthority: "provider_confirmed",
    prices,
    legalities: card.legalities,
  };
}

function buildQuery(signals: CardRecognitionSignals) {
  const clauses: string[] = [];
  const name = `${signals.cardName ?? ""}`.trim();
  const set = `${signals.setCode ?? ""}`.trim();
  const number = `${signals.collectorNumber ?? ""}`.trim();
  const providerId = signals.providerIds?.scryfall;
  if (providerId) clauses.push(`id:${providerId}`);
  if (name) clauses.push(`!"${name.replaceAll('"', "")}"`);
  if (set) clauses.push(`set:${set.replace(/[^a-z0-9]/gi, "")}`);
  if (number) clauses.push(`cn:${number.replace(/[^a-z0-9/★]/gi, "")}`);
  if (signals.language) clauses.push(`lang:${`${signals.language}`.replace(/[^a-z]/gi, "")}`);
  return clauses.join(" ") || `${signals.ocrText ?? ""}`.trim();
}

function price(value: string | null | undefined, finish: string) {
  const market = Number(value);
  if (!Number.isFinite(market) || market < 0) return null;
  return { currency: "USD" as const, market, low: null, high: null, source: `scryfall:${finish}`, updatedAt: null };
}
function normalize(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
