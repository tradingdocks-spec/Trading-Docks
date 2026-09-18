import type {
  ListingCandidate,
  MarketplaceCapabilities,
  SellingMarketplace,
} from "./types";

export type MarketplaceAccount = {
  id: string;
  marketplace: SellingMarketplace;
  externalAccountId?: string | null;
  status: "not_connected" | "connected" | "attention" | "expired";
  lastSyncAt?: string | null;
};

export type MarketplaceResult<T> = {
  ok: boolean;
  value?: T;
  error?: { code: string; message: string; retryable: boolean };
};

export interface MarketplaceAdapter {
  readonly marketplace: SellingMarketplace;
  readonly capabilities: MarketplaceCapabilities;
  connectAccount?: () => Promise<MarketplaceResult<MarketplaceAccount>>;
  disconnectAccount?: () => Promise<MarketplaceResult<void>>;
  validateConnection?: () => Promise<MarketplaceResult<MarketplaceAccount>>;
  prepareListing?: (candidate: ListingCandidate) => Promise<MarketplaceResult<unknown>>;
  publishListing?: (prepared: unknown, idempotencyKey: string) => Promise<MarketplaceResult<{ externalListingId: string }>>;
  updateListing?: (externalListingId: string, prepared: unknown, idempotencyKey: string) => Promise<MarketplaceResult<void>>;
  updatePrice?: (externalListingId: string, price: number, idempotencyKey: string) => Promise<MarketplaceResult<void>>;
  updateQuantity?: (externalListingId: string, quantity: number, idempotencyKey: string) => Promise<MarketplaceResult<void>>;
  endListing?: (externalListingId: string, idempotencyKey: string) => Promise<MarketplaceResult<void>>;
  getListing?: (externalListingId: string) => Promise<MarketplaceResult<unknown>>;
  getListings?: () => Promise<MarketplaceResult<unknown[]>>;
  getOrders?: () => Promise<MarketplaceResult<unknown[]>>;
  acknowledgeOrder?: (externalOrderId: string, idempotencyKey: string) => Promise<MarketplaceResult<void>>;
  syncInventory?: () => Promise<MarketplaceResult<{ changed: number }>>;
  syncOrders?: () => Promise<MarketplaceResult<{ imported: number }>>;
}

const readOnlyCapabilities: MarketplaceCapabilities = {
  supportsPublishing: false,
  supportsQuantitySync: false,
  supportsOrderImport: false,
  supportsImages: false,
  supportsVariantListings: false,
  supportsShippingPolicies: false,
  supportsStoreCategories: false,
};

const ebayCapabilities: MarketplaceCapabilities = {
  ...readOnlyCapabilities,
  supportsPublishing: true,
  supportsQuantitySync: true,
  supportsOrderImport: true,
  supportsImages: true,
  supportsShippingPolicies: true,
  supportsStoreCategories: true,
};

export const MARKETPLACE_CAPABILITIES: Record<SellingMarketplace, MarketplaceCapabilities> = {
  ebay: ebayCapabilities,
  mana_pool: { ...readOnlyCapabilities, supportsPublishing: true, supportsQuantitySync: true, supportsOrderImport: true },
  shopify: { ...readOnlyCapabilities, supportsPublishing: true, supportsQuantitySync: true, supportsOrderImport: true, supportsImages: true, supportsVariantListings: true, supportsShippingPolicies: true, supportsStoreCategories: true },
};

export function getMarketplaceCapabilities(marketplace: SellingMarketplace) {
  return MARKETPLACE_CAPABILITIES[marketplace];
}

export function createMarketplaceAdapter(marketplace: SellingMarketplace): MarketplaceAdapter {
  return {
    marketplace,
    capabilities: getMarketplaceCapabilities(marketplace),
  };
}
