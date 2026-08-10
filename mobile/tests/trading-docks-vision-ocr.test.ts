import assert from 'node:assert/strict';
import test from 'node:test';

import {
  recognizeText,
  recognizeFrameTitle,
  analyzeRecognitionImage,
  compareFeaturePrints,
  generateFeaturePrint,
  getVisionOcrRuntimeDiagnostics,
  validateNativeImageRequest,
  validateNativeLiveTitleOcrRequest,
  validateNativeOcrRequest,
  type NativeLiveTitleOcrRequest,
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

const liveRequest: NativeLiveTitleOcrRequest = {
  frameId: 'frame-1',
  width: 4,
  height: 4,
  pixels: Array.from({ length: 16 }, () => 128),
  roi: { x: 0.1, y: 0.05, width: 0.8, height: 0.15 },
  recognitionLevel: 'fast',
  languages: ['en-US'],
  orientation: 'portrait',
};

test('native live title OCR request validation accepts bounded luma frames and ROI', () => {
  assert.equal(validateNativeLiveTitleOcrRequest(liveRequest).ok, true);
});

test('native live title OCR validation rejects mismatched pixels and invalid ROI', () => {
  const result = validateNativeLiveTitleOcrRequest({
    ...liveRequest,
    pixels: [1, 2, 3],
    roi: { x: 0.9, y: 0.1, width: 0.3, height: 0.1 },
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.result.code, 'invalid_request');
});

test('native live title OCR adapter returns structured unsupported result without frame retention', async () => {
  const result = await recognizeFrameTitle(liveRequest, null, 'android');
  assert.equal(result.ok, false);
  if (result.ok === false) {
    assert.equal(result.code, 'unsupported_platform');
    assert.match(result.message, /live frame title OCR/);
    assert.match(result.warnings.join(' '), /unsupported/);
  }
});

test('native live title OCR adapter passes frame request to linked module', async () => {
  const result = await recognizeFrameTitle(liveRequest, {
    recognizeText: async () => ({ ok: false, provider: 'apple_vision', code: 'empty_result', message: 'No text', latencyMs: 1, warnings: [] }),
    recognizeFrameTitle: async (request) => ({
      ok: true,
      provider: 'apple_vision',
      frameId: request.frameId,
      text: 'Sol Ring',
      confidence: 91,
      durationMs: 23,
      roi: request.roi,
      warnings: [],
    }),
  }, 'ios');

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.text, 'Sol Ring');
    assert.equal(result.durationMs, 23);
    assert.deepEqual(result.roi, liveRequest.roi);
  }
});

test('native image analysis and feature-print requests require local file URIs', () => {
  assert.equal(validateNativeImageRequest({ imageUri: 'file:///tmp/card.jpg' }, 'analysis').ok, true);
  assert.equal(validateNativeImageRequest({ imageUri: 'https://example.test/card.jpg' }, 'feature_print').ok, false);
});

test('feature-print prototype returns safe unavailable results without native module', async () => {
  const analysis = await analyzeRecognitionImage({ imageUri: 'file:///tmp/card.jpg' }, null, 'ios');
  assert.equal(analysis.ok, false);
  if (!analysis.ok) assert.equal(analysis.code, 'native_module_unavailable');

  const feature = await generateFeaturePrint({ imageUri: 'file:///tmp/card.jpg' }, null, 'ios');
  assert.equal(feature.ok, false);
  if (!feature.ok) assert.equal(feature.code, 'native_module_unavailable');

  const distance = await compareFeaturePrints({ leftFeaturePrint: 'left', rightFeaturePrint: 'right' }, null, 'ios');
  assert.equal(distance.ok, false);
  if (!distance.ok) assert.equal(distance.code, 'native_module_unavailable');
});
