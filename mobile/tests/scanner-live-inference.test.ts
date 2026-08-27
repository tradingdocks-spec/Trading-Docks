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
  assert.equal(state.headline, 'Likely: Slay');
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
  assert.equal(state.subtitle, 'Exact printing \u2022 10E \u2022 146');
});

function sample(overrides: {
  frameId: string;
  observedAt: number;
  fingerprint?: string;
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
