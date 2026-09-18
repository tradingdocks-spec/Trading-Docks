import type { MarketplaceResult } from "./adapter.ts";

export type EbayListingInput = {
  tradingDocksCandidateId: string;
  inventoryItemId: string;
  cardName: string;
  setCode?: string | null;
  collectorNumber?: string | null;
  game?: string | null;
  condition?: string | null;
  listingPrice?: number | null;
  quantity?: number | null;
  imageUrls?: string[];
  categoryId?: string | null;
  sellerAccountId?: string | null;
  merchantLocationKey?: string | null;
  fulfillmentPolicyId?: string | null;
  paymentPolicyId?: string | null;
  returnPolicyId?: string | null;
  itemSpecifics?: Record<string, string[]>;
  titleOverride?: string | null;
};

export type EbayPreparedListing = {
  sku: string;
  title: string;
  categoryId: string | null;
  condition: string | null;
  price: number | null;
  quantity: number | null;
  imageUrls: string[];
  merchantLocationKey: string | null;
  fulfillmentPolicyId: string | null;
  paymentPolicyId: string | null;
  returnPolicyId: string | null;
  itemSpecifics: Record<string, string[]>;
  candidateId: string;
};

export type EbayReadinessBlocker = { code: string; message: string };

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36).toUpperCase().padStart(7, "0");
}

export function stableEbaySku(input: Pick<EbayListingInput, "tradingDocksCandidateId" | "inventoryItemId">) {
  return `TD-${hash(`${input.tradingDocksCandidateId}:${input.inventoryItemId}`)}`;
}

export function generateEbayTitle(input: Pick<EbayListingInput, "cardName" | "setCode" | "collectorNumber" | "game" | "condition" | "titleOverride">, maxLength = 80) {
  const fallback = [input.cardName || "Trading Docks Card", input.collectorNumber ? `#${input.collectorNumber}` : null, input.setCode, input.game === "magic" || !input.game ? "MTG" : input.game, input.condition].filter(Boolean).join(" ");
  const title = (input.titleOverride?.trim() || fallback).replace(/\s+/g, " ").trim();
  return title.slice(0, Math.max(1, maxLength)).trim();
}

export function mapEbayCondition(condition?: string | null) {
  const normalized = condition?.trim().toUpperCase();
  if (!normalized) return null;
  const values: Record<string, string> = { NM: "NEW", M: "NEW", LP: "USED_EXCELLENT", MP: "USED_GOOD", HP: "USED_ACCEPTABLE", DMG: "USED_ACCEPTABLE" };
  return values[normalized] ?? null;
}

export function prepareEbayListing(input: EbayListingInput): EbayPreparedListing {
  return {
    sku: stableEbaySku(input),
    title: generateEbayTitle(input),
    categoryId: input.categoryId?.trim() || null,
    condition: mapEbayCondition(input.condition),
    price: typeof input.listingPrice === "number" && Number.isFinite(input.listingPrice) ? input.listingPrice : null,
    quantity: Number.isInteger(input.quantity) ? input.quantity! : null,
    imageUrls: [...new Set((input.imageUrls ?? []).filter((url) => /^https:\/\//i.test(url)))],
    merchantLocationKey: input.merchantLocationKey?.trim() || null,
    fulfillmentPolicyId: input.fulfillmentPolicyId?.trim() || null,
    paymentPolicyId: input.paymentPolicyId?.trim() || null,
    returnPolicyId: input.returnPolicyId?.trim() || null,
    itemSpecifics: input.itemSpecifics ?? {},
    candidateId: input.tradingDocksCandidateId,
  };
}

export function validateEbayListing(input: EbayListingInput): EbayReadinessBlocker[] {
  const blockers: EbayReadinessBlocker[] = [];
  if (!input.sellerAccountId) blockers.push({ code: "NEEDS_SELLER_ACCOUNT", message: "Connect an eBay seller account." });
  if (!input.merchantLocationKey) blockers.push({ code: "NEEDS_MERCHANT_LOCATION", message: "Choose an eBay inventory location." });
  if (!input.categoryId) blockers.push({ code: "NEEDS_EBAY_CATEGORY", message: "Choose an eBay category." });
  if (!mapEbayCondition(input.condition)) blockers.push({ code: "NEEDS_EBAY_CONDITION_MAPPING", message: "Map the inventory condition to an eBay condition." });
  if (input.listingPrice == null || input.listingPrice <= 0) blockers.push({ code: "NEEDS_PRICE", message: "Set a listing price before publishing." });
  if (!Number.isInteger(input.quantity) || input.quantity! < 1) blockers.push({ code: "NEEDS_QUANTITY", message: "Set an available quantity before publishing." });
  if (!input.fulfillmentPolicyId) blockers.push({ code: "NEEDS_SHIPPING_POLICY", message: "Choose an eBay fulfillment policy." });
  if (!input.paymentPolicyId) blockers.push({ code: "NEEDS_PAYMENT_POLICY", message: "Choose an eBay payment policy." });
  if (!input.returnPolicyId) blockers.push({ code: "NEEDS_RETURN_POLICY", message: "Choose an eBay return policy." });
  if (!(input.imageUrls ?? []).some((url) => /^https:\/\//i.test(url))) blockers.push({ code: "NEEDS_IMAGE", message: "Add at least one HTTPS listing image." });
  return blockers;
}

export type EbayPublishAdapter = {
  prepare: (input: EbayListingInput) => MarketplaceResult<EbayPreparedListing>;
  publish: (prepared: EbayPreparedListing, idempotencyKey: string) => Promise<MarketplaceResult<{ externalListingId: string; sku: string }>>;
};

export function createMockEbayAdapter(): EbayPublishAdapter {
  const published = new Map<string, { externalListingId: string; sku: string }>();
  return {
    prepare(input) {
      const blockers = validateEbayListing(input);
      if (blockers.length) return { ok: false, error: { code: blockers[0].code, message: blockers.map((blocker) => blocker.message).join(" "), retryable: false } };
      return { ok: true, value: prepareEbayListing(input) };
    },
    async publish(prepared, idempotencyKey) {
      const existing = published.get(idempotencyKey);
      if (existing) return { ok: true, value: existing };
      const value = { externalListingId: `MOCK-${hash(idempotencyKey)}`, sku: prepared.sku };
      published.set(idempotencyKey, value);
      return { ok: true, value };
    },
  };
}
