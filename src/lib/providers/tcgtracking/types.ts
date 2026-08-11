export type TcgTrackingCategoryId = string;
export type TcgTrackingSetId = string;
export type TcgTrackingProductId = string;
export type TcgTrackingSkuId = string;

export type TcgTrackingProviderConfig = {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  retries?: number;
  fetch?: typeof fetch;
};

export type TcgTrackingMeta = {
  provider: "tcgtracking";
  baseUrl: string;
  status: "available" | "unavailable";
  version?: string;
  generatedAt?: string;
  rawKeys: string[];
};

export type TcgTrackingCategory = {
  id: TcgTrackingCategoryId;
  name: string;
  slug?: string;
};

export type TcgTrackingSet = {
  id: TcgTrackingSetId;
  categoryId: TcgTrackingCategoryId;
  name: string;
  abbreviation?: string;
  releasedAt?: string;
};

export type TcgTrackingProduct = {
  providerProductId: TcgTrackingProductId;
  categoryId: TcgTrackingCategoryId;
  setId?: TcgTrackingSetId;
  tcgplayerProductId?: number;
  name: string;
  cleanName?: string;
  setName?: string;
  setCode?: string;
  collectorNumber?: string;
  rarity?: string;
  imageUrl?: string;
  scryfallId?: string;
  mtgjsonUuid?: string;
  cardtraderId?: string;
  cardmarketId?: string;
  colors: string[];
  manaValue?: number;
  finishes: string[];
  raw: unknown;
};

export type TcgTrackingSku = {
  providerSkuId: TcgTrackingSkuId;
  providerProductId?: TcgTrackingProductId;
  tcgplayerSkuId?: number;
  tcgplayerProductId?: number;
  condition?: string;
  conditionCode?: string;
  variant?: string;
  variantAbbreviation?: string;
  variantId?: string;
  language?: string;
  marketPrice?: number;
  lowPrice?: number;
  highPrice?: number;
  activeListings?: number;
  manapoolLow?: number;
  lastSyncedAt?: string;
  raw: unknown;
};

export type TcgTrackingSealedProduct = {
  providerProductId: TcgTrackingProductId;
  categoryId: TcgTrackingCategoryId;
  setId?: TcgTrackingSetId;
  tcgplayerProductId?: number;
  name: string;
  productType?: string;
  imageUrl?: string;
  marketPrice?: number;
  lowPrice?: number;
  highPrice?: number;
  raw: unknown;
};

export type TcgTrackingPriceSnapshot = {
  providerProductId?: TcgTrackingProductId;
  providerSkuId?: TcgTrackingSkuId;
  tcgplayerProductId?: number;
  tcgplayerSkuId?: number;
  tcgMarket: number | null;
  tcgLow: number | null;
  tcgHigh: number | null;
  activeListings: number | null;
  manapoolLow: number | null;
  updatedAt: string;
};

export type TcgTrackingScanCandidate = {
  providerProductId?: TcgTrackingProductId;
  tcgplayerProductId?: number;
  name?: string;
  setName?: string;
  setCode?: string;
  collectorNumber?: string;
  imageUrl?: string;
  confidence: number;
  metadata: Record<string, unknown>;
};

export type TcgTrackingScanResult = {
  provider: "tcgtracking";
  status: "matched" | "unresolved" | "provider_failed";
  candidates: TcgTrackingScanCandidate[];
  latencyMs?: number;
  error?: string;
};

export type TradingDocksProductIdentity = {
  gameCategoryId: string;
  tcgplayerProductId?: number;
  name: string;
  setName?: string;
  setCode?: string;
  collectorNumber?: string;
  scryfallId?: string;
  mtgjsonUuid?: string;
  cardtraderId?: string;
  cardmarketId?: string;
  imageUrl?: string;
  providerProductId?: string;
};

export type TradingDocksSkuIdentity = {
  tcgplayerSkuId?: number;
  tcgplayerProductId?: number;
  condition?: string;
  variant?: string;
  variantId?: string;
  language?: string;
  providerSkuId?: string;
};

export type TcgTrackingReconciliationResult = {
  status: "matched" | "conflict" | "missing_provider_product" | "missing_local_catalog";
  product?: TradingDocksProductIdentity;
  sku?: TradingDocksSkuIdentity;
  conflicts: Array<{
    field: string;
    local: unknown;
    provider: unknown;
  }>;
};

export type TcgTrackingProviderHealth = {
  provider: "tcgtracking";
  status: "available" | "unavailable";
  baseUrl: string;
  metaVersion?: string;
  categoryCount?: number;
  lastCheckedAt: string;
  latencyMs: number | null;
  cachePolicy: {
    staticDataTtlDays: number;
    pricingTtlHours: number;
  };
  localSchema: "proposal-only";
  sync?: {
    mapping?: {
      status: string;
      processed: number;
      updatedAt?: string;
      completedAt?: string | null;
    } | null;
    pricing?: {
      status: string;
      processed: number;
      updatedAt?: string;
      completedAt?: string | null;
    } | null;
  };
  error?: string;
};
