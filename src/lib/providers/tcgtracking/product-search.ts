import {
  TCGTRACKING_POKEMON_CATEGORY_ID,
  TCGTRACKING_POKEMON_GAME_ID,
  createTcgTrackingClient,
  type TcgTrackingClient,
} from "./client.ts";
import type {
  TcgTrackingPriceSnapshot,
  TcgTrackingProduct,
  TcgTrackingSet,
  TcgTrackingSku,
} from "./types.ts";

const STATIC_INDEX_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SEARCH_LIMIT = 10;

export type TcgProductSearchResult = {
  providerProductId: string;
  tcgplayerProductId: number | null;
  gameId: number;
  categoryId: string;
  name: string;
  cleanName?: string;
  setId?: string;
  setName?: string;
  setCode?: string;
  collectorNumber?: string;
  rarity?: string;
  imageUrl?: string;
  variants: string[];
  score: number;
};

export type TcgProductSkuOption = {
  providerSkuId: string;
  providerProductId?: string;
  tcgplayerSkuId: number | null;
  tcgplayerProductId: number | null;
  condition: string;
  variant: string;
  language: string;
  marketPrice: number | null;
  lowPrice: number | null;
  highPrice: number | null;
  activeListings: number | null;
  lastSyncedAt?: string;
};

type ProductIndex = {
  categoryId: string;
  builtAt: number;
  sets: TcgTrackingSet[];
  products: TcgTrackingProduct[];
};

let pokemonIndex: ProductIndex | null = null;
let pokemonIndexPromise: Promise<ProductIndex> | null = null;

export async function searchTcgProducts(input: {
  gameId: number;
  query: string;
  limit?: number;
  client?: Pick<TcgTrackingClient, "sets" | "cards">;
}): Promise<TcgProductSearchResult[]> {
  const query = normalizeSearchText(input.query);
  if (!query || input.gameId !== TCGTRACKING_POKEMON_GAME_ID) return [];

  const index = await loadPokemonProductIndex(input.client);
  const limit = clampLimit(input.limit);
  const queryParts = query.split(" ").filter(Boolean);

  return index.products
    .map((product) => {
      const haystack = normalizeSearchText([
        product.name,
        product.cleanName,
        product.collectorNumber,
        product.setName,
        product.setCode,
      ].filter(Boolean).join(" "));
      const nameText = normalizeSearchText(product.name);
      const cleanNameText = normalizeSearchText(product.cleanName ?? product.name);
      const setText = normalizeSearchText(`${product.setName ?? ""} ${product.setCode ?? ""}`);
      let score = 0;
      if (nameText === query || cleanNameText === query) score += 120;
      if (nameText.includes(query) || cleanNameText.includes(query)) score += 80;
      if (haystack.includes(query)) score += 42;
      if (product.collectorNumber && normalizeSearchText(product.collectorNumber) === query) score += 36;
      if (setText.includes(query)) score += 12;
      score += queryParts.filter((part) => haystack.includes(part)).length * 8;
      return score > 0 ? toSearchResult(product, score) : null;
    })
    .filter((result): result is TcgProductSearchResult => Boolean(result))
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
    .slice(0, limit);
}

export async function resolveTcgProductSkus(input: {
  gameId: number;
  providerProductId: string;
  setId?: string | null;
  client?: Pick<TcgTrackingClient, "product" | "skus" | "pricing">;
}): Promise<{ product: TcgProductSearchResult | null; skus: TcgProductSkuOption[] }> {
  if (input.gameId !== TCGTRACKING_POKEMON_GAME_ID) return { product: null, skus: [] };
  const client = input.client ?? createTcgTrackingClient();
  const product = await client.product(input.providerProductId);
  if (!product) return { product: null, skus: [] };
  const setId = input.setId ?? product.setId;
  const [skus, pricing] = setId
    ? await Promise.all([
        client.skus(TCGTRACKING_POKEMON_CATEGORY_ID, setId),
        client.pricing(TCGTRACKING_POKEMON_CATEGORY_ID, setId).catch(() => [] as TcgTrackingPriceSnapshot[]),
      ])
    : [[] as TcgTrackingSku[], [] as TcgTrackingPriceSnapshot[]];
  const productSkus = skus
    .filter((sku) =>
      sku.providerProductId === product.providerProductId ||
      (product.tcgplayerProductId != null && sku.tcgplayerProductId === product.tcgplayerProductId),
    )
    .map((sku) => toSkuOption(sku, pricing));
  return {
    product: toSearchResult(product, 100),
    skus: dedupeSkuOptions(productSkus),
  };
}

export function clearTcgProductSearchCache() {
  pokemonIndex = null;
  pokemonIndexPromise = null;
}

async function loadPokemonProductIndex(
  client: Pick<TcgTrackingClient, "sets" | "cards"> = createTcgTrackingClient(),
) {
  if (pokemonIndex && Date.now() - pokemonIndex.builtAt < STATIC_INDEX_TTL_MS) return pokemonIndex;
  if (pokemonIndexPromise) return pokemonIndexPromise;

  pokemonIndexPromise = (async () => {
    const sets = await client.sets(TCGTRACKING_POKEMON_CATEGORY_ID);
    const productGroups = await Promise.all(
      sets.map(async (set) => {
        try {
          return await client.cards(TCGTRACKING_POKEMON_CATEGORY_ID, set.id);
        } catch {
          return [];
        }
      }),
    );
    const products = productGroups.flat();
    const index = {
      categoryId: TCGTRACKING_POKEMON_CATEGORY_ID,
      builtAt: Date.now(),
      sets,
      products,
    };
    pokemonIndex = index;
    pokemonIndexPromise = null;
    return index;
  })();

  return pokemonIndexPromise;
}

function toSearchResult(product: TcgTrackingProduct, score: number): TcgProductSearchResult {
  return {
    providerProductId: product.providerProductId,
    tcgplayerProductId: product.tcgplayerProductId ?? null,
    gameId: TCGTRACKING_POKEMON_GAME_ID,
    categoryId: TCGTRACKING_POKEMON_CATEGORY_ID,
    name: product.name,
    cleanName: product.cleanName,
    setId: product.setId,
    setName: product.setName,
    setCode: product.setCode,
    collectorNumber: product.collectorNumber,
    rarity: product.rarity,
    imageUrl: product.imageUrl,
    variants: product.finishes,
    score,
  };
}

function toSkuOption(sku: TcgTrackingSku, pricing: TcgTrackingPriceSnapshot[]): TcgProductSkuOption {
  const price = pricing.find((entry) =>
    entry.providerSkuId === sku.providerSkuId ||
    (sku.tcgplayerSkuId != null && entry.tcgplayerSkuId === sku.tcgplayerSkuId),
  );
  return {
    providerSkuId: sku.providerSkuId,
    providerProductId: sku.providerProductId,
    tcgplayerSkuId: sku.tcgplayerSkuId ?? null,
    tcgplayerProductId: sku.tcgplayerProductId ?? null,
    condition: sku.condition ?? sku.conditionCode ?? "Condition unavailable",
    variant: sku.variant ?? sku.variantAbbreviation ?? "Normal",
    language: sku.language ?? "English",
    marketPrice: sku.marketPrice ?? price?.tcgMarket ?? null,
    lowPrice: sku.lowPrice ?? price?.tcgLow ?? null,
    highPrice: sku.highPrice ?? price?.tcgHigh ?? null,
    activeListings: sku.activeListings ?? price?.activeListings ?? null,
    lastSyncedAt: sku.lastSyncedAt ?? price?.updatedAt,
  };
}

function dedupeSkuOptions(skus: TcgProductSkuOption[]) {
  const seen = new Set<string>();
  return skus.filter((sku) => {
    const key = [
      sku.providerSkuId,
      sku.condition.toLowerCase(),
      sku.variant.toLowerCase(),
      sku.language.toLowerCase(),
    ].join(":");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function clampLimit(value: number | undefined) {
  return Math.max(1, Math.min(SEARCH_LIMIT, Number.isFinite(value ?? NaN) ? Number(value) : SEARCH_LIMIT));
}
