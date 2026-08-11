import { normalizeCollectorNumber, normalizeProductName, normalizeSetName } from "../../tcgplayer-catalog/normalization.ts";
import type {
  TcgTrackingProduct,
  TcgTrackingReconciliationResult,
  TcgTrackingSku,
  TradingDocksProductIdentity,
  TradingDocksSkuIdentity,
} from "./types.ts";

export type LocalTcgplayerCatalogIdentity = {
  tcgplayer_id: number;
  set_name: string;
  product_name: string;
  collector_number: string | null;
  condition: string;
  finish: string;
  photo_url?: string | null;
};

export function productIdentityFromTcgTracking(
  product: TcgTrackingProduct,
): TradingDocksProductIdentity {
  return {
    gameCategoryId: product.categoryId,
    tcgplayerProductId: product.tcgplayerProductId,
    name: product.name,
    setName: product.setName,
    setCode: product.setCode,
    collectorNumber: product.collectorNumber,
    scryfallId: product.scryfallId,
    mtgjsonUuid: product.mtgjsonUuid,
    cardtraderId: product.cardtraderId,
    cardmarketId: product.cardmarketId,
    imageUrl: product.imageUrl,
    providerProductId: product.providerProductId,
  };
}

export function skuIdentityFromTcgTracking(
  sku: TcgTrackingSku,
): TradingDocksSkuIdentity {
  return {
    tcgplayerSkuId: sku.tcgplayerSkuId,
    tcgplayerProductId: sku.tcgplayerProductId,
    condition: sku.condition,
    variant: sku.variant,
    variantId: sku.variantId,
    language: sku.language,
    providerSkuId: sku.providerSkuId,
  };
}

export function reconcileTcgTrackingWithLocalCatalog(input: {
  local?: LocalTcgplayerCatalogIdentity | null;
  product?: TcgTrackingProduct | null;
  sku?: TcgTrackingSku | null;
}): TcgTrackingReconciliationResult {
  const { local, product, sku } = input;
  if (!local && !product) {
    return {
      status: "missing_local_catalog",
      conflicts: [],
    };
  }
  if (local && !product) {
    return {
      status: "missing_provider_product",
      conflicts: [],
    };
  }

  const conflicts: TcgTrackingReconciliationResult["conflicts"] = [];

  if (local && product) {
    compareField(conflicts, "tcgplayerProductId", local.tcgplayer_id, product.tcgplayerProductId);
    compareField(
      conflicts,
      "name",
      normalizeProductName(local.product_name),
      normalizeProductName(product.name),
    );
    if (product.setName) {
      compareField(
        conflicts,
        "setName",
        normalizeSetName(local.set_name),
        normalizeSetName(product.setName),
      );
    }
    if (product.collectorNumber) {
      compareField(
        conflicts,
        "collectorNumber",
        normalizeCollectorNumber(local.collector_number),
        normalizeCollectorNumber(product.collectorNumber),
      );
    }
  }

  if (local && sku) {
    compareField(conflicts, "skuProductId", local.tcgplayer_id, sku.tcgplayerProductId);
    if (sku.condition) compareField(conflicts, "condition", local.condition.toLowerCase(), sku.condition.toLowerCase());
    if (sku.variant) compareField(conflicts, "finish", local.finish.toLowerCase(), sku.variant.toLowerCase());
  }

  return {
    status: conflicts.length ? "conflict" : "matched",
    product: product ? productIdentityFromTcgTracking(product) : undefined,
    sku: sku ? skuIdentityFromTcgTracking(sku) : undefined,
    conflicts,
  };
}

export function chooseExactProductImage(input: {
  tradingDocksImageUrl?: string | null;
  product?: TradingDocksProductIdentity | null;
  tcgTrackingImageUrl?: string | null;
  scryfallFallbackUrl?: string | null;
}) {
  return (
    input.tradingDocksImageUrl?.trim() ||
    input.product?.imageUrl?.trim() ||
    input.tcgTrackingImageUrl?.trim() ||
    input.scryfallFallbackUrl?.trim() ||
    null
  );
}

function compareField(
  conflicts: TcgTrackingReconciliationResult["conflicts"],
  field: string,
  local: unknown,
  provider: unknown,
) {
  if (local == null || provider == null) return;
  if (String(local) === String(provider)) return;
  conflicts.push({ field, local, provider });
}
