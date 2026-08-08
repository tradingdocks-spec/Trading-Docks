import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildLiveTitleOcrRequest,
  createRapidLiveOcrState,
  normalizeLiveOcrRoi,
  rapidTitleRoiForFrame,
  runRapidLiveTitleOcr,
  stopRapidLiveOcr,
} from '../services/rapid-scan-live-ocr.ts';
import {
  buildRapidMagicNameIndex,
  nextRapidScanRuntime,
  markRapidIdentityEmitted,
  createRapidScanRuntime,
} from '../services/rapid-scan-pipeline.ts';
import type { ScannerCameraFrame } from '../components/scanner-camera-contract.ts';

const frame: ScannerCameraFrame = {
  id: 'frame-1',
  userId: 'user-1',
  capturedAt: 1000,
  width: 4,
  height: 4,
  pixels: Array.from({ length: 16 }, () => 144),
  pixelFormat: 'luma8',
  orientation: 'portrait',
  source: 'vision-camera',
  previewResolution: { width: 1080, height: 1920 },
};

const index = buildRapidMagicNameIndex([
  { name: 'Sol Ring', oracleId: 'oracle-sol-ring', scryfallId: 'sf-sol-ring' },
  { name: 'Lightning Bolt', oracleId: 'oracle-lightning-bolt', scryfallId: 'sf-bolt' },
]);

test('live OCR request uses normalized title ROI without file or base64 input', () => {
  const request = buildLiveTitleOcrRequest(frame);
  assert.equal(request.frameId, 'frame-1');
  assert.equal(request.pixels.length, 16);
  assert.equal('imageUri' in request, false);
  assert.deepEqual(request.roi, rapidTitleRoiForFrame(frame));
});

test('ROI normalization clamps expanded regions into frame bounds', () => {
  const roi = normalizeLiveOcrRoi({ x: -0.2, y: 0.95, width: 2, height: 0.2 }, frame);
  assert.equal(roi.x, 0);
  assert.ok(roi.y <= 0.8);
  assert.equal(roi.width, 1);
});

test('live OCR result handling routes high confidence into an appendable Rapid result', async () => {
  let now = 1000;
  const result = await runRapidLiveTitleOcr({
    state: createRapidLiveOcrState(),
    frame,
    nameIndex: index,
    destination: 'collection',
    createResultId: () => 'rapid-1',
    now: () => {
      now += 12;
      return now;
    },
    nativeProvider: async (request) => ({
      ok: true,
      provider: 'apple_vision',
      frameId: request.frameId,
      text: 'Sol Ring',
      confidence: 93,
      durationMs: 30,
      roi: request.roi,
      warnings: [],
    }),
  });

  assert.equal(result.outcome.status, 'added');
  if (result.outcome.status === 'added') {
    assert.equal(result.outcome.result.cardName, 'Sol Ring');
    assert.equal(result.outcome.result.exactPrintingId, 'sf-sol-ring');
    assert.equal(result.outcome.nativeDurationMs, 30);
  }
  assert.equal(result.state.metrics.ocrCompleted, 1);
});

test('backpressure skips frames while OCR is already in flight', async () => {
  const result = await runRapidLiveTitleOcr({
    state: { ...createRapidLiveOcrState(), inFlight: true },
    frame,
    nameIndex: index,
    destination: 'collection',
    createResultId: () => 'rapid-1',
    nativeProvider: async () => {
      throw new Error('should not run');
    },
  });

  assert.equal(result.outcome.status, 'skipped');
  assert.equal(result.state.metrics.framesSkipped, 1);
});

test('backpressure marks state in flight before native OCR resolves', async () => {
  const state = createRapidLiveOcrState();
  let resolveNative!: () => void;
  const first = runRapidLiveTitleOcr({
    state,
    frame,
    nameIndex: index,
    destination: 'collection',
    createResultId: () => 'rapid-1',
    nativeProvider: async (request) => new Promise<void>((resolve) => {
      resolveNative = resolve;
    }).then(() => ({
      ok: true,
      provider: 'apple_vision' as const,
      frameId: request.frameId,
      text: 'Sol Ring',
      confidence: 93,
      durationMs: 30,
      roi: request.roi,
      warnings: [],
    })),
  });

  assert.equal(state.inFlight, true);

  const skipped = await runRapidLiveTitleOcr({
    state,
    frame: { ...frame, id: 'frame-2' },
    nameIndex: index,
    destination: 'collection',
    createResultId: () => 'rapid-2',
    nativeProvider: async () => {
      throw new Error('second native OCR should be dropped');
    },
  });

  assert.equal(skipped.outcome.status, 'skipped');
  assert.equal(skipped.state.metrics.framesSkipped, 1);
  resolveNative();
  const completed = await first;
  assert.equal(completed.outcome.status, 'added');
  assert.equal(completed.state.inFlight, false);
});

test('scanner teardown discards live OCR work before mutation', async () => {
  const state = stopRapidLiveOcr(createRapidLiveOcrState());
  const result = await runRapidLiveTitleOcr({
    state,
    frame,
    nameIndex: index,
    destination: 'collection',
    createResultId: () => 'rapid-1',
    nativeProvider: async () => {
      throw new Error('should not run after teardown');
    },
  });

  assert.equal(result.outcome.status, 'stale');
});

test('weak live OCR results retry sampled title ROI before precision fallback', async () => {
  const result = await runRapidLiveTitleOcr({
    state: createRapidLiveOcrState(),
    frame,
    nameIndex: index,
    destination: 'collection',
    createResultId: () => 'rapid-1',
    nativeProvider: async (request) => ({
      ok: false,
      provider: 'apple_vision',
      frameId: request.frameId,
      code: 'empty_result',
      message: 'No title text.',
      durationMs: 18,
      warnings: [],
    }),
  });

  assert.equal(result.outcome.status, 'retry');
});

test('native unavailable falls back to Precision rather than appending invented identity', async () => {
  const result = await runRapidLiveTitleOcr({
    state: createRapidLiveOcrState(),
    frame,
    nameIndex: index,
    destination: 'collection',
    createResultId: () => 'rapid-1',
    nativeProvider: async (request) => ({
      ok: false,
      provider: 'native_module_unavailable',
      frameId: request.frameId,
      code: 'native_module_unavailable',
      message: 'Live OCR module missing.',
      durationMs: 0,
      warnings: [],
    }),
  });

  assert.equal(result.outcome.status, 'fallback_precision');
});

test('new-card rearm remains driven by rapid state after live identity', () => {
  const identified = markRapidIdentityEmitted(createRapidScanRuntime(0), {
    at: 1100,
    fingerprint: 'fp-sol-ring',
    title: 'Sol Ring',
  });
  const transition = nextRapidScanRuntime(identified, {
    at: 1120,
    cardPresent: true,
    fingerprint: 'fp-bolt',
    recognizedTitle: 'Lightning Bolt',
    differenceScore: 0.7,
  });

  assert.equal(transition.action, 'rearm_new_card');
  assert.equal(transition.runtime.state, 'new_card');
});
