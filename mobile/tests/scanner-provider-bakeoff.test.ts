import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildScannerProviderManifest,
  resolveScannerProviderFlags,
} from '../services/scanner-provider-stack.ts';
import {
  createCurrentScannerBaselineAdapter,
  createTcgTrackingBakeoffAdapter,
  runScannerProviderBakeoff,
  serializeScannerProviderBakeoffMarkdown,
} from '../services/scanner-provider-bakeoff.ts';

const fixture = {
  id: 'private-raff-security-officer',
  localImagePath: 'mobile/fixtures/magic-scanner-private/private-magic-fixtures-2026-08/images/raff-security-officer.jpg',
  expectedCardName: 'Raff Security Officer',
  expectedSetCode: 'MSH',
  expectedCollectorNumber: '0033',
  expectedScryfallId: 'raff-scryfall-id',
  expectedLanguage: 'en',
  notes: 'Private local iPhone capture',
};

test('scanner provider manifest keeps off-the-shelf providers feature-flagged and secret-gated', () => {
  const manifest = buildScannerProviderManifest(resolveScannerProviderFlags({
    SCANNER_PROVIDER_CARDSIGHT_ENABLED: 'true',
    SCANNER_PROVIDER_TCGTRACKING_ENABLED: 'true',
    SCANNER_PROVIDER_TINEYE_ENABLED: 'true',
    SCANNER_NORMALIZER_SCANBOT_ENABLED: 'true',
    SCANNER_NORMALIZER_DYNAMSOFT_ENABLED: 'true',
  }));

  const cardsight = manifest.find((provider) => provider.id === 'cardsight');
  const tineye = manifest.find((provider) => provider.id === 'tineye-cardsearchengine');
  const scanbot = manifest.find((provider) => provider.id === 'scanbot-normalizer');
  const dynamsoft = manifest.find((provider) => provider.id === 'dynamsoft-normalizer');

  assert.equal(cardsight?.availability, 'requires_credentials');
  assert.equal(cardsight?.requiresServerSideSecrets, true);
  assert.equal(tineye?.availability, 'requires_reference_dataset');
  assert.equal(tineye?.requiresReferenceDataset, true);
  assert.equal(scanbot?.availability, 'requires_development_build');
  assert.equal(dynamsoft?.availability, 'requires_development_build');
});

test('provider bake-off keeps missing adapters unavailable and strips local paths from the report', async () => {
  const report = await runScannerProviderBakeoff({
    fixtures: [fixture],
    adapters: [],
    env: {},
    allowNetwork: false,
    generatedAt: '2026-08-27T00:00:00.000Z',
  });

  const local = report.providers.find((provider) => provider.providerId === 'trading-docks-local');
  const tcgtracking = report.providers.find((provider) => provider.providerId === 'tcgtracking');
  const markdown = serializeScannerProviderBakeoffMarkdown(report);

  assert.equal(local?.availability, 'available');
  assert.equal(local?.fixturesEvaluated, 1);
  assert.equal(local?.exactNameFixtures, 0);
  assert.equal(tcgtracking?.availability, 'disabled');
  assert.equal(tcgtracking?.fixturesEvaluated, 1);
  assert.doesNotMatch(markdown, /private-magic-fixtures|raff-security-officer\.jpg|mobile\/fixtures/);
  assert.match(markdown, /This report intentionally omits source image paths and image contents\./);
});

test('current baseline adapter uses the local lab result and promotes an exact match', async () => {
  const adapter = createCurrentScannerBaselineAdapter({
    runScannerRecognitionLab: async () => ({
      imageUri: fixture.localImagePath,
      expectedName: fixture.expectedCardName,
      expectedOracleId: fixture.expectedScryfallId,
      capturedQuality: {
        resolution: '1200x1600',
        sharpness: 0.92,
        exposure: 0.51,
        cardCoverage: null,
        perspectiveScore: null,
        lumaHash: '00ff00ff00ff00ff',
      },
      engines: {
        ocr_accurate: {
          engine: 'ocr_accurate',
          outcome: 'identity_correct',
          durationMs: 48,
          top1: {
            name: fixture.expectedCardName,
            oracleId: 'oracle-raff',
            scryfallId: fixture.expectedScryfallId,
            score: 97,
            distance: null,
          },
          top5: [],
          rawText: fixture.expectedCardName,
          confidence: 97,
          matchScore: 97,
          candidatesConsidered: 1,
          notes: [],
        },
        phash_luma_8x8: {
          engine: 'phash_luma_8x8',
          outcome: 'no_result',
          durationMs: 0,
          top1: null,
          top5: [],
          notes: [],
        },
        apple_vision_feature_print: {
          engine: 'apple_vision_feature_print',
          outcome: 'no_result',
          durationMs: 0,
          top1: null,
          top5: [],
          notes: [],
        },
      },
      summary: {
        accuracyPct: 100,
        missPct: 0,
        falsePositivePct: 0,
        medianLatencyMs: 48,
        p95LatencyMs: 48,
      },
      debugArtifacts: null,
    }),
  });

  const result = await adapter.evaluate(fixture, {
    provider: buildScannerProviderManifest(resolveScannerProviderFlags({}))[0],
    flags: resolveScannerProviderFlags({}),
    allowNetwork: false,
  });

  assert.equal(result.status, 'matched');
  assert.equal(result.expectedNameMatch, true);
  assert.equal(result.exactPrintingMatch, true);
  assert.equal(result.topCandidate?.name, fixture.expectedCardName);
});

test('tcgtracking adapter stays conservative when disabled and can be injected when enabled', async () => {
  const adapter = createTcgTrackingBakeoffAdapter({
    prepareTcgTrackingScanImage: async () => ({
      image: 'ZmFrZQ==',
      width: 1200,
      height: 1600,
      bytes: 4,
      mimeType: 'image/jpeg',
    }),
    scanPreparedImageWithTcgTracking: async () => ({
      ok: true,
      provider: 'tcgtracking',
      status: 'candidates',
      candidates: [{
        id: fixture.expectedScryfallId,
        name: fixture.expectedCardName,
        setCode: fixture.expectedSetCode,
        collectorNumber: fixture.expectedCollectorNumber,
        confidence: 0.99,
        recognitionMode: 'assisted_capture',
        finishes: ['normal'],
      } as never],
      latencyMs: 22,
      topConfidence: 0.99,
      confidenceBand: 'high',
      fallbackRecommended: false,
      image: { width: 1200, height: 1600, bytes: 4, retained: false },
    }),
  });

  const disabled = await adapter.evaluate(fixture, {
    provider: buildScannerProviderManifest(resolveScannerProviderFlags({}))[1],
    flags: resolveScannerProviderFlags({}),
    allowNetwork: true,
  });

  const enabled = await adapter.evaluate(fixture, {
    provider: buildScannerProviderManifest(resolveScannerProviderFlags({
      SCANNER_PROVIDER_TCGTRACKING_ENABLED: 'true',
    }))[1],
    flags: resolveScannerProviderFlags({
      SCANNER_PROVIDER_TCGTRACKING_ENABLED: 'true',
    }),
    allowNetwork: true,
  });

  assert.equal(disabled.status, 'disabled');
  assert.equal(disabled.topCandidate, null);
  assert.equal(enabled.status, 'matched');
  assert.equal(enabled.expectedNameMatch, true);
  assert.equal(enabled.exactPrintingMatch, true);
  assert.equal(enabled.topCandidate?.name, fixture.expectedCardName);
});
