import type {
  TcgTrackingPriceSnapshot,
  TcgTrackingProduct,
  TcgTrackingSealedProduct,
  TcgTrackingSku,
} from "../providers/tcgtracking/types.ts";
import type { TradingDocksMarketSnapshot } from "../providers/tcgtracking/pricing.ts";
import {
  marketSnapshotFromTcgTracking,
} from "../providers/tcgtracking/pricing.ts";
import {
  getGameByTcgTrackingCategory,
  getSupportedGame,
  isGameCapabilitySupported,
  MAGIC_GAME_ID,
  TCGTRACKING_MAGIC_CATEGORY_ID,
  type GameIdentity,
  type SupportedGameId,
} from "./registry.ts";

export type ProductType = "card" | "sealed";

export type CatalogSet = {
  game: GameIdentity;
  provider: "tcgtracking" | "tcgplayer" | "scryfall" | "manual";
  providerSetId?: string;
  name: string;
  code?: string;
  releasedAt?: string;
};

export type CatalogProduct = {
  game: GameIdentity;
  productType: ProductType;
  provider: "tcgtracking" | "tcgplayer" | "scryfall" | "manual";
  providerProductId?: string;
  tcgplayerProductId?: number;
  name: string;
  set?: CatalogSet;
  collectorNumber?: string;
  rarity?: string;
  imageUrl?: string;
  externalIds: {
    scryfallId?: string;
    mtgjsonUuid?: string;
    cardtraderId?: string;
    cardmarketId?: string;
  };
  gameSpecific: Record<string, unknown>;
};

export type CatalogSku = {
  game: GameIdentity;
  product: CatalogProduct;
  provider: "tcgtracking" | "tcgplayer" | "manual";
  providerSkuId?: string;
  tcgplayerSkuId?: number;
  condition?: string;
  variant?: string;
  language?: string;
  marketPrice: GameAwareMarketSnapshot;
};

export type GameAwareMarketSnapshot = TradingDocksMarketSnapshot & {
  gameId: SupportedGameId;
};

export type InventoryGameIdentity = {
  gameId: SupportedGameId | "unknown";
  productType: ProductType;
  provider?: "tcgtracking" | "tcgplayer" | "scryfall" | "manual";
  providerProductId?: string;
  providerSkuId?: string;
  tcgplayerProductId?: number;
  tcgplayerSkuId?: number;
  scryfallId?: string;
  name?: string;
  setCode?: string;
  collectorNumber?: string;
  condition?: string;
  variant?: string;
  language?: string;
};

export type GameAwareSearchResult = {
  game: GameIdentity;
  productType: ProductType;
  label: string;
  subtitle?: string;
  product: CatalogProduct;
};

export type MagicCatalogRowLike = {
  tcgplayer_id?: number | string | null;
  product_line?: string | null;
  set_name?: string | null;
  set_code?: string | null;
  product_name?: string | null;
  collector_number?: string | null;
  condition?: string | null;
  finish?: string | null;
  language?: string | null;
  photo_url?: string | null;
  tcg_market_price?: number | string | null;
  tcg_low_price?: number | string | null;
  tcg_high_price?: number | string | null;
};

export function productFromTcgTrackingProduct(
  product: TcgTrackingProduct,
): CatalogProduct {
  const game = gameFromCategory(product.categoryId);
  return {
    game,
    productType: "card",
    provider: "tcgtracking",
    providerProductId: product.providerProductId,
    tcgplayerProductId: product.tcgplayerProductId,
    name: product.name,
    set: product.setName || product.setCode || product.setId
      ? {
          game,
          provider: "tcgtracking",
          providerSetId: product.setId,
          name: product.setName ?? product.setCode ?? "Unknown set",
          code: product.setCode,
        }
      : undefined,
    collectorNumber: product.collectorNumber,
    rarity: product.rarity,
    imageUrl: product.imageUrl,
    externalIds: {
      scryfallId: product.scryfallId,
      mtgjsonUuid: product.mtgjsonUuid,
      cardtraderId: product.cardtraderId,
      cardmarketId: product.cardmarketId,
    },
    gameSpecific: isGameCapabilitySupported(game, "scryfall")
      ? {
          colors: product.colors,
          manaValue: product.manaValue,
          finishes: product.finishes,
        }
      : { variants: product.finishes },
  };
}

export function sealedProductFromTcgTracking(
  product: TcgTrackingSealedProduct,
): CatalogProduct {
  const game = gameFromCategory(product.categoryId);
  return {
    game,
    productType: "sealed",
    provider: "tcgtracking",
    providerProductId: product.providerProductId,
    tcgplayerProductId: product.tcgplayerProductId,
    name: product.name,
    set: product.setId
      ? {
          game,
          provider: "tcgtracking",
          providerSetId: product.setId,
          name: product.setId,
        }
      : undefined,
    imageUrl: product.imageUrl,
    externalIds: {},
    gameSpecific: {
      sealedType: product.productType,
    },
  };
}

export function skuFromTcgTrackingSku(
  sku: TcgTrackingSku,
  product: CatalogProduct,
): CatalogSku {
  return {
    game: product.game,
    product,
    provider: "tcgtracking",
    providerSkuId: sku.providerSkuId,
    tcgplayerSkuId: sku.tcgplayerSkuId,
    condition: sku.condition,
    variant: sku.variant,
    language: sku.language,
    marketPrice: marketSnapshotForGame(
      {
        providerProductId: sku.providerProductId,
        providerSkuId: sku.providerSkuId,
        tcgplayerProductId: sku.tcgplayerProductId,
        tcgplayerSkuId: sku.tcgplayerSkuId,
        tcgMarket: sku.marketPrice ?? null,
        tcgLow: sku.lowPrice ?? null,
        tcgHigh: sku.highPrice ?? null,
        activeListings: sku.activeListings ?? null,
        manapoolLow: sku.manapoolLow ?? null,
        updatedAt: sku.lastSyncedAt ?? new Date(0).toISOString(),
      },
      product.game,
    ),
  };
}

export function marketSnapshotForGame(
  snapshot: TcgTrackingPriceSnapshot | null,
  game: GameIdentity | SupportedGameId | string,
  now = new Date(),
): GameAwareMarketSnapshot {
  const resolvedGame = typeof game === "object"
    ? game
    : getSupportedGame(game) ?? gameFromCategory(TCGTRACKING_MAGIC_CATEGORY_ID);
  const market = marketSnapshotFromTcgTracking(snapshot, now);
  if (!isGameCapabilitySupported(resolvedGame, "manapool")) {
    return {
      ...market,
      gameId: resolvedGame.id,
      manapoolLow: null,
      crossMarketSpread: null,
    };
  }
  return { ...market, gameId: resolvedGame.id };
}

export function magicCatalogRowToGenericProduct(
  row: MagicCatalogRowLike,
): { product: CatalogProduct; sku: CatalogSku } | null {
  const name = stringValue(row.product_name);
  if (!name) return null;
  const game = getSupportedGame(MAGIC_GAME_ID);
  if (!game) return null;
  const product: CatalogProduct = {
    game,
    productType: stringValue(row.finish)?.toLowerCase() === "unopened"
      ? "sealed"
      : "card",
    provider: "tcgplayer",
    tcgplayerProductId: safeInteger(row.tcgplayer_id),
    name,
    set: {
      game,
      provider: "tcgplayer",
      name: stringValue(row.set_name) ?? "Unknown set",
      code: stringValue(row.set_code),
    },
    collectorNumber: stringValue(row.collector_number),
    imageUrl: stringValue(row.photo_url),
    externalIds: {},
    gameSpecific: {
      sourceTable: "tcgplayer_magic_catalog",
      productLine: stringValue(row.product_line) ?? "Magic",
    },
  };
  const market = marketSnapshotForGame(
    {
      tcgplayerProductId: product.tcgplayerProductId,
      tcgplayerSkuId: product.tcgplayerProductId,
      tcgMarket: numberValue(row.tcg_market_price),
      tcgLow: numberValue(row.tcg_low_price),
      tcgHigh: numberValue(row.tcg_high_price),
      activeListings: null,
      manapoolLow: null,
      updatedAt: new Date(0).toISOString(),
    },
    game,
  );
  return {
    product,
    sku: {
      game,
      product,
      provider: "tcgplayer",
      tcgplayerSkuId: product.tcgplayerProductId,
      condition: stringValue(row.condition),
      variant: stringValue(row.finish),
      language: stringValue(row.language),
      marketPrice: market,
    },
  };
}

export function inventoryGameIdentityFromRow(
  row: Record<string, unknown>,
): InventoryGameIdentity {
  const data = objectValue(row.data);
  const gameCandidate =
    stringValue(row.game_id) ??
    stringValue(row.game) ??
    stringValue(data?.gameId) ??
    stringValue(data?.game_id) ??
    stringValue(data?.game);
  const game = getSupportedGame(gameCandidate);
  const inferredMagic =
    Boolean(row.scryfall_id) ||
    Boolean(row.set_code) ||
    Boolean(row.collector_number);
  const gameId = game?.id ?? (inferredMagic ? MAGIC_GAME_ID : "unknown");

  return {
    gameId,
    productType: normalizeProductType(
      stringValue(row.product_type) ??
      stringValue(row.item_kind) ??
      stringValue(data?.productType) ??
      stringValue(data?.product_type),
    ),
    provider: providerValue(
      stringValue(row.provider) ??
      stringValue(data?.provider) ??
      (row.scryfall_id ? "scryfall" : undefined),
    ),
    providerProductId:
      stringValue(row.provider_product_id) ??
      stringValue(data?.providerProductId) ??
      stringValue(data?.provider_product_id),
    providerSkuId:
      stringValue(row.provider_sku_id) ??
      stringValue(data?.providerSkuId) ??
      stringValue(data?.provider_sku_id),
    tcgplayerProductId:
      safeInteger(row.tcgplayer_product_id) ??
      safeInteger(data?.tcgplayerProductId) ??
      safeInteger(data?.tcgplayer_product_id),
    tcgplayerSkuId:
      safeInteger(row.tcgplayer_sku_id) ??
      safeInteger(data?.tcgplayerSkuId) ??
      safeInteger(data?.tcgplayer_sku_id),
    scryfallId: stringValue(row.scryfall_id) ?? stringValue(data?.scryfallId),
    name: stringValue(row.card_name) ?? stringValue(data?.name),
    setCode: stringValue(row.set_code) ?? stringValue(data?.setCode),
    collectorNumber:
      stringValue(row.collector_number) ??
      stringValue(data?.collectorNumber),
    condition: stringValue(row.condition) ?? stringValue(data?.condition),
    variant:
      stringValue(row.variant) ??
      stringValue(row.finish) ??
      stringValue(data?.variant) ??
      stringValue(data?.finish),
    language: stringValue(row.language) ?? stringValue(data?.language),
  };
}

export function inventoryIdentityKey(identity: InventoryGameIdentity) {
  return [
    identity.gameId,
    identity.productType,
    identity.tcgplayerSkuId ?? identity.providerSkuId ?? "",
    identity.tcgplayerProductId ?? identity.providerProductId ?? identity.scryfallId ?? "",
    identity.setCode ?? "",
    identity.collectorNumber ?? "",
    identity.name?.toLowerCase() ?? "",
    identity.condition ?? "",
    identity.variant ?? "",
    identity.language ?? "",
  ].join("|");
}

export function gameAwareSearchResult(product: CatalogProduct): GameAwareSearchResult {
  const setLabel = [product.set?.code, product.collectorNumber]
    .filter(Boolean)
    .join(" #");
  return {
    game: product.game,
    productType: product.productType,
    label: product.name,
    subtitle: [product.game.displayName, setLabel || product.set?.name]
      .filter(Boolean)
      .join(" · "),
    product,
  };
}

function gameFromCategory(categoryId: string) {
  return (
    getGameByTcgTrackingCategory(categoryId) ??
    getSupportedGame(MAGIC_GAME_ID)
  )!;
}

function normalizeProductType(value: string | undefined): ProductType {
  return value?.toLowerCase() === "sealed" ||
    value?.toLowerCase() === "sealed_product"
    ? "sealed"
    : "card";
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : undefined;
}

function safeInteger(value: unknown) {
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed)) return parsed;
  }
  return undefined;
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/[$,]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function providerValue(value: string | undefined) {
  if (
    value === "tcgtracking" ||
    value === "tcgplayer" ||
    value === "scryfall" ||
    value === "manual"
  ) {
    return value;
  }
  return undefined;
}
