import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  calculateMagicBenchmarkMetrics,
  classifyMagicRecognition,
  MAGIC_BENCHMARK_CATEGORIES,
  runMagicBenchmark,
  serializeMagicBenchmarkCsv,
  serializeMagicBenchmarkJson,
  serializeMagicBenchmarkMarkdown,
  validateMagicBenchmarkFixtureManifest,
  type MagicBenchmarkFixtureManifest,
} from '../services/magic-recognition-provider.ts';
import type { RecognitionCandidate, RecognitionConfidence } from '../services/scanner-intelligence.ts';

test('fixture manifest validation accepts required private fixture fields', () => {
  const validation = validateMagicBenchmarkFixtureManifest(manifest([fixture({ id: 'fixture-1' })]));

  assert.equal(validation.ok, true);
});

test('fixture manifest validation reports missing expected fields', () => {
  const invalid = manifest([{ ...fixture({ id: '' }), expectedScryfallId: '', expectedCollectorNumber: '' }]);
  const validation = validateMagicBenchmarkFixtureManifest(invalid);

  assert.equal(validation.ok, false);
  if (validation.ok) return;
  assert.match(validation.errors.join('\n'), /expectedScryfallId/);
  assert.match(validation.errors.join('\n'), /expectedCollectorNumber/);
  assert.match(validation.errors.join('\n'), /id/);
});

test('benchmark runner records top-1 and top-3 Magic scoring', async () => {
  const report = await runMagicBenchmark(manifest([
    fixture({
      id: 'rhystic-wot',
      candidateCatalog: [
        candidate({ id: 'wrong-print', setCode: 'PCY', collectorNumber: '45' }),
        candidate({ id: 'sf-wot-25', setCode: 'WOT', collectorNumber: '25' }),
      ],
    }),
  ]), { now: clock([100, 134]), generatedAt: '2026-08-05T00:00:00.000Z' });

  assert.equal(report.results[0].scores.printingTop1, true);
  assert.equal(report.results[0].scores.printingTop3, true);
  assert.equal(report.results[0].latencyMs, 34);
  assert.equal(report.metrics.exactPrintingTop1Accuracy, 1);
  assert.equal(report.metrics.exactPrintingTop3Accuracy, 1);
});

test('benchmark categories include the off-center and partial-crop scanner cases', () => {
  for (const category of ['off_center', 'partial_crop', 'perspective', 'title_obscured', 'blur']) {
    assert.equal(MAGIC_BENCHMARK_CATEGORIES.includes(category as never), true, `${category} should be represented in the benchmark set`);
  }
});

test('benchmark metrics detect false high-confidence exact-printing failures', () => {
  const metrics = calculateMagicBenchmarkMetrics([
    {
      fixtureId: 'bad-high-confidence',
      sanitizedImageId: 'bad-high-confidence:modern_frame',
      frameType: 'modern_frame',
      lightingCondition: 'controlled',
      sleeveStatus: 'unsleeved',
      angle: 'flat',
      signalSource: 'observed_signals',
      ok: true,
      error: null,
      expected: { cardName: 'Rhystic Study', setCode: 'WOT', collectorNumber: '25', scryfallId: 'expected', language: 'en', finish: 'nonfoil' },
      top1: { scryfallId: 'wrong', name: 'Rhystic Study', setCode: 'WOT', collectorNumber: '25' },
      top3: [{ scryfallId: 'wrong', name: 'Rhystic Study', setCode: 'WOT', collectorNumber: '25' }],
      scores: { nameTop1: true, printingTop1: false, printingTop3: false, falseHighConfidence: true, finishCorrect: null, unsupportedRejected: null },
      confidence: confidence(96, false),
      thresholdClass: 'auto_suggest',
      latencyMs: 12,
    },
  ]);

  assert.equal(metrics.falseHighConfidenceRate, 1);
});

test('unsupported-card fixture records rejection when token candidate is not selected', async () => {
  const report = await runMagicBenchmark(manifest([
    fixture({
      id: 'token-fixture',
      frameType: 'token',
      expectedCardName: 'Treasure Token',
      expectedScryfallId: 'token-1',
      candidateCatalog: [candidate({ id: 'token-1', name: 'Treasure Token', layout: 'token' })],
    }),
  ]), { now: clock([0, 3]) });

  assert.equal(report.results[0].scores.unsupportedRejected, true);
  assert.equal(report.metrics.unsupportedCardRejectionRate, 1);
});

test('reports never include local source image paths', async () => {
  const privatePath = 'C:/Users/Jerem/private-fixtures/rhystic-study.jpg';
  const report = await runMagicBenchmark(manifest([
    fixture({ id: 'private-image', localImagePath: privatePath, candidateCatalog: [candidate({ id: 'sf-wot-25' })] }),
  ]), { now: clock([0, 1]) });

  const combined = [
    serializeMagicBenchmarkJson(report),
    serializeMagicBenchmarkCsv(report),
    serializeMagicBenchmarkMarkdown(report),
  ].join('\n');

  assert.doesNotMatch(combined, /private-fixtures/);
  assert.doesNotMatch(combined, /rhystic-study\.jpg/);
  assert.doesNotMatch(combined, /C:\//);
});

test('threshold classification distinguishes recognized, likely, ambiguous, and manual review', () => {
  assert.equal(classifyMagicRecognition(confidence(97, false), 1).thresholdClass, 'auto_suggest');
  assert.equal(classifyMagicRecognition(confidence(90, false), 1).thresholdClass, 'one_tap_confirm');
  assert.equal(classifyMagicRecognition(confidence(81, true), 2).thresholdClass, 'review_alternatives');
  assert.equal(classifyMagicRecognition(confidence(55, true), 0).thresholdClass, 'manual_search_required');
});

test('private fixture and benchmark output directories are excluded from Git', () => {
  const ignore = readFileSync(join(process.cwd(), '.gitignore'), 'utf8');

  assert.match(ignore, /fixtures\/private-scanner\//);
  assert.match(ignore, /fixtures\/magic-scanner-private\//);
  assert.match(ignore, /benchmark-output\//);
});

function manifest(fixtures: MagicBenchmarkFixtureManifest['fixtures']): MagicBenchmarkFixtureManifest {
  return {
    schemaVersion: 1,
    fixtureSetId: 'private-magic-fixtures-2026-08',
    createdAt: '2026-08-05T00:00:00.000Z',
    fixtures,
  };
}

function fixture(overrides: Partial<MagicBenchmarkFixtureManifest['fixtures'][number]>): MagicBenchmarkFixtureManifest['fixtures'][number] {
  return {
    id: overrides.id ?? 'fixture-1',
    localImagePath: overrides.localImagePath ?? 'C:/private/magic/fixture-1.jpg',
    expectedCardName: overrides.expectedCardName ?? 'Rhystic Study',
    expectedSetCode: overrides.expectedSetCode ?? 'WOT',
    expectedCollectorNumber: overrides.expectedCollectorNumber ?? '25',
    expectedScryfallId: overrides.expectedScryfallId ?? 'sf-wot-25',
    expectedLanguage: overrides.expectedLanguage ?? 'en',
    expectedFinish: overrides.expectedFinish ?? 'nonfoil',
    frameType: overrides.frameType ?? 'modern_frame',
    lightingCondition: overrides.lightingCondition ?? 'controlled',
    sleeveStatus: overrides.sleeveStatus ?? 'unsleeved',
    angle: overrides.angle ?? 'flat',
    notes: overrides.notes ?? '',
    observed: overrides.observed,
    candidateCatalog: overrides.candidateCatalog,
  };
}

function candidate(overrides: Partial<RecognitionCandidate>): RecognitionCandidate {
  return {
    id: overrides.id ?? 'sf-wot-25',
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

function confidence(overall: number, requiresConfirmation: boolean): RecognitionConfidence {
  return {
    overall,
    threshold: 82,
    requiresConfirmation,
    signals: [],
    conflicts: [],
  };
}

function clock(values: number[]) {
  let index = 0;
  return () => values[index++] ?? values[values.length - 1] ?? 0;
}
