import type { ScannerGuideLayout } from './continuous-offer-scanner.ts';
import type { LiveFrameSample } from './live-card-recognition.ts';
import {
  DEFAULT_SCANNER_VISION_CONFIG,
  createScannerVisionEngine,
  type ScannerVisionConfig,
  type ScannerVisionResult,
} from './scanner-vision-engine.ts';

export type SingleScanCaptureQuality = {
  canCapture: boolean;
  guidance: 'Place card' | 'Move closer' | 'Center card' | 'Tap card to focus' | 'Hold steady' | 'Ready';
  reason:
    | 'no_frame'
    | 'no_card'
    | 'too_small'
    | 'off_center'
    | 'too_blurry'
    | 'moving'
    | 'focus_settling'
    | 'camera_not_ready'
    | 'ready';
  fillRatio: number | null;
  blurScore: number | null;
  motionScore: number | null;
  stableDurationMs: number | null;
  vision: ScannerVisionResult | null;
};

export type SingleScanQualityAnalyzer = {
  analyzeFrame: (frame: LiveFrameSample) => SingleScanCaptureQuality;
  reset: () => void;
};

export const SINGLE_SCAN_MIN_GUIDE_FILL = 0.7;
export const SINGLE_SCAN_MAX_GUIDE_FILL = 0.92;
export const SINGLE_SCAN_MAX_BLUR = 0.55;
export const SINGLE_SCAN_MAX_MOTION = 0.26;
export const SINGLE_SCAN_REQUIRED_STABILITY_MS = 450;
export const SINGLE_SCAN_FOCUS_SETTLE_MS = 450;

export function createSingleScanQualityAnalyzer(input: {
  view: { width: number; height: number };
  guide: Pick<ScannerGuideLayout, 'left' | 'top' | 'width' | 'height' | 'ratio'>;
}): SingleScanQualityAnalyzer {
  let engine: ReturnType<typeof createScannerVisionEngine> | null = null;
  let engineKey: string | null = null;

  return {
    analyzeFrame(frame) {
      const guide = mapViewGuideToFrame({ view: input.view, guide: input.guide, frame });
      const nextKey = `${frame.width}x${frame.height}:${Math.round(guide.left)}:${Math.round(guide.top)}:${Math.round(guide.width)}:${Math.round(guide.height)}`;
      if (!engine || engineKey !== nextKey) {
        engine = createScannerVisionEngine({ config: singleScanVisionConfig(guide) });
        engineKey = nextKey;
      }
      return resolveSingleScanCaptureQuality(engine.analyzeFrame(frame), { cameraReady: true, focusSettling: false });
    },
    reset() {
      engine = null;
      engineKey = null;
    },
  };
}

export function resolveSingleScanCaptureQuality(
  vision: ScannerVisionResult | null,
  input: { cameraReady: boolean; focusSettling: boolean },
): SingleScanCaptureQuality {
  if (!input.cameraReady) {
    return quality(false, 'Hold steady', 'camera_not_ready', null);
  }
  if (input.focusSettling) {
    return quality(false, 'Hold steady', 'focus_settling', vision);
  }
  if (!vision) {
    return quality(false, 'Place card', 'no_frame', null);
  }
  if (!vision.detection.cardPresent) {
    return quality(false, 'Place card', 'no_card', vision);
  }
  if (vision.detection.fillRatio < SINGLE_SCAN_MIN_GUIDE_FILL) {
    return quality(false, 'Move closer', 'too_small', vision);
  }
  if (vision.detection.centerOffset.normalized > 0.2) {
    return quality(false, 'Center card', 'off_center', vision);
  }
  if (vision.quality.blur > SINGLE_SCAN_MAX_BLUR) {
    return quality(false, 'Tap card to focus', 'too_blurry', vision);
  }
  if (vision.quality.motion > SINGLE_SCAN_MAX_MOTION) {
    return quality(false, 'Hold steady', 'moving', vision);
  }
  if (vision.quality.stabilityMs < SINGLE_SCAN_REQUIRED_STABILITY_MS) {
    return quality(false, 'Hold steady', 'moving', vision);
  }
  return quality(true, 'Ready', 'ready', vision);
}

export function singleScanUserFacingFailure(reason: string) {
  if (/Apple Vision OCR did not return readable text|No title read|readable text/i.test(reason)) {
    return {
      title: "Couldn't read the card.",
      message: 'Move closer, tap the card to focus, and try again.',
    };
  }
  if (/network|fetch|timeout|offline/i.test(reason)) {
    return {
      title: 'Lookup failed.',
      message: 'Check your connection, retake, or search manually.',
    };
  }
  if (/no match|not found|no card|empty/i.test(reason)) {
    return {
      title: "Couldn't identify.",
      message: 'Retake the card or search manually.',
    };
  }
  return {
    title: "Couldn't identify.",
    message: 'Retake the card or search manually.',
  };
}

export function mapViewGuideToFrame(input: {
  view: { width: number; height: number };
  guide: Pick<ScannerGuideLayout, 'left' | 'top' | 'width' | 'height' | 'ratio'>;
  frame: Pick<LiveFrameSample, 'width' | 'height'>;
}): ScannerVisionConfig['guide'] {
  const viewWidth = positive(input.view.width);
  const viewHeight = positive(input.view.height);
  const frameWidth = positive(input.frame.width);
  const frameHeight = positive(input.frame.height);
  const scale = Math.max(viewWidth / frameWidth, viewHeight / frameHeight);
  const displayedWidth = frameWidth * scale;
  const displayedHeight = frameHeight * scale;
  const offsetX = (viewWidth - displayedWidth) / 2;
  const offsetY = (viewHeight - displayedHeight) / 2;
  return {
    left: (input.guide.left - offsetX) / scale,
    top: (input.guide.top - offsetY) / scale,
    width: input.guide.width / scale,
    height: input.guide.height / scale,
    ratio: input.guide.ratio,
  };
}

function singleScanVisionConfig(guide: ScannerVisionConfig['guide']): ScannerVisionConfig {
  return {
    ...DEFAULT_SCANNER_VISION_CONFIG,
    guide,
    thresholds: {
      ...DEFAULT_SCANNER_VISION_CONFIG.thresholds,
      minGuideFillRatio: SINGLE_SCAN_MIN_GUIDE_FILL,
      maxGuideFillRatio: SINGLE_SCAN_MAX_GUIDE_FILL,
      maxBlurScore: SINGLE_SCAN_MAX_BLUR,
      maxMotionScore: SINGLE_SCAN_MAX_MOTION,
      requiredStabilityMs: SINGLE_SCAN_REQUIRED_STABILITY_MS,
    },
  };
}

function quality(
  canCapture: boolean,
  guidance: SingleScanCaptureQuality['guidance'],
  reason: SingleScanCaptureQuality['reason'],
  vision: ScannerVisionResult | null,
): SingleScanCaptureQuality {
  return {
    canCapture,
    guidance,
    reason,
    fillRatio: vision?.detection.fillRatio ?? null,
    blurScore: vision?.quality.blur ?? null,
    motionScore: vision?.quality.motion ?? null,
    stableDurationMs: vision?.quality.stabilityMs ?? null,
    vision,
  };
}

function positive(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 1;
}
