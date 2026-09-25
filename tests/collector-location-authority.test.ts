import assert from 'node:assert/strict';
import test from 'node:test';

import {
  validateCollectorMutation,
  type CollectorMutation,
} from '../mobile/services/collector-mutations.ts';
import {
  reviewCollectionLocationImportRow,
} from '../src/lib/collection-location-import.ts';

const context = {
  membershipTier: 'collector',
  currentTotalQuantity: 20,
  currentCardQuantity: 4,
  requestedUserId: 'user-1',
  authenticatedUserId: 'user-1',
};

test('partial location move validates quantity against the selected lot', () => {
  const mutation: CollectorMutation = {
    type: 'move_quantity',
    userId: 'user-1',
    inventoryItemId: 'lot-1',
    quantity: 2,
    storageLocationId: 'binder-1',
  };

  assert.deepEqual(validateCollectorMutation(mutation, context), { ok: true });
  assert.equal(validateCollectorMutation({ ...mutation, quantity: 0 }, context).ok, false);
  assert.equal(validateCollectorMutation({ ...mutation, quantity: 5 }, context).ok, false);
});

test('remove-from-collection validates quantity without deleting account data client-side', () => {
  const mutation: CollectorMutation = {
    type: 'remove_quantity',
    userId: 'user-1',
    inventoryItemId: 'lot-1',
    quantity: 4,
    reason: 'Sold at show',
  };

  assert.deepEqual(validateCollectorMutation(mutation, context), { ok: true });
  assert.equal(validateCollectorMutation({ ...mutation, userId: 'user-2' }, context).ok, false);
});

test('collection CSV review normalizes condition, finish, quantity, storage path, and TCGplayer ids', () => {
  const row = reviewCollectionLocationImportRow({
    name: 'Unblinking Observer',
    language: 'en',
    set: 'MID',
    collectorNumber: '82',
    condition: 'NearMint',
    finish: 'Nonfoil',
    quantity: '3',
    storageLocation: 'Binder 1 > Page 2 > Slot B3',
    tcgplayerId: '123456',
    tcgplayerSkuId: '654321',
  });

  assert.equal(row.ok, true);
  assert.equal(row.condition, 'near_mint');
  assert.equal(row.finish, 'normal');
  assert.equal(row.quantity, 3);
  assert.equal(row.storagePath, 'Binder 1 / Page 2 / Slot B3');
  assert.equal(row.tcgplayerId, 123456);
  assert.equal(row.tcgplayerSkuId, 654321);
});

test('collection CSV review marks unknown physical fields for review instead of guessing', () => {
  const row = reviewCollectionLocationImportRow({
    name: 'Mystery Card',
    condition: 'Packed Fresh',
    finish: '',
    quantity: '1',
  });

  assert.equal(row.ok, false);
  assert.deepEqual(row.issues.sort(), ['unknown_condition', 'unknown_finish', 'unknown_language', 'unresolved_printing']);
});
