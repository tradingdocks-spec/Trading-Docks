import type { BatchScannerTimingSnapshot } from './continuous-offer-scanner.ts';

export const SCANNER_PERFORMANCE_HISTORY_LIMIT = 20;

export type ScannerResolution = {
  width: number;
  height: number;
};

export type ScannerPerformanceSample = {
  sequence: number;
  source: 'assisted_capture' | 'manual_search';
  captureMs: number | null;
  ocrMs: number | null;
  scryfallLookupMs: number | null;
  sessionWriteMs: number | null;
  totalUntilSessionInsertionMs: number | null;
  cameraFps: number | null;
  previewResolution: ScannerResolution | null;
  captureResolution: ScannerResolution | null;
  fallbackCount: number;
};

export type ScannerPerformanceAverages = {
  averageScanTimeMs: number | null;
  averageOcrTimeMs: number | null;
  averageScryfallLookupTimeMs: number | null;
  averageTotalUntilSessionInsertionMs: number | null;
  averageCameraFps: number | null;
};

export type ScannerPerformanceReport = {
  schemaVersion: 1;
  sampleCount: number;
  historyLimit: number;
  averages: ScannerPerformanceAverages;
  latest: ScannerPerformanceSample | null;
  samples: ScannerPerformanceSample[];
  unavailable: string[];
};

export function createScannerPerformanceSample(input: {
  previousSamples: ScannerPerformanceSample[];
  source: ScannerPerformanceSample['source'];
  timing: BatchScannerTimingSnapshot;
  cameraFps?: number | null;
  previewResolution?: ScannerResolution | null;
  captureResolution?: ScannerResolution | null;
}): ScannerPerformanceSample {
  const totalUntilSessionInsertionMs = combineTimings(input.timing.totalMs, input.timing.sessionWriteMs);
  return {
    sequence: nextSequence(input.previousSamples),
    source: input.source,
    captureMs: input.timing.captureMs,
    ocrMs: input.timing.ocrMs,
    scryfallLookupMs: input.timing.scryfallMs,
    sessionWriteMs: input.timing.sessionWriteMs,
    totalUntilSessionInsertionMs,
    cameraFps: normalizeMetric(input.cameraFps),
    previewResolution: normalizeResolution(input.previewResolution),
    captureResolution: normalizeResolution(input.captureResolution),
    fallbackCount: Math.max(0, Math.round(input.timing.fallbackCount)),
  };
}

export function appendScannerPerformanceSample(
  samples: ScannerPerformanceSample[],
  sample: ScannerPerformanceSample,
  limit = SCANNER_PERFORMANCE_HISTORY_LIMIT,
) {
  return [sample, ...samples].slice(0, Math.max(1, Math.floor(limit)));
}

export function buildScannerPerformanceReport(samples: ScannerPerformanceSample[]): ScannerPerformanceReport {
  const boundedSamples = samples.slice(0, SCANNER_PERFORMANCE_HISTORY_LIMIT);
  return {
    schemaVersion: 1,
    sampleCount: boundedSamples.length,
    historyLimit: SCANNER_PERFORMANCE_HISTORY_LIMIT,
    averages: {
      averageScanTimeMs: averageMetric(boundedSamples.map((sample) => sample.captureMs)),
      averageOcrTimeMs: averageMetric(boundedSamples.map((sample) => sample.ocrMs)),
      averageScryfallLookupTimeMs: averageMetric(boundedSamples.map((sample) => sample.scryfallLookupMs)),
      averageTotalUntilSessionInsertionMs: averageMetric(boundedSamples.map((sample) => sample.totalUntilSessionInsertionMs)),
      averageCameraFps: averageMetric(boundedSamples.map((sample) => sample.cameraFps)),
    },
    latest: boundedSamples[0] ?? null,
    samples: boundedSamples,
    unavailable: unavailablePerformanceFields(boundedSamples),
  };
}

export function serializeScannerPerformanceReport(report: ScannerPerformanceReport) {
  return JSON.stringify(report, null, 2);
}

function nextSequence(samples: ScannerPerformanceSample[]) {
  return (samples[0]?.sequence ?? 0) + 1;
}

function combineTimings(totalMs: number | null, sessionWriteMs: number | null) {
  if (totalMs === null || sessionWriteMs === null) return null;
  return normalizeMetric(totalMs + sessionWriteMs);
}

function averageMetric(values: (number | null)[]) {
  const measured = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!measured.length) return null;
  return Math.round(measured.reduce((sum, value) => sum + value, 0) / measured.length);
}

function normalizeMetric(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
}

function normalizeResolution(value: ScannerResolution | null | undefined): ScannerResolution | null {
  if (!value || !Number.isFinite(value.width) || !Number.isFinite(value.height) || value.width <= 0 || value.height <= 0) return null;
  return { width: Math.round(value.width), height: Math.round(value.height) };
}

function unavailablePerformanceFields(samples: ScannerPerformanceSample[]) {
  if (!samples.length) return ['no_samples'];
  const unavailable: string[] = [];
  if (samples.every((sample) => sample.cameraFps === null)) unavailable.push('camera_fps');
  if (samples.every((sample) => sample.previewResolution === null)) unavailable.push('preview_resolution');
  if (samples.every((sample) => sample.captureResolution === null)) unavailable.push('capture_resolution');
  return unavailable;
}
