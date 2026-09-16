import assert from 'node:assert/strict';
import test from 'node:test';

import { createScannerLiveInferenceState, updateScannerLiveInference, type ScannerLiveInferenceSample } from '../services/scanner-live-inference.ts';

test('stale live inference samples cannot override a newer card', () => {
  const base = createScannerLiveInferenceState();
  const first = updateScannerLiveInference(base, sample({
    frameId: 'frame-a',
    observedAt: 1000,
    candidateName: 'Slay',
    confidenceBand: 'medium',
    matchScore: 58,
    visualSimilarity: 0.42,
    rawOcrText: 'Sla',
    normalizedOcrText: 'Sla',
    route: 'continue_reading',
    outcomeStatus: 'retry',
  }));
  const stale = updateScannerLiveInference(first, sample({
    frameId: 'frame-b',
    observedAt: 990,
    candidateName: 'Lightning Bolt',
    confidenceBand: 'high',
    matchScore: 92,
    visualSimilarity: 0.91,
    rawOcrText: 'Lightning Bolt',
    normalizedOcrText: 'Lightning Bolt',
    route: 'append_identity',
    outcomeStatus: 'added',
  }));

  assert.equal(stale.candidateName, first.candidateName);
  assert.equal(stale.latestFrameId, first.latestFrameId);
});

test('repeated candidate consensus raises a likely live inference state', () => {
  let state = createScannerLiveInferenceState();
  state = updateScannerLiveInference(state, sample({
    frameId: 'frame-1',
    observedAt: 1000,
    fingerprint: 'fp-slay',
    candidateName: 'Slay',
    confidenceBand: 'medium',
    matchScore: 62,
    visualSimilarity: 0.47,
    rawOcrText: 'Slay',
    normalizedOcrText: 'Slay',
    route: 'continue_reading',
    outcomeStatus: 'retry',
  }));
  state = updateScannerLiveInference(state, sample({
    frameId: 'frame-2',
    observedAt: 1120,
    fingerprint: 'fp-slay',
    candidateName: 'Slay',
    confidenceBand: 'high',
    matchScore: 84,
    visualSimilarity: 0.76,
    rawOcrText: 'Slay',
    normalizedOcrText: 'Slay',
    route: 'review',
    outcomeStatus: 'retry',
  }));
  state = updateScannerLiveInference(state, sample({
    frameId: 'frame-3',
    observedAt: 1240,
    fingerprint: 'fp-slay',
    candidateName: 'Slay',
    confidenceBand: 'high',
    matchScore: 88,
    visualSimilarity: 0.84,
    rawOcrText: 'Slay',
    normalizedOcrText: 'Slay',
    route: 'review',
    outcomeStatus: 'retry',
  }));

  assert.equal(state.stage, 'likely');
  assert.equal(state.headline, 'Slay');
  assert.equal(state.subtitle, 'Matching printing...');
  assert.equal(state.consensusCount, 3);
});

test('exact printing samples refine the live inference banner', () => {
  const state = updateScannerLiveInference(createScannerLiveInferenceState(), sample({
    frameId: 'frame-exact',
    observedAt: 1400,
    fingerprint: 'fp-bolt',
    candidateName: 'Lightning Bolt',
    exactPrintingId: 'sf-bolt-10e',
    exactPrintingLabel: '10E \u2022 146',
    confidenceBand: 'high',
    matchScore: 94,
    visualSimilarity: 0.95,
    rawOcrText: 'Lightning Bolt',
    normalizedOcrText: 'Lightning Bolt',
    route: 'append_identity',
    outcomeStatus: 'added',
  }));

  assert.equal(state.stage, 'exact');
  assert.equal(state.headline, '\u2713 Lightning Bolt');
  assert.equal(state.subtitle, 'Verified \u2022 10E \u2022 146');
});

test('unnamed visual noise does not outrank a named OCR candidate', () => {
  let state = createScannerLiveInferenceState();
  state = updateScannerLiveInference(state, sample({
    frameId: 'frame-ocr',
    observedAt: 1000,
    fingerprint: 'fp-ocr',
    candidateName: 'Goblin Electromancer',
    confidenceBand: 'medium',
    matchScore: 78,
    visualSimilarity: 0.38,
    rawOcrText: 'Goblin Electromancer',
    normalizedOcrText: 'Goblin Electromancer',
    route: 'continue_reading',
    outcomeStatus: 'retry',
  }));
  state = updateScannerLiveInference(state, sample({
    frameId: 'frame-visual-noise',
    observedAt: 1120,
    fingerprint: 'fp-ocr',
    candidateName: null,
    confidenceBand: 'high',
    matchScore: null,
    visualSimilarity: 0.98,
    rawOcrText: null,
    normalizedOcrText: null,
    route: 'continue_reading',
    outcomeStatus: 'retry',
  }));

  assert.equal(state.candidateName, 'Goblin Electromancer');
  assert.equal(state.headline, 'Goblin Electromancer');
  assert.equal(state.subtitle, 'Matching printing...');
});

test('weak ambiguous evidence stays in Reading with keep-scanning copy', () => {
  const state = updateScannerLiveInference(createScannerLiveInferenceState(), sample({
    frameId: 'frame-reading',
    observedAt: 1000,
    fingerprint: 'fp-reading',
    candidateName: null,
    confidenceBand: 'low',
    matchScore: null,
    visualSimilarity: 0.31,
    rawOcrText: 'Sla',
    normalizedOcrText: 'Sla',
    route: 'continue_reading',
    outcomeStatus: 'retry',
  }));

  assert.equal(state.stage, 'reading');
  assert.equal(state.headline, 'Reading...');
  assert.equal(state.subtitle, 'Keep scanning');
});

test('warming recognition shows Preparing recognition instead of Looking', () => {
  const state = updateScannerLiveInference(createScannerLiveInferenceState(), sample({
    frameId: 'frame-warmup',
    observedAt: 1000,
    fingerprint: 'fp-warmup',
    recognitionReady: false,
    candidateName: null,
    confidenceBand: 'low',
    matchScore: null,
    visualSimilarity: 0.12,
    rawOcrText: 'Raff Sec',
    normalizedOcrText: 'Raff Sec',
    route: 'continue_reading',
    outcomeStatus: 'retry',
  }));

  assert.equal(state.stage, 'reading');
  assert.equal(state.headline, 'Preparing recognition...');
  assert.equal(state.subtitle, 'Keep scanning');
});

function sample(overrides: {
  frameId: string;
  observedAt: number;
  fingerprint?: string;
  recognitionReady?: boolean;
  candidateName: string | null;
  exactPrintingId?: string | null;
  exactPrintingLabel?: string | null;
  confidenceBand: 'high' | 'medium' | 'low' | null;
  matchScore: number | null;
  visualSimilarity: number | null;
  rawOcrText: string | null;
  normalizedOcrText: string | null;
  route: string | null;
  outcomeStatus: ScannerLiveInferenceSample['outcomeStatus'];
}): ScannerLiveInferenceSample {
  return {
    frameId: overrides.frameId,
    observedAt: overrides.observedAt,
    fingerprint: overrides.fingerprint ?? `fp-${overrides.frameId}`,
    recognitionReady: overrides.recognitionReady ?? true,
    candidateName: overrides.candidateName,
    exactPrintingId: overrides.exactPrintingId ?? null,
    exactPrintingLabel: overrides.exactPrintingLabel ?? null,
    confidenceBand: overrides.confidenceBand,
    matchScore: overrides.matchScore,
    visualSimilarity: overrides.visualSimilarity,
    rawOcrText: overrides.rawOcrText,
    normalizedOcrText: overrides.normalizedOcrText,
    route: overrides.route,
    failureStage: null,
    outcomeStatus: overrides.outcomeStatus,
  };
}
