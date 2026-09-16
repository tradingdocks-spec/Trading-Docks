import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { appStorage } from '../services/storage/app-storage.ts';
import {
  DEFAULT_SCANNER_FEEDBACK_PREFERENCES,
  loadScannerFeedbackPreferences,
  normalizeScannerFeedbackPreferences,
  saveScannerFeedbackPreferences,
} from '../services/scanner-feedback-preferences.ts';

const root = process.cwd().replace(/\\/g, '/').endsWith('/mobile') ? process.cwd() : join(process.cwd(), 'mobile');

test('scanner feedback preferences normalize, persist, and restore through the app storage key', async () => {
  const store = new Map<string, string>();
  const originalGetItem = appStorage.getItem;
  const originalSetItem = appStorage.setItem;
  const originalRemoveItem = appStorage.removeItem;

  appStorage.getItem = async (key: string) => store.get(key) ?? null;
  appStorage.setItem = async (key: string, value: string) => {
    store.set(key, value);
  };
  appStorage.removeItem = async (key: string) => {
    store.delete(key);
  };

  try {
    const normalized = normalizeScannerFeedbackPreferences({
      visualConfirmation: false,
      audioConfirmation: true,
      hapticConfirmation: false,
      blockDuplicateScans: true,
      requireCardChangeBeforeRearm: false,
    });
    assert.deepEqual(normalized, {
      visualConfirmation: false,
      audioConfirmation: true,
      hapticConfirmation: false,
      blockDuplicateScans: true,
      requireCardChangeBeforeRearm: false,
    });

    await saveScannerFeedbackPreferences(normalized);
    const restored = await loadScannerFeedbackPreferences();
    assert.deepEqual(restored, normalized);

    await saveScannerFeedbackPreferences(DEFAULT_SCANNER_FEEDBACK_PREFERENCES);
    const restoredDefaults = await loadScannerFeedbackPreferences();
    assert.deepEqual(restoredDefaults, DEFAULT_SCANNER_FEEDBACK_PREFERENCES);
  } finally {
    appStorage.getItem = originalGetItem;
    appStorage.setItem = originalSetItem;
    appStorage.removeItem = originalRemoveItem;
  }
});

test('production scanner feedback controls are exposed in settings and wired independently in the scanner consumer', () => {
  const settings = readFileSync(join(root, 'app', 'settings.tsx'), 'utf8');
  const scanner = readFileSync(join(root, 'components', 'scanner', 'prebuilt-scanner-bakeoff-screen.native.tsx'), 'utf8');

  assert.match(settings, /Visual confirmation/);
  assert.match(settings, /Audio confirmation/);
  assert.match(settings, /Haptic feedback/);
  assert.match(settings, /Prevent duplicate scans/);
  assert.match(settings, /Require next card/);

  assert.match(scanner, /visualConfirmation/);
  assert.match(scanner, /audioConfirmation/);
  assert.match(scanner, /hapticConfirmation/);
  assert.match(scanner, /blockDuplicateScans/);
  assert.match(scanner, /requireCardChangeBeforeRearm/);
  assert.match(scanner, /useAudioPlayer/);
  assert.match(scanner, /audioEventKey/);
  assert.match(scanner, /keepAudioSessionActive: true/);
  assert.match(scanner, /if \(scannerPreferences\.hapticConfirmation\)/);
  assert.match(scanner, /shouldPlayScannerSuccessTone/);
  assert.doesNotMatch(scanner, /if \(!scannerPreferences\.hapticConfirmation\) return;[\s\S]*scannerPreferences\.audioConfirmation/);
});
