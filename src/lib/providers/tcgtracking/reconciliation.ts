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
  matchType: "tcgplayer_sku_id" | "condition_finish" | "missing_local";
  pricingDelta: {
    market: number | null;
    marketPercent: number | null;
    low: number | null;
    lowPercent: number | null;
    manapoolLow: number | null;
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
  maxMarketDelta: number | null;
  maxLowDelta: number | null;
  percentMarketWithinOnePercent: number | null;
  percentMarketWithinFivePercent: number | null;
  localNullPriceCount: number;
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
    const matchByVariant = matchBySku ?? relevantLocalRows.find((row) =>
      normalizeCondition(row.condition) === normalizeCondition(sku.condition) &&
      normalizeFinish(row.finish) === normalizeFinish(sku.variant),
    );
    if (matchByVariant) matchedLocalIds.add(matchByVariant.tcgplayer_id);

    if (matchByVariant && matchBySku == null) {
      conflicts.push({
        type: "identity",
        field: "tcgplayerSkuId",
        provider: sku.tcgplayerSkuId,
        local: matchByVariant.tcgplayer_id,
      });
    }

    const condition = normalizeCondition(sku.condition);
    const finish = normalizeFinish(sku.variant);
    if (matchByVariant && condition !== normalizeCondition(matchByVariant.condition)) {
      conflicts.push({
        type: "condition",
        field: "condition",
        provider: sku.condition,
        local: matchByVariant.condition,
      });
    }
    if (matchByVariant && finish !== normalizeFinish(matchByVariant.finish)) {
      conflicts.push({
        type: "finish",
        field: "finish",
        provider: sku.variant,
        local: matchByVariant.finish,
      });
    }
    if (sku.language && sku.language.toUpperCase() !== "EN") {
      conflicts.push({
        type: "language",
        field: "language",
        provider: sku.language,
        local: "not stored",
      });
    }

    const snapshot = priceSnapshots.find((price) =>
      price.tcgplayerProductId === sku.tcgplayerProductId &&
      normalizeFinish(price.providerSkuId?.split(":").at(-1)) === finish,
    );

    return {
      providerSkuId: sku.tcgplayerSkuId,
      providerProductId: sku.tcgplayerProductId ?? providerProductId ?? undefined,
      localTcgplayerId: matchByVariant?.tcgplayer_id,
      condition,
      finish,
      language: sku.language ?? null,
      matchType: matchBySku
        ? "tcgplayer_sku_id"
        : matchByVariant
          ? "condition_finish"
          : "missing_local",
      pricingDelta: {
        market: numericDelta(matchByVariant?.tcg_market_price, sku.marketPrice ?? snapshot?.tcgMarket),
        marketPercent: percentDelta(matchByVariant?.tcg_market_price, sku.marketPrice ?? snapshot?.tcgMarket),
        low: numericDelta(matchByVariant?.tcg_low_price, sku.lowPrice ?? snapshot?.tcgLow),
        lowPercent: percentDelta(matchByVariant?.tcg_low_price, sku.lowPrice ?? snapshot?.tcgLow),
        manapoolLow: snapshot?.manapoolLow ?? sku.manapoolLow ?? null,
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
    missingLocalSkus: skuMatches.filter((match) => match.matchType === "missing_local").length,
    missingProviderSkus,
    conflicts,
    skuMatches,
  };
}

export function summarizePricingDeltas(
  products: TcgTrackingProductReconciliation[],
): TcgTrackingPricingDeltaSummary {
  const matched = products.flatMap((product) =>
    product.skuMatches.filter((match) => match.localTcgplayerId != null),
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

  return {
    matchedSkuCount: matched.length,
    medianMarketDelta: median(marketDeltas),
    medianLowDelta: median(lowDeltas),
    maxMarketDelta: maxAbs(marketDeltas),
    maxLowDelta: maxAbs(lowDeltas),
    percentMarketWithinOnePercent: percentWithin(marketPercentDeltas, 1),
    percentMarketWithinFivePercent: percentWithin(marketPercentDeltas, 5),
    localNullPriceCount: matched.filter((match) => match.pricingDelta.market == null).length,
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
