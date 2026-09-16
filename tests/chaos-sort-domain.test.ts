import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildChaosSortPlan,
  buildDefaultChaosSortRules,
  classifyChaosSortRecognition,
  createChaosSortBatchCode,
  summarizeChaosSortBatch,
  canCloseChaosSortBatch,
  createChaosSortSession,
  getChaosSortBatchProgress,
  normalizeChaosSortTargetSize,
  type ChaosSortBatch,
  type ChaosSortItem,
} from "../src/lib/chaos-sort/domain.ts";
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

test("chaos sort commit creates its batch parent before physical positions", () => {
  const migration = readFileSync("supabase/migrations/202609070002_fix_chaos_sort_commit_order.sql", "utf8");
  const parentInsert = migration.indexOf("insert into public.chaos_sort_batches");
  const positionInsert = migration.indexOf("insert into public.chaos_sort_inventory_positions");
  assert.ok(parentInsert >= 0);
  assert.ok(positionInsert > parentInsert);
});

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

test("chaos sort sessions keep intake provenance and normalize the batch target", () => {
  const session = createChaosSortSession({
    sequence: 184,
    source: " Collection Purchase ",
    reference: "PO-184",
    game: "mixed",
    defaultCondition: "NM",
    targetBatchSize: 101.9,
    now: "2026-09-07T12:00:00.000Z",
  });

  assert.equal(session.sessionCode, "CS-SESSION-000184");
  assert.equal(session.source, "Collection Purchase");
  assert.equal(session.reference, "PO-184");
  assert.equal(session.targetBatchSize, 101);
  assert.equal(session.status, "active");
  assert.equal(normalizeChaosSortTargetSize(1), 20);
  assert.equal(normalizeChaosSortTargetSize(900), 500);
});

test("chaos sort progress treats target as guidance instead of a hard limit", () => {
  assert.deepEqual(getChaosSortBatchProgress(0, 100), {
    count: 0,
    target: 100,
    ratio: 0,
    state: "empty",
    label: "0 / ~100 cards",
  });
  assert.equal(getChaosSortBatchProgress(100, 100).state, "target_reached");
  assert.equal(getChaosSortBatchProgress(108, 100).state, "over_target");
  assert.equal(getChaosSortBatchProgress(108, 100).ratio, 1);
});

test("chaos sort cannot close while an item remains unresolved", () => {
  const pending = item({ humanState: "pending" });
  const confirmed = item({ humanState: "confirmed" });
  const removed = item({ humanState: "removed" });
  assert.equal(canCloseChaosSortBatch([pending]), false);
  assert.equal(canCloseChaosSortBatch([confirmed, removed]), true);
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
