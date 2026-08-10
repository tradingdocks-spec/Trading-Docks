export type ScannerIdentityTier = 'exact' | 'suggested' | 'needs_review' | 'failed';

export type ScannerFastIdentityScan = {
  ok: boolean;
  candidates?: unknown[];
  recognition?: {
    confidence: {
      overall: number;
      requiresConfirmation: boolean;
    };
  };
  signals?: {
    collectorInfo?: {
      setCode: string | null;
      collectorNumber: string | null;
    } | null;
  };
};

export type ScannerFastIdentityTiming = {
  captureStartedAt: number;
  titleOcrCompletedAt: number | null;
  lookupCompletedAt: number | null;
  sessionInsertedAt: number | null;
  collectorRefinementStartedAt: number | null;
  pricingStartedAt: number | null;
};

export type ScannerFastIdentityEvent =
  | 'capture_started'
  | 'title_ocr_completed'
  | 'lookup_completed'
  | 'session_inserted'
  | 'collector_refinement_started'
  | 'pricing_started';

export type ScannerFastIdentityPlan = {
  tier: ScannerIdentityTier;
  canInsertBeforeRefinement: boolean;
  reason: string;
  timing: ScannerFastIdentityTiming;
  eventOrder: ScannerFastIdentityEvent[];
};

export function classifyScannerFastIdentity(scan: ScannerFastIdentityScan): ScannerIdentityTier {
  if (!scan.ok || !scan.recognition) return 'failed';
  const overall = scan.recognition.confidence.overall;
  const hasPrintingEvidence = Boolean(scan.signals?.collectorInfo?.setCode && scan.signals.collectorInfo.collectorNumber);
  if (overall >= 82 && hasPrintingEvidence && !scan.recognition.confidence.requiresConfirmation) return 'exact';
  if (overall >= 58 && scan.candidates?.length) return 'suggested';
  if (scan.candidates?.length) return 'needs_review';
  return 'failed';
}

export function createScannerFastIdentityPlan(input: {
  scan: ScannerFastIdentityScan;
  captureStartedAt: number;
  titleOcrCompletedAt: number | null;
  lookupCompletedAt: number | null;
  sessionInsertedAt: number | null;
  collectorRefinementStartedAt?: number | null;
  pricingStartedAt?: number | null;
}): ScannerFastIdentityPlan {
  const tier = classifyScannerFastIdentity(input.scan);
  const timing: ScannerFastIdentityTiming = {
    captureStartedAt: input.captureStartedAt,
    titleOcrCompletedAt: input.titleOcrCompletedAt,
    lookupCompletedAt: input.lookupCompletedAt,
    sessionInsertedAt: input.sessionInsertedAt,
    collectorRefinementStartedAt: input.collectorRefinementStartedAt ?? null,
    pricingStartedAt: input.pricingStartedAt ?? null,
  };
  return {
    tier,
    canInsertBeforeRefinement: tier === 'exact' || tier === 'suggested' || tier === 'needs_review',
    reason: fastIdentityReason(tier),
    timing,
    eventOrder: fastIdentityEventOrder(timing),
  };
}

export function scannerFastIdentityLatency(input: ScannerFastIdentityTiming) {
  return {
    captureToTitleMs: elapsed(input.captureStartedAt, input.titleOcrCompletedAt),
    captureToLookupMs: elapsed(input.captureStartedAt, input.lookupCompletedAt),
    captureToInsertMs: elapsed(input.captureStartedAt, input.sessionInsertedAt),
    collectorStartedAfterInsert: happensAfter(input.collectorRefinementStartedAt, input.sessionInsertedAt),
    pricingStartedAfterInsert: happensAfter(input.pricingStartedAt, input.sessionInsertedAt),
  };
}

function fastIdentityReason(tier: ScannerIdentityTier) {
  if (tier === 'exact') return 'Strong name and printing evidence can insert immediately.';
  if (tier === 'suggested') return 'Strong name can insert immediately while exact-printing evidence refines in background.';
  if (tier === 'needs_review') return 'Likely identity can insert into Review List without blocking the next scan.';
  return 'No usable identity; manual search or retake is required.';
}

function fastIdentityEventOrder(timing: ScannerFastIdentityTiming): ScannerFastIdentityEvent[] {
  return [
    ['capture_started', timing.captureStartedAt],
    ['title_ocr_completed', timing.titleOcrCompletedAt],
    ['lookup_completed', timing.lookupCompletedAt],
    ['session_inserted', timing.sessionInsertedAt],
    ['collector_refinement_started', timing.collectorRefinementStartedAt],
    ['pricing_started', timing.pricingStartedAt],
  ]
    .filter((entry): entry is [ScannerFastIdentityEvent, number] => typeof entry[1] === 'number')
    .sort((a, b) => a[1] - b[1])
    .map(([event]) => event);
}

function elapsed(startedAt: number, endedAt: number | null) {
  return endedAt === null ? null : Math.max(0, endedAt - startedAt);
}

function happensAfter(eventAt: number | null, gateAt: number | null) {
  return eventAt === null || gateAt === null ? null : eventAt >= gateAt;
}
