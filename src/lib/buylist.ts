import { knownAttribute, physicalFinish, physicalLanguage, physicalResolution } from "./card-intelligence/resolution.ts";

export type InventoryBuylistItem = {
  id: string; name: string; quantity: number; set?: string; collectorNumber?: string;
  scryfallId?: string; finish?: string; language?: string; condition?: string;
  unitMarketValue?: number; value?: number; imageUrl?: string;
  variant?: string; variantAmbiguous?: boolean; candidateCount?: number; conflictingSignals?: string[];
};

export type BuylistOffer = {
  id: string; store_name: string; scryfall_id: string | null; card_name: string;
  set_code: string; collector_number: string; finish: string; language: string;
  condition: string; cash_price: number; credit_price: number | null;
  quantity_wanted: number; source_url: string | null; verified_at: string;
  provider?: string; source_kind?: string; indicative?: boolean; expires_at?: string | null; variant?: string;
};

const clean = (value?: string | null) => (value ?? "").trim().toLowerCase();
export function offerMatchesItem(offer: BuylistOffer, item: InventoryBuylistItem) {
  return resolveBuylistMatch(offer, item).canFinalize;
}

export function resolveBuylistMatch(offer: BuylistOffer, item: InventoryBuylistItem) {
  const conflicts = [...(item.conflictingSignals ?? [])];
  for (const [field, left, right] of [
    ["printing", item.scryfallId, offer.scryfall_id],
    ["set", item.set, offer.set_code],
    ["collector number", item.collectorNumber, offer.collector_number],
    ["variant", item.variant, offer.variant],
  ]) {
    if (knownAttribute(left) && knownAttribute(right) && clean(left) !== clean(right)) conflicts.push(`${field} conflict`);
  }
  const identityMatches = knownAttribute(item.scryfallId) && knownAttribute(offer.scryfall_id)
    ? clean(item.scryfallId) === clean(offer.scryfall_id)
    : Boolean(knownAttribute(item.set) && knownAttribute(item.collectorNumber)) && clean(item.name) === clean(offer.card_name) &&
      clean(item.set) === clean(offer.set_code) &&
      clean(item.collectorNumber) === clean(offer.collector_number);
  if (!physicalFinish(offer.finish) || physicalFinish(item.finish) !== physicalFinish(offer.finish)) conflicts.push("Finish unconfirmed or different");
  if (!physicalLanguage(offer.language) || physicalLanguage(item.language) !== physicalLanguage(offer.language)) conflicts.push("Language unconfirmed or different");
  if (!knownAttribute(offer.condition) || knownAttribute(item.condition) !== knownAttribute(offer.condition)) conflicts.push("Condition unconfirmed or different");
  return physicalResolution({ exactPrinting: Boolean(identityMatches), candidateCount: item.candidateCount,
    finish: item.finish, language: item.language, condition: item.condition, conflicts,
    variantAmbiguous: item.variantAmbiguous || Boolean(offer.variant && !item.variant),
  });
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
