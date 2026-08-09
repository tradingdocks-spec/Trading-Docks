import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createAppleVisionAutoCaptureRuntime,
  nextAppleVisionAutoCaptureRuntime,
  type AppleVisionCardRectangle,
} from '../services/apple-vision-auto-capture.ts';

const rectangle: AppleVisionCardRectangle = {
  detected: true,
  confidence: 0.86,
  boundingBox: { x: 0.22, y: 0.12, width: 0.56, height: 0.78 },
  corners: [
    { x: 0.22, y: 0.12 },
    { x: 0.78, y: 0.12 },
    { x: 0.78, y: 0.9 },
    { x: 0.22, y: 0.9 },
  ],
};

const quality = { blur: 0.2, motion: 0.08, lighting: 0.64, glare: 0.12 };

function step(runtime = createAppleVisionAutoCaptureRuntime(), now = 1000, patch: Partial<Parameters<typeof nextAppleVisionAutoCaptureRuntime>[1]> = {}) {
  return nextAppleVisionAutoCaptureRuntime(runtime, {
    autoEnabled: true,
    cameraReady: true,
    processing: false,
    now,
    rectangle,
    quality,
    fingerprint: 'card-a',
    ...patch,
  });
}

test('Auto ON captures automatically after stable rectangle and quality gates pass', () => {
  const first = step(undefined, 1000);
  assert.equal(first.shouldCapture, false);
  assert.equal(first.runtime.state, 'STABILIZING');
  const ready = step(first.runtime, 1540);
  assert.equal(ready.shouldCapture, true);
  assert.equal(ready.runtime.state, 'CAPTURING');
});

test('unstable card does not capture', () => {
  const first = step(undefined, 1000);
  const shifted = step(first.runtime, 1540, {
    rectangle: { ...rectangle, boundingBox: { x: 0.31, y: 0.12, width: 0.56, height: 0.78 } },
  });
  assert.equal(shifted.shouldCapture, false);
  assert.equal(shifted.runtime.state, 'STABILIZING');
});

test('same card remaining in frame does not duplicate capture', () => {
  const ready = step(step(undefined, 1000).runtime, 1540);
  const duplicate = step(ready.runtime, 2100);
  assert.equal(duplicate.shouldCapture, false);
  assert.equal(duplicate.runtime.state, 'WAITING_FOR_REMOVAL');
});

test('card removal rearms scanner', () => {
  const ready = step(step(undefined, 1000).runtime, 1540);
  const missing = step(ready.runtime, 1800, { rectangle: null });
  const rearmed = step(missing.runtime, 2030, { rectangle: null });
  assert.equal(rearmed.shouldCapture, false);
  assert.equal(rearmed.runtime.state, 'REARMED');
});

test('new card auto captures after removal and stabilization', () => {
  const ready = step(step(undefined, 1000).runtime, 1540);
  const rearmed = step(step(ready.runtime, 1800, { rectangle: null }).runtime, 2030, { rectangle: null });
  const newCard = { ...rectangle, boundingBox: { x: 0.2, y: 0.12, width: 0.56, height: 0.78 } };
  const found = step(rearmed.runtime, 2200, { rectangle: newCard, fingerprint: 'card-b' });
  const captured = step(found.runtime, 2740, { rectangle: newCard, fingerprint: 'card-b' });
  assert.equal(captured.shouldCapture, true);
  assert.equal(captured.runtime.state, 'CAPTURING');
});

test('Auto OFF reaches ready but never triggers capture', () => {
  const first = step(undefined, 1000, { autoEnabled: false });
  const ready = step(first.runtime, 1540, { autoEnabled: false });
  assert.equal(ready.shouldCapture, false);
  assert.equal(ready.runtime.state, 'READY');
});
