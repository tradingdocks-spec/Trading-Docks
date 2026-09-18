export const SELLING_MARKETPLACES = ["ebay", "mana_pool", "shopify"] as const;

export type SellingMarketplace = (typeof SELLING_MARKETPLACES)[number];

export type MarketplaceCapabilities = {
  supportsPublishing: boolean;
  supportsQuantitySync: boolean;
  supportsOrderImport: boolean;
  supportsImages: boolean;
  supportsVariantListings: boolean;
  supportsShippingPolicies: boolean;
  supportsStoreCategories: boolean;
};

export type ListingLifecycle =
  | "DRAFT"
  | "READY"
  | "QUEUED"
  | "PUBLISHING"
  | "ACTIVE"
  | "PARTIALLY_ACTIVE"
  | "NEEDS_ATTENTION"
  | "FAILED"
  | "ENDED"
  | "SOLD_OUT";

export type ListingReadinessCode =
  | "READY"
  | "NEEDS_PRICE"
  | "NEEDS_CONDITION"
  | "NEEDS_MATCH_REVIEW"
  | "NEEDS_CATEGORY"
  | "NEEDS_SHIPPING_POLICY"
  | "NEEDS_IMAGE"
  | "DUPLICATE_LISTING"
  | "ALREADY_LISTED"
  | "MARKETPLACE_ERROR";

export type InventoryPositionReference = {
  inventoryItemId: string;
  inventoryPositionId?: string | null;
  inventoryBatchId?: string | null;
  locationId?: string | null;
  quantity: number;
  costBasis?: number | null;
};

export type ListingCandidate = InventoryPositionReference & {
  id: string;
  batchId: string;
  cardName: string;
  setCode?: string | null;
  collectorNumber?: string | null;
  finish?: string | null;
  condition?: string | null;
  language?: string | null;
  marketPrice?: number | null;
  listingPrice?: number | null;
  readiness: ListingReadinessCode;
  readinessMessage: string;
};
