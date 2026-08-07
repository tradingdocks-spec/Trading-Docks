export type MobileSyncStatus = 'synced' | 'syncing' | 'offline' | 'pending' | 'failed';

export const MOBILE_SYNC_STATUS_LABELS: Record<MobileSyncStatus, string> = {
  synced: 'Synced',
  syncing: 'Syncing',
  offline: 'Offline',
  pending: 'Pending',
  failed: 'Failed',
};

export function mobileSyncStatusLabel(status: MobileSyncStatus) {
  return MOBILE_SYNC_STATUS_LABELS[status];
}

export function mobileSyncStatusFromScannerLine(input: {
  syncState: 'local_only' | 'pending_sync' | 'synced' | 'failed';
  online?: boolean;
  syncing?: boolean;
}): MobileSyncStatus {
  if (input.syncing) return 'syncing';
  if (input.online === false && input.syncState !== 'synced') return 'offline';
  if (input.syncState === 'synced') return 'synced';
  if (input.syncState === 'failed') return 'failed';
  return 'pending';
}
