import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateCardGuideLayout, DEFAULT_CONTINUOUS_SCANNER_THRESHOLDS, type ScannerGuideLayout } from '../services/continuous-offer-scanner.ts';
import type { LiveFrameAnalysisResult } from '../services/live-card-recognition.ts';
import {
  NO_NATIVE_VISUAL_SIGNALS,
  applyScannerCalibrationToGuide,
  buildGuideCropMapping,
  canAutoCaptureNative,
  captureOutcomeForRecognition,
  diagnosticsFromFrameAnalysis,
  isScannerDiagnosticsEnabled,
  nativeScannerCalibrationKey,
  normalizeScannerCalibrationPreferences,
  shouldRearmAfterCardRemoval,
  summarizeFoilDiagnostics,
} from '../services/native-scanner-calibration.ts';

const baseGuide = calculateCardGuideLayout({ containerWidth: 390, containerHeight: 440, safeTop: 48, reservedVerticalSpace: 120 });

test('diagnostics are hidden unless the explicit dev flag is enabled', () => {
  assert.equal(isScannerDiagnosticsEnabled({ NODE_ENV: 'production', EXPO_PUBLIC_ENABLE_SCANNER_DIAGNOSTICS: 'true' }), false);
  assert.equal(isScannerDiagnosticsEnabled({ NODE_ENV: 'development', EXPO_PUBLIC_ENABLE_SCANNER_DIAGNOSTICS: 'false' }), false);
  assert.equal(isScannerDiagnosticsEnabled({ NODE_ENV: 'development', EXPO_PUBLIC_ENABLE_SCANNER_DIAGNOSTICS: 'true' }), true);
});

test('calibration preferences are clamped and user-scoped', () => {
  const normalized = normalizeScannerCalibrationPreferences({ guideScale: 2, verticalOffset: -999, tolerance: 1 });
  assert.equal(normalized.guideScale, 1.08);
  assert.equal(normalized.verticalOffset, -72);
  assert.equal(normalized.tolerance, 0.18);
  assert.equal(nativeScannerCalibrationKey('user-a'), 'td:native-scanner-calibration:v1:user-a');
});

test('calibrated guide preserves the 63 by 88 ratio and centered crop mapping', () => {
  const guide = applyScannerCalibrationToGuide(baseGuide, 390, { guideScale: 1.04, verticalOffset: 20, tolerance: 0.12 });
  const mapping = buildGuideCropMapping({ width: 390, height: 440 }, guide);
  assert.ok(Math.abs(mapping.guideAspectRatio - baseGuide.ratio) < 0.004);
  assert.ok(mapping.normalizedCrop.x > 0);
  assert.ok(mapping.normalizedCrop.width < 1);
  assert.ok(mapping.normalizedCrop.height < 1);
});

test('unavailable observation signals never pass auto-capture readiness', () => {
  const decision = canAutoCaptureNative({
    cameraReady: true,
    signalAvailability: NO_NATIVE_VISUAL_SIGNALS,
    analysis: readyAnalysis(baseGuide),
  });
  assert.equal(decision.ok, false);
  assert.match(decision.reason, /signals_unavailable/);
});

test('auto-capture is blocked before camera ready even with good analysis', () => {
  const decision = canAutoCaptureNative({
    cameraReady: false,
    signalAvailability: allSignalsAvailable(),
    analysis: readyAnalysis(baseGuide),
  });
  assert.deepEqual(decision, { ok: false, reason: 'camera_not_ready' });
});

test('ready native analysis passes only when required physical signals are available', () => {
  const decision = canAutoCaptureNative({
    cameraReady: true,
    signalAvailability: allSignalsAvailable(),
    analysis: readyAnalysis(baseGuide),
  });
  assert.deepEqual(decision, { ok: true, reason: 'ready' });
});

test('capture outcome always exposes an honest visible status', () => {
  assert.equal(captureOutcomeForRecognition({ captured: false, providerAvailable: false, appendedToSession: false }).status, 'capture_failed');
  const unavailable = captureOutcomeForRecognition({ captured: true, providerAvailable: false, appendedToSession: true });
  assert.equal(unavailable.status, 'identification_unavailable');
  assert.match(unavailable.message, /manual search/);
  assert.equal(captureOutcomeForRecognition({ captured: true, providerAvailable: true, confidenceState: 'likely', appendedToSession: true }).status, 'likely');
});

test('diagnostics snapshot preserves capture, duplicate, recognition, and session states', () => {
  const snapshot = diagnosticsFromFrameAnalysis({
    cameraReady: true,
    previewDimensions: { width: 390, height: 440 },
    guideDimensions: baseGuide,
    analysis: readyAnalysis(baseGuide),
    captureState: 'captured',
    duplicateFingerprintStatus: 'awaiting_removal',
    recognitionStage: 'provider_unavailable',
    recognitionLatencyMs: 18,
    sessionInsertionResult: 'inserted',
    signalAvailability: allSignalsAvailable(),
  });
  assert.equal(snapshot.cardCornersVisible, 4);
  assert.equal(snapshot.fillPercentage, 72);
  assert.equal(snapshot.captureState, 'captured');
  assert.equal(snapshot.duplicateFingerprintStatus, 'awaiting_removal');
  assert.equal(snapshot.sessionInsertionResult, 'inserted');
});

test('stationary duplicate requires removal before rearm unless tester override is explicit', () => {
  assert.equal(shouldRearmAfterCardRemoval({ awaitingCardRemoval: true, guideFillRatio: 0.6, removalThreshold: 0.2 }), false);
  assert.equal(shouldRearmAfterCardRemoval({ awaitingCardRemoval: true, guideFillRatio: 0.1, removalThreshold: 0.2 }), true);
  assert.equal(shouldRearmAfterCardRemoval({ awaitingCardRemoval: true, guideFillRatio: 0.6, removalThreshold: 0.2, override: true }), true);
});

test('foil diagnostics never claim classification without benchmarked evidence', () => {
  const empty = summarizeFoilDiagnostics([]);
  assert.equal(empty.status, 'indeterminate');
  assert.equal(empty.frameCount, 0);
  const summary = summarizeFoilDiagnostics([
    { capturedAt: 1, highlightScore: 0.8, motionScore: 0.1 },
    { capturedAt: 2, highlightScore: 0.4, motionScore: 0.2 },
  ]);
  assert.equal(summary.status, 'indeterminate');
  assert.equal(summary.frameCount, 2);
  assert.ok(summary.evidence.some((line) => line.includes('not claimed')));
});

function readyAnalysis(guide: ScannerGuideLayout): LiveFrameAnalysisResult {
  return {
    frameId: 'frame-1',
    guidance: 'Ready',
    readyForAutoCapture: true,
    aspectRatio: guide.ratio,
    aspectRatioOk: true,
    crop: {
      frameId: 'frame-1',
      bounds: { x: guide.left, y: guide.top, width: guide.width, height: guide.height },
      corners: [
        { x: guide.left, y: guide.top, visible: true },
        { x: guide.left + guide.width, y: guide.top, visible: true },
        { x: guide.left, y: guide.top + guide.height, visible: true },
        { x: guide.left + guide.width, y: guide.top + guide.height, visible: true },
      ],
      orientation: 'portrait',
      perspectiveCorrected: false,
      fingerprint: 'fingerprint-1',
    },
    observation: {
      corners: [
        { x: guide.left, y: guide.top, visible: true },
        { x: guide.left + guide.width, y: guide.top, visible: true },
        { x: guide.left, y: guide.top + guide.height, visible: true },
        { x: guide.left + guide.width, y: guide.top + guide.height, visible: true },
      ],
      fullyInsideGuide: true,
      guideFillRatio: 0.72,
      perspectiveScore: 0.01,
      motionScore: 0.02,
      blurScore: 0.1,
      glareScore: 0.1,
      lightingScore: 0.8,
      stabilityMs: DEFAULT_CONTINUOUS_SCANNER_THRESHOLDS.requiredStabilityMs,
      cardPresent: true,
      orientation: 'portrait',
      imageFingerprint: 'fingerprint-1',
      observedAt: 1,
    },
  };
}

function allSignalsAvailable() {
  return {
    boundary: true,
    corners: true,
    perspective: true,
    blur: true,
    motion: true,
    lighting: true,
    glare: true,
    ocr: false,
    artwork: false,
    finish: false,
  };
}
