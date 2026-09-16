import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AUTOMATIC_SNAPSHOT_FALLBACK_DEADLINE_MS,
  AUTOMATIC_SNAPSHOT_FALLBACK_COOLDOWN_MS,
  resolveScannerLiveFallbackDecision,
} from '../services/scanner-live-fallback.ts';

test('automatic fallback triggers after the deadline when no credible candidate exists', () => {
  const decision = resolveScannerLiveFallbackDecision({
    cardPresent: true,
    hasCredibleCandidate: false,
    fallbackInFlight: false,
    liveOcrInFlight: false,
    cardPresentSinceAt: 1_000,
    lastFallbackAt: null,
    now: 1_000 + AUTOMATIC_SNAPSHOT_FALLBACK_DEADLINE_MS,
  });

  assert.equal(decision.shouldTrigger, true);
  assert.equal(decision.deadlineStartedAt, 1_000);
  assert.equal(decision.readyAt, 1_000 + AUTOMATIC_SNAPSHOT_FALLBACK_DEADLINE_MS);
});

test('automatic fallback stays quiet for credible candidates and while cooling down', () => {
  const candidateDecision = resolveScannerLiveFallbackDecision({
    cardPresent: true,
    hasCredibleCandidate: true,
    fallbackInFlight: false,
    liveOcrInFlight: false,
    cardPresentSinceAt: 1_000,
    lastFallbackAt: null,
    now: 1_000 + AUTOMATIC_SNAPSHOT_FALLBACK_DEADLINE_MS,
  });

  const cooldownDecision = resolveScannerLiveFallbackDecision({
    cardPresent: true,
    hasCredibleCandidate: false,
    fallbackInFlight: false,
    liveOcrInFlight: false,
    cardPresentSinceAt: 1_000,
    lastFallbackAt: 1_000 + AUTOMATIC_SNAPSHOT_FALLBACK_DEADLINE_MS - 1,
    now: 1_000 + AUTOMATIC_SNAPSHOT_FALLBACK_DEADLINE_MS,
  });

  assert.equal(candidateDecision.shouldTrigger, false);
  assert.equal(cooldownDecision.shouldTrigger, false);
  assert.equal(resolveScannerLiveFallbackDecision({
    cardPresent: false,
    hasCredibleCandidate: false,
    fallbackInFlight: false,
    liveOcrInFlight: false,
    cardPresentSinceAt: null,
    lastFallbackAt: null,
    now: 10_000,
  }).shouldTrigger, false);
  assert.equal(AUTOMATIC_SNAPSHOT_FALLBACK_COOLDOWN_MS > 0, true);
});
