import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateCardGuideLayout } from '../services/continuous-offer-scanner.ts';
import {
  SCANNER_CAMERA_MAX_BOTTOM_GUIDE_CLEARANCE,
  SCANNER_NATIVE_FRAME_SAMPLE_HEIGHT,
  SCANNER_NATIVE_FRAME_SAMPLE_WIDTH,
  scannerCameraFraming,
  scannerCameraStageHeight,
  scannerCameraViewQualityProps,
  scannerCaptureOptions,
  scannerGuideHasUsableCaptureArea,
  scannerNativeFrameSampling,
  scannerNativePhotoTarget,
} from '../services/scanner-camera-quality.ts';

test('scanner still capture keeps maximum quality with native orientation processing', () => {
  assert.deepEqual(scannerCaptureOptions(), {
    quality: 1,
    skipProcessing: false,
  });
});

test('scanner camera view enables supported quality props only', () => {
  assert.deepEqual(scannerCameraViewQualityProps(), {
    animateShutter: true,
    autofocus: 'on',
    responsiveOrientationWhenOrientationLocked: true,
  });
});

test('native live frame sampling stays compact and portrait oriented', () => {
  const sampling = scannerNativeFrameSampling();
  assert.equal(sampling.width, SCANNER_NATIVE_FRAME_SAMPLE_WIDTH);
  assert.equal(sampling.height, SCANNER_NATIVE_FRAME_SAMPLE_HEIGHT);
  assert.equal(sampling.targetFps, 8);
  assert.equal(sampling.pixelFormat, 'yuv');
  assert.equal(sampling.previewSizedBuffers, true);
  assert.ok(sampling.height > sampling.width);
});

test('native still capture uses an OCR-safe balanced four-by-three target', () => {
  const target = scannerNativePhotoTarget();
  assert.equal(target.width, 1920);
  assert.equal(target.height, 2560);
  assert.equal(target.quality, 0.86);
  assert.equal(target.qualityPrioritization, 'balanced');
  assert.equal(target.distortionCorrection, true);
  assert.equal(target.virtualDeviceFusion, true);
});

test('scanner framing reserves safe area and bottom controls away from the guide', () => {
  const framing = scannerCameraFraming({
    viewportWidth: 390,
    viewportHeight: 844,
    safeTop: 59,
    safeBottom: 34,
  });
  const guide = calculateCardGuideLayout(framing.guideLayoutInput);

  assert.equal(framing.cameraStageHeight, 844);
  assert.equal(framing.guideLayoutInput.safeTop, 59);
  assert.equal(framing.guideLayoutInput.safeBottom, 130);
  assert.ok(guide.top >= framing.guideLayoutInput.safeTop);
  assert.ok(guide.top + guide.height <= 844 - framing.guideLayoutInput.safeBottom);
  assert.ok(scannerGuideHasUsableCaptureArea(guide));
});

test('compact scanner framing keeps a usable guide instead of burying it under controls', () => {
  const framing = scannerCameraFraming({
    viewportWidth: 320,
    viewportHeight: 568,
    safeTop: 44,
    safeBottom: 34,
  });
  const guide = calculateCardGuideLayout(framing.guideLayoutInput);

  assert.equal(scannerCameraStageHeight(500), 520);
  assert.equal(framing.guideLayoutInput.safeBottom, 130);
  assert.ok(scannerGuideHasUsableCaptureArea(guide));
});

test('scanner framing clamps extreme device insets', () => {
  const framing = scannerCameraFraming({
    viewportWidth: 430,
    viewportHeight: 932,
    safeTop: 120,
    safeBottom: 200,
  });

  assert.equal(framing.guideLayoutInput.safeTop, 72);
  assert.equal(framing.guideLayoutInput.safeBottom, SCANNER_CAMERA_MAX_BOTTOM_GUIDE_CLEARANCE);
});
