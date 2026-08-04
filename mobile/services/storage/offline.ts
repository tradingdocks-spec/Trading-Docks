import { appStorage } from './app-storage';

const QUEUE_KEY = 'td-offline-operation-queue-v1';
export type OfflineOperation = { id: string; type: string; createdAt: string; payload: Record<string, unknown> };

export async function enqueueOfflineOperation(type: string, payload: Record<string, unknown>) {
  const current = await getOfflineQueue();
  const operation: OfflineOperation = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, type, createdAt: new Date().toISOString(), payload };
  await appStorage.setItem(QUEUE_KEY, JSON.stringify([...current, operation]));
  return operation;
}
export async function getOfflineQueue(): Promise<OfflineOperation[]> {
  const raw = await appStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as OfflineOperation[]; } catch { return []; }
}
export async function clearOfflineQueue() { await appStorage.removeItem(QUEUE_KEY); }
