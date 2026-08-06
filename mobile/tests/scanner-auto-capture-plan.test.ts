import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const repo = join(process.cwd(), '..');

test('active Scan route uses native frame signals through the shared camera adapter', () => {
  const scan = readFileSync(join(process.cwd(), 'components', 'scanner', 'automatic-scanner-screen.tsx'), 'utf8');
  const nativeCamera = readFileSync(join(process.cwd(), 'components', 'scanner-camera.tsx'), 'utf8');
  const webCamera = readFileSync(join(process.cwd(), 'components', 'scanner-camera.web.tsx'), 'utf8');

  assert.match(scan, /ScannerCamera/);
  assert.match(scan, /capturePhoto/);
  assert.match(scan, /NATIVE_FRAME_VISUAL_SIGNALS/);
  assert.match(scan, /canAutoCaptureNative/);
  assert.doesNotMatch(scan, /takePictureAsync/);
  assert.match(nativeCamera, /useFrameOutput/);
  assert.match(nativeCamera, /react-native-vision-camera/);
  assert.match(webCamera, /CameraView/);
});

test('native auto-capture plan documents honest implementation and remaining physical gates', () => {
  const plan = readFileSync(join(repo, 'docs', 'SCANNER_AUTO_CAPTURE_NATIVE_PLAN.md'), 'utf8');

  assert.match(plan, /Status: Partially Implemented/);
  assert.match(plan, /feeds bounded native VisionCamera luma samples/);
  assert.match(plan, /No fake signal, fake FPS, or fake readiness/);
  assert.match(plan, /same stationary card cannot scan twice/i);
  assert.match(plan, /Physical iOS and Android tests/);
});
