import {
  SCANNER_COLLECTION_QUEUE_TYPE,
  buildScannerAddPayload,
  scannerIdempotencyKey,
  validateScannerConfirmation,
  type ScannerAddPayload,
  type ScannerConfirmation,
} from './scanner-foundation.ts';
import { loadInventoryQuantityTotal } from './inventory-quantity-total.ts';
import type { OfflineOperation, OfflineQueue } from './storage/offline-core.ts';

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
  processOperation: OfflineQueue['process'];
  getAuthenticatedUserId: () => Promise<string | null>;
  loadCurrentTotalQuantity: (userId: string) => Promise<number>;
  inventoryItemExists: (userId: string, inventoryItemId: string) => Promise<boolean>;
  validatePrintingIdentity: (confirmation: ScannerConfirmation) => Promise<ScannerConfirmation>;
  insertInventoryItem: (payload: ScannerAddPayload) => Promise<void>;
  runTradeStatus: (confirmation: ScannerConfirmation, inventoryItemId: string) => Promise<void>;
  runWishlist: (confirmation: ScannerConfirmation) => Promise<void>;
};

export function scannerSyncStateForOperation(operation: OfflineOperation): ScannerSyncState {
  if (operation.status === 'review_required') return 'action_required';
  if (operation.status === 'processing') return 'syncing';
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
  if (!confirmed) return false;
  const { discardOfflineOperation } = await import('./storage/offline.ts');
  return discardOfflineOperation(operationId, userId, SCANNER_COLLECTION_QUEUE_TYPE);
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

  let attempted = 0;
  let succeeded = 0;
  let failed = 0;
  let actionRequired = 0;

  for (const operation of queue) {
    const entry = scannerQueuedAddFromOperation(operation, input.userId);
    if (operation.userId !== input.userId || operation.type !== SCANNER_COLLECTION_QUEUE_TYPE || (input.operationId && operation.id !== input.operationId)) continue;
    if (!entry) {
      await dependencies.processOperation(operation.id, input.userId, SCANNER_COLLECTION_QUEUE_TYPE, async () => {
        throw scannerAuthorityError('Malformed scanner operation preserved for review.');
      }, { retrySafe: false, classify: classifyScannerReplayError });
      actionRequired += 1;
      continue;
    }

    const outcome = await dependencies.processOperation(operation.id, input.userId, SCANNER_COLLECTION_QUEUE_TYPE, async (claimed) => {
      const current = scannerQueuedAddFromOperation(claimed, input.userId);
      if (!current) throw new Error('Invalid queued scanner payload. Review required.');
      await executeScannerReplayEntry(current, input.membershipTier, dependencies);
    }, { retrySafe: !entry.confirmation.addToWishlist && entry.confirmation.tradeStatus === 'not_for_trade', classify: classifyScannerReplayError });
    if (outcome.status === 'skipped') continue;
    attempted += 1;
    if (outcome.status === 'committed') succeeded += 1;
    else { failed += 1; if (isActionRequiredCode(outcome.errorCode)) actionRequired += 1; }
  }

  const remaining = await dependencies.getQueue();
  actionRequired = remaining.filter((operation) => operation.userId === input.userId && operation.type === SCANNER_COLLECTION_QUEUE_TYPE && operation.status === 'review_required').length;
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
  const exists = await dependencies.inventoryItemExists(entry.userId, entry.inventoryItemId);
  let authoritativeConfirmation = entry.confirmation;
  if (!exists) {
    const currentTotalQuantity = await dependencies.loadCurrentTotalQuantity(entry.userId);
    const validation = validateScannerConfirmation(entry.confirmation, { membershipTier, currentTotalQuantity });
    if (!validation.ok) {
      const error = new Error(validation.reason) as Error & { scannerCode: string };
      error.scannerCode = validation.code;
      throw error;
    }
    authoritativeConfirmation = await dependencies.validatePrintingIdentity(entry.confirmation);
    await dependencies.insertInventoryItem(buildScannerAddPayload(authoritativeConfirmation, entry.inventoryItemId));
  }

  if (authoritativeConfirmation.tradeStatus !== 'not_for_trade') {
    await dependencies.runTradeStatus(authoritativeConfirmation, entry.inventoryItemId);
  }
  if (authoritativeConfirmation.addToWishlist) {
    await dependencies.runWishlist(authoritativeConfirmation);
  }
}

function createScannerReplayDependencies(): ScannerReplayDependencies {
  return {
    async getQueue() {
      const { getOfflineQueue } = await import('./storage/offline.ts');
      return getOfflineQueue();
    },
    async processOperation(...args) {
      const { processOfflineOperation } = await import('./storage/offline.ts');
      return processOfflineOperation(...args);
    },
    getAuthenticatedUserId: currentUserId,
    loadCurrentTotalQuantity,
    inventoryItemExists,
    validatePrintingIdentity: validateQueuedPrintingIdentity,
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

async function validateQueuedPrintingIdentity(confirmation: ScannerConfirmation) {
  const { supabase } = await import('../lib/supabase.ts');
  if (!supabase) throw scannerAuthorityError('Card identity validation is not configured. This scan needs confirmation.');
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw scannerAuthorityError('Sign in again to validate this queued scan.');
  const { validateScannerInventoryIdentity } = await import('./scanner-inventory-authority.ts');
  try {
    return await validateScannerInventoryIdentity({ confirmation, accessToken: data.session.access_token });
  } catch (error) {
    throw scannerAuthorityError(error instanceof Error ? error.message : 'This queued scan needs printing confirmation.');
  }
}

function scannerAuthorityError(message: string) {
  const error = new Error(message) as Error & { scannerCode: ScannerReplayErrorCode };
  error.scannerCode = 'invalid_printing';
  return error;
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
  // A uniqueness error is not proof of this operation's success. Reconcile the
  // exact owner/item on the next retry, never swallow an unrelated constraint.
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
