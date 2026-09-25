// Original Phase 1H reproduction, now asserts the Phase 1I repaired queue behavior.
// Run: node --experimental-strip-types tests/phase1h-offline-evidence.mjs
import assert from 'node:assert/strict';
import { replayQueuedScannerAddsWithDependencies } from '../mobile/services/scanner-replay.ts';
import { createOfflineQueue, createQueueLock } from '../mobile/services/storage/offline-core.ts';
import { SCANNER_COLLECTION_QUEUE_TYPE } from '../mobile/services/scanner-foundation.ts';

const confirmation = {
  userId: 'synthetic-owner', candidate: {
    id: 'synthetic-printing', name: 'Fixture card', setCode: 'tst', collectorNumber: '1',
    setName: 'Test', finishes: ['normal'], language: 'en', confidence: .9,
    recognitionMode: 'manual_search',
  }, quantity: 1, condition: 'near_mint', finish: 'normal', language: 'en',
  storageLocationId: null, tradeStatus: 'not_for_trade', addToWishlist: false,
};
const first = {
  id: 'scan-operation-a', userId: confirmation.userId, type: SCANNER_COLLECTION_QUEUE_TYPE,
  createdAt: '2026-09-24T00:00:00Z', status: 'pending',
  payload: { confirmation, inventoryItemId: 'stock-a', idempotencyKey: 'operation-a' },
};
const late = { ...first, id: 'scan-operation-b', payload: { confirmation, inventoryItemId: 'stock-b', idempotencyKey: 'operation-b' } };
let persisted = JSON.stringify([first]); let sequence = 0;
const coordinator = createOfflineQueue({ storage: { getItem: async () => persisted, setItem: async (_key, value) => { persisted = value; } }, lock: createQueueLock(), runtimeId: 'integration', newId: () => 'claim-' + (++sequence) });
let inserted = 0;
const result = await replayQueuedScannerAddsWithDependencies({
  userId: confirmation.userId, membershipTier: 'collector', trigger: 'network_reconnect',
}, {
  getQueue: coordinator.list,
  processOperation: coordinator.process,
  getAuthenticatedUserId: async () => confirmation.userId,
  loadCurrentTotalQuantity: async () => 0,
  inventoryItemExists: async () => false,
  validatePrintingIdentity: async (value) => value,
  insertInventoryItem: async () => {
    inserted += 1;
    // Another scan is durably enqueued while operation A awaits its server reply.
    await coordinator.enqueue(late.type, late.payload, { userId: late.userId, operationId: late.id });
    assert.equal((await coordinator.list()).some((operation) => operation.id === late.id), true);
  },
  runTradeStatus: async () => {}, runWishlist: async () => {},
});
assert.equal(inserted, 1);
assert.equal(result.succeeded, 1);
assert.deepEqual((await coordinator.list()).map((operation) => operation.id), [late.id]);
console.log('RACE_FIXED: scanner replay commits A and preserves newly queued operation B.');
console.log('Synthetic dependency harness only; no network, database or device storage accessed.');
