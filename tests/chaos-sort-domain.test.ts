import test from "node:test";
import assert from "node:assert/strict";

import {
  buildChaosSortPlan,
  buildDefaultChaosSortRules,
  classifyChaosSortRecognition,
  createChaosSortBatchCode,
  summarizeChaosSortBatch,
  type ChaosSortBatch,
  type ChaosSortItem,
} from "../src/lib/chaos-sort/domain.ts";

function item(overrides: Partial<ChaosSortItem>): ChaosSortItem {
  const now = new Date().toISOString();
  return {
    id: overrides.id ?? crypto.randomUUID(),
    batchId: "batch-1",
    sourceFileName: "scan.jpg",
    sourceFileHash: "hash-1",
    sourceImageUrl: null,
    processingState: "ready",
    recognitionState: "high_confidence",
    humanState: "confirmed",
    cardName: "Lightning Bolt",
    scryfallId: null,
    gameId: "magic",
    setCode: "M11",
    collectorNumber: "146",
    rarity: "common",
    finish: "nonfoil",
    condition: "Near Mint",
    quantity: 1,
    marketPrice: 0.55,
    existingOwnedQuantity: 0,
    destinationLocationId: null,
    destinationLabel: "Unassigned",
    sortPile: "bulk_cu",
    sortPass: 1,
    confidence: 0.91,
    evidence: ["vision"],
    notes: "",
    duplicateOfItemId: null,
    sortRuleId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

test("chaos sort batch codes stay stable and readable", () => {
  assert.equal(createChaosSortBatchCode(1), "CS-000001");
  assert.equal(createChaosSortBatchCode(123), "CS-000123");
});

test("recognition confidence maps to review states", () => {
  assert.equal(
    classifyChaosSortRecognition({
      processingState: "ready",
      confidence: 0.91,
      cardName: "Lightning Bolt",
      setCode: "M11",
      collectorNumber: "146",
    }),
    "high_confidence",
  );
  assert.equal(
    classifyChaosSortRecognition({
      processingState: "ready",
      confidence: 0.51,
      cardName: "Lightning Bolt",
      setCode: null,
      collectorNumber: null,
    }),
    "review",
  );
  assert.equal(
    classifyChaosSortRecognition({
      processingState: "failed",
      confidence: 0.99,
      cardName: "Lightning Bolt",
      setCode: "M11",
      collectorNumber: "146",
    }),
    "unknown",
  );
});

test("default rules route cards into the expected first-pass piles", () => {
  const rules = buildDefaultChaosSortRules();
  const plan = buildChaosSortPlan([
    item({ id: "foil", finish: "foil", marketPrice: 2.1 }),
    item({ id: "value", finish: "nonfoil", marketPrice: 9.5, cardName: "The One Ring" }),
    item({ id: "bulk", finish: "nonfoil", marketPrice: 0.35, rarity: "common", cardName: "Opt" }),
    item({ id: "review", recognitionState: "review", humanState: "pending", confidence: 0.4, cardName: "Unknown card" }),
  ], rules);

  const piles = new Map(plan.items.map((entry) => [entry.itemId, entry.pile]));
  assert.equal(piles.get("foil"), "foil");
  assert.equal(piles.get("value"), "high_value");
  assert.equal(piles.get("bulk"), "bulk_cu");
  assert.equal(piles.get("review"), "review");
});

test("batch summaries count confirmed, unknown, and duplicate items", () => {
  const batch: ChaosSortBatch = {
    id: "batch-1",
    batchCode: "CS-000123",
    title: "Test batch",
    status: "review",
    sourceCount: 3,
    duplicateCount: 1,
    identifiedCount: 2,
    confirmedCount: 1,
    needsReviewCount: 1,
    unknownCount: 1,
    estimatedMarketValue: 12.5,
    acquisitionCost: null,
    destinationLocationId: null,
    destinationLabel: "Unassigned",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [
      item({ id: "confirmed", humanState: "confirmed", recognitionState: "high_confidence" }),
      item({ id: "review", humanState: "pending", recognitionState: "review" }),
      item({ id: "duplicate", humanState: "unknown", recognitionState: "unknown", duplicateOfItemId: "confirmed" }),
    ],
    rules: buildDefaultChaosSortRules(),
  };

  const summary = summarizeChaosSortBatch(batch);
  assert.equal(summary.totalImages, 3);
  assert.equal(summary.confirmed, 1);
  assert.equal(summary.needsReview, 1);
  assert.equal(summary.unknown, 1);
  assert.equal(summary.duplicateInventoryPositions, 1);
});
