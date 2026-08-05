import {
  MEMBERSHIP_PLANS,
  normalizeMembershipTier,
} from './membership-catalog.ts';
import {
  normalizeCardCondition,
  normalizeCardFinish,
  normalizeTradeBinderStatus,
  type CardCondition,
  type CardFinish,
  type CollectionCard,
  type StorageLocation,
  type TradeBinderStatus,
} from './collector-workspace.ts';

export type CollectorMutationType =
  | 'quantity'
  | 'condition'
  | 'finish'
  | 'storage'
  | 'trade_binder_status'
  | 'wishlist';

export type QuantityMutation = {
  type: 'quantity';
  userId: string;
  inventoryItemId: string;
  quantity: number;
};

export type ConditionMutation = {
  type: 'condition';
  userId: string;
  inventoryItemId: string;
  condition: CardCondition;
};

export type FinishMutation = {
  type: 'finish';
  userId: string;
  inventoryItemId: string;
  finish: CardFinish;
};

export type StorageMutation = {
  type: 'storage';
  userId: string;
  inventoryItemId: string;
  storageLocationId: string | null;
};

export type TradeBinderMutation = {
  type: 'trade_binder_status';
  userId: string;
  inventoryItemId: string;
  status: Exclude<TradeBinderStatus, 'unknown'>;
};

export type WishlistMutation = {
  type: 'wishlist';
  userId: string;
  inventoryItemId: string;
  wishlisted: boolean;
  cardName: string;
  setCode?: string | null;
  condition: CardCondition;
  finish: CardFinish;
};

export type CollectorMutation =
  | QuantityMutation
  | ConditionMutation
  | FinishMutation
  | StorageMutation
  | TradeBinderMutation
  | WishlistMutation;

export type MutationValidationContext = {
  membershipTier: unknown;
  currentTotalQuantity: number;
  currentCardQuantity: number;
  requestedUserId: string;
  authenticatedUserId: string;
};

export type MutationValidationResult =
  | { ok: true }
  | { ok: false; reason: string; code: 'unauthorized' | 'invalid_quantity' | 'free_limit' | 'invalid_value' };

export type OptimisticMutationResult = {
  cards: CollectionCard[];
  previousCards: CollectionCard[];
  pendingCardId: string;
};

export const COLLECTION_MUTATION_QUEUE_TYPE = 'collector_collection_mutation';

export const CARD_CONDITION_OPTIONS: CardCondition[] = [
  'near_mint',
  'lightly_played',
  'moderately_played',
  'heavily_played',
  'damaged',
  'unknown',
];

export const CARD_FINISH_OPTIONS: CardFinish[] = [
  'normal',
  'foil',
  'etched',
  'showcase',
  'extended_art',
  'borderless',
  'serialized',
  'unknown',
];

export const TRADE_BINDER_STATUS_OPTIONS: Exclude<TradeBinderStatus, 'unknown'>[] = [
  'not_for_trade',
  'available',
  'reserved',
  'pending',
  'looking_for_upgrade',
  'for_sale',
];

export function validateCollectorMutation(
  mutation: CollectorMutation,
  context: MutationValidationContext,
): MutationValidationResult {
  if (mutation.userId !== context.authenticatedUserId || context.requestedUserId !== context.authenticatedUserId) {
    return { ok: false, code: 'unauthorized', reason: 'You can only update your own collection records.' };
  }

  if (!mutation.inventoryItemId.trim()) {
    return { ok: false, code: 'invalid_value', reason: 'Choose a valid collection record.' };
  }

  if (mutation.type === 'quantity') {
    if (!Number.isInteger(mutation.quantity) || mutation.quantity < 0) {
      return { ok: false, code: 'invalid_quantity', reason: 'Quantity must be a whole number at or above zero.' };
    }

    const plan = MEMBERSHIP_PLANS[normalizeMembershipTier(context.membershipTier)];
    const nextTotal = context.currentTotalQuantity - context.currentCardQuantity + mutation.quantity;
    if (plan.limits.cardLimit !== null && nextTotal > plan.limits.cardLimit) {
      return {
        ok: false,
        code: 'free_limit',
        reason: `Free plan collections are limited to ${plan.limits.cardLimit} cards.`,
      };
    }
  }

  if (mutation.type === 'condition' && normalizeCardCondition(mutation.condition) !== mutation.condition) {
    return { ok: false, code: 'invalid_value', reason: 'Choose a supported condition.' };
  }

  if (mutation.type === 'finish' && normalizeCardFinish(mutation.finish) !== mutation.finish) {
    return { ok: false, code: 'invalid_value', reason: 'Choose a supported finish.' };
  }

  if (mutation.type === 'trade_binder_status' && normalizeTradeBinderStatus(mutation.status) !== mutation.status) {
    return { ok: false, code: 'invalid_value', reason: 'Choose a supported trade binder status.' };
  }

  return { ok: true };
}

export function applyCollectorMutationOptimistically(
  cards: CollectionCard[],
  mutation: CollectorMutation,
  locations: StorageLocation[] = [],
): OptimisticMutationResult {
  const previousCards = cards.map((card) => cloneCard(card));
  const cardsByLocation = new Map(locations.map((location) => [location.id, location]));
  return {
    previousCards,
    pendingCardId: mutation.inventoryItemId,
    cards: cards.map((card) => {
      if (card.id !== mutation.inventoryItemId) return card;
      const next = cloneCard(card);
      if (mutation.type === 'quantity') next.quantityOwned = mutation.quantity;
      if (mutation.type === 'condition') next.condition = mutation.condition;
      if (mutation.type === 'finish') next.printing.finish = mutation.finish;
      if (mutation.type === 'storage') next.storageLocation = mutation.storageLocationId ? cardsByLocation.get(mutation.storageLocationId) ?? {
        id: mutation.storageLocationId,
        name: 'Storage location unavailable',
        type: 'unknown',
      } : null;
      if (mutation.type === 'trade_binder_status') next.tradeBinderStatus = mutation.status;
      if (mutation.type === 'wishlist') next.wishlistStatus = mutation.wishlisted ? 'wanted' : 'not_wishlisted';
      next.updatedAt = new Date().toISOString();
      return next;
    }),
  };
}

export function rollbackCollectorMutation(result: OptimisticMutationResult) {
  return result.previousCards;
}

export function mutationQueueKey(mutation: CollectorMutation) {
  if (mutation.type === 'wishlist') return `${mutation.userId}:${mutation.inventoryItemId}:${mutation.type}`;
  return `${mutation.userId}:${mutation.inventoryItemId}:${mutation.type}`;
}

export function isTradeBinderVisibleInTradeFilters(status: TradeBinderStatus) {
  return status !== 'not_for_trade' && status !== 'unknown';
}

function cloneCard(card: CollectionCard): CollectionCard {
  return {
    ...card,
    printing: { ...card.printing },
    storageLocation: card.storageLocation ? { ...card.storageLocation } : null,
    marketPrice: { ...card.marketPrice },
  };
}
