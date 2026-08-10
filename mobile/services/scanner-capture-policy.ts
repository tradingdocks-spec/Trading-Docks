import type { SingleScanCaptureQuality } from './single-scan-capture-quality.ts';

export type ScannerCaptureTrigger = 'manual' | 'auto';

export type ScannerManualCapturePolicyInput = {
  cameraInitialized: boolean;
  permissionGranted: boolean;
  appForegrounded: boolean;
  processing: boolean;
};

export type ScannerManualCapturePolicy = {
  canCapture: boolean;
  blockedReason: 'camera_unavailable' | 'permission_denied' | 'app_backgrounded' | 'processing' | null;
};

export type ScannerAutoCapturePolicyInput = ScannerManualCapturePolicyInput & {
  qualityReady: boolean;
};

export type ScannerAutoCapturePolicy = ScannerManualCapturePolicy & {
  qualityReady: boolean;
};

export type ScannerCaptureDiagnostic = {
  trigger: ScannerCaptureTrigger;
  qualityReason: SingleScanCaptureQuality['reason'];
  guidance: SingleScanCaptureQuality['guidance'];
  blurScore: number | null;
  fillRatio: number | null;
  motionScore: number | null;
  stableDurationMs: number | null;
  forced: boolean;
};

export function resolveScannerManualCapturePolicy(input: ScannerManualCapturePolicyInput): ScannerManualCapturePolicy {
  if (!input.permissionGranted) {
    return { canCapture: false, blockedReason: 'permission_denied' };
  }
  if (!input.appForegrounded) {
    return { canCapture: false, blockedReason: 'app_backgrounded' };
  }
  if (!input.cameraInitialized) {
    return { canCapture: false, blockedReason: 'camera_unavailable' };
  }
  if (input.processing) {
    return { canCapture: false, blockedReason: 'processing' };
  }
  return { canCapture: true, blockedReason: null };
}

export function resolveScannerAutoCapturePolicy(input: ScannerAutoCapturePolicyInput): ScannerAutoCapturePolicy {
  const manual = resolveScannerManualCapturePolicy(input);
  return {
    ...manual,
    canCapture: manual.canCapture && input.qualityReady,
    qualityReady: input.qualityReady,
  };
}

export function createScannerCaptureDiagnostic(input: {
  trigger: ScannerCaptureTrigger;
  quality: SingleScanCaptureQuality;
}): ScannerCaptureDiagnostic {
  return {
    trigger: input.trigger,
    qualityReason: input.quality.reason,
    guidance: input.quality.guidance,
    blurScore: input.quality.blurScore,
    fillRatio: input.quality.fillRatio,
    motionScore: input.quality.motionScore,
    stableDurationMs: input.quality.stableDurationMs,
    forced: input.trigger === 'manual' && !input.quality.canCapture,
  };
}
