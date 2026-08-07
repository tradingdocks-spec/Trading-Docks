import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createScannerCaptureDiagnostic,
  resolveScannerAutoCapturePolicy,
  resolveScannerManualCapturePolicy,
} from '../services/scanner-capture-policy.ts';
import type { SingleScanCaptureQuality } from '../services/single-scan-capture-quality.ts';

const poorQuality: SingleScanCaptureQuality = {
  canCapture: false,
  guidance: 'Move closer',
  reason: 'too_small',
  fillRatio: 0.42,
  blurScore: 0.2,
  motionScore: 0.1,
  stableDurationMs: 80,
  vision: null,
};

test('manual capture is allowed when quality is not ready', () => {
  const policy = resolveScannerManualCapturePolicy({
    cameraInitialized: true,
    permissionGranted: true,
    appForegrounded: true,
    processing: false,
  });
  const diagnostic = createScannerCaptureDiagnostic({ trigger: 'manual', quality: poorQuality });

  assert.equal(policy.canCapture, true);
  assert.equal(policy.blockedReason, null);
  assert.equal(diagnostic.forced, true);
  assert.equal(diagnostic.qualityReason, 'too_small');
  assert.equal(diagnostic.fillRatio, 0.42);
});

test('manual capture is blocked only by camera lifecycle and processing state', () => {
  assert.equal(resolveScannerManualCapturePolicy({
    cameraInitialized: false,
    permissionGranted: true,
    appForegrounded: true,
    processing: false,
  }).blockedReason, 'camera_unavailable');
  assert.equal(resolveScannerManualCapturePolicy({
    cameraInitialized: true,
    permissionGranted: false,
    appForegrounded: true,
    processing: false,
  }).blockedReason, 'permission_denied');
  assert.equal(resolveScannerManualCapturePolicy({
    cameraInitialized: true,
    permissionGranted: true,
    appForegrounded: false,
    processing: false,
  }).blockedReason, 'app_backgrounded');
  assert.equal(resolveScannerManualCapturePolicy({
    cameraInitialized: true,
    permissionGranted: true,
    appForegrounded: true,
    processing: true,
  }).blockedReason, 'processing');
});

test('auto capture remains quality gated', () => {
  assert.equal(resolveScannerAutoCapturePolicy({
    cameraInitialized: true,
    permissionGranted: true,
    appForegrounded: true,
    processing: false,
    qualityReady: false,
  }).canCapture, false);
  assert.equal(resolveScannerAutoCapturePolicy({
    cameraInitialized: true,
    permissionGranted: true,
    appForegrounded: true,
    processing: false,
    qualityReady: true,
  }).canCapture, true);
});
