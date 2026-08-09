import assert from 'node:assert/strict';
import test from 'node:test';

import { detectCardRectangle } from '../modules/trading-docks-vision-ocr/index.ts';

test('detectCardRectangle rejects non-local images before native work', async () => {
  const result = await detectCardRectangle({ imageUri: 'https://example.test/card.jpg' }, null, 'ios');
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.provider, 'apple_vision_rectangle');
    assert.equal(result.code, 'invalid_request');
  }
});

test('detectCardRectangle requires iOS native module availability', async () => {
  const result = await detectCardRectangle({ imageUri: 'file:///tmp/card.jpg' }, null, 'ios');
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.provider, 'native_module_unavailable');
    assert.equal(result.code, 'native_module_unavailable');
  }
});

test('detectCardRectangle forwards to the native rectangle provider on iOS', async () => {
  const native = {
    recognizeText: async () => {
      throw new Error('not used');
    },
    detectCardRectangle: async () => ({
      ok: true as const,
      provider: 'apple_vision_rectangle' as const,
      imageUri: 'file:///tmp/card.jpg',
      detected: true,
      confidence: 0.91,
      corners: [
        { x: 0.2, y: 0.1 },
        { x: 0.8, y: 0.1 },
        { x: 0.8, y: 0.9 },
        { x: 0.2, y: 0.9 },
      ] as [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }],
      boundingBox: { x: 0.2, y: 0.1, width: 0.6, height: 0.8 },
      aspectRatio: 0.75,
      durationMs: 20,
      warnings: [],
    }),
  };
  const result = await detectCardRectangle({ imageUri: 'file:///tmp/card.jpg' }, native, 'ios');
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.detected, true);
    assert.equal(result.boundingBox?.width, 0.6);
  }
});
