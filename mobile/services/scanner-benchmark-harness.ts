import {
  buildScannerPerformanceReport,
  type ScannerPerformanceReport,
  type ScannerPerformanceSample,
} from './scanner-performance-instrumentation.ts';

export type ScannerBenchmarkOutcome = 'success' | 'needs_review' | 'failed';

export type ScannerBenchmarkRunInput = {
  id: string;
  deviceLabel: string;
  appBuild: string;
  mode: 'automatic_scan' | 'single_scan';
  samples: ScannerPerformanceSample[];
  outcomes: ScannerBenchmarkOutcome[];
  startedAt: string;
  endedAt: string;
  notes?: string | null;
};

export type ScannerBenchmarkRun = {
  schemaVersion: 1;
  id: string;
  deviceLabel: string;
  appBuild: string;
  mode: ScannerBenchmarkRunInput['mode'];
  startedAt: string;
  endedAt: string;
  performance: ScannerPerformanceReport;
  metrics: {
    firstScanLatencyMs: number | null;
    warmScanLatencyMs: number | null;
    averageScanTimeMs: number | null;
    averageOcrTimeMs: number | null;
    averageScryfallLookupTimeMs: number | null;
    averageTotalUntilSessionInsertionMs: number | null;
    averageCameraFps: number | null;
    averageFallbackCount: number | null;
    successRate: number | null;
    reviewRate: number | null;
    failureRate: number | null;
  };
  notes: string | null;
  privacy: {
    sourceImagesIncluded: false;
    sourceImagePathsIncluded: false;
  };
};

export function createScannerBenchmarkRun(input: ScannerBenchmarkRunInput): ScannerBenchmarkRun {
  const performance = buildScannerPerformanceReport(input.samples);
  return {
    schemaVersion: 1,
    id: sanitizeIdentifier(input.id),
    deviceLabel: sanitizeLabel(input.deviceLabel),
    appBuild: sanitizeLabel(input.appBuild),
    mode: input.mode,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    performance,
    metrics: {
      firstScanLatencyMs: input.samples.at(-1)?.totalUntilSessionInsertionMs ?? null,
      warmScanLatencyMs: input.samples[0]?.totalUntilSessionInsertionMs ?? null,
      averageScanTimeMs: performance.averages.averageScanTimeMs,
      averageOcrTimeMs: performance.averages.averageOcrTimeMs,
      averageScryfallLookupTimeMs: performance.averages.averageScryfallLookupTimeMs,
      averageTotalUntilSessionInsertionMs: performance.averages.averageTotalUntilSessionInsertionMs,
      averageCameraFps: performance.averages.averageCameraFps,
      averageFallbackCount: averageFallbackCount(input.samples),
      successRate: rate(input.outcomes, 'success'),
      reviewRate: rate(input.outcomes, 'needs_review'),
      failureRate: rate(input.outcomes, 'failed'),
    },
    notes: input.notes ? sanitizeLabel(input.notes) : null,
    privacy: {
      sourceImagesIncluded: false,
      sourceImagePathsIncluded: false,
    },
  };
}

export function serializeScannerBenchmarkRun(run: ScannerBenchmarkRun) {
  return JSON.stringify(run, null, 2);
}

export function scannerBenchmarkMarkdownSummary(run: ScannerBenchmarkRun) {
  return [
    `# Scanner Benchmark ${run.id}`,
    '',
    `- Mode: ${run.mode}`,
    `- Device: ${run.deviceLabel}`,
    `- Samples: ${run.performance.sampleCount}`,
    `- First scan latency: ${metric(run.metrics.firstScanLatencyMs, 'ms')}`,
    `- Warm scan latency: ${metric(run.metrics.warmScanLatencyMs, 'ms')}`,
    `- Average OCR: ${metric(run.metrics.averageOcrTimeMs, 'ms')}`,
    `- Average Scryfall lookup: ${metric(run.metrics.averageScryfallLookupTimeMs, 'ms')}`,
    `- Average total until session insertion: ${metric(run.metrics.averageTotalUntilSessionInsertionMs, 'ms')}`,
    `- Average camera FPS: ${metric(run.metrics.averageCameraFps, 'fps')}`,
    `- Review rate: ${percent(run.metrics.reviewRate)}`,
    `- Failure rate: ${percent(run.metrics.failureRate)}`,
    '',
    'No source images or source image paths are included in this report.',
  ].join('\n');
}

function averageFallbackCount(samples: ScannerPerformanceSample[]) {
  if (!samples.length) return null;
  return Math.round(samples.reduce((sum, sample) => sum + sample.fallbackCount, 0) / samples.length);
}

function rate(outcomes: ScannerBenchmarkOutcome[], target: ScannerBenchmarkOutcome) {
  if (!outcomes.length) return null;
  return Math.round((outcomes.filter((outcome) => outcome === target).length / outcomes.length) * 1000) / 1000;
}

function sanitizeIdentifier(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80) || 'scanner-benchmark';
}

function sanitizeLabel(value: string) {
  return value.replace(/file:\/\/\S+/gi, '[local-file]').replace(/[A-Z]:\\\S+/gi, '[local-file]').trim().slice(0, 240);
}

function metric(value: number | null, unit: string) {
  return value === null ? 'unavailable' : `${value} ${unit}`;
}

function percent(value: number | null) {
  return value === null ? 'unavailable' : `${Math.round(value * 100)}%`;
}
