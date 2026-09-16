import type { MagicBenchmarkFixtureManifestEntry } from './magic-recognition-provider.ts';
import { runScannerRecognitionLab, type ScannerRecognitionLabReport } from './scanner-recognition-lab.ts';
import { buildScannerProviderManifest, resolveScannerProviderFlags, type ScannerProviderAvailability, type ScannerProviderKind, type ScannerProviderManifest } from './scanner-provider-stack.ts';

type PrepareTcgTrackingScanImage = typeof import('./tcgtracking-scan-provider.ts')['prepareTcgTrackingScanImage'];
type ScanPreparedImageWithTcgTracking = typeof import('./tcgtracking-scan-provider.ts')['scanPreparedImageWithTcgTracking'];

export type ScannerProviderBakeoffFixture = Pick<
  MagicBenchmarkFixtureManifestEntry,
  'id' | 'localImagePath' | 'expectedCardName' | 'expectedSetCode' | 'expectedCollectorNumber' | 'expectedScryfallId' | 'expectedLanguage' | 'notes'
>;

export type ScannerProviderBakeoffStatus =
  | ScannerProviderAvailability
  | 'matched'
  | 'partial'
  | 'not_configured'
  | 'adapter_error';

export type ScannerProviderBakeoffCandidate = {
  name: string | null;
  setCode: string | null;
  collectorNumber: string | null;
  scryfallId: string | null;
  confidence: number | null;
};

export type ScannerProviderBakeoffResult = {
  providerId: string;
  providerName: string;
  kind: ScannerProviderKind;
  status: ScannerProviderBakeoffStatus;
  topCandidate: ScannerProviderBakeoffCandidate | null;
  expectedNameMatch: boolean;
  exactPrintingMatch: boolean;
  latencyMs: number | null;
  notes: string[];
};

export type ScannerProviderBakeoffAdapterContext = {
  provider: ScannerProviderManifest;
  flags: ReturnType<typeof resolveScannerProviderFlags>;
  allowNetwork: boolean;
};

export type ScannerProviderBakeoffAdapter = {
  id: string;
  name: string;
  kind: ScannerProviderKind;
  evaluate(fixture: ScannerProviderBakeoffFixture, context: ScannerProviderBakeoffAdapterContext): Promise<ScannerProviderBakeoffResult> | ScannerProviderBakeoffResult;
};

export type ScannerProviderBakeoffProviderSummary = {
  providerId: string;
  providerName: string;
  kind: ScannerProviderKind;
  availability: ScannerProviderAvailability;
  fixturesEvaluated: number;
  matchedFixtures: number;
  exactNameFixtures: number;
  exactPrintingFixtures: number;
  averageLatencyMs: number | null;
  topCandidate: string | null;
  notes: string[];
};

export type ScannerProviderBakeoffFixtureResult = {
  fixtureId: string;
  expectedName: string;
  expectedSetCode: string;
  expectedCollectorNumber: string;
  providerResults: ScannerProviderBakeoffResult[];
};

export type ScannerProviderBakeoffReport = {
  schemaVersion: 1;
  generatedAt: string;
  recommendation: string;
  providerManifest: ScannerProviderManifest[];
  fixtures: ScannerProviderBakeoffFixtureResult[];
  providers: ScannerProviderBakeoffProviderSummary[];
};

export function createScannerProviderBakeoffAdapters(options: {
  includeBaseline?: boolean;
  includeTcgTracking?: boolean;
} = {}): ScannerProviderBakeoffAdapter[] {
  const adapters: ScannerProviderBakeoffAdapter[] = [];
  if (options.includeBaseline ?? true) adapters.push(createCurrentScannerBaselineAdapter());
  if (options.includeTcgTracking ?? true) adapters.push(createTcgTrackingBakeoffAdapter());
  return adapters;
}

export function createCurrentScannerBaselineAdapter(deps: {
  runScannerRecognitionLab?: typeof runScannerRecognitionLab;
} = {}): ScannerProviderBakeoffAdapter {
  const runLab = deps.runScannerRecognitionLab ?? runScannerRecognitionLab;
  return {
    id: 'trading-docks-local',
    name: 'Trading Docks local OCR + visual pipeline',
    kind: 'recognition',
    async evaluate(fixture) {
      const started = Date.now();
      try {
        const report = await runLab({
          imageUri: fixture.localImagePath,
          expectedName: fixture.expectedCardName,
          expectedOracleId: fixture.expectedScryfallId,
          referenceCandidates: [],
          includeDebugArtifacts: false,
        });
        const topCandidate = report.engines.ocr_accurate.top1;
        return {
          providerId: 'trading-docks-local',
          providerName: 'Trading Docks local OCR + visual pipeline',
          kind: 'recognition',
          status: classifyAdapterStatus({
            expectedName: fixture.expectedCardName,
            topCandidate: topCandidate?.name ?? null,
            exactPrinting: topCandidate?.scryfallId === fixture.expectedScryfallId,
          }),
          topCandidate: topCandidate ? {
            name: topCandidate.name,
            setCode: null,
            collectorNumber: null,
            scryfallId: topCandidate.scryfallId,
            confidence: topCandidate.score ?? null,
          } : null,
          expectedNameMatch: topCandidate?.name === fixture.expectedCardName,
          exactPrintingMatch: topCandidate?.scryfallId === fixture.expectedScryfallId,
          latencyMs: report.engines.ocr_accurate.durationMs ?? Math.max(0, Date.now() - started),
          notes: [
            'Baseline adapter uses the current local OCR + visual lab.',
            'It stays local-only and never includes source image paths in the report.',
          ],
        };
      } catch (error) {
        return adapterError('trading-docks-local', 'Trading Docks local OCR + visual pipeline', 'recognition', error, Date.now() - started);
      }
    },
  };
}

export function createTcgTrackingBakeoffAdapter(deps: {
  prepareTcgTrackingScanImage?: PrepareTcgTrackingScanImage;
  scanPreparedImageWithTcgTracking?: ScanPreparedImageWithTcgTracking;
} = {}): ScannerProviderBakeoffAdapter {
  return {
    id: 'tcgtracking',
    name: 'TCGTracking scan provider',
    kind: 'recognition',
    async evaluate(fixture, context) {
      const started = Date.now();
      if (!context.flags.tcgtrackingEnabled) {
        return unavailableAdapterResult('tcgtracking', 'TCGTracking scan provider', 'recognition', 'disabled', ['Feature flag is off.']);
      }
      if (!context.allowNetwork) {
        return unavailableAdapterResult('tcgtracking', 'TCGTracking scan provider', 'recognition', 'not_configured', ['Network access is disabled for this bake-off run.']);
      }
      try {
        const providerModules = deps.prepareTcgTrackingScanImage && deps.scanPreparedImageWithTcgTracking
          ? {
            prepare: deps.prepareTcgTrackingScanImage,
            scan: deps.scanPreparedImageWithTcgTracking,
            gameId: 1,
          }
          : await import('./tcgtracking-scan-provider.ts').then((module) => ({
            prepare: module.prepareTcgTrackingScanImage,
            scan: module.scanPreparedImageWithTcgTracking,
            gameId: module.TCGTRACKING_MAGIC_GAME_ID,
          }));
        const prepared = await providerModules.prepare({ imageUri: fixture.localImagePath });
        const result = await providerModules.scan({
          preparedImage: prepared,
          gameId: providerModules.gameId,
        });
        if (!result.ok) {
          return {
            providerId: 'tcgtracking',
            providerName: 'TCGTracking scan provider',
            kind: 'recognition',
            status: 'partial',
            topCandidate: null,
            expectedNameMatch: false,
            exactPrintingMatch: false,
            latencyMs: result.latencyMs ?? Math.max(0, Date.now() - started),
            notes: [result.reason],
          };
        }
        const topCandidate = result.candidates[0] ?? null;
        return {
          providerId: 'tcgtracking',
          providerName: 'TCGTracking scan provider',
          kind: 'recognition',
          status: classifyAdapterStatus({
            expectedName: fixture.expectedCardName,
            topCandidate: topCandidate?.name ?? null,
            exactPrinting: topCandidate?.id === fixture.expectedScryfallId,
          }),
          topCandidate: topCandidate ? {
            name: topCandidate.name,
            setCode: topCandidate.setCode ?? null,
            collectorNumber: topCandidate.collectorNumber ?? null,
            scryfallId: topCandidate.id,
            confidence: topCandidate.confidence ?? result.topConfidence ?? null,
          } : null,
          expectedNameMatch: topCandidate?.name === fixture.expectedCardName,
          exactPrintingMatch: topCandidate?.id === fixture.expectedScryfallId,
          latencyMs: result.latencyMs ?? Math.max(0, Date.now() - started),
          notes: [
            `Confidence band: ${result.confidenceBand}.`,
            result.fallbackRecommended ? 'Fallback is recommended for this result.' : 'Fallback was not recommended by the provider.',
          ],
        };
      } catch (error) {
        return adapterError('tcgtracking', 'TCGTracking scan provider', 'recognition', error, Date.now() - started);
      }
    },
  };
}

export function createUnavailableProviderAdapter(provider: ScannerProviderManifest): ScannerProviderBakeoffAdapter {
  return {
    id: provider.id,
    name: provider.name,
    kind: provider.kind,
    evaluate() {
      return unavailableAdapterResult(
        provider.id,
        provider.name,
        provider.kind,
        provider.availability === 'available' ? 'not_configured' : provider.availability,
        [provider.notes],
      );
    },
  };
}

export async function runScannerProviderBakeoff(input: {
  fixtures: readonly ScannerProviderBakeoffFixture[];
  adapters?: readonly ScannerProviderBakeoffAdapter[];
  env?: Record<string, string | undefined>;
  allowNetwork?: boolean;
  generatedAt?: string;
}): Promise<ScannerProviderBakeoffReport> {
  const flags = resolveScannerProviderFlags(input.env ?? process.env);
  const providerManifest = buildScannerProviderManifest(flags);
  const adapterMap = new Map((input.adapters ?? createScannerProviderBakeoffAdapters()).map((adapter) => [adapter.id, adapter]));
  const providerRows = new Map<string, ScannerProviderBakeoffFixtureResult['providerResults']>();
  const fixtureResults: ScannerProviderBakeoffFixtureResult[] = [];
  const allowNetwork = input.allowNetwork ?? false;

  for (const fixture of input.fixtures) {
    const providerResults: ScannerProviderBakeoffResult[] = [];
    for (const provider of providerManifest) {
      const adapter = adapterMap.get(provider.id) ?? createUnavailableProviderAdapter(provider);
      const result = await adapter.evaluate(fixture, { provider, flags, allowNetwork });
      providerResults.push(result);
      const existing = providerRows.get(provider.id) ?? [];
      existing.push(result);
      providerRows.set(provider.id, existing);
    }
    fixtureResults.push({
      fixtureId: fixture.id,
      expectedName: fixture.expectedCardName,
      expectedSetCode: fixture.expectedSetCode,
      expectedCollectorNumber: fixture.expectedCollectorNumber,
      providerResults,
    });
  }

  return {
    schemaVersion: 1,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    recommendation: buildScannerProviderRecommendation(providerManifest, providerRows),
    providerManifest,
    fixtures: fixtureResults,
    providers: providerManifest.map((provider) => summarizeProvider(provider, providerRows.get(provider.id) ?? [])),
  };
}

export function serializeScannerProviderBakeoffJson(report: ScannerProviderBakeoffReport) {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function serializeScannerProviderBakeoffMarkdown(report: ScannerProviderBakeoffReport) {
  return [
    '# Scanner Provider Bakeoff',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Fixtures: ${report.fixtures.length}`,
    `- Providers: ${report.providers.length}`,
    '',
    '## Recommendation',
    report.recommendation,
    '',
    '## Provider Summary',
    '| Provider | Kind | Availability | Fixtures | Exact name | Exact printing | Avg latency | Top candidate | Notes |',
    '| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- |',
    ...report.providers.map((provider) => [
      provider.providerName,
      provider.kind,
      provider.availability,
      provider.fixturesEvaluated,
      provider.exactNameFixtures,
      provider.exactPrintingFixtures,
      metric(provider.averageLatencyMs),
      escapeTableCell(provider.topCandidate ?? 'none'),
      escapeTableCell(provider.notes.join(' ')),
    ].join(' | ')),
    '',
    '## Fixture Results',
    ...report.fixtures.map((fixture) => [
      `- ${fixture.fixtureId}: ${fixture.expectedName} ${fixture.expectedSetCode} #${fixture.expectedCollectorNumber}`,
      ...fixture.providerResults.map((result) => `  - ${result.providerName}: ${result.status}${result.topCandidate?.name ? `, ${result.topCandidate.name}` : ''}${result.latencyMs !== null ? `, ${result.latencyMs} ms` : ''}`),
    ].join('\n')),
    '',
    'This report intentionally omits source image paths and image contents.',
  ].join('\n');
}

function summarizeProvider(provider: ScannerProviderManifest, results: readonly ScannerProviderBakeoffResult[]): ScannerProviderBakeoffProviderSummary {
  const exactNameFixtures = results.filter((result) => result.expectedNameMatch).length;
  const exactPrintingFixtures = results.filter((result) => result.exactPrintingMatch).length;
  return {
    providerId: provider.id,
    providerName: provider.name,
    kind: provider.kind,
    availability: provider.availability,
    fixturesEvaluated: results.length,
    matchedFixtures: results.filter((result) => result.status === 'matched').length,
    exactNameFixtures,
    exactPrintingFixtures,
    averageLatencyMs: average(results.map((result) => result.latencyMs)),
    topCandidate: results.find((result) => result.topCandidate?.name)?.topCandidate?.name ?? null,
    notes: unique([
      provider.notes,
      ...results.flatMap((result) => result.notes),
    ]),
  };
}

function buildScannerProviderRecommendation(manifest: readonly ScannerProviderManifest[], providerRows: Map<string, readonly ScannerProviderBakeoffResult[]>) {
  const hasBaseline = manifest.some((provider) => provider.id === 'trading-docks-local');
  const hasTcgTracking = manifest.some((provider) => provider.id === 'tcgtracking');
  const cardsight = manifest.find((provider) => provider.id === 'cardsight');
  const scanbot = manifest.find((provider) => provider.id === 'scanbot-normalizer');
  const dynamsoft = manifest.find((provider) => provider.id === 'dynamsoft-normalizer');
  const tineye = manifest.find((provider) => provider.id === 'tineye-cardsearchengine');
  const lines = [
    hasBaseline ? 'Keep Trading Docks local OCR + visual + Scryfall authority as the canonical baseline.' : 'Add a baseline adapter before treating this report as actionable.',
    hasTcgTracking ? 'Use TCGTracking as the first server-backed fallback because it already exists in the product and can be feature-flagged.' : 'TCGTracking is not present in the manifest for this run.',
  ];
  if (cardsight?.availability === 'requires_credentials') {
    lines.push('CardSight is the strongest off-the-shelf provider candidate to evaluate next, but only through a server-side secret and a private bake-off.');
  } else {
    lines.push('CardSight remains a future provider candidate until server-side credentials are wired.');
  }
  if (scanbot?.availability === 'requires_development_build' || dynamsoft?.availability === 'requires_development_build') {
    lines.push('Scanbot or Dynamsoft should be evaluated as geometry/normalization helpers, not canonical identity sources.');
  }
  if (tineye?.availability === 'requires_reference_dataset') {
    lines.push('TinEye needs a permitted reference corpus and license review before any automated integration.');
  }
  const tcgRows = providerRows.get('tcgtracking') ?? [];
  if (!tcgRows.length || tcgRows.every((row) => row.status === 'disabled' || row.status === 'not_configured')) {
    lines.push('This run does not include a live TCGTracking provider result.');
  }
  return lines.join(' ');
}

function classifyAdapterStatus(input: {
  expectedName: string;
  topCandidate: string | null;
  exactPrinting: boolean;
}): ScannerProviderBakeoffStatus {
  if (!input.topCandidate) return 'partial';
  if (input.topCandidate === input.expectedName && input.exactPrinting) return 'matched';
  if (input.topCandidate === input.expectedName) return 'partial';
  return 'partial';
}

function unavailableAdapterResult(
  providerId: string,
  providerName: string,
  kind: ScannerProviderKind,
  status: ScannerProviderAvailability | 'not_configured',
  notes: string[],
): ScannerProviderBakeoffResult {
  return {
    providerId,
    providerName,
    kind,
    status,
    topCandidate: null,
    expectedNameMatch: false,
    exactPrintingMatch: false,
    latencyMs: null,
    notes,
  };
}

function adapterError(
  providerId: string,
  providerName: string,
  kind: ScannerProviderKind,
  error: unknown,
  latencyMs: number,
): ScannerProviderBakeoffResult {
  return {
    providerId,
    providerName,
    kind,
    status: 'adapter_error',
    topCandidate: null,
    expectedNameMatch: false,
    exactPrintingMatch: false,
    latencyMs,
    notes: [error instanceof Error ? error.message : String(error)],
  };
}

function average(values: readonly (number | null)[]) {
  const measured = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!measured.length) return null;
  return Math.round(measured.reduce((sum, value) => sum + value, 0) / measured.length);
}

function unique(values: readonly string[]) {
  const cleaned = values.map((value) => value.trim()).filter(Boolean);
  return [...new Set(cleaned)];
}

function metric(value: number | null) {
  return value === null ? 'n/a' : `${value} ms`;
}

function escapeTableCell(value: string) {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ');
}
