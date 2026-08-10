import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SCANNER_CAMERA_LENS_LABELS,
  appendScannerCameraEvent,
  buildScannerCameraQualityProfile,
  createScannerCameraSwitchPlan,
  convertPreviewTapToCameraPoint,
  isApprovedTorchTransitionReason,
  normalizeScannerCameraLensMode,
  normalizeScannerCameraSelectionMode,
  resolveAutoCaptureReadiness,
  resolveScannerCameraLensSelection,
  resolveScannerFocusRequest,
  resolveScannerTorchState,
  scannerFocusReticleDuration,
  shouldIgnoreFrameAfterLensSwitch,
  shouldWarnAboutTorchThrash,
  type ScannerCameraDeviceLike,
  type ScannerCameraRuntimeEvent,
} from '../services/scanner-camera-controls.ts';

const standardDevice: ScannerCameraDeviceLike = {
  id: 'wide',
  localizedName: 'Back Wide Camera',
  position: 'back',
  type: 'wide-angle',
  minZoom: 1,
  neutralZoom: 1,
  maxZoom: 8,
  supportsFocusMetering: true,
  hasTorch: true,
  supportedFPSRanges: [{ min: 24, max: 60 }],
  getSupportedResolutions: (stream) => stream === 'photo'
    ? [{ width: 4032, height: 3024 }, { width: 1920, height: 1080 }]
    : [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }],
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

  assert.deepEqual(supportedModes, ['auto', 'close', 'standard', 'telephoto']);
  assert.equal(selection.selectedDevice?.id, 'tele');
  assert.equal(selection.selectedDeviceSummary?.hasTorch, false);
  assert.equal(selection.options.find((option) => option.mode === 'telephoto')?.deviceId, 'tele');
  assert.match(selection.options.find((option) => option.mode === 'telephoto')?.mappingReason ?? '', /real telephoto/);
});

test('lens controls use named modes instead of fake digital zoom labels', () => {
  const labels = Object.values(SCANNER_CAMERA_LENS_LABELS).map((label) => label.shortLabel);

  assert.deepEqual(labels, ['Auto', 'Close', 'Std', 'Tele']);
  assert.doesNotMatch(labels.join(' '), /0\.5x|2x|5x/);
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
  assert.equal(selection.options.find((option) => option.mode === 'telephoto')?.supported, false);
  assert.match(selection.options.find((option) => option.mode === 'telephoto')?.mappingReason ?? '', /unavailable/);
});

test('lens preference normalization defaults safely', () => {
  assert.equal(normalizeScannerCameraLensMode('macro'), 'close');
  assert.equal(normalizeScannerCameraLensMode('close'), 'close');
  assert.equal(normalizeScannerCameraLensMode('business'), 'auto');
  assert.equal(normalizeScannerCameraSelectionMode('raw'), 'raw');
});

test('camera diagnostics enumerate rear devices and quality profile', () => {
  const selection = resolveScannerCameraLensSelection([standardDevice, closeUpDevice, telephotoDevice], 'auto');

  assert.equal(selection.rearDevices.length, 3);
  assert.equal(selection.selectedDeviceSummary?.id, 'wide');
  assert.equal(selection.selectedDeviceSummary?.formatsCount, null);
  assert.deepEqual(selection.selectedDeviceSummary?.maxPhotoResolution, { width: 4032, height: 3024 });
  assert.deepEqual(selection.selectedDeviceSummary?.fpsRanges, [{ min: 24, max: 60 }]);
  assert.equal(selection.qualityProfile?.targetFps, 30);
  assert.equal(selection.qualityProfile?.defaultZoom, 1);
  assert.match(selection.qualityProfile?.selectedFormatLabel ?? '', /quality-first 30fps/);
  assert.ok(selection.options.every((option) => option.mappingReason.length > 0));
});

test('close-up lens prefers short focus distance over only lens type', () => {
  const closeFocusDevice: ScannerCameraDeviceLike = {
    ...standardDevice,
    id: 'macro-wide',
    minFocusDistance: 1.5,
  };
  const distantUltraWide: ScannerCameraDeviceLike = {
    ...closeUpDevice,
    id: 'distant-ultra',
    minFocusDistance: 9,
  };

  const selection = resolveScannerCameraLensSelection([distantUltraWide, closeFocusDevice], 'close');

  assert.equal(selection.selectedDevice?.id, 'macro-wide');
});

test('duplicate lens mappings are hidden from normal controls', () => {
  const virtualMultiCamera: ScannerCameraDeviceLike = {
    ...standardDevice,
    id: 'virtual-back',
    localizedName: 'Back Dual Wide Camera',
    isVirtualDevice: true,
    physicalDevices: [
      { ...closeUpDevice, id: 'physical-ultra', position: 'back' },
      { ...standardDevice, id: 'physical-wide', position: 'back' },
    ],
  };
  const selection = resolveScannerCameraLensSelection([virtualMultiCamera], 'standard');
  const supportedModes = selection.options.filter((option) => option.supported).map((option) => option.mode);

  assert.deepEqual(supportedModes, ['auto', 'close']);
  assert.equal(selection.resolvedMode, 'auto');
  assert.match(selection.options.find((option) => option.mode === 'standard')?.mappingReason ?? '', /same physical camera/);
});

test('raw camera selection is development-only selectable by id', () => {
  const selection = resolveScannerCameraLensSelection([standardDevice, closeUpDevice], 'raw', 'ultra');

  assert.equal(selection.requestedMode, 'raw');
  assert.equal(selection.resolvedMode, 'raw');
  assert.equal(selection.selectedDevice?.id, 'ultra');
});

test('quality profile uses neutral zoom and stable VisionCamera constraints', () => {
  const profile = buildScannerCameraQualityProfile(standardDevice, 'standard');

  assert.equal(profile.targetFps, 30);
  assert.deepEqual(profile.photoResolution, { width: 4032, height: 3024 });
  assert.deepEqual(profile.frameResolution, { width: 768, height: 576 });
  assert.equal(profile.constraints.binned, false);
  assert.equal(profile.constraints.photoBias, true);
  assert.equal(profile.constraints.frameBias, true);
  assert.equal(profile.defaultZoom, 1);
});

test('mode-specific quality profiles change frame targets without fake zoom switching', () => {
  const closeProfile = buildScannerCameraQualityProfile(closeUpDevice, 'close');
  const teleProfile = buildScannerCameraQualityProfile(telephotoDevice, 'telephoto');

  assert.match(closeProfile.selectedFormatLabel, /^close quality-first/);
  assert.match(teleProfile.selectedFormatLabel, /^telephoto quality-first/);
  assert.deepEqual(closeProfile.frameResolution, { width: 768, height: 576 });
  assert.deepEqual(teleProfile.frameResolution, { width: 640, height: 480 });
  assert.equal(closeProfile.defaultZoom, 0.5);
  assert.equal(teleProfile.defaultZoom, 2);
});

test('camera switch plan blocks capture while preserving session state', () => {
  const previous = resolveScannerCameraLensSelection([standardDevice, closeUpDevice], 'standard');
  const next = resolveScannerCameraLensSelection([standardDevice, closeUpDevice], 'close');
  const plan = createScannerCameraSwitchPlan({ previous, next, torchRequested: true });

  assert.equal(plan.deviceChanged, true);
  assert.equal(plan.blockAutoCapture, true);
  assert.equal(plan.resetStabilityTimer, true);
  assert.equal(plan.preserveSession, true);
  assert.equal(plan.preserveTorch, true);
});

test('auto-capture readiness blocks while camera mode is switching', () => {
  const readiness = resolveAutoCaptureReadiness({
    frameCount: 8,
    firstFrameAt: 1000,
    latestFrameAt: 1800,
    cardPresence: true,
    cornersVisible: 4,
    guideFill: 0.58,
    aspectRatio: 0.716,
    centerOffset: 0.08,
    blur: 0.64,
    motion: 0.12,
    lighting: 0.8,
    glare: 0.1,
    stableDurationMs: 620,
    removalState: 'clear',
    processing: false,
    duplicateBlocked: false,
    cameraReady: true,
    cameraSwitching: true,
  });

  assert.equal(readiness.ready, false);
  assert.equal(readiness.primaryReason, 'camera_unavailable');
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

test('torch transition classification accepts expected lifecycle reasons only', () => {
  assert.equal(isApprovedTorchTransitionReason('user'), true);
  assert.equal(isApprovedTorchTransitionReason('capture'), false);
  assert.equal(isApprovedTorchTransitionReason('device_change'), true);
  assert.equal(isApprovedTorchTransitionReason('unknown'), false);
});

test('camera event log keeps latest entries first and bounded', () => {
  let events: ScannerCameraRuntimeEvent[] = [];
  for (let index = 0; index < 18; index += 1) {
    events = appendScannerCameraEvent(events, {
      at: index,
      type: 'device_change',
      oldValue: String(index),
      newValue: String(index + 1),
      reason: 'device_change',
    }, 16);
  }

  assert.equal(events.length, 16);
  assert.equal(events[0].at, 17);
  assert.equal(events[15].at, 2);
});

test('auto-capture readiness lists exact rejection reasons', () => {
  const readiness = resolveAutoCaptureReadiness({
    frameCount: 4,
    firstFrameAt: 1000,
    latestFrameAt: 1600,
    cardPresence: true,
    cornersVisible: 4,
    guideFill: 0.42,
    aspectRatio: 0.716,
    centerOffset: 0.1,
    blur: 0.6,
    motion: 0.2,
    lighting: 0.8,
    glare: 0.1,
    stableDurationMs: 700,
    removalState: 'clear',
    processing: false,
    duplicateBlocked: false,
    cameraReady: true,
  });

  assert.equal(readiness.ready, true);
  assert.equal(readiness.label, 'READY');
  assert.equal(readiness.instruction, 'Ready');
  assert.equal(readiness.visualState, 'ready');
  assert.equal(readiness.effectiveFps, 6.7);

  const blocked = resolveAutoCaptureReadiness({
    ...{
      frameCount: 0,
      firstFrameAt: null,
      latestFrameAt: null,
      cardPresence: false,
      cornersVisible: null,
      guideFill: null,
      aspectRatio: null,
      centerOffset: null,
      blur: null,
      motion: null,
      lighting: null,
      glare: null,
      stableDurationMs: null,
      removalState: 'awaiting_removal' as const,
      processing: true,
      duplicateBlocked: true,
      cameraReady: false,
    },
  });

  assert.equal(blocked.ready, false);
  assert.deepEqual(blocked.reasons, ['camera not ready']);
  assert.equal(blocked.primaryReason, 'camera_unavailable');
  assert.equal(blocked.instruction, 'Place card in frame');
});

test('auto-capture readiness does not block on unavailable optional lighting and glare', () => {
  const readiness = resolveAutoCaptureReadiness({
    frameCount: 8,
    firstFrameAt: 1000,
    latestFrameAt: 1800,
    cardPresence: true,
    cornersVisible: null,
    guideFill: 0.58,
    aspectRatio: null,
    centerOffset: 0.08,
    blur: 0.64,
    motion: 0.12,
    lighting: null,
    glare: null,
    stableDurationMs: 620,
    removalState: 'clear',
    processing: false,
    duplicateBlocked: false,
    cameraReady: true,
  });

  assert.equal(readiness.ready, true);
  assert.deepEqual(readiness.reasons, []);
});
