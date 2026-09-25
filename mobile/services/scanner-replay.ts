import {
  SCANNER_COLLECTION_QUEUE_TYPE,
  scannerIdempotencyKey,
  type ScannerConfirmation,
} from './scanner-foundation.ts';
import { classifyInventoryCommandError, deliverInventoryCommand, readInventoryCommand, type InventoryCommand } from './inventory-command.ts';
import type { OfflineOperation, OfflineQueue } from './storage/offline-core.ts';

export type ScannerReplayTrigger = 'network_reconnect' | 'app_resume' | 'session_restore' | 'manual_retry';
export type ScannerSyncState = 'pending' | 'syncing' | 'synced' | 'failed' | 'action_required';
export type ScannerReplayErrorCode =
  | 'IDEMPOTENCY_CONFLICT' | 'REVIEW_REQUIRED' | 'AUTHORIZATION_FAILURE' | 'VALIDATION_REJECTED' | 'RETRYABLE_FAILURE'
  | 'free_limit'
  | 'unauthorized'
  | 'invalid_quantity'
  | 'invalid_printing'
  | 'missing_membership'
  | 'missing_profile'
  | 'unknown';

export type ScannerQueuedAddPayload = {
  command?: InventoryCommand;
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
  deliverCommand?: (operation: OfflineOperation) => Promise<unknown>;
  getQueue: () => Promise<OfflineOperation[]>;
  processOperation: OfflineQueue['process'];
  getAuthenticatedUserId: () => Promise<string | null>;

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
  const command = classifyInventoryCommandError(error);
  if (command.code !== 'RETRYABLE_FAILURE') return { ...command, code: command.code as ScannerReplayErrorCode };
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
      // Legacy confirmation-only entries cannot prove the original RPC payload.
      // Never regenerate recognition, source, timestamp or key during replay.
      readInventoryCommand(claimed);
      if (!dependencies.deliverCommand) throw new Error('REVIEW_REQUIRED: command transport unavailable.');
      await dependencies.deliverCommand(claimed);
    }, { retrySafe: Boolean(operation.payload.command), classify: classifyScannerReplayError });
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

function createScannerReplayDependencies(): ScannerReplayDependencies {
  return {
    deliverCommand: deliverScannerCommand,
    async getQueue() {
      const { getOfflineQueue } = await import('./storage/offline.ts');
      return getOfflineQueue();
    },
    async processOperation(...args) {
      const { processOfflineOperation } = await import('./storage/offline.ts');
      return processOfflineOperation(...args);
    },
    getAuthenticatedUserId: currentUserId,

  };
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

function scannerRemainingForUser(queue: OfflineOperation[], userId: string) {
  return queue.filter((operation) => scannerQueuedAddFromOperation(operation, userId)).length;
}

function normalizeScannerReplayErrorCode(value: unknown): ScannerReplayErrorCode | null {
  if (value === 'IDEMPOTENCY_CONFLICT' || value === 'REVIEW_REQUIRED' || value === 'AUTHORIZATION_FAILURE' || value === 'VALIDATION_REJECTED' || value === 'RETRYABLE_FAILURE') return value;
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
  return code === 'IDEMPOTENCY_CONFLICT' || code === 'REVIEW_REQUIRED' || code === 'AUTHORIZATION_FAILURE' || code === 'VALIDATION_REJECTED' || code === 'free_limit'
    || code === 'unauthorized'
    || code === 'invalid_quantity'
    || code === 'invalid_printing'
    || code === 'missing_membership'
    || code === 'missing_profile';
}

export async function deliverScannerCommand(operation: OfflineOperation) {
  const { supabase } = await import('../lib/supabase.ts');
  if (!supabase) throw new Error('Scanner storage is offline.');
  const { currentInventoryWorkspace } = await import('./inventory-workspace.ts');
  return deliverInventoryCommand(operation, {
    async context() {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw new Error('AUTHORIZATION_FAILURE');
      return { userId: data.user.id, workspaceId: await currentInventoryWorkspace(supabase) };
    },
    async rpc(endpoint, args) { return await supabase.rpc(endpoint, args); },
  });
}
