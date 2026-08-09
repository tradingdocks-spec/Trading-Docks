import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildLiveTitleOcrRequest,
  createRapidLiveOcrState,
  normalizeLiveOcrRoi,
  rapidTitleRoiForFrame,
  rapidTitleRoiForStage,
  runRapidLiveTitleOcr,
  stopRapidLiveOcr,
  visionRoiFromTopLeftRoi,
} from '../services/rapid-scan-live-ocr.ts';
import {
  buildRapidMagicNameIndex,
  nextRapidScanRuntime,
  markRapidIdentityEmitted,
  createRapidScanRuntime,
} from '../services/rapid-scan-pipeline.ts';
import {
  buildVisualReferenceIndex,
  type VisualReferenceRecord,
} from '../services/scanner-multi-signal-recognition.ts';
import type { ScannerCameraFrame } from '../components/scanner-camera-contract.ts';
import type { ScannerVisionResult } from '../services/scanner-vision-engine.ts';

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

const goblinVisualRecords: VisualReferenceRecord[] = [{
  oracleId: 'oracle-goblin-war-strike',
  scryfallId: 'sf-goblin-war-strike',
  name: 'Goblin War Strike',
  setCode: 'SCG',
  collectorNumber: '96',
  descriptor: { algorithm: 'luma_phash_8x8_v1', hash: 'ff00aa55ff00aa55', source: 'reference_image' },
}];

test('live OCR request uses normalized title ROI without file or base64 input', () => {
  const request = buildLiveTitleOcrRequest(frame);
  assert.equal(request.frameId, 'frame-1');
  assert.equal(request.pixels.length, 16);
  assert.equal('imageUri' in request, false);
  assert.deepEqual(request.roi, rapidTitleRoiForFrame(frame));
  assert.ok(request.roi.x > 0.18);
  assert.ok(request.roi.y > 0.12);
});

test('Vision ROI converts React Native top-left origin to bottom-left origin', () => {
  assert.deepEqual(
    visionRoiFromTopLeftRoi({ x: 0.2312, y: 0.1542, width: 0.5376, height: 0.0798 }),
    { x: 0.2312, y: 0.766, width: 0.5376, height: 0.0798 },
  );
});

test('Rapid title ROI stages expand within the detected card zone', () => {
  const tight = rapidTitleRoiForStage('title_primary', frame);
  const expanded = rapidTitleRoiForStage('title_expanded', frame);
  const upper = rapidTitleRoiForStage('upper_card', frame);
  assert.ok(expanded.width > tight.width);
  assert.ok(upper.height > expanded.height);
  assert.ok(upper.x >= 0.18);
  assert.ok(upper.y >= 0.12);
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

test('catalog-not-ready behavior retries without calling native OCR', async () => {
  const result = await runRapidLiveTitleOcr({
    state: createRapidLiveOcrState(),
    frame,
    nameIndex: buildRapidMagicNameIndex([]),
    destination: 'collection',
    createResultId: () => 'rapid-1',
    nativeProvider: async () => {
      throw new Error('native OCR should wait for catalog prewarm');
    },
  });

  assert.equal(result.outcome.status, 'retry');
  assert.equal(result.state.lastDiagnostics?.indexReady, false);
  assert.equal(result.state.lastDiagnostics?.failureStage, 'NO_LOCAL_MATCH');
});

test('weak live OCR results retry sampled title ROI before precision fallback', async () => {
  const calls: string[] = [];
  const result = await runRapidLiveTitleOcr({
    state: createRapidLiveOcrState(),
    frame,
    nameIndex: index,
    destination: 'collection',
    createResultId: () => 'rapid-1',
    nativeProvider: async (request) => {
      calls.push(`${request.roi.x}:${request.roi.y}:${request.roi.width}:${request.roi.height}`);
      return {
        ok: false,
        provider: 'apple_vision',
        frameId: request.frameId,
        code: 'empty_result',
        message: 'No title text.',
        durationMs: 18,
        warnings: [],
      };
    },
  });

  assert.equal(result.outcome.status, 'fallback_precision');
  assert.equal(calls.length, 3);
  assert.equal(result.state.lastDiagnostics?.failureStage, 'NO_TEXT');
});

test('expanded live OCR title ROI can recover before upper-card fallback', async () => {
  let calls = 0;
  const result = await runRapidLiveTitleOcr({
    state: createRapidLiveOcrState(),
    frame,
    nameIndex: index,
    destination: 'collection',
    createResultId: () => 'rapid-expanded',
    nativeProvider: async (request) => {
      calls += 1;
      if (calls === 1) {
        return { ok: false, provider: 'apple_vision', frameId: request.frameId, code: 'empty_result', message: 'No tight title.', durationMs: 8, warnings: [] };
      }
      return {
        ok: true,
        provider: 'apple_vision',
        frameId: request.frameId,
        text: 'Lightning Bolt',
        confidence: 88,
        durationMs: 14,
        roi: request.roi,
        warnings: [],
      };
    },
  });

  assert.equal(result.outcome.status, 'added');
  assert.equal(result.state.lastDiagnostics?.stage, 'title_expanded');
  assert.equal(result.state.metrics.boundedRetries, 1);
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

test('Rapid Scan uses multi-signal fusion to recover visual identity when OCR is empty', async () => {
  const result = await runRapidLiveTitleOcr({
    state: createRapidLiveOcrState(),
    frame,
    nameIndex: index,
    destination: 'collection',
    createResultId: () => 'rapid-visual',
    visualIndex: buildVisualReferenceIndex(goblinVisualRecords),
    vision: visionResult('ff00aa55ff00aa55'),
    nativeProvider: async (request) => ({
      ok: false,
      provider: 'apple_vision',
      frameId: request.frameId,
      code: 'empty_result',
      message: 'No title text.',
      durationMs: 19,
      warnings: [],
    }),
  });

  assert.equal(result.outcome.status, 'added');
  if (result.outcome.status !== 'added') return;
  assert.equal(result.outcome.result.cardName, 'Goblin War Strike');
  assert.equal(result.outcome.fusion?.status, 'append_identity');
  assert.equal(result.state.lastDiagnostics?.fusion?.visualCandidate, 'Goblin War Strike');
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

function visionResult(hash: string): ScannerVisionResult {
  return {
    frameId: 'frame-vision',
    observedAt: 1000,
    fps: 10,
    detection: {
      cardPresent: true,
      bounds: { x: 0, y: 0, width: 4, height: 4 },
      corners: [
        { x: 0, y: 0, visible: true, confidence: 0.9 },
        { x: 4, y: 0, visible: true, confidence: 0.9 },
        { x: 4, y: 4, visible: true, confidence: 0.9 },
        { x: 0, y: 4, visible: true, confidence: 0.9 },
      ],
      aspectRatio: 0.72,
      rotationDegrees: 0,
      perspectiveScore: 0.02,
      fillRatio: 0.8,
      centerOffset: { x: 0, y: 0, normalized: 0 },
      edgeVisibility: 0.92,
      confidence: 0.94,
      fingerprint: hash,
    },
    quality: { blur: 0.12, motion: 0.05, lighting: 0.82, glare: 0.08, distance: 0.91, stabilityMs: 800, confidence: 0.9 },
    observation: {
      corners: [
        { x: 0, y: 0, visible: true },
        { x: 4, y: 0, visible: true },
        { x: 4, y: 4, visible: true },
        { x: 0, y: 4, visible: true },
      ],
      fullyInsideGuide: true,
      guideFillRatio: 0.8,
      perspectiveScore: 0.02,
      motionScore: 0.05,
      blurScore: 0.12,
      glareScore: 0.08,
      lightingScore: 0.82,
      stabilityMs: 800,
      cardPresent: true,
      orientation: 'portrait',
      imageFingerprint: hash,
      observedAt: 1000,
    },
    crop: {
      frameId: 'frame-vision',
      bounds: { x: 0, y: 0, width: 4, height: 4 },
      corners: [
        { x: 0, y: 0, visible: true },
        { x: 1, y: 0, visible: true },
        { x: 1, y: 1, visible: true },
        { x: 0, y: 1, visible: true },
      ],
      orientation: 'portrait',
      perspectiveCorrected: true,
      fingerprint: hash,
    },
    regions: [],
    guidance: 'Ready',
    captureState: 'ready',
    guideTone: 'ready',
    cornerGlow: true,
    readyForAutoCapture: true,
    shouldCapture: true,
    shouldRearm: false,
    latencyMs: 2,
  };
}
