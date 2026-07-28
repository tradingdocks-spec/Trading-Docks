import type {
  SealedProductSearchResult,
  SealedSearchResponse,
  TcgCsvCategory,
  TcgCsvGroup,
  TcgCsvPrice,
  TcgCsvProduct,
} from "./types";

const BASE_URL = "https://tcgcsv.com/tcgplayer";
const CACHE_TTL = 24 * 60 * 60 * 1000;

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const cache = new Map<string, CacheEntry<unknown>>();

const SEALED_KEYWORDS = [
  "booster box",
  "collector booster",
  "draft booster",
  "set booster",
  "play booster",
  "booster pack",
  "bundle",
  "fat pack",
  "commander deck",
  "starter deck",
  "theme deck",
  "structure deck",
  "elite trainer box",
  "ultra-premium collection",
  "premium collection",
  "collection box",
  "trainer toolkit",
  "build & battle",
  "build and battle",
  "display",
  "case",
  "gift set",
  "trove",
  "illumineer's trove",
  "starter set",
  "starter deck",
  "deck box",
  "special set",
  "anniversary collection",
  "double pack",
  "blister",
  "tin",
  "mini tin",
  "deck",
];

const NON_SEALED_HINTS = new Set([
  "rarity",
  "number",
  "card number",
  "hp",
  "attack",
  "defense",
  "artist",
]);

export async function getCategories() {
  return cached("categories", async () => {
    const response = await tcgCsvFetch<{ results: TcgCsvCategory[] }>(
      `${BASE_URL}/categories`,
    );

    return response.results ?? [];
  });
}

export async function getGroups(categoryId: number) {
  return cached(`groups:${categoryId}`, async () => {
    const response = await tcgCsvFetch<{ results: TcgCsvGroup[] }>(
      `${BASE_URL}/${categoryId}/groups`,
    );

    return response.results ?? [];
  });
}

export async function getProducts(
  categoryId: number,
  groupId: number,
) {
  return cached(`products:${categoryId}:${groupId}`, async () => {
    const response = await tcgCsvFetch<{ results: TcgCsvProduct[] }>(
      `${BASE_URL}/${categoryId}/${groupId}/products`,
    );

    return response.results ?? [];
  });
}

export async function getPrices(
  categoryId: number,
  groupId: number,
) {
  return cached(`prices:${categoryId}:${groupId}`, async () => {
    const response = await tcgCsvFetch<{ results: TcgCsvPrice[] }>(
      `${BASE_URL}/${categoryId}/${groupId}/prices`,
    );

    return response.results ?? [];
  });
}

export async function searchSealedProducts({
  query,
  categoryName,
  limit = 30,
}: {
  query: string;
  categoryName?: string;
  limit?: number;
}): Promise<SealedSearchResponse> {
  const categories = await getCategories();
  const selectedCategories = chooseCategories(
    categories,
    categoryName,
  );
  const normalizedQuery = normalize(query);
  const results: SealedProductSearchResult[] = [];
  let scannedGroups = 0;

  for (const category of selectedCategories) {
    const groups = await getGroups(category.categoryId);
    const rankedGroups = rankGroups(groups, normalizedQuery).slice(
      0,
      normalizedQuery ? 10 : 6,
    );

    const groupResults = await Promise.all(
      rankedGroups.map(async (group) => {
        scannedGroups += 1;

        const [products, prices] = await Promise.all([
          getProducts(category.categoryId, group.groupId),
          getPrices(category.categoryId, group.groupId),
        ]);

        const pricesByProduct = groupPrices(prices);

        return products
          .filter((product) =>
            isSealedProduct(product, normalizedQuery),
          )
          .map((product) =>
            normalizeSealedProduct(
              category,
              group,
              product,
              pricesByProduct.get(product.productId) ?? [],
            ),
          );
      }),
    );

    results.push(...groupResults.flat());
  }

  const sorted = results
    .filter((product) =>
      normalizedQuery
        ? normalize(
            `${product.name} ${product.groupName} ${product.productType}`,
          ).includes(normalizedQuery) ||
          tokenScore(
            normalize(
              `${product.name} ${product.groupName} ${product.productType}`,
            ),
            normalizedQuery,
          ) > 0
        : true,
    )
    .sort((a, b) => {
      const aScore = productScore(a, normalizedQuery);
      const bScore = productScore(b, normalizedQuery);

      return (
        bScore - aScore ||
        b.marketPrice - a.marketPrice ||
        a.name.localeCompare(b.name)
      );
    });

  return {
    query,
    category: categoryName ?? "All",
    updatedAt: new Date().toISOString(),
    scannedGroups,
    results: dedupeByProductId(sorted).slice(0, limit),
  };
}

function chooseCategories(
  categories: TcgCsvCategory[],
  requested?: string,
) {
  const supportedNames = [
    "magic",
    "pokemon",
    "disney lorcana",
    "lorcana",
    "one piece",
    "one piece card game",
    "yu-gi-oh",
    "yugioh",
    "flesh and blood",
  ];

  if (requested && requested.toLowerCase() !== "all") {
    const normalizedRequested = normalize(requested);

    return categories.filter((category) => {
      const names = normalize(
        `${category.name} ${category.displayName ?? ""}`,
      );

      return (
        names.includes(normalizedRequested) ||
        normalizedRequested.includes(names)
      );
    });
  }

  return categories.filter((category) => {
    const names = normalize(
      `${category.name} ${category.displayName ?? ""}`,
    );

    return supportedNames.some((name) =>
      names.includes(normalize(name)),
    );
  });
}

function rankGroups(groups: TcgCsvGroup[], query: string) {
  return [...groups].sort((a, b) => {
    if (!query) {
      return (
        dateValue(b.modifiedOn ?? b.publishedOn) -
        dateValue(a.modifiedOn ?? a.publishedOn)
      );
    }

    return (
      tokenScore(normalize(b.name), query) -
        tokenScore(normalize(a.name), query) ||
      dateValue(b.modifiedOn ?? b.publishedOn) -
        dateValue(a.modifiedOn ?? a.publishedOn)
    );
  });
}

function isSealedProduct(
  product: TcgCsvProduct,
  query: string,
) {
  const haystack = normalize(
    `${product.name} ${product.cleanName ?? ""}`,
  );
  const extendedNames = new Set(
    (product.extendedData ?? []).map((entry) =>
      normalize(entry.name || entry.displayName || ""),
    ),
  );
  const hasCardFields = [...extendedNames].some((name) =>
    NON_SEALED_HINTS.has(name),
  );
  const hasSealedKeyword = SEALED_KEYWORDS.some((keyword) =>
    haystack.includes(normalize(keyword)),
  );

  if (hasCardFields && !hasSealedKeyword) return false;

  if (!query) return hasSealedKeyword;

  return (
    hasSealedKeyword &&
    (haystack.includes(query) || tokenScore(haystack, query) > 0)
  );
}

function normalizeSealedProduct(
  category: TcgCsvCategory,
  group: TcgCsvGroup,
  product: TcgCsvProduct,
  prices: TcgCsvPrice[],
): SealedProductSearchResult {
  const selectedPrice =
    [...prices]
      .filter((price) => Number(price.marketPrice ?? 0) > 0)
      .sort(
        (a, b) =>
          Number(b.marketPrice ?? 0) -
          Number(a.marketPrice ?? 0),
      )[0] ??
    [...prices].sort(
      (a, b) =>
        Number(b.lowPrice ?? 0) -
        Number(a.lowPrice ?? 0),
    )[0] ??
    {};

  return {
    productId: product.productId,
    categoryId: category.categoryId,
    categoryName:
      category.displayName ?? category.name,
    groupId: group.groupId,
    groupName: group.name,
    name: product.name,
    cleanName: product.cleanName ?? product.name,
    productType: inferProductType(product.name),
    imageUrl: improveImage(product.imageUrl ?? ""),
    productUrl: product.url ?? "",
    marketPrice: money(selectedPrice.marketPrice),
    lowPrice: money(selectedPrice.lowPrice),
    midPrice: money(selectedPrice.midPrice),
    directLowPrice: money(selectedPrice.directLowPrice),
    priceSubtype: selectedPrice.subTypeName ?? "Sealed",
    allPrices: prices,
    isPresale: Boolean(product.presaleInfo?.isPresale),
    releasedOn:
      product.presaleInfo?.releasedOn ?? null,
    modifiedOn: product.modifiedOn ?? null,
    dataSource: "TCGCSV",
  };
}

function inferProductType(name: string) {
  const normalized = normalize(name);

  const types = [
    "Collector Booster Box",
    "Play Booster Box",
    "Set Booster Box",
    "Draft Booster Box",
    "Booster Box",
    "Elite Trainer Box",
    "Ultra-Premium Collection",
    "Premium Collection",
    "Commander Deck",
    "Starter Deck",
    "Structure Deck",
    "Booster Pack",
    "Bundle",
    "Case",
    "Tin",
    "Display",
  ];

  return (
    types.find((type) =>
      normalized.includes(normalize(type)),
    ) ?? "Sealed Product"
  );
}

function groupPrices(prices: TcgCsvPrice[]) {
  const grouped = new Map<number, TcgCsvPrice[]>();

  for (const price of prices) {
    const current = grouped.get(price.productId) ?? [];
    current.push(price);
    grouped.set(price.productId, current);
  }

  return grouped;
}

function productScore(
  product: SealedProductSearchResult,
  query: string,
) {
  if (!query) {
    return dateValue(product.modifiedOn) / 1_000_000_000;
  }

  const name = normalize(product.name);
  const group = normalize(product.groupName);
  let score = tokenScore(`${name} ${group}`, query);

  if (name === query) score += 100;
  if (name.startsWith(query)) score += 40;
  if (name.includes(query)) score += 20;
  if (group.includes(query)) score += 8;
  if (product.marketPrice > 0) score += 2;

  return score;
}

function tokenScore(haystack: string, needle: string) {
  const tokens = needle
    .split(/\s+/)
    .filter((token) => token.length > 1);

  return tokens.reduce(
    (score, token) =>
      score + (haystack.includes(token) ? 4 : 0),
    0,
  );
}

function dedupeByProductId(
  products: SealedProductSearchResult[],
) {
  const seen = new Set<number>();

  return products.filter((product) => {
    if (seen.has(product.productId)) return false;
    seen.add(product.productId);
    return true;
  });
}

function improveImage(url: string) {
  return url.replace("_200w.", "_in_1000x1000.");
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dateValue(value?: string | null) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

async function tcgCsvFetch<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "TradingDocks/1.0",
    },
    next: {
      revalidate: 86_400,
    },
  });

  if (!response.ok) {
    throw new Error(
      `TCGCSV request failed with ${response.status}: ${url}`,
    );
  }

  return response.json() as Promise<T>;
}

async function cached<T>(
  key: string,
  loader: () => Promise<T>,
): Promise<T> {
  const existing = cache.get(key) as CacheEntry<T> | undefined;

  if (existing && existing.expiresAt > Date.now()) {
    return existing.value;
  }

  const value = await loader();

  cache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL,
  });

  return value;
}
