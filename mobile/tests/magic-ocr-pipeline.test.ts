import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildGuideAssistedCropMapping,
  buildMagicOcrSignals,
  buildOcrAwareMagicSearch,
  capTitleOnlyConfidence,
  confidenceLabel,
  normalizeMagicTitleOcr,
  parseMagicCollectorOcr,
  recognizeMagicStillCapture,
} from '../services/magic-ocr-pipeline.ts';
import type { MagicRecognitionResult } from '../services/magic-recognition-provider.ts';
import type { RecognitionCandidate } from '../services/scanner-intelligence.ts';
import type { NativeOcrResult } from '../modules/trading-docks-vision-ocr/index.ts';

const rhystic: RecognitionCandidate = {
  id: 'sf-rhystic-wot-25',
  name: 'Rhystic Study',
  setCode: 'WOT',
  setName: 'Wilds of Eldraine',
  collectorNumber: '25',
  finishes: ['normal', 'foil'],
  language: 'en',
  imageUrl: 'https://img.example/rhystic.jpg',
  confidence: 0.95,
  recognitionMode: 'assisted_capture',
  legalFinishes: ['normal', 'foil'],
  layout: 'normal',
  colorIdentity: ['U'],
};

const rhysticMystery: RecognitionCandidate = {
  ...rhystic,
  id: 'sf-rhystic-mystery-82',
  setCode: 'MB1',
  setName: 'Mystery Booster',
  collectorNumber: '82',
};

const brainstorm: RecognitionCandidate = {
  ...rhystic,
  id: 'sf-brainstorm',
  name: 'Brainstorm',
  setCode: 'STA',
  collectorNumber: '13',
};

const ocr: NativeOcrResult & { ok: true } = {
  ok: true,
  provider: 'apple_vision',
  fullText: 'Rhystic Study\nWOT 25 EN',
  latencyMs: 42,
  orientationUsed: 'up',
  warnings: [],
  observations: [
    { id: 'title:0', requestedRegionId: 'title', regionType: 'name', text: 'Rhystic Study', rawText: 'Rhystic Study', confidence: 91, bounds: { x: 0.1, y: 0.1, width: 0.7, height: 0.08 } },
    { id: 'collector:0', requestedRegionId: 'collector_info', regionType: 'collector_info', text: 'WOT 25 EN', rawText: 'WOT 25 EN', confidence: 82, bounds: { x: 0.1, y: 0.9, width: 0.5, height: 0.06 } },
  ],
};

test('guide-assisted crop mapping stays in bounds for portrait capture', () => {
  const mapping = buildGuideAssistedCropMapping({
    preview: { width: 390, height: 440 },
    image: { width: 3024, height: 4032 },
    guide: { left: 50, top: 78, width: 290, height: 405 },
  });
  assert.ok(mapping.cardCrop.x >= 0);
  assert.ok(mapping.cardCrop.y >= 0);
  assert.ok(mapping.cardCrop.x + mapping.cardCrop.width <= 1);
  assert.ok(mapping.regions.every((region) => region.x + region.width <= 1 && region.y + region.height <= 1));
});

test('guide-assisted crop mapping handles rotated landscape capture dimensions', () => {
  const mapping = buildGuideAssistedCropMapping({
    preview: { width: 430, height: 440 },
    image: { width: 4032, height: 3024 },
    guide: { left: 64, top: 46, width: 300, height: 420 },
    orientation: 'landscape',
  });
  assert.ok(mapping.imageScale > 0);
  assert.ok(mapping.regions.find((region) => region.id === 'collector_info'));
});

test('title OCR normalization preserves punctuation and adds conservative alternatives', () => {
  const normalized = normalizeMagicTitleOcr("  Teferi\u2019s   Protection  ");
  assert.equal(normalized.normalized, "Teferi's Protection");
  assert.ok(normalized.alternatives.includes("Teferi's Protection"));
});

test('collector OCR parses set code, collector number suffix, and language', () => {
  const parsed = parseMagicCollectorOcr('WOT 25a EN *');
  assert.equal(parsed.setCode, 'WOT');
  assert.equal(parsed.collectorNumber, '25A');
  assert.equal(parsed.language, 'en');
});

test('OCR signals preserve raw and normalized values', () => {
  const signals = buildMagicOcrSignals(ocr.observations);
  assert.equal(signals.rawTitle, 'Rhystic Study');
  assert.equal(signals.normalizedTitle, 'Rhystic Study');
  assert.equal(signals.rawCollectorText, 'WOT 25 EN');
  assert.equal(signals.collectorInfo?.collectorNumber, '25');
});

test('title-only recognition confidence is capped below high exact-printing confidence', () => {
  const recognition = recognitionResult(96);
  const capped = capTitleOnlyConfidence(recognition, false, false);
  assert.equal(capped.confidence.overall, 69);
  assert.equal(capped.confidence.requiresConfirmation, true);
  assert.equal(confidenceLabel(capped), 'manual_review_required');
});

test('OCR-aware Scryfall search falls back to fuzzy title candidates', async () => {
  const search = buildOcrAwareMagicSearch(async (query) => query.name === 'Rhystic Study' ? [] : [rhystic], ['Rhystic Stvdy']);
  const result = await search({ name: 'Rhystic Study', setCode: null, collectorNumber: null });
  assert.equal(result[0].id, 'sf-rhystic-wot-25');
});

test('still capture OCR returns top three and preserves missing pricing for session confirmation', async () => {
  const stages: string[] = [];
  const result = await recognizeMagicStillCapture({
    imageUri: 'file:///tmp/card.jpg',
    preview: { width: 390, height: 440 },
    image: { width: 3024, height: 4032 },
    guide: { left: 50, top: 78, width: 290, height: 405 },
    online: true,
    recognize: async () => ocr,
    searchCatalog: async () => [rhystic, rhysticMystery, brainstorm],
    cleanup: async () => ({ ok: true, deleted: true }),
    onStage: (stage) => stages.push(stage),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.candidates.length, 3);
  assert.equal(result.selected?.name, 'Rhystic Study');
  assert.equal(result.cleanup.deleted, true);
  assert.equal(result.recognition.explanation.some((line) => /Name OCR/.test(line)), true);
  assert.deepEqual(stages, ['reading_title', 'finding_card']);
});

test('still capture OCR exposes structured empty OCR failure and cleanup status', async () => {
  const result = await recognizeMagicStillCapture({
    imageUri: 'file:///tmp/card.jpg',
    preview: { width: 390, height: 440 },
    image: { width: 3024, height: 4032 },
    guide: { left: 50, top: 78, width: 290, height: 405 },
    online: true,
    recognize: async () => ({ ok: false, provider: 'apple_vision', code: 'empty_result', message: 'No text', latencyMs: 12, warnings: [] }),
    cleanup: async () => ({ ok: true, deleted: true }),
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, 'ocr_failed');
    assert.equal(result.cleanup?.deleted, true);
  }
});

function recognitionResult(overall: number): MagicRecognitionResult & { ok: true } {
  return {
    ok: true,
    selected: rhystic,
    candidates: [rhystic, rhysticMystery],
    source: 'injected',
    confidence: {
      overall,
      threshold: 82,
      requiresConfirmation: false,
      conflicts: [],
      signals: [
        { key: 'name_ocr', label: 'Name OCR', score: 96, weight: 0.22, evidence: 'Rhystic Study' },
      ],
    },
    explanation: ['Name OCR: 96/100 - Rhystic Study'],
  };
}
