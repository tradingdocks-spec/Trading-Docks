import { isDevelopmentToolEnabled, MOBILE_PUBLIC_ENV_KEYS } from './mobile-release-config.ts';

export type ReleaseStateKey =
  | 'home_snapshot'
  | 'collection'
  | 'recent_cards'
  | 'profile'
  | 'membership'
  | 'card_detail'
  | 'scanner_session';

export type ReleaseEmptyKey =
  | 'collection'
  | 'recent_cards'
  | 'review_cards'
  | 'scanner_session'
  | 'search_results'
  | 'wishlist'
  | 'trade_cards'
  | 'storage_locations'
  | 'signals'
  | 'purchase_history';

export type ReleaseErrorKey =
  | 'network'
  | 'sync_failed'
  | 'session_expired'
  | 'query_failed'
  | 'revenuecat_unavailable'
  | 'storekit_unavailable'
  | 'purchase_failed'
  | 'restore_failed'
  | 'ocr_failed'
  | 'lookup_failed'
  | 'image_failed'
  | 'scanner_insert_failed';

export type ReleaseSyncState = 'online' | 'offline' | 'syncing' | 'pending_changes' | 'sync_failed';
export type ReleaseHapticIntent = 'light' | 'medium' | 'success' | 'warning';

export type ReleaseStateModel = {
  title: string;
  message: string;
  actionLabel?: string;
};

export type ReleaseMotionModel = {
  durationMs: number;
  easing: 'standard' | 'emphasized' | 'instant';
};

const loadingStates: Record<ReleaseStateKey, ReleaseStateModel> = {
  home_snapshot: { title: 'Loading home', message: 'Preparing your latest collection snapshot.' },
  collection: { title: 'Loading collection', message: 'Fetching your saved cards.' },
  recent_cards: { title: 'Loading recent cards', message: 'Checking your latest additions.' },
  profile: { title: 'Loading profile', message: 'Opening your account details.' },
  membership: { title: 'Loading memberships', message: 'Checking current StoreKit options.' },
  card_detail: { title: 'Loading card', message: 'Fetching this saved card.' },
  scanner_session: { title: 'Loading review list', message: 'Restoring scanned cards.' },
};

const emptyStates: Record<ReleaseEmptyKey, ReleaseStateModel> = {
  collection: { title: 'No cards yet', message: 'Scan your first card to start your collection.', actionLabel: 'Scan a card' },
  recent_cards: { title: 'No recent additions', message: 'Cards you add or scan will appear here.', actionLabel: 'Open scanner' },
  review_cards: { title: 'No cards need review', message: 'Everything scanned recently is confirmed.', actionLabel: 'Scan more cards' },
  scanner_session: { title: 'No scanner session', message: 'Start a scan to build a review list.', actionLabel: 'Open scanner' },
  search_results: { title: 'No matching cards', message: 'Try a different name, set, number, or location.', actionLabel: 'Clear search' },
  wishlist: { title: 'No wishlist cards', message: 'Cards you are looking for will appear here.', actionLabel: 'Add wanted card' },
  trade_cards: { title: 'No trade cards', message: 'Mark cards for trade to build your binder.', actionLabel: 'Open collection' },
  storage_locations: { title: 'No storage locations', message: 'Create a location when you are ready to organize cards.', actionLabel: 'Create location' },
  signals: { title: 'No signals yet', message: 'Market and collection signals appear when real data is available.', actionLabel: 'Refresh' },
  purchase_history: { title: 'No purchase history', message: 'Completed purchases will appear here.', actionLabel: 'View plans' },
};

const errorStates: Record<ReleaseErrorKey, ReleaseStateModel> = {
  network: { title: "Couldn't connect", message: 'Check your connection and try again.', actionLabel: 'Retry' },
  sync_failed: { title: "Couldn't sync changes", message: 'Your saved work is still on this device. Try again when your connection is ready.', actionLabel: 'Retry sync' },
  session_expired: { title: 'Sign in again', message: 'Your session expired. Sign in to continue.', actionLabel: 'Sign in' },
  query_failed: { title: "Couldn't refresh data", message: 'Check your connection and try again.', actionLabel: 'Retry' },
  revenuecat_unavailable: { title: 'Memberships unavailable', message: 'Store subscriptions could not be loaded right now.', actionLabel: 'Retry' },
  storekit_unavailable: { title: 'Store unavailable', message: 'Purchases are available in a signed native build.', actionLabel: 'Try again' },
  purchase_failed: { title: "Purchase couldn't be completed", message: 'Your card was not charged. Try again or restore purchases.', actionLabel: 'Try again' },
  restore_failed: { title: "Purchases couldn't be restored", message: 'Check your connection and try again.', actionLabel: 'Restore again' },
  ocr_failed: { title: "Couldn't read the card", message: 'Move closer, tap the card to focus, and try again.', actionLabel: 'Retake' },
  lookup_failed: { title: "Couldn't identify", message: 'Retake the card or search manually.', actionLabel: 'Search manually' },
  image_failed: { title: 'Image unavailable', message: 'The card image could not be loaded.', actionLabel: 'Retry image' },
  scanner_insert_failed: { title: "Couldn't save scan", message: 'The card was not added. Try again or keep it queued for sync.', actionLabel: 'Retry' },
};

export const RELEASE_MOTION: Record<string, ReleaseMotionModel> = {
  page: { durationMs: 220, easing: 'standard' },
  sheet: { durationMs: 180, easing: 'emphasized' },
  control: { durationMs: 120, easing: 'standard' },
  success: { durationMs: 260, easing: 'standard' },
  reduced: { durationMs: 0, easing: 'instant' },
};

export const RELEASE_HAPTICS: Record<ReleaseHapticIntent, string> = {
  light: 'button confirmation and tab selection',
  medium: 'scanner successful capture or add',
  success: 'purchase, restore, or important completed action',
  warning: 'destructive confirmation only',
};

export const RELEASE_SAFE_AREA = {
  minTouchTarget: 44,
  smallPhoneWidth: 320,
  supportedWidths: [320, 375, 390, 430],
  bottomNavContentPadding: 96,
};

export function releaseLoadingState(key: ReleaseStateKey) {
  return loadingStates[key];
}

export function releaseEmptyState(key: ReleaseEmptyKey) {
  return emptyStates[key];
}

export function releaseErrorState(key: ReleaseErrorKey) {
  return errorStates[key];
}

export function releaseSyncCopy(state: ReleaseSyncState) {
  if (state === 'offline') return { label: 'Offline', message: "Saved on this device. Will sync when you're back online." };
  if (state === 'syncing') return { label: 'Syncing', message: 'Updating your saved changes.' };
  if (state === 'pending_changes') return { label: 'Pending changes', message: "Saved on this device. Will sync when you're back online." };
  if (state === 'sync_failed') return { label: 'Sync failed', message: 'Your saved work is still on this device. Try again when your connection is ready.' };
  return { label: 'Online', message: 'Up to date.' };
}

export function releaseMotion(key: keyof typeof RELEASE_MOTION, reduceMotion: boolean) {
  return reduceMotion ? RELEASE_MOTION.reduced : RELEASE_MOTION[key];
}

export function isMobileDevRouteEnabled(route: string, env: Record<string, string | undefined> = process.env) {
  if (route === '/dev/design-system') return isDevelopmentToolEnabled(MOBILE_PUBLIC_ENV_KEYS.designSystemShowcase, env);
  if (route === '/dev/scanner-benchmark') return isDevelopmentToolEnabled(MOBILE_PUBLIC_ENV_KEYS.scannerBenchmarkBuilder, env);
  if (route === '/dev/camera-qa') return isDevelopmentToolEnabled(MOBILE_PUBLIC_ENV_KEYS.scannerDiagnostics, env);
  return true;
}

export function humanizeReleaseError(input: unknown, fallback: ReleaseErrorKey = 'query_failed') {
  const message = input instanceof Error ? input.message : typeof input === 'string' ? input : '';
  if (/network|fetch|timeout|offline/i.test(message)) return releaseErrorState('network');
  if (/session|jwt|auth/i.test(message)) return releaseErrorState('session_expired');
  if (/purchase/i.test(message)) return releaseErrorState('purchase_failed');
  if (/restore/i.test(message)) return releaseErrorState('restore_failed');
  if (/ocr|readable text|title read/i.test(message)) return releaseErrorState('ocr_failed');
  if (/lookup|scryfall|identify|candidate/i.test(message)) return releaseErrorState('lookup_failed');
  return releaseErrorState(fallback);
}
