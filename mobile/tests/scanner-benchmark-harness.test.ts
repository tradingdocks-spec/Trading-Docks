import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createScannerBenchmarkRun,
  scannerBenchmarkMarkdownSummary,
  serializeScannerBenchmarkRun,
} from '../services/scanner-benchmark-harness.ts';

const samples = [
  {
    sequence: 2,
    source: 'assisted_capture' as const,
    captureMs: 180,
    ocrMs: 90,
    scryfallLookupMs: 60,
    sessionWriteMs: 12,
    totalUntilSessionInsertionMs: 342,
    cameraFps: 29,
    previewResolution: { width: 1280, height: 720 },
    captureResolution: { width: 3024, height: 4032 },
    fallbackCount: 0,
  },
  {
    sequence: 1,
    source: 'assisted_capture' as const,
    captureMs: 300,
    ocrMs: 150,
    scryfallLookupMs: 80,
    sessionWriteMs: 20,
    totalUntilSessionInsertionMs: 550,
    cameraFps: 28,
    previewResolution: { width: 1280, height: 720 },
    captureResolution: { width: 3024, height: 4032 },
    fallbackCount: 2,
  },
];

test('scanner benchmark run reports first and warm scan latencies from measured samples', () => {
  const run = createScannerBenchmarkRun({
    id: 'ios 15 pro/card show',
    deviceLabel: 'iPhone 15 Pro',
    appBuild: 'dev-client',
    mode: 'automatic_scan',
    samples,
    outcomes: ['success', 'needs_review', 'failed'],
    startedAt: '2026-08-06T10:00:00.000Z',
    endedAt: '2026-08-06T10:01:00.000Z',
  });

  assert.equal(run.id, 'ios-15-pro-card-show');
  assert.equal(run.metrics.firstScanLatencyMs, 550);
  assert.equal(run.metrics.warmScanLatencyMs, 342);
  assert.equal(run.metrics.averageOcrTimeMs, 120);
  assert.equal(run.metrics.averageCameraFps, 29);
  assert.equal(run.metrics.averageFallbackCount, 1);
  assert.equal(run.metrics.reviewRate, 0.333);
  assert.equal(run.privacy.sourceImagesIncluded, false);
});

test('scanner benchmark export is sanitized and does not include local image paths', () => {
  const run = createScannerBenchmarkRun({
    id: 'fixture-1',
    deviceLabel: 'file:///private/card.jpg',
    appBuild: 'C:\\private\\card.jpg',
    mode: 'single_scan',
    samples,
    outcomes: ['success'],
    startedAt: '2026-08-06T10:00:00.000Z',
    endedAt: '2026-08-06T10:01:00.000Z',
    notes: 'Captured from file:///tmp/source.jpg',
  });
  const json = serializeScannerBenchmarkRun(run);
  const markdown = scannerBenchmarkMarkdownSummary(run);

  assert.doesNotMatch(json, /file:\/\/|C:\\|source\.jpg|card\.jpg/);
  assert.doesNotMatch(markdown, /file:\/\/|C:\\|source\.jpg|card\.jpg/);
  assert.match(markdown, /No source images or source image paths/);
});
