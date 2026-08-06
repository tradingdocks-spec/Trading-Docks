import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateCardGuideLayout } from '../services/continuous-offer-scanner.ts';
import {
  SCANNER_CAMERA_MAX_BOTTOM_GUIDE_CLEARANCE,
  scannerCameraFraming,
  scannerCameraStageHeight,
  scannerCameraViewQualityProps,
  scannerCaptureOptions,
  scannerGuideHasUsableCaptureArea,
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
