import test from "node:test";
import assert from "node:assert/strict";

import {
  buildChaosSortPlan,
  buildDefaultChaosSortRules,
  classifyChaosSortRecognition,
  createChaosSortBatchCode,
  resolveChaosSortRecognition,
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
import { chaosSortRecognitionMessage, CHAOS_SORT_RECOGNITION_REASONS } from "../src/lib/chaos-sort/recognition-messages.ts";
import { TcgTrackingClient } from "../src/lib/providers/tcgtracking/client.ts";
import { runTcgTrackingScanHealthCheck, validateTcgTrackingScanImage } from "../src/lib/providers/tcgtracking/scanner.ts";

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

test("TCGTracking uses the documented public scan endpoint and caches product metadata", async () => {
  const requests: string[] = [];
  const client = new TcgTrackingClient({
    fetch: async (input) => {
      const url = String(input);
      requests.push(url);
      if (url.endsWith("/scan")) return new Response(JSON.stringify({ results: [{ product_id: 557921, score: 91 }] }), { status: 200, headers: { "content-type": "application/json" } });
      return new Response(JSON.stringify({ id: 557921, name: "Llanowar Elves", clean_name: "Llanowar Elves", set_abbr: "FDN", number: "227", scryfall_id: "6a0b230b-0000-0000-0000-000000000000" }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  const scan = await client.scanCardImage({ image: new Uint8Array([1, 2, 3]), gameId: 1, limit: 10 });
  assert.equal(scan.candidates[0]?.providerProductId, "557921");
  assert.match(requests[0] ?? "", /https:\/\/tcgtracking\.com\/tcgapi\/v1\/scan$/);
  await client.product("557921");
  await client.product("557921");
  assert.equal(requests.filter((url) => url.endsWith("/products/557921")).length, 1);
});

test("TCGTracking direct diagnostic preserves documented response evidence", async () => {
  const client = new TcgTrackingClient({
    retries: 0,
    fetch: async () => new Response(JSON.stringify({ success: true, game_id: 1, candidates_scanned: 17, results: [{ product_id: 123, score: 44 }] }), { status: 200, headers: { "content-type": "application/json" } }),
  });
  const result = await client.scanCardImage({ image: new Uint8Array([1, 2, 3]), gameId: 1, limit: 5, captureResponseBody: true });
  assert.equal(result.httpStatus, undefined);
  assert.equal(result.candidatesScanned, 17);
  assert.equal(result.candidates[0]?.providerProductId, "123");
  assert.equal(result.candidates[0]?.confidence, 0.44);
  assert.match(result.rawResponseBody ?? "", /candidates_scanned/);
  assert.equal(result.responseContentType, "application/json");
});

test("TCGTracking direct diagnostic preserves non-2xx provider bodies", async () => {
  const client = new TcgTrackingClient({
    retries: 0,
    fetch: async () => new Response(JSON.stringify({ error: "image too large", code: "IMAGE_LIMIT" }), { status: 413, headers: { "content-type": "application/json" } }),
  });
  const result = await client.scanCardImage({ image: new Uint8Array([1, 2, 3]), gameId: 1, limit: 5, captureResponseBody: true });
  assert.equal(result.status, "provider_failed");
  assert.equal(result.httpStatus, 413);
  assert.equal(result.rawResponseBody, '{"error":"image too large","code":"IMAGE_LIMIT"}');
});

test("TCGTracking multipart scan uses the documented fields and image contract", async () => {
  let captured: FormData | null = null;
  let capturedHeaders: Headers | undefined;
  const client = new TcgTrackingClient({
    retries: 0,
    fetch: async (_input, init) => {
      captured = init?.body instanceof FormData ? init.body : null;
      capturedHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify({ results: [] }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  await client.scanCardImage({ image: new Uint8Array([1, 2, 3]), gameId: 1, setIds: [2708, 2710], limit: 10 });
  assert.ok(captured);
  assert.equal(captured.get("game_id"), "1");
  assert.equal(captured.get("limit"), "10");
  assert.deepEqual(captured.getAll("set_ids[]"), ["2708", "2710"]);
  const image = captured.get("image");
  assert.ok(image instanceof File || image instanceof Blob);
  assert.equal((image as Blob).type, "image/jpeg");
  assert.equal(capturedHeaders?.has("content-type"), false);
  assert.equal(captured.has("hashes"), false);
});

test("Chaos Sort maps verified, ambiguous, unknown, and technical outcomes distinctly", () => {
  assert.equal(resolveChaosSortRecognition({ confidence: 0.95, cardName: "Goblin Matron", canonicalPrintingResolved: true }), "high_confidence");
  assert.equal(resolveChaosSortRecognition({ confidence: 0.95, cardName: "Goblin Matron", canonicalPrintingResolved: false }), "review");
  assert.equal(resolveChaosSortRecognition({ confidence: 0, cardName: "", canonicalPrintingResolved: false }), "unknown");
  assert.equal(classifyChaosSortRecognition({ processingState: "failed", confidence: 0, cardName: "Goblin Matron", setCode: null, collectorNumber: null }), "unknown");
});

test("HTTP 200 scanner outcomes stay semantic instead of becoming FAILED", () => {
  assert.equal(resolveChaosSortRecognition({ confidence: 0.44, cardName: "", canonicalPrintingResolved: false }), "unknown");
  assert.equal(resolveChaosSortRecognition({ confidence: 0.44, cardName: "Goblin Matron", canonicalPrintingResolved: false }), "review");
  assert.equal(resolveChaosSortRecognition({ confidence: 0.72, cardName: "Goblin Matron", canonicalPrintingResolved: false }), "review");
  assert.equal(resolveChaosSortRecognition({ confidence: 0.95, cardName: "Goblin Matron", canonicalPrintingResolved: true }), "high_confidence");
});

test("every technical recognition reason has an explicit non-generic UI message", () => {
  for (const reason of CHAOS_SORT_RECOGNITION_REASONS) {
    const mapped = chaosSortRecognitionMessage(reason);
    assert.notEqual(mapped.message, "Recognition could not be completed.");
    assert.ok(mapped.stage);
  }
  assert.notEqual(chaosSortRecognitionMessage("unexpected_reason").message, "Recognition could not be completed.");
});

test("TCGTracking health check classifies documented response, no match, HTTP, malformed, and image errors", async () => {
  const image = new Uint8Array([1, 2, 3]);
  const client = (response: unknown) => ({
    scanCardImage: async () => response,
    product: async () => null,
  }) as never;
  assert.equal(await runTcgTrackingScanHealthCheck({ client: client({ provider: "tcgtracking", status: "matched", candidates: [{ providerProductId: "1", confidence: 0.91 }] }), image }), "SUCCESS_MATCH");
  assert.equal(await runTcgTrackingScanHealthCheck({ client: client({ provider: "tcgtracking", status: "unresolved", candidates: [] }), image }), "SUCCESS_NO_MATCH");
  assert.equal(await runTcgTrackingScanHealthCheck({ client: client({ provider: "tcgtracking", status: "provider_failed", candidates: [], error: "HTTP 503" }), image }), "HTTP_ERROR");
  assert.equal(await runTcgTrackingScanHealthCheck({ client: client({ provider: "tcgtracking", status: "provider_failed", candidates: [], error: "malformed scan response" }), image }), "INVALID_RESPONSE");
  assert.equal(await runTcgTrackingScanHealthCheck({ client: client({ provider: "tcgtracking", status: "matched", candidates: [] }), image: new Uint8Array() }), "IMAGE_ERROR");
  assert.equal(validateTcgTrackingScanImage(image).valid, true);
  assert.equal(validateTcgTrackingScanImage(new Uint8Array(100_001)).valid, false);
});
