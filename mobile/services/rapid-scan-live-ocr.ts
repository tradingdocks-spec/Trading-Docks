import {
  recognizeFrameTitle,
  validateNativeLiveTitleOcrRequest,
  type NativeLiveTitleOcrRequest,
  type NativeLiveTitleOcrResult,
} from '../modules/trading-docks-vision-ocr/index.ts';
import type { ScannerCameraFrame } from '../components/scanner-camera-contract.ts';
import {
  RAPID_SCAN_FIXED_ZONE,
  createRapidScanResult,
  matchRapidTitle,
  routeRapidIdentity,
  type RapidMagicNameIndex,
  type RapidScanDestination,
  type RapidScanResult,
} from './rapid-scan-pipeline.ts';

export type RapidLiveOcrStatus = 'idle' | 'in_flight' | 'stale' | 'failed';

export type RapidLiveOcrMetrics = {
  framesSampled: number;
  ocrStarted: number;
  ocrCompleted: number;
  framesSkipped: number;
  staleResultsDiscarded: number;
  lastOcrDurationMs: number | null;
  lastLocalMatchMs: number | null;
  lastIdentityLatencyMs: number | null;
  lastFrameToResultLatencyMs: number | null;
};

export type RapidLiveOcrState = {
  activeToken: number;
  inFlight: boolean;
  latestAcceptedFrameId: string | null;
  tornDown: boolean;
  metrics: RapidLiveOcrMetrics;
};

export type RapidLiveOcrOutcome =
  | {
    status: 'added';
    frameId: string;
    titleText: string;
    confidence: number;
    result: RapidScanResult;
    nativeDurationMs: number;
    localMatchMs: number;
    identityLatencyMs: number;
  }
  | {
    status: 'retry';
    frameId: string;
    reason: string;
    nativeDurationMs: number | null;
  }
  | {
    status: 'fallback_precision';
    frameId: string;
    reason: string;
    nativeDurationMs: number | null;
  }
  | {
    status: 'skipped' | 'stale';
    frameId: string;
    reason: string;
  };

export type RapidLiveOcrNativeProvider = (request: NativeLiveTitleOcrRequest) => Promise<NativeLiveTitleOcrResult>;

export function createRapidLiveOcrState(): RapidLiveOcrState {
  return {
    activeToken: 0,
    inFlight: false,
    latestAcceptedFrameId: null,
    tornDown: false,
    metrics: {
      framesSampled: 0,
      ocrStarted: 0,
      ocrCompleted: 0,
      framesSkipped: 0,
      staleResultsDiscarded: 0,
      lastOcrDurationMs: null,
      lastLocalMatchMs: null,
      lastIdentityLatencyMs: null,
      lastFrameToResultLatencyMs: null,
    },
  };
}

export function stopRapidLiveOcr(state: RapidLiveOcrState): RapidLiveOcrState {
  return {
    ...state,
    tornDown: true,
    activeToken: state.activeToken + 1,
    inFlight: false,
  };
}

export function rapidTitleRoiForFrame(frame: Pick<ScannerCameraFrame, 'width' | 'height'>) {
  const roi = RAPID_SCAN_FIXED_ZONE.titleRoi;
  return normalizeLiveOcrRoi({
    x: roi.x,
    y: roi.y,
    width: roi.width,
    height: roi.height,
  }, frame);
}

export function normalizeLiveOcrRoi(
  roi: NativeLiveTitleOcrRequest['roi'],
  frame: Pick<ScannerCameraFrame, 'width' | 'height'>,
): NativeLiveTitleOcrRequest['roi'] {
  const width = clamp(roi.width, 0.01, 1);
  const height = clamp(roi.height, 0.01, 1);
  const x = clamp(roi.x, 0, 1 - width);
  const y = clamp(roi.y, 0, 1 - height);
  if (frame.width <= 0 || frame.height <= 0) return { x, y, width, height };
  return { x, y, width, height };
}

export function buildLiveTitleOcrRequest(frame: ScannerCameraFrame, roi = rapidTitleRoiForFrame(frame)): NativeLiveTitleOcrRequest {
  return {
    frameId: frame.id,
    width: frame.width,
    height: frame.height,
    pixels: Array.from(frame.pixels),
    roi,
    languages: ['en-US'],
    recognitionLevel: 'fast',
    orientation: frame.orientation,
  };
}

export async function runRapidLiveTitleOcr(input: {
  state: RapidLiveOcrState;
  frame: ScannerCameraFrame;
  nameIndex: RapidMagicNameIndex;
  destination: RapidScanDestination;
  createResultId: () => string;
  now?: () => number;
  nativeProvider?: RapidLiveOcrNativeProvider;
}): Promise<{ state: RapidLiveOcrState; outcome: RapidLiveOcrOutcome }> {
  const now = input.now ?? (() => Date.now());
  if (input.state.tornDown) return {
    state: input.state,
    outcome: { status: 'stale', frameId: input.frame.id, reason: 'Scanner is torn down.' },
  };
  if (input.state.inFlight) return {
    state: incrementMetric(input.state, 'framesSkipped'),
    outcome: { status: 'skipped', frameId: input.frame.id, reason: 'Live OCR is already in flight; dropping intermediate frame.' },
  };

  const token = input.state.activeToken + 1;
  const startedAt = now();
  const request = buildLiveTitleOcrRequest(input.frame);
  const validation = validateNativeLiveTitleOcrRequest(request);
  if (!validation.ok) return {
    state: incrementMetric(input.state, 'framesSkipped'),
    outcome: { status: 'fallback_precision', frameId: input.frame.id, reason: validation.result.message, nativeDurationMs: null },
  };

  input.state.activeToken = token;
  input.state.inFlight = true;
  input.state.latestAcceptedFrameId = input.frame.id;
  input.state.metrics = {
    ...input.state.metrics,
    framesSampled: input.state.metrics.framesSampled + 1,
    ocrStarted: input.state.metrics.ocrStarted + 1,
  };
  let nextState = input.state;

  const native = input.nativeProvider ?? recognizeFrameTitle;
  const nativeResult = await native(request);
  const ocrEndedAt = now();

  if (nextState.tornDown || token !== nextState.activeToken) {
    return {
      state: {
        ...nextState,
        inFlight: false,
        metrics: {
          ...nextState.metrics,
          staleResultsDiscarded: nextState.metrics.staleResultsDiscarded + 1,
        },
      },
      outcome: { status: 'stale', frameId: input.frame.id, reason: 'Discarded stale live OCR result.' },
    };
  }

  nextState = {
    ...nextState,
    inFlight: false,
    metrics: {
      ...nextState.metrics,
      ocrCompleted: nextState.metrics.ocrCompleted + 1,
      lastOcrDurationMs: nativeResult.ok ? nativeResult.durationMs : null,
    },
  };

  if (!nativeResult.ok) {
    return {
      state: nextState,
      outcome: liveOcrFailureOutcome(input.frame.id, nativeResult),
    };
  }

  const matchStartedAt = now();
  const match = matchRapidTitle(input.nameIndex, nativeResult.text);
  const route = routeRapidIdentity(match);
  const localMatchMs = Math.max(0, now() - matchStartedAt);
  const identityLatencyMs = Math.max(0, now() - startedAt);

  nextState = {
    ...nextState,
    metrics: {
      ...nextState.metrics,
      lastLocalMatchMs: localMatchMs,
      lastIdentityLatencyMs: identityLatencyMs,
      lastFrameToResultLatencyMs: Math.max(0, ocrEndedAt - input.frame.capturedAt),
    },
  };

  if (route.action === 'continue_reading') {
    return {
      state: nextState,
      outcome: {
        status: 'retry',
        frameId: input.frame.id,
        reason: route.reason,
        nativeDurationMs: nativeResult.durationMs,
      },
    };
  }
  if (route.action === 'precision_fallback') {
    return {
      state: nextState,
      outcome: {
        status: 'fallback_precision',
        frameId: input.frame.id,
        reason: route.reason,
        nativeDurationMs: nativeResult.durationMs,
      },
    };
  }

  const result = createRapidScanResult({
    id: input.createResultId(),
    match,
    destination: input.destination,
    createdAt: now(),
  });
  if (!result) return {
    state: nextState,
    outcome: {
      status: 'retry',
      frameId: input.frame.id,
      reason: 'Rapid title match did not produce an appendable result.',
      nativeDurationMs: nativeResult.durationMs,
    },
  };

  return {
    state: nextState,
    outcome: {
      status: 'added',
      frameId: input.frame.id,
      titleText: nativeResult.text,
      confidence: nativeResult.confidence,
      result,
      nativeDurationMs: nativeResult.durationMs,
      localMatchMs,
      identityLatencyMs,
    },
  };
}

function liveOcrFailureOutcome(frameId: string, result: Extract<NativeLiveTitleOcrResult, { ok: false }>): RapidLiveOcrOutcome {
  if (result.code === 'empty_result') return {
    status: 'retry',
    frameId,
    reason: result.message,
    nativeDurationMs: result.durationMs,
  };
  return {
    status: 'fallback_precision',
    frameId,
    reason: result.message,
    nativeDurationMs: result.durationMs,
  };
}

function incrementMetric(state: RapidLiveOcrState, metric: 'framesSkipped' | 'staleResultsDiscarded') {
  return {
    ...state,
    metrics: {
      ...state.metrics,
      [metric]: state.metrics[metric] + 1,
    },
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
