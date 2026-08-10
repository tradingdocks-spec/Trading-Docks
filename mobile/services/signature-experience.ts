export const TRADING_DOCKS_SIGNATURE_INTERACTIONS = [
  'dock',
  'lift',
  'slot',
  'scanLock',
  'reveal',
] as const;

export type TradingDocksSignatureInteraction = typeof TRADING_DOCKS_SIGNATURE_INTERACTIONS[number];

export const TRADING_DOCKS_HAPTIC_VOCABULARY: Record<TradingDocksSignatureInteraction, 'light' | 'selection' | 'medium' | 'success'> = {
  dock: 'light',
  lift: 'selection',
  slot: 'medium',
  scanLock: 'selection',
  reveal: 'success',
};

export const SIGNATURE_SKELETON_SURFACES = [
  'home',
  'collection',
  'decks',
  'account',
  'binder',
  'scanner',
] as const;

export type SignatureSkeletonSurface = typeof SIGNATURE_SKELETON_SURFACES[number];

export type ScanLockState = 'searching' | 'found' | 'locked' | 'reading' | 'added' | 'remove' | 'ready';

export const SCAN_LOCK_STATES: ScanLockState[] = [
  'searching',
  'found',
  'locked',
  'reading',
  'added',
  'remove',
  'ready',
];

export function describeScanLockState(state: ScanLockState) {
  const copy: Record<ScanLockState, { label: string; instruction: string; tone: 'neutral' | 'info' | 'success' | 'warning' }> = {
    searching: { label: 'Searching', instruction: 'Place a card in the frame.', tone: 'neutral' },
    found: { label: 'Found', instruction: 'Center card.', tone: 'info' },
    locked: { label: 'Locked', instruction: 'Hold steady.', tone: 'info' },
    reading: { label: 'Reading', instruction: 'Scanning.', tone: 'info' },
    added: { label: 'Added', instruction: 'Card added.', tone: 'success' },
    remove: { label: 'Remove', instruction: 'Remove card to rearm.', tone: 'warning' },
    ready: { label: 'Ready', instruction: 'Ready for next card.', tone: 'info' },
  };
  return copy[state];
}

export function buildLaunchChoreographyContract({
  appReady,
  reduceMotion,
}: {
  appReady: boolean;
  reduceMotion: boolean;
}) {
  return {
    targetDurationMs: reduceMotion ? 0 : 860,
    minimumDurationMs: reduceMotion ? 0 : 700,
    maximumDurationMs: reduceMotion ? 0 : 1000,
    blocksAppReadiness: false,
    nextSurface: appReady ? 'home' : 'matching-skeleton',
  } as const;
}
