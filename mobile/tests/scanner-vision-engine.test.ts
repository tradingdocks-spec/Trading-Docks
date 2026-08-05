import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateCardGuideLayout } from '../services/continuous-offer-scanner.ts';
import type { LiveFrameSample } from '../services/live-card-recognition.ts';
import {
  DEFAULT_SCANNER_VISION_CONFIG,
  createScannerVisionEngine,
  type ScannerVisionConfig,
} from '../services/scanner-vision-engine.ts';

const guide = calculateCardGuideLayout({ containerWidth: 240, containerHeight: 360, reservedVerticalSpace: 40 });
const config: ScannerVisionConfig = { ...DEFAULT_SCANNER_VISION_CONFIG, guide, edgeThreshold: 20 };

test('CardBoundaryProvider detects four corners aspect fill center and confidence', () => {
  const result = engine().analyzeFrame(frameWithCard({ cardWidth: 128, cardHeight: 179, x: 56, y: 70, detail: true }));
  assert.equal(result.detection.cardPresent, true);
  assert.equal(result.detection.corners.every((corner) => corner.visible), true);
  assert.ok(result.detection.confidence > 0.7);
  assert.ok(Math.abs((result.detection.aspectRatio ?? 0) - guide.ratio) < 0.02);
  assert.ok(result.detection.fillRatio >= config.thresholds.minGuideFillRatio);
  assert.ok(result.detection.centerOffset.normalized < 0.12);
  assert.ok(result.detection.edgeVisibility > 0.7);
});

test('PerspectiveProvider rejects incorrect aspect and produces tilt guidance', () => {
  const result = engine().analyzeFrame(frameWithCard({ cardWidth: 150, cardHeight: 120, x: 45, y: 90, detail: true }));
  assert.equal(result.readyForAutoCapture, false);
  assert.ok(result.detection.perspectiveScore > config.thresholds.maxPerspectiveScore);
  assert.equal(result.guidance, 'Tilt slightly');
});

test('CardPresenceProvider rejects an empty frame without placeholder success', () => {
  const result = engine().analyzeFrame(emptyFrame());
  assert.equal(result.detection.cardPresent, false);
  assert.equal(result.readyForAutoCapture, false);
  assert.equal(result.guidance, 'Place card');
  assert.equal(result.crop, null);
});

test('BlurProvider returns normalized unreadable blur for low-detail frames', () => {
  const result = engine().analyzeFrame(frameWithCard({ cardWidth: 128, cardHeight: 179, x: 56, y: 70, flatCard: true }));
  assert.ok(result.quality.blur > config.thresholds.maxBlurScore);
  assert.equal(result.readyForAutoCapture, false);
  assert.equal(result.guidance, 'Hold steady');
});

test('MotionProvider resets stability when frames change quickly', () => {
  const scanner = engine();
  scanner.analyzeFrame(frameWithCard({ cardWidth: 128, cardHeight: 179, x: 56, y: 70, brightness: 80, capturedAt: 1000 }));
  const result = scanner.analyzeFrame(frameWithCard({ cardWidth: 128, cardHeight: 179, x: 58, y: 72, brightness: 180, capturedAt: 1100 }));
  assert.ok(result.quality.motion > config.thresholds.maxMotionScore);
  assert.equal(result.quality.stabilityMs, 0);
  assert.equal(result.readyForAutoCapture, false);
});

test('LightingProvider and GlareProvider block capture with actionable guidance', () => {
  const lowLight = engine().analyzeFrame(frameWithCard({ cardWidth: 128, cardHeight: 179, x: 56, y: 70, brightness: 20, detail: true }));
  const glare = engine().analyzeFrame(frameWithCard({ cardWidth: 128, cardHeight: 179, x: 56, y: 70, glare: true, detail: true }));
  assert.ok(lowLight.quality.lighting < config.thresholds.minLightingScore);
  assert.equal(lowLight.guidance, 'Improve lighting');
  assert.ok(glare.quality.glare > config.thresholds.maxGlareScore);
  assert.equal(glare.guidance, 'Reduce glare');
});

test('FrameQualityProvider allows auto-capture only after all checks and stability pass', () => {
  const scanner = engine({ stableSince: 1000 });
  const result = scanner.analyzeFrame(frameWithCard({ cardWidth: 128, cardHeight: 179, x: 56, y: 70, brightness: 136, detail: true, capturedAt: 1800 }));
  assert.equal(result.readyForAutoCapture, true);
  assert.equal(result.shouldCapture, true);
  assert.equal(result.captureState, 'ready');
  assert.equal(result.guideTone, 'ready');
  assert.equal(result.cornerGlow, true);
  assert.equal(result.guidance, 'Ready');
});

test('CardRemovalProvider prevents same stationary card from scanning twice', () => {
  const scanner = engine({ stableSince: 1000 });
  const ready = scanner.analyzeFrame(frameWithCard({ cardWidth: 128, cardHeight: 179, x: 56, y: 70, brightness: 136, detail: true, capturedAt: 1800 }));
  assert.equal(ready.shouldCapture, true);
  const sameCard = scanner.analyzeFrame(frameWithCard({ cardWidth: 128, cardHeight: 179, x: 56, y: 70, brightness: 136, detail: true, capturedAt: 2200 }));
  assert.equal(sameCard.readyForAutoCapture, false);
  assert.equal(sameCard.captureState, 'waiting_for_removal');
  assert.equal(sameCard.guidance, 'Remove card');
  const removed = scanner.analyzeFrame(emptyFrame({ capturedAt: 2600 }));
  assert.equal(removed.shouldRearm, true);
});

test('RegionExtractionProvider returns normalized in-memory crop contracts for card regions', () => {
  const result = engine({ stableSince: 1000 }).analyzeFrame(frameWithCard({ cardWidth: 128, cardHeight: 179, x: 56, y: 70, brightness: 136, detail: true, capturedAt: 1800 }));
  assert.deepEqual(result.regions.map((region) => region.name), ['title', 'artwork', 'type_line', 'set_symbol', 'collector_number', 'bottom_left']);
  assert.ok(result.regions.every((region) => region.bounds.width > 0 && region.bounds.height > 0));
});

test('providers are replaceable without changing the engine contract', () => {
  const scanner = createScannerVisionEngine({
    config,
    providers: {
      glare: { analyzeGlare: () => 1 },
    },
    initialState: { stableSince: 1000 },
  });
  const result = scanner.analyzeFrame(frameWithCard({ cardWidth: 128, cardHeight: 179, x: 56, y: 70, brightness: 136, detail: true, capturedAt: 1800 }));
  assert.equal(result.quality.glare, 1);
  assert.equal(result.readyForAutoCapture, false);
  assert.equal(result.guidance, 'Reduce glare');
});

test('debug metrics include FPS latency capture state and recognition-safe crop only', () => {
  const scanner = engine({ stableSince: 1000, lastFrameAt: 1000 });
  const result = scanner.analyzeFrame(frameWithCard({ cardWidth: 128, cardHeight: 179, x: 56, y: 70, brightness: 136, detail: true, capturedAt: 1500 }));
  assert.equal(result.fps, 2);
  assert.ok(result.latencyMs >= 0);
  assert.ok(result.crop?.fingerprint);
  assert.equal('pixels' in result, false);
});

function engine(initialState: Parameters<typeof createScannerVisionEngine>[0]['initialState'] = {}) {
  return createScannerVisionEngine({ config, initialState });
}

function emptyFrame(input: Partial<Pick<LiveFrameSample, 'capturedAt'>> = {}): LiveFrameSample {
  return {
    id: `empty-${input.capturedAt ?? 1000}`,
    userId: 'user-1',
    capturedAt: input.capturedAt ?? 1000,
    width: 240,
    height: 360,
    pixels: new Uint8Array(240 * 360).fill(18),
    pixelFormat: 'luma8',
    orientation: 'portrait',
  };
}

function frameWithCard(input: {
  cardWidth: number;
  cardHeight: number;
  x: number;
  y: number;
  brightness?: number;
  glare?: boolean;
  flatCard?: boolean;
  detail?: boolean;
  capturedAt?: number;
}): LiveFrameSample {
  const width = 240;
  const height = 360;
  const pixels = new Uint8Array(width * height).fill(18);
  const brightness = input.brightness ?? 136;
  for (let y = input.y; y < input.y + input.cardHeight; y += 1) {
    for (let x = input.x; x < input.x + input.cardWidth; x += 1) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const edge = x === input.x || y === input.y || x === input.x + input.cardWidth - 1 || y === input.y + input.cardHeight - 1;
      const pattern = input.detail && !edge ? ((x + y) % 13) * 7 : 0;
      const glare = input.glare && x > input.x + input.cardWidth * 0.55 && y < input.y + input.cardHeight * 0.35;
      pixels[y * width + x] = glare ? 255 : edge ? 220 : input.flatCard ? brightness : Math.min(235, brightness + pattern);
    }
  }
  return {
    id: `frame-${input.x}-${input.y}-${input.cardWidth}-${input.cardHeight}-${input.capturedAt ?? 1000}`,
    userId: 'user-1',
    capturedAt: input.capturedAt ?? 1000,
    width,
    height,
    pixels,
    pixelFormat: 'luma8',
    orientation: 'portrait',
  };
}
