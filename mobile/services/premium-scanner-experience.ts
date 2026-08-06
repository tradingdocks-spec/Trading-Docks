import type { ScannerCardCandidate } from './scanner-foundation.ts';

export type PremiumScannerPipelineState =
  | 'camera_ready'
  | 'aligning'
  | 'capturing'
  | 'reading'
  | 'searching'
  | 'candidate_ready'
  | 'confirmation_required'
  | 'added'
  | 'remove_card'
  | 'ready_for_next'
  | 'failed';

export type PremiumScannerGuideState =
  | 'idle'
  | 'card_present'
  | 'aligning'
  | 'stabilizing'
  | 'ready'
  | 'capturing'
  | 'processing'
  | 'recognized'
  | 'review_required'
  | 'failed';

export type PremiumScannerGuidePresentation = {
  state: PremiumScannerGuideState;
  message: string;
  tone: 'neutral' | 'cyan' | 'blue' | 'emerald' | 'amber' | 'danger';
  progress: number;
  statusLabel: string;
};

export type PremiumResultTrayKind = 'recognized' | 'likely' | 'ambiguous' | 'failed';

export type PremiumResultTray = {
  kind: PremiumResultTrayKind;
  title: string;
  subtitle: string;
  status: string;
  expanded: boolean;
  primaryAction: string;
  secondaryActions: string[];
};

export type PremiumScannerModeDefaults = {
  highVolume: boolean;
  defaultCondition: string;
  defaultFinish: string;
  defaultLanguage: string;
  cashOfferRate: number;
  autoAddHighConfidence: false;
};

export type PremiumScannerDominantSurface = 'camera_prompt' | 'progress' | 'result_tray' | 'none';

export type Scanner2InteractionState =
  | 'launching'
  | 'camera_ready'
  | 'card_absent'
  | 'card_present'
  | 'aligning'
  | 'stabilizing'
  | 'capturing'
  | 'reading'
  | 'searching'
  | 'recognized'
  | 'likely'
  | 'ambiguous'
  | 'failed'
  | 'added'
  | 'remove_card'
  | 'rearming'
  | 'paused'
  | 'offline'
  | 'camera_error';

export type Scanner2HudSummary = {
  modeLabel: string;
  cardCount: number;
  offerTotal: number | null;
  reviewCount: number;
};

export const PREMIUM_SCANNER_PIPELINE_STATES: PremiumScannerPipelineState[] = [
  'camera_ready',
  'aligning',
  'capturing',
  'reading',
  'searching',
  'candidate_ready',
  'confirmation_required',
  'added',
  'remove_card',
  'ready_for_next',
  'failed',
];

export function resolvePremiumScannerPipeline(input: {
  permissionGranted: boolean;
  cameraReady: boolean;
  cameraActive: boolean;
  captureState: string;
  recognitionStage: 'idle' | 'reading_title' | 'finding_card' | 'review_ready' | 'failed';
  selectedCandidate: ScannerCardCandidate | null;
  hasError: boolean;
  awaitingCardRemoval: boolean;
  justAdded: boolean;
}): PremiumScannerPipelineState {
  if (input.hasError || input.recognitionStage === 'failed' || input.captureState === 'failed') return 'failed';
  if (input.awaitingCardRemoval) return 'remove_card';
  if (input.justAdded) return 'added';
  if (input.recognitionStage === 'reading_title') return 'reading';
  if (input.recognitionStage === 'finding_card') return 'searching';
  if (input.recognitionStage === 'review_ready' && input.selectedCandidate) return 'candidate_ready';
  if (input.selectedCandidate) return 'confirmation_required';
  if (input.captureState === 'capturing' || input.captureState === 'captured') return 'capturing';
  if (input.permissionGranted && input.cameraReady && input.cameraActive) return 'camera_ready';
  return 'aligning';
}

export function guidePresentationForPipeline(
  pipeline: PremiumScannerPipelineState,
  guidance: string | null | undefined,
): PremiumScannerGuidePresentation {
  if (pipeline === 'failed') return guide('failed', "Couldn't read the card", 'danger', 0, 'Review required');
  if (pipeline === 'remove_card') return guide('recognized', 'Remove card', 'emerald', 1, 'Added');
  if (pipeline === 'added') return guide('recognized', 'Ready for next card', 'emerald', 1, 'Added');
  if (pipeline === 'reading') return guide('processing', 'Reading card', 'blue', 0.72, 'Reading');
  if (pipeline === 'searching') return guide('processing', 'Finding match', 'blue', 0.86, 'Searching');
  if (pipeline === 'candidate_ready') return guide('recognized', 'Match found', 'emerald', 1, 'Match found');
  if (pipeline === 'confirmation_required') return guide('review_required', 'Review printing', 'amber', 0.92, 'Review');
  if (pipeline === 'capturing') return guide('capturing', 'Reading card', 'blue', 0.64, 'Capturing');
  if (pipeline === 'camera_ready') return guide('ready', guidance || 'Hold steady', 'emerald', 0.52, 'Ready');
  return guide('aligning', guidance || 'Place the card inside the guide.', 'cyan', 0.18, 'Aligning');
}

export function buildPremiumResultTray(input: {
  selectedCandidate: ScannerCardCandidate | null;
  topCandidate: ScannerCardCandidate | null;
  candidateCount: number;
  confidenceLabel: string | null;
  confidenceScore: number | null;
  failedReason: string | null;
  marketPrice: number | null;
  cashOffer: number | null;
}): PremiumResultTray | null {
  if (input.failedReason) {
    return {
      kind: 'failed',
      title: "Couldn't read the card",
      subtitle: input.failedReason,
      status: 'Review required',
      expanded: true,
      primaryAction: 'Retake',
      secondaryActions: ['Search manually'],
    };
  }

  const candidate = input.selectedCandidate ?? input.topCandidate;
  if (!candidate) return null;

  const confidence = input.confidenceLabel ?? 'Review printing';
  const score = input.confidenceScore === null ? '' : ` - ${input.confidenceScore}%`;
  const kind: PremiumResultTrayKind = input.candidateCount >= 3 && confidence.toLowerCase().includes('ambiguous')
    ? 'ambiguous'
    : confidence.toLowerCase().includes('recognized')
      ? 'recognized'
      : 'likely';

  return {
    kind,
    title: candidate.name,
    subtitle: `${candidate.setCode ?? 'Set unavailable'} #${candidate.collectorNumber ?? '?'} - ${candidate.language ?? 'language unavailable'}`,
    status: `${confidence}${score}`,
    expanded: kind === 'ambiguous',
    primaryAction: kind === 'recognized' ? 'Add to session' : 'Confirm printing',
    secondaryActions: kind === 'ambiguous' ? ['Alternates', 'Manual Search', 'Retake'] : ['Correct', 'Retake'],
  };
}

export function compactScannerMoney(value: number | null | undefined) {
  return value === null || value === undefined ? '—' : `$${value.toFixed(2)}`;
}

export function scannerCameraHeightForWidth(width: number) {
  const usableWidth = Number.isFinite(width) && width > 0 ? width : 390;
  return Math.round(Math.min(430, Math.max(320, usableWidth * 1.05)));
}

export function scanner2CameraHeight(input: {
  width: number;
  height: number;
  safeTop: number;
  safeBottom: number;
  hasResult: boolean;
}) {
  const widthHeight = scannerCameraHeightForWidth(input.width);
  const available = Math.max(420, input.height - input.safeTop - input.safeBottom - (input.hasResult ? 248 : 178));
  const target = Math.round(input.height * (input.hasResult ? 0.52 : 0.62));
  return Math.max(340, Math.min(Math.max(widthHeight, target), available));
}

export function scannerHudRowsForWidth(width: number) {
  const narrow = width <= 360;
  return {
    rows: 2,
    topRowItems: ['mode', 'review'],
    metricColumns: narrow ? 2 : 3,
    maxStatWidth: narrow ? 118 : 132,
    overflows: false,
  };
}

export function scanner2HudLine(input: Scanner2HudSummary) {
  const cards = `${input.cardCount} card${input.cardCount === 1 ? '' : 's'}`;
  const offer = `Offer ${compactScannerMoney(input.offerTotal)}`;
  const review = `${input.reviewCount} review`;
  return `${input.modeLabel} - ${cards} - ${offer} - ${review}`;
}

export function resolveScanner2InteractionState(input: {
  loading: boolean;
  permission: 'not_requested' | 'granted' | 'denied' | 'unavailable';
  cameraActive: boolean;
  cameraReady: boolean;
  captureState: string;
  recognitionStage: 'idle' | 'reading_title' | 'finding_card' | 'review_ready' | 'failed';
  trayKind: PremiumResultTrayKind | null;
  awaitingCardRemoval: boolean;
  justAdded: boolean;
  offline: boolean;
  hasCameraError: boolean;
}): Scanner2InteractionState {
  if (input.loading) return 'launching';
  if (input.offline) return 'offline';
  if (input.hasCameraError || input.permission === 'denied' || input.permission === 'unavailable') return 'camera_error';
  if (!input.cameraActive) return 'paused';
  if (input.awaitingCardRemoval) return 'remove_card';
  if (input.justAdded) return 'added';
  if (input.recognitionStage === 'failed' || input.captureState === 'failed') return 'failed';
  if (input.recognitionStage === 'reading_title') return 'reading';
  if (input.recognitionStage === 'finding_card') return 'searching';
  if (input.trayKind === 'recognized') return 'recognized';
  if (input.trayKind === 'likely') return 'likely';
  if (input.trayKind === 'ambiguous') return 'ambiguous';
  if (input.captureState === 'capturing' || input.captureState === 'captured') return 'capturing';
  if (input.permission === 'granted' && input.cameraReady) return 'card_absent';
  if (input.permission === 'granted') return 'camera_ready';
  return 'camera_ready';
}

export function scanner2MotionForState(state: Scanner2InteractionState, reduceMotion: boolean) {
  if (reduceMotion) return { pulse: false, flash: false, progress: state === 'reading' || state === 'searching' };
  return {
    pulse: state === 'recognized' || state === 'added',
    flash: state === 'capturing',
    progress: state === 'stabilizing' || state === 'reading' || state === 'searching',
  };
}

export function scannerTrayLayoutForWidth(input: { width: number; kind: PremiumResultTrayKind }) {
  const narrow = input.width <= 375;
  return {
    usesThumbnail: input.kind !== 'failed',
    includesPricing: input.kind !== 'failed',
    includesQuantity: input.kind !== 'failed',
    actionWrap: narrow,
    textMinWidth: Math.max(180, Math.min(300, input.width - (input.kind === 'failed' ? 112 : 180))),
  };
}

export function scannerVerticalLayoutModel(input: {
  viewportHeight: number;
  safeTop: number;
  safeBottom: number;
  cameraHeight: number;
  resultTrayHeight: number;
  sessionBarHeight: number;
  bottomNavHeight: number;
}) {
  const hudHeight = input.safeTop + 92;
  const contentHeight = hudHeight + input.cameraHeight + input.resultTrayHeight + input.sessionBarHeight + input.safeBottom;
  const bottomClearance = input.sessionBarHeight + input.bottomNavHeight + input.safeBottom;
  return {
    hudHeight,
    contentHeight,
    bottomClearance,
    cameraOverlapsResult: false,
    sessionBarClearsNav: bottomClearance >= input.sessionBarHeight + input.bottomNavHeight,
    needsScroll: contentHeight > input.viewportHeight,
  };
}

export function dominantScannerSurface(input: {
  hasResultTray: boolean;
  isReading: boolean;
  isSearching: boolean;
  hasCameraPrompt: boolean;
}) : PremiumScannerDominantSurface {
  if (input.hasResultTray) return 'result_tray';
  if (input.isReading || input.isSearching) return 'progress';
  if (input.hasCameraPrompt) return 'camera_prompt';
  return 'none';
}

export function shouldRenderDiagnosticsInline(diagnosticsEnabled: boolean) {
  void diagnosticsEnabled;
  return false;
}

export function highVolumeCardShowDefaults(input?: Partial<PremiumScannerModeDefaults>): PremiumScannerModeDefaults {
  return {
    highVolume: true,
    defaultCondition: input?.defaultCondition ?? 'near_mint',
    defaultFinish: input?.defaultFinish ?? 'normal',
    defaultLanguage: input?.defaultLanguage ?? 'en',
    cashOfferRate: input?.cashOfferRate ?? 70,
    autoAddHighConfidence: false,
  };
}

function guide(
  state: PremiumScannerGuideState,
  message: string,
  tone: PremiumScannerGuidePresentation['tone'],
  progress: number,
  statusLabel: string,
): PremiumScannerGuidePresentation {
  return { state, message, tone, progress, statusLabel };
}
