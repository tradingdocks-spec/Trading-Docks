import { displayCondition, displayFinish, type CardCondition, type CardFinish, type TradeBinderStatus } from './collector-workspace.ts';
import { scannerIdempotencyKey, type ScannerCardCandidate } from './scanner-foundation.ts';

export type ScannerFrame = {
  id: string;
  userId: string;
  capturedAt: string;
  uri: string | null;
  width: number;
  height: number;
  sequenceIndex: number;
  retainedByUser: boolean;
  uploadedWithConsent: boolean;
};

export type NormalizedCardImage = {
  frameId: string;
  orientation: 'portrait' | 'landscape' | 'unknown';
  perspectiveCorrected: boolean;
  width: number;
  height: number;
  regions: CardRegion[];
};

export type CardRegionType =
  | 'full_card'
  | 'name'
  | 'mana_cost'
  | 'artwork'
  | 'type_line'
  | 'set_symbol'
  | 'collector_info'
  | 'set_code'
  | 'collector_number'
  | 'language_rarity'
  | 'finish_evidence';

export type CardRegion = {
  id: string;
  type: CardRegionType;
  frameId: string;
  bounds: { x: number; y: number; width: number; height: number };
  confidence: number;
};

export type OCRObservation = {
  regionType: Extract<CardRegionType, 'name' | 'type_line' | 'collector_info' | 'set_code' | 'collector_number' | 'language_rarity'>;
  text: string;
  confidence: number;
};

export type SymbolObservation = {
  symbol: string | null;
  rarity: string | null;
  confidence: number;
};

export type ArtworkObservation = {
  fingerprint: string | null;
  layout: string | null;
  similarity: number;
};

export type CollectorInfoObservation = {
  setCode: string | null;
  collectorNumber: string | null;
  language: string | null;
  rarity: string | null;
  confidence: number;
};

export type FinishObservation = {
  finish: 'nonfoil' | 'likely_foil' | 'likely_etched' | 'special_finish_candidate' | 'indeterminate';
  confidence: number;
  evidence: string[];
  frameCount: number;
};

export type RecognitionCandidate = ScannerCardCandidate & {
  legalFinishes: CardFinish[];
  layout: string | null;
  colorIdentity: string[];
};

export type RecognitionSignalKey =
  | 'name_ocr'
  | 'set_code'
  | 'collector_number'
  | 'artwork'
  | 'set_symbol'
  | 'layout'
  | 'legal_finish'
  | 'finish_evidence'
  | 'color_frame';

export type RecognitionSignalScore = {
  key: RecognitionSignalKey;
  label: string;
  score: number | null;
  weight: number;
  evidence: string;
  conflict?: string;
};

export type RecognitionConfidence = {
  overall: number;
  threshold: number;
  requiresConfirmation: boolean;
  signals: RecognitionSignalScore[];
  conflicts: string[];
};

export type PrintingResolution = {
  candidates: RecognitionCandidate[];
  selected: RecognitionCandidate | null;
  confidence: RecognitionConfidence;
  ambiguous: boolean;
};

export type ScanDestination =
  | { type: 'collection' }
  | { type: 'binder'; binderId: string; binderName: string }
  | { type: 'trade_binder'; status: Exclude<TradeBinderStatus, 'unknown'> }
  | { type: 'scan_session'; sessionId: string; sessionName: string }
  | { type: 'deal_desk_handoff'; planned: true };

export type ScanConfirmation = {
  userId: string;
  candidate: RecognitionCandidate;
  finish: CardFinish;
  foilState: FinishObservation['finish'];
  language: string | null;
  condition: CardCondition;
  quantity: number;
  storageLocationId: string | null;
  destination: ScanDestination;
  tradeStatus: Exclude<TradeBinderStatus, 'unknown'>;
  addToWishlist: boolean;
  purchasePrice: number | null;
  notes: string;
  confidence: RecognitionConfidence;
  idempotencyKey: string;
};

export type ScanSession = {
  id: string;
  userId: string;
  name: string;
  startedAt: string;
  cardsScanned: number;
  totalQuantity: number;
  destination: ScanDestination;
  priceSource: string | null;
  priceTimestamp: string | null;
  pendingSync: number;
  failedItems: number;
  exportStatus: 'not_exported' | 'queued' | 'exported' | 'failed';
};

export type ScanExportRow = {
  cardName: string;
  setCode: string | null;
  collectorNumber: string | null;
  scryfallId: string | null;
  language: string | null;
  finish: CardFinish;
  foilState: FinishObservation['finish'];
  condition: CardCondition;
  quantity: number;
  marketPrice: number | null;
  priceSource: string | null;
  priceTimestamp: string | null;
  purchasePrice: number | null;
  storageLocation: string | null;
  destinationBinder: string | null;
  tradeBinderStatus: string;
  notes: string;
  scanConfidence: number;
  recognitionMethod: string;
};

export type ScannerBenchmarkCategory =
  | 'modern_frame'
  | 'old_border'
  | 'borderless'
  | 'extended_art'
  | 'showcase'
  | 'retro_frame'
  | 'foil'
  | 'etched_foil'
  | 'sleeved_card'
  | 'glare'
  | 'low_light'
  | 'angled_card'
  | 'foreign_language'
  | 'double_faced_card'
  | 'damaged_card'
  | 'token'
  | 'similar_artwork_reprints'
  | 'same_name_many_sets';

export type ScannerBenchmarkFixture = {
  id: string;
  category: ScannerBenchmarkCategory;
  expectedName: string;
  expectedScryfallId?: string;
  expectedSetCode?: string;
  expectedCollectorNumber?: string;
  expectedFinish?: FinishObservation['finish'];
  labeledFrameUris: string[];
  notes?: string;
};

export type ScannerBenchmarkMetrics = {
  correctNameTop1: number | null;
  correctPrintingTop1: number | null;
  correctPrintingTop3: number | null;
  foilClassificationAccuracy: number | null;
  falseFoilRate: number | null;
  averageScanLatencyMs: number | null;
  manualCorrectionRate: number | null;
  failureRate: number | null;
  benchmarkedFixtureCount: number;
};

export type CameraCaptureProvider = { id: string; captureStill(): Promise<ScannerFrame>; captureFinishFrames(durationMs: number): Promise<ScannerFrame[]> };
export type CardBoundaryProvider = { id: string; normalize(frame: ScannerFrame): Promise<NormalizedCardImage> };
export type TextRecognitionProvider = { id: string; recognizeText(regions: CardRegion[]): Promise<OCRObservation[]> };
export type ArtworkMatchingProvider = { id: string; matchArtwork(region: CardRegion): Promise<ArtworkObservation> };
export type SetSymbolProvider = { id: string; detectSymbol(region: CardRegion): Promise<SymbolObservation> };
export type CollectorInfoProvider = { id: string; parseCollectorInfo(observations: OCRObservation[]): Promise<CollectorInfoObservation> };
export type FinishDetectionProvider = { id: string; classifyFinish(frames: ScannerFrame[]): Promise<FinishObservation> };
export type PrintingCandidateProvider = { id: string; resolveCandidates(input: CandidateResolutionInput): Promise<RecognitionCandidate[]> };
export type ConfidenceFusionProvider = { id: string; fuse(input: ConfidenceFusionInput): RecognitionConfidence };

export type CandidateResolutionInput = {
  nameObservation?: OCRObservation;
  collectorInfo?: CollectorInfoObservation;
  artwork?: ArtworkObservation;
  symbol?: SymbolObservation;
  knownCandidates: RecognitionCandidate[];
};

export type ConfidenceFusionInput = {
  candidate: RecognitionCandidate;
  observations: {
    name?: OCRObservation;
    collectorInfo?: CollectorInfoObservation;
    artwork?: ArtworkObservation;
    symbol?: SymbolObservation;
    finish?: FinishObservation;
  };
  threshold?: number;
};

export const SCANNER_CONFIDENCE_THRESHOLD = 82;

export function buildCardRegions(frame: ScannerFrame): CardRegion[] {
  const base = { frameId: frame.id, confidence: frame.width > 0 && frame.height > 0 ? 0.65 : 0 };
  return [
    region(base, 'full_card', 0, 0, 1, 1),
    region(base, 'name', 0.08, 0.045, 0.66, 0.085),
    region(base, 'mana_cost', 0.72, 0.045, 0.2, 0.085),
    region(base, 'artwork', 0.08, 0.16, 0.84, 0.39),
    region(base, 'type_line', 0.08, 0.57, 0.84, 0.07),
    region(base, 'set_symbol', 0.72, 0.57, 0.16, 0.07),
    region(base, 'collector_info', 0.07, 0.9, 0.52, 0.07),
    region(base, 'set_code', 0.07, 0.9, 0.16, 0.07),
    region(base, 'collector_number', 0.23, 0.9, 0.2, 0.07),
    region(base, 'language_rarity', 0.43, 0.9, 0.16, 0.07),
    region(base, 'finish_evidence', 0, 0, 1, 1),
  ];
}

export function parseCollectorInfoText(text: string): CollectorInfoObservation {
  const normalized = text.trim().replace(/\s+/g, ' ');
  const setMatch = normalized.match(/\b[A-Z0-9]{2,5}\b/i);
  const numberMatch = normalized.match(/\b\d{1,4}[a-z]?\b/i);
  const languageMatch = normalized.match(/\b(EN|JP|JA|DE|FR|ES|IT|PT|KO|RU|ZH)\b/i);
  return {
    setCode: setMatch?.[0]?.toUpperCase() ?? null,
    collectorNumber: numberMatch?.[0] ?? null,
    language: languageMatch?.[0]?.toLowerCase() ?? null,
    rarity: null,
    confidence: normalized ? 58 : 0,
  };
}

export function rankPrintingCandidates(input: CandidateResolutionInput) {
  return [...input.knownCandidates]
    .map((candidate) => ({ candidate, rankScore: candidateRankScore(candidate, input) }))
    .sort((a, b) => b.rankScore - a.rankScore || a.candidate.name.localeCompare(b.candidate.name))
    .slice(0, 3)
    .map((entry) => entry.candidate);
}

export function fuseRecognitionConfidence(input: ConfidenceFusionInput): RecognitionConfidence {
  const threshold = input.threshold ?? SCANNER_CONFIDENCE_THRESHOLD;
  const signals: RecognitionSignalScore[] = [
    textSignal('name_ocr', 'Name OCR', input.observations.name?.confidence ?? null, 0.2, input.observations.name?.text ?? 'Missing name signal'),
    textSignal('set_code', 'Set code', scoreExact(input.observations.collectorInfo?.setCode, input.candidate.setCode), 0.16, input.observations.collectorInfo?.setCode ?? 'Missing set code'),
    textSignal('collector_number', 'Collector number', scoreExact(input.observations.collectorInfo?.collectorNumber, input.candidate.collectorNumber), 0.16, input.observations.collectorInfo?.collectorNumber ?? 'Missing collector number'),
    textSignal('artwork', 'Artwork similarity', scale01(input.observations.artwork?.similarity), 0.16, input.observations.artwork?.fingerprint ?? 'Missing artwork fingerprint'),
    textSignal('set_symbol', 'Set symbol', input.observations.symbol?.confidence ?? null, 0.1, input.observations.symbol?.symbol ?? 'Missing set symbol'),
    textSignal('layout', 'Layout cues', input.observations.artwork?.layout && input.candidate.layout === input.observations.artwork.layout ? 88 : null, 0.08, input.observations.artwork?.layout ?? 'Missing layout cue'),
    textSignal('legal_finish', 'Legal finish', input.observations.finish ? legalFinishScore(input.candidate, input.observations.finish) : null, 0.06, input.observations.finish?.finish ?? 'Missing finish evidence'),
    textSignal('finish_evidence', 'Multi-frame finish', input.observations.finish?.confidence ?? null, 0.06, input.observations.finish?.evidence.join('; ') ?? 'No multi-frame finish evidence'),
    textSignal('color_frame', 'Color/frame cues', null, 0.02, 'Not implemented by current providers'),
  ];
  const conflicts = signals.map((signal) => signal.conflict).filter((value): value is string => Boolean(value));
  const scored = signals.filter((signal) => signal.score !== null);
  const weightTotal = scored.reduce((sum, signal) => sum + signal.weight, 0);
  const overall = weightTotal
    ? Math.round(scored.reduce((sum, signal) => sum + (signal.score ?? 0) * signal.weight, 0) / weightTotal)
    : 0;
  return { overall, threshold, requiresConfirmation: overall < threshold || conflicts.length > 0, signals, conflicts };
}

export function resolvePrinting(input: CandidateResolutionInput, threshold = SCANNER_CONFIDENCE_THRESHOLD): PrintingResolution {
  const candidates = rankPrintingCandidates(input);
  const selected = candidates[0] ?? null;
  const confidence = selected
    ? fuseRecognitionConfidence({
      candidate: selected,
      threshold,
      observations: {
        name: input.nameObservation,
        collectorInfo: input.collectorInfo,
        artwork: input.artwork,
        symbol: input.symbol,
      },
    })
    : { overall: 0, threshold, requiresConfirmation: true, signals: [], conflicts: ['No candidates resolved.'] };
  return { candidates, selected, confidence, ambiguous: candidates.length > 1 || confidence.requiresConfirmation };
}

export function classifyFinishFromFrames(frames: ScannerFrame[]): FinishObservation {
  if (frames.length < 2) {
    return { finish: 'indeterminate', confidence: 0, evidence: ['At least two tilted frames are required.'], frameCount: frames.length };
  }
  return {
    finish: 'indeterminate',
    confidence: 35,
    evidence: ['Provider contract is present, but specular highlight analysis is not benchmarked in this build.'],
    frameCount: frames.length,
  };
}

export function buildScanConfirmation(input: Omit<ScanConfirmation, 'idempotencyKey'> & { inventoryItemId: string }): ScanConfirmation {
  return {
    ...input,
    idempotencyKey: scannerIdempotencyKey({
      userId: input.userId,
      candidate: input.candidate,
      quantity: input.quantity,
      condition: input.condition,
      finish: input.finish,
      language: input.language,
      storageLocationId: input.storageLocationId,
      tradeStatus: input.tradeStatus,
      addToWishlist: input.addToWishlist,
    }, input.inventoryItemId),
  };
}

export function createScanSession(input: { id: string; userId: string; name: string; destination: ScanDestination; startedAt?: string }): ScanSession {
  return {
    id: input.id,
    userId: input.userId,
    name: input.name.trim() || 'Inventory Intake',
    startedAt: input.startedAt ?? new Date().toISOString(),
    cardsScanned: 0,
    totalQuantity: 0,
    destination: input.destination,
    priceSource: null,
    priceTimestamp: null,
    pendingSync: 0,
    failedItems: 0,
    exportStatus: 'not_exported',
  };
}

export function addScanToSession(session: ScanSession, confirmation: ScanConfirmation, queued: boolean): ScanSession {
  return {
    ...session,
    cardsScanned: session.cardsScanned + 1,
    totalQuantity: session.totalQuantity + confirmation.quantity,
    pendingSync: queued ? session.pendingSync + 1 : session.pendingSync,
  };
}

export function buildScanExportRow(input: {
  confirmation: ScanConfirmation;
  marketPrice: number | null;
  priceSource: string | null;
  priceTimestamp: string | null;
  storageLocationName?: string | null;
  recognitionMethod: string;
}): ScanExportRow {
  const destinationBinder = input.confirmation.destination.type === 'binder'
    ? input.confirmation.destination.binderName
    : null;
  return {
    cardName: input.confirmation.candidate.name,
    setCode: input.confirmation.candidate.setCode,
    collectorNumber: input.confirmation.candidate.collectorNumber,
    scryfallId: input.confirmation.candidate.id,
    language: input.confirmation.language,
    finish: input.confirmation.finish,
    foilState: input.confirmation.foilState,
    condition: input.confirmation.condition,
    quantity: input.confirmation.quantity,
    marketPrice: input.marketPrice,
    priceSource: input.priceSource,
    priceTimestamp: input.priceTimestamp,
    purchasePrice: input.confirmation.purchasePrice,
    storageLocation: input.storageLocationName ?? input.confirmation.storageLocationId,
    destinationBinder,
    tradeBinderStatus: input.confirmation.tradeStatus,
    notes: input.confirmation.notes,
    scanConfidence: input.confirmation.confidence.overall,
    recognitionMethod: input.recognitionMethod,
  };
}

export function serializeScanCsv(rows: ScanExportRow[]) {
  const headers = [
    'card name',
    'set code',
    'collector number',
    'Scryfall id',
    'language',
    'finish',
    'foil state',
    'condition',
    'quantity',
    'market price',
    'price source',
    'price timestamp',
    'purchase price',
    'storage location',
    'destination binder',
    'Trade Binder status',
    'notes',
    'scan confidence',
    'recognition method',
  ];
  const body = rows.map((row) => [
    row.cardName,
    row.setCode,
    row.collectorNumber,
    row.scryfallId,
    row.language,
    displayFinish(row.finish),
    row.foilState,
    displayCondition(row.condition),
    row.quantity,
    row.marketPrice,
    row.priceSource,
    row.priceTimestamp,
    row.purchasePrice,
    row.storageLocation,
    row.destinationBinder,
    row.tradeBinderStatus,
    row.notes,
    row.scanConfidence,
    row.recognitionMethod,
  ]);
  return [headers, ...body].map((row) => row.map(csvCell).join(',')).join('\n');
}

export const benchmarkMetricsUnavailable: ScannerBenchmarkMetrics = {
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

function region(base: Omit<CardRegion, 'id' | 'type' | 'bounds'>, type: CardRegionType, x: number, y: number, width: number, height: number): CardRegion {
  return { ...base, id: `${base.frameId}:${type}`, type, bounds: { x, y, width, height } };
}

function candidateRankScore(candidate: RecognitionCandidate, input: CandidateResolutionInput) {
  const name = input.nameObservation?.text.toLowerCase();
  const collector = input.collectorInfo;
  let score = 0;
  if (name && candidate.name.toLowerCase().includes(name)) score += 30;
  if (collector?.setCode && candidate.setCode === collector.setCode) score += 25;
  if (collector?.collectorNumber && candidate.collectorNumber === collector.collectorNumber) score += 25;
  if (input.artwork?.similarity) score += input.artwork.similarity * 15;
  if (input.symbol?.confidence) score += input.symbol.confidence * 0.05;
  return score;
}

function textSignal(key: RecognitionSignalKey, label: string, score: number | null, weight: number, evidence: string): RecognitionSignalScore {
  const normalized = score === null ? null : Math.max(0, Math.min(100, Math.round(score)));
  return {
    key,
    label,
    score: normalized,
    weight,
    evidence,
    conflict: normalized !== null && normalized < 35 ? `${label} conflicts with the selected printing.` : undefined,
  };
}

function scoreExact(observed: string | null | undefined, expected: string | null | undefined) {
  if (!observed || !expected) return null;
  return observed.toLowerCase() === expected.toLowerCase() ? 96 : 10;
}

function scale01(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, value * 100));
}

function legalFinishScore(candidate: RecognitionCandidate, finish: FinishObservation) {
  if (finish.finish === 'indeterminate') return null;
  const normalized = finish.finish === 'nonfoil' ? 'normal' : finish.finish === 'likely_foil' ? 'foil' : finish.finish === 'likely_etched' ? 'etched' : null;
  if (!normalized) return 45;
  return candidate.legalFinishes.includes(normalized) ? 94 : 8;
}

function csvCell(value: unknown) {
  if (value === null || value === undefined) return '';
  return `"${String(value).replaceAll('"', '""')}"`;
}
