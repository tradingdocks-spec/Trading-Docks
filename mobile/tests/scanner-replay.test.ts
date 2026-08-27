import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SCANNER_COLLECTION_QUEUE_TYPE,
  normalizeScannerCandidate,
  scannerIdempotencyKey,
  type ScannerConfirmation,
} from '../services/scanner-foundation.ts';
import {
  classifyScannerReplayError,
  discardQueuedScannerAddFromQueue,
  replayQueuedScannerAddsWithDependencies,
  scannerQueuedAddFromOperation,
  type ScannerReplayDependencies,
  type ScannerReplayTrigger,
} from '../services/scanner-replay.ts';
import { addOfflineOperation, type OfflineOperation } from '../services/storage/offline-core.ts';

const candidate = normalizeScannerCandidate({
  id: 'sf-rhystic',
  name: 'Rhystic Study',
  setCode: 'wot',
  setName: 'Wilds of Eldraine',
  collectorNumber: '25',
  finishes: ['foil', 'nonfoil'],
  language: 'en',
  imageUrl: 'https://cards.example/rhystic.jpg',
  providerSource: 'scryfall',
  providerSources: ['scryfall'],
  providerIds: { scryfall: 'sf-rhystic' },
  confidence: 0.94,
})!;

const confirmation: ScannerConfirmation = {
  userId: 'user-1',
  candidate,
  quantity: 1,
  condition: 'near_mint',
  finish: 'foil',
  language: 'en',
  storageLocationId: 'binder-1',
  tradeStatus: 'available',
  addToWishlist: true,
};

test('offline scanner adds are queued with user-scoped idempotency data', () => {
  const operation = operationFor(confirmation, 'scan-1');
  const entry = scannerQueuedAddFromOperation(operation, 'user-1');

  assert.equal(entry?.userId, 'user-1');
  assert.equal(entry?.inventoryItemId, 'scan-1');
  assert.equal(entry?.idempotencyKey, scannerIdempotencyKey(confirmation, 'scan-1'));
  assert.equal(scannerQueuedAddFromOperation(operation, 'user-2'), null);
});

test('network reconnect, app resume, and session restore triggers replay scanner adds', async () => {
  for (const trigger of ['network_reconnect', 'app_resume', 'session_restore'] as ScannerReplayTrigger[]) {
    const harness = replayHarness([operationFor(confirmation, `scan-${trigger}`)]);
    const result = await replayQueuedScannerAddsWithDependencies({ userId: 'user-1', membershipTier: 'collector', trigger }, harness.deps);

    assert.equal(result.trigger, trigger);
    assert.equal(result.succeeded, 1);
    assert.equal(harness.inserted.length, 1);
    assert.equal(harness.queue.length, 0);
  }
});

test('queued scanner replay is isolated by authenticated user and never crosses accounts', async () => {
  const otherConfirmation = { ...confirmation, userId: 'user-2' };
  const harness = replayHarness([operationFor(confirmation, 'scan-1'), operationFor(otherConfirmation, 'scan-2')]);

  const result = await replayQueuedScannerAddsWithDependencies({ userId: 'user-1', membershipTier: 'collector', trigger: 'manual_retry' }, harness.deps);

  assert.equal(result.succeeded, 1);
  assert.equal(harness.inserted[0].user_id, 'user-1');
  assert.equal(harness.queue.length, 1);
  assert.equal(harness.queue[0].userId, 'user-2');
});

test('auth user mismatch stops replay without exposing another user queue', async () => {
  const harness = replayHarness([operationFor(confirmation, 'scan-1')], { authUserId: 'user-2' });
  const result = await replayQueuedScannerAddsWithDependencies({ userId: 'user-1', membershipTier: 'collector', trigger: 'manual_retry' }, harness.deps);

  assert.equal(result.attempted, 0);
  assert.equal(result.remaining, 1);
  assert.equal(harness.inserted.length, 0);
});

test('duplicate replay prevention treats an existing inventory item as success', async () => {
  const harness = replayHarness([operationFor(confirmation, 'scan-1')], { existingIds: new Set(['scan-1']) });
  const result = await replayQueuedScannerAddsWithDependencies({ userId: 'user-1', membershipTier: 'collector', trigger: 'manual_retry' }, harness.deps);

  assert.equal(result.succeeded, 1);
  assert.equal(harness.inserted.length, 0);
  assert.equal(harness.tradeStatuses.length, 1);
  assert.equal(harness.queue.length, 0);
});

test('successful replay removes queue entry and preserves exact printing fields', async () => {
  const harness = replayHarness([operationFor(confirmation, 'scan-1')]);
  const result = await replayQueuedScannerAddsWithDependencies({ userId: 'user-1', membershipTier: 'collector', trigger: 'manual_retry' }, harness.deps);

  assert.equal(result.succeeded, 1);
  assert.equal(harness.queue.length, 0);
  assert.equal(harness.inserted[0].scryfall_id, 'sf-rhystic');
  assert.equal(harness.inserted[0].collector_number, '25');
  assert.equal(harness.inserted[0].quantity, 1);
  assert.equal(harness.inserted[0].location_id, 'binder-1');
  assert.equal(harness.inserted[0].data.finish, 'foil');
  assert.equal(harness.inserted[0].data.condition, 'near_mint');
  assert.equal(harness.inserted[0].data.language, 'en');
  assert.equal(harness.wishlistAdds.length, 1);
});

test('failed replay remains visible with retryable failed state', async () => {
  const harness = replayHarness([operationFor(confirmation, 'scan-1')], { insertError: new Error('network unavailable') });
  const result = await replayQueuedScannerAddsWithDependencies({ userId: 'user-1', membershipTier: 'collector', trigger: 'manual_retry' }, harness.deps);
  const entry = scannerQueuedAddFromOperation(harness.queue[0], 'user-1');

  assert.equal(result.failed, 1);
  assert.equal(entry?.syncState, 'failed');
  assert.equal(entry?.lastError, 'network unavailable');
});

test('queued replay validates before insert and preserves existing quantity behavior', async () => {
  const harness = replayHarness([operationFor({ ...confirmation, quantity: 3 }, 'scan-1')]);
  await replayQueuedScannerAddsWithDependencies({ userId: 'user-1', membershipTier: 'collector', trigger: 'manual_retry' }, harness.deps);

  assert.deepEqual(harness.events, ['validate', 'insert']);
  assert.equal(harness.inserted[0].quantity, 3);
});

test('failed replay validation moves the intact scan to action-required review without insert', async () => {
  const authorityError = Object.assign(new Error('Provider ID mismatch. Review this exact printing.'), { scannerCode: 'invalid_printing' });
  const harness = replayHarness([operationFor(confirmation, 'scan-1')], { validationError: authorityError });
  const result = await replayQueuedScannerAddsWithDependencies({ userId: 'user-1', membershipTier: 'collector', trigger: 'network_reconnect' }, harness.deps);
  const entry = scannerQueuedAddFromOperation(harness.queue[0], 'user-1');

  assert.equal(result.actionRequired, 1);
  assert.equal(harness.inserted.length, 0);
  assert.equal(entry?.syncState, 'action_required');
  assert.equal(entry?.confirmation.candidate.id, confirmation.candidate.id);
});

test('Free-limit replay error becomes action required', async () => {
  const harness = replayHarness([operationFor({ ...confirmation, quantity: 2 }, 'scan-1')], { currentTotalQuantity: 499 });
  const result = await replayQueuedScannerAddsWithDependencies({ userId: 'user-1', membershipTier: 'free', trigger: 'manual_retry' }, harness.deps);
  const entry = scannerQueuedAddFromOperation(harness.queue[0], 'user-1');

  assert.equal(result.actionRequired, 1);
  assert.equal(entry?.syncState, 'action_required');
  assert.equal(entry?.errorCode, 'free_limit');
});

test('retry one only replays the requested queued scan', async () => {
  const first = operationFor(confirmation, 'scan-1');
  const second = operationFor({ ...confirmation, storageLocationId: 'binder-2' }, 'scan-2');
  const harness = replayHarness([first, second]);

  const result = await replayQueuedScannerAddsWithDependencies({ userId: 'user-1', membershipTier: 'collector', trigger: 'manual_retry', operationId: first.id }, harness.deps);

  assert.equal(result.succeeded, 1);
  assert.equal(harness.inserted[0].id, 'scan-1');
  assert.equal(harness.queue.length, 1);
  assert.equal(harness.queue[0].id, second.id);
});

test('retry all handles duplicate queued writes through dedupe keys', () => {
  const first = operationFor(confirmation, 'scan-1');
  const duplicate = operationFor(confirmation, 'scan-1');
  const queue = addOfflineOperation(addOfflineOperation([], first), duplicate);

  assert.equal(queue.length, 1);
  assert.equal((queue[0].payload as { inventoryItemId: string }).inventoryItemId, 'scan-1');
});

test('discard requires confirmation and removes only that user scanner entry', () => {
  const first = operationFor(confirmation, 'scan-1');
  const other = operationFor({ ...confirmation, userId: 'user-2' }, 'scan-2');
  let result = discardQueuedScannerAddFromQueue([first, other], first.id, 'user-1', false);

  assert.equal(result.discarded, false);
  assert.equal(result.queue.length, 2);

  result = discardQueuedScannerAddFromQueue([first, other], first.id, 'user-1', true);
  assert.equal(result.discarded, true);
  assert.deepEqual(result.queue.map((operation) => operation.userId), ['user-2']);
});

test('authoritative scanner replay errors are classified for UI recovery', () => {
  assert.deepEqual(classifyScannerReplayError(new Error('TD_COLLECTOR_FREE_LIMIT_EXCEEDED')).code, 'free_limit');
  assert.deepEqual(classifyScannerReplayError(new Error('TD_COLLECTOR_UNAUTHORIZED')).code, 'unauthorized');
  assert.deepEqual(classifyScannerReplayError(new Error('Quantity must be positive')).code, 'invalid_quantity');
  assert.deepEqual(classifyScannerReplayError(new Error('Missing membership/profile')).code, 'missing_membership');
});

function operationFor(input: ScannerConfirmation, inventoryItemId: string): OfflineOperation {
  const idempotencyKey = scannerIdempotencyKey(input, inventoryItemId);
  return {
    id: `${input.userId}-${inventoryItemId}`,
    type: SCANNER_COLLECTION_QUEUE_TYPE,
    createdAt: '2026-08-05T00:00:00.000Z',
    payload: { confirmation: input, inventoryItemId, idempotencyKey } as unknown as Record<string, unknown>,
    userId: input.userId,
    dedupeKey: idempotencyKey,
  };
}

function replayHarness(
  initialQueue: OfflineOperation[],
  options: {
    authUserId?: string;
    currentTotalQuantity?: number;
    existingIds?: Set<string>;
    insertError?: Error;
    validationError?: Error;
    authoritativeConfirmation?: ScannerConfirmation;
  } = {},
) {
  const harness = {
    queue: [...initialQueue],
    inserted: [] as Parameters<ScannerReplayDependencies['insertInventoryItem']>[0][],
    tradeStatuses: [] as string[],
    wishlistAdds: [] as string[],
    events: [] as string[],
  };
  const existingIds = options.existingIds ?? new Set<string>();
  const deps: ScannerReplayDependencies = {
    async getQueue() {
      return harness.queue;
    },
    async replaceQueue(next) {
      harness.queue = next;
    },
    async getAuthenticatedUserId() {
      return options.authUserId ?? 'user-1';
    },
    async loadCurrentTotalQuantity() {
      return options.currentTotalQuantity ?? 0;
    },
    async inventoryItemExists(_userId, inventoryItemId) {
      return existingIds.has(inventoryItemId);
    },
    async validatePrintingIdentity(input) {
      harness.events.push('validate');
      if (options.validationError) throw options.validationError;
      return options.authoritativeConfirmation ?? input;
    },
    async insertInventoryItem(payload) {
      harness.events.push('insert');
      if (options.insertError) throw options.insertError;
      harness.inserted.push(payload);
      existingIds.add(payload.id);
    },
    async runTradeStatus(_confirmation, inventoryItemId) {
      harness.tradeStatuses.push(inventoryItemId);
    },
    async runWishlist(input) {
      harness.wishlistAdds.push(input.candidate.id);
    },
  };
  return Object.assign(harness, { deps });
}
