import type { CardCondition, CardFinish, TradeBinderStatus } from './collector-workspace.ts';
import { displayCondition } from './collector-workspace.ts';
import type {
  FinishObservation,
  RecognitionConfidence,
  ScanDestination,
} from './scanner-intelligence.ts';
import type { ScannerCardCandidate, ScannerConfirmation } from './scanner-foundation.ts';
import type { SupportedTcg } from './multi-tcg-scanner.ts';
import { defaultFinishForPrinting } from './exact-printing-recognition.ts';

export const STANDARD_TRADING_CARD_WIDTH_MM = 63;
export const STANDARD_TRADING_CARD_HEIGHT_MM = 88;
export const TRADING_CARD_GUIDE_RATIO = STANDARD_TRADING_CARD_WIDTH_MM / STANDARD_TRADING_CARD_HEIGHT_MM;
export const CONTINUOUS_SCANNER_SESSION_KEY_PREFIX = 'trading-docks-continuous-scanner-session-v1';

export type ContinuousScannerMode =
  | 'collection_intake'
  | 'binder_intake'
  | 'trade_evaluation'
  | 'card_show_purchase'
  | 'collection_purchase'
  | 'seller_intake'
  | 'mixed_tcg_intake';

export type ContinuousScanState =
  | 'idle'
  | 'detecting_card'
  | 'aligning'
  | 'stabilizing'
  | 'quality_check'
  | 'capturing'
  | 'recognizing'
  | 'review_required'
  | 'confirmed'
  | 'cooldown'
  | 'ready_for_next';

export type BatchScannerState =
  | 'ready'
  | 'capturing'
  | 'reading'
  | 'matching'
  | 'added'
  | 'remove_card'
  | 'rearming'
  | 'failed'
  | 'paused'
  | 'offline'
  | 'camera_error';

export type ContinuousConfidenceState =
  | 'high_confidence'
  | 'likely'
  | 'ambiguous'
  | 'manual_review_required';

export type ScannerAutoConfirmSetting = 'suggest_only' | 'auto_confirm_high_confidence';
export type ScannerLineStatus = 'suggested' | 'needs_review' | 'confirmed' | 'failed' | 'local_only' | 'pending_sync' | 'synced';
export type ScannerDestinationType =
  | 'collection'
  | 'binder'
  | 'trade_binder'
  | 'storage_location'
  | 'purchase_intake'
  | 'trade_evaluation'
  | 'export_only';

export type ScannerGuideLayout = {
  width: number;
  height: number;
  top: number;
  left: number;
  ratio: number;
};

export type CardCorner = {
  x: number;
  y: number;
  visible: boolean;
};

export type CardBoundaryObservation = {
  corners: [CardCorner, CardCorner, CardCorner, CardCorner];
  fullyInsideGuide: boolean;
  guideFillRatio: number;
  perspectiveScore: number;
  motionScore: number;
  blurScore: number;
  glareScore: number;
  lightingScore: number;
  stabilityMs: number;
  cardPresent: boolean;
  orientation: 'portrait' | 'landscape' | 'unknown';
  imageFingerprint: string | null;
  observedAt: number;
};

export type ContinuousScannerThresholds = {
  minGuideFillRatio: number;
  maxGuideFillRatio: number;
  maxPerspectiveScore: number;
  maxMotionScore: number;
  maxBlurScore: number;
  maxGlareScore: number;
  minLightingScore: number;
  requiredStabilityMs: number;
  cooldownMs: number;
  duplicateWindowMs: number;
  cardRemovalFillRatio: number;
};

export type BoundaryQualityResult = {
  ready: boolean;
  guidance: string[];
  missingChecks: string[];
};

export type DuplicateProtectionState = {
  recentFingerprints: { fingerprint: string; capturedAt: number; scanId: string }[];
  recentPrintings: { printingId: string; capturedAt: number; scanId: string }[];
  lastCaptureAt: number | null;
  awaitingCardRemoval: boolean;
  lastScanId: string | null;
};

export type ContinuousScannerRuntime = {
  state: ContinuousScanState;
  scanId: string;
  lastGuidance: string;
  quality: BoundaryQualityResult;
  duplicateProtection: DuplicateProtectionState;
};

export type RecognitionPipelineReport = {
  detectedGame: SupportedTcg;
  topCandidate: ScannerCardCandidate | null;
  topThree: ScannerCardCandidate[];
  overallConfidence: number;
  confidenceState: ContinuousConfidenceState;
  signals: RecognitionConfidence['signals'];
  missingSignals: string[];
  conflictingSignals: string[];
  finish: FinishObservation;
  recognitionMethod: 'metadata_assisted' | 'manual_search' | 'future_visual_provider' | 'unavailable';
  requiresManualConfirmation: boolean;
};

export type OfferRule = {
  id: string;
  label: string;
  appliesTo: 'default_cash' | 'default_trade' | 'price_range' | 'game' | 'condition';
  percentage: number;
  game?: SupportedTcg;
  condition?: CardCondition;
  minPrice?: number;
  maxPrice?: number;
};

export type OfferRoundingRule = 'none' | 'nearest_cent' | 'nearest_quarter' | 'nearest_dollar';

export type OfferCalculationConfig = {
  defaultCashPercentage: number;
  defaultTradePercentage: number;
  rules: OfferRule[];
  minimumCardValue: number | null;
  rounding: OfferRoundingRule;
};

export type ScannerSessionLine = {
  id: string;
  stableScanId: string;
  game: SupportedTcg;
  cardName: string;
  setCode: string | null;
  collectorNumber: string | null;
  exactPrintingId: string | null;
  language: string | null;
  finish: CardFinish | FinishObservation['finish'];
  condition: CardCondition;
  quantity: number;
  confidence: ContinuousConfidenceState;
  confidenceScore: number;
  marketPrice: number | null;
  priceSource: string | null;
  priceTimestamp: string | null;
  purchasePercentage: number;
  cashOffer: number | null;
  tradeValue: number | null;
  estimatedMargin: number | null;
  destination: ScannerDestinationType;
  storageLocationId: string | null;
  binderId: string | null;
  binderPage: number | null;
  binderSlot: string | null;
  tradeStatus: Exclude<TradeBinderStatus, 'unknown'>;
  reviewStatus: 'suggested' | 'needs_review' | 'confirmed';
  syncState: Extract<ScannerLineStatus, 'local_only' | 'pending_sync' | 'synced' | 'failed'>;
  notes: string;
  recognition: RecognitionPipelineReport;
  createdAt: string;
};

export type ContinuousScannerSession = {
  inventoryCommandVersion?: 1;
  id: string;
  userId: string;
  name: string;
  mode: ContinuousScannerMode;
  createdAt: string;
  updatedAt: string;
  autoConfirm: ScannerAutoConfirmSetting;
  offerConfig: OfferCalculationConfig;
  defaultDestination: ScannerDestinationType;
  paused: boolean;
  lines: ScannerSessionLine[];
  undoneLines: ScannerSessionLine[];
};

export type ScannerDestinationPreference = {
  destination: ScannerDestinationType;
  storageLocationId: string | null;
  binderId: string | null;
  binderPage: number | null;
  binderSlot: string | null;
  label: string;
};

export type ScannerSessionTotals = {
  cardsScanned: number;
  cardsRecognized: number;
  needsReview: number;
  marketValue: number | null;
  cashOffer: number | null;
  tradeValue: number | null;
  missingPriceItems: number;
  gameTotals: Partial<Record<SupportedTcg, { cards: number; quantity: number }>>;
  finishTotals: Record<string, number>;
};

export type BatchScannerReviewChipModel = {
  hidden: boolean;
  summary: string;
  reviewLabel: 'Review List';
  tone: 'info' | 'warning';
};

export type BatchScannerNoticeModel = {
  title: string;
  message: string;
  tone: 'success' | 'warning' | 'info';
  undoLabel: 'Undo';
  correctLabel: 'Correct';
};

export type BatchScannerTimingSnapshot = {
  captureMs: number | null;
  cropMs: number | null;
  ocrMs: number | null;
  scryfallMs: number | null;
  sessionWriteMs: number | null;
  totalMs: number | null;
  fallbackCount: number;
};

export type SessionReviewStatusTab = 'all' | 'needs_review' | 'suggested' | 'confirmed';
export type SessionReviewGameFilter = SupportedTcg | 'all';
export type SessionReviewConfidenceFilter = ContinuousConfidenceState | 'all';
export type SessionReviewSortOrder = 'newest' | 'oldest' | 'needs_review_first' | 'highest_offer';

export type SessionReviewFilterState = {
  status: SessionReviewStatusTab;
  game: SessionReviewGameFilter;
  confidence: SessionReviewConfidenceFilter;
  missingPriceOnly: boolean;
  sortOrder: SessionReviewSortOrder;
};

export type SessionReviewMetric = {
  id: 'cards' | 'needs_review' | 'missing_price' | 'offer_total';
  label: string;
  value: string;
  tone: 'neutral' | 'success' | 'warning' | 'info';
};

export type SessionFinalizeEligibility = {
  canFinalize: boolean;
  reason: string;
  readyCount: number;
  blockingReviewCount: number;
};

export type ContinuousScannerCsvRow = {
  sessionName: string;
  sessionType: ContinuousScannerMode;
  game: SupportedTcg;
  cardName: string;
  setCode: string | null;
  collectorNumber: string | null;
  externalId: string | null;
  language: string | null;
  finish: string;
  condition: string;
  quantity: number;
  marketPrice: number | null;
  priceSource: string | null;
  priceTimestamp: string | null;
  buyingPercentage: number;
  cashOffer: number | null;
  tradeValue: number | null;
  storageLocation: string | null;
  binder: string | null;
  binderPage: number | null;
  binderSlot: string | null;
  confidence: ContinuousConfidenceState;
  reviewStatus: string;
  notes: string;
};

export const DEFAULT_CONTINUOUS_SCANNER_THRESHOLDS: ContinuousScannerThresholds = {
  minGuideFillRatio: 0.62,
  maxGuideFillRatio: 0.94,
  maxPerspectiveScore: 0.22,
  maxMotionScore: 0.18,
  maxBlurScore: 0.24,
  maxGlareScore: 0.42,
  minLightingScore: 0.58,
  requiredStabilityMs: 700,
  cooldownMs: 1100,
  duplicateWindowMs: 7000,
  cardRemovalFillRatio: 0.24,
};

export const DEFAULT_OFFER_CONFIG: OfferCalculationConfig = {
  defaultCashPercentage: 70,
  defaultTradePercentage: 80,
  minimumCardValue: null,
  rounding: 'nearest_cent',
  rules: [],
};

export const SCANNER_SESSION_MODES: { id: ContinuousScannerMode; label: string; offerWorkspace: boolean }[] = [
  { id: 'collection_intake', label: 'Collection Intake', offerWorkspace: false },
  { id: 'binder_intake', label: 'Binder Intake', offerWorkspace: false },
  { id: 'trade_evaluation', label: 'Trade Evaluation', offerWorkspace: true },
  { id: 'card_show_purchase', label: 'Card Show Purchase', offerWorkspace: true },
  { id: 'collection_purchase', label: 'Collection Purchase', offerWorkspace: true },
  { id: 'seller_intake', label: 'Seller Intake', offerWorkspace: false },
  { id: 'mixed_tcg_intake', label: 'Mixed TCG Intake', offerWorkspace: false },
];

export function continuousScannerSessionKey(userId: string) {
  return `${CONTINUOUS_SCANNER_SESSION_KEY_PREFIX}:${userId}`;
}

export function calculateCardGuideLayout(input: {
  containerWidth: number;
  containerHeight: number;
  safeTop?: number;
  safeBottom?: number;
  reservedVerticalSpace?: number;
}): ScannerGuideLayout {
  const safeTop = input.safeTop ?? 0;
  const safeBottom = input.safeBottom ?? 0;
  const reserved = input.reservedVerticalSpace ?? 128;
  const availableWidth = Math.max(1, input.containerWidth - 48);
  const availableHeight = Math.max(1, input.containerHeight - safeTop - safeBottom - reserved);
  const widthFromHeight = availableHeight * TRADING_CARD_GUIDE_RATIO;
  const width = Math.min(availableWidth, widthFromHeight);
  const height = width / TRADING_CARD_GUIDE_RATIO;
  return {
    width: Math.round(width),
    height: Math.round(height),
    left: Math.round((input.containerWidth - width) / 2),
    top: Math.round(safeTop + Math.max(16, (availableHeight - height) / 2)),
    ratio: TRADING_CARD_GUIDE_RATIO,
  };
}

export function evaluateBoundaryQuality(
  observation: CardBoundaryObservation,
  thresholds: ContinuousScannerThresholds = DEFAULT_CONTINUOUS_SCANNER_THRESHOLDS,
  options: { foilAnalysisMode?: boolean } = {},
): BoundaryQualityResult {
  const missingChecks: string[] = [];
  const guidance: string[] = [];
  const cornersVisible = observation.corners.every((corner) => corner.visible);

  if (!observation.cardPresent) {
    missingChecks.push('card_present');
    guidance.push('Place a card in the guide');
  }
  if (!cornersVisible) {
    missingChecks.push('four_corners');
    guidance.push('Card edge not visible');
  }
  if (!observation.fullyInsideGuide) {
    missingChecks.push('inside_guide');
    guidance.push('Center the card');
  }
  if (observation.guideFillRatio < thresholds.minGuideFillRatio) {
    missingChecks.push('too_far');
    guidance.push('Move closer');
  }
  if (observation.guideFillRatio > thresholds.maxGuideFillRatio) {
    missingChecks.push('too_close');
    guidance.push('Move farther away');
  }
  if (observation.perspectiveScore > thresholds.maxPerspectiveScore) {
    missingChecks.push('perspective');
    guidance.push('Square the card');
  }
  if (observation.motionScore > thresholds.maxMotionScore) {
    missingChecks.push('motion');
    guidance.push('Hold steady');
  }
  if (observation.blurScore > thresholds.maxBlurScore) {
    missingChecks.push('blur');
    guidance.push('Hold steady');
  }
  if (observation.lightingScore < thresholds.minLightingScore) {
    missingChecks.push('lighting');
    guidance.push('Improve lighting');
  }
  if (!options.foilAnalysisMode && observation.glareScore > thresholds.maxGlareScore) {
    missingChecks.push('glare');
    guidance.push('Reduce glare');
  }
  if (options.foilAnalysisMode && observation.glareScore <= thresholds.maxGlareScore) {
    guidance.push('Tilt slightly for foil check');
  }
  if (observation.stabilityMs < thresholds.requiredStabilityMs) {
    missingChecks.push('stability');
    guidance.push('Hold steady');
  }

  return {
    ready: missingChecks.length === 0,
    guidance: [...new Set(guidance.length ? guidance : ['Ready to scan'])],
    missingChecks,
  };
}

export function createContinuousScannerRuntime(input: { scanId: string; now?: number }): ContinuousScannerRuntime {
  return {
    state: 'idle',
    scanId: input.scanId,
    lastGuidance: 'Place a card in the guide',
    quality: { ready: false, guidance: ['Place a card in the guide'], missingChecks: ['card_present'] },
    duplicateProtection: {
      recentFingerprints: [],
      recentPrintings: [],
      lastCaptureAt: null,
      awaitingCardRemoval: false,
      lastScanId: null,
    },
  };
}

export function nextContinuousScannerRuntime(
  runtime: ContinuousScannerRuntime,
  observation: CardBoundaryObservation,
  thresholds: ContinuousScannerThresholds = DEFAULT_CONTINUOUS_SCANNER_THRESHOLDS,
  now = observation.observedAt,
): ContinuousScannerRuntime {
  const quality = evaluateBoundaryQuality(observation, thresholds);
  const duplicate = updateCardRemoval(runtime.duplicateProtection, observation, thresholds);
  const coolingDown = duplicate.lastCaptureAt !== null && now - duplicate.lastCaptureAt < thresholds.cooldownMs;
  const state: ContinuousScanState = !observation.cardPresent
    ? 'detecting_card'
    : duplicate.awaitingCardRemoval
      ? 'cooldown'
      : coolingDown
        ? 'cooldown'
        : !observation.fullyInsideGuide || !observation.corners.every((corner) => corner.visible)
          ? 'aligning'
          : observation.stabilityMs < thresholds.requiredStabilityMs
            ? 'stabilizing'
            : quality.ready
              ? 'capturing'
              : 'quality_check';

  return {
    ...runtime,
    state,
    quality,
    duplicateProtection: duplicate,
    lastGuidance: quality.guidance[0] ?? 'Ready to scan',
  };
}

export function shouldAutoCapture(runtime: ContinuousScannerRuntime) {
  return runtime.state === 'capturing' && runtime.quality.ready;
}

export function markCaptureStarted(runtime: ContinuousScannerRuntime): ContinuousScannerRuntime {
  return { ...runtime, state: 'recognizing', lastGuidance: 'Recognizing card' };
}

export function markScanResult(
  runtime: ContinuousScannerRuntime,
  input: { printingId?: string | null; fingerprint?: string | null; now: number; scanId?: string },
): ContinuousScannerRuntime {
  const scanId = input.scanId ?? runtime.scanId;
  return {
    ...runtime,
    state: 'confirmed',
    lastGuidance: 'Card added to session',
    duplicateProtection: rememberRecentScan(runtime.duplicateProtection, {
      printingId: input.printingId,
      fingerprint: input.fingerprint,
      capturedAt: input.now,
      scanId,
    }),
  };
}

export function markReadyForNext(runtime: ContinuousScannerRuntime, scanId: string): ContinuousScannerRuntime {
  return {
    ...runtime,
    state: 'ready_for_next',
    scanId,
    lastGuidance: 'Ready for next card',
    duplicateProtection: { ...runtime.duplicateProtection, awaitingCardRemoval: false },
  };
}

export function isDuplicateScan(
  duplicateProtection: DuplicateProtectionState,
  input: { fingerprint?: string | null; printingId?: string | null; now: number },
  thresholds: ContinuousScannerThresholds = DEFAULT_CONTINUOUS_SCANNER_THRESHOLDS,
) {
  const fingerprintDuplicate = Boolean(input.fingerprint && duplicateProtection.recentFingerprints.some((entry) => entry.fingerprint === input.fingerprint && input.now - entry.capturedAt <= thresholds.duplicateWindowMs));
  const printingDuplicate = Boolean(input.printingId && duplicateProtection.recentPrintings.some((entry) => entry.printingId === input.printingId && input.now - entry.capturedAt <= thresholds.duplicateWindowMs));
  return duplicateProtection.awaitingCardRemoval || fingerprintDuplicate || printingDuplicate;
}

export function classifyContinuousConfidence(confidence: RecognitionConfidence | { overall: number; requiresConfirmation?: boolean; conflicts?: string[] }) {
  if (confidence.requiresConfirmation || (confidence.conflicts?.length ?? 0) > 0) {
    if (confidence.overall >= 72) return 'ambiguous' satisfies ContinuousConfidenceState;
    return 'manual_review_required' satisfies ContinuousConfidenceState;
  }
  if (confidence.overall >= 88) return 'high_confidence' satisfies ContinuousConfidenceState;
  if (confidence.overall >= 72) return 'likely' satisfies ContinuousConfidenceState;
  if (confidence.overall >= 50) return 'ambiguous' satisfies ContinuousConfidenceState;
  return 'manual_review_required' satisfies ContinuousConfidenceState;
}

export function createRecognitionPipelineReport(input: {
  detectedGame: SupportedTcg;
  candidates: ScannerCardCandidate[];
  confidence: RecognitionConfidence;
  finish?: FinishObservation;
  recognitionMethod: RecognitionPipelineReport['recognitionMethod'];
}): RecognitionPipelineReport {
  const missingSignals = input.confidence.signals.filter((signal) => signal.score === null).map((signal) => signal.label);
  const state = classifyContinuousConfidence(input.confidence);
  return {
    detectedGame: input.detectedGame,
    topCandidate: input.candidates[0] ?? null,
    topThree: input.candidates.slice(0, 3),
    overallConfidence: input.confidence.overall,
    confidenceState: state,
    signals: input.confidence.signals,
    missingSignals,
    conflictingSignals: input.confidence.conflicts,
    finish: input.finish ?? {
      finish: 'indeterminate',
      confidence: 0,
      evidence: ['Finish recognition is pending benchmarked multi-frame analysis.'],
      frameCount: 0,
    },
    recognitionMethod: input.recognitionMethod,
    requiresManualConfirmation: state !== 'high_confidence' || input.confidence.requiresConfirmation,
  };
}

export function createContinuousScannerSession(input: {
  id: string;
  userId: string;
  name: string;
  mode: ContinuousScannerMode;
  createdAt?: string;
  autoConfirm?: ScannerAutoConfirmSetting;
  defaultDestination?: ScannerDestinationType;
  offerConfig?: Partial<OfferCalculationConfig>;
}): ContinuousScannerSession {
  const now = input.createdAt ?? new Date().toISOString();
  return {
    inventoryCommandVersion: 1,
    id: input.id,
    userId: input.userId,
    name: input.name.trim() || scannerModeLabel(input.mode),
    mode: input.mode,
    createdAt: now,
    updatedAt: now,
    autoConfirm: input.autoConfirm ?? 'suggest_only',
    defaultDestination: input.defaultDestination ?? destinationForMode(input.mode),
    offerConfig: { ...DEFAULT_OFFER_CONFIG, ...input.offerConfig, rules: input.offerConfig?.rules ?? DEFAULT_OFFER_CONFIG.rules },
    paused: false,
    lines: [],
    undoneLines: [],
  };
}

export function buildScannerDestinationPreference(input: Partial<ScannerDestinationPreference>): ScannerDestinationPreference {
  const destination = normalizeScannerDestination(input.destination);
  return {
    destination,
    storageLocationId: input.storageLocationId ?? null,
    binderId: input.binderId ?? null,
    binderPage: normalizePositiveInteger(input.binderPage),
    binderSlot: input.binderSlot?.trim() || null,
    label: input.label?.trim() || scannerDestinationLabel(destination),
  };
}

export function applyScannerDestinationPreference(session: ContinuousScannerSession, preference: ScannerDestinationPreference): ContinuousScannerSession {
  return {
    ...session,
    defaultDestination: preference.destination,
    updatedAt: new Date().toISOString(),
    lines: session.lines.map((line) => line.syncState === 'synced'
      ? line
      : recalculateLine({
        ...line,
        destination: preference.destination,
        storageLocationId: preference.destination === 'storage_location' ? preference.storageLocationId : line.storageLocationId,
        binderId: preference.destination === 'binder' ? preference.binderId : line.binderId,
        binderPage: preference.destination === 'binder' ? preference.binderPage : line.binderPage,
        binderSlot: preference.destination === 'binder' ? preference.binderSlot : line.binderSlot,
      }, session.offerConfig)),
  };
}

export function scannerDestinationLabel(destination: ScannerDestinationType) {
  const labels: Record<ScannerDestinationType, string> = {
    collection: 'Collection',
    storage_location: 'Storage Location',
    binder: 'Binder',
    trade_binder: 'Trade Binder',
    purchase_intake: 'Purchase Intake',
    trade_evaluation: 'Trade Evaluation',
    export_only: 'Export Only',
  };
  return labels[destination];
}

export function normalizeScannerDestination(value: unknown): ScannerDestinationType {
  return value === 'binder' ||
    value === 'trade_binder' ||
    value === 'storage_location' ||
    value === 'purchase_intake' ||
    value === 'trade_evaluation' ||
    value === 'export_only'
    ? value
    : 'collection';
}

export function cardShowOfferPreview(input: { marketPrice: number | null; quantity?: number; offerRate: number }) {
  const rate = clampPercentage(input.offerRate);
  const quantity = Math.max(1, Math.round(input.quantity ?? 1));
  return {
    rate,
    marketLabel: input.marketPrice === null ? 'Market unavailable' : formatSessionReviewMoney(input.marketPrice * quantity),
    offerLabel: input.marketPrice === null ? 'Offer unavailable' : formatSessionReviewMoney(calculateOfferAmount(input.marketPrice, quantity, rate, DEFAULT_OFFER_CONFIG)),
  };
}

export function updateCardShowOfferRate(session: ContinuousScannerSession, rate: number): ContinuousScannerSession {
  const nextRate = clampPercentage(rate);
  const offerConfig = { ...session.offerConfig, defaultCashPercentage: nextRate };
  return {
    ...session,
    offerConfig,
    updatedAt: new Date().toISOString(),
    lines: session.lines.map((line) => recalculateLine({ ...line, purchasePercentage: nextRate }, offerConfig)),
  };
}

export function addRecognitionToSession(
  session: ContinuousScannerSession,
  input: {
    stableScanId: string;
    candidate: ScannerCardCandidate | null;
    identity?: { cardName: string; oracleId?: string | null } | null;
    recognition: RecognitionPipelineReport;
    quantity?: number;
    condition?: CardCondition;
    finish?: CardFinish | FinishObservation['finish'];
    language?: string | null;
    marketPrice?: number | null;
    priceSource?: string | null;
    priceTimestamp?: string | null;
    storageLocationId?: string | null;
    binderId?: string | null;
    binderPage?: number | null;
    binderSlot?: string | null;
    tradeStatus?: Exclude<TradeBinderStatus, 'unknown'>;
    destination?: ScannerDestinationType;
    notes?: string;
    createdAt?: string;
  },
) {
  const candidate = input.candidate ?? input.recognition.topCandidate;
  const confidence = input.recognition.confidenceState;
  const reviewStatus = session.autoConfirm === 'auto_confirm_high_confidence' && confidence === 'high_confidence'
    ? 'confirmed'
    : confidence === 'high_confidence'
      ? 'suggested'
      : 'needs_review';
  const quantity = input.quantity ?? 1;
  const marketPrice = input.marketPrice ?? null;
  const lineBase = {
    game: input.recognition.detectedGame,
    condition: input.condition ?? 'near_mint',
    quantity,
    marketPrice,
  };
  const purchasePercentage = cashPercentageForLine(session.offerConfig, lineBase);
  const tradePercentage = tradePercentageForLine(session.offerConfig, lineBase);
  const cashOffer = calculateOfferAmount(marketPrice, quantity, purchasePercentage, session.offerConfig);
  const tradeValue = calculateOfferAmount(marketPrice, quantity, tradePercentage, session.offerConfig);
  const line: ScannerSessionLine = {
    id: `${session.id}:${input.stableScanId}`,
    stableScanId: input.stableScanId,
    game: input.recognition.detectedGame,
    cardName: candidate?.name ?? input.identity?.cardName ?? 'Unrecognized card',
    setCode: candidate?.setCode ?? null,
    collectorNumber: candidate?.collectorNumber ?? null,
    exactPrintingId: candidate?.id ?? null,
    language: input.language ?? candidate?.language ?? null,
    finish: input.finish ?? input.recognition.finish.finish,
    condition: input.condition ?? 'near_mint',
    quantity,
    confidence,
    confidenceScore: input.recognition.overallConfidence,
    marketPrice,
    priceSource: input.priceSource ?? null,
    priceTimestamp: input.priceTimestamp ?? null,
    purchasePercentage,
    cashOffer,
    tradeValue,
    estimatedMargin: marketPrice === null || cashOffer === null ? null : roundCurrency((marketPrice * quantity) - cashOffer),
    destination: input.destination ?? session.defaultDestination,
    storageLocationId: input.storageLocationId ?? null,
    binderId: input.binderId ?? null,
    binderPage: normalizePositiveInteger(input.binderPage),
    binderSlot: input.binderSlot?.trim() || null,
    tradeStatus: input.tradeStatus ?? 'not_for_trade',
    reviewStatus,
    syncState: 'local_only',
    notes: input.notes ?? '',
    recognition: input.recognition,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
  return {
    ...session,
    updatedAt: line.createdAt,
    lines: [...session.lines, line],
    undoneLines: [],
  };
}

export function batchScannerReviewStatusForConfidence(confidence: ContinuousConfidenceState): ScannerSessionLine['reviewStatus'] {
  return confidence === 'high_confidence' ? 'suggested' : 'needs_review';
}

export function shouldAddRecognitionToBatch(input: { candidateCount: number; confidenceState: ContinuousConfidenceState | null; failedReason?: string | null }) {
  if (input.failedReason) return false;
  return input.candidateCount > 0 && input.confidenceState !== null;
}

export function batchScannerNoticeForLine(line: ScannerSessionLine): BatchScannerNoticeModel {
  if (line.reviewStatus === 'needs_review') {
    return {
      title: 'Added for review',
      message: `${line.cardName} needs review. Keep scanning.`,
      tone: 'warning',
      undoLabel: 'Undo',
      correctLabel: 'Correct',
    };
  }
  return {
    title: 'Added',
    message: `${line.cardName} is in the review list.`,
    tone: 'success',
    undoLabel: 'Undo',
    correctLabel: 'Correct',
  };
}

export function batchScannerInstructionForState(state: BatchScannerState) {
  if (state === 'capturing') return 'Reading';
  if (state === 'reading') return 'Reading';
  if (state === 'matching') return 'Reading';
  if (state === 'added') return 'Added';
  if (state === 'remove_card') return 'Remove card';
  if (state === 'rearming') return 'Place card in frame';
  if (state === 'failed') return "Couldn't identify";
  if (state === 'paused') return 'Place card in frame';
  if (state === 'offline') return 'Place card in frame';
  if (state === 'camera_error') return 'Place card in frame';
  return 'Place card in frame';
}

export function batchScannerReviewChipModel(input: { cardCount: number; reviewCount: number }): BatchScannerReviewChipModel {
  const scanned = `${input.cardCount} scanned`;
  return {
    hidden: false,
    summary: scanned,
    reviewLabel: 'Review List',
    tone: input.reviewCount > 0 ? 'warning' : 'info',
  };
}

export function batchScannerTimingSummary(input: Partial<BatchScannerTimingSnapshot>): BatchScannerTimingSnapshot {
  return {
    captureMs: normalizeTiming(input.captureMs),
    cropMs: normalizeTiming(input.cropMs),
    ocrMs: normalizeTiming(input.ocrMs),
    scryfallMs: normalizeTiming(input.scryfallMs),
    sessionWriteMs: normalizeTiming(input.sessionWriteMs),
    totalMs: normalizeTiming(input.totalMs),
    fallbackCount: Math.max(0, Math.round(input.fallbackCount ?? 0)),
  };
}

export function editScannerSessionLine(session: ContinuousScannerSession, lineId: string, patch: Partial<Pick<ScannerSessionLine, 'cardName' | 'setCode' | 'collectorNumber' | 'exactPrintingId' | 'language' | 'confidence' | 'confidenceScore' | 'condition' | 'finish' | 'quantity' | 'purchasePercentage' | 'marketPrice' | 'priceSource' | 'priceTimestamp' | 'destination' | 'storageLocationId' | 'binderId' | 'binderPage' | 'binderSlot' | 'reviewStatus' | 'syncState' | 'notes' | 'recognition'>>) {
  return {
    ...session,
    updatedAt: new Date().toISOString(),
    lines: session.lines.map((line) => line.id === lineId ? recalculateLine({ ...line, ...patch }, session.offerConfig) : line),
  };
}

export function updateScannerSessionLineFinish(session: ContinuousScannerSession, lineId: string, finish: CardFinish) {
  const line = session.lines.find((item) => item.id === lineId);
  const candidate = line?.recognition.topThree.find((item) => item.id === line.exactPrintingId) ?? line?.recognition.topCandidate ?? null;
  if (!line || !candidate || !candidate.finishes.includes(finish)) return { session, changed: false, reason: 'unsupported_finish' as const };
  const marketPrice = selectLineScryfallPrice(candidate, finish);
  return {
    session: editScannerSessionLine(session, lineId, {
      finish,
      marketPrice,
      priceSource: marketPrice === null ? 'unavailable' : 'scryfall',
      priceTimestamp: candidate.marketPrice?.fetchedAt ?? new Date().toISOString(),
    }),
    changed: true,
    reason: null,
  };
}

export function updateScannerSessionLinePrinting(session: ContinuousScannerSession, lineId: string, candidate: ScannerCardCandidate) {
  const line = session.lines.find((item) => item.id === lineId);
  if (!line) return { session, changed: false, fallbackMessage: null };
  const finish = defaultFinishForPrinting(candidate, String(line.finish));
  const marketPrice = selectLineScryfallPrice(candidate, finish.finish);
  const nextRecognition: RecognitionPipelineReport = {
    ...line.recognition,
    topCandidate: candidate,
    topThree: [candidate, ...line.recognition.topThree.filter((entry) => entry.id !== candidate.id)].slice(0, 3),
    requiresManualConfirmation: false,
    confidenceState: 'likely',
  };
  return {
    session: {
      ...session,
      updatedAt: new Date().toISOString(),
      lines: session.lines.map((item) => item.id === lineId ? recalculateLine({
        ...item,
        cardName: candidate.name,
        setCode: candidate.setCode,
        collectorNumber: candidate.collectorNumber,
        exactPrintingId: candidate.id,
        language: candidate.language,
        finish: finish.finish,
        marketPrice,
        priceSource: marketPrice === null ? 'unavailable' : 'scryfall',
        priceTimestamp: candidate.marketPrice?.fetchedAt ?? new Date().toISOString(),
        reviewStatus: 'confirmed',
        confidence: 'likely',
        confidenceScore: Math.max(item.confidenceScore, Math.round(candidate.confidence * 100)),
        notes: item.notes ? `${item.notes} Printing manually corrected.` : 'Printing manually corrected.',
        recognition: nextRecognition,
      }, session.offerConfig) : item),
    },
    changed: true,
    fallbackMessage: finish.fallbackMessage,
  };
}

export function recalculateSessionOffers(session: ContinuousScannerSession, offerConfig: OfferCalculationConfig) {
  return {
    ...session,
    offerConfig,
    updatedAt: new Date().toISOString(),
    lines: session.lines.map((line) => recalculateLine(line, offerConfig)),
  };
}

export function undoMostRecentScan(session: ContinuousScannerSession) {
  const lines = [...session.lines];
  const removed = lines.pop();
  if (!removed) return session;
  return {
    ...session,
    updatedAt: new Date().toISOString(),
    lines,
    undoneLines: [removed, ...session.undoneLines].slice(0, 10),
  };
}

export function removeScannerSessionLine(session: ContinuousScannerSession, lineId: string) {
  const removed = session.lines.find((line) => line.id === lineId);
  return {
    ...session,
    updatedAt: new Date().toISOString(),
    lines: session.lines.filter((line) => line.id !== lineId),
    undoneLines: removed ? [removed, ...session.undoneLines].slice(0, 10) : session.undoneLines,
  };
}

export function bulkConfirmReviewedCards(session: ContinuousScannerSession) {
  return {
    ...session,
    updatedAt: new Date().toISOString(),
    lines: session.lines.map((line) => line.reviewStatus === 'needs_review' ? { ...line, reviewStatus: 'confirmed' as const } : line),
  };
}

export function filterScannerSessionLines(
  lines: ScannerSessionLine[],
  filter: {
    game?: SupportedTcg | 'all';
    status?: ScannerSessionLine['reviewStatus'] | 'all';
    missingPrice?: boolean;
    confidence?: ContinuousConfidenceState | 'all';
  },
) {
  return lines.filter((line) => {
    if (filter.game && filter.game !== 'all' && line.game !== filter.game) return false;
    if (filter.status && filter.status !== 'all' && line.reviewStatus !== filter.status) return false;
    if (filter.missingPrice && line.marketPrice !== null) return false;
    if (filter.confidence && filter.confidence !== 'all' && line.confidence !== filter.confidence) return false;
    return true;
  });
}

export function defaultSessionReviewFilters(): SessionReviewFilterState {
  return {
    status: 'all',
    game: 'all',
    confidence: 'all',
    missingPriceOnly: false,
    sortOrder: 'needs_review_first',
  };
}

export function normalizeSessionReviewStatus(status: SessionReviewStatusTab): ScannerSessionLine['reviewStatus'] | 'all' {
  return status;
}

export function filterSessionReviewLines(lines: ScannerSessionLine[], filters: SessionReviewFilterState) {
  const filtered = filterScannerSessionLines(lines, {
    game: filters.game,
    status: normalizeSessionReviewStatus(filters.status),
    confidence: filters.confidence,
    missingPrice: filters.missingPriceOnly,
  });
  return sortSessionReviewLines(filtered, filters.sortOrder);
}

export function sortSessionReviewLines(lines: ScannerSessionLine[], sortOrder: SessionReviewSortOrder) {
  return [...lines].sort((a, b) => {
    if (sortOrder === 'oldest') return a.createdAt.localeCompare(b.createdAt);
    if (sortOrder === 'highest_offer') return (b.cashOffer ?? -1) - (a.cashOffer ?? -1) || b.createdAt.localeCompare(a.createdAt);
    if (sortOrder === 'needs_review_first') {
      const score = (line: ScannerSessionLine) => line.reviewStatus === 'needs_review' ? 0 : line.reviewStatus === 'suggested' ? 1 : 2;
      return score(a) - score(b) || b.createdAt.localeCompare(a.createdAt);
    }
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function sessionReviewMetrics(totals: ScannerSessionTotals | null): SessionReviewMetric[] {
  return [
    { id: 'cards', label: 'Cards', value: String(totals?.cardsScanned ?? 0), tone: 'info' },
    { id: 'needs_review', label: 'Needs review', value: String(totals?.needsReview ?? 0), tone: totals?.needsReview ? 'warning' : 'neutral' },
    { id: 'missing_price', label: 'No price', value: String(totals?.missingPriceItems ?? 0), tone: totals?.missingPriceItems ? 'warning' : 'neutral' },
    { id: 'offer_total', label: 'Offer total', value: formatSessionReviewMoney(totals?.cashOffer), tone: 'success' },
  ];
}

export function sessionFinalizeEligibility(session: ContinuousScannerSession): SessionFinalizeEligibility {
  const blockingReviewCount = session.lines.filter((line) => line.reviewStatus === 'needs_review').length;
  const readyCount = session.lines.filter((line) => line.reviewStatus !== 'needs_review').length;
  if (!session.lines.length) {
    return { canFinalize: false, reason: 'Scan cards before finalizing this session.', readyCount, blockingReviewCount };
  }
  if (blockingReviewCount > 0) {
    return { canFinalize: false, reason: `${blockingReviewCount} card${blockingReviewCount === 1 ? '' : 's'} still need review.`, readyCount, blockingReviewCount };
  }
  return { canFinalize: true, reason: `${readyCount} reviewed card${readyCount === 1 ? '' : 's'} ready to finalize.`, readyCount, blockingReviewCount };
}

export function nextReviewLine(lines: ScannerSessionLine[]) {
  return sortSessionReviewLines(lines.filter((line) => line.reviewStatus === 'needs_review'), 'oldest')[0] ?? null;
}

export function reviewedProgressLabel(session: ContinuousScannerSession) {
  const total = session.lines.length;
  const reviewed = session.lines.filter((line) => line.reviewStatus !== 'needs_review').length;
  return `${reviewed} of ${total} reviewed`;
}

export function hasAdvancedSessionFilters(filters: SessionReviewFilterState) {
  const defaults = defaultSessionReviewFilters();
  return filters.game !== defaults.game
    || filters.confidence !== defaults.confidence
    || filters.missingPriceOnly !== defaults.missingPriceOnly
    || filters.sortOrder !== defaults.sortOrder;
}

export function activeSessionFilterSummary(filters: SessionReviewFilterState) {
  const parts: string[] = [];
  if (filters.game !== 'all') parts.push(sessionGameLabel(filters.game));
  if (filters.status !== 'all') parts.push(sessionReviewStatusLabel(filters.status));
  if (filters.confidence !== 'all') parts.push(sessionConfidenceLabel(filters.confidence));
  if (filters.missingPriceOnly) parts.push('Missing price');
  if (filters.sortOrder !== 'needs_review_first') parts.push(sessionSortLabel(filters.sortOrder));
  return parts.join(' • ');
}

export function sessionReviewStatusLabel(status: SessionReviewStatusTab | ScannerSessionLine['reviewStatus']) {
  if (status === 'needs_review') return 'Needs review';
  if (status === 'suggested') return 'Suggested';
  if (status === 'confirmed') return 'Done';
  return 'All';
}

export function sessionConfidenceLabel(confidence: ContinuousConfidenceState | 'all') {
  if (confidence === 'high_confidence') return 'High confidence';
  if (confidence === 'likely') return 'Likely';
  if (confidence === 'ambiguous') return 'Ambiguous';
  if (confidence === 'manual_review_required') return 'Manual review required';
  return 'All';
}

export function sessionGameLabel(game: SupportedTcg | 'all') {
  if (game === 'one_piece') return 'One Piece';
  if (game === 'pokemon') return 'Pokemon';
  if (game === 'magic') return 'Magic';
  if (game === 'lorcana') return 'Lorcana';
  if (game === 'unknown') return 'Unknown';
  return 'All';
}

export function sessionSortLabel(sort: SessionReviewSortOrder) {
  if (sort === 'oldest') return 'Oldest first';
  if (sort === 'highest_offer') return 'Highest offer';
  if (sort === 'newest') return 'Newest first';
  return 'Needs review first';
}

export function calculateSessionTotals(session: ContinuousScannerSession): ScannerSessionTotals {
  let knownMarketValue = 0;
  let cashOffer = 0;
  let tradeValue = 0;
  let missingPriceItems = 0;
  const gameTotals: ScannerSessionTotals['gameTotals'] = {};
  const finishTotals: Record<string, number> = {};

  for (const line of session.lines) {
    if (line.marketPrice === null) {
      missingPriceItems += 1;
    } else {
      knownMarketValue += line.marketPrice * line.quantity;
      cashOffer += line.cashOffer ?? 0;
      tradeValue += line.tradeValue ?? 0;
    }
    gameTotals[line.game] = {
      cards: (gameTotals[line.game]?.cards ?? 0) + 1,
      quantity: (gameTotals[line.game]?.quantity ?? 0) + line.quantity,
    };
    finishTotals[String(line.finish)] = (finishTotals[String(line.finish)] ?? 0) + line.quantity;
  }

  return {
    cardsScanned: session.lines.reduce((sum, line) => sum + line.quantity, 0),
    cardsRecognized: session.lines.filter((line) => line.exactPrintingId !== null).length,
    needsReview: session.lines.filter((line) => line.reviewStatus === 'needs_review').length,
    marketValue: knownMarketValue ? roundCurrency(knownMarketValue) : null,
    cashOffer: cashOffer ? roundCurrency(cashOffer) : null,
    tradeValue: tradeValue ? roundCurrency(tradeValue) : null,
    missingPriceItems,
    gameTotals,
    finishTotals,
  };
}

export function buildScannerCollectionConfirmation(line: ScannerSessionLine, userId: string): ScannerConfirmation | null {
  if (!line.exactPrintingId || line.reviewStatus !== 'confirmed') return null;
  const exact = line.recognition.topThree.find((card) => card.id === line.exactPrintingId)
    ?? (line.recognition.topCandidate?.id === line.exactPrintingId ? line.recognition.topCandidate : null);
  return {
    userId,
    candidate: {
      ...exact,
      id: line.exactPrintingId,
      name: line.cardName,
      setCode: line.setCode,
      setName: null,
      collectorNumber: line.collectorNumber,
      finishes: normalizeLineFinish(line.finish),
      language: line.language,
      confidence: line.confidenceScore / 100,
      recognitionMode: line.recognition.recognitionMethod === 'manual_search' ? 'manual_search' : 'assisted_capture',
    },
    quantity: line.quantity,
    condition: line.condition,
    finish: normalizeLineFinish(line.finish)[0] ?? 'normal',
    language: line.language,
    storageLocationId: line.storageLocationId,
    binderPage: line.binderPage,
    binderSlot: line.binderSlot,
    tradeStatus: line.tradeStatus,
    addToWishlist: false,
  };
}

export function buildContinuousScannerCsvRows(session: ContinuousScannerSession): ContinuousScannerCsvRow[] {
  return session.lines.map((line) => ({
    sessionName: session.name,
    sessionType: session.mode,
    game: line.game,
    cardName: line.cardName,
    setCode: line.setCode,
    collectorNumber: line.collectorNumber,
    externalId: line.exactPrintingId,
    language: line.language,
    finish: String(line.finish),
    condition: displayCondition(line.condition),
    quantity: line.quantity,
    marketPrice: line.marketPrice,
    priceSource: line.priceSource,
    priceTimestamp: line.priceTimestamp,
    buyingPercentage: line.purchasePercentage,
    cashOffer: line.cashOffer,
    tradeValue: line.tradeValue,
    storageLocation: line.storageLocationId,
    binder: line.binderId,
    binderPage: line.binderPage,
    binderSlot: line.binderSlot,
    confidence: line.confidence,
    reviewStatus: line.reviewStatus,
    notes: line.notes,
  }));
}

export function serializeContinuousScannerCsv(rows: ContinuousScannerCsvRow[]) {
  const headers = [
    'session name',
    'session type',
    'game',
    'card name',
    'set',
    'collector number',
    'external id',
    'language',
    'finish',
    'condition',
    'quantity',
    'market price',
    'price source',
    'price timestamp',
    'buying percentage',
    'cash offer',
    'trade value',
    'storage location',
    'binder',
    'binder page',
    'binder slot',
    'confidence',
    'review status',
    'notes',
  ];
  return [headers, ...rows.map((row) => [
    row.sessionName,
    scannerModeLabel(row.sessionType),
    row.game,
    row.cardName,
    row.setCode,
    row.collectorNumber,
    row.externalId,
    row.language,
    row.finish,
    row.condition,
    row.quantity,
    row.marketPrice,
    row.priceSource,
    row.priceTimestamp,
    row.buyingPercentage,
    row.cashOffer,
    row.tradeValue,
    row.storageLocation,
    row.binder,
    row.binderPage,
    row.binderSlot,
    row.confidence,
    row.reviewStatus,
    row.notes,
  ])].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function scannerModeLabel(mode: ContinuousScannerMode) {
  return SCANNER_SESSION_MODES.find((entry) => entry.id === mode)?.label ?? 'Scanner Session';
}

export function scannerModeUsesOfferWorkspace(mode: ContinuousScannerMode) {
  return Boolean(SCANNER_SESSION_MODES.find((entry) => entry.id === mode)?.offerWorkspace);
}

export function destinationForMode(mode: ContinuousScannerMode): ScannerDestinationType {
  if (mode === 'binder_intake') return 'binder';
  if (mode === 'trade_evaluation') return 'trade_evaluation';
  if (mode === 'card_show_purchase' || mode === 'collection_purchase') return 'purchase_intake';
  if (mode === 'seller_intake') return 'export_only';
  return 'collection';
}

export function scanDestinationToLegacyDestination(destination: ScannerDestinationType, sessionId: string, sessionName: string): ScanDestination {
  if (destination === 'trade_binder') return { type: 'trade_binder', status: 'available' };
  if (destination === 'binder') return { type: 'binder', binderId: sessionId, binderName: sessionName };
  if (destination === 'purchase_intake' || destination === 'trade_evaluation' || destination === 'export_only') {
    return { type: 'scan_session', sessionId, sessionName };
  }
  return { type: 'collection' };
}

function updateCardRemoval(
  duplicateProtection: DuplicateProtectionState,
  observation: CardBoundaryObservation,
  thresholds: ContinuousScannerThresholds,
) {
  if (!duplicateProtection.awaitingCardRemoval) return duplicateProtection;
  if (!observation.cardPresent || observation.guideFillRatio <= thresholds.cardRemovalFillRatio) {
    return { ...duplicateProtection, awaitingCardRemoval: false };
  }
  return duplicateProtection;
}

function rememberRecentScan(
  duplicateProtection: DuplicateProtectionState,
  input: { printingId?: string | null; fingerprint?: string | null; capturedAt: number; scanId: string },
): DuplicateProtectionState {
  const pruneAfter = input.capturedAt - DEFAULT_CONTINUOUS_SCANNER_THRESHOLDS.duplicateWindowMs;
  return {
    recentFingerprints: [
      ...(input.fingerprint ? [{ fingerprint: input.fingerprint, capturedAt: input.capturedAt, scanId: input.scanId }] : []),
      ...duplicateProtection.recentFingerprints.filter((entry) => entry.capturedAt >= pruneAfter),
    ].slice(0, 12),
    recentPrintings: [
      ...(input.printingId ? [{ printingId: input.printingId, capturedAt: input.capturedAt, scanId: input.scanId }] : []),
      ...duplicateProtection.recentPrintings.filter((entry) => entry.capturedAt >= pruneAfter),
    ].slice(0, 12),
    lastCaptureAt: input.capturedAt,
    awaitingCardRemoval: true,
    lastScanId: input.scanId,
  };
}

function recalculateLine(line: ScannerSessionLine, offerConfig: OfferCalculationConfig): ScannerSessionLine {
  const cashOffer = calculateOfferAmount(line.marketPrice, line.quantity, line.purchasePercentage, offerConfig);
  const tradePercentage = tradePercentageForLine(offerConfig, line);
  const tradeValue = calculateOfferAmount(line.marketPrice, line.quantity, tradePercentage, offerConfig);
  return {
    ...line,
    cashOffer,
    tradeValue,
    estimatedMargin: line.marketPrice === null || cashOffer === null ? null : roundCurrency((line.marketPrice * line.quantity) - cashOffer),
  };
}

function cashPercentageForLine(config: OfferCalculationConfig, line: Pick<ScannerSessionLine, 'game' | 'condition' | 'marketPrice'>) {
  const matching = [...config.rules]
    .reverse()
    .find((rule) => rule.appliesTo !== 'default_trade' && ruleMatches(rule, line));
  return clampPercentage(matching?.percentage ?? config.defaultCashPercentage);
}

function tradePercentageForLine(config: OfferCalculationConfig, line: Pick<ScannerSessionLine, 'game' | 'condition' | 'marketPrice'>) {
  const matching = [...config.rules]
    .reverse()
    .find((rule) => rule.appliesTo === 'default_trade' || ruleMatches(rule, line));
  return clampPercentage(matching?.percentage ?? config.defaultTradePercentage);
}

function calculateOfferAmount(price: number | null, quantity: number, percentage: number, config: OfferCalculationConfig) {
  if (price === null || !Number.isFinite(price)) return null;
  if (config.minimumCardValue !== null && price < config.minimumCardValue) return null;
  return roundOffer(price * quantity * (clampPercentage(percentage) / 100), config.rounding);
}

function ruleMatches(rule: OfferRule, line: Pick<ScannerSessionLine, 'game' | 'condition' | 'marketPrice'>) {
  if (rule.appliesTo === 'default_cash' || rule.appliesTo === 'default_trade') return true;
  if (rule.appliesTo === 'game') return rule.game === line.game;
  if (rule.appliesTo === 'condition') return rule.condition === line.condition;
  if (rule.appliesTo === 'price_range') {
    if (line.marketPrice === null) return false;
    if (rule.minPrice !== undefined && line.marketPrice < rule.minPrice) return false;
    if (rule.maxPrice !== undefined && line.marketPrice > rule.maxPrice) return false;
    return true;
  }
  return false;
}

function normalizeLineFinish(finish: ScannerSessionLine['finish']): CardFinish[] {
  if (finish === 'likely_foil') return ['foil'];
  if (finish === 'likely_etched') return ['etched'];
  if (finish === 'nonfoil') return ['normal'];
  if (finish === 'normal' || finish === 'foil' || finish === 'etched') return [finish];
  return ['normal'];
}

function selectLineScryfallPrice(candidate: ScannerCardCandidate, finish: CardFinish | string) {
  const prices = candidate.marketPrice;
  if (!prices || prices.source !== 'scryfall') return null;
  const amount = finish === 'foil'
    ? prices.usdFoil
    : finish === 'etched'
      ? prices.usdEtched
      : prices.usd;
  return typeof amount === 'number' && Number.isFinite(amount) && amount > 0 ? roundCurrency(amount) : null;
}

function clampPercentage(value: number) {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function normalizePositiveInteger(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

function roundOffer(value: number, rule: OfferRoundingRule) {
  if (rule === 'nearest_dollar') return Math.round(value);
  if (rule === 'nearest_quarter') return Math.round(value * 4) / 4;
  return roundCurrency(value);
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeTiming(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Math.max(0, Math.round(value));
}

export function formatSessionReviewMoney(value: number | null | undefined) {
  return value === null || value === undefined ? '—' : `$${value.toFixed(2)}`;
}

function csvCell(value: unknown) {
  if (value === null || value === undefined) return '';
  return `"${String(value).replaceAll('"', '""')}"`;
}
