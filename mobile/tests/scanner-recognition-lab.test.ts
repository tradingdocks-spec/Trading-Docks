import assert from 'node:assert/strict';
import test from 'node:test';

import {
  runScannerRecognitionLab,
  summarizeRecognitionLab,
  type ScannerRecognitionEngineResult,
} from '../services/scanner-recognition-lab.ts';
import type { ScannerCardCandidate } from '../services/scanner-foundation.ts';

const goblin: ScannerCardCandidate = {
  id: 'sf-goblin',
  oracleId: 'oracle-goblin',
  name: 'Goblin War Strike',
  setCode: 'SCG',
  setName: 'Scourge',
  collectorNumber: '96',
  finishes: ['normal', 'foil'],
  language: 'en',
  imageUrl: 'https://img.example/goblin.jpg',
  confidence: 0.9,
  recognitionMode: 'assisted_capture',
  marketPrice: null,
};

test('recognition lab sends the same normalized image to OCR analysis and feature print engines', async () => {
  const seen: string[] = [];
  const report = await runScannerRecognitionLab({
    imageUri: 'file:///tmp/physical-card.jpg',
    expectedName: 'Goblin War Strike',
    expectedOracleId: 'oracle-goblin',
    referenceCandidates: [goblin],
    includeDebugArtifacts: true,
  }, {
    analyzeRecognitionImage: async (request) => {
      seen.push(`analysis:${request.imageUri}`);
      return { ok: true, provider: 'apple_vision', imageUri: request.imageUri, width: 1200, height: 1680, lumaHash: 'ff00aa55ff00aa55', sharpness: 0.88, exposure: 0.52, durationMs: 8, warnings: [] };
    },
    recognizeText: async (request) => {
      seen.push(`ocr:${request.imageUri}`);
      return {
        ok: true,
        provider: 'apple_vision',
        fullText: 'Goblin War Strike',
        latencyMs: 44,
        orientationUsed: 'up',
        warnings: [],
        observations: [{ id: 'title:0', requestedRegionId: 'title_zone', regionType: 'name', text: 'Goblin War Strike', rawText: 'Goblin War Strike', confidence: 94, bounds: { x: 0, y: 0, width: 1, height: 0.1 } }],
      };
    },
    generateFeaturePrint: async (request) => {
      seen.push(`feature:${request.imageUri}`);
      return { ok: true, provider: 'apple_vision_feature_print', imageUri: request.imageUri, featurePrint: request.imageUri.includes('reference') ? 'ref' : 'capture', descriptorBytes: 1024, durationMs: 30, warnings: [] };
    },
    compareFeaturePrints: async () => ({ ok: true, provider: 'apple_vision_feature_print', distance: 0.12, durationMs: 3, warnings: [] }),
    downloadReferenceImage: async () => 'file:///tmp/reference-goblin.jpg',
  });

  assert.ok(seen.includes('analysis:file:///tmp/physical-card.jpg'));
  assert.ok(seen.includes('ocr:file:///tmp/physical-card.jpg'));
  assert.ok(seen.includes('feature:file:///tmp/physical-card.jpg'));
  assert.equal(report.engines.ocr_accurate.top1?.name, 'Goblin War Strike');
  assert.equal(report.engines.apple_vision_feature_print.top1?.name, 'Goblin War Strike');
  assert.equal(report.debugArtifacts?.normalizedCardCropUri, 'file:///tmp/physical-card.jpg');
});

test('recognition lab accounts for false positives misses and latency', () => {
  const results: ScannerRecognitionEngineResult[] = [
    result('ocr_accurate', 'identity_correct', 20),
    result('phash_luma_8x8', 'identity_wrong', 30),
    result('apple_vision_feature_print', 'no_result', 40),
  ];
  const summary = summarizeRecognitionLab(results);
  assert.equal(summary.accuracyPct, 33.33);
  assert.equal(summary.falsePositivePct, 33.33);
  assert.equal(summary.missPct, 33.33);
  assert.equal(summary.medianLatencyMs, 30);
  assert.equal(summary.p95LatencyMs, 40);
});

test('debug artifacts are opt-in only', async () => {
  const report = await runScannerRecognitionLab({
    imageUri: 'file:///tmp/card.jpg',
    expectedOracleId: 'oracle-goblin',
    referenceCandidates: [],
  }, {
    analyzeRecognitionImage: async (request) => ({ ok: true, provider: 'apple_vision', imageUri: request.imageUri, width: 1, height: 1, lumaHash: '0000000000000000', sharpness: 0, exposure: 0, durationMs: 1, warnings: [] }),
    recognizeText: async () => ({ ok: false, provider: 'apple_vision', code: 'empty_result', message: 'No text', latencyMs: 2, warnings: [] }),
    generateFeaturePrint: async (request) => ({ ok: false, provider: 'apple_vision_feature_print', code: 'native_module_unavailable', message: 'No feature print', durationMs: 0, warnings: [], imageUri: request.imageUri } as never),
  });
  assert.equal(report.debugArtifacts, null);
});

function result(engine: ScannerRecognitionEngineResult['engine'], outcome: ScannerRecognitionEngineResult['outcome'], durationMs: number): ScannerRecognitionEngineResult {
  return { engine, outcome, durationMs, top1: null, top5: [], notes: [], candidatesConsidered: 0 };
}
