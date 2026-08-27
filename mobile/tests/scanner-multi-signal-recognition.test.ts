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
  matchVisualDescriptor,
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

test('default Magic visual descriptor index loads production-scale offline regression records', () => {
  const index = defaultMagicVisualReferenceIndex();
  const metadata = defaultMagicVisualReferenceIndexMetadata();
  assert.ok(index.recordCount > 10000, `expected production-scale index, got ${index.recordCount}`);
  assert.equal(metadata.recordCount, index.recordCount);
  assert.equal(metadata.descriptorVersion, 'luma_phash_8x8_v1');
  assert.equal(metadata.normalizationVersion, 'scryfall_full_card_luma8_8x8_mean_v1');
  assert.ok(metadata.oracleIdentityCount > 30000, `expected broad identity coverage, got ${metadata.oracleIdentityCount}`);
  assert.ok(metadata.printingCount > metadata.recordCount, 'finish-equivalent printings should not all duplicate descriptors');
  for (const name of [
    'Incinerate',
    'Goblin War Strike',
    'Lightning Bolt',
    'Sol Ring',
    'Birds of Paradise',
    'Rhystic Study',
    'Runed Stalactite',
    'Krark-Clan Ironworks',
    'Ulalek, Fused Atrocity',
  ]) {
    assert.equal(index.records.some((record) => record.name === name), true, `${name} should be in the production index`);
  }
  assert.match(metadata.refreshCommand, /catalog:magic-visual-index/);
});

test('visual lookup can narrow candidates with usable OCR identity', () => {
  const index = buildVisualReferenceIndex(visualRecords);
  const broad = matchVisualDescriptor(index, { algorithm: 'luma_phash_8x8_v1', hash: 'aa00aa55ff00aa55', source: 'live_normalized_crop' });
  const narrowed = matchVisualDescriptor(index, { algorithm: 'luma_phash_8x8_v1', hash: 'aa00aa55ff00aa55', source: 'live_normalized_crop' }, { oracleIds: [goblinOracleId] });
  assert.equal(broad?.candidatesConsidered, 2);
  assert.equal(narrowed?.candidatesConsidered, 1);
  assert.equal(narrowed?.record?.name, 'Goblin War Strike');
});

test('OCR-only strong identity becomes review when visual evidence is unavailable', () => {
  const result = recognizeWithMultiSignal({
    geometry: goodGeometry('ff00aa55ff00aa55'),
    descriptor: null,
    visualIndex: null,
    ocr: createOcrIdentitySignal({ rawText: 'Goblin War Strike', normalizedText: 'Goblin War Strike', confidence: 92 }),
    printingCandidates: [goblinPrinting],
  });
  assert.equal(result.status, 'append_identity');
  assert.equal(result.identityName, 'Goblin War Strike');
  assert.equal(result.confidence.requiresConfirmation, false);
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
  assert.equal(result.status, 'append_identity');
  assert.equal(result.identityName, 'Incinerate');
  assert.equal(result.diagnostics.visualCandidate, null);
});

test('strong OCR title beats an unrelated visual nearest neighbor', () => {
  const index = buildVisualReferenceIndex([
    {
      oracleId: 'raff-oracle',
      scryfallId: 'raff-visual',
      name: 'Raff Security Officer',
      setCode: 'MSH',
      collectorNumber: '0033',
      descriptor: { algorithm: 'luma_phash_8x8_v1', hash: 'aaaaaaaaaaaaaaaa', source: 'reference_image' },
    },
    {
      oracleId: 'mycoloth-oracle',
      scryfallId: 'mycoloth-visual',
      name: 'Mycoloth',
      setCode: 'ALA',
      collectorNumber: '163',
      descriptor: { algorithm: 'luma_phash_8x8_v1', hash: 'aaaaaaaaaaaaaaab', source: 'reference_image' },
    },
  ]);
  const result = recognizeWithMultiSignal({
    geometry: goodGeometry('aaaaaaaaaaaaaaaa'),
    descriptor: { algorithm: 'luma_phash_8x8_v1', hash: 'aaaaaaaaaaaaaaab', source: 'live_normalized_crop' },
    visualIndex: index,
    ocr: createOcrIdentitySignal({ rawText: 'Raff Security Officer', normalizedText: 'Raff Security Officer', confidence: 96 }),
    printingCandidates: [{
      id: 'raff-security-officer-printing',
      oracleId: 'raff-oracle',
      name: 'Raff Security Officer',
      setCode: 'MSH',
      setName: 'Mystery Set',
      collectorNumber: '0033',
      finishes: ['normal'],
      language: 'en',
      imageUrl: null,
      confidence: 0.9,
      recognitionMode: 'assisted_capture',
      legalFinishes: ['normal'],
      layout: 'portrait',
      colorIdentity: ['W', 'U'],
    }],
  });

  assert.equal(result.status, 'append_identity');
  assert.equal(result.identityName, result.diagnostics.ocrCandidate);
  assert.notEqual(result.identityName, 'Mycoloth');
  assert.equal(result.diagnostics.visualCandidate, null);
});

test('low absolute visual similarity does not surface a named guess', () => {
  const index = buildVisualReferenceIndex([
    {
      oracleId: 'low-a',
      scryfallId: 'low-a',
      name: 'Card Alpha',
      setCode: 'TST',
      collectorNumber: '1',
      descriptor: { algorithm: 'luma_phash_8x8_v1', hash: '0000000000000000', source: 'reference_image' },
    },
    {
      oracleId: 'low-b',
      scryfallId: 'low-b',
      name: 'Card Beta',
      setCode: 'TST',
      collectorNumber: '2',
      descriptor: { algorithm: 'luma_phash_8x8_v1', hash: 'ffffffffffffffff', source: 'reference_image' },
    },
  ]);
  const result = recognizeWithMultiSignal({
    geometry: goodGeometry('aaaaaaaaaaaaaaaa'),
    descriptor: { algorithm: 'luma_phash_8x8_v1', hash: 'aaaaaaaaaaaaaaaa', source: 'live_normalized_crop' },
    visualIndex: index,
    ocr: createOcrIdentitySignal({ rawText: null, normalizedText: null, confidence: null }),
  });

  assert.equal(result.status, 'continue_scanning');
  assert.equal(result.identityName, null);
  assert.equal(result.diagnostics.visualCandidate, null);
});

test('small top-1 top-2 visual margin keeps the scanner reading instead of guessing', () => {
  const index = buildVisualReferenceIndex([
    {
      oracleId: 'margin-a',
      scryfallId: 'margin-a',
      name: 'Margin Card A',
      setCode: 'TST',
      collectorNumber: '10',
      descriptor: { algorithm: 'luma_phash_8x8_v1', hash: '0000000000000000', source: 'reference_image' },
    },
    {
      oracleId: 'margin-b',
      scryfallId: 'margin-b',
      name: 'Margin Card B',
      setCode: 'TST',
      collectorNumber: '11',
      descriptor: { algorithm: 'luma_phash_8x8_v1', hash: '0000000000000001', source: 'reference_image' },
    },
  ]);
  const result = recognizeWithMultiSignal({
    geometry: goodGeometry('0000000000000000'),
    descriptor: { algorithm: 'luma_phash_8x8_v1', hash: '0000000000000007', source: 'live_normalized_crop' },
    visualIndex: index,
    ocr: createOcrIdentitySignal({ rawText: null, normalizedText: null, confidence: null }),
  });

  assert.equal(result.status, 'continue_scanning');
  assert.equal(result.identityName, null);
  assert.equal(result.visualCandidates.length, 2);
  assert.equal(result.diagnostics.visualCandidate, null);
});

test('visual-only identification still works when the match is strong and unambiguous', () => {
  const index = buildVisualReferenceIndex([
    {
      oracleId: 'visual-only',
      scryfallId: 'visual-only',
      name: 'Visual Only Card',
      setCode: 'TST',
      collectorNumber: '99',
      descriptor: { algorithm: 'luma_phash_8x8_v1', hash: '1234567890abcdef', source: 'reference_image' },
    },
  ]);
  const result = recognizeWithMultiSignal({
    geometry: goodGeometry('1234567890abcdef'),
    descriptor: { algorithm: 'luma_phash_8x8_v1', hash: '1234567890abcdef', source: 'live_normalized_crop' },
    visualIndex: index,
    ocr: createOcrIdentitySignal({ rawText: null, normalizedText: null, confidence: null }),
  });

  assert.equal(result.status, 'append_identity');
  assert.equal(result.identityName, 'Visual Only Card');
});

test('weak geometry still carries identity evidence through fusion instead of hard rejection', () => {
  const index = buildVisualReferenceIndex(visualRecords);
  const result = recognizeWithMultiSignal({
    geometry: { ...goodGeometry('ff00aa55ff00aa55'), cardDetected: false, qualityScore: 0.2, normalizedCrop: null, blockers: ['NO_CARD'] },
    descriptor: { algorithm: 'luma_phash_8x8_v1', hash: 'ff00aa55ff00aa55', source: 'live_normalized_crop' },
    visualIndex: index,
    ocr: createOcrIdentitySignal({ rawText: 'Goblin War Strike', normalizedText: 'Goblin War Strike', confidence: 95 }),
  });
  assert.equal(result.status, 'append_identity');
  assert.equal(result.identityName, 'Goblin War Strike');
  assert.equal(result.diagnostics.blockers.includes('NO_CARD'), true);
});

test('purely unusable frames still reject when no identity evidence exists', () => {
  const result = recognizeWithMultiSignal({
    geometry: { cardDetected: false, geometryScore: 0.05, qualityScore: 0.12, perspectiveCorrected: false, normalizedCrop: null, blockers: ['NO_CARD', 'NO_NORMALIZED_CROP'] },
    descriptor: null,
    visualIndex: null,
    ocr: createOcrIdentitySignal({ rawText: null, normalizedText: null, confidence: null }),
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
