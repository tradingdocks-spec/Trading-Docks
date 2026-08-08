import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SCANNER_PERFORMANCE_HISTORY_LIMIT,
  appendScannerPerformanceSample,
  buildScannerPerformanceReport,
  createScannerPerformanceSample,
  serializeScannerBenchmarkSummary,
  serializeScannerPerformanceReport,
  type ScannerPerformanceSample,
} from '../services/scanner-performance-instrumentation.ts';

test('scanner performance samples are monotonic and bounded', () => {
  let samples: ScannerPerformanceSample[] = [];
  for (let index = 0; index < SCANNER_PERFORMANCE_HISTORY_LIMIT + 3; index += 1) {
    const sample = createScannerPerformanceSample({
      previousSamples: samples,
      source: 'assisted_capture',
      timing: { captureMs: index, cropMs: null, ocrMs: 10, scryfallMs: 20, sessionWriteMs: 5, totalMs: 40, fallbackCount: 0 },
    });
    samples = appendScannerPerformanceSample(samples, sample);
  }

  assert.equal(samples.length, SCANNER_PERFORMANCE_HISTORY_LIMIT);
  assert.equal(samples[0].sequence, SCANNER_PERFORMANCE_HISTORY_LIMIT + 3);
  assert.equal(samples.at(-1)?.sequence, 4);
});

test('scanner performance report averages measured values only', () => {
  const first = createScannerPerformanceSample({
    previousSamples: [],
    source: 'assisted_capture',
    timing: { captureMs: 12.2, cropMs: null, ocrMs: 88.8, scryfallMs: 140.1, sessionWriteMs: 5, totalMs: 250, fallbackCount: 2 },
    previewResolution: { width: 390.4, height: 720.2 },
    captureResolution: { width: 3024, height: 4032 },
  });
  const second = createScannerPerformanceSample({
    previousSamples: [first],
    source: 'manual_search',
    timing: { captureMs: null, cropMs: null, ocrMs: null, scryfallMs: 100, sessionWriteMs: 4, totalMs: 120, fallbackCount: 1 },
    cameraFps: null,
  });

  const report = buildScannerPerformanceReport([second, first]);

  assert.equal(report.averages.averageScanTimeMs, 12);
  assert.equal(report.averages.averageOcrTimeMs, 89);
  assert.equal(report.averages.averageScryfallLookupTimeMs, 120);
  assert.equal(report.averages.averageTotalUntilSessionInsertionMs, 190);
  assert.deepEqual(report.latest?.previewResolution, null);
  assert.equal(report.samples[1].totalUntilSessionInsertionMs, 255);
  assert.ok(report.unavailable.includes('camera_fps'));
});

test('scanner performance JSON omits images users and local paths', () => {
  const sample = createScannerPerformanceSample({
    previousSamples: [],
    source: 'assisted_capture',
    timing: { captureMs: 10, cropMs: null, ocrMs: 20, scryfallMs: 30, sessionWriteMs: 4, totalMs: 60, fallbackCount: 0 },
    previewResolution: { width: 390, height: 844 },
    captureResolution: { width: 3024, height: 4032 },
  });
  const json = serializeScannerPerformanceReport(buildScannerPerformanceReport([sample]));

  assert.doesNotMatch(json, /file:|imageUri|uri|userId|localImagePath|token|secret/i);
  assert.match(json, /averageTotalUntilSessionInsertionMs/);
  assert.match(json, /captureResolution/);
});

test('compact benchmark summary reports tunable scanner timings without sensitive data', () => {
  const sample = createScannerPerformanceSample({
    previousSamples: [],
    source: 'assisted_capture',
    timing: { captureMs: 44, cropMs: null, ocrMs: 120, scryfallMs: 180, sessionWriteMs: 8, totalMs: 410, fallbackCount: 0 },
    cameraFps: 28,
    previewResolution: { width: 390, height: 844 },
    captureResolution: { width: 3024, height: 4032 },
  });
  const summary = serializeScannerBenchmarkSummary(buildScannerPerformanceReport([sample]));

  assert.match(summary, /Average scan time: 44 ms/);
  assert.match(summary, /Average OCR time: 120 ms/);
  assert.match(summary, /Average Scryfall lookup time: 180 ms/);
  assert.match(summary, /Average total until session insertion: 418 ms/);
  assert.match(summary, /Average camera FPS: 28 fps/);
  assert.match(summary, /Preview resolution: 390x844/);
  assert.match(summary, /Capture resolution: 3024x4032/);
  assert.doesNotMatch(summary, /file:|imageUri|uri|userId|localImagePath|token|secret/i);
});
