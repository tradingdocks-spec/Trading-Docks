import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildGuideAssistedCropMapping,
  buildMagicOcrSignals,
  buildMagicOcrRegions,
  buildOcrAwareMagicSearch,
  capTitleOnlyConfidence,
  confidenceLabel,
  mapPreviewGuideToCapturedImage,
  normalizeMagicTitleOcr,
  parseMagicCollectorOcr,
  rankMagicTitleObservations,
  recognizeSequentialMagicTitle,
  recognizeMagicStillCapture,
} from '../services/magic-ocr-pipeline.ts';
import type { MagicRecognitionResult } from '../services/magic-recognition-provider.ts';
import { MagicCatalogLookupError } from '../services/magic-recognition-provider.ts';
import type { RecognitionCandidate } from '../services/scanner-intelligence.ts';
import type { NativeOcrResult } from '../modules/trading-docks-vision-ocr/index.ts';

const rhystic: RecognitionCandidate = {
  id: 'sf-rhystic-wot-25',
  oracleId: 'oracle-rhystic',
  name: 'Rhystic Study',
  setCode: 'WOT',
  setName: 'Wilds of Eldraine',
  collectorNumber: '25',
  finishes: ['normal', 'foil'],
  language: 'en',
  imageUrl: 'https://img.example/rhystic.jpg',
  confidence: 0.95,
  recognitionMode: 'assisted_capture',
  marketPrice: { usd: 41.24, usdFoil: 65.5, usdEtched: null, source: 'scryfall', fetchedAt: '2026-08-06T00:00:00.000Z' },
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
    { id: 'title:0', requestedRegionId: 'title_primary', regionType: 'name', text: 'Rhystic Study', rawText: 'Rhystic Study', confidence: 91, bounds: { x: 0.1, y: 0.1, width: 0.7, height: 0.08 } },
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
  assert.equal(mapping.normalizedImage.rotatedFromRaw, true);
  assert.ok(mapping.regions.find((region) => region.id === 'collector_info'));
});

test('preview guide maps through aspect-fill offsets and keeps title crop inside card crop', () => {
  const mapping = mapPreviewGuideToCapturedImage({
    preview: { width: 393, height: 542 },
    image: { width: 4032, height: 3024 },
    guide: { left: 82, top: 82, width: 229, height: 320 },
    orientation: 'portrait',
  });
  assert.equal(mapping.previewContentFit, 'cover');
  assert.equal(mapping.normalizedImage.width, 3024);
  assert.equal(mapping.normalizedImage.height, 4032);
  assert.equal(mapping.normalizedImage.rotatedFromRaw, true);
  assert.ok(mapping.displayedImage.offsetX < 0);
  assert.ok(mapping.titleCrop.x >= mapping.cardCrop.x);
  assert.ok(mapping.titleCrop.y >= mapping.cardCrop.y);
  assert.ok(mapping.titleCrop.x + mapping.titleCrop.width <= mapping.cardCrop.x + mapping.cardCrop.width);
  assert.ok(mapping.titleCrop.y + mapping.titleCrop.height <= mapping.cardCrop.y + mapping.cardCrop.height);
  assert.ok(mapping.titleCropPixels.width > 0);
  assert.ok(mapping.cardCropPixels.height > mapping.titleCropPixels.height);
});

test('Magic OCR region order uses primary, expanded, upper-card, full-card fallback', () => {
  const regions = buildMagicOcrRegions({ x: 0.1, y: 0.08, width: 0.8, height: 0.86 });
  assert.deepEqual(
    regions.filter((region) => region.regionType === 'name').map((region) => region.id),
    ['title_primary', 'title_expanded', 'upper_card', 'full_card'],
  );
});

test('title OCR normalization preserves punctuation and adds conservative alternatives', () => {
  const normalized = normalizeMagicTitleOcr("  Teferi\u2019s   Protection  ");
  assert.equal(normalized.normalized, "Teferi's Protection");
  assert.ok(normalized.alternatives.includes("Teferi's Protection"));
});

test('title OCR normalization removes isolated mana and numeric noise without hardcoded names', () => {
  const normalized = normalizeMagicTitleOcr('{U}\n7\nBrainstorm\nInstant');
  assert.equal(normalized.normalized, 'Brainstorm');
  assert.equal(normalized.alternatives.includes('Brainstorm'), true);
});

test('title ranking falls back from empty primary to expanded and upper-card attempts before full card', () => {
  const attempts = rankMagicTitleObservations([
    { id: 'primary-empty', requestedRegionId: 'title_primary', regionType: 'name', text: 'U', rawText: 'U', confidence: 94, bounds: { x: 0.1, y: 0.06, width: 0.7, height: 0.1 } },
    { id: 'expanded', requestedRegionId: 'title_expanded', regionType: 'name', text: 'Brainstorm', rawText: 'Brainstorm', confidence: 72, bounds: { x: 0.1, y: 0.08, width: 0.76, height: 0.12 } },
    { id: 'upper', requestedRegionId: 'upper_card', regionType: 'name', text: 'Brainstorm', rawText: 'Brainstorm', confidence: 70, bounds: { x: 0.05, y: 0.07, width: 0.9, height: 0.25 } },
    { id: 'full-card', requestedRegionId: 'full_card', regionType: 'name', text: 'Brainstorm Instant Draw three cards', rawText: 'Brainstorm Instant Draw three cards', confidence: 88, bounds: { x: 0.1, y: 0.1, width: 0.7, height: 0.8 } },
  ]);
  assert.equal(attempts[0].id, 'title_expanded');
  assert.equal(attempts[0].normalizedText, 'Brainstorm');
  assert.equal(attempts.some((attempt) => attempt.id === 'full_card'), true);
  assert.equal(attempts.find((attempt) => attempt.id === 'title_primary')?.reason, 'rejected_noise');
});

test('sequential OCR stops after a strong title without collector OCR on the critical path', async () => {
  const calls: string[] = [];
  const result = await recognizeSequentialMagicTitle({
    imageUri: 'file:///tmp/card.jpg',
    regions: buildMagicOcrRegions({ x: 0.1, y: 0.08, width: 0.8, height: 0.86 }),
    recognize: async (request) => {
      calls.push(request.regions[0].id);
      if (request.regions[0].id === 'title_primary') {
        return {
          ok: true,
          provider: 'apple_vision',
          fullText: 'Brainstorm',
          latencyMs: 8,
          orientationUsed: 'up',
          warnings: [],
          observations: [{ id: 'primary:0', requestedRegionId: 'title_primary', regionType: 'name', text: 'Brainstorm', rawText: 'Brainstorm', confidence: 92, bounds: { x: 0.1, y: 0.06, width: 0.7, height: 0.08 } }],
        };
      }
      return {
        ok: false,
        provider: 'apple_vision',
        code: 'empty_result',
        message: 'No collector text.',
        latencyMs: 5,
        warnings: [],
      };
    },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(calls, ['title_primary']);
  if (result.ok) {
    assert.equal(result.observations[0].requestedRegionId, 'title_primary');
    assert.doesNotMatch(result.warnings.join(' '), /Optional collector OCR failed/);
  }
});

test('sequential OCR can opt into collector OCR for background refinement', async () => {
  const calls: string[] = [];
  const result = await recognizeSequentialMagicTitle({
    imageUri: 'file:///tmp/card.jpg',
    regions: buildMagicOcrRegions({ x: 0.1, y: 0.08, width: 0.8, height: 0.86 }),
    includeCollectorOcr: true,
    recognize: async (request) => {
      calls.push(request.regions[0].id);
      if (request.regions[0].id === 'collector_info') {
        return {
          ok: true,
          provider: 'apple_vision',
          fullText: 'STA 13 EN',
          latencyMs: 6,
          orientationUsed: 'up',
          warnings: [],
          observations: [{ id: 'collector:0', requestedRegionId: 'collector_info', regionType: 'collector_info', text: 'STA 13 EN', rawText: 'STA 13 EN', confidence: 82, bounds: { x: 0.1, y: 0.9, width: 0.5, height: 0.06 } }],
        };
      }
      return {
        ok: true,
        provider: 'apple_vision',
        fullText: 'Brainstorm',
        latencyMs: 8,
        orientationUsed: 'up',
        warnings: [],
        observations: [{ id: 'primary:0', requestedRegionId: 'title_primary', regionType: 'name', text: 'Brainstorm', rawText: 'Brainstorm', confidence: 92, bounds: { x: 0.1, y: 0.06, width: 0.7, height: 0.08 } }],
      };
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(calls, ['title_primary', 'collector_info']);
  if (result.ok) assert.equal(result.observations.some((observation) => observation.regionType === 'collector_info'), true);
});

test('sequential OCR falls back through expanded, upper-card, and full-card regions', async () => {
  const calls: string[] = [];
  const result = await recognizeSequentialMagicTitle({
    imageUri: 'file:///tmp/card.jpg',
    regions: buildMagicOcrRegions({ x: 0.1, y: 0.08, width: 0.8, height: 0.86 }),
    recognize: async (request) => {
      const id = request.regions[0].id;
      calls.push(id);
      if (id !== 'full_card') {
        return { ok: false, provider: 'apple_vision', code: 'empty_result', message: 'empty', latencyMs: 2, warnings: [] };
      }
      return {
        ok: true,
        provider: 'apple_vision',
        fullText: 'Rhystic Study',
        latencyMs: 10,
        orientationUsed: 'up',
        warnings: [],
        observations: [{ id: 'full:0', requestedRegionId: 'full_card', regionType: 'name', text: 'Rhystic Study', rawText: 'Rhystic Study', confidence: 84, bounds: { x: 0.1, y: 0.08, width: 0.7, height: 0.5 } }],
      };
    },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(calls, ['title_primary', 'title_expanded', 'upper_card', 'full_card']);
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
  assert.equal(signals.selectedTitleAttemptId, 'title_primary');
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

test('valid OCR title produces Scryfall query diagnostics', async () => {
  const diagnostics: string[] = [];
  const result = await recognizeMagicStillCapture({
    imageUri: 'file:///tmp/card.jpg',
    preview: { width: 390, height: 440 },
    image: { width: 3024, height: 4032 },
    guide: { left: 50, top: 78, width: 290, height: 405 },
    online: true,
    recognize: async () => ocr,
    searchCatalog: async (query) => {
      diagnostics.push(`${query.name ?? ''}|${query.setCode ?? ''}|${query.collectorNumber ?? ''}`);
      return [rhystic];
    },
    cleanup: async () => ({ ok: true, deleted: true }),
  });
  assert.equal(result.ok, true);
  assert.deepEqual(diagnostics, ['rhystic study|WOT|25']);
  if (!result.ok) return;
  assert.equal(result.cropDiagnostics.selectedTitleAttemptId, 'title_primary');
  assert.equal(result.lookupDiagnostics.outcome, 'success');
  assert.ok(result.cropDiagnostics.titleCrops.upper_card.height > result.cropDiagnostics.titleCrops.title_primary.height);
});

test('title-only OCR produces capped candidates when collector data is missing', async () => {
  const titleOnlyOcr: NativeOcrResult & { ok: true } = {
    ...ocr,
    observations: [ocr.observations[0]],
  };
  const result = await recognizeMagicStillCapture({
    imageUri: 'file:///tmp/card.jpg',
    preview: { width: 390, height: 440 },
    image: { width: 3024, height: 4032 },
    guide: { left: 50, top: 78, width: 290, height: 405 },
    online: true,
    recognize: async () => titleOnlyOcr,
    searchCatalog: async () => [rhystic, rhysticMystery],
    cleanup: async () => ({ ok: true, deleted: true }),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.candidates.length, 2);
  assert.equal(result.recognition.confidence.overall, 69);
  assert.equal(result.recognition.confidence.requiresConfirmation, true);
});

test('empty OCR title produces a no-title state with lookup diagnostics', async () => {
  const noTitleOcr: NativeOcrResult & { ok: true } = {
    ...ocr,
    observations: [{ ...ocr.observations[0], text: '', rawText: '', confidence: 0 }],
  };
  const result = await recognizeMagicStillCapture({
    imageUri: 'file:///tmp/card.jpg',
    preview: { width: 390, height: 440 },
    image: { width: 3024, height: 4032 },
    guide: { left: 50, top: 78, width: 290, height: 405 },
    online: true,
    recognize: async () => noTitleOcr,
    cleanup: async () => ({ ok: true, deleted: true }),
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.lookupDiagnostics?.lookupErrorCode, 'no_title_read');
  assert.equal(result.lookupDiagnostics?.outcome, 'no_title');
  assert.match(result.reason, /No title read/);
  assert.equal(result.cropDiagnostics?.titleAttempts.every((attempt) => attempt.reason === 'rejected_noise'), true);
});

test('network failure produces a network lookup state', async () => {
  const result = await recognizeMagicStillCapture({
    imageUri: 'file:///tmp/card.jpg',
    preview: { width: 390, height: 440 },
    image: { width: 3024, height: 4032 },
    guide: { left: 50, top: 78, width: 290, height: 405 },
    online: true,
    recognize: async () => ocr,
    searchCatalog: async () => {
      throw new MagicCatalogLookupError('network_unavailable', 'Network unavailable while searching Scryfall.');
    },
    cleanup: async () => ({ ok: true, deleted: true }),
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.lookupDiagnostics?.lookupErrorCode, 'network_unavailable');
  assert.equal(result.lookupDiagnostics?.outcome, 'network_unavailable');
  assert.match(result.reason, /Network unavailable/);
});

test('cancelled Scryfall lookup produces a structured cancelled state', async () => {
  const result = await recognizeMagicStillCapture({
    imageUri: 'file:///tmp/card.jpg',
    preview: { width: 390, height: 440 },
    image: { width: 3024, height: 4032 },
    guide: { left: 50, top: 78, width: 290, height: 405 },
    online: true,
    recognize: async () => ocr,
    searchCatalog: async () => {
      const error = new Error('Cancelled');
      error.name = 'AbortError';
      throw error;
    },
    cleanup: async () => ({ ok: true, deleted: true }),
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.lookupDiagnostics?.lookupErrorCode, 'cancelled');
  assert.equal(result.lookupDiagnostics?.outcome, 'cancelled');
});


test('empty Scryfall response produces a no-match state', async () => {
  const result = await recognizeMagicStillCapture({
    imageUri: 'file:///tmp/card.jpg',
    preview: { width: 390, height: 440 },
    image: { width: 3024, height: 4032 },
    guide: { left: 50, top: 78, width: 290, height: 405 },
    online: true,
    recognize: async () => ocr,
    searchCatalog: async () => [],
    cleanup: async () => ({ ok: true, deleted: true }),
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.lookupDiagnostics?.lookupErrorCode, 'no_candidate_found');
  assert.equal(result.lookupDiagnostics?.outcome, 'no_match');
  assert.match(result.reason, /No matching card/);
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
  assert.equal(result.selected?.oracleId, 'oracle-rhystic');
  assert.equal(result.selected?.marketPrice?.usd, 41.24);
  assert.equal(result.selected?.marketPrice?.usdFoil, 65.5);
  assert.equal(result.cleanup.deleted, true);
  assert.equal(result.cropDiagnostics.titleAttempts[0].normalizedText, 'Rhystic Study');
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
