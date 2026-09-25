"use client";
import { createOfflineQueue, type OfflineQueue } from '../../mobile/services/storage/offline-core';
let coordinator: OfflineQueue | undefined;
export function collectorEditQueue() {
  if (coordinator) return coordinator;
  if (!navigator.locks || !crypto.randomUUID) throw new Error('Safe edit recovery requires a secure browser with locking support.');
  coordinator = createOfflineQueue({
    storage: { getItem: async (key) => localStorage.getItem(key), setItem: async (key, value) => { localStorage.setItem(key, value); } },
    lock: async (name, work) => await navigator.locks.request(name, work),
    runtimeId: crypto.randomUUID(), newId: () => crypto.randomUUID(),
  });
  return coordinator;
}
