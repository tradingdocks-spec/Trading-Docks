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
  | { ok: false; reason: string; offline?: boolean };

export type MagicCatalogQuery = {
  name?: string;
  setCode?: string | null;
  collectorNumber?: string | null;
};

export type MagicCatalogSearch = (query: MagicCatalogQuery) => Promise<RecognitionCandidate[]>;

export type MagicBenchmarkManifest = {
  fixtureRoot: string;
  fixtures: ScannerBenchmarkFixture[];
  metrics: ScannerBenchmarkMetrics;
  copyrightPolicy: 'private_local_fixtures_only';
};

type MagicCandidateLoadResult =
  | { ok: true; candidates: RecognitionCandidate[]; source: 'scryfall' | 'cache' | 'injected' }
  | { ok: false; reason: string; offline?: boolean };

type ScryfallCard = {
  id?: string;
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

export function isMagicTokenOrUnsupported(candidate: RecognitionCandidate) {
  const name = candidate.name.toLowerCase();
  const layout = candidate.layout?.toLowerCase() ?? '';
  return name.includes('token') || layout === 'token';
}

export async function searchScryfallMagicCatalog(query: MagicCatalogQuery): Promise<RecognitionCandidate[]> {
  const parts = ['game:paper'];
  if (query.name) parts.push(`!"${query.name.replaceAll('"', '')}"`);
  if (query.setCode) parts.push(`set:${query.setCode.toLowerCase()}`);
  if (query.collectorNumber) parts.push(`number:${query.collectorNumber}`);
  if (parts.length === 1) return [];
  const url = `https://api.scryfall.com/cards/search?${new URLSearchParams({
    q: parts.join(' '),
    unique: 'prints',
    order: 'released',
    dir: 'desc',
  }).toString()}`;
  const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'TradingDocksMobile/1.0 magic-recognition' } });
  if (!response.ok) throw new Error('Scryfall candidate search failed.');
  const payload = await response.json() as { data?: ScryfallCard[] };
  return (payload.data ?? []).slice(0, 24).map(scryfallToRecognitionCandidate).filter((candidate): candidate is RecognitionCandidate => Boolean(candidate));
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
    layout: card.layout ?? null,
    colorIdentity: card.color_identity ?? [],
  };
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
