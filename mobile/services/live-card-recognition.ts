import {
  DEFAULT_CONTINUOUS_SCANNER_THRESHOLDS,
  TRADING_CARD_GUIDE_RATIO,
  evaluateBoundaryQuality,
  type CardBoundaryObservation,
  type ContinuousScannerThresholds,
  type ScannerGuideLayout,
} from './continuous-offer-scanner.ts';
import {
  classifyFinishFromFrames,
  parseCollectorInfoText,
  type FinishObservation,
  type OCRObservation,
  type RecognitionCandidate,
  type ScannerFrame,
} from './scanner-intelligence.ts';
import {
  recognizeMagicCard,
  type MagicRecognitionInput,
} from './magic-recognition-provider.ts';

export type LiveFramePixelFormat = 'luma8';

export type LiveFrameSample = {
  id: string;
  userId: string;
  capturedAt: number;
  width: number;
  height: number;
  pixels: ArrayLike<number>;
  pixelFormat: LiveFramePixelFormat;
  orientation: 'portrait' | 'landscape';
};

export type LiveFrameAnalysisConfig = {
  guide: ScannerGuideLayout;
  thresholds: ContinuousScannerThresholds;
  aspectRatioTolerance: number;
  edgeThreshold: number;
  minCardPixelRatio: number;
};

export type LiveFrameAnalysisResult = {
  frameId: string;
  observation: CardBoundaryObservation;
  guidance: string;
  readyForAutoCapture: boolean;
  aspectRatio: number | null;
  aspectRatioOk: boolean;
  crop: NormalizedCardCrop | null;
};

export type NormalizedCardCrop = {
  frameId: string;
  bounds: { x: number; y: number; width: number; height: number };
  corners: CardBoundaryObservation['corners'];
  orientation: 'portrait' | 'landscape';
  perspectiveCorrected: boolean;
  fingerprint: string;
};

export type TargetedOcrRegion = 'title' | 'collector_info' | 'set_code' | 'collector_number' | 'language';

export type TargetedOcrReading = {
  region: TargetedOcrRegion;
  text: string;
  confidence: number;
  bounds: { x: number; y: number; width: number; height: number };
};

export type LiveMagicRecognitionProviderInput = {
  frame: LiveFrameSample;
  crop: NormalizedCardCrop;
  ocrReadings: TargetedOcrReading[];
  catalogCandidates: RecognitionCandidate[];
  finishFrames?: ScannerFrame[];
  online: boolean;
};

export type LiveRecognitionProviderStatus = {
  visionCameraInstalled: boolean;
  usesDevelopmentBuild: boolean;
  expoGoSupported: false;
  frameProcessorNativeModule: 'vision-camera';
  ocrProvider: 'targeted-region-contract';
  artworkProvider: 'perceptual-fingerprint-contract';
};

export const DEFAULT_LIVE_FRAME_ANALYSIS_CONFIG: Omit<LiveFrameAnalysisConfig, 'guide'> = {
  thresholds: { ...DEFAULT_CONTINUOUS_SCANNER_THRESHOLDS, requiredStabilityMs: 650, maxBlurScore: 0.55 },
  aspectRatioTolerance: 0.12,
  edgeThreshold: 34,
  minCardPixelRatio: 0.04,
};

export const LIVE_RECOGNITION_PROVIDER_STATUS: LiveRecognitionProviderStatus = {
  visionCameraInstalled: true,
  usesDevelopmentBuild: true,
  expoGoSupported: false,
  frameProcessorNativeModule: 'vision-camera',
  ocrProvider: 'targeted-region-contract',
  artworkProvider: 'perceptual-fingerprint-contract',
};

export function analyzeLiveFrame(
  frame: LiveFrameSample,
  config: LiveFrameAnalysisConfig,
  previous?: LiveFrameSample | null,
): LiveFrameAnalysisResult {
  validateFrame(frame);
  const bounds = detectCardBounds(frame, config);
  const crop = bounds ? cropFromBounds(frame, bounds) : null;
  const aspectRatio = bounds ? bounds.width / bounds.height : null;
  const aspectRatioOk = aspectRatio !== null && Math.abs(aspectRatio - TRADING_CARD_GUIDE_RATIO) <= config.aspectRatioTolerance;
  const motionScore = previous ? motionBetweenFrames(previous, frame) : 0;
  const blurScore = blurFromLaplacian(frame, bounds);
  const lightingScore = lightingFromMean(frame, bounds);
  const glareScore = glareFromHighlights(frame, bounds);
  const guideFillRatio = bounds ? Math.min(1, Math.max(bounds.width / config.guide.width, bounds.height / config.guide.height)) : 0;
  const fullyInsideGuide = bounds ? isInsideGuide(bounds, config.guide) : false;
  const perspectiveScore = aspectRatio === null ? 1 : Math.abs(aspectRatio - TRADING_CARD_GUIDE_RATIO) / TRADING_CARD_GUIDE_RATIO;
  const observation: CardBoundaryObservation = {
    corners: crop?.corners ?? invisibleCorners(),
    fullyInsideGuide,
    guideFillRatio,
    perspectiveScore,
    motionScore,
    blurScore,
    glareScore,
    lightingScore,
    stabilityMs: motionScore <= config.thresholds.maxMotionScore ? config.thresholds.requiredStabilityMs : 0,
    cardPresent: Boolean(bounds && bounds.width * bounds.height >= frame.width * frame.height * config.minCardPixelRatio),
    orientation: frame.orientation,
    imageFingerprint: crop?.fingerprint ?? null,
    observedAt: frame.capturedAt,
  };
  const quality = evaluateBoundaryQuality(observation, config.thresholds);
  const readyForAutoCapture = quality.ready && aspectRatioOk;
  return {
    frameId: frame.id,
    observation,
    guidance: primaryGuidance(quality.guidance, aspectRatioOk),
    readyForAutoCapture,
    aspectRatio,
    aspectRatioOk,
    crop,
  };
}

export function mapTargetedOcrToMagicInput(input: {
  readings: TargetedOcrReading[];
  crop: NormalizedCardCrop;
  catalogCandidates: RecognitionCandidate[];
  finish?: FinishObservation;
  online: boolean;
}): MagicRecognitionInput {
  const title = bestReading(input.readings, 'title');
  const collectorInfo = [
    bestReading(input.readings, 'collector_info')?.text,
    bestReading(input.readings, 'set_code')?.text,
    bestReading(input.readings, 'collector_number')?.text,
    bestReading(input.readings, 'language')?.text,
  ].filter(Boolean).join(' ');
  return {
    nameObservation: title ? ocrObservation('name', normalizeOcrText(title.text), title.confidence) : undefined,
    collectorInfoText: collectorInfo || undefined,
    collectorInfoObservation: collectorInfo ? parseCollectorInfoText(normalizeCollectorInfoOcr(collectorInfo)) : undefined,
    artworkObservation: {
      fingerprint: input.crop.fingerprint,
      layout: input.crop.orientation,
      similarity: input.catalogCandidates.length ? 0.42 : 0,
    },
    finishObservation: input.finish,
    online: input.online,
    cachedCandidates: input.catalogCandidates,
  };
}

export async function recognizeMagicFromLiveFrame(input: LiveMagicRecognitionProviderInput) {
  const finish = input.finishFrames?.length ? classifyFinishFromFrames(input.finishFrames) : {
    finish: 'indeterminate',
    confidence: 0,
    evidence: ['No multi-frame foil evidence was captured.'],
    frameCount: 0,
  } satisfies FinishObservation;
  return recognizeMagicCard(mapTargetedOcrToMagicInput({
    readings: input.ocrReadings,
    crop: input.crop,
    catalogCandidates: input.catalogCandidates,
    finish,
    online: input.online,
  }));
}

export function normalizeOcrText(text: string) {
  return text
    .replace(/[|]/g, 'I')
    .replace(/\b0f\b/gi, 'of')
    .replace(/\brn\b/gi, 'm')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeCollectorInfoOcr(text: string) {
  return normalizeOcrText(text)
    .replace(/\bO(?=\d)/g, '0')
    .replace(/\bS(?=\d)/g, '5')
    .replace(/[\u00b7\u2022]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function detectCardBounds(frame: LiveFrameSample, config: LiveFrameAnalysisConfig) {
  let minX = frame.width;
  let minY = frame.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 1; y < frame.height - 1; y += 1) {
    for (let x = 1; x < frame.width - 1; x += 1) {
      const value = pixel(frame, x, y);
      const dx = Math.abs(value - pixel(frame, x - 1, y)) + Math.abs(value - pixel(frame, x + 1, y));
      const dy = Math.abs(value - pixel(frame, x, y - 1)) + Math.abs(value - pixel(frame, x, y + 1));
      if (dx + dy < config.edgeThreshold) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function cropFromBounds(frame: LiveFrameSample, bounds: { x: number; y: number; width: number; height: number }): NormalizedCardCrop {
  const corners: CardBoundaryObservation['corners'] = [
    { x: bounds.x / frame.width, y: bounds.y / frame.height, visible: true },
    { x: (bounds.x + bounds.width) / frame.width, y: bounds.y / frame.height, visible: true },
    { x: (bounds.x + bounds.width) / frame.width, y: (bounds.y + bounds.height) / frame.height, visible: true },
    { x: bounds.x / frame.width, y: (bounds.y + bounds.height) / frame.height, visible: true },
  ];
  return {
    frameId: frame.id,
    bounds,
    corners,
    orientation: bounds.width > bounds.height ? 'landscape' : 'portrait',
    perspectiveCorrected: false,
    fingerprint: fingerprintFrame(frame, bounds),
  };
}

function isInsideGuide(bounds: { x: number; y: number; width: number; height: number }, guide: ScannerGuideLayout) {
  return bounds.x >= guide.left
    && bounds.y >= guide.top
    && bounds.x + bounds.width <= guide.left + guide.width
    && bounds.y + bounds.height <= guide.top + guide.height;
}

function blurFromLaplacian(frame: LiveFrameSample, bounds: { x: number; y: number; width: number; height: number } | null) {
  if (!bounds) return 1;
  let total = 0;
  let count = 0;
  const step = Math.max(1, Math.floor(Math.min(bounds.width, bounds.height) / 24));
  for (let y = bounds.y + 1; y < bounds.y + bounds.height - 1; y += step) {
    for (let x = bounds.x + 1; x < bounds.x + bounds.width - 1; x += step) {
      const center = pixel(frame, x, y) * 4;
      const laplacian = Math.abs(center - pixel(frame, x - 1, y) - pixel(frame, x + 1, y) - pixel(frame, x, y - 1) - pixel(frame, x, y + 1));
      total += laplacian;
      count += 1;
    }
  }
  const sharpness = count ? total / count : 0;
  return Math.max(0, Math.min(1, 1 - sharpness / 80));
}

function motionBetweenFrames(previous: LiveFrameSample, current: LiveFrameSample) {
  if (previous.width !== current.width || previous.height !== current.height) return 1;
  const step = Math.max(1, Math.floor(Math.sqrt(current.width * current.height / 400)));
  let delta = 0;
  let count = 0;
  for (let y = 0; y < current.height; y += step) {
    for (let x = 0; x < current.width; x += step) {
      delta += Math.abs(pixel(previous, x, y) - pixel(current, x, y));
      count += 1;
    }
  }
  return Math.max(0, Math.min(1, (count ? delta / count : 255) / 128));
}

function lightingFromMean(frame: LiveFrameSample, bounds: { x: number; y: number; width: number; height: number } | null) {
  const stats = frameStats(frame, bounds);
  const centered = 1 - Math.abs(stats.mean - 136) / 136;
  return Math.max(0, Math.min(1, centered));
}

function glareFromHighlights(frame: LiveFrameSample, bounds: { x: number; y: number; width: number; height: number } | null) {
  const stats = frameStats(frame, bounds);
  return Math.max(0, Math.min(1, stats.highlightRatio * 4));
}

function fingerprintFrame(frame: LiveFrameSample, bounds: { x: number; y: number; width: number; height: number }) {
  const grid = 8;
  const bits: string[] = [];
  const stats = frameStats(frame, bounds);
  for (let gy = 0; gy < grid; gy += 1) {
    for (let gx = 0; gx < grid; gx += 1) {
      const x = Math.min(frame.width - 1, Math.floor(bounds.x + (gx + 0.5) * bounds.width / grid));
      const y = Math.min(frame.height - 1, Math.floor(bounds.y + (gy + 0.5) * bounds.height / grid));
      bits.push(pixel(frame, x, y) >= stats.mean ? '1' : '0');
    }
  }
  return parseInt(bits.join('').slice(0, 32), 2).toString(16).padStart(8, '0')
    + parseInt(bits.join('').slice(32), 2).toString(16).padStart(8, '0');
}

function frameStats(frame: LiveFrameSample, bounds: { x: number; y: number; width: number; height: number } | null) {
  const region = bounds ?? { x: 0, y: 0, width: frame.width, height: frame.height };
  let total = 0;
  let count = 0;
  let highlights = 0;
  const step = Math.max(1, Math.floor(Math.min(region.width, region.height) / 32));
  for (let y = region.y; y < region.y + region.height; y += step) {
    for (let x = region.x; x < region.x + region.width; x += step) {
      const value = pixel(frame, x, y);
      total += value;
      count += 1;
      if (value >= 238) highlights += 1;
    }
  }
  return { mean: count ? total / count : 0, highlightRatio: count ? highlights / count : 0 };
}

function primaryGuidance(guidance: string[], aspectRatioOk: boolean) {
  if (!aspectRatioOk) return 'Show all four edges';
  if (guidance.includes('Improve lighting')) return 'Improve lighting';
  if (guidance.includes('Reduce glare')) return 'Reduce glare';
  if (guidance.includes('Hold steady')) return 'Hold steady';
  const first = guidance[0] ?? 'Ready';
  return first === 'Ready to scan' ? 'Ready' : first;
}

function ocrObservation(regionType: OCRObservation['regionType'], text: string, confidence: number): OCRObservation {
  return { regionType, text, confidence: Math.max(0, Math.min(100, Math.round(confidence))) };
}

function bestReading(readings: TargetedOcrReading[], region: TargetedOcrRegion) {
  return readings
    .filter((reading) => reading.region === region && reading.text.trim())
    .sort((a, b) => b.confidence - a.confidence)[0];
}

function invisibleCorners(): CardBoundaryObservation['corners'] {
  return [
    { x: 0, y: 0, visible: false },
    { x: 0, y: 0, visible: false },
    { x: 0, y: 0, visible: false },
    { x: 0, y: 0, visible: false },
  ];
}

function validateFrame(frame: LiveFrameSample) {
  if (frame.pixelFormat !== 'luma8') throw new Error('Only luma8 frame samples are supported by the first local analyzer.');
  if (frame.width <= 0 || frame.height <= 0) throw new Error('Frame dimensions must be positive.');
  if (frame.pixels.length < frame.width * frame.height) throw new Error('Frame sample is shorter than its dimensions.');
}

function pixel(frame: LiveFrameSample, x: number, y: number) {
  return frame.pixels[y * frame.width + x] ?? 0;
}
