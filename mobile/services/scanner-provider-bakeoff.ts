import { MOBILE_CANONICAL_SITE_URL } from './mobile-release-config.ts';
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
  details?: Record<string, unknown>;
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
  includeCardSight?: boolean;
} = {}): ScannerProviderBakeoffAdapter[] {
  const adapters: ScannerProviderBakeoffAdapter[] = [];
  if (options.includeBaseline ?? true) adapters.push(createCurrentScannerBaselineAdapter());
  if (options.includeTcgTracking ?? true) adapters.push(createTcgTrackingBakeoffAdapter());
  if (options.includeCardSight ?? true) adapters.push(createCardSightBakeoffAdapter());
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

type PrepareCardSightScanImage = (input: {
  imageUri: string;
  targetLongEdge?: number;
}) => Promise<{
  image: string;
  width: number;
  height: number;
  bytes: number;
  mimeType: 'image/jpeg';
}>;
type CardSightRequestMode = 'raw' | 'cropped';
type CardSightRouteCandidate = {
  printingId?: string | null;
  canonicalCardId?: string | null;
  name?: string | null;
  setCode?: string | null;
  setName?: string | null;
  collectorNumber?: string | null;
  language?: string | null;
  finish?: string | null;
  confidence?: number | null;
  latencyMs?: number | null;
  providerIds?: Record<string, string | number>;
};
type CardSightRouteResponse = {
  status?: string;
  mode?: CardSightRequestMode;
  candidates?: CardSightRouteCandidate[];
  topCandidate?: CardSightRouteCandidate | null;
  intelligence?: {
    selectedPrintingId?: string | null;
    requiresConfirmation?: boolean;
    candidates?: Array<{ printingId?: string | null; name?: string | null; confidence?: number | null }>;
  } | null;
  fallbackRecommended?: boolean;
  latencyMs?: number | null;
  totalLatencyMs?: number | null;
  error?: string;
};

export function createCardSightBakeoffAdapter(deps: {
  prepareCardSightScanImage?: PrepareCardSightScanImage;
  getAccessToken?: () => Promise<string | null> | string | null;
  fetcher?: typeof fetch;
} = {}): ScannerProviderBakeoffAdapter {
  const prepareScanImage = deps.prepareCardSightScanImage ?? prepareCardSightScanImage;
  return {
    id: 'cardsight',
    name: 'CardSight AI',
    kind: 'recognition',
    async evaluate(fixture, context) {
      const started = Date.now();
      if (!context.flags.cardsightEnabled) {
        return unavailableAdapterResult('cardsight', 'CardSight AI', 'recognition', 'disabled', ['Feature flag is off.']);
      }
      if (!context.allowNetwork) {
        return unavailableAdapterResult('cardsight', 'CardSight AI', 'recognition', 'not_configured', ['Network access is disabled for this bake-off run.']);
      }
      const session = await loadScannerSessionToken(deps.getAccessToken);
      if (!session) {
        return unavailableAdapterResult('cardsight', 'CardSight AI', 'recognition', 'not_configured', ['Scanner authentication is not available for the CardSight request.']);
      }

      try {
        const [rawImage, croppedImage] = await Promise.all([
          prepareScanImage({ imageUri: fixture.localImagePath, targetLongEdge: 1440 }),
          prepareScanImage({ imageUri: fixture.localImagePath, targetLongEdge: 720 }),
        ]);
        const [rawResult, croppedResult] = await Promise.all([
          requestCardSightScan({
            image: rawImage.image,
            mode: 'raw',
            fetcher: deps.fetcher,
            accessToken: session.accessToken,
          }),
          requestCardSightScan({
            image: croppedImage.image,
            mode: 'cropped',
            fetcher: deps.fetcher,
            accessToken: session.accessToken,
          }),
        ]);
        const winner = chooseCardSightWinner(rawResult, croppedResult);
        const topCandidate = winner?.topCandidate ?? null;
        const selectedPrintingId = winner?.intelligence?.selectedPrintingId ?? null;
        const exactPrintingMatch = Boolean(
          fixture.expectedScryfallId &&
          (selectedPrintingId === fixture.expectedScryfallId || topCandidate?.printingId === fixture.expectedScryfallId || topCandidate?.canonicalCardId === fixture.expectedScryfallId),
        );
        const exactNameMatch = Boolean(topCandidate?.name && topCandidate.name === fixture.expectedCardName);
        const status = winner
          ? classifyAdapterStatus({
            expectedName: fixture.expectedCardName,
            topCandidate: topCandidate?.name ?? null,
            exactPrinting: exactPrintingMatch,
          })
          : 'partial';
        return {
          providerId: 'cardsight',
          providerName: 'CardSight AI',
          kind: 'recognition',
          status: winner ? status : 'partial',
          topCandidate: topCandidate ? {
            name: topCandidate.name ?? null,
            setCode: topCandidate.setCode ?? null,
            collectorNumber: topCandidate.collectorNumber ?? null,
            scryfallId: topCandidate.printingId ?? topCandidate.canonicalCardId ?? null,
            confidence: topCandidate.confidence ?? null,
          } : null,
          expectedNameMatch: exactNameMatch,
          exactPrintingMatch,
          latencyMs: winner?.latencyMs ?? Math.max(0, Date.now() - started),
          notes: [
            winner?.mode === 'raw' ? 'CardSight raw image performed best in this run.' : 'CardSight cropped image performed best in this run.',
            summarizeCardSightMode('raw', rawResult),
            summarizeCardSightMode('cropped', croppedResult),
          ].filter(Boolean),
          details: {
            raw: rawResult,
            cropped: croppedResult,
            selectedMode: winner?.mode ?? null,
            selectedPrintingId,
          },
        };
      } catch (error) {
        return adapterError('cardsight', 'CardSight AI', 'recognition', error, Date.now() - started);
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

async function loadScannerSessionToken(getAccessToken?: () => Promise<string | null> | string | null) {
  if (getAccessToken) {
    const accessToken = await getAccessToken();
    return accessToken ? { accessToken } : null;
  }
  const { supabase } = await import('../lib/supabase.ts');
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  return accessToken ? { accessToken } : null;
}

async function requestCardSightScan(input: {
  image: string;
  mode: CardSightRequestMode;
  fetcher?: typeof fetch;
  accessToken: string;
}): Promise<CardSightRouteResponse> {
  const response = await (input.fetcher ?? fetch)(`${MOBILE_CANONICAL_SITE_URL}/api/scanner/cardsight`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image: input.image,
      game: 'magic',
      limit: 5,
      mode: input.mode,
    }),
  });
  const payload = await response.json().catch(() => ({})) as CardSightRouteResponse;
  if (!response.ok || payload.status === 'provider_failed' || payload.status === 'timeout' || payload.status === 'unavailable') {
    return {
      status: payload.status ?? 'provider_failed',
      mode: input.mode,
      candidates: [],
      topCandidate: null,
      intelligence: null,
      fallbackRecommended: true,
      latencyMs: payload.latencyMs ?? null,
      totalLatencyMs: payload.totalLatencyMs ?? null,
      error: payload.error ?? `CardSight returned HTTP ${response.status}.`,
    };
  }
  return {
    status: payload.status ?? 'candidates',
    mode: input.mode,
    candidates: Array.isArray(payload.candidates) ? payload.candidates : [],
    topCandidate: payload.topCandidate ?? payload.candidates?.[0] ?? null,
    intelligence: payload.intelligence ?? null,
    fallbackRecommended: payload.fallbackRecommended ?? false,
    latencyMs: payload.latencyMs ?? null,
    totalLatencyMs: payload.totalLatencyMs ?? null,
    error: payload.error,
  };
}

function chooseCardSightWinner(raw: CardSightRouteResponse, cropped: CardSightRouteResponse) {
  const rawCandidate = raw.topCandidate ?? raw.candidates?.[0] ?? null;
  const croppedCandidate = cropped.topCandidate ?? cropped.candidates?.[0] ?? null;
  const rawScore = scoreCardSightResult(raw, rawCandidate);
  const croppedScore = scoreCardSightResult(cropped, croppedCandidate);
  if (!rawCandidate && !croppedCandidate) return null;
  return rawScore >= croppedScore ? { ...raw, mode: 'raw' as const } : { ...cropped, mode: 'cropped' as const };
}

function scoreCardSightResult(result: CardSightRouteResponse, candidate: CardSightRouteCandidate | null) {
  if (!candidate) return -Infinity;
  const selected = result.intelligence?.selectedPrintingId ? 3 : 0;
  const exact = candidate.printingId ? 2 : candidate.canonicalCardId ? 1.5 : 0;
  const confidence = typeof candidate.confidence === 'number' && Number.isFinite(candidate.confidence) ? candidate.confidence : 0;
  const latency = typeof result.latencyMs === 'number' && Number.isFinite(result.latencyMs) ? Math.max(0, 1 - (result.latencyMs / 10_000)) : 0;
  return selected + exact + confidence + latency;
}

function summarizeCardSightMode(mode: CardSightRequestMode, result: CardSightRouteResponse) {
  const candidate = result.topCandidate ?? result.candidates?.[0] ?? null;
  if (!candidate) return `CardSight ${mode}: no candidate.`;
  const selected = result.intelligence?.selectedPrintingId ? `selected=${result.intelligence.selectedPrintingId}` : 'selected=none';
  const confidence = typeof candidate.confidence === 'number' ? candidate.confidence.toFixed(2) : 'n/a';
  return `CardSight ${mode}: ${candidate.name ?? 'unknown'} (${selected}, confidence=${confidence}, latency=${result.latencyMs ?? 'n/a'} ms).`;
}

async function prepareCardSightScanImage(input: {
  imageUri: string;
  targetLongEdge?: number;
}): Promise<{ image: string; width: number; height: number; bytes: number; mimeType: 'image/jpeg' }> {
  const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
  const result = await manipulateAsync(input.imageUri, [{
    resize: input.targetLongEdge
      ? { width: input.targetLongEdge }
      : { width: 1280 },
  }], {
    compress: 0.75,
    format: SaveFormat.JPEG,
    base64: true,
  });
  const image = result.base64 ?? '';
  return {
    image,
    width: result.width,
    height: result.height,
    bytes: decodedBase64Bytes(image),
    mimeType: 'image/jpeg',
  };
}

function decodedBase64Bytes(image: string) {
  const clean = image.includes(',') ? image.split(',').pop() ?? '' : image;
  const normalized = clean.replace(/\s+/g, '');
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
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
