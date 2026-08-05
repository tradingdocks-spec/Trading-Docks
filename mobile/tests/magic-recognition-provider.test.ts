import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createMagicBenchmarkManifest,
  evaluateMagicBenchmarkResults,
  explainMagicConfidence,
  isMagicTokenOrUnsupported,
  magicBenchmarkMetricsUnavailable,
  magicRecognitionPrivacy,
  rankMagicCandidates,
  recognizeMagicCard,
  scoreMagicCandidate,
  type MagicCatalogSearch,
} from '../services/magic-recognition-provider.ts';
import { MagicRecognitionAdapter } from '../services/magic-recognition-provider.ts';
import type { RecognitionCandidate } from '../services/scanner-intelligence.ts';
import type { TcgDetectionCandidate, UniversalScanCandidate } from '../services/multi-tcg-scanner.ts';

test('exact name and collector-number match selects the exact Magic printing', async () => {
  const result = await recognizeMagicCard({
    nameObservation: nameOcr('Rhystic Study', 95),
    collectorInfoText: 'WOT 25 EN',
    finishObservation: { finish: 'nonfoil', confidence: 88, evidence: ['matte frame'], frameCount: 3 },
    language: 'en',
    online: true,
  }, catalog([candidate({ id: 'sf-wot-25', name: 'Rhystic Study', setCode: 'WOT', collectorNumber: '25' })]));

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.selected?.id, 'sf-wot-25');
  assert.equal(result.confidence.requiresConfirmation, false);
});

test('ambiguous name returns top alternatives instead of inventing certainty', async () => {
  const result = await recognizeMagicCard({
    nameObservation: nameOcr('Lightning Bolt', 80),
    online: true,
  }, catalog([
    candidate({ id: 'bolt-1', name: 'Lightning Bolt', setCode: '2XM', collectorNumber: '129' }),
    candidate({ id: 'bolt-2', name: 'Lightning Bolt', setCode: 'SLD', collectorNumber: '675' }),
    candidate({ id: 'bolt-3', name: 'Lightning Bolt', setCode: 'M10', collectorNumber: '146' }),
  ]));

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.candidates.length, 3);
  assert.equal(result.confidence.requiresConfirmation, true);
});

test('multiple reprints are ranked by exact set and collector signals', () => {
  const ranked = rankMagicCandidates({
    candidates: [
      candidate({ id: 'rhystic-pcy-45', name: 'Rhystic Study', setCode: 'PCY', collectorNumber: '45' }),
      candidate({ id: 'rhystic-wot-25', name: 'Rhystic Study', setCode: 'WOT', collectorNumber: '25' }),
    ],
    nameObservation: nameOcr('Rhystic Study', 92),
    collectorInfo: { setCode: 'WOT', collectorNumber: '25', language: 'en', rarity: null, confidence: 80 },
  });

  assert.equal(ranked[0].id, 'rhystic-wot-25');
});

test('missing collector number does not inflate confidence', () => {
  const confidence = scoreMagicCandidate({
    candidate: candidate({ id: 'sf-1', name: 'Rhystic Study', setCode: 'WOT', collectorNumber: '25' }),
    nameObservation: nameOcr('Rhystic Study', 95),
  });
  const collectorSignal = confidence.signals.find((signal) => signal.key === 'collector_number');

  assert.equal(collectorSignal?.score, null);
  assert.equal(confidence.requiresConfirmation, true);
});

test('conflicting set and collector number are visible conflicts', () => {
  const confidence = scoreMagicCandidate({
    candidate: candidate({ id: 'sf-1', name: 'Rhystic Study', setCode: 'WOT', collectorNumber: '25' }),
    nameObservation: nameOcr('Rhystic Study', 95),
    collectorInfo: { setCode: 'PCY', collectorNumber: '45', language: 'en', rarity: null, confidence: 80 },
  });

  assert.equal(confidence.requiresConfirmation, true);
  assert.match(confidence.conflicts.join(' '), /Set code/);
  assert.match(confidence.conflicts.join(' '), /Collector number/);
});

test('legal and illegal finishes are validated against Scryfall finish metadata', () => {
  const legal = scoreMagicCandidate({
    candidate: candidate({ id: 'sf-foil', legalFinishes: ['normal', 'foil'] }),
    finishObservation: { finish: 'likely_foil', confidence: 86, evidence: ['specular shift'], frameCount: 4 },
  });
  const illegal = scoreMagicCandidate({
    candidate: candidate({ id: 'sf-nonfoil', legalFinishes: ['normal'] }),
    finishObservation: { finish: 'likely_etched', confidence: 80, evidence: ['edge shimmer'], frameCount: 4 },
  });

  assert.equal(legal.signals.find((signal) => signal.key === 'legal_finish')?.score, 94);
  assert.equal(illegal.requiresConfirmation, true);
  assert.match(illegal.conflicts.join(' '), /Finish compatibility/);
});

test('double-faced layout can be matched without changing printing identity', () => {
  const confidence = scoreMagicCandidate({
    candidate: candidate({ id: 'dfc-1', layout: 'transform' }),
    artworkObservation: { fingerprint: 'layout-transform', layout: 'transform', similarity: 0.88 },
  });

  assert.equal(confidence.signals.find((signal) => signal.key === 'layout')?.score, 92);
});

test('unsupported token results are excluded from recognition selection', async () => {
  const token = candidate({ id: 'token-1', name: 'Treasure Token', layout: 'token' });
  assert.equal(isMagicTokenOrUnsupported(token), true);

  const result = await recognizeMagicCard({
    nameObservation: nameOcr('Treasure Token', 90),
    online: true,
  }, catalog([token]));

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.selected, null);
});

test('top-three ranking is stable and limited', () => {
  const ranked = rankMagicCandidates({
    candidates: [
      candidate({ id: 'a', name: 'Island', setCode: 'AAA', collectorNumber: '1' }),
      candidate({ id: 'b', name: 'Island', setCode: 'BBB', collectorNumber: '1' }),
      candidate({ id: 'c', name: 'Island', setCode: 'CCC', collectorNumber: '1' }),
      candidate({ id: 'd', name: 'Island', setCode: 'DDD', collectorNumber: '1' }),
    ],
    nameObservation: nameOcr('Island', 80),
  });

  assert.equal(ranked.length, 3);
  assert.deepEqual(ranked.map((entry) => entry.id), ['a', 'b', 'c']);
});

test('manual fallback can use offline cached candidates', async () => {
  const result = await recognizeMagicCard({
    nameObservation: nameOcr('Counterspell', 81),
    online: false,
    cachedCandidates: [candidate({ id: 'counterspell-1', name: 'Counterspell' })],
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.source, 'cache');
  assert.equal(result.selected?.name, 'Counterspell');
});

test('Scryfall failure falls back to cached candidates when available', async () => {
  const result = await recognizeMagicCard({
    nameObservation: nameOcr('Sol Ring', 85),
    online: true,
    cachedCandidates: [candidate({ id: 'sol-ring-cache', name: 'Sol Ring' })],
  }, async () => {
    throw new Error('Scryfall unavailable');
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.source, 'cache');
});

test('Scryfall failure is explicit when no cache exists', async () => {
  const result = await recognizeMagicCard({
    nameObservation: nameOcr('Sol Ring', 85),
    online: true,
  }, async () => {
    throw new Error('Scryfall unavailable');
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, 'Scryfall unavailable');
});

test('explanation text is suitable for Why this match without hidden signals', () => {
  const confidence = scoreMagicCandidate({
    candidate: candidate({ id: 'sf-1', name: 'Rhystic Study' }),
    nameObservation: nameOcr('Rhystic Study', 95),
  });
  const explanation = explainMagicConfidence(confidence).join('\n');

  assert.match(explanation, /Name OCR/);
  assert.match(explanation, /Manual confirmation/);
});

test('privacy contract does not upload or retain images by default', () => {
  const privacy = magicRecognitionPrivacy();

  assert.equal(privacy.uploadsImagesWithoutIntent, false);
  assert.equal(privacy.retainsPhotosByDefault, false);
  assert.equal(privacy.usesPaidCloudVisionProvider, false);
});

test('benchmark manifest supports private local fixtures without committing scans', () => {
  const manifest = createMagicBenchmarkManifest({ fixtureRoot: 'C:/private/magic-fixtures' });

  assert.equal(manifest.copyrightPolicy, 'private_local_fixtures_only');
  assert.equal(manifest.fixtures.length > 10, true);
  assert.equal(manifest.metrics.benchmarkedFixtureCount, 0);
  assert.equal(magicBenchmarkMetricsUnavailable.correctPrintingTop1, null);
});

test('benchmark evaluation reports measurable metrics only from fixture results', () => {
  const result = evaluateMagicBenchmarkResults([
    {
      expectedName: 'Rhystic Study',
      expectedScryfallId: 'sf-1',
      latencyMs: 120,
      result: {
        ok: true,
        selected: candidate({ id: 'sf-1', name: 'Rhystic Study' }),
        candidates: [candidate({ id: 'sf-1', name: 'Rhystic Study' })],
        confidence: scoreMagicCandidate({ candidate: candidate({ id: 'sf-1', name: 'Rhystic Study' }), nameObservation: nameOcr('Rhystic Study', 95) }),
        explanation: [],
        source: 'injected',
      },
    },
  ]);

  assert.equal(result.benchmarkedFixtureCount, 1);
  assert.equal(result.correctNameTop1, 1);
  assert.equal(result.correctPrintingTop1, 1);
  assert.equal(result.averageScanLatencyMs, 120);
});

test('MagicRecognitionAdapter is the routed real Magic adapter and preserves universal candidates', async () => {
  const universal = universalCandidate('sf-wot-25');
  const recognized = await MagicRecognitionAdapter.recognize({
    frame: { id: 'frame-1', userId: 'user-1', capturedAt: new Date(0).toISOString(), uri: null, width: 1000, height: 1400, sequenceIndex: 0, retainedByUser: false, uploadedWithConsent: false },
    observations: [
      { signal: 'ocr_keyword', value: 'Rhystic Study', confidence: 90, evidence: 'name crop' },
      { signal: 'bottom_information_layout', value: 'WOT 25 EN', confidence: 85, evidence: 'collector crop' },
    ],
    catalogCandidates: [universal],
  });

  assert.equal(MagicRecognitionAdapter.catalogProviderId, 'scryfall');
  assert.equal(recognized[0], universal);
});

function catalog(candidates: RecognitionCandidate[]): MagicCatalogSearch {
  return async () => candidates;
}

function nameOcr(text: string, confidence: number) {
  return { regionType: 'name' as const, text, confidence };
}

function candidate(overrides: Partial<RecognitionCandidate>): RecognitionCandidate {
  return {
    id: overrides.id ?? 'sf-1',
    name: overrides.name ?? 'Rhystic Study',
    setCode: overrides.setCode ?? 'WOT',
    setName: overrides.setName ?? 'Wilds of Eldraine',
    collectorNumber: overrides.collectorNumber ?? '25',
    finishes: overrides.finishes ?? ['normal'],
    legalFinishes: overrides.legalFinishes ?? overrides.finishes ?? ['normal'],
    language: overrides.language ?? 'en',
    imageUrl: overrides.imageUrl ?? null,
    confidence: overrides.confidence ?? 0,
    recognitionMode: overrides.recognitionMode ?? 'assisted_capture',
    layout: overrides.layout ?? 'normal',
    colorIdentity: overrides.colorIdentity ?? ['U'],
  };
}

function universalCandidate(id: string): UniversalScanCandidate {
  return {
    game: 'magic',
    card: { game: 'magic', name: 'Rhystic Study', provider: 'scryfall', externalId: id },
    printing: {
      game: 'magic',
      setName: 'Wilds of Eldraine',
      setCode: 'WOT',
      cardNumber: '25',
      language: 'en',
      finish: 'normal',
      externalProvider: 'scryfall',
      externalId: id,
      metadata: { layout: 'normal' },
    },
    condition: 'near_mint',
    quantity: 1,
    confidence: scoreMagicCandidate({ candidate: candidate({ id }), nameObservation: nameOcr('Rhystic Study', 95) }),
    gameConfidence: { game: 'magic', confidence: 92, signals: [], conflicts: [] } as TcgDetectionCandidate,
    destination: { type: 'collection' },
    notes: '',
  };
}
