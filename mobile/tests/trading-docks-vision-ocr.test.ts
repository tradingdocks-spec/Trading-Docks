import assert from 'node:assert/strict';
import test from 'node:test';

import {
  recognizeText,
  getVisionOcrRuntimeDiagnostics,
  validateNativeOcrRequest,
  type NativeOcrRequest,
} from '../modules/trading-docks-vision-ocr/index.ts';

const request: NativeOcrRequest = {
  imageUri: 'file:///tmp/card.jpg',
  languages: ['en-US'],
  recognitionLevel: 'accurate',
  regions: [
    { id: 'title', regionType: 'name', x: 0.1, y: 0.1, width: 0.7, height: 0.1 },
  ],
};

test('native OCR request validation accepts local file URIs and normalized regions', () => {
  assert.equal(validateNativeOcrRequest(request).ok, true);
});

test('native OCR request validation rejects non-local image URIs', () => {
  const result = validateNativeOcrRequest({ ...request, imageUri: 'https://example.test/card.jpg' });
  assert.equal(result.ok, false);
  if (!result.ok && !result.result.ok) assert.equal(result.result.code, 'invalid_request');
});

test('native OCR request validation rejects out-of-bounds regions', () => {
  const result = validateNativeOcrRequest({
    ...request,
    regions: [{ id: 'title', regionType: 'name', x: 0.8, y: 0.1, width: 0.5, height: 0.1 }],
  });
  assert.equal(result.ok, false);
  if (!result.ok && !result.result.ok) assert.match(result.result.message, /normalized/);
});

test('native OCR adapter returns structured unsupported result without native module', async () => {
  const result = await recognizeText(request, null, 'android');
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, 'unsupported_platform');
    assert.match(result.message, /iOS Apple Vision/);
  }
});

test('runtime diagnostics report linked module details when native bridge is available', async () => {
  const diagnostics = await getVisionOcrRuntimeDiagnostics({
    recognizeText: async () => ({ ok: false, provider: 'apple_vision', code: 'empty_result', message: 'No text', latencyMs: 1, warnings: [] }),
    getDiagnostics: async () => ({
      moduleLinked: true,
      runtimeModuleName: 'TradingDocksVisionOcr',
      nativeModuleVersion: '0.1.1',
      platform: 'ios',
    }),
  }, 'ios');
  assert.equal(diagnostics.moduleLinked, true);
  assert.equal(diagnostics.runtimeModuleName, 'TradingDocksVisionOcr');
  assert.equal(diagnostics.nativeModuleVersion, '0.1.1');
});

test('runtime diagnostics remain safe when native bridge is unavailable', async () => {
  const diagnostics = await getVisionOcrRuntimeDiagnostics(null, 'ios');
  assert.equal(diagnostics.moduleLinked, false);
  assert.equal(diagnostics.runtimeModuleName, 'TradingDocksVisionOcr');
  assert.equal(diagnostics.nativeModuleVersion, 'unavailable');
});
