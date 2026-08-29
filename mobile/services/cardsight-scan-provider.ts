import { MOBILE_CANONICAL_SITE_URL } from './mobile-release-config.ts';
import { createAbortableFetchSignal } from './abortable-fetch.ts';
import { logScannerAuthTrace, resolveScannerAccessToken } from './scanner-auth.ts';
import { normalizeScannerCandidate, type ScannerCardCandidate } from './scanner-foundation.ts';
import type { GuideCropMapping, PixelRect } from './magic-ocr-pipeline.ts';

export const CARDSIGHT_SCAN_TIMEOUT_MS = 6500;
export const CARDSIGHT_RAW_TARGET_LONG_EDGE = 1440;
export const CARDSIGHT_CROPPED_TARGET_LONG_EDGE = 960;
export const EXPO_PUBLIC_CARDSIGHT_FLAG = 'EXPO_PUBLIC_SCANNER_PROVIDER_CARDSIGHT_ENABLED';

export type CardSightScanMode = 'raw' | 'cropped';

export type CardSightPreparedImage = {
  image: string;
  width: number;
  height: number;
  bytes: number;
  mimeType: 'image/jpeg';
};

export type CardSightAttemptTrace = {
  mode: CardSightScanMode;
  authenticated: boolean;
  requestStarted: boolean;
  imageSource: CardSightScanMode;
  imageWidth: number | null;
  imageHeight: number | null;
  imageBytes: number | null;
  mimeType: 'image/jpeg';
  httpStatus: number | null;
  status: 'candidates' | 'unavailable' | 'timeout' | 'aborted' | 'provider_failed' | 'malformed_response';
  latencyMs: number | null;
  confidenceBand: 'high' | 'medium' | 'low' | null;
  candidateCount: number;
  selectedPrintingId: string | null;
  fallbackRecommended: boolean;
  parsingSucceeded: boolean;
  topCandidateName: string | null;
  topCandidateSet: string | null;
  topCandidateCollectorNumber: string | null;
  topCandidateConfidence: number | null;
  rawProviderConfidence: number | null;
  error?: string;
};

export type CardSightMobileScanResult =
  | {
    ok: true;
    provider: 'cardsight';
    status: 'candidates';
    mode: CardSightScanMode;
    candidates: ScannerCardCandidate[];
    latencyMs: number | null;
    topConfidence: number | null;
    confidenceBand: 'high' | 'medium' | 'low';
    fallbackRecommended: boolean;
    image: { width: number; height: number; bytes: number; retained: false };
    traces: CardSightAttemptTrace[];
  }
  | {
    ok: false;
    provider: 'cardsight';
    reason: string;
    fallbackRecommended: true;
    latencyMs?: number | null;
    mode: CardSightScanMode;
    traces: CardSightAttemptTrace[];
  };

export function isCardSightScannerEnabled(env: Record<string, string | undefined> = process.env) {
  return env[EXPO_PUBLIC_CARDSIGHT_FLAG] === 'true';
}

export async function prepareCardSightScanImage(input: {
  imageUri: string;
  cropPixels?: PixelRect | null;
  mode: CardSightScanMode;
  targetLongEdge?: number;
}): Promise<CardSightPreparedImage> {
  const targetLongEdge = input.targetLongEdge ?? (input.mode === 'raw' ? CARDSIGHT_RAW_TARGET_LONG_EDGE : CARDSIGHT_CROPPED_TARGET_LONG_EDGE);
  const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
  const actions: any[] = [];
  if (input.mode === 'cropped' && input.cropPixels && input.cropPixels.width > 0 && input.cropPixels.height > 0) {
    actions.push({
      crop: {
        originX: Math.max(0, Math.round(input.cropPixels.x)),
        originY: Math.max(0, Math.round(input.cropPixels.y)),
        width: Math.max(1, Math.round(input.cropPixels.width)),
        height: Math.max(1, Math.round(input.cropPixels.height)),
      },
    });
  }
  actions.push({ resize: { width: targetLongEdge } });
  const result = await manipulateAsync(input.imageUri, actions, {
    compress: input.mode === 'raw' ? 0.78 : 0.72,
    format: SaveFormat.JPEG,
    base64: true,
  });
  const image = result.base64 ?? '';
  return {
    image,
    width: result.width,
    height: result.height,
    bytes: decodedBase64Bytes(image),
    mimeType: 'image/jpeg',
  };
}

type ImageManipulationAction = {
  crop?: {
    originX: number;
    originY: number;
    width: number;
    height: number;
  };
  resize?: {
    width?: number;
    height?: number;
  };
};

export async function scanCardSightWithFallback(input: {
  imageUri: string;
  mapping: GuideCropMapping;
  online: boolean;
  allowUnconfirmedCandidate?: boolean;
  getAccessToken?: () => Promise<string | null> | string | null;
  fetcher?: typeof fetch;
  prepareCardSightScanImage?: typeof prepareCardSightScanImage;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<CardSightMobileScanResult> {
  if (!input.online) {
    return failure('CardSight requires network access.', 'raw', 'unavailable');
  }
  const auth = await resolveScannerAccessToken({ getAccessToken: input.getAccessToken });
  if (!auth.accessToken) {
    logCardSightRequest({
      authenticated: false,
      requestStarted: false,
      imageSource: 'raw',
      preparedImage: { width: null, height: null, bytes: null, mimeType: 'image/jpeg' },
      httpStatus: null,
      latencyMs: null,
    });
    return failure('Sign in again to use CardSight fallback.', 'raw', 'unavailable');
  }
  logScannerAuthTrace({
    sessionPresent: auth.sessionPresent,
    accessTokenPresent: auth.accessTokenPresent,
    authorizationHeaderAttached: true,
    backendAuthorizationHeaderPresent: null,
    authenticatedUserResolved: null,
    capabilityResolved: null,
  });

  const traces: CardSightAttemptTrace[] = [];
  const prepareImage = input.prepareCardSightScanImage ?? prepareCardSightScanImage;
  const rawPrepared = await prepareImage({ imageUri: input.imageUri, mode: 'raw' });
  const rawResult = await requestCardSightScan({
    fetcher: input.fetcher,
    accessToken: auth.accessToken,
    authenticated: true,
    image: rawPrepared.image,
    preparedImage: rawPrepared,
    mode: 'raw',
    signal: input.signal,
    timeoutMs: input.timeoutMs,
    authResolution: auth,
    getAccessToken: input.getAccessToken,
  });
  traces.push(rawResult.trace);
  if (canAcceptCardSightResult(rawResult, Boolean(input.allowUnconfirmedCandidate))) {
    return buildSuccess(rawResult, 'raw', rawPrepared, traces);
  }

  const croppedPrepared = await prepareImage({
    imageUri: input.imageUri,
    cropPixels: input.mapping.cardCropPixels,
    mode: 'cropped',
  });
  const croppedResult = await requestCardSightScan({
    fetcher: input.fetcher,
    accessToken: auth.accessToken,
    authenticated: true,
    image: croppedPrepared.image,
    preparedImage: croppedPrepared,
    mode: 'cropped',
    signal: input.signal,
    timeoutMs: input.timeoutMs,
    authResolution: auth,
    getAccessToken: input.getAccessToken,
  });
  traces.push(croppedResult.trace);
  if (canAcceptCardSightResult(croppedResult, Boolean(input.allowUnconfirmedCandidate))) {
    return buildSuccess(croppedResult, 'cropped', croppedPrepared, traces);
  }

  const winner = chooseBetterAttempt(rawResult, croppedResult);
  return {
    ok: false,
    provider: 'cardsight',
    reason: winner.trace.error ?? 'CardSight did not resolve a confident card identity.',
    fallbackRecommended: true,
    latencyMs: winner.trace.latencyMs,
    mode: winner.mode,
    traces,
  };
}

export async function scanCardSightImageOnce(input: {
  imageUri: string;
  mapping: GuideCropMapping;
  mode: CardSightScanMode;
  online: boolean;
  allowUnconfirmedCandidate?: boolean;
  getAccessToken?: () => Promise<string | null> | string | null;
  fetcher?: typeof fetch;
  prepareCardSightScanImage?: typeof prepareCardSightScanImage;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<CardSightMobileScanResult> {
  if (!input.online) {
    return failure('CardSight requires network access.', input.mode, 'unavailable');
  }
  const auth = await resolveScannerAccessToken({ getAccessToken: input.getAccessToken });
  if (!auth.accessToken) {
    logCardSightRequest({
      authenticated: false,
      requestStarted: false,
      imageSource: input.mode,
      preparedImage: { width: null, height: null, bytes: null, mimeType: 'image/jpeg' },
      httpStatus: null,
      latencyMs: null,
    });
    return failure('Sign in again to use CardSight fallback.', input.mode, 'unavailable');
  }
  logScannerAuthTrace({
    sessionPresent: auth.sessionPresent,
    accessTokenPresent: auth.accessTokenPresent,
    authorizationHeaderAttached: true,
    backendAuthorizationHeaderPresent: null,
    authenticatedUserResolved: null,
    capabilityResolved: null,
  });
  const prepareImage = input.prepareCardSightScanImage ?? prepareCardSightScanImage;
  const preparedImage = await prepareImage({
    imageUri: input.imageUri,
    cropPixels: input.mode === 'cropped' ? input.mapping.cardCropPixels : null,
    mode: input.mode,
  });
  const attempt = await requestCardSightScan({
    fetcher: input.fetcher,
    accessToken: auth.accessToken,
    authenticated: true,
    image: preparedImage.image,
    preparedImage,
    mode: input.mode,
    signal: input.signal,
    timeoutMs: input.timeoutMs,
    authResolution: auth,
    getAccessToken: input.getAccessToken,
  });
  if (canAcceptCardSightResult(attempt, Boolean(input.allowUnconfirmedCandidate))) {
    return buildSuccess(attempt, input.mode, preparedImage, [attempt.trace]);
  }
  return {
    ok: false,
    provider: 'cardsight',
    reason: attempt.trace.error ?? 'CardSight did not resolve a confident card identity.',
    fallbackRecommended: true,
    latencyMs: attempt.trace.latencyMs,
    mode: input.mode,
    traces: [attempt.trace],
  };
}

type CardSightAttempt = {
  mode: CardSightScanMode;
  trace: CardSightAttemptTrace;
  preparedImage: CardSightPreparedImage;
  candidates: ScannerCardCandidate[];
  confidenceBand: 'high' | 'medium' | 'low';
  fallbackRecommended: boolean;
  selectedPrintingId: string | null;
  topConfidence: number | null;
  selectedCandidate: ScannerCardCandidate | null;
};

type CardSightRouteCandidate = {
  canonicalCardId?: string | null;
  printingId?: string | null;
  game?: 'magic' | 'pokemon' | 'unknown';
  name?: string | null;
  setName?: string | null;
  setCode?: string | null;
  collectorNumber?: string | null;
  language?: string | null;
  finishes?: string[];
  rarity?: string | null;
  imageUrl?: string | null;
  providerIds?: Record<string, string | number>;
  provenance?: string[];
  identityAuthority?: 'provider_confirmed' | 'synthetic_fallback';
  prices?: Array<{ currency?: string; market?: number | null; low?: number | null; high?: number | null; source?: string; updatedAt?: string | null }>;
  confidence?: number | null;
  score?: number;
  confidenceTier?: 'high' | 'medium' | 'low';
  requiresConfirmation?: boolean;
  matchedSignals?: string[];
  conflictingSignals?: string[];
  reason?: string;
};

async function requestCardSightScan(input: {
  fetcher?: typeof fetch;
  accessToken: string;
  authenticated: boolean;
  image: string;
  preparedImage: CardSightPreparedImage;
  mode: CardSightScanMode;
  signal?: AbortSignal;
  timeoutMs?: number;
  authResolution: { sessionPresent: boolean; accessTokenPresent: boolean; refreshAttempted: boolean; refreshSucceeded: boolean };
  getAccessToken?: () => Promise<string | null> | string | null;
}): Promise<CardSightAttempt> {
  const startedAt = Date.now();
  const managedSignal = createAbortableFetchSignal({
    callerSignal: input.signal,
    timeoutMs: input.timeoutMs ?? CARDSIGHT_SCAN_TIMEOUT_MS,
  });
  try {
    logCardSightRequest({
      authenticated: input.authenticated,
      requestStarted: true,
      imageSource: input.mode,
      preparedImage: input.preparedImage,
      httpStatus: null,
      latencyMs: null,
    });
    const requestBody = {
      image: input.image,
      game: 'magic',
      limit: 5,
      mode: input.mode,
    };
    let response = await (input.fetcher ?? fetch)(`${MOBILE_CANONICAL_SITE_URL}/api/scanner/cardsight`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${input.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: managedSignal.signal,
    });
    if (response.status === 401 && input.authResolution.accessTokenPresent && !input.authResolution.refreshAttempted && !input.getAccessToken) {
      const refreshed = await resolveScannerAccessToken({ getAccessToken: input.getAccessToken, forceRefresh: true });
      if (refreshed.accessToken && refreshed.accessToken !== input.accessToken) {
        logScannerAuthTrace({
          sessionPresent: refreshed.sessionPresent,
          accessTokenPresent: refreshed.accessTokenPresent,
          authorizationHeaderAttached: true,
          backendAuthorizationHeaderPresent: null,
          authenticatedUserResolved: null,
          capabilityResolved: null,
        });
        response = await (input.fetcher ?? fetch)(`${MOBILE_CANONICAL_SITE_URL}/api/scanner/cardsight`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${refreshed.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: managedSignal.signal,
        });
      }
    }
    const payload = await response.json().catch(() => ({})) as {
      status?: string;
      candidates?: CardSightRouteCandidate[];
      topCandidate?: CardSightRouteCandidate | null;
      intelligence?: {
        selectedPrintingId?: string | null;
        requiresConfirmation?: boolean;
        candidates?: CardSightRouteCandidate[];
      } | null;
      latencyMs?: number | null;
      fallbackRecommended?: boolean;
      error?: string;
      auth?: {
        sessionPresent?: boolean;
        accessTokenPresent?: boolean;
        authorizationHeaderAttached?: boolean;
        backendAuthorizationHeaderPresent?: boolean;
        authenticatedUserResolved?: boolean;
        capabilityResolved?: boolean;
      };
    };
    if (payload.auth) {
      logScannerAuthTrace({
        sessionPresent: payload.auth.sessionPresent ?? input.authResolution.sessionPresent,
        accessTokenPresent: payload.auth.accessTokenPresent ?? input.authResolution.accessTokenPresent,
        authorizationHeaderAttached: payload.auth.authorizationHeaderAttached ?? true,
        backendAuthorizationHeaderPresent: payload.auth.backendAuthorizationHeaderPresent ?? null,
        authenticatedUserResolved: payload.auth.authenticatedUserResolved ?? null,
        capabilityResolved: payload.auth.capabilityResolved ?? null,
      });
    }
    const normalizedCandidates = (payload.intelligence?.candidates ?? payload.candidates ?? [])
      .map((candidate: CardSightRouteCandidate) => normalizeScannerCandidate({
        id: candidate.printingId ?? candidate.canonicalCardId ?? candidate.name,
        gameId: candidate.game ?? 'magic',
        providerSource: candidate.provenance?.length === 1 && ['scryfall', 'tcgplayer', 'tcgtracking'].includes(candidate.provenance[0]) ? candidate.provenance[0] : candidate.provenance?.length ? 'multiple' : null,
        providerSources: candidate.provenance ?? [],
        providerIds: candidate.providerIds,
        identityAuthority: candidate.identityAuthority ?? null,
        oracleId: candidate.canonicalCardId,
        name: candidate.name,
        setCode: candidate.setCode,
        setName: candidate.setName,
        collectorNumber: candidate.collectorNumber,
        finishes: candidate.finishes,
        language: candidate.language,
        imageUrl: candidate.imageUrl,
        confidence: candidate.score ?? candidate.confidence ?? (candidate.confidenceTier === 'high' ? 0.95 : candidate.confidenceTier === 'medium' ? 0.7 : 0.45),
        recognitionMode: 'assisted_capture',
        marketPrice: normalizeMarketPrice(candidate.prices ?? []),
        scryfallMetadata: null,
      }))
      .filter((candidate): candidate is ScannerCardCandidate => Boolean(candidate));
    const topCandidate = normalizedCandidates[0] ?? null;
    const trace: CardSightAttemptTrace = {
      mode: input.mode,
      authenticated: input.authenticated,
      requestStarted: true,
      imageSource: input.mode,
      imageWidth: input.preparedImage.width,
      imageHeight: input.preparedImage.height,
      imageBytes: input.preparedImage.bytes,
      mimeType: input.preparedImage.mimeType,
      httpStatus: response.status,
      status: response.ok ? (normalizedCandidates.length ? 'candidates' : 'malformed_response') : 'provider_failed',
      latencyMs: payload.latencyMs ?? Date.now() - startedAt,
      confidenceBand: confidenceBandFromCandidate(topCandidate),
      candidateCount: normalizedCandidates.length,
      selectedPrintingId: payload.intelligence?.selectedPrintingId ?? topCandidate?.id ?? null,
      fallbackRecommended: payload.fallbackRecommended ?? Boolean(payload.intelligence?.requiresConfirmation ?? !payload.intelligence?.selectedPrintingId),
      parsingSucceeded: response.ok && normalizedCandidates.length > 0,
      topCandidateName: topCandidate?.name ?? null,
      topCandidateSet: topCandidate?.setCode ?? null,
      topCandidateCollectorNumber: topCandidate?.collectorNumber ?? null,
      topCandidateConfidence: topCandidate?.confidence ?? null,
      rawProviderConfidence: normalizeConfidence(payload.topCandidate?.confidence ?? payload.topCandidate?.score ?? null),
      error: payload.error ?? (!response.ok ? `CardSight returned HTTP ${response.status}.` : undefined),
    };
    logCardSightResult(trace);
    if (!response.ok || trace.status !== 'candidates') {
      return {
        mode: input.mode,
        trace,
        preparedImage: input.preparedImage,
        candidates: normalizedCandidates,
        confidenceBand: trace.confidenceBand ?? 'low',
        fallbackRecommended: true,
        selectedPrintingId: trace.selectedPrintingId,
        topConfidence: topCandidate?.confidence ?? null,
        selectedCandidate: topCandidate,
      };
    }
    return {
      mode: input.mode,
      trace,
      preparedImage: input.preparedImage,
      candidates: normalizedCandidates,
      confidenceBand: trace.confidenceBand ?? 'low',
      fallbackRecommended: trace.fallbackRecommended,
      selectedPrintingId: trace.selectedPrintingId,
      topConfidence: topCandidate?.confidence ?? null,
      selectedCandidate: topCandidate,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'CardSight request failed.';
    const timeout = managedSignal.timedOut();
    const aborted = !timeout && managedSignal.callerAborted();
    const trace: CardSightAttemptTrace = {
      mode: input.mode,
      authenticated: input.authenticated,
      requestStarted: true,
      imageSource: input.mode,
      imageWidth: input.preparedImage.width,
      imageHeight: input.preparedImage.height,
      imageBytes: input.preparedImage.bytes,
      mimeType: input.preparedImage.mimeType,
      httpStatus: null,
      status: timeout ? 'timeout' : aborted ? 'aborted' : 'provider_failed',
      latencyMs: Date.now() - startedAt,
      confidenceBand: null,
      candidateCount: 0,
      selectedPrintingId: null,
      fallbackRecommended: true,
      parsingSucceeded: false,
      topCandidateName: null,
      topCandidateSet: null,
      topCandidateCollectorNumber: null,
      topCandidateConfidence: null,
      rawProviderConfidence: null,
      error: timeout ? 'Card recognition timed out.' : aborted ? 'Card recognition was cancelled.' : reason,
    };
    logCardSightResult(trace);
    return {
      mode: input.mode,
      trace,
      preparedImage: input.preparedImage,
      candidates: [],
      confidenceBand: 'low',
      fallbackRecommended: true,
      selectedPrintingId: null,
      topConfidence: null,
      selectedCandidate: null,
    };
  } finally {
    managedSignal.cleanup();
  }
}

function logCardSightRequest(input: {
  authenticated: boolean;
  requestStarted: boolean;
  imageSource: CardSightScanMode;
  preparedImage: { width: number | null; height: number | null; bytes: number | null; mimeType: 'image/jpeg' };
  httpStatus: number | null;
  latencyMs: number | null;
}) {
  if (!(typeof __DEV__ !== 'undefined' && __DEV__)) return;
  console.info('TD_CARDSIGHT_REQUEST', {
    authenticated: input.authenticated,
    imageSource: input.imageSource,
    width: input.preparedImage.width,
    height: input.preparedImage.height,
    bytes: input.preparedImage.bytes,
    mimeType: input.preparedImage.mimeType,
    requestStarted: input.requestStarted,
    httpStatus: input.httpStatus,
    latencyMs: input.latencyMs,
  });
}

function logCardSightResult(input: CardSightAttemptTrace) {
  if (!(typeof __DEV__ !== 'undefined' && __DEV__)) return;
  console.info('TD_CARDSIGHT_RESULT', {
    httpStatus: input.httpStatus,
    latencyMs: input.latencyMs,
    candidateCount: input.candidateCount,
    topCandidateName: input.topCandidateName,
    topCandidateSet: input.topCandidateSet,
    topCandidateCollectorNumber: input.topCandidateCollectorNumber,
    topCandidateConfidence: input.topCandidateConfidence,
    rawProviderConfidence: input.rawProviderConfidence,
    parsingSucceeded: input.parsingSucceeded,
  });
}

function buildSuccess(attempt: CardSightAttempt, mode: CardSightScanMode, preparedImage: CardSightPreparedImage, traces: CardSightAttemptTrace[]): CardSightMobileScanResult {
  return {
    ok: true,
    provider: 'cardsight',
    status: 'candidates',
    mode,
    candidates: attempt.candidates,
    latencyMs: attempt.trace.latencyMs,
    topConfidence: attempt.topConfidence,
    confidenceBand: attempt.confidenceBand,
    fallbackRecommended: attempt.fallbackRecommended,
    image: {
      width: preparedImage.width,
      height: preparedImage.height,
      bytes: preparedImage.bytes,
      retained: false,
    },
    traces,
  };
}

function chooseBetterAttempt(raw: CardSightAttempt, cropped: CardSightAttempt) {
  if (raw.trace.status === 'candidates' && cropped.trace.status !== 'candidates') return raw;
  if (cropped.trace.status === 'candidates' && raw.trace.status !== 'candidates') return cropped;
  const rawScore = attemptScore(raw);
  const croppedScore = attemptScore(cropped);
  return rawScore >= croppedScore ? raw : cropped;
}

function attemptScore(attempt: CardSightAttempt) {
  const confidence = attempt.topConfidence ?? 0;
  const selected = attempt.selectedPrintingId ? 0.5 : 0;
  const band = attempt.confidenceBand === 'high' ? 0.25 : attempt.confidenceBand === 'medium' ? 0.15 : 0;
  return confidence + selected + band;
}

function isStrongCardSightResult(attempt: CardSightAttempt) {
  return attempt.trace.status === 'candidates'
    && Boolean(attempt.selectedPrintingId)
    && attempt.fallbackRecommended === false
    && attempt.confidenceBand === 'high';
}

function canAcceptCardSightResult(attempt: CardSightAttempt, allowUnconfirmedCandidate: boolean) {
  if (isStrongCardSightResult(attempt)) return true;
  return allowUnconfirmedCandidate
    && attempt.trace.status === 'candidates'
    && attempt.candidates.length > 0;
}

function confidenceBandFromCandidate(candidate: ScannerCardCandidate | null): 'high' | 'medium' | 'low' {
  const score = candidate?.confidence ?? 0;
  if (score >= 0.92) return 'high';
  if (score >= 0.72) return 'medium';
  return 'low';
}

function normalizeConfidence(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeMarketPrice(prices: Array<{ currency?: string; market?: number | null; low?: number | null; high?: number | null; source?: string; updatedAt?: string | null }>) {
  const nonfoil = prices.find((price) => price.source?.includes('nonfoil') || price.source?.includes('normal')) ?? null;
  const foil = prices.find((price) => price.source?.includes('foil')) ?? null;
  const etched = prices.find((price) => price.source?.includes('etched')) ?? null;
  return nonfoil || foil || etched ? {
    usd: toPrice(nonfoil?.market ?? nonfoil?.low ?? nonfoil?.high ?? null),
    usdFoil: toPrice(foil?.market ?? foil?.low ?? foil?.high ?? null),
    usdEtched: toPrice(etched?.market ?? etched?.low ?? etched?.high ?? null),
    source: 'scryfall' as const,
    fetchedAt: nonfoil?.updatedAt ?? foil?.updatedAt ?? etched?.updatedAt ?? null,
  } : null;
}

function toPrice(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
}

function failure(reason: string, mode: CardSightScanMode, status: 'unavailable' | 'timeout' | 'provider_failed' | 'malformed_response'): CardSightMobileScanResult {
  return {
    ok: false,
    provider: 'cardsight',
    reason,
    fallbackRecommended: true,
    mode,
    traces: [{
      mode,
      status,
      authenticated: false,
      requestStarted: false,
      imageSource: mode,
      imageWidth: null,
      imageHeight: null,
      imageBytes: null,
      mimeType: 'image/jpeg',
      httpStatus: null,
      latencyMs: null,
      confidenceBand: null,
      candidateCount: 0,
      selectedPrintingId: null,
      fallbackRecommended: true,
      parsingSucceeded: false,
      topCandidateName: null,
      topCandidateSet: null,
      topCandidateCollectorNumber: null,
      topCandidateConfidence: null,
      rawProviderConfidence: null,
      error: reason,
    }],
  };
}

function decodedBase64Bytes(image: string) {
  const clean = image.includes(',') ? image.split(',').pop() ?? '' : image;
  const normalized = clean.replace(/\s+/g, '');
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
}
