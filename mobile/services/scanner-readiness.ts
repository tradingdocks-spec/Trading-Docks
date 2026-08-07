import type { SingleScanCaptureQuality } from './single-scan-capture-quality';

export type ScannerReadinessState = 'searching' | 'needs_attention' | 'ready' | 'processing' | 'failure';

export type ScannerReadinessReason =
  | 'camera_unavailable'
  | 'no_card'
  | 'too_small'
  | 'too_large'
  | 'off_center'
  | 'too_dark'
  | 'focus'
  | 'motion'
  | 'glare'
  | 'ready'
  | 'reading'
  | 'failed'
  | 'remove_card';

export type ScannerReadinessTone = 'cyan' | 'amber' | 'emerald' | 'blue' | 'coral';

export type ScannerReadinessModel = {
  state: ScannerReadinessState;
  reason: ScannerReadinessReason;
  message: string;
  tone: ScannerReadinessTone;
  autoCaptureReady: boolean;
};

export type ScannerReadinessMetrics = {
  cameraReady: boolean;
  processing: boolean;
  cardPresent: boolean;
  fillRatio: number | null;
  centerOffset: number | null;
  blurScore: number | null;
  motionScore: number | null;
  lightingScore: number | null;
  glareScore: number | null;
  stableDurationMs: number | null;
  duplicateBlocked?: boolean;
  awaitingRemoval?: boolean;
};

const AUTO_MIN_FILL = 0.38;
const AUTO_MAX_FILL = 0.92;
const AUTO_MAX_CENTER_OFFSET = 0.24;
const AUTO_MIN_SHARPNESS = 0.42;
const AUTO_MAX_MOTION = 0.34;
const AUTO_MIN_LIGHTING = 0.16;
const AUTO_MAX_GLARE = 0.72;
const AUTO_STABLE_MS = 420;

export function scannerReadinessMessage(reason: ScannerReadinessReason) {
  if (reason === 'too_small') return 'Move closer';
  if (reason === 'too_large') return 'Move away';
  if (reason === 'off_center') return 'Center card';
  if (reason === 'too_dark') return 'Too dark';
  if (reason === 'focus') return 'Tap card to focus';
  if (reason === 'motion') return 'Hold steady';
  if (reason === 'glare') return 'Reduce glare';
  if (reason === 'ready') return 'Ready';
  if (reason === 'reading') return 'Reading';
  if (reason === 'failed') return "Couldn't identify";
  if (reason === 'remove_card') return 'Remove card';
  return 'Place card in frame';
}

export function scannerReadinessTone(state: ScannerReadinessState): ScannerReadinessTone {
  if (state === 'needs_attention') return 'amber';
  if (state === 'ready') return 'emerald';
  if (state === 'processing') return 'blue';
  if (state === 'failure') return 'coral';
  return 'cyan';
}

export function scannerReadinessModel(state: ScannerReadinessState, reason: ScannerReadinessReason, autoCaptureReady = false): ScannerReadinessModel {
  return {
    state,
    reason,
    message: scannerReadinessMessage(reason),
    tone: scannerReadinessTone(state),
    autoCaptureReady,
  };
}

export function resolveSingleScanReadiness(input: {
  quality: SingleScanCaptureQuality;
  stage: 'idle' | 'reading' | 'matching' | 'result' | 'failed';
}): ScannerReadinessModel {
  if (input.stage === 'reading' || input.stage === 'matching') return scannerReadinessModel('processing', 'reading');
  if (input.stage === 'failed') return scannerReadinessModel('failure', 'failed');
  if (input.stage === 'result') return scannerReadinessModel('ready', 'ready');
  const quality = input.quality;
  if (quality.canCapture) return scannerReadinessModel('ready', 'ready', true);
  if (quality.reason === 'camera_not_ready' || quality.reason === 'no_frame' || quality.reason === 'no_card') {
    return scannerReadinessModel('searching', quality.reason === 'camera_not_ready' ? 'camera_unavailable' : 'no_card');
  }
  if (quality.reason === 'too_small') return scannerReadinessModel('needs_attention', 'too_small');
  if (quality.vision?.detection.fillRatio !== undefined && quality.vision.detection.fillRatio > 0.92) return scannerReadinessModel('needs_attention', 'too_large');
  if (quality.reason === 'off_center') return scannerReadinessModel('needs_attention', 'off_center');
  if (quality.vision?.quality.lighting !== undefined && quality.vision.quality.lighting < AUTO_MIN_LIGHTING) return scannerReadinessModel('needs_attention', 'too_dark');
  if (quality.reason === 'too_blurry' || quality.reason === 'focus_settling') return scannerReadinessModel('needs_attention', 'focus');
  if (quality.reason === 'moving') return scannerReadinessModel('needs_attention', 'motion');
  if (quality.vision?.quality.glare !== undefined && quality.vision.quality.glare > AUTO_MAX_GLARE) return scannerReadinessModel('needs_attention', 'glare');
  return scannerReadinessModel('needs_attention', 'motion');
}

export function resolveAutomaticScannerReadiness(input: ScannerReadinessMetrics): ScannerReadinessModel & {
  reasons: string[];
} {
  const reasons: string[] = [];
  const blocked = (reason: ScannerReadinessReason, detail: string) => {
    reasons.push(detail);
    return scannerReadinessModel(
      reason === 'camera_unavailable' || reason === 'no_card' ? 'searching' : 'needs_attention',
      reason,
      false,
    );
  };

  if (!input.cameraReady) return { ...blocked('camera_unavailable', 'camera not ready'), reasons };
  if (input.processing) return { ...scannerReadinessModel('processing', 'reading'), reasons: ['scanner processing'] };
  if (input.duplicateBlocked || input.awaitingRemoval) return { ...blocked('remove_card', 'remove previous card'), reasons };
  if (!input.cardPresent) return { ...blocked('no_card', 'card not present'), reasons };
  if (input.fillRatio === null) return { ...blocked('no_card', 'guide fill unavailable'), reasons };
  if (input.fillRatio < AUTO_MIN_FILL) return { ...blocked('too_small', 'move closer'), reasons };
  if (input.fillRatio > AUTO_MAX_FILL) return { ...blocked('too_large', 'move away'), reasons };
  if (input.centerOffset === null) return { ...blocked('off_center', 'center offset unavailable'), reasons };
  if (input.centerOffset > AUTO_MAX_CENTER_OFFSET) return { ...blocked('off_center', 'center card'), reasons };
  if (input.lightingScore !== null && input.lightingScore < AUTO_MIN_LIGHTING) return { ...blocked('too_dark', 'lighting too low'), reasons };
  if (input.blurScore === null) return { ...blocked('focus', 'blur unavailable'), reasons };
  if (input.blurScore < AUTO_MIN_SHARPNESS) return { ...blocked('focus', 'blur too high'), reasons };
  if (input.motionScore === null) return { ...blocked('motion', 'motion unavailable'), reasons };
  if (input.motionScore > AUTO_MAX_MOTION) return { ...blocked('motion', 'motion too high'), reasons };
  if (input.glareScore !== null && input.glareScore > AUTO_MAX_GLARE) return { ...blocked('glare', 'reduce glare'), reasons };
  if (input.stableDurationMs === null || input.stableDurationMs < AUTO_STABLE_MS) return { ...blocked('motion', 'hold steady'), reasons };

  return { ...scannerReadinessModel('ready', 'ready', true), reasons };
}

export function shouldEmitReadyHaptic(previous: ScannerReadinessState | null, next: ScannerReadinessState) {
  return previous !== 'ready' && next === 'ready';
}
