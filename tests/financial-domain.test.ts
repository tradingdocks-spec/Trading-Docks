import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateRealizedProfit,
  resolveInventoryCostBasis,
  resolveInventoryPositionFinancials,
} from "../src/lib/financials/domain.ts";

test("cost basis distinguishes known, partial, and unknown coverage", () => {
  assert.deepEqual(resolveInventoryCostBasis([{ quantity: 3, unitCost: 2 }]), {
    quantity: 3,
    knownQuantity: 3,
    knownTotalCost: 6,
    weightedAverageUnitCost: 2,
    coverageRatio: 1,
    completeness: "known",
    coverageLabel: "Cost basis known for all copies",
  });

  const partial = resolveInventoryCostBasis([
    { quantity: 7, unitCost: 1.5 },
    { quantity: 3 },
  ]);
  assert.equal(partial.completeness, "partial");
  assert.equal(partial.knownQuantity, 7);
  assert.equal(partial.knownTotalCost, 10.5);
  assert.equal(partial.coverageLabel, "Known cost basis for 7 of 10 copies");

  const unknown = resolveInventoryCostBasis([{ quantity: 4 }]);
  assert.equal(unknown.completeness, "unknown");
  assert.equal(unknown.knownTotalCost, null);
  assert.equal(unknown.weightedAverageUnitCost, null);
});

test("position financials do not fabricate gain when cost is missing", () => {
  const position = resolveInventoryPositionFinancials({
    lots: [{ quantity: 2 }],
    marketValue: 40,
  });
  assert.equal(position.marketValue, 40);
  assert.equal(position.unrealizedGain, null);
  assert.equal(position.coverageLabel, "Cost basis missing");
});

test("realized profit excludes tax and refuses ROI when cost basis is missing or zero", () => {
  const known = calculateRealizedProfit({
    grossSale: 120,
    taxCollected: 8,
    marketplaceFees: 12,
    paymentFees: 3,
    sellerShipping: 5,
    suppliesCost: 2,
    refunds: 10,
    allocatedCostBasis: 40,
  });
  assert.equal(known.sellerRevenue, 112);
  assert.equal(known.netProceeds, 80);
  assert.equal(known.realizedProfit, 40);
  assert.equal(known.margin, 40 / 112);
  assert.equal(known.roi, 1);

  const missing = calculateRealizedProfit({ grossSale: 50, allocatedCostBasis: null });
  assert.equal(missing.realizedProfit, null);
  assert.equal(missing.completeness, "cost_basis_missing");
  assert.deepEqual(missing.missingFields, ["allocatedCostBasis"]);

  const zero = calculateRealizedProfit({ grossSale: 20, allocatedCostBasis: 0 });
  assert.equal(zero.realizedProfit, 20);
  assert.equal(zero.roi, null);
});
