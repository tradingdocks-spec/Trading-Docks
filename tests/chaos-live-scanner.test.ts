import test from "node:test";
import assert from "node:assert/strict";
import { EmulatorScannerProvider } from "../src/lib/chaos-sort/scanner-provider.ts";
import { RecognitionPool, assertIntakeRoom, physicalCardCount, liveScanStatus, unresolvedLiveItems, validateLiveCommit } from "../src/lib/chaos-sort/live-intake.ts";
import type { ChaosSortItem } from "../src/lib/chaos-sort/domain.ts";

const fixture = new File(["deterministic image fixture"], "card.png", { type: "image/png" });
const item = (patch: Partial<ChaosSortItem> = {}) => ({ id: "card", quantity: 1, humanState: "confirmed", processingState: "ready", recognitionState: "high_confidence", cardName: "Sol Ring", setCode: "CMM", collectorNumber: "396", ...patch } as ChaosSortItem);

test("scanner detects, connects, captures duplicate physical copies with distinct capture IDs, disconnects", async () => {
  const provider = new EmulatorScannerProvider();
  assert.equal((await provider.detect())[0].simulated, true);
  await assert.rejects(provider.capture(), /disconnected/);
  await provider.connect(); provider.configure({ fixtures: [fixture], delayMs: 0, scenario: "duplicate" });
  const first = await provider.capture(), second = await provider.capture();
  assert.notEqual(first.captureId, second.captureId); assert.equal(first.file, second.file);
  await provider.disconnect(); assert.equal(provider.getStatus(), "disconnected");
});
test("capture failure, jam, disconnect and cancellation preserve recoverable provider states", async () => {
  const provider = new EmulatorScannerProvider(); await provider.connect(); provider.configure({ fixtures: [fixture], delayMs: 0 });
  for (const scenario of ["failure", "jam", "disconnect"] as const) {
    await provider.connect(); provider.configure({ scenario }); await assert.rejects(provider.capture());
    assert.equal(provider.getStatus(), scenario === "jam" ? "jammed" : scenario === "disconnect" ? "disconnected" : "ready");
  }
  await provider.connect(); provider.configure({ scenario: "slow" });
  const capture = provider.capture(); provider.cancelCapture(); await assert.rejects(capture, /cancelled/);
  assert.equal(provider.getStatus(), "ready");
  provider.configure({ scenario: "success", delayMs: 0 }); assert.ok(await provider.capture());
});
for (const count of [1, 25, 50, 100]) test(`${count} physical copies fit; reservations cannot admit card 101`, async () => {
  const provider = new EmulatorScannerProvider(); await provider.connect(); provider.configure({ fixtures: [fixture], delayMs: 0 });
  const cards: ChaosSortItem[] = [];
  for (let n = 0; n < count; n++) { assertIntakeRoom(physicalCardCount(cards), 1); const capture = await provider.capture(); cards.push(item({ id: capture.captureId })); }
  assert.equal(physicalCardCount(cards), count);
  assert.equal(new Set(cards.map(card => card.id)).size, count);
  assert.throws(() => assertIntakeRoom(count, 101 - count), /100 physical/);
});
test("physical quantity counts do not collapse repeated printings; removing one frees one slot", () => {
  const cards = [item({ quantity: 5 }), item({ quantity: 95 }), item({ quantity: 10, humanState: "removed" })];
  assert.equal(physicalCardCount(cards), 100); assert.throws(() => assertIntakeRoom(100, 1));
  assertIntakeRoom(99, 1);
  for (const invalid of [0, -1, NaN, 0.5]) assert.throws(() => assertIntakeRoom(0, invalid));
});
test("commit blocks processing, failures, unknown and unconfirmed printing even at high confidence", () => {
  for (const card of [item({ processingState: "processing" }), item({ processingState: "failed" }), item({ humanState: "pending" }), item({ collectorNumber: null })]) {
    assert.equal(unresolvedLiveItems([card]).length, 1); assert.ok(validateLiveCommit([card]));
  }
  assert.equal(liveScanStatus(item()), "CONFIRMED"); assert.equal(validateLiveCommit([item()]), null);
  assert.ok(validateLiveCommit([item({ quantity: 101 })]));
  assert.equal(unresolvedLiveItems([item({ humanState: "removed" })]).length, 0);
});
test("100 rapidly queued recognition tasks share four workers and survive isolated failures", async () => {
  const pool = new RecognitionPool(); let active = 0, peak = 0, completed = 0;
  const results = await Promise.allSettled(Array.from({ length: 100 }, (_, n) => pool.run(async () => {
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 1)); active--; completed++;
    if (n === 12) throw new Error("isolated recognition failure");
  })));
  assert.equal(peak, 4); assert.equal(completed, 100); assert.equal(results.filter(result => result.status === "rejected").length, 1);
});
