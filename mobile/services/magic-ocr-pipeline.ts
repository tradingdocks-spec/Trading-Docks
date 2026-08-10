import { detectCardRectangle, recognizeText, type NativeCardRectangleResult, type NativeOcrObservation, type NativeOcrRegion, type NativeOcrResult } from '../modules/trading-docks-vision-ocr/index.ts';
import {
  classifyMagicRecognition,
  MagicCatalogLookupError,
  recognizeMagicCard,
  searchScryfallMagicCatalog,
  searchScryfallMagicCatalogFuzzy,
  type MagicCatalogDiagnosticsSink,
  type MagicCatalogLookupDiagnostics,
  type MagicCatalogSearch,
  type MagicRecognitionResult,
} from './magic-recognition-provider.ts';
import type { ScannerGuideLayout } from './continuous-offer-scanner.ts';
import { normalizeScannerCandidate, type ScannerCardCandidate } from './scanner-foundation.ts';
import { parseCollectorInfoText, type CollectorInfoObservation, type RecognitionCandidate } from './scanner-intelligence.ts';
import { createCachedMagicCatalogSearch } from './scanner-cache-prewarming.ts';
import {
  matchMagicCardName,
  prewarmMagicNameIndex,
  type MagicNameMatch,
} from './magic-card-identity.ts';
import type { ScannerVisionResult } from './scanner-vision-engine.ts';
import type { MultiSignalRecognitionResult, VisualReferenceIndex } from './scanner-multi-signal-recognition.ts';
import {
  recognizeScannerFrameWithFusion,
  scannerCandidateFromVisualRecord,
} from './scanner-multi-signal-recognition.ts';

export type CaptureDimensions = { width: number; height: number };
export type CropRect = { x: number; y: number; width: number; height: number };
export type PixelRect = { x: number; y: number; width: number; height: number };
export type MagicTitleOcrAttemptId = 'title_primary' | 'title_expanded' | 'upper_card' | 'full_card' | 'collector_info';

export type GuideCropMappingInput = {
  preview: CaptureDimensions;
  image: CaptureDimensions;
  guide: Pick<ScannerGuideLayout, 'left' | 'top' | 'width' | 'height'>;
  orientation?: 'portrait' | 'landscape';
};

export type GuideCropMapping = {
  cardCrop: CropRect;
  cardCropPixels: PixelRect;
  titleCrop: CropRect;
  titleCropPixels: PixelRect;
  collectorCrop: CropRect;
  collectorCropPixels: PixelRect;
  bottomLeftPrintingCrop: CropRect;
  bottomLeftPrintingCropPixels: PixelRect;
  rawImage: CaptureDimensions & { orientation: 'portrait' | 'landscape' };
  normalizedImage: CaptureDimensions & { orientation: 'portrait' | 'landscape'; rotatedFromRaw: boolean };
  previewContentFit: 'cover';
  displayedImage: { width: number; height: number; offsetX: number; offsetY: number };
  imageScale: number;
  imageOffset: { x: number; y: number };
  regions: NativeOcrRegion[];
  warnings: string[];
  rectangleDetection: NativeCardRectangleResult | null;
  normalizationSource: 'apple_vision_rectangle' | 'guide';
};

export type MagicTitleOcrAttempt = {
  id: MagicTitleOcrAttemptId;
  rawText: string;
  normalizedText: string | null;
  confidence: number;
  score: number;
  bounds: CropRect;
  reason: 'selected' | 'usable_candidate' | 'rejected_noise';
  latencyMs: number | null;
  rejectionReason: string | null;
};

export type MagicOcrSignals = {
  rawTitle: string | null;
  normalizedTitle: string | null;
  titleAlternatives: string[];
  titleAttempts: MagicTitleOcrAttempt[];
  selectedTitleAttemptId: MagicTitleOcrAttemptId | null;
  rawCollectorText: string | null;
  rawBottomLeftPrintingText: string | null;
  collectorInfo: CollectorInfoObservation | null;
  observations: NativeOcrObservation[];
  ocrConfidence: number | null;
};

export type MagicStillScanCropDiagnostics = {
  preview: CaptureDimensions;
  rawImage: GuideCropMapping['rawImage'];
  normalizedImage: GuideCropMapping['normalizedImage'];
  previewContentFit: GuideCropMapping['previewContentFit'];
  displayedImage: GuideCropMapping['displayedImage'];
  guide: GuideCropMappingInput['guide'];
  cardCrop: CropRect;
  cardCropPixels: PixelRect;
  titleCrops: Record<MagicTitleOcrAttemptId, CropRect>;
  titleCrop: CropRect;
  titleCropPixels: PixelRect;
  collectorCrop: CropRect;
  collectorCropPixels: PixelRect;
  bottomLeftPrintingCrop: CropRect;
  bottomLeftPrintingCropPixels: PixelRect;
  selectedTitleAttemptId: MagicTitleOcrAttemptId | null;
  titleAttempts: MagicTitleOcrAttempt[];
  warnings: string[];
};

export type MagicStillScanLookupDiagnostics = {
  outcome: 'success' | 'no_title' | 'no_match' | 'network_unavailable' | 'service_error' | 'invalid_response' | 'cancelled';
  rawOcrTitle: string | null;
  normalizedOcrTitle: string | null;
  titleAlternatives: string[];
  scryfallQueryString: string | null;
  httpStatus: number | null;
  responseItemCount: number | null;
  lookupErrorCode: MagicCatalogLookupDiagnostics['errorCode'];
  lookupLatencyMs: number;
  topThreeCandidateNames: string[];
};

export type MagicStillScanResult =
  | {
    ok: true;
    ocr: NativeOcrResult & { ok: true };
    signals: MagicOcrSignals;
    recognition: MagicRecognitionResult & { ok: true };
    candidates: ScannerCardCandidate[];
    selected: ScannerCardCandidate | null;
    confidenceLabel: 'recognized' | 'likely' | 'ambiguous' | 'manual_review_required';
    mapping: GuideCropMapping;
    cropDiagnostics: MagicStillScanCropDiagnostics;
    lookupLatencyMs: number;
    lookupDiagnostics: MagicStillScanLookupDiagnostics;
    multiSignal: ReturnType<typeof recognizeScannerFrameWithFusion> | null;
    cleanup: CaptureCleanupResult;
  }
  | {
    ok: false;
    reason: string;
    code: 'ocr_failed' | 'candidate_lookup_failed' | 'cleanup_failed';
    ocr?: NativeOcrResult;
    mapping?: GuideCropMapping;
    cropDiagnostics?: MagicStillScanCropDiagnostics;
    signals?: MagicOcrSignals;
    lookupDiagnostics?: MagicStillScanLookupDiagnostics;
    multiSignal?: ReturnType<typeof recognizeScannerFrameWithFusion> | null;
    cleanup?: CaptureCleanupResult;
  };

export type CaptureCleanupResult =
  | { ok: true; deleted: true }
  | { ok: true; deleted: false; reason: 'no_uri' | 'non_file_uri' | 'deferred_for_diagnostics' }
  | { ok: false; deleted: false; reason: string };

const cachedScryfallMagicCatalogSearch = createCachedMagicCatalogSearch({
  search: searchScryfallMagicCatalog,
  maxEntries: 80,
  ttlMs: 5 * 60 * 1000,
});

export async function recognizeMagicStillCapture(input: {
  imageUri: string;
  preview: CaptureDimensions;
  image: CaptureDimensions;
  guide: GuideCropMappingInput['guide'];
  online: boolean;
  cachedCandidates?: RecognitionCandidate[];
  recognize?: typeof recognizeText;
  searchCatalog?: MagicCatalogSearch;
  cleanup?: typeof deleteCapturedStill;
  deferCleanup?: boolean;
  sequentialTitleOcr?: boolean;
  includeCollectorOcr?: boolean;
  vision?: ScannerVisionResult | null;
  visualIndex?: VisualReferenceIndex | null;
  detectRectangle?: typeof detectCardRectangle;
  onStage?: (stage: 'reading_title' | 'finding_card') => void;
  onLookupDiagnostics?: (diagnostics: MagicStillScanLookupDiagnostics) => void;
}): Promise<MagicStillScanResult> {
  const guideMapping = buildGuideAssistedCropMapping({
    preview: input.preview,
    image: input.image,
    guide: input.guide,
  });
  const rectangleDetection = await (input.detectRectangle ?? detectCardRectangle)({ imageUri: input.imageUri });
  const mapping = buildRectangleAssistedCropMapping(guideMapping, rectangleDetection);
  const cleanup = input.cleanup ?? deleteCapturedStill;
  const cleanupCapture = () => input.deferCleanup
    ? Promise.resolve<CaptureCleanupResult>({ ok: true, deleted: false, reason: 'deferred_for_diagnostics' })
    : cleanup(input.imageUri);
  input.onStage?.('reading_title');
  const ocr = input.sequentialTitleOcr
    ? await recognizeSequentialMagicTitle({
      imageUri: input.imageUri,
      regions: mapping.regions,
      recognize: input.recognize ?? recognizeText,
      includeCollectorOcr: input.includeCollectorOcr ?? false,
    })
    : await (input.recognize ?? recognizeText)({
      imageUri: input.imageUri,
      regions: mapping.regions,
      languages: ['en-US'],
      recognitionLevel: 'accurate',
    });
  if (!ocr.ok) {
    const cleanupResult = await cleanupCapture();
    const cropDiagnostics = createCropDiagnostics(input.preview, input.guide, mapping, [], null);
    const multiSignal = input.vision ? recognizeScannerFrameWithFusion({
      vision: input.vision,
      rawOcrText: null,
      normalizedOcrText: null,
      ocrConfidence: null,
      ocrDurationMs: ocr.latencyMs,
      visualIndex: input.visualIndex,
    }) : null;
    if (multiSignal?.status === 'append_identity' && multiSignal.visual?.record) {
      const candidate = scannerCandidateFromVisualRecord(multiSignal.visual.record, multiSignal.confidence.overall / 100);
      const lookupDiagnostics = createStillLookupDiagnostics(emptySignals(), {
        queryString: null,
        httpStatus: null,
        responseItemCount: 1,
        errorCode: null,
        latencyMs: 0,
        topThreeCandidateNames: [candidate.name],
      });
      return {
        ok: true,
        ocr: { ok: true, provider: 'apple_vision', fullText: '', observations: [], latencyMs: ocr.latencyMs, orientationUsed: 'unavailable', warnings: ['OCR failed; visual fingerprint supplied identity.'] },
        signals: emptySignals(),
        recognition: recognitionFromFusion(multiSignal, [candidate]),
        candidates: [candidate],
        selected: candidate,
        confidenceLabel: confidenceLabel(recognitionFromFusion(multiSignal, [candidate])),
        mapping,
        cropDiagnostics,
        lookupLatencyMs: 0,
        lookupDiagnostics,
        multiSignal,
        cleanup: cleanupResult,
      };
    }
    return { ok: false, code: 'ocr_failed', reason: ocr.message, ocr, mapping, cropDiagnostics, multiSignal, cleanup: cleanupResult };
  }

  const signals = buildMagicOcrSignals(ocr.observations);
  const cropDiagnostics = createCropDiagnostics(input.preview, input.guide, mapping, signals.titleAttempts, signals.selectedTitleAttemptId);
  const baseMultiSignal = input.vision ? recognizeScannerFrameWithFusion({
    vision: input.vision,
    rawOcrText: signals.rawTitle,
    normalizedOcrText: signals.normalizedTitle,
    ocrConfidence: signals.ocrConfidence,
    ocrDurationMs: ocr.latencyMs,
    visualIndex: input.visualIndex,
  }) : null;
  if (!signals.normalizedTitle) {
    const cleanupResult = await cleanupCapture();
    const lookupDiagnostics = createStillLookupDiagnostics(signals, { queryString: null, httpStatus: null, responseItemCount: 0, errorCode: 'no_title_read', latencyMs: 0, topThreeCandidateNames: [] });
    input.onLookupDiagnostics?.(lookupDiagnostics);
    if (baseMultiSignal?.status === 'append_identity' && baseMultiSignal.visual?.record) {
      const candidate = scannerCandidateFromVisualRecord(baseMultiSignal.visual.record, baseMultiSignal.confidence.overall / 100);
      return {
        ok: true,
        ocr,
        signals,
        recognition: recognitionFromFusion(baseMultiSignal, [candidate]),
        candidates: [candidate],
        selected: candidate,
        confidenceLabel: confidenceLabel(recognitionFromFusion(baseMultiSignal, [candidate])),
        mapping,
        cropDiagnostics,
        lookupLatencyMs: 0,
        lookupDiagnostics: { ...lookupDiagnostics, outcome: 'success', responseItemCount: 1, topThreeCandidateNames: [candidate.name] },
        multiSignal: baseMultiSignal,
        cleanup: cleanupResult,
      };
    }
    return { ok: false, code: 'candidate_lookup_failed', reason: 'No title read. Try again or search manually.', ocr, mapping, cropDiagnostics, signals, lookupDiagnostics, multiSignal: baseMultiSignal, cleanup: cleanupResult };
  }

  input.onStage?.('finding_card');
  const started = Date.now();
  let latestLookupDiagnostics: MagicStillScanLookupDiagnostics | null = null;
  const localNameMatch = matchMagicCardName(prewarmMagicNameIndex(), signals.normalizedTitle);
  const localCandidates = localNameMatch.entry ? [localNameMatchToRecognitionCandidate(localNameMatch)] : [];
  const onLookupDiagnostics: MagicCatalogDiagnosticsSink = (diagnostics) => {
    latestLookupDiagnostics = createStillLookupDiagnostics(signals, diagnostics);
    input.onLookupDiagnostics?.(latestLookupDiagnostics);
  };
  const recognition = await recognizeMagicCard({
    nameObservation: {
      regionType: 'name',
      text: signals.normalizedTitle,
      confidence: signals.ocrConfidence ?? 0,
    },
    collectorInfoText: signals.rawCollectorText ?? undefined,
    collectorInfoObservation: signals.collectorInfo ?? undefined,
    bottomLeftPrintingText: signals.rawBottomLeftPrintingText,
    online: input.online,
    cachedCandidates: input.cachedCandidates,
  }, buildOcrAwareMagicSearch(
    input.searchCatalog ?? cachedScryfallMagicCatalogSearch,
    signals.titleAlternatives,
    onLookupDiagnostics,
    input.searchCatalog ? null : searchScryfallMagicCatalogFuzzy,
    localCandidates,
  ));
  const lookupLatencyMs = Math.max(0, Date.now() - started);
  const cleanupResult = await cleanupCapture();
  if (!recognition.ok) {
    const lookupDiagnostics = latestLookupDiagnostics ?? createStillLookupDiagnostics(signals, {
      queryString: signals.normalizedTitle,
      httpStatus: null,
      responseItemCount: 0,
      errorCode: recognition.code ?? 'no_candidate_found',
      latencyMs: lookupLatencyMs,
      topThreeCandidateNames: [],
    });
    return { ok: false, code: 'candidate_lookup_failed', reason: lookupFailureMessage(recognition), ocr, mapping, cropDiagnostics, signals, lookupDiagnostics, multiSignal: baseMultiSignal, cleanup: cleanupResult };
  }
  const cappedRecognition = capTitleOnlyConfidence(recognition, Boolean(signals.collectorInfo?.setCode), Boolean(signals.collectorInfo?.collectorNumber));
  const scannerCandidates = cappedRecognition.candidates.map(recognitionToScannerCandidate).filter((candidate): candidate is ScannerCardCandidate => Boolean(candidate));
  const multiSignal = input.vision ? recognizeScannerFrameWithFusion({
    vision: input.vision,
    rawOcrText: signals.rawTitle,
    normalizedOcrText: signals.normalizedTitle,
    ocrConfidence: signals.ocrConfidence,
    ocrDurationMs: ocr.latencyMs,
    visualIndex: input.visualIndex,
    printingCandidates: cappedRecognition.candidates,
  }) : baseMultiSignal;
  const visualCandidate = multiSignal?.visual?.record && !scannerCandidates.some((candidate) => candidate.id === multiSignal.visual?.record?.scryfallId)
    ? scannerCandidateFromVisualRecord(multiSignal.visual.record, multiSignal.confidence.overall / 100)
    : null;
  const candidates = visualCandidate && multiSignal?.status === 'append_identity'
    ? [visualCandidate, ...scannerCandidates]
    : scannerCandidates;
  const lookupDiagnostics = latestLookupDiagnostics ?? createStillLookupDiagnostics(signals, {
    queryString: signals.normalizedTitle,
    httpStatus: null,
    responseItemCount: candidates.length,
    errorCode: candidates.length ? null : 'no_candidate_found',
    latencyMs: lookupLatencyMs,
    topThreeCandidateNames: candidates.slice(0, 3).map((candidate) => candidate.name),
  });
  if (!candidates.length) {
    return { ok: false, code: 'candidate_lookup_failed', reason: 'No matching card found. Try again or search manually.', ocr, mapping, cropDiagnostics, signals, lookupDiagnostics, multiSignal, cleanup: cleanupResult };
  }
  const recognitionForResult = multiSignal?.status === 'append_identity' && visualCandidate
    ? recognitionFromFusion(multiSignal, candidates)
    : cappedRecognition;
  return {
    ok: true,
    ocr,
    signals,
    recognition: recognitionForResult,
    candidates,
    selected: candidates[0] ?? null,
    confidenceLabel: confidenceLabel(recognitionForResult),
    mapping,
    cropDiagnostics,
    lookupLatencyMs,
    lookupDiagnostics,
    multiSignal,
    cleanup: cleanupResult,
  };
}

export function buildGuideAssistedCropMapping(input: GuideCropMappingInput): GuideCropMapping {
  return mapPreviewGuideToCapturedImage(input);
}

export function buildRectangleAssistedCropMapping(
  guideMapping: GuideCropMapping,
  rectangleDetection: NativeCardRectangleResult | null,
): GuideCropMapping {
  if (!rectangleDetection?.ok || !rectangleDetection.detected || !rectangleDetection.boundingBox) {
    return {
      ...guideMapping,
      rectangleDetection,
      normalizationSource: 'guide',
      warnings: [
        ...guideMapping.warnings,
        ...(rectangleDetection?.ok === false ? [`Apple Vision rectangle fallback: ${rectangleDetection.code}.`] : []),
      ],
    };
  }
  const rectangleCrop = clampRect(rectangleDetection.boundingBox);
  if (rectangleCrop.width < 0.1 || rectangleCrop.height < 0.1) {
    return {
      ...guideMapping,
      rectangleDetection,
      normalizationSource: 'guide',
      warnings: [...guideMapping.warnings, 'Apple Vision rectangle was too small; guide crop was used.'],
    };
  }
  const regions = buildMagicOcrRegions(rectangleCrop);
  const titleCrop = regions.find((regionEntry) => regionEntry.id === 'title_primary') ?? regions[0];
  const collectorCrop = regions.find((regionEntry) => regionEntry.id === 'collector_info') ?? regions[0];
  const bottomLeftPrintingCrop = regions.find((regionEntry) => regionEntry.id === 'bottomLeftPrintingRegion') ?? collectorCrop;
  return {
    ...guideMapping,
    cardCrop: rectangleCrop,
    cardCropPixels: toPixelRect(rectangleCrop, guideMapping.normalizedImage.width, guideMapping.normalizedImage.height),
    titleCrop: rectFromRegion(titleCrop),
    titleCropPixels: toPixelRect(rectFromRegion(titleCrop), guideMapping.normalizedImage.width, guideMapping.normalizedImage.height),
    collectorCrop: rectFromRegion(collectorCrop),
    collectorCropPixels: toPixelRect(rectFromRegion(collectorCrop), guideMapping.normalizedImage.width, guideMapping.normalizedImage.height),
    bottomLeftPrintingCrop: rectFromRegion(bottomLeftPrintingCrop),
    bottomLeftPrintingCropPixels: toPixelRect(rectFromRegion(bottomLeftPrintingCrop), guideMapping.normalizedImage.width, guideMapping.normalizedImage.height),
    regions,
    rectangleDetection,
    normalizationSource: 'apple_vision_rectangle',
    warnings: [...guideMapping.warnings, 'Apple Vision rectangle crop selected for OCR normalization.'],
  };
}

export function mapPreviewGuideToCapturedImage(input: GuideCropMappingInput): GuideCropMapping {
  const previewWidth = positive(input.preview.width);
  const previewHeight = positive(input.preview.height);
  const rawImageWidth = positive(input.image.width);
  const rawImageHeight = positive(input.image.height);
  const rawOrientation = rawImageWidth >= rawImageHeight ? 'landscape' : 'portrait';
  const previewOrientation = previewWidth >= previewHeight ? 'landscape' : 'portrait';
  const shouldRotateForPreview = rawOrientation !== previewOrientation;
  const imageWidth = shouldRotateForPreview ? rawImageHeight : rawImageWidth;
  const imageHeight = shouldRotateForPreview ? rawImageWidth : rawImageHeight;
  const scale = Math.max(previewWidth / imageWidth, previewHeight / imageHeight);
  const displayedWidth = imageWidth * scale;
  const displayedHeight = imageHeight * scale;
  const offsetX = (previewWidth - displayedWidth) / 2;
  const offsetY = (previewHeight - displayedHeight) / 2;
  const cropPx = {
    x: (input.guide.left - offsetX) / scale,
    y: (input.guide.top - offsetY) / scale,
    width: input.guide.width / scale,
    height: input.guide.height / scale,
  };
  const cardCrop = clampRect({
    x: cropPx.x / imageWidth,
    y: cropPx.y / imageHeight,
    width: cropPx.width / imageWidth,
    height: cropPx.height / imageHeight,
  });
  const warnings: string[] = [];
  if (cardCrop.width < 0.1 || cardCrop.height < 0.1) warnings.push('Guide crop is unusually small for the captured image.');
  if (shouldRotateForPreview) warnings.push('Captured still dimensions were rotated to match the live preview orientation before crop mapping.');
  const regions = buildMagicOcrRegions(cardCrop);
  const titleCrop = regions.find((regionEntry) => regionEntry.id === 'title_primary') ?? regions[0];
  const collectorCrop = regions.find((regionEntry) => regionEntry.id === 'collector_info') ?? regions[0];
  const bottomLeftPrintingCrop = regions.find((regionEntry) => regionEntry.id === 'bottomLeftPrintingRegion') ?? collectorCrop;
  return {
    cardCrop,
    cardCropPixels: toPixelRect(cardCrop, imageWidth, imageHeight),
    titleCrop: rectFromRegion(titleCrop),
    titleCropPixels: toPixelRect(rectFromRegion(titleCrop), imageWidth, imageHeight),
    collectorCrop: rectFromRegion(collectorCrop),
    collectorCropPixels: toPixelRect(rectFromRegion(collectorCrop), imageWidth, imageHeight),
    bottomLeftPrintingCrop: rectFromRegion(bottomLeftPrintingCrop),
    bottomLeftPrintingCropPixels: toPixelRect(rectFromRegion(bottomLeftPrintingCrop), imageWidth, imageHeight),
    rawImage: { width: rawImageWidth, height: rawImageHeight, orientation: rawOrientation },
    normalizedImage: { width: imageWidth, height: imageHeight, orientation: imageWidth >= imageHeight ? 'landscape' : 'portrait', rotatedFromRaw: shouldRotateForPreview },
    previewContentFit: 'cover',
    displayedImage: { width: displayedWidth, height: displayedHeight, offsetX, offsetY },
    imageScale: scale,
    imageOffset: { x: offsetX, y: offsetY },
    regions,
    warnings,
    rectangleDetection: null,
    normalizationSource: 'guide',
  };
}

export function buildMagicOcrRegions(cardCrop: GuideCropMapping['cardCrop']): NativeOcrRegion[] {
  return [
    region(cardCrop, 'title_primary', 'name', 0.055, 0.026, 0.78, 0.13),
    region(cardCrop, 'title_expanded', 'name', 0.04, 0.012, 0.84, 0.18),
    region(cardCrop, 'upper_card', 'name', 0.035, 0.02, 0.93, 0.25),
    region(cardCrop, 'full_card', 'name', 0.035, 0.02, 0.93, 0.93),
    region(cardCrop, 'type_line', 'type_line', 0.07, 0.555, 0.72, 0.075),
    region(cardCrop, 'collector_info', 'collector_info', 0.06, 0.885, 0.62, 0.09),
    region(cardCrop, 'bottomLeftPrintingRegion', 'bottom_left_printing', 0.045, 0.855, 0.5, 0.125),
    region(cardCrop, 'bottom_left', 'bottom_left', 0.06, 0.885, 0.33, 0.09),
    region(cardCrop, 'bottom_right', 'bottom_right', 0.38, 0.885, 0.4, 0.09),
  ];
}

export async function recognizeSequentialMagicTitle(input: {
  imageUri: string;
  regions: NativeOcrRegion[];
  recognize: typeof recognizeText;
  includeCollectorOcr?: boolean;
}): Promise<NativeOcrResult> {
  const selectedObservations: NativeOcrObservation[] = [];
  const warnings: string[] = [];
  let fullText: string[] = [];
  let totalLatencyMs = 0;
  let lastFailure: NativeOcrResult | null = null;
  const titleOrder: MagicTitleOcrAttemptId[] = ['title_primary', 'title_expanded', 'upper_card', 'full_card'];
  for (const regionId of titleOrder) {
    const regionEntry = input.regions.find((regionCandidate) => regionCandidate.id === regionId);
    if (!regionEntry) continue;
    const started = Date.now();
    const result = await input.recognize({
      imageUri: input.imageUri,
      regions: [regionEntry],
      languages: ['en-US'],
      recognitionLevel: 'accurate',
    });
    const latencyMs = Math.max(0, Date.now() - started);
    totalLatencyMs += latencyMs;
    if (!result.ok) {
      lastFailure = result;
      warnings.push(`OCR ${regionId} failed: ${result.message}`);
      continue;
    }
    const observations = result.observations.map((observation) => ({ ...observation, latencyMs }));
    selectedObservations.push(...observations);
    fullText = [...fullText, result.fullText].filter(Boolean);
    const signals = buildMagicOcrSignals(selectedObservations);
    const selected = signals.titleAttempts.find((attempt) => attempt.id === regionId && attempt.normalizedText);
    if (selected?.normalizedText && selected.confidence >= 70 && selected.normalizedText.length >= 3) break;
  }
  const collectorRegion = input.includeCollectorOcr ? input.regions.find((regionEntry) => regionEntry.id === 'collector_info') : null;
  const bottomLeftPrintingRegion = input.includeCollectorOcr ? input.regions.find((regionEntry) => regionEntry.id === 'bottomLeftPrintingRegion') : null;
  if (selectedObservations.some((observation) => observation.regionType === 'name') && collectorRegion) {
    const started = Date.now();
    const collector = await input.recognize({
      imageUri: input.imageUri,
      regions: [collectorRegion],
      languages: ['en-US'],
      recognitionLevel: 'accurate',
    });
    const latencyMs = Math.max(0, Date.now() - started);
    totalLatencyMs += latencyMs;
    if (collector.ok) {
      selectedObservations.push(...collector.observations.map((observation) => ({ ...observation, latencyMs })));
      if (collector.fullText) fullText.push(collector.fullText);
    } else {
      warnings.push(`Optional collector OCR failed: ${collector.message}`);
    }
  }
  if (selectedObservations.some((observation) => observation.regionType === 'name') && bottomLeftPrintingRegion) {
    const started = Date.now();
    const bottomLeftPrinting = await input.recognize({
      imageUri: input.imageUri,
      regions: [bottomLeftPrintingRegion],
      languages: ['en-US'],
      recognitionLevel: 'accurate',
    });
    const latencyMs = Math.max(0, Date.now() - started);
    totalLatencyMs += latencyMs;
    if (bottomLeftPrinting.ok) {
      selectedObservations.push(...bottomLeftPrinting.observations.map((observation) => ({ ...observation, latencyMs })));
      if (bottomLeftPrinting.fullText) fullText.push(bottomLeftPrinting.fullText);
    } else {
      warnings.push(`Optional bottom-left printing OCR failed: ${bottomLeftPrinting.message}`);
    }
  }
  if (selectedObservations.length) {
    return {
      ok: true,
      provider: 'apple_vision',
      fullText: fullText.join('\n'),
      observations: selectedObservations,
      latencyMs: totalLatencyMs,
      orientationUsed: 'sequential',
      warnings,
    };
  }
  return lastFailure ?? {
    ok: false,
    provider: 'apple_vision',
    code: 'empty_result',
    message: 'Apple Vision OCR did not return readable text for the requested regions.',
    latencyMs: totalLatencyMs,
    warnings,
  };
}

export function buildMagicOcrSignals(observations: NativeOcrObservation[]): MagicOcrSignals {
  const titleAttempts = rankMagicTitleObservations(observations);
  const title = titleAttempts.find((attempt) => attempt.normalizedText) ?? null;
  const attemptsWithReasons = titleAttempts.map((attempt) => ({
    ...attempt,
    reason: attempt.id === title?.id ? 'selected' as const : attempt.reason,
  }));
  const collector = observations.filter((entry) => entry.regionType === 'collector_info' || entry.regionType === 'collector_number' || entry.regionType === 'language_rarity' || entry.regionType === 'bottom_left_printing');
  const rawCollectorText = collector.map((entry) => entry.rawText || entry.text).filter(Boolean).join(' ').trim() || null;
  const rawBottomLeftPrintingText = observations
    .filter((entry) => entry.regionType === 'bottom_left_printing' || entry.requestedRegionId === 'bottomLeftPrintingRegion')
    .map((entry) => entry.rawText || entry.text)
    .filter(Boolean)
    .join(' ')
    .trim() || null;
  const rawTitle = title?.rawText ?? null;
  const normalizedTitle = title?.normalizedText ?? null;
  const titleAlternatives = titleAttempts
    .flatMap((attempt) => attempt.rawText ? normalizeMagicTitleOcr(attempt.rawText).alternatives : [])
    .filter(uniqueString);
  return {
    rawTitle,
    normalizedTitle,
    titleAlternatives,
    titleAttempts: attemptsWithReasons,
    selectedTitleAttemptId: title?.id ?? null,
    rawCollectorText,
    rawBottomLeftPrintingText,
    collectorInfo: rawCollectorText ? parseMagicCollectorOcr(rawCollectorText) : null,
    observations,
    ocrConfidence: title?.confidence ?? null,
  };
}

export function normalizeMagicTitleOcr(raw: string): { raw: string; normalized: string; alternatives: string[] } {
  const candidateLines = raw
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[|]/g, 'I')
    .split(/\r?\n/)
    .map(cleanMagicTitleLine)
    .filter((line) => isUsableMagicTitleLine(line))
    .sort((a, b) => scoreTitleLine(b) - scoreTitleLine(a));
  const normalized = (candidateLines[0] ?? cleanMagicTitleLine(raw))
    .replace(/\s+/g, ' ')
    .trim();
  const alternatives = new Set<string>([normalized]);
  alternatives.add(normalized.replace(/\b0f\b/gi, 'of'));
  alternatives.add(normalized.replace(/\brn\b/gi, 'm'));
  alternatives.add(normalized.replace(/\bI(?=[a-z]{2,})/g, 'l'));
  return { raw, normalized, alternatives: [...alternatives].filter((entry) => entry.length >= 2) };
}

export function rankMagicTitleObservations(observations: NativeOcrObservation[]): MagicTitleOcrAttempt[] {
  return observations
    .filter((entry) => entry.regionType === 'name' && isMagicTitleAttemptId(entry.requestedRegionId))
    .map((entry) => {
      const normalized = normalizeMagicTitleOcr(entry.rawText || entry.text);
      const normalizedText = isUsableMagicTitleLine(normalized.normalized) ? normalized.normalized : null;
      const latencyMs = typeof (entry as NativeOcrObservation & { latencyMs?: unknown }).latencyMs === 'number'
        ? (entry as NativeOcrObservation & { latencyMs: number }).latencyMs
        : null;
      return {
        id: entry.requestedRegionId as MagicTitleOcrAttemptId,
        rawText: entry.rawText || entry.text,
        normalizedText,
        confidence: entry.confidence,
        score: titleObservationScore(entry, normalizedText),
        bounds: entry.bounds,
        reason: normalizedText ? 'usable_candidate' as const : 'rejected_noise' as const,
        latencyMs,
        rejectionReason: normalizedText ? null : 'OCR text did not normalize to a usable Magic title.',
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function parseMagicCollectorOcr(raw: string): CollectorInfoObservation {
  const normalized = raw
    .replace(/[\u00b7\u2022]/g, ' ')
    .replace(/\bO(?=\d)/g, '0')
    .replace(/\bS(?=\d)/g, '5')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  const collectorNumber = normalized.match(/\b\d{1,4}[A-Z]?\b/)?.[0] ?? null;
  const language = normalized.match(/\b(EN|JP|JA|DE|FR|ES|IT|PT|KO|RU|ZH)\b/)?.[0]?.toLowerCase() ?? null;
  const setCode = normalized
    .split(/\s+/)
    .find((part) => /^[A-Z0-9]{2,5}$/.test(part) && part !== language?.toUpperCase() && part !== collectorNumber) ?? null;
  return {
    ...parseCollectorInfoText(normalized),
    setCode: setCode ?? parseCollectorInfoText(normalized).setCode,
    collectorNumber: collectorNumber ?? parseCollectorInfoText(normalized).collectorNumber,
    language: language ?? parseCollectorInfoText(normalized).language,
    confidence: normalized ? 68 : 0,
  };
}

export function capTitleOnlyConfidence<T extends MagicRecognitionResult & { ok: true }>(recognition: T, hasSetCode: boolean, hasCollectorNumber: boolean): T {
  const selected = recognition.selected ?? recognition.candidates[0] ?? null;
  const candidateHasExactPrinting = Boolean(selected?.setCode && selected.collectorNumber);
  if (hasSetCode && hasCollectorNumber && candidateHasExactPrinting) return recognition;
  const hasPartialPrintingEvidence = hasSetCode || hasCollectorNumber;
  const cap = hasPartialPrintingEvidence ? 78 : 69;
  const overall = Math.min(recognition.confidence.overall, cap);
  return {
    ...recognition,
    confidence: {
      ...recognition.confidence,
      overall,
      requiresConfirmation: true,
      conflicts: recognition.confidence.conflicts,
    },
    explanation: [
      ...recognition.explanation,
      hasPartialPrintingEvidence
        ? 'Exact-printing confidence is capped until both set code and collector number are observed.'
        : 'Title-only OCR cannot produce high exact-printing confidence.',
    ],
  };
}

export function confidenceLabel(recognition: MagicRecognitionResult & { ok: true }) {
  const presentation = classifyMagicRecognition(recognition.confidence, recognition.candidates.length);
  if (presentation.label === 'Recognized') return 'recognized';
  if (presentation.label === 'Likely') return 'likely';
  if (presentation.label === 'Ambiguous') return 'ambiguous';
  return 'manual_review_required';
}

export async function deleteCapturedStill(imageUri: string | null | undefined): Promise<CaptureCleanupResult> {
  if (!imageUri) return { ok: true, deleted: false, reason: 'no_uri' };
  if (!imageUri.startsWith('file://')) return { ok: true, deleted: false, reason: 'non_file_uri' };
  try {
    const FileSystem = await import('expo-file-system');
    await FileSystem.deleteAsync(imageUri, { idempotent: true });
    return { ok: true, deleted: true };
  } catch (error) {
    return { ok: false, deleted: false, reason: error instanceof Error ? error.message : 'Temporary capture cleanup failed.' };
  }
}

export function buildOcrAwareMagicSearch(
  primary: MagicCatalogSearch,
  alternatives: string[],
  onDiagnostics?: MagicCatalogDiagnosticsSink,
  fuzzySearch: MagicCatalogSearch | null = searchScryfallMagicCatalogFuzzy,
  localFallbackCandidates: RecognitionCandidate[] = [],
): MagicCatalogSearch {
  return async (query) => {
    const exact = await callMagicSearch(primary, query, onDiagnostics);
    if (exact.length || !query.name) return exact;
    for (const alternative of alternatives.filter((entry) => entry && entry !== query.name)) {
      const alternativeExact = await callMagicSearch(primary, { ...query, name: alternative }, onDiagnostics);
      if (alternativeExact.length) return alternativeExact;
    }
    if (!fuzzySearch) return localFallbackCandidates;
    const fuzzy = await callMagicSearch(fuzzySearch, query, onDiagnostics);
    return fuzzy.length ? fuzzy : localFallbackCandidates;
  };
}

async function callMagicSearch(
  search: MagicCatalogSearch,
  query: Parameters<MagicCatalogSearch>[0],
  onDiagnostics?: MagicCatalogDiagnosticsSink,
) {
  try {
    const searchWithDiagnostics = search as MagicCatalogSearch & ((query: Parameters<MagicCatalogSearch>[0], onDiagnostics?: MagicCatalogDiagnosticsSink) => Promise<RecognitionCandidate[]>);
    return await searchWithDiagnostics(query, onDiagnostics);
  } catch (error) {
    if (error instanceof MagicCatalogLookupError && error.code === 'no_candidate_found') return [];
    if (isAbortError(error)) throw new MagicCatalogLookupError('cancelled', 'Card lookup was cancelled.');
    throw error;
  }
}

function createStillLookupDiagnostics(signals: MagicOcrSignals, diagnostics: MagicCatalogLookupDiagnostics): MagicStillScanLookupDiagnostics {
  return {
    outcome: lookupOutcome(diagnostics.errorCode, diagnostics.responseItemCount),
    rawOcrTitle: signals.rawTitle,
    normalizedOcrTitle: signals.normalizedTitle,
    titleAlternatives: signals.titleAlternatives,
    scryfallQueryString: diagnostics.queryString,
    httpStatus: diagnostics.httpStatus,
    responseItemCount: diagnostics.responseItemCount,
    lookupErrorCode: diagnostics.errorCode,
    lookupLatencyMs: diagnostics.latencyMs,
    topThreeCandidateNames: diagnostics.topThreeCandidateNames,
  };
}

function localNameMatchToRecognitionCandidate(match: MagicNameMatch): RecognitionCandidate {
  const entry = match.entry;
  if (!entry) throw new Error('Cannot build a local Magic candidate without a matched catalog entry.');
  return {
    id: entry.scryfallId ?? entry.oracleId,
    oracleId: entry.oracleId,
    name: entry.name,
    setCode: null,
    setName: null,
    collectorNumber: null,
    finishes: ['normal', 'foil', 'etched'],
    language: 'en',
    imageUrl: null,
    confidence: match.score,
    recognitionMode: 'assisted_capture',
    marketPrice: null,
    legalFinishes: ['normal', 'foil', 'etched'],
    layout: null,
    colorIdentity: [],
  };
}

function lookupOutcome(errorCode: MagicCatalogLookupDiagnostics['errorCode'], responseItemCount: number | null): MagicStillScanLookupDiagnostics['outcome'] {
  if (errorCode === 'no_title_read') return 'no_title';
  if (errorCode === 'no_candidate_found') return 'no_match';
  if (errorCode === 'network_unavailable') return 'network_unavailable';
  if (errorCode === 'service_error') return 'service_error';
  if (errorCode === 'invalid_response') return 'invalid_response';
  if (errorCode === 'cancelled') return 'cancelled';
  return responseItemCount && responseItemCount > 0 ? 'success' : 'no_match';
}

function createCropDiagnostics(
  preview: CaptureDimensions,
  guide: GuideCropMappingInput['guide'],
  mapping: GuideCropMapping,
  titleAttempts: MagicTitleOcrAttempt[],
  selectedTitleAttemptId: MagicTitleOcrAttemptId | null,
): MagicStillScanCropDiagnostics {
  return {
    preview,
    rawImage: mapping.rawImage,
    normalizedImage: mapping.normalizedImage,
    previewContentFit: mapping.previewContentFit,
    displayedImage: mapping.displayedImage,
    guide,
    cardCrop: mapping.cardCrop,
    cardCropPixels: mapping.cardCropPixels,
    titleCrops: titleCropMap(mapping),
    titleCrop: mapping.titleCrop,
    titleCropPixels: mapping.titleCropPixels,
    collectorCrop: mapping.collectorCrop,
    collectorCropPixels: mapping.collectorCropPixels,
    bottomLeftPrintingCrop: mapping.bottomLeftPrintingCrop,
    bottomLeftPrintingCropPixels: mapping.bottomLeftPrintingCropPixels,
    selectedTitleAttemptId,
    titleAttempts,
    warnings: mapping.warnings,
  };
}

function titleCropMap(mapping: GuideCropMapping): Record<MagicTitleOcrAttemptId, CropRect> {
  return {
    title_primary: rectFromRegion(mapping.regions.find((regionEntry) => regionEntry.id === 'title_primary')),
    title_expanded: rectFromRegion(mapping.regions.find((regionEntry) => regionEntry.id === 'title_expanded')),
    upper_card: rectFromRegion(mapping.regions.find((regionEntry) => regionEntry.id === 'upper_card')),
    full_card: rectFromRegion(mapping.regions.find((regionEntry) => regionEntry.id === 'full_card')),
    collector_info: rectFromRegion(mapping.regions.find((regionEntry) => regionEntry.id === 'collector_info')),
  };
}

function lookupFailureMessage(recognition: MagicRecognitionResult & { ok: false }) {
  if (recognition.code === 'network_unavailable' || recognition.offline) return 'Network unavailable. Search manually or try again when connected.';
  if (recognition.code === 'invalid_response') return 'Card search returned an invalid response. Try manual search.';
  if (recognition.code === 'service_error') return 'Card search service is unavailable. Try manual search.';
  if (recognition.code === 'no_title_read') return 'No title read. Try again or search manually.';
  if (recognition.code === 'no_candidate_found') return 'No matching card found. Try again or search manually.';
  return recognition.reason;
}

function recognitionToScannerCandidate(candidate: RecognitionCandidate) {
  return normalizeScannerCandidate({
    id: candidate.id,
    oracleId: candidate.oracleId,
    name: candidate.name,
    setCode: candidate.setCode,
    setName: candidate.setName,
    collectorNumber: candidate.collectorNumber,
    finishes: candidate.finishes,
    language: candidate.language,
    imageUrl: candidate.imageUrl,
    confidence: candidate.confidence,
    recognitionMode: 'assisted_capture',
    marketPrice: candidate.marketPrice,
    specialPrintingLabels: candidate.specialPrintingLabels,
    scryfallMetadata: candidate.scryfallMetadata,
  });
}

function recognitionFromFusion(multiSignal: MultiSignalRecognitionResult, candidates: ScannerCardCandidate[]): MagicRecognitionResult & { ok: true } {
  const recognitionCandidates = candidates.map(scannerCandidateToRecognitionCandidate);
  return {
    ok: true,
    selected: recognitionCandidates[0] ?? null,
    candidates: recognitionCandidates,
    source: 'cache',
    confidence: multiSignal.confidence,
    explanation: [
      multiSignal.diagnostics.decisionReason,
      `Visual candidate: ${multiSignal.diagnostics.visualCandidate ?? 'unavailable'}`,
      `OCR candidate: ${multiSignal.diagnostics.ocrCandidate ?? 'unavailable'}`,
    ],
  };
}

function scannerCandidateToRecognitionCandidate(candidate: ScannerCardCandidate): RecognitionCandidate {
  return {
    ...candidate,
    legalFinishes: candidate.finishes,
    layout: null,
    colorIdentity: [],
  };
}

function emptySignals(): MagicOcrSignals {
  return {
    rawTitle: null,
    normalizedTitle: null,
    titleAlternatives: [],
    titleAttempts: [],
    selectedTitleAttemptId: null,
    rawCollectorText: null,
    rawBottomLeftPrintingText: null,
    collectorInfo: null,
    observations: [],
    ocrConfidence: null,
  };
}

function titleObservationScore(entry: NativeOcrObservation, normalizedText: string | null) {
  if (!normalizedText) return 0;
  const attemptWeight: Record<MagicTitleOcrAttemptId, number> = {
    title_primary: 120,
    title_expanded: 105,
    upper_card: 82,
    full_card: -60,
    collector_info: -120,
  };
  const textScore = scoreTitleLine(normalizedText);
  const topCardBonus = entry.bounds.y <= 0.28 ? 26 : entry.bounds.y <= 0.45 ? 8 : -18;
  const lengthBonus = Math.min(28, normalizedText.length * 1.35);
  const fallbackPenalty = entry.requestedRegionId === 'full_card' ? 70 : 0;
  return (attemptWeight[entry.requestedRegionId as MagicTitleOcrAttemptId] ?? 0)
    + entry.confidence
    + textScore
    + topCardBonus
    + lengthBonus
    - fallbackPenalty;
}

function cleanMagicTitleLine(value: string) {
  return value
    .replace(/\{[WUBRGCX0-9/]+\}/gi, ' ')
    .replace(/(^|\s)[WUBRGCX](?=\s|$)/g, ' ')
    .replace(/(^|\s)\d+(?=\s|$)/g, ' ')
    .replace(/[^\p{L}\p{N}'’,.!?:\- //]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isUsableMagicTitleLine(value: string) {
  const clean = value.trim();
  if (clean.length < 2) return false;
  if (/^\d+$/.test(clean)) return false;
  if (/^[WUBRGCX]$/i.test(clean)) return false;
  if (!/\p{L}/u.test(clean)) return false;
  return true;
}

function scoreTitleLine(value: string) {
  const alphaCount = (value.match(/\p{L}/gu) ?? []).length;
  const digitCount = (value.match(/\d/g) ?? []).length;
  const wordCount = value.split(/\s+/).filter(Boolean).length;
  const punctuationPenalty = (value.match(/[^\p{L}\p{N}'’,.!?:\- ]/gu) ?? []).length * 8;
  const digitPenalty = digitCount > alphaCount ? 24 : digitCount * 2;
  return alphaCount * 4 + Math.min(wordCount, 5) * 12 - punctuationPenalty - digitPenalty;
}

function isMagicTitleAttemptId(value: string): value is MagicTitleOcrAttemptId {
  return value === 'title_primary' || value === 'title_expanded' || value === 'upper_card' || value === 'full_card' || value === 'collector_info';
}

function uniqueString(value: string, index: number, array: string[]) {
  return Boolean(value) && array.indexOf(value) === index;
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

function region(
  cardCrop: GuideCropMapping['cardCrop'],
  id: string,
  regionType: NativeOcrRegion['regionType'],
  x: number,
  y: number,
  width: number,
  height: number,
): NativeOcrRegion {
  return {
    id,
    regionType,
    ...clampRect({
      x: cardCrop.x + cardCrop.width * x,
      y: cardCrop.y + cardCrop.height * y,
      width: cardCrop.width * width,
      height: cardCrop.height * height,
    }),
  };
}

function clampRect(rect: { x: number; y: number; width: number; height: number }) {
  const x = clamp01(rect.x);
  const y = clamp01(rect.y);
  return {
    x,
    y,
    width: Math.max(0.001, Math.min(rect.width, 1 - x)),
    height: Math.max(0.001, Math.min(rect.height, 1 - y)),
  };
}

function rectFromRegion(regionEntry: NativeOcrRegion | undefined): CropRect {
  if (!regionEntry) return { x: 0, y: 0, width: 0.001, height: 0.001 };
  return {
    x: regionEntry.x,
    y: regionEntry.y,
    width: regionEntry.width,
    height: regionEntry.height,
  };
}

function toPixelRect(rect: CropRect, imageWidth: number, imageHeight: number): PixelRect {
  return {
    x: Math.round(rect.x * imageWidth),
    y: Math.round(rect.y * imageHeight),
    width: Math.round(rect.width * imageWidth),
    height: Math.round(rect.height * imageHeight),
  };
}

function positive(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
