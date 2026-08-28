import { runScannerRecognitionLab, type ScannerRecognitionLabReport } from './scanner-recognition-lab.ts';
import { prepareTcgTrackingScanImage, scanPreparedImageWithTcgTracking, type TcgTrackingMobileScanResult } from './tcgtracking-scan-provider.ts';
import { scanCardSightWithFallback, type CardSightMobileScanResult } from './cardsight-scan-provider.ts';
import type { GuideCropMapping } from './magic-ocr-pipeline.ts';

export type PrebuiltScannerBakeoffVariant = 'raw' | 'cropped';

export type PrebuiltScannerBakeoffResult = {
  mode: PrebuiltScannerBakeoffVariant;
  local: ScannerRecognitionLabReport;
  cardsight: CardSightMobileScanResult;
  tcgtracking: TcgTrackingMobileScanResult;
};

export type PrebuiltScannerBakeoffSummary = {
  provider: 'local' | 'cardsight' | 'tcgtracking';
  winner: PrebuiltScannerBakeoffVariant | null;
  raw: {
    topCandidate: string | null;
    confidence: number | null;
    latencyMs: number | null;
    status: string;
  };
  cropped: {
    topCandidate: string | null;
    confidence: number | null;
    latencyMs: number | null;
    status: string;
  };
};

export type PrebuiltScannerBakeoffReport = {
  raw: PrebuiltScannerBakeoffResult;
  cropped: PrebuiltScannerBakeoffResult;
  summary: {
    local: PrebuiltScannerBakeoffSummary;
    cardsight: PrebuiltScannerBakeoffSummary;
    tcgtracking: PrebuiltScannerBakeoffSummary;
  };
};

export async function runPrebuiltScannerBakeoff(input: {
  rawImageUri: string;
  croppedImageUri?: string | null;
  rawImageSize: { width: number; height: number };
  croppedImageSize?: { width: number; height: number } | null;
  online: boolean;
  getAccessToken?: () => Promise<string | null> | string | null;
  fetcher?: typeof fetch;
}): Promise<PrebuiltScannerBakeoffReport> {
  const croppedImageUri = input.croppedImageUri ?? input.rawImageUri;
  const croppedImageSize = input.croppedImageSize ?? input.rawImageSize;

  const [rawLocal, croppedLocal, rawCardSight, croppedCardSight, rawTcgTracking, croppedTcgTracking] = await Promise.all([
    runScannerRecognitionLab({ imageUri: input.rawImageUri, referenceCandidates: [], includeDebugArtifacts: false }),
    runScannerRecognitionLab({ imageUri: croppedImageUri, referenceCandidates: [], includeDebugArtifacts: false }),
    scanCardSightWithFallback({
      imageUri: input.rawImageUri,
      mapping: fullImageMapping(input.rawImageSize),
      online: input.online,
      getAccessToken: input.getAccessToken,
      fetcher: input.fetcher,
    }),
    scanCardSightWithFallback({
      imageUri: croppedImageUri,
      mapping: fullImageMapping(croppedImageSize),
      online: input.online,
      getAccessToken: input.getAccessToken,
      fetcher: input.fetcher,
    }),
    scanTcgTrackingVariant({ imageUri: input.rawImageUri, online: input.online, fetcher: input.fetcher }),
    scanTcgTrackingVariant({ imageUri: croppedImageUri, online: input.online, fetcher: input.fetcher }),
  ]);

  return {
    raw: { mode: 'raw', local: rawLocal, cardsight: rawCardSight, tcgtracking: rawTcgTracking },
    cropped: { mode: 'cropped', local: croppedLocal, cardsight: croppedCardSight, tcgtracking: croppedTcgTracking },
    summary: {
      local: summarizeProvider('local', rawLocal, croppedLocal),
      cardsight: summarizeProvider('cardsight', rawCardSight, croppedCardSight),
      tcgtracking: summarizeProvider('tcgtracking', rawTcgTracking, croppedTcgTracking),
    },
  };
}

async function scanTcgTrackingVariant(input: {
  imageUri: string;
  online: boolean;
  fetcher?: typeof fetch;
}): Promise<TcgTrackingMobileScanResult> {
  if (!input.online) {
    return { ok: false, provider: 'tcgtracking', reason: 'Network access is disabled.', fallbackRecommended: true };
  }
  const prepared = await prepareTcgTrackingScanImage({ imageUri: input.imageUri });
  return scanPreparedImageWithTcgTracking({ preparedImage: prepared, fetcher: input.fetcher });
}

function summarizeProvider(
  provider: 'local' | 'cardsight' | 'tcgtracking',
  raw: ScannerRecognitionLabReport | CardSightMobileScanResult | TcgTrackingMobileScanResult,
  cropped: ScannerRecognitionLabReport | CardSightMobileScanResult | TcgTrackingMobileScanResult,
): PrebuiltScannerBakeoffSummary {
  const rawSummary = summarizeVariant(raw);
  const croppedSummary = summarizeVariant(cropped);
  return {
    provider,
    winner: chooseWinner(rawSummary, croppedSummary),
    raw: rawSummary,
    cropped: croppedSummary,
  };
}

function summarizeVariant(
  result: ScannerRecognitionLabReport | CardSightMobileScanResult | TcgTrackingMobileScanResult,
) {
  if ('engines' in result) {
    const top = result.engines.ocr_accurate.top1 ?? result.engines.apple_vision_feature_print.top1 ?? result.engines.phash_luma_8x8.top1 ?? null;
    return {
      topCandidate: top?.name ?? null,
      confidence: top?.score ?? null,
      latencyMs: result.summary.medianLatencyMs ?? result.engines.ocr_accurate.durationMs ?? null,
      status: result.summary.accuracyPct !== null ? 'completed' : 'partial',
    };
  }
  if (result.ok) {
    return {
      topCandidate: result.candidates[0]?.name ?? null,
      confidence: result.topConfidence ?? result.candidates[0]?.confidence ?? null,
      latencyMs: result.latencyMs ?? null,
      status: 'completed',
    };
  }
  return {
    topCandidate: null,
    confidence: null,
    latencyMs: result.latencyMs ?? null,
    status: result.reason,
  };
}

function chooseWinner(raw: { confidence: number | null; latencyMs: number | null }, cropped: { confidence: number | null; latencyMs: number | null }) {
  if (raw.confidence === null && cropped.confidence === null) return null;
  if (raw.confidence === null) return 'cropped';
  if (cropped.confidence === null) return 'raw';
  if (cropped.confidence > raw.confidence + 0.02) return 'cropped';
  if (raw.confidence > cropped.confidence + 0.02) return 'raw';
  return (cropped.latencyMs ?? Number.POSITIVE_INFINITY) < (raw.latencyMs ?? Number.POSITIVE_INFINITY) ? 'cropped' : 'raw';
}

function fullImageMapping(size: { width: number; height: number }) {
  return {
    cardCropPixels: { x: 0, y: 0, width: Math.max(1, Math.round(size.width)), height: Math.max(1, Math.round(size.height)) },
  } as GuideCropMapping;
}
