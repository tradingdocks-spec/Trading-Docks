import { Platform } from 'react-native';
import { appStorage } from './app-storage.ts';
import { createOfflineQueue, createQueueLock, type QueueLock, type OfflineQueue } from './offline-core.ts';
export type { OfflineOperation } from './offline-core.ts';

// A single coordinator per native JS runtime, including module reloads. Native
// background queue consumers must run in this runtime; none currently run headless.
const registry = globalThis as typeof globalThis & { __tdOfflineQueue?: OfflineQueue };
function queue(): OfflineQueue {
  if (registry.__tdOfflineQueue) return registry.__tdOfflineQueue;
  const nativeLock = createQueueLock();
  const lock: QueueLock = async (name, work) => {
    if (Platform.OS !== 'web') return nativeLock(name, work);
    // localStorage is shared across tabs. A JS mutex alone is insufficient.
    const locks = (globalThis as typeof globalThis & { navigator?: { locks?: { request: <T>(name: string, callback: () => Promise<T>) => Promise<T> } } }).navigator?.locks;
    if (!locks) throw new Error('Safe offline storage requires browser locking support. Queue preserved; use a supported secure browser.');
    return locks.request(name, work);
  };
  registry.__tdOfflineQueue = createOfflineQueue({ storage: appStorage, lock,
    runtimeId: newId(), newId,
    diagnostic: (event) => console.info('[offline-queue]', event),
  });
  return registry.__tdOfflineQueue;
}
function newId() { return globalThis.crypto?.randomUUID?.() ?? `op-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`; }
export const getOfflineQueue = () => queue().list();
export const findOfflineOperation: OfflineQueue['find'] = (...args) => queue().find(...args);
export const prepareOfflineOperation: OfflineQueue['prepare'] = (...args) => queue().prepare(...args);
export const enqueueOfflineOperation: OfflineQueue['enqueue'] = (...args) => queue().enqueue(...args);
export const processOfflineOperation: OfflineQueue['process'] = (...args) => queue().process(...args);
export const discardOfflineOperation: OfflineQueue['discard'] = (...args) => queue().discard(...args);
