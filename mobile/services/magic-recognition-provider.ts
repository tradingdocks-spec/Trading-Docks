import { normalizeCardFinish, type CardFinish } from './collector-workspace.ts';
import type { TcgRecognitionAdapter, UniversalScanCandidate } from './multi-tcg-scanner.ts';
import {
  SCANNER_CONFIDENCE_THRESHOLD,
  parseCollectorInfoText,
  type ArtworkObservation,
  type CollectorInfoObservation,
  type FinishObservation,
  type OCRObservation,
  type RecognitionCandidate,
  type RecognitionConfidence,
  type RecognitionSignalScore,
  type ScannerBenchmarkCategory,
  type ScannerBenchmarkFixture,
  type ScannerBenchmarkMetrics,
  type SymbolObservation,
} from './scanner-intelligence.ts';

export const MAGIC_BENCHMARK_CATEGORIES: ScannerBenchmarkCategory[] = [
  'modern_frame',
  'old_border',
  'borderless',
  'extended_art',
  'showcase',
  'retro_frame',
  'foil',
  'etched_foil',
  'sleeved_card',
  'glare',
  'low_light',
  'angled_card',
  'foreign_language',
  'double_faced_card',
  'damaged_card',
  'token',
  'similar_artwork_reprints',
  'same_name_many_sets',
];

export type MagicRecognitionInput = {
  nameObservation?: OCRObservation;
  collectorInfoObservation?: CollectorInfoObservation;
  collectorInfoText?: string;
  artworkObservation?: ArtworkObservation;
  setSymbolObservation?: SymbolObservation;
  finishObservation?: FinishObservation;
  language?: string | null;
  online?: boolean;
  cachedCandidates?: RecognitionCandidate[];
};

export type MagicRecognitionResult =
  | {
    ok: true;
    selected: RecognitionCandidate | null;
    candidates: RecognitionCandidate[];
    confidence: RecognitionConfidence;
    explanation: string[];
    source: 'scryfall' | 'cache' | 'injected';
  }
  | { ok: false; reason: string; code?: MagicLookupErrorCode; offline?: boolean };

export type MagicLookupErrorCode =
  | 'no_title_read'
  | 'no_candidate_found'
  | 'network_unavailable'
  | 'service_error'
  | 'invalid_response'
  | 'cancelled';

export type MagicCatalogQuery = {
  name?: string;
  setCode?: string | null;
  collectorNumber?: string | null;
};

export type MagicCatalogSearch = (query: MagicCatalogQuery) => Promise<RecognitionCandidate[]>;

export type MagicCatalogLookupDiagnostics = {
  queryString: string | null;
  httpStatus: number | null;
  responseItemCount: number | null;
  errorCode: MagicLookupErrorCode | null;
  latencyMs: number;
  topThreeCandidateNames: string[];
};

export type MagicCatalogDiagnosticsSink = (diagnostics: MagicCatalogLookupDiagnostics) => void;

export type MagicRecognitionThresholdClass =
  | 'auto_suggest'
  | 'one_tap_confirm'
  | 'review_alternatives'
  | 'manual_search_required';

export type MagicRecognitionPresentation = {
  thresholdClass: MagicRecognitionThresholdClass;
  label: 'Recognized' | 'Likely' | 'Ambiguous' | 'Manual review required';
  tone: 'success' | 'info' | 'warning';
  description: string;
};

export type MagicBenchmarkFrameType =
  | ScannerBenchmarkCategory
  | 'double_faced'
  | 'same_name_reprint'
  | 'same_name_reprints'
  | 'special_finish'
  | 'unsupported_card';

export type MagicBenchmarkFixtureManifestEntry = {
  id: string;
  localImagePath: string;
  expectedCardName: string;
  expectedSetCode: string;
  expectedCollectorNumber: string;
  expectedScryfallId: string;
  expectedLanguage: string;
  expectedFinish: FinishObservation['finish'];
  frameType: MagicBenchmarkFrameType;
  lightingCondition: 'controlled' | 'glare' | 'low_light' | 'mixed' | 'unknown';
  sleeveStatus: 'unsleeved' | 'single_sleeved' | 'double_sleeved' | 'toploader' | 'unknown';
  angle: 'flat' | 'slight_angle' | 'steep_angle' | 'unknown';
  notes: string;
  observed?: {
    nameText?: string;
    nameConfidence?: number;
    collectorInfoText?: string;
    setCode?: string | null;
    collectorNumber?: string | null;
    language?: string | null;
    finish?: FinishObservation['finish'];
    finishConfidence?: number;
    artworkLayout?: string | null;
    artworkSimilarity?: number | null;
    setSymbol?: string | null;
    setSymbolConfidence?: number | null;
  };
  candidateCatalog?: RecognitionCandidate[];
};

export type MagicBenchmarkFixtureManifest = {
  schemaVersion: 1;
  fixtureSetId: string;
  createdAt: string;
  fixtures: MagicBenchmarkFixtureManifestEntry[];
};

export type MagicBenchmarkManifest = {
  fixtureRoot: string;
  fixtures: ScannerBenchmarkFixture[];
  metrics: ScannerBenchmarkMetrics;
  copyrightPolicy: 'private_local_fixtures_only';
};

export type MagicBenchmarkFixtureResult = {
  fixtureId: string;
  sanitizedImageId: string;
  frameType: MagicBenchmarkFrameType;
  lightingCondition: MagicBenchmarkFixtureManifestEntry['lightingCondition'];
  sleeveStatus: MagicBenchmarkFixtureManifestEntry['sleeveStatus'];
  angle: MagicBenchmarkFixtureManifestEntry['angle'];
  signalSource: 'observed_signals' | 'expected_metadata_seed' | 'catalog_only';
  ok: boolean;
  error: string | null;
  expected: {
    cardName: string;
    setCode: string;
    collectorNumber: string;
    scryfallId: string;
    language: string;
    finish: FinishObservation['finish'];
  };
  top1: {
    scryfallId: string | null;
    name: string | null;
    setCode: string | null;
    collectorNumber: string | null;
  };
  top3: {
    scryfallId: string;
    name: string;
    setCode: string | null;
    collectorNumber: string | null;
  }[];
  scores: {
    nameTop1: boolean;
    printingTop1: boolean;
    printingTop3: boolean;
    falseHighConfidence: boolean;
    finishCorrect: boolean | null;
    unsupportedRejected: boolean | null;
  };
  confidence: RecognitionConfidence;
  thresholdClass: MagicRecognitionThresholdClass;
  latencyMs: number;
};

export type MagicBenchmarkMetricsReport = ScannerBenchmarkMetrics & {
  cardNameTop1Accuracy: number | null;
  exactPrintingTop1Accuracy: number | null;
  exactPrintingTop3Accuracy: number | null;
  falseHighConfidenceRate: number | null;
  averageConfidence: number | null;
  finishAccuracy: number | null;
  unsupportedCardRejectionRate: number | null;
};

export type MagicCalibrationRecommendation = {
  kind: 'over_weighted_signal' | 'under_weighted_signal' | 'missing_evidence_inflation' | 'threshold_change' | 'weight_change';
  signal?: RecognitionSignalScore['key'];
  recommendation: string;
  evidence: string;
  applyAutomatically: false;
};

export type MagicBenchmarkReport = {
  generatedAt: string;
  fixtureSetId: string;
  fixtureCount: number;
  metrics: MagicBenchmarkMetricsReport;
  calibrationRecommendations: MagicCalibrationRecommendation[];
  results: MagicBenchmarkFixtureResult[];
  privacy: ReturnType<typeof magicRecognitionPrivacy>;
};

type MagicCandidateLoadResult =
  | { ok: true; candidates: RecognitionCandidate[]; source: 'scryfall' | 'cache' | 'injected' }
  | { ok: false; reason: string; code?: MagicLookupErrorCode; offline?: boolean };

export class MagicCatalogLookupError extends Error {
  readonly code: MagicLookupErrorCode;
  readonly status: number | null;
  readonly queryString: string | null;

  constructor(code: MagicLookupErrorCode, message: string, options: { status?: number | null; queryString?: string | null } = {}) {
    super(message);
    this.name = 'MagicCatalogLookupError';
    this.code = code;
    this.status = options.status ?? null;
    this.queryString = options.queryString ?? null;
  }
}

type ScryfallCard = {
  id?: string;
  oracle_id?: string | null;
  name?: string;
  set?: string;
  set_name?: string;
  collector_number?: string;
  lang?: string;
  finishes?: string[];
  layout?: string;
  color_identity?: string[];
  image_uris?: { normal?: string; large?: string };
  card_faces?: { image_uris?: { normal?: string; large?: string } }[];
  prices?: { usd?: string | null; usd_foil?: string | null; usd_etched?: string | null };
};

export const magicBenchmarkMetricsUnavailable: ScannerBenchmarkMetrics = {
  correctNameTop1: null,
  correctPrintingTop1: null,
  correctPrintingTop3: null,
  foilClassificationAccuracy: null,
  falseFoilRate: null,
  averageScanLatencyMs: null,
  manualCorrectionRate: null,
  failureRate: null,
  benchmarkedFixtureCount: 0,
};

export const MAGIC_RECOGNITION_THRESHOLDS = {
  autoSuggest: 96,
  oneTapConfirm: 88,
  reviewAlternatives: 70,
  manualSearchRequiredBelow: 70,
} as const;

export const MagicRecognitionAdapter: TcgRecognitionAdapter = {
  game: 'magic',
  label: 'Magic Recognition Adapter',
  catalogProviderId: 'scryfall',
  finishTaxonomy: ['normal', 'foil', 'etched', 'special', 'indeterminate'],
  regionMap: ['name', 'mana_cost', 'artwork', 'type_line', 'set_symbol', 'collector_info', 'collector_number', 'language_rarity'],
  signalWeights: {
    ocr_keyword: 0.2,
    bottom_information_layout: 0.24,
    logo_symbol_layout: 0.14,
    border_geometry: 0.12,
    artwork_embedding: 0.18,
    aspect_ratio: 0.12,
  },
  supports(candidate) {
    return candidate.game === 'magic' && candidate.card.provider === 'scryfall';
  },
  async recognize({ catalogCandidates, observations }) {
    const magicCandidates = catalogCandidates.filter((candidate) => candidate.game === 'magic');
    const collectorInfoText = observations.find((entry) => entry.signal === 'bottom_information_layout')?.value;
    const nameText = observations.find((entry) => entry.signal === 'ocr_keyword')?.value;
    const ranked = rankMagicCandidates({
      candidates: magicCandidates.map(universalToRecognitionCandidate),
      nameObservation: nameText ? { regionType: 'name', text: nameText, confidence: 72 } : undefined,
      collectorInfo: collectorInfoText ? parseCollectorInfoText(collectorInfoText) : undefined,
    });
    return ranked
      .map((candidate) => magicCandidates.find((entry) => entry.printing.externalId === candidate.id))
      .filter((candidate): candidate is UniversalScanCandidate => Boolean(candidate));
  },
};

export async function recognizeMagicCard(
  input: MagicRecognitionInput,
  searchCatalog: MagicCatalogSearch = searchScryfallMagicCatalog,
): Promise<MagicRecognitionResult> {
  const collectorInfo = input.collectorInfoObservation ?? (input.collectorInfoText ? parseCollectorInfoText(input.collectorInfoText) : undefined);
  const query: MagicCatalogQuery = {
    name: normalizeName(input.nameObservation?.text),
    setCode: collectorInfo?.setCode ?? null,
    collectorNumber: collectorInfo?.collectorNumber ?? null,
  };
  const loaded = await loadMagicCandidates(query, input, searchCatalog);
  if (!loaded.ok) return loaded;
  const ranked = rankMagicCandidates({
    candidates: loaded.candidates.filter((candidate) => !isMagicTokenOrUnsupported(candidate)),
    nameObservation: input.nameObservation,
    collectorInfo,
    artworkObservation: input.artworkObservation,
    setSymbolObservation: input.setSymbolObservation,
    finishObservation: input.finishObservation,
    language: input.language ?? collectorInfo?.language ?? null,
  });
  const selected = ranked[0] ?? null;
  const confidence = selected
    ? scoreMagicCandidate({
      candidate: selected,
      nameObservation: input.nameObservation,
      collectorInfo,
      artworkObservation: input.artworkObservation,
      setSymbolObservation: input.setSymbolObservation,
      finishObservation: input.finishObservation,
      language: input.language ?? collectorInfo?.language ?? null,
    })
    : emptyConfidence('No supported Magic printing matched the observed signals.');
  return {
    ok: true,
    selected,
    candidates: ranked,
    confidence,
    explanation: explainMagicConfidence(confidence),
    source: loaded.source,
  };
}

export function rankMagicCandidates(input: {
  candidates: RecognitionCandidate[];
  nameObservation?: OCRObservation;
  collectorInfo?: CollectorInfoObservation;
  artworkObservation?: ArtworkObservation;
  setSymbolObservation?: SymbolObservation;
  finishObservation?: FinishObservation;
  language?: string | null;
}) {
  return [...input.candidates]
    .map((candidate) => ({
      candidate,
      confidence: scoreMagicCandidate({
        candidate,
        nameObservation: input.nameObservation,
        collectorInfo: input.collectorInfo,
        artworkObservation: input.artworkObservation,
        setSymbolObservation: input.setSymbolObservation,
        finishObservation: input.finishObservation,
        language: input.language,
      }),
    }))
    .sort((a, b) => b.confidence.overall - a.confidence.overall || candidateTieBreak(a.candidate).localeCompare(candidateTieBreak(b.candidate)))
    .slice(0, 3)
    .map((entry) => entry.candidate);
}

export function scoreMagicCandidate(input: {
  candidate: RecognitionCandidate;
  nameObservation?: OCRObservation;
  collectorInfo?: CollectorInfoObservation;
  artworkObservation?: ArtworkObservation;
  setSymbolObservation?: SymbolObservation;
  finishObservation?: FinishObservation;
  language?: string | null;
}): RecognitionConfidence {
  const signals: RecognitionSignalScore[] = [
    signal('name_ocr', 'Name OCR', scoreName(input.nameObservation, input.candidate.name), 0.22, input.nameObservation?.text ?? 'Missing name OCR'),
    signal('set_code', 'Set code', scoreExact(input.collectorInfo?.setCode, input.candidate.setCode), 0.17, input.collectorInfo?.setCode ?? 'Missing set code'),
    signal('collector_number', 'Collector number', scoreExact(input.collectorInfo?.collectorNumber, input.candidate.collectorNumber), 0.18, input.collectorInfo?.collectorNumber ?? 'Missing collector number'),
    signal('artwork', 'Artwork comparison', scoreArtwork(input.artworkObservation, input.candidate), 0.14, input.artworkObservation?.fingerprint ?? input.artworkObservation?.layout ?? 'Missing artwork signal'),
    signal('set_symbol', 'Set symbol', input.setSymbolObservation?.confidence ?? null, 0.08, input.setSymbolObservation?.symbol ?? 'Missing set symbol'),
    signal('layout', 'Layout', scoreLayout(input.artworkObservation?.layout, input.candidate.layout), 0.08, input.artworkObservation?.layout ?? 'Missing layout signal'),
    signal('legal_finish', 'Finish compatibility', scoreFinish(input.finishObservation, input.candidate.legalFinishes), 0.08, input.finishObservation?.finish ?? 'Missing finish signal'),
    signal('color_frame', 'Language compatibility', scoreLanguage(input.language, input.candidate.language), 0.05, input.language ?? 'Missing language signal'),
  ];
  const conflicts = signals.map((entry) => entry.conflict).filter((value): value is string => Boolean(value));
  const missingPrintingSignals = !input.collectorInfo?.setCode || !input.collectorInfo?.collectorNumber;
  const scored = signals.filter((entry) => entry.score !== null);
  const weightTotal = scored.reduce((sum, entry) => sum + entry.weight, 0);
  const overall = weightTotal
    ? Math.round(scored.reduce((sum, entry) => sum + (entry.score ?? 0) * entry.weight, 0) / weightTotal)
    : 0;
  return {
    overall,
    threshold: SCANNER_CONFIDENCE_THRESHOLD,
    requiresConfirmation: overall < SCANNER_CONFIDENCE_THRESHOLD || conflicts.length > 0 || missingPrintingSignals,
    signals,
    conflicts,
  };
}

export function explainMagicConfidence(confidence: RecognitionConfidence) {
  const lines = confidence.signals.map((signalScore) => {
    const score = signalScore.score === null ? 'missing' : `${signalScore.score}/100`;
    return `${signalScore.label}: ${score} - ${signalScore.evidence}`;
  });
  if (confidence.conflicts.length) lines.push(`Conflicts: ${confidence.conflicts.join('; ')}`);
  if (confidence.requiresConfirmation) lines.push('Manual confirmation is required before writing inventory.');
  return lines;
}

export function classifyMagicRecognition(confidence: RecognitionConfidence, candidateCount: number): MagicRecognitionPresentation {
  if (candidateCount === 0 || confidence.overall < MAGIC_RECOGNITION_THRESHOLDS.manualSearchRequiredBelow) {
    return {
      thresholdClass: 'manual_search_required',
      label: 'Manual review required',
      tone: 'warning',
      description: 'Recognition signals are too weak or missing. Use manual search and confirm the exact printing.',
    };
  }
  if (confidence.conflicts.length || confidence.requiresConfirmation || candidateCount > 1) {
    return {
      thresholdClass: confidence.overall >= MAGIC_RECOGNITION_THRESHOLDS.oneTapConfirm ? 'one_tap_confirm' : 'review_alternatives',
      label: candidateCount > 1 ? 'Ambiguous' : 'Likely',
      tone: 'warning',
      description: 'Confirm the exact printing before saving. Similar printings or missing signals still need review.',
    };
  }
  if (confidence.overall >= MAGIC_RECOGNITION_THRESHOLDS.autoSuggest) {
    return {
      thresholdClass: 'auto_suggest',
      label: 'Recognized',
      tone: 'success',
      description: 'Signals strongly agree, but this sprint still keeps confirmation before inventory writes.',
    };
  }
  return {
    thresholdClass: 'one_tap_confirm',
    label: 'Likely',
    tone: 'info',
    description: 'Signals are strong enough for a streamlined confirmation, not automatic inventory writes.',
  };
}

export function isMagicTokenOrUnsupported(candidate: RecognitionCandidate) {
  const name = candidate.name.toLowerCase();
  const layout = candidate.layout?.toLowerCase() ?? '';
  return name.includes('token') || layout === 'token';
}

export async function searchScryfallMagicCatalog(query: MagicCatalogQuery, onDiagnostics?: MagicCatalogDiagnosticsSink): Promise<RecognitionCandidate[]> {
  const parts = ['game:paper'];
  if (query.name) parts.push(`!"${query.name.replaceAll('"', '')}"`);
  if (query.setCode) parts.push(`set:${query.setCode.toLowerCase()}`);
  if (query.collectorNumber) parts.push(`number:${query.collectorNumber}`);
  if (parts.length === 1) {
    onDiagnostics?.(emptyLookupDiagnostics(null, 'no_title_read'));
    return [];
  }
  return runScryfallSearch(parts.join(' '), 'Scryfall candidate search failed.', onDiagnostics);
}

export async function searchScryfallMagicCatalogFuzzy(query: MagicCatalogQuery, onDiagnostics?: MagicCatalogDiagnosticsSink): Promise<RecognitionCandidate[]> {
  if (!query.name) return [];
  const parts = ['game:paper', query.name.replaceAll('"', '')];
  if (query.setCode) parts.push(`set:${query.setCode.toLowerCase()}`);
  if (query.collectorNumber) parts.push(`number:${query.collectorNumber}`);
  return runScryfallSearch(parts.join(' '), 'Scryfall fuzzy candidate search failed.', onDiagnostics);
}

async function runScryfallSearch(
  queryString: string,
  failureMessage: string,
  onDiagnostics?: MagicCatalogDiagnosticsSink,
): Promise<RecognitionCandidate[]> {
  const started = Date.now();
  const url = `https://api.scryfall.com/cards/search?${new URLSearchParams({
    q: queryString,
    unique: 'prints',
    order: 'released',
    dir: 'desc',
  }).toString()}`;
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'TradingDocksMobile/1.0 magic-recognition' } });
    if (!response.ok) {
      const code: MagicLookupErrorCode = response.status === 404 ? 'no_candidate_found' : 'service_error';
      onDiagnostics?.(emptyLookupDiagnostics(queryString, code, response.status, Date.now() - started));
      if (response.status === 404) return [];
      throw new MagicCatalogLookupError(code, failureMessage, { status: response.status, queryString });
    }
    const payload = await response.json() as { data?: unknown };
    if (!Array.isArray(payload.data)) {
      onDiagnostics?.(emptyLookupDiagnostics(queryString, 'invalid_response', response.status, Date.now() - started));
      throw new MagicCatalogLookupError('invalid_response', 'Scryfall returned an invalid candidate response.', { status: response.status, queryString });
    }
    const candidates = payload.data
      .slice(0, 24)
      .map((card) => scryfallToRecognitionCandidate(card as ScryfallCard))
      .filter((candidate): candidate is RecognitionCandidate => Boolean(candidate));
    onDiagnostics?.({
      queryString,
      httpStatus: response.status,
      responseItemCount: candidates.length,
      errorCode: candidates.length ? null : 'no_candidate_found',
      latencyMs: Math.max(0, Date.now() - started),
      topThreeCandidateNames: candidates.slice(0, 3).map((candidate) => candidate.name),
    });
    return candidates;
  } catch (error) {
    if (error instanceof MagicCatalogLookupError) throw error;
    onDiagnostics?.(emptyLookupDiagnostics(queryString, 'network_unavailable', null, Date.now() - started));
    throw new MagicCatalogLookupError('network_unavailable', 'Network unavailable while searching Scryfall.', { queryString });
  }
}

function emptyLookupDiagnostics(
  queryString: string | null,
  errorCode: MagicLookupErrorCode,
  httpStatus: number | null = null,
  latencyMs = 0,
): MagicCatalogLookupDiagnostics {
  return {
    queryString,
    httpStatus,
    responseItemCount: 0,
    errorCode,
    latencyMs: Math.max(0, latencyMs),
    topThreeCandidateNames: [],
  };
}

export function createMagicBenchmarkManifest(input: {
  fixtureRoot: string;
  fixtures?: ScannerBenchmarkFixture[];
}): MagicBenchmarkManifest {
  const fixtures = input.fixtures ?? MAGIC_BENCHMARK_CATEGORIES.map((category) => ({
    id: `magic-${category}`,
    category,
    expectedName: '',
    labeledFrameUris: [],
    notes: 'Private fixture metadata placeholder. Add local frame paths outside Git before running benchmarks.',
  }));
  return {
    fixtureRoot: input.fixtureRoot,
    fixtures,
    metrics: magicBenchmarkMetricsUnavailable,
    copyrightPolicy: 'private_local_fixtures_only',
  };
}

export function validateMagicBenchmarkFixtureManifest(value: unknown): { ok: true; manifest: MagicBenchmarkFixtureManifest } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!value || typeof value !== 'object') return { ok: false, errors: ['Manifest must be an object.'] };
  const manifest = value as Partial<MagicBenchmarkFixtureManifest>;
  if (manifest.schemaVersion !== 1) errors.push('schemaVersion must be 1.');
  if (!stringValue(manifest.fixtureSetId)) errors.push('fixtureSetId is required.');
  if (!stringValue(manifest.createdAt)) errors.push('createdAt is required.');
  if (!Array.isArray(manifest.fixtures)) errors.push('fixtures must be an array.');
  else {
    const ids = new Set<string>();
    manifest.fixtures.forEach((fixture, index) => {
      const prefix = `fixtures[${index}]`;
      validateRequiredString(fixture.id, `${prefix}.id`, errors);
      validateRequiredString(fixture.localImagePath, `${prefix}.localImagePath`, errors);
      validateRequiredString(fixture.expectedCardName, `${prefix}.expectedCardName`, errors);
      validateRequiredString(fixture.expectedSetCode, `${prefix}.expectedSetCode`, errors);
      validateRequiredString(fixture.expectedCollectorNumber, `${prefix}.expectedCollectorNumber`, errors);
      validateRequiredString(fixture.expectedScryfallId, `${prefix}.expectedScryfallId`, errors);
      validateRequiredString(fixture.expectedLanguage, `${prefix}.expectedLanguage`, errors);
      validateRequiredString(fixture.expectedFinish, `${prefix}.expectedFinish`, errors);
      validateRequiredString(fixture.frameType, `${prefix}.frameType`, errors);
      validateRequiredString(fixture.lightingCondition, `${prefix}.lightingCondition`, errors);
      validateRequiredString(fixture.sleeveStatus, `${prefix}.sleeveStatus`, errors);
      validateRequiredString(fixture.angle, `${prefix}.angle`, errors);
      if (fixture.id) {
        if (ids.has(fixture.id)) errors.push(`${prefix}.id must be unique.`);
        ids.add(fixture.id);
      }
    });
  }
  return errors.length ? { ok: false, errors } : { ok: true, manifest: manifest as MagicBenchmarkFixtureManifest };
}

export async function runMagicBenchmark(
  manifest: MagicBenchmarkFixtureManifest,
  options: {
    searchCatalog?: MagicCatalogSearch;
    now?: () => number;
    generatedAt?: string;
  } = {},
): Promise<MagicBenchmarkReport> {
  const searchCatalog = options.searchCatalog ?? searchScryfallMagicCatalog;
  const now = options.now ?? (() => Date.now());
  const results: MagicBenchmarkFixtureResult[] = [];
  for (const fixture of manifest.fixtures) {
    const started = now();
    const signalSource = fixtureSignalSource(fixture);
    const search: MagicCatalogSearch = fixture.candidateCatalog
      ? async () => fixture.candidateCatalog ?? []
      : searchCatalog;
    const recognition = await recognizeMagicCard(fixtureToRecognitionInput(fixture), search);
    const latencyMs = Math.max(0, Math.round(now() - started));
    results.push(buildFixtureResult(fixture, recognition, latencyMs, signalSource));
  }
  return {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    fixtureSetId: manifest.fixtureSetId,
    fixtureCount: manifest.fixtures.length,
    metrics: calculateMagicBenchmarkMetrics(results),
    calibrationRecommendations: recommendMagicCalibration(results),
    results,
    privacy: magicRecognitionPrivacy(),
  };
}

export function calculateMagicBenchmarkMetrics(results: MagicBenchmarkFixtureResult[]): MagicBenchmarkMetricsReport {
  const successful = results.filter((result) => result.ok);
  const printable = results.filter((result) => result.scores.unsupportedRejected !== true);
  const withExpectedFinish = results.filter((result) => result.scores.finishCorrect !== null);
  const unsupported = results.filter((result) => result.scores.unsupportedRejected !== null);
  return {
    correctNameTop1: ratio(successful.filter((result) => result.scores.nameTop1).length, successful.length),
    correctPrintingTop1: ratio(printable.filter((result) => result.scores.printingTop1).length, printable.length),
    correctPrintingTop3: ratio(printable.filter((result) => result.scores.printingTop3).length, printable.length),
    foilClassificationAccuracy: ratio(withExpectedFinish.filter((result) => result.scores.finishCorrect).length, withExpectedFinish.length),
    falseFoilRate: null,
    averageScanLatencyMs: results.length ? Math.round(results.reduce((sum, result) => sum + result.latencyMs, 0) / results.length) : null,
    manualCorrectionRate: ratio(results.filter((result) => result.confidence.requiresConfirmation).length, results.length),
    failureRate: ratio(results.filter((result) => !result.ok).length, results.length),
    benchmarkedFixtureCount: results.length,
    cardNameTop1Accuracy: ratio(successful.filter((result) => result.scores.nameTop1).length, successful.length),
    exactPrintingTop1Accuracy: ratio(printable.filter((result) => result.scores.printingTop1).length, printable.length),
    exactPrintingTop3Accuracy: ratio(printable.filter((result) => result.scores.printingTop3).length, printable.length),
    falseHighConfidenceRate: ratio(results.filter((result) => result.scores.falseHighConfidence).length, results.length),
    averageConfidence: results.length ? Math.round(results.reduce((sum, result) => sum + result.confidence.overall, 0) / results.length) : null,
    finishAccuracy: ratio(withExpectedFinish.filter((result) => result.scores.finishCorrect).length, withExpectedFinish.length),
    unsupportedCardRejectionRate: ratio(unsupported.filter((result) => result.scores.unsupportedRejected).length, unsupported.length),
  };
}

export function recommendMagicCalibration(results: MagicBenchmarkFixtureResult[]): MagicCalibrationRecommendation[] {
  if (!results.length) {
    return [{
      kind: 'threshold_change',
      recommendation: 'Do not change thresholds until private fixtures are available.',
      evidence: 'No benchmark results were supplied.',
      applyAutomatically: false,
    }];
  }
  const recommendations: MagicCalibrationRecommendation[] = [];
  const falseHighConfidence = results.filter((result) => result.scores.falseHighConfidence);
  if (falseHighConfidence.length) {
    recommendations.push({
      kind: 'threshold_change',
      recommendation: 'Raise or keep the one-tap and auto-suggest thresholds until false high-confidence cases are understood.',
      evidence: `${falseHighConfidence.length} fixture(s) produced high confidence for an incorrect exact printing.`,
      applyAutomatically: false,
    });
  }
  const missingEvidenceInflation = results.filter((result) => result.confidence.overall >= SCANNER_CONFIDENCE_THRESHOLD && result.confidence.signals.some((signalScore) => signalScore.score === null));
  if (missingEvidenceInflation.length) {
    recommendations.push({
      kind: 'missing_evidence_inflation',
      recommendation: 'Keep missing exact-printing evidence confirmation-gated; consider lowering effective confidence when set or collector signals are absent.',
      evidence: `${missingEvidenceInflation.length} fixture(s) exceeded the threshold while at least one signal was missing.`,
      applyAutomatically: false,
    });
  }
  const signalMisses = signalMissSummary(results);
  for (const [key, count] of Object.entries(signalMisses)) {
    if (count >= Math.max(2, Math.ceil(results.length * 0.25))) {
      recommendations.push({
        kind: 'over_weighted_signal',
        signal: key as RecognitionSignalScore['key'],
        recommendation: `Review the ${key} weight before changing thresholds.`,
        evidence: `${count} fixture(s) had low ${key} score among incorrect or manually reviewed results.`,
        applyAutomatically: false,
      });
    }
  }
  if (!recommendations.length) {
    recommendations.push({
      kind: 'weight_change',
      recommendation: 'No weight or threshold change is supported by this benchmark run.',
      evidence: 'No false high-confidence or repeated signal-specific failure pattern was detected.',
      applyAutomatically: false,
    });
  }
  return recommendations;
}

export function serializeMagicBenchmarkJson(report: MagicBenchmarkReport) {
  return `${JSON.stringify(sanitizeMagicBenchmarkReport(report), null, 2)}\n`;
}

export function serializeMagicBenchmarkCsv(report: MagicBenchmarkReport) {
  const headers = [
    'fixture id',
    'image id',
    'frame type',
    'lighting',
    'sleeve',
    'angle',
    'signal source',
    'ok',
    'expected name',
    'expected set',
    'expected collector',
    'expected scryfall id',
    'top1 name',
    'top1 set',
    'top1 collector',
    'top1 scryfall id',
    'name top1',
    'printing top1',
    'printing top3',
    'false high confidence',
    'threshold class',
    'overall confidence',
    'requires confirmation',
    'latency ms',
  ];
  const rows = report.results.map((result) => [
    result.fixtureId,
    result.sanitizedImageId,
    result.frameType,
    result.lightingCondition,
    result.sleeveStatus,
    result.angle,
    result.signalSource,
    result.ok,
    result.expected.cardName,
    result.expected.setCode,
    result.expected.collectorNumber,
    result.expected.scryfallId,
    result.top1.name,
    result.top1.setCode,
    result.top1.collectorNumber,
    result.top1.scryfallId,
    result.scores.nameTop1,
    result.scores.printingTop1,
    result.scores.printingTop3,
    result.scores.falseHighConfidence,
    result.thresholdClass,
    result.confidence.overall,
    result.confidence.requiresConfirmation,
    result.latencyMs,
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function serializeMagicBenchmarkMarkdown(report: MagicBenchmarkReport) {
  const metrics = report.metrics;
  const lines = [
    `# Magic Scanner Benchmark Summary`,
    '',
    `Generated: ${report.generatedAt}`,
    `Fixture set: ${report.fixtureSetId}`,
    `Fixtures: ${report.fixtureCount}`,
    '',
    '## Metrics',
    '',
    `- Card name top-1 accuracy: ${formatMetric(metrics.cardNameTop1Accuracy)}`,
    `- Exact printing top-1 accuracy: ${formatMetric(metrics.exactPrintingTop1Accuracy)}`,
    `- Exact printing top-3 accuracy: ${formatMetric(metrics.exactPrintingTop3Accuracy)}`,
    `- False high-confidence rate: ${formatMetric(metrics.falseHighConfidenceRate)}`,
    `- Average confidence: ${metrics.averageConfidence ?? 'unavailable'}`,
    `- Average latency: ${metrics.averageScanLatencyMs === null ? 'unavailable' : `${metrics.averageScanLatencyMs} ms`}`,
    `- Manual correction rate: ${formatMetric(metrics.manualCorrectionRate)}`,
    `- Finish accuracy: ${formatMetric(metrics.finishAccuracy)}`,
    `- Unsupported-card rejection rate: ${formatMetric(metrics.unsupportedCardRejectionRate)}`,
    '',
    '## Calibration',
    '',
    ...report.calibrationRecommendations.map((entry) => `- ${entry.recommendation} Evidence: ${entry.evidence}`),
    '',
    '## Privacy',
    '',
    '- Source image paths and image contents are intentionally omitted from this report.',
    `- ${report.privacy.message}`,
  ];
  return `${lines.join('\n')}\n`;
}

export function sanitizeMagicBenchmarkReport(report: MagicBenchmarkReport): MagicBenchmarkReport {
  return {
    ...report,
    results: report.results.map((result) => ({ ...result })),
  };
}

export function evaluateMagicBenchmarkResults(results: {
  expectedName: string;
  expectedScryfallId?: string | null;
  expectedFinish?: FinishObservation['finish'] | null;
  latencyMs?: number | null;
  result: MagicRecognitionResult;
}[]): ScannerBenchmarkMetrics {
  if (!results.length) return magicBenchmarkMetricsUnavailable;
  const successful = results.filter((entry): entry is typeof entry & { result: Extract<MagicRecognitionResult, { ok: true }> } => entry.result.ok);
  const top1Name = successful.filter((entry) => normalizeName(entry.result.selected?.name) === normalizeName(entry.expectedName)).length;
  const top1Printing = successful.filter((entry) => entry.expectedScryfallId && entry.result.selected?.id === entry.expectedScryfallId).length;
  const top3Printing = successful.filter((entry) => entry.expectedScryfallId && entry.result.candidates.some((candidate) => candidate.id === entry.expectedScryfallId)).length;
  const latencies = results.map((entry) => entry.latencyMs).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return {
    correctNameTop1: ratio(top1Name, successful.length),
    correctPrintingTop1: ratio(top1Printing, successful.filter((entry) => entry.expectedScryfallId).length),
    correctPrintingTop3: ratio(top3Printing, successful.filter((entry) => entry.expectedScryfallId).length),
    foilClassificationAccuracy: null,
    falseFoilRate: null,
    averageScanLatencyMs: latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : null,
    manualCorrectionRate: ratio(successful.filter((entry) => entry.result.confidence.requiresConfirmation).length, successful.length),
    failureRate: ratio(results.length - successful.length, results.length),
    benchmarkedFixtureCount: results.length,
  };
}

export function magicRecognitionPrivacy() {
  return {
    uploadsImagesWithoutIntent: false,
    retainsPhotosByDefault: false,
    usesPaidCloudVisionProvider: false,
    catalogProvider: 'scryfall',
    message: 'Magic recognition sends text metadata queries to Scryfall only after a user starts recognition; captured images are not uploaded or retained by default.',
  };
}

function scryfallToRecognitionCandidate(card: ScryfallCard): RecognitionCandidate | null {
  if (!card.id || !card.name) return null;
  const legalFinishes = normalizeFinishes(card.finishes);
  return {
    id: card.id,
    oracleId: card.oracle_id ?? null,
    name: card.name,
    setCode: card.set?.toUpperCase() ?? null,
    setName: card.set_name ?? null,
    collectorNumber: card.collector_number ?? null,
    finishes: legalFinishes,
    legalFinishes,
    language: card.lang ?? 'en',
    imageUrl: card.image_uris?.normal ?? card.image_uris?.large ?? card.card_faces?.[0]?.image_uris?.normal ?? null,
    confidence: 0,
    recognitionMode: 'assisted_capture',
    marketPrice: scryfallPriceMetadata(card.prices),
    layout: card.layout ?? null,
    colorIdentity: card.color_identity ?? [],
  };
}

function scryfallPriceMetadata(prices: ScryfallCard['prices']) {
  if (!prices) return null;
  return {
    usd: parseScryfallPrice(prices.usd),
    usdFoil: parseScryfallPrice(prices.usd_foil),
    usdEtched: parseScryfallPrice(prices.usd_etched),
    source: 'scryfall' as const,
    fetchedAt: new Date().toISOString(),
  };
}

function parseScryfallPrice(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : null;
}

function fixtureToRecognitionInput(fixture: MagicBenchmarkFixtureManifestEntry): MagicRecognitionInput {
  const observed = fixture.observed;
  const nameText = observed?.nameText ?? fixture.expectedCardName;
  const collectorInfoText = observed?.collectorInfoText ?? `${observed?.setCode ?? fixture.expectedSetCode} ${observed?.collectorNumber ?? fixture.expectedCollectorNumber} ${observed?.language ?? fixture.expectedLanguage}`;
  return {
    nameObservation: nameText ? { regionType: 'name', text: nameText, confidence: observed?.nameConfidence ?? (observed ? 72 : 60) } : undefined,
    collectorInfoText,
    finishObservation: observed?.finish ? {
      finish: observed.finish,
      confidence: observed.finishConfidence ?? 60,
      evidence: ['Fixture manifest observed finish signal.'],
      frameCount: 1,
    } : undefined,
    artworkObservation: observed?.artworkLayout || typeof observed?.artworkSimilarity === 'number'
      ? {
        fingerprint: null,
        layout: observed.artworkLayout ?? null,
        similarity: observed.artworkSimilarity ?? 0,
      }
      : undefined,
    setSymbolObservation: observed?.setSymbol || typeof observed?.setSymbolConfidence === 'number'
      ? { symbol: observed.setSymbol ?? null, rarity: null, confidence: observed.setSymbolConfidence ?? 0 }
      : undefined,
    language: observed?.language ?? fixture.expectedLanguage,
    cachedCandidates: fixture.candidateCatalog,
    online: true,
  };
}

function buildFixtureResult(
  fixture: MagicBenchmarkFixtureManifestEntry,
  recognition: MagicRecognitionResult,
  latencyMs: number,
  signalSource: MagicBenchmarkFixtureResult['signalSource'],
): MagicBenchmarkFixtureResult {
  const selected = recognition.ok ? recognition.selected : null;
  const confidence = recognition.ok ? recognition.confidence : emptyConfidence(recognition.reason);
  const threshold = classifyMagicRecognition(confidence, recognition.ok ? recognition.candidates.length : 0);
  const top3 = recognition.ok ? recognition.candidates.map((candidate) => ({
    scryfallId: candidate.id,
    name: candidate.name,
    setCode: candidate.setCode,
    collectorNumber: candidate.collectorNumber,
  })) : [];
  const unsupportedFixture = fixture.frameType === 'token' || fixture.frameType === 'unsupported_card';
  const unsupportedRejected = unsupportedFixture ? selected === null : null;
  const printingTop1 = selected?.id === fixture.expectedScryfallId;
  const printingTop3 = top3.some((candidate) => candidate.scryfallId === fixture.expectedScryfallId);
  const finishSignal = confidence.signals.find((signalScore) => signalScore.key === 'legal_finish');
  return {
    fixtureId: fixture.id,
    sanitizedImageId: sanitizeFixtureImageId(fixture),
    frameType: fixture.frameType,
    lightingCondition: fixture.lightingCondition,
    sleeveStatus: fixture.sleeveStatus,
    angle: fixture.angle,
    signalSource,
    ok: recognition.ok,
    error: recognition.ok ? null : recognition.reason,
    expected: {
      cardName: fixture.expectedCardName,
      setCode: fixture.expectedSetCode,
      collectorNumber: fixture.expectedCollectorNumber,
      scryfallId: fixture.expectedScryfallId,
      language: fixture.expectedLanguage,
      finish: fixture.expectedFinish,
    },
    top1: {
      scryfallId: selected?.id ?? null,
      name: selected?.name ?? null,
      setCode: selected?.setCode ?? null,
      collectorNumber: selected?.collectorNumber ?? null,
    },
    top3,
    scores: {
      nameTop1: normalizeName(selected?.name) === normalizeName(fixture.expectedCardName),
      printingTop1,
      printingTop3,
      falseHighConfidence: confidence.overall >= SCANNER_CONFIDENCE_THRESHOLD && !printingTop1 && !unsupportedFixture,
      finishCorrect: finishSignal?.score === null || finishSignal === undefined ? null : finishSignal.score >= 80,
      unsupportedRejected,
    },
    confidence,
    thresholdClass: threshold.thresholdClass,
    latencyMs,
  };
}

function fixtureSignalSource(fixture: MagicBenchmarkFixtureManifestEntry): MagicBenchmarkFixtureResult['signalSource'] {
  if (fixture.observed) return 'observed_signals';
  if (fixture.expectedCardName || fixture.expectedSetCode || fixture.expectedCollectorNumber) return 'expected_metadata_seed';
  return 'catalog_only';
}

function sanitizeFixtureImageId(fixture: MagicBenchmarkFixtureManifestEntry) {
  return `${fixture.id}:${fixture.frameType}`;
}

function signalMissSummary(results: MagicBenchmarkFixtureResult[]) {
  const counts: Partial<Record<RecognitionSignalScore['key'], number>> = {};
  for (const result of results) {
    if (result.scores.printingTop1 && !result.confidence.requiresConfirmation) continue;
    for (const signalScore of result.confidence.signals) {
      if (signalScore.score !== null && signalScore.score < 50) counts[signalScore.key] = (counts[signalScore.key] ?? 0) + 1;
    }
  }
  return counts;
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function validateRequiredString(value: unknown, field: string, errors: string[]) {
  if (!stringValue(value)) errors.push(`${field} is required.`);
}

async function loadMagicCandidates(
  query: MagicCatalogQuery,
  input: MagicRecognitionInput,
  searchCatalog: MagicCatalogSearch,
): Promise<MagicCandidateLoadResult> {
  if (!input.online && input.cachedCandidates?.length) return { ok: true, candidates: input.cachedCandidates, source: 'cache' };
  if (!input.online) return { ok: false, reason: 'Magic recognition needs internet unless cached candidates are available.', offline: true };
  try {
    const candidates = await searchCatalog(query);
    return { ok: true, candidates, source: searchCatalog === searchScryfallMagicCatalog ? 'scryfall' : 'injected' };
  } catch (error) {
    if (input.cachedCandidates?.length) return { ok: true, candidates: input.cachedCandidates, source: 'cache' };
    if (error instanceof MagicCatalogLookupError) return { ok: false, reason: error.message, code: error.code, offline: error.code === 'network_unavailable' };
    return { ok: false, reason: error instanceof Error ? error.message : 'Magic recognition catalog search failed.' };
  }
}

function signal(key: RecognitionSignalScore['key'], label: string, rawScore: number | null, weight: number, evidence: string): RecognitionSignalScore {
  const score = rawScore === null ? null : Math.max(0, Math.min(100, Math.round(rawScore)));
  return {
    key,
    label,
    score,
    weight,
    evidence,
    conflict: score !== null && score < 35 ? `${label} conflicts with the selected printing.` : undefined,
  };
}

function scoreName(observation: OCRObservation | undefined, expected: string) {
  const observed = normalizeName(observation?.text);
  const normalizedExpected = normalizeName(expected);
  if (!observed) return null;
  if (observed === normalizedExpected) return Math.min(99, Math.max(88, observation?.confidence ?? 94));
  if (normalizedExpected.includes(observed) || observed.includes(normalizedExpected)) return 74;
  return 12;
}

function scoreExact(observed: string | null | undefined, expected: string | null | undefined) {
  if (!observed || !expected) return null;
  return observed.toLowerCase() === expected.toLowerCase() ? 98 : 8;
}

function scoreArtwork(observation: ArtworkObservation | undefined, candidate: RecognitionCandidate) {
  if (!observation) return null;
  if (observation.layout && candidate.layout && observation.layout !== candidate.layout) return 12;
  return Math.max(0, Math.min(100, observation.similarity * 100));
}

function scoreLayout(observed: string | null | undefined, expected: string | null | undefined) {
  if (!observed || !expected) return null;
  return observed === expected ? 92 : 18;
}

function scoreFinish(observation: FinishObservation | undefined, legalFinishes: CardFinish[]) {
  if (!observation || observation.finish === 'indeterminate') return null;
  const normalized = observation.finish === 'nonfoil'
    ? 'normal'
    : observation.finish === 'likely_foil'
      ? 'foil'
      : observation.finish === 'likely_etched'
        ? 'etched'
        : normalizeCardFinish(observation.finish);
  if (normalized === 'unknown') return 45;
  return legalFinishes.includes(normalized) ? 94 : 6;
}

function scoreLanguage(observed: string | null | undefined, expected: string | null | undefined) {
  if (!observed || !expected) return null;
  return observed.toLowerCase() === expected.toLowerCase() ? 94 : 20;
}

function normalizeName(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/\s+/g, ' ') ?? '';
}

function normalizeFinishes(finishes: string[] | undefined): CardFinish[] {
  const normalized = (finishes ?? [])
    .map((finish) => finish === 'nonfoil' ? 'normal' : normalizeCardFinish(finish))
    .filter((finish) => finish !== 'unknown');
  return normalized.length ? [...new Set(normalized)] : ['normal'];
}

function emptyConfidence(reason: string): RecognitionConfidence {
  return {
    overall: 0,
    threshold: SCANNER_CONFIDENCE_THRESHOLD,
    requiresConfirmation: true,
    signals: [],
    conflicts: [reason],
  };
}

function candidateTieBreak(candidate: RecognitionCandidate) {
  return `${candidate.name}:${candidate.setCode ?? ''}:${candidate.collectorNumber ?? ''}:${candidate.id}`;
}

function universalToRecognitionCandidate(candidate: UniversalScanCandidate): RecognitionCandidate {
  const finish = candidate.printing.finish === 'normal' || candidate.printing.finish === 'foil' || candidate.printing.finish === 'etched'
    ? candidate.printing.finish
    : 'normal';
  return {
    id: candidate.printing.externalId ?? candidate.card.externalId ?? candidate.card.name,
    name: candidate.card.name,
    setCode: candidate.printing.setCode,
    setName: candidate.printing.setName,
    collectorNumber: candidate.printing.cardNumber,
    finishes: [finish],
    legalFinishes: [finish],
    language: candidate.printing.language === 'unknown' ? null : candidate.printing.language,
    imageUrl: null,
    confidence: candidate.confidence.overall / 100,
    recognitionMode: 'assisted_capture',
    layout: typeof candidate.printing.metadata.layout === 'string' ? candidate.printing.metadata.layout : null,
    colorIdentity: [],
  };
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? Number((numerator / denominator).toFixed(4)) : null;
}

function formatMetric(value: number | null) {
  return value === null ? 'unavailable' : `${Math.round(value * 1000) / 10}%`;
}

function csvCell(value: unknown) {
  if (value === null || value === undefined) return '';
  return `"${String(value).replaceAll('"', '""')}"`;
}
