import assert from 'node:assert/strict';
import test from 'node:test';

import {
  convertPreviewTapToCameraPoint,
  normalizeScannerCameraLensMode,
  resolveScannerCameraLensSelection,
  resolveScannerFocusRequest,
  resolveScannerTorchState,
  scannerFocusReticleDuration,
  shouldIgnoreFrameAfterLensSwitch,
  shouldWarnAboutTorchThrash,
  type ScannerCameraDeviceLike,
} from '../services/scanner-camera-controls.ts';

const standardDevice: ScannerCameraDeviceLike = {
  id: 'wide',
  localizedName: 'Back Wide Camera',
  position: 'back',
  type: 'wide-angle',
  minZoom: 1,
  maxZoom: 8,
  supportsFocusMetering: true,
  hasTorch: true,
};

const closeUpDevice: ScannerCameraDeviceLike = {
  id: 'ultra',
  localizedName: 'Back Ultra Wide Camera',
  position: 'back',
  type: 'ultra-wide-angle',
  minZoom: 0.5,
  maxZoom: 4,
  supportsFocusMetering: true,
  hasTorch: true,
};

const telephotoDevice: ScannerCameraDeviceLike = {
  id: 'tele',
  localizedName: 'Back Telephoto Camera',
  position: 'back',
  type: 'telephoto',
  minZoom: 2,
  maxZoom: 12,
  supportsFocusMetering: true,
  hasTorch: false,
};

test('tap focus accepts supported active preview requests', () => {
  assert.deepEqual(resolveScannerFocusRequest({
    active: true,
    appForegrounded: true,
    processing: false,
    supportsFocus: true,
  }), { allowed: true, reason: null });
});

test('tap focus ignores unsupported or busy states safely', () => {
  assert.equal(resolveScannerFocusRequest({ active: false, appForegrounded: true, processing: false, supportsFocus: true }).reason, 'inactive');
  assert.equal(resolveScannerFocusRequest({ active: true, appForegrounded: false, processing: false, supportsFocus: true }).reason, 'backgrounded');
  assert.equal(resolveScannerFocusRequest({ active: true, appForegrounded: true, processing: true, supportsFocus: true }).reason, 'processing');
  assert.equal(resolveScannerFocusRequest({ active: true, appForegrounded: true, processing: false, supportsFocus: false }).reason, 'unsupported');
});

test('tap focus converts cover-cropped preview coordinates', () => {
  const conversion = convertPreviewTapToCameraPoint({
    point: { x: 195, y: 422 },
    view: { width: 390, height: 844 },
    source: { width: 640, height: 480 },
    resizeMode: 'cover',
  });

  assert.equal(conversion.insidePreview, true);
  assert.deepEqual(conversion.viewPoint, { x: 195, y: 422 });
  assert.equal(conversion.normalizedPoint?.x.toFixed(3), '0.500');
  assert.equal(conversion.normalizedPoint?.y.toFixed(3), '0.500');
  assert.ok(conversion.renderedSource.offsetX < 0);
});

test('tap focus rejects points outside the actual preview crop', () => {
  const conversion = convertPreviewTapToCameraPoint({
    point: { x: 10, y: 10 },
    view: { width: 844, height: 390 },
    source: { width: 480, height: 640 },
    resizeMode: 'contain',
  });

  assert.equal(conversion.insidePreview, false);
  assert.equal(conversion.viewPoint, null);
});

test('tap focus mirrors normalized camera points when needed', () => {
  const conversion = convertPreviewTapToCameraPoint({
    point: { x: 100, y: 200 },
    view: { width: 400, height: 800 },
    source: { width: 400, height: 800 },
    mirrored: true,
  });

  assert.equal(conversion.normalizedPoint?.x.toFixed(2), '0.75');
});

test('reticle lifetime respects reduced motion', () => {
  assert.ok(scannerFocusReticleDuration(false) > scannerFocusReticleDuration(true));
});

test('lens selection exposes only supported rear lens modes', () => {
  const selection = resolveScannerCameraLensSelection([standardDevice, closeUpDevice, telephotoDevice], 'telephoto');
  const supportedModes = selection.options.filter((option) => option.supported).map((option) => option.mode);

  assert.deepEqual(supportedModes, ['auto', 'macro', 'standard', 'telephoto']);
  assert.equal(selection.selectedDevice?.id, 'tele');
  assert.equal(selection.selectedDeviceSummary?.hasTorch, false);
});

test('auto lens prefers focus and torch for scanning', () => {
  const selection = resolveScannerCameraLensSelection([telephotoDevice, standardDevice], 'auto');

  assert.equal(selection.selectedDevice?.id, 'wide');
});

test('unsupported lens preference falls back to auto', () => {
  const selection = resolveScannerCameraLensSelection([standardDevice], 'telephoto');

  assert.equal(selection.resolvedMode, 'auto');
  assert.equal(selection.selectedDevice?.id, 'wide');
  assert.deepEqual(selection.options.filter((option) => option.supported).map((option) => option.mode), ['auto', 'standard']);
});

test('lens preference normalization defaults safely', () => {
  assert.equal(normalizeScannerCameraLensMode('macro'), 'macro');
  assert.equal(normalizeScannerCameraLensMode('business'), 'auto');
});

test('lens switch cancels stale frame analysis until ready', () => {
  assert.equal(shouldIgnoreFrameAfterLensSwitch({ frameCapturedAt: 100, switchStartedAt: 200, cameraReady: false }), true);
  assert.equal(shouldIgnoreFrameAfterLensSwitch({ frameCapturedAt: 100, switchStartedAt: 200, cameraReady: true }), true);
  assert.equal(shouldIgnoreFrameAfterLensSwitch({ frameCapturedAt: 250, switchStartedAt: 200, cameraReady: true }), false);
});

test('torch remains independent from still-photo flash', () => {
  assert.deepEqual(resolveScannerTorchState({
    requested: true,
    active: true,
    appForegrounded: true,
    deviceHasTorch: true,
  }), {
    torchEnabled: true,
    torchSupported: true,
    torchActive: true,
    torchProp: 'on',
    photoFlashMode: 'off',
  });
});

test('torch shuts down in background or unsupported lenses', () => {
  assert.equal(resolveScannerTorchState({ requested: true, active: true, appForegrounded: false, deviceHasTorch: true }).torchProp, 'off');
  assert.equal(resolveScannerTorchState({ requested: true, active: true, appForegrounded: true, deviceHasTorch: false }).torchProp, 'off');
});

test('torch diagnostics warn on unexplained rapid transitions', () => {
  assert.equal(shouldWarnAboutTorchThrash([
    { at: 1000, state: 'on', reason: 'unknown' },
    { at: 900, state: 'off', reason: 'lifecycle' },
    { at: 800, state: 'on', reason: 'capture' },
  ], 1000), true);
});
