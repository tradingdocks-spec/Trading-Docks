import type { ScannerCardCandidate } from './scanner-foundation.ts';
import type { ScannerReadinessState } from './scanner-readiness.ts';

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

export type Scanner2CameraLifecycleState =
  | 'permission_pending'
  | 'unavailable'
  | 'starting'
  | 'ready'
  | 'user_paused'
  | 'processing_paused'
  | 'backgrounded'
  | 'error';

export type Scanner2HudSummary = {
  modeLabel: string;
  cardCount: number;
  marketTotal?: number | null;
  offerTotal: number | null;
  reviewCount: number;
};

export type Scanner2HeaderModel = {
  line1: {
    mode: string;
    cards: string;
  };
  line2: {
    id: 'market' | 'offer' | 'review';
    label: string;
    value: string;
  }[];
  rows: 2;
  overflows: false;
};

export type Scanner2MainControlId = 'torch' | 'capture';

export type Scanner2SessionStripModel = {
  hidden: boolean;
  summary: string;
  reviewLabel: string;
  compact: boolean;
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
  readinessState?: ScannerReadinessState,
): PremiumScannerGuidePresentation {
  if (pipeline === 'failed') return guide('failed', "Couldn't identify", 'danger', 0, "Couldn't identify");
  if (pipeline === 'remove_card') return guide('recognized', 'Remove card', 'emerald', 1, 'Added');
  if (pipeline === 'added') return guide('recognized', 'Added', 'emerald', 1, 'Added');
  if (pipeline === 'reading') return guide('processing', 'Reading', 'blue', 0.72, 'Reading');
  if (pipeline === 'searching') return guide('processing', 'Reading', 'blue', 0.86, 'Reading');
  if (pipeline === 'candidate_ready') return guide('recognized', 'Added', 'emerald', 1, 'Added');
  if (pipeline === 'confirmation_required') return guide('review_required', 'Hold steady', 'amber', 0.92, 'Hold steady');
  if (pipeline === 'capturing') return guide('capturing', 'Reading', 'blue', 0.64, 'Reading');
  if (pipeline === 'camera_ready') {
    if (readinessState === 'ready') return guide('ready', guidance || 'Ready', 'emerald', 0.52, 'Ready');
    if (readinessState === 'needs_attention') return guide('aligning', guidance || 'Hold steady', 'amber', 0.34, guidance || 'Hold steady');
    if (readinessState === 'processing') return guide('processing', 'Reading', 'blue', 0.72, 'Reading');
    return guide('aligning', guidance || 'Place card in frame', 'cyan', 0.18, 'Place card in frame');
  }
  return guide('aligning', guidance || 'Place card in frame', 'cyan', 0.18, 'Place card in frame');
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
      status: '',
      expanded: true,
      primaryAction: 'Retake',
      secondaryActions: ['Search manually'],
    };
  }

  const candidate = input.selectedCandidate ?? input.topCandidate;
  if (!candidate) return null;

  const confidence = input.confidenceLabel ?? 'Review printing';
  const kind: PremiumResultTrayKind = input.candidateCount >= 3 && confidence.toLowerCase().includes('ambiguous')
    ? 'ambiguous'
    : confidence.toLowerCase().includes('recognized')
      ? 'recognized'
      : 'likely';

  return {
    kind,
    title: candidate.name,
    subtitle: `${candidate.setCode ?? 'Set unavailable'} #${candidate.collectorNumber ?? '?'} - ${candidate.language ?? 'language unavailable'}`,
    status: confidence,
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
    topRowItems: ['mode', 'cards'],
    metricColumns: narrow ? 2 : 3,
    maxStatWidth: narrow ? 118 : 132,
    overflows: false,
  };
}

export function scanner2HudLine(input: Scanner2HudSummary) {
  const cards = `${input.cardCount} scanned`;
  const offer = `Offer ${compactScannerMoney(input.offerTotal)}`;
  const review = `${input.reviewCount} review`;
  return `${input.modeLabel} - ${cards} - ${offer} - ${review}`;
}

export function scanner2HeaderModel(input: Scanner2HudSummary): Scanner2HeaderModel {
  return {
    line1: {
      mode: input.modeLabel,
      cards: String(input.cardCount),
    },
    line2: [],
    rows: 2,
    overflows: false,
  };
}

export function scanner2MainControls(): Scanner2MainControlId[] {
  return ['torch', 'capture'];
}

export function shouldHideScannerPrimaryControls(input: {
  processing: boolean;
  saving: boolean;
  sheetOpen: boolean;
  state: Scanner2InteractionState;
}) {
  return input.processing || input.saving || input.sheetOpen || input.state === 'added' || input.state === 'remove_card';
}

export function scanner2SessionStripModel(input: {
  cardCount: number;
  marketTotal: number | null;
  offerTotal: number | null;
}): Scanner2SessionStripModel {
  const empty = input.cardCount === 0;
  const cards = `${input.cardCount} scanned`;
  return {
    hidden: false,
    summary: cards,
    reviewLabel: 'Review',
    compact: empty,
  };
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

export function resolveScanner2CameraLifecycle(input: {
  permission: 'not_requested' | 'granted' | 'denied' | 'unavailable';
  cameraAvailable: boolean;
  cameraReady: boolean;
  userPaused: boolean;
  appForegrounded: boolean;
  processing: boolean;
  hasCameraError: boolean;
}): Scanner2CameraLifecycleState {
  if (!input.appForegrounded) return 'backgrounded';
  if (!input.cameraAvailable || input.permission === 'unavailable') return 'unavailable';
  if (input.hasCameraError || input.permission === 'denied') return 'error';
  if (input.permission !== 'granted') return 'permission_pending';
  if (input.userPaused) return 'user_paused';
  if (input.processing) return 'processing_paused';
  if (!input.cameraReady) return 'starting';
  return 'ready';
}

export function shouldScannerCameraRender(lifecycle: Scanner2CameraLifecycleState) {
  return lifecycle === 'ready' || lifecycle === 'processing_paused' || lifecycle === 'starting';
}

export function shouldShowScannerResumeAction(lifecycle: Scanner2CameraLifecycleState) {
  return lifecycle === 'user_paused';
}

export function shouldBlockScannerCapture(input: {
  lifecycle: Scanner2CameraLifecycleState;
  captureState: string;
  recognitionStage: 'idle' | 'reading_title' | 'finding_card' | 'review_ready' | 'failed';
}) {
  if (input.lifecycle !== 'ready') return true;
  if (input.captureState === 'capturing' || input.captureState === 'captured' || input.captureState === 'recognizing') return true;
  return input.recognitionStage === 'reading_title' || input.recognitionStage === 'finding_card';
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
