import {
  SCANNER_COLLECTION_QUEUE_TYPE,
  buildScannerAddPayload,
  scannerIdempotencyKey,
  validateScannerConfirmation,
  type ScannerAddPayload,
  type ScannerConfirmation,
} from './scanner-foundation.ts';
import { loadInventoryQuantityTotal } from './inventory-quantity-total.ts';
import type { OfflineOperation } from './storage/offline-core.ts';

export type ScannerReplayTrigger = 'network_reconnect' | 'app_resume' | 'session_restore' | 'manual_retry';
export type ScannerSyncState = 'pending' | 'syncing' | 'synced' | 'failed' | 'action_required';
export type ScannerReplayErrorCode =
  | 'free_limit'
  | 'unauthorized'
  | 'invalid_quantity'
  | 'invalid_printing'
  | 'missing_membership'
  | 'missing_profile'
  | 'unknown';

export type ScannerQueuedAddPayload = {
  confirmation: ScannerConfirmation;
  inventoryItemId: string;
  idempotencyKey?: string;
};

export type ScannerQueuedAdd = {
  operationId: string;
  userId: string;
  inventoryItemId: string;
  idempotencyKey: string;
  createdAt: string;
  syncState: ScannerSyncState;
  lastError?: string;
  errorCode?: ScannerReplayErrorCode;
  confirmation: ScannerConfirmation;
};

export type ScannerReplayResult = {
  trigger: ScannerReplayTrigger;
  attempted: number;
  succeeded: number;
  failed: number;
  actionRequired: number;
  remaining: number;
};

export type ScannerReplayDependencies = {
  getQueue: () => Promise<OfflineOperation[]>;
  replaceQueue: (queue: OfflineOperation[]) => Promise<void>;
  getAuthenticatedUserId: () => Promise<string | null>;
  loadCurrentTotalQuantity: (userId: string) => Promise<number>;
  inventoryItemExists: (userId: string, inventoryItemId: string) => Promise<boolean>;
  insertInventoryItem: (payload: ScannerAddPayload) => Promise<void>;
  runTradeStatus: (confirmation: ScannerConfirmation, inventoryItemId: string) => Promise<void>;
  runWishlist: (confirmation: ScannerConfirmation) => Promise<void>;
};

export function scannerSyncStateForOperation(operation: OfflineOperation): ScannerSyncState {
  if (isActionRequiredCode(operation.errorCode)) return 'action_required';
  return operation.lastError ? 'failed' : 'pending';
}

export function scannerQueuedAddFromOperation(operation: OfflineOperation, userId: string): ScannerQueuedAdd | null {
  if (operation.type !== SCANNER_COLLECTION_QUEUE_TYPE || operation.userId !== userId) return null;
  const payload = operation.payload as Partial<ScannerQueuedAddPayload>;
  if (!payload.confirmation || !payload.inventoryItemId || payload.confirmation.userId !== userId) return null;
  const idempotencyKey = payload.idempotencyKey ?? scannerIdempotencyKey(payload.confirmation, payload.inventoryItemId);
  return {
    operationId: operation.id,
    userId,
    inventoryItemId: payload.inventoryItemId,
    idempotencyKey,
    createdAt: operation.createdAt,
    syncState: scannerSyncStateForOperation(operation),
    lastError: operation.lastError,
    errorCode: normalizeScannerReplayErrorCode(operation.errorCode) ?? undefined,
    confirmation: payload.confirmation,
  };
}

export function classifyScannerReplayError(error: unknown): { code: ScannerReplayErrorCode; message: string; actionRequired: boolean } {
  const message = error instanceof Error ? error.message : String(error || 'Queued scanner add failed.');
  const sourceCode = normalizeScannerReplayErrorCode((error as { code?: unknown; scannerCode?: unknown; errorCode?: unknown } | null)?.scannerCode)
    ?? normalizeScannerReplayErrorCode((error as { code?: unknown; scannerCode?: unknown; errorCode?: unknown } | null)?.errorCode)
    ?? normalizeScannerReplayErrorCode((error as { code?: unknown; scannerCode?: unknown; errorCode?: unknown } | null)?.code);
  const normalized = message.toLowerCase();
  const code = sourceCode
    ?? (normalized.includes('free') && normalized.includes('limit') ? 'free_limit'
      : normalized.includes('unauthorized') || normalized.includes('own') || normalized.includes('sign in') ? 'unauthorized'
        : normalized.includes('quantity') ? 'invalid_quantity'
          : normalized.includes('printing') ? 'invalid_printing'
            : normalized.includes('membership') ? 'missing_membership'
              : normalized.includes('profile') ? 'missing_profile'
                : 'unknown');
  return { code, message, actionRequired: isActionRequiredCode(code) };
}

export async function listScannerQueuedAdds(userId: string) {
  const { getOfflineQueue } = await import('./storage/offline.ts');
  const queue = await getOfflineQueue();
  return queue
    .map((operation) => scannerQueuedAddFromOperation(operation, userId))
    .filter((entry): entry is ScannerQueuedAdd => Boolean(entry));
}

export function discardQueuedScannerAddFromQueue(
  queue: OfflineOperation[],
  operationId: string,
  userId: string,
  confirmed: boolean,
) {
  if (!confirmed) return { queue, discarded: false };
  let discarded = false;
  const next = queue.filter((operation) => {
    const entry = scannerQueuedAddFromOperation(operation, userId);
    if (entry?.operationId === operationId) {
      discarded = true;
      return false;
    }
    return true;
  });
  return { queue: next, discarded };
}

export async function discardQueuedScannerAdd(operationId: string, userId: string, confirmed: boolean) {
  const { getOfflineQueue, replaceOfflineQueue } = await import('./storage/offline.ts');
  const result = discardQueuedScannerAddFromQueue(await getOfflineQueue(), operationId, userId, confirmed);
  if (result.discarded) await replaceOfflineQueue(result.queue);
  return result.discarded;
}

export async function retryQueuedScannerAdd({
  operationId,
  userId,
  membershipTier,
}: {
  operationId: string;
  userId: string;
  membershipTier: unknown;
}) {
  return replayQueuedScannerAddsWithDependencies(
    { userId, membershipTier, trigger: 'manual_retry', operationId },
    createScannerReplayDependencies(),
  );
}

export async function retryQueuedScannerAdds({
  userId,
  membershipTier,
  trigger,
}: {
  userId: string;
  membershipTier: unknown;
  trigger: ScannerReplayTrigger;
}) {
  return replayQueuedScannerAddsWithDependencies(
    { userId, membershipTier, trigger },
    createScannerReplayDependencies(),
  );
}

export async function replayQueuedScannerAddsWithDependencies(
  input: {
    userId: string;
    membershipTier: unknown;
    trigger: ScannerReplayTrigger;
    operationId?: string;
  },
  dependencies: ScannerReplayDependencies,
): Promise<ScannerReplayResult> {
  const authUserId = await dependencies.getAuthenticatedUserId();
  const queue = await dependencies.getQueue();
  if (authUserId !== input.userId) {
    return { trigger: input.trigger, attempted: 0, succeeded: 0, failed: 0, actionRequired: 0, remaining: scannerRemainingForUser(queue, input.userId) };
  }

  const remaining: OfflineOperation[] = [];
  let attempted = 0;
  let succeeded = 0;
  let failed = 0;
  let actionRequired = 0;

  for (const operation of queue) {
    const entry = scannerQueuedAddFromOperation(operation, input.userId);
    if (!entry || (input.operationId && entry.operationId !== input.operationId)) {
      remaining.push(operation);
      continue;
    }

    attempted += 1;
    const syncingOperation = { ...operation, lastError: undefined, errorCode: undefined };
    try {
      await executeScannerReplayEntry(entry, input.membershipTier, dependencies);
      succeeded += 1;
    } catch (error) {
      const classified = classifyScannerReplayError(error);
      failed += 1;
      if (classified.actionRequired) actionRequired += 1;
      remaining.push({
        ...syncingOperation,
        lastError: classified.message,
        errorCode: classified.code,
      });
    }
  }

  await dependencies.replaceQueue(remaining);
  return {
    trigger: input.trigger,
    attempted,
    succeeded,
    failed,
    actionRequired,
    remaining: scannerRemainingForUser(remaining, input.userId),
  };
}

async function executeScannerReplayEntry(
  entry: ScannerQueuedAdd,
  membershipTier: unknown,
  dependencies: ScannerReplayDependencies,
) {
  const currentTotalQuantity = await dependencies.loadCurrentTotalQuantity(entry.userId);
  const validation = validateScannerConfirmation(entry.confirmation, { membershipTier, currentTotalQuantity });
  if (!validation.ok) {
    const error = new Error(validation.reason) as Error & { scannerCode: string };
    error.scannerCode = validation.code;
    throw error;
  }

  const exists = await dependencies.inventoryItemExists(entry.userId, entry.inventoryItemId);
  if (!exists) {
    await dependencies.insertInventoryItem(buildScannerAddPayload(entry.confirmation, entry.inventoryItemId));
  }

  if (entry.confirmation.tradeStatus !== 'not_for_trade') {
    await dependencies.runTradeStatus(entry.confirmation, entry.inventoryItemId);
  }
  if (entry.confirmation.addToWishlist) {
    await dependencies.runWishlist(entry.confirmation);
  }
}

function createScannerReplayDependencies(): ScannerReplayDependencies {
  return {
    async getQueue() {
      const { getOfflineQueue } = await import('./storage/offline.ts');
      return getOfflineQueue();
    },
    async replaceQueue(queue) {
      const { replaceOfflineQueue } = await import('./storage/offline.ts');
      await replaceOfflineQueue(queue);
    },
    getAuthenticatedUserId: currentUserId,
    loadCurrentTotalQuantity,
    inventoryItemExists,
    insertInventoryItem,
    async runTradeStatus(confirmation, inventoryItemId) {
      const { runMobileTradeWishlistMutation } = await import('./trade-binder-wishlist-data.ts');
      await runMobileTradeWishlistMutation({
        type: 'trade_status',
        userId: confirmation.userId,
        inventoryItemId,
        status: confirmation.tradeStatus,
      });
    },
    async runWishlist(confirmation) {
      const { runMobileTradeWishlistMutation } = await import('./trade-binder-wishlist-data.ts');
      await runMobileTradeWishlistMutation({
        type: 'wishlist_toggle',
        userId: confirmation.userId,
        cardName: confirmation.candidate.name,
        setCode: confirmation.candidate.setCode,
        condition: confirmation.condition,
        finish: confirmation.finish,
        wishlisted: true,
      });
    },
  };
}

async function currentUserId() {
  const { supabase } = await import('../lib/supabase.ts');
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

async function loadCurrentTotalQuantity(userId: string) {
  const { supabase } = await import('../lib/supabase.ts');
  if (!supabase) throw new Error('Supabase scanner replay is not configured.');
  return loadInventoryQuantityTotal(supabase, userId);
}

async function inventoryItemExists(userId: string, inventoryItemId: string) {
  const { supabase } = await import('../lib/supabase.ts');
  if (!supabase) throw new Error('Supabase scanner replay is not configured.');
  const { data, error } = await supabase
    .from('inventory_items')
    .select('id')
    .eq('user_id', userId)
    .eq('id', inventoryItemId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

async function insertInventoryItem(payload: ScannerAddPayload) {
  const { supabase } = await import('../lib/supabase.ts');
  if (!supabase) throw new Error('Supabase scanner replay is not configured.');
  const inventoryItemId = String(payload.id ?? '');
  const { error } = await supabase.rpc('create_inventory_item_with_event', {
    p_inventory: payload,
    p_source: 'scanner_replay',
    p_idempotency_key: inventoryItemId ? `scanner-replay:${inventoryItemId}` : null,
    p_related_entity_type: 'scanner_queue_entry',
    p_related_entity_id: inventoryItemId || null,
  });
  if (!error) return;
  const classified = classifyScannerReplayError(error);
  if (classified.code === 'unknown' && /duplicate|unique/i.test(error.message)) return;
  throw new Error(error.message);
}

function scannerRemainingForUser(queue: OfflineOperation[], userId: string) {
  return queue.filter((operation) => scannerQueuedAddFromOperation(operation, userId)).length;
}

function normalizeScannerReplayErrorCode(value: unknown): ScannerReplayErrorCode | null {
  if (value === 'free_limit' || value === 'TD_COLLECTOR_FREE_LIMIT_EXCEEDED') return 'free_limit';
  if (value === 'unauthorized' || value === 'TD_COLLECTOR_UNAUTHORIZED') return 'unauthorized';
  if (value === 'invalid_quantity' || value === 'TD_COLLECTOR_INVALID_QUANTITY') return 'invalid_quantity';
  if (value === 'invalid_printing' || value === 'TD_COLLECTOR_INVALID_PRINTING') return 'invalid_printing';
  if (value === 'missing_membership' || value === 'TD_COLLECTOR_MISSING_MEMBERSHIP') return 'missing_membership';
  if (value === 'missing_profile' || value === 'TD_COLLECTOR_MISSING_PROFILE') return 'missing_profile';
  if (value === 'unknown') return 'unknown';
  return null;
}

function isActionRequiredCode(value: unknown): value is ScannerReplayErrorCode {
  const code = normalizeScannerReplayErrorCode(value);
  return code === 'free_limit'
    || code === 'unauthorized'
    || code === 'invalid_quantity'
    || code === 'invalid_printing'
    || code === 'missing_membership'
    || code === 'missing_profile';
}
