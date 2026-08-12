import {
  normalizeCollectorNumber,
  normalizeProductName,
  normalizeSetName,
} from "../../tcgplayer-catalog/normalization.ts";
import type {
  TcgTrackingPriceSnapshot,
  TcgTrackingProduct,
  TcgTrackingSku,
} from "./types.ts";

export type TcgTrackingLocalCatalogRow = {
  tcgplayer_id: number;
  set_name: string;
  product_name: string;
  collector_number: string | null;
  condition: string;
  finish: string;
  tcg_market_price: number | null;
  tcg_low_price: number | null;
  photo_url?: string | null;
};

export type TcgTrackingSkuMatch = {
  providerSkuId?: number;
  providerProductId?: number;
  localTcgplayerId?: number;
  condition: string | null;
  finish: string | null;
  language: string | null;
  matchType: "tcgplayer_sku_id" | "condition_finish" | "provider_only_sku";
  classification:
    | "EXACT_MATCH"
    | "PROVIDER_ONLY_SKU"
    | "PROVIDER_ONLY_LANGUAGE_VARIANT"
    | "PROVIDER_ONLY_FINISH_VARIANT"
    | "PROVIDER_ONLY_VARIANT";
  pricingDelta: {
    market: number | null;
    marketPercent: number | null;
    low: number | null;
    lowPercent: number | null;
    manapoolLow: number | null;
  };
  pricePresence: {
    localMarket: boolean;
    providerMarket: boolean;
    localLow: boolean;
    providerLow: boolean;
  };
};

export type TcgTrackingProductReconciliation = {
  providerProductId: number | null;
  productName: string;
  setName: string | null;
  collectorNumber: string | null;
  localSkuCount: number;
  providerSkuCount: number;
  exactMatches: number;
  missingLocalSkus: number;
  missingProviderSkus: number;
  providerOnlySkus: number;
  providerOnlyLanguageVariants: Record<string, number>;
  conflicts: Array<{
    type: "identity" | "condition" | "finish" | "language" | "pricing";
    field: string;
    provider: unknown;
    local: unknown;
  }>;
  skuMatches: TcgTrackingSkuMatch[];
};

export type TcgTrackingPricingDeltaSummary = {
  matchedSkuCount: number;
  medianMarketDelta: number | null;
  medianLowDelta: number | null;
  medianAbsoluteMarketDelta: number | null;
  medianAbsoluteLowDelta: number | null;
  maxMarketDelta: number | null;
  maxLowDelta: number | null;
  percentMarketWithinOneCent: number | null;
  percentMarketWithinOnePercent: number | null;
  percentMarketWithinFivePercent: number | null;
  percentLowWithinOneCent: number | null;
  percentLowWithinOnePercent: number | null;
  percentLowWithinFivePercent: number | null;
  localNullPriceCount: number;
  providerNullPriceCount: number;
};

export type ImageProbeResult = {
  url: string;
  ok: boolean;
  status?: number;
  contentType?: string | null;
  contentLength?: number | null;
  latencyMs: number;
  exactPrintingMismatch?: boolean;
};

export type ImageReliabilitySummary = {
  tested: number;
  successRate: number | null;
  medianLatencyMs: number | null;
  p95LatencyMs: number | null;
  failures: number;
  exactPrintingMismatches: number;
};

export function reconcileTcgTrackingProduct(input: {
  providerProduct: TcgTrackingProduct;
  providerSkus: TcgTrackingSku[];
  priceSnapshots: TcgTrackingPriceSnapshot[];
  localRows: TcgTrackingLocalCatalogRow[];
}): TcgTrackingProductReconciliation {
  const { providerProduct, providerSkus, priceSnapshots, localRows } = input;
  const conflicts: TcgTrackingProductReconciliation["conflicts"] = [];
  const providerProductId = numericId(providerProduct.providerProductId);
  const relevantLocalRows = localRows.filter((row) =>
    identityMatches(providerProduct, row),
  );
  const providerSkuIds = new Set(
    providerSkus
      .map((sku) => sku.tcgplayerSkuId)
      .filter((value): value is number => typeof value === "number"),
  );
  const matchedLocalIds = new Set<number>();

  const skuMatches = providerSkus.map((sku) => {
    const matchBySku = relevantLocalRows.find(
      (row) => row.tcgplayer_id === sku.tcgplayerSkuId,
    );
    const condition = normalizeCondition(sku.condition);
    const finish = normalizeFinish(sku.variant);
    const language = normalizeLanguage(sku.language);
    const matchByVariant = matchBySku
      ? matchBySku
      : isDefaultLanguage(language)
        ? relevantLocalRows.find((row) =>
          !matchedLocalIds.has(row.tcgplayer_id) &&
          normalizeCondition(row.condition) === condition &&
          normalizeFinish(row.finish) === finish
        )
        : undefined;
    const classification = classifySkuMatch({
      matchBySku: Boolean(matchBySku),
      matchByVariant: Boolean(matchByVariant),
      language,
      finish,
    });
    if (matchBySku) matchedLocalIds.add(matchBySku.tcgplayer_id);

    if (matchByVariant && matchBySku == null && isDefaultLanguage(language)) {
      conflicts.push({
        type: "identity",
        field: "tcgplayerSkuId",
        provider: sku.tcgplayerSkuId,
        local: matchByVariant.tcgplayer_id,
      });
    }

    if (matchBySku && condition !== normalizeCondition(matchBySku.condition)) {
      conflicts.push({
        type: "condition",
        field: "condition",
        provider: sku.condition,
        local: matchBySku.condition,
      });
    }
    if (matchBySku && finish !== normalizeFinish(matchBySku.finish)) {
      conflicts.push({
        type: "finish",
        field: "finish",
        provider: sku.variant,
        local: matchBySku.finish,
      });
    }

    const snapshot = priceSnapshots.find((price) =>
      price.tcgplayerProductId === sku.tcgplayerProductId &&
      normalizeFinish(price.providerSkuId?.split(":").at(-1)) === finish,
    );
    const providerMarket = sku.marketPrice ?? snapshot?.tcgMarket;
    const providerLow = sku.lowPrice ?? snapshot?.tcgLow;
    const pricingRow = matchBySku;

    return {
      providerSkuId: sku.tcgplayerSkuId,
      providerProductId: sku.tcgplayerProductId ?? providerProductId ?? undefined,
      localTcgplayerId: matchBySku?.tcgplayer_id,
      condition,
      finish,
      language: sku.language ?? null,
      classification,
      matchType: matchBySku
        ? "tcgplayer_sku_id"
        : matchByVariant
          ? "condition_finish"
          : "provider_only_sku",
      pricingDelta: {
        market: numericDelta(pricingRow?.tcg_market_price, providerMarket),
        marketPercent: percentDelta(pricingRow?.tcg_market_price, providerMarket),
        low: numericDelta(pricingRow?.tcg_low_price, providerLow),
        lowPercent: percentDelta(pricingRow?.tcg_low_price, providerLow),
        manapoolLow: snapshot?.manapoolLow ?? sku.manapoolLow ?? null,
      },
      pricePresence: {
        localMarket: isFiniteNumber(pricingRow?.tcg_market_price),
        providerMarket: isFiniteNumber(providerMarket),
        localLow: isFiniteNumber(pricingRow?.tcg_low_price),
        providerLow: isFiniteNumber(providerLow),
      },
    } satisfies TcgTrackingSkuMatch;
  });

  const missingProviderSkus = relevantLocalRows.filter(
    (row) => !providerSkuIds.has(row.tcgplayer_id),
  ).length;

  return {
    providerProductId,
    productName: providerProduct.name,
    setName: providerProduct.setName ?? null,
    collectorNumber: providerProduct.collectorNumber ?? null,
    localSkuCount: relevantLocalRows.length,
    providerSkuCount: providerSkus.length,
    exactMatches: skuMatches.filter((match) => match.matchType === "tcgplayer_sku_id").length,
    missingLocalSkus: 0,
    missingProviderSkus,
    providerOnlySkus: skuMatches.filter((match) => match.classification !== "EXACT_MATCH").length,
    providerOnlyLanguageVariants: countProviderOnlyLanguages(skuMatches),
    conflicts,
    skuMatches,
  };
}

export function summarizePricingDeltas(
  products: TcgTrackingProductReconciliation[],
): TcgTrackingPricingDeltaSummary {
  const matched = products.flatMap((product) =>
    product.skuMatches.filter((match) => match.matchType === "tcgplayer_sku_id"),
  );
  const marketDeltas = matched
    .map((match) => match.pricingDelta.market)
    .filter((value): value is number => typeof value === "number");
  const marketPercentDeltas = matched
    .map((match) => match.pricingDelta.marketPercent)
    .filter((value): value is number => typeof value === "number");
  const lowDeltas = matched
    .map((match) => match.pricingDelta.low)
    .filter((value): value is number => typeof value === "number");
  const lowPercentDeltas = matched
    .map((match) => match.pricingDelta.lowPercent)
    .filter((value): value is number => typeof value === "number");

  return {
    matchedSkuCount: matched.length,
    medianMarketDelta: median(marketDeltas),
    medianLowDelta: median(lowDeltas),
    medianAbsoluteMarketDelta: median(marketDeltas.map(Math.abs)),
    medianAbsoluteLowDelta: median(lowDeltas.map(Math.abs)),
    maxMarketDelta: maxAbs(marketDeltas),
    maxLowDelta: maxAbs(lowDeltas),
    percentMarketWithinOneCent: percentWithin(marketDeltas, 0.01),
    percentMarketWithinOnePercent: percentWithin(marketPercentDeltas, 1),
    percentMarketWithinFivePercent: percentWithin(marketPercentDeltas, 5),
    percentLowWithinOneCent: percentWithin(lowDeltas, 0.01),
    percentLowWithinOnePercent: percentWithin(lowPercentDeltas, 1),
    percentLowWithinFivePercent: percentWithin(lowPercentDeltas, 5),
    localNullPriceCount: matched.filter((match) =>
      !match.pricePresence.localMarket && !match.pricePresence.localLow
    ).length,
    providerNullPriceCount: matched.filter((match) =>
      !match.pricePresence.providerMarket && !match.pricePresence.providerLow
    ).length,
  };
}

export function summarizeImageReliability(
  images: ImageProbeResult[],
): ImageReliabilitySummary {
  const successful = images.filter((image) =>
    image.ok &&
    (image.contentType?.startsWith("image/") ?? false) &&
    (image.contentLength == null || image.contentLength > 0),
  );
  return {
    tested: images.length,
    successRate: images.length ? successful.length / images.length : null,
    medianLatencyMs: median(images.map((image) => image.latencyMs)),
    p95LatencyMs: percentile(images.map((image) => image.latencyMs), 0.95),
    failures: images.length - successful.length,
    exactPrintingMismatches: images.filter((image) => image.exactPrintingMismatch).length,
  };
}

export function normalizeCondition(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase();
  const aliases: Record<string, string> = {
    nm: "Near Mint",
    "near mint": "Near Mint",
    lp: "Lightly Played",
    "lightly played": "Lightly Played",
    mp: "Moderately Played",
    "moderately played": "Moderately Played",
    hp: "Heavily Played",
    "heavily played": "Heavily Played",
    dmg: "Damaged",
    damaged: "Damaged",
    unopened: "Unopened",
  };
  return aliases[normalized] ?? (normalized ? String(value).trim() : null);
}

export function normalizeFinish(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase();
  const aliases: Record<string, string> = {
    n: "Normal",
    normal: "Normal",
    nonfoil: "Normal",
    nonfoils: "Normal",
    f: "Foil",
    foil: "Foil",
    etched: "Etched",
    unopened: "Unopened",
  };
  return aliases[normalized] ?? (normalized ? String(value).trim() : null);
}

function normalizeLanguage(value: unknown) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  const upper = normalized.toUpperCase();
  const aliases: Record<string, string> = {
    EN: "English",
    ENG: "English",
    ENGLISH: "English",
    FR: "French",
    FRE: "French",
    FRENCH: "French",
    DE: "German",
    DEU: "German",
    GER: "German",
    GERMAN: "German",
    JP: "Japanese",
    JA: "Japanese",
    JPN: "Japanese",
    JAPANESE: "Japanese",
    ES: "Spanish",
    SPA: "Spanish",
    SPANISH: "Spanish",
    IT: "Italian",
    ITA: "Italian",
    ITALIAN: "Italian",
    PT: "Portuguese",
    POR: "Portuguese",
    PORTUGUESE: "Portuguese",
    ZH: "Chinese",
    CHINESE: "Chinese",
    KO: "Korean",
    KOR: "Korean",
    KOREAN: "Korean",
    RU: "Russian",
    RUS: "Russian",
    RUSSIAN: "Russian",
  };
  return aliases[upper] ?? normalized;
}

function isDefaultLanguage(language: string | null) {
  return language == null || language === "English";
}

function classifySkuMatch(input: {
  matchBySku: boolean;
  matchByVariant: boolean;
  language: string | null;
  finish: string | null;
}): TcgTrackingSkuMatch["classification"] {
  if (input.matchBySku) return "EXACT_MATCH";
  if (!isDefaultLanguage(input.language)) return "PROVIDER_ONLY_LANGUAGE_VARIANT";
  if (input.finish && input.finish !== "Normal") return "PROVIDER_ONLY_FINISH_VARIANT";
  if (input.matchByVariant) return "PROVIDER_ONLY_VARIANT";
  return "PROVIDER_ONLY_SKU";
}

function countProviderOnlyLanguages(matches: TcgTrackingSkuMatch[]) {
  return matches.reduce<Record<string, number>>((counts, match) => {
    if (match.classification !== "PROVIDER_ONLY_LANGUAGE_VARIANT") return counts;
    const label = normalizeLanguage(match.language) ?? "Unknown";
    counts[label] = (counts[label] ?? 0) + 1;
    return counts;
  }, {});
}

function identityMatches(
  provider: TcgTrackingProduct,
  local: TcgTrackingLocalCatalogRow,
) {
  return (
    normalizeProductName(provider.name) === normalizeProductName(local.product_name) &&
    (!provider.setName || normalizeSetName(provider.setName) === normalizeSetName(local.set_name)) &&
    (!provider.collectorNumber ||
      normalizeCollectorNumber(provider.collectorNumber) === normalizeCollectorNumber(local.collector_number))
  );
}

function numericId(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function numericDelta(local: unknown, provider: unknown) {
  const left = typeof local === "number" && Number.isFinite(local) ? local : null;
  const right = typeof provider === "number" && Number.isFinite(provider) ? provider : null;
  if (left == null || right == null) return null;
  return Math.round((right - left) * 100) / 100;
}

function percentDelta(local: unknown, provider: unknown) {
  const left = typeof local === "number" && Number.isFinite(local) ? local : null;
  const right = typeof provider === "number" && Number.isFinite(provider) ? provider : null;
  if (left == null || right == null || left === 0) return null;
  return Math.round(((right - left) / left) * 10_000) / 100;
}

function isFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value);
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : Math.round(((sorted[middle - 1] + sorted[middle]) / 2) * 100) / 100;
}

function percentile(values: number[], percentileValue: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * percentileValue) - 1),
  );
  return sorted[index];
}

function maxAbs(values: number[]) {
  return values.length
    ? Math.max(...values.map((value) => Math.abs(value)))
    : null;
}

function percentWithin(values: number[], threshold: number) {
  if (!values.length) return null;
  const count = values.filter((value) => Math.abs(value) <= threshold).length;
  return Math.round((count / values.length) * 10_000) / 100;
}
