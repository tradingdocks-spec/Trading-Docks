import { appStorage } from './app-storage.ts';
import { addOfflineOperation, type OfflineOperation } from './offline-core.ts';

const QUEUE_KEY = 'td-offline-operation-queue-v1';
export type { OfflineOperation };

export async function enqueueOfflineOperation(
  type: string,
  payload: Record<string, unknown>,
  options: { dedupeKey?: string; userId?: string } = {},
) {
  const current = await getOfflineQueue();
  const operation: OfflineOperation = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    createdAt: new Date().toISOString(),
    payload,
    dedupeKey: options.dedupeKey,
    userId: options.userId,
  };
  await appStorage.setItem(QUEUE_KEY, JSON.stringify(addOfflineOperation(current, operation)));
  return operation;
}
export async function getOfflineQueue(): Promise<OfflineOperation[]> {
  const raw = await appStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as OfflineOperation[]; } catch { return []; }
}
export async function clearOfflineQueue() { await appStorage.removeItem(QUEUE_KEY); }
export async function replaceOfflineQueue(queue: OfflineOperation[]) {
  await appStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}
