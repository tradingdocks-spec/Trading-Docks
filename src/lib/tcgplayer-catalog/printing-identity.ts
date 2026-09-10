import { normalizeCollectorNumber, normalizeProductName } from "./normalization.ts";
import { resolveMtgSetIdentity } from "../mtg/set-identity.ts";

export type CatalogPrinting = {
  productId: string;
  setName: string;
  productName: string;
  collectorNumber: string;
};

export type PrintingLookupInput = {
  productName: string;
  setCode?: string | null;
  setName?: string | null;
  collectorNumber?: string | null;
  scryfallId?: string | null;
  tcgplayerProductId?: string | null;
};

export function parseListCollector(value: string | null | undefined) {
  const match = normalizeCollectorNumber(value)?.match(/^([a-z0-9]+)-(.+)$/);
  return match ? { sourceSetCode: match[1], sourceCollectorNumber: match[2] } : null;
}

export function normalizeExternalId(value: unknown) {
  const text = String(value ?? "").trim();
  return /^\d+$/.test(text) && BigInt(text) > BigInt(0) ? BigInt(text).toString() : null;
}

// These URLs identify products, whereas the seller CSV's TCGplayer Id identifies a SKU.
export function catalogProductId(photoUrl: string | null) {
  if (!photoUrl) return null;
  try {
    const url = new URL(photoUrl);
    if (!/(^|\.)(tcgplayer\.com|tcgplayer-cdn\.tcgplayer\.com)$/.test(url.hostname)) return null;
    return normalizeExternalId(url.pathname.match(/\/(?:product\/)?(\d+)(?:_|\.|\/|$)/)?.[1]);
  } catch { return null; }
}

type ScryfallPrinting = { id: string; name: string; set: string; collector_number: string; tcgplayer_id?: number };
type Group = { groupId: number; name: string; abbreviation?: string };
type Product = { productId: number; name: string; extendedData?: { name: string; value: string }[] };

// Request-scoped promise caches coalesce repeated rows without retaining failed lookups globally.
export function createPrintingLookup(fetcher: typeof fetch = fetch) {
  const cache = new Map<string, Promise<unknown>>();
  function get<T>(url: string): Promise<T> {
    if (!cache.has(url)) cache.set(url, (async () => {
      const response = await fetcher(url, {
        headers: { "User-Agent": "TradingDocks/1.0 (printing resolution)", Accept: "application/json" },
        signal: AbortSignal.timeout(10_000), cache: "no-store",
      });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`Printing metadata lookup failed (${response.status}).`);
      return response.json();
    })());
    return cache.get(url) as Promise<T>;
  }
  return async (input: PrintingLookupInput): Promise<CatalogPrinting | null> => {
    let set = input.setCode?.trim().toLowerCase();
    const compound = set === "plst" ? parseListCollector(input.collectorNumber) : null;
    const lookupNumber = compound ? `${compound.sourceSetCode.toUpperCase()}-${compound.sourceCollectorNumber}` : input.collectorNumber?.trim();
    let productId = normalizeExternalId(input.tcgplayerProductId);
    if (!productId || !set) {
      const path = productId ? `tcgplayer/${productId}` : input.scryfallId?.trim()
        ? encodeURIComponent(input.scryfallId.trim().toLowerCase())
        : set && input.collectorNumber
          ? `${encodeURIComponent(set)}/${encodeURIComponent(lookupNumber!)}` : null;
      if (!path) return null;
      const card = await get<ScryfallPrinting | null>(`https://api.scryfall.com/cards/${path}`);
      if (!card) return null;
      if (!input.scryfallId && !productId && normalizeProductName(card.name) !== normalizeProductName(input.productName)) return null;
      if (!input.scryfallId && !productId && (card.set !== set || normalizeCollectorNumber(card.collector_number) !== normalizeCollectorNumber(input.collectorNumber))) return null;
      if (compound && !input.scryfallId && !input.tcgplayerProductId) {
        // Validate the embedded original printing, but use the List printing's product link.
        const original = await get<ScryfallPrinting | null>(`https://api.scryfall.com/cards/${encodeURIComponent(compound.sourceSetCode)}/${encodeURIComponent(compound.sourceCollectorNumber)}`);
        if (!original || normalizeProductName(original.name) !== normalizeProductName(card.name)) return null;
      }
      productId = normalizeExternalId(card.tcgplayer_id);
      set = card.set;
    }
    if (!productId) return null;
    const groups = await get<{ results: Group[] }>("https://tcgcsv.com/tcgplayer/1/groups");
    const identity = resolveMtgSetIdentity(set ?? input.setName ?? "");
    // PLST spans List/Mystery catalog groups. A product link is the authority, never a name-only guess.
    const candidates = groups.results.filter((group) =>
      set === "plst" ? /list|mystery/i.test(group.name) : group.abbreviation?.toLowerCase() === set || group.name === input.setName || (identity.status === "matched" && group.name === identity.name),
    );
    for (const group of candidates) {
      const products = await get<{ results: Product[] }>(`https://tcgcsv.com/tcgplayer/1/${group.groupId}/products`);
      const product = products.results.find((entry) => String(entry.productId) === productId);
      if (product) return {
        productId, setName: group.name, productName: product.name,
        collectorNumber: product.extendedData?.find((entry) => entry.name.toLowerCase() === "number")?.value ?? "",
      };
    }
    return null;
  };
}
