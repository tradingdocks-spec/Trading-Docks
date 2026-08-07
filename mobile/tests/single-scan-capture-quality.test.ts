import assert from 'node:assert/strict';
import test from 'node:test';

import type { LiveFrameSample } from '../services/live-card-recognition.ts';
import {
  SINGLE_SCAN_FOCUS_SETTLE_MS,
  SINGLE_SCAN_MIN_GUIDE_FILL,
  createSingleScanQualityAnalyzer,
  mapViewGuideToFrame,
  resolveSingleScanCaptureQuality,
  singleScanUserFacingFailure,
} from '../services/single-scan-capture-quality.ts';

const view = { width: 390, height: 844 };
const guide = { left: 58, top: 170, width: 274, height: 383, ratio: 274 / 383 };

test('view guide maps into frame coordinates without using native preview dimensions', () => {
  const mapped = mapViewGuideToFrame({
    view,
    guide,
    frame: { width: 240, height: 360 },
  });
  assert.ok(mapped.width > 0);
  assert.ok(mapped.height > 0);
  assert.ok(Math.abs(mapped.height / mapped.width - guide.height / guide.width) < 0.01);
});

test('card too small blocks Single Scan capture with Move closer guidance', () => {
  const analyzer = createSingleScanQualityAnalyzer({ view: { width: 240, height: 360 }, guide: centeredGuide() });
  const result = analyzer.analyzeFrame(frameWithCard({ cardWidth: 86, cardHeight: 120, x: 77, y: 104, detail: true, capturedAt: 1000 }));
  assert.equal(result.canCapture, false);
  assert.equal(result.reason, 'too_small');
  assert.equal(result.guidance, 'Move closer');
  assert.ok((result.fillRatio ?? 0) < SINGLE_SCAN_MIN_GUIDE_FILL);
});

test('blurry frame blocks Single Scan capture with focus guidance', () => {
  const analyzer = createSingleScanQualityAnalyzer({ view: { width: 240, height: 360 }, guide: centeredGuide() });
  analyzer.analyzeFrame(frameWithCard({ cardWidth: 128, cardHeight: 179, x: 56, y: 70, flatCard: true, capturedAt: 1000 }));
  const result = analyzer.analyzeFrame(frameWithCard({ cardWidth: 128, cardHeight: 179, x: 56, y: 70, flatCard: true, capturedAt: 1600 }));
  assert.equal(result.canCapture, false);
  assert.equal(result.reason, 'too_blurry');
  assert.equal(result.guidance, 'Tap card to focus');
});

test('stable sharp filled frame can capture after stability window', () => {
  const analyzer = createSingleScanQualityAnalyzer({ view: { width: 240, height: 360 }, guide: centeredGuide() });
  analyzer.analyzeFrame(frameWithCard({ cardWidth: 128, cardHeight: 179, x: 56, y: 70, detail: true, brightness: 136, capturedAt: 1000 }));
  const result = analyzer.analyzeFrame(frameWithCard({ cardWidth: 128, cardHeight: 179, x: 56, y: 70, detail: true, brightness: 136, capturedAt: 1600 }));
  assert.equal(result.canCapture, true);
  assert.equal(result.guidance, 'Ready');
});

test('focus settle blocks capture briefly before OCR', () => {
  const ready = resolveSingleScanCaptureQuality(null, { cameraReady: true, focusSettling: true });
  assert.equal(ready.canCapture, false);
  assert.equal(ready.reason, 'focus_settling');
  assert.equal(ready.guidance, 'Hold steady');
  assert.equal(SINGLE_SCAN_FOCUS_SETTLE_MS, 450);
});

test('user-facing OCR error is nontechnical while raw provider error can remain diagnostic', () => {
  const raw = 'Apple Vision OCR did not return readable text for the requested regions.';
  const friendly = singleScanUserFacingFailure(raw);
  assert.equal(friendly.title, "Couldn't read the card.");
  assert.equal(friendly.message, 'Move closer, tap the card to focus, and try again.');
  assert.doesNotMatch(`${friendly.title} ${friendly.message}`, /Apple Vision|requested regions/);
  assert.match(raw, /Apple Vision OCR/);
});

test('user-facing lookup failures stay short and recoverable', () => {
  const network = singleScanUserFacingFailure('Scryfall network timeout');
  const unknown = singleScanUserFacingFailure('Native provider returned an internal exception');

  assert.deepEqual(network, {
    title: 'Lookup failed.',
    message: 'Check your connection, retake, or search manually.',
  });
  assert.deepEqual(unknown, {
    title: "Couldn't identify.",
    message: 'Retake the card or search manually.',
  });
  assert.doesNotMatch(`${unknown.title} ${unknown.message}`, /Native provider|internal exception/);
});

function centeredGuide() {
  return { left: 56, top: 70, width: 128, height: 179, ratio: 128 / 179 };
}

function frameWithCard(input: {
  cardWidth: number;
  cardHeight: number;
  x: number;
  y: number;
  brightness?: number;
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
      pixels[y * width + x] = edge ? 220 : input.flatCard ? brightness : Math.min(235, brightness + pattern);
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
