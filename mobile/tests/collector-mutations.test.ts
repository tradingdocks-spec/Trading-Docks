import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyCollectorMutationOptimistically,
  classifyCollectorAuthoritativeError,
  collectionQuantityLimitDecision,
  isTradeBinderVisibleInTradeFilters,
  mutationQueueKey,
  rollbackCollectorMutation,
  validateCollectorMutation,
  type CollectorMutation,
} from '../services/collector-mutations.ts';
import { COLLECTION_MUTATION_QUEUE_TYPE } from '../services/collector-mutations.ts';
import { addOfflineOperation, type OfflineOperation } from '../services/storage/offline-core.ts';
import type { CollectionCard } from '../services/collector-workspace.ts';

const baseCard: CollectionCard = {
  id: 'card-1',
  cardName: 'Sol Ring',
  game: 'Magic: The Gathering',
  gameId: 'magic',
  gameLabel: 'Magic: The Gathering',
  productType: 'card',
  printing: {
    scryfallId: 'sf-1',
    setCode: 'ltc',
    setName: 'Commander',
    collectorNumber: '101',
    language: 'en',
    finish: 'normal',
    treatment: null,
    imageUrl: null,
  },
  condition: 'near_mint',
  quantityOwned: 2,
  storageLocation: null,
  tradeBinderStatus: 'not_for_trade',
  wishlistStatus: 'not_wishlisted',
  marketPrice: { amount: null, currency: 'USD', source: 'unavailable' },
  costBasisKnown: false,
};

test('collector mutation validation rejects cross-user ownership attempts', () => {
  const mutation: CollectorMutation = { type: 'quantity', userId: 'other-user', inventoryItemId: 'card-1', quantity: 3 };
  const result = validateCollectorMutation(mutation, {
    membershipTier: 'collector',
    currentTotalQuantity: 2,
    currentCardQuantity: 2,
    requestedUserId: 'other-user',
    authenticatedUserId: 'user-1',
  });

  assert.deepEqual(result, {
    ok: false,
    code: 'unauthorized',
    reason: 'You can only update your own collection records.',
  });
});

test('Free plan limit enforcement prevents increasing collection beyond card limit', () => {
  const result = validateCollectorMutation(
    { type: 'quantity', userId: 'user-1', inventoryItemId: 'card-1', quantity: 3 },
    {
      membershipTier: 'free',
      currentTotalQuantity: 500,
      currentCardQuantity: 2,
      requestedUserId: 'user-1',
      authenticatedUserId: 'user-1',
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.ok ? null : result.code, 'free_limit');
});

test('Free plan allows decreases and metadata edits in an already over-limit collection', () => {
  const context = {
    membershipTier: 'free',
    currentTotalQuantity: 1218,
    currentCardQuantity: 2,
    hasFullPlatformAccess: false,
  } as const;

  assert.deepEqual(collectionQuantityLimitDecision(context, 1), { ok: true });
  assert.deepEqual(collectionQuantityLimitDecision({ ...context, currentCardQuantity: 1 }, 0), { ok: true });
  assert.equal(validateCollectorMutation({ type: 'condition', userId: 'user-1', inventoryItemId: 'card-1', condition: 'near_mint' }, {
    ...context,
    requestedUserId: 'user-1',
    authenticatedUserId: 'user-1',
  }).ok, true);
});

test('Trusted platform access bypasses the commercial quantity cap', () => {
  assert.deepEqual(collectionQuantityLimitDecision({
    membershipTier: 'free',
    currentTotalQuantity: 1218,
    currentCardQuantity: 1,
    hasFullPlatformAccess: true,
  }, 2), { ok: true });
});

test('quantity mutation rejects negative or fractional quantities but allows zero as non-destructive zero-owned state', () => {
  for (const quantity of [-1, 1.5]) {
    const result = validateCollectorMutation(
      { type: 'quantity', userId: 'user-1', inventoryItemId: 'card-1', quantity },
      {
        membershipTier: 'collector',
        currentTotalQuantity: 2,
        currentCardQuantity: 2,
        requestedUserId: 'user-1',
        authenticatedUserId: 'user-1',
      },
    );
    assert.equal(result.ok, false);
  }

  assert.equal(validateCollectorMutation(
    { type: 'quantity', userId: 'user-1', inventoryItemId: 'card-1', quantity: 0 },
    {
      membershipTier: 'collector',
      currentTotalQuantity: 2,
      currentCardQuantity: 2,
      requestedUserId: 'user-1',
      authenticatedUserId: 'user-1',
    },
  ).ok, true);
});

test('condition, finish, storage, trade binder, and wishlist mutations update optimistic card state', () => {
  let cards = [baseCard];
  cards = applyCollectorMutationOptimistically(cards, {
    type: 'condition',
    userId: 'user-1',
    inventoryItemId: 'card-1',
    condition: 'lightly_played',
  }).cards;
  cards = applyCollectorMutationOptimistically(cards, {
    type: 'finish',
    userId: 'user-1',
    inventoryItemId: 'card-1',
    finish: 'foil',
  }).cards;
  cards = applyCollectorMutationOptimistically(cards, {
    type: 'storage',
    userId: 'user-1',
    inventoryItemId: 'card-1',
    storageLocationId: 'binder-1',
  }, [{ id: 'binder-1', name: 'Blue Binder', type: 'binder' }]).cards;
  cards = applyCollectorMutationOptimistically(cards, {
    type: 'trade_binder_status',
    userId: 'user-1',
    inventoryItemId: 'card-1',
    status: 'available',
  }).cards;
  cards = applyCollectorMutationOptimistically(cards, {
    type: 'wishlist',
    userId: 'user-1',
    inventoryItemId: 'card-1',
    wishlisted: true,
    cardName: 'Sol Ring',
    setCode: 'ltc',
    condition: 'lightly_played',
    finish: 'foil',
  }).cards;

  assert.equal(cards[0].condition, 'lightly_played');
  assert.equal(cards[0].printing.finish, 'foil');
  assert.equal(cards[0].storageLocation?.name, 'Blue Binder');
  assert.equal(cards[0].tradeBinderStatus, 'available');
  assert.equal(cards[0].wishlistStatus, 'wanted');
});

test('optimistic rollback restores the previous card state after mutation failure', () => {
  const optimistic = applyCollectorMutationOptimistically([baseCard], {
    type: 'quantity',
    userId: 'user-1',
    inventoryItemId: 'card-1',
    quantity: 4,
  });

  assert.equal(optimistic.cards[0].quantityOwned, 4);
  assert.equal(rollbackCollectorMutation(optimistic)[0].quantityOwned, 2);
});

test('all non-not_for_trade trade statuses remain visible in trade filters', () => {
  assert.equal(isTradeBinderVisibleInTradeFilters('not_for_trade'), false);
  assert.equal(isTradeBinderVisibleInTradeFilters('available'), true);
  assert.equal(isTradeBinderVisibleInTradeFilters('reserved'), true);
  assert.equal(isTradeBinderVisibleInTradeFilters('pending'), true);
  assert.equal(isTradeBinderVisibleInTradeFilters('looking_for_upgrade'), true);
  assert.equal(isTradeBinderVisibleInTradeFilters('for_sale'), true);
});

test('offline queue isolates writes by user and replaces duplicate queued mutations', () => {
  const firstMutation: CollectorMutation = { type: 'quantity', userId: 'user-1', inventoryItemId: 'card-1', quantity: 3 };
  const secondMutation: CollectorMutation = { type: 'quantity', userId: 'user-1', inventoryItemId: 'card-1', quantity: 4 };
  const otherUserMutation: CollectorMutation = { type: 'quantity', userId: 'user-2', inventoryItemId: 'card-1', quantity: 7 };
  let queue: OfflineOperation[] = [];

  queue = addOfflineOperation(queue, operationFor(firstMutation, {
    userId: firstMutation.userId,
    dedupeKey: mutationQueueKey(firstMutation),
  }));
  queue = addOfflineOperation(queue, operationFor(secondMutation, {
    userId: secondMutation.userId,
    dedupeKey: mutationQueueKey(secondMutation),
  }));
  queue = addOfflineOperation(queue, operationFor(otherUserMutation, {
    userId: otherUserMutation.userId,
    dedupeKey: mutationQueueKey(otherUserMutation),
  }));

  assert.equal(queue.length, 2);
  assert.equal(queue.filter((operation) => operation.userId === 'user-1').length, 1);
  assert.equal((queue.find((operation) => operation.userId === 'user-1')?.payload as { quantity?: number }).quantity, 4);
  assert.equal(queue.filter((operation) => operation.userId === 'user-2').length, 1);
});

test('authoritative database errors are recognizable for mobile offline replay', () => {
  assert.deepEqual(
    classifyCollectorAuthoritativeError(new Error('TD_COLLECTOR_FREE_LIMIT_EXCEEDED')),
    {
      authoritative: true,
      code: 'TD_COLLECTOR_FREE_LIMIT_EXCEEDED',
    message: 'Collection limit reached: Free accounts can hold up to 500 total owned cards. Reduce quantity or upgrade to add more.',
    },
  );
  assert.deepEqual(
    classifyCollectorAuthoritativeError({ details: '{"code":"TD_COLLECTOR_UNAUTHORIZED"}' }),
    {
      authoritative: true,
      code: 'TD_COLLECTOR_UNAUTHORIZED',
      message: 'This queued change is not authorized for the signed-in user.',
    },
  );
  assert.equal(classifyCollectorAuthoritativeError(new Error('network unavailable')), null);
});

function operationFor(
  mutation: CollectorMutation,
  options: { userId: string; dedupeKey: string },
): OfflineOperation {
  return {
    id: `${options.userId}-${mutation.inventoryItemId}`,
    type: COLLECTION_MUTATION_QUEUE_TYPE,
    createdAt: '2026-08-05T00:00:00.000Z',
    payload: mutation as unknown as Record<string, unknown>,
    userId: options.userId,
    dedupeKey: options.dedupeKey,
  };
}
