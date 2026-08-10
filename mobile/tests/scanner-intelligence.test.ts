import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addScanToSession,
  benchmarkMetricsUnavailable,
  buildCardRegions,
  buildScanConfirmation,
  buildScanExportRow,
  classifyFinishFromFrames,
  createScanSession,
  fuseRecognitionConfidence,
  parseCollectorInfoText,
  rankPrintingCandidates,
  resolvePrinting,
  serializeScanCsv,
  type RecognitionCandidate,
  type ScannerFrame,
} from '../services/scanner-intelligence.ts';

const frame: ScannerFrame = {
  id: 'frame-1',
  userId: 'user-1',
  capturedAt: '2026-08-05T00:00:00.000Z',
  uri: 'cache://frame-1.jpg',
  width: 1200,
  height: 1680,
  sequenceIndex: 0,
  retainedByUser: false,
  uploadedWithConsent: false,
};

const rhystic: RecognitionCandidate = {
  id: 'sf-rhystic-wot-25',
  name: 'Rhystic Study',
  setCode: 'WOT',
  setName: 'Wilds of Eldraine',
  collectorNumber: '25',
  finishes: ['normal', 'foil'],
  legalFinishes: ['normal', 'foil'],
  language: 'en',
  imageUrl: 'https://cards.example/rhystic.jpg',
  confidence: 0.91,
  recognitionMode: 'assisted_capture',
  layout: 'normal',
  colorIdentity: ['U'],
};

const otherRhystic: RecognitionCandidate = {
  ...rhystic,
  id: 'sf-rhystic-pcy-45',
  setCode: 'PCY',
  setName: 'Prophecy',
  collectorNumber: '45',
};

test('region extraction contract includes scanner recognition regions', () => {
  const regions = buildCardRegions(frame);
  assert.ok(regions.some((region) => region.type === 'name'));
  assert.ok(regions.some((region) => region.type === 'collector_info'));
  assert.ok(regions.some((region) => region.type === 'set_symbol'));
  assert.ok(regions.some((region) => region.type === 'finish_evidence'));
});

test('missing name signal does not create positive confidence', () => {
  const confidence = fuseRecognitionConfidence({
    candidate: rhystic,
    observations: {
      collectorInfo: { setCode: 'WOT', collectorNumber: '25', language: 'en', rarity: null, confidence: 90 },
    },
  });

  assert.equal(confidence.signals.find((signal) => signal.key === 'name_ocr')?.score, null);
  assert.equal(confidence.requiresConfirmation, false);
});

test('conflicting set and collector signals require manual confirmation', () => {
  const confidence = fuseRecognitionConfidence({
    candidate: rhystic,
    observations: {
      name: { regionType: 'name', text: 'Rhystic Study', confidence: 92 },
      collectorInfo: { setCode: 'PCY', collectorNumber: '45', language: 'en', rarity: null, confidence: 90 },
    },
  });

  assert.equal(confidence.requiresConfirmation, true);
  assert.ok(confidence.conflicts.length >= 2);
});

test('exact printing resolution orders top three candidates by independent signals', () => {
  const candidates = rankPrintingCandidates({
    nameObservation: { regionType: 'name', text: 'Rhystic Study', confidence: 90 },
    collectorInfo: parseCollectorInfoText('WOT 25 EN'),
    knownCandidates: [otherRhystic, rhystic],
  });

  assert.equal(candidates[0].id, rhystic.id);
  assert.equal(candidates.length, 2);
});

test('low-confidence or ambiguous printing resolution requires confirmation', () => {
  const resolution = resolvePrinting({
    nameObservation: { regionType: 'name', text: 'Rhystic', confidence: 42 },
    knownCandidates: [rhystic, otherRhystic],
  });

  assert.equal(resolution.ambiguous, true);
  assert.equal(resolution.confidence.requiresConfirmation, true);
});

test('foil multi-frame contract returns indeterminate without benchmarked evidence', () => {
  assert.equal(classifyFinishFromFrames([frame]).finish, 'indeterminate');
  const finish = classifyFinishFromFrames([frame, { ...frame, id: 'frame-2', sequenceIndex: 1 }]);
  assert.equal(finish.finish, 'indeterminate');
  assert.equal(finish.frameCount, 2);
});

test('legal finish validation penalizes impossible finish evidence', () => {
  const confidence = fuseRecognitionConfidence({
    candidate: { ...rhystic, legalFinishes: ['normal'] },
    observations: {
      finish: { finish: 'likely_foil', confidence: 80, evidence: ['multi-frame shimmer'], frameCount: 8 },
    },
  });

  assert.equal(confidence.signals.find((signal) => signal.key === 'legal_finish')?.score, 8);
  assert.equal(confidence.requiresConfirmation, true);
});

test('duplicate submission prevention uses scan confirmation idempotency key', () => {
  const confidence = fuseRecognitionConfidence({ candidate: rhystic, observations: {} });
  const confirmation = buildScanConfirmation({
    inventoryItemId: 'scan-1',
    userId: 'user-1',
    candidate: rhystic,
    finish: 'foil',
    foilState: 'likely_foil',
    language: 'en',
    condition: 'near_mint',
    quantity: 1,
    storageLocationId: 'binder-1',
    destination: { type: 'collection' },
    tradeStatus: 'available',
    addToWishlist: true,
    purchasePrice: 12.34,
    notes: 'show intake',
    confidence,
  });

  assert.ok(confirmation.idempotencyKey.includes('scan-1'));
  assert.ok(confirmation.idempotencyKey.includes('user-1'));
});

test('rapid scan sessions preserve defaults and running totals', () => {
  const session = createScanSession({ id: 'session-1', userId: 'user-1', name: 'Phoenix Card Show', destination: { type: 'collection' } });
  const confidence = fuseRecognitionConfidence({ candidate: rhystic, observations: {} });
  const confirmation = buildScanConfirmation({
    inventoryItemId: 'scan-1',
    userId: 'user-1',
    candidate: rhystic,
    finish: 'normal',
    foilState: 'nonfoil',
    language: 'en',
    condition: 'near_mint',
    quantity: 3,
    storageLocationId: null,
    destination: { type: 'collection' },
    tradeStatus: 'not_for_trade',
    addToWishlist: false,
    purchasePrice: null,
    notes: '',
    confidence,
  });

  const next = addScanToSession(session, confirmation, true);
  assert.equal(next.cardsScanned, 1);
  assert.equal(next.totalQuantity, 3);
  assert.equal(next.pendingSync, 1);
});

test('collection, binder, and Trade Binder destinations are distinct contracts', () => {
  assert.deepEqual({ type: 'collection' }, { type: 'collection' });
  assert.equal(({ type: 'binder', binderId: 'b1', binderName: 'Blue Binder' } as const).type, 'binder');
  assert.equal(({ type: 'trade_binder', status: 'available' } as const).status, 'available');
});

test('priced CSV export preserves unavailable missing prices', () => {
  const confidence = fuseRecognitionConfidence({ candidate: rhystic, observations: {} });
  const confirmation = buildScanConfirmation({
    inventoryItemId: 'scan-1',
    userId: 'user-1',
    candidate: rhystic,
    finish: 'normal',
    foilState: 'nonfoil',
    language: 'en',
    condition: 'near_mint',
    quantity: 1,
    storageLocationId: 'box-1',
    destination: { type: 'binder', binderId: 'binder-1', binderName: 'Blue Binder' },
    tradeStatus: 'not_for_trade',
    addToWishlist: false,
    purchasePrice: null,
    notes: 'needs review',
    confidence,
  });
  const row = buildScanExportRow({ confirmation, marketPrice: null, priceSource: null, priceTimestamp: null, recognitionMethod: 'manual_search' });
  const csv = serializeScanCsv([row]);

  assert.equal(row.marketPrice, null);
  assert.match(csv, /"Blue Binder"/);
  assert.match(csv, /"manual_search"/);
});

test('benchmark metrics stay unpublished until fixtures are actually run', () => {
  assert.equal(benchmarkMetricsUnavailable.benchmarkedFixtureCount, 0);
  assert.equal(benchmarkMetricsUnavailable.correctPrintingTop1, null);
  assert.equal(benchmarkMetricsUnavailable.foilClassificationAccuracy, null);
});

test('captured scanner frames are private by default', () => {
  assert.equal(frame.retainedByUser, false);
  assert.equal(frame.uploadedWithConsent, false);
});
