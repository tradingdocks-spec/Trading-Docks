import assert from "node:assert/strict";
import test from "node:test";

import {
  allocateCollectionPurchaseCost,
  calculateCollectionValuation,
  COLLECTION_INTAKE_SCENARIOS,
  inferReviewState,
  normalizeScenario,
  type CollectionIntakeItem,
} from "../src/lib/collection-intake/domain.ts";

function item(patch: Partial<CollectionIntakeItem>): CollectionIntakeItem {
  const hasUnitMarketValue = Object.prototype.hasOwnProperty.call(patch, "unitMarketValue");
  return {
    id: patch.id ?? "item-1",
    cardName: patch.cardName ?? "Lightning Bolt",
    gameId: patch.gameId ?? "magic",
    productType: patch.productType ?? "card",
    setCode: patch.setCode ?? "2X2",
    collectorNumber: patch.collectorNumber ?? "117",
    scryfallId: patch.scryfallId ?? null,
    tcgplayerProductId: patch.tcgplayerProductId ?? 12345,
    tcgplayerSkuId: patch.tcgplayerSkuId ?? 67890,
    condition: patch.condition ?? "Near Mint",
    finish: patch.finish ?? "nonfoil",
    language: patch.language ?? "English",
    quantity: patch.quantity ?? 1,
    unitMarketValue: hasUnitMarketValue ? patch.unitMarketValue ?? null : 2,
    reviewState: patch.reviewState ?? "ready",
    notes: patch.notes ?? "",
  };
}

test("collection valuation separates market value, costs, profit, and max offer", () => {
  const valuation = calculateCollectionValuation({
    items: [
      item({ id: "rhystic", cardName: "Rhystic Study", quantity: 1, unitMarketValue: 45 }),
      item({ id: "bolt", quantity: 4, unitMarketValue: 2 }),
      item({ id: "bulk", cardName: "Bulk rare", quantity: 25, unitMarketValue: 0.25 }),
    ],
    scenario: COLLECTION_INTAKE_SCENARIOS.standard,
  });

  assert.equal(valuation.totalQuantity, 30);
  assert.equal(valuation.uniqueLines, 3);
  assert.equal(valuation.marketValue, 59.25);
  assert.ok(valuation.sellableValue > 0);
  assert.ok(valuation.sellingCosts > 0);
  assert.ok(valuation.desiredProfit > 0);
  assert.equal(valuation.actualOffer, valuation.calculatedMaxOffer);
  assert.ok((valuation.offerPercentOfMarket ?? 0) > 0);
});

test("scenario assumptions materially change calculated max offer", () => {
  const items = [item({ quantity: 10, unitMarketValue: 10 })];
  const conservative = calculateCollectionValuation({
    items,
    scenario: COLLECTION_INTAKE_SCENARIOS.conservative,
  });
  const aggressive = calculateCollectionValuation({
    items,
    scenario: COLLECTION_INTAKE_SCENARIOS.aggressive,
  });

  assert.ok(aggressive.calculatedMaxOffer > conservative.calculatedMaxOffer);
  assert.notEqual(aggressive.roiPercent, conservative.roiPercent);
});

test("custom scenarios are bounded and normalized", () => {
  const scenario = normalizeScenario("custom", {
    label: "Counter offer",
    realizationPercent: 150,
    sellingCostPercent: -10,
    desiredProfitPercent: 20,
    perItemCost: "0.15",
  });

  assert.equal(scenario.label, "Counter offer");
  assert.equal(scenario.realizationPercent, 100);
  assert.equal(scenario.sellingCostPercent, 0);
  assert.equal(scenario.desiredProfitPercent, 20);
  assert.equal(scenario.perItemCost, 0.15);
});

test("review policy blocks ambiguous identity before valuation confidence", () => {
  assert.equal(inferReviewState({ cardName: "" }), "unresolved_identity");
  assert.equal(inferReviewState({ cardName: "Winota, Joiner of Forces", condition: "NM", finish: "nonfoil" }), "ambiguous_printing");
  assert.equal(inferReviewState({ cardName: "Sol Ring", setCode: "CMM", condition: "", finish: "nonfoil" }), "unknown_condition");
  assert.equal(inferReviewState({ cardName: "Sol Ring", setCode: "CMM", condition: "NM", finish: "" }), "unknown_finish");
  assert.equal(inferReviewState({ cardName: "Sol Ring", setCode: "CMM", condition: "NM", finish: "nonfoil", language: "English", unitMarketValue: null }), "missing_price");
  assert.equal(inferReviewState({ cardName: "Mox Diamond", setCode: "STH", condition: "NM", finish: "nonfoil", language: "English", unitMarketValue: 650 }), "high_value_confirmation");
});

test("missing prices are warning-only but reduce pricing coverage", () => {
  const valuation = calculateCollectionValuation({
    items: [
      item({ id: "priced", quantity: 2, unitMarketValue: 5 }),
      item({ id: "missing", quantity: 8, unitMarketValue: null, reviewState: "missing_price" }),
    ],
    scenario: COLLECTION_INTAKE_SCENARIOS.standard,
    actualOffer: 5,
  });

  assert.equal(valuation.warningReviewCount, 1);
  assert.equal(valuation.blockingReviewCount, 0);
  assert.equal(valuation.pricedQuantity, 2);
  assert.equal(valuation.unpricedQuantity, 8);
  assert.equal(valuation.pricingCoveragePercent, 20);
});

test("proportional cost allocation preserves exact total with rounding", () => {
  const allocations = allocateCollectionPurchaseCost([
    item({ id: "a", quantity: 1, unitMarketValue: 10 }),
    item({ id: "b", quantity: 3, unitMarketValue: 5 }),
    item({ id: "c", quantity: 2, unitMarketValue: 0 }),
  ], 20);

  assert.deepEqual(allocations.map((entry) => entry.itemId), ["a", "b", "c"]);
  assert.equal(
    allocations.reduce((sum, entry) => Math.round((sum + entry.allocatedTotalCost) * 100) / 100, 0),
    20,
  );
  assert.equal(allocations[2].allocatedTotalCost, 0);
  assert.equal(allocations[1].allocatedUnitCost, 4);
});
