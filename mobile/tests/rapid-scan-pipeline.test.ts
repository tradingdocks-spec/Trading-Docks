import assert from 'node:assert/strict';
import test from 'node:test';

import {
  appendRapidResultTray,
  appendRapidSessionResult,
  applyRapidPrintingRefinement,
  buildRapidMagicNameIndex,
  createRapidScanMetricSample,
  createRapidScanResult,
  createRapidScanRuntime,
  createRapidScanSession,
  markRapidIdentityEmitted,
  matchRapidTitle,
  nextRapidScanRuntime,
  rapidPrecisionFallback,
  routeRapidIdentity,
  scannerScanModeLabel,
  summarizeRapidScanMetrics,
} from '../services/rapid-scan-pipeline.ts';

const index = buildRapidMagicNameIndex([
  { name: 'Lightning Bolt', oracleId: 'oracle-lightning-bolt', scryfallId: 'sf-bolt' },
  { name: 'Sol Ring', oracleId: 'oracle-sol-ring', scryfallId: 'sf-sol-ring' },
  { name: 'Rhystic Study', oracleId: 'oracle-rhystic-study', scryfallId: 'sf-rhystic' },
  { name: 'Llanowar Elves', oracleId: 'oracle-llanowar-elves', scryfallId: 'sf-llanowar' },
  { name: 'Unblinking Observer', oracleId: 'oracle-unblinking-observer', scryfallId: 'sf-observer' },
  { name: 'Fire // Ice', oracleId: 'oracle-fire-ice', scryfallId: 'sf-fire-ice' },
]);

test('scan modes expose Rapid and Precision labels', () => {
  assert.equal(scannerScanModeLabel('rapid_scan'), 'Rapid Scan');
  assert.equal(scannerScanModeLabel('precision_scan'), 'Precision Scan');
});

test('card-change state machine starts identity when a card appears', () => {
  const runtime = createRapidScanRuntime(0);
  const transition = nextRapidScanRuntime(runtime, {
    at: 100,
    cardPresent: true,
    fingerprint: 'fp-a',
    recognizedTitle: null,
    differenceScore: 0.7,
  });

  assert.equal(transition.runtime.state, 'card_present');
  assert.equal(transition.action, 'start_identity');
});

test('same-card suppression blocks repeated stationary recognition', () => {
  const runtime = markRapidIdentityEmitted(createRapidScanRuntime(0), {
    at: 120,
    fingerprint: 'fp-a',
    title: 'Sol Ring',
  });

  const transition = nextRapidScanRuntime(runtime, {
    at: 180,
    cardPresent: true,
    fingerprint: 'fp-a',
    recognizedTitle: 'Sol Ring',
    differenceScore: 0.03,
  });

  assert.equal(transition.runtime.state, 'waiting_for_change');
  assert.equal(transition.action, 'suppress_same_card');
  assert.equal(transition.runtime.suppressedSameCardCount, 1);
});

test('new-card evidence rearms immediately without a long cooldown', () => {
  const runtime = markRapidIdentityEmitted(createRapidScanRuntime(0), {
    at: 120,
    fingerprint: 'fp-a',
    title: 'Sol Ring',
  });

  const transition = nextRapidScanRuntime(runtime, {
    at: 180,
    cardPresent: true,
    fingerprint: 'fp-b',
    recognizedTitle: 'Lightning Bolt',
    differenceScore: 0.84,
  });

  assert.equal(transition.runtime.state, 'new_card');
  assert.equal(transition.action, 'rearm_new_card');
  assert.equal(transition.runtime.rearmedAt, 180);
});

test('local fuzzy title matching is network independent and robust to OCR noise', () => {
  const match = matchRapidTitle(index, 'L1ghtning BoIt');

  assert.equal(match.entry?.name, 'Lightning Bolt');
  assert.ok(match.score >= 0.72);
});

test('split names match either half locally', () => {
  const match = matchRapidTitle(index, 'Fire');

  assert.equal(match.entry?.name, 'Fire // Ice');
  assert.ok(match.score >= 0.86);
});

test('high, medium, and low routing choose safe actions', () => {
  const high = routeRapidIdentity(matchRapidTitle(index, 'Sol Ring'));
  const medium = routeRapidIdentity({
    entry: index.records.find((record) => record.name === 'Unblinking Observer') ?? null,
    normalizedQuery: 'unblinking ob',
    score: 0.74,
    exact: false,
    confidenceBand: 'medium',
    failureCode: null,
    evidence: ['Synthetic medium-confidence title evidence.'],
  });
  const low = routeRapidIdentity(matchRapidTitle(index, 'Totally Unknown Card'));

  assert.equal(high.confidenceClass, 'high');
  assert.equal(high.action, 'append_confirmed');
  assert.equal(medium.confidenceClass, 'medium');
  assert.equal(medium.action, 'append_review');
  assert.equal(low.confidenceClass, 'low');
  assert.equal(low.action, 'continue_reading');
});

test('async printing refinement updates confident printings and flags ambiguous ones', () => {
  const result = createRapidScanResult({
    id: 'scan-1',
    match: matchRapidTitle(index, 'Rhystic Study'),
    destination: 'collection',
    createdAt: 200,
  });
  assert.ok(result);

  const refined = applyRapidPrintingRefinement(result, {
    exactPrintingId: 'sf-rhystic-wot',
    setCode: 'WOT',
    collectorNumber: '25',
    finish: 'foil',
    language: 'en',
    confidence: 0.91,
    ambiguous: false,
  });
  assert.equal(refined.exactPrintingId, 'sf-rhystic-wot');
  assert.equal(refined.refinementState, 'resolved');
  assert.equal(refined.reviewRequired, false);

  const ambiguous = applyRapidPrintingRefinement(result, {
    exactPrintingId: null,
    setCode: null,
    collectorNumber: null,
    finish: null,
    language: null,
    confidence: 0.52,
    ambiguous: true,
  });
  assert.equal(ambiguous.refinementState, 'review_required');
  assert.equal(ambiguous.reviewRequired, true);
});

test('result tray appends newest first and de-duplicates by id', () => {
  const first = createRapidScanResult({
    id: 'scan-1',
    match: matchRapidTitle(index, 'Sol Ring'),
    destination: 'collection',
    createdAt: 1,
  });
  const second = createRapidScanResult({
    id: 'scan-2',
    match: matchRapidTitle(index, 'Lightning Bolt'),
    destination: 'collection',
    createdAt: 2,
  });
  assert.ok(first);
  assert.ok(second);

  const tray = appendRapidResultTray(appendRapidResultTray([first], second), first);

  assert.deepEqual(tray.map((item) => item.id), ['scan-1', 'scan-2']);
});

test('batch destination is inherited by appended rapid results', () => {
  const session = createRapidScanSession({ id: 'batch-1', destination: 'binder', startedAt: 0 });
  const result = createRapidScanResult({
    id: 'scan-1',
    match: matchRapidTitle(index, 'Lightning Bolt'),
    destination: 'collection',
    createdAt: 10,
  });
  assert.ok(result);

  const next = appendRapidSessionResult(session, result);

  assert.equal(next.results[0].destination, 'binder');
  assert.equal(next.cardsScanned, 1);
});

test('Rapid falls back to Precision when title or printing confidence is too weak', () => {
  assert.equal(rapidPrecisionFallback({ confidenceClass: 'low' }).required, true);
  assert.equal(rapidPrecisionFallback({ confidenceClass: 'medium', ambiguousPrinting: true }).required, true);
  assert.equal(rapidPrecisionFallback({ confidenceClass: 'high' }).required, false);
});

test('benchmark metrics report code-level latency without inventing physical results', () => {
  const summary = summarizeRapidScanMetrics([
    createRapidScanMetricSample({
      frameSamplingRateHz: 12,
      cardPresenceDetectionMs: 18,
      titleCropMs: 6,
      ocrMs: 84,
      localFuzzyMatchMs: 3,
      identityLatencyMs: 150,
      printingRefinementLatencyMs: 420,
      newCardDetectionLatencyMs: 45,
      cardsScanned: 2,
      elapsedMs: 3000,
    }),
  ]);

  assert.equal(summary.averageLocalFuzzyMatchMs, 3);
  assert.equal(summary.effectiveCardsPerMinute, 40);
});
