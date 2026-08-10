import {
  DEFAULT_CONTINUOUS_SCANNER_THRESHOLDS,
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
import { createScannerVisionEngine } from './scanner-vision-engine.ts';

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
  const engine = createScannerVisionEngine({
    config,
    initialState: {
      previousFrame: previous ?? null,
      stableSince: previous ? previous.capturedAt : frame.capturedAt - config.thresholds.requiredStabilityMs,
      lastFrameAt: previous?.capturedAt ?? null,
    },
  });
  const result = engine.analyzeFrame(frame);
  return {
    frameId: frame.id,
    observation: result.observation,
    guidance: result.guidance,
    readyForAutoCapture: result.readyForAutoCapture,
    aspectRatio: result.detection.aspectRatio,
    aspectRatioOk: result.detection.aspectRatio !== null && Math.abs(result.detection.aspectRatio - config.guide.ratio) <= config.aspectRatioTolerance,
    crop: result.crop,
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

function ocrObservation(regionType: OCRObservation['regionType'], text: string, confidence: number): OCRObservation {
  return { regionType, text, confidence: Math.max(0, Math.min(100, Math.round(confidence))) };
}

function bestReading(readings: TargetedOcrReading[], region: TargetedOcrRegion) {
  return readings
    .filter((reading) => reading.region === region && reading.text.trim())
    .sort((a, b) => b.confidence - a.confidence)[0];
}
