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
  if (pipeline === 'failed') return guide('failed', 'Retake or search manually', 'danger', 0, 'Failed');
  if (pipeline === 'remove_card') return guide('recognized', 'Remove card', 'emerald', 1, 'Added');
  if (pipeline === 'added') return guide('recognized', 'Ready for next card', 'emerald', 1, 'Added');
  if (pipeline === 'reading') return guide('processing', 'Reading card', 'blue', 0.72, 'Reading');
  if (pipeline === 'searching') return guide('processing', 'Finding printing', 'blue', 0.86, 'Searching');
  if (pipeline === 'candidate_ready') return guide('recognized', 'Match found', 'emerald', 1, 'Match found');
  if (pipeline === 'confirmation_required') return guide('review_required', 'Review printing', 'amber', 0.92, 'Review');
  if (pipeline === 'capturing') return guide('capturing', 'Reading card', 'blue', 0.64, 'Capturing');
  if (pipeline === 'camera_ready') return guide('ready', guidance || 'Hold steady', 'emerald', 0.52, 'Ready');
  return guide('aligning', guidance || 'Place card in frame', 'cyan', 0.18, 'Aligning');
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
      title: 'No reliable match',
      subtitle: input.failedReason,
      status: 'Manual review required',
      expanded: true,
      primaryAction: 'Retake',
      secondaryActions: ['Manual Search'],
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
