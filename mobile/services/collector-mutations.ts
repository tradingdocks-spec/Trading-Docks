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
  | 'move_quantity'
  | 'remove_quantity'
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

export type MoveQuantityMutation = {
  type: 'move_quantity';
  userId: string;
  inventoryItemId: string;
  quantity: number;
  storageLocationId: string | null;
};

export type RemoveQuantityMutation = {
  type: 'remove_quantity';
  userId: string;
  inventoryItemId: string;
  quantity: number;
  reason?: string | null;
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
  | MoveQuantityMutation
  | RemoveQuantityMutation
  | TradeBinderMutation
  | WishlistMutation;

export type MutationValidationContext = {
  membershipTier: unknown;
  currentTotalQuantity: number;
  currentCardQuantity: number;
  /** Set only from a trusted server/platform-access resolution. */
  hasFullPlatformAccess?: boolean;
  requestedUserId: string;
  authenticatedUserId: string;
};

export type MutationValidationResult =
  | { ok: true }
  | { ok: false; reason: string; code: 'unauthorized' | 'invalid_quantity' | 'free_limit' | 'invalid_value' };

export type CollectorAuthoritativeErrorCode =
  | 'TD_COLLECTOR_UNAUTHORIZED'
  | 'TD_COLLECTOR_FREE_LIMIT_EXCEEDED'
  | 'TD_COLLECTOR_INVALID_QUANTITY'
  | 'TD_COLLECTOR_MISSING_MEMBERSHIP'
  | 'TD_COLLECTOR_INVALID_MUTATION'
  | 'TD_COLLECTOR_INVALID_CONDITION'
  | 'TD_COLLECTOR_INVALID_FINISH';

export type CollectorAuthoritativeError = {
  authoritative: true;
  code: CollectorAuthoritativeErrorCode;
  message: string;
};

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

    const limit = collectionQuantityLimitDecision(context, mutation.quantity);
    if (!limit.ok) {
      return {
        ok: false,
        code: 'free_limit',
        reason: limit.reason,
      };
    }
  }

  if (mutation.type === 'move_quantity' || mutation.type === 'remove_quantity') {
    if (!Number.isInteger(mutation.quantity) || mutation.quantity <= 0) {
      return { ok: false, code: 'invalid_quantity', reason: 'Quantity must be a whole number above zero.' };
    }
    if (mutation.quantity > context.currentCardQuantity) {
      return { ok: false, code: 'invalid_quantity', reason: 'Quantity cannot exceed the selected lot.' };
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

export function collectionQuantityLimitDecision(
  context: Pick<MutationValidationContext, 'membershipTier' | 'currentTotalQuantity' | 'currentCardQuantity' | 'hasFullPlatformAccess'>,
  requestedQuantity: number,
): { ok: true } | { ok: false; reason: string } {
  if (context.hasFullPlatformAccess) return { ok: true };

  const plan = MEMBERSHIP_PLANS[normalizeMembershipTier(context.membershipTier)];
  const limit = plan.limits.cardLimit;
  if (limit === null) return { ok: true };

  const isGrowth = requestedQuantity > context.currentCardQuantity;
  const nextTotal = context.currentTotalQuantity - context.currentCardQuantity + requestedQuantity;
  if (!isGrowth || nextTotal <= limit) return { ok: true };
  return {
    ok: false,
    reason: `Collection limit reached: Free accounts can hold up to ${limit} total owned cards. Reduce quantity or upgrade to add more.`,
  };
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
      if (mutation.type === 'move_quantity') {
        if (mutation.quantity >= next.quantityOwned) {
          next.storageLocation = mutation.storageLocationId ? cardsByLocation.get(mutation.storageLocationId) ?? {
            id: mutation.storageLocationId,
            name: 'Storage location unavailable',
            type: 'unknown',
          } : null;
        } else {
          next.quantityOwned = Math.max(0, next.quantityOwned - mutation.quantity);
        }
      }
      if (mutation.type === 'remove_quantity') next.quantityOwned = Math.max(0, next.quantityOwned - mutation.quantity);
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

export function classifyCollectorAuthoritativeError(error: unknown): CollectorAuthoritativeError | null {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const detail = typeof error === 'object' && error !== null && 'details' in error
    ? String((error as { details?: unknown }).details ?? '')
    : '';
  const source = `${message} ${detail}`;
  const codes: CollectorAuthoritativeErrorCode[] = [
    'TD_COLLECTOR_UNAUTHORIZED',
    'TD_COLLECTOR_FREE_LIMIT_EXCEEDED',
    'TD_COLLECTOR_INVALID_QUANTITY',
    'TD_COLLECTOR_MISSING_MEMBERSHIP',
    'TD_COLLECTOR_INVALID_MUTATION',
    'TD_COLLECTOR_INVALID_CONDITION',
    'TD_COLLECTOR_INVALID_FINISH',
  ];
  const code = codes.find((candidate) => source.includes(candidate));
  if (!code) return null;
  return { authoritative: true, code, message: authoritativeMessage(code) };
}

function authoritativeMessage(code: CollectorAuthoritativeErrorCode) {
  const messages: Record<CollectorAuthoritativeErrorCode, string> = {
    TD_COLLECTOR_UNAUTHORIZED: 'This queued change is not authorized for the signed-in user.',
    TD_COLLECTOR_FREE_LIMIT_EXCEEDED: 'Collection limit reached: Free accounts can hold up to 500 total owned cards. Reduce quantity or upgrade to add more.',
    TD_COLLECTOR_INVALID_QUANTITY: 'Quantity must be a whole number at or above zero.',
    TD_COLLECTOR_MISSING_MEMBERSHIP: 'Membership could not be resolved for this collection change.',
    TD_COLLECTOR_INVALID_MUTATION: 'This queued collection change is not supported.',
    TD_COLLECTOR_INVALID_CONDITION: 'This queued condition is not supported.',
    TD_COLLECTOR_INVALID_FINISH: 'This queued finish is not supported.',
  };
  return messages[code];
}

function cloneCard(card: CollectionCard): CollectionCard {
  return {
    ...card,
    printing: { ...card.printing },
    storageLocation: card.storageLocation ? { ...card.storageLocation } : null,
    marketPrice: { ...card.marketPrice },
  };
}
