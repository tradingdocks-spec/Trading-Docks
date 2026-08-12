import type {
  TcgTrackingCategory,
  TcgTrackingPriceSnapshot,
  TcgTrackingProduct,
  TcgTrackingScanCandidate,
  TcgTrackingSealedProduct,
  TcgTrackingSet,
  TcgTrackingSku,
} from "./types.ts";
import { normalizeTcgTrackingImageUrl } from "../../card-image-authority.ts";

export function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const object = asObject(value);
  for (const key of ["data", "results", "items", "categories", "sets", "products", "cards", "skus", "pricing", "candidates"]) {
    const candidate = object?.[key];
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

export function stringField(
  source: Record<string, unknown>,
  keys: string[],
) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return undefined;
}

export function numberField(
  source: Record<string, unknown>,
  keys: string[],
) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const normalized = value.replace(/[$,]/g, "").trim();
      if (!normalized) continue;
      const parsed = Number(normalized);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

export function integerField(
  source: Record<string, unknown>,
  keys: string[],
) {
  const value = numberField(source, keys);
  if (value == null) return undefined;
  const integer = Math.trunc(value);
  return Number.isSafeInteger(integer) ? integer : undefined;
}

export function arrayOfStrings(
  source: Record<string, unknown>,
  keys: string[],
) {
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) {
      return value
        .map((entry) =>
          typeof entry === "string" ? entry.trim() : "",
        )
        .filter(Boolean);
    }
    if (typeof value === "string" && value.trim()) {
      return value
        .split(/[,/|]/)
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
  }
  return [];
}

export function safeProviderUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export function normalizeCategory(value: unknown): TcgTrackingCategory | null {
  const source = asObject(value);
  if (!source) return null;
  const id = stringField(source, ["id", "category_id", "categoryId", "slug"]);
  const name = stringField(source, ["name", "display_name", "title"]);
  if (!id || !name) return null;
  return {
    id,
    name,
    slug: stringField(source, ["slug"]),
  };
}

export function normalizeSet(
  value: unknown,
  categoryId: string,
): TcgTrackingSet | null {
  const source = asObject(value);
  if (!source) return null;
  const id = stringField(source, ["id", "set_id", "setId", "abbr", "code"]);
  const name = stringField(source, ["name", "set_name", "setName"]);
  if (!id || !name) return null;
  return {
    id,
    categoryId,
    name,
    abbreviation: stringField(source, ["abbr", "abbreviation", "code", "set_abbr"]),
    releasedAt: stringField(source, ["released_at", "releaseDate", "release_date"]),
  };
}

export function normalizeProduct(
  value: unknown,
  categoryId: string,
): TcgTrackingProduct | null {
  const source = asObject(value);
  if (!source) return null;
  const providerProductId = stringField(source, [
    "product_id",
    "productId",
    "id",
  ]);
  const name = stringField(source, [
    "name",
    "product_name",
    "productName",
    "title",
  ]);
  if (!providerProductId || !name) return null;
  return {
    providerProductId,
    categoryId,
    setId: stringField(source, ["set_id", "setId"]),
    tcgplayerProductId: integerField(source, [
      "tcgplayer_product_id",
      "tcgplayerProductId",
      "tcg_player_id",
      "tcgplayer_id",
      "id",
    ]),
    name,
    cleanName: stringField(source, ["clean_name", "cleanName"]),
    setName: stringField(source, ["set_name", "setName"]),
    setCode: stringField(source, ["set_abbr", "setAbbr", "set_code", "setCode"]),
    collectorNumber: stringField(source, [
      "collector_number",
      "collectorNumber",
      "number",
    ]),
    rarity: stringField(source, ["rarity"]),
    imageUrl: normalizeTcgTrackingImageUrl(
      stringField(source, ["image_url", "imageUrl", "image"]),
    ) ?? undefined,
    scryfallId: stringField(source, ["scryfall_id", "scryfallId"]),
    mtgjsonUuid: stringField(source, ["mtgjson_uuid", "mtgjsonUuid", "uuid"]),
    cardtraderId: stringField(source, ["cardtrader_id", "cardtraderId"]),
    cardmarketId: stringField(source, ["cardmarket_id", "cardmarketId"]),
    colors: arrayOfStrings(source, ["colors", "color_identity", "colorIdentity"]),
    manaValue: numberField(source, ["mana_value", "manaValue", "cmc"]),
    finishes: arrayOfStrings(source, ["finishes", "variants", "available_finishes"]),
    raw: value,
  };
}

export function normalizeSku(value: unknown): TcgTrackingSku | null {
  const source = asObject(value);
  if (!source) return null;
  const providerSkuId = stringField(source, ["sku_id", "skuId", "id"]);
  if (!providerSkuId) return null;
  return {
    providerSkuId,
    providerProductId: stringField(source, ["product_id", "productId"]),
    tcgplayerSkuId: integerField(source, [
      "tcgplayer_sku_id",
      "tcgplayerSkuId",
    ]),
    tcgplayerProductId: integerField(source, [
      "tcgplayer_product_id",
      "tcgplayerProductId",
      "tcgplayer_id",
    ]),
    condition: stringField(source, ["condition", "condition_name", "conditionName", "cnd"]),
    conditionCode: stringField(source, ["condition_code", "conditionCode", "cnd"]),
    variant: stringField(source, ["variant", "finish", "printing", "var"]),
    variantAbbreviation: stringField(source, [
      "variant_abbreviation",
      "variantAbbreviation",
      "var_a",
    ]),
    variantId: stringField(source, ["variant_id", "variantId", "vid"]),
    language: stringField(source, ["language", "lang", "lng"]),
    marketPrice: numberField(source, ["market_price", "marketPrice", "tcg_market", "mkt"]),
    lowPrice: numberField(source, ["low_price", "lowPrice", "tcg_low", "low"]),
    highPrice: numberField(source, ["high_price", "highPrice", "tcg_high", "hi"]),
    activeListings: integerField(source, [
      "listing_count",
      "activeListings",
      "active_listings",
      "cnt",
      "mp_qty",
    ]),
    manapoolLow: numberField(source, ["manapool_low", "manapoolLow", "mp"]),
    lastSyncedAt: stringField(source, ["last_synced_at", "updated_at", "updatedAt"]),
    raw: value,
  };
}

export function normalizeSealedProduct(
  value: unknown,
  categoryId: string,
): TcgTrackingSealedProduct | null {
  const product = normalizeProduct(value, categoryId);
  const source = asObject(value);
  if (!product || !source) return null;
  return {
    providerProductId: product.providerProductId,
    categoryId,
    setId: product.setId,
    tcgplayerProductId: product.tcgplayerProductId,
    name: product.name,
    productType: stringField(source, ["product_type", "productType", "sealed_type"]),
    imageUrl: product.imageUrl,
    marketPrice: numberField(source, ["market_price", "marketPrice", "tcg_market"]),
    lowPrice: numberField(source, ["low_price", "lowPrice", "tcg_low"]),
    highPrice: numberField(source, ["high_price", "highPrice", "tcg_high"]),
    raw: value,
  };
}

export function normalizePriceSnapshot(value: unknown): TcgTrackingPriceSnapshot | null {
  const sku = normalizeSku(value);
  const source = asObject(value);
  if (!source) return null;
  const updatedAt =
    stringField(source, ["updated_at", "updatedAt", "last_synced_at"]) ??
    new Date(0).toISOString();
  return {
    providerProductId: sku?.providerProductId ?? stringField(source, ["product_id", "productId"]),
    providerSkuId: sku?.providerSkuId ?? stringField(source, ["sku_id", "skuId"]),
    tcgplayerProductId: sku?.tcgplayerProductId,
    tcgplayerSkuId: sku?.tcgplayerSkuId,
    tcgMarket: sku?.marketPrice ?? numberField(source, ["tcg_market", "market"]) ?? null,
    tcgLow: sku?.lowPrice ?? numberField(source, ["tcg_low", "low"]) ?? null,
    tcgHigh: sku?.highPrice ?? numberField(source, ["tcg_high", "hi", "high"]) ?? null,
    activeListings: sku?.activeListings ?? null,
    manapoolLow: sku?.manapoolLow ?? null,
    updatedAt,
  };
}

export function normalizeScanCandidate(value: unknown): TcgTrackingScanCandidate | null {
  const source = asObject(value);
  if (!source) return null;
  const confidence = numberField(source, ["confidence", "score", "match_score"]) ?? 0;
  const candidate: TcgTrackingScanCandidate = {
    providerProductId: stringField(source, ["product_id", "productId", "id"]),
    tcgplayerProductId: integerField(source, [
      "tcgplayer_product_id",
      "tcgplayerProductId",
      "tcgplayer_id",
    ]),
    name: stringField(source, ["name", "product_name", "productName"]),
    setName: stringField(source, ["set_name", "setName"]),
    setCode: stringField(source, ["set_abbr", "setAbbr", "set_code", "setCode"]),
    collectorNumber: stringField(source, ["collector_number", "collectorNumber", "number"]),
    imageUrl: normalizeTcgTrackingImageUrl(stringField(source, ["image_url", "imageUrl", "image"])) ?? undefined,
    confidence: Math.max(0, Math.min(1, confidence > 1 ? confidence / 100 : confidence)),
    metadata: source,
  };

  if (!candidate.providerProductId && !candidate.tcgplayerProductId) {
    return null;
  }

  return candidate;
}
