import { recognizeText, type NativeOcrObservation, type NativeOcrRegion, type NativeOcrResult } from '../modules/trading-docks-vision-ocr/index.ts';
import {
  classifyMagicRecognition,
  recognizeMagicCard,
  searchScryfallMagicCatalog,
  searchScryfallMagicCatalogFuzzy,
  type MagicCatalogSearch,
  type MagicRecognitionResult,
} from './magic-recognition-provider.ts';
import type { ScannerGuideLayout } from './continuous-offer-scanner.ts';
import { normalizeScannerCandidate, type ScannerCardCandidate } from './scanner-foundation.ts';
import { parseCollectorInfoText, type CollectorInfoObservation, type OCRObservation, type RecognitionCandidate } from './scanner-intelligence.ts';

export type CaptureDimensions = { width: number; height: number };
export type GuideCropMappingInput = {
  preview: CaptureDimensions;
  image: CaptureDimensions;
  guide: Pick<ScannerGuideLayout, 'left' | 'top' | 'width' | 'height'>;
  orientation?: 'portrait' | 'landscape';
};

export type GuideCropMapping = {
  cardCrop: { x: number; y: number; width: number; height: number };
  imageScale: number;
  imageOffset: { x: number; y: number };
  regions: NativeOcrRegion[];
  warnings: string[];
};

export type MagicOcrSignals = {
  rawTitle: string | null;
  normalizedTitle: string | null;
  titleAlternatives: string[];
  rawCollectorText: string | null;
  collectorInfo: CollectorInfoObservation | null;
  observations: NativeOcrObservation[];
  ocrConfidence: number | null;
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
    lookupLatencyMs: number;
    cleanup: CaptureCleanupResult;
  }
  | {
    ok: false;
    reason: string;
    code: 'ocr_failed' | 'candidate_lookup_failed' | 'cleanup_failed';
    ocr?: NativeOcrResult;
    mapping?: GuideCropMapping;
    cleanup?: CaptureCleanupResult;
  };

export type CaptureCleanupResult =
  | { ok: true; deleted: true }
  | { ok: true; deleted: false; reason: 'no_uri' | 'non_file_uri' }
  | { ok: false; deleted: false; reason: string };

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
  onStage?: (stage: 'reading_title' | 'finding_card') => void;
}): Promise<MagicStillScanResult> {
  const mapping = buildGuideAssistedCropMapping({
    preview: input.preview,
    image: input.image,
    guide: input.guide,
  });
  const cleanup = input.cleanup ?? deleteCapturedStill;
  input.onStage?.('reading_title');
  const ocr = await (input.recognize ?? recognizeText)({
    imageUri: input.imageUri,
    regions: mapping.regions,
    languages: ['en-US'],
    recognitionLevel: 'accurate',
  });
  if (!ocr.ok) {
    const cleanupResult = await cleanup(input.imageUri);
    return { ok: false, code: 'ocr_failed', reason: ocr.message, ocr, mapping, cleanup: cleanupResult };
  }

  const signals = buildMagicOcrSignals(ocr.observations);
  if (!signals.normalizedTitle) {
    const cleanupResult = await cleanup(input.imageUri);
    return { ok: false, code: 'candidate_lookup_failed', reason: 'OCR did not find a usable card title.', ocr, mapping, cleanup: cleanupResult };
  }

  input.onStage?.('finding_card');
  const started = Date.now();
  const recognition = await recognizeMagicCard({
    nameObservation: {
      regionType: 'name',
      text: signals.normalizedTitle,
      confidence: signals.ocrConfidence ?? 0,
    },
    collectorInfoText: signals.rawCollectorText ?? undefined,
    collectorInfoObservation: signals.collectorInfo ?? undefined,
    online: input.online,
    cachedCandidates: input.cachedCandidates,
  }, buildOcrAwareMagicSearch(input.searchCatalog ?? searchScryfallMagicCatalog, signals.titleAlternatives));
  const lookupLatencyMs = Math.max(0, Date.now() - started);
  const cleanupResult = await cleanup(input.imageUri);
  if (!recognition.ok) {
    return { ok: false, code: 'candidate_lookup_failed', reason: recognition.reason, ocr, mapping, cleanup: cleanupResult };
  }
  const cappedRecognition = capTitleOnlyConfidence(recognition, Boolean(signals.collectorInfo?.setCode), Boolean(signals.collectorInfo?.collectorNumber));
  const candidates = cappedRecognition.candidates.map(recognitionToScannerCandidate).filter((candidate): candidate is ScannerCardCandidate => Boolean(candidate));
  return {
    ok: true,
    ocr,
    signals,
    recognition: cappedRecognition,
    candidates,
    selected: candidates[0] ?? null,
    confidenceLabel: confidenceLabel(cappedRecognition),
    mapping,
    lookupLatencyMs,
    cleanup: cleanupResult,
  };
}

export function buildGuideAssistedCropMapping(input: GuideCropMappingInput): GuideCropMapping {
  const previewWidth = positive(input.preview.width);
  const previewHeight = positive(input.preview.height);
  const imageWidth = positive(input.image.width);
  const imageHeight = positive(input.image.height);
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
  return {
    cardCrop,
    imageScale: scale,
    imageOffset: { x: offsetX, y: offsetY },
    regions: buildMagicOcrRegions(cardCrop),
    warnings,
  };
}

export function buildMagicOcrRegions(cardCrop: GuideCropMapping['cardCrop']): NativeOcrRegion[] {
  return [
    region(cardCrop, 'title', 'name', 0.07, 0.035, 0.7, 0.095),
    region(cardCrop, 'type_line', 'type_line', 0.07, 0.555, 0.72, 0.075),
    region(cardCrop, 'collector_info', 'collector_info', 0.06, 0.885, 0.62, 0.09),
    region(cardCrop, 'bottom_left', 'bottom_left', 0.06, 0.885, 0.33, 0.09),
    region(cardCrop, 'bottom_right', 'bottom_right', 0.38, 0.885, 0.4, 0.09),
  ];
}

export function buildMagicOcrSignals(observations: NativeOcrObservation[]): MagicOcrSignals {
  const title = bestObservation(observations, 'name');
  const collector = observations.filter((entry) => entry.regionType === 'collector_info' || entry.regionType === 'collector_number' || entry.regionType === 'language_rarity');
  const rawCollectorText = collector.map((entry) => entry.rawText || entry.text).filter(Boolean).join(' ').trim() || null;
  const rawTitle = title?.rawText ?? title?.text ?? null;
  const normalizedTitle = rawTitle ? normalizeMagicTitleOcr(rawTitle).normalized : null;
  const titleAlternatives = rawTitle ? normalizeMagicTitleOcr(rawTitle).alternatives : [];
  return {
    rawTitle,
    normalizedTitle,
    titleAlternatives,
    rawCollectorText,
    collectorInfo: rawCollectorText ? parseMagicCollectorOcr(rawCollectorText) : null,
    observations,
    ocrConfidence: title?.confidence ?? null,
  };
}

export function normalizeMagicTitleOcr(raw: string): { raw: string; normalized: string; alternatives: string[] } {
  const normalized = raw
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[|]/g, 'I')
    .replace(/\s+/g, ' ')
    .trim();
  const alternatives = new Set<string>([normalized]);
  alternatives.add(normalized.replace(/\b0f\b/gi, 'of'));
  alternatives.add(normalized.replace(/\brn\b/gi, 'm'));
  alternatives.add(normalized.replace(/\bI(?=[a-z]{2,})/g, 'l'));
  return { raw, normalized, alternatives: [...alternatives].filter((entry) => entry.length >= 2) };
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
  if (hasSetCode && hasCollectorNumber) return recognition;
  const cap = hasSetCode || hasCollectorNumber ? 78 : 69;
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
      hasSetCode || hasCollectorNumber
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

export function buildOcrAwareMagicSearch(primary: MagicCatalogSearch, alternatives: string[]): MagicCatalogSearch {
  return async (query) => {
    const exact = await primary(query);
    if (exact.length || !query.name) return exact;
    for (const alternative of alternatives.filter((entry) => entry && entry !== query.name)) {
      const alternativeExact = await primary({ ...query, name: alternative });
      if (alternativeExact.length) return alternativeExact;
    }
    return searchScryfallMagicCatalogFuzzy(query);
  };
}

function recognitionToScannerCandidate(candidate: RecognitionCandidate) {
  return normalizeScannerCandidate({
    id: candidate.id,
    name: candidate.name,
    setCode: candidate.setCode,
    setName: candidate.setName,
    collectorNumber: candidate.collectorNumber,
    finishes: candidate.finishes,
    language: candidate.language,
    imageUrl: candidate.imageUrl,
    confidence: candidate.confidence,
    recognitionMode: 'assisted_capture',
  });
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

function bestObservation(observations: NativeOcrObservation[], regionType: OCRObservation['regionType']) {
  return observations
    .filter((entry) => entry.regionType === regionType && entry.text.trim())
    .sort((a, b) => b.confidence - a.confidence)[0];
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

function positive(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
