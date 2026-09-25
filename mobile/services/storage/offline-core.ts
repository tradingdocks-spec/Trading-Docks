export type OfflineOperation = {
  id: string;
  type: string;
  createdAt: string;
  payload: Record<string, unknown>;
  dedupeKey?: string;
  userId?: string;
  lastError?: string;
  errorCode?: string;
  status?: 'pending' | 'processing' | 'retryable' | 'review_required' | 'committed';
  attempts?: number;
  updatedAt?: string;
  claimId?: string;
  runtimeId?: string;
};

export function addOfflineOperation(
  current: OfflineOperation[],
  operation: OfflineOperation,
) {
  const existing = current.find((queued) => queued.id === operation.id || (
    operation.dedupeKey && queued.dedupeKey === operation.dedupeKey && queued.userId === operation.userId && queued.type === operation.type
  ));
  // Never replace a live claim, payload or original operation identity.
  return existing ? current : [...current, operation];
}

export type QueueStorage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
export type QueueLock = <T>(name: string, work: () => Promise<T>) => Promise<T>;
export type QueueDiagnostic = { event: string; operationId?: string; type?: string; attempts?: number; depth: number };
export type QueueOutcome = { status: 'committed' | 'failed' | 'skipped'; errorCode?: string };
export const OFFLINE_QUEUE_KEY = 'td-offline-operation-queue-v1';

/** One storage lock shared by every caller. Network work uses separate item locks. */
export function createQueueLock(): QueueLock {
  const tails = new Map<string, Promise<unknown>>();
  return async (name, work) => {
    const before = tails.get(name) ?? Promise.resolve();
    const next = before.catch(() => {}).then(work);
    tails.set(name, next);
    try { return await next; } finally { if (tails.get(name) === next) tails.delete(name); }
  };
}

export function createOfflineQueue(input: {
  storage: QueueStorage;
  lock: QueueLock;
  runtimeId: string;
  newId: () => string;
  now?: () => string;
  diagnostic?: (event: QueueDiagnostic) => void;
}) {
  const now = input.now ?? (() => new Date().toISOString());
  const emit = (event: string, rows: OfflineOperation[], row?: OfflineOperation) => {
    // Never log payloads, auth identities, user-provided messages or raw server errors.
    try { input.diagnostic?.({ event, operationId: row?.id, type: row?.type, attempts: row?.attempts ?? 0, depth: rows.filter((r) => r.status !== 'committed').length }); } catch { /* diagnostics cannot break persistence */ }
  };
  const read = async (): Promise<OfflineOperation[]> => {
    const raw = await input.storage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { throw new Error('Offline queue is unreadable. Original storage preserved; recovery required.'); }
    if (!Array.isArray(parsed)) throw new Error('Offline queue format is unsupported. Original storage preserved.');
    const ids = new Set<string>();
    return parsed.map((value, index) => {
      const row = value as Partial<OfflineOperation> | null;
      if (!row || typeof row.id !== 'string' || !row.id || ids.has(row.id) || typeof row.type !== 'string' || !row.type || typeof row.userId !== 'string' || !row.userId || !row.payload || typeof row.payload !== 'object' || Array.isArray(row.payload)) {
        return { id: `quarantined:${index}`, userId: '__quarantine__', type: 'invalid_operation', createdAt: '', payload: { preserved: value }, status: 'review_required', errorCode: 'invalid_operation', lastError: 'Malformed operation preserved for review.' };
      }
      ids.add(row.id);
      const states = ['pending', 'processing', 'retryable', 'review_required', 'committed'];
      const validStatus = row.status === undefined || states.includes(row.status);
      return { ...row, status: validStatus ? row.status ?? 'review_required' : 'review_required',
        ...(row.status === undefined ? { errorCode: 'legacy_outcome_unknown', lastError: 'Legacy queued request preserved. Verify its server outcome before replay.' } : {}),
        attempts: Number.isSafeInteger(row.attempts) && row.attempts! >= 0 ? row.attempts : 0 } as OfflineOperation;
    });
  };
  const update = <T>(work: (rows: OfflineOperation[]) => { rows: OfflineOperation[]; result: T; event?: string; row?: OfflineOperation }): Promise<T> => input.lock(OFFLINE_QUEUE_KEY, async () => {
    const change = work(await read());
    await input.storage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(change.rows));
    if (change.event) emit(change.event, change.rows, change.row);
    return change.result;
  });
  return {
    async list() { return input.lock(OFFLINE_QUEUE_KEY, async () => (await read()).filter((r) => r.status !== 'committed')); },
    async enqueue(type: string, payload: Record<string, unknown>, options: { userId?: string; dedupeKey?: string; operationId?: string; uncertain?: boolean } = {}) {
      if (!options.userId || !type) throw new Error('Queue operations require a user and type.');
      const row: OfflineOperation = { id: options.operationId ?? input.newId(), type, payload, userId: options.userId, dedupeKey: options.dedupeKey, createdAt: now(), updatedAt: now(), attempts: 0,
        status: options.uncertain ? 'review_required' : 'pending',
        ...(options.uncertain ? { errorCode: 'uncertain_legacy_response', lastError: 'Server outcome requires reconciliation before replay.' } : {}),
      };
      return update((rows) => {
        const existing = rows.find((r) => r.id === row.id || (r.status !== 'committed' && row.dedupeKey && r.dedupeKey === row.dedupeKey && r.userId === row.userId && r.type === row.type));
        if (existing) {
          if (existing.userId !== row.userId || existing.type !== row.type || JSON.stringify(existing.payload) !== JSON.stringify(row.payload)) throw new Error('Queue operation identity conflicts with its persisted payload. Original operation preserved.');
          return { rows, result: existing, event: 'duplicate_enqueue', row: existing };
        }
        return { rows: [...rows, row], result: row, event: 'enqueue', row };
      });
    },
    async discard(id: string, userId: string, type: string) {
      return update((rows) => {
        const row = rows.find((r) => r.id === id && r.userId === userId && r.type === type);
        if (!row || row.status === 'processing' || row.status === 'committed') return { rows, result: false };
        // Retain a terminal tombstone so a stale enqueue cannot resurrect the item.
        const changed: OfflineOperation = { ...row, status: 'committed', errorCode: 'discarded_by_user', updatedAt: now() };
        return { rows: rows.map((r) => r === row ? changed : r), result: true, event: 'discard', row: changed };
      });
    },
    async process(id: string, userId: string, type: string, handler: (operation: OfflineOperation) => Promise<void>, options: {
      retrySafe: boolean;
      classify?: (error: unknown) => { code: string; message: string; actionRequired: boolean };
    }): Promise<QueueOutcome> {
      return input.lock(`${OFFLINE_QUEUE_KEY}:item:${id}`, async () => {
        const claim = await update<OfflineOperation | null>((rows) => {
          const row = rows.find((r) => r.id === id && r.userId === userId && r.type === type);
          if (!row || row.status === 'committed' || row.status === 'review_required') return { rows, result: null, event: 'duplicate_or_blocked_replay', row };
          const recovered = row.status === 'processing';
          if (recovered && !options.retrySafe) {
            const held: OfflineOperation = { ...row, status: 'review_required', errorCode: 'uncertain_commit', lastError: 'Interrupted operation requires server reconciliation.', updatedAt: now() };
            return { rows: rows.map((r) => r === row ? held : r), result: null, event: 'restart_review_required', row: held };
          }
          const claimed: OfflineOperation = { ...row, status: 'processing', attempts: (row.attempts ?? 0) + 1, updatedAt: now(), claimId: input.newId(), runtimeId: input.runtimeId };
          return { rows: rows.map((r) => r === row ? claimed : r), result: claimed, event: recovered ? 'restart_recovery' : 'claim', row: claimed };
        });
        if (!claim) return { status: 'skipped' };
        await input.lock(OFFLINE_QUEUE_KEY, async () => emit('replay_start', await read(), claim));
        let failure: unknown;
        let failed = false;
        try { await handler(claim); } catch (error) { failed = true; failure = error; }
        // If this write fails, persisted PROCESSING remains: never claim local success.
        return update<QueueOutcome>((rows) => {
          const row = rows.find((r) => r.id === claim.id && r.claimId === claim.claimId && r.status === 'processing');
          if (!row) return { rows, result: { status: 'skipped' } };
          const classified = failed ? options.classify?.(failure) ?? { code: 'request_failed', message: 'Request did not complete. Retry or review its server outcome.', actionRequired: false } : null;
          const changed: OfflineOperation = { ...row, updatedAt: now(), status: failed ? (!options.retrySafe || classified?.actionRequired ? 'review_required' : 'retryable') : 'committed', lastError: classified?.message, errorCode: classified?.code };
          return { rows: rows.map((r) => r === row ? changed : r), result: { status: failed ? 'failed' : 'committed', errorCode: classified?.code }, event: failed ? 'replay_failure' : 'replay_success', row: changed };
        });
      });
    },
  };
}

export type OfflineQueue = ReturnType<typeof createOfflineQueue>;
