import type { VisionDetection, VisionQuality } from './scanner-vision-engine.ts';

export type AppleVisionAutoCaptureState =
  | 'SEARCHING'
  | 'FOUND'
  | 'STABILIZING'
  | 'READY'
  | 'CAPTURING'
  | 'READING'
  | 'IDENTIFIED'
  | 'WAITING_FOR_REMOVAL'
  | 'REARMED';

export type AppleVisionPoint = { x: number; y: number };
export type AppleVisionRect = { x: number; y: number; width: number; height: number };

export type AppleVisionCardRectangle = {
  detected: boolean;
  confidence: number;
  corners: [AppleVisionPoint, AppleVisionPoint, AppleVisionPoint, AppleVisionPoint] | null;
  boundingBox: AppleVisionRect | null;
  durationMs?: number | null;
};

export type AppleVisionAutoCaptureRuntime = {
  state: AppleVisionAutoCaptureState;
  stableSince: number | null;
  lastRectangle: AppleVisionCardRectangle | null;
  lastCapturedFingerprint: string | null;
  captureLocked: boolean;
  missingSince: number | null;
  readyAt: number | null;
  reason: string;
};

export type AppleVisionAutoCaptureInput = {
  autoEnabled: boolean;
  cameraReady: boolean;
  processing: boolean;
  now: number;
  rectangle: AppleVisionCardRectangle | null;
  quality: Pick<VisionQuality, 'blur' | 'motion' | 'lighting' | 'glare'> | null;
  fingerprint?: string | null;
};

export type AppleVisionAutoCaptureDecision = {
  runtime: AppleVisionAutoCaptureRuntime;
  shouldCapture: boolean;
};

const REQUIRED_STABILITY_MS = 520;
const REMOVAL_MS = 220;
const MIN_CONFIDENCE = 0.56;
const MAX_MOTION = 0.34;
const MAX_BLUR = 0.62;
const MIN_LIGHTING = 0.28;
const MAX_GLARE = 0.7;
const MIN_AREA = 0.16;
const MAX_AREA = 0.78;
const MAX_CENTER_OFFSET = 0.22;
const MAX_GEOMETRY_DELTA = 0.035;
const NEW_CARD_GEOMETRY_DELTA = 0.13;

export function createAppleVisionAutoCaptureRuntime(): AppleVisionAutoCaptureRuntime {
  return {
    state: 'SEARCHING',
    stableSince: null,
    lastRectangle: null,
    lastCapturedFingerprint: null,
    captureLocked: false,
    missingSince: null,
    readyAt: null,
    reason: 'searching',
  };
}

export function nextAppleVisionAutoCaptureRuntime(
  current: AppleVisionAutoCaptureRuntime,
  input: AppleVisionAutoCaptureInput,
): AppleVisionAutoCaptureDecision {
  if (!input.cameraReady) {
    return { runtime: { ...current, state: 'SEARCHING', stableSince: null, reason: 'camera_not_ready' }, shouldCapture: false };
  }
  if (input.processing) {
    return { runtime: { ...current, state: current.state === 'CAPTURING' ? 'CAPTURING' : 'READING', reason: 'processing' }, shouldCapture: false };
  }

  const rectangle = normalizedRectangle(input.rectangle);
  if (!rectangle) {
    const missingSince = current.missingSince ?? input.now;
    const removed = input.now - missingSince >= REMOVAL_MS;
    if (removed) {
      return {
        runtime: {
          ...createAppleVisionAutoCaptureRuntime(),
          state: current.captureLocked ? 'REARMED' : 'SEARCHING',
          missingSince,
          reason: current.captureLocked ? 'card_removed_rearmed' : 'searching',
        },
        shouldCapture: false,
      };
    }
    return {
      runtime: { ...current, state: current.captureLocked ? 'WAITING_FOR_REMOVAL' : 'SEARCHING', stableSince: null, missingSince, reason: 'card_not_detected' },
      shouldCapture: false,
    };
  }

  const geometryDelta = current.lastRectangle ? rectangleGeometryDelta(current.lastRectangle, rectangle) : Number.POSITIVE_INFINITY;
  const newGeometryWhileLocked = current.captureLocked && geometryDelta >= NEW_CARD_GEOMETRY_DELTA;
  const stableGeometry = geometryDelta <= MAX_GEOMETRY_DELTA;
  const lastCapturedFingerprint = newGeometryWhileLocked ? null : current.lastCapturedFingerprint;
  const captureLocked = newGeometryWhileLocked ? false : current.captureLocked;

  if (captureLocked) {
    return {
      runtime: {
        ...current,
        state: 'WAITING_FOR_REMOVAL',
        lastRectangle: rectangle,
        missingSince: null,
        lastCapturedFingerprint,
        reason: 'same_card_waiting_for_removal',
      },
      shouldCapture: false,
    };
  }

  const geometry = classifyGeometry(rectangle);
  if (!geometry.ok) {
    return {
      runtime: {
        ...current,
        state: 'FOUND',
        lastRectangle: rectangle,
        stableSince: null,
        missingSince: null,
        lastCapturedFingerprint,
        captureLocked: false,
        reason: geometry.reason,
      },
      shouldCapture: false,
    };
  }

  const quality = classifyQuality(input.quality);
  if (!quality.ok) {
    return {
      runtime: {
        ...current,
        state: 'FOUND',
        lastRectangle: rectangle,
        stableSince: null,
        missingSince: null,
        lastCapturedFingerprint,
        captureLocked: false,
        reason: quality.reason,
      },
      shouldCapture: false,
    };
  }

  const stableSince = stableGeometry ? current.stableSince ?? input.now : input.now;
  const stableDurationMs = input.now - stableSince;
  if (stableDurationMs < REQUIRED_STABILITY_MS) {
    return {
      runtime: {
        ...current,
        state: 'STABILIZING',
        lastRectangle: rectangle,
        stableSince,
        missingSince: null,
        lastCapturedFingerprint,
        captureLocked: false,
        reason: `stabilizing:${Math.max(0, REQUIRED_STABILITY_MS - stableDurationMs)}`,
      },
      shouldCapture: false,
    };
  }

  const nextReady: AppleVisionAutoCaptureRuntime = {
    ...current,
    state: input.autoEnabled ? 'CAPTURING' : 'READY',
    lastRectangle: rectangle,
    stableSince,
    missingSince: null,
    readyAt: current.readyAt ?? input.now,
    lastCapturedFingerprint: input.autoEnabled ? input.fingerprint ?? rectangleFingerprint(rectangle) : lastCapturedFingerprint,
    captureLocked: input.autoEnabled,
    reason: input.autoEnabled ? 'auto_capture_triggered' : 'manual_ready',
  };

  return { runtime: nextReady, shouldCapture: input.autoEnabled };
}

export function scannerVisionDetectionToAppleRectangle(detection: VisionDetection | null | undefined): AppleVisionCardRectangle | null {
  if (!detection?.cardPresent || !detection.bounds) return null;
  return {
    detected: true,
    confidence: detection.confidence,
    corners: detection.corners.map((corner) => ({ x: corner.x, y: corner.y })) as [AppleVisionPoint, AppleVisionPoint, AppleVisionPoint, AppleVisionPoint],
    boundingBox: {
      x: detection.bounds.x,
      y: detection.bounds.y,
      width: detection.bounds.width,
      height: detection.bounds.height,
    },
  };
}

export function appleVisionStateInstruction(state: AppleVisionAutoCaptureState, fallback: string): string {
  if (state === 'SEARCHING' || state === 'REARMED') return 'Place card';
  if (state === 'FOUND') return fallback;
  if (state === 'STABILIZING') return 'Hold steady';
  if (state === 'READY') return 'Ready';
  if (state === 'CAPTURING') return 'Capturing';
  if (state === 'READING') return 'Scanning';
  if (state === 'IDENTIFIED') return 'Added';
  if (state === 'WAITING_FOR_REMOVAL') return 'Remove card';
  return fallback;
}

export function markAppleVisionAutoCapturePhase(
  current: AppleVisionAutoCaptureRuntime,
  state: Extract<AppleVisionAutoCaptureState, 'CAPTURING' | 'READING' | 'IDENTIFIED' | 'WAITING_FOR_REMOVAL'>,
  reason = state.toLowerCase(),
): AppleVisionAutoCaptureRuntime {
  return { ...current, state, reason };
}

function normalizedRectangle(rectangle: AppleVisionCardRectangle | null): AppleVisionCardRectangle | null {
  if (!rectangle?.detected || !rectangle.boundingBox || rectangle.confidence < MIN_CONFIDENCE) return null;
  const box = rectangle.boundingBox;
  const validBox = [box.x, box.y, box.width, box.height].every(Number.isFinite)
    && box.width > 0
    && box.height > 0;
  if (!validBox) return null;
  return rectangle;
}

function classifyGeometry(rectangle: AppleVisionCardRectangle): { ok: true } | { ok: false; reason: string } {
  const box = rectangle.boundingBox;
  if (!box) return { ok: false, reason: 'missing_bounds' };
  const area = box.width * box.height;
  if (area < MIN_AREA) return { ok: false, reason: 'move_closer' };
  if (area > MAX_AREA) return { ok: false, reason: 'move_away' };
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const centerOffset = Math.hypot(centerX - 0.5, centerY - 0.5);
  if (centerOffset > MAX_CENTER_OFFSET) return { ok: false, reason: 'center_card' };
  return { ok: true };
}

function classifyQuality(quality: AppleVisionAutoCaptureInput['quality']): { ok: true } | { ok: false; reason: string } {
  if (!quality) return { ok: false, reason: 'quality_unavailable' };
  if (quality.motion > MAX_MOTION) return { ok: false, reason: 'motion' };
  if (quality.blur > MAX_BLUR) return { ok: false, reason: 'blur' };
  if (quality.lighting < MIN_LIGHTING) return { ok: false, reason: 'lighting' };
  if (quality.glare > MAX_GLARE) return { ok: false, reason: 'glare' };
  return { ok: true };
}

function rectangleGeometryDelta(left: AppleVisionCardRectangle, right: AppleVisionCardRectangle): number {
  const leftBox = left.boundingBox;
  const rightBox = right.boundingBox;
  if (!leftBox || !rightBox) return Number.POSITIVE_INFINITY;
  const boxDelta = Math.max(
    Math.abs(leftBox.x - rightBox.x),
    Math.abs(leftBox.y - rightBox.y),
    Math.abs(leftBox.width - rightBox.width),
    Math.abs(leftBox.height - rightBox.height),
  );
  if (!left.corners || !right.corners) return boxDelta;
  const cornerDelta = left.corners.reduce((max, point, index) => {
    const other = right.corners?.[index] ?? point;
    return Math.max(max, Math.hypot(point.x - other.x, point.y - other.y));
  }, 0);
  return Math.max(boxDelta, cornerDelta);
}

function rectangleFingerprint(rectangle: AppleVisionCardRectangle): string {
  const box = rectangle.boundingBox;
  if (!box) return 'no-rectangle';
  return [box.x, box.y, box.width, box.height]
    .map((value) => Math.round(value * 100))
    .join(':');
}
