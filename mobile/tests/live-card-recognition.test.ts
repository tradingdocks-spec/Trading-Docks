import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateCardGuideLayout } from '../services/continuous-offer-scanner.ts';
import type { RecognitionCandidate } from '../services/scanner-intelligence.ts';
import {
  DEFAULT_LIVE_FRAME_ANALYSIS_CONFIG,
  LIVE_RECOGNITION_PROVIDER_STATUS,
  analyzeLiveFrame,
  mapTargetedOcrToMagicInput,
  normalizeCollectorInfoOcr,
  normalizeOcrText,
  recognizeMagicFromLiveFrame,
  type LiveFrameSample,
} from '../services/live-card-recognition.ts';

const guide = calculateCardGuideLayout({ containerWidth: 240, containerHeight: 360, reservedVerticalSpace: 40 });
const config = { ...DEFAULT_LIVE_FRAME_ANALYSIS_CONFIG, guide, edgeThreshold: 20 };

const candidate: RecognitionCandidate = {
  id: 'card-1',
  name: 'Rhystic Study',
  setCode: 'WOT',
  setName: 'Wilds of Eldraine',
  collectorNumber: '25',
  finishes: ['normal', 'foil'],
  language: 'en',
  imageUrl: null,
  confidence: 0.9,
  recognitionMode: 'assisted_capture',
  legalFinishes: ['normal', 'foil'],
  layout: 'portrait',
  colorIdentity: ['U'],
};

test('live analyzer detects all four corners for a standard card', () => {
  const frame = frameWithCard({ width: 240, height: 360, cardWidth: 128, cardHeight: 179, x: 56, y: 70 });
  const result = analyzeLiveFrame(frame, config);
  assert.equal(result.observation.corners.every((corner) => corner.visible), true);
  assert.equal(result.aspectRatioOk, true);
  assert.ok(result.observation.cardPresent);
});

test('incorrect object ratio is rejected before auto capture', () => {
  const frame = frameWithCard({ width: 240, height: 360, cardWidth: 150, cardHeight: 120, x: 45, y: 90 });
  const result = analyzeLiveFrame(frame, config);
  assert.equal(result.aspectRatioOk, false);
  assert.equal(result.readyForAutoCapture, false);
  assert.equal(result.guidance, 'Tilt slightly');
});

test('partial card outside guide is rejected', () => {
  const frame = frameWithCard({ width: 240, height: 360, cardWidth: 128, cardHeight: 179, x: 4, y: 20 });
  const result = analyzeLiveFrame(frame, config);
  assert.equal(result.observation.fullyInsideGuide, false);
  assert.equal(result.readyForAutoCapture, false);
  assert.ok(result.observation.guideFillRatio > 0);
});

test('perspective-like aspect drift is rejected', () => {
  const frame = frameWithCard({ width: 240, height: 360, cardWidth: 150, cardHeight: 179, x: 45, y: 70 });
  const result = analyzeLiveFrame(frame, { ...config, aspectRatioTolerance: 0.05 });
  assert.equal(result.aspectRatioOk, false);
  assert.ok(result.observation.perspectiveScore > 0.05);
});

test('blur guidance appears for low-detail card region', () => {
  const frame = frameWithCard({ width: 240, height: 360, cardWidth: 128, cardHeight: 179, x: 56, y: 70, flatCard: true });
  const result = analyzeLiveFrame(frame, config);
  assert.ok(result.observation.blurScore > config.thresholds.maxBlurScore);
  assert.equal(result.readyForAutoCapture, false);
  assert.ok(result.guidance === 'Hold steady' || result.observation.blurScore > 0.9);
});

test('motion guidance prevents capture before stability window', () => {
  const previous = frameWithCard({ width: 240, height: 360, cardWidth: 128, cardHeight: 179, x: 56, y: 70, brightness: 80 });
  const current = frameWithCard({ width: 240, height: 360, cardWidth: 128, cardHeight: 179, x: 58, y: 72, brightness: 180 });
  const result = analyzeLiveFrame(current, config, previous);
  assert.ok(result.observation.motionScore > config.thresholds.maxMotionScore);
  assert.equal(result.readyForAutoCapture, false);
  assert.equal(result.observation.stabilityMs, 0);
});

test('glare and poor lighting produce concise guidance', () => {
  const glare = analyzeLiveFrame(frameWithCard({ width: 240, height: 360, cardWidth: 128, cardHeight: 179, x: 56, y: 70, glare: true }), config);
  const lowLight = analyzeLiveFrame(frameWithCard({ width: 240, height: 360, cardWidth: 128, cardHeight: 179, x: 56, y: 70, brightness: 20 }), config);
  assert.ok(glare.observation.glareScore > config.thresholds.maxGlareScore);
  assert.equal(glare.readyForAutoCapture, false);
  assert.equal(lowLight.guidance, 'Improve lighting');
});

test('stable high-quality frame is ready for automatic capture', () => {
  const frame = frameWithCard({ width: 240, height: 360, cardWidth: 128, cardHeight: 179, x: 56, y: 70, brightness: 136, detail: true });
  const result = analyzeLiveFrame(frame, config);
  assert.equal(result.readyForAutoCapture, true);
  assert.equal(result.guidance, 'Ready');
  assert.ok(result.crop?.fingerprint);
});

test('OCR normalizer handles common title and collector-info confusions', () => {
  assert.equal(normalizeOcrText('Rhystic   Study'), 'Rhystic Study');
  assert.equal(normalizeOcrText('Rhy|stic 0f'), 'RhyIstic of');
  assert.equal(normalizeCollectorInfoOcr('wot • O25 en'), 'WOT 025 EN');
});

test('targeted OCR readings map into Magic recognition input', () => {
  const frame = frameWithCard({ width: 240, height: 360, cardWidth: 128, cardHeight: 179, x: 56, y: 70, detail: true });
  const crop = analyzeLiveFrame(frame, config).crop;
  assert.ok(crop);
  const input = mapTargetedOcrToMagicInput({
    crop,
    catalogCandidates: [candidate],
    online: false,
    readings: [
      { region: 'title', text: 'Rhystic Study', confidence: 91, bounds: { x: 0.1, y: 0.05, width: 0.6, height: 0.08 } },
      { region: 'collector_info', text: 'WOT 25 EN', confidence: 88, bounds: { x: 0.1, y: 0.9, width: 0.4, height: 0.06 } },
    ],
  });
  assert.equal(input.nameObservation?.text, 'Rhystic Study');
  assert.equal(input.collectorInfoObservation?.setCode, 'WOT');
  assert.equal(input.collectorInfoObservation?.collectorNumber, '25');
});

test('conflicting OCR signals require review even with a candidate', async () => {
  const frame = frameWithCard({ width: 240, height: 360, cardWidth: 128, cardHeight: 179, x: 56, y: 70, detail: true });
  const crop = analyzeLiveFrame(frame, config).crop;
  assert.ok(crop);
  const result = await recognizeMagicFromLiveFrame({
    frame,
    crop,
    catalogCandidates: [candidate],
    online: false,
    ocrReadings: [
      { region: 'title', text: 'Rhystic Study', confidence: 90, bounds: { x: 0.1, y: 0.05, width: 0.6, height: 0.08 } },
      { region: 'collector_info', text: 'ABC 999 EN', confidence: 90, bounds: { x: 0.1, y: 0.9, width: 0.4, height: 0.06 } },
    ],
  });
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.confidence.requiresConfirmation, true);
  assert.equal(result.ok && result.candidates.length <= 3, true);
});

test('native provider status documents development-build requirement and no Expo Go support', () => {
  assert.equal(LIVE_RECOGNITION_PROVIDER_STATUS.visionCameraInstalled, true);
  assert.equal(LIVE_RECOGNITION_PROVIDER_STATUS.usesDevelopmentBuild, true);
  assert.equal(LIVE_RECOGNITION_PROVIDER_STATUS.expoGoSupported, false);
});

function frameWithCard(input: {
  width: number;
  height: number;
  cardWidth: number;
  cardHeight: number;
  x: number;
  y: number;
  brightness?: number;
  glare?: boolean;
  flatCard?: boolean;
  detail?: boolean;
}): LiveFrameSample {
  const pixels = new Uint8Array(input.width * input.height).fill(18);
  const brightness = input.brightness ?? 136;
  for (let y = input.y; y < input.y + input.cardHeight; y += 1) {
    for (let x = input.x; x < input.x + input.cardWidth; x += 1) {
      const inside = x >= 0 && y >= 0 && x < input.width && y < input.height;
      if (!inside) continue;
      const edge = x === input.x || y === input.y || x === input.x + input.cardWidth - 1 || y === input.y + input.cardHeight - 1;
      const pattern = input.detail && !edge ? ((x + y) % 13) * 7 : 0;
      const glare = input.glare && x > input.x + input.cardWidth * 0.55 && y < input.y + input.cardHeight * 0.35;
      pixels[y * input.width + x] = glare ? 255 : edge ? 220 : input.flatCard ? brightness : Math.min(235, brightness + pattern);
    }
  }
  return {
    id: `frame-${input.x}-${input.y}-${input.cardWidth}-${input.cardHeight}`,
    userId: 'user-1',
    capturedAt: 1000,
    width: input.width,
    height: input.height,
    pixels,
    pixelFormat: 'luma8',
    orientation: 'portrait',
  };
}
