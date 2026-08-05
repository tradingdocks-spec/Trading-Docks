import { TRADING_CARD_GUIDE_RATIO, type CardBoundaryObservation, type ScannerGuideLayout } from './continuous-offer-scanner.ts';
import type { LiveFrameAnalysisResult, NormalizedCardCrop } from './live-card-recognition.ts';

export const SCANNER_DIAGNOSTICS_DEV_FLAG = 'EXPO_PUBLIC_ENABLE_SCANNER_DIAGNOSTICS';
export const NATIVE_SCANNER_CALIBRATION_KEY_PREFIX = 'td:native-scanner-calibration:v1';

export type ScannerCaptureState =
  | 'idle'
  | 'camera_not_ready'
  | 'ready'
  | 'capturing'
  | 'captured'
  | 'recognizing'
  | 'failed';

export type ScannerCaptureOutcomeStatus =
  | 'recognized'
  | 'likely'
  | 'ambiguous'
  | 'manual_review_required'
  | 'identification_unavailable'
  | 'capture_failed';

export type ScannerSignalAvailability = {
  boundary: boolean;
  corners: boolean;
  perspective: boolean;
  blur: boolean;
  motion: boolean;
  lighting: boolean;
  glare: boolean;
  ocr: boolean;
  artwork: boolean;
  finish: boolean;
};

export type ScannerCalibrationPreferences = {
  guideScale: number;
  verticalOffset: number;
  tolerance: number;
};

export type PreviewDimensions = {
  width: number;
  height: number;
};

export type GuideCropMapping = {
  normalizedCrop: { x: number; y: number; width: number; height: number };
  guideAspectRatio: number;
  previewAspectRatio: number;
  aspectRatioError: number;
};

export type ScannerDiagnosticsSnapshot = {
  cameraReady: boolean;
  previewDimensions: PreviewDimensions | null;
  guideDimensions: ScannerGuideLayout;
  guideAspectRatio: number;
  detectedCardBounds: NormalizedCardCrop['bounds'] | null;
  cardCornersVisible: number;
  fillPercentage: number | null;
  perspectiveScore: number | null;
  blurScore: number | null;
  motionScore: number | null;
  lightingScore: number | null;
  glareScore: number | null;
  stabilityMs: number | null;
  captureState: ScannerCaptureState;
  duplicateFingerprintStatus: 'clear' | 'cooldown' | 'awaiting_removal' | 'duplicate' | 'unavailable';
  recognitionStage: 'not_started' | 'capture_only' | 'provider_unavailable' | 'manual_search' | 'recognized' | 'failed';
  recognitionLatencyMs: number | null;
  sessionInsertionResult: 'not_attempted' | 'inserted' | 'failed';
  signalAvailability: ScannerSignalAvailability;
};

export type NativeAutoCaptureDecision = {
  ok: boolean;
  reason: string;
};

export type FoilDiagnosticsFrame = {
  capturedAt: number;
  highlightScore: number;
  motionScore: number;
};

export type FoilDiagnosticsSummary = {
  status: 'indeterminate';
  frameCount: number;
  evidence: string[];
};

export const DEFAULT_SCANNER_CALIBRATION: ScannerCalibrationPreferences = {
  guideScale: 1,
  verticalOffset: 0,
  tolerance: 0.12,
};

export const NO_NATIVE_VISUAL_SIGNALS: ScannerSignalAvailability = {
  boundary: false,
  corners: false,
  perspective: false,
  blur: false,
  motion: false,
  lighting: false,
  glare: false,
  ocr: false,
  artwork: false,
  finish: false,
};

export function isScannerDiagnosticsEnabled(env: Record<string, string | undefined> = process.env) {
  return env.NODE_ENV !== 'production' && env[SCANNER_DIAGNOSTICS_DEV_FLAG] === 'true';
}

export function nativeScannerCalibrationKey(userId: string) {
  return `${NATIVE_SCANNER_CALIBRATION_KEY_PREFIX}:${userId}`;
}

export function normalizeScannerCalibrationPreferences(input?: Partial<ScannerCalibrationPreferences> | null): ScannerCalibrationPreferences {
  return {
    guideScale: clampFinite(input?.guideScale, 0.86, 1.08, DEFAULT_SCANNER_CALIBRATION.guideScale),
    verticalOffset: clampFinite(input?.verticalOffset, -72, 72, DEFAULT_SCANNER_CALIBRATION.verticalOffset),
    tolerance: clampFinite(input?.tolerance, 0.06, 0.18, DEFAULT_SCANNER_CALIBRATION.tolerance),
  };
}

export function applyScannerCalibrationToGuide(
  baseGuide: ScannerGuideLayout,
  containerWidth: number,
  preferences: ScannerCalibrationPreferences,
): ScannerGuideLayout {
  const normalized = normalizeScannerCalibrationPreferences(preferences);
  const width = Math.round(baseGuide.width * normalized.guideScale);
  const height = Math.round(width / TRADING_CARD_GUIDE_RATIO);
  return {
    ...baseGuide,
    width,
    height,
    left: Math.round((containerWidth - width) / 2),
    top: Math.max(12, Math.round(baseGuide.top + normalized.verticalOffset)),
    ratio: TRADING_CARD_GUIDE_RATIO,
  };
}

export function buildGuideCropMapping(preview: PreviewDimensions, guide: ScannerGuideLayout): GuideCropMapping {
  const normalizedCrop = {
    x: clamp01(guide.left / preview.width),
    y: clamp01(guide.top / preview.height),
    width: clamp01(guide.width / preview.width),
    height: clamp01(guide.height / preview.height),
  };
  const guideAspectRatio = guide.width / guide.height;
  const previewAspectRatio = preview.width / preview.height;
  return {
    normalizedCrop,
    guideAspectRatio,
    previewAspectRatio,
    aspectRatioError: Math.abs(guideAspectRatio - TRADING_CARD_GUIDE_RATIO),
  };
}

export function canAutoCaptureNative(input: {
  cameraReady: boolean;
  signalAvailability: ScannerSignalAvailability;
  analysis?: LiveFrameAnalysisResult | null;
}): NativeAutoCaptureDecision {
  if (!input.cameraReady) return { ok: false, reason: 'camera_not_ready' };
  const required: (keyof ScannerSignalAvailability)[] = ['boundary', 'corners', 'perspective', 'blur', 'motion', 'lighting', 'glare'];
  const missing = required.filter((key) => !input.signalAvailability[key]);
  if (missing.length) return { ok: false, reason: `signals_unavailable:${missing.join(',')}` };
  if (!input.analysis) return { ok: false, reason: 'no_frame_analysis' };
  if (!input.analysis.readyForAutoCapture) return { ok: false, reason: input.analysis.guidance };
  return { ok: true, reason: 'ready' };
}

export function diagnosticsFromFrameAnalysis(input: {
  cameraReady: boolean;
  previewDimensions: PreviewDimensions | null;
  guideDimensions: ScannerGuideLayout;
  analysis?: LiveFrameAnalysisResult | null;
  captureState: ScannerCaptureState;
  duplicateFingerprintStatus: ScannerDiagnosticsSnapshot['duplicateFingerprintStatus'];
  recognitionStage: ScannerDiagnosticsSnapshot['recognitionStage'];
  recognitionLatencyMs?: number | null;
  sessionInsertionResult: ScannerDiagnosticsSnapshot['sessionInsertionResult'];
  signalAvailability: ScannerSignalAvailability;
}): ScannerDiagnosticsSnapshot {
  const observation: CardBoundaryObservation | null = input.analysis?.observation ?? null;
  return {
    cameraReady: input.cameraReady,
    previewDimensions: input.previewDimensions,
    guideDimensions: input.guideDimensions,
    guideAspectRatio: input.guideDimensions.width / input.guideDimensions.height,
    detectedCardBounds: input.analysis?.crop?.bounds ?? null,
    cardCornersVisible: observation ? observation.corners.filter((corner) => corner.visible).length : 0,
    fillPercentage: observation ? Math.round(observation.guideFillRatio * 100) : null,
    perspectiveScore: observation?.perspectiveScore ?? null,
    blurScore: observation?.blurScore ?? null,
    motionScore: observation?.motionScore ?? null,
    lightingScore: observation?.lightingScore ?? null,
    glareScore: observation?.glareScore ?? null,
    stabilityMs: observation?.stabilityMs ?? null,
    captureState: input.captureState,
    duplicateFingerprintStatus: input.duplicateFingerprintStatus,
    recognitionStage: input.recognitionStage,
    recognitionLatencyMs: input.recognitionLatencyMs ?? null,
    sessionInsertionResult: input.sessionInsertionResult,
    signalAvailability: input.signalAvailability,
  };
}

export function captureOutcomeForRecognition(input: {
  captured: boolean;
  providerAvailable: boolean;
  confidenceState?: ScannerCaptureOutcomeStatus | null;
  appendedToSession: boolean;
  error?: string | null;
}): { status: ScannerCaptureOutcomeStatus; message: string } {
  if (!input.captured || input.error) return { status: 'capture_failed', message: input.error ?? 'Capture failed.' };
  if (!input.providerAvailable) {
    return {
      status: 'identification_unavailable',
      message: input.appendedToSession
        ? 'Captured - identification unavailable. Use manual search to choose the exact printing.'
        : 'Captured - identification unavailable. Session insertion did not complete.',
    };
  }
  return {
    status: input.confidenceState ?? 'manual_review_required',
    message: 'Captured result needs exact-printing confirmation before saving.',
  };
}

export function shouldRearmAfterCardRemoval(input: {
  awaitingCardRemoval: boolean;
  guideFillRatio: number;
  removalThreshold: number;
  override?: boolean;
}) {
  if (input.override) return true;
  return input.awaitingCardRemoval && input.guideFillRatio <= input.removalThreshold;
}

export function summarizeFoilDiagnostics(frames: FoilDiagnosticsFrame[]): FoilDiagnosticsSummary {
  if (!frames.length) {
    return {
      status: 'indeterminate',
      frameCount: 0,
      evidence: ['No foil-test frames captured. Finish remains manually editable.'],
    };
  }
  const highlightAverage = average(frames.map((frame) => frame.highlightScore));
  const motionAverage = average(frames.map((frame) => frame.motionScore));
  return {
    status: 'indeterminate',
    frameCount: frames.length,
    evidence: [
      `Highlight average ${Math.round(highlightAverage * 100)}%.`,
      `Motion average ${Math.round(motionAverage * 100)}%.`,
      'Foil classification is not claimed without benchmarked multi-frame evidence.',
    ],
  };
}

function clampFinite(value: number | undefined, min: number, max: number, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}
