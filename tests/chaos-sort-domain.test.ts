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
import {
  buildDeterministicPickTasks,
  buildPhysicalLocationMap,
  markPickTask,
  pickLocationCount,
  resolveOrderItemPhysicalLocation,
} from "../src/lib/orders/pick-domain.ts";
import {
  buildChaosSortQueue,
  claimChaosSortQueueItem,
  chaosSortRetryDelayMs,
  CHAOS_SORT_MAX_BATCH_SIZE,
  CHAOS_SORT_MAX_RECOGNITION_ATTEMPTS,
  parseRetryAfterMs,
  runBoundedChaosSortQueue,
} from "../src/lib/chaos-sort/batch-queue.ts";
import { classifyProviderFailure, providerFailureDetails } from "../src/lib/chaos-sort/provider-errors.ts";

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

test("physical locations resolve through the authoritative parent hierarchy", () => {
  const locations = [
    { id: "shelf-a", name: "Shelf A", data: {} },
    { id: "box-2", name: "Box 2", data: { parentId: "shelf-a" } },
    { id: "divider-b", name: "Divider A-2-B", data: { parentId: "box-2" } },
  ];
  const inventory = [{ id: "item-1", card_name: "Lightning Bolt", location_id: "divider-b", data: {} }];
  const location = resolveOrderItemPhysicalLocation({ id: "line-1", title: "Lightning Bolt", quantity: 1 }, inventory, locations);
  assert.equal(location?.pathLabel, "Shelf A › Box 2 › Divider A-2-B");
  assert.equal(buildPhysicalLocationMap(locations).get("divider-b"), location?.pathLabel);
  assert.equal(resolveOrderItemPhysicalLocation({ id: "line-2", title: "Counterspell", quantity: 1 }, inventory, locations), null);
});

test("pick tasks sort deterministically by physical location and preserve missing state", () => {
  const tasks = buildDeterministicPickTasks([
    { id: "c", title: "Lightning Bolt", quantity: 1, physicalLocation: { id: "b", name: "Divider A-2-B", pathLabel: "Shelf A › Box 2 › Divider A-2-B", sortKey: "Shelf A › Box 2 › Divider A-2-B" } },
    { id: "a", title: "Sol Ring", quantity: 1, physicalLocation: { id: "a", name: "Divider A-1-A", pathLabel: "Shelf A › Box 1 › Divider A-1-A", sortKey: "Shelf A › Box 1 › Divider A-1-A" } },
    { id: "u", title: "Unknown Card", quantity: 1 },
  ]);
  assert.deepEqual(tasks.map((task) => task.id), ["a", "c", "u"]);
  assert.equal(pickLocationCount(tasks), 3);
  const missing = markPickTask(tasks, "c", "missing");
  assert.equal(missing.find((task) => task.id === "c")?.state, "missing");
  assert.equal(tasks.find((task) => task.id === "c")?.state, "ready");
});

test("chaos sort queues at most 100 images and keeps recognition concurrency bounded", async () => {
  const queue = buildChaosSortQueue(Array.from({ length: 125 }, (_, index) => index), (value) => `scan-${value}`);
  assert.equal(queue.length, CHAOS_SORT_MAX_BATCH_SIZE);
  assert.equal(queue[0]?.state, "queued");
  let active = 0;
  let peak = 0;
  await runBoundedChaosSortQueue(queue, async (entry) => {
    entry.state = entry.input % 7 === 0 ? "failed" : "identified";
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active -= 1;
  }, 4);
  assert.ok(peak <= 4);
  assert.equal(queue.filter((entry) => entry.state === "failed").length, 15);
  assert.equal(queue.filter((entry) => entry.state === "identified").length, 85);
});

test("a queued recognition item can only be claimed once", async () => {
  const queue = buildChaosSortQueue(["scan-1"], (value) => value);
  const item = queue[0];
  if (!item) throw new Error("Expected one queued item.");
  assert.equal(item?.state, "queued");
  assert.equal(claimChaosSortQueueItem(item), true);
  assert.equal(claimChaosSortQueueItem(item), false);
  assert.equal(item.state, "processing");
});

test("retry-after and recognition backoff stay bounded", () => {
  assert.equal(parseRetryAfterMs("2"), 2000);
  assert.equal(parseRetryAfterMs("999"), 30_000);
  assert.equal(parseRetryAfterMs("not-a-date"), null);
  assert.equal(chaosSortRetryDelayMs(1), 500);
  assert.equal(chaosSortRetryDelayMs(99), 30_000);
  assert.equal(CHAOS_SORT_MAX_RECOGNITION_ATTEMPTS, 3);
});

test("provider 429 responses distinguish quota exhaustion from temporary rate limiting", () => {
  const quota = providerFailureDetails({ error: { type: "insufficient_quota", code: "insufficient_quota" } });
  const rate = providerFailureDetails({ error: { type: "invalid_request_error", code: "rate_limit_exceeded" } });
  assert.equal(classifyProviderFailure(429, quota), "quota_exhausted");
  assert.equal(classifyProviderFailure(429, rate), "rate_limited");
  assert.equal(classifyProviderFailure(503, providerFailureDetails({ error: { type: "server_error" } })), "temporarily_unavailable");
});
