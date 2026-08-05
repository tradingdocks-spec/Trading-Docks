import assert from 'node:assert/strict';
import test from 'node:test';

import type { ScannerCardCandidate } from '../services/scanner-foundation.ts';
import {
  buildPremiumResultTray,
  guidePresentationForPipeline,
  highVolumeCardShowDefaults,
  resolvePremiumScannerPipeline,
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
  assert.equal(tray?.title, 'No reliable match');
  assert.deepEqual(tray?.secondaryActions, ['Manual Search']);
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

test('high-volume card-show mode defaults do not auto-add inventory by default', () => {
  const defaults = highVolumeCardShowDefaults({ cashOfferRate: 65 });
  assert.equal(defaults.highVolume, true);
  assert.equal(defaults.cashOfferRate, 65);
  assert.equal(defaults.autoAddHighConfidence, false);
});
