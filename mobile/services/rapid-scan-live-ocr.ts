import {
  recognizeFrameTitle,
  validateNativeLiveTitleOcrRequest,
  type NativeLiveTitleOcrRequest,
  type NativeLiveTitleOcrResult,
} from '../modules/trading-docks-vision-ocr/index.ts';
import type { ScannerCameraFrame } from '../components/scanner-camera-contract.ts';
import type { ScannerVisionResult } from './scanner-vision-engine.ts';
import type { VisualReferenceIndex, MultiSignalRecognitionResult } from './scanner-multi-signal-recognition.ts';
import {
  RAPID_SCAN_FIXED_ZONE,
  createRapidScanResult,
  matchRapidTitle,
  normalizeRapidTitle,
  routeRapidIdentity,
  type RapidMagicNameIndex,
  type RapidScanDestination,
  type RapidScanResult,
} from './rapid-scan-pipeline.ts';
import {
  recognizeScannerFrameWithFusion,
} from './scanner-multi-signal-recognition.ts';

export type RapidLiveOcrStatus = 'idle' | 'in_flight' | 'stale' | 'failed';
export type RapidTitleRoiStage = 'title_primary' | 'title_expanded' | 'upper_card';
export type RapidLiveOcrFailureStage =
  | 'NO_CARD'
  | 'NO_TEXT'
  | 'LOW_OCR_CONFIDENCE'
  | 'NO_LOCAL_MATCH'
  | 'AMBIGUOUS_MATCH'
  | 'PRINTING_AMBIGUOUS'
  | 'NETWORK_ENRICHMENT_FAILED';

export type RapidLiveOcrMetrics = {
  framesSampled: number;
  ocrStarted: number;
  ocrCompleted: number;
  framesSkipped: number;
  staleResultsDiscarded: number;
  boundedRetries: number;
  lastOcrDurationMs: number | null;
  lastLocalMatchMs: number | null;
  lastIdentityLatencyMs: number | null;
  lastFrameToResultLatencyMs: number | null;
};

export type RapidLiveOcrDiagnostics = {
  frameId: string;
  stage: RapidTitleRoiStage;
  rawOcrText: string | null;
  normalizedOcrText: string | null;
  ocrConfidence: number | null;
  localMatchCandidate: string | null;
  matchScore: number | null;
  confidenceBand: 'high' | 'medium' | 'low' | null;
  route: string | null;
  failureStage: RapidLiveOcrFailureStage | null;
  roi: NativeLiveTitleOcrRequest['roi'];
  visionRoi: NativeLiveTitleOcrRequest['roi'];
  frameOrientation: ScannerCameraFrame['orientation'];
  ocrDurationMs: number | null;
  matchDurationMs: number | null;
  catalogLoaded: boolean;
  catalogCardCount: number;
  indexReady: boolean;
  prewarmMs: number | null;
  fusion?: {
    geometryQuality: number;
    bestFrameScore: number | null;
    visualCandidate: string | null;
    visualSimilarity: number | null;
    ocrCandidate: string | null;
    ocrScore: number | null;
    fusedCandidate: string | null;
    fusedConfidence: number;
    printingCandidate: string | null;
    finalDecision: MultiSignalRecognitionResult['status'];
    conflict: boolean;
    decisionReason: string;
    timings: ReturnType<typeof recognizeScannerFrameWithFusion>['activeDiagnostics']['timings'];
    visualIndexRecordCount: number;
  };
};

export type RapidLiveOcrState = {
  activeToken: number;
  inFlight: boolean;
  latestAcceptedFrameId: string | null;
  tornDown: boolean;
  metrics: RapidLiveOcrMetrics;
  lastDiagnostics: RapidLiveOcrDiagnostics | null;
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
    fusion: MultiSignalRecognitionResult | null;
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

const RAPID_TITLE_ROI_STAGES: RapidTitleRoiStage[] = ['title_primary', 'title_expanded', 'upper_card'];

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
      boundedRetries: 0,
      lastOcrDurationMs: null,
      lastLocalMatchMs: null,
      lastIdentityLatencyMs: null,
      lastFrameToResultLatencyMs: null,
    },
    lastDiagnostics: null,
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
  return rapidTitleRoiForStage('title_primary', frame);
}

export function rapidTitleRoiForStage(stage: RapidTitleRoiStage, frame: Pick<ScannerCameraFrame, 'width' | 'height'>) {
  const card = RAPID_SCAN_FIXED_ZONE.card;
  const cardRelative = stage === 'title_primary'
    ? RAPID_SCAN_FIXED_ZONE.titleRoi
    : stage === 'title_expanded'
      ? { x: 0.045, y: 0.025, width: 0.9, height: 0.16 }
      : { x: 0.035, y: 0.02, width: 0.93, height: 0.245 };
  const roi = {
    x: card.x + cardRelative.x * card.width,
    y: card.y + cardRelative.y * card.height,
    width: cardRelative.width * card.width,
    height: cardRelative.height * card.height,
  };
  return normalizeLiveOcrRoi(roi, frame);
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

export function visionRoiFromTopLeftRoi(roi: NativeLiveTitleOcrRequest['roi']): NativeLiveTitleOcrRequest['roi'] {
  return {
    x: roi.x,
    y: 1 - roi.y - roi.height,
    width: roi.width,
    height: roi.height,
  };
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
  vision?: ScannerVisionResult | null;
  visualIndex?: VisualReferenceIndex | null;
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

  if (!input.nameIndex.records.length) {
    const roi = rapidTitleRoiForStage('title_primary', input.frame);
    return {
      state: {
        ...input.state,
        lastDiagnostics: diagnosticBase(input.frame, 'title_primary', roi, {
          failureStage: 'NO_LOCAL_MATCH',
          catalogCardCount: 0,
          indexReady: false,
          prewarmMs: input.nameIndex.prewarmMs ?? null,
        }),
      },
      outcome: { status: 'retry', frameId: input.frame.id, reason: 'Preparing scanner name catalog.', nativeDurationMs: null },
    };
  }

  const token = input.state.activeToken + 1;
  const startedAt = now();
  const initialRequest = buildLiveTitleOcrRequest(input.frame, rapidTitleRoiForStage('title_primary', input.frame));
  const validation = validateNativeLiveTitleOcrRequest(initialRequest);
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
  let nativeResult: NativeLiveTitleOcrResult | null = null;
  let nativeRequest = initialRequest;
  let usedStage: RapidTitleRoiStage = 'title_primary';
  for (const stage of RAPID_TITLE_ROI_STAGES) {
    usedStage = stage;
    nativeRequest = buildLiveTitleOcrRequest(input.frame, rapidTitleRoiForStage(stage, input.frame));
    nativeResult = await native(nativeRequest);
    if (nativeResult.ok && nativeResult.text.trim() && nativeResult.confidence >= 45) break;
    if (!nativeResult.ok && nativeResult.code !== 'empty_result') break;
  }
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
      boundedRetries: usedStage === 'title_primary' ? nextState.metrics.boundedRetries : nextState.metrics.boundedRetries + 1,
      lastOcrDurationMs: nativeResult?.ok ? nativeResult.durationMs : null,
    },
  };

  if (!nativeResult?.ok) {
    const failure = nativeResult ?? {
      ok: false,
      provider: 'apple_vision' as const,
      frameId: input.frame.id,
      code: 'empty_result' as const,
      message: 'No OCR result.',
      durationMs: 0,
      warnings: [],
    };
    const fusion = input.vision ? recognizeScannerFrameWithFusion({
      vision: input.vision,
      rawOcrText: null,
      normalizedOcrText: null,
      ocrConfidence: null,
      ocrDurationMs: failure.durationMs,
      visualIndex: input.visualIndex,
      nameIndex: input.nameIndex,
      now,
    }) : null;
    nextState = {
      ...nextState,
      lastDiagnostics: diagnosticBase(input.frame, usedStage, nativeRequest.roi, {
        failureStage: failure.code === 'empty_result' ? 'NO_TEXT' : 'LOW_OCR_CONFIDENCE',
        ocrDurationMs: failure.durationMs,
        catalogCardCount: input.nameIndex.records.length,
        indexReady: true,
        prewarmMs: input.nameIndex.prewarmMs ?? null,
      }, fusion?.activeDiagnostics),
    };
    if (fusion?.status === 'append_identity' && fusion.identityName && fusion.oracleId) {
      return {
        state: nextState,
        outcome: {
          status: 'added',
          frameId: input.frame.id,
          titleText: fusion.identityName,
          confidence: fusion.confidence.overall,
          result: rapidResultFromFusion(fusion, input.destination, input.createResultId(), now()),
          nativeDurationMs: failure.durationMs,
          localMatchMs: fusion.activeDiagnostics.timings.visualLookupMs ?? 0,
          identityLatencyMs: fusion.activeDiagnostics.timings.identityMs ?? 0,
          fusion,
        },
      };
    }
    return {
      state: nextState,
      outcome: usedStage === 'upper_card'
        ? { status: 'fallback_precision', frameId: input.frame.id, reason: failure.message, nativeDurationMs: failure.durationMs }
        : liveOcrFailureOutcome(input.frame.id, failure),
    };
  }

  const matchStartedAt = now();
  const match = matchRapidTitle(input.nameIndex, nativeResult.text);
  const route = routeRapidIdentity(match);
  const localMatchMs = Math.max(0, now() - matchStartedAt);
  const identityLatencyMs = Math.max(0, now() - startedAt);
  const fusion = input.vision ? recognizeScannerFrameWithFusion({
    vision: input.vision,
    rawOcrText: nativeResult.text,
    normalizedOcrText: normalizeRapidTitle(nativeResult.text),
    ocrConfidence: nativeResult.confidence,
    ocrDurationMs: nativeResult.durationMs,
    visualIndex: input.visualIndex,
    nameIndex: input.nameIndex,
    now,
  }) : null;
  const failureStage = !match.entry
    ? match.failureCode ?? 'NO_LOCAL_MATCH'
    : route.action === 'continue_reading'
      ? 'LOW_OCR_CONFIDENCE'
      : route.action === 'precision_fallback'
        ? 'AMBIGUOUS_MATCH'
        : null;

  nextState = {
    ...nextState,
    lastDiagnostics: {
      frameId: input.frame.id,
      stage: usedStage,
      rawOcrText: nativeResult.text,
      normalizedOcrText: normalizeRapidTitle(nativeResult.text),
      ocrConfidence: nativeResult.confidence,
      localMatchCandidate: match.entry?.name ?? null,
      matchScore: match.score,
      confidenceBand: route.confidenceClass,
      route: route.action,
      failureStage,
      roi: nativeRequest.roi,
      visionRoi: visionRoiFromTopLeftRoi(nativeRequest.roi),
      frameOrientation: input.frame.orientation,
      ocrDurationMs: nativeResult.durationMs,
      matchDurationMs: localMatchMs,
      catalogLoaded: true,
      catalogCardCount: input.nameIndex.records.length,
      indexReady: true,
      prewarmMs: input.nameIndex.prewarmMs ?? null,
      fusion: fusion?.activeDiagnostics,
    },
    metrics: {
      ...nextState.metrics,
      lastLocalMatchMs: localMatchMs,
      lastIdentityLatencyMs: identityLatencyMs,
      lastFrameToResultLatencyMs: Math.max(0, ocrEndedAt - input.frame.capturedAt),
    },
  };

  if (fusion?.status === 'append_identity' && fusion.identityName && fusion.oracleId) {
    const result = rapidResultFromFusion(fusion, input.destination, input.createResultId(), now());
    return {
      state: nextState,
      outcome: {
        status: 'added',
        frameId: input.frame.id,
        titleText: nativeResult.text,
        confidence: fusion.confidence.overall,
        result,
        nativeDurationMs: nativeResult.durationMs,
        localMatchMs: fusion.activeDiagnostics.timings.visualLookupMs ?? localMatchMs,
        identityLatencyMs: fusion.activeDiagnostics.timings.identityMs ?? identityLatencyMs,
        fusion,
      },
    };
  }

  if (fusion?.status === 'review') {
    return {
      state: nextState,
      outcome: {
        status: 'fallback_precision',
        frameId: input.frame.id,
        reason: fusion.diagnostics.decisionReason,
        nativeDurationMs: nativeResult.durationMs,
      },
    };
  }

  if (route.action === 'continue_reading') {
    return {
      state: nextState,
      outcome: {
        status: usedStage === 'upper_card' ? 'fallback_precision' : 'retry',
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
      fusion,
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

function diagnosticBase(
  frame: ScannerCameraFrame,
  stage: RapidTitleRoiStage,
  roi: NativeLiveTitleOcrRequest['roi'],
  input: {
    failureStage: RapidLiveOcrFailureStage | null;
    ocrDurationMs?: number | null;
    catalogCardCount: number;
    indexReady: boolean;
    prewarmMs: number | null;
  },
  fusion?: ReturnType<typeof recognizeScannerFrameWithFusion>['activeDiagnostics'],
): RapidLiveOcrDiagnostics {
  return {
    frameId: frame.id,
    stage,
    rawOcrText: null,
    normalizedOcrText: null,
    ocrConfidence: null,
    localMatchCandidate: null,
    matchScore: null,
    confidenceBand: null,
    route: null,
    failureStage: input.failureStage,
    roi,
    visionRoi: visionRoiFromTopLeftRoi(roi),
    frameOrientation: frame.orientation,
    ocrDurationMs: input.ocrDurationMs ?? null,
    matchDurationMs: null,
    catalogLoaded: input.catalogCardCount > 0,
    catalogCardCount: input.catalogCardCount,
    indexReady: input.indexReady,
    prewarmMs: input.prewarmMs,
    fusion,
  };
}

function rapidResultFromFusion(
  fusion: MultiSignalRecognitionResult,
  destination: RapidScanDestination,
  id: string,
  createdAt: number,
): RapidScanResult {
  return {
    id,
    cardName: fusion.identityName ?? 'Unrecognized card',
    oracleId: fusion.oracleId ?? '',
    scryfallId: fusion.printing.selected?.id ?? fusion.visual?.record?.scryfallId ?? null,
    confidenceClass: fusion.confidenceBand,
    reviewRequired: fusion.status !== 'append_identity' || fusion.printing.ambiguous,
    destination,
    exactPrintingId: fusion.printing.selected?.id ?? fusion.visual?.record?.scryfallId ?? null,
    setCode: fusion.printing.selected?.setCode ?? fusion.visual?.record?.setCode ?? null,
    collectorNumber: fusion.printing.selected?.collectorNumber ?? fusion.visual?.record?.collectorNumber ?? null,
    finish: null,
    language: fusion.printing.selected?.language ?? 'en',
    pricingState: 'not_started',
    createdAt,
    refinementState: fusion.printing.ambiguous ? 'review_required' : 'resolved',
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
