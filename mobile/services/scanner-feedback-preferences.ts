import { appStorage } from './storage/app-storage.ts';

export type ScannerFeedbackPreferences = {
  visualConfirmation: boolean;
  audioConfirmation: boolean;
  hapticConfirmation: boolean;
  blockDuplicateScans: boolean;
  requireCardChangeBeforeRearm: boolean;
};

export const DEFAULT_SCANNER_FEEDBACK_PREFERENCES: ScannerFeedbackPreferences = {
  visualConfirmation: true,
  audioConfirmation: true,
  hapticConfirmation: true,
  blockDuplicateScans: true,
  requireCardChangeBeforeRearm: true,
};

const SCANNER_FEEDBACK_PREFERENCES_KEY = 'trading-docks-scanner-feedback-preferences-v1';

export async function loadScannerFeedbackPreferences(): Promise<ScannerFeedbackPreferences> {
  const raw = await appStorage.getItem(SCANNER_FEEDBACK_PREFERENCES_KEY);
  if (!raw) return DEFAULT_SCANNER_FEEDBACK_PREFERENCES;
  try {
    const parsed = JSON.parse(raw) as Partial<ScannerFeedbackPreferences>;
    return normalizeScannerFeedbackPreferences(parsed);
  } catch {
    return DEFAULT_SCANNER_FEEDBACK_PREFERENCES;
  }
}

export async function saveScannerFeedbackPreferences(preferences: ScannerFeedbackPreferences) {
  await appStorage.setItem(SCANNER_FEEDBACK_PREFERENCES_KEY, JSON.stringify(normalizeScannerFeedbackPreferences(preferences)));
}

export function normalizeScannerFeedbackPreferences(preferences: Partial<ScannerFeedbackPreferences> | null | undefined): ScannerFeedbackPreferences {
  return {
    visualConfirmation: preferences?.visualConfirmation ?? DEFAULT_SCANNER_FEEDBACK_PREFERENCES.visualConfirmation,
    audioConfirmation: preferences?.audioConfirmation ?? DEFAULT_SCANNER_FEEDBACK_PREFERENCES.audioConfirmation,
    hapticConfirmation: preferences?.hapticConfirmation ?? DEFAULT_SCANNER_FEEDBACK_PREFERENCES.hapticConfirmation,
    blockDuplicateScans: preferences?.blockDuplicateScans ?? DEFAULT_SCANNER_FEEDBACK_PREFERENCES.blockDuplicateScans,
    requireCardChangeBeforeRearm: preferences?.requireCardChangeBeforeRearm ?? DEFAULT_SCANNER_FEEDBACK_PREFERENCES.requireCardChangeBeforeRearm,
  };
}
