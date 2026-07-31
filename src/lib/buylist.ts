export type InventoryBuylistItem = {
  id: string; name: string; quantity: number; set?: string; collectorNumber?: string;
  scryfallId?: string; finish?: string; language?: string; condition?: string;
  unitMarketValue?: number; value?: number; imageUrl?: string;
};

export type BuylistOffer = {
  id: string; store_name: string; scryfall_id: string | null; card_name: string;
  set_code: string; collector_number: string; finish: string; language: string;
  condition: string; cash_price: number; credit_price: number | null;
  quantity_wanted: number; source_url: string | null; verified_at: string;
  provider?: string; source_kind?: string; indicative?: boolean; expires_at?: string | null;
};

const clean = (value?: string | null) => (value ?? "").trim().toLowerCase();
export function offerMatchesItem(offer: BuylistOffer, item: InventoryBuylistItem) {
  const identityMatches = item.scryfallId && offer.scryfall_id
    ? clean(item.scryfallId) === clean(offer.scryfall_id)
    : clean(item.name) === clean(offer.card_name) &&
      clean(item.set) === clean(offer.set_code) &&
      clean(item.collectorNumber) === clean(offer.collector_number);
  return Boolean(identityMatches) &&
    clean(item.finish || "nonfoil") === clean(offer.finish || "nonfoil") &&
    clean(item.language || "English") === clean(offer.language || "English") &&
    clean(item.condition || "NM") === clean(offer.condition || "NM");
}

export function marketUnitValue(item: InventoryBuylistItem) {
  if (typeof item.unitMarketValue === "number") return item.unitMarketValue;
  return item.quantity > 0 ? Number(item.value || 0) / item.quantity : 0;
}

export function freshness(verifiedAt: string) {
  const age = Date.now() - new Date(verifiedAt).getTime();
  const hours = Math.max(0, Math.floor(age / 3_600_000));
  return { hours, stale: hours > 24, label: hours < 1 ? "Just verified" : hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago` };
}
