import assert from 'node:assert/strict';
import test from 'node:test';

import type { ScannerCardCandidate } from '../services/scanner-foundation.ts';
import {
  buildPremiumResultTray,
  compactScannerMoney,
  dominantScannerSurface,
  guidePresentationForPipeline,
  highVolumeCardShowDefaults,
  resolvePremiumScannerPipeline,
  resolveScanner2InteractionState,
  scanner2CameraHeight,
  scanner2HudLine,
  scanner2MotionForState,
  scannerCameraHeightForWidth,
  scannerHudRowsForWidth,
  scannerTrayLayoutForWidth,
  scannerVerticalLayoutModel,
  shouldRenderDiagnosticsInline,
} from '../services/premium-scanner-experience.ts';

const candidate: ScannerCardCandidate = {
  id: 'sf-brainstorm',
  name: 'Brainstorm',
  setCode: 'STA',
  setName: 'Strixhaven Mystical Archive',
  collectorNumber: '13',
  finishes: ['normal', 'foil'],
  language: 'en',
  imageUrl: 'https://img.example/brainstorm.jpg',
  confidence: 0.94,
  recognitionMode: 'assisted_capture',
};

test('normal scanner excludes diagnostics inline even when development diagnostics are enabled', () => {
  assert.equal(shouldRenderDiagnosticsInline(false), false);
  assert.equal(shouldRenderDiagnosticsInline(true), false);
});

test('OCR failure produces a failed tray without creating an unknown session row contract', () => {
  const tray = buildPremiumResultTray({
    selectedCandidate: null,
    topCandidate: null,
    candidateCount: 0,
    confidenceLabel: null,
    confidenceScore: null,
    failedReason: 'OCR did not find a usable card title.',
    marketPrice: null,
    cashOffer: null,
  });
  assert.equal(tray?.kind, 'failed');
  assert.equal(tray?.title, "Couldn't identify card");
  assert.equal(tray?.status, 'Review required');
  assert.deepEqual(tray?.secondaryActions, ['Search manually']);
});

test('high-confidence result tray stays compact and session-oriented', () => {
  const tray = buildPremiumResultTray({
    selectedCandidate: candidate,
    topCandidate: candidate,
    candidateCount: 1,
    confidenceLabel: 'Recognized',
    confidenceScore: 94,
    failedReason: null,
    marketPrice: 4,
    cashOffer: 2.8,
  });
  assert.equal(tray?.kind, 'recognized');
  assert.equal(tray?.expanded, false);
  assert.equal(tray?.primaryAction, 'Add to session');
});

test('ambiguous top-three result tray expands for printing review', () => {
  const tray = buildPremiumResultTray({
    selectedCandidate: candidate,
    topCandidate: candidate,
    candidateCount: 3,
    confidenceLabel: 'Ambiguous',
    confidenceScore: 72,
    failedReason: null,
    marketPrice: null,
    cashOffer: null,
  });
  assert.equal(tray?.kind, 'ambiguous');
  assert.equal(tray?.expanded, true);
  assert.ok(tray?.secondaryActions.includes('Alternates'));
});

test('pipeline maps capture and recognition stages to one visible recoverable state', () => {
  assert.equal(resolvePremiumScannerPipeline({
    permissionGranted: true,
    cameraReady: true,
    cameraActive: true,
    captureState: 'ready',
    recognitionStage: 'idle',
    selectedCandidate: null,
    hasError: false,
    awaitingCardRemoval: false,
    justAdded: false,
  }), 'camera_ready');
  assert.equal(resolvePremiumScannerPipeline({
    permissionGranted: true,
    cameraReady: true,
    cameraActive: true,
    captureState: 'captured',
    recognitionStage: 'finding_card',
    selectedCandidate: null,
    hasError: false,
    awaitingCardRemoval: false,
    justAdded: false,
  }), 'searching');
});

test('guide presentation uses text in addition to color for accessibility', () => {
  const guide = guidePresentationForPipeline('confirmation_required', null);
  assert.equal(guide.message, 'Review printing');
  assert.equal(guide.tone, 'amber');
  assert.equal(guide.statusLabel, 'Review');
});

test('compact scanner money avoids long unavailable copy in constrained HUD cells', () => {
  assert.equal(compactScannerMoney(null), '—');
  assert.equal(compactScannerMoney(12.5), '$12.50');
});

test('Scanner 2.0 HUD is one compact line without unavailable pricing copy', () => {
  const line = scanner2HudLine({ modeLabel: 'Card Show', cardCount: 12, offerTotal: null, reviewCount: 2 });
  assert.equal(line, 'Card Show - 12 cards - Offer — - 2 review');
  assert.equal(line.includes('Pricing unavailable'), false);
});

test('Scanner 2.0 camera opens into camera states without an open-camera state', () => {
  assert.equal(resolveScanner2InteractionState({
    loading: false,
    permission: 'granted',
    cameraActive: true,
    cameraReady: true,
    captureState: 'ready',
    recognitionStage: 'idle',
    trayKind: null,
    awaitingCardRemoval: false,
    justAdded: false,
    offline: false,
    hasCameraError: false,
  }), 'card_absent');
});

test('Scanner 2.0 state model covers recognized likely ambiguous failure and removal', () => {
  const base = {
    loading: false,
    permission: 'granted' as const,
    cameraActive: true,
    cameraReady: true,
    captureState: 'ready',
    recognitionStage: 'idle' as const,
    awaitingCardRemoval: false,
    justAdded: false,
    offline: false,
    hasCameraError: false,
  };
  assert.equal(resolveScanner2InteractionState({ ...base, trayKind: 'recognized' }), 'recognized');
  assert.equal(resolveScanner2InteractionState({ ...base, trayKind: 'likely' }), 'likely');
  assert.equal(resolveScanner2InteractionState({ ...base, trayKind: 'ambiguous' }), 'ambiguous');
  assert.equal(resolveScanner2InteractionState({ ...base, trayKind: null, recognitionStage: 'failed' }), 'failed');
  assert.equal(resolveScanner2InteractionState({ ...base, trayKind: null, awaitingCardRemoval: true }), 'remove_card');
});

test('Scanner 2.0 camera remains the dominant region on target iPhone widths', () => {
  for (const width of [320, 375, 390, 430]) {
    const cameraHeight = scanner2CameraHeight({ width, height: 844, safeTop: 47, safeBottom: 34, hasResult: false });
    assert.ok(cameraHeight >= 520);
  }
});

test('Scanner 2.0 reduced-motion behavior suppresses decorative pulse and flash', () => {
  assert.deepEqual(scanner2MotionForState('recognized', true), { pulse: false, flash: false, progress: false });
  assert.deepEqual(scanner2MotionForState('capturing', true), { pulse: false, flash: false, progress: false });
  assert.equal(scanner2MotionForState('searching', false).progress, true);
});

test('top HUD uses two safe rows on narrow iPhone widths', () => {
  for (const width of [320, 375, 390, 430]) {
    const layout = scannerHudRowsForWidth(width);
    assert.equal(layout.rows, 2);
    assert.equal(layout.overflows, false);
    assert.deepEqual(layout.topRowItems, ['mode', 'review']);
  }
});

test('failed tray keeps usable text width and excludes pricing and quantity', () => {
  const layout = scannerTrayLayoutForWidth({ width: 320, kind: 'failed' });
  assert.equal(layout.usesThumbnail, false);
  assert.equal(layout.includesPricing, false);
  assert.equal(layout.includesQuantity, false);
  assert.ok(layout.textMinWidth >= 180);
});

test('recognized and ambiguous trays keep responsive narrow-width actions', () => {
  const recognized = scannerTrayLayoutForWidth({ width: 375, kind: 'recognized' });
  const ambiguous = scannerTrayLayoutForWidth({ width: 320, kind: 'ambiguous' });
  assert.equal(recognized.usesThumbnail, true);
  assert.equal(recognized.includesPricing, true);
  assert.equal(ambiguous.actionWrap, true);
});

test('vertical scanner layout keeps camera, tray, session bar, and bottom nav separated', () => {
  const cameraHeight = scannerCameraHeightForWidth(390);
  const layout = scannerVerticalLayoutModel({
    viewportHeight: 844,
    safeTop: 47,
    safeBottom: 34,
    cameraHeight,
    resultTrayHeight: 180,
    sessionBarHeight: 74,
    bottomNavHeight: 72,
  });
  assert.equal(layout.cameraOverlapsResult, false);
  assert.equal(layout.sessionBarClearsNav, true);
});

test('only one dominant failure surface renders when result tray exists', () => {
  assert.equal(dominantScannerSurface({
    hasResultTray: true,
    isReading: false,
    isSearching: false,
    hasCameraPrompt: true,
  }), 'result_tray');
});

test('high-volume card-show mode defaults do not auto-add inventory by default', () => {
  const defaults = highVolumeCardShowDefaults({ cashOfferRate: 65 });
  assert.equal(defaults.highVolume, true);
  assert.equal(defaults.cashOfferRate, 65);
  assert.equal(defaults.autoAddHighConfidence, false);
});
