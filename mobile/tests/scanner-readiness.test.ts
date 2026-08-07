import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveAutomaticScannerReadiness,
  resolveSingleScanReadiness,
  scannerReadinessMessage,
  shouldEmitReadyHaptic,
} from '../services/scanner-readiness.ts';
import type { SingleScanCaptureQuality } from '../services/single-scan-capture-quality.ts';

function quality(patch: Partial<SingleScanCaptureQuality>): SingleScanCaptureQuality {
  return {
    canCapture: false,
    guidance: 'Place card',
    reason: 'no_card',
    fillRatio: null,
    blurScore: null,
    motionScore: null,
    stableDurationMs: null,
    vision: null,
    ...patch,
  };
}

test('scanner readiness returns exactly one user-facing instruction', () => {
  assert.equal(scannerReadinessMessage('no_card'), 'Place card in frame');
  assert.equal(scannerReadinessMessage('too_dark'), 'Too dark');
  assert.equal(scannerReadinessMessage('focus'), 'Tap card to focus');
  assert.equal(scannerReadinessMessage('motion'), 'Hold steady');
});

test('Single Scan uses green ready state without locking manual capture policy', () => {
  const readiness = resolveSingleScanReadiness({
    quality: quality({ canCapture: true, guidance: 'Ready', reason: 'ready', fillRatio: 0.8 }),
    stage: 'idle',
  });

  assert.equal(readiness.state, 'ready');
  assert.equal(readiness.tone, 'emerald');
  assert.equal(readiness.message, 'Ready');
});

test('Single Scan maps poor lighting focus and centering to amber guidance', () => {
  assert.deepEqual(resolveSingleScanReadiness({
    quality: quality({ reason: 'off_center', guidance: 'Center card' }),
    stage: 'idle',
  }), {
    state: 'needs_attention',
    reason: 'off_center',
    message: 'Center card',
    tone: 'amber',
    autoCaptureReady: false,
  });

  assert.equal(resolveSingleScanReadiness({
    quality: quality({ reason: 'too_blurry', guidance: 'Tap card to focus' }),
    stage: 'idle',
  }).message, 'Tap card to focus');
});

test('Automatic Scan ignores unavailable optional glare and lighting signals', () => {
  const readiness = resolveAutomaticScannerReadiness({
    cameraReady: true,
    processing: false,
    cardPresent: true,
    fillRatio: 0.62,
    centerOffset: 0.08,
    blurScore: 0.72,
    motionScore: 0.12,
    lightingScore: null,
    glareScore: null,
    stableDurationMs: 620,
  });

  assert.equal(readiness.autoCaptureReady, true);
  assert.equal(readiness.message, 'Ready');
  assert.deepEqual(readiness.reasons, []);
});

test('Automatic Scan prioritizes one readiness reason for users', () => {
  const readiness = resolveAutomaticScannerReadiness({
    cameraReady: true,
    processing: false,
    cardPresent: true,
    fillRatio: 0.24,
    centerOffset: 0.5,
    blurScore: 0.1,
    motionScore: 0.9,
    lightingScore: 0.05,
    glareScore: 0.95,
    stableDurationMs: 0,
  });

  assert.equal(readiness.autoCaptureReady, false);
  assert.equal(readiness.reason, 'too_small');
  assert.equal(readiness.message, 'Move closer');
  assert.equal(readiness.reasons.length, 1);
});

test('Ready haptic fires once on transition into Ready', () => {
  assert.equal(shouldEmitReadyHaptic(null, 'ready'), true);
  assert.equal(shouldEmitReadyHaptic('needs_attention', 'ready'), true);
  assert.equal(shouldEmitReadyHaptic('ready', 'ready'), false);
  assert.equal(shouldEmitReadyHaptic('ready', 'processing'), false);
});
