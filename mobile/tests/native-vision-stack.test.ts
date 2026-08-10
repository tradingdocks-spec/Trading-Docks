import assert from 'node:assert/strict';
import test from 'node:test';

import { verifyNativeVisionStack } from '../scripts/verify-native-vision-stack.js';

test('native VisionCamera worklet stack remains compile-compatible', () => {
  const versions = verifyNativeVisionStack();

  assert.deepEqual(versions, {
    expo: '54.0.36',
    reactNative: '0.81.5',
    reactNativeMetroConfig: '0.81.5',
    visionCamera: '5.0.11',
    visionCameraWorklets: '5.0.11',
    worklets: '0.8.3',
    nitroModules: '0.35.9',
    nitroImage: '0.15.0',
    reanimated: '4.1.7',
  });
});
