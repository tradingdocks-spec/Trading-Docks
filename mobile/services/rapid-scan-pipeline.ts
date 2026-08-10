import {
  buildMagicNameIndex,
  matchMagicCardName,
  normalizeMagicNameForIdentity,
  type MagicNameIndex,
  type MagicNameIndexRecord,
  type MagicNameMatch,
} from './magic-card-identity.ts';

export const SCANNER_SCAN_MODES = ['rapid_scan', 'precision_scan'] as const;

export type ScannerScanMode = typeof SCANNER_SCAN_MODES[number];

export type RapidScanCardState =
  | 'empty'
  | 'card_present'
  | 'identifying'
  | 'identified'
  | 'waiting_for_change'
  | 'new_card';

export type RapidScanDestination = 'collection' | 'storage' | 'binder';

export type RapidScanConfidenceClass = 'high' | 'medium' | 'low';

export type RapidScanRouteAction =
  | 'append_confirmed'
  | 'append_review'
  | 'continue_reading'
  | 'precision_fallback';

export type RapidMagicNameIndexEntry = {
  name: string;
  oracleId: string;
  scryfallId?: string | null;
};

export type RapidMagicNameIndexRecord = MagicNameIndexRecord;

export type RapidMagicNameIndex = MagicNameIndex;

export type RapidTitleMatch = MagicNameMatch;

export type RapidScanRuntime = {
  state: RapidScanCardState;
  lastFingerprint: string | null;
  lastTitle: string | null;
  lastSeenAt: number | null;
  identifiedAt: number | null;
  rearmedAt: number | null;
  suppressedSameCardCount: number;
};

export type RapidScanObservation = {
  at: number;
  cardPresent: boolean;
  fingerprint: string | null;
  recognizedTitle?: string | null;
  differenceScore?: number | null;
};

export type RapidScanTransition = {
  runtime: RapidScanRuntime;
  action: 'none' | 'start_identity' | 'suppress_same_card' | 'rearm_new_card';
  reason: string;
};

export type RapidScanResult = {
  id: string;
  cardName: string;
  oracleId: string;
  scryfallId: string | null;
  confidenceClass: RapidScanConfidenceClass;
  reviewRequired: boolean;
  destination: RapidScanDestination;
  exactPrintingId: string | null;
  setCode: string | null;
  collectorNumber: string | null;
  finish: string | null;
  language: string | null;
  pricingState: 'not_started' | 'pending' | 'resolved' | 'unavailable';
  createdAt: number;
  refinementState: 'pending' | 'resolved' | 'review_required';
};

export type RapidPrintingRefinement = {
  exactPrintingId: string | null;
  setCode: string | null;
  collectorNumber: string | null;
  finish: string | null;
  language: string | null;
  confidence: number;
  ambiguous: boolean;
};

export type RapidScanSession = {
  id: string;
  destination: RapidScanDestination;
  startedAt: number;
  cardsScanned: number;
  confirmed: number;
  reviewRequired: number;
  duplicates: number;
  failedAttempts: number;
  results: RapidScanResult[];
};

export type RapidScanMetricSample = {
  frameSamplingRateHz: number;
  cardPresenceDetectionMs: number | null;
  titleCropMs: number | null;
  ocrMs: number | null;
  localFuzzyMatchMs: number | null;
  identityLatencyMs: number | null;
  printingRefinementLatencyMs: number | null;
  newCardDetectionLatencyMs: number | null;
  cardsScanned: number;
  elapsedMs: number;
};

export const RAPID_SCAN_FIXED_ZONE = {
  card: { x: 0.18, y: 0.12, width: 0.64, height: 0.76 },
  titleRoi: { x: 0.08, y: 0.045, width: 0.84, height: 0.105 },
  bottomLeftRoi: { x: 0.075, y: 0.855, width: 0.46, height: 0.075 },
} as const;

export const RAPID_SCAN_SAMPLING = {
  emptyHz: 4,
  presentHz: 10,
  identifyingHz: 6,
  waitingForChangeHz: 5,
} as const;

const SAME_CARD_DIFFERENCE_THRESHOLD = 0.18;
const NEW_CARD_DIFFERENCE_THRESHOLD = 0.36;

export function scannerScanModeLabel(mode: ScannerScanMode) {
  return mode === 'rapid_scan' ? 'Rapid Scan' : 'Precision Scan';
}

export function createRapidScanRuntime(now = 0): RapidScanRuntime {
  return {
    state: 'empty',
    lastFingerprint: null,
    lastTitle: null,
    lastSeenAt: now,
    identifiedAt: null,
    rearmedAt: now,
    suppressedSameCardCount: 0,
  };
}

export function nextRapidScanRuntime(runtime: RapidScanRuntime, observation: RapidScanObservation): RapidScanTransition {
  if (!observation.cardPresent) {
    return {
      runtime: {
        ...runtime,
        state: 'empty',
        lastSeenAt: observation.at,
        rearmedAt: observation.at,
      },
      action: 'none',
      reason: 'Card left the fixed scan zone; recognition is rearmed.',
    };
  }

  const sameFingerprint = Boolean(runtime.lastFingerprint && observation.fingerprint && runtime.lastFingerprint === observation.fingerprint);
  const sameTitle = Boolean(runtime.lastTitle && observation.recognizedTitle && normalizeRapidTitle(runtime.lastTitle) === normalizeRapidTitle(observation.recognizedTitle));
  const differenceScore = observation.differenceScore ?? null;
  const looksLikeSameCard = sameFingerprint || sameTitle || (differenceScore !== null && differenceScore < SAME_CARD_DIFFERENCE_THRESHOLD);

  if (runtime.state === 'waiting_for_change' || runtime.state === 'identified') {
    if (looksLikeSameCard) {
      return {
        runtime: {
          ...runtime,
          state: 'waiting_for_change',
          lastSeenAt: observation.at,
          suppressedSameCardCount: runtime.suppressedSameCardCount + 1,
        },
        action: 'suppress_same_card',
        reason: 'Same stationary card remains in the scan zone.',
      };
    }
    if (!runtime.lastFingerprint || differenceScore === null || differenceScore >= NEW_CARD_DIFFERENCE_THRESHOLD || observation.fingerprint !== runtime.lastFingerprint) {
      return {
        runtime: {
          ...runtime,
          state: 'new_card',
          lastFingerprint: observation.fingerprint,
          lastTitle: observation.recognizedTitle ?? null,
          lastSeenAt: observation.at,
          identifiedAt: null,
          rearmedAt: observation.at,
        },
        action: 'rearm_new_card',
        reason: 'New card evidence differs enough to rearm immediately.',
      };
    }
  }

  return {
    runtime: {
      ...runtime,
      state: runtime.state === 'empty' ? 'card_present' : 'identifying',
      lastFingerprint: observation.fingerprint ?? runtime.lastFingerprint,
      lastTitle: observation.recognizedTitle ?? runtime.lastTitle,
      lastSeenAt: observation.at,
    },
    action: 'start_identity',
    reason: 'Card is present and ready for title-first identity work.',
  };
}

export function markRapidIdentityEmitted(runtime: RapidScanRuntime, input: { at: number; fingerprint: string | null; title: string | null }): RapidScanRuntime {
  return {
    ...runtime,
    state: 'waiting_for_change',
    lastFingerprint: input.fingerprint,
    lastTitle: input.title,
    lastSeenAt: input.at,
    identifiedAt: input.at,
  };
}

export function rapidScanSamplingRate(state: RapidScanCardState) {
  if (state === 'empty') return RAPID_SCAN_SAMPLING.emptyHz;
  if (state === 'card_present' || state === 'new_card') return RAPID_SCAN_SAMPLING.presentHz;
  if (state === 'identifying') return RAPID_SCAN_SAMPLING.identifyingHz;
  return RAPID_SCAN_SAMPLING.waitingForChangeHz;
}

export function buildRapidMagicNameIndex(entries: RapidMagicNameIndexEntry[]): RapidMagicNameIndex {
  return buildMagicNameIndex(entries.map((entry) => ({
    name: entry.name,
    oracleId: entry.oracleId,
    scryfallId: entry.scryfallId ?? null,
    aliases: [],
  })));
}

export function matchRapidTitle(index: RapidMagicNameIndex, rawTitle: string): RapidTitleMatch {
  return matchMagicCardName(index, rawTitle);
}

export function routeRapidIdentity(match: RapidTitleMatch): { confidenceClass: RapidScanConfidenceClass; action: RapidScanRouteAction; reason: string } {
  if (!match.entry || match.score < 0.56) return {
    confidenceClass: 'low',
    action: 'continue_reading',
    reason: 'Low title confidence continues frame reading without adding a result.',
  };
  if (match.exact || match.score >= 0.86) return {
    confidenceClass: 'high',
    action: 'append_confirmed',
    reason: 'High local title confidence can append immediately while printing refines later.',
  };
  if (match.score >= 0.68) return {
    confidenceClass: 'medium',
    action: 'append_review',
    reason: 'Medium title confidence appends to the result tray with Review required.',
  };
  return {
    confidenceClass: 'low',
    action: 'precision_fallback',
    reason: 'Ambiguous title confidence should offer Precision Scan or manual capture.',
  };
}

export function createRapidScanResult(input: {
  id: string;
  match: RapidTitleMatch;
  destination: RapidScanDestination;
  createdAt: number;
}): RapidScanResult | null {
  if (!input.match.entry) return null;
  const route = routeRapidIdentity(input.match);
  if (route.action === 'continue_reading' || route.action === 'precision_fallback') return null;
  return {
    id: input.id,
    cardName: input.match.entry.name,
    oracleId: input.match.entry.oracleId,
    scryfallId: input.match.entry.scryfallId ?? null,
    confidenceClass: route.confidenceClass,
    reviewRequired: route.action === 'append_review',
    destination: input.destination,
    exactPrintingId: input.match.entry.scryfallId ?? null,
    setCode: null,
    collectorNumber: null,
    finish: null,
    language: null,
    pricingState: 'not_started',
    createdAt: input.createdAt,
    refinementState: 'pending',
  };
}

export function applyRapidPrintingRefinement(result: RapidScanResult, refinement: RapidPrintingRefinement): RapidScanResult {
  const confidentExactPrinting = !refinement.ambiguous && refinement.confidence >= 0.82 && Boolean(refinement.exactPrintingId);
  return {
    ...result,
    exactPrintingId: confidentExactPrinting ? refinement.exactPrintingId : result.exactPrintingId,
    setCode: confidentExactPrinting ? refinement.setCode : result.setCode,
    collectorNumber: confidentExactPrinting ? refinement.collectorNumber : result.collectorNumber,
    finish: confidentExactPrinting ? refinement.finish : result.finish,
    language: confidentExactPrinting ? refinement.language : result.language,
    reviewRequired: result.reviewRequired || !confidentExactPrinting,
    refinementState: confidentExactPrinting ? 'resolved' : 'review_required',
  };
}

export function createRapidScanSession(input: { id: string; destination: RapidScanDestination; startedAt: number }): RapidScanSession {
  return {
    id: input.id,
    destination: input.destination,
    startedAt: input.startedAt,
    cardsScanned: 0,
    confirmed: 0,
    reviewRequired: 0,
    duplicates: 0,
    failedAttempts: 0,
    results: [],
  };
}

export function appendRapidSessionResult(session: RapidScanSession, result: Omit<RapidScanResult, 'destination'>): RapidScanSession {
  const nextResult: RapidScanResult = { ...result, destination: session.destination };
  return {
    ...session,
    cardsScanned: session.cardsScanned + 1,
    confirmed: session.confirmed + (nextResult.reviewRequired ? 0 : 1),
    reviewRequired: session.reviewRequired + (nextResult.reviewRequired ? 1 : 0),
    results: [...session.results, nextResult],
  };
}

export function appendRapidResultTray(results: RapidScanResult[], result: RapidScanResult, maxItems = 5): RapidScanResult[] {
  return [result, ...results.filter((item) => item.id !== result.id)].slice(0, Math.max(1, maxItems));
}

export function rapidPrecisionFallback(input: { confidenceClass: RapidScanConfidenceClass; ambiguousPrinting?: boolean; failedAttempts?: number }) {
  if (input.confidenceClass === 'low') return { required: true, reason: 'Low title confidence needs Precision Scan or manual capture.' };
  if (input.ambiguousPrinting) return { required: true, reason: 'Printing evidence is ambiguous; keep the card in Review or run Precision Scan.' };
  if ((input.failedAttempts ?? 0) >= 2) return { required: true, reason: 'Repeated Rapid misses should switch to Precision Scan.' };
  return { required: false, reason: 'Rapid Scan can continue.' };
}

export function createRapidScanMetricSample(input: RapidScanMetricSample): RapidScanMetricSample {
  return {
    frameSamplingRateHz: clampNumber(input.frameSamplingRateHz, 0, 30),
    cardPresenceDetectionMs: nullableMs(input.cardPresenceDetectionMs),
    titleCropMs: nullableMs(input.titleCropMs),
    ocrMs: nullableMs(input.ocrMs),
    localFuzzyMatchMs: nullableMs(input.localFuzzyMatchMs),
    identityLatencyMs: nullableMs(input.identityLatencyMs),
    printingRefinementLatencyMs: nullableMs(input.printingRefinementLatencyMs),
    newCardDetectionLatencyMs: nullableMs(input.newCardDetectionLatencyMs),
    cardsScanned: Math.max(0, Math.floor(input.cardsScanned)),
    elapsedMs: Math.max(0, Math.floor(input.elapsedMs)),
  };
}

export function summarizeRapidScanMetrics(samples: RapidScanMetricSample[]) {
  const elapsedMs = sum(samples.map((sample) => sample.elapsedMs));
  const cardsScanned = sum(samples.map((sample) => sample.cardsScanned));
  return {
    sampleCount: samples.length,
    averageFrameSamplingRateHz: average(samples.map((sample) => sample.frameSamplingRateHz)),
    averageCardPresenceDetectionMs: averageNullable(samples.map((sample) => sample.cardPresenceDetectionMs)),
    averageTitleCropMs: averageNullable(samples.map((sample) => sample.titleCropMs)),
    averageOcrMs: averageNullable(samples.map((sample) => sample.ocrMs)),
    averageLocalFuzzyMatchMs: averageNullable(samples.map((sample) => sample.localFuzzyMatchMs)),
    averageIdentityLatencyMs: averageNullable(samples.map((sample) => sample.identityLatencyMs)),
    averagePrintingRefinementLatencyMs: averageNullable(samples.map((sample) => sample.printingRefinementLatencyMs)),
    averageNewCardDetectionLatencyMs: averageNullable(samples.map((sample) => sample.newCardDetectionLatencyMs)),
    effectiveCardsPerMinute: elapsedMs > 0 ? Math.round((cardsScanned / elapsedMs) * 60000 * 10) / 10 : null,
  };
}

export function normalizeRapidTitle(value: string) {
  return normalizeMagicNameForIdentity(value);
}

function nullableMs(value: number | null) {
  return value === null ? null : Math.max(0, Math.floor(value));
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function average(values: number[]) {
  return values.length ? Math.round((sum(values) / values.length) * 10) / 10 : null;
}

function averageNullable(values: (number | null)[]) {
  return average(values.filter((value): value is number => value !== null));
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}
