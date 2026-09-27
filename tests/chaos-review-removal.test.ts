import test from "node:test";
import assert from "node:assert/strict";
import { saveScanReview, recoveredScanItem, rememberScanRevisions, storeScan } from "../src/lib/chaos-sort/scan-album-client.ts";
import { physicalCardCount, unresolvedLiveItems } from "../src/lib/chaos-sort/live-intake.ts";

test("persisted removal is idempotent and queued stale recognition cannot resurrect it", async () => {
  const originalFetch = globalThis.fetch;
  const item = recoveredScanItem("batch", crypto.randomUUID());
  const removed = { ...item, humanState: "removed" as const, processingState: "ready" as const };
  let stored = item; let revision = 0; let writes = 0;
  globalThis.fetch = async (_url, init) => {
    const { action, payload } = JSON.parse(String(init?.body));
    assert.equal(action, "review"); assert.equal(payload.revision, revision);
    stored = payload.item; writes++; return Response.json({ revision: ++revision });
  };
  try {
    await Promise.all([saveScanReview("batch", [removed]), saveScanReview("batch", [{ ...item, cardName: "Late result" }]), saveScanReview("batch", [removed])]);
    assert.equal(writes, 1);
    assert.equal(stored.humanState, "removed");
    assert.equal(physicalCardCount([stored]), 0);
    assert.deepEqual(unresolvedLiveItems([stored]), []);
    rememberScanRevisions([{ capture_id: item.captureId!, revision }]);
    await saveScanReview("batch", [item]);
    assert.equal(writes, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test("duplex upload requires compatible cloud storage and explicit acknowledgement of both sides", async () => {
  const originalFetch = globalThis.fetch;
  const front = new File(["front"], "front.jpg", { type: "image/jpeg" });
  const back = new File(["back"], "back.jpg", { type: "image/jpeg" });
  let pairedImages = false, sides = 1, uploads = 0;
  globalThis.fetch = async (_url, init) => {
    if (!(init?.body instanceof FormData)) return Response.json({ pairedImages });
    uploads++; assert.equal(await (init.body.get("image") as File).text(), "front");
    assert.equal(await (init.body.get("backImage") as File).text(), "back");
    return Response.json({ sides, sourceImageUrl: "/fixture" });
  };
  try {
    await assert.rejects(storeScan("batch", "capture", front, back), /update required/);
    assert.equal(uploads, 0);
    pairedImages = true;
    await assert.rejects(storeScan("batch", "capture", front, back), /did not confirm both sides/);
    sides = 2; assert.equal(await storeScan("batch", "capture", front, back), "/fixture");
  } finally { globalThis.fetch = originalFetch; }
});

test("failed removal can be retried without poisoning the review queue", async () => {
  const originalFetch = globalThis.fetch;
  const item = { ...recoveredScanItem("batch", crypto.randomUUID()), humanState: "removed" as const };
  let attempts = 0;
  globalThis.fetch = async () => ++attempts === 1 ? Response.json({ error: "Cloud unavailable" }, { status: 503 }) : Response.json({ revision: 1 });
  try {
    await assert.rejects(saveScanReview("batch", [item]), /Cloud unavailable/);
    await saveScanReview("batch", [item]);
    assert.equal(attempts, 2);
  } finally { globalThis.fetch = originalFetch; }
});
