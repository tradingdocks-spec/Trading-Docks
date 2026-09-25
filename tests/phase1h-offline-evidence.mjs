// Diagnostic reproduction, NOT a passing retry-safety acceptance test.
// Run: node --experimental-strip-types tests/phase1h-offline-evidence.mjs
import assert from 'node:assert/strict';
import { replayQueuedScannerAddsWithDependencies } from '../mobile/services/scanner-replay.ts';
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
  createdAt: '2026-09-24T00:00:00Z',
  payload: { confirmation, inventoryItemId: 'stock-a', idempotencyKey: 'operation-a' },
};
const late = { ...first, id: 'scan-operation-b', payload: { confirmation, inventoryItemId: 'stock-b', idempotencyKey: 'operation-b' } };
let queue = [first];
let inserted = 0;
const result = await replayQueuedScannerAddsWithDependencies({
  userId: confirmation.userId, membershipTier: 'collector', trigger: 'network_reconnect',
}, {
  getQueue: async () => structuredClone(queue),
  replaceQueue: async (next) => { queue = structuredClone(next); },
  getAuthenticatedUserId: async () => confirmation.userId,
  loadCurrentTotalQuantity: async () => 0,
  inventoryItemExists: async () => false,
  validatePrintingIdentity: async (value) => value,
  insertInventoryItem: async () => {
    inserted += 1;
    // Another scan is durably enqueued while operation A awaits its server reply.
    queue = [...queue, late];
    assert.equal(queue.some((operation) => operation.id === late.id), true);
  },
  runTradeStatus: async () => {}, runWishlist: async () => {},
});
assert.equal(inserted, 1);
assert.equal(result.succeeded, 1);
assert.equal(queue.some((operation) => operation.id === late.id), false);
console.log('DEFECT_REPRODUCED: scanner replay reports success but erases newly queued operation B.');
console.log('Synthetic dependency harness only; no network, database or device storage accessed.');
