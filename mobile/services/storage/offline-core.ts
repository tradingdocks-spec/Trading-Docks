export type OfflineOperation = {
  id: string;
  type: string;
  createdAt: string;
  payload: Record<string, unknown>;
  dedupeKey?: string;
  userId?: string;
};

export function addOfflineOperation(
  current: OfflineOperation[],
  operation: OfflineOperation,
) {
  const withoutDuplicate = operation.dedupeKey
    ? current.filter((queued) => queued.dedupeKey !== operation.dedupeKey)
    : current;
  return [...withoutDuplicate, operation];
}
