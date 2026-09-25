import assert from "node:assert/strict";
import test from "node:test";
import { offerMatchesItem, resolveBuylistMatch, type BuylistOffer, type InventoryBuylistItem } from "../src/lib/buylist.ts";
import { intelligenceValue } from "../src/lib/intelligence-provenance.ts";
import { normalizeCard } from "../src/lib/market-engine/helpers.ts";

const item: InventoryBuylistItem = { id: "stock", name: "Fixture", quantity: 2, scryfallId: "printing-a", set: "abc", collectorNumber: "42", finish: "normal", condition: "NM", language: "en" };
const offer: BuylistOffer = { id: "offer", store_name: "Fixture store", scryfall_id: "printing-a", card_name: "Fixture", set_code: "abc", collector_number: "42", finish: "nonfoil", condition: "NM", language: "English", cash_price: 1, credit_price: null, quantity_wanted: 2, source_url: null, verified_at: "2026-09-24T00:00:00Z" };

test("buylist confirms explicit physical attributes without confusing nonfoil with foil", () => {
  assert.equal(offerMatchesItem(offer, item), true);
  assert.equal(offerMatchesItem({ ...offer, finish: "foil" }, item), false);
});
for (const [name, patch] of [
  ["foil ambiguity", { finish: undefined }],
  ["unknown condition", { condition: undefined }],
  ["unknown language", { language: undefined }],
  ["same-name multiple printings", { scryfallId: undefined, candidateCount: 2 }],
  ["collector conflict despite matching provider ID", { collectorNumber: "43" }],
  ["provider disagreement", { conflictingSignals: ["providers disagree"] }],
  ["set conflict despite matching provider ID", { set: "def" }],
  ["variant ambiguity", { variantAmbiguous: true }],
] as const) {
  test(`buylist requires review for ${name}`, () => {
    const result = resolveBuylistMatch(offer, { ...item, ...patch });
    assert.equal(result.state, "REVIEW_REQUIRED");
    assert.equal(result.canFinalize, false);
    assert.ok(result.reasons.length);
  });
}
test("name alone and blank offer attributes never establish an exact match", () => {
  assert.equal(offerMatchesItem({ ...offer, scryfall_id: null, set_code: "", collector_number: "" }, { ...item, scryfallId: undefined, set: undefined, collectorNumber: undefined }), false);
  assert.equal(offerMatchesItem({ ...offer, finish: "", condition: "", language: "" }, item), false);
});
test("synthetic and unsourced metrics cannot masquerade as production observations", () => {
  for (const status of ["SYNTHETIC", "UNAVAILABLE", "INSUFFICIENT_DATA"] as const) {
    const result = intelligenceValue({ value: 93, status, confidence: .98, observedAt: null, sources: ["demo"], inputs: [], explanation: "fixture" });
    assert.equal(result.value, null);
    assert.equal(result.confidence, null);
  }
  assert.equal(intelligenceValue({ value: 93, status: "OBSERVED", confidence: .98, observedAt: null, sources: [], inputs: [], explanation: "No source" }).value, null);
});
test("market quote does not synthesize demand, trends, low price, ownership or revenue", () => {
  const input = { id: "quote", game: "magic" as const, name: "Fixture", subtitle: "", setName: "", setCode: "abc", collectorNumber: "42", image: "", marketPrice: 10, inventoryOwned: 100, index: 1, source: "Fixture provider", dataQuality: "live" as const };
  const card = normalizeCard(input);
  assert.equal(card.marketPrice, 10);
  assert.equal(card.provenance.marketPrice.status, "OBSERVED");
  for (const field of ["lowPrice", "change24h", "change7d", "volumeScore", "opportunityScore", "inventoryOwned", "potentialRevenue", "demand", "signal"] as const) {
    assert.equal(card[field], null, field);
    assert.equal(card.provenance[field].status, "INSUFFICIENT_DATA");
  }
  assert.deepEqual(card.sparkline, []);
  assert.equal(normalizeCard({ ...input, dataQuality: "fallback" }).marketPrice, null);
  assert.equal(normalizeCard({ ...input, dataQuality: "reference" }).marketPrice, null);
});
