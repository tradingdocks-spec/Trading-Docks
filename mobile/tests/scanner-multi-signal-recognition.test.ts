import assert from 'node:assert/strict';
import test from 'node:test';

import type { NormalizedCardCrop } from '../services/live-card-recognition.ts';
import type { RecognitionCandidate } from '../services/scanner-intelligence.ts';
import {
  benchmarkRecognitionApproaches,
  buildVisualReferenceIndex,
  createOcrIdentitySignal,
  defaultMagicVisualReferenceIndex,
  defaultMagicVisualReferenceIndexMetadata,
  descriptorFromNormalizedCrop,
  recognizeWithMultiSignal,
  refinePrintingCandidates,
  selectBestFrameBufferEntry,
  type CardGeometryEvidence,
  type VisualReferenceRecord,
} from '../services/scanner-multi-signal-recognition.ts';

const goblinOracleId = '4e01f678-198d-4ed9-a27f-cc028f26d24b';
const incinerateOracleId = '7bbca13f-8c4e-45a2-9656-9e822adb3af2';

const goblinPrinting: RecognitionCandidate = {
  id: 'goblin-war-strike-scryfall-id',
  oracleId: goblinOracleId,
  name: 'Goblin War Strike',
  setCode: 'SCG',
  setName: 'Scourge',
  collectorNumber: '96',
  finishes: ['normal', 'foil'],
  language: 'en',
  imageUrl: null,
  confidence: 0.92,
  recognitionMode: 'assisted_capture',
  legalFinishes: ['normal', 'foil'],
  layout: 'portrait',
  colorIdentity: ['R'],
};

const incineratePrinting: RecognitionCandidate = {
  id: 'incinerate-scryfall-id',
  oracleId: incinerateOracleId,
  name: 'Incinerate',
  setCode: 'M12',
  setName: 'Magic 2012',
  collectorNumber: '146',
  finishes: ['normal', 'foil'],
  language: 'en',
  imageUrl: null,
  confidence: 0.9,
  recognitionMode: 'assisted_capture',
  legalFinishes: ['normal', 'foil'],
  layout: 'portrait',
  colorIdentity: ['R'],
};

const visualRecords: VisualReferenceRecord[] = [
  {
    oracleId: goblinOracleId,
    scryfallId: goblinPrinting.id,
    name: 'Goblin War Strike',
    setCode: 'SCG',
    collectorNumber: '96',
    descriptor: { algorithm: 'luma_phash_8x8_v1', hash: 'ff00aa55ff00aa55', source: 'reference_image' },
  },
  {
    oracleId: incinerateOracleId,
    scryfallId: incineratePrinting.id,
    name: 'Incinerate',
    setCode: 'M12',
    collectorNumber: '146',
    descriptor: { algorithm: 'luma_phash_8x8_v1', hash: '0000aa55ff00aa55', source: 'reference_image' },
  },
];

test('visual fingerprint plus weak OCR can append card identity without waiting for exact printing', () => {
  const index = buildVisualReferenceIndex(visualRecords);
  const result = recognizeWithMultiSignal({
    geometry: goodGeometry('ff00aa55ff00aa55'),
    descriptor: { algorithm: 'luma_phash_8x8_v1', hash: 'ff00aa55ff00aa54', source: 'live_normalized_crop' },
    visualIndex: index,
    ocr: createOcrIdentitySignal({ rawText: 'G0blin War Strlke', normalizedText: 'G0blin War Strlke', confidence: 38 }),
    printingCandidates: [goblinPrinting, incineratePrinting],
  });
  assert.equal(result.status, 'append_identity');
  assert.equal(result.identityName, 'Goblin War Strike');
  assert.equal(result.confidenceBand, 'high');
  assert.equal(result.printing.selected?.id, goblinPrinting.id);
  assert.equal(result.printing.ambiguous, false);
});

test('default Magic visual descriptor index loads offline regression records', () => {
  const index = defaultMagicVisualReferenceIndex();
  const metadata = defaultMagicVisualReferenceIndexMetadata();
  assert.equal(index.recordCount, 9);
  assert.equal(metadata.recordCount, 9);
  assert.equal(index.records.some((record) => record.name === 'Goblin War Strike'), true);
  assert.equal(index.records.some((record) => record.name === 'Ulalek, Fused Atrocity'), true);
  assert.match(metadata.refreshCommand, /catalog:magic-visual-descriptors/);
});

test('OCR-only strong identity becomes review when visual evidence is unavailable', () => {
  const result = recognizeWithMultiSignal({
    geometry: goodGeometry('ff00aa55ff00aa55'),
    descriptor: null,
    visualIndex: null,
    ocr: createOcrIdentitySignal({ rawText: 'Goblin War Strike', normalizedText: 'Goblin War Strike', confidence: 92 }),
    printingCandidates: [goblinPrinting],
  });
  assert.equal(result.status, 'review');
  assert.equal(result.identityName, 'Goblin War Strike');
  assert.equal(result.confidence.requiresConfirmation, true);
});

test('visual and OCR conflict routes to review instead of silently choosing a card', () => {
  const index = buildVisualReferenceIndex(visualRecords);
  const result = recognizeWithMultiSignal({
    geometry: goodGeometry('ff00aa55ff00aa55'),
    descriptor: { algorithm: 'luma_phash_8x8_v1', hash: 'ff00aa55ff00aa55', source: 'live_normalized_crop' },
    visualIndex: index,
    ocr: createOcrIdentitySignal({ rawText: 'Incinerate', normalizedText: 'Incinerate', confidence: 95 }),
    printingCandidates: [goblinPrinting, incineratePrinting],
  });
  assert.equal(result.status, 'review');
  assert.equal(result.diagnostics.conflict, true);
  assert.match(result.confidence.conflicts[0], /Visual and OCR/);
});

test('unusable geometry rejects the frame before identity fusion', () => {
  const index = buildVisualReferenceIndex(visualRecords);
  const result = recognizeWithMultiSignal({
    geometry: { ...goodGeometry('ff00aa55ff00aa55'), cardDetected: false, qualityScore: 0.2, normalizedCrop: null, blockers: ['NO_CARD'] },
    descriptor: { algorithm: 'luma_phash_8x8_v1', hash: 'ff00aa55ff00aa55', source: 'live_normalized_crop' },
    visualIndex: index,
    ocr: createOcrIdentitySignal({ rawText: 'Goblin War Strike', normalizedText: 'Goblin War Strike', confidence: 95 }),
  });
  assert.equal(result.status, 'reject_frame');
  assert.equal(result.diagnostics.blockers.includes('NO_CARD'), true);
});

test('best-frame buffer prefers sharp stable geometry over latest frame', () => {
  const older = { frameId: 'older-good', capturedAt: 1000, geometry: goodGeometry('ff00aa55ff00aa55'), descriptor: descriptorFromNormalizedCrop(crop('ff00aa55ff00aa55')) };
  const latest = { frameId: 'latest-blurry', capturedAt: 1200, geometry: { ...goodGeometry('ff00aa55ff00aa55'), qualityScore: 0.4, blockers: ['BLUR'] }, descriptor: descriptorFromNormalizedCrop(crop('ff00aa55ff00aa55')) };
  assert.equal(selectBestFrameBufferEntry([older, latest])?.frameId, 'older-good');
});

test('printing refinement scopes candidates after identity before selecting exact printing', () => {
  const selected = refinePrintingCandidates({
    oracleId: goblinOracleId,
    name: 'Goblin War Strike',
    candidates: [goblinPrinting, incineratePrinting],
    visual: {
      record: visualRecords[0],
      similarity: 0.95,
      distance: 3,
      candidatesConsidered: 2,
      algorithm: 'luma_phash_8x8_v1',
    },
  });
  assert.equal(selected.selected?.id, goblinPrinting.id);
  assert.equal(selected.candidates.length, 1);
});

test('benchmark report compares OCR-only and visual-fingerprint paths without inventing embedding results', () => {
  const report = benchmarkRecognitionApproaches([
    {
      id: 'goblin-war-strike-clear',
      expectedName: 'Goblin War Strike',
      ocrOnly: { name: null, latencyMs: 42 },
      visualFingerprintOcr: { name: 'Goblin War Strike', latencyMs: 18, indexBytes: 128 },
    },
    {
      id: 'incinerate-clear',
      expectedName: 'Incinerate',
      ocrOnly: { name: 'Incinerate', latencyMs: 37 },
      visualFingerprintOcr: { name: 'Incinerate', latencyMs: 17, indexBytes: 128 },
    },
  ]);
  assert.equal(report.approaches.ocr_only.top1Accuracy, 0.5);
  assert.equal(report.approaches.visual_fingerprint_ocr.top1Accuracy, 1);
  assert.equal(report.approaches.compact_embedding_ocr.measured, false);
  assert.match(report.approaches.compact_embedding_ocr.rejectedReason ?? '', /No native compact-embedding runtime/);
});

function goodGeometry(hash: string): CardGeometryEvidence {
  return {
    cardDetected: true,
    geometryScore: 0.92,
    qualityScore: 0.88,
    perspectiveCorrected: true,
    normalizedCrop: crop(hash),
    blockers: [],
  };
}

function crop(hash: string): NormalizedCardCrop {
  return {
    frameId: `frame-${hash}`,
    bounds: { x: 40, y: 60, width: 128, height: 179 },
    corners: [
      { x: 0.16, y: 0.16, visible: true },
      { x: 0.69, y: 0.16, visible: true },
      { x: 0.69, y: 0.66, visible: true },
      { x: 0.16, y: 0.66, visible: true },
    ],
    orientation: 'portrait',
    perspectiveCorrected: true,
    fingerprint: hash,
  };
}
