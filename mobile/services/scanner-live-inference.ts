import type { RapidLiveOcrDiagnostics, RapidLiveOcrOutcome } from './rapid-scan-live-ocr.ts';

export type ScannerLiveInferenceTone = 'muted' | 'info' | 'warning' | 'success';
export type ScannerLiveInferenceStage = 'looking' | 'reading' | 'possible' | 'likely' | 'matching_printing' | 'exact';

export type ScannerLiveInferenceSample = {
  frameId: string;
  observedAt: number;
  fingerprint: string | null;
  candidateName: string | null;
  exactPrintingId: string | null;
  exactPrintingLabel: string | null;
  confidenceBand: RapidLiveOcrDiagnostics['confidenceBand'];
  matchScore: number | null;
  visualSimilarity: number | null;
  rawOcrText: string | null;
  normalizedOcrText: string | null;
  route: string | null;
  failureStage: RapidLiveOcrDiagnostics['failureStage'];
  outcomeStatus: RapidLiveOcrOutcome['status'];
};

export type ScannerLiveInferenceState = {
  latestFrameId: string | null;
  latestObservedAt: number | null;
  fingerprint: string | null;
  history: ScannerLiveInferenceSample[];
  stage: ScannerLiveInferenceStage;
  tone: ScannerLiveInferenceTone;
  headline: string;
  subtitle: string | null;
  candidateName: string | null;
  exactPrintingLabel: string | null;
  exactPrintingId: string | null;
  confidenceScore: number;
  consensusCount: number;
};

export function createScannerLiveInferenceState(): ScannerLiveInferenceState {
  return {
    latestFrameId: null,
    latestObservedAt: null,
    fingerprint: null,
    history: [],
    stage: 'looking',
    tone: 'muted',
    headline: 'Looking...',
    subtitle: null,
    candidateName: null,
    exactPrintingLabel: null,
    exactPrintingId: null,
    confidenceScore: 0,
    consensusCount: 0,
  };
}

export function sampleScannerLiveInference(input: {
  frameId: string;
  observedAt: number;
  fingerprint: string | null;
  outcome: RapidLiveOcrOutcome;
  diagnostics: RapidLiveOcrDiagnostics | null;
}): ScannerLiveInferenceSample {
  const fusion = input.diagnostics?.fusion;
  const result = input.outcome.status === 'added' ? input.outcome.result : null;
  return {
    frameId: input.frameId,
    observedAt: input.observedAt,
    fingerprint: input.fingerprint,
    candidateName: result?.cardName ?? input.diagnostics?.localMatchCandidate ?? fusion?.fusedCandidate ?? null,
    exactPrintingId: result?.exactPrintingId ?? fusion?.printingCandidate ?? null,
    exactPrintingLabel: result ? formatPrintingLabel(result.setCode ?? null, result.collectorNumber ?? null) : null,
    confidenceBand: input.diagnostics?.confidenceBand ?? (input.outcome.status === 'added' ? 'high' : null),
    matchScore: input.diagnostics?.matchScore ?? null,
    visualSimilarity: fusion?.visualSimilarity ?? null,
    rawOcrText: input.diagnostics?.rawOcrText ?? null,
    normalizedOcrText: input.diagnostics?.normalizedOcrText ?? null,
    route: input.diagnostics?.route ?? null,
    failureStage: input.diagnostics?.failureStage ?? null,
    outcomeStatus: input.outcome.status,
  };
}

export function updateScannerLiveInference(previous: ScannerLiveInferenceState, sample: ScannerLiveInferenceSample): ScannerLiveInferenceState {
  if (previous.latestObservedAt !== null && sample.observedAt < previous.latestObservedAt) return previous;
  if (previous.latestFrameId === sample.frameId && previous.latestObservedAt !== null && sample.observedAt <= previous.latestObservedAt) return previous;

  const shouldReset = previous.fingerprint !== null
    && sample.fingerprint !== null
    && previous.fingerprint !== sample.fingerprint
    && (previous.latestObservedAt === null || sample.observedAt >= previous.latestObservedAt);

  const history = [...(shouldReset ? [] : previous.history), sample].slice(-6);
  const consensus = consensusCount(history, sample.candidateName);
  const best = chooseBestSample(history);
  const stage = resolveStage({ sample, consensus, best });
  const message = scannerLiveInferenceCopy({
    stage,
    candidateName: best.candidateName ?? sample.candidateName,
    exactPrintingLabel: best.exactPrintingLabel ?? sample.exactPrintingLabel,
    outcomeStatus: sample.outcomeStatus,
    route: sample.route,
  });

  return {
    latestFrameId: sample.frameId,
    latestObservedAt: sample.observedAt,
    fingerprint: sample.fingerprint ?? previous.fingerprint,
    history,
    stage,
    tone: message.tone,
    headline: message.headline,
    subtitle: message.subtitle,
    candidateName: best.candidateName ?? sample.candidateName,
    exactPrintingLabel: best.exactPrintingLabel ?? sample.exactPrintingLabel,
    exactPrintingId: best.exactPrintingId ?? sample.exactPrintingId,
    confidenceScore: confidenceScoreFor(best),
    consensusCount: consensus,
  };
}

export function scannerLiveInferenceCopy(
  state: Pick<ScannerLiveInferenceState, 'stage' | 'candidateName' | 'exactPrintingLabel'> & { outcomeStatus?: RapidLiveOcrOutcome['status']; route?: string | null; },
): { headline: string; subtitle: string | null; tone: ScannerLiveInferenceTone } {
  if (state.stage === 'exact' && state.candidateName) {
    return {
      headline: `\u2713 ${state.candidateName}`,
      subtitle: state.exactPrintingLabel ? `Verified \u2022 ${state.exactPrintingLabel}` : 'Verified exact printing',
      tone: 'success',
    };
  }
  if (state.stage === 'matching_printing' && state.candidateName) {
    return {
      headline: state.candidateName,
      subtitle: state.exactPrintingLabel ? `Matching printing \u2022 ${state.exactPrintingLabel}` : 'Matching printing...',
      tone: 'warning',
    };
  }
  if (state.stage === 'likely' && state.candidateName) {
    return {
      headline: state.candidateName,
      subtitle: state.exactPrintingLabel ? `Matching printing \u2022 ${state.exactPrintingLabel}` : 'Matching printing...',
      tone: 'info',
    };
  }
  if (state.stage === 'possible' && state.candidateName) {
    return {
      headline: `Possible match: ${state.candidateName}`,
      subtitle: 'Keep scanning',
      tone: 'info',
    };
  }
  if (state.stage === 'reading') {
    return {
      headline: 'Reading...',
      subtitle: state.route === 'continue_reading' ? 'Keep scanning' : null,
      tone: 'muted',
    };
  }
  return {
    headline: 'Looking...',
    subtitle: null,
    tone: 'muted',
  };
}

function resolveStage(input: {
  sample: ScannerLiveInferenceSample;
  consensus: number;
  best: ScannerLiveInferenceSample;
}): ScannerLiveInferenceStage {
  const confidenceScore = confidenceScoreFor(input.best);
  const candidateKnown = Boolean(input.best.candidateName);
  const printingKnown = Boolean(input.best.exactPrintingLabel || input.best.exactPrintingId);
  const exactReady = input.sample.outcomeStatus === 'added' && printingKnown;

  if (exactReady) return 'exact';
  if (printingKnown && (input.sample.confidenceBand === 'high' || confidenceScore >= 0.82)) return 'matching_printing';
  if (printingKnown && candidateKnown) return 'matching_printing';
  if (!candidateKnown) return input.sample.rawOcrText || input.sample.normalizedOcrText ? 'reading' : 'looking';
  if (input.consensus >= 3 || confidenceScore >= 0.82 || input.sample.confidenceBand === 'high') return 'likely';
  return 'possible';
}

function chooseBestSample(history: readonly ScannerLiveInferenceSample[]) {
  return [...history].sort((left, right) => {
    const leftScore = confidenceScoreFor(left);
    const rightScore = confidenceScoreFor(right);
    return rightScore - leftScore || right.observedAt - left.observedAt;
  })[0] ?? history.at(0) ?? {
    frameId: '',
    observedAt: 0,
    fingerprint: null,
    candidateName: null,
    exactPrintingId: null,
    exactPrintingLabel: null,
    confidenceBand: null,
    matchScore: null,
    visualSimilarity: null,
    rawOcrText: null,
    normalizedOcrText: null,
    route: null,
    failureStage: null,
    outcomeStatus: 'retry' as const,
  };
}

function consensusCount(history: readonly ScannerLiveInferenceSample[], candidateName: string | null) {
  if (!candidateName) return 0;
  let count = 0;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index]?.candidateName !== candidateName) break;
    count += 1;
  }
  return count;
}

function confidenceScoreFor(sample: ScannerLiveInferenceSample) {
  const candidateScore = sample.matchScore !== null ? sample.matchScore / 100 : 0;
  const visualScore = sample.visualSimilarity ?? 0;
  const namedCandidate = Boolean(sample.candidateName);
  const bandScore = namedCandidate
    ? sample.confidenceBand === 'high' ? 1 : sample.confidenceBand === 'medium' ? 0.68 : sample.confidenceBand === 'low' ? 0.42 : 0
    : sample.confidenceBand === 'high' ? 0.22 : sample.confidenceBand === 'medium' ? 0.14 : sample.confidenceBand === 'low' ? 0.08 : 0;
  const exactScore = sample.exactPrintingId ? 0.16 : 0;
  const namedBonus = namedCandidate ? 0.18 : 0;
  const visualWeight = namedCandidate ? 0.95 : 0.08;
  return Number(Math.min(1, Math.max(candidateScore, visualScore * visualWeight, bandScore + exactScore + namedBonus)).toFixed(3));
}

function formatPrintingLabel(setCode: string | null, collectorNumber: string | null) {
  if (!setCode || !collectorNumber) return null;
  return `${setCode} \u2022 ${collectorNumber}`;
}
